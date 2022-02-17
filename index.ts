import * as fs from 'fs';
import * as localtunnel from 'localtunnel';
import { WebSocketServer, WebSocket } from 'ws';
import * as liveServer from 'live-server';

// Fallback if the config is empty
// How often should the RSSI be scanned
let quantity = 10;
// How much time should be between the scans.
let timing = 500;
// Defaults to the Port 8181
let webport = 8181;

// Here the config is loaded from the JSON File that can be edited by the user.
(async () => {
  let config;
  let rawdata = await fs.readFileSync('config.json');
  if(rawdata.toString() !== "") {
    config = JSON.parse(rawdata.toString());
  } else {
    console.log('No config present!');
  }
  if(config) {
    quantity = config.measurements.quantity;
    timing = config.measurements.time_per_scan;
    webport = config.port;
  }
  startLiveServer();
})();


let deviceList: DeviceList[] = [];
let names: string[] = [];

function startLiveServer() {
  // Parameter for the Live Server
  const params = {
    port: webport, // Set the server port. Defaults to 8080.
    host: "0.0.0.0", // Set the address to bind to. Defaults to 0.0.0.0 or process.env.IP.
    root: "", // Set root directory that's being served. Defaults to cwd.
    open: true, // When false, it won't load your browser by default.
    ignore: 'README.ME,package.json', // comma-separated string for paths to ignore
    file: "visualizer.html", // When set, serve this file (server root relative) for every 404 (useful for single-page applications)
    wait: 1000, // Waits for all changes, before reloading. Defaults to 0 sec.
    // mount: [['/data', './src']], // Mount a directory to a route.
  };
  // Start the Live Server
  liveServer.start(params);
}

(async () => {
    const tunnel: localtunnel.Tunnel = await localtunnel({ port: 3030, subdomain: 'blebeacon' });

    console.log('The Tunnel for scanning Devices is running on %s', tunnel.url);

    tunnel.on('close', () => {
        console.log('Tunnel is closed!');
    });

    question();
})();

// Commandline questions.
let rl:any;
async function question() {

  const readline = await import('readline');
  rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
  });

  rl.question('What is the actual distance of the devices right now (in cm)?\n', function (distance: string) {
    let distanceNumber = Number(distance);
    if(distanceNumber) {
      measure(distanceNumber);
    } else {
      console.log('Not a Number, try again!');
      rl.close();
      question();
    }
  })

  rl.on('close', function() {
    process.stdout.write('.\n');
    return;
  })
}

// Measurement Timing
async function measure(_distance: number) {
  let datasets: number[][][] = [];
  deviceList.forEach(device => {
    datasets.push([]);
  });
  for (let i = 0; i < quantity; i++) {
    await new Promise(r => setTimeout(r, timing));
    let string = '\rTaking Measurements';
    if (i%3 === 0) {
      string += ".  ";
    } else if (i%3 === 1) {
      string += ".. ";
    } else if (i%3 === 2) {
      string += "...";
    }
    process.stdout.write(string);
    // The RSSI is pushed after "timing"-milliseconds.
    deviceList.forEach((device, i) => {
      datasets[i].push([_distance, device.foundDevices[0].rawRssi]);
    });
  }
  datasets.forEach((dataset, index) => {
    dataToLog(dataset, index);
  });
  
  process.stdout.write('\rMeasurements are completed!\n');
  rl.close();
  question();
}

// Writes the scanned Data to data.json
async function dataToLog(_set: number[][], _index: number) {

  let rawdata: Buffer;
  try {
    rawdata = await fs.readFileSync('data/data' + _index + '.json');
  } catch (err) {
    // if there is no file found to be read, a new file is created.
    console.log('creating new data file data' + _index + '.json...');
  }
  if(rawdata && rawdata.toString() !== '') { // If a data file is found
    let pastData = JSON.parse(rawdata.toString());

    if(Array.isArray(pastData)) { // If the data in data.json is already an Array
      _set.forEach(element => {
        pastData.push(element)
      });
      // If new data is written, sort it by x-Value
      pastData.sort((a, b) => a[0] - b[0]);
      fs.writeFile('data/data' + _index + '.json', JSON.stringify(pastData), err => {
        if (err) {
          console.error(err);
          return;
        }
      });
    }
  } else { // The case that data.json is empty or doesn't exist
    fs.appendFile('data/data' + _index + '.json', JSON.stringify(_set) + '\n', err => {
      if (err) {
        console.error(err);
        return;
      }
    });
  }

}

// To give every new connected client its unique id.
function getUniqueID(): string {
  // There are 16777215 possible ID's with 6 Hex-Numbers. Padding with 0 if code is too short.
  // The first 4 are reserved for fix Devices therefore we start at 4 till 16777214.
  let newID: string = (4 + Math.floor(Math.random() * 16777211)).toString(16).padStart(6, '0');

  if (deviceList.some(element => element.id === newID)) {
    newID = getUniqueID();
  }

  return newID;
}

// Set up Servercommunication with mobile Device
const wssP: WebSocketServer = new WebSocketServer({ port: 3030 });

// Wire up some logic for the connection event (when a client connects) 
wssP.on('connection', function connection(ws: WebSocket): void {

  // Wire up logic for the message event (when a client sends something)
  ws.on('message', function incoming(message: string): void {
    const jsonMessage: any = JSON.parse(message);

    // Register if there is not already an id present.
    if (!jsonMessage.id) {
      const playerID: string = getUniqueID();
      // Send the Client his new ID
      ws.send(JSON.stringify({id: playerID}));
      //deviceList.push(jsonMessage);
      console.log('new ID was send!');
    } else {
      
      if (deviceList.some(element => element.id === jsonMessage.id)) {
        // *** Grenzfall: ID ist jemand anderem zugeteilt und man loggt sich mit der eigenen ID neue ein.***
        // If the Client is already registered and can just send Data.
        deviceList.some(element => { 
          if (element.id === jsonMessage.id) {
            element.foundDevices = jsonMessage.list;
            element.timeout = false;
          }
        });
      } else {
        // The Client already has an ID but is not registered in the Server.
        // The Player is just added to the List if he received some signal of another Player.
        if (!(jsonMessage.list === [])) {
          addToDeviceList({id: jsonMessage.id, foundDevices: jsonMessage.list, timeout: false});
          console.log('Client first connect or reconnect after being disconnected: %o', jsonMessage.id);
        } else {
          console.log('Player %s did not send any Data, maybe the Device is not advertising!', jsonMessage.id);
        }
      }
    }
  });

  // Send a message
  ws.send('Hello client!');
});

wssP.on('close', function close(): void {
  console.log('Connection closed!');
});

/**
 * This Function sorts the Device into the right place of the device array. The List is sorted after id's.
 * (Die Funktion könnte rechnerisch verbessert werden, indem man in der mitte des Arrays anfängt und sich so zu seinem Platz hin halbiert)
 * @param item 
 */
 function addToDeviceList(item: DeviceList): void {

  deviceList.push(item);
  names.push('');
  let j: number = deviceList.length - 2;
  while ((j > -1) && (deviceList[j].id > item.id)) {
    deviceList[j + 1] = deviceList[j];
    names[j + 1] = names[j];
    j--;
  }
  deviceList[j + 1] = item;
  names[j + 1] = item.id;

}

// The List of all Connected Devices and their Devices in Range.
interface DeviceList {
  id: string;
  foundDevices: DeviceData[];
  timeout: boolean;
}

// One Data-Package of a Device in Range.
interface DeviceData {
  id: string;
  linearRssi: number;
  rawRssi: number;
}

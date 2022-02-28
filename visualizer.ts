// Distance in cm if config loading fails
let right_x = 500;
let left_x = 0;

// Signal Strength Indicator Fallback values
let lower_y = 0;
let upper_y = -100;

// Values that are set in the config.json file
let datasetname: string[] = [];
let datasetalgos: string[] = [];
let datasettype: string[] = [];
let datasetcolors: string[] = [];
let deltaquantity: number[] = [];
let deltathreshold: number[] = [];

/**
 * This function runs at the start of the script, loads the config and draws the graph if valid data is provided.
 */
(async () => {

    // The data storage 
    let data: number[][][] = [];

    // Here the config is loaded from the JSON File that can be edited by the user.
    let config = await fetch("config.json").then(handleErrors)
    .then(response => {return response} )
    .catch(error => console.log(error) );

    if(config) {
        // Distance in cm
        right_x = config.coordinates.right_x;
        left_x = config.coordinates.left_x;
    
        lower_y = config.coordinates.lower_y;
        upper_y = config.coordinates.upper_y;

        for (const value of Object.values(config.datasets)) {
            const object: Dataset = <Dataset>value;
            datasetalgos.push(object.algorithm);
            datasettype.push(object.type);
            datasetcolors.push(object.color);
            datasetname.push(object.fileName);
            if(object.deltacorrection) {
                deltaquantity.push(object.deltacorrection.quantity);
                deltathreshold.push(object.deltacorrection.threshold);
            } else {
                deltaquantity.push(0);
                deltathreshold.push(0);
            }
            data.push(await fetchDataSet(object.fileName));
        }

        let pl_exp: number = config.pl_exp; // Path loss exponent
        if(data[0]) {
            data.forEach((dataset: number[][], i) => {
                if(config.correct127s) {
                    dataset = correct127s(dataset);
                }
                let convertedData: number[][] = linearConversion(dataset, datasetalgos[i], pl_exp);
                if(deltaquantity[i] > 0) {
                    convertedData = deltaCorrect(convertedData, deltaquantity[i], deltathreshold[i]);
                }
                drawGraph(convertedData, datasetcolors[i], datasettype[i]);
                drawDataInfo(datasetname[i], datasetalgos[i], datasetcolors[i], datasettype[i]);
            });
            return;
        }

    } else {
        console.log('Fallback config is being used...');
    }

    drawGraph([]);
})();

/**
 * fetches a data file and returns the value of this file
 * 
 * @param _fileName the name of the file that needs to be fetched
 * @returns the extraced data of the given data file
 */
async function fetchDataSet(_fileName: string): Promise<number[][]> {
    // Here the data is loaded from the JSON File that is created.
    return await fetch('data/' + _fileName).then(handleErrors)
    .then(response => {return response} )
    .catch(error => console.log(error) );
}

/**
 * Handle errors of fetch
 * 
 * @param response gives information over the response status
 * @returns the response as data
 */
function handleErrors(response: any) {
    if (!response.ok) {
        console.log(response.statusText);
    }
    return response.json();
}

declare let d3: any; // d3 needs to be declared so that the script-tag import works with typescript
let coordinateSystemPresent = false; // So the coordinate System is drawn only once

// https://www.d3-graph-gallery.com/graph/area_lineDot.html
/**
 * draws the given data on an svg with id=digram
 * 
 * @param _data the coordinates of the data points that need to be drawn
 * @param _color the color of the datapoints that will be drawn
 * @param _type how the data should be presented
 */
function drawGraph(_data: number[][], _color: string = 'rgba(0,0,0,0.2)', _type: string = 'rawdata') {
    let MARGINX: number, MARGINY: number, width: number, height: number, points_data: number[][], svg, x: any, y: any, line: boolean = false;

    // switch between visualisation type
    switch(_type) {
        case 'rawdata':
            points_data = _data;
            break;
        case 'average':
            points_data = averagePoints(_data);
            break;
        case 'median':
            points_data = medianPoints(_data);
            break;
        case 'averageLine':
            points_data = averagePoints(_data);
            line = true;
            break;
        case 'medianLine':
            points_data = medianPoints(_data);
            line = true;
            break;
        case 'boxplot':
            points_data = getDataGroups(_data);
            break;
        default:
            points_data = _data;
            break;
    };

    // Used to print the interference Value points
    /*let kol: string = "";
    let abstandsverhältnis: string = "";
    let lineardj = "";
    for (let i = 0; i < 401; i+=1) {
        const heighti = 1.123;
        const distance = i/100;
        const wavelength = 0.121;
        const frequenz = 2.4*100000000;
        const abstandGerade = distance/wavelength;
        const abstandQuer = (Math.sqrt(Math.pow(heighti,2) + Math.pow(distance/2,2))*2)/wavelength;
        let interference = ((Math.abs((abstandQuer-abstandGerade)))*2*Math.PI)%(2*Math.PI);
        //interference = Math.sin(2*Math.PI*frequenz)+Math.sin(2*Math.PI*frequenz+interference);
        //interference = Math.PI-Math.abs(interference-Math.PI);
        interference = Math.pow(2*((Math.abs(Math.cos(interference/2)))),2);
        const multiplikator = (1/Math.pow(abstandQuer,2))/(1/Math.pow(abstandGerade,2));
        interference = (interference*multiplikator);
        if((abstandQuer/abstandGerade < 1.55)&&(abstandQuer/abstandGerade > 1.45)) {
            console.log('Abstand: '+i);
        }
        abstandsverhältnis += ("["+i+","+ multiplikator*4 +"],"); 
        kol += ("["+i+","+ interference+"],"); 

        let linearconv = quadrate(i/100);
        linearconv = linearconv+interference;

        lineardj += ("["+i+","+ linearconv+"],");
    };
    console.log(lineardj);
    //console.log(abstandsverhältnis);
    console.log(Math.pow(2*Math.abs(Math.cos((Math.PI/2)/2)),2));
    console.log(2*Math.abs(Math.cos(((3*Math.PI)/2)/2)));*/

    // The svg that is selected from the HTML page
    svg = d3.select('#diagram');

    width = svg.node().getBoundingClientRect().width;
    height = svg.node().getBoundingClientRect().height;
    
    if (width >= height) {
        MARGINY = height / 5;
        MARGINX = height / 5;
    }
    else {
        MARGINX = width / 5;
        MARGINY = width / 5;
    }

    // The range of the values is set with the given svg-size
    x = d3.scaleLinear().domain([left_x, right_x]).range([MARGINX, width - MARGINX]);
    y = d3.scaleLinear().domain([upper_y, lower_y]).range([MARGINY, height - MARGINY]);
    if(!coordinateSystemPresent){
        let axisBotTop: any;
        if(upper_y <= 0) {
            axisBotTop = d3.axisTop(x);
            svg
                .append("g")
                .attr("transform", "translate(0," + MARGINY + ")") // This controls the vertical position of the Axis
                .call(axisBotTop.ticks(25).tickSizeOuter(0));
        } else {
            axisBotTop = d3.axisBottom(x);
            svg
                .append("g")
                .attr("transform", "translate(0," + (height-MARGINY) + ")") // This controls the vertical position of the Axis
                .call(axisBotTop.ticks(25).tickSizeOuter(0));
        }

        const axisLeft = d3.axisLeft(y);
        
        svg
            .append("g")
            .attr("transform", "translate(" + MARGINX + ",0)") // This controls the vertical position of the Axis
            .call(axisLeft.ticks(8).tickSizeOuter(0));

        svg.append("text")
            .attr("class", "x label")
            .attr("text-anchor", "end")
            .attr("x", width-MARGINX)
            .attr("y", function() {
                if(upper_y <= 0) {
                    return MARGINY - 40
                } 
                return height - MARGINY + 40
            })
            .text("actual distance (centimeter)");

        svg.append("text")
            .attr("class", "y label")
            .attr("text-anchor", "end")
            .attr("x", function() {
                if(upper_y <= 0) {
                    return -height + MARGINY + 60
                } 
                return -MARGINY})
            .attr("y", MARGINX - 40)
            .attr("dy", ".75em")
            .attr("transform", "rotate(-90)")
            .text("LDPL(RSSI) (meter)");
    }

    if(_type === "boxplot") {
        for (let i = 1; i < points_data.length; i++) {

            // a few features for the box
            let center = points_data[i][0];
            points_data[i].shift();
            let boxwidth = 8;

            // Compute summary statistics used for the box:
            let data_sorted = points_data[i].sort(d3.ascending);
            let q1 = d3.quantile(data_sorted, .25);
            let median = d3.quantile(data_sorted, .5);
            let q3 = d3.quantile(data_sorted, .75);
            let mean = d3.mean(data_sorted);
            let mode = d3.mode(data_sorted);
            let interQuantileRange = q3 - q1;
            /*
            let min = q1 - 1.5 * interQuantileRange;
            let max = q3 + 1.5 * interQuantileRange;
            */
            let min = data_sorted[0];
            let max = data_sorted[data_sorted.length-1];

            console.log(data_sorted[data_sorted.length-1]);
            // Show the main vertical line
            svg
            .append("line")
            .attr("x1", x(center))
            .attr("x2", x(center))
            .attr("y1", y(min) )
            .attr("y2", y(max))
            .attr("stroke", "black")
            .attr("stroke-width", 1)

            // Show the box
            svg
            .append("rect")
            .attr("x", x(center)-boxwidth/2 )
            .attr("y", y(q3) )
            .attr("height", (y(q1)-y(q3)) )
            .attr("width", boxwidth )
            .attr("stroke", "black")
            .attr("stroke-width", 0.5)
            .style("fill", "rgba(200,200,200,1)")

            // show median, min and max horizontal lines
            svg
            .selectAll("toto")
            .data([min, max])
            .enter()
            .append("line")
            .attr("x1", x(center)-boxwidth/2)
            .attr("x2", x(center)+boxwidth/2)
            .attr("y1", function(d:any){ return(y(d))} )
            .attr("y2", function(d:any){ return(y(d))} )
            .attr("stroke", "black")
            .attr("stroke-width", 1)
            svg
            .selectAll("toto")
            .data([mode])
            .enter()
            .append("line")
            .attr("x1", x(center)-boxwidth/2)
            .attr("x2", x(center)+boxwidth/2)
            .attr("y1", function(d:any){ return(y(d))} )
            .attr("y2", function(d:any){ return(y(d))} )
            .attr("stroke", "orange")
            .attr("stroke-width", 2)
            svg
            .selectAll("toto")
            .data([mean])
            .enter()
            .append("line")
            .attr("x1", x(center)-boxwidth/2)
            .attr("x2", x(center)+boxwidth/2)
            .attr("y1", function(d:any){ return(y(d))} )
            .attr("y2", function(d:any){ return(y(d))} )
            .attr("stroke", _color)
            .attr("stroke-width", 2)
            svg
            .selectAll("toto")
            .data([median])
            .enter()
            .append("line")
            .attr("x1", x(center)-boxwidth/2)
            .attr("x2", x(center)+boxwidth/2)
            .attr("y1", function(d:any){ return(y(d))} )
            .attr("y2", function(d:any){ return(y(d))} )
            .attr("stroke", "blue")
            .attr("stroke-width", 2)
        }
    } else {
    // If the selected Type is line a line from every average point is drawn
        if (line) {
            // sort the list so lines dont go backwards (only needed by custom data that is not measured with this tool)
            points_data.sort(function(a, b) {
                return d3.ascending(a[0], b[0])
            });
            // create the line
            svg.append("path")
            .datum(points_data)
            .attr("fill", "none")
            .attr("stroke", _color)
            .attr("stroke-width", 1)
            .attr("d", d3.line()
                .x(function(d: number[]) { return x(d[0]) })
                .y(function(d: number[]) { return y(d[1]) })
                )
        }
        if(!line){
        // The circles are added
        svg.selectAll("myCircles")
            .data(points_data)
            .enter()
            .append("circle")
            .attr("fill", function () {
            // color could be changed for different x and y values (gettable with d[0] and d[1])
            return _color;
        })
            .attr("stroke", "none")
            .attr("cx", function (d: number[]) { return x(d[0]); })
            .attr("cy", function (d: number[]) { return y(d[1]); })
            .attr("r", 2);
        }
    }

    coordinateSystemPresent = true;
}

function quadrate(_linear: number) {
    return -(40.66+10*2.5*Math.log10(_linear));
}

/**
 * This function draws information about every Graph that is send.
 * 
 * @param _name the file name of the data
 * @param _algo the algorithm that was used
 * @param _color the color in the graph
 * @param _type hoe the data is displayed
 */
function drawDataInfo(_name: string, _algo: string, _color: string = 'rgba(0,0,0,0.2)', _type: string = 'rawdata') {
    // set Infos under Graph
    const infoField = document.getElementById('data-infos');

    let newInfoContainer = document.createElement('div');
    newInfoContainer.classList.add('infoContainer');

    let newDataColor = document.createElement('div');
    newDataColor.classList.add('data-color');
    newDataColor.style.backgroundColor = _color;
    
    let newDataInfos = document.createElement('p');
    newDataInfos.classList.add('data-infotext');
    newDataInfos.innerText = 'File-Name: ' + _name + ",\nType: " + _type + ',\nAlgorithm: ' + _algo;

    newInfoContainer.appendChild(newDataColor);
    newInfoContainer.appendChild(newDataInfos);
    
    infoField.appendChild(newInfoContainer);
}

// This function coorects given 127 values out of the data
function correct127s(_data: number[][]): number[][] {
    let newData: number[][] = [];
    _data.forEach(data => {
        if(data[1] !== 127) {
            newData.push(data);
        }
    });
    return newData;
}

function getDataGroups(_points: number[][]) {

    // create dummy data
    let data: number[][] = [];
    
    while (_points.length > 0) {
        let newY: number[] = [];
        let currentX = _points[0][0];
        for (let j = 0; j < _points.length; j++) {
            if(_points[j][0] === currentX) {
                newY.push(_points.splice(j, 1)[0][1]);
                j--;
            }
        }
        newY.splice(0,0,currentX);
        data.push(newY);
    };
    return data;
}

/**
 * Averages Points for datasets on the same x-Value.
 * 
 * @param _points The list of points that need to be averaged
 * @returns a new list with one average point for every given x-Value
 */
function averagePoints(_points: number[][]): number[][] {
    let newPoints: number[][] = [];
    while (_points.length > 0) {
        let newY: number[] = [];
        let currentX = _points[0][0];
        for (let j = 0; j < _points.length; j++) {
            if(_points[j][0] === currentX) {
                newY.push(_points.splice(j, 1)[0][1]);
                j--;
            }
        }
        newPoints.push([currentX, average(newY)])
    };
    return newPoints
}

/**
 * averages a list of numbers to one number
 * 
 * @param _numbers the numbers that need to be averaged
 * @returns the average of all given numbers
 */
function average(_numbers: number[]): number {
    return _numbers.reduce((a, b) => (a + b)) / _numbers.length;
}

/**
 * Median Points for datasets on the same x-Value.
 * 
 * @param _points The list of points that need medians
 * @returns a new list with one median point for every given x-Value
 */
 function medianPoints(_points: number[][]): number[][] {
    let newPoints: number[][] = [];
    while (_points.length > 0) {
        let newY: number[] = [];
        let currentX = _points[0][0];
        for (let j = 0; j < _points.length; j++) {
            if(_points[j][0] === currentX) {
                newY.push(_points.splice(j, 1)[0][1]);
                j--;
            }
        }
        newPoints.push([currentX, median(newY)])
    };
    return newPoints
}

/**
 * returns the median of a list of numbers
 * 
 * @param _numbers the list of numbers
 * @returns the median of all given numbers
 */
function median(_numbers: number[]){
    if(_numbers.length ===0) throw new Error("No inputs");
  
    _numbers.sort(function(a,b){
      return a-b;
    });
  
    let half = Math.floor(_numbers.length / 2);
    
    if (_numbers.length % 2)
      return _numbers[half];
    
    return (_numbers[half - 1] + _numbers[half]) / 2.0;
  }

/**
 * Corrects the RSSI-Signal to linear mapping
 * 
 * @param _data the coordinates that need to be converted to a linear scale
 * @param _algo is the converting algorithm that will be used
 * @returns the data points converted to linear mapping
 */
function linearConversion(_data: number[][], _algo: string = 'none', _pl_exp: number = 2): number[][] {
    let convertedData: number[][] = [];
    switch(_algo) {
        case 'friis':
            _data.forEach(point => {
                const convertedPoint = friisTransmissionEquation(point[1]);
                convertedData.push([point[0],convertedPoint]);
            });
            return convertedData;
        case 'logdpl':
            _data.forEach(point => {
                const convertedPoint = logDistancePathLossModel(point[1], _pl_exp);
                convertedData.push([point[0],convertedPoint]);
            });
            return convertedData;
        case 'none':
            return _data;
        case 'interferenceCorrection':
            
            let puffer: number[][] = [];
            for (let index = 0; index < _data.length; index++) {
                console.log(index);
                let element: number = _data[index][1]/interferenceCorrection[_data[index][0]][1] ;
                puffer.push([_data[index][0],element]);
            }
            let averagedPoints: number[][] = averagePoints(puffer);
            averagedPoints.forEach(point => {
                const convertedPoint = logDistancePathLossModel(point[1], _pl_exp);
                convertedData.push([point[0],convertedPoint]);
            });
            return convertedData;
        default:
            console.log('The presented algorithm doesnt match. none is used instead!');
            return _data;
    }
}

// Possible good Solution: https://ieeexplore.ieee.org/abstract/document/7301734

// Friis Transmission Equation after https://www.slideshare.net/khvardhan3/friis-formula S.4.
/**
 * Converts RSSI-Values to a linear representation with help of the Friis Transmission Equation
 * 
 * @param _rssi the RSSI-Value that is converted
 * @returns the converted RSSI-Value
 */
function friisTransmissionEquation(_rssi: number): number {
    const pr = _rssi    // Received Power in dbm
    const pt = 0;       // Transmission Power in dbm of the device that is used
    const gr = 0;       // Antenna Gain of Receiver in db
    const gt = 0;       // Antenna Gain of transmitter in db
    return 1 / (32 * Math.exp( ((-pt - gt - gr + pr) * Math.log(10)) / 20 ) * Math.PI);
}

/**
 * A linear conversion Model
 * 
 * @param _rssi the RSSI-Value that is converted
 * @param _n path loss exponent depending on the surrounding environment
 * The path loss exponent for different environments after Haithem Elehesseawy and Lamiaa Riad
 * Free Space                       2
 * Urban area cellular radio        2.7 to 3.5
 * Shadowed urban cellular radio    3 to 5
 * In building LOS                  1.6 ro 1.8
 * Obstructed in building           4 to 6
 * Obstructed in Factories          2 to 3
 * @returns the converted RSSI-Value
 */
function logDistancePathLossModel(_rssi: number, _n: number = 2.25): number {
    return Math.exp(-(((_rssi+40.05)*Math.log(10))/(10*_n)));
}

/**
 * This Funktion takes a list of datapoints and uses deltacorrection on them
 * 
 * @param _data the list of all datapoints
 * @param _number the number of datapoints that should be taken into account
 * @param _threshold the threshold that is acceptable
 * @returns an array with all datapoints that are accepted by the deltacorrection
 */
function deltaCorrect(_data: number[][], _number: number, _threshold: number): number[][] {
    let newData: number[][] = [];
    _data.forEach((rssi, index) => {
        let rssiList = [];
        if(index > _number) {
            for (let j = index - _number; j < index; j++) {
                rssiList.push(_data[j]);
            }
        } else {
            for (let j = 0; j < index; j++) {
                rssiList.push(_data[j]);
            }
        }
        if(index === 0) {
            newData.push(rssi);
        } else if(calculateDelta(rssiList, rssi[1], _threshold)) {
            newData.push(rssi);
        }
    });
    console.log("Länge nach Delta: " + newData.length);
    return newData;
}

/**
 * This function calculates a delta which determines if the next incoming RSSI-Value is valid or to far of.
 * Principle of Jun Ho S.13-14.
 * Should take the linear RSSI to better determine the average.
 *
 * @param _rssiList The List of the last n RSSI Values in linear representation.
 * @param _rssi The new RSSI value that needs to be checked.
 * @returns _rssi is valid (true) or not (false).
 */
function calculateDelta(_rssiList: number[][], _rssi: number, _threshold: number): boolean {
    const threshold = _threshold;
    const deltaList = [];

    for (let i = 0; i < _rssiList.length - 2; i++) {
        const delta = Math.abs(_rssiList[i+1][1] - _rssiList[i][1]);
        deltaList.push(delta);
    }
    let averageDelta = 0;
    deltaList.forEach(element => {
        averageDelta += element;
    });
    averageDelta = averageDelta/deltaList.length;
    if(averageDelta === 0) {
        console.log('Der Average war 0');
    }
    const currentDelta = Math.abs(_rssi - _rssiList[_rssiList.length - 1][1]);
    const deltaRatio = Math.abs(currentDelta/averageDelta);
    let effective: boolean;
    if(deltaRatio < threshold) {
        effective = true;
    } else {
        effective = false;
    }
    return effective;
}

// The information that should be provided for a dataset in the config.json
interface Dataset {
    fileName: string;
    algorithm: string;
    type: string;
    color: string;
    deltacorrection: {
        quantity: number,
        threshold: number
    };
}

// Interference Correction with Reflection Value 0.05
let interferenceCorrection = [
    [0, 1],
    [1, 1.0004416],
    [2, 1.00071196],
    [3, 1.000535925],
    [4, 0.999825177],
    [5, 0.998730505],
    [6, 0.997605045],
    [7, 0.996890754],
    [8, 0.996966081],
    [9, 0.998004599],
    [10, 0.999890286],
    [11, 1.002218166],
    [12, 1.004384742],
    [13, 1.005746916],
    [14, 1.005806809],
    [15, 1.004369426],
    [16, 1.001625115],
    [17, 0.998129402],
    [18, 0.994682627],
    [19, 0.992140347],
    [20, 0.991203138],
    [21, 0.992237328],
    [22, 0.99517353],
    [23, 0.999491776],
    [24, 1.004288824],
    [25, 1.00851963],
    [26, 1.011218261],
    [27, 1.011668942],
    [28, 1.009634741],
    [29, 1.005443743],
    [30, 0.999834026],
    [31, 0.99391105],
    [32, 0.988881789],
    [33, 0.985844129],
    [34, 0.98547656],
    [35, 0.987976387],
    [36, 0.992991949],
    [37, 0.999625105],
    [38, 1.006667481],
    [39, 1.012786989],
    [40, 1.01680326],
    [41, 1.017899816],
    [42, 1.015757256],
    [43, 1.010695222],
    [44, 1.003508796],
    [45, 0.995432234],
    [46, 0.987866589],
    [47, 0.982132146],
    [48, 0.979292106],
    [49, 0.979872051],
    [50, 0.98389537],
    [51, 0.99073615],
    [52, 0.999342433],
    [53, 1.00836037],
    [54, 1.01633808],
    [55, 1.021961744],
    [56, 1.024336649],
    [57, 1.022992173],
    [58, 1.018113721],
    [59, 1.010341329],
    [60, 1.000844026],
    [61, 0.990985018],
    [62, 0.982234694],
    [63, 0.975871182],
    [64, 0.972855399],
    [65, 0.97364696],
    [66, 0.978219939],
    [67, 0.985939046],
    [68, 0.995813467],
    [69, 1.006494508],
    [70, 1.016548825],
    [71, 1.024657289],
    [72, 1.029686512],
    [73, 1.031005505],
    [74, 1.028372456],
    [75, 1.022092219],
    [76, 1.012962615],
    [77, 1.002070951],
    [78, 0.990758988],
    [79, 0.980400071],
    [80, 0.972263184],
    [81, 0.967310289],
    [82, 0.966179168],
    [83, 0.968993421],
    [84, 0.975443327],
    [85, 0.984842618],
    [86, 0.996112068],
    [87, 1.008022806],
    [88, 1.019263593],
    [89, 1.028588496],
    [90, 1.035033388],
    [91, 1.037866787],
    [92, 1.036787429],
    [93, 1.031914396],
    [94, 1.023744521],
    [95, 1.013082857],
    [96, 1.001010387],
    [97, 0.988740393],
    [98, 0.977472407],
    [99, 0.96827649],
    [100, 0.962075495],
    [101, 0.959430152],
    [102, 0.960593103],
    [103, 0.96545459],
    [104, 0.973591509],
    [105, 0.984216608],
    [106, 0.996424369],
    [107, 1.009098177],
    [108, 1.021137248],
    [109, 1.031515654],
    [110, 1.039322636],
    [111, 1.043915411],
    [112, 1.044938368],
    [113, 1.042295015],
    [114, 1.036209829],
    [115, 1.027195217],
    [116, 1.015982743],
    [117, 1.003463698],
    [118, 0.990613335],
    [119, 0.978422485],
    [120, 0.967835709],
    [121, 0.959619411],
    [122, 0.954407918],
    [123, 0.952548],
    [124, 0.954163828],
    [125, 0.959121008],
    [126, 0.967064221],
    [127, 0.977414577],
    [128, 0.989438649],
    [129, 1.002300176],
    [130, 1.015127954],
    [131, 1.027051562],
    [132, 1.037302203],
    [133, 1.045193533],
    [134, 1.050265348],
    [135, 1.0521804],
    [136, 1.050840483],
    [137, 1.046348162],
    [138, 1.039028672],
    [139, 1.029320374],
    [140, 1.017838052],
    [141, 1.005270479],
    [142, 0.992382459],
    [143, 0.979930039],
    [144, 0.968616502],
    [145, 0.959084822],
    [146, 0.951856616],
    [147, 0.947337717],
    [148, 0.94573729],
    [149, 0.94712318],
    [150, 0.951396163],
    [151, 0.958316275],
    [152, 0.967501061],
    [153, 0.978434342],
    [154, 0.990552854],
    [155, 1.003237955],
    [156, 1.015832614],
    [157, 1.027735514],
    [158, 1.038336612],
    [159, 1.047153363],
    [160, 1.053755406],
    [161, 1.057887782],
    [162, 1.059350574],
    [163, 1.058098777],
    [164, 1.054212423],
    [165, 1.047919361],
    [166, 1.039497181],
    [167, 1.029341788],
    [168, 1.017919099],
    [169, 1.005746189],
    [170, 0.993336228],
    [171, 0.981218687],
    [172, 0.969904745],
    [173, 0.959864736],
    [174, 0.951471562],
    [175, 0.945073236],
    [176, 0.940902425],
    [177, 0.939092313],
    [178, 0.939692426],
    [179, 0.942660428],
    [180, 0.947874488],
    [181, 0.955089317],
    [182, 0.964024537],
    [183, 0.974336979],
    [184, 0.98563862],
    [185, 0.997500335],
    [186, 1.009497936],
    [187, 1.021203999],
    [188, 1.032203394],
    [189, 1.042161438],
    [190, 1.050695953],
    [191, 1.057583078],
    [192, 1.062569164],
    [193, 1.065526799],
    [194, 1.06639667],
    [195, 1.065147768],
    [196, 1.06184116],
    [197, 1.056637406],
    [198, 1.049686946],
    [199, 1.041232315],
    [200, 1.031553407],
    [201, 1.02095927],
    [202, 1.009763766],
    [203, 0.998313312],
    [204, 0.986948953],
    [205, 0.975996195],
    [206, 0.965756378],
    [207, 0.956520863],
    [208, 0.948540533],
    [209, 0.942012413],
    [210, 0.937095919],
    [211, 0.933932626],
    [212, 0.932560046],
    [213, 0.932995925],
    [214, 0.935226551],
    [215, 0.939168023],
    [216, 0.944681942],
    [217, 0.951638708],
    [218, 0.959821644],
    [219, 0.969038732],
    [220, 0.979026702],
    [221, 0.989543631],
    [222, 1.000336693],
    [223, 1.011148071],
    [224, 1.021721125],
    [225, 1.031806647],
    [226, 1.041169013],
    [227, 1.049626046],
    [228, 1.056982282],
    [229, 1.06309257],
    [230, 1.067826648],
    [231, 1.071121841],
    [232, 1.072889431],
    [233, 1.073139302],
    [234, 1.071873959],
    [235, 1.069117792],
    [236, 1.06498969],
    [237, 1.059546246],
    [238, 1.052941653],
    [239, 1.045300188],
    [240, 1.036814189],
    [241, 1.027629423],
    [242, 1.017942251],
    [243, 1.007966962],
    [244, 0.997874683],
    [245, 0.987858529],
    [246, 0.978103112],
    [247, 0.968805614],
    [248, 0.960111538],
    [249, 0.952161233],
    [250, 0.9451154],
    [251, 0.939064361],
    [252, 0.934120447],
    [253, 0.930332047],
    [254, 0.927789011],
    [255, 0.926481353],
    [256, 0.926433262],
    [257, 0.927639772],
    [258, 0.930039822],
    [259, 0.933611288],
    [260, 0.938259313],
    [261, 0.943907629],
    [262, 0.950448854],
    [263, 0.957782855],
    [264, 0.965764094],
    [265, 0.974281549],
    [266, 0.983202322],
    [267, 0.992375365],
    [268, 1.001663706],
    [269, 1.010929791],
    [270, 1.020037539],
    [271, 1.028854397],
    [272, 1.037282822],
    [273, 1.045183763],
    [274, 1.052444188],
    [275, 1.059001971],
    [276, 1.064751589],
    [277, 1.069630392],
    [278, 1.073590316],
    [279, 1.076578985],
    [280, 1.078576954],
    [281, 1.079568231],
    [282, 1.079544163],
    [283, 1.078535965],
    [284, 1.076539679],
    [285, 1.073629255],
    [286, 1.069811016],
    [287, 1.06518293],
    [288, 1.059778148],
    [289, 1.053687607],
    [290, 1.046997436],
    [291, 1.039772651],
    [292, 1.032120574],
    [293, 1.02414458],
    [294, 1.015922723],
    [295, 1.007554687],
    [296, 0.999138603],
    [297, 0.990769894],
    [298, 0.982540248],
    [299, 0.974536724],
    [300, 0.966841004],
    [301, 0.95953648],
    [302, 0.952710291],
    [303, 0.946404029],
    [304, 0.940678583],
    [305, 0.9356164],
    [306, 0.931219661],
    [307, 0.927564012],
    [308, 0.924643538],
    [309, 0.922508802],
    [310, 0.921141237],
    [311, 0.920579031],
    [312, 0.920778969],
    [313, 0.921775415],
    [314, 0.923499376],
    [315, 0.925979741],
    [316, 0.929131028],
    [317, 0.932965255],
    [318, 0.937399523],
    [319, 0.942408567],
    [320, 0.947940094],
    [321, 0.953921826],
    [322, 0.960311818],
    [323, 0.967055272],
    [324, 0.974074353],
    [325, 0.981308284],
    [326, 0.988695113],
    [327, 0.99617222],
    [328, 1.003676844],
    [329, 1.011146601],
    [330, 1.018520012],
    [331, 1.025737019],
    [332, 1.032739493],
    [333, 1.039471721],
    [334, 1.045897217],
    [335, 1.051968572],
    [336, 1.057625641],
    [337, 1.062827946],
    [338, 1.067580097],
    [339, 1.071808187],
    [340, 1.075497677],
    [341, 1.078649716],
    [342, 1.081208686],
    [343, 1.083205314],
    [344, 1.084598772],
    [345, 1.085398758],
    [346, 1.085613579],
    [347, 1.085222428],
    [348, 1.084280063],
    [349, 1.082749463],
    [350, 1.080687859],
    [351, 1.078092643],
    [352, 1.074982764],
    [353, 1.071418001],
    [354, 1.067388217],
    [355, 1.062941036],
    [356, 1.058126133],
    [357, 1.052952247],
    [358, 1.047459204],
    [359, 1.04170932],
    [360, 1.035727113],
    [361, 1.029546759],
    [362, 1.023210544],
    [363, 1.016760582],
    [364, 1.010238518],
    [365, 1.003685251],
    [366, 0.997140691],
    [367, 0.990643524],
    [368, 0.984231021],
    [369, 0.977938851],
    [370, 0.971800938],
    [371, 0.965849327],
    [372, 0.960114082],
    [373, 0.9546232],
    [374, 0.949410374],
    [375, 0.944512905],
    [376, 0.93993334],
    [377, 0.935690746],
    [378, 0.931826087],
    [379, 0.928344224],
    [380, 0.925244891],
    [381, 0.922568545],
    [382, 0.920305432],
    [383, 0.91845375],
    [384, 0.917054144],
    [385, 0.916067983],
    [386, 0.915521633],
    [387, 0.915405249],
    [388, 0.915700646],
    [389, 0.9164374],
    [390, 0.91756736],
    [391, 0.919106003],
    [392, 0.921036104],
    [393, 0.923326653],
    [394, 0.925998287],
    [395, 0.929006333],
    [396, 0.932329236],
    [397, 0.935977762],
    [398, 0.939910449],
    [399, 0.944101827],
    [400, 0.948533033]
  ]
  
  

  
  

  
  
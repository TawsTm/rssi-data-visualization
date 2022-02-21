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
        default:
            points_data = _data;
            break;
    };

    // For Interference display
    /*let kol: string = "";
    for (let i = 0; i < 251; i+=1) {
        const heighti = 1.12;
        const distance = i/100;
        const wavelength = 0.121;
        const abstandGerade = distance/wavelength;
        const abstandQuer = (Math.sqrt(Math.pow(heighti,2) + Math.pow(distance/2,2))*2)/wavelength;
        let interference = ((Math.abs((abstandQuer-abstandGerade)))*2*Math.PI)%(2*Math.PI);
        interference = Math.abs(interference-Math.PI);
        interference = interference - 45;
        kol += ("["+i+","+ interference+"],");
    };
    console.log(kol);*/

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
                .call(axisBotTop.ticks(15).tickSizeOuter(0));
        }

        const axisLeft = d3.axisLeft(y);
        
        svg
            .append("g")
            .attr("transform", "translate(" + MARGINX + ",0)") // This controls the vertical position of the Axis
            .call(axisLeft.ticks(4).tickSizeOuter(0));

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
            .text("LDPL[RSSI] (meter)");
    }

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

    coordinateSystemPresent = true;
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
  
    var half = Math.floor(_numbers.length / 2);
    
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
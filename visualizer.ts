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

        for (const [key, value] of Object.entries(config.datasets)) {
            const object: Dataset = <Dataset>value;
            datasetalgos.push(object.algorithm);
            datasettype.push(object.type);
            datasetcolors.push(object.color);
            datasetname.push(object.fileName);
            data.push(await fetchDataSet(object.fileName));
        }

        let pl_exp: number = config.pl_exp; // Path loss exponent

        if(data) {
            data.forEach((dataset: number[][], i) => {
                let convertedData: number[][] = linearConversion(dataset, datasetalgos[i], pl_exp);
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
        case 'line':
            points_data = averagePoints(_data);
            line = true;
            break;
        default:
            points_data = _data;
            break;
    }

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
        const axisBot = d3.axisBottom(x);
        svg
            .append("g")
            .attr("transform", "translate(0," + (height - MARGINY) + ")") // This controls the vertical position of the Axis
            .call(axisBot.ticks(5).tickSizeOuter(0));
        const axisLeft = d3.axisLeft(y);
        svg
            .append("g")
            .attr("transform", "translate(" + MARGINX + ",0)") // This controls the vertical position of the Axis
            .call(axisLeft.ticks(5).tickSizeOuter(0));
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
        .attr("fill", function (d: number[]) {
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

/**
 * Averages Points that are vertically on the same height.
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
 * @param _numbers the numbers that need to be averaged
 * @returns the average of all given numbers
 */
function average(_numbers: number[]): number {
    return _numbers.reduce((a, b) => (a + b)) / _numbers.length;
}

/**
 * Corrects the RSSI-Signal to linear mapping
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
 * A linear conversion Model with 
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
    console.log(_n);
    return Math.exp(-(( _rssi *Math.log(10)/(10*_n))));
}

// The information that should be provided for a dataset in the config.json
interface Dataset {
    fileName: string;
    algorithm: string;
    type: string;
    color: string;
}
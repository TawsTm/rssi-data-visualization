# rssi-data-visualization

This tool is meant to visualize measurement-data of RSSI based systems. A device can be connected to the Tool via Websocket over tunnel `https://blebeacon.loca.lt`, which will open a socket at port 3030.
A BLE-application which provides the correct data-format can be found at [BleBeacon](https://pages.github.com/TawsTM). You can also visualize existing data files.

## Installation

To use this tool you need [Node.js](https://nodejs.org) installed on your machine. Go to the project folder and use

```
npm install
npm run build
```

in your console to install and build the tool.

## Usage

To start the Server for measurements and displaying data, run

```
npm start
```

## Config

You can change the settings of the tool in the config.json:
```
{
    "coordinates": {                                
        "min_x": 0,                                 *specifies the left end of the x-Axis*
        "max_x": 200,                               *specifies the right end of the x-Axis*
        "min_y": -80,                               *specifies the upper end of the y-Axis*
        "max_y": 0                                  *specifies the lower end of the y-Axis*
    },
    "measurements": {
        "quantity": 30,                             *specifies how many measures are taken*
        "time_per_scan": 500                        *time between measurements in ms*
    },
    "datasets": {                                   *more datasets then one can be displayed*
        "dataset1": {                               *specifies which dataset is displayed and written to*
            "fileName": "data.json",                *the filename of the data*
            "algorithm": "none",                    *specifies the algorithm for linear representation: 'logdpl', 'friis', 'none'*
            "type": "rawdata",                      *specifies how the data is displayed: 'rawdata', 'average', 'median, 'averageLine', 'medianLine'*
            "color": "rgba(0,0,0,0.2)",             *specifies the color in which the datapoints are presented*
            "deltacorrection": {                    *all deltacorrection options*
                "quantity": 20,                     *specifies how many values should be taken into account (at least 3)*
                "threshold": 1                      *specifies how big the margin for change of delta should be*
            }
        },
        ...
    },
    "pl_exp": 2.25,                                 *specifies the path loss exponent that should be adjusted to the surroundings*
    "correct127s": true,                            *specifies if data with value 127 should be ignored* 
    "port": 8181                                    *specifies the Port for visual presentation. Defaults to 8181*
}
```

## Data Files

Data files should always be .json-files with this data structure:

```
[[xValue-1, yValue-1], [xValue-2, yValue-2], ..., [xValue-N, yValue-N]]
```

## Take Measurements

You need to connect a device to the server to take measurements. Once the device is connected, you can type the real distance of the measurement in centimeters into the console. The measurement will start automatically.

## Device Input

If you choose to send data from your own application to the server, your data must be a json-String and match the following structure:
```
{
    "id": "000000",             *The id of the sending device*
    "list": [                   *A list of scanned devices for rssi-values*
        {
        "id": "000001",         *The id of a scanned device*
        "rawRssi": "-43"        *The current RSSI value of the scanned device*
        },
        ...
    ]
}
```
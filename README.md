# rssi-data-visualization

This tool is meant to visualize measurement-data of RSSI based systems. A device can be connected to the Tool via Websocket over tunnel `https://blebeacon.loca.lt`, which will open a socket at port 3030.
A BLE-application which provides the correct data-format can be found at [BleBeacon](https://pages.github.com/TawsTM). You can also visualize existing data files.

## Installation
```
npm install
tsc -b
```

## Usage
```
npm start
```

## Data Files

Data files should always be .json-files with this data structure:

```
[[xValue-1, yValue-1], [xValue-2, yValue-2], ..., [xValue-N, yValue-N]]
```

## Config

You can change the settings of the tool in the config.json:
```
{
    "coordinates": {                                
        "min_x": "0",                               *specifies the left end of the x-Axis*
        "max_x": "200",                             *specifies the right end of the x-Axis*
        "min_y": "-80",                             *specifies the upper end of the y-Axis*
        "max_y": "0"                                *specifies the lower end of the y-Axis*
    },
    "measurements": {
        "quantity": "30",                           *specifies how many measures are taken*
        "time_per_scan": "500"                      *time between measurements in ms*
    },
    "datasets": {                                   *more datasets then one can be displayed*
        "dataset1": {                               *specifies which dataset is displayed and written to*
            "fileName": "data.json",                *the filename of the data*
            "algorithm": "none",                    *specifies the algorithm for linear representation: 'friis', 'none'*
            "type": "rawdata",                      *specifies how the data is displayed: 'rawdata', 'average', 'line*
            "color": "rgba(0,0,0,0.2)"              *specifies the color in which the datapoints are presented*
        }
        ...
    },
    "pl_exp": "2.25",                               *specifies the path loss exponent that should be adjusted to the surroundings*
    "port": "8181"                                  *specifies the Port for visual presentation. Defaults to 8181*
}
```
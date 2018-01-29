/**
 *
 * yeelight adapter
 *
 *
  */
'use strict';

// you have to require the utils module and call adapter function
var utils =    require(__dirname + '/lib/utils'); // Get common adapter utils

var yeelight = require(__dirname + '/lib/yeelight');

var adapter = new utils.Adapter('yeelight');
var objects = {};

adapter.on('unload', function (callback) {
    try {
        adapter.log.info('cleaned everything up...');
        yeelight.stopDiscovering();
    } catch (e) {
        yeelight.stopDiscovering();
    }
});

adapter.on('stateChange', function (id, state) {
    var changeState = id.split('.');
    if (changeState[4] == 'IPAdress'){

        uploadState(adapter.namespace + '.' + changeState[2], 'all');
    }
    //adapter.log.info(JSON.stringify(changeState));
    //adapter.log.info('stateChange ' + id);
    // you can use the ack flag to detect if it is status (true) or command (false)
    if (state && !state.ack) {
        adapter.log.info('ack is not set!');
    }
});

adapter.on('ready', function () {
    main();
});

function main() {

    readObjects(createDevice());

    adapter.subscribeStates('*');


};

function readObjects(callback) {
    adapter.getForeignObjects(adapter.namespace + ".*", 'channel' , function (err, list) {
        if (err) {
            adapter.log.error(err);
        } else {
            adapter.subscribeStates('*');
            objects = list;
            callback && callback();
        }
    });
};
function createDevice() {

    yeelight.discover(function(device) {
        var sid = adapter.namespace  + '.' + device.model + '_' + device.id;
        //adapter.log.warn(JSON.stringify(objects));
        //adapter.log.warn(objects[sid]);
        if (!objects[sid]) {
            adapter.setObject(sid, {
                type: 'channel',
                common: {
                    name: device.model,
                    icon: '/icons/' + device.model + '.png',
                },
                native: {
                    sid: device.id,
                    type: device.model
                }
            });

            switch (device.model) {
                case 'ceiling1':
                    //adapter.log.warn('Тут все должно работать');
                    adapter.setObject(sid + '.power', {
                        type: 'state',
                        common: {
                            name: 'power',
                            role: 'switch',
                            write: true,
                            read: true,
                            type: 'boolean'
                        },
                        native: {}
                    });
                    adapter.setObject(sid + '.dimmer', {
                        type: 'state',
                        common: {
                            name: 'Light',
                            role: 'level.dimmer',
                            unit: '%',
                            min: 0,
                            max: 100,
                            write: true,
                            read: true,
                            type: 'number'
                        },
                        native: {}
                    });
                    adapter.setObject(sid + '.ct', {
                        type: 'state',
                        common: {
                            name: 'Color temperature',
                            role: 'level.ct',
                            unit: 'K',
                            min: 2700,
                            max: 6500,
                            write: true,
                            read: true,
                            type: 'number'
                        },
                        native: {}
                    });
                    adapter.setObject(sid + '.moon', {
                        common: {
                            name: 'Moon mode',
                            role: 'switch',
                            write: true,
                            read: true,
                            type: 'boolean'
                        },
                        type: 'state',
                        native: {}
                    });
                    adapter.setObject(sid + '.info.connect', {
                        common: {
                            name: 'Connect',
                            role: 'indicator.connected',
                            write: false,
                            read: true,
                            type: 'boolean'
                        },
                        type: 'state',
                        native: {}
                    });
                    adapter.setObject(sid + '.info.IPAdress', {
                        common: {
                            name: 'IP',
                            role: 'state',
                            write: false,
                            read: true,
                            type: 'string'
                        },
                        type: 'state',
                        native: {}
                    });
                    adapter.setObject(sid + '.info.Port', {
                        common: {
                            name: 'Port',
                            role: 'state',
                            write: false,
                            read: true,
                            type: 'number'
                        },
                        type: 'state',
                        native: {}
                    });

                    break;

                case 'color':
                    adapter.setObject(sid + '.power', {
                        common: {
                            name: 'power',
                            role: 'switch',
                            write: true,
                            read: true,
                            type: 'boolean'
                        },
                        type: 'state',
                        native: {}
                    });
                    adapter.setObject(sid + '.dimmer', {
                        common: {
                            name: 'Light',
                            role: 'level.dimmer',
                            unit: '%',
                            min: 0,
                            max: 100,
                            write: true,
                            read: true,
                            type: 'number'
                        },
                        type: 'state',
                        native: {}
                    });
                    adapter.setObject(sid + '.ct', {
                        common: {
                            name: 'Color temperature',
                            role: 'level.ct',
                            unit: 'K',
                            min: 2700,
                            max: 6500,
                            write: true,
                            read: true,
                            type: 'number'
                        },
                        type: 'state',
                        native: {}
                    });
                    adapter.setObject(sid + '.rgb', {
                        common: {
                            name: 'RGB',
                            role: 'level.rgb',
                            write: true,
                            read: true,
                            type: 'string'
                        },
                        type: 'state',
                        native: {}
                    });
                    adapter.setObject(sid + '.info.connect', {
                        common: {
                            name: 'Connect',
                            role: 'indicator.connected',
                            write: false,
                            read: true,
                            type: 'boolean'
                        },
                        type: 'state',
                        native: {}
                    });
                    adapter.setObject(sid + '.info.IPAdress', {
                        common: {
                            name: 'IP',
                            role: 'state',
                            write: false,
                            read: true,
                            type: 'string'
                        },
                        type: 'state',
                        native: {}
                    });
                    adapter.setObject(sid + '.info.Port', {
                        common: {
                            name: 'Port',
                            role: 'state',
                            write: false,
                            read: true,
                            type: 'number'
                        },
                        type: 'state',
                        native: {}
                    });

                    break;

            }

            adapter.setState(sid + '.info.IPAdress', device.host, true);
            adapter.setState(sid + '.info.Port', device.port, true);
            //adapter.log.info('Найдено устройство - ' + device.model + '_' + device.id);

        } ;
    });
};
function uploadState(id, parameter) {
    var device = new yeelight;
    adapter.log.warn(id);
    adapter.log.warn(getState(id + '.info.IPAdress').val);
    device.host = adapter.getState(id + '.info.IPAdress'),
        device.port = adapter.getState(id + '.info.Port')||55443
    adapter.log.warn(device.host);
    adapter.log.warn(device.port);
    switch (parameter) {

        case 'all':
            device.sendCommand('get_prop', ['power', 'bright', 'ct', 'active_mode', 'rgb'], function (err, result) {
                adapter.log.info('Отправка команды выполняется');
                adapter.log.info(result);
                if (result) {
                    adapter.setState(id + '.info.connect', true, true);
                    for (var i = 0, l = result.length; i < l; i++) {
                        if (result[i]) {
                            switch (i) {
                                case 0:
                                    if (result[i] == 'on') {
                                        adapter.setState(id + '.power', true, true)
                                    } else if (result[i] == 'off') {
                                        adapter.setState(id, false, true)
                                    }
                                    break;

                                case 1:
                                    adapter.setState(id + '.dimmer', result[i], true);
                                    break;

                                case 2:
                                    adapter.setState(id + '.ct', result[i], true);
                                    break;

                                case 3:
                                    adapter.setState(id + '.moon', result[i], true);
                                    break;

                                case 4:
                                    adapter.setState(id + '.rgb', result[i], true);
                                    break;
                            }

                        }
                        ;
                    }
                    ;
                } else {
                    adapter.setState(id + '.info.connect', false, true);
                }
            });
            break;

        case 'power':

            break;

        case 'dimmer':

            break;

        case 'ct':

            break;

        case 'moon':

            break;

        case 'rgb':

            break;

    }
    ;
};
/*function stop() {
    yeelight.stopDiscovering();
}*/
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
    adapter.log.info(JSON.stringify(id));
    adapter.log.info(JSON.stringify(state));
    var changeState = id.split('.');
    var sid = adapter.namespace + '.' + changeState[2];
    adapter.getState(sid + '.info.IPAdress', function (err, Ip) {
        if (err) {
            adapter.log.error(err);
        } else {
            adapter.log.warn(JSON.stringify(Ip));
            var host = Ip.val;
            adapter.log.warn(host);
            if (changeState[3] == 'info') {
                if (changeState[4] == 'IPAdress') {
                    uploadState(sid, host, 'all');
                }
            } else {
                if (!state.ack) {
                    uploadState(sid, host, changeState[3], state.val);
                }
            }
        }


    })
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
/*function firstUploadState(id) {

    adapter.getState(id + '.info.IPAdress', function (err, Ip) {
        if (err) {
            adapter.log.error(err);
        } else {
            adapter.log.warn(Ip.val);
            var host = Ip.val;
            uploadState(id, host, 'all');
        }
    });
}*/
function uploadState(id, host, parameter, val) {
    var device = new yeelight;
    device.host = host;
    device.port = 55443;
    switch (parameter) {

        case 'all':
            device.sendCommand('get_prop', ['power', 'bright', 'ct', 'active_mode', 'rgb'], function (err, result) {
                //adapter.log.info('Отправка команды выполняется');
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
                                    switch (result [i]) {
                                        case '0':
                                            adapter.setState(id + '.moon', false, true);
                                            break;
                                        case '1':
                                            adapter.setState(id + '.moon', true, true);
                                            break;
                                    }

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
            var powerState;
            switch (val) {
                case true:
                    powerState = 'on';
                    break;
                case false:
                    powerState = 'off';
                    break;
            }
            device.sendCommand('set_power', [powerState, 'smooth', 1000], function (err, result) {
                if (err) {
                    adapter.log.error(err)
                } else {
                    if (result) {
                        adapter.log.warn(JSON.stringify(result));
                        if (result[0] == 'ok') {
                            adapter.log.warn('Подтверждение');
                            adapter.setState(id + '.' + parameter, val, true)
                        }
                    } else {
                        if (val == getProp (device.host, parameter)) {
                            adapter.setState(id + '.' + parameter, val, true);
                        } else {adapter.log.warn('Ошибка подтверждения команды')}
                    }
                }
            })
            break;

        case 'dimmer':
            device.sendCommand('set_bright', [val, 'smooth', 1000], function (err, result) {
                if (err) {
                    adapter.log.error(err)
                } else {
                    if (result) {
                        adapter.log.debug(JSON.stringify(result));
                        if (result[0] == 'ok') {
                            adapter.log.warn('Подтверждение');
                            adapter.setState(id + '.' + parameter, val, true)
                        }
                    } else {
                        if (val == getProp (device.host, parameter)) {
                            adapter.setState(id + '.' + parameter, val, true);
                        } else {adapter.log.warn('Ошибка подтверждения команды')}
                    }
                }
            })
            break;

        case 'ct':
            device.sendCommand('set_ct_abx', [val, 'smooth', 1000], function (err, result) {
                if (err) {
                    adapter.log.error(err)
                } else {
                    if (result) {
                        adapter.log.debug(JSON.stringify(result));
                        if (result[0] == 'ok') {
                            adapter.log.warn('Подтверждение');
                            adapter.setState(id + '.' + parameter, val, true)
                        }
                    } else {
                        if (val == getProp (device.host, parameter)) {
                            adapter.setState(id + '.' + parameter, val, true);
                        } else {adapter.log.warn('Ошибка подтверждения команды')}
                    }
                }
            })
            break;

        case 'moon':
            switch (val) {
                case true:
                    device.sendCommand('set_power', ['on', 'smooth', 1000, 5], function (err, result) {
                        if (err) {
                            adapter.log.error(err)
                        } else {
                            if (result) {
                                adapter.log.debug(JSON.stringify(result));
                                if (result[0] == 'ok') {
                                    adapter.log.warn('Подтверждение');
                                    adapter.setState(id + '.' + parameter, val, true);
                                    adapter.setState(id + '.power', true, true);
                                }
                            } else {
                                if (val == getProp (device.host, parameter)) {
                                    adapter.setState(id + '.' + parameter, val, true);
                                } else {adapter.log.warn('Ошибка подтверждения команды')}
                            }
                        }
                    })
                    break;
                case false:
                    device.sendCommand('set_power', ['on', 'smooth', 1000, 1], function (err, result) {
                        if (err) {
                            adapter.log.error(err)
                        } else {
                            if (result) {
                                adapter.log.debug(JSON.stringify(result));
                                if (result[0] == 'ok') {
                                    adapter.log.warn('Подтверждение');
                                    adapter.setState(id + '.' + parameter, val, true);
                                }
                            } else {
                                if (val == getProp (device.host, parameter)) {
                                    adapter.setState(id + '.' + parameter, val, true);
                                } else {adapter.log.warn('Ошибка подтверждения команды')}
                            }
                        }
                    })
                    break;
            }

            break;

        case 'rgb':
            device.sendCommand('set_rgb', [val, 'smooth', 1000], function (err, result) {
                if (err) {
                    adapter.log.error(err)
                } else {
                    if (result) {
                        adapter.log.debug(JSON.stringify(result));
                        if (result[0] == 'ok') {
                            adapter.log.warn('Подтверждение');
                            adapter.setState(id + '.' + parameter, val, true)
                        }
                    } else {
                        if (val == getProp (device.host, parameter)) {
                            adapter.setState(id + '.' + parameter, val, true);
                        } else {adapter.log.warn('Ошибка подтверждения команды')}
                    }
                }
            })
            break;

    }
    ;
};
/*function stop() {
    yeelight.stopDiscovering();
}*/
function getProp(host, parameter) {
    var device = new yeelight;
    device.host = host;
    device.port = 55443;
    var param;
    switch (parameter) {
        case 'dimmer':
            param = 'bright';
            break;
        case 'moon':
            param = 'active_mode';
            break;
        default:
            param = parameter;
            break;
    }
    device.sendCommand('get_prop', [param], function (err, result) {
        if (err) {
            adapter.log.error(err)
        } else {
            if (result) {
                return result[0];
            }
        }
    })
}
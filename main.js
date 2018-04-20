/**
 *
 * yeelight adapter
 *
 *
  */
'use strict';

// you have to require the utils module and call adapter function
var utils = require(__dirname + '/lib/utils'); // Get common adapter utils
var net = require('net');
var yeelight = require(__dirname + '/lib/yeelight');
var adapter = new utils.Adapter('yeelight');
var objects = {};
var sockets = {};

var bright_selector;
var bright_modi = ["active_bright", "bright"]


adapter.on('unload', function (callback) {
    sockets = null;
    yeelight.stopDiscovering();
});

adapter.on('stateChange', function (id, state) {
    //adapter.log.warn('state:' + JSON.stringify(state));
    //adapter.log.warn('id:' + JSON.stringify(id));
    if (state && !state.ack) {
        var changeState = id.split('.');
        var sid = adapter.namespace + '.' + changeState[2];
        adapter.getState(sid + '.info.IPAdress', function (err, data) {
            if (err) {
                adapter.log.error(err);
            } else {
                if (changeState[3] != 'info') {
                    if (!state.ack) {
                        uploadState(sid, data.val, changeState[3], state.val);
                    }
                }
            }


        })
    }
});

adapter.on('ready', function () {
    main();
});

adapter.on('message', function (callback) {
    
    //yeelight.stopDiscovering();
    adapter.log.warn('here is a Message');
});

function main() {
    readObjects(createDevice());
    adapter.subscribeStates('*');

};

function readObjects(callback) {
    adapter.getForeignObjects(adapter.namespace + ".*", 'channel', function (err, list) {
        if (err) {
            adapter.log.error(err);
        } else {
            adapter.subscribeStates('*');
            objects = list;
            createSocketsList();
            updateConnect();
            callback && callback();
        }
    });
};
function createDevice() {

    yeelight.discover(function (device) {
        adapter.log.warn('D:' + JSON.stringify(device));

        var sid = adapter.namespace + '.' + device.model + '_' + device.id;

        adapter.setObjectNotExists(sid + '.info.com', {
            common: {
                name: 'Command',
                role: 'state',
                write: false,
                read: true,
                type: 'string'
            },
            type: 'state',
            native: {}
        });

        adapter.setState(sid + '.info.com', JSON.stringify(device), true);

        
        if (!objects[sid]) {
            adapter.setObjectNotExists(sid, {
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

            adapter.setObjectNotExists(sid + '.info.connect', {
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
            adapter.setObjectNotExists(sid + '.info.IPAdress', {
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
            adapter.setObjectNotExists(sid + '.info.Port', {
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
            adapter.setState(sid + '.info.IPAdress', device.host, true);
            adapter.setState(sid + '.info.Port', device.port, true);
            var YeelState = new yeelight;
            YeelState.host = device.host;
            YeelState.port = device.port;
            YeelState.sendCommand('get_prop', ['power', 'active_bright', 'ct', 'rgb', 'active_mode', 'color_mode', 'bright', 'hue', 'sat'], function (err, result) {
                if (err) {
                    adapter.log.error(err);
                } else {
                    adapter.setState(sid + '.info.connect', true, true);
                    if (result) {
                        if (result[0]) {
                            switch (result[0]) {
                                case 'on':
                                    addState(sid, 'power', true);
                                    break;
                                case 'off':
                                    addState(sid, 'power', false);
                                    break;
                            }
                        }
                        if (result[1]) {
                            addState(sid, 'active_bright', result[1]);
                        } else {
                            addState(sid, 'active_bright', result[6]);
                        }
                        if (result[2]) {
                            addState(sid, 'ct', result[2]);
                        }
                        if (result[3]) {
                            addState(sid, 'rgb', result[3]);
                        }
                        if (result[4]) {
                            switch (+result[4]) {
                                case 0:
                                    addState(sid, 'moon_mode', false);
                                    break;
                                case 1:
                                    addState(sid, 'moon_mode', true);
                                    break;
                            }
                        }
                        if (result[5]) {
                            if (true) {

                                switch (+result[5]) {
                                    case 1:
                                        addState(sid, 'color_mode', true);
                                        break;
                                    case 2:
                                        addState(sid, 'color_mode', false);
                                        break;
                                }
                            }
                        }
                        if (result[7]) {
                            addState(sid, 'hue', result[7]);
                        }
                        if (result[8]) {
                            addState(sid, 'sat', result[7]);
                        }
                    } else {
                        adapter.log.warn('No response from the device at: ' + YeelState.host + ':' + YeelState.port);
                    }
                }
            })
            listen(device.host, device.port, setStateDevice);
        };
    });
};

function uploadState(id, host, parameter, val) {
    var device = new yeelight;
    device.host = host;
    device.port = 55443;
    adapter.log.debug("Upload State " + parameter + " host: " + host + " Value: " + val);
    switch (parameter) {

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
                        adapter.log.debug("Answer from set_power: " + JSON.stringify(result));
                        if (result[0] == 'ok') {
                            adapter.setState(id + '.' + parameter, val, true);
                            adapter.getState(id + '.color_mode', function (err, state) {
                                if (err) {
                                    adapter.log.error(err)
                                } else {
                                    if (state) {
                                        adapter.setState(id + '.' + '.color_mode', false, true);
                                    }
                                }
                            });
                            if (val) {
                                getProp(device.host, "bright", function (result) {
                                    adapter.log.debug("Read bright because poweron: " + result[0]);
                                    adapter.setState(id + '.active_bright', result[0], true);
                                });
                            }
                        }
                    } else {
                        getProp(device.host, parameter, function (result) {
                            adapter.log.debug("Wrong respons at power on, ckeck again --> " + powerState + "  <<--soll ist-->> " + result[0]);

                            if (powerState == result[0]) {
                                adapter.setState(id + '.' + parameter, val, true);
                                adapter.getState(id + '.color_mode', function (err, state) {
                                    if (err) {
                                        adapter.log.error(err)
                                    } else {
                                        if (state) {
                                            adapter.setState(id + '.' + '.color_mode', false, true);
                                        }
                                    }
                                });
                                if (val) {
                                    getProp(device.host, "bright", function (result) {
                                        adapter.log.debug("Read bright because poweron: " + result[0]);
                                        adapter.setState(id + '.active_bright', result[0], true);
                                    });
                                }
                            } else { adapter.log.warn('Error verifying power_on command') }
                        });


                    }
                }
            })
            break;

        case 'active_bright':
            // TODO 0 for Light off and power on brfore change!

            device.sendCommand('set_bright', [val, 'smooth', 1000], function (err, result) {
                if (err) {
                    adapter.log.error(err)
                } else {
                    if (result) {
                        adapter.log.debug("Answer from set_bright: " + JSON.stringify(result));
                        if (result[0] == 'ok') {
                            adapter.setState(id + '.' + parameter, val, true)
                        }
                    } else {
                        getProp(device.host, "active_bright", function (result) {
                            adapter.log.debug("Wrong respons set_bright, ckeck again --> " + val + "  <<--soll ist-->> " + result[0]);
                            if (val == result[0]) {
                                adapter.setState(id + '.' + parameter, result[0], true);
                            } else {
                                adapter.log.warn('Error verifying active_bright command');
                            }
                        });
                    }
                }
            });
            break;

        case 'ct':
            device.sendCommand('set_ct_abx', [val, 'smooth', 1000], function (err, result) {
                if (err) {
                    adapter.log.error(err)
                } else {
                    if (result) {
                        adapter.log.debug("Answer from set_ct: " + JSON.stringify(result));
                        if (result[0] == 'ok') {
                            adapter.setState(id + '.' + parameter, val, true);

                        }
                    } else {
                        getProp(device.host, parameter, function (result) {
                            adapter.log.debug("Wrong respons set_ct, ckeck again --> " + val + "  <<--soll ist-->> " + result[0]);
                            if (val == result[0]) {
                                adapter.setState(id + '.' + parameter, val, true);
                            } else {
                                adapter.log.warn('Error verifying set_ct command');
                            }
                        });
                    }
                }
            });
            break;

        case 'moon_mode':
            switch (val) {
                case true:
                    device.sendCommand('set_power', ['on', 'smooth', 1000, 5], function (err, result) {
                        if (err) {
                            adapter.log.error(err)
                        } else {
                            adapter.log.debug("Answer from moon_mode: " + JSON.stringify(result));
                            if (result) {
                                adapter.log.debug(JSON.stringify(result));
                                if (result[0] == 'ok') {
                                    adapter.setState(id + '.' + parameter, val, true);
                                    adapter.setState(id + '.power', true, true);
                                    getProp(device.host, "active_bright", function (result) {
                                        adapter.log.debug("Read bright because moon_mode: " + result[0]);
                                        adapter.setState(id + '.active_bright', result[0], true);
                                    });
                                }

                            } else {
                                getProp(device.host, "active_mode", function (result) {
                                    val = val ? 1 : 0;
                                    adapter.log.debug("Wrong respons for moon_mode , ckeck again --> " + val + "  <<--soll ist-->> " + result[0]);
                                    if (val == result[0]) {
                                        adapter.setState(id + '.' + parameter, true, true);
                                        adapter.setState(id + '.power', true, true);
                                        getProp(device.host, "active_bright", function (result) {
                                            adapter.log.debug("Read bright because moon_mode: " + result[0]);
                                            adapter.setState(id + '.active_bright', result[0], true);
                                        });
                                    } else {
                                        adapter.log.warn('Error verifying set_moon_mode command');
                                    }
                                });
                            }
                        }
                    })
                    break;

                case false:
                    device.sendCommand('set_power', ['on', 'smooth', 1000, 1], function (err, result) {
                        if (err) {
                            adapter.log.error(err)
                        } else {
                            adapter.log.debug("Answer from moon_mode: " + JSON.stringify(result));
                            if (result) {
                                if (result[0] == 'ok') {
                                    adapter.setState(id + '.' + parameter, val, true);
                                    getProp(device.host, "active_bright", function (result) {
                                        adapter.log.debug("Read bright because moon_mode_off: " + result[0]);
                                        adapter.setState(id + '.active_bright', result[0], true);
                                    });
                                }
                            } else {
                                if (val == getProp(device.host, parameter)) {
                                    adapter.setState(id + '.' + parameter, val, true);
                                    adapter.setState(id + '.active_bright', getProp(device.host, parameter));
                                } else { adapter.log.warn('Error verifying the command') }

                                getProp(device.host, "active_mode", function (result) {
                                    val = val ? 1 : 0;
                                    adapter.log.debug("Wrong respons for moon_mode , ckeck again --> " + val + "  <<--soll ist-->> " + result[0]);
                                    if (val == result[0]) {
                                        adapter.setState(id + '.' + parameter, false, true);
                                        getProp(device.host, "active_bright", function (result) {
                                            adapter.log.debug("Read bright because moon_mode_off: " + result[0]);
                                            adapter.setState(id + '.active_bright', result[0], true);
                                        });
                                    } else {
                                        adapter.log.warn('Error verifying set_moon_mode_off command');
                                    }
                                });
                            }
                        }
                    })
                    break;
            }

            break;

        case 'rgb':
            var isOk = /^#[0-9A-F]{6}$/i.test(val);
            // ckeck if it is a Hex Format
            if (isOk) {
                var rgb = hex2dec(val);
                adapter.log.debug("rgb to hs: " + JSON.stringify(rgbToHsl(val)));
                device.sendCommand('set_power', ['on', 'smooth', 1000, 2], function (err, result) {
                    if (err) {
                        adapter.log.error(err)
                    } else {
                        adapter.log.debug("Answer from rgb _power on an color mode before set: " + JSON.stringify(result));
                        if (result) {
                            if (result[0] == 'ok') {
                                adapter.setState(id + '.color_mode', true, true);

                                getProp(device.host, parameter, function (result) {
                                    adapter.log.debug("Read rgb because color_mode_on: " + result[0]);
                                    adapter.setState(id + '.rgb', dec2hex(result[0]), true);
                                });
                            }
                        } else {
                            getProp(device.host, 'color_mode', function (result) {
                                adapter.log.debug("No response, request color mode again: " + result[0]);


                                switch (result[0]) {
                                    case 1:
                                        adapter.setState(id + '.color_mode', true, true);

                                        break;
                                    case 2:
                                        adapter.setState(id + '.color_mode', false, true);

                                        break;
                                    default:
                                        adapter.log.warn('Error verifying rgb command');
                                        break;
                                }
                            });


                        }
                    }
                });
                device.sendCommand('set_rgb', [+rgb, 'smooth', 1000], function (err, result) {
                    if (err) {
                        adapter.log.error(err)
                    } else {
                        if (result) {
                            //adapter.log.debug(JSON.stringify(result));
                            if (result[0] == 'ok') {
                                adapter.setState(id + '.' + parameter, val, true)
                            }
                        } else {
                            getProp(device.host, parameter, function (result) {
                                adapter.log.debug("Wrong respons for set_rgb , ckeck again --> " + rgb + "  <<--soll ist-->> " + result[0]);
                                if (rgb == result[0]) {
                                    adapter.setState(id + '.' + parameter, val, true);
                                } else {
                                    adapter.log.warn('Error verifying set_rgb command');
                                }
                            });

                        }
                    }
                })
            }
            else {
                adapter.log.warn('Please enter a Hex Format like: "#FF22AA"');
            }
            break;

        case 'hue':
            // TODO catch NAN an 1-360;


            device.sendCommand('set_power', ['on', 'smooth', 1000, 3], function (err, result) {
                if (err) {
                    adapter.log.error(err)
                } else {
                    adapter.log.debug("Answer from rgb _power on an color mode 3 before set: " + JSON.stringify(result));
                    if (result) {
                        adapter.log.debug(JSON.stringify(result));
                        if (result[0] == 'ok') {
                            adapter.setState(id + '.color_mode', true, true);

                            getProp(device.host, parameter, function (result) {
                                adapter.log.debug("Read hsv because color_mode_on: " + result[0]);
                                adapter.setState(id + '.hue', (result[0]), true);
                            });
                        }
                    } else {
                        getProp(device.host, 'color_mode', function (result) {
                            adapter.log.debug("No response, request color mode again: " + result[0]);


                            switch (result[0]) {
                                case 1:
                                    adapter.setState(id + '.color_mode', true, true);

                                    break;
                                case 2:
                                    adapter.setState(id + '.color_mode', false, true);

                                    break;
                                default:
                                    adapter.log.warn('Error verifying rgb command');
                                    break;
                            }
                        });
                    }
                }
            });

            adapter.getState(id + '.sat', function (err, state) {
                var saturation = state.val;

                adapter.log.debug("Answer from rgb _power on an color mode 3 beforesat_val: " + saturation);

                device.sendCommand('set_hsv', [val, saturation, 'smooth', 1000], function (err, result) {
                    if (err) {
                        adapter.log.error(err)
                    } else {
                        if (result) {
                            //adapter.log.debug(JSON.stringify(result));
                            if (result[0] == 'ok') {
                                adapter.setState(id + '.' + parameter, val, true)
                            }
                        } else {
                            getProp(device.host, parameter, function (result) {
                                adapter.log.debug("Wrong respons for set_hue , ckeck again --> " + val + "  <<--soll ist-->> " + result[0]);
                                if (val == result[0]) {
                                    adapter.setState(id + '.' + parameter, result[0], true);
                                } else {
                                    adapter.log.warn('Error verifying set_hue command');
                                }
                            });
                        }
                    }
                });
            });
            break;


        case 'sat':
            // TODO catch NAN an 1-100;
            device.sendCommand('set_power', ['on', 'smooth', 1000, 3], function (err, result) {
                if (err) {
                    adapter.log.error(err)
                } else {
                    adapter.log.debug("Answer from rgb _power on an color mode 3 before set: " + JSON.stringify(result));
                    if (result) {
                        adapter.log.debug(JSON.stringify(result));
                        if (result[0] == 'ok') {
                            adapter.setState(id + '.color_mode', true, true);
                        }
                    } else {
                        getProp(device.host, 'color_mode', function (result) {
                            adapter.log.debug("No response, request color mode again: " + result[0]);


                            switch (result[0]) {
                                case 1:
                                    adapter.setState(id + '.color_mode', true, true);

                                    break;
                                case 2:
                                    adapter.setState(id + '.color_mode', false, true);

                                    break;
                                default:
                                    adapter.log.warn('Error verifying sat command');
                                    break;
                            }
                        });
                    }
                }
            });

            adapter.getState(id + '.hue', function (err, state) {
                var huevalue = state.val;
                adapter.log.debug("hue" + huevalue + " sat " + val);
                device.sendCommand('set_hsv', [parseInt(huevalue), parseInt(val), 'smooth', 1000], function (err, result) {
                    if (err) {
                        adapter.log.error(err)
                    } else {
                        if (result) {
                            //adapter.log.debug(JSON.stringify(result));
                            if (result[0] == 'ok') {
                                adapter.setState(id + '.' + parameter, val, true)
                            }
                        } else {
                            getProp(device.host, parameter, function (result) {
                                adapter.log.debug("Wrong respons for set_hue , ckeck again --> " + val + "  <<--soll ist-->> " + result[0]);
                                if (val == result[0]) {
                                    adapter.setState(id + '.' + parameter, result[0], true);
                                } else {
                                    adapter.log.warn('Error verifying set_sat command');
                                }
                            });
                        }
                    }
                });
            });
            break;


        case 'color_mode':
            switch (val) {
                case true:
                    device.sendCommand('set_power', ['on', 'smooth', 1000, 2], function (err, result) {
                        if (err) {
                            adapter.log.error(err)
                        } else {
                            if (result) {
                                //adapter.log.debug(JSON.stringify(result));
                                if (result[0] == 'ok') {
                                    adapter.setState(id + '.' + parameter, val, true)
                                }
                            } else {
                                getProp(device.host, 'color_mode', function (result) {
                                    adapter.log.debug("No response, request color mode again: " + result[0]);


                                    switch (result[0]) {
                                        case 1:
                                            adapter.setState(id + '.color_mode', true, true);

                                            break;
                                        case 2:
                                            adapter.setState(id + '.color_mode', false, true);

                                            break;
                                        default:
                                            adapter.log.warn('Error verifying color_mode command');
                                            break;
                                    }
                                });
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
                                    adapter.setState(id + '.' + parameter, val, true);
                                }
                            } else {
                                getProp(device.host, 'color_mode', function (result) {
                                    adapter.log.debug("No response, request color mode again: " + result[0]);


                                    switch (result[0]) {
                                        case 1:
                                            adapter.setState(id + '.color_mode', true, true);

                                            break;
                                        case 2:
                                            adapter.setState(id + '.color_mode', false, true);

                                            break;
                                        default:
                                            adapter.log.warn('Error verifying color_mode command');
                                            break;
                                    }
                                });
                            }
                        }
                    });
                    break;
            }
            break;
        default:
            adapter.log.warn('State not found');
    }


};
function getProp(host, parameter, callback) {
    var device = new yeelight;
    device.host = host;
    device.port = 55443;
    var param;


    switch (parameter) {

        case 'moon_mode':
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
                if (callback && typeof (callback) === "function") callback(result);
                return result[0];
            }
        }
    })
}
function dec2hex(dec) {
    return '#' + (+dec).toString(16);
}
function hex2dec(hex) {
    return parseInt(hex.substring(1), 16);
}
function listen(host, port, callback) {
    var socket = net.connect(port, host);
    socket.on('data', function (data) {
        if (callback) {
            try {
                data = JSON.parse(data);
            } catch (e) {
                callback(e);
                return;
            }
            if (data['error']) {
                callback(new Error(data['error']['message']));
            } else {
                callback(socket.remoteAddress, data['params']);
            }
        }
        // socket.destroy();
    });
    socket.on('error', function (err) {
        socket.destroy();
        adapter.log.error(err);
    });


}
function setStateDevice(ip, state) {
    adapter.log.debug(ip);
    var id = sockets[ip];
    adapter.log.debug(id);
    adapter.log.debug(JSON.stringify(state));
    adapter.log.debug(JSON.stringify(sockets));
    for (var key in state) {
        adapter.log.debug(key);
        switch (key) {
            case 'power':
                switch (state[key]) {
                    case 'on':
                        adapter.setState(id + '.' + key, true, true);
                        break;
                    case 'off':
                        adapter.setState(id + '.' + key, false, true);
                        break;
                }
                break;
            case 'bright':
            case 'active_bright':
            case 'ct':
                if (key == 'bright') {
                    adapter.setState(id + '.active_bright', +state[key], true);
                }
                adapter.setState(id + '.' + key, state[key], true);
                break;
            case 'rgb':
                var value = dec2hex(state[key]);
                adapter.setState(id + '.' + key, value, true);
                break;
            case 'active_mode':
                switch (+state[key]) {
                    case 0:
                        adapter.setState(id + '.moon_mode', false, true);
                        break;
                    case 1:
                        adapter.setState(id + '.moon_mode', true, true);
                        break;
                }
                break;
            case 'color_mode':
                switch (+state[key]) {
                    case 1:
                        adapter.setState(id + '.color_mode', true, true);
                        break;
                    case 2:
                        adapter.setState(id + '.color_mode', false, true);
                        break;
                }
                break;
        }
    }

}
function updateConnect() {
    for (var key in objects) {
        var id = key;
        adapter.getState(id + '.info.IPAdress', function (err, Ip) {
            if (err) {
                adapter.log.error(err);
            } else {
                var device = new yeelight;
                device.host = Ip.val;
                device.port = 55443;
                device.sendCommand('get_prop', ['power'], function (err, result) {
                    if (err) {
                        adapter.log.error(err);
                    } else {
                        if (result) {
                            adapter.setState(id + '.info.connect', true, true);
                        } else {
                            adapter.setState(id + '.info.connect', false, true);
                        }
                    }
                })
                listen(Ip.val, 55443, setStateDevice);
            }
        })
    }
}
function addState(id, state, val) {
    switch (state) {
        case 'power':
        case 'moon_mode':
        case 'color_mode':
            adapter.setObjectNotExists(id + '.' + state, {
                type: 'state',
                common: {
                    name: state,
                    role: 'switch',
                    write: true,
                    read: true,
                    type: 'boolean'
                },
                native: {}
            });
            adapter.setState(id + '.' + state, val, true);
            break;
        case 'ct':
            adapter.setObjectNotExists(id + '.' + state, {
                type: 'state',
                common: {
                    name: state,
                    role: 'level.color.temperature',
                    write: true,
                    read: true,
                    type: 'number'
                },
                native: {}
            });
            adapter.setState(id + '.' + state, val, true);
            break;
        case 'active_bright':
            adapter.setObjectNotExists(id + '.' + state, {
                type: 'state',
                common: {
                    name: state,
                    role: 'level.dimmer',
                    write: true,
                    read: true,
                    type: 'number'
                },
                native: {}
            });
            adapter.setState(id + '.' + state, val, true);
            break;
        case 'hue':
            adapter.setObjectNotExists(id + '.' + state, {
                type: 'state',
                common: {
                    name: state,
                    role: 'level.color.hue',
                    write: true,
                    read: true,
                    type: 'number',
                    min: 0,
                    max: 360
                },
                native: {}
            });
            adapter.setState(id + '.' + state, val, true);
            break;
        case 'sat':
            adapter.setObjectNotExists(id + '.' + state, {
                type: 'state',
                common: {
                    name: state,
                    role: 'level.color.saturation',
                    write: true,
                    read: true,
                    type: 'number',
                    min: 0,
                    max: 360
                },
                native: {}
            });
            adapter.setState(id + '.' + state, val, true);
            break;
        case 'rgb':
            adapter.setObjectNotExists(id + '.' + state, {
                type: 'state',
                common: {
                    name: state,
                    role: 'level.' + state,
                    write: true,
                    read: true,
                    type: 'string'
                },
                native: {}
            });
            val = dec2hex(val);
            adapter.setState(id + '.' + state, val, true);
            break;
    }

}
function createSocketsList() {
    adapter.getStates(adapter.namespace + '.*.info.IPAdress', function (err, list) {
        if (err) {
            adapter.log.error(err);
        } else {
            var temp = {};
            temp = list;
            for (var key in temp) {
                if (~key.indexOf('IPAdress')) {
                    var id = key;
                    var ip = temp[key].val;
                    var sid = id.split('.');
                    id = sid[0] + '.' + sid[1] + '.' + sid[2];
                    sockets[ip] = id;
                    //adapter.log.warn(JSON.stringify(sockets));
                }
            }
        }
    });

    /*  for (var key in objects) {
  
  
        if (key) {
  
              adapter.getState(key + '.info.IPAdress', function (err, Ip) {
                  if (err) {
                      adapter.log.error(err);
                  } else {
                      sockets[Ip.val] = key;
                  }
              })
          }
  
      }
    */
}

/**
 * Converts an HSL color value to RGB. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes h, s, and l are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 *
 * @param   {number}  h       The hue
 * @param   {number}  s       The saturation
 * @param   {number}  l       The lightness
 * @return  {Array}           The RGB representation
 */
function hslToRgb(h, s, l) {
    var r, g, b;

    if (s == 0) {
        r = g = b = l; // achromatic
    } else {
        var hue2rgb = function hue2rgb(p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        }

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}


/**
 * Converts an RGB color value to HSL. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes r, g, and b are contained in the set [0, 255] and
 * returns h, s, and l in the set [0, 1].
 *
 * @param   {number}  r       The red color value
 * @param   {number}  g       The green color value
 * @param   {number}  b       The blue color value
 * @return  {Array}           The HSL representation
 */
function rgbToHsl(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

    var r = parseInt(result[1], 16);
    var g = parseInt(result[2], 16);
    var b = parseInt(result[3], 16);

    r /= 255, g /= 255, b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;

    if (max == min) {
        h = s = 0; // achromatic
    } else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [Math.round(h * 360), Math.round(s * 100)];
}
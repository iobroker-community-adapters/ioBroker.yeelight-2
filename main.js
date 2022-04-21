/* jshint -W097 */ // jshint strict:false
/*jslint node: true */
'use strict';

const utils = require('@iobroker/adapter-core');
const adapter = new utils.Adapter('yeelight-2');
const scenen = require(__dirname + '/lib/scenen');
const YeelightSearch = require(__dirname + '/yeelight-wifi/build/index');
let Yeelights;

//just for test
const JSON = require('circular-json');
let timeOutVar;
let ConfigDevices = [];
let ObjDevices = [];
const initializedLights = [];
let discoveryTimeout = null;

adapter.on('unload', function (callback) {
    try {
        clearTimeout(timeOutVar);
        clearTimeout(discoveryTimeout);
        initializedLights.forEach(light => {
            try {
                light.disconnect()
            } catch (err) {
                // ignore
            }
        })
        adapter.log.info('cleaned everything up...');
        callback();
    } catch (e) {
        callback();
    }
});

// is called if a subscribed object changes
adapter.on('objectChange', function (id, obj) {
    // Warning, obj can be null if it was deleted
    adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
});

adapter.on('stateChange', function (id, state) {
    if (state && !state.ack) {
        const changeState = id.split('.');
        const sid = adapter.namespace + '.' + changeState[2];

        // search id in config
        const findlight = ConfigDevices.find(device => device.name === changeState[2]);

        if (findlight) {
            if (changeState[3] !== 'info' && changeState[3] !== 'scenen') {
                if (!state.ack) {
                    uploadState(findlight.id, changeState[4], state.val, sid);

                }
            } else if (changeState[3] === 'scenen') {
                if (!state.ack) {
                    _sendscene(findlight.id, changeState[4], state.val, sid);

                }
            }
        } else {
            adapter.log.error('LIGHT: ' + changeState[2] + ' NOT FOUND IN CONFIG!');
        }
    }
});

function initYeelight() {
    if (Yeelights) {
        return;
    }
    Yeelights = new YeelightSearch();
    Yeelights.on('error', err => {
        adapter.log.error('Yeelight Error: ' + err);
    });
}

adapter.on('message', function (obj) {
    adapter.log.debug('here is a Message' + JSON.stringify(obj));

    if (!obj) return;

    function reply(result) {
        adapter.sendTo(obj.from, obj.command, JSON.stringify(result), obj.callback);
    }

    switch (obj.command) {
        case 'discovery': {
            const deviceDiscovered = [];
            initYeelight();
            Yeelights.refresh();

            const foundHandler = Yeelights.on('found', light => {
                deviceDiscovered.push({
                    'model': light.model,
                    'host': light.hostname,
                    'port': light.port,
                    'id': light.getId()
                });
                adapter.log.debug('Found Light {id: ' + light.getId() + ', name: ' + light.name + ', model: ' + light.model + ', \nsupports: ' + light.supports + '}');
            });

            discoveryTimeout = setTimeout(() => {
                Yeelights.removeEventListener('found', foundHandler);
                reply(deviceDiscovered);
            }, 5000);

            return true;
        }
        default:
            adapter.log.debug('Unknown command: ' + obj.command);
            break;
    }
});


adapter.on('ready', function () {
    main();
    adapter.log.debug('DEVICES IN CONFIG: ' + JSON.stringify(adapter.config.devices));
    ConfigDevices = adapter.config.devices;
});

function uploadState(id, parameter, value, sid) {
    if (!Yeelights) return;
    let checkHex = null;
    adapter.log.debug('SEND STATE: id:' + id + ', state: ' + parameter + ', value: ' + value);

    const aktYeelight = Yeelights.getYeelightById(id);
    if (aktYeelight) {
        switch (parameter) {
            case 'set_scene':
                aktYeelight.setScene(JSON.parse(value))
                    .catch(err => generateWarnMessageForUploadState(parameter, value, id, err));
                break;
            case 'power':
                if (value) {
                    aktYeelight.turnOn()
                        .catch(err => generateWarnMessageForUploadState(parameter, value, id, err));
                    break;
                }
                aktYeelight.turnOff()
                    .catch(err => generateWarnMessageForUploadState(parameter, value, id, err));
                break;
            case 'bg_power':
                if (value) {
                    aktYeelight.turnOnBg()
                        .catch(err => generateWarnMessageForUploadState(parameter, value, id, err));
                    break;
                }
                aktYeelight.turnOffBg()
                    .catch(err => generateWarnMessageForUploadState(parameter, value, id, err));
                break;
            case 'active_bright':
                aktYeelight.setBrightness(value)
                    .catch(err => generateWarnMessageForUploadState(parameter, value, id, err));
                break;
            case 'bg_bright':
                aktYeelight.setBrightnessBg(value)
                    .catch(err => generateWarnMessageForUploadState(parameter, value, id, err));
                break;
            case 'ct':
                aktYeelight.setColorTemperature(value)
                    .catch(err => generateWarnMessageForUploadState(parameter, value, id, err));
                break;
            case 'bg_ct':
                aktYeelight.setColorTemperatureBg(value)
                    .catch(err => generateWarnMessageForUploadState(parameter, value, id, err));
                break;
            case 'moon_mode':
                if (value) {
                    aktYeelight.moonMode()
                        .catch(err => generateWarnMessageForUploadState(parameter, value, id, err));
                    break;
                }
                aktYeelight.defaultMode()
                    .catch(err => generateWarnMessageForUploadState(parameter, value, id, err));
                break;
            case 'rgb':
                checkHex = /^#[0-9A-F]{6}$/i.test(value);
                if (checkHex) {
                    aktYeelight.setRGB(value, 'sudden', 400)
                        .catch(err => generateWarnMessageForUploadState(parameter, value, id, err));
                } else {
                    adapter.log.warn('Please enter a Hex Format like: "#FF22AA"');
                }
                break;
            case 'bg_rgb':
                checkHex = /^#[0-9A-F]{6}$/i.test(value);
                if (checkHex) {
                    aktYeelight.setRGBBg(value)
                        .catch(err => generateWarnMessageForUploadState(parameter, value, id, err));
                } else {
                    adapter.log.warn('Please enter a Hex Format like: "#FF22AA"');
                }
                break;
            case 'hue':
                // TODO catch NAN an 1-360;
                adapter.getState(sid + '.control.sat', function (err, state) {
                    const saturation = state.val;
                    aktYeelight.setHSV(value.toString(), saturation.toString())
                        .catch(err => generateWarnMessageForUploadState(parameter, value, id, err));
                });
                break;
            case 'bg_hue':
                adapter.getState(sid + '.control.bg_sat', function (err, state) {
                    const saturation = state.val;
                    aktYeelight.setHSVBg(value.toString(), saturation.toString())
                        .catch(err => generateWarnMessageForUploadState(parameter, value, id, err));
                });
                break;
            case 'sat':
                // TODO catch NAN an 1-100;
                adapter.getState(sid + '.control.hue', function (err, state) {
                    const hue = state.val;
                    aktYeelight.setHSV(hue.toString(), value.toString())
                        .catch(err => generateWarnMessageForUploadState(parameter, value, id, err));
                });
                break;
            case 'bg_sat':
                adapter.getState(sid + '.control.bg_hue', function (err, state) {
                    const hue = state.val;
                    aktYeelight.setHSVBg(hue.toString(), value.toString())
                        .catch(err => generateWarnMessageForUploadState(parameter, value, id, err));
                });
                break;
            case 'color_mode':
                if (value) {
                    aktYeelight.colorMode()
                        .catch(err => generateWarnMessageForUploadState(parameter, value, id, err));
                    break;
                }
                aktYeelight.defaultMode()
                    .catch(err => generateWarnMessageForUploadState(parameter, value, id, err));
                break;
            default:
                adapter.log.warn('State not found');
        }
    }
}

function _sendscene(id, parameter, value, sid) {
    if (!Yeelights) return;
    adapter.log.debug('SEND SCENE: id:' + id + ', state: ' + parameter + ', value: ' + value);

    const aktYeelight = Yeelights.getYeelightById(id);
    if (aktYeelight) {
        aktYeelight.setScene(scenen[parameter])
            .catch(err => generateWarnMessageForUploadState(parameter, value, id, err));
    }

}

function _createscenen(sid) {
    for (const key in scenen) {
        adapter.setObjectNotExists(sid + '.scenen.' + key, {
            common: {
                name: key,
                role: 'button.scenen',
                write: true,
                read: false,
                type: 'boolean'
            },
            type: 'state',
            native: {}
        });
    }
}

function checkChanges(callback) {
    adapter.getForeignObjects(adapter.namespace + '.*', 'device', async function (err, list) {
        if (err) {
            adapter.log.error(err);
        } else {
            ObjDevices = list;

            adapter.log.debug('DEVICES IN OBJECTS: ' + JSON.stringify(ObjDevices));

            const count = Object.keys(ObjDevices).length;
            adapter.log.debug('DEVICES IN OBJECTS FOUND: ' + count);
            //check every device
            for (let j = 0; j < count; j++) {
                const element = Object.keys(ObjDevices)[j];
                adapter.log.debug('OBJ_ELEMENT: ' + element);

                const sid = ObjDevices[element].native.sid;
                const type = ObjDevices[element].native.type;
                const oldConfig = await getastate(element);
                await ifinConfig(element, oldConfig);
            }

            adapter.subscribeStates('*');
            callback && callback();
        }
    });

    async function getastate(element) {
        const state = await adapter.getStateAsync(element + '.info.com');
        adapter.log.debug('OLD CONF. FROM OBJ: ' + (state && state.val));
        try {
            return JSON.parse(state.val);
        } catch (err) {
            adapter.log.error(`Could not parse ${element + '.info.com'}: ${err.message}`);
            return '';
        }
    }

    async function ifinConfig(element, oldConfig) {

        const sid = ObjDevices[element].native.sid;
        const type = ObjDevices[element].native.type;

        let isThere = false;
        for (let i = 0; i < ConfigDevices.length; i++) {
            if (ConfigDevices[i].name == sid && ConfigDevices[i].type == type) {
                isThere = true;
                adapter.log.debug('SMARTNAME: ' + ConfigDevices[i].smart_name);
                if (ConfigDevices[i].ip !== oldConfig.ip) {
                    await adapter.setStateAsync(element + '.info.IPAdress', ConfigDevices[i].ip, true);
                    await adapter.setStateAsync(element + '.info.com', JSON.stringify(ConfigDevices[i]), true);
                }
                if (ConfigDevices[i].port !== oldConfig.port) {
                    await adapter.setStateAsync(element + '.info.Port', ConfigDevices[i].port, true);
                    await adapter.setStateAsync(element + '.info.com', JSON.stringify(ConfigDevices[i]), true);
                }
                if (ConfigDevices[i].smart_name !== oldConfig.smart_name) {
                    await changeSmartName(element, ConfigDevices[i].smart_name);
                    await adapter.setStateAsync(element + '.info.com', JSON.stringify(ConfigDevices[i]), true);
                }

            }

            if (i === ConfigDevices.length - 1 && isThere === false) {
                await delDev(element.split('.')[2]);

                adapter.log.debug('object: ' + ObjDevices[element]._id + ' deleted');
            }
        }
    }

    async function changeSmartName(element, newSm) {
        const Names = ['power', 'ct', 'active_bright', 'hue', 'sat'];
        try {
            const list = await adapter.getForeignObjectsAsync(element + '.*');

            for (let i = 0; i < Names.length; i++) {
                if (typeof (list[element + '.control.' + Names[i]]) !== 'undefined') {
                    await adapter.extendObjectAsync(element + '.control.' + Names[i], {
                        common: {
                            smartName: {
                                de: newSm
                            }
                        }
                    });
                }
            }
        } catch (err) {
            // ignore
        }

        adapter.log.debug('changed ' + Names.length + ' smartname to : ' + newSm);
    }

    async function delDev(id) {
        adapter.log.warn('DEL: ' + id);
        try {
            await adapter.deleteDevice(id);
        } catch (err) {
            adapter.log.warn(err.message);
        }
    }
}

function createDevice() {

    if (typeof ConfigDevices === 'undefined') return;

    for (let i = 0; i < ConfigDevices.length; i++) {

        const sid = adapter.namespace + '.' + ConfigDevices[i].name;
        const device = ConfigDevices[i].name;

        //adapter.log.debug("Create Device: " + sid);
        //adapter.log.debug("onj Device: " + ObjDevices[sid]);

        if (!ObjDevices[sid]) {
            adapter.log.debug('CREATE DEVICE: ' + sid);
            adapter.createDevice(device, {
                name: ConfigDevices[i].type,
                icon: '/icons/' + ConfigDevices[i].type + '.png',
            }, {
                sid: ConfigDevices[i].name,
                type: ConfigDevices[i].type
            });
            adapter.createChannel(device, 'info');
            adapter.createChannel(device, 'control');
            adapter.createChannel(device, 'scenen');
            _createscenen(sid);
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

            adapter.setState(sid + '.info.com', JSON.stringify(ConfigDevices[i]), true);

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

            adapter.setState(sid + '.info.IPAdress', ConfigDevices[i].ip, true);
            adapter.setState(sid + '.info.Port', ConfigDevices[i].port, true);
        }
        if (i === ConfigDevices.length - 1) listener();
    }
}

function checkOnline() {
    if (!Yeelights) return;
    const lights = Yeelights.yeelights;

    if (lights.length !== 0) {
        lights.forEach(element => {
            const device = ConfigDevices.find(device => device.id === element.id);
            if (device) {
                const sid = device.name;

                if (element.status !== 3) {
                    //turn off
                    adapter.setState(sid + '.info.connect', false, true);
                    adapter.log.debug('YEELIGHT OFFLINE: ' + element.id);

                } else {
                    //turn on
                    adapter.setState(sid + '.info.connect', true, true);
                }
            }
        });
    }
}

function listener() {
    initYeelight();
    ConfigDevices.forEach((element, index) => setTimeout(() => Yeelights.addInitLights(element), index * 300));
    timeOutVar = setInterval(() => {
        //Yeelights.refresh();
        checkOnline();
    }, 60 * 1000);

    Yeelights.on('found', light => {
        if (initializedLights.find(l => l.id === light.id)) {
            adapter.log.debug('YEELIGHT FOUND (but already initialized): ' + light.hostname + ':' + light.port + '  id: ' + light.getId() + ' model: ' + light.model);
            return;
        }
        initializedLights.push(light);
        adapter.log.debug('YEELIGHT FOUND: ' + light.hostname + ':' + light.port + '  id: ' + light.getId() + ' model: ' + light.model);
        light.getValues(
            'power',
            'bright',
            'rgb',
            'color_mode',
            'ct',
            'active_bright',
            'active_mode',
            'hue',
            'sat',
            'flowing',
            'main_power',
            'bg_power',
            'bg_color_mode',
            'bg_bright',
            'bg_hue',
            'bg_sat',
            'bg_rgb',
            'bg_ct'
        ).then((resp) => {
            light['initinalid'] = 1;
        });

        light.on('error', function (id, ex, err) {
            adapter.log.debug('ERROR YEELIGHT CONNECTION: ' + id + ': ' + ex + ': ' + err);
        });

        light.on('notification', message => {
            adapter.log.debug('NOTIFY MESSAGE: from: ' + light.getId() + ', message: ' + JSON.stringify(message));
            //adapter.log.debug(JSON.stringify(Yeelights))
            if (message.method === 'props' && message.params) {

                setStateDevice(light, message.params);
            }

        });

        light.on('response', (id, result) => {
            adapter.log.debug('RESPONSE MESSAGE: from: ' + light.getId() + ', id: ' + id + ', result:[' + result + ']}');
            //adapter.log.debug(JSON.stringify(light))
            if (result && result[0] !== 'ok') {

                if (id === light.initinalid) {
                    adapter.log.debug('INITINAL ID FOUND FOR: ' + light.model + '-' + light.getId());
                    initObj(light, result);
                } else {
                    setResponse(light, result);
                }
            }
        });
    });
}

function setResponse(aktYeelight, result) {
    const device = ConfigDevices.find(device => device.id === aktYeelight.getId());

    //result:[off,100,16711680,2,4000]};
    if (device) {
        let sid = device.name;
        adapter.setState(sid + '.info.connect', true, true);
        sid = sid + '.control';
        adapter.log.debug('DEVICE FOUND IN CONFIG: ' + JSON.stringify(device));
        if (result) {
            if (!(result[0] === '')) {
                switch (result[0]) {
                    case 'on':
                        adapter.setState(sid + '.power', true, true);
                        break;
                    case 'off':
                        adapter.setState(sid + '.power', false, true);
                        break;
                }
            }
            if (!(result[1] === '')) {
                adapter.setState(sid + '.active_bright', parseInt(result[1]), true);
            }
            if (!(result[2] === '')) {
                adapter.setState(sid + '.rgb', dec2hex(result[2]), true);
            }
            if (!(result[3] === '')) {
                switch (+result[3]) {
                    case 1:
                        adapter.setState(sid + '.color_mode', true, true);
                        break;
                    case 2:
                        adapter.setState(sid + '.color_mode', false, true);
                        break;
                }
            }
            if (!(result[4] === '')) {
                adapter.setState(sid + '.ct', parseInt(result[4]), true);
            }
        } else {
            adapter.log.warn('EMPTY RESPONSE');
        }

    } else {
        adapter.log.warn('NEW DEVICE FOUND, PLEASE ADD TO CONFIG: ' + aktYeelight.model + ', id: ' + aktYeelight.getId());
    }
}

function main() {
    checkChanges(createDevice);
    adapter.subscribeStates('*');
}

async function initObj(aktYeelight, result) {
    //search light in Config
    const device = ConfigDevices.find(device => device.id === aktYeelight.getId());

    //result = ["off", "1", "4000", "", "0", "2", "1", "", "", "0", "off", "off", "", "40", "180", "100", "65535", "4000"];
    if (device) {
        let sid = device.name;
        adapter.setState(sid + '.info.connect', true, true);
        sid = sid + '.control';
        adapter.log.debug('DEVICE FOUND IN AND CONFIG: ' + JSON.stringify(device));

        if (result) {
            if (!(result[0] === '')) {
                await addState(sid, 'set_scene', '', device);
                switch (result[0]) {
                    case 'on':
                        await addState(sid, 'power', true, device);
                        break;
                    case 'off':
                        await addState(sid, 'power', false, device);
                        break;
                }
            }
            if (!(result[5] === '')) {
                await addState(sid, 'active_bright', Number(result[5]), device);
            } else {
                await addState(sid, 'active_bright', Number(result[1]), device);
            }
            if (!(result[4] === '')) {
                await addState(sid, 'ct', Number(result[4]), device);
            }
            if (!(result[2] === '')) {
                await addState(sid, 'rgb', result[2], device);
            }
            if (!(result[6] === '')) {
                switch (+result[6]) {
                    case 0:
                        await addState(sid, 'moon_mode', false, device);
                        break;
                    case 1:
                        await addState(sid, 'moon_mode', true, device);
                        break;
                }
            }
            if (!(result[3] === '')) {
                if (true) {
                    switch (+result[3]) {
                        case 1:
                            await addState(sid, 'color_mode', true, device);
                            break;
                        case 2:
                            await addState(sid, 'color_mode', false, device);
                            break;
                    }
                }
            }
            if (!(result[7] === '')) {
                await addState(sid, 'hue', Number(result[7]), device);
            }
            if (!(result[8] === '')) {
                await addState(sid, 'sat', Number(result[8]), device);
            }
            if (!(result[10] === '')) {
                switch (result[10]) {
                    case 'on':
                        await addState(sid, 'main_power', true, device);
                        break;
                    case 'off':
                        await addState(sid, 'main_power', false, device);
                        break;
                }
            }
            if (!(result[11] === '')) {
                switch (result[11]) {
                    case 'on':
                        await addState(sid, 'bg_power', true, device);
                        break;
                    case 'off':
                        await addState(sid, 'bg_power', false, device);
                        break;
                }
            }
            if (!(result[13] === '')) {
                await addState(sid, 'bg_bright', result[13], device);
            }
            if (!(result[14] === '')) {
                await addState(sid, 'bg_hue', result[14], device);
            }
            if (!(result[15] === '')) {
                await addState(sid, 'bg_sat', result[15], device);
            }
            if (!(result[16] === '')) {
                await addState(sid, 'bg_rgb', result[16], device);
            }
            if (!(result[17] === '')) {
                await addState(sid, 'bg_ct', result[17], device);
            }
        } else {
            adapter.log.warn('EMPTY INITINAL RESPONSE');
        }

    } else {
        adapter.log.warn('NEW DEVICE FOUND, PLEASE ADD TO CONFIG: ' + aktYeelight.model + ', id: ' + aktYeelight.getId());
    }
}

async function addState(id, state, val, device) {

    let ct_min = 1700;
    const ct_max = 6500;
    let smartname = '';

    if (typeof device.type !== 'undefined') {
        if (device.type === 'ceiling1' ) {
            ct_min = 2500;
        }
        // change ct for pedant
        if (device.type === 'ceiling10' && (state.substring(0, 2) !== 'bg_')) {
            ct_min = 2500;
        }
    }
    if (typeof device.smart_name !== 'undefined') {
        if (device.smart_name !== '') {
            smartname = device.smart_name;
        }
        //adapter.log.warn(device.smart_name);
    }

    switch (state) {
        case 'power':
        case 'bg_power':
        case 'main_power':
            await adapter.setObjectNotExistsAsync(id + '.' + state, {
                type: 'state',
                common: {
                    name: state,
                    role: 'switch',
                    write: true,
                    read: true,
                    type: 'boolean',
                    smartName: {
                        de: smartname,
                        smartType: 'LIGHT'
                    }
                },
                native: {}
            });
            await adapter.setStateAsync(id + '.' + state, !!val, true);
            break;

        case 'set_scene':
            await adapter.setObjectNotExistsAsync(id + '.' + state, {
                type: 'state',
                common: {
                    name: state,
                    role: 'json',
                    write: true,
                    read: true,
                    type: 'string',

                },
                native: {}
            });
            await adapter.setStateAsync(id + '.' + state, val, true);
            break;

        case 'color_mode':
            await adapter.setObjectNotExistsAsync(id + '.' + state, {
                type: 'state',
                common: {
                    name: state,
                    role: 'switch.mode.color',
                    write: true,
                    read: true,
                    type: 'boolean'
                },
                native: {}
            });
            await adapter.setStateAsync(id + '.' + state, !!val, true);
            break;

        case 'moon_mode':
            await adapter.setObjectNotExistsAsync(id + '.' + state, {
                type: 'state',
                common: {
                    name: state,
                    role: 'switch.mode.moon',
                    write: true,
                    read: true,
                    type: 'boolean'
                },
                native: {}
            });
            await adapter.setStateAsync(id + '.' + state, !!val, true);
            break;
        case 'ct':
        case 'bg_ct':
            await adapter.setObjectNotExistsAsync(id + '.' + state, {
                type: 'state',
                common: {
                    name: state,
                    role: 'level.color.temperature',
                    write: true,
                    read: true,
                    type: 'number',
                    min: ct_min,
                    max: ct_max,
                    unit: 'K',
                    smartName: {
                        de: smartname,
                        smartType: 'LIGHT'
                    }
                },
                native: {}
            });
            await adapter.setStateAsync(id + '.' + state, parseInt(val), true);
            break;
        case 'active_bright':
        case 'bg_bright':
            await adapter.setObjectNotExistsAsync(id + '.' + state, {
                type: 'state',
                common: {
                    name: state,
                    role: 'level.dimmer',
                    write: true,
                    read: true,
                    type: 'number',
                    min: 0,
                    max: 100,
                    unit: '%',
                    smartName: {
                        de: smartname,
                        smartType: 'LIGHT',
                        byON: '-'
                    }
                },
                native: {}
            });
            await adapter.setStateAsync(id + '.' + state, parseInt(val), true);
            break;
        case 'hue':
        case 'bg_hue':
            await adapter.setObjectNotExistsAsync(id + '.' + state, {
                type: 'state',
                common: {
                    name: state,
                    role: 'level.color.hue',
                    write: true,
                    read: true,
                    type: 'number',
                    min: 0,
                    max: 360,
                    smartName: {
                        de: smartname,
                        smartType: 'LIGHT'
                    }
                },
                native: {}
            });
            await adapter.setStateAsync(id + '.' + state, parseInt(val), true);
            break;
        case 'sat':
        case 'bg_sat':
            await adapter.setObjectNotExistsAsync(id + '.' + state, {
                type: 'state',
                common: {
                    name: state,
                    role: 'level.color.saturation',
                    write: true,
                    read: true,
                    type: 'number',
                    min: 0,
                    max: 100,
                    smartName: {
                        de: smartname,
                        smartType: 'LIGHT'
                    }
                },
                native: {}
            });
            await adapter.setStateAsync(id + '.' + state, parseInt(val), true);
            break;
        case 'rgb':
        case 'bg_rgb':
            await adapter.setObjectNotExistsAsync(id + '.' + state, {
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
            await adapter.setStateAsync(id + '.' + state, val, true);
            break;
    }
}

function setStateDevice(aktYeelight, state) {
    //search light in Config
    const device = ConfigDevices.find(device => device.id === aktYeelight.getId());

    if (device) {
        let sid = device.name;
        adapter.setState(sid + '.info.connect', true, true);
        sid = sid + '.control';
        adapter.log.debug('DEVICE FOUND SET NOTIFY STATE: ' + JSON.stringify(device));

        for (const key in state) {
            switch (key) {
                case 'power':
                case 'main_power':
                case 'bg_power':
                    switch (state[key]) {
                        case 'on':
                            adapter.setState(sid + '.' + key, true, true);
                            break;
                        case 'off':
                            adapter.setState(sid + '.' + key, false, true);
                            break;
                    }
                    break;
                case 'bright':
                case 'active_bright':
                case 'ct':
                case 'bg_bright':
                case 'bg_ct':
                case 'bg_hue':
                case 'bg_sat':
                case 'sat':
                case 'hue':
                    if (key == 'bright') {
                        adapter.setState(sid + '.active_bright', +  parseInt(state[key]), true);
                    }
                    adapter.setState(sid + '.' + key, parseInt(state[key]), true);
                    break;
                case 'rgb':
                case 'bg_rgb':
                    adapter.setState(sid + '.' + key, dec2hex(state[key]), true);
                    break;
                case 'active_mode':
                    switch (+state[key]) {
                        case 0:
                            adapter.setState(sid + '.moon_mode', false, true);
                            break;
                        case 1:
                            adapter.setState(sid + '.moon_mode', true, true);
                            break;
                    }
                    break;
                case 'color_mode':
                    //modeVal = state[key];
                    switch (+state[key]) {
                        case 1:
                            adapter.setState(sid + '.color_mode', true, true);
                            break;
                        case 2:
                            adapter.setState(sid + '.color_mode', false, true);
                            break;
                    }
                    break;
            }
        }
    } else {
        adapter.log.debug('NEW DEVICE FOUND IN NOTIFY, PLEASE ADD TO CONFIG: ' + aktYeelight.model + ', id: ' + aktYeelight.getId());
    }


}

function dec2hex(dec) {
    const template = '#000000';
    const hexstring = dec.toString(16);
    return  template.substring(0,7 - hexstring.length) + hexstring;
}

function hex2dec(hex) {
    return parseInt(hex.substring(1), 16);
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
    let r, g, b;

    if (s == 0) {
        r = g = b = l; // achromatic
    } else {
        const hue2rgb = function hue2rgb(p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
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
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

    let r = parseInt(result[1], 16);
    let g = parseInt(result[2], 16);
    let b = parseInt(result[3], 16);

    r /= 255, g /= 255, b /= 255;
    const max = Math.max(r, g, b),
        min = Math.min(r, g, b);
    let h, s;
    const l = (max + min) / 2;

    if (max == min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            case b:
                h = (r - g) / d + 4;
                break;
        }
        h /= 6;
    }

    return [Math.round(h * 360), Math.round(s * 100)];
}

function generateWarnMessageForUploadState(parameter, value, id, err) {
    adapter.log.warn(`Could not set state (${parameter}) to value (${value}) for device: ${id}. Error: ${err}`);
}

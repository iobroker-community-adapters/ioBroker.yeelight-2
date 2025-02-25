/* eslint-disable jsdoc/require-param-description */
/* jshint -W097 */ // jshint strict:false
/*jslint node: true */
'use strict';

// The adapter-core module gives you access to the core ioBroker functions
const utils = require('@iobroker/adapter-core');
const scenen = require(`${__dirname}/lib/scenen`);
const YeelightSearch = require(`${__dirname}/yeelight-wifi/build/index`);

let Yeelights;
let gthis = null; // global to 'this' of Yeelight2 main instance

//just for test
const JSON = require('circular-json');
let timeOutInterval;
let ConfigDevices = [];
let ObjDevices = [];
const initializedLights = [];
let discoveryTimeout = null;

class Yeelight2 extends utils.Adapter {
    constructor(options) {
        super({
            ...options,
            name: 'yeelight-2',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('objectChange', this.onObjectChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        gthis = this;
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        this.main();
        this.log.debug(`DEVICES IN CONFIG: ${JSON.stringify(this.config.devices)}`);
        ConfigDevices = this.config.devices;
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     *
     * @param callback
     */
    onUnload(callback) {
        try {
            clearInterval(timeOutInterval);
            clearTimeout(discoveryTimeout);
            initializedLights.forEach(light => {
                try {
                    light.disconnect();
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                } catch (err) {
                    // ignore
                }
            });
            this.log.info('cleaned everything up...');
            callback();
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
            callback();
        }
    }

    // If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
    // You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
    /**
     * Is called if a subscribed object changes
     *
     * @param id
     * @param obj
     */
    onObjectChange(id, obj) {
        // Warning, obj can be null if it was deleted
        this.log.info(`objectChange ${id} ${JSON.stringify(obj)}`);
    }

    /**
     * Is called if a subscribed state changes
     *
     * @param id
     * @param state
     */
    onStateChange(id, state) {
        if (state && !state.ack) {
            const changeState = id.split('.');
            const sid = `${this.namespace}.${changeState[2]}`;

            // search id in config
            const findlight = ConfigDevices.find(device => device.name === changeState[2]);

            if (findlight) {
                if (changeState[3] !== 'info' && changeState[3] !== 'scenen') {
                    if (!state.ack) {
                        this.uploadState(findlight.id, changeState[4], state.val, sid);
                    }
                } else if (changeState[3] === 'scenen') {
                    if (!state.ack) {
                        this._sendscene(findlight.id, changeState[4], state.val);
                    }
                }
            } else {
                this.log.error(`LIGHT: ${changeState[2]} NOT FOUND IN CONFIG!`);
            }
        }
    }

    // If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
    /**
     * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
     * Using this method requires "common.messagebox" property to be set to true in io-package.json
     *
     * @param obj
     */
    onMessage(obj) {
        this.log.debug(`here is a Message: ${JSON.stringify(obj)}`);

        if (!obj) {
            return;
        }

        function reply(result) {
            gthis.sendTo(obj.from, obj.command, JSON.stringify(result), obj.callback);
        }

        switch (obj.command) {
            case 'discovery': {
                const deviceDiscovered = [];
                this.initYeelight();
                Yeelights.refresh();

                const foundHandler = Yeelights.on('found', light => {
                    deviceDiscovered.push({
                        model: light.model,
                        host: light.hostname,
                        port: light.port,
                        id: light.getId(),
                    });
                    this.log.debug(
                        `Found Light {id: ${light.getId()}, name: ${light.name}, model: ${light.model}, \nsupports: ${light.supports}}`,
                    );
                });

                discoveryTimeout = setTimeout(() => {
                    Yeelights && Yeelights.removeEventListener && Yeelights.removeEventListener('found', foundHandler);
                    reply(deviceDiscovered);
                }, 5000);

                return true;
            }
            default:
                this.log.debug(`Unknown command: ${obj.command}`);
                break;
        }
    }

    initYeelight() {
        if (Yeelights) {
            return;
        }
        Yeelights = new YeelightSearch();
        Yeelights.on('error', err => {
            gthis.log.error(`Yeelight Error: ${err}`);
        });
    }

    uploadState(id, parameter, value, sid) {
        if (!Yeelights) {
            return;
        }
        let checkHex = null;
        this.log.debug(`SEND STATE: id:${id}, state: ${parameter}, value: ${value}`);

        const aktYeelight = Yeelights.getYeelightById(id);
        if (aktYeelight) {
            switch (parameter) {
                case 'set_scene':
                    aktYeelight
                        .setScene(JSON.parse(value))
                        .catch(err => this.generateWarnMessageForUploadState(parameter, value, id, err));
                    break;
                case 'power':
                    if (value) {
                        aktYeelight
                            .turnOn()
                            .catch(err => this.generateWarnMessageForUploadState(parameter, value, id, err));
                        break;
                    }
                    aktYeelight
                        .turnOff()
                        .catch(err => this.generateWarnMessageForUploadState(parameter, value, id, err));
                    break;
                case 'bg_power':
                    if (value) {
                        aktYeelight
                            .turnOnBg()
                            .catch(err => this.generateWarnMessageForUploadState(parameter, value, id, err));
                        break;
                    }
                    aktYeelight
                        .turnOffBg()
                        .catch(err => this.generateWarnMessageForUploadState(parameter, value, id, err));
                    break;
                case 'active_bright':
                    aktYeelight
                        .setBrightness(value)
                        .catch(err => this.generateWarnMessageForUploadState(parameter, value, id, err));
                    break;
                case 'bg_bright':
                    aktYeelight
                        .setBrightnessBg(value)
                        .catch(err => this.generateWarnMessageForUploadState(parameter, value, id, err));
                    break;
                case 'ct':
                    aktYeelight
                        .setColorTemperature(value)
                        .catch(err => this.generateWarnMessageForUploadState(parameter, value, id, err));
                    break;
                case 'bg_ct':
                    aktYeelight
                        .setColorTemperatureBg(value)
                        .catch(err => this.generateWarnMessageForUploadState(parameter, value, id, err));
                    break;
                case 'moon_mode':
                    if (value) {
                        aktYeelight
                            .moonMode()
                            .catch(err => this.generateWarnMessageForUploadState(parameter, value, id, err));
                        break;
                    }
                    aktYeelight
                        .defaultMode()
                        .catch(err => this.generateWarnMessageForUploadState(parameter, value, id, err));
                    break;
                case 'rgb':
                    checkHex = /^#[0-9A-F]{6}$/i.test(value);
                    if (checkHex) {
                        aktYeelight
                            .setRGB(value, 'sudden', 400)
                            .catch(err => this.generateWarnMessageForUploadState(parameter, value, id, err));
                    } else {
                        this.log.warn('Please enter a Hex Format like: "#FF22AA"');
                    }
                    break;
                case 'bg_rgb':
                    checkHex = /^#[0-9A-F]{6}$/i.test(value);
                    if (checkHex) {
                        aktYeelight
                            .setRGBBg(value)
                            .catch(err => this.generateWarnMessageForUploadState(parameter, value, id, err));
                    } else {
                        this.log.warn('Please enter a Hex Format like: "#FF22AA"');
                    }
                    break;
                case 'hue':
                    // TODO catch NAN an 1-360;
                    this.getState(`${sid}.control.sat`, function (err, state) {
                        if (!state) {
                            return;
                        }
                        const saturation = state.val;
                        aktYeelight
                            .setHSV((value || '').toString(), (saturation || '').toString())
                            .catch(err => this.generateWarnMessageForUploadState(parameter, value, id, err));
                    });
                    break;
                case 'bg_hue':
                    this.getState(`${sid}.control.bg_sat`, function (err, state) {
                        if (!state) {
                            return;
                        }
                        const saturation = state.val;
                        aktYeelight
                            .setHSVBg((value || '').toString(), (saturation || '').toString())
                            .catch(err => this.generateWarnMessageForUploadState(parameter, value, id, err));
                    });
                    break;
                case 'sat':
                    // TODO catch NAN an 1-100;
                    this.getState(`${sid}.control.hue`, function (err, state) {
                        if (!state) {
                            return;
                        }
                        const hue = state.val;
                        aktYeelight
                            .setHSV((hue || '').toString(), (value || '').toString())
                            .catch(err => this.generateWarnMessageForUploadState(parameter, value, id, err));
                    });
                    break;
                case 'bg_sat':
                    this.getState(`${sid}.control.bg_hue`, function (err, state) {
                        if (!state) {
                            return;
                        }
                        const hue = state.val;
                        aktYeelight
                            .setHSVBg((hue || '').toString(), (value || '').toString())
                            .catch(err => this.generateWarnMessageForUploadState(parameter, value, id, err));
                    });
                    break;
                case 'color_mode':
                    if (value) {
                        aktYeelight
                            .colorMode()
                            .catch(err => this.generateWarnMessageForUploadState(parameter, value, id, err));
                        break;
                    }
                    aktYeelight
                        .defaultMode()
                        .catch(err => this.generateWarnMessageForUploadState(parameter, value, id, err));
                    break;
                default:
                    this.log.warn('State not found');
            }
        }
    }

    _sendscene(id, parameter, value) {
        if (!Yeelights) {
            return;
        }
        this.log.debug(`SEND SCENE: id:${id}, state: ${parameter}, value: ${value}`);

        const aktYeelight = Yeelights.getYeelightById(id);
        if (aktYeelight) {
            aktYeelight
                .setScene(scenen[parameter])
                .catch(err => this.generateWarnMessageForUploadState(parameter, value, id, err));
        }
    }

    _createscenen(sid) {
        for (const key in scenen) {
            this.setObjectNotExists(`${sid}.scenen.${key}`, {
                common: {
                    name: key,
                    role: 'button.scenen',
                    write: true,
                    read: false,
                    type: 'boolean',
                },
                type: 'state',
                native: {},
            });
        }
    }

    checkChanges(callback) {
        this.getForeignObjects(`${this.namespace}.*`, 'device', async function (err, list) {
            if (err) {
                this.log.error(err);
            } else {
                ObjDevices = list;

                gthis.log.debug(`DEVICES IN OBJECTS: ${JSON.stringify(ObjDevices)}`);

                const count = Object.keys(ObjDevices).length;
                gthis.log.debug(`DEVICES IN OBJECTS FOUND: ${count}`);
                //check every device
                for (let j = 0; j < count; j++) {
                    const element = Object.keys(ObjDevices)[j];
                    gthis.log.debug(`OBJ_ELEMENT: ${element}`);

                    const oldConfig = await getastate(element);
                    await ifinConfig(element, oldConfig);
                }

                gthis.subscribeStates('*');
                callback && callback();
            }
        });

        async function getastate(element) {
            const state = await gthis.getStateAsync(`${element}.info.com`);
            gthis.log.debug(`OLD CONF. FROM OBJ: ${state && state.val}`);
            try {
                return JSON.parse(state.val);
            } catch (err) {
                gthis.log.error(`Could not parse ${`${element}.info.com`}: ${err.message}`);
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
                    gthis.log.debug(`SMARTNAME: ${ConfigDevices[i].smart_name}`);
                    if (ConfigDevices[i].ip !== oldConfig.ip) {
                        await gthis.setStateAsync(`${element}.info.IPAdress`, ConfigDevices[i].ip, true);
                        await gthis.setStateAsync(`${element}.info.com`, JSON.stringify(ConfigDevices[i]), true);
                    }
                    if (ConfigDevices[i].port !== oldConfig.port) {
                        await gthis.setStateAsync(`${element}.info.Port`, parseInt(ConfigDevices[i].port), true);
                        await gthis.setStateAsync(`${element}.info.com`, JSON.stringify(ConfigDevices[i]), true);
                    }
                    if (ConfigDevices[i].smart_name !== oldConfig.smart_name) {
                        await changeSmartName(element, ConfigDevices[i].smart_name);
                        await gthis.setStateAsync(`${element}.info.com`, JSON.stringify(ConfigDevices[i]), true);
                    }
                }

                if (i === ConfigDevices.length - 1 && isThere === false) {
                    await delDev(element.split('.')[2]);

                    gthis.log.debug(`object: ${ObjDevices[element]._id} deleted`);
                }
            }
        }

        async function changeSmartName(element, newSm) {
            const Names = ['power', 'ct', 'active_bright', 'hue', 'sat'];
            try {
                const list = await gthis.getForeignObjectsAsync(`${element}.*`);

                for (let i = 0; i < Names.length; i++) {
                    if (typeof list[`${element}.control.${Names[i]}`] !== 'undefined') {
                        await gthis.extendObjectAsync(`${element}.control.${Names[i]}`, {
                            common: {
                                smartName: {
                                    de: newSm,
                                },
                            },
                        });
                    }
                }
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (err) {
                // ignore
            }

            gthis.log.debug(`changed ${Names.length} smartname to : ${newSm}`);
        }

        async function delDev(id) {
            gthis.log.warn(`DEL: ${id}`);
            try {
                await gthis.deleteDevice(id);
            } catch (err) {
                gthis.log.warn(err.message);
            }
        }
    }

    createDevices() {
        if (typeof ConfigDevices === 'undefined') {
            return;
        }

        for (let i = 0; i < ConfigDevices.length; i++) {
            const deviceSId = `${gthis.namespace}.${ConfigDevices[i].name}`;
            const deviceName = ConfigDevices[i].name;
            const deviceType = ConfigDevices[i].type;

            gthis.log.debug(`CREATE DEVICE: ${deviceSId}`);

            const deviceObj = {
                type: 'device',
                common: {
                    statusStates: {
                        onlineId: `${deviceSId}.info.connect`,
                    },
                    name: deviceType,
                    icon: `/icons/${deviceType}.png`,
                },
                native: {
                    sid: deviceName,
                    type: deviceType,
                },
            };
            gthis.extendObject(deviceName, deviceObj);

            const deviceInfoObj = {
                type: 'channel',
                common: {
                    name: 'info',
                },
                native: {},
            };
            gthis.setObjectNotExists(`${deviceName}.info`, deviceInfoObj);

            const deviceControlObj = {
                type: 'channel',
                common: {
                    name: 'control',
                },
                native: {},
            };
            gthis.setObjectNotExists(`${deviceName}.control`, deviceControlObj);

            const devicesScenesObj = {
                type: 'channel',
                common: {
                    name: 'scenen',
                },
                native: {},
            };
            gthis.extendObject(`${deviceName}.scenen`, devicesScenesObj);

            gthis._createscenen(deviceSId);

            gthis.setObjectNotExists(
                `${deviceSId}.info.com`,
                {
                    common: {
                        name: 'Command',
                        role: 'state',
                        write: false,
                        read: true,
                        type: 'string',
                    },
                    type: 'state',
                    native: {},
                },
                () => gthis.setStateChanged(`${deviceSId}.info.com`, JSON.stringify(ConfigDevices[i]), true),
            );

            gthis.setObjectNotExists(`${deviceSId}.info.connect`, {
                common: {
                    name: 'Connect',
                    role: 'indicator.connected',
                    write: false,
                    read: true,
                    type: 'boolean',
                },
                type: 'state',
                native: {},
            });

            gthis.setObjectNotExists(
                `${deviceSId}.info.IPAdress`,
                {
                    common: {
                        name: 'IP',
                        role: 'state',
                        write: false,
                        read: true,
                        type: 'string',
                    },
                    type: 'state',
                    native: {},
                },
                () => gthis.setStateChanged(`${deviceSId}.info.IPAdress`, ConfigDevices[i].ip, true),
            );

            gthis.setObjectNotExists(
                `${deviceSId}.info.Port`,
                {
                    common: {
                        name: 'Port',
                        role: 'state',
                        write: false,
                        read: true,
                        type: 'number',
                    },
                    type: 'state',
                    native: {},
                },
                () => gthis.setStateChanged(`${deviceSId}.info.Port`, parseInt(ConfigDevices[i].port), true),
            );

            if (i === ConfigDevices.length - 1) {
                gthis.listener();
            }
        }
    }

    checkOnline() {
        if (!Yeelights) {
            return;
        }
        const lights = Yeelights.yeelights;

        if (lights.length !== 0) {
            lights.forEach(element => {
                const device = ConfigDevices.find(device => device.id === element.id);
                if (device) {
                    const sid = device.name;

                    if (element.status !== 3) {
                        //turn off
                        this.setState(`${sid}.info.connect`, false, true);
                        this.log.debug(`YEELIGHT OFFLINE: ${element.id}`);
                    } else {
                        //turn on
                        this.setState(`${sid}.info.connect`, true, true);
                    }
                }
            });
        }
    }

    listener() {
        this.initYeelight();
        ConfigDevices.forEach((element, index) => setTimeout(() => Yeelights.addInitLights(element), index * 300));
        timeOutInterval = setInterval(() => {
            this.checkOnline();
        }, 60 * 1000);

        Yeelights.on('found', light => {
            if (initializedLights.find(l => l.id === light.id)) {
                this.log.debug(
                    `YEELIGHT FOUND (but already initialized): ${light.hostname}:${light.port}  id: ${light.getId()} model: ${light.model}`,
                );
                return;
            }
            initializedLights.push(light);
            this.log.debug(
                `YEELIGHT FOUND: ${light.hostname}:${light.port}  id: ${light.getId()} model: ${light.model}`,
            );
            light
                .getValues(
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
                    'bg_ct',
                )
                .then(() => {
                    light['initinalid'] = 1;
                })
                .catch(err => {
                    this.log.error(`Exception at calling getValues() for light ${light.id}: ${err.toString()}`);
                });

            light.on('error', function (id, ex, err) {
                gthis.log.error(`ERROR YEELIGHT CONNECTION: ${id}: ${ex}: ${err}`);
            });

            light.on('notification', message => {
                gthis.log.debug(`NOTIFY MESSAGE: from: ${light.getId()}, message: ${JSON.stringify(message)}`);
                //gthis.log.debug(JSON.stringify(Yeelights))
                if (message.method === 'props' && message.params) {
                    gthis.setStateDevice(light, message.params);
                }
            });

            light.on('response', (id, result) => {
                gthis.log.debug(`RESPONSE MESSAGE: from: ${light.getId()}, id: ${id}, result:[${result}]}`);
                //gthis.log.debug(JSON.stringify(light))
                if (result && result[0] !== 'ok') {
                    if (id === light.initinalid) {
                        gthis.log.debug(`INITINAL ID FOUND FOR: ${light.model}-${light.getId()}`);
                        gthis.initObj(light, result);
                    } else {
                        gthis.setResponse(light, result);
                    }
                }
            });
        });
    }

    setResponse(aktYeelight, result) {
        const device = ConfigDevices.find(device => device.id === aktYeelight.getId());

        //result:[off,100,16711680,2,4000]};
        if (device) {
            let sid = device.name;
            this.setState(`${sid}.info.connect`, true, true);
            sid = `${sid}.control`;
            this.log.debug(`DEVICE FOUND IN CONFIG: ${JSON.stringify(device)}`);
            if (result) {
                if (!(result[0] === '')) {
                    switch (result[0]) {
                        case 'on':
                            this.setState(`${sid}.power`, true, true);
                            break;
                        case 'off':
                            this.setState(`${sid}.power`, false, true);
                            break;
                    }
                }
                if (!(result[1] === '')) {
                    this.setState(`${sid}.active_bright`, parseInt(result[1]), true);
                }
                if (!(result[2] === '')) {
                    this.setState(`${sid}.rgb`, this.dec2hex(result[2]), true);
                }
                if (!(result[3] === '')) {
                    switch (+result[3]) {
                        case 1:
                            this.setState(`${sid}.color_mode`, true, true);
                            break;
                        case 2:
                            this.setState(`${sid}.color_mode`, false, true);
                            break;
                    }
                }
                if (!(result[4] === '')) {
                    this.setState(`${sid}.ct`, parseInt(result[4]), true);
                }
            } else {
                this.log.warn('EMPTY RESPONSE');
            }
        } else {
            this.log.warn(`NEW DEVICE FOUND, PLEASE ADD TO CONFIG: ${aktYeelight.model}, id: ${aktYeelight.getId()}`);
        }
    }

    main() {
        this.checkChanges(this.createDevices);
        this.subscribeStates('*');
    }

    generateWarnMessageForUploadState(parameter, value, id, err) {
        this.log.warn(`Could not set state (${parameter}) to value (${value}) for device: ${id}. Error: ${err}`);
    }

    async initObj(aktYeelight, result) {
        //search light in Config
        const device = ConfigDevices.find(device => device.id === aktYeelight.getId());

        //result = ["off", "1", "4000", "", "0", "2", "1", "", "", "0", "off", "off", "", "40", "180", "100", "65535", "4000"];
        if (device) {
            let sid = device.name;
            this.setState(`${sid}.info.connect`, true, true);
            sid = `${sid}.control`;
            this.log.debug(`DEVICE FOUND IN AND CONFIG: ${JSON.stringify(device)}`);

            if (result) {
                if (!(result[0] == '')) {
                    await this.addState(sid, 'set_scene', '', device);
                    switch (result[0]) {
                        case 'on':
                            await this.addState(sid, 'power', true, device);
                            break;
                        case 'off':
                            await this.addState(sid, 'power', false, device);
                            break;
                    }
                }
                if (!(result[5] == '')) {
                    await this.addState(sid, 'active_bright', Number(result[5]), device);
                } else {
                    await this.addState(sid, 'active_bright', Number(result[1]), device);
                }
                if (!(result[4] == '')) {
                    await this.addState(sid, 'ct', Number(result[4]), device);
                }
                if (!(result[2] == '')) {
                    await this.addState(sid, 'rgb', result[2], device);
                }
                if (!(result[6] == '')) {
                    switch (+result[6]) {
                        case 0:
                            await this.addState(sid, 'moon_mode', false, device);
                            break;
                        case 1:
                            await this.addState(sid, 'moon_mode', true, device);
                            break;
                    }
                }
                if (!(result[3] == '')) {
                    switch (+result[3]) {
                        case 1:
                            await this.addState(sid, 'color_mode', true, device);
                            break;
                        case 2:
                            await this.addState(sid, 'color_mode', false, device);
                            break;
                    }
                }
                if (!(result[7] == '')) {
                    await this.addState(sid, 'hue', Number(result[7]), device);
                }
                if (!(result[8] == '')) {
                    await this.addState(sid, 'sat', Number(result[8]), device);
                }
                if (!(result[10] == '')) {
                    switch (result[10]) {
                        case 'on':
                            await this.addState(sid, 'main_power', true, device);
                            break;
                        case 'off':
                            await this.addState(sid, 'main_power', false, device);
                            break;
                    }
                }
                if (!(result[11] == '')) {
                    switch (result[11]) {
                        case 'on':
                            await this.addState(sid, 'bg_power', true, device);
                            break;
                        case 'off':
                            await this.addState(sid, 'bg_power', false, device);
                            break;
                    }
                }
                if (!(result[13] == '')) {
                    await this.addState(sid, 'bg_bright', result[13], device);
                }
                if (!(result[14] == '')) {
                    await this.addState(sid, 'bg_hue', result[14], device);
                }
                if (!(result[15] == '')) {
                    await this.addState(sid, 'bg_sat', result[15], device);
                }
                if (!(result[16] == '')) {
                    await this.addState(sid, 'bg_rgb', result[16], device);
                }
                if (!(result[17] == '')) {
                    await this.addState(sid, 'bg_ct', result[17], device);
                }
            } else {
                this.log.warn('EMPTY INITINAL RESPONSE');
            }
        } else {
            this.log.warn(`NEW DEVICE FOUND, PLEASE ADD TO CONFIG: ${aktYeelight.model}, id: ${aktYeelight.getId()}`);
        }
    }

    async addState(id, state, val, device) {
        let ct_min = 1700;
        const ct_max = 6500;
        let smartname = '';

        if (typeof device.type !== 'undefined') {
            if (device.type === 'ceiling1') {
                ct_min = 2500;
            }
            // change ct for pedant
            if (device.type === 'ceiling10' && state.substring(0, 2) !== 'bg_') {
                ct_min = 2500;
            }
        }
        if (typeof device.smart_name !== 'undefined') {
            if (device.smart_name !== '') {
                smartname = device.smart_name;
            }
            //this.log.warn(device.smart_name);
        }

        switch (state) {
            case 'power':
            case 'bg_power':
            case 'main_power':
                await this.setObjectNotExistsAsync(`${id}.${state}`, {
                    type: 'state',
                    common: {
                        name: state,
                        role: 'switch',
                        write: true,
                        read: true,
                        type: 'boolean',
                        smartName: {
                            de: smartname,
                            smartType: 'LIGHT',
                        },
                    },
                    native: {},
                });
                await this.setStateAsync(`${id}.${state}`, !!val, true);
                break;

            case 'set_scene':
                await this.setObjectNotExistsAsync(`${id}.${state}`, {
                    type: 'state',
                    common: {
                        name: state,
                        role: 'json',
                        write: true,
                        read: true,
                        type: 'string',
                    },
                    native: {},
                });
                await this.setStateAsync(`${id}.${state}`, val, true);
                break;

            case 'color_mode':
                await this.setObjectNotExistsAsync(`${id}.${state}`, {
                    type: 'state',
                    common: {
                        name: state,
                        role: 'switch.mode.color',
                        write: true,
                        read: true,
                        type: 'boolean',
                    },
                    native: {},
                });
                await this.setStateAsync(`${id}.${state}`, !!val, true);
                break;

            case 'moon_mode':
                await this.setObjectNotExistsAsync(`${id}.${state}`, {
                    type: 'state',
                    common: {
                        name: state,
                        role: 'switch.mode.moon',
                        write: true,
                        read: true,
                        type: 'boolean',
                    },
                    native: {},
                });
                await this.setStateAsync(`${id}.${state}`, !!val, true);
                break;
            case 'ct':
            case 'bg_ct':
                await this.setObjectNotExistsAsync(`${id}.${state}`, {
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
                            smartType: 'LIGHT',
                        },
                    },
                    native: {},
                });
                await this.setStateAsync(`${id}.${state}`, parseInt(val), true);
                break;
            case 'active_bright':
            case 'bg_bright':
                await this.setObjectNotExistsAsync(`${id}.${state}`, {
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
                            byON: '-',
                        },
                    },
                    native: {},
                });
                await this.setStateAsync(`${id}.${state}`, parseInt(val), true);
                break;
            case 'hue':
            case 'bg_hue':
                await this.setObjectNotExistsAsync(`${id}.${state}`, {
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
                            smartType: 'LIGHT',
                        },
                    },
                    native: {},
                });
                await this.setStateAsync(`${id}.${state}`, parseInt(val), true);
                break;
            case 'sat':
            case 'bg_sat':
                await this.setObjectNotExistsAsync(`${id}.${state}`, {
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
                            smartType: 'LIGHT',
                        },
                    },
                    native: {},
                });
                await this.setStateAsync(`${id}.${state}`, parseInt(val), true);
                break;
            case 'rgb':
            case 'bg_rgb':
                await this.setObjectNotExistsAsync(`${id}.${state}`, {
                    type: 'state',
                    common: {
                        name: state,
                        role: `level.${state}`,
                        write: true,
                        read: true,
                        type: 'string',
                    },
                    native: {},
                });
                val = this.dec2hex(val);
                await this.setStateAsync(`${id}.${state}`, val, true);
                break;
        }
    }

    setStateDevice(aktYeelight, state) {
        //search light in Config
        const device = ConfigDevices.find(device => device.id === aktYeelight.getId());

        if (device) {
            let sid = device.name;
            this.setState(`${sid}.info.connect`, true, true);
            sid = `${sid}.control`;
            this.log.debug(`DEVICE FOUND SET NOTIFY STATE: ${JSON.stringify(device)}`);

            for (const key in state) {
                switch (key) {
                    case 'power':
                    case 'main_power':
                    case 'bg_power':
                        switch (state[key]) {
                            case 'on':
                                this.setState(`${sid}.${key}`, true, true);
                                break;
                            case 'off':
                                this.setState(`${sid}.${key}`, false, true);
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
                            this.setState(`${sid}.active_bright`, +parseInt(state[key]), true);
                        }
                        this.setState(`${sid}.${key}`, parseInt(state[key]), true);
                        break;
                    case 'rgb':
                    case 'bg_rgb':
                        this.setState(`${sid}.${key}`, this.dec2hex(state[key]), true);
                        break;
                    case 'active_mode':
                        switch (+state[key]) {
                            case 0:
                                this.setState(`${sid}.moon_mode`, false, true);
                                break;
                            case 1:
                                this.setState(`${sid}.moon_mode`, true, true);
                                break;
                        }
                        break;
                    case 'color_mode':
                        //modeVal = state[key];
                        switch (+state[key]) {
                            case 1:
                                this.setState(`${sid}.color_mode`, true, true);
                                break;
                            case 2:
                                this.setState(`${sid}.color_mode`, false, true);
                                break;
                        }
                        break;
                }
            }
        } else {
            this.log.debug(
                `NEW DEVICE FOUND IN NOTIFY, PLEASE ADD TO CONFIG: ${aktYeelight.model}, id: ${aktYeelight.getId()}`,
            );
        }
    }

    dec2hex(dec) {
        const template = '#000000';
        const hexstring = dec.toString(16);
        return template.substring(0, 7 - hexstring.length) + hexstring;
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param [options]
     */
    module.exports = options => new Yeelight2(options);
} else {
    // otherwise start the instance directly
    new Yeelight2();
}

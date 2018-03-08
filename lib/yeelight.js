var url = require('url');
var net = require('net');
var udp = require('dgram');
var qs = require('querystring');

/**
 * Yeelight constructor.
 * @param {String} id
 * @param {Number} port
 * @param {String} host
 * @param {Array}  methods
 * @constructor
 */
function Yeelight(id, port, host, model, methods) {
	this.id = id;
	this.port = port;
	this.host = host;
	this.model = model;
	this.methods = methods;
}

/**
 * Available Devices
 * @type {Yeelight[]}
 * @private
 */
Yeelight._devices = [];

/**
 * SSDP socket
 * @type {Socket}
 * @private
 */
Yeelight._socket = null;

/**
 * Send command to Yeelight device.
 * @see   http://www.yeelight.com/download/Yeelight_Inter-Operation_Spec.pdf
 * @param {String}        method     Method of command
 * @param {Array|String}  [params]   Parameters
 * @param {Function}      [callback] Callback function
 */
Yeelight.prototype.sendCommand = function (method, params, callback) {
	var self = this;
	var socket = net.connect(this.port, this.host);
	if (params === null || params === undefined) {
		params = [];
	} else if (!Array.isArray(params)) {
		params = [params];
	}
	socket.write(JSON.stringify({
		id: 0,
		method: method,
		params: params
	}) + '\r\n');
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
				callback(null, data['result']);
			}
		}
		socket.destroy();
	});
	socket.on('error', function (err) {
		socket.destroy();
		callback && callback(err);
		Yeelight.removeDevice(self);
	});
};

/**
 * Discover Yeelight LED devices by SSDP(Simple Service Discovery Protocol).
 * @see https://tools.ietf.org/html/draft-cai-ssdp-v1-03
 * @param {Function} [callback]
 */
Yeelight.discover = function (callback) {
	var port = 1982;
	var host = '239.255.255.250';
	var socket = udp.createSocket('udp4');

	Yeelight.stopDiscovering();
	Yeelight._socket = socket;

	socket.on('message', function (message) {
		var data = qs.parse(message.toString(), '\r\n', ': ');
		var location = data['Location'];
		var methods = data['support'];
		if (location) {
			var urlObj = url.parse(location);
			var yeeLight = new Yeelight(
				data['id'],
				urlObj['port'],
				urlObj['hostname'],
				data['model'],
				methods ? methods.trim().split(' ') : []
			);
			if (Yeelight.addDevice(yeeLight) && callback) {
				callback(yeeLight);
			}
		}
	});
	socket.bind(port, function () {
        socket.addMembership(host);
        var sendMsg;
        if (typeof Buffer.from === "function") { // Node 6+
            try {
                sendMsg = Buffer.from('M-SEARCH * HTTP/1.1\r\n' +
                    'HOST: ' + host + ':' + port + '\r\n' +
                    'MAN: "ssdp:discover"\r\n' +
                    'ST: wifi_bulb\r\n');
                socket.send(sendMsg, port, host);
            }
            catch (e) {
                //self.adapter.log.warn("Warning Buffer function  is empty, try new Buffer");
           
            }

        } else { //Node 4
            sendMsg = new Buffer('M-SEARCH * HTTP/1.1\r\n' +
                'HOST: ' + host + ':' + port + '\r\n' +
                'MAN: "ssdp:discover"\r\n' +
                'ST: wifi_bulb\r\n');
            socket.send(sendMsg, port, host);
        }
		
	});
};

/**
 * Stop discovering devices.
 */
Yeelight.stopDiscovering = function () {
	if (Yeelight._socket) {
		Yeelight._socket.close();
		Yeelight._socket = null;
	}
};

/**
 * Add a Yeelight device.
 * @param  {Yeelight} device
 * @return {Boolean}  If the device is added
 */
Yeelight.addDevice = function (device) {
	var id = device.id;
	var devices = Yeelight._devices;
	for (var i = 0, l = devices.length; i < l; ++i) {
		var curDevice = devices[i];
		if (curDevice.id === id) {
			return false;
		}
	}
	devices.push(device);
	return true;
};

/**
 * Remove a Yeelight device.
 * @param  {Yeelight} device
 * @return {Boolean}  If the device is removed
 */
Yeelight.removeDevice = function (device) {
	var id = device.id;
	var devices = Yeelight._devices;
	for (var i = 0, l = devices.length; i < l; ++i) {
		if (devices[i]['id'] === id) {
			devices.splice(i, 1);
			return true;
		}
	}
	return false;
};

/**
 * Remove all Yeelight devices.
 */
Yeelight.removeAllDevices = function () {
	Yeelight._devices = [];
};

/**
 * Get all Yeelight devices.
 * @return {Yeelight[]} Yeelight devices
 */
Yeelight.getDevices = function () {
	return this._devices.concat();
};

/**
 * Get Yeelight device by id.
 * @param  {String}   id
 * @return {Yeelight} The Yeelight device
 */
Yeelight.getDeviceById = function (id) {
	var devices = Yeelight._devices;
	for (var i = 0, l = devices.length; i < l; ++i) {
		if (devices[i]['id'] === id) {
			return devices[i];
		}
	}
	return null;
};

module.exports = Yeelight;

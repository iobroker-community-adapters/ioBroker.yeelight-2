'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.YeelightStatus = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _net = require('net');

var _net2 = _interopRequireDefault(_net);

var _joi = require('joi');

var _url = require('url');

var _url2 = _interopRequireDefault(_url);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _utils = require('./utils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var YeelightStatus = exports.YeelightStatus = {
  OFFLINE: 0,
  SSDP: 1,
  UPDATING: 2,
  ONLINE: 3

  /**
   * Class Yeelight provides all functionality
   * @param {object} yeelightData
   * @example
   * {
   *  LOCATION: 'yeelight://10.0.0.33:55443',
   *  ID: '0x0000000000000000',
   *  SUPPORT: 'get_prop set_default set_power toggle set_bright start_cf stop_cf set_scene cron_add cron_get cron_del set_ct_abx set_rgb set_hsv set_adjust set_music set_name',
   *  NAME: 'Living Room',
   *  MODEL: 'color',
   * }
   * @extends EventEmitter
   */
};
var Yeelight = function (_EventEmitter) {
  _inherits(Yeelight, _EventEmitter);

  function Yeelight(data) {
    _classCallCheck(this, Yeelight);

    var _this = _possibleConstructorReturn(this, (Yeelight.__proto__ || Object.getPrototypeOf(Yeelight)).call(this));

    if (typeof data === 'undefined' || (typeof data === 'undefined' ? 'undefined' : _typeof(data)) !== 'object') {
      throw new Error('options are needed');
    }

    var parsedUri = _url2.default.parse(data.LOCATION);
    if (parsedUri.protocol !== 'yeelight:') {
      throw new Error(parsedUri.protocol + ' is not supported');
    }

    _this.config = {
      refresh: 30
    };

    _this.id = data.ID;
    _this.name = data.NAME;
    _this.model = data.MODEL;
    _this.port = parsedUri.port;
    _this.hostname = parsedUri.hostname;
    _this.supports = data.SUPPORT.split(' ');
    if (_this.SUPPORT_OBJ) _this.supports = _this.SUPPORT_OBJ;
    _this.status = YeelightStatus.SSDP;
    _this.lastKnown = Date.now();

    _this.reqCount = 1;
    _this.log = (0, _debug2.default)('Yeelight-' + _this.name);

    _this.socket = new _net2.default.Socket();
    _this.socket.setKeepAlive(true);
    _this.socket.setTimeout(_this.config.refresh * 1000);

    _this.socket.on('data', _this.formatResponse.bind(_this));

    _this.socket.on('close', function () {
      _this.log('closed connection to ' + _this.name + ' id ' + _this.id + ' on ' + _this.hostname + ':' + _this.port);
      _this.status = YeelightStatus.OFFLINE;
      setTimeout(_this.reconnect2.bind(_this), _this.config.refresh * 1000);
    });

    _this.socket.on('timeout', _this.refresh.bind(_this));

    _this.socket.on('error', function (err) {
      if (err.code == 'ECONNRESET') {
        _this.log('Connection reset on id ' + _this.id + ' ' + _this.hostname + ':' + _this.port + ' connection');
        _this.status = YeelightStatus.OFFLINE;
        _this.socket.connect(_this.port, _this.hostname, () => _this.connect());
      } else if (err.code == 'ECONNREFUSED') {
        _this.status = YeelightStatus.OFFLINE;
        _this.log('Connection refused on id ' + _this.id + ' ' + _this.hostname + ':' + _this.port + ' connection');
      } else if (err.code == 'EHOSTUNREACH') {
        // retry connect in x sec.
        _this.status = YeelightStatus.OFFLINE;
        setTimeout(_this.reconnect2.bind(_this), 20 * 1000);
      }
      _this.emit('error', _this.id, 'Connection ' + _this.hostname + ':' + _this.port, err);
    });

    _this.socket.connect(_this.port, _this.hostname, () => _this.connect());
    return _this;
  }

  /**
   * reconnect reconnects to the light, use it when connection is reset after power failure
   *
   */


  _createClass(Yeelight, [{
    key: 'reconnect',
    value: function reconnect(data) {
      // Address could change
      this.parsedUri = _url2.default.parse(data.LOCATION);
      if (this.parsedUri.protocol !== 'yeelight:') {
        throw new Error(this.parsedUri.protocol + ' is not supported');
      }
      this.port = this.parsedUri.port;
      this.hostname = this.parsedUri.hostname;
      this.socket.connect(this.port, this.hostname, () => this.connect());
    }

    /**
     * reconnect reconnects to the light, use it when lights first connection ist failed
     *
     */

  }, {
    key: 'reconnect2',
    value: function reconnect2() {
      this.socket.connect(this.port, this.hostname, () => this.connect());
    }

    /**
     * connect function called when socket is connected
     * @private
     *
     */

  }, {
    key: 'connect',
    value: function connect() {
      this.log('connected to ' + this.name + ' id ' + this.id + ' on ' + this.hostname + ':' + this.port);
      this.socket.setKeepAlive(true);
      this.socket.setTimeout(this.config.refresh * 1000);
      this.emit('connected');
      this.status = YeelightStatus.ONLINE;
    }

    /**
     * refresh function called periodically
     * @private
     *
     */

  }, {
    key: 'refresh',
    value: function refresh() {
      this.log('Connection refresh on ' + this.name + ' id ' + this.id + ' on ' + this.hostname + ':' + this.port);

      if (Date.now() - this.lastKnown > 2 * this.config.refresh * 1000 + 100) {
        this.status = YeelightStatus.OFFLINE;
      } else {
        this.status = YeelightStatus.ONLINE;
      }
      this.socket.setKeepAlive(true);
      this.socket.setTimeout(this.config.refresh * 1000);
      this.getValues('power', 'bright', 'rgb', 'color_mode', 'ct');
    }

    /**
     * sendRequest validates the given params and send the request to the Yeelight
     * @private
     *
     * @param {object} method method to be called 'set_power'
     * @param {object} params array with params ['on', 'smooth', '1000']
     * @param {object} schema schema for validation
     */

  }, {
    key: 'sendRequest',
    value: function sendRequest(method, params, schema) {
      var _this2 = this;

      return new Promise(function (resolve, reject) {
        if (!schema) {
          schema = _joi.any(); //eslint-disable-line
        }

        const result = schema.validate(params);

        if (result.error) {
          reject(err);
          return;
        }

        var req = JSON.stringify({
          method: method,
          params: result.value,
          id: _this2.reqCount
        });

        // Avoid to send data on stale sockets
        if (_this2.status >= YeelightStatus.OFFLINE) {
          _this2.log('sending req: ' + req);

          _this2.socket.write(req + '\r\n', function (err) {
            if (err) {
              _this2.log('Error sending req: ' + req + ' on ' + err.address);
              reject(err);
              return;
            }
            resolve(_this2.reqCount);
            _this2.reqCount += 1;
          });
        } else {
          _this2.log('Not sending request for offline bulb');
          resolve();
        }
      });
    }

    /**
     * formats the incomming repsonses from the Yeelight
     * the result will trigger an 'response' event with id and result as payload
     * @private
     *
     * @param {string} resp response comming from the socket as a json string
     */

  }, {
    key: 'formatResponse',
    value: function formatResponse(resp) {
      try {
        var json = JSON.parse(resp);
        var id = json.id;
        var result = json.result;

        if (!id) {
          this.log('got response without id: ' + resp.toString().replace(/\r\n/, ''));
          this.emit('notifcation', json);
          return;
        }

        this.lastKnown = Date.now();
        this.status = YeelightStatus.ONLINE;

        this.log('got response: ' + resp.toString().replace(/\r\n/, ''));

        if (json && json.error) {
          var error = new Error(json.error.message);
          error.code = json.error.code;
          this.emit('error', id, error);
        } else {
          this.emit('response', id, result);
        }
      } catch (ex) {
        this.emit('error', null, ex, resp);
      }
    }

    /**
     * returns The ID provided by the Yeelight
     * @returns {string} uuid given by the yeelightData
     */

  }, {
    key: 'getId',
    value: function getId() {
      return this.id;
    }

    /**
     * returns The MODEL provided by the Yeelight
     * @returns {string} model string 'color' or 'mono'
     */

  }, {
    key: 'getModel',
    value: function getModel() {
      return this.model;
    }

    /**
     * returns The NAME provided by the Yeelight
     * @returns {string} Yeelight name
     */

  }, {
    key: 'getName',
    value: function getName() {
      return this.name;
    }

    /**
     * Sets the name on the Yeelight
     * @param {string} name
     * @returns {Promise} will be invoked after successfull or failed send
     */

  }, {
    key: 'setName',
    value: function setName(name) {
      var schema = _joi.array().items(_joi.string().required());
      return this.sendRequest('set_name', [name], schema);
    }

    /**
     * This method is used to retrieve current property of smart LED.
     * @param {array} props The parameter is a list of property names and the response contains
     * a list of corresponding property values. If the requested property name is not recognized by
     * smart LED, then a empty string value ("") will be returned.
     *
     * @example
     * getValues('power', 'bright');
     *
     * @returns {Promise} will be invoked after successfull or failed send
     */

  }, {
    key: 'getValues',
    value: function getValues() {
      for (var _len = arguments.length, props = Array(_len), _key = 0; _key < _len; _key++) {
        props[_key] = arguments[_key];
      }

      return this.sendRequest('get_prop', props);
    }

    /**
     * This method is used to toggle the smart LED.
     * @returns {Promise} will be invoked after successfull or failed send
     */

  }, {
    key: 'toggle',
    value: function toggle() {
      return this.sendRequest('toggle', []);
    }

    /**
     * This method is used to save current state of smart LED in persistent memory.
     * So if user powers off and then powers on the smart LED again (hard power reset),
     * the smart LED will show last saved state.
     * @returns {Promise} will be invoked after successfull or failed send
     */

  }, {
    key: 'setDefaultState',
    value: function setDefaultState() {
      return this.sendRequest('set_default', []);
    }
    /**
     * This method is used to save current state of smart LED in persistent memory.
     * So if user powers off and then powers on the smart LED again (hard power reset),
     * the smart LED will show last saved state.
     * @returns {Promise} will be invoked after successfull or failed send
     */

  }, {
    key: 'setDefaultStateBg',
    value: function setDefaultStateBg() {
      return this.sendRequest('bg_set_default', []);
    }

    /**
     * Will change the color temperature of the Yeelight
     * @param {string} temperature is the target color temperature. The type is integer and
     * range is 1700 ~ 6500 (k).
     *
     * @param {string} [effect='smooth'] support two values: 'sudden' and 'smooth'. If effect is 'sudden',
     * then the color temperature will be changed directly to target value, under this case, the
     * third parameter 'duration' is ignored. If effect is 'smooth', then the color temperature will
     * be changed to target value in a gradual fashion, under this case, the total time of gradual
     * change is specified in third parameter "duration".
     *
     * @param {number} [time=1000] time specifies the total time of the gradual changing. The unit is
     * milliseconds. The minimum support duration is 30 milliseconds.
     *
     * @example
     * setColorTemperature(5000);
     * setColorTemperature(5000, 'sudden');
     * setColorTemperature(5000, 'smooth', 1000);
     *
     * @returns {Promise} will be invoked after successfull or failed send
     */

  }, {
    key: 'setColorTemperature',
    value: function setColorTemperature(temperature) {
      var effect = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'smooth';
      var time = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1000;

      var schema = _joi.array().items(_joi.number().min(1700).max(6500).required(), _joi.string().allow('sudden', 'smooth').required(), _joi.number().required());
      return this.sendRequest('set_ct_abx', [temperature, effect, time], schema);
    }

    /**
     * Will change the color temperature of the Yeelight
     * @param {string} temperature is the target color temperature. The type is integer and
     * range is 1700 ~ 6500 (k).
     *
     * @param {string} [effect='smooth'] support two values: 'sudden' and 'smooth'. If effect is 'sudden',
     * then the color temperature will be changed directly to target value, under this case, the
     * third parameter 'duration' is ignored. If effect is 'smooth', then the color temperature will
     * be changed to target value in a gradual fashion, under this case, the total time of gradual
     * change is specified in third parameter "duration".
     *
     * @param {number} [time=1000] time specifies the total time of the gradual changing. The unit is
     * milliseconds. The minimum support duration is 30 milliseconds.
     *
     * @example
     * setColorTemperatureBg(5000);
     * setColorTemperatureBg(5000, 'sudden');
     * setColorTemperatureBg(5000, 'smooth', 1000);
     *
     * @returns {Promise} will be invoked after successfull or failed send
     */

  }, {
    key: 'setColorTemperatureBg',
    value: function setColorTemperatureBg(temperature) {
      var effect = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'smooth';
      var time = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1000;

      var schema = _joi.array().items(_joi.number().min(1700).max(6500).required(), _joi.string().allow('sudden', 'smooth').required(), _joi.number().required());
      return this.sendRequest('bg_set_ct_abx', [temperature, effect, time], schema);
    }

    /**
     * This method is used to change the brightness of a smart LED.
     * @param {string} brightness is the target brightness. The type is integer and ranges
     * from 1 to 100. The brightness is a percentage instead of a absolute value. 100 means
     * maximum brightness while 1 means the minimum brightness.
     *
     * @param {string} [effect='smooth']  Refer to 'setColorTemperature' method.
     * @param {number} [time=1000] Refer to 'setColorTemperature' method.
     *
     * @example
     * setBrightness(25);
     * setBrightness(25, 'sudden');
     * setBrightness(25, 'smooth', 1000);
     *
     * @returns {Promise} will be invoked after successfull or failed send
     */

  }, {
    key: 'setBrightness',
    value: function setBrightness(brightness) {
      var effect = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'smooth';
      var time = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1000;

      var schema = _joi.array().items(_joi.number().min(0).max(100).required(), _joi.string().allow('sudden', 'smooth').required(), _joi.number().required());
      return this.sendRequest('set_bright', [brightness, effect, time], schema);
    }

    /**
     * This method is used to change the brightness of a smart LED.
     * @param {string} brightness is the target brightness. The type is integer and ranges
     * from 1 to 100. The brightness is a percentage instead of a absolute value. 100 means
     * maximum brightness while 1 means the minimum brightness.
     *
     * @param {string} [effect='smooth']  Refer to 'setColorTemperature' method.
     * @param {number} [time=1000] Refer to 'setColorTemperature' method.
     *
     * @example
     * setBrightnessBg(25);
     * setBrightnessBg(25, 'sudden');
     * setBrightnessBg(25, 'smooth', 1000);
     *
     * @returns {Promise} will be invoked after successfull or failed send
     */

  }, {
    key: 'setBrightnessBg',
    value: function setBrightnessBg(brightness) {
      var effect = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'smooth';
      var time = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1000;

      var schema = _joi.array().items(_joi.number().min(0).max(100).required(), _joi.string().allow('sudden', 'smooth').required(), _joi.number().required());
      return this.sendRequest('bg_set_bright', [brightness, effect, time], schema);
    }

    /**
     * This method is used to switch on the smart LED (software managed on/off).
     * @param {string} [effect='smooth']  Refer to 'setColorTemperature' method.
     * @param {number} [time=1000] Refer to 'setColorTemperature' method.
     *
     * @example
     * turnOn();
     * turnOn('sudden');
     * turnOn('smooth', 1000);
     *
     * @returns {Promise} will be invoked after successfull or failed send
     */

  }, {
    key: 'turnOn',
    value: function turnOn() {
      var effect = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'smooth';
      var time = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1000;

      var schema = _joi.array().items(_joi.any().required(), _joi.string().allow('sudden', 'smooth').required(), _joi.number().required());
      return this.sendRequest('set_power', ['on', effect, time], schema);
    }

    /**
     * This method is used to switch on the smart LED (software managed on/off).
     * @param {string} [effect='smooth']  Refer to 'setColorTemperature' method.
     * @param {number} [time=1000] Refer to 'setColorTemperature' method.
     *
     * @example
     * turnOnBg();
     * turnOnBg('sudden');
     * turnOnBg('smooth', 1000);
     *
     * @returns {Promise} will be invoked after successfull or failed send
     */

  }, {
    key: 'turnOnBg',
    value: function turnOnBg() {
      var effect = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'smooth';
      var time = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1000;

      var schema = _joi.array().items(_joi.any().required(), _joi.string().allow('sudden', 'smooth').required(), _joi.number().required());
      return this.sendRequest('bg_set_power', ['on', effect, time], schema);
    }

    /**
     * This method is used to switch off the smart LED (software managed on/off).
     * @param {string} [effect='smooth']  Refer to 'setColorTemperature' method.
     * @param {number} [time=1000] Refer to 'setColorTemperature' method.
     *
     * @example
     * turnOff();
     * turnOff('sudden');
     * turnOff('smooth', 1000);
     *
     * @returns {Promise} will be invoked after successfull or failed send
     */

  }, {
    key: 'turnOff',
    value: function turnOff() {
      var effect = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'smooth';
      var time = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1000;

      var schema = _joi.array().items(_joi.any().required(), _joi.string().allow('sudden', 'smooth').required(), _joi.number().required());
      return this.sendRequest('set_power', ['off', effect, time], schema);
    }

    /**
     * This method is used to switch off the smart LED (software managed on/off).
     * @param {string} [effect='smooth']  Refer to 'setColorTemperature' method.
     * @param {number} [time=1000] Refer to 'setColorTemperature' method.
     *
     * @example
     * turnOffBg();
     * turnOffBg('sudden');
     * turnOffBg('smooth', 1000);
     *
     * @returns {Promise} will be invoked after successfull or failed send
     */

  }, {
    key: 'turnOffBg',
    value: function turnOffBg() {
      var effect = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'smooth';
      var time = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1000;

      var schema = _joi.array().items(_joi.any().required(), _joi.string().allow('sudden', 'smooth').required(), _joi.number().required());
      return this.sendRequest('bg_set_power', ['off', effect, time], schema);
    }

    /**
     * This method is used to switch on the smart LED (software managed on/off).
     * @param {string} [effect='smooth']  Refer to 'setColorTemperature' method.
     * @param {number} [time=1000] Refer to 'setColorTemperature' method.
     *
     * @example
     * moonMode();
     * moonMode('sudden');
     * moonMode('smooth', 1000);
     *
     * @returns {Promise} will be invoked after successfull or failed send
     */

  }, {
    key: 'moonMode',
    value: function moonMode() {
      var effect = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'smooth';
      var time = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1000;

      var schema = _joi.array().items(_joi.any().required(), _joi.string().allow('sudden', 'smooth').required(), _joi.number().required());
      return this.sendRequest('set_power', ['on', effect, time, 5], schema);
    }
    /**
     * This method is used to switch on the smart LED (software managed on/off).
     * @param {string} [effect='smooth']  Refer to 'setColorTemperature' method.
     * @param {number} [time=1000] Refer to 'setColorTemperature' method.
     *
     * @example
     * defaultMode();
     * defaultMode('sudden');
     * defaultMode('smooth', 1000);
     *
     * @returns {Promise} will be invoked after successfull or failed send
     */

  }, {
    key: 'defaultMode',
    value: function defaultMode() {
      var effect = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'smooth';
      var time = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1000;

      var schema = _joi.array().items(_joi.any().required(), _joi.string().allow('sudden', 'smooth').required(), _joi.number().required());
      return this.sendRequest('set_power', ['on', effect, time, 1], schema);
    }

    /**
     * This method is used to switch on the smart LED (software managed on/off).
     * @param {string} [effect='smooth']  Refer to 'setColorTemperature' method.
     * @param {number} [time=1000] Refer to 'setColorTemperature' method.
     *
     * @example
     * colorMode();
     * colorMode('sudden');
     * colorMode('smooth', 1000);
     *
     * @returns {Promise} will be invoked after successfull or failed send
     */

  }, {
    key: 'colorMode',
    value: function colorMode() {
      var effect = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'smooth';
      var time = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1000;

      var schema = _joi.array().items(_joi.any().required(), _joi.string().allow('sudden', 'smooth').required(), _joi.number().required());
      return this.sendRequest('set_power', ['on', effect, time, 2], schema);
    }

    /**
       * This method is used to set the smart LED directly to specified state. If +
       * the smart LED is off, then it will turn on the smart LED firstly and
       * then apply the specified command.
       * @param {array} params can be "color", "hsv", "ct", "cf", "auto_dealy_off".
       * <br>"color" means change the smart LED to specified color and brightness.
       * <br>"hsv" means change the smart LED to specified color and brightness"
       * <br>"ct" means change the smart LED to specified ct and brightness.
       * <br>"cf" means start a color flow in specified fashion.
       * <br>c"auto_delay_off" means turn on the smart LED to specified
       * brightness and start a sleep timer to turn off the light after the specified minutes.
     "val1", "val2", "val3" are class specific.
       *
       * @example
       * setScene(['color', 65280, 70]);
       * setScene(['hsv', 300, 70, 100]);
       * setScene(['ct', 5400, 100]);
       * setScene(['cf', 0, 0, '500,1,255,100,1000,1,16776960,70']);
       *
       * @returns {Promise} will be invoked after successfull or failed send
       */

  }, {
    key: 'setScene',
    value: function setScene(params) {
      var schema = _joi.array().items(_joi.string().allow('color', 'hsv', 'ct', 'auto_delay_off').required(), _joi.any().required(), _joi.any().required(), _joi.any());
      return this.sendRequest('set_scene', params, schema);
    }

    /**
       * This method is used to set the smart LED directly to specified state. If +
       * the smart LED is off, then it will turn on the smart LED firstly and
       * then apply the specified command.
       * @param {array} params can be "color", "hsv", "ct", "cf", "auto_dealy_off".
       * <br>"color" means change the smart LED to specified color and brightness.
       * <br>"hsv" means change the smart LED to specified color and brightness"
       * <br>"ct" means change the smart LED to specified ct and brightness.
       * <br>"cf" means start a color flow in specified fashion.
       * <br>c"auto_delay_off" means turn on the smart LED to specified
       * brightness and start a sleep timer to turn off the light after the specified minutes.
     "val1", "val2", "val3" are class specific.
       *
       * @example
       * setSceneBg(['color', 65280, 70]);
       * setSceneBg(['hsv', 300, 70, 100]);
       * setSceneBg(['ct', 5400, 100]);
       * setSceneBg(['cf', 0, 0, '500,1,255,100,1000,1,16776960,70']);
       *
       * @returns {Promise} will be invoked after successfull or failed send
       */

  }, {
    key: 'setSceneBg',
    value: function setSceneBg(params) {
      var schema = _joi.array().items(_joi.string().allow('color', 'hsv', 'ct', 'auto_delay_off').required(), _joi.any().required(), _joi.any().required(), _joi.any());
      return this.sendRequest('bg_set_scene', params, schema);
    }

    /**
     * This method is used to change the color of a smart LED.
     * @param {string} hex is the target color, whose type is integer.
     * It should be expressed in hex 0xFFFFFF.
     *
     * @param {string} [effect='smooth']  Refer to 'setColorTemperature' method.
     * @param {number} [time=1000] Refer to 'setColorTemperature' method.
     *
     * @example
     * setRGB('#ffffff');
     * setRGB('#ffffff', 'sudden');
     * setRGB('#ffffff', 'smooth', 1000);
     *
     * @returns {Promise} will be invoked after successfull or failed send
     */

  }, {
    key: 'setRGB',
    value: function setRGB(hex) {
      var effect = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'smooth';
      var time = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1000;

      var color = (0, _utils.hexToRgb)(hex);
      var colorDec = color.red * 65536 + color.green * 256 + color.blue;
      var schema = _joi.array().items(_joi.number().min(0).max(16777215).required(), _joi.string().allow('sudden', 'smooth').required(), _joi.number().required());
      return this.sendRequest('set_rgb', [colorDec, effect, time], schema);
    }

    /**
     * This method is used to change the color of a smart LED.
     * @param {string} hex is the target color, whose type is integer.
     * It should be expressed in hex 0xFFFFFF.
     *
     * @param {string} [effect='smooth']  Refer to 'setColorTemperature' method.
     * @param {number} [time=1000] Refer to 'setColorTemperature' method.
     *
     * @example
     * setRGBBg('#ffffff');
     * setRGBBg('#ffffff', 'sudden');
     * setRGBBg('#ffffff', 'smooth', 1000);
     *
     * @returns {Promise} will be invoked after successfull or failed send
     */

  }, {
    key: 'setRGBBg',
    value: function setRGBBg(hex) {
      var effect = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'smooth';
      var time = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1000;

      var color = (0, _utils.hexToRgb)(hex);
      var colorDec = color.red * 65536 + color.green * 256 + color.blue;
      var schema = _joi.array().items(_joi.number().min(0).max(16777215).required(), _joi.string().allow('sudden', 'smooth').required(), _joi.number().required());
      return this.sendRequest('bg_set_rgb', [colorDec, effect, time], schema);
    }

    /**
     * This method is used to change the color of a smart LED.
     * @param {string} hue "hue" is the target hue value, whose type is integer.
     * It should be expressed in decimal integer ranges from 0 to 359.
     *
     * @param {string} saturation is the target saturation value whose type is integer.
     * It's range is 0 to 100.
     *
     * @param {string} [effect='smooth']  Refer to 'setColorTemperature' method.
     * @param {number} [time=1000] Refer to 'setColorTemperature' method.
     *
     * @example
     * setHSV(100, 50);
     * setHSV(100, 50, 'sudden');
     * setHSV(100, 50, 'smooth', 1000);
     *
     * @returns {Promise} will be invoked after successfull or failed send
     */

  }, {
    key: 'setHSV',
    value: function setHSV(hue, saturation) {
      var effect = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'smooth';
      var time = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 100;

      var schema = _joi.array().items(_joi.number().min(0).max(359).required(), _joi.number().min(0).max(100).required(), _joi.string().allow('sudden', 'smooth').required(), _joi.number().required());
      return this.sendRequest('set_hsv', [hue, saturation, effect, time], schema);
    }

    /**
     * This method is used to change the color of a smart LED.
     * @param {string} hue "hue" is the target hue value, whose type is integer.
     * It should be expressed in decimal integer ranges from 0 to 359.
     *
     * @param {string} saturation is the target saturation value whose type is integer.
     * It's range is 0 to 100.
     *
     * @param {string} [effect='smooth']  Refer to 'setColorTemperature' method.
     * @param {number} [time=1000] Refer to 'setColorTemperature' method.
     *
     * @example
     * setHSVBg(100, 50);
     * setHSVBg(100, 50, 'sudden');
     * setHSVBg(100, 50, 'smooth', 1000);
     *
     * @returns {Promise} will be invoked after successfull or failed send
     */

  }, {
    key: 'setHSVBg',
    value: function setHSVBg(hue, saturation) {
      var effect = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'smooth';
      var time = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 100;

      var schema = _joi.array().items(_joi.number().min(0).max(359).required(), _joi.number().min(0).max(100).required(), _joi.string().allow('sudden', 'smooth').required(), _joi.number().required());
      return this.sendRequest('bg_set_hsv', [hue, saturation, effect, time], schema);
    }

    /**
     * This method is used to start a timer job on the smart LED.
     * @param {string} type currently can only be 0. (means power off)
     * @param {string} value is the length of the timer (in minutes).
     *
     * @example
     * addCron(0, 15);
     *
     * @returns {Promise} will be invoked after successfull or failed send
     */

  }, {
    key: 'addCron',
    value: function addCron(type, value) {
      var schema = _joi.array().items(_joi.number().required(), _joi.number().required());
      return this.sendRequest('cron_add', [type, value], schema);
    }

    /**
     * This method is used to retrieve the setting of the current cron job of the specified type.
     * @param {string} type the type of the cron job. (currently only support 0).
     *
     * @example
     * getCron(0);
     *
     * @returns {Promise} will be invoked after successfull or failed send
     */

  }, {
    key: 'getCron',
    value: function getCron(index) {
      var schema = _joi.array().items(_joi.number().required());
      return this.sendRequest('cron_get', [index], schema);
    }

    /**
     * This method is used to stop the specified cron job.
     * @param {string} type the type of the cron job. (currently only support 0).
     *
     * @example
     * deleteCron(0);
     *
     * @returns {Promise} will be invoked after successfull or failed send
     */

  }, {
    key: 'deleteCron',
    value: function deleteCron(index) {
      var schema = _joi.array().items(_joi.number().required());
      return this.sendRequest('cron_del', [index], schema);
    }

    /**
     * This method is used to change brightness, CT or color of a smart LED
     * without knowing the current value, it's main used by controllers.
     * @param {string} action the direction of the adjustment. The valid value can be:
     * <br>'increase': increase the specified property
     * <br>'decrease': decrease the specified property
     * <br>'circle': increase the specified property, after it reaches the max value, go back to minimum value
     *
     * @param {string} prop the property to adjust. The valid value can be:
     * <br>'bright': adjust brightness.
     * <br>'ct': adjust color temperature.
     * <br>'color': adjust color. (When 'prop' is 'color', the 'action' can only be 'circle', otherwise, it will be deemed as invalid request.)
     *
     * @example
     * setAdjust('increase', 'bright');
     *
     * @returns {Promise} will be invoked after successfull or failed send
     */

  }, {
    key: 'setAdjust',
    value: function setAdjust(action, prop) {
      var schema = _joi.array().items(_joi.string().allow('increase', 'decrease', 'circle').required(), _joi.string().allow('bright', 'ct', 'color').required());
      return this.sendRequest('set_adjust', [action, prop], schema);
    }

    /**
     * This method is used to change brightness, CT or color of a smart LED
     * without knowing the current value, it's main used by controllers.
     * @param {string} action the direction of the adjustment. The valid value can be:
     * <br>'increase': increase the specified property
     * <br>'decrease': decrease the specified property
     * <br>'circle': increase the specified property, after it reaches the max value, go back to minimum value
     *
     * @param {string} prop the property to adjust. The valid value can be:
     * <br>'bright': adjust brightness.
     * <br>'ct': adjust color temperature.
     * <br>'color': adjust color. (When 'prop' is 'color', the 'action' can only be 'circle', otherwise, it will be deemed as invalid request.)
     *
     * @example
     * setAdjustBg('increase', 'bright');
     *
     * @returns {Promise} will be invoked after successfull or failed send
     */

  }, {
    key: 'setAdjustBg',
    value: function setAdjustBg(action, prop) {
      var schema = _joi.array().items(_joi.string().allow('increase', 'decrease', 'circle').required(), _joi.string().allow('bright', 'ct', 'color').required());
      return this.sendRequest('bg_set_adjust', [action, prop], schema);
    }

    /**
     * This method is used to start or stop music mode on a device. Under music mode,
     * no property will be reported and no message quota is checked.
     * @param {number} action the action of set_music command. The valid value can be:
     * <br>0: turn off music mode.
     * <br>1: turn on music mode.
     * @param {string} host the IP address of the music server.
     * @param {string} port the TCP port music application is listening on
     *
     * @example
     * setMusicMode(0, '10.0.0.1', 4000);
     *
     * @returns {Promise} will be invoked after successfull or failed send
     */

  }, {
    key: 'setMusicMode',
    value: function setMusicMode(action, host, port) {
      var schema = _joi.array().items(_joi.number().allow(0, 1).required(), _joi.string().required(), _joi.number().min(1).max(65535).required());
      return this.sendRequest('set_music', [action, host, port], schema);
    }

    /**
     * This method is used to start a color flow. Color flow is a series of smart
     * LED visible state changing. It can be brightness changing,
     * color changing or color temperature changing.
     * @param {number} count is the total number of visible state changing
     * before color flow stopped. 0 means infinite loop on the state changing.
     * @param {string} action is the action taken after the flow is stopped.
     * <br>0: means smart LED recover to the state before the color flow started.
     * <br>1: means smart LED stay at the state when the flow is stopped.
     * <br>2: means turn off the smart LED after the flow is stopped.
     * @param {string} flowExpression is the expression of the state changing series.
     *
     * @example
     * startColorFlow(4, 2, '1000, 2, 2700, 100, 500, 1, 255, 10, 500, 2, 5000, 1');
     *
     * @returns {Promise} will be invoked after successfull or failed send
     */

  }, {
    key: 'startColorFlow',
    value: function startColorFlow(count, action, flowExpression) {
      var schema = _joi.array().items(_joi.number().required(), _joi.number().allow(0, 1, 2).required(), _joi.string().required());
      return this.sendRequest('start_cf', [action, action, flowExpression], schema);
    }

    /**
     * This method is used to start a color flow. Color flow is a series of smart
     * LED visible state changing. It can be brightness changing,
     * color changing or color temperature changing.
     * @param {number} count is the total number of visible state changing
     * before color flow stopped. 0 means infinite loop on the state changing.
     * @param {string} action is the action taken after the flow is stopped.
     * <br>0: means smart LED recover to the state before the color flow started.
     * <br>1: means smart LED stay at the state when the flow is stopped.
     * <br>2: means turn off the smart LED after the flow is stopped.
     * @param {string} flowExpression is the expression of the state changing series.
     *
     * @example
     * startColorFlowBg(4, 2, '1000, 2, 2700, 100, 500, 1, 255, 10, 500, 2, 5000, 1');
     *
     * @returns {Promise} will be invoked after successfull or failed send
     */

  }, {
    key: 'startColorFlowBg',
    value: function startColorFlowBg(count, action, flowExpression) {
      var schema = _joi.array().items(_joi.number().required(), _joi.number().allow(0, 1, 2).required(), _joi.string().required());
      return this.sendRequest('bg_start_cf', [action, action, flowExpression], schema);
    }

    /**
     * This method is used to stop a running color flow
     *
     * @example
     * stopColorFlow();
     *
     * @returns {Promise} will be invoked after successfull or failed send
     */

  }, {
    key: 'stopColorFlow',
    value: function stopColorFlow() {
      return this.sendRequest('stop_cf', []);
    }

    /**
     * This method is used to stop a running color flow
     *
     * @example
     * stopColorFlowBg();
     *
     * @returns {Promise} will be invoked after successfull or failed send
     */

  }, {
    key: 'stopColorFlowBg',
    value: function stopColorFlowBg() {
      return this.sendRequest('bg_stop_cf', []);
    }
  }]);

  return Yeelight;
}(_events2.default);

exports.default = Yeelight;

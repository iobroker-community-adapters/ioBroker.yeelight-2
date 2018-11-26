'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _nodeSsdp = require('node-ssdp');

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

var _Yeelight = require('./Yeelight');

var _Yeelight2 = _interopRequireDefault(_Yeelight);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Create a new instance of the YeelightSearch class
 * and start searching for new Yeelights
 * once a Yeelight has been found it will create an Yeelight instance
 * and emits the 'found' event light the Yeelight instance as payload
 *
 * @extends EventEmitter
 */
var YeelightSearch = function (_EventEmitter) {
  _inherits(YeelightSearch, _EventEmitter);

  function YeelightSearch() {
    _classCallCheck(this, YeelightSearch);

    var _this = _possibleConstructorReturn(this, (YeelightSearch.__proto__ || Object.getPrototypeOf(YeelightSearch)).call(this));

    _this.yeelights = [];
    _this.log = (0, _debug2.default)('YeelightSearch');
    // Setting the sourcePort ensures multicast traffic is received
    _this.client = new _nodeSsdp.Client({ sourcePort: 1982, ssdpPort: 1982 });

    _this.client.on('response', function (data) {
      return _this.addLight(data);
    });
    // Register devices that sends NOTIFY to multicast address too
    _this.client.on('advertise-alive', function (data) {
      return _this.addLight(data);
    });

    //this.client.search('wifi_bulb');
    return _this;
  }

  /**
   * adds a new light to the lights array
   */


  _createClass(YeelightSearch, [{
    key: 'addLight',
    value: function addLight(lightdata) {
      var yeelight = this.yeelights.find(function (item) {
        return item.getId() === lightdata.ID;
      });
      if (!yeelight) {
        yeelight = new _Yeelight2.default(lightdata);
        this.yeelights.push(yeelight);
        this.emit('found', yeelight);
      } else {
        if (yeelight.status === _Yeelight.YeelightStatus.OFFLINE) {
          // Reconnect to light
          this.log('Light id ' + lightdata.ID + ' comming up');
          yeelight.status = _Yeelight.YeelightStatus.SSDP;
          yeelight.reconnect(lightdata);
        }
      }
    }

    /**
     * returns a list of all found Yeelights
     * @returns {array.<Yeelight>} array with yeelight instances
     */

  }, {
    key: 'getYeelights',
    value: function getYeelights() {
      return this.yeelights;
    }
    /**
    * add a list of Yeelights
    * @param {obj} lightarray array of Yeelights
    */

  }, {
    key: 'addInitLights',
    value: function addInitLights(lightarray) {
      var yeelight = new _Yeelight2.default({
        'LOCATION': 'yeelight://' + lightarray.ip + ':' + lightarray.port,
        'ID': lightarray.id,
        'SUPPORT': 'get_prop set_default set_power toggle set_bright start_cf stop_cf set_scene cron_add cron_get cron_del set_ct_abx set_rgb set_hsv set_adjust set_music set_name',
        'NAME': 'Living Room',
        'MODEL': lightarray.type,
        'SUPPORT_OBJ': lightarray.supports
      });
      yeelight.init = true;

      this.yeelights.push(yeelight);
      this.emit('found', yeelight);
    }

    /**
     * returns one Yeelight found by id
     * @param {string} id Yeelight Id
     * @returns {Yeelight} Yeelight instance
     */

  }, {
    key: 'getYeelightById',
    value: function getYeelightById(id) {
      return this.yeelights.find(function (item) {
        return item.getId() === id;
      });
    }

    /**
     * refresh lights sending a new m-search
     */

  }, {
    key: 'refresh',
    value: function refresh() {
      this.client.search('wifi_bulb');
    }
  }]);

  return YeelightSearch;
}(_events2.default);

module.exports = YeelightSearch;
import EventEmitter from 'events';
import { Client } from 'node-ssdp';
import debug from 'debug';
import Yeelight from './Yeelight';
import { YeelightStatus } from './Yeelight';

/**
 * Create a new instance of the YeelightSearch class
 * and start searching for new Yeelights
 * once a Yeelight has been found it will create an Yeelight instance
 * and emits the 'found' event light the Yeelight instance as payload
 *
 * @extends EventEmitter
 */
class YeelightSearch extends EventEmitter {
  constructor() {
    super();

    this.yeelights = [];
    this.log = debug(`YeelightSearch`);
    // Setting the sourcePort ensures multicast traffic is received
    this.client = new Client({ sourcePort: 1982, ssdpPort: 1982 });

    this.client.on('response', data => this.addLight(data));
    // Register devices that sends NOTIFY to multicast address too
    this.client.on('advertise-alive', data => this.addLight(data));

    //this.client.search('wifi_bulb');
  }

  /**
   * adds a new light to the lights array
   */
  addLight(lightdata) {
    let yeelight = this.yeelights.find(item => item.getId() === lightdata.ID);
    if (!yeelight) {
      yeelight = new Yeelight(lightdata);
      this.yeelights.push(yeelight);
      this.emit('found', yeelight);
    } else {
      if ( yeelight.status === YeelightStatus.OFFLINE ) {
        // Reconnect to light
        this.log(`Light id ${lightdata.ID} comming up`);
        yeelight.status = YeelightStatus.SSDP;
        yeelight.reconnect(lightdata);
      }
    }
  }

  /**
   * returns a list of all found Yeelights
   * @returns {array.<Yeelight>} array with yeelight instances
   */
  getYeelights() {
    return this.yeelights;
  }
    /**
   * add a list of Yeelights
   * @param {obj} lightarray array of Yeelights
   */
  addInitLights(lightarray){
    let yeelight = new Yeelight({
      'LOCATION': 'yeelight://'+lightarray.ip+':'+lightarray.port,
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
  getYeelightById(id) {
    return this.yeelights.find(item => item.getId() === id);
  }

  /**
   * refresh lights sending a new m-search
   */
  refresh() {
    this.client.search('wifi_bulb');
  }
}

module.exports = YeelightSearch;

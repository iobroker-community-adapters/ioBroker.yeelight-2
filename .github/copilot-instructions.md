# ioBroker Adapter Development with GitHub Copilot

**Version:** 0.4.0
**Template Source:** https://github.com/DrozmotiX/ioBroker-Copilot-Instructions

This file contains instructions and best practices for GitHub Copilot when working on ioBroker adapter development.

## Project Context

You are working on an ioBroker adapter. ioBroker is an integration platform for the Internet of Things, focused on building smart home and industrial IoT solutions. Adapters are plugins that connect ioBroker to external systems, devices, or services.

### Yeelight-2 Adapter Specific Context

This adapter connects ioBroker to Yeelight smart bulbs and LED strips (manufactured by Xiaomi/Mihome) over the local network. The adapter provides:

- **Device Discovery**: Automatic discovery of Yeelight devices using SSDP protocol
- **Device Control**: Full control over brightness, color (RGB/HSV), color temperature, and power state
- **Scene Management**: Support for predefined and custom lighting scenes
- **Music Mode**: Synchronization with music/audio (if supported by device)
- **Effect Control**: Various lighting effects like smooth transitions, color flow, etc.
- **Local Network Communication**: Direct communication with devices via TCP/IP (port 55443 by default)

#### Key Requirements:
- Yeelight devices must have "LAN Control" enabled in the Yeelight mobile app
- Devices must be on the same network as ioBroker
- Supports various Yeelight models: bulbs, strips, ceiling lights, desk lamps

#### Main Dependencies:
- `yeelight2`: Core library for Yeelight device communication
- `node-ssdp`: Service discovery protocol for finding devices
- `@iobroker/adapter-core`: ioBroker adapter framework

## Testing

### Unit Testing
- Use Jest as the primary testing framework for ioBroker adapters
- Create tests for all adapter main functions and helper methods
- Test error handling scenarios and edge cases
- Mock external API calls and hardware dependencies
- For adapters connecting to APIs/devices not reachable by internet, provide example data files to allow testing of functionality without live connections
- Example test structure:
  ```javascript
  describe('AdapterName', () => {
    let adapter;
    
    beforeEach(() => {
      // Setup test adapter instance
    });
    
    test('should initialize correctly', () => {
      // Test adapter initialization
    });
  });
  ```

### Integration Testing

**IMPORTANT**: Use the official `@iobroker/testing` framework for all integration tests. This is the ONLY correct way to test ioBroker adapters.

**Official Documentation**: https://github.com/ioBroker/testing

#### Framework Structure
Integration tests MUST follow this exact pattern:

```javascript
const path = require('path');
const { tests } = require('@iobroker/testing');

// Define test coordinates or configuration
const TEST_COORDINATES = '52.520008,13.404954'; // Berlin
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Use tests.integration() with defineAdditionalTests
tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('Test adapter with specific configuration', (getHarness) => {
            let harness;

            before(() => {
                harness = getHarness();
            });

            it('should configure and start adapter', function () {
                return new Promise(async (resolve, reject) => {
                    try {
                        harness = getHarness();
                        
                        // Get adapter object using promisified pattern
                        const obj = await new Promise((res, rej) => {
                            harness.objects.getObject('system.adapter.your-adapter.0', (err, o) => {
                                if (err) return rej(err);
                                res(o);
                            });
                        });
                        
                        if (!obj) {
                            return reject(new Error('Adapter object not found'));
                        }

                        // Configure adapter properties
                        Object.assign(obj.native, {
                            position: TEST_COORDINATES,
                            createCurrently: true,
                            createHourly: true,
                            createDaily: true,
                            // Add other configuration as needed
                        });

                        // Set the updated configuration
                        harness.objects.setObject(obj._id, obj);

                        console.log('✅ Step 1: Configuration written, starting adapter...');
                        
                        // Start adapter and wait
                        await harness.startAdapterAndWait();
                        
                        console.log('✅ Step 2: Adapter started');

                        // Wait for adapter to process data
                        const waitMs = 15000;
                        await wait(waitMs);

                        console.log('🔍 Step 3: Checking states after adapter run...');
                        
                        // Use harness.objects.getObjectList to find all states
                        const objects = await new Promise((resolve, reject) => {
                            harness.objects.getObjectList({ 
                                startkey: 'your-adapter.0', 
                                endkey: 'your-adapter.0\u9999' 
                            }, (err, res) => {
                                if (err) reject(err);
                                resolve(res);
                            });
                        });

                        const stateObjects = objects?.rows?.filter(row => row.doc?.type === 'state') || [];

                        if (stateObjects.length === 0) {
                            return reject(new Error('No state objects found - adapter may not have processed data correctly'));
                        }

                        console.log(`✅ Found ${stateObjects.length} state objects`);

                        // Test specific states exist
                        const connectionState = await new Promise((resolve, reject) => {
                            harness.states.getState('your-adapter.0.info.connection', (err, state) => {
                                if (err) return reject(err);
                                resolve(state);
                            });
                        });

                        if (!connectionState) {
                            return reject(new Error('Connection state not found'));
                        }

                        console.log('✅ Integration test completed successfully');
                        resolve();

                    } catch (error) {
                        console.error('Integration test failed:', error.message);
                        reject(error);
                    }
                });
            });
        });
    }
});
```

#### Testing with Mock Data
For Yeelight adapter testing, since physical devices may not be available:

```javascript
// Mock Yeelight device responses
const mockDeviceData = {
    devices: [
        {
            id: 'test-bulb-001',
            model: 'color',
            location: 'udp://192.168.1.100:55443',
            support: 'get_prop set_default set_power toggle set_bright set_scene'
        }
    ],
    responses: {
        'get_prop': '{"id":1,"result":["on",100,4000,16777215,"",0],"error":null}',
        'set_power': '{"id":1,"result":["ok"],"error":null}'
    }
};
```

### Yeelight-Specific Testing Considerations

For the Yeelight adapter, testing should cover:
- **Device Discovery**: Mock SSDP responses to test device finding functionality
- **Command Execution**: Test color, brightness, and power commands with mock responses
- **Error Handling**: Network timeouts, device unavailable, invalid parameters
- **State Management**: Proper state updates when device status changes

## File Structure and Organization

ioBroker adapters follow a specific structure:
- `main.js` - Main adapter code and logic
- `io-package.json` - Adapter metadata and configuration schema
- `admin/` - Admin interface files (HTML, CSS, JS for configuration)
- `lib/` - Helper libraries and modules
- `test/` - Test files (unit and integration tests)
- `package.json` - Node.js package definition

## Logging

ioBroker provides a structured logging system. Use appropriate log levels:

```javascript
this.log.error('Critical error message');
this.log.warn('Warning message'); 
this.log.info('Information message');
this.log.debug('Debug message (only in debug mode)');
```

### Yeelight-Specific Logging
For Yeelight adapter development, include relevant context in logs:
```javascript
this.log.info(`Discovered Yeelight device: ${device.id} at ${device.location}`);
this.log.debug(`Sending command to ${deviceId}: ${JSON.stringify(command)}`);
this.log.warn(`Device ${deviceId} not responding, retrying in 5 seconds`);
```

## State Management

### State Structure
ioBroker uses a hierarchical state structure:
- `adapter.instance.device.channel.state`
- States have types (boolean, number, string) and roles (switch, level, sensor)

### For Yeelight Devices:
```javascript
// Example state structure for Yeelight bulb
await this.setObjectNotExistsAsync(`${deviceId}.power`, {
    type: 'state',
    common: {
        name: 'Power',
        type: 'boolean',
        role: 'switch',
        read: true,
        write: true
    }
});

await this.setObjectNotExistsAsync(`${deviceId}.brightness`, {
    type: 'state',
    common: {
        name: 'Brightness',
        type: 'number',
        role: 'level.dimmer',
        min: 1,
        max: 100,
        unit: '%',
        read: true,
        write: true
    }
});
```

### State Updates
Always update states when device status changes:
```javascript
await this.setStateAsync(`${deviceId}.power`, device.power, true);
await this.setStateAsync(`${deviceId}.brightness`, device.brightness, true);
```

## Configuration

Configuration is defined in `io-package.json` and handled in the admin interface:

```json
{
  "native": {
    "devices": "array of device configurations",
    "discoveryEnabled": "boolean for auto-discovery",
    "refreshInterval": "number for polling interval"
  }
}
```

## Error Handling

Implement comprehensive error handling:
```javascript
try {
  await device.sendCommand(command);
} catch (error) {
  this.log.error(`Failed to send command to device ${deviceId}: ${error.message}`);
  await this.setStateAsync('info.connection', false, true);
}
```

## Adapter Lifecycle

### Key Methods to Implement:
- `onReady()` - Called when adapter starts
- `onStateChange()` - Called when a state changes (user control)
- `onUnload()` - Called when adapter stops (cleanup)

### Yeelight Adapter Lifecycle Example:
```javascript
async onReady() {
    // Initialize device discovery
    if (this.config.discoveryEnabled) {
        await this.startDeviceDiscovery();
    }
    
    // Connect to configured devices
    for (const deviceConfig of this.config.devices) {
        await this.connectToDevice(deviceConfig);
    }
}

async onStateChange(id, state) {
    if (state && !state.ack) {
        // Handle user commands
        const [, , deviceId, , stateName] = id.split('.');
        await this.handleDeviceCommand(deviceId, stateName, state.val);
    }
}

onUnload(callback) {
    try {
        // Clean up connections, timers, etc.
        this.clearDiscoveryTimer();
        this.disconnectAllDevices();
        callback();
    } catch (e) {
        callback();
    }
}
```

## Code Style and Standards

- Follow JavaScript/TypeScript best practices
- Use async/await for asynchronous operations
- Implement proper resource cleanup in `unload()` method
- Use semantic versioning for adapter releases
- Include proper JSDoc comments for public methods

## CI/CD and Testing Integration

### GitHub Actions for API Testing
For adapters with external API dependencies, implement separate CI/CD jobs:

```yaml
# Tests API connectivity with demo credentials (runs separately)
demo-api-tests:
  if: contains(github.event.head_commit.message, '[skip ci]') == false
  
  runs-on: ubuntu-22.04
  
  steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Use Node.js 20.x
      uses: actions/setup-node@v4
      with:
        node-version: 20.x
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run demo API tests
      run: npm run test:integration-demo
```

### CI/CD Best Practices
- Run credential tests separately from main test suite
- Use ubuntu-22.04 for consistency
- Don't make credential tests required for deployment
- Provide clear failure messages for API connectivity issues
- Use appropriate timeouts for external API calls (120+ seconds)

### Package.json Script Integration
Add dedicated script for credential testing:
```json
{
  "scripts": {
    "test:integration-demo": "mocha test/integration-demo --exit"
  }
}
```

### Practical Example: Complete API Testing Implementation
Here's a complete example based on lessons learned from the Discovergy adapter:

#### test/integration-demo.js
```javascript
const path = require("path");
const { tests } = require("@iobroker/testing");

// Helper function to encrypt password using ioBroker's encryption method
async function encryptPassword(harness, password) {
    const systemConfig = await harness.objects.getObjectAsync("system.config");
    
    if (!systemConfig || !systemConfig.native || !systemConfig.native.secret) {
        throw new Error("Could not retrieve system secret for password encryption");
    }
    
    const secret = systemConfig.native.secret;
    let result = '';
    for (let i = 0; i < password.length; ++i) {
        result += String.fromCharCode(secret[i % secret.length].charCodeAt(0) ^ password.charCodeAt(i));
    }
    
    return result;
}

// Run integration tests with demo credentials
tests.integration(path.join(__dirname, ".."), {
    defineAdditionalTests({ suite }) {
        suite("API Testing with Demo Credentials", (getHarness) => {
            let harness;
            
            before(() => {
                harness = getHarness();
            });

            it("Should connect to API and initialize with demo credentials", async () => {
                console.log("Setting up demo credentials...");
                
                if (harness.isAdapterRunning()) {
                    await harness.stopAdapter();
                }
                
                const encryptedPassword = await encryptPassword(harness, "demo_password");
                
                await harness.changeAdapterConfig("your-adapter", {
                    native: {
                        username: "demo@provider.com",
                        password: encryptedPassword,
                        // other config options
                    }
                });

                console.log("Starting adapter with demo credentials...");
                await harness.startAdapter();
                
                // Wait for API calls and initialization
                await new Promise(resolve => setTimeout(resolve, 60000));
                
                const connectionState = await harness.states.getStateAsync("your-adapter.0.info.connection");
                
                if (connectionState && connectionState.val === true) {
                    console.log("✅ SUCCESS: API connection established");
                    return true;
                } else {
                    throw new Error("API Test Failed: Expected API connection to be established with demo credentials. " +
                        "Check logs above for specific API errors (DNS resolution, 401 Unauthorized, network issues, etc.)");
                }
            }).timeout(120000);
        });
    }
});
```

## Device-Specific Development Patterns

### Yeelight Command Structure
Yeelight devices use JSON-RPC protocol over TCP:
```javascript
const command = {
    id: 1,
    method: 'set_power',
    params: ['on', 'smooth', 500]
};

// Send command and handle response
const response = await device.sendCommand(command);
if (response.error) {
    throw new Error(`Device error: ${response.error.message}`);
}
```

### Common Yeelight Methods:
- `get_prop`: Get device properties
- `set_power`: Turn device on/off
- `set_bright`: Set brightness (1-100)
- `set_rgb`: Set RGB color
- `set_hsv`: Set HSV color
- `set_ct_abx`: Set color temperature
- `set_scene`: Set predefined scene
- `cron_add`: Add scheduled task
- `start_cf`: Start color flow
- `stop_cf`: Stop color flow

### Device Discovery Pattern:
```javascript
const SSDP = require('node-ssdp').Client;
const client = new SSDP();

client.on('response', (headers, statusCode, rinfo) => {
    if (headers.LOCATION && headers.LOCATION.includes('yeelight')) {
        this.log.info(`Found Yeelight device at ${rinfo.address}`);
        this.addDevice(headers, rinfo.address);
    }
});

client.search('wifi_bulb');
```

## Security and Best Practices

- Validate all user inputs and device responses  
- Use timeouts for network operations
- Implement retry logic for failed commands
- Handle device disconnections gracefully
- Don't store sensitive data in plain text
- Use proper error messages for troubleshooting

### Yeelight Security Considerations:
- Devices communicate over unencrypted TCP
- Ensure devices are on trusted network only
- Validate device responses before processing
- Implement rate limiting for commands
- Handle concurrent access properly

## Performance Optimization

- Use connection pooling for multiple devices
- Implement caching for device states
- Batch operations where possible  
- Use appropriate polling intervals
- Clean up resources properly

### Memory Management
```javascript
// Proper cleanup in onUnload
onUnload(callback) {
  try {
    if (this.discoveryTimer) {
      this.clearTimeout(this.discoveryTimer);
      this.discoveryTimer = undefined;
    }
    if (this.connectionTimer) {
      this.clearTimeout(this.connectionTimer);
      this.connectionTimer = undefined;
    }
    // Close connections, clean up resources
    callback();
  } catch (e) {
    callback();
  }
}
```
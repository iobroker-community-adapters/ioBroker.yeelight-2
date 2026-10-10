const assert = require('node:assert/strict');
const path = require('node:path');
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();

describe('HSV uploadState callbacks', () => {
    let adapter;
    let outcome;
    let pending;
    let warnings;
    let calls;

    beforeEach(() => {
        outcome = 'reject';
        pending = [];
        warnings = [];
        calls = [];

        class AdapterStub {
            constructor() {
                this.log = {
                    debug() {},
                    warn(message) {
                        warnings.push(message);
                    },
                };
            }

            on() {}

            getState(id, callback) {
                // The callback receiver must not be relied on to expose subclass methods.
                callback.call({}, null, outcome === 'missing' ? null : { val: 40 });
            }
        }

        const light = {};
        for (const method of ['setHSV', 'setHSVBg']) {
            light[method] = (...args) => {
                calls.push({ method, args });
                return {
                    catch(handler) {
                        const operation =
                            outcome === 'reject'
                                ? Promise.reject(new Error('simulated socket unavailable'))
                                : Promise.resolve();
                        const handled = operation.catch(handler);
                        pending.push(handled);
                        return handled;
                    },
                };
            };
        }

        class YeelightSearchStub {
            on() {}

            getYeelightById() {
                return light;
            }
        }

        const createAdapter = proxyquire('../main', {
            '@iobroker/adapter-core': { Adapter: AdapterStub },
            [path.join(__dirname, '..', 'yeelight-wifi', 'build', 'index')]: YeelightSearchStub,
        });
        adapter = createAdapter({});
        adapter.initYeelight();
    });

    for (const parameter of ['hue', 'bg_hue', 'sat', 'bg_sat']) {
        it(`${parameter}: logs failed commands without rejecting the error handler`, async () => {
            adapter.uploadState('fixture-light', parameter, 120, 'yeelight-2.0.fixture');
            await Promise.all(pending);

            assert.equal(calls.length, 1);
            assert.equal(warnings.length, 1);
            assert.match(warnings[0], /fixture-light/);
            assert.match(warnings[0], /simulated socket unavailable/);
            assert.ok(warnings[0].includes(`(${parameter})`));
        });

        it(`${parameter}: preserves successful command arguments`, async () => {
            outcome = 'resolve';
            adapter.uploadState('fixture-light', parameter, 120, 'yeelight-2.0.fixture');
            await Promise.all(pending);

            assert.deepEqual(calls, [
                {
                    method: parameter.startsWith('bg_') ? 'setHSVBg' : 'setHSV',
                    args: parameter.endsWith('hue') ? ['120', '40'] : ['40', '120'],
                },
            ]);
            assert.equal(warnings.length, 0);
        });

        it(`${parameter}: skips commands when the related state is missing`, () => {
            outcome = 'missing';
            adapter.uploadState('fixture-light', parameter, 120, 'yeelight-2.0.fixture');

            assert.equal(calls.length, 0);
            assert.equal(warnings.length, 0);
        });
    }
});

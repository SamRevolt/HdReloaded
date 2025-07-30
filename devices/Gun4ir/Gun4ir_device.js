/* The meat and potatoes for sending output commands
 to a GUN4IR device, v0.1.7b. Created by nugarp/spazzy.
 If you have other devices that you want to communicate
 with for your own plugins, this is the file you would use
 to add commands for those effects. I've included an example
 for posting to a REST URL when recoil is triggered, but it
 is commented out.

 Changelog:
 v0.1.7b. Fixed bug with not re-gaining S6 access to a gun when using pre-connect upon actual hook.
 v0.1.7. Revert control to default behavior until a REAL hook comes in when using preconnect.
         Fire events when true COM connections have been made (use case: quitAfterHook)
 v0.1.6. Added support for passing context and data in connected()/disconnected()
         Added support for "preconnect". If true, the plugin will bind to the COM ports
         immediately (although callbacks will only execute when a "true" hook is complete).
 v0.1.5. Added support for a disconnecting() callback in plugins, called for each device.
 v0.1.4. Support "dummy" spots (i.e. blank paths)
 v0.1.3. Added support for a connected() callback in plugins, called for each device.
 v0.1.2. Improved reset code for onUnhook for rumble + recoil.
 v0.1.1. Increased baud from 9600 to 50xxx as a precaution.
 
 Last Updated 12/8/22. */

const { SerialPort } = require('serialport');
const NanoTimer = require('nanotimer');
const _ = require('lodash');
const { performance } = require('perf_hooks');
const emitter = require('../core/emitter');

// const axios = require('axios'); // we don't need this for now but if you had an output that you could hit
// that was on a REST server, for example (i.e. lights on recoil...) you could use this library.

// helper func to bound valid values
let bound = (value, min, max) => {
    return Math.min(Math.max(value, min), max);
}

// consts for COM states
const DEVICE_ERROR = -2;
const DEVICE_DISCONNECTING = -1;
const DEVICE_DISCONNECTED = 0;
const DEVICE_CONNECTED = 1;

// The meat of this file -- a serial/gun4ir device
// it exposes many helpful methods for plugins:
//
// RECOIL:
// setAutofireTimings(hold = 35, pause = 35)
// startAutofire(length = 70). if length is not specified, pause and hold will be used from setAutofireTimmings
                            // if length is specified, then hold = pause = ~0.5x length
// stopAutofire()
// fireRecoil(pulses = 0);
//
// RUMBLE:
// startRumblePulsingEffect(effect name, strength = 255, on = 50, off = 50) durations are in ms
// stopRumblePulsingEffect(effect name)
// setRumbleEffect(effect name, strength = 255, duration = 0) duration is in ms, 0 is inf.
//
// MISC:
// sendAction(string) to send your own custom action over COM.

class Device {
    #port = null;
    #path = null;
    #player = null;
    #delay = 0;
    #gameDelay = 0;
    #state = DEVICE_DISCONNECTED;
    #preconnect = false;
    #preconnectPromise = null;
    #quitAfterUnhook = false;

    #onConnectedCall = null;
    #onConnectedContext = null;
    #onDisconnectingCall = null;
    #onDisconnectingContext = null;
    #currentData = { key: null }; // identifies current game

    // COM port management
    #queue = [];
    #outstandingWrites = 0;

    // autofire (solenoid) settings
    #autofireHold = -1;
    #autofirePause = -1;
    #autofireLength = -1;
    #lastAutofireSettings = { pause: 0, hold: 0, length: 0 };
    #autofireTimer = null;

    // for rumble that is forever, or has a certain duration
    #rumbleEffects = {}; // { key:string, value: {value: int[0, 255], index: int }}
    #rumbleEffectsTimers = []; // list of timers
    #rumbleEffectIndex = 0;
    #rumbleEffectsIndices = []; // { key: effect/string, value: int }
    #lastRumbleSettings = { duration: 0, strength: -1};

    // for rumble that pulses
    #pulsingRumbleTimers = {}; // { key: effect/string, value: timer }

    #rumbleOnHook = false;

    constructor(path, player, rumbleOnHook, delay, preconnect, quitAfterUnhook) {
        this.#path = path;
        this.#player = player;
        this.#delay = delay;
        this.#quitAfterUnhook = quitAfterUnhook;
        this.#port = path ? new SerialPort({ path: path, baudRate: 57600, autoOpen: false }) : null;
        this.#rumbleOnHook = rumbleOnHook;
        this.#preconnect = preconnect;
        if (preconnect) {
            this.#preconnectPromise = new Promise((res) => {
                this.onHook(0, null, res);
            });
        }
        // if (this.#port) {
        //     this.#port.on('close', () => {
        //         this.#port = null;
        //         this.#state = DEVICE_DISCONNECTED;
        //         // we won't call onDisconnecting since it might want to do a callback to COM port but there is nothing to write to
        //         // // call onDisconnecting...
        //         // if (this.#onDisconnectingCall) {
        //         //     this.#onDisconnectingCall.call(this.#onDisconnectingContext, this, _.merge(this.#currentData, this.getInfo()));
        //         // }

        //         // clear out the queue
        //         this.#queue = [];
                        
        //         // remove any connected callbacks and contexts
        //         this.#onConnectedCall = null;
        //         this.#onConnectedContext = null;
        //         this.#onDisconnectingCall = null;
        //         this.#onDisconnectingContext = null;

        //         // clear out rumble timers
        //         // here, clear out pulsing timers
        //         let pulsingRumbleTimerEffects = Object.keys(this.#pulsingRumbleTimers);
        //         pulsingRumbleTimerEffects.forEach(prte => {
        //             this.#pulsingRumbleTimers[prte].clearInterval();
        //             delete this.#pulsingRumbleTimers[prte];
        //         });

        //         // here, clear out rumbles with durations set
        //         this.#rumbleEffectsTimers.forEach(ret => ret.clearTimeout());
        //         this.#rumbleEffectsTimers = [];

        //         // clear out all rumble effects and reset rumble vars
        //         this.#rumbleEffects = {};
        //         this.#rumbleEffectIndex = 0;
        //         this.#rumbleEffectsIndices = []; // { key: effect/string, value: int }
        //         this.#lastRumbleSettings = { duration: 0, strength: -1};
            
        //         // stop autofire
        //         this.stopAutofire();

        //         // reset autofire settings
        //         this.#autofireHold = -1;
        //         this.#autofirePause = -1;
        //         this.#autofireLength = -1;
        //         this.#lastAutofireSettings = { pause: 0, hold: 0, length: 0 };
        //         console.log('port was closed --');
        //         emitter.eventBus.sendEvent('disconnected', { player: this.#player, port: this.#path });
        //     });
        // }
    };

    #onWriteComplete = (err) => {
        this.#outstandingWrites--;
        if (this.#state === DEVICE_DISCONNECTING && this.#outstandingWrites === 0) {
            if (this.#port) {
                this.#port.close(() => this.#state = DEVICE_DISCONNECTED);
            } else {
                this.#state = DEVICE_DISCONNECTED;
            }
        }
    };

    // action is the serial command
    // instantaneous, if true, will ignore gameDelay and run immediately
    // important will always run (or queue), whereas non-important (default) will only run if state is not disconnecting or disconnected
    #sendAction = (action, instantaneous, important) => {
        // console.log(`< [P${this.#player} SA:CMD ] ${action}`);
        // catch cases where commands are sent after a device has been disconnected (or during disconnects) TODO BUG????
        if (!important && (this.#state == DEVICE_DISCONNECTED || this.#state == DEVICE_DISCONNECTED || this.#state == DEVICE_ERROR)) {
            // console.log(`* [P${this.#player} SA:IGNR] ${action}`);
            return;
        }

        // standard execution logic
        if ((this.#delay + this.#gameDelay) === 0 || instantaneous) {
            if (this.#state == DEVICE_CONNECTED || this.#state == DEVICE_DISCONNECTING) {
                this.#outstandingWrites++;
                if (this.#port) {
                    try {
                        this.#port.write(action, this.#onWriteComplete);
                    } catch(e) {
                        console.log('Exception writing to port: ' + e);
                    }
                }
                // console.log(`> [P${this.#player} SA:SENT] ${action}`);    
                //  console.log(action);
            } else if (this.#state != DEVICE_ERROR) { // no need to queue if we are in an error state
                this.#queue.push(action);
            }
        } else {
            // console.log('plan: ' + action);
            let t = new NanoTimer();
            t.setTimeout(() => this.#sendAction(action, /* instantaneous */ true, /* important */ false), '', (this.#delay + this.#gameDelay) + 'm');
        }
    };

    // preconnectResolve is only specified if onHook is being called internally as a preconnect. Else, it should always be falsy.
    onHook = (gameDelay = 0, key, preconnectResolve) => {
        console.log(`P${this.#player} ONHOOK ${(preconnectResolve ? " (preconnect)" : "")}`);
        let that = this;
        this.#currentData.key = key;
        this.#gameDelay = gameDelay;
        console.log("opening port " + that.#path);
        // revert the state if we aren't doing a preconnection
        if (!this.#preconnectPromise) {
            this.#state = DEVICE_DISCONNECTED;
        }
        if (!this.#port) {
            this.#state = DEVICE_CONNECTED;
            console.log(`P${that.#player} connected (DUMMY)`);
        } else {
            // if we did a preconnection beforehand (i.e. preconnectPromise was already defined)...then this must be a real hook
            // no need to open the connection again -- just wait for the original promise to resolve.
            // note that we will call S6 from setOnConnected most likely.
            if (this.#preconnectPromise) {
                this.#preconnectPromise.then((err) => {
                    if (err) {
                        console.log(`P${this.#player} PRECONNECT failed ${err}`)
                    } else {
                        this.#sendAction("S6", /* instantaneous */ true, /* important */ true); // all custom feedback
                        if (this.#rumbleOnHook) {
                            this.setRumbleEffect("INTERNAL-HOOK", 255, 200, /* instantaneous */ true, /* important */ true);
                            // if we are preconnecting, then we only cared for S6 for the rumble, so we will revert to "E" and
                            // go back to S6 when a real hook comes in.
                            if (preconnectResolve) { this.#sendAction("E"); }
                        }
                        while (that.#queue.length > 0) {
                            let action = that.#queue.shift();
                            this.#sendAction(action);
                        }
                        if (this.#onConnectedCall) {
                            this.#onConnectedCall.call(this.#onConnectedContext, this, _.merge(this.#currentData, this.getInfo()));
                        }
                    }
                });
            } else { // else this is either a preconnection request, or a real hook with preconnect OFF, so we must open the port.
                this.#port.open((err) => {
                    if (err) {
                        this.#state = DEVICE_ERROR;
                        console.log(`Error: P${that.#player} not connected on ${that.#path}`);
                        console.log('Error information: ' + err);
                        if (preconnectResolve) {
                            preconnectResolve(err);
                        }
                    } else {
                        // always send this event when we connect to serial...which we have because this is the callback of this.#port.open()
                        emitter.eventBus.sendEvent('connected', { player: that.#player, port: that.#path });
                        console.log(`P${that.#player} connected on ${that.#path}`);
                        that.#state = DEVICE_CONNECTED;
                        // always send S6 to take over gun feedback
                        that.#sendAction("S6", /* instantaneous */ true, /* important */ true); // all custom feedback
                        if (that.#rumbleOnHook) {
                            that.setRumbleEffect("INTERNAL-HOOK", 255, 200, /* instantaneous */ true, /* important */ true);
                            // if we are preconnecting, then we only cared for S6 for the rumble, so we will revert to "E" and
                            // go back to S6 when a real hook comes in.
                            if (preconnectResolve) { that.#sendAction("E"); }
                        }
                        while (that.#queue.length > 0) {
                            let action = that.#queue.shift();
                            that.#sendAction(action);
                        }
                        // preconnectResolve is truthy if this is a preconnection attempt
                        if (preconnectResolve) {
                            preconnectResolve();
                        }
                        // this is a real call from a real hook
                        if (!that.#preconnectPromise) {
                            if (that.#onConnectedCall) {
                                that.#onConnectedCall.call(that.#onConnectedContext, that, _.merge(that.#currentData, that.getInfo()));
                            }    
                        }
                    }
                });
            }
        }
    };

    onUnhook = () => {
        // call onDisconnecting...
        if (this.#onDisconnectingCall) {
            this.#onDisconnectingCall.call(this.#onDisconnectingContext, this, _.merge(this.#currentData, this.getInfo()));
        }
        
        // clear out the queue
        this.#queue = [];
        
        // remove any connected callbacks and contexts
        this.#onConnectedCall = null;
        this.#onConnectedContext = null;
        this.#onDisconnectingCall = null;
        this.#onDisconnectingContext = null;

        // update state to disconnecting ONLY IF preconnect IS OFF
        if (this.#state == DEVICE_CONNECTED && !this.#preconnect) {
            this.#state = DEVICE_DISCONNECTING;
        }
        
        // clear out rumble timers
        // here, clear out pulsing timers
        let pulsingRumbleTimerEffects = Object.keys(this.#pulsingRumbleTimers);
        pulsingRumbleTimerEffects.forEach(prte => {
            this.#pulsingRumbleTimers[prte].clearInterval();
            delete this.#pulsingRumbleTimers[prte];
        });

        // here, clear out rumbles with durations set
        this.#rumbleEffectsTimers.forEach(ret => ret.clearTimeout());
        this.#rumbleEffectsTimers = [];

        // clear out all rumble effects and reset rumble vars
        this.#rumbleEffects = {};
        this.#rumbleEffectIndex = 0;
        this.#rumbleEffectsIndices = []; // { key: effect/string, value: int }
        this.#lastRumbleSettings = { duration: 0, strength: -1};
    
        // stop autofire
        this.stopAutofire();

        // reset autofire settings
        this.#autofireHold = -1;
        this.#autofirePause = -1;
        this.#autofireLength = -1;
        this.#lastAutofireSettings = { pause: 0, hold: 0, length: 0 };

        // turn off rumble
        this.#sendAction("F1.0.0", /* instantaneous */ true, /* important */ true);

        // restore default feedback settings
        this.#sendAction("E", /* instantaneous */ true, /* important */ true);

        // close the port if preconnect is false OR quitAfterUnhook is true
        if (!this.#preconnect || this.#quitAfterUnhook) {
            // give it a delay before it closes the port
            setTimeout(() => {
                if (this.#port) {
                    this.#port.close(() => {
                        console.log('port closed');
                        this.#state = DEVICE_DISCONNECTED;
                        emitter.eventBus.sendEvent('disconnected', { player: this.#player, port: this.#path });
                    })
                } else {
                    console.log('virtual port closed');
                    this.#state = DEVICE_DISCONNECTED;
                }
            }, 100);
        }

        // revert gameDelay to 0.
        this.#gameDelay = 0;

        // revert currentData
        this.#currentData.key = null;
    };

    fireRecoil = (pulses = 0) => {
        //if (pulses === 1) {
            // axios.get('http://192.168.1.21:1337/white/d6');
            //setTimeout(() => axios.get('http://192.168.1.21:1337/white/00'), 50);
        //}
        this.#sendAction("F0.1." + bound(pulses, 0, 255));
    };

    last_tick = performance.now();
    tick = null;

    stopRumblePulsingEffect = (effect = "MAIN") => {
        let timer = this.#pulsingRumbleTimers[effect];
        if (timer) {
            timer.clearInterval();
            timer = null;    
        }
        this.setRumbleEffect(effect, 0, 0);
        delete this.#pulsingRumbleTimers[effect];
    };

    startRumblePulsingEffect = (effect = "MAIN", strength = 255, on = 50, off = 50) => {
        let timer = null;
        if (this.#pulsingRumbleTimers[effect] !== undefined) { // if the effect is already running, we'll replace it
            timer = this.#pulsingRumbleTimers[effect];
            timer.clearInterval();
        } else {
            timer = new NanoTimer();
        }
        timer.setInterval(() => {
            this.setRumbleEffect(effect, strength, on);
        }, '', (on + off) + 'm');
        this.#pulsingRumbleTimers[effect] = timer;
    };

    setRumbleEffect = (effect = "MAIN", strength = 255, duration = 0, instantaneous = false, important = false) => {
        // if there are no pulsed/delayed commands going on and strength is the same as last set..do nothing
        if (this.#rumbleEffectsTimers.length === 0 && duration === 0 && strength === this.#lastRumbleSettings.strength) {
            return;
        }
        this.#rumbleEffectsIndices[effect] = ++this.#rumbleEffectIndex;
        let rumbleEffectIndex = this.#rumbleEffectsIndices[effect];
        this.#rumbleEffects[effect] = { value: bound(strength, 0, 255), index: rumbleEffectIndex };
        let rumbleEffectKeys = Object.keys(this.#rumbleEffects);
        let maxRumble = 0; // set the rumble to max from all available effects
        rumbleEffectKeys.forEach(key => {
            maxRumble = Math.max(this.#rumbleEffects[key].value, maxRumble);
        });
        this.#lastRumbleSettings.strength = maxRumble;
        this.#sendAction("F1." + (maxRumble > 0 ? 1 : 0) + "." + maxRumble, instantaneous, important);
        // console.log("SET RUMBLE TO: " + maxRumble);
        if (duration > 0) {
            let timer = new NanoTimer();
            timer.setTimeout(() => {
                // remove from the list of effect timers (mutates the array)
                _.remove(this.#rumbleEffectsTimers, ret => ret === timer);

                // while waiting, a new setRumbleEffect for the given effect came in, so exit early.
                if (this.#rumbleEffectsIndices[effect] !== rumbleEffectIndex) { return; }

                // update the effect to 0, and send the data
                this.#rumbleEffects[effect] = 0;
                this.setRumbleEffect(effect, 0, 0, instantaneous, important);
                timer = null;
            }, '', duration + 'm');    
            this.#rumbleEffectsTimers.push(timer)
        }
    }

    // strenth is [0, 255]
    // duration = 0 is infinity
    // duration > 0 is milliseconds
    // this method is now obsolete. it utilizes setRumbleEffect now.
    setRumble = (strength = 255, duration = 0, instantaneous, important) => {
        this.setRumbleEffect("MAIN", strength, duration, instantaneous, important);
    };

    // hold timing is [0,9999] in ms
    // pause timing is [0,9999] in ms
    setAutofireTimings = (hold = 35, pause = 35) => {
        this.#autofireHold = bound(hold, 0, 9999);
        this.#autofirePause = bound(pause, 0, 9999);
        this.#sendAction("R0.0." + hold, false, true);
        this.#sendAction("R0.1." + pause, false, true);
    };

    // if length is specified, then hold + pause will be just under half the time
    // length is ms between shots, valid values are *technically* [0,19998]
    // if you don't want timings auto-calculated, call setAutofireTimings and then
    // manually call startAutofire.
    startAutofire = (length = -1) => {
        // initial condition  -- give it a default of 70ms
        if (length < 40 && this.#autofireHold === -1 && this.#autofirePause === -1) {
            length = 70; // give it a default
        }
        if (length >= 40) { // minimum that we will support
            // we will reduce the timings by 3ms for each so we hopefully
            // always finish the shot before moving on to the next one
            // since we send autofire via F0.1.0 (no queueing).
            if (this.#autofireHold !== Math.floor(length / 2 - 3) || this.#autofirePause !== Math.floor(length / 2 - 3)) {
                this.setAutofireTimings(length / 2 - 3, length / 2 - 3);
            }
        } else {
            // we will keep a buffer of 6ms.
            length = this.#autofireHold + this.#autofirePause + 6;
        }
        this.#autofireLength = length;
        if (this.#autofireTimer !== null) {
            if (this.#lastAutofireSettings.hold == this.#autofireHold && this.#lastAutofireSettings.pause == this.#autofirePause && this.#lastAutofireSettings.length == this.#autofireLength) {
                return // do nothing;
            }
            this.stopAutofire();
        }
        console.log('start AF');
        this.fireRecoil(1);
        this.#lastAutofireSettings = { hold: this.#autofireHold, pause: this.#autofirePause, length: this.#autofireLength };
        this.#autofireTimer = new NanoTimer();
        this.last_tick = performance.now();
        this.#autofireTimer.setInterval(() => {
            this.tick = performance.now();
            if(Math.abs(this.tick - this.last_tick - length) > 1) {
                console.log(this.tick - this.last_tick - length);
            }
            this.last_tick = this.tick;
            this.fireRecoil(1)
	    }, '', length + 'm');
    };

    stopAutofire = () => {
        if (this.#autofireTimer) {
            console.log('stop AF');
            this.#autofireTimer.clearInterval();
            // clearInterval(this.autofireTimer);
            this.#autofireTimer = null;
        }
    };

    sendAction = (action) => {
        this.#sendAction(action);
    };

    setOnConnected = (fn, ctx) => {
        this.#onConnectedCall = fn;
        this.#onConnectedContext = ctx;

        // // if we are already connected, execute immediately IF we are already hooked.
        // // if we are not yet hooked, don't execute because we will execute in the hook method itself.
        // if (this.#state === DEVICE_CONNECTED) {
        //     this.#sendAction("S6", /* inst */ true, /* impt */ true);
        //     console.log("entrypoint 1");
        //     this.#onConnectedCall.call(ctx, this, _.merge(this.#currentData, this.getInfo()));
        // }
    };

    setOnDisconnecting = (fn, ctx) => {
        this.#onDisconnectingCall = fn;
        this.#onDisconnectingContext = ctx;
    };

    #getStateName = (state) => {
        switch(state) {
            case DEVICE_CONNECTED:
                return "CONNECTED";
            case DEVICE_DISCONNECTED:
                return "DISCONNECTED";
            case DEVICE_DISCONNECTING:
                return "DISCONNECTING";
            case DEVICE_ERROR:
                return "ERROR";
        }
    };

    getInfo = () => {
        return {
            player: this.#player,
            port: this.#path,
            state: this.#getStateName(this.#state)
        }
    };

}
module.exports = { Device: Device };
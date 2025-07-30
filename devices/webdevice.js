/* A "web" type of device. Useful for sending (GET) requests to an http endpoint.
  This file still needs a TON of deleting/cleanup. One day. Today is not that day.
  Created by nugarp/spazzy. Last updated 3/1/24. */

 const NanoTimer = require('nanotimer');
 const _ = require('lodash');
 const emitter = require('../core/emitter');
 const axios = require('axios');
 
 // consts for COM states
 const DEVICE_ERROR = -2;
 const DEVICE_DISCONNECTING = -1;
 const DEVICE_DISCONNECTED = 0;
 const DEVICE_CONNECTED = 1;
 
 // This virtual device, so far, has only needed one action:
 // 
 // sendAction(url) to a GET endpoint over COM. There is an excellent
 // argument to be made with REST principles that this should be POST.
 // But dude, this is for arcade machines, and testing with GET vars is
 // so much easier.
 //
 // Yes, that's it. Feel free to create your own methods if you
 // need to do POST requests, etc.

 // Mocks SerialPort but uses axios behind-the-scenes for all data transfer.
 class WebPort {
     #cfg = null;
     constructor (cfg) { // baseUrl
         cfg = cfg || {}
         this.#cfg = cfg;
     }
     close = (callback) => {
         if (callback && typeof callback == "function") {
             callback();
         }
     }
     write = (options, callback) => {
         // expect: object (options.path, options.data) OR string (url)
         let url = options.path || (typeof options === 'string' ? options : '');
         if (url.toLowerCase().length < 4 || url.toLowerCase().substring(0,4) !== 'http') {
             console.log('failed to send command to url: ' + url)
             callback(null);
             return;
         }
         // this is an output..write can't be used to get data so we only call callback if there's an error
         axios.get(url).then(() => {}).catch((err) => callback(err))
     }
     open = (callback) => {
         if (callback && typeof callback == "function") {
             callback(null); // null = no error
         }
     }
 }
 
 class WebDevice {
     #port = null; // not used
     #path = null; // not used
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
 
 /*
 ALL OF THE BELOW IS IGNORED
 */
 
     #queue = [];
     #outstandingWrites = 0;
   
     #rumbleOnHook = false;
 /*
 ALL OF THE ABOVE IS IGNORED
 */
 
     constructor(path, player, rumbleOnHook, delay, preconnect, quitAfterUnhook) {
         this.#path = path;
         this.#player = player;
         this.#delay = delay;
         this.#quitAfterUnhook = quitAfterUnhook;
         this.#port = new WebPort({ path: path });// path; //new SerialPort({ path: path, baudRate: 57600, autoOpen: false }) : null;
         this.#preconnect = preconnect;
         if (preconnect) {
             this.#preconnectPromise = new Promise((res) => {
                 this.onHook(0, null, res);
             });
         }
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
         console.log(`< [P${this.#player} SA:CMD ] ${action}`);
         // catch cases where commands are sent after a device has been disconnected (or during disconnects) TODO BUG????
         if (!important && (this.#state == DEVICE_DISCONNECTED || this.#state == DEVICE_DISCONNECTED || this.#state == DEVICE_ERROR)) {
             console.log(`* [P${this.#player} SA:IGNR] ${action}`);
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
                 console.log(`> [P${this.#player} SA:SENT] ${action}`);    
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
 
     sendAction = (action) => {
         this.#sendAction(action);
     };
 
     setOnConnected = (fn, ctx) => {
         this.#onConnectedCall = fn;
         this.#onConnectedContext = ctx;
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
 module.exports = { WebDevice: WebDevice };
/* Base class for all plugins that will read from game's memory
 v0.1.8 Created by nugarp/spazzy.
 A very barebones class. Implement tick(), hook(), and unhook() if
 you plan to make plugins for this. You can see Tc5.js or Hotd4.js
 for examples that utilize this method of output generation.
 Last Updated 3/1/24.
 
 v0.1.8 - Add support for passing the config.json cfg file to plugins if they need to reference it.
 v0.1.7 - Add support for generic connected/disconnected files (handles multiple games at once)
 v0.1.6 - Added support for calling external files for connected() and disconnecting()
          Added support for a "preconnect" flag in config.json that will force NGO to
          reserve all defined COM ports as soon as it is run. It never releases the ports
          until the program is closed.
 v0.1.2 - Added support for disconnecting() callback, which is called just
 before a serial port connection is terminated. It can be called N times -
 once per player.
 v0.1.1 - Added support for connected() callback, which is called after
 a serial port connection success has been made (or if it already is connected,
 it will execute immediately). It can be called N times - once per player.
 */

const vm = require('vm');
const fs = require('fs');

class Plugin {
    process = null;
    players = null;
    mem = null;
    cfg = null; // in case we need to reference it in a child class.

    constructor (process, players, mem, cfg) {
        this.process = process;
        this.mem = mem;

        // allow remapping of player order if needed (might be useful for 4p games)
        this.players = [];
        if (cfg && cfg.players) {
            cfg.players.forEach((port, index) => {
                this.players[index] = _.find(players, cp => cp.getInfo().port === port);
            })
        } else {
            this.players = players;
        }

        this.cfg = cfg;
    }

    connected (player, data) {
        console.log('connected() called:', JSON.stringify(data));
    }

    disconnecting (player, data) {
        console.log('disconnecting() called:', JSON.stringify(data));
    }
 
    tick () { console.log('tick() not implemented'); }
    hook () { console.log('hook() not implemented'); }
    unhook () { console.log('unhook() not implemented'); }

    // DO NOT override these _-prefix functions in your plugins
    _universalConnected (player, data) {
        this.connected(player, data);

        // if the user has defined a generic connected file, call that.
        let execFile = `${__dirname}/../overrides/connected.js`;
        if (fs.existsSync(execFile)) {
            let code = fs.readFileSync(execFile);
            vm.runInNewContext(code, {player: player, data: data, console: console});
        }
        
        // then, if they have anything even more specific for a game, call that.
        execFile = `${__dirname}/../overrides/connected/${data.key}.js`;
        if (fs.existsSync(execFile)) {
            let code = fs.readFileSync(execFile);
            vm.runInNewContext(code, {player: player, data: data, console: console});
        }
    }

    // DO NOT override these _-prefix functions in your plugins
    _universalDisconnecting (player, data) {
        this.disconnecting(player, data);

        // if the user has defined a generic disconnecting file, call that.
        let execFile = `${__dirname}/../overrides/disconnecting.js`;
        if (fs.existsSync(execFile)) {
            let code = fs.readFileSync(execFile);
            vm.runInNewContext(code, {player: player, data: data});
        }

        // then, if they have anything even more specific for a game, call that.
        execFile = `${__dirname}/../overrides/disconnecting/${data.key}.js`;
        if (fs.existsSync(execFile)) {
            let code = fs.readFileSync(execFile);
            vm.runInNewContext(code, {player: player, data: data});
        }
    }
}

module.exports = { Plugin: Plugin }
// ---
// node-game-outputs
// Original authors: nugarp / spazzy
// Modified and extended by SamRevolt (2025)
// This is a personal version with added features and tweaks.
// ---

// index_patch.js — Patch pour uniformiser l'ouverture du process côté mémoire (mode manuel & autodétection)
// et surveiller la fermeture du process même en mode manuel (avec arguments)
// et supporter les arguments -target=xxx et -rom=yyy en plus de l'ancien format (-nes -duckhunt)

const fs = require('fs');
const memoryjs = require('memoryjs');
const _ = require('lodash');
const NanoTimer = require('nanotimer');
const { performance } = require('perf_hooks');
const ph = require('./core/processHelpers');

const device = require('./devices/device');
const webdevice = require('./devices/webdevice');
const memoryHelpers = require('./core/memoryHelpers');
const io = require('socket.io')();
const emitter = require('./core/emitter');

let appRefreshInterval = 1000;
let mainloopInterval = 8;
let players = [];
let openConnections = 0;

console.log("node-game-outputs, originally created by nugarp/spazzy.");
console.log("Modified and extended by SamRevolt (2025).");

console.log("Step 1. Loading CFG");
let cfg = JSON.parse(fs.readFileSync("config/config.json"));
mainloopInterval = cfg.interval || mainloopInterval;

emitter.eventBus.on('connected', () => {
    openConnections++;
    console.log('[connected] open connections: ' + openConnections);
});
emitter.eventBus.on('disconnected', () => {
    openConnections--;
    console.log('[disconnected] open connections: ' + openConnections);
    if (openConnections === 0 && cfg.quitAfterUnhook) {
        console.log('[quitAfterUnhook] all connections closed. Hope you enjoyed!');
        process.exit();
    }
})

// detect and store which device type should be used -- COM or Web (REST)
let deviceType = "COM";
if (!cfg.deviceType || cfg.deviceType.toLowerCase() === "com") {
    deviceType = "COM";
} else if (cfg.deviceType.toLowerCase() === "web") {
    deviceType = "Web";
}

for (let i = 0; i < cfg.players.length; i++) {
    let path = cfg.players[i];
    if (!cfg.deviceType || cfg.deviceType.toLowerCase() === "com") {
        players.push(new device.Device(path, i+1, cfg.rumbleOnHook, cfg.delay, cfg.preconnect, cfg.quitAfterUnhook));
    } else if (cfg.deviceType.toLowerCase() === "web") {
        players.push(new webdevice.WebDevice(path, i+1, cfg.rumbleOnHook, cfg.delay, cfg.preconnect, cfg.quitAfterUnhook));
    }
}

console.log("CFG loaded, " + deviceType + " devices set up.");

let currentApp = null;
let plugin = null;

// -------- Patch: Supporte -target=xxx et -rom=yyy en plus de l'ancien format (-nes -duckhunt) --------
let systemArg = null;
let titleArg = null;
process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('-target=')) {
        systemArg = arg.split('=')[1].toLowerCase();
    } else if (arg.startsWith('-rom=')) {
        titleArg = arg.split('=')[1].toLowerCase();
    }
});
// Fallback pour l'ancien format (ex: -nes -duckhunt)
if (!systemArg || !titleArg) {
    const args = process.argv.slice(2).filter(a => a.startsWith('-')).map(a => a.replace(/^-+/, '').toLowerCase());
    if (!systemArg && args[0]) systemArg = args[0];
    if (!titleArg && args[1]) titleArg = args[1];
}
// -----------------------------------------------------------------------------------------------

// PATCH: Fonction utilitaire pour ouvrir un process via memoryjs et construire un objet process complet (avec handle)
function openProcessByNameOrPid(exeName, pid) {
    try {
        let procObj = null;
        if (pid) {
            procObj = memoryjs.openProcess(pid);
        } else if (exeName) {
            const procs = memoryjs.getProcesses();
            const found = procs.find(p => p.szExeFile.toLowerCase() === exeName.toLowerCase());
            if (found) {
                procObj = memoryjs.openProcess(found.th32ProcessID);
            }
        }
        return procObj;
    } catch (e) {
        console.error("[ERROR] openProcessByNameOrPid:", e);
        return null;
    }
}

/* ---- PATCH: Mode ARGS, attend le PID réel puis ouvre le process AVANT de charger le plugin ---- */
function waitForProcessAndLaunch(appName, entry, sectionName, title) {
    let interval = setInterval(() => {
        let procs = memoryjs.getProcesses();
        let foundProc = procs.find(p => p.szExeFile.toLowerCase() === appName.toLowerCase());
        if (foundProc) {
            clearInterval(interval);
            let processObj = openProcessByNameOrPid(appName, foundProc.th32ProcessID);
            if (!processObj) {
                console.error(`[manual] Impossible d'ouvrir le process ${appName} (PID: ${foundProc.th32ProcessID})`);
                process.exit(1);
            }
            processObj.szExeFile = appName;
            processObj.th32ProcessID = foundProc.th32ProcessID;
            currentApp = { cfg: entry, target: processObj, section: sectionName, title: title };
            console.log(`[manual] Plugin: '${entry.plugin}' for system '${sectionName}', title '${title}' (PID: ${processObj.th32ProcessID})`);
            players.forEach(player => player.onHook(entry.config.gameDelay || 0, entry.key || title));
            let pluginLoaded = require('./plugins/' + entry.plugin);
            plugin = pluginLoaded.generate(processObj, players, new memoryHelpers.MemoryHelper(processObj), entry.config || {});
            players.forEach(player => player.setOnConnected(plugin._universalConnected, plugin));
            players.forEach(player => player.setOnDisconnecting(plugin._universalDisconnecting, plugin));
            plugin.hook();

            // -------- PATCH: Surveillance de la fermeture du process même en mode manuel --------
            setInterval(() => {
                if (currentApp && currentApp.target && currentApp.target.th32ProcessID) {
                    let procs = memoryjs.getProcesses();
                    if (!procs.find(p => p.th32ProcessID === currentApp.target.th32ProcessID)) {
                        console.log('UNHOOKING / APP EXIT (manual mode)');
                        players.forEach(player => player.onUnhook());
                        if (plugin && typeof plugin.unhook === 'function') {
                            plugin.unhook();
                        }
                        plugin = null;
                        currentApp = null;
						process.exit(); // <-- quitte la console automatiquement
                    }
                }
            }, 1000);
            // -------------------------------------------------------------------------
        } else {
            process.stdout.write(`\r[attente] Lancement de ${appName}...          `);
        }
    }, 1000);
}

/* ---------------- AUTODETECTION APPS ---------------- */
let checkForApps = () => {
    if (currentApp) return;
    ph.findGames(cfg.apps).then(result => {
        if (result !== null) {
            let procObj = openProcessByNameOrPid(result.target.process.szExeFile, result.target.process.th32ProcessID);
            if (!procObj) {
                console.error(`[autodetect] Impossible d'ouvrir le process ${result.target.process.szExeFile} (PID: ${result.target.process.th32ProcessID})`);
                return;
            }
            procObj.szExeFile = result.target.process.szExeFile;
            procObj.th32ProcessID = result.target.process.th32ProcessID;
            currentApp = result;
            currentApp.target.process = procObj;
            console.log(result);
            players.forEach(player => player.onHook(result.cfg.config.gameDelay || 0, result.cfg.key));
            let pluginLoaded = require('./plugins/' + result.cfg.plugin);
            plugin = pluginLoaded.generate(procObj, players, new memoryHelpers.MemoryHelper(procObj), result.cfg.config || {});
            players.forEach(player => player.setOnConnected(plugin._universalConnected, plugin));
            players.forEach(player => player.setOnDisconnecting(plugin._universalDisconnecting, plugin));
            plugin.hook();
        }
    });
};

let checkForAppExit = () => {
    if (currentApp === null || currentApp.rom) {  return; }
    let procs = memoryjs.getProcesses();
    if (!_.find(procs, p => p.th32ProcessID === currentApp.target.th32ProcessID)) {
        console.log('UNHOOKING / APP EXIT')
        players.forEach(player => player.onUnhook());
        if (plugin && typeof plugin.unhook === 'function') {
            plugin.unhook();
        }
        plugin = null;
        currentApp = null;
    }
}

let last_tick = performance.now();
let tick = null;
let mainLoop = () => {
    if (plugin !== null) {
        tick = performance.now();
        plugin.tick();
        last_tick = tick;
    }
}
let tickTimer = new NanoTimer();
tickTimer.setInterval(mainLoop, '', mainloopInterval + 'm');

let apploop = setInterval(() => {
    if (currentApp === null) {
        checkForApps();
    } else if (currentApp !== null) {
        checkForAppExit();
    }
}, appRefreshInterval);

checkForApps();

/* ---------------- HOOKS / MAMEHOOKER ---------------- */
console.log('socketio server started');
io.on('connection', client => {
    console.log('socketio connected');
    client.on('OnMAMEStart', (data) => {
        if (currentApp !== null && currentApp.rom && currentApp.rom.length > 0) {
            players.forEach(player => player.onUnhook());
            if (plugin && typeof plugin.unhook === 'function') {
                plugin.unhook();
            }
            plugin = null;
            currentApp = null;
        }
        console.log('OnMAMEStart',data.Name);
        if (data && data.Name && data.Name.length > 0) {
            if (cfg.hooks && cfg.hooks.length > 0) {
                let cfgAppEntry = _.find(cfg.hooks, (h) => h.rom.toLowerCase() == data.Name.toLowerCase());
                if (cfgAppEntry) {
                    currentApp = { rom: data.Name, cfg: cfgAppEntry };
                    players.forEach(player => player.onHook(currentApp.cfg.config.gameDelay || 0, cfgAppEntry.key || currentApp.rom));
                    let pluginLoaded = require('./plugins/' + currentApp.cfg.plugin);
                    plugin = pluginLoaded.generate(currentApp, players, null);
                    players.forEach(player => player.setOnConnected(plugin._universalConnected, plugin))
                    players.forEach(player => player.setOnDisconnecting(plugin._universalDisconnecting, plugin));
                    plugin.hook();
                }
            }
        }
    });

    client.on('OnMAMEStop', (data) => {
        console.log('OnMAMEStop');
        if (currentApp !== null && currentApp.rom && currentApp.rom.length > 0) {
            players.forEach(player => player.onUnhook());
            if (plugin && typeof plugin.unhook === 'function') {
                plugin.unhook();
            }
            plugin = null;
            currentApp = null;
        }
    });

    client.on('OnMAMEOutput', (data) => {
        if (plugin !== null && plugin.onMameOutput) {
            plugin.onMameOutput(data);
        }
    });

    client.on('disconnect', () => {
        console.log('socketio disconnect');
        if (currentApp !== null && currentApp.rom && currentApp.rom.length > 0) {
            players.forEach(player => player.onUnhook());
            if (plugin && typeof plugin.unhook === 'function') {
                plugin.unhook();
            }
            plugin = null;
            currentApp = null;
        }
    });
});

io.listen(9000);

/* -------------- MAIN ENTRYPOINT ARGUMENTS -------------- */
if (systemArg && titleArg && cfg[systemArg] && Array.isArray(cfg[systemArg])) {
    clearInterval(apploop);
    let entry = cfg[systemArg].find(e => e.title && e.title.toLowerCase() === titleArg.toLowerCase());
    if (!entry) {
        console.error(`[error] Aucun jeu trouvé pour '${systemArg}' avec le titre '${titleArg}'`);
        process.exit(1);
    }
    waitForProcessAndLaunch(entry.app, entry, systemArg, titleArg);
}
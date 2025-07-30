/**
 * Cooper's 9 Arcade FeedbackPlugin v1.0 - Plugin for HdReloaded
 * --------------------------------------
 * Author: SamRevolt
 * First Release: 10 July 2025
 *
 * This plugin enables LightGun feedback (Recoil & Rumble on damage) for both players.
 * Compatible with TeknoParrot and JConfig.
 * Memory addresses are retrieved via an external DLL.
 */

const { Plugin } = require('./plugin');
const { TYPE } = require('../core/memoryHelpers');
const getMem2Base = require('../core/Coopers9.MemoryHook'); // charge le module externe

class Coopers9Plugin extends Plugin {

    #gameBaseAddr = null;
    #playerOffsets = null; // <-- structure des offsets
    #id = 0;
    #lastState =  { players: [ { bullets1: -1, bullets2: -1, health: -1, weapons: -1 } , { bullets1: -1, bullets2: -1, health: -1, weapons: -1 } ], changed: false, valid: false };

    constructor(proc, players, mem, cfg) {
        console.log('Coopers 9: loaded');
        super(proc, players, mem, cfg);
        this.#initBaseAddr();
    }

    async #initBaseAddr() {
        // Réessaye toutes les 2 secondes tant que la base ou les offsets ne sont pas trouvés
        const tryGetBase = () => {
            // appel asynchrone à la DLL
            getMem2Base((err, result) => {
                if (err) {
                    console.error('[Coopers 9] Error getting base address:', err);
                } else if (result && result.BaseAddress && result.PlayerOffsets) {
                    this.#gameBaseAddr = result.BaseAddress;
                    this.#playerOffsets = result.PlayerOffsets;
                    console.log(`[Coopers 9] base address (via DLL) found`);
                    console.log(`[Coopers 9] player offsets loaded:`);
                } else {
                    if (!this._warnedNoBaseAddr) {
                        console.warn('[Coopers 9] base address or offsets not found (DLL), will retry...');
                        this._warnedNoBaseAddr = true;
                    }
                    setTimeout(tryGetBase, 2000); // réessaye dans 2 secondes
                }
            });
        };
        tryGetBase();
    }

    hook () {
        console.log('Coopers 9: hooked');
        this.players[0].setAutofireTimings(20, 15);
        this.players[1].setAutofireTimings(20, 15);
        this.#id = 0;
    }

    unhook () {
        console.log("Coopers 9: unhooked");
    }

    tick () {
        let state = this.#readMemory();

        if (state.valid) {
            if (state.changed) {
                console.log(state);
                for (let i = 0; i < state.players.length; i++) {
                    let device = this.players[i];
                    let player = state.players[i];
                    let lastPlayer = this.#lastState.players[i];

                    if (player.bullets1 == lastPlayer.bullets1 - 1) {
                        device.fireRecoil(1);
                    }
                    if (player.bullets2 == lastPlayer.bullets2 - 1) {
                        device.fireRecoil(1);
                    }
                    if (player.health == lastPlayer.health - 1) {
                        device.setRumbleEffect("DAMAGE" + this.#id++, 600, 200);
                    }
                }
            }
            this.#lastState = state;
        }
    }

    #readMemory() {
        if (!this.#gameBaseAddr || !this.#playerOffsets) {
            if (!this._warnedNoBaseAddr) {
                console.warn('[Coopers 9] Waiting for Core base address or offsets from DLL...');
                this._warnedNoBaseAddr = true;
            }
            return { valid: false };
        }

        let state = {
            players: [{},{}],
            changed: false,
            valid: true
        };

        // Utilise les offsets pour chaque joueur
        this.#playerOffsets.forEach((offsets, i) => {
            Object.keys(offsets).forEach(f => {
                const address = this.#gameBaseAddr + offsets[f];
                state.players[i][f] = this.mem.read(address, TYPE.BYTE);
                state.changed = state.changed || (state.players[i][f] !== this.#lastState.players[i][f]);
                state.valid = state.valid && state.players[i][f] >= -1;
            });
        });

        return state;
    }
}

exports.generate = (process, players, mem) => { return new Coopers9Plugin(process, players, mem); };
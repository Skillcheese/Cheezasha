/**
 * Sim Builds
 *
 * Persists fully fictional player DTOs (equipment, abilities, consumables, skill
 * levels, house rooms) saved from the Sim Editor. Unlike loadout-snapshot.js
 * (real in-game loadouts synced from the server), these are user-authored "what if"
 * builds for long-term gear/ability planning — e.g. an endgame target set that has
 * nothing currently equipped.
 *
 * Character-scoped, same as loadout snapshots, so builds don't leak across accounts.
 */

import dataManager from '../../core/data-manager.js';
import storage from '../../core/storage.js';
import { buildGameDataPayload } from './combat-sim-adapter.js';

const STORAGE_KEY_PREFIX = 'combat_sim_builds';
const SCHEMA_VERSION = 1;

/**
 * Get character-scoped storage key.
 * @returns {string}
 */
function getStorageKey() {
    const charId = dataManager.getCurrentCharacterId() || 'default';
    return `${STORAGE_KEY_PREFIX}_${charId}`;
}

/**
 * Strip equipment/abilities/food/drinks referencing item or ability hrids the game
 * no longer recognizes (e.g. a build saved before an item/ability was renamed or
 * removed in a game update). Mutates and returns the given DTO.
 * @param {Object} dto
 * @returns {Object} the same dto, pruned
 */
function pruneUnknownHrids(dto) {
    const gameData = buildGameDataPayload();
    const itemDetailMap = gameData?.itemDetailMap || {};
    const abilityDetailMap = gameData?.abilityDetailMap || {};

    if (dto.equipment) {
        for (const [slot, item] of Object.entries(dto.equipment)) {
            if (item?.hrid && !itemDetailMap[item.hrid]) {
                console.warn(`[SimBuilds] Dropping unknown item from saved build: ${item.hrid}`);
                delete dto.equipment[slot];
            }
        }
    }

    if (Array.isArray(dto.abilities)) {
        dto.abilities = dto.abilities.map((ab) => {
            if (ab?.hrid && !abilityDetailMap[ab.hrid]) {
                console.warn(`[SimBuilds] Dropping unknown ability from saved build: ${ab.hrid}`);
                return null;
            }
            return ab;
        });
    }

    for (const field of ['food', 'drinks']) {
        if (Array.isArray(dto[field])) {
            dto[field] = dto[field].map((item) => {
                if (item?.hrid && !itemDetailMap[item.hrid]) {
                    console.warn(`[SimBuilds] Dropping unknown item from saved build: ${item.hrid}`);
                    return null;
                }
                return item;
            });
        }
    }

    return dto;
}

class SimBuilds {
    constructor() {
        this.builds = {};
        this.isInitialized = false;
    }

    /**
     * Load builds from storage. Safe to call multiple times.
     */
    async initialize() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        const stored = await storage.getJSON(getStorageKey(), 'settings', null);
        if (stored && stored.version === SCHEMA_VERSION && stored.builds) {
            this.builds = stored.builds;
        } else {
            this.builds = {};
        }
    }

    _persist() {
        storage.setJSON(getStorageKey(), { version: SCHEMA_VERSION, builds: this.builds }, 'settings');
    }

    /**
     * Get all saved builds, sorted by name.
     * @returns {Array<{name: string, savedAt: number}>} metadata only, no dto
     */
    list() {
        return Object.values(this.builds)
            .map((b) => ({ name: b.name, savedAt: b.savedAt }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * @param {string} name
     * @returns {boolean}
     */
    has(name) {
        return Object.prototype.hasOwnProperty.call(this.builds, name);
    }

    /**
     * Get a build's DTO by name, pruned of any now-unknown item/ability hrids.
     * @param {string} name
     * @returns {Object|null} a structuredClone of the saved DTO, or null if not found
     */
    get(name) {
        const build = this.builds[name];
        if (!build) return null;
        return pruneUnknownHrids(structuredClone(build.dto));
    }

    /**
     * Save (or overwrite) a build under the given name.
     * @param {string} name
     * @param {Object} dto - Player DTO to snapshot
     */
    save(name, dto) {
        if (!name) return;
        this.builds[name] = {
            name,
            savedAt: Date.now(),
            dto: structuredClone(dto),
        };
        this._persist();
    }

    /**
     * Rename a saved build. No-op if the source doesn't exist or the target name is taken.
     * @param {string} oldName
     * @param {string} newName
     * @returns {boolean} true if renamed
     */
    rename(oldName, newName) {
        if (!newName || oldName === newName) return false;
        const build = this.builds[oldName];
        if (!build || this.builds[newName]) return false;
        delete this.builds[oldName];
        build.name = newName;
        this.builds[newName] = build;
        this._persist();
        return true;
    }

    /**
     * Delete a saved build.
     * @param {string} name
     */
    remove(name) {
        if (!this.builds[name]) return;
        delete this.builds[name];
        this._persist();
    }
}

const simBuilds = new SimBuilds();

export default simBuilds;

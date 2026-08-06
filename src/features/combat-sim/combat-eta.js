/**
 * Combat ETA Estimator
 *
 * Estimates kills/hr for the player's currently active combat zone by running a short,
 * single-worker combat simulation, so finite ("Kill N") combat tasks can show a time
 * remaining estimate the same way non-combat actions do.
 *
 * The result is cached per zone+difficultyTier and re-simulated at most every
 * REFRESH_INTERVAL_MS, so a lucky/unlucky sim doesn't lock in a stale rate forever but
 * we also don't re-simulate on every kill.
 */

import config from '../../core/config.js';
import {
    buildGameDataPayload,
    buildAllPlayerDTOs,
    getCommunityBuffs,
    applyLoadoutSnapshotToDTO,
} from './combat-sim-adapter.js';
import { runSimulation } from './combat-sim-runner.js';

const REFRESH_INTERVAL_MS = 30 * 60 * 1000;
const SIM_HOURS = 1;
const ONE_HOUR_NS = 3600 * 1e9;

class CombatEtaEstimator {
    constructor() {
        // Keyed by zone|tier|loadout — the queue menu can show several distinct combat actions
        // at once, so a single shared cache slot would thrash: computing zone B's estimate would
        // evict zone A's just-resolved value, flipping its row back to "Calculating…" forever.
        this.cache = new Map(); // key -> { encountersPerHour, timestamp }
        this.pending = new Map(); // key -> in-flight recompute promise
        this.listeners = new Set();
    }

    /**
     * Get estimated encounters (kills)/hr for a combat zone, using a cached value when fresh.
     * Returns a stale cached value immediately (while refreshing in the background) rather than
     * blocking the caller, so the UI never has to wait on a resim once an initial value exists.
     * @param {string} zoneHrid
     * @param {number} difficultyTier
     * @returns {Promise<number|null>} Encounters/hr, or null if unavailable (e.g. still computing)
     */
    async getKillsPerHour(zoneHrid, difficultyTier) {
        const key = this._buildKey(zoneHrid, difficultyTier);
        const entry = this.cache.get(key);
        const isFresh = entry && Date.now() - entry.timestamp < REFRESH_INTERVAL_MS;

        if (isFresh) {
            return entry.encountersPerHour;
        }

        const pending = this._startRefresh(key, zoneHrid, difficultyTier);

        if (entry) {
            // Stale value available — return it now, let the resim update the cache in the background.
            pending.catch(() => {});
            return entry.encountersPerHour;
        }

        return pending;
    }

    /**
     * Synchronous cache lookup for callers (e.g. queue-menu rendering) that can't await a sim.
     * Kicks off a background refresh when the cache is missing/stale and notifies subscribers
     * once it resolves, but never blocks — returns the current cached value (possibly stale) or
     * null if nothing has been computed yet.
     * @param {string} zoneHrid
     * @param {number} difficultyTier
     * @returns {number|null}
     */
    peek(zoneHrid, difficultyTier) {
        const key = this._buildKey(zoneHrid, difficultyTier);
        const entry = this.cache.get(key);
        const isFresh = entry && Date.now() - entry.timestamp < REFRESH_INTERVAL_MS;

        if (!isFresh) {
            this._startRefresh(key, zoneHrid, difficultyTier).catch(() => {});
        }

        return entry ? entry.encountersPerHour : null;
    }

    /**
     * Build a cache key that also accounts for the loadout the sim should run with, so switching
     * the "default loadout for combat estimates" setting invalidates any cached rate.
     * @param {string} zoneHrid
     * @param {number} difficultyTier
     * @returns {string}
     */
    _buildKey(zoneHrid, difficultyTier) {
        const loadoutName = config.getSettingValue('combatSim_defaultLoadout', '');
        return `${zoneHrid}|${difficultyTier}|${loadoutName}`;
    }

    /**
     * Start (or join) an in-flight recompute for the given key.
     * @returns {Promise<number|null>}
     */
    _startRefresh(key, zoneHrid, difficultyTier) {
        const existing = this.pending.get(key);
        if (existing) {
            return existing;
        }

        const promise = this._runSim(key, zoneHrid, difficultyTier).finally(() => {
            this.pending.delete(key);
        });
        this.pending.set(key, promise);

        return promise;
    }

    /**
     * Subscribe to cache updates (e.g. to re-render once a background sim resolves).
     * @param {Function} fn
     * @returns {Function} Unsubscribe function
     */
    subscribe(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    _notify() {
        for (const fn of this.listeners) {
            try {
                fn();
            } catch (error) {
                console.error('[CombatEta] Listener error:', error);
            }
        }
    }

    /**
     * Run the short simulation and update the cache.
     * @param {string} key
     * @param {string} zoneHrid
     * @param {number} difficultyTier
     * @returns {Promise<number|null>}
     */
    async _runSim(key, zoneHrid, difficultyTier) {
        try {
            const gameData = buildGameDataPayload();
            if (!gameData) return null;

            const { players } = await buildAllPlayerDTOs();
            if (!players || players.length === 0) return null;

            const loadoutName = config.getSettingValue('combatSim_defaultLoadout', '');
            if (loadoutName) {
                applyLoadoutSnapshotToDTO(players[0], loadoutName, gameData);
            }

            const communityBuffs = getCommunityBuffs();

            const result = await runSimulation({
                gameData,
                playerDTOs: [players[0]],
                zoneHrid,
                difficultyTier,
                hours: SIM_HOURS,
                communityBuffs,
                singleWorker: true,
            });

            const simHours = (result?.simulatedTime || 0) / ONE_HOUR_NS || SIM_HOURS;
            const encountersPerHour = (result?.encounters || 0) / simHours;

            this.cache.set(key, { encountersPerHour, timestamp: Date.now() });
            this._notify();
            return encountersPerHour;
        } catch (error) {
            console.error('[CombatEta] Simulation failed:', error);
            return null;
        }
    }

    /**
     * Clear cached/in-flight state (e.g. on character switch).
     */
    reset() {
        this.cache.clear();
        this.pending.clear();
    }
}

const combatEtaEstimator = new CombatEtaEstimator();
export default combatEtaEstimator;

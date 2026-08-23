/**
 * Labyrinth XP Tracker
 * Tracks per-skill XP gained during the current labyrinth run two ways, live:
 *  1. Locally — by snapshotting skill XP when the labyrinth becomes active and diffing against
 *     action_completed's endCharacterSkills as actions complete. No requests sent. Each
 *     action_completed carries the single action that produced it as endCharacterAction — only
 *     completions where that's /actions/labyrinth/explore are counted, so a background action
 *     queue (e.g. a long-running craft/decompose job) that keeps completing in parallel with
 *     the lab is correctly excluded. That same action's createdAt/updatedAt give its exact
 *     start/end, so active duration is read directly rather than approximated from wall-clock
 *     gaps between completions (which would count idle/waiting time as active).
 *  2. Passively via loot_log_updated — the same data source the native "Loot & XP Log"
 *     page uses, and that Cheezasha's own loot-log-stats.js already listens to. Cheezasha
 *     never sends the get_loot_log request itself; it only reads whatever the server already
 *     pushed (from you visiting that page, clicking its Refresh button, or any other code —
 *     ours or the game's own — asking for it).
 *
 * Deliberately does NOT try to guess when a run "really" ended from the character's action
 * queue (actions_updated) — an earlier version did, using heuristics like "a different action
 * started", and that produced false positives (e.g. a queued background action appearing while
 * still mid-lab) that wiped an in-progress run's data. labyrinth_updated's isActive only ever
 * pauses/resumes local accumulation in place; it never wipes anything. The loot log is the only
 * thing authorized to declare "this is a genuinely different run" — done by comparing the
 * server's labyrinthStartedAt for the run against what we last synced to. This trades instant
 * run-boundary detection for correctness: local may keep accumulating across what the server
 * considers two separate runs until the next loot_log_updated arrives, at which point it's
 * corrected exactly.
 */

import webSocketHook from '../../core/websocket.js';
import dataManager from '../../core/data-manager.js';
import config from '../../core/config.js';
import storage from '../../core/storage.js';

const ZERO_TIME = '0001-01-01T00:00:00Z';
const TOTAL_LEVEL_HRID = '/skills/total_level';
const LABYRINTH_EXPLORE_HRID = '/actions/labyrinth/explore';
const STORE_NAME = 'labyrinth';
const STORAGE_KEY_PREFIX = 'xpTrackerRun';

/**
 * Get character-scoped storage key for the in-progress run snapshot.
 * @returns {string}
 */
function getStorageKey() {
    const charId = dataManager.getCurrentCharacterId() || 'default';
    return `${STORAGE_KEY_PREFIX}_${charId}`;
}

class LabyrinthXpTracker {
    constructor() {
        this.isInitialized = false;
        this.local = null; // { isActive, startedAt, serverStartedAt, baseline, xpGains, actionCount, totalActiveMillis }
        this.handlers = {};
        this.listeners = [];
    }

    async initialize() {
        if (this.isInitialized) return;
        if (!config.getSetting('labyrinthXpTracker')) return;

        // The tracker's run state only ever lived in memory, so refreshing the page mid-run
        // wiped it entirely even though the run itself was still in progress server-side.
        // getCurrentCharacterId() may still be null here (init_character_data hasn't arrived
        // yet), in which case this reads the '_default'-keyed slot; the character_initialized
        // handler below re-reads the correctly-scoped key once the real character ID is known.
        const saved = await storage.get(getStorageKey(), STORE_NAME, null);
        if (saved) {
            this.local = saved;
        }

        this.handlers.lootLog = (data) => this._onLootLogUpdated(data);
        this.handlers.labyrinthUpdated = (data) => this._onLabyrinthUpdated(data);
        this.handlers.actionCompleted = (data) => this._onActionCompleted(data);
        this.handlers.characterInitialized = () => this._reloadForCurrentCharacter();

        webSocketHook.on('loot_log_updated', this.handlers.lootLog);
        webSocketHook.on('labyrinth_updated', this.handlers.labyrinthUpdated);
        dataManager.on('action_completed', this.handlers.actionCompleted);
        dataManager.on('character_initialized', this.handlers.characterInitialized);

        this.isInitialized = true;
        this._notify();
    }

    /**
     * Re-read the persisted run under the now-correctly-scoped (real character ID) storage key,
     * in case initialize() ran before init_character_data arrived and only saw the '_default' slot.
     * @private
     */
    async _reloadForCurrentCharacter() {
        if (this.local) return; // already tracking a run (started/restored) — nothing to reload
        const saved = await storage.get(getStorageKey(), STORE_NAME, null);
        if (saved) {
            this.local = saved;
            this._notify();
        }
    }

    disable() {
        if (this.handlers.lootLog) webSocketHook.off('loot_log_updated', this.handlers.lootLog);
        if (this.handlers.labyrinthUpdated) webSocketHook.off('labyrinth_updated', this.handlers.labyrinthUpdated);
        if (this.handlers.actionCompleted) dataManager.off('action_completed', this.handlers.actionCompleted);
        if (this.handlers.characterInitialized)
            dataManager.off('character_initialized', this.handlers.characterInitialized);
        this.handlers = {};

        this.local = null;
        this.listeners = [];
        this.isInitialized = false;
    }

    /**
     * @param {Object} data - labyrinth_updated message payload
     */
    _onLabyrinthUpdated(data) {
        const isActive = !!data?.labyrinth?.isActive;

        if (isActive) {
            if (!this.local) {
                this._startLocalRun();
            } else if (!this.local.isActive) {
                // Resume in place — isActive can pulse false→true between rooms (e.g. after a
                // failed/timed-out room) without you actually having left the lab. Never wipe
                // accumulated data here; only the loot log is authorized to do that.
                this.local.isActive = true;
                this._notify();
            }
        } else if (this.local?.isActive) {
            // Keep the last stats on screen, just stop accumulating until it's active again.
            this.local.isActive = false;
            this._notify();
        }
    }

    /** @private */
    _startLocalRun() {
        const skills = dataManager.characterSkills || [];
        const baseline = {};
        for (const skill of skills) {
            if (skill?.skillHrid) baseline[skill.skillHrid] = skill.experience || 0;
        }

        this.local = {
            isActive: true,
            startedAt: Date.now(),
            serverStartedAt: null,
            baseline,
            xpGains: {},
            actionCount: 0,
            totalActiveMillis: 0,
            lastActionCreatedAt: null,
            lastActionUpdatedAt: 0,
        };
        this._notify();
    }

    /**
     * @param {Object} data - action_completed message payload
     */
    _onActionCompleted(data) {
        if (!this.local?.isActive) return;

        // action_completed carries the single action that just finished as endCharacterAction
        // (not the endCharacterActions array — that's only on actions_updated). Whether inside
        // the lab or not, this is an exact, authoritative tag for which action produced the
        // skill gains below — background queue actions (e.g. a long-running decompose/craft
        // job) keep completing in parallel with the lab and must not be counted.
        const action = data.endCharacterAction;
        if (action?.actionHrid !== LABYRINTH_EXPLORE_HRID) return;

        const skills = data.endCharacterSkills;
        if (!Array.isArray(skills) || skills.length === 0) return;

        // The explore action is a single repeating action instance across the whole lab run —
        // createdAt stays fixed at when it first started, while currentCount/updatedAt advance
        // on every room. So updatedAt - createdAt is the CUMULATIVE elapsed time since the run
        // began, not this one room's duration — summing that per completion would massively
        // overcount. Only the time since the previous completion of this same action instance
        // (tracked by createdAt staying the same) is this room's actual duration.
        if (action.createdAt && action.updatedAt) {
            const updatedMs = +new Date(action.updatedAt);
            let addedMs;
            if (this.local.lastActionCreatedAt !== action.createdAt) {
                // First completion seen for this action instance — nothing to diff against yet,
                // so this room's duration really is updatedAt - createdAt.
                const createdMs = +new Date(action.createdAt);
                addedMs = Math.max(0, updatedMs - createdMs);
            } else {
                addedMs = Math.max(0, updatedMs - this.local.lastActionUpdatedAt);
            }
            this.local.totalActiveMillis += addedMs;

            // TEMPORARY diagnostic — remove once the duration-per-completion bug is confirmed
            // fixed. Run copy(JSON.stringify(window.__cheezashaActionDebug, null, 2)) in the
            // console after reproducing, then paste.
            window.__cheezashaActionDebug = window.__cheezashaActionDebug || [];
            window.__cheezashaActionDebug.push({
                action,
                currentCount: action.currentCount,
                prevLastActionCreatedAt: this.local.lastActionCreatedAt,
                prevLastActionUpdatedAt: this.local.lastActionUpdatedAt,
                addedMs,
                totalActiveMillisAfter: this.local.totalActiveMillis,
            });
            if (window.__cheezashaActionDebug.length > 30) window.__cheezashaActionDebug.shift();

            this.local.lastActionCreatedAt = action.createdAt;
            this.local.lastActionUpdatedAt = updatedMs;
        }

        this.local.actionCount++;

        for (const entry of skills) {
            const hrid = entry?.skillHrid;
            if (!hrid || hrid === TOTAL_LEVEL_HRID) continue;

            if (!(hrid in this.local.baseline)) {
                // First time seeing this skill this run — nothing gained yet, just anchor it.
                this.local.baseline[hrid] = entry.experience;
                continue;
            }

            const gained = entry.experience - this.local.baseline[hrid];
            if (gained > 0) this.local.xpGains[hrid] = gained;
        }

        this._notify();
    }

    /**
     * @param {Object} data - loot_log_updated message payload
     */
    _onLootLogUpdated(data) {
        const lootLog = data?.lootLog;
        if (!Array.isArray(lootLog)) return;

        // The server aggregates the entire current labyrinth run into a single entry tagged
        // with a non-zero labyrinthStartedAt. The log can contain entries from past runs too,
        // so pick the most recent one (highest labyrinthStartedAt) rather than the first match
        // — otherwise a stale run's entry could be recalibrated against by mistake.
        const entry = lootLog
            .filter((e) => e?.labyrinthStartedAt && e.labyrinthStartedAt !== ZERO_TIME)
            .reduce((latest, e) => (!latest || e.labyrinthStartedAt > latest.labyrinthStartedAt ? e : latest), null);
        if (!entry) return;

        // TEMPORARY diagnostic — remove once the "won't recalibrate down" bug is confirmed
        // fixed. Run copy(JSON.stringify(window.__cheezashaLootLogDebug, null, 2)) after
        // reproducing, then paste.
        window.__cheezashaLootLogDebug = {
            entry,
            localBefore: this.local ? { ...this.local } : null,
        };

        if (!this.local) {
            // No local run in progress (e.g. tracker just initialized) — adopt the server
            // snapshot directly as the starting point for local live tracking.
            this._adoptServerEntry(entry);
        } else if (this.local.serverStartedAt && entry.labyrinthStartedAt !== this.local.serverStartedAt) {
            // The server confirms this is a genuinely different run than the one we've been
            // tracking locally (its own authoritative signal, not a guess) — start over from
            // this snapshot instead of merging it into stale data from the previous run.
            this._adoptServerEntry(entry);
        } else {
            // Same run — correct any drift in the live local tracker and keep counting from
            // here, so XP gained after this point via the fast local path still shows up.
            this._recalibrateFromServer(entry);
        }
        this._notify();
    }

    /**
     * Replace local entirely with a fresh run seeded directly from a server snapshot.
     * @param {Object} entry - loot log entry for the run to adopt
     * @private
     */
    _adoptServerEntry(entry) {
        const currentSkills = dataManager.characterSkills || [];
        const currentExpByHrid = {};
        for (const skill of currentSkills) {
            if (skill?.skillHrid) currentExpByHrid[skill.skillHrid] = skill.experience || 0;
        }

        const baseline = {};
        const xpGains = {};
        for (const [hrid, gainedXp] of Object.entries(entry.xpGains || {})) {
            if (hrid === TOTAL_LEVEL_HRID) continue;
            const currentExp = currentExpByHrid[hrid];
            if (currentExp == null) continue;
            baseline[hrid] = currentExp - gainedXp;
            xpGains[hrid] = gainedXp;
        }

        this.local = {
            isActive: true,
            startedAt: Date.now(),
            serverStartedAt: entry.labyrinthStartedAt,
            baseline,
            xpGains,
            actionCount: entry.actionCount || 0,
            totalActiveMillis: entry.totalActiveMillis || 0,
            lastActionCreatedAt: null,
            lastActionUpdatedAt: 0,
        };
    }

    /**
     * Correct the live local tracker's running totals using an authoritative server snapshot,
     * without losing the ability to keep accumulating locally afterward.
     * @param {Object} entry - matching loot log entry for the current run
     * @private
     */
    _recalibrateFromServer(entry) {
        const currentSkills = dataManager.characterSkills || [];
        const currentExpByHrid = {};
        for (const skill of currentSkills) {
            if (skill?.skillHrid) currentExpByHrid[skill.skillHrid] = skill.experience || 0;
        }

        // Rebuild xpGains entirely from the server snapshot rather than merging into whatever
        // local had accumulated — the loot log is the authoritative source, so any stale/extra
        // hrid local picked up (e.g. from a bug or a background action briefly misattributed)
        // must not survive a recalibration.
        const newXpGains = {};
        for (const [hrid, gainedXp] of Object.entries(entry.xpGains || {})) {
            if (hrid === TOTAL_LEVEL_HRID) continue;
            const currentExp = currentExpByHrid[hrid];
            if (currentExp == null) continue;
            // Re-anchor the baseline so gainedXp-so-far matches the server exactly, while
            // future action_completed diffs against it continue to add on top correctly.
            this.local.baseline[hrid] = currentExp - gainedXp;
            newXpGains[hrid] = gainedXp;
        }
        this.local.xpGains = newXpGains;
        this.local.serverStartedAt = entry.labyrinthStartedAt;

        // Trust the server's counts outright rather than taking the larger of the two — our
        // local duration estimate can drift (e.g. failed/timed-out actions still ticking time
        // that the server doesn't count), so max() would never let the server correct it back
        // down; the loot log is always the best available source of truth.
        this.local.actionCount = entry.actionCount || 0;
        this.local.totalActiveMillis = entry.totalActiveMillis || 0;
    }

    /**
     * @param {Function} cb
     */
    onUpdate(cb) {
        if (!this.listeners.includes(cb)) this.listeners.push(cb);
    }

    /**
     * @param {Function} cb
     */
    offUpdate(cb) {
        this.listeners = this.listeners.filter((l) => l !== cb);
    }

    _notify() {
        this._persist();
        for (const cb of this.listeners) {
            try {
                cb();
            } catch (error) {
                console.error('[LabyrinthXpTracker] Listener error:', error);
            }
        }
    }

    /**
     * Persist the current run snapshot (debounced) so it survives a page refresh mid-run.
     * @private
     */
    _persist() {
        if (!this.isInitialized) return;
        storage.set(getStorageKey(), this.local, STORE_NAME);
    }

    /**
     * @returns {{xpGains: Object, totalActiveMillis: number, startedAt: string, actionCount: number}|null}
     */
    getCurrentRunStats() {
        if (!this.local) return null;

        return {
            xpGains: this.local.xpGains,
            totalActiveMillis: this.local.totalActiveMillis,
            startedAt: new Date(this.local.startedAt).toISOString(),
            actionCount: this.local.actionCount,
        };
    }
}

const labyrinthXpTracker = new LabyrinthXpTracker();
export default labyrinthXpTracker;

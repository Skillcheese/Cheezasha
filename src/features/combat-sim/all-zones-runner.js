/**
 * All Zones Combat Simulator Runner
 * Uses a dedicated coordinator worker (multiWorker) that spawns child simulation workers.
 *
 * Worker-spawned workers get different CPU scheduling from the browser than
 * main-thread-spawned workers, matching Shykai's architecture for better
 * multi-zone throughput.
 */

import { buildExtraBuffs } from './combat-sim-runner.js';
import WORKER_SCRIPT from './combat-sim-worker-entry.js?worker';
import MULTI_WORKER_SCRIPT from './multi-worker-entry.js?worker';
import { calculateSimRevenue } from './combat-sim-adapter.js';
import config from '../../core/config.js';

let multiWorker = null;
let multiWorkerBlobURL = null;
let coordinatorHasGameData = null; // gameData reference the coordinator already has cached
let coordinatorHasScript = false;
let activeReject = null;

/**
 * Run simulations for all specified zones in parallel via a coordinator worker.
 *
 * The coordinator worker (and its own internal pool of child sim workers) is kept alive and
 * reused across calls rather than torn down after every run — Ultimate Sim calls this
 * repeatedly (once per iteration) against the same gameData, so reuse avoids re-paying worker
 * boot and gameData clone cost every iteration. gameData/the worker script are only sent when
 * they differ (by identity) from what the coordinator already has cached.
 * @param {Object} params
 * @param {Object} params.gameData - Game data maps from buildGameDataPayload()
 * @param {Array<Object>} params.playerDTOs - Player DTOs from buildAllPlayerDTOs()
 * @param {Array<{zoneHrid: string, difficultyTier: number}>} params.zones - Zones to simulate
 * @param {number} params.hours - Hours to simulate per zone
 * @param {Object} params.communityBuffs - { mooPass, comExp, comDrop }
 * @param {boolean} [params.useEarlyExit] - Skip higher tiers when both XP/hr and profit/hr decline
 * @param {Function} [onProgress] - Called with (percent: 0-100) for overall progress
 * @returns {Promise<Array<Object>>} Array of SimResults, one per zone (same order as input)
 */
export async function runAllZonesSimulation(params, onProgress) {
    const { gameData, playerDTOs, zones, hours, communityBuffs, useEarlyExit } = params;

    if (!zones.length) return [];

    // Cancel any previous run that's still in flight (not a normal, already-resolved reuse)
    if (activeReject) {
        cancelAllZonesSimulation();
    }

    const extraBuffs = buildExtraBuffs(communityBuffs);
    const ONE_HOUR_NS = 3600 * 1e9;
    const simulationTimeLimit = hours * ONE_HOUR_NS;

    const availableCores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
    const maxThreadsSetting = config.getSetting('combatSim_maxThreads') || 0;
    const maxWorkers = maxThreadsSetting > 0 ? Math.min(maxThreadsSetting, availableCores) : availableCores;

    return new Promise((resolve, reject) => {
        // Store reject so cancelAllZonesSimulation can unblock the promise
        activeReject = reject;

        // Reuse the existing coordinator worker if one is still alive; only create a new one
        // (and reset what it's known to have cached) the first time or after a cancel/error.
        if (!multiWorker) {
            const blob = new Blob([MULTI_WORKER_SCRIPT], { type: 'application/javascript' });
            multiWorkerBlobURL = URL.createObjectURL(blob);
            multiWorker = new Worker(multiWorkerBlobURL);
            coordinatorHasGameData = null;
            coordinatorHasScript = false;
        }
        const worker = multiWorker;

        const cleanup = () => {
            activeReject = null;
        };

        const teardown = () => {
            worker.terminate();
            if (multiWorker === worker) {
                multiWorker = null;
                if (multiWorkerBlobURL) {
                    URL.revokeObjectURL(multiWorkerBlobURL);
                    multiWorkerBlobURL = null;
                }
            }
            cleanup();
        };

        // Per-zone tier metrics for early exit comparison: zoneHrid → [{xpPerHour, profitPerHour}]
        const tierResultsByZone = new Map();

        worker.onmessage = (event) => {
            const msg = event.data;

            if (msg.type === 'progress') {
                if (onProgress) onProgress(Math.round(msg.progress));
            } else if (msg.type === 'zone_tier_result') {
                // Calculate XP/hr and profit/hr for this tier and decide whether to skip the next
                const { zoneHrid, simResult } = msg;
                const simHours = (simResult.simulatedTime || 0) / (3600 * 1e9) || hours;

                // Sum XP across all players and all skills
                let totalXP = 0;
                for (const playerXP of Object.values(simResult.experienceGained || {})) {
                    for (const xp of Object.values(playerXP)) {
                        totalXP += xp;
                    }
                }
                const xpPerHour = totalXP / simHours;

                let profitPerHour = 0;
                try {
                    const revenue = calculateSimRevenue(simResult, gameData, 'player1', simHours);
                    profitPerHour = revenue.netPerHour;
                } catch {
                    // Revenue calculation may fail if market data is unavailable
                }

                const prevResults = tierResultsByZone.get(zoneHrid) || [];
                const currMetrics = { xpPerHour, profitPerHour };

                let skip = false;
                if (prevResults.length > 0) {
                    const prev = prevResults[prevResults.length - 1];
                    if (xpPerHour < prev.xpPerHour && profitPerHour < prev.profitPerHour) {
                        skip = true;
                    }
                }

                prevResults.push(currMetrics);
                tierResultsByZone.set(zoneHrid, prevResults);

                worker.postMessage({ type: 'zone_tier_decision', zoneHrid, skip });
            } else if (msg.type === 'all_zones_result') {
                // Success — leave the coordinator (and its child worker pool) running so the
                // next call (e.g. the next Ultimate Sim iteration) can reuse it.
                cleanup();
                if (onProgress) onProgress(100);
                resolve(msg.results);
            } else if (msg.type === 'error') {
                // The coordinator may be in a bad state after an error — don't reuse it.
                teardown();
                reject(new Error(msg.error));
            }
        };

        worker.onerror = (error) => {
            teardown();
            reject(new Error(error.message || 'MultiWorker error'));
        };

        // Only send the worker script / gameData when the coordinator doesn't already have them
        // cached (identity check — both are stable references reused across an entire run).
        const message = {
            type: 'start_all_zones',
            playerDTOs,
            zones,
            simulationTimeLimit,
            extraBuffs,
            maxWorkers,
            useEarlyExit: !!useEarlyExit,
        };
        if (!coordinatorHasScript) {
            message.workerScript = WORKER_SCRIPT;
            coordinatorHasScript = true;
        }
        if (coordinatorHasGameData !== gameData) {
            message.gameData = gameData;
            coordinatorHasGameData = gameData;
        }
        worker.postMessage(message);
    });
}

/**
 * Terminate the coordinator worker (kills all child workers too) and reject the pending promise.
 */
export function cancelAllZonesSimulation() {
    if (multiWorker) {
        multiWorker.terminate();
        multiWorker = null;
    }
    if (multiWorkerBlobURL) {
        URL.revokeObjectURL(multiWorkerBlobURL);
        multiWorkerBlobURL = null;
    }
    coordinatorHasGameData = null;
    coordinatorHasScript = false;
    if (activeReject) {
        activeReject(new Error('Cancelled'));
        activeReject = null;
    }
}

/**
 * Multi-Worker Entry for All-Zones Simulation
 *
 * This file is bundled into a string and runs inside a Worker (the "coordinator").
 * It receives all zones to simulate and processes them via a task queue against a
 * persistent pool of child simulation workers. Child workers are spawned from a Blob URL
 * created from the simulation worker script passed in the init message.
 *
 * This matches Shykai's architecture: worker-spawned workers get different
 * CPU scheduling from the browser than main-thread-spawned workers.
 *
 * The coordinator itself is also kept alive and reused across multiple 'start_all_zones'
 * calls (see all-zones-runner.js) rather than being torn down after each one — Ultimate Sim
 * runs this same all-zones pass repeatedly (once per iteration) against the same gameData, so
 * reusing both the coordinator and its child worker pool avoids re-paying worker boot and
 * gameData clone cost on every iteration. gameData and the worker script are only included in
 * a message when they differ from what's already cached (by object identity), both here and at
 * the child-worker level.
 *
 * When useEarlyExit is true, only T0 is seeded per zone initially. After each tier
 * completes, a zone_tier_result message is sent to the main thread. The main thread
 * compares XP/hr and profit/hr and responds with zone_tier_decision { skip }. If skip
 * is false, the next tier is enqueued; if true, remaining tiers for that zone are skipped.
 */

let simWorkerBlobURL = null;
let cachedWorkerScript = null;
let cachedGameData = null;
let taskIdCounter = 0;

// Persistent child worker pool, reused across tasks within a run and across separate
// 'start_all_zones' calls on this same coordinator instance. Grows as needed, never shrinks.
const childPool = []; // { worker, busy, lastGameData, onProgress }

// Pending early-exit decisions: zoneHrid → resolve function
const pendingDecisions = new Map();

/**
 * Get or create the Blob URL for child simulation workers, from the cached worker script.
 * @returns {string}
 */
function ensureWorkerURL() {
    if (!simWorkerBlobURL) {
        const blob = new Blob([cachedWorkerScript], { type: 'application/javascript' });
        simWorkerBlobURL = URL.createObjectURL(blob);
    }
    return simWorkerBlobURL;
}

/**
 * Get an idle pooled child worker, creating a new one if none are idle.
 * @param {string} workerURL
 * @returns {{worker: Worker, busy: boolean, lastGameData: Object|null, onProgress: Function|null}}
 */
function getIdleChild(workerURL) {
    const idle = childPool.find((s) => !s.busy);
    if (idle) return idle;
    const slot = { worker: new Worker(workerURL), busy: false, lastGameData: null, onProgress: null };
    childPool.push(slot);
    return slot;
}

/**
 * Run one simulation task on a pooled child worker slot, posting gameData only when it differs
 * from what that worker already has cached.
 * @param {Object} slot
 * @param {Object} message - start_simulation message (including gameData)
 * @returns {Promise<Object>} simResult
 */
function runTaskOnChild(slot, message) {
    return new Promise((resolve, reject) => {
        slot.busy = true;

        slot.worker.onmessage = (event) => {
            const msg = event.data;
            if (msg.taskId !== message.taskId) return;

            if (msg.type === 'progress') {
                if (slot.onProgress) slot.onProgress(msg.progress);
            } else if (msg.type === 'result') {
                slot.busy = false;
                resolve(msg.simResult);
            } else if (msg.type === 'error') {
                slot.busy = false;
                reject(new Error(msg.error));
            }
        };

        slot.worker.onerror = (error) => {
            slot.busy = false;
            reject(new Error(error.message || 'Worker error'));
        };

        let payload = message;
        if (slot.lastGameData === message.gameData) {
            const { gameData: _omit, ...rest } = message;
            payload = rest;
        } else {
            slot.lastGameData = message.gameData;
        }
        slot.worker.postMessage(payload);
    });
}

onmessage = async function (event) {
    const { type } = event.data;

    if (type === 'start_all_zones') {
        const { workerScript, gameData, playerDTOs, zones, simulationTimeLimit, extraBuffs, maxWorkers, useEarlyExit } =
            event.data;

        if (workerScript) cachedWorkerScript = workerScript;
        if (gameData) cachedGameData = gameData;
        const effectiveGameData = gameData || cachedGameData;
        const workerURL = ensureWorkerURL();

        const results = new Array(zones.length);

        // Per-zone progress tracking
        const zoneProgress = new Array(zones.length).fill(0);
        const reportProgress = () => {
            const total = zoneProgress.reduce((sum, p) => sum + p, 0);
            postMessage({ type: 'progress', progress: total / zones.length });
        };

        // zoneInfoMap groups tiers by zone for early exit tracking
        const zoneInfoMap = new Map(); // zoneHrid → { tiers: [{tier, index}], nextIdx }

        // Build initial task queue
        let taskQueue;
        if (useEarlyExit) {
            // Group zones by hrid, sort tiers ascending within each group
            for (let i = 0; i < zones.length; i++) {
                const { zoneHrid, difficultyTier } = zones[i];
                if (!zoneInfoMap.has(zoneHrid)) {
                    zoneInfoMap.set(zoneHrid, { tiers: [], nextIdx: 0 });
                }
                zoneInfoMap.get(zoneHrid).tiers.push({ tier: difficultyTier, index: i });
            }
            for (const info of zoneInfoMap.values()) {
                info.tiers.sort((a, b) => a.tier - b.tier);
            }

            // Seed only the first (lowest) tier per zone
            taskQueue = [];
            for (const [zoneHrid, info] of zoneInfoMap) {
                const first = info.tiers[0];
                taskQueue.push({ zoneHrid, difficultyTier: first.tier, index: first.index });
                info.nextIdx = 1;
            }
        } else {
            taskQueue = [...zones.map((zone, index) => ({ ...zone, index }))];
        }

        const poolSize = Math.min(maxWorkers, taskQueue.length || 1);
        // Grow the persistent pool up to this run's concurrency need; never shrink it back down.
        while (childPool.length < poolSize) {
            childPool.push({ worker: new Worker(workerURL), busy: false, lastGameData: null, onProgress: null });
        }

        const processQueue = async () => {
            while (taskQueue.length > 0) {
                const task = taskQueue.shift();
                if (!task) continue;
                const taskId = ++taskIdCounter;

                const slot = getIdleChild(workerURL);
                slot.onProgress = (p) => {
                    zoneProgress[task.index] = p;
                    reportProgress();
                };

                let simResult = null;
                try {
                    simResult = await runTaskOnChild(slot, {
                        type: 'start_simulation',
                        taskId,
                        gameData: effectiveGameData,
                        playerDTOs,
                        zoneHrid: task.zoneHrid,
                        difficultyTier: task.difficultyTier,
                        simulationTimeLimit,
                        extraBuffs,
                    });
                } catch (error) {
                    console.error(`[MultiWorker] Zone ${task.zoneHrid} T${task.difficultyTier} failed:`, error);
                }

                results[task.index] = simResult;
                zoneProgress[task.index] = 100;
                reportProgress();

                // Early exit: send tier result to main thread and await go/skip decision
                if (useEarlyExit && simResult) {
                    const zoneInfo = zoneInfoMap.get(task.zoneHrid);
                    if (zoneInfo && zoneInfo.nextIdx < zoneInfo.tiers.length) {
                        postMessage({
                            type: 'zone_tier_result',
                            zoneHrid: task.zoneHrid,
                            tier: task.difficultyTier,
                            index: task.index,
                            simResult,
                        });

                        const skip = await new Promise((resolve) => {
                            pendingDecisions.set(task.zoneHrid, resolve);
                        });

                        if (skip) {
                            // Mark remaining tiers for this zone as skipped (null result)
                            for (let i = zoneInfo.nextIdx; i < zoneInfo.tiers.length; i++) {
                                results[zoneInfo.tiers[i].index] = null;
                                zoneProgress[zoneInfo.tiers[i].index] = 100;
                            }
                            zoneInfo.nextIdx = zoneInfo.tiers.length;
                            reportProgress();
                        } else {
                            // Enqueue the next tier
                            const next = zoneInfo.tiers[zoneInfo.nextIdx];
                            zoneInfo.nextIdx++;
                            taskQueue.push({
                                zoneHrid: task.zoneHrid,
                                difficultyTier: next.tier,
                                index: next.index,
                            });
                        }
                    }
                }
            }
        };

        try {
            await Promise.all(
                Array(poolSize)
                    .fill()
                    .map(() => processQueue())
            );
            postMessage({ type: 'all_zones_result', results });
        } catch (error) {
            postMessage({ type: 'error', error: error.message || String(error) });
        }

        // Deliberately no cleanup here: the child pool and blob URL persist so the next
        // start_all_zones message (e.g. the next Ultimate Sim iteration) can reuse them.
    } else if (type === 'zone_tier_decision') {
        // Main thread responded to an early-exit zone_tier_result
        const { zoneHrid, skip } = event.data;
        const resolve = pendingDecisions.get(zoneHrid);
        if (resolve) {
            pendingDecisions.delete(zoneHrid);
            resolve(skip);
        }
    }
};

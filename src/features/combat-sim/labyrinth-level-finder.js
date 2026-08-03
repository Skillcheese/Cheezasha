/**
 * Labyrinth Level Finder
 * Binary search to find the highest beatable roomLevel at a given win-rate threshold.
 */

import { runLabyrinthSimulation, cancelSimulation, getMaxBatchWorkers } from './combat-sim-runner.js';

const DEFAULT_MIN_LEVEL = 20;
const DEFAULT_MAX_LEVEL = 300;
const DEFAULT_THRESHOLD = 0.95; // 95% win rate
const DEFAULT_SIM_HOURS = 2; // 2 hours per level gives ~50-100+ encounters depending on fight time

/**
 * Find the highest room level where win rate >= threshold.
 *
 * @param {Object} params
 * @param {Object} params.gameData - Game data payload
 * @param {Array<Object>} params.playerDTOs - Player DTOs
 * @param {string} params.zoneHrid - Zone HRID for SimResult context
 * @param {string} params.monsterHrid - Labyrinth monster HRID
 * @param {string[]} params.crates - Crate item HRIDs
 * @param {Object} params.communityBuffs - Community buff config
 * @param {number} [params.threshold=0.95] - Win rate threshold (0-1)
 * @param {number} [params.minLevel=20] - Minimum room level to search
 * @param {number} [params.maxLevel=300] - Maximum room level to search
 * @param {number} [params.simHours=2] - Hours to simulate per level
 * @param {Function} [onProgress] - Progress callback ({ level, winRate, step, totalSteps })
 * @returns {Promise<Object>} { maxLevel, winRate, attempts, encounters }
 */
export async function findMaxLabyrinthLevel(params, onProgress) {
    const {
        gameData,
        playerDTOs,
        zoneHrid,
        monsterHrid,
        crates,
        communityBuffs,
        labyrinthCombatBuffs,
        threshold = DEFAULT_THRESHOLD,
        minLevel = DEFAULT_MIN_LEVEL,
        maxLevel = DEFAULT_MAX_LEVEL,
        simHours = DEFAULT_SIM_HOURS,
    } = params;

    let low = minLevel;
    let high = maxLevel;
    let bestLevel = 0;
    let bestWinRate = 0;
    let step = 0;
    const totalSteps = Math.ceil(Math.log2(maxLevel - minLevel + 1)) + 1;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        step++;

        const simResult = await runLabyrinthSimulation({
            gameData,
            playerDTOs,
            zoneHrid,
            monsterHrid,
            roomLevel: mid,
            crates,
            hours: simHours,
            communityBuffs,
            labyrinthCombatBuffs,
        });

        const attempts = simResult.labyAttemptCount || 1;
        const encounters = simResult.encounters || 0;
        const winRate = encounters / attempts;

        if (onProgress) {
            onProgress({ level: mid, winRate, step, totalSteps, encounters, attempts });
        }

        if (winRate >= threshold) {
            bestLevel = mid;
            bestWinRate = winRate;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    return {
        maxLevel: bestLevel,
        winRate: bestWinRate,
        steps: step,
    };
}

/**
 * Run labyrinth sim for all monsters at a range of room levels.
 * Used for the "All Labyrinths" table view.
 *
 * @param {Object} params
 * @param {Object} params.gameData - Game data payload
 * @param {Array<Object>} params.playerDTOs - Player DTOs
 * @param {string} params.zoneHrid - Zone HRID for SimResult context
 * @param {string[]} params.crates - Crate item HRIDs
 * @param {Object} params.communityBuffs - Community buff config
 * @param {number} [params.simHours=1] - Hours to simulate per level
 * @param {number} [params.startLevel=40] - Starting room level
 * @param {number} [params.endLevel=220] - Ending room level
 * @param {number} [params.stepSize=20] - Room level step size
 * @param {Function} [onProgress] - Progress callback ({ monsterHrid, roomLevel, winRate, done, total })
 * @returns {Promise<Array<Object>>} Array of { monsterHrid, roomLevel, winRate, encounters, attempts }
 */
export async function runAllLabyrinths(params, onProgress) {
    const {
        gameData,
        playerDTOs,
        zoneHrid,
        crates,
        communityBuffs,
        simHours = 1,
        startLevel = 40,
        endLevel = 220,
        stepSize = 20,
    } = params;

    // Get all labyrinth monsters
    const combatMonsterDetailMap = gameData.combatMonsterDetailMap;
    const labyrinthMonsters = Object.values(combatMonsterDetailMap)
        .filter((m) => m.isLabyrinthMonster === true)
        .map((m) => m.hrid);

    const levels = [];
    for (let level = startLevel; level <= endLevel; level += stepSize) {
        levels.push(level);
    }

    // Every (monster, level) pair is an independent sim, so fan them out across the worker pool
    // instead of running them one at a time.
    const tasks = [];
    for (const monsterHrid of labyrinthMonsters) {
        for (const roomLevel of levels) {
            tasks.push({ monsterHrid, roomLevel });
        }
    }

    const total = tasks.length;
    let done = 0;
    const results = new Array(tasks.length);

    let cursor = 0;
    const workerCount = Math.max(1, Math.min(getMaxBatchWorkers(), tasks.length));
    await Promise.all(
        Array.from({ length: workerCount }, async () => {
            while (cursor < tasks.length) {
                const index = cursor++;
                const { monsterHrid, roomLevel } = tasks[index];

                const simResult = await runLabyrinthSimulation({
                    gameData,
                    playerDTOs,
                    zoneHrid,
                    monsterHrid,
                    roomLevel,
                    crates,
                    hours: simHours,
                    communityBuffs,
                });

                const attempts = simResult.labyAttemptCount || 1;
                const encounters = simResult.encounters || 0;
                const winRate = encounters / attempts;

                results[index] = { monsterHrid, roomLevel, winRate, encounters, attempts };
                done++;

                if (onProgress) {
                    onProgress({ monsterHrid, roomLevel, winRate, done, total });
                }
            }
        })
    );

    return results;
}

export { cancelSimulation };

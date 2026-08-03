/**
 * Ultimate Sim Runner
 * Headless (DOM-free) loop that repeatedly: optimizes food for the current zone, optimizes
 * coffee for the current zone, simulates all zones with that food/coffee loadout, and moves to
 * whichever zone comes out best — until the best zone stops changing or a repeat is detected.
 */

import {
    buildGameDataPayload,
    buildAllPlayerDTOs,
    getCombatZones,
    getCommunityBuffs,
    calculateSimRevenue,
} from './combat-sim-adapter.js';
import { buildExtraBuffs } from './combat-sim-runner.js';
import { runAllZonesSimulation } from './all-zones-runner.js';
import { applyLiveSelfOverrides } from '../../utils/loadout-scraper.js';
import { getGlobalBestProfitPerHour } from '../../utils/tea-optimizer.js';
import { runFoodOptimization, rankFoodResults, buildFoodDTO } from './optimize-food-core.js';
import { runCoffeeOptimization } from './optimize-coffee-core.js';

const ONE_HOUR_NS = 3600 * 1e9;
const MAX_DRINK_SLOTS = 3;

/**
 * Score a set of all-zones sim results. Always computes XP/hr, Profit/hr, and Eff. XP/hr (the
 * Optimize Coffee opportunity-cost formula) so the UI can display and sort by any of them; `score`
 * is whichever of those the requested metric points at, and is what "best zone" is chosen by.
 * @param {Array<{zone: Object, simResult: Object}>} entries
 * @param {Object} gameData
 * @param {string} playerHrid
 * @param {number} hours
 * @param {'xp'|'profit'|'mixed'} metric
 * @returns {Array<Object>} entries with xpPerHour/profitPerHour/effXpPerHour/score, sorted best-first
 */
function scoreZoneEntries(entries, gameData, playerHrid, hours, metric) {
    const profitAnchor = getGlobalBestProfitPerHour();

    const scored = entries.map(({ zone, simResult }) => {
        const simHours = (simResult.simulatedTime || 0) / ONE_HOUR_NS || hours;
        const xpMap = simResult.experienceGained?.[playerHrid] || {};
        const xpPerHour = Object.values(xpMap).reduce((s, v) => s + v, 0) / simHours;

        let profitPerHour = 0;
        try {
            profitPerHour = calculateSimRevenue(simResult, gameData, playerHrid, simHours).netPerHour;
        } catch {
            // Revenue may not be available for this zone
        }

        const effXpPerHour =
            profitPerHour >= 0 || profitAnchor <= 0
                ? xpPerHour
                : xpPerHour / (1 + Math.abs(profitPerHour) / profitAnchor);

        const score = metric === 'profit' ? profitPerHour : metric === 'mixed' ? effXpPerHour : xpPerHour;

        return { zone, xpPerHour, profitPerHour, effXpPerHour, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored;
}

/**
 * Build the (zoneHrid, difficultyTier) list for every combat zone and every tier it supports.
 * @returns {Array<{zoneHrid: string, difficultyTier: number, name: string, isDungeon: boolean, maxSpawnCount: number}>}
 */
function buildAllZoneTiers() {
    const zones = getCombatZones();
    const list = [];
    for (const zone of zones) {
        for (let t = 0; t <= zone.maxDifficulty; t++) {
            list.push({
                zoneHrid: zone.hrid,
                difficultyTier: t,
                name: zone.name,
                isDungeon: zone.isDungeon,
                maxSpawnCount: zone.maxSpawnCount,
            });
        }
    }
    return list;
}

/**
 * Run the Ultimate Sim loop.
 * @param {Object} params
 * @param {string} params.startZoneHrid
 * @param {number} params.startTier
 * @param {number} params.foodHours - Test hours per food combo
 * @param {number} params.coffeeHours - Test hours per coffee combo
 * @param {number} params.allZonesHours - Sim hours per zone/tier in the all-zones pass
 * @param {'xp'|'profit'|'mixed'} params.metric - What "best zone" means
 * @param {number} [params.maxIterations]
 * @param {boolean} [params.excludeDungeons] - Restrict all-zones pass to non-dungeons (max 3 players)
 * @param {boolean} [params.includeZones] - Include group zones (maxSpawnCount > 1) in the all-zones pass
 * @param {boolean} [params.includeSoloMobs] - Include individual-monster encounters (maxSpawnCount === 1)
 * @param {Function} [params.onProgress] - ({iteration, phase, zoneHrid, difficultyTier, percent}) => void
 * @param {Function} [params.isAborted] - () => boolean
 * @param {Array<Object>} [params.playerDTOs] - Pre-built player DTOs (e.g. from an edited loadout). If
 *   omitted, DTOs are built from live game state instead.
 * @param {string} [params.selfHrid] - Required alongside params.playerDTOs.
 * @returns {Promise<{converged: boolean, reason: string, history: Array<Object>, finalZone: Object|null}>}
 */
export async function runUltimateSim(params) {
    const {
        startZoneHrid,
        startTier,
        foodHours,
        coffeeHours,
        allZonesHours,
        metric = 'mixed',
        maxIterations = 10,
        excludeDungeons = false,
        includeZones = true,
        includeSoloMobs = true,
        onProgress = () => {},
        isAborted = () => false,
    } = params;

    const gameData = buildGameDataPayload();
    if (!gameData) throw new Error('No game data available.');

    let playerDTOs;
    let selfHrid;
    if (params.playerDTOs) {
        playerDTOs = [...params.playerDTOs];
        selfHrid = params.selfHrid;
    } else {
        const result = await buildAllPlayerDTOs();
        playerDTOs = result.players;
        selfHrid = result.selfHrid;
    }
    if (!playerDTOs.length) throw new Error('No character data available.');

    const selfIndex = playerDTOs.findIndex((p) => p.hrid === selfHrid || p === playerDTOs[0]);
    const baseIndex = selfIndex >= 0 ? selfIndex : 0;
    if (!params.playerDTOs) applyLiveSelfOverrides(playerDTOs[baseIndex]);

    // Non-dungeon zones support at most 3 players; drop dungeons from the all-zones pool if the
    // party is too large for them to be simulated honestly, rather than fail the whole run.
    const partyTooLargeForDungeons = playerDTOs.length > 3;
    const zoneTiers = buildAllZoneTiers().filter((z) => {
        if (z.isDungeon && partyTooLargeForDungeons) return false;
        if (excludeDungeons && z.isDungeon) return false;
        if (z.maxSpawnCount > 1 && !includeZones) return false;
        if (z.maxSpawnCount === 1 && !includeSoloMobs) return false;
        return true;
    });
    if (!zoneTiers.length) throw new Error('No zones match the selected filters.');
    let currentZone = startZoneHrid;
    let currentTier = startTier;
    const visited = new Set();
    const history = [];

    for (let iteration = 0; iteration < maxIterations; iteration++) {
        if (isAborted()) return { converged: false, reason: 'aborted', history, finalZone: null };

        const communityBuffs = getCommunityBuffs();
        const extraBuffs = buildExtraBuffs(communityBuffs, playerDTOs[0]?.guildCombatBuffs);

        onProgress({ iteration, phase: 'food', zoneHrid: currentZone, difficultyTier: currentTier });
        const foodResult = await runFoodOptimization({
            gameData,
            playerDTOs,
            baseIndex,
            zoneHrid: currentZone,
            difficultyTier: currentTier,
            hours: foodHours,
            extraBuffs,
            selfHrid,
            isAborted,
            onProgress: ({ phase: subPhase, ...p }) =>
                onProgress({
                    iteration,
                    phase: 'food',
                    subPhase,
                    zoneHrid: currentZone,
                    difficultyTier: currentTier,
                    ...p,
                }),
        });
        if (isAborted()) return { converged: false, reason: 'aborted', history, finalZone: null };

        const bestFood = rankFoodResults(foodResult.refined, 1)[0] || null;
        const topFoods = rankFoodResults(foodResult.refined, 5);
        const foodDTO = bestFood
            ? buildFoodDTO(bestFood.combo, bestFood.slotTriggers || bestFood.combo.map(() => null))
            : [null, null, null];
        playerDTOs[baseIndex] = { ...playerDTOs[baseIndex], food: foodDTO };

        onProgress({ iteration, phase: 'coffee', zoneHrid: currentZone, difficultyTier: currentTier });
        const coffeeResults = await runCoffeeOptimization({
            gameData,
            playerDTOs,
            baseIndex,
            zoneHrid: currentZone,
            difficultyTier: currentTier,
            hours: coffeeHours,
            extraBuffs,
            selfHrid,
            isAborted,
            onProgress: (p) =>
                onProgress({
                    iteration,
                    phase: 'coffee',
                    zoneHrid: currentZone,
                    difficultyTier: currentTier,
                    ...p,
                }),
        });
        if (isAborted()) return { converged: false, reason: 'aborted', history, finalZone: null };

        const scoreKey = metric === 'profit' ? 'profitPerHour' : metric === 'xp' ? 'xpPerHour' : 'mixedScore';
        for (const r of coffeeResults) r.score = r[scoreKey];
        const rankedCoffees = [...coffeeResults].sort((a, b) => b[scoreKey] - a[scoreKey]);
        const bestCoffee = rankedCoffees[0] || null;
        const topCoffees = rankedCoffees.slice(0, 5);
        const drinksDTO = [];
        for (let s = 0; s < MAX_DRINK_SLOTS; s++) {
            drinksDTO.push(bestCoffee?.combo[s] ? { hrid: bestCoffee.combo[s].hrid, triggers: [] } : null);
        }
        playerDTOs[baseIndex] = { ...playerDTOs[baseIndex], drinks: drinksDTO };

        onProgress({ iteration, phase: 'zones', zoneHrid: currentZone, difficultyTier: currentTier, percent: 0 });
        const simZones = zoneTiers.map((z) => ({ zoneHrid: z.zoneHrid, difficultyTier: z.difficultyTier }));
        const simResults = await runAllZonesSimulation(
            { gameData, playerDTOs, zones: simZones, hours: allZonesHours, communityBuffs, useEarlyExit: true },
            (percent) =>
                onProgress({ iteration, phase: 'zones', zoneHrid: currentZone, difficultyTier: currentTier, percent })
        );
        if (isAborted()) return { converged: false, reason: 'aborted', history, finalZone: null };

        const entries = simResults
            .map((simResult, i) => ({ zone: zoneTiers[i], simResult }))
            .filter((e) => e.simResult);
        const scored = scoreZoneEntries(entries, gameData, selfHrid, allZonesHours, metric);
        const best = scored[0];
        if (!best) return { converged: false, reason: 'no_results', history, finalZone: null };

        const key = `${currentZone}|${currentTier}`;
        const bestKey = `${best.zone.zoneHrid}|${best.zone.difficultyTier}`;

        history.push({
            iteration,
            zoneHrid: currentZone,
            difficultyTier: currentTier,
            food: bestFood,
            topFoods,
            coffee: bestCoffee,
            topCoffees,
            bestZone: best,
            topZones: scored.slice(0, 5),
        });

        if (bestKey === key) {
            return { converged: true, reason: 'stable', history, finalZone: best };
        }
        if (visited.has(bestKey)) {
            return { converged: true, reason: 'repeat', history, finalZone: best };
        }

        visited.add(key);
        currentZone = best.zone.zoneHrid;
        currentTier = best.zone.difficultyTier;
    }

    return {
        converged: false,
        reason: 'max_iterations',
        history,
        finalZone: history[history.length - 1]?.bestZone || null,
    };
}

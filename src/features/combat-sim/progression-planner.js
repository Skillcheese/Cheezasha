/**
 * Progression Planner
 *
 * Ties saved fictional gear Builds (sim-builds.js) to the brew-vs-combat climb model
 * (brew-vs-combat-planner.js): for a set of gear stages (your current gear plus a run
 * of saved Builds), find each stage's best zone by simulating it across every combat
 * zone, then feed the resulting {cost, goldPerHr, xpPerHr} stages into planProgression.
 *
 * `buildStagesFromResults` is pure and covers the tricky part (ordering stages cheapest
 * to priciest and pricing only the items you don't already own at each step) — fully
 * unit-testable without a live sim. `findBestZoneForDTO` / `runProgressionZoneSearch`
 * drive the actual Web Worker combat simulation and can only run inside the userscript.
 */

import { runAllZonesSimulation } from './all-zones-runner.js';
import { calculateSimRevenue } from './combat-sim-adapter.js';
import { calculateGearUpgradeCost, estimateEquipmentPrice } from './gear-price.js';

/**
 * Turn a set of already-simulated gear stages into the ordered, incrementally-priced stage
 * list `planProgression`/`simulateClimb` expect.
 *
 * Stages are sorted by their full gear price (cheapest first, current gear always first
 * regardless of price since it's already owned) and each stage's `cost` is computed against
 * the *previous stage in that order* — so an item worn in both stays free, and only the actual
 * upgrade delta is charged.
 *
 * Any extra fields on a build entry (e.g. `bestZone`) pass through unchanged onto its stage,
 * so callers can carry along metadata the pure cost/ordering logic here doesn't need.
 *
 * @param {Object} params
 * @param {{equipment: Object, goldPerHr: number, xpPerHr: number}} params.currentStage - Your
 *   current gear plus its own simulated rates (this stage's cost is always forced to 0 — you
 *   already own it, regardless of what it would cost to buy from scratch).
 * @param {Array<{name: string, equipment: Object, goldPerHr: number, xpPerHr: number, requiredXp?: number}>} params.builds
 *   One entry per saved Build already simulated at its best zone (see runProgressionZoneSearch).
 * @returns {Array<{name: string, cost: number, goldPerHr: number, xpPerHr: number, requiredXp?: number}>}
 */
export function buildStagesFromResults({ currentStage, builds }) {
    const priced = builds
        .map((build) => ({ ...build, _fullPrice: estimateEquipmentPrice(build.equipment).total }))
        .sort((a, b) => a._fullPrice - b._fullPrice);

    const { equipment: currentEquipment, ...currentRest } = currentStage;
    const stages = [{ name: 'Current Gear', ...currentRest, cost: 0, equipment: currentEquipment }];

    let prevEquipment = currentEquipment;
    for (const build of priced) {
        const { total: cost } = calculateGearUpgradeCost(prevEquipment, build.equipment);
        const { _fullPrice, ...rest } = build;
        void _fullPrice;
        stages.push({ ...rest, cost });
        prevEquipment = build.equipment;
    }

    return stages;
}

/**
 * Simulate a single DTO across every given zone and return its best zone by the chosen metric.
 * Runs inside the userscript only (spins up real combat-sim Web Workers).
 * @param {Object} dto - Player DTO to test (equipment/abilities/consumables/skills)
 * @param {Array<{zoneHrid: string, difficultyTier: number, name: string}>} zones
 * @param {Object} gameData - Game data from buildGameDataPayload()
 * @param {Object} [options]
 * @param {number} [options.hours=1] - Simulated hours per zone (short — this is a scan, not a final result)
 * @param {Object} [options.communityBuffs] - { mooPass, comExp, comDrop }
 * @param {'xpPerHr'|'goldPerHr'} [options.rankBy='xpPerHr'] - Which metric picks the "best" zone
 * @param {Function} [onProgress] - Called with (percent: 0-100)
 * @returns {Promise<{zoneHrid: string, difficultyTier: number, name: string, goldPerHr: number, xpPerHr: number}|null>}
 */
export async function findBestZoneForDTO(dto, zones, gameData, options = {}, onProgress) {
    const { hours = 1, communityBuffs = {}, rankBy = 'xpPerHr' } = options;
    if (!zones?.length) return null;

    const playerHrid = dto.hrid || 'player1';
    const simZones = zones.map((z) => ({ zoneHrid: z.zoneHrid, difficultyTier: z.difficultyTier }));
    const simResults = await runAllZonesSimulation(
        { gameData, playerDTOs: [dto], zones: simZones, hours, communityBuffs, useEarlyExit: false },
        onProgress
    );

    let best = null;
    for (let i = 0; i < simResults.length; i++) {
        const simResult = simResults[i];
        if (!simResult) continue;

        const simHours = (simResult.simulatedTime || 0) / (3600 * 1e9) || hours;

        let xpPerHr = 0;
        for (const amount of Object.values(simResult.experienceGained?.[playerHrid] || {})) {
            xpPerHr += amount / simHours;
        }

        let goldPerHr = 0;
        try {
            goldPerHr = calculateSimRevenue(simResult, gameData, playerHrid, simHours).netPerHour;
        } catch (error) {
            console.error('[ProgressionPlanner] Failed to compute revenue for zone', zones[i]?.zoneHrid, error);
        }

        const candidate = { ...zones[i], goldPerHr, xpPerHr };
        if (!best || candidate[rankBy] > best[rankBy]) best = candidate;
    }

    return best;
}

/**
 * Full orchestration: for the current gear and every saved Build, find the best zone, then
 * assemble the incrementally-priced stage list ready for planProgression. Runs inside the
 * userscript only.
 * @param {Object} params
 * @param {Object} params.currentDTO - Your live/current player DTO
 * @param {Array<{name: string, dto: Object}>} params.builds - Saved builds to include, cheapest gear first isn't required — sorting happens internally
 * @param {Array<{zoneHrid: string, difficultyTier: number, name: string}>} params.zones - Zones to scan
 * @param {Object} params.gameData - Game data from buildGameDataPayload()
 * @param {Object} [params.options] - Passed through to findBestZoneForDTO (hours, communityBuffs, rankBy)
 * @param {Function} [onProgress] - Called with (percent: 0-100, label: string) as each build's scan completes
 * @returns {Promise<Array<{name: string, cost: number, goldPerHr: number, xpPerHr: number, bestZone: Object}>>}
 */
export async function runProgressionZoneSearch({ currentDTO, builds, zones, gameData, options = {} }, onProgress) {
    const allEntries = [{ name: 'Current Gear', dto: currentDTO }, ...builds];
    const results = [];

    for (let i = 0; i < allEntries.length; i++) {
        const entry = allEntries[i];
        const bestZone = await findBestZoneForDTO(entry.dto, zones, gameData, options);
        results.push({
            name: entry.name,
            equipment: entry.dto.equipment,
            goldPerHr: bestZone?.goldPerHr || 0,
            xpPerHr: bestZone?.xpPerHr || 0,
            bestZone,
        });
        if (onProgress) onProgress(Math.round(((i + 1) / allEntries.length) * 100), entry.name);
    }

    const [currentStage, ...buildResults] = results;
    return buildStagesFromResults({ currentStage, builds: buildResults });
}

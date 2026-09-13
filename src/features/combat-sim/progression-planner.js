/**
 * Progression Planner
 *
 * Ties saved fictional gear Builds (sim-builds.js) to the multi-skill progression optimizer
 * (progression-optimizer.js): for a set of gear stages (your current gear plus a run of saved
 * Builds), find each stage's best zone — ranked by the SAME gold/XP objective slider the
 * optimizer itself uses, so a gold-leaning slider scans for the best gold/hr zone and an
 * XP-leaning one scans for the best XP/hr zone for that gear — then assemble the resulting
 * {cost, goldPerHr, xpPerHrBySkill, requiredLevels} stages ready for optimizeProgression.
 *
 * `buildStagesFromResults` is pure and covers the tricky part (ordering stages cheapest to
 * priciest and pricing only the items you don't already own at each step) — fully unit-testable
 * without a live sim. `findBestZoneForDTO` / `runProgressionZoneSearch` drive the actual Web
 * Worker combat simulation and can only run inside the userscript.
 */

import { runAllZonesSimulation } from './all-zones-runner.js';
import { calculateSimRevenue } from './combat-sim-adapter.js';
import { calculateGearUpgradeCost, estimateEquipmentPrice } from './gear-price.js';

/**
 * Turn a set of already-simulated gear stages into the ordered, incrementally-priced stage
 * list `optimizeProgression`/`simulateMultiSkillClimb` expect.
 *
 * Stages are sorted by their full gear price (cheapest first, current gear always first
 * regardless of price since it's already owned) and each stage's `cost` is computed against
 * the *previous stage in that order* — so an item worn in both stays free, and only the actual
 * upgrade delta is charged. Gear price order is used as a proxy for "power order" here — it's
 * independent of the gold/XP objective, unlike the per-stage zone choice (see findBestZoneForDTO).
 *
 * Any extra fields on a build entry (e.g. `bestZone`, `requiredLevels`) pass through unchanged
 * onto its stage, so callers can carry along whatever metadata the pure cost/ordering logic
 * here doesn't need.
 *
 * @param {Object} params
 * @param {{equipment: Object, goldPerHr: number, xpPerHrBySkill: Object<string, number>}} params.currentStage
 *   Your current gear plus its own simulated rates (this stage's cost is always forced to 0 —
 *   you already own it, regardless of what it would cost to buy from scratch).
 * @param {Array<{name: string, equipment: Object, goldPerHr: number, xpPerHrBySkill: Object<string, number>, requiredLevels?: Array<{skillHrid: string, level: number}>}>} params.builds
 *   One entry per saved Build already simulated at its best zone (see runProgressionZoneSearch).
 * @returns {Array<{name: string, cost: number, goldPerHr: number, xpPerHrBySkill: Object<string, number>, requiredLevels?: Array<{skillHrid: string, level: number}>}>}
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
 * Extract the highest level requirement per skill across every equipped item in a loadout, from
 * live game data (item level requirements aren't known statically).
 * @param {Object} equipment - dto.equipment: { [equipmentTypeHrid]: { hrid, enhancementLevel } }
 * @param {Object} gameData - Game data from buildGameDataPayload()
 * @returns {Array<{skillHrid: string, level: number}>}
 */
export function getRequiredLevelsForEquipment(equipment, gameData) {
    const itemDetailMap = gameData?.itemDetailMap || {};
    const maxBySkill = new Map();

    for (const item of Object.values(equipment || {})) {
        if (!item?.hrid) continue;
        const requirements = itemDetailMap[item.hrid]?.equipmentDetail?.levelRequirements || [];
        for (const req of requirements) {
            const current = maxBySkill.get(req.skillHrid) || 0;
            if (req.level > current) maxBySkill.set(req.skillHrid, req.level);
        }
    }

    return Array.from(maxBySkill, ([skillHrid, level]) => ({ skillHrid, level }));
}

/**
 * Simulate a single DTO across every given zone and return its best zone, ranked by the same
 * gold/XP objective slider optimizeProgression uses: at each zone, gold/hr and total XP/hr are
 * min-max normalized against every OTHER zone tried for this same DTO, then blended by
 * `objectiveWeight` (0 = pick the best gold/hr zone, 1 = pick the best XP/hr zone). Runs inside
 * the userscript only (spins up real combat-sim Web Workers).
 * @param {Object} dto - Player DTO to test (equipment/abilities/consumables/skills)
 * @param {Array<{zoneHrid: string, difficultyTier: number, name: string}>} zones
 * @param {Object} gameData - Game data from buildGameDataPayload()
 * @param {Object} [options]
 * @param {number} [options.hours=1] - Simulated hours per zone (short — this is a scan, not a final result)
 * @param {Object} [options.communityBuffs] - { mooPass, comExp, comDrop }
 * @param {number} [options.objectiveWeight=1] - 0 = rank zones by gold/hr, 1 = rank by total XP/hr, in between blends both
 * @param {Function} [onProgress] - Called with (percent: 0-100)
 * @returns {Promise<{zoneHrid: string, difficultyTier: number, name: string, goldPerHr: number, xpPerHr: number, xpPerHrBySkill: Object<string, number>}|null>}
 */
export async function findBestZoneForDTO(dto, zones, gameData, options = {}, onProgress) {
    const { hours = 1, communityBuffs = {}, objectiveWeight = 1 } = options;
    if (!zones?.length) return null;

    const playerHrid = dto.hrid || 'player1';
    const simZones = zones.map((z) => ({ zoneHrid: z.zoneHrid, difficultyTier: z.difficultyTier }));
    const simResults = await runAllZonesSimulation(
        { gameData, playerDTOs: [dto], zones: simZones, hours, communityBuffs, useEarlyExit: false },
        onProgress
    );

    const candidates = [];
    for (let i = 0; i < simResults.length; i++) {
        const simResult = simResults[i];
        if (!simResult) continue;

        const simHours = (simResult.simulatedTime || 0) / (3600 * 1e9) || hours;

        // simResult.experienceGained uses short skill keys ('attack', 'defense', ...) while
        // gameData's item level requirements use full skill hrids ('/skills/attack', ...) — key
        // everything to the hrid form so eligibility checks in progression-optimizer.js can
        // compare them directly.
        const xpPerHrBySkill = {};
        for (const [skill, amount] of Object.entries(simResult.experienceGained?.[playerHrid] || {})) {
            xpPerHrBySkill[`/skills/${skill}`] = amount / simHours;
        }
        const xpPerHr = Object.values(xpPerHrBySkill).reduce((sum, v) => sum + v, 0);

        let goldPerHr = 0;
        try {
            goldPerHr = calculateSimRevenue(simResult, gameData, playerHrid, simHours).netPerHour;
        } catch (error) {
            console.error('[ProgressionPlanner] Failed to compute revenue for zone', zones[i]?.zoneHrid, error);
        }

        candidates.push({ ...zones[i], goldPerHr, xpPerHr, xpPerHrBySkill });
    }

    if (candidates.length === 0) return null;

    const golds = candidates.map((c) => c.goldPerHr);
    const xps = candidates.map((c) => c.xpPerHr);
    const minGold = Math.min(...golds);
    const maxGold = Math.max(...golds);
    const minXp = Math.min(...xps);
    const maxXp = Math.max(...xps);
    const normalize = (value, min, max) => (max > min ? (value - min) / (max - min) : 1);

    let best = null;
    for (const candidate of candidates) {
        const normGold = normalize(candidate.goldPerHr, minGold, maxGold);
        const normXp = normalize(candidate.xpPerHr, minXp, maxXp);
        const score = (1 - objectiveWeight) * normGold + objectiveWeight * normXp;
        if (!best || score > best.score) best = { ...candidate, score };
    }

    return best;
}

/**
 * Full orchestration: for the current gear and every saved Build, find the best zone (per the
 * shared objective slider), then assemble the incrementally-priced stage list ready for
 * optimizeProgression. Runs inside the userscript only.
 *
 * Current gear IS simulated as a real activity (not a zero-value placeholder) — it's the only
 * bridge between "today" and the first saved Build you don't yet qualify for, since leveling
 * toward that build's requirements can only happen by actually fighting in something. What it
 * shouldn't do is let XP in skills irrelevant to the style you're planning around (e.g. melee XP
 * from a melee weapon while planning a magic progression) make it look artificially better than
 * a purpose-built option — that's handled by optimizeProgression's `relevantSkillHrids`, which
 * scores only the skills that actually matter for the chosen style, not raw total XP.
 *
 * @param {Object} params
 * @param {Object} params.currentDTO - Your live/current player DTO
 * @param {Array<{name: string, dto: Object}>} params.builds - Saved builds to include, cheapest gear first isn't required — sorting happens internally
 * @param {Array<{zoneHrid: string, difficultyTier: number, name: string}>} params.zones - Zones to scan
 * @param {Object} params.gameData - Game data from buildGameDataPayload()
 * @param {Object} [params.options] - Passed through to findBestZoneForDTO (hours, communityBuffs, objectiveWeight)
 * @param {Function} [onProgress] - Called with (percent: 0-100, label: string) as each stage's scan completes
 * @returns {Promise<Array<{name: string, cost: number, goldPerHr: number, xpPerHrBySkill: Object<string, number>, requiredLevels: Array<{skillHrid: string, level: number}>, bestZone: Object|null}>>}
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
            xpPerHrBySkill: bestZone?.xpPerHrBySkill || {},
            requiredLevels:
                entry.name === 'Current Gear' ? [] : getRequiredLevelsForEquipment(entry.dto.equipment, gameData),
            bestZone,
        });
        if (onProgress) onProgress(Math.round(((i + 1) / allEntries.length) * 100), entry.name);
    }

    const [currentStage, ...buildResults] = results;
    return buildStagesFromResults({ currentStage, builds: buildResults });
}

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
import { COMBAT_SKILLS } from './level-target-core.js';

const COMBAT_SKILL_HRIDS = new Set(COMBAT_SKILLS.map(({ key }) => `/skills/${key}`));

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
 * Extract the highest COMBAT-skill level requirement per skill across every equipped item in a
 * loadout, from live game data (item level requirements aren't known statically).
 *
 * Non-combat requirements (a pouch/back item gated behind an artisan skill, a "total level"
 * milestone gate, etc.) are deliberately ignored here — this planner only tracks combat XP, so
 * a gate on, say, Alchemy would otherwise show as permanently unmeetable ("you don't have the
 * level") even though it has nothing to do with combat progression.
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
            if (!COMBAT_SKILL_HRIDS.has(req.skillHrid)) continue;
            const current = maxBySkill.get(req.skillHrid) || 0;
            if (req.level > current) maxBySkill.set(req.skillHrid, req.level);
        }
    }

    return Array.from(maxBySkill, ([skillHrid, level]) => ({ skillHrid, level }));
}

/**
 * Stable cache key for a DTO's simulated rates: covers everything that can change what the sim
 * actually produces (gear, abilities, consumables, skills, zones scanned, sim duration) but
 * deliberately excludes `objectiveWeight`, which only affects how an already-simulated set of
 * zones gets ranked, not the simulation itself.
 * @param {Object} dto
 * @param {Array<{zoneHrid: string, difficultyTier: number}>} zones
 * @param {number} hours
 * @param {Object} communityBuffs
 * @returns {string}
 */
function buildZoneCacheKey(dto, zones, hours, communityBuffs) {
    return JSON.stringify({ dto, zones: zones.map((z) => [z.zoneHrid, z.difficultyTier]), hours, communityBuffs });
}

/**
 * Simulate a single DTO across every given zone and return the raw per-zone results (goldPerHr,
 * xpPerHr, xpPerHrBySkill) — unranked. Runs inside the userscript only (spins up real combat-sim
 * Web Workers). Split out from `findBestZoneForDTO` so the (expensive) simulation step can be
 * cached independently of the (cheap) objective-weight ranking step.
 * @param {Object} dto - Player DTO to test (equipment/abilities/consumables/skills)
 * @param {Array<{zoneHrid: string, difficultyTier: number, name: string}>} zones
 * @param {Object} gameData - Game data from buildGameDataPayload()
 * @param {Object} [options]
 * @param {number} [options.hours=1] - Simulated hours per zone (short — this is a scan, not a final result)
 * @param {Object} [options.communityBuffs] - { mooPass, comExp, comDrop }
 * @param {Function} [onProgress] - Called with (percent: 0-100)
 * @returns {Promise<Array<{zoneHrid: string, difficultyTier: number, name: string, goldPerHr: number, xpPerHr: number, xpPerHrBySkill: Object<string, number>}>>}
 */
export async function simulateDtoAcrossZones(dto, zones, gameData, options = {}, onProgress) {
    const { hours = 1, communityBuffs = {} } = options;
    if (!zones?.length) return [];

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

    return candidates;
}

/**
 * Simulate a single DTO across every given zone (or reuse a cached result — see `options.cache`)
 * and return its best zone, ranked by the same gold/XP objective slider optimizeProgression uses:
 * at each zone, gold/hr and total XP/hr are min-max normalized against every OTHER zone tried for
 * this same DTO, then blended by `objectiveWeight` (0 = pick the best gold/hr zone, 1 = pick the
 * best XP/hr zone). Runs inside the userscript only (spins up real combat-sim Web Workers).
 * @param {Object} dto - Player DTO to test (equipment/abilities/consumables/skills)
 * @param {Array<{zoneHrid: string, difficultyTier: number, name: string}>} zones
 * @param {Object} gameData - Game data from buildGameDataPayload()
 * @param {Object} [options]
 * @param {number} [options.hours=1] - Simulated hours per zone (short — this is a scan, not a final result)
 * @param {Object} [options.communityBuffs] - { mooPass, comExp, comDrop }
 * @param {number} [options.objectiveWeight=1] - 0 = rank zones by gold/hr, 1 = rank by total XP/hr, in between blends both
 * @param {Map<string, Array>} [options.cache] - Optional cache of raw per-zone sim results, keyed
 *   by DTO content + zones + hours + communityBuffs. Reused as long as none of those change —
 *   independent of `objectiveWeight`, which only affects ranking below, not what gets cached.
 * @param {Function} [onProgress] - Called with (percent: 0-100)
 * @returns {Promise<{zoneHrid: string, difficultyTier: number, name: string, goldPerHr: number, xpPerHr: number, xpPerHrBySkill: Object<string, number>, cached: boolean}|null>}
 */
export async function findBestZoneForDTO(dto, zones, gameData, options = {}, onProgress) {
    const { hours = 1, communityBuffs = {}, objectiveWeight = 1, cache } = options;
    if (!zones?.length) return null;

    const cacheKey = cache ? buildZoneCacheKey(dto, zones, hours, communityBuffs) : null;
    let candidates;
    let cached = false;
    if (cache && cache.has(cacheKey)) {
        candidates = cache.get(cacheKey);
        cached = true;
    } else {
        candidates = await simulateDtoAcrossZones(dto, zones, gameData, options, onProgress);
        if (cache) cache.set(cacheKey, candidates);
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

    return best ? { ...best, cached } : null;
}

/**
 * Full orchestration: for every saved Build (never current gear), find the best zone (per the
 * shared objective slider), then assemble the incrementally-priced stage list ready for
 * optimizeProgression. Runs inside the userscript only.
 *
 * Current gear is never simulated as an activity — only saved Builds compete to be fought in.
 * Its equipment is used purely as the cost-diffing baseline (so a build that reuses an
 * already-owned item isn't charged for it again). This means progress is only possible starting
 * from a build you already meet the level requirements for at your real current XP — there is no
 * "fight in whatever you have on now to bridge the gap" option. If no saved build is currently
 * eligible, optimizeProgression's candidates will all show zero progress; the caller should
 * detect that (every candidate's reachedStageIndex stays 0) and tell the user plainly, rather
 * than presenting a "recommended" strategy that quietly does nothing for the whole time budget.
 *
 * @param {Object} params
 * @param {Object} params.currentDTO - Your live/current player DTO (used only for cost-diffing)
 * @param {Array<{name: string, dto: Object}>} params.builds - Saved builds to include, cheapest gear first isn't required — sorting happens internally
 * @param {Array<{zoneHrid: string, difficultyTier: number, name: string}>} params.zones - Zones to scan
 * @param {Object} params.gameData - Game data from buildGameDataPayload()
 * @param {Object} [params.options] - Passed through to findBestZoneForDTO (hours, communityBuffs, objectiveWeight)
 * @param {Function} [onProgress] - Called with (percent: 0-100, label: string, cached: boolean|undefined)
 *   as each build's scan completes — `cached` is true when a matching `options.cache` entry was
 *   reused instead of running a fresh simulation
 * @returns {Promise<Array<{name: string, cost: number, goldPerHr: number, xpPerHrBySkill: Object<string, number>, requiredLevels: Array<{skillHrid: string, level: number}>, bestZone: Object|null}>>}
 */
export async function runProgressionZoneSearch({ currentDTO, builds, zones, gameData, options = {} }, onProgress) {
    const currentStage = {
        name: 'Current Gear',
        equipment: currentDTO.equipment,
        goldPerHr: 0,
        xpPerHrBySkill: {},
        requiredLevels: [],
        bestZone: null,
    };

    const buildResults = [];
    for (let i = 0; i < builds.length; i++) {
        const entry = builds[i];
        const bestZone = await findBestZoneForDTO(entry.dto, zones, gameData, options);
        if (onProgress) onProgress(Math.round(((i + 1) / builds.length) * 100), entry.name, bestZone?.cached);
        buildResults.push({
            name: entry.name,
            equipment: entry.dto.equipment,
            goldPerHr: bestZone?.goldPerHr || 0,
            xpPerHrBySkill: bestZone?.xpPerHrBySkill || {},
            requiredLevels: getRequiredLevelsForEquipment(entry.dto.equipment, gameData),
            bestZone,
        });
    }

    return buildStagesFromResults({ currentStage, builds: buildResults });
}

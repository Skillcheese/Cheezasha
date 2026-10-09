/**
 * Progression Planner
 *
 * Ties saved fictional gear Builds (sim-builds.js) to the multi-skill progression optimizer
 * (progression-optimizer.js): simulate each saved Build in every zone, keep every zone that isn't
 * beaten outright by another (see pruneDominatedZones), and turn each (build, zone) pair into its
 * own {cost, goldPerHr, xpPerHrBySkill, requiredLevels} stage. No zone is picked up front — the
 * optimizer chooses which zone to fight in at each point of the plan, since the best zone depends
 * on what it's for (e.g. a high-XP zone to clear the next set's level gate sooner can beat the
 * highest-gold zone even when optimizing purely for gold).
 *
 * `buildStagesFromResults` and `pruneDominatedZones` are pure and fully unit-testable without a
 * live sim. `findZoneOptionsForDTO` / `runProgressionZoneSearch` drive the actual Web Worker
 * combat simulation and can only run inside the userscript.
 */

import { runAllZonesSimulation } from './all-zones-runner.js';
import { calculateSimRevenue } from './combat-sim-adapter.js';
import { calculateGearUpgradeCost, estimateEquipmentPrice, estimateGearResaleValue } from './gear-price.js';
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
 * independent of the gold/XP objective.
 *
 * Any extra fields on a build entry (e.g. `requiredLevels`) pass through unchanged onto its
 * stage(s), so callers can carry along whatever metadata the pure cost/ordering logic here
 * doesn't need.
 *
 * A build with a `zoneOptions` array is expanded into one stage per zone, named
 * `"<build> @ <zone> (T<tier>)"`, each with that zone's rates plus `buildName` and `zone`. Zone
 * variants of the same build share its gear, so switching between them is free (directCosts 0)
 * and they share its `cost`, `requiredLevels` and `gearValue`. A build without `zoneOptions`
 * stays a single stage under its own name (`buildName` still set).
 *
 * Every stage also gets a `directCosts` map: `directCosts[otherStageName]` is the cost to go
 * straight from THIS stage's owned equipment to that other stage's equipment, bypassing whatever
 * sits between them in the sorted order. `optimizeProgression`'s climb uses this to jump straight
 * to whichever reachable stage is actually worth fighting toward, instead of being forced to buy
 * every cheaper stage's gear along the way even when none of it helps reach the target.
 *
 * With `sellOldGear`, every stage also gets a `gearValue` (its equipment's resale value — see
 * estimateGearResaleValue), so the optimizer can score by net worth rather than cash alone.
 *
 * Current gear is treated as items already in your bank (typically it's your brewing setup): any
 * build item it covers is free (see calculateGearUpgradeCost's `ownedEquipment`). Leaving Current
 * Gear never sells anything — your current setup stays as it is — but once a bank item is part
 * of a build, it's that build's gear like any other: counted in its `gearValue`, and sold (with
 * `sellOldGear`) when a later build replaces it.
 *
 * @param {Object} params
 * @param {{equipment: Object, goldPerHr: number, xpPerHrBySkill: Object<string, number>}} params.currentStage
 *   Your current gear plus its own simulated rates (this stage's cost is always forced to 0 —
 *   you already own it, regardless of what it would cost to buy from scratch).
 * @param {Array<{name: string, equipment: Object, goldPerHr?: number, xpPerHrBySkill?: Object<string, number>, requiredLevels?: Array<{skillHrid: string, level: number}>, zoneOptions?: Array<{name: string, difficultyTier: number, goldPerHr: number, xpPerHrBySkill: Object<string, number>}>}>} params.builds
 *   One entry per saved Build, with its simulated zones (see runProgressionZoneSearch).
 * @param {boolean} [params.sellOldGear=false] - Credit selling gear that isn't carried forward
 *   into the next stage toward that stage's cost (see calculateGearUpgradeCost's `sellOldGear`).
 * @returns {Array<{name: string, buildName: string, zone?: Object, cost: number, goldPerHr: number, xpPerHrBySkill: Object<string, number>, requiredLevels?: Array<{skillHrid: string, level: number}>, directCosts: Object<string, number>}>}
 */
export function buildStagesFromResults({ currentStage, builds, sellOldGear = false }) {
    const priced = builds
        .map((build) => ({ ...build, _fullPrice: estimateEquipmentPrice(build.equipment).total }))
        .sort((a, b) => a._fullPrice - b._fullPrice);

    const { equipment: currentEquipment, ...currentRest } = currentStage;
    const gears = [{ name: 'Current Gear', ...currentRest, cost: 0, equipment: currentEquipment }];

    let prevEquipment = currentEquipment;
    for (const build of priced) {
        const { total: cost } = calculateGearUpgradeCost(prevEquipment, build.equipment, {
            // Nothing from your current setup is ever sold just to leave it
            sellOldGear: sellOldGear && prevEquipment !== currentEquipment,
            ownedEquipment: currentEquipment,
        });
        const { _fullPrice, ...rest } = build;
        void _fullPrice;
        gears.push({ ...rest, cost });
        prevEquipment = build.equipment;
    }

    // Price every gear pair once (not every zone-variant pair — the gear is what's bought).
    const gearCosts = new Map();
    for (const gear of gears) {
        const costs = {};
        for (const other of gears) {
            if (other === gear) continue;
            costs[other.name] = calculateGearUpgradeCost(gear.equipment, other.equipment, {
                sellOldGear: sellOldGear && gear.equipment !== currentEquipment,
                ownedEquipment: currentEquipment,
            }).total;
        }
        gearCosts.set(gear.name, costs);
    }

    const stages = [];
    for (const gear of gears) {
        const { zoneOptions, ...gearRest } = gear;
        // Only meaningful when selling is modeled: otherwise gear is a sunk cost that's never
        // turned back into gold, so it shouldn't count toward the optimizer's net worth either.
        // Current gear is never sold as such (see above), so it's worth nothing to the plan.
        const gearValue =
            sellOldGear && gear.equipment !== currentEquipment ? estimateGearResaleValue(gear.equipment) : 0;
        if (!zoneOptions?.length) {
            stages.push({ ...gearRest, buildName: gear.name, gearValue });
            continue;
        }
        for (const zone of zoneOptions) {
            stages.push({
                ...gearRest,
                name: `${gear.name} @ ${zone.name} (T${zone.difficultyTier})`,
                buildName: gear.name,
                zone,
                goldPerHr: zone.goldPerHr,
                xpPerHrBySkill: zone.xpPerHrBySkill,
                gearValue,
            });
        }
    }

    for (const stage of stages) {
        const costs = gearCosts.get(stage.buildName);
        const directCosts = {};
        for (const other of stages) {
            if (other === stage) continue;
            directCosts[other.name] = other.buildName === stage.buildName ? 0 : costs[other.buildName];
        }
        stage.directCosts = directCosts;
    }

    return stages;
}

/**
 * Drop every zone that another zone beats outright — at least as much gold/hr AND at least as much
 * XP/hr in every single skill (strictly more in at least one). Such a zone can never be the better
 * choice for any gold/XP blend or any level gate, so dropping it loses nothing and keeps the
 * optimizer's option count down. Of exact duplicates, only the first is kept.
 * @param {Array<{goldPerHr: number, xpPerHrBySkill: Object<string, number>}>} zones
 * @returns {Array<Object>} The surviving zones, in their original order
 */
export function pruneDominatedZones(zones) {
    const skills = [...new Set(zones.flatMap((z) => Object.keys(z.xpPerHrBySkill || {})))];
    const atLeast = (a, b) =>
        a.goldPerHr >= b.goldPerHr && skills.every((k) => (a.xpPerHrBySkill?.[k] || 0) >= (b.xpPerHrBySkill?.[k] || 0));

    return zones.filter((zone, i) =>
        zones.every((other, j) => {
            if (i === j || !atLeast(other, zone)) return true;
            // `other` is at least as good everywhere — `zone` survives only as the first of identical twins.
            return atLeast(zone, other) && i < j;
        })
    );
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
 * and return every zone worth considering for it (see pruneDominatedZones). Which of them to
 * actually fight in is left to the optimizer. Runs inside the userscript only (spins up real
 * combat-sim Web Workers).
 * @param {Object} dto - Player DTO to test (equipment/abilities/consumables/skills)
 * @param {Array<{zoneHrid: string, difficultyTier: number, name: string}>} zones
 * @param {Object} gameData - Game data from buildGameDataPayload()
 * @param {Object} [options]
 * @param {number} [options.hours=1] - Simulated hours per zone (short — this is a scan, not a final result)
 * @param {Object} [options.communityBuffs] - { mooPass, comExp, comDrop }
 * @param {Map<string, Array>} [options.cache] - Optional cache of raw per-zone sim results, keyed
 *   by DTO content + zones + hours + communityBuffs. Reused as long as none of those change.
 * @param {Function} [onProgress] - Called with (percent: 0-100)
 * @returns {Promise<{zoneOptions: Array<{zoneHrid: string, difficultyTier: number, name: string, goldPerHr: number, xpPerHr: number, xpPerHrBySkill: Object<string, number>}>, cached: boolean}>}
 */
export async function findZoneOptionsForDTO(dto, zones, gameData, options = {}, onProgress) {
    const { hours = 1, communityBuffs = {}, cache } = options;
    if (!zones?.length) return { zoneOptions: [], cached: false };

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

    return { zoneOptions: pruneDominatedZones(candidates), cached };
}

/**
 * Full orchestration: for every saved Build (never current gear), simulate every zone and keep
 * the ones worth considering, then assemble the incrementally-priced stage list (one stage per
 * build and zone) ready for optimizeProgression. Runs inside the userscript only.
 *
 * Current gear is never simulated as an activity — only saved Builds compete to be fought in.
 * Its items count as already in your bank: free for any build that uses them, and only ever sold
 * once a build that used them is upgraded (see buildStagesFromResults). This means
 * progress is only possible starting
 * from a build you already meet the level requirements for at your real current XP — there is no
 * "fight in whatever you have on now to bridge the gap" option. If no saved build is currently
 * eligible, optimizeProgression's candidates will all show zero progress; the caller should
 * detect that (every candidate's reachedStageIndex stays 0) and tell the user plainly, rather
 * than presenting a "recommended" strategy that quietly does nothing for the whole time budget.
 *
 * @param {Object} params
 * @param {Object} params.currentDTO - Your live/current player DTO (its gear counts as owned, never sold)
 * @param {Array<{name: string, dto: Object}>} params.builds - Saved builds to include, cheapest gear first isn't required — sorting happens internally
 * @param {Array<{zoneHrid: string, difficultyTier: number, name: string}>} params.zones - Zones to scan
 * @param {Object} params.gameData - Game data from buildGameDataPayload()
 * @param {Object} [params.options] - Passed through to findZoneOptionsForDTO (hours, communityBuffs, cache)
 * @param {boolean} [params.sellOldGear=false] - Credit selling gear not carried forward into the
 *   next stage toward that stage's cost (see buildStagesFromResults/calculateGearUpgradeCost)
 * @param {Function} [onProgress] - Called with (percent: 0-100, label: string, cached: boolean|undefined)
 *   as each build's scan completes — `cached` is true when a matching `options.cache` entry was
 *   reused instead of running a fresh simulation
 * @returns {Promise<Array<Object>>} See buildStagesFromResults — each build's stages also carry
 *   `cached` (whether its zone scan came from `options.cache`)
 */
export async function runProgressionZoneSearch(
    { currentDTO, builds, zones, gameData, options = {}, sellOldGear = false },
    onProgress
) {
    const currentStage = {
        name: 'Current Gear',
        equipment: currentDTO.equipment,
        goldPerHr: 0,
        xpPerHrBySkill: {},
        requiredLevels: [],
    };

    const buildResults = [];
    for (let i = 0; i < builds.length; i++) {
        const entry = builds[i];
        const { zoneOptions, cached } = await findZoneOptionsForDTO(entry.dto, zones, gameData, options);
        if (onProgress) onProgress(Math.round(((i + 1) / builds.length) * 100), entry.name, cached);
        if (zoneOptions.length === 0) continue; // nothing simulated — no way to fight in it
        buildResults.push({
            name: entry.name,
            equipment: entry.dto.equipment,
            requiredLevels: getRequiredLevelsForEquipment(entry.dto.equipment, gameData),
            zoneOptions,
            cached,
        });
    }

    return buildStagesFromResults({ currentStage, builds: buildResults, sellOldGear });
}

/**
 * Skilling Optimizer Engine
 * Per-slot independent optimization: for each equipment slot, finds the best item
 * at each enhancement breakpoint. Uses the same breakpoint tables as the combat
 * upgrade advisor.
 */

import dataManager from '../../core/data-manager.js';
import marketAPI from '../../api/marketplace.js';
import {
    scoreEquipmentSetup,
    findOptimalTeas,
    getSkillActionsForDisplay,
    calculateSkillPerformance,
} from '../../utils/tea-optimizer.js';

export { getSkillActionsForDisplay, calculateSkillPerformance, findOptimalTeas };

// Equipment type → item location mapping (two_hand maps to main_hand slot)
const EQUIPMENT_TYPE_TO_LOCATION = {
    '/equipment_types/back': '/item_locations/back',
    '/equipment_types/head': '/item_locations/head',
    '/equipment_types/trinket': '/item_locations/trinket',
    '/equipment_types/main_hand': '/item_locations/main_hand',
    '/equipment_types/two_hand': '/item_locations/main_hand',
    '/equipment_types/body': '/item_locations/body',
    '/equipment_types/off_hand': '/item_locations/off_hand',
    '/equipment_types/hands': '/item_locations/hands',
    '/equipment_types/legs': '/item_locations/legs',
    '/equipment_types/pouch': '/item_locations/pouch',
    '/equipment_types/feet': '/item_locations/feet',
    '/equipment_types/neck': '/item_locations/neck',
    '/equipment_types/earrings': '/item_locations/earrings',
    '/equipment_types/ring': '/item_locations/ring',
    '/equipment_types/charm': '/item_locations/charm',
    // Skill-specific tool slots
    '/equipment_types/milking_tool': '/item_locations/milking_tool',
    '/equipment_types/foraging_tool': '/item_locations/foraging_tool',
    '/equipment_types/woodcutting_tool': '/item_locations/woodcutting_tool',
    '/equipment_types/cheesesmithing_tool': '/item_locations/cheesesmithing_tool',
    '/equipment_types/crafting_tool': '/item_locations/crafting_tool',
    '/equipment_types/tailoring_tool': '/item_locations/tailoring_tool',
    '/equipment_types/cooking_tool': '/item_locations/cooking_tool',
    '/equipment_types/brewing_tool': '/item_locations/brewing_tool',
    '/equipment_types/alchemy_tool': '/item_locations/alchemy_tool',
};

// Build reverse map: location → [equipment types]
const LOCATION_TO_EQUIPMENT_TYPES = {};
for (const [eqType, loc] of Object.entries(EQUIPMENT_TYPE_TO_LOCATION)) {
    if (!LOCATION_TO_EQUIPMENT_TYPES[loc]) LOCATION_TO_EQUIPMENT_TYPES[loc] = [];
    LOCATION_TO_EQUIPMENT_TYPES[loc].push(eqType);
}

// Every enhancement level 1-20 gives its own distinct stat bonus (see ENHANCEMENT_BONUSES in
// enhancement-multipliers.js), so all of them are scored — unlike the combat upgrade advisor,
// which intentionally checks only a sparse set of "typical" combat-gear checkpoints, this
// optimizer is meant to answer "what can I buy right now at this exact + level", so skipping
// levels would hide real, buyable options (e.g. a +9 that's cheaper than +10).
const FULL_LEVEL_RANGE = Array.from({ length: 20 }, (_, i) => i + 1);
const REFINED_LEVEL_RANGE = FULL_LEVEL_RANGE.filter((lvl) => lvl >= 10);

export const SKILLING_LOCATIONS = [
    // Skill-specific tools (shown first)
    '/item_locations/milking_tool',
    '/item_locations/foraging_tool',
    '/item_locations/woodcutting_tool',
    '/item_locations/cheesesmithing_tool',
    '/item_locations/crafting_tool',
    '/item_locations/tailoring_tool',
    '/item_locations/cooking_tool',
    '/item_locations/brewing_tool',
    '/item_locations/alchemy_tool',
    // General equipment slots
    '/item_locations/main_hand',
    '/item_locations/off_hand',
    '/item_locations/head',
    '/item_locations/body',
    '/item_locations/legs',
    '/item_locations/hands',
    '/item_locations/feet',
    '/item_locations/back',
    '/item_locations/neck',
    '/item_locations/ring',
    '/item_locations/earrings',
    '/item_locations/trinket',
    '/item_locations/pouch',
    '/item_locations/charm',
];

export const SLOT_DISPLAY_NAMES = {
    '/item_locations/milking_tool': 'Milking Tool',
    '/item_locations/foraging_tool': 'Foraging Tool',
    '/item_locations/woodcutting_tool': 'Woodcutting Tool',
    '/item_locations/cheesesmithing_tool': 'Cheesesmithing Tool',
    '/item_locations/crafting_tool': 'Crafting Tool',
    '/item_locations/tailoring_tool': 'Tailoring Tool',
    '/item_locations/cooking_tool': 'Cooking Tool',
    '/item_locations/brewing_tool': 'Brewing Tool',
    '/item_locations/alchemy_tool': 'Alchemy Tool',
    '/item_locations/main_hand': 'Main Hand',
    '/item_locations/off_hand': 'Off Hand',
    '/item_locations/head': 'Head',
    '/item_locations/body': 'Body',
    '/item_locations/legs': 'Legs',
    '/item_locations/hands': 'Hands',
    '/item_locations/feet': 'Feet',
    '/item_locations/back': 'Back',
    '/item_locations/neck': 'Neck',
    '/item_locations/ring': 'Ring',
    '/item_locations/earrings': 'Earrings',
    '/item_locations/trinket': 'Trinket',
    '/item_locations/pouch': 'Pouch',
    '/item_locations/charm': 'Charm',
};

export const SKILL_TOOL_LOCATION = {
    Milking: '/item_locations/milking_tool',
    Foraging: '/item_locations/foraging_tool',
    Woodcutting: '/item_locations/woodcutting_tool',
    Cheesesmithing: '/item_locations/cheesesmithing_tool',
    Crafting: '/item_locations/crafting_tool',
    Tailoring: '/item_locations/tailoring_tool',
    Cooking: '/item_locations/cooking_tool',
    Brewing: '/item_locations/brewing_tool',
    Alchemy: '/item_locations/alchemy_tool',
};

const GATHERING_SKILLS = new Set(['milking', 'foraging', 'woodcutting']);

export const SKILL_NAMES = [
    'Milking',
    'Foraging',
    'Woodcutting',
    'Cheesesmithing',
    'Crafting',
    'Tailoring',
    'Cooking',
    'Brewing',
    'Alchemy',
];

/**
 * Get the player's current level for a skill.
 * @param {string} skillName
 * @returns {number}
 */
export function getPlayerSkillLevel(skillName) {
    const skills = dataManager.getSkills();
    const skillHrid = `/skills/${skillName.toLowerCase()}`;
    return skills?.find((s) => s.skillHrid === skillHrid)?.level ?? 1;
}

/**
 * Get breakpoints for a location/item combination.
 * @param {string} locationHrid
 * @param {string} itemHrid
 * @returns {number[]}
 */
function getBreakpoints(_locationHrid, itemHrid) {
    // Refined items can't be enhanced below +10
    return itemHrid.includes('_refined') ? REFINED_LEVEL_RANGE : FULL_LEVEL_RANGE;
}

/**
 * Build a map of all player skill levels, with the target skill overridden.
 * @param {string} skillName
 * @param {number} overrideLevel
 * @returns {Map<string, number>}
 */
function buildPlayerLevelMap(skillName, overrideLevel) {
    const skills = dataManager.getSkills() || [];
    const map = new Map(skills.map((s) => [s.skillHrid, s.level]));
    map.set(`/skills/${skillName.toLowerCase()}`, overrideLevel);
    return map;
}

/**
 * Check if the player meets all level requirements for an item.
 * @param {Object} itemDetail
 * @param {Map<string, number>} playerLevels
 * @returns {boolean}
 */
function meetsLevelRequirements(itemDetail, playerLevels) {
    for (const req of itemDetail.equipmentDetail?.levelRequirements || []) {
        if (!req.levelTypeHrid) continue;
        const skillHrid = req.levelTypeHrid.replace('/level_types/', '/skills/');
        // Some accessories (e.g. Task Shop rewards) gate on a non-skill requirement type, like
        // task level, that isn't tracked in playerLevels at all. Defaulting an unrecognized type
        // to level 1 would make any such item look permanently locked and silently disappear —
        // only enforce requirements against skills we actually have a level for.
        if (!playerLevels.has(skillHrid)) continue;
        const playerLevel = playerLevels.get(skillHrid);
        if (playerLevel < req.level) return false;
    }
    return true;
}

/**
 * Get all equipment candidates for a slot that the player can equip.
 * @param {string} locationHrid
 * @param {Map<string, number>} playerLevels
 * @param {Object} itemDetailMap
 * @returns {Array<{ hrid: string, name: string }>}
 */
function getCandidatesForSlot(locationHrid, playerLevels, itemDetailMap) {
    const validEqTypes = new Set(LOCATION_TO_EQUIPMENT_TYPES[locationHrid] || []);
    if (!validEqTypes.size) return [];

    return Object.entries(itemDetailMap)
        .filter(([_hrid, detail]) => {
            if (!detail.equipmentDetail) return false;
            if (!validEqTypes.has(detail.equipmentDetail.type)) return false;
            // Require at least one actual non-zero noncombat stat (confirmed via live game data:
            // pure-combat accessories carry an EMPTY noncombatStats object — `{}` — not a missing
            // one, so a truthy-object check alone wasn't the problem; but leaving every item
            // unfiltered meant scoring hundreds of irrelevant combat rings/earrings per skill,
            // which is slow enough to look like the slot never finishes. This keeps the candidate
            // pool to only items that could possibly matter.
            const stats = detail.equipmentDetail.noncombatStats;
            if (!stats || !Object.values(stats).some((v) => v > 0)) return false;
            return meetsLevelRequirements(detail, playerLevels);
        })
        .map(([hrid, detail]) => ({ hrid, name: detail.name }));
}

/**
 * Get the market buy price (ask) for an item at a given enhancement level.
 * @param {string} itemHrid
 * @param {number} enhancementLevel
 * @returns {number|null}
 */
function getItemCost(itemHrid, enhancementLevel) {
    const price = marketAPI.getPrice(itemHrid, enhancementLevel);
    return price?.ask ?? null;
}

/**
 * Score a single candidate item in a slot at a specific enhancement level.
 * @param {string} itemHrid
 * @param {string} locationHrid
 * @param {string} skillName
 * @param {string} goal
 * @param {number} enhancementLevel
 * @param {number} playerLevel
 * @returns {number}
 */
function scoreCandidate(
    itemHrid,
    locationHrid,
    skillName,
    goal,
    enhancementLevel,
    playerLevel,
    selectedActionHrids,
    baseEquipment = null
) {
    const equipment = new Map(baseEquipment);
    equipment.set(locationHrid, { itemHrid, enhancementLevel });
    return scoreEquipmentSetup(skillName, goal, equipment, playerLevel, selectedActionHrids);
}

/**
 * Build the set of noncombatStats field names that are relevant to a skill.
 * @param {string} skillName
 * @returns {Set<string>}
 */
function getRelevantStatsForSkill(skillName) {
    const key = skillName.toLowerCase();
    const fields = new Set([
        `${key}Speed`,
        `${key}Efficiency`,
        `${key}RareFind`,
        'skillingSpeed',
        'skillingEfficiency',
        'skillingRareFind',
        'skillingEssenceFind',
    ]);
    if (GATHERING_SKILLS.has(key)) fields.add('gatheringQuantity');
    return fields;
}

/**
 * Get all equippable items for a slot that have stats relevant to the given skill.
 * Availability is based on the player's actual skill levels.
 * @param {string} locationHrid
 * @param {string} skillName
 * @returns {Array<{ hrid, name, available, maxReq, itemLevel }>} Sorted by itemLevel descending
 */
export function getItemsForSlot(locationHrid, skillName) {
    const gameData = dataManager.getInitClientData();
    if (!gameData?.itemDetailMap) return [];

    const validEqTypes = new Set(LOCATION_TO_EQUIPMENT_TYPES[locationHrid] || []);
    if (!validEqTypes.size) return [];

    const skills = dataManager.getSkills() || [];
    const playerLevels = new Map(skills.map((s) => [s.skillHrid, s.level]));
    const relevantStats = getRelevantStatsForSkill(skillName);

    const result = [];
    for (const [hrid, detail] of Object.entries(gameData.itemDetailMap)) {
        if (!detail.equipmentDetail) continue;
        if (!validEqTypes.has(detail.equipmentDetail.type)) continue;
        const stats = detail.equipmentDetail.noncombatStats;
        if (!stats) continue;
        // Only include items with at least one relevant non-zero stat for this skill
        if (!Object.entries(stats).some(([field, val]) => val > 0 && relevantStats.has(field))) continue;

        let available = true;
        let maxReq = 1;
        for (const req of detail.equipmentDetail.levelRequirements || []) {
            if (!req.levelTypeHrid) continue;
            const skillHrid = req.levelTypeHrid.replace('/level_types/', '/skills/');
            if (req.level > maxReq) maxReq = req.level;
            if ((playerLevels.get(skillHrid) ?? 1) < req.level) available = false;
        }

        result.push({ hrid, name: detail.name, available, maxReq, itemLevel: detail.itemLevel || 0 });
    }

    return result.sort((a, b) => b.itemLevel - a.itemLevel || a.name.localeCompare(b.name));
}

const SKILLING_BUFF_TYPES = new Set([
    '/buff_types/efficiency',
    '/buff_types/wisdom',
    '/buff_types/gathering',
    '/buff_types/processing',
    '/buff_types/artisan',
    '/buff_types/gourmet',
    '/buff_types/action_level',
    '/buff_types/alchemy_success',
]);

/**
 * Get all consumable drink items that provide skilling-relevant buffs.
 * @returns {Array<{ hrid, name }>} Sorted by name
 */
export function getSkillDrinkItems() {
    const gameData = dataManager.getInitClientData();
    if (!gameData?.itemDetailMap) return [];

    const result = [];
    for (const [hrid, detail] of Object.entries(gameData.itemDetailMap)) {
        // Restrict to actual drinks — some Labyrinth scrolls (e.g. Scroll of Gourmet) carry the
        // same buff types (gourmet, efficiency, etc.) but are one-off consumables, not something
        // reliably available to base a gear purchase decision on. Only teas belong here.
        if (!detail.categoryHrid?.includes('drink')) continue;
        if (!detail.consumableDetail?.buffs?.length) continue;
        const hasSkillBuff = detail.consumableDetail.buffs.some(
            (b) => SKILLING_BUFF_TYPES.has(b.typeHrid) || b.typeHrid?.endsWith('_level')
        );
        if (!hasSkillBuff) continue;
        result.push({ hrid, name: detail.name });
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Yield control back to the browser (lets the UI repaint a progress bar / stay responsive)
 * before resuming the next chunk of work.
 * @returns {Promise<void>}
 */
function yieldToUI() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Build a slot's breakpoint progression plus its cost-vs-score Pareto frontier (used by the
 * budget view), given a generic scoring function. Shared by both the normal per-item scoring
 * path and the drink-concentration path (items like Guzzling Pouch, whose only value is
 * amplifying teas, so they must be scored with an actual tea loadout applied).
 * @param {string} locationHrid
 * @param {Array<{hrid: string, name: string}>} candidates
 * @param {(itemHrid: string, effectiveLevel: number, goalName: 'xp'|'gold') => number} scoreFn
 * @param {number} baseline - Score with nothing equipped in this slot, for the active goal
 * @param {number} xpBaseline
 * @param {number} goldBaseline
 * @param {string} goal - 'xp' or 'gold'
 * @returns {{progression: Array<Object>, paretoCandidates: Array<Object>}|null} null if no
 *  candidate ever beats baseline
 */
function computeSlotResult(locationHrid, candidates, scoreFn, baseline, xpBaseline, goldBaseline, goal) {
    const allBreakpoints = new Set();
    for (const candidate of candidates) {
        for (const bp of getBreakpoints(locationHrid, candidate.hrid)) {
            allBreakpoints.add(bp);
        }
    }
    const sortedBreakpoints = [...allBreakpoints].sort((a, b) => a - b);

    const progression = [];
    let lastWinnerHrid = null;
    // Every (item, effective enhancement level) pair scored, regardless of whether it won its
    // breakpoint — used to build the budget view's cost-vs-score Pareto frontier so items that
    // are merely close (e.g. a "Holy" tier tool) but never outright win a breakpoint can still
    // show up there instead of being invisible.
    const allScoredByKey = new Map();

    for (const bp of sortedBreakpoints) {
        let bestItem = null;
        let bestScore = baseline;

        for (const candidate of candidates) {
            // Refined items can't be enhanced below +10
            const effectiveLevel = candidate.hrid.includes('_refined') ? Math.max(bp, 10) : bp;
            const score = scoreFn(candidate.hrid, effectiveLevel, goal);

            const key = `${candidate.hrid}:${effectiveLevel}`;
            if (!allScoredByKey.has(key)) {
                allScoredByKey.set(key, {
                    itemHrid: candidate.hrid,
                    itemName: candidate.name,
                    breakpoint: effectiveLevel,
                    score,
                });
            }

            if (score > bestScore) {
                bestScore = score;
                bestItem = candidate;
            }
        }

        const effectiveLevelOf = (hrid) => (hrid.includes('_refined') ? Math.max(bp, 10) : bp);

        progression.push({
            breakpoint: bp,
            itemHrid: bestItem?.hrid ?? null,
            itemName: bestItem?.name ?? null,
            score: bestScore,
            xpScore: !bestItem
                ? xpBaseline
                : goal === 'xp'
                  ? bestScore
                  : scoreFn(bestItem.hrid, effectiveLevelOf(bestItem.hrid), 'xp'),
            goldScore: !bestItem
                ? goldBaseline
                : goal === 'gold'
                  ? bestScore
                  : scoreFn(bestItem.hrid, effectiveLevelOf(bestItem.hrid), 'gold'),
            isChange: (bestItem?.hrid ?? null) !== lastWinnerHrid,
            cost: bestItem ? getItemCost(bestItem.hrid, effectiveLevelOf(bestItem.hrid)) : null,
        });

        const lastEntry = progression[progression.length - 1];
        lastEntry.goldGainPerHour = lastEntry.goldScore - goldBaseline;
        lastEntry.paybackHours =
            lastEntry.cost != null && lastEntry.goldGainPerHour > 0 ? lastEntry.cost / lastEntry.goldGainPerHour : null;

        lastWinnerHrid = bestItem?.hrid ?? null;
    }

    // Only include slots where at least one item beats the baseline
    if (!progression.some((p) => p.itemHrid !== null)) return null;

    // Build the cost-vs-score Pareto frontier: price every scored (item, level) pair, sort
    // cheapest-first, and keep only entries that beat every cheaper alternative's score. This
    // surfaces any genuinely-better item at its price point — including ones that never won a
    // breakpoint outright — while dropping anything a cheaper option already matches or beats.
    const priced = [];
    for (const entry of allScoredByKey.values()) {
        const cost = getItemCost(entry.itemHrid, entry.breakpoint);
        if (cost == null) continue; // unpriced items can't be judged "affordable" — omit entirely
        priced.push({ ...entry, cost });
    }
    priced.sort((a, b) => a.cost - b.cost);

    // Ranked by gold gain specifically — not the skill's primary goal — because the budget view is
    // inherently a gold cost-effectiveness tool. A production skill's main progression ranks by XP
    // (more reliable than gold since it doesn't depend on market prices), but that would silently
    // drop gold-only accessories like a Rare Find ring/earring (zero XP benefit, pure gold upside)
    // before they ever reached the "does it profit gold?" check.
    const paretoCandidates = [];
    let bestGoldSoFar = -Infinity;
    for (const entry of priced) {
        const xpScore = goal === 'xp' ? entry.score : scoreFn(entry.itemHrid, entry.breakpoint, 'xp');
        const goldScore = goal === 'gold' ? entry.score : scoreFn(entry.itemHrid, entry.breakpoint, 'gold');
        if (goldScore <= bestGoldSoFar) continue;
        bestGoldSoFar = goldScore;

        const goldGainPerHour = goldScore - goldBaseline;

        paretoCandidates.push({
            ...entry,
            xpScore,
            goldScore,
            goldGainPerHour,
            paybackHours: goldGainPerHour > 0 ? entry.cost / goldGainPerHour : null,
        });
    }

    return { progression, paretoCandidates };
}

/**
 * Optimize a skill for the given player level and selected actions.
 * Equipment is always scored for XP (efficiency/speed benefit both goals equally).
 * Returns per-slot progression plus tea results for both XP and Gold goals.
 *
 * Runs slot-by-slot, yielding to the UI thread between slots so a progress bar can update and
 * the panel doesn't freeze during the (synchronous, CPU-bound) scoring work.
 *
 * @param {string} skillName
 * @param {number} playerLevel
 * @param {Set<string>|null} selectedActionHrids - HRIDs of actions to score against, or null for all
 * @param {Function} [onProgress] - Called with (completed, total) as slots/steps finish
 * @param {Map|null} [baseEquipment] - Equipment to hold fixed in every other slot while each
 *  candidate is scored, and to score as the baseline. Defaults to the player's live equipment;
 *  pass a saved loadout's equipment map instead to compare against that loadout specifically.
 * @returns {Promise<Object|null>}
 */
export async function optimizeSkill(
    skillName,
    playerLevel,
    selectedActionHrids = null,
    onProgress = null,
    baseEquipment = null
) {
    // Rank every skill's default equipment progression by Gold — captures gathering quantity,
    // rare/essence find, and market-priced output value, not just raw XP. Production skills used
    // to rank by XP instead (steadier since it ignores market prices), but that silently hid any
    // item whose only benefit is gold (Rare Find, Essence Find, Gathering Quantity accessories).
    const goal = 'gold';
    const gameData = dataManager.getInitClientData();
    if (!gameData?.itemDetailMap) return null;

    const { itemDetailMap } = gameData;
    const playerLevels = buildPlayerLevelMap(skillName, playerLevel);

    // Every slot is scored against this same equipment held fixed elsewhere (this slot swapped
    // to the candidate, every other slot left as-is), not against an empty setup — scoring
    // against an empty loadout produced a near-zero (sometimes negative) baseline for skills
    // where profit depends on other equipped gear, which made % gains either silently disappear
    // (baseline <= 0) or explode into absurd values (baseline near zero). Defaults to the
    // player's live equipment; the UI passes a compared loadout's equipment here instead when one
    // is selected, so every score in the results is consistent with that same loadout.
    const currentEquipment = baseEquipment ?? dataManager.getEquipment();

    const xpBaseline = scoreEquipmentSetup(skillName, 'xp', currentEquipment, playerLevel, selectedActionHrids);
    const goldBaseline = scoreEquipmentSetup(skillName, 'gold', currentEquipment, playerLevel, selectedActionHrids);
    const baseline = goal === 'xp' ? xpBaseline : goldBaseline;

    /**
     * Every slot shares the same baseline (your real current loadout, tea-less) since a
     * candidate's score already swaps in only that one slot against the same currentEquipment.
     * @returns {{slotBaseline: number, slotXpBaseline: number, slotGoldBaseline: number}}
     */
    const getSlotBaselines = () => ({
        slotBaseline: baseline,
        slotXpBaseline: xpBaseline,
        slotGoldBaseline: goldBaseline,
    });

    const slots = {};
    const optimalEquipmentAtMax = new Map();
    // Slots whose only candidates give a drinkConcentration bonus (e.g. Guzzling Pouch) — those
    // items are worth nothing scored in isolation (no teas active), so they're deferred and
    // rescored once a tea loadout exists to actually amplify. See the block after the main loop.
    const concentrationSlots = [];

    // +2 extra steps for the final XP/Gold tea-optimization passes below (more added later if any
    // drink-concentration slots are deferred).
    let totalSteps = SKILLING_LOCATIONS.length + 2;
    let completedSteps = 0;
    const reportProgress = () => onProgress?.(completedSteps, totalSteps);
    reportProgress();

    for (const locationHrid of SKILLING_LOCATIONS) {
        await yieldToUI();
        completedSteps++;
        reportProgress();
        const candidates = getCandidatesForSlot(locationHrid, playerLevels, itemDetailMap);
        if (!candidates.length) continue;

        // Items whose only stat is drinkConcentration (e.g. Guzzling Pouch) score as zero gain
        // when tested alone with no teas active — defer them until a tea loadout exists.
        const hasDrinkConcentration = candidates.some(
            (c) => (itemDetailMap[c.hrid]?.equipmentDetail?.noncombatStats?.drinkConcentration ?? 0) > 0
        );
        if (hasDrinkConcentration) {
            concentrationSlots.push({ locationHrid, candidates });
            continue;
        }

        const scoreFn = (itemHrid, effectiveLevel, goalName) =>
            scoreCandidate(
                itemHrid,
                locationHrid,
                skillName,
                goalName,
                effectiveLevel,
                playerLevel,
                selectedActionHrids,
                currentEquipment
            );

        const { slotBaseline, slotXpBaseline, slotGoldBaseline } = getSlotBaselines();
        const result = computeSlotResult(
            locationHrid,
            candidates,
            scoreFn,
            slotBaseline,
            slotXpBaseline,
            slotGoldBaseline,
            goal
        );
        if (!result) continue;

        slots[locationHrid] = {
            name: SLOT_DISPLAY_NAMES[locationHrid] || locationHrid,
            candidateCount: candidates.length,
            slotXpBaseline,
            slotGoldBaseline,
            ...result,
        };

        // Record the optimal item at max breakpoint for tea optimization
        const maxEntry = result.progression[result.progression.length - 1];
        if (maxEntry?.itemHrid) {
            optimalEquipmentAtMax.set(locationHrid, { itemHrid: maxEntry.itemHrid, enhancementLevel: 20 });
        }
    }

    // Drink-concentration slots (e.g. pouch): now that optimalEquipmentAtMax reflects every other
    // slot's winner, find a preliminary tea loadout for each goal and rescore these slots'
    // candidates with that tea loadout actually applied, so their real value (amplifying tea
    // effects) shows up instead of always reading as zero gain.
    if (concentrationSlots.length) {
        totalSteps += 1 + concentrationSlots.length;

        await yieldToUI();
        completedSteps++;
        reportProgress();

        const prelimXpTeas = (
            findOptimalTeas(skillName, 'xp', null, null, null, null, optimalEquipmentAtMax, selectedActionHrids)
                ?.optimal?.teas ?? []
        ).map((t) => t.hrid);
        const prelimGoldTeas = (
            findOptimalTeas(skillName, 'gold', null, null, null, null, optimalEquipmentAtMax, selectedActionHrids)
                ?.optimal?.teas ?? []
        ).map((t) => t.hrid);
        const teasForGoal = { xp: prelimXpTeas, gold: prelimGoldTeas };

        const perfWithoutSlot = (locationHrid, goalName) => {
            const equipment = new Map(optimalEquipmentAtMax);
            equipment.delete(locationHrid);
            const perf = calculateSkillPerformance(
                skillName,
                equipment,
                teasForGoal[goalName],
                playerLevel,
                selectedActionHrids
            );
            return goalName === 'xp' ? perf.xpPerHour : perf.goldPerHour;
        };

        for (const { locationHrid, candidates } of concentrationSlots) {
            await yieldToUI();
            completedSteps++;
            reportProgress();

            const scoreFn = (itemHrid, effectiveLevel, goalName) => {
                const equipment = new Map(optimalEquipmentAtMax);
                equipment.set(locationHrid, { itemHrid, enhancementLevel: effectiveLevel });
                const perf = calculateSkillPerformance(
                    skillName,
                    equipment,
                    teasForGoal[goalName],
                    playerLevel,
                    selectedActionHrids
                );
                return goalName === 'xp' ? perf.xpPerHour : perf.goldPerHour;
            };

            const currentItem = currentEquipment.get(locationHrid);
            const currentXp = currentItem?.itemHrid
                ? scoreFn(currentItem.itemHrid, currentItem.enhancementLevel || 0, 'xp')
                : -Infinity;
            const currentGold = currentItem?.itemHrid
                ? scoreFn(currentItem.itemHrid, currentItem.enhancementLevel || 0, 'gold')
                : -Infinity;
            const slotXpBaseline = Math.max(perfWithoutSlot(locationHrid, 'xp'), currentXp);
            const slotGoldBaseline = Math.max(perfWithoutSlot(locationHrid, 'gold'), currentGold);
            const slotBaseline = goal === 'xp' ? slotXpBaseline : slotGoldBaseline;

            const result = computeSlotResult(
                locationHrid,
                candidates,
                scoreFn,
                slotBaseline,
                slotXpBaseline,
                slotGoldBaseline,
                goal
            );
            if (!result) continue;

            slots[locationHrid] = {
                name: SLOT_DISPLAY_NAMES[locationHrid] || locationHrid,
                candidateCount: candidates.length,
                slotXpBaseline,
                slotGoldBaseline,
                ...result,
            };

            const maxEntry = result.progression[result.progression.length - 1];
            if (maxEntry?.itemHrid) {
                optimalEquipmentAtMax.set(locationHrid, { itemHrid: maxEntry.itemHrid, enhancementLevel: 20 });
            }
        }
    }

    // Run tea optimizer for both goals with optimal equipment at max enhancement
    await yieldToUI();
    completedSteps++;
    reportProgress();
    const xpTeaResult = findOptimalTeas(
        skillName,
        'xp',
        null,
        null,
        null,
        null,
        optimalEquipmentAtMax,
        selectedActionHrids
    );

    await yieldToUI();
    completedSteps++;
    reportProgress();
    const goldTeaResult = findOptimalTeas(
        skillName,
        'gold',
        null,
        null,
        null,
        null,
        optimalEquipmentAtMax,
        selectedActionHrids
    );

    return {
        skill: skillName,
        playerLevel,
        goal,
        xpBaseline,
        goldBaseline,
        slots,
        xpTeaResult: xpTeaResult?.error ? null : xpTeaResult,
        goldTeaResult: goldTeaResult?.error ? null : goldTeaResult,
    };
}

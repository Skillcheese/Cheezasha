/**
 * Skill Optimizer Calc
 * Computes best profit/hr across all gathering/production skills (excludes enhancing) for a
 * fully customizable loadout: equipment, skill levels, house room levels, and community buffs.
 * Defaults to the player's live data for any field the user hasn't overridden, and delegates all
 * gold/XP/tea math to tea-optimizer.js.
 */

import dataManager from '../../core/data-manager.js';
import { getSkillActionRates } from '../../utils/tea-optimizer.js';

export const SKILLS = [
    'milking',
    'foraging',
    'woodcutting',
    'cheesesmithing',
    'crafting',
    'tailoring',
    'cooking',
    'brewing',
    'alchemy',
];

const SKILL_TO_ACTION_TYPE = {
    milking: '/action_types/milking',
    foraging: '/action_types/foraging',
    woodcutting: '/action_types/woodcutting',
    cheesesmithing: '/action_types/cheesesmithing',
    crafting: '/action_types/crafting',
    tailoring: '/action_types/tailoring',
    cooking: '/action_types/cooking',
    brewing: '/action_types/brewing',
    alchemy: '/action_types/alchemy',
};

export const EQUIPMENT_LOCATIONS = [
    '/item_locations/milking_tool',
    '/item_locations/foraging_tool',
    '/item_locations/woodcutting_tool',
    '/item_locations/cheesesmithing_tool',
    '/item_locations/crafting_tool',
    '/item_locations/tailoring_tool',
    '/item_locations/cooking_tool',
    '/item_locations/brewing_tool',
    '/item_locations/alchemy_tool',
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

// Equipment type (item's own equip slot) → item location map key. Two-handed weapons occupy the
// main_hand location just like one-handers, so both types are offered for that slot.
const LOCATION_TO_EQUIPMENT_TYPES = {
    '/item_locations/main_hand': ['/equipment_types/main_hand', '/equipment_types/two_hand'],
};
for (const loc of EQUIPMENT_LOCATIONS) {
    if (!LOCATION_TO_EQUIPMENT_TYPES[loc]) {
        LOCATION_TO_EQUIPMENT_TYPES[loc] = [loc.replace('/item_locations/', '/equipment_types/')];
    }
}

export const COMMUNITY_BUFF_TYPES = [
    { hrid: '/community_buff_types/efficiency', name: 'Efficiency (Gathering)' },
    { hrid: '/community_buff_types/production_efficiency', name: 'Efficiency (Production)' },
    { hrid: '/community_buff_types/gathering_quantity', name: 'Gathering Quantity' },
    { hrid: '/community_buff_types/experience', name: 'Wisdom (XP)' },
];

/**
 * Get all equippable items for a given item-location slot, regardless of level requirement —
 * this is a "what if" customization tool, not restricted to what the player can currently wear.
 * @param {string} locationHrid
 * @returns {Array<{hrid: string, name: string}>} Sorted by item level ascending
 */
export function getItemsForSlot(locationHrid) {
    const gameData = dataManager.getInitClientData();
    if (!gameData?.itemDetailMap) return [];

    const validEqTypes = new Set(LOCATION_TO_EQUIPMENT_TYPES[locationHrid] || []);
    if (!validEqTypes.size) return [];

    const result = [];
    for (const [hrid, detail] of Object.entries(gameData.itemDetailMap)) {
        if (!detail.equipmentDetail || !validEqTypes.has(detail.equipmentDetail.type)) continue;
        // Combat-only gear (e.g. armor/weapons with no noncombatStats) is dead space for a
        // skilling loadout — only keep items that actually carry a skilling-relevant stat.
        const noncombatStats = detail.equipmentDetail.noncombatStats;
        if (!noncombatStats || Object.keys(noncombatStats).length === 0) continue;
        result.push({ hrid, name: detail.name, itemLevel: detail.itemLevel || 0 });
    }
    return result.sort((a, b) => a.itemLevel - b.itemLevel || a.name.localeCompare(b.name));
}

/**
 * Get all house rooms relevant to at least one of the tracked skills (i.e. that grant efficiency
 * to one of SKILL_TO_ACTION_TYPE's action types).
 * @returns {Array<{hrid: string, name: string}>}
 */
export function getRelevantHouseRooms() {
    const gameData = dataManager.getInitClientData();
    if (!gameData?.houseRoomDetailMap) return [];

    const relevantActionTypes = new Set(Object.values(SKILL_TO_ACTION_TYPE));
    const result = [];
    for (const [hrid, detail] of Object.entries(gameData.houseRoomDetailMap)) {
        const usable = detail.usableInActionTypeMap || {};
        if (Object.keys(usable).some((actionType) => relevantActionTypes.has(actionType))) {
            result.push({ hrid, name: detail.name || hrid });
        }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Snapshot the player's live loadout (equipment, skill levels, house rooms, community buffs) in
 * the same shape consumed by computeTopResults' overrides, for pre-filling the customization tab.
 * @returns {{equipment: Map, skillLevels: Object, houseRooms: Map, communityBuffLevels: Object}}
 */
export function getLiveLoadout() {
    const equipment = dataManager.getEquipment();
    const houseRooms = dataManager.getHouseRooms();

    const skillLevels = {};
    for (const skill of dataManager.getSkills() || []) {
        const name = skill.skillHrid?.replace('/skills/', '');
        if (name) skillLevels[name] = skill.level;
    }

    const communityBuffLevels = {};
    for (const { hrid } of COMMUNITY_BUFF_TYPES) {
        communityBuffLevels[hrid] = dataManager.getCommunityBuffLevel(hrid);
    }

    return { equipment, skillLevels, houseRooms, communityBuffLevels };
}

/**
 * Compute the top-N profit/hr actions for every skill under a given loadout override.
 * @param {{equipment: Map, skillLevels: Object, houseRooms: Map, communityBuffLevels: Object}} overrides
 * @param {number} topN
 * @returns {Object<string, Array<{name: string, hrid: string, profitPerHour: number, xpPerHour: number, teaHrids: Array<string>}>>}
 */
export function computeTopResults(overrides, topN = 3) {
    const results = {};
    for (const skill of SKILLS) {
        const playerLevel = overrides.skillLevels?.[skill] ?? 1;
        const rates = getSkillActionRates(skill, playerLevel, 'gold', null, overrides);
        results[skill] = rates
            .filter((r) => r.profitPerHour > 0)
            .sort((a, b) => b.profitPerHour - a.profitPerHour)
            .slice(0, topN);
    }
    return results;
}

/**
 * Mutate the given loadout in place to a "best case" setup: max skill levels, the highest-level
 * item available in every slot enhanced to +15, and every relevant house room at level 8.
 * @param {{equipment: Map, skillLevels: Object, houseRooms: Map, communityBuffLevels: Object}} loadout
 */
export function applyMaxLoadout(loadout) {
    for (const skill of SKILLS) {
        loadout.skillLevels[skill] = 150;
    }

    for (const location of EQUIPMENT_LOCATIONS) {
        const items = getItemsForSlot(location);
        if (items.length === 0) {
            loadout.equipment.delete(location);
            continue;
        }
        const bestItem = items[items.length - 1];
        loadout.equipment.set(location, { itemHrid: bestItem.hrid, enhancementLevel: 15 });
    }

    for (const room of getRelevantHouseRooms()) {
        loadout.houseRooms.set(room.hrid, { houseRoomHrid: room.hrid, level: 8 });
    }
}

export default {
    SKILLS,
    EQUIPMENT_LOCATIONS,
    SLOT_DISPLAY_NAMES,
    COMMUNITY_BUFF_TYPES,
    getItemsForSlot,
    getRelevantHouseRooms,
    getLiveLoadout,
    computeTopResults,
    applyMaxLoadout,
};

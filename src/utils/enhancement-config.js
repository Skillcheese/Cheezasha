/**
 * Enhancement Configuration Manager
 *
 * Combines auto-detected enhancing parameters with manual overrides from settings.
 * Provides single source of truth for enhancement simulator inputs.
 */

import config from '../core/config.js';
import dataManager from '../core/data-manager.js';
import {
    detectEnhancingGear,
    detectEnhancingTeas,
    getEnhancingTeaLevelBonus,
    getEnhancingTeaSpeedBonus,
} from './enhancement-gear-detector.js';
import { getEnhancementMultiplier } from './enhancement-multipliers.js';

/**
 * Get enhancing parameters (auto-detected or manual)
 * @returns {Object} Enhancement parameters for simulator
 */
export function getEnhancingParams() {
    const autoDetect = config.getSettingValue('enhanceSim_autoDetect', false);

    if (autoDetect) {
        return getAutoDetectedParams();
    } else {
        return getManualParams();
    }
}

/**
 * Get auto-detected enhancing parameters from character data
 * @returns {Object} Auto-detected parameters
 */
export function getAutoDetectedParams() {
    // Get character data
    const equipment = dataManager.getEquipment();
    const skills = dataManager.getSkills();
    const drinkSlots = dataManager.getActionDrinkSlots('/action_types/enhancing');
    const itemDetailMap = dataManager.getInitClientData()?.itemDetailMap || {};

    // Detect gear from equipped items only
    const gear = detectEnhancingGear(equipment, itemDetailMap);

    // Detect drink concentration from equipment (Guzzling Pouch)
    // IMPORTANT: Only scan equipped items, not entire inventory
    let drinkConcentration = 0;
    const itemsToScan = equipment ? Array.from(equipment.values()).filter((item) => item && item.itemHrid) : [];

    for (const item of itemsToScan) {
        const itemDetails = itemDetailMap[item.itemHrid];
        if (!itemDetails?.equipmentDetail?.noncombatStats?.drinkConcentration) continue;

        const concentration = itemDetails.equipmentDetail.noncombatStats.drinkConcentration;
        const enhancementLevel = item.enhancementLevel || 0;
        const multiplier = getEnhancementMultiplier(itemDetails, enhancementLevel);
        const scaledConcentration = concentration * 100 * multiplier;

        // Only keep the highest concentration (shouldn't have multiple, but just in case)
        if (scaledConcentration > drinkConcentration) {
            drinkConcentration = scaledConcentration;
        }
    }

    // Detect teas
    const teas = detectEnhancingTeas(drinkSlots, itemDetailMap);

    // Get tea level bonus (base, then scale with concentration)
    const baseTeaLevel = getEnhancingTeaLevelBonus(teas);
    const teaLevelBonus = baseTeaLevel > 0 ? baseTeaLevel * (1 + drinkConcentration / 100) : 0;

    // Get tea speed bonus (base, then scale with concentration)
    const baseTeaSpeed = getEnhancingTeaSpeedBonus(teas);
    const teaSpeedBonus = baseTeaSpeed > 0 ? baseTeaSpeed * (1 + drinkConcentration / 100) : 0;

    // Get tea wisdom bonus (base, then scale with concentration)
    // Wisdom Tea/Coffee provide 12% wisdom, scales with drink concentration
    let baseTeaWisdom = 0;
    if (drinkSlots && drinkSlots.length > 0) {
        for (const drink of drinkSlots) {
            if (!drink || !drink.itemHrid) continue;
            const drinkDetails = itemDetailMap[drink.itemHrid];
            if (!drinkDetails?.consumableDetail?.buffs) continue;

            const wisdomBuff = drinkDetails.consumableDetail.buffs.find(
                (buff) => buff.typeHrid === '/buff_types/wisdom'
            );

            if (wisdomBuff && wisdomBuff.flatBoost) {
                baseTeaWisdom += wisdomBuff.flatBoost * 100; // Convert to percentage
            }
        }
    }
    const teaWisdomBonus = baseTeaWisdom > 0 ? baseTeaWisdom * (1 + drinkConcentration / 100) : 0;

    // Get Enhancing skill level
    const enhancingSkill = skills?.find((s) => s.skillHrid === '/skills/enhancing');
    if (!enhancingSkill) {
        console.error('[EnhancementConfig] Skill not found: /skills/enhancing');
    }
    const enhancingLevel = enhancingSkill?.level || 1;

    // Get Observatory house room level (enhancing uses observatory, NOT laboratory!)
    const houseLevel = dataManager.getHouseRoomLevel('/house_rooms/observatory');

    // Calculate global house buffs from ALL house rooms
    // Rare Find: 0.2% base + 0.2% per level (per room, only if level >= 1)
    // Wisdom: 0.05% base + 0.05% per level (per room, only if level >= 1)
    const houseRooms = dataManager.getHouseRooms();
    let houseRareFindBonus = 0;
    let houseWisdomBonus = 0;

    for (const [_hrid, room] of houseRooms) {
        const level = room.level || 0;
        if (level >= 1) {
            // Each room: 0.2% per level (NOT 0.2% base + 0.2% per level)
            houseRareFindBonus += 0.2 * level;
            // Each room: 0.05% per level (NOT 0.05% base + 0.05% per level)
            houseWisdomBonus += 0.05 * level;
        }
    }

    // Get Enhancing Speed community buff level
    const communityBuffLevel = dataManager.getCommunityBuffLevel('/community_buff_types/enhancing_speed');
    // Formula: 20% base + 0.5% per level
    const communitySpeedBonus = communityBuffLevel > 0 ? 20 + (communityBuffLevel - 1) * 0.5 : 0;

    // Get Experience (Wisdom) community buff level
    const communityWisdomLevel = dataManager.getCommunityBuffLevel('/community_buff_types/experience');
    // Formula: 20% base + 0.5% per level (same as other community buffs)
    const communityWisdomBonus = communityWisdomLevel > 0 ? 20 + (communityWisdomLevel - 1) * 0.5 : 0;

    const achievementWisdomBonus =
        dataManager.getAchievementBuffFlatBoost('/action_types/enhancing', '/buff_types/wisdom') * 100;
    const achievementRareFindBonus =
        dataManager.getAchievementBuffFlatBoost('/action_types/enhancing', '/buff_types/rare_find') * 100;

    // Calculate total success rate bonus
    // Equipment + house + achievement
    const houseSuccessBonus = houseLevel * 0.05; // 0.05% per level for success
    const equipmentSuccessBonus = gear.toolBonus;
    const achievementSuccessBonus =
        dataManager.getAchievementBuffRatioBoost('/action_types/enhancing', '/buff_types/enhancing_success') * 100;
    const totalSuccessBonus = equipmentSuccessBonus + houseSuccessBonus + achievementSuccessBonus;

    // Calculate total speed bonus
    // Speed bonus (from equipment) + house bonus (1% per level) + community buff + tea speed
    const houseSpeedBonus = houseLevel * 1.0; // 1% per level for action speed
    const totalSpeedBonus = gear.speedBonus + houseSpeedBonus + communitySpeedBonus + teaSpeedBonus;

    // Calculate total experience bonus
    // Equipment + house wisdom + tea wisdom + community wisdom + achievement wisdom
    const totalExperienceBonus =
        gear.experienceBonus + houseWisdomBonus + teaWisdomBonus + communityWisdomBonus + achievementWisdomBonus;

    // Calculate guzzling bonus multiplier (1.0 at level 0, scales with drink concentration)
    const guzzlingBonus = 1 + drinkConcentration / 100;

    return {
        // Core values for calculations
        enhancingLevel: enhancingLevel + teaLevelBonus, // Base level + tea bonus
        houseLevel: houseLevel,
        toolBonus: totalSuccessBonus, // Tool + house combined
        speedBonus: totalSpeedBonus, // Speed + house + community + tea combined
        rareFindBonus: gear.rareFindBonus + houseRareFindBonus + achievementRareFindBonus, // Rare find (equipment + house rooms + achievements)
        experienceBonus: totalExperienceBonus, // Experience (equipment + house + tea + community wisdom)
        guzzlingBonus: guzzlingBonus, // Drink concentration multiplier for blessed tea
        teas: teas,

        // Display info (for UI) - show best item per slot
        toolSlot: gear.toolSlot,
        bodySlot: gear.bodySlot,
        legsSlot: gear.legsSlot,
        handsSlot: gear.handsSlot,
        detectedTeaBonus: teaLevelBonus,
        communityBuffLevel: communityBuffLevel, // For display (speed)
        communitySpeedBonus: communitySpeedBonus, // For display
        communityWisdomLevel: communityWisdomLevel, // For display
        communityWisdomBonus: communityWisdomBonus, // For display
        achievementWisdomBonus: achievementWisdomBonus, // For display
        teaSpeedBonus: teaSpeedBonus, // For display
        teaWisdomBonus: teaWisdomBonus, // For display
        drinkConcentration: drinkConcentration, // For display
        houseRareFindBonus: houseRareFindBonus, // For display
        achievementRareFindBonus: achievementRareFindBonus, // For display
        houseWisdomBonus: houseWisdomBonus, // For display
        equipmentRareFind: gear.rareFindBonus, // For display
        equipmentExperience: gear.experienceBonus, // For display
        equipmentSuccessBonus: equipmentSuccessBonus, // For display
        houseSuccessBonus: houseSuccessBonus, // For display
        achievementSuccessBonus: achievementSuccessBonus, // For display
        equipmentSpeedBonus: gear.speedBonus, // For display
        houseSpeedBonus: houseSpeedBonus, // For display
        slotBreakdown: gear.slotBreakdown || [], // Per-item breakdown for display
    };
}

/**
 * Detect current character's enhancing gear and return values mapped to setting keys.
 * Used by settings UI to populate gear inputs when auto-detect is toggled on.
 * @returns {Object} Map of settingId → detected value
 */
export function getDetectedGearSettings() {
    const equipment = dataManager.getEquipment();
    const skills = dataManager.getSkills();
    const drinkSlots = dataManager.getActionDrinkSlots('/action_types/enhancing');

    const result = {};

    // Enhancing level
    const enhancingSkill = skills?.find((s) => s.skillHrid === '/skills/enhancing');
    result.enhanceSim_enhancingLevel = enhancingSkill?.level || 1;

    // Observatory
    result.enhanceSim_houseLevel = dataManager.getHouseRoomLevel('/house_rooms/observatory');

    // Community buffs
    result.enhanceSim_communityBuff = dataManager.getCommunityBuffLevel('/community_buff_types/enhancing_speed');
    result.enhanceSim_communityBuffWisdom = dataManager.getCommunityBuffLevel('/community_buff_types/experience');

    // Achievement
    const achievementBonus = dataManager.getAchievementBuffRatioBoost(
        '/action_types/enhancing',
        '/buff_types/enhancing_success'
    );
    result.enhanceSim_achievement = achievementBonus > 0;

    // Tea detection
    const teaMap = {
        '/items/ultra_enhancing_tea': 'ultra',
        '/items/super_enhancing_tea': 'super',
        '/items/enhancing_tea': 'basic',
    };
    const WISDOM_TEA_HRIDS = ['/items/wisdom_tea', '/items/wisdom_coffee'];
    let detectedTea = 'none';
    let hasBlessed = false;
    let hasWisdom = false;
    if (drinkSlots) {
        for (const drink of drinkSlots) {
            if (!drink?.itemHrid) continue;
            if (teaMap[drink.itemHrid]) detectedTea = teaMap[drink.itemHrid];
            if (drink.itemHrid === '/items/blessed_tea') hasBlessed = true;
            if (WISDOM_TEA_HRIDS.includes(drink.itemHrid)) hasWisdom = true;
        }
    }
    result.enhanceSim_teaEnabled = detectedTea !== 'none';
    result.enhanceSim_tea = detectedTea === 'none' ? 'ultra' : detectedTea;
    result.enhanceSim_blessedTea = hasBlessed;
    result.enhanceSim_wisdomTea = hasWisdom;

    // Gear detection — match equipped items to known gear HRIDs
    const ENHANCER_HRIDS = {
        '/items/cheese_enhancer': 'cheese',
        '/items/verdant_enhancer': 'verdant',
        '/items/azure_enhancer': 'azure',
        '/items/burble_enhancer': 'burble',
        '/items/crimson_enhancer': 'crimson',
        '/items/rainbow_enhancer': 'rainbow',
        '/items/holy_enhancer': 'holy',
        '/items/celestial_enhancer': 'celestial',
    };
    const CAPE_HRIDS = {
        '/items/chance_cape': 'normal',
        '/items/chance_cape_refined': 'refined',
    };
    const CHARM_HRIDS = {
        '/items/trainee_enhancing_charm': 'trainee',
        '/items/basic_enhancing_charm': 'basic',
        '/items/advanced_enhancing_charm': 'advanced',
        '/items/expert_enhancing_charm': 'expert',
        '/items/master_enhancing_charm': 'master',
        '/items/grandmaster_enhancing_charm': 'grandmaster',
    };
    const FIXED_HRIDS = {
        '/items/enchanted_gloves': 'gloves',
        '/items/enhancers_top': 'top',
        '/items/enhancers_bottoms': 'bottoms',
        '/items/guzzling_pouch': 'guzzling',
    };
    const NECK_HRIDS = {
        '/items/philosophers_necklace': 'philo',
        '/items/necklace_of_speed': 'speed',
    };
    const RING_HRIDS = {
        '/items/philosophers_ring': 'philo',
        '/items/ring_of_rare_find': 'rarefind',
    };
    const EARRING_HRIDS = {
        '/items/philosophers_earrings': 'philo',
        '/items/earrings_of_rare_find': 'rarefind',
    };

    // Default all gear to disabled (not detected)
    result.enhanceSim_gear_enhancer = { enabled: false, tier: 'celestial', level: 0 };
    result.enhanceSim_gear_gloves = { enabled: false, level: 0 };
    result.enhanceSim_gear_top = { enabled: false, level: 0 };
    result.enhanceSim_gear_bottoms = { enabled: false, level: 0 };
    result.enhanceSim_gear_neck = { enabled: false, tier: 'philo', level: 0 };
    result.enhanceSim_gear_ring = { enabled: false, tier: 'philo', level: 0 };
    result.enhanceSim_gear_earring = { enabled: false, tier: 'philo', level: 0 };
    result.enhanceSim_gear_cape = { enabled: false, tier: 'normal', level: 0 };
    result.enhanceSim_gear_guzzling = { enabled: false, level: 0 };
    result.enhanceSim_gear_charm = { enabled: false, tier: 'grandmaster', level: 0 };

    if (equipment) {
        for (const item of equipment.values()) {
            if (!item?.itemHrid) continue;
            const hrid = item.itemHrid;
            const enhLevel = item.enhancementLevel || 0;

            if (ENHANCER_HRIDS[hrid]) {
                result.enhanceSim_gear_enhancer = { enabled: true, tier: ENHANCER_HRIDS[hrid], level: enhLevel };
            } else if (CAPE_HRIDS[hrid]) {
                result.enhanceSim_gear_cape = { enabled: true, tier: CAPE_HRIDS[hrid], level: enhLevel };
            } else if (CHARM_HRIDS[hrid]) {
                result.enhanceSim_gear_charm = { enabled: true, tier: CHARM_HRIDS[hrid], level: enhLevel };
            } else if (NECK_HRIDS[hrid]) {
                result.enhanceSim_gear_neck = { enabled: true, tier: NECK_HRIDS[hrid], level: enhLevel };
            } else if (RING_HRIDS[hrid]) {
                result.enhanceSim_gear_ring = { enabled: true, tier: RING_HRIDS[hrid], level: enhLevel };
            } else if (EARRING_HRIDS[hrid]) {
                result.enhanceSim_gear_earring = { enabled: true, tier: EARRING_HRIDS[hrid], level: enhLevel };
            } else if (FIXED_HRIDS[hrid]) {
                const slot = FIXED_HRIDS[hrid];
                result[`enhanceSim_gear_${slot}`] = { enabled: true, level: enhLevel };
            }
        }
    }

    return result;
}

/**
 * Get manual enhancing parameters from gear-based config settings
 * @returns {Object} Manual parameters
 */
function getManualParams() {
    const getValue = (key, defaultValue) => {
        return config.getSettingValue(key, defaultValue);
    };

    const itemDetailMap = dataManager.getInitClientData()?.itemDetailMap || {};

    // --- ENHANCING ---
    const houseLevel = getValue('enhanceSim_houseLevel', 8);
    const baseEnhancingLevel = getValue('enhanceSim_enhancingLevel', 140);

    // --- TEA ---
    const teaEnabled = getValue('enhanceSim_teaEnabled', true);
    const teaSelection = teaEnabled ? getValue('enhanceSim_tea', 'ultra') : 'none';
    const wisdomTeaEnabled = getValue('enhanceSim_wisdomTea', true);
    const teas = {
        enhancing: teaSelection === 'basic',
        superEnhancing: teaSelection === 'super',
        ultraEnhancing: teaSelection === 'ultra',
        blessed: getValue('enhanceSim_blessedTea', true),
        wisdom: wisdomTeaEnabled,
    };
    const teaLevelBonus =
        teaSelection === 'ultra' ? 8 : teaSelection === 'super' ? 6 : teaSelection === 'basic' ? 3 : 0;
    const teaSpeedBonus =
        teaSelection === 'ultra' ? 6 : teaSelection === 'super' ? 4 : teaSelection === 'basic' ? 2 : 0;

    // --- GEAR ---
    const ENHANCER_TIERS = {
        cheese: '/items/cheese_enhancer',
        verdant: '/items/verdant_enhancer',
        azure: '/items/azure_enhancer',
        burble: '/items/burble_enhancer',
        crimson: '/items/crimson_enhancer',
        rainbow: '/items/rainbow_enhancer',
        holy: '/items/holy_enhancer',
        celestial: '/items/celestial_enhancer',
    };
    const CAPE_TIERS = {
        normal: '/items/chance_cape',
        refined: '/items/chance_cape_refined',
    };
    const CHARM_TIERS = {
        trainee: '/items/trainee_enhancing_charm',
        basic: '/items/basic_enhancing_charm',
        advanced: '/items/advanced_enhancing_charm',
        expert: '/items/expert_enhancing_charm',
        master: '/items/master_enhancing_charm',
        grandmaster: '/items/grandmaster_enhancing_charm',
    };
    const FIXED_GEAR = {
        gloves: '/items/enchanted_gloves',
        top: '/items/enhancers_top',
        bottoms: '/items/enhancers_bottoms',
        guzzling: '/items/guzzling_pouch',
    };
    const NECK_TIERS = {
        philo: '/items/philosophers_necklace',
        speed: '/items/necklace_of_speed',
    };
    const RING_TIERS = {
        philo: '/items/philosophers_ring',
        rarefind: '/items/ring_of_rare_find',
    };
    const EARRING_TIERS = {
        philo: '/items/philosophers_earrings',
        rarefind: '/items/earrings_of_rare_find',
    };

    // Helper to read compound gear setting
    const getGear = (key, defaults) => {
        const val = getValue(key, defaults);
        // Handle both object (new format) and missing/null
        if (val && typeof val === 'object') return val;
        return defaults;
    };

    // Calculate bonuses from each gear slot
    let equipmentSuccessBonus = 0;
    let equipmentSpeedBonus = 0;
    let equipmentRareFind = 0;
    let equipmentExperience = 0;
    let drinkConcentration = 0;
    const slotBreakdown = [];

    // Enhancer
    const enhancer = getGear('enhanceSim_gear_enhancer', { enabled: true, tier: 'celestial', level: 13 });
    if (enhancer.enabled) {
        const hrid = ENHANCER_TIERS[enhancer.tier] || ENHANCER_TIERS.celestial;
        const bonus = getGearSlotBonus(hrid, enhancer.level, itemDetailMap);
        equipmentSuccessBonus += bonus.success;
        equipmentSpeedBonus += bonus.speed;
        equipmentRareFind += bonus.rareFind;
        equipmentExperience += bonus.experience;
        const details = itemDetailMap[hrid];
        slotBreakdown.push({
            name: details?.name || 'Enhancer',
            enhancementLevel: enhancer.level,
            success: bonus.success,
            speed: bonus.speed,
            rareFind: bonus.rareFind,
            experience: bonus.experience,
        });
    }

    // Gloves
    const gloves = getGear('enhanceSim_gear_gloves', { enabled: true, level: 10 });
    if (gloves.enabled) {
        const bonus = getGearSlotBonus(FIXED_GEAR.gloves, gloves.level, itemDetailMap);
        equipmentSpeedBonus += bonus.speed;
        equipmentExperience += bonus.experience;
        const details = itemDetailMap[FIXED_GEAR.gloves];
        slotBreakdown.push({
            name: details?.name || 'Gloves',
            enhancementLevel: gloves.level,
            success: 0,
            speed: bonus.speed,
            rareFind: 0,
            experience: bonus.experience,
        });
    }

    // Top
    const top = getGear('enhanceSim_gear_top', { enabled: true, level: 10 });
    if (top.enabled) {
        const bonus = getGearSlotBonus(FIXED_GEAR.top, top.level, itemDetailMap);
        equipmentSpeedBonus += bonus.speed;
        equipmentRareFind += bonus.rareFind;
        equipmentExperience += bonus.experience;
        const details = itemDetailMap[FIXED_GEAR.top];
        slotBreakdown.push({
            name: details?.name || 'Top',
            enhancementLevel: top.level,
            success: 0,
            speed: bonus.speed,
            rareFind: bonus.rareFind,
            experience: bonus.experience,
        });
    }

    // Bottoms
    const bottoms = getGear('enhanceSim_gear_bottoms', { enabled: true, level: 10 });
    if (bottoms.enabled) {
        const bonus = getGearSlotBonus(FIXED_GEAR.bottoms, bottoms.level, itemDetailMap);
        equipmentSpeedBonus += bonus.speed;
        equipmentExperience += bonus.experience;
        const details = itemDetailMap[FIXED_GEAR.bottoms];
        slotBreakdown.push({
            name: details?.name || 'Bottoms',
            enhancementLevel: bottoms.level,
            success: 0,
            speed: bonus.speed,
            rareFind: 0,
            experience: bonus.experience,
        });
    }

    // Neck
    const neck = getGear('enhanceSim_gear_neck', { enabled: true, tier: 'philo', level: 10 });
    if (neck.enabled) {
        const hrid = NECK_TIERS[neck.tier] || NECK_TIERS.philo;
        const bonus = getGearSlotBonus(hrid, neck.level, itemDetailMap);
        equipmentSpeedBonus += bonus.speed;
        equipmentRareFind += bonus.rareFind;
        equipmentExperience += bonus.experience;
        const details = itemDetailMap[hrid];
        slotBreakdown.push({
            name: details?.name || 'Necklace',
            enhancementLevel: neck.level,
            success: 0,
            speed: bonus.speed,
            rareFind: bonus.rareFind,
            experience: bonus.experience,
        });
    }

    // Ring
    const ring = getGear('enhanceSim_gear_ring', { enabled: true, tier: 'philo', level: 10 });
    if (ring.enabled) {
        const hrid = RING_TIERS[ring.tier] || RING_TIERS.philo;
        const bonus = getGearSlotBonus(hrid, ring.level, itemDetailMap);
        equipmentSpeedBonus += bonus.speed;
        equipmentRareFind += bonus.rareFind;
        equipmentExperience += bonus.experience;
        const details = itemDetailMap[hrid];
        slotBreakdown.push({
            name: details?.name || 'Ring',
            enhancementLevel: ring.level,
            success: 0,
            speed: bonus.speed,
            rareFind: bonus.rareFind,
            experience: bonus.experience,
        });
    }

    // Earring
    const earring = getGear('enhanceSim_gear_earring', { enabled: true, tier: 'philo', level: 10 });
    if (earring.enabled) {
        const hrid = EARRING_TIERS[earring.tier] || EARRING_TIERS.philo;
        const bonus = getGearSlotBonus(hrid, earring.level, itemDetailMap);
        equipmentSpeedBonus += bonus.speed;
        equipmentRareFind += bonus.rareFind;
        equipmentExperience += bonus.experience;
        const details = itemDetailMap[hrid];
        slotBreakdown.push({
            name: details?.name || 'Earrings',
            enhancementLevel: earring.level,
            success: 0,
            speed: bonus.speed,
            rareFind: bonus.rareFind,
            experience: bonus.experience,
        });
    }

    // Cape
    const cape = getGear('enhanceSim_gear_cape', { enabled: true, tier: 'normal', level: 5 });
    if (cape.enabled) {
        const hrid = CAPE_TIERS[cape.tier] || CAPE_TIERS.normal;
        const bonus = getGearSlotBonus(hrid, cape.level, itemDetailMap);
        equipmentSpeedBonus += bonus.speed;
        equipmentExperience += bonus.experience;
        const details = itemDetailMap[hrid];
        slotBreakdown.push({
            name: details?.name || 'Cape',
            enhancementLevel: cape.level,
            success: 0,
            speed: bonus.speed,
            rareFind: 0,
            experience: bonus.experience,
        });
    }

    // Guzzling Pouch (provides drink concentration)
    const guzzling = getGear('enhanceSim_gear_guzzling', { enabled: true, level: 10 });
    if (guzzling.enabled) {
        const bonus = getGearSlotBonus(FIXED_GEAR.guzzling, guzzling.level, itemDetailMap);
        drinkConcentration = bonus.drinkConc;
    }

    // Charm (provides experience/wisdom bonus)
    const charm = getGear('enhanceSim_gear_charm', { enabled: true, tier: 'grandmaster', level: 0 });
    if (charm.enabled) {
        const hrid = CHARM_TIERS[charm.tier] || CHARM_TIERS.grandmaster;
        const bonus = getGearSlotBonus(hrid, charm.level, itemDetailMap);
        equipmentExperience += bonus.experience;
        const details = itemDetailMap[hrid];
        slotBreakdown.push({
            name: details?.name || 'Charm',
            enhancementLevel: charm.level,
            success: 0,
            speed: 0,
            rareFind: 0,
            experience: bonus.experience,
        });
    }

    // --- COMMUNITY BUFF ---
    const communityBuffLevel = getValue('enhanceSim_communityBuff', 0);
    const communitySpeedBonus = communityBuffLevel > 0 ? 20 + (communityBuffLevel - 1) * 0.5 : 0;

    // --- ACHIEVEMENT ---
    const achievementEnabled = getValue('enhanceSim_achievement', false);
    const achievementSuccessBonus = achievementEnabled ? 0.2 : 0;

    // --- HOUSE BONUSES ---
    const houseSpeedBonus = houseLevel * 1.0;
    const houseSuccessBonus = houseLevel * 0.05;

    // House wisdom: 0.05% per level per room (same as auto-detect)
    const houseRooms = dataManager.getHouseRooms();
    let houseWisdomBonus = 0;
    for (const [_hrid, room] of houseRooms) {
        const level = room.level || 0;
        if (level >= 1) {
            houseWisdomBonus += 0.05 * level;
        }
    }

    // --- SCALE TEA BONUSES WITH DRINK CONCENTRATION ---
    const scaledTeaLevelBonus = teaLevelBonus > 0 ? teaLevelBonus * (1 + drinkConcentration / 100) : 0;
    const scaledTeaSpeedBonus = teaSpeedBonus > 0 ? teaSpeedBonus * (1 + drinkConcentration / 100) : 0;

    // Tea wisdom bonus (Wisdom Tea/Coffee provide 12% wisdom, scales with drink concentration)
    const baseTeaWisdom = wisdomTeaEnabled ? 12 : 0;
    const teaWisdomBonus = baseTeaWisdom > 0 ? baseTeaWisdom * (1 + drinkConcentration / 100) : 0;

    // Community wisdom buff
    const communityWisdomLevel = getValue('enhanceSim_communityBuffWisdom', 0);
    const communityWisdomBonus = communityWisdomLevel > 0 ? 20 + (communityWisdomLevel - 1) * 0.5 : 0;

    // Achievement wisdom buff
    const achievementWisdomBonus =
        dataManager.getAchievementBuffFlatBoost('/action_types/enhancing', '/buff_types/wisdom') * 100;

    // --- TOTALS ---
    const totalToolBonus = equipmentSuccessBonus + houseSuccessBonus + achievementSuccessBonus;
    const totalSpeedBonus = equipmentSpeedBonus + houseSpeedBonus + communitySpeedBonus + scaledTeaSpeedBonus;
    const totalExperienceBonus =
        equipmentExperience + houseWisdomBonus + teaWisdomBonus + communityWisdomBonus + achievementWisdomBonus;
    const guzzlingBonus = 1 + drinkConcentration / 100;

    return {
        enhancingLevel: baseEnhancingLevel + scaledTeaLevelBonus,
        houseLevel: houseLevel,
        toolBonus: totalToolBonus,
        speedBonus: totalSpeedBonus,
        rareFindBonus: equipmentRareFind,
        experienceBonus: totalExperienceBonus,
        guzzlingBonus: guzzlingBonus,
        teas: teas,

        // Display info for manual mode
        toolSlot: null,
        bodySlot: null,
        legsSlot: null,
        handsSlot: null,
        detectedTeaBonus: scaledTeaLevelBonus,
        communityBuffLevel: communityBuffLevel,
        communitySpeedBonus: communitySpeedBonus,
        teaSpeedBonus: scaledTeaSpeedBonus,
        equipmentSpeedBonus: equipmentSpeedBonus,
        houseSpeedBonus: houseSpeedBonus,
        equipmentSuccessBonus: equipmentSuccessBonus,
        houseSuccessBonus: houseSuccessBonus,
        achievementSuccessBonus: achievementSuccessBonus,
        slotBreakdown: slotBreakdown,
    };
}

/**
 * Calculate enhancing bonuses from a single gear slot
 * @param {string} itemHrid - Item HRID
 * @param {number} enhancementLevel - Enhancement level (0-20)
 * @param {Object} itemDetailMap - Item details map
 * @returns {Object} { success, speed, rareFind, experience, drinkConc }
 */
function getGearSlotBonus(itemHrid, enhancementLevel, itemDetailMap) {
    const itemDetails = itemDetailMap[itemHrid];
    if (!itemDetails) return { success: 0, speed: 0, rareFind: 0, experience: 0, drinkConc: 0 };

    const multiplier = getEnhancementMultiplier(itemDetails, enhancementLevel);
    const stats = itemDetails.equipmentDetail?.noncombatStats || {};

    return {
        success: (stats.enhancingSuccess || 0) * 100 * multiplier,
        speed: ((stats.enhancingSpeed || 0) + (stats.skillingSpeed || 0)) * 100 * multiplier,
        rareFind: ((stats.enhancingRareFind || 0) + (stats.skillingRareFind || 0)) * 100 * multiplier,
        experience: ((stats.enhancingExperience || 0) + (stats.skillingExperience || 0)) * 100 * multiplier,
        drinkConc: (stats.drinkConcentration || 0) * 100 * multiplier,
    };
}

/**
 * Upgrade Advisor for Combat Sim
 *
 * Generates equipment upgrade candidates, calculates their costs,
 * and runs simulations to rank them by "Gold per 0.01% improvement".
 */

import dataManager from '../../core/data-manager.js';
import { buildGameDataPayload, calculateSimRevenue } from './combat-sim-adapter.js';
import { runSimulation, runLabyrinthSimulation, getMaxBatchWorkers } from './combat-sim-runner.js';
import labyrinthClearRate from '../combat/labyrinth-clear-rate.js';
import { resolveItemPrice } from '../../utils/profit-helpers.js';
import { getItemPrices } from '../../utils/market-data.js';
import { calculateEnhancement } from '../../utils/enhancement-calculator.js';
import { getEnhancingParams, getAutoDetectedParams } from '../../utils/enhancement-config.js';
import { getCheapestProtectionPrice, getProductionCost } from '../enhancement/tooltip-enhancement.js';
import { calculateAbilityLevelUpCost } from '../../utils/ability-cost-calculator.js';
import { buildOverridesForSkill } from './skilling-sim-helpers.js';

/** Enhancement breakpoints by slot type */
const BREAKPOINTS_DEFAULT = [7, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const BREAKPOINTS_JEWELRY = [5, 7, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const BREAKPOINTS_BACK = [3, 5, 7, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const BREAKPOINTS_REFINED = [10, 12, 13, 14, 15, 16, 17, 18, 19, 20];

const JEWELRY_SLOTS = new Set(['/equipment_types/earrings', '/equipment_types/ring', '/equipment_types/neck']);

// Abilities with no effect worth simulating in the Labyrinth/Combat Sim: Promote is a
// monster-only mechanic (chess-piece "Enchanted" monsters promoting to Rook/Knight/Bishop, see
// combat-simulator.js's processAbilityPromoteEffect) that isn't actually player-equippable, but
// still shows up in abilityDetailMap with no ability-book requirement to filter it out.
// Revive/Taunt/Provoke target party members or aggro mechanics that don't exist in a solo sim,
// and Quick Aid/Rejuvenate heal a party member other than the caster — never worth an
// ability-swap/optimize slot.
const SIM_USELESS_ABILITY_HRIDS = new Set([
    '/abilities/promote',
    '/abilities/revive',
    '/abilities/taunt',
    '/abilities/provoke',
    '/abilities/quick_aid',
    '/abilities/rejuvenate',
]);

/**
 * Get the next ability level target (next multiple of 10) above the current level.
 * Used as fallback when no explicit target level is provided.
 * @param {number} currentLevel - Current ability level
 * @returns {number|null} Next target level, or null if at max (200)
 */
function getNextAbilityBreakpoint(currentLevel) {
    const next = Math.ceil((currentLevel + 1) / 10) * 10;
    return next <= 200 ? next : null;
}

/**
 * Get the next enhancement breakpoint above the current level.
 * Uses slot-specific breakpoints: jewelry gets +5, back gets +3/+5,
 * refined items always start at +10 minimum.
 * @param {number} currentLevel - Current enhancement level
 * @param {string} slot - Equipment slot HRID
 * @param {string} itemHrid - Item HRID (used to detect refined items)
 * @returns {number|null} Next breakpoint level, or null if already at max
 */
function getNextBreakpoint(currentLevel, slot, itemHrid) {
    let breakpoints;
    if (itemHrid.includes('_refined')) {
        breakpoints = BREAKPOINTS_REFINED;
    } else if (JEWELRY_SLOTS.has(slot)) {
        breakpoints = BREAKPOINTS_JEWELRY;
    } else if (slot === '/equipment_types/back') {
        breakpoints = BREAKPOINTS_BACK;
    } else {
        breakpoints = BREAKPOINTS_DEFAULT;
    }

    for (const bp of breakpoints) {
        if (bp > currentLevel) return bp;
    }
    return null;
}

/**
 * Get the highest enhancement breakpoint affordable within a coin budget, rather than
 * just the next single breakpoint — so if the budget covers a jump straight to a
 * higher tier, that's what gets suggested.
 * @param {number} currentLevel - Current enhancement level
 * @param {string} slot - Equipment slot HRID
 * @param {string} itemHrid - Item HRID
 * @param {Object} gameData
 * @param {number} budget - Coin budget
 * @returns {number|null} Highest affordable breakpoint level, or null if none affordable
 */
function getBudgetMatchedBreakpoint(currentLevel, slot, itemHrid, gameData, budget) {
    let breakpoints;
    if (itemHrid.includes('_refined')) {
        breakpoints = BREAKPOINTS_REFINED;
    } else if (JEWELRY_SLOTS.has(slot)) {
        breakpoints = BREAKPOINTS_JEWELRY;
    } else if (slot === '/equipment_types/back') {
        breakpoints = BREAKPOINTS_BACK;
    } else {
        breakpoints = BREAKPOINTS_DEFAULT;
    }

    let best = null;
    for (const bp of breakpoints) {
        if (bp <= currentLevel) continue;
        const cost = calculateEnhancementCost(itemHrid, currentLevel, bp, gameData, { slot });
        // Cost is monotonically non-decreasing with level, so the first unaffordable
        // breakpoint means every subsequent one is unaffordable too.
        if (cost <= budget) {
            best = bp;
        } else {
            break;
        }
    }
    return best;
}

/**
 * Get the highest enhancement level of an item that's both listed on the market and
 * affordable within budget. A tier-replacement candidate should only ever generate
 * ONE row per item — the best level actually worth buying — not a separate row per
 * +0/+X level of the same item.
 * @param {string} hrid - Item HRID
 * @param {number} budget - Coin budget
 * @returns {number} Highest affordable enhancement level with a market listing, or 0
 */
function getBudgetMatchedItemLevel(hrid, budget) {
    let bestLevel = -1;
    for (let level = 0; level <= 20; level++) {
        const market = getItemPrices(hrid, level);
        if (!market || !(market.ask > 0)) continue;
        if (market.ask <= budget) {
            bestLevel = level;
        }
    }
    return Math.max(bestLevel, 0);
}

/**
 * Get the player's primary combat style from their weapon.
 * @param {Object} playerDTO
 * @param {Object} gameData
 * @returns {string} e.g., 'slash', 'stab', 'smash', 'ranged', 'magic'
 */
function getPlayerCombatStyle(playerDTO, gameData) {
    const weapon =
        playerDTO.equipment['/equipment_types/main_hand'] || playerDTO.equipment['/equipment_types/two_hand'];
    if (!weapon) return 'unknown';
    const weaponDetails = gameData.itemDetailMap[weapon.hrid];
    const stats = weaponDetails?.equipmentDetail?.combatStats;
    if (!stats) return 'unknown';

    if (stats.rangedDamage > 0) return 'ranged';
    if (stats.magicDamage > 0) return 'magic';
    if (stats.stabDamage > 0) return 'stab';
    if (stats.slashDamage > 0) return 'slash';
    if (stats.smashDamage > 0) return 'smash';
    return 'unknown';
}

/**
 * Get the combat style of an ability from its effects.
 * Uses combatStyleHrid for damage abilities, buff typeHrid/skill multipliers for buffs.
 * @param {Object} abilityDetail - From abilityDetailMap
 * @returns {string} 'stab', 'slash', 'smash', 'ranged', 'magic', 'melee', 'physical', or 'universal'
 */
function getAbilityCombatStyle(abilityDetail) {
    // Check for direct combat style on damage/heal effects
    for (const effect of abilityDetail.abilityEffects || []) {
        if (effect.combatStyleHrid) {
            return effect.combatStyleHrid.split('/').pop();
        }
    }

    // For buff abilities, analyze buff types and skill multipliers
    const buffTypes = new Set();
    const skillMultipliers = new Set();

    for (const effect of abilityDetail.abilityEffects || []) {
        if (effect.effectType?.includes('heal')) return 'universal';
        if (!effect.buffs) continue;
        for (const buff of effect.buffs) {
            if (buff.typeHrid) buffTypes.add(buff.typeHrid);
            if (buff.multiplierForSkillHrid) skillMultipliers.add(buff.multiplierForSkillHrid);
        }
    }

    // Skill multiplier is the strongest signal
    if (skillMultipliers.has('/skills/magic')) return 'magic';
    if (skillMultipliers.has('/skills/melee')) return 'melee';
    if (skillMultipliers.has('/skills/ranged')) return 'ranged';

    // Buff type analysis
    const hasElementalAmp =
        buffTypes.has('/buff_types/water_amplify') ||
        buffTypes.has('/buff_types/nature_amplify') ||
        buffTypes.has('/buff_types/fire_amplify');
    if (hasElementalAmp) return 'magic';

    const hasPhysicalAmp = buffTypes.has('/buff_types/physical_amplify');
    if (hasPhysicalAmp) return 'physical';

    // Attack speed without cast speed = physical only
    const hasAttackSpeed = buffTypes.has('/buff_types/attack_speed');
    const hasCastSpeed = buffTypes.has('/buff_types/cast_speed');
    if (hasAttackSpeed && !hasCastSpeed) return 'physical';

    // Universal buffs: attack_speed+cast_speed, damage, accuracy, evasion, armor, thorns, etc.
    return 'universal';
}

/** Intelligence level required to unlock the 2nd, 3rd, and 4th normal ability slots. */
const ABILITY_SLOT_INT_REQUIREMENTS = { 2: 20, 3: 50, 4: 90 };

/**
 * Generate all orderings of an array's elements (order matters, no repeated picks).
 * Used to enumerate ability-slot arrangements — capped by callers to a handful of
 * items (4! = 24) since this is naive O(n!) recursion.
 * @param {Array} arr
 * @returns {Array<Array>}
 */
function permute(arr) {
    if (arr.length <= 1) return [arr];
    const result = [];
    for (let i = 0; i < arr.length; i++) {
        const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
        for (const rest_perm of permute(rest)) {
            result.push([arr[i], ...rest_perm]);
        }
    }
    return result;
}

/**
 * Check whether an ability slot is unlocked for the player.
 * Slots 0-1 (special + first normal slot) are always available. Slots 2, 3,
 * and 4 (2nd/3rd/4th normal ability slots) require Intelligence 20 / 50 / 90.
 * @param {number} slotIdx - 0 = special ability, 1-4 = normal ability slots
 * @param {Object} playerDTO
 * @returns {boolean}
 */
function isAbilitySlotUnlocked(slotIdx, playerDTO) {
    const req = ABILITY_SLOT_INT_REQUIREMENTS[slotIdx];
    if (req === undefined) return true;
    return (playerDTO.intelligenceLevel || 0) >= req;
}

/**
 * Build a map of the player's live skill levels keyed by raw skillHrid (not the
 * DTO's derived field names), so it can be compared directly against requirement
 * lists that also key by skillHrid without guessing a naming convention.
 * @param {number} [levelBoost=0] - Levels to add to every skill, for planning future
 *  upgrades against a hypothetical "current level + X" (e.g. "what could I equip 10
 *  levels from now").
 * @returns {Map<string, number>} skillHrid -> level
 */
function getCharacterSkillLevelMap(levelBoost = 0) {
    const map = new Map();
    // dataManager.characterSkills is kept live-updated by the skills_updated websocket handler;
    // characterData.characterSkills is only a one-time snapshot from login/character-init and
    // goes stale the moment a skill levels up during the session.
    const skills = dataManager.characterSkills || dataManager.characterData?.characterSkills || [];
    for (const skill of skills) {
        if (skill?.skillHrid) map.set(skill.skillHrid, (skill.level || 0) + levelBoost);
    }
    return map;
}

/** Combat skill hrid -> matching field name on a player DTO. */
const DTO_SKILL_FIELDS = {
    '/skills/stamina': 'staminaLevel',
    '/skills/intelligence': 'intelligenceLevel',
    '/skills/attack': 'attackLevel',
    '/skills/melee': 'meleeLevel',
    '/skills/defense': 'defenseLevel',
    '/skills/ranged': 'rangedLevel',
    '/skills/magic': 'magicLevel',
};

/**
 * Build a skill-level map from a player DTO's own combat-skill fields, falling back to the
 * live character's skills for anything the DTO doesn't carry (non-combat skills). Requirement
 * checks (ability books, equipment) must use this instead of the live character's skills
 * whenever the DTO being planned against has simulated/edited stats — otherwise editing a
 * stat in the sim editor's Config tab silently has no effect on what abilities/equipment are
 * considered available.
 * @param {Object} playerDTO
 * @param {number} [levelBoost=0] - Levels to add on top of the DTO's own combat-skill values,
 *  for planning upgrades reachable X levels from now.
 * @returns {Map<string, number>} skillHrid -> level
 */
function getSkillLevelMapFromDTO(playerDTO, levelBoost = 0) {
    const map = getCharacterSkillLevelMap(levelBoost);
    for (const [skillHrid, field] of Object.entries(DTO_SKILL_FIELDS)) {
        if (playerDTO[field] != null) map.set(skillHrid, playerDTO[field] + levelBoost);
    }
    return map;
}

/**
 * Check whether the player's skills meet an ability book's level requirements
 * (e.g. a book requiring 50 Melee can't be learned/equipped below that level).
 * @param {string} abilityHrid
 * @param {Map<string, number>} skillLevelMap - From getCharacterSkillLevelMap()
 * @param {Object} gameData
 * @returns {boolean}
 */
function meetsAbilityBookRequirements(abilityHrid, skillLevelMap, gameData) {
    const bookHrid = abilityHrid.replace('/abilities/', '/items/');
    const reqs = gameData.itemDetailMap[bookHrid]?.abilityBookDetail?.levelRequirements;
    if (!reqs || reqs.length === 0) return true;

    for (const req of reqs) {
        if (!req.skillHrid) continue;
        const playerLevel = skillLevelMap.get(req.skillHrid) ?? 0;
        if (playerLevel < (req.level || 0)) return false;
    }
    return true;
}

/**
 * Check whether the player's skills meet an equippable item's level requirements
 * (e.g. armor requiring 50 Defense can't be equipped below that level).
 * @param {string} itemHrid
 * @param {Map<string, number>} skillLevelMap - From getCharacterSkillLevelMap()
 * @param {Object} gameData
 * @returns {boolean}
 */
function meetsItemLevelRequirements(itemHrid, skillLevelMap, gameData) {
    const reqs = gameData.itemDetailMap[itemHrid]?.equipmentDetail?.levelRequirements;
    if (!reqs || reqs.length === 0) return true;

    for (const req of reqs) {
        if (!req.skillHrid) continue;
        const playerLevel = skillLevelMap.get(req.skillHrid) ?? 0;
        if (playerLevel < (req.level || 0)) return false;
    }
    return true;
}

/**
 * Get the map of all abilities the player has ever learned (equipped or not) to their level.
 * @returns {Map<string, number>} abilityHrid -> level
 */
function getLearnedAbilityLevels() {
    const learned = new Map();
    for (const ab of dataManager.characterData?.characterAbilities || []) {
        if (ab?.abilityHrid) learned.set(ab.abilityHrid, ab.level || 0);
    }
    return learned;
}

/**
 * Average coin cost of the XP currently invested across the player's equipped abilities.
 * Used as a "fair" spending budget for sizing swap candidates that aren't equipped.
 * @param {Object} playerDTO
 * @returns {number} Average coin cost, or 0 if no equipped abilities / no price data
 */
function getAverageEquippedAbilityCost(playerDTO) {
    let total = 0;
    let count = 0;
    for (const ability of playerDTO.abilities) {
        if (!ability) continue;
        total += calculateAbilityLevelUpCost(ability.hrid, 0, 0, ability.level);
        count++;
    }
    return count > 0 ? total / count : 0;
}

/**
 * Find the highest ability level whose training cost (from level 0) doesn't exceed budget.
 * Cost is monotonically non-decreasing with level, so a linear scan is safe and cheap
 * (levels are capped at 200).
 * @param {string} abilityHrid
 * @param {number} budget - Coin budget
 * @returns {number} Level (at least 1)
 */
function getBudgetMatchedAbilityLevel(abilityHrid, budget) {
    if (budget <= 0) return 1;
    let bestLevel = 1;
    for (let level = 1; level <= 200; level++) {
        const cost = calculateAbilityLevelUpCost(abilityHrid, 0, 0, level);
        if (cost <= budget) {
            bestLevel = level;
        } else {
            break;
        }
    }
    return bestLevel;
}

/**
 * Find the highest level reachable from an ability's current level/xp by spending
 * no more than budget on the incremental training cost. Used to build an
 * apples-to-apples "what if I spent that same money leveling this ability
 * further instead of swapping" comparison.
 * @param {string} abilityHrid
 * @param {number} currentLevel
 * @param {number} currentXp
 * @param {number} budget - Coin budget
 * @returns {number} Level (at least currentLevel)
 */
function getBudgetMatchedLevelFromCurrent(abilityHrid, currentLevel, currentXp, budget) {
    if (budget <= 0) return currentLevel;
    let bestLevel = currentLevel;
    for (let level = currentLevel + 1; level <= 200; level++) {
        const cost = calculateAbilityLevelUpCost(abilityHrid, currentLevel, currentXp, level);
        if (cost <= budget) {
            bestLevel = level;
        } else {
            break;
        }
    }
    return bestLevel;
}

/**
 * Check if an ability is compatible with a player's weapon style.
 * @param {string} abilityStyle - From getAbilityCombatStyle()
 * @param {string} weaponStyle - From getPlayerCombatStyle()
 * @returns {boolean}
 */
const ELEMENTAL_DAMAGE_TYPE_LABELS = {
    '/damage_types/fire': 'Fire',
    '/damage_types/water': 'Water',
    '/damage_types/nature': 'Nature',
};

/**
 * Find same-tier magic weapons that differ only by element (damageType), for a given equipped
 * magic weapon. Magic item names/hrids don't encode element in a parseable way (e.g. "Crimson
 * Staff" vs "Azure Staff"), so siblings are matched by identical magicDamage/magicAccuracy and
 * level requirement, differing only in combatStats.damageType.
 * @param {string} weaponHrid
 * @param {Object} gameData
 * @returns {Array<{hrid: string, damageType: string}>} Includes the original weapon itself.
 */
function getElementalWeaponVariants(weaponHrid, gameData) {
    const base = gameData.itemDetailMap[weaponHrid];
    const baseStats = base?.equipmentDetail?.combatStats;
    if (!baseStats || !ELEMENTAL_DAMAGE_TYPE_LABELS[baseStats.damageType]) return [];

    const slot = base.equipmentDetail.type;
    const baseLevelReq =
        (base.equipmentDetail.levelRequirements || []).find((r) => r.skillHrid === '/skills/magic')?.level ?? null;

    const variants = [{ hrid: weaponHrid, damageType: baseStats.damageType }];
    for (const [hrid, detail] of Object.entries(gameData.itemDetailMap)) {
        if (hrid === weaponHrid) continue;
        const stats = detail?.equipmentDetail?.combatStats;
        if (!stats || detail.equipmentDetail.type !== slot) continue;
        if (!ELEMENTAL_DAMAGE_TYPE_LABELS[stats.damageType] || stats.damageType === baseStats.damageType) continue;
        if (Math.abs((stats.magicDamage || 0) - (baseStats.magicDamage || 0)) > 0.01) continue;
        if (Math.abs((stats.magicAccuracy || 0) - (baseStats.magicAccuracy || 0)) > 0.01) continue;
        const levelReq =
            (detail.equipmentDetail.levelRequirements || []).find((r) => r.skillHrid === '/skills/magic')?.level ??
            null;
        if (levelReq !== baseLevelReq) continue;
        variants.push({ hrid, damageType: stats.damageType });
    }
    return variants;
}

/**
 * Compare two labyrinth sim results to decide whether `candidate` is an improvement over
 * `baseline`. Win rate is the primary signal, but when a monster can't be cleared at all yet
 * (both tie, typically at 0%), win rate alone can't distinguish weapons/gear that are actually
 * doing more damage or dying less from ones that aren't — so this falls back to total damage
 * dealt, then fewer deaths, letting an equipment search still surface which loadout best exploits
 * a monster's weaknesses even before it's beatable.
 * @param {{winRate: number, totalDamageDealt?: number, deaths?: number}} candidate
 * @param {{winRate: number, totalDamageDealt?: number, deaths?: number}} baseline
 * @returns {boolean}
 */
export function isLabyrinthResultBetter(candidate, baseline) {
    if (candidate.winRate !== baseline.winRate) return candidate.winRate > baseline.winRate;
    const candidateDamage = candidate.totalDamageDealt || 0;
    const baselineDamage = baseline.totalDamageDealt || 0;
    if (candidateDamage !== baselineDamage) return candidateDamage > baselineDamage;
    return (candidate.deaths ?? Infinity) < (baseline.deaths ?? Infinity);
}

function isAbilityCompatible(abilityStyle, weaponStyle) {
    // Universal abilities work for everyone
    if (abilityStyle === 'universal') return true;

    // Magic abilities only for magic weapons
    if (abilityStyle === 'magic') return weaponStyle === 'magic';

    // Ranged abilities only for ranged weapons
    if (abilityStyle === 'ranged') return weaponStyle === 'ranged';

    // Physical (non-elemental amplify) works for all melee and ranged
    const meleeStyles = ['stab', 'slash', 'smash'];
    if (abilityStyle === 'physical') {
        return meleeStyles.includes(weaponStyle) || weaponStyle === 'ranged';
    }

    // Melee-specific (e.g., fierce aura with /skills/melee multiplier)
    if (abilityStyle === 'melee') return meleeStyles.includes(weaponStyle);

    // Specific melee sub-styles (stab/slash/smash abilities) work with any melee weapon
    if (meleeStyles.includes(abilityStyle)) return meleeStyles.includes(weaponStyle);

    return abilityStyle === weaponStyle;
}

/**
 * Accuracy-type "specialization" options a lab sim optimizer search can be locked to, grouped by
 * weapon category. Ranged only has one sub-style so it's not user-selectable as a restriction;
 * melee (stab/slash/smash) and magic (fire/water/nature) each offer a real choice. Leaving
 * specialization unset (null) means "try everything the equipped weapon's category allows",
 * matching the optimizer's pre-existing default behavior.
 */
export const SPECIALIZATION_OPTIONS = {
    melee: ['stab', 'slash', 'smash'],
    magic: ['fire', 'water', 'nature'],
};

/**
 * Get the elemental damage type (fire/water/nature) of a magic ability's damaging effect, if any.
 * @param {Object} abilityDetail
 * @returns {string|null}
 */
function getAbilityElement(abilityDetail) {
    for (const effect of abilityDetail.abilityEffects || []) {
        if (effect.damageType && ELEMENTAL_DAMAGE_TYPE_LABELS[effect.damageType]) {
            return effect.damageType.split('/').pop();
        }
    }
    return null;
}

/**
 * Whether an ability is allowed under a selected specialization (an exact melee sub-style or
 * magic element). Abilities not tied to a specific sub-style/element (universal, physical,
 * generic 'melee'/'magic') always pass — specialization only excludes abilities that actively
 * belong to a *different* sub-style/element than the one chosen. A null/undefined specialization
 * imposes no restriction.
 * @param {string} abilityStyle - From getAbilityCombatStyle()
 * @param {Object} abilityDetail
 * @param {string|null} specialization - e.g. 'stab', 'fire', or null for "try everything"
 * @returns {boolean}
 */
function matchesAbilitySpecialization(abilityStyle, abilityDetail, specialization) {
    if (!specialization) return true;

    if (SPECIALIZATION_OPTIONS.melee.includes(specialization)) {
        if (SPECIALIZATION_OPTIONS.melee.includes(abilityStyle)) return abilityStyle === specialization;
        return true;
    }

    if (SPECIALIZATION_OPTIONS.magic.includes(specialization)) {
        if (abilityStyle !== 'magic') return true;
        const element = getAbilityElement(abilityDetail);
        return !element || element === specialization;
    }

    return true;
}

/**
 * Whether an equipment item's combat stats are allowed under a selected specialization. Items
 * with no stats in the specialization's style category always pass (e.g. pure defensive gear or
 * off-hands with no melee/magic lean) — specialization only excludes items that actively lean a
 * *different* melee sub-style or magic element than the one chosen.
 * @param {Object} candidateStats - equipmentDetail.combatStats
 * @param {string|null} specialization
 * @returns {boolean}
 */
function matchesEquipmentSpecialization(candidateStats, specialization) {
    if (!specialization || !candidateStats) return true;

    if (SPECIALIZATION_OPTIONS.melee.includes(specialization)) {
        for (const style of SPECIALIZATION_OPTIONS.melee) {
            if (style === specialization) continue;
            const value = (candidateStats[`${style}Damage`] || 0) + (candidateStats[`${style}Accuracy`] || 0);
            if (value > 0) return false;
        }
        return true;
    }

    if (SPECIALIZATION_OPTIONS.magic.includes(specialization)) {
        const damageType = candidateStats.damageType;
        if (damageType && ELEMENTAL_DAMAGE_TYPE_LABELS[damageType] && damageType.split('/').pop() !== specialization) {
            return false;
        }
        for (const element of SPECIALIZATION_OPTIONS.magic) {
            if (element === specialization) continue;
            if ((candidateStats[`${element}Amplify`] || 0) > 0) return false;
        }
        return true;
    }

    return true;
}

/**
 * Calculate the gold cost of enhancing an item from startLevel to targetLevel.
 * Uses incremental cost approach: cost(0→target) - cost(0→start), matching
 * the tooltip's enhancement path calculation exactly.
 * @param {string} itemHrid - Item HRID
 * @param {number} startLevel - Starting enhancement level
 * @param {number} targetLevel - Target enhancement level
 * @param {Object} gameData - Game data from buildGameDataPayload()
 * @param {Object} [options] - Options
 * @param {string} [options.slot] - Equipment slot HRID (forces auto-detect for back items)
 * @returns {number} Expected gold cost
 */
function calculateEnhancementCost(itemHrid, startLevel, targetLevel, gameData, options = {}) {
    const itemDetails = gameData.itemDetailMap[itemHrid];
    if (!itemDetails?.enhancementCosts || itemDetails.enhancementCosts.length === 0) {
        return 0;
    }

    // Back items are non-tradeable, always use player's actual enhancing stats
    const enhancingParams = options.slot === '/equipment_types/back' ? getAutoDetectedParams() : getEnhancingParams();
    const itemLevel = itemDetails.itemLevel || 1;

    // Calculate per-attempt material cost (matches tooltip-enhancement pricing)
    let perAttemptCost = 0;
    for (const material of itemDetails.enhancementCosts) {
        let price = 0;
        if (material.itemHrid.startsWith('/items/trainee_')) {
            price = 250000;
        } else if (material.itemHrid === '/items/coin') {
            price = 1;
        } else {
            const marketPrice = getItemPrices(material.itemHrid, 0);
            if (marketPrice) {
                let ask = marketPrice.ask;
                let bid = marketPrice.bid;
                if (ask > 0 && bid < 0) bid = ask;
                if (bid > 0 && ask < 0) ask = bid;
                if (ask > 0) {
                    price = ask;
                }
            }
            // Fallback if no valid market ask
            if (price === 0) {
                const itemDetail = gameData.itemDetailMap[material.itemHrid];
                price = getProductionCost(material.itemHrid, 'ask') || itemDetail?.sellPrice || 0;
            }
        }
        perAttemptCost += price * material.count;
    }

    // Get cheapest protection price
    const { price: protPrice } = getCheapestProtectionPrice(itemHrid);

    // Calculate full path cost for each level from 1 to targetLevel
    // Find optimal protectFrom for each level (same approach as tooltip)
    // Then: incremental cost = fullCost(targetLevel) - fullCost(startLevel)
    const fullCost = new Array(targetLevel + 1).fill(0);

    for (let level = 1; level <= targetLevel; level++) {
        let bestCost = Infinity;

        // Try all protection strategies: no protection, protect from 2, 3, ..., level
        const protectOptions = [0];
        for (let pf = 2; pf <= level; pf++) {
            protectOptions.push(pf);
        }

        for (const protectFrom of protectOptions) {
            try {
                const result = calculateEnhancement({
                    enhancingLevel: enhancingParams.enhancingLevel,
                    toolBonus: enhancingParams.toolBonus,
                    speedBonus: enhancingParams.speedBonus || 0,
                    itemLevel,
                    targetLevel: level,
                    protectFrom,
                    blessedTea: enhancingParams.teas?.blessed || false,
                    guzzlingBonus: enhancingParams.guzzlingBonus || 1.0,
                });

                const materialCost = perAttemptCost * result.attempts;
                const protectionCost = protPrice * (result.protectionCount || 0);
                const totalForLevel = materialCost + protectionCost;

                if (totalForLevel < bestCost) {
                    bestCost = totalForLevel;
                }
            } catch {
                // Skip this strategy if calculation fails
            }
        }

        fullCost[level] = bestCost === Infinity ? 0 : bestCost;
    }

    // Incremental cost = cost to reach targetLevel - cost to reach startLevel
    return Math.max(0, Math.round(fullCost[targetLevel] - fullCost[startLevel]));
}

/**
 * Classify an item's combat role based on its primary offensive/defensive stats.
 * Items with the same role are valid tier comparison targets.
 * @param {Object} combatStats - equipmentDetail.combatStats
 * @returns {string} Role identifier
 */
function getItemRole(combatStats) {
    if (!combatStats) return 'unknown';

    // Check for elemental amplify — sub-classifies magic gear by element
    const fireAmp = combatStats.fireAmplify || 0;
    const natureAmp = combatStats.natureAmplify || 0;
    const waterAmp = combatStats.waterAmplify || 0;

    if (fireAmp > 0 || natureAmp > 0 || waterAmp > 0) {
        if (fireAmp >= natureAmp && fireAmp >= waterAmp) return 'magic_fire';
        if (natureAmp >= fireAmp && natureAmp >= waterAmp) return 'magic_nature';
        return 'magic_water';
    }

    // Check for primary offensive stats (exclude defensiveDamage — it's a tank stat)
    const stab = combatStats.stabDamage || 0;
    const slash = combatStats.slashDamage || 0;
    const smash = combatStats.smashDamage || 0;
    const ranged = combatStats.rangedDamage || 0;
    const magic = combatStats.magicDamage || 0;
    const melee = stab + slash + smash;

    // If item has offensive damage stats, classify by highest.
    // Melee is subdivided by damage style so stab/slash/smash weapons form separate tier groups.
    if (melee > 0 || ranged > 0 || magic > 0) {
        if (ranged >= melee && ranged >= magic) return 'ranged';
        if (magic >= melee && magic >= ranged) return 'magic';
        if (stab >= slash && stab >= smash) return 'melee_stab';
        if (slash >= stab && slash >= smash) return 'melee_slash';
        return 'melee_smash';
    }

    // Items with only defensiveDamage and no offensive damage are tanks
    if (combatStats.defensiveDamage > 0) return 'defensive';

    // Check accuracy as secondary signal
    const stabAcc = combatStats.stabAccuracy || 0;
    const slashAcc = combatStats.slashAccuracy || 0;
    const smashAcc = combatStats.smashAccuracy || 0;
    const meleeAcc = stabAcc + slashAcc + smashAcc;
    const rangedAcc = combatStats.rangedAccuracy || 0;
    const magicAcc = combatStats.magicAccuracy || 0;

    if (meleeAcc > 0 || rangedAcc > 0 || magicAcc > 0) {
        if (rangedAcc >= meleeAcc && rangedAcc >= magicAcc) return 'ranged';
        if (magicAcc >= meleeAcc && magicAcc >= rangedAcc) return 'magic';
        if (stabAcc >= slashAcc && stabAcc >= smashAcc) return 'melee_stab';
        if (slashAcc >= stabAcc && slashAcc >= smashAcc) return 'melee_slash';
        return 'melee_smash';
    }

    // Defensive/utility gear — armor, evasion, HP
    return 'defensive';
}

/**
 * Sum damage + accuracy per combat style (melee merges stab/slash/smash, since those
 * are all mutually valid comparisons for a melee player — only magic/ranged/melee are
 * mutually exclusive combat styles).
 * @param {Object} combatStats - equipmentDetail.combatStats
 * @returns {{magic: number, ranged: number, melee: number}}
 */
function getStyleValues(combatStats) {
    if (!combatStats) return { magic: 0, ranged: 0, melee: 0 };
    const magic = (combatStats.magicDamage || 0) + (combatStats.magicAccuracy || 0);
    const ranged = (combatStats.rangedDamage || 0) + (combatStats.rangedAccuracy || 0);
    const melee =
        (combatStats.stabDamage || 0) +
        (combatStats.slashDamage || 0) +
        (combatStats.smashDamage || 0) +
        (combatStats.stabAccuracy || 0) +
        (combatStats.slashAccuracy || 0) +
        (combatStats.smashAccuracy || 0);
    return { magic, ranged, melee };
}

/**
 * Whether a candidate item is a valid style-compatible replacement for the currently
 * equipped item. Neutral items (no damage/accuracy in any style — e.g. pure defensive
 * gear) are always compatible. Otherwise the candidate must be positive on at least one
 * of the player's currently-active styles and not negative on any of them, so e.g. a
 * ranged player never sees magic/melee-only items, but hybrid items showing +accuracy
 * to the player's style still surface even if they also carry stats for other styles.
 * @param {Object} currentStats - equipmentDetail.combatStats of the currently equipped item
 * @param {Object} candidateStats - equipmentDetail.combatStats of the candidate item
 * @returns {boolean}
 */
function isStyleCompatible(currentStats, candidateStats) {
    const cur = getStyleValues(currentStats);
    const activeStyles = ['magic', 'ranged', 'melee'].filter((s) => cur[s] > 0);
    if (activeStyles.length === 0) return true;

    const cand = getStyleValues(candidateStats);
    const candNeutral = cand.magic === 0 && cand.ranged === 0 && cand.melee === 0;
    if (candNeutral) return true;

    for (const s of activeStyles) {
        if (cand[s] < 0) return false;
    }
    return activeStyles.some((s) => cand[s] > 0);
}

/**
 * Get equipment tier progression for a given slot.
 * @param {Object} gameData - Game data from buildGameDataPayload()
 * @returns {Object} Map of slot → sorted item entries (weakest to strongest)
 */
export function getEquipmentTierProgression(gameData) {
    const progression = {};

    for (const [itemHrid, item] of Object.entries(gameData.itemDetailMap)) {
        if (!item.equipmentDetail?.type) continue;
        if (!item.equipmentDetail.combatStats) continue;
        if (!hasCombatStats(item)) continue;

        const slot = item.equipmentDetail.type;
        const key = slot;
        if (!progression[key]) {
            progression[key] = [];
        }

        progression[key].push({
            hrid: itemHrid,
            itemLevel: item.itemLevel || 0,
            sortIndex: item.sortIndex ?? 9999,
            name: item.name,
        });
    }

    // Sort each group by itemLevel (primary), then refined after non-refined, then sortIndex
    for (const key of Object.keys(progression)) {
        progression[key].sort((a, b) => {
            if (a.itemLevel !== b.itemLevel) return a.itemLevel - b.itemLevel;
            const aRefined = a.hrid.endsWith('_refined') ? 1 : 0;
            const bRefined = b.hrid.endsWith('_refined') ? 1 : 0;
            if (aRefined !== bRefined) return aRefined - bRefined;
            return a.sortIndex - b.sortIndex;
        });
    }

    return progression;
}

/** Combat-relevant stats that affect simulation outcomes */
export const COMBAT_STATS = new Set([
    'stabAccuracy',
    'slashAccuracy',
    'smashAccuracy',
    'rangedAccuracy',
    'magicAccuracy',
    'stabDamage',
    'slashDamage',
    'smashDamage',
    'rangedDamage',
    'magicDamage',
    'defensiveDamage',
    'taskDamage',
    'physicalAmplify',
    'waterAmplify',
    'natureAmplify',
    'fireAmplify',
    'healingAmplify',
    'stabEvasion',
    'slashEvasion',
    'smashEvasion',
    'rangedEvasion',
    'magicEvasion',
    'armor',
    'waterResistance',
    'natureResistance',
    'fireResistance',
    'maxHitpoints',
    'maxManapoints',
    'lifeSteal',
    'hpRegenPer10',
    'mpRegenPer10',
    'physicalThorns',
    'elementalThorns',
    'criticalRate',
    'criticalDamage',
    'armorPenetration',
    'waterPenetration',
    'naturePenetration',
    'firePenetration',
    'abilityHaste',
    'tenacity',
    'manaLeech',
    'castSpeed',
    'threat',
    'parry',
    'mayhem',
    'pierce',
    'curse',
    'fury',
    'weaken',
    'ripple',
    'bloom',
    'blaze',
    'attackSpeed',
    'autoAttackDamage',
    'abilityDamage',
    'retaliation',
    'maxHitpointsRatio',
    'maxManapointsRatio',
]);

/**
 * Check if an item has any combat-relevant stats (not just utility like foodSlots).
 * @param {Object} itemDetails - Item detail from itemDetailMap
 * @returns {boolean}
 */
function hasCombatStats(itemDetails) {
    if (!itemDetails?.equipmentDetail?.combatStats) return false;
    for (const stat of Object.keys(itemDetails.equipmentDetail.combatStats)) {
        if (COMBAT_STATS.has(stat) && itemDetails.equipmentDetail.combatStats[stat] !== 0) {
            return true;
        }
    }
    return false;
}

/**
 * Build a map of valid tier upgrades based on crafting/production chains.
 * An item X can upgrade to item Y if Y's crafting action uses X as:
 *   - upgradeItemHrid (direct upgrade chain), OR
 *   - one of its inputItems (combination recipes like Philosopher's)
 *
 * Only considers equipment outputs and equipment inputs.
 * @param {Object} gameData
 * @returns {Map<string, Set<string>>} itemHrid → Set of possible upgrade output hrids
 */
function buildUpgradeMap(gameData) {
    const map = new Map();

    for (const action of Object.values(gameData.actionDetailMap)) {
        if (!action.outputItems?.length) continue;
        const outputHrid = action.outputItems[0].itemHrid;

        // Only consider equipment outputs
        const outputItem = gameData.itemDetailMap[outputHrid];
        if (!outputItem?.equipmentDetail?.type) continue;

        // upgradeItemHrid → output (direct upgrade chain)
        if (action.upgradeItemHrid) {
            const upgradeItem = gameData.itemDetailMap[action.upgradeItemHrid];
            if (upgradeItem?.equipmentDetail?.type) {
                if (!map.has(action.upgradeItemHrid)) map.set(action.upgradeItemHrid, new Set());
                map.get(action.upgradeItemHrid).add(outputHrid);
            }
        }

        // inputItems → output (combination recipes like Philosopher's)
        if (action.inputItems) {
            for (const input of action.inputItems) {
                const inputItem = gameData.itemDetailMap[input.itemHrid];
                if (!inputItem?.equipmentDetail?.type) continue;

                if (!map.has(input.itemHrid)) map.set(input.itemHrid, new Set());
                map.get(input.itemHrid).add(outputHrid);
            }
        }
    }

    return map;
}

/**
 * Get the primary damage style of an item's combat stats.
 * @param {Object} combatStats - Item combat stats
 * @returns {string} 'slash', 'stab', 'smash', 'ranged', 'magic', or 'unknown'
 */
function getItemDamageStyle(combatStats) {
    if (!combatStats) return 'unknown';
    // Combine damage and accuracy so weapons that lean on one or the other (e.g. high-tier
    // elemental staffs with magicAccuracy but little/no magicDamage) still classify correctly.
    const slash = (combatStats.slashDamage || 0) + (combatStats.slashAccuracy || 0);
    const stab = (combatStats.stabDamage || 0) + (combatStats.stabAccuracy || 0);
    const smash = (combatStats.smashDamage || 0) + (combatStats.smashAccuracy || 0);
    const ranged = (combatStats.rangedDamage || 0) + (combatStats.rangedAccuracy || 0);
    const magic = (combatStats.magicDamage || 0) + (combatStats.magicAccuracy || 0);

    if (slash >= stab && slash >= smash && slash >= ranged && slash >= magic && slash > 0) return 'slash';
    if (stab >= slash && stab >= smash && stab >= ranged && stab >= magic && stab > 0) return 'stab';
    if (smash >= slash && smash >= stab && smash >= ranged && smash >= magic && smash > 0) return 'smash';
    if (ranged >= slash && ranged >= stab && ranged >= smash && ranged >= magic && ranged > 0) return 'ranged';
    if (magic > 0) return 'magic';
    return 'unknown';
}

/** Max number of style-matched off-hands to test per main-hand weapon. */
const MAX_OFFHAND_CANDIDATES = 3;

/**
 * Find candidate off-hand items for a given combat style and level range.
 * Returns up to MAX_OFFHAND_CANDIDATES style-matched off-hands by item level (not just the
 * single best) plus, if not already included, the strongest off-hand overall regardless of
 * style fit (e.g. Knight's Aegis for any cross-slot upgrade). Returning more than just "the
 * one best" matters because a lower tier can be more coin-efficient, and different items
 * bring different utility stats (e.g. a tome vs. a buckler) that only the sim can judge.
 * @param {Object} gameData - Game data
 * @param {string} damageStyle - Primary damage style of the weapon
 * @param {number} maxItemLevel - Maximum item level to consider
 * @returns {Array<{hrid: string, itemLevel: number}>}
 */
function findBestOffHand(gameData, damageStyle, maxItemLevel) {
    const isMagic = damageStyle === 'magic';
    const isRanged = damageStyle === 'ranged';
    const isMelee = damageStyle === 'slash' || damageStyle === 'stab' || damageStyle === 'smash';

    const styleMatches = [];
    const defensiveMatches = [];
    let highest = null; // highest-itemLevel off-hand overall (with magic-exclusion for non-magic)

    for (const [itemHrid, item] of Object.entries(gameData.itemDetailMap)) {
        const eq = item.equipmentDetail;
        if (!eq || eq.type !== '/equipment_types/off_hand') continue;
        if (!hasCombatStats(item)) continue;
        if ((item.itemLevel || 0) > maxItemLevel) continue;

        const level = item.itemLevel || 0;
        const stats = eq.combatStats || {};
        const hasMagicStats = (stats.magicDamage || 0) > 0 || (stats.magicAccuracy || 0) > 0;

        // Build "highest overall" candidate (mirrors original behavior)
        if (isMagic) {
            if (!highest) {
                highest = { hrid: itemHrid, itemLevel: level, isMagic: hasMagicStats };
            } else if (hasMagicStats && !highest.isMagic) {
                highest = { hrid: itemHrid, itemLevel: level, isMagic: true };
            } else if (hasMagicStats === highest.isMagic && level > highest.itemLevel) {
                highest = { hrid: itemHrid, itemLevel: level, isMagic: hasMagicStats };
            }
        } else if (!hasMagicStats && (!highest || level > highest.itemLevel)) {
            // For non-magic, exclude off-hands with magic stats from "highest"
            highest = { hrid: itemHrid, itemLevel: level };
        }

        // A purely defensive off-hand (e.g. a shield with only armor/evasion, no damage or
        // accuracy of its own) doesn't clash with any weapon style — it's a real candidate for
        // every style (trading DPS for survivability), not just whichever style it happens to
        // "match". Tracked separately from style-matched offensive off-hands below so it gets
        // its own reserved slot instead of competing by item level against damage-focused picks
        // (shields often out-level dedicated damage off-hands and would otherwise crowd them out).
        const hasAnyOffensiveStats =
            (stats.stabDamage || 0) > 0 ||
            (stats.slashDamage || 0) > 0 ||
            (stats.smashDamage || 0) > 0 ||
            (stats.rangedDamage || 0) > 0 ||
            (stats.magicDamage || 0) > 0 ||
            (stats.stabAccuracy || 0) > 0 ||
            (stats.slashAccuracy || 0) > 0 ||
            (stats.smashAccuracy || 0) > 0 ||
            (stats.rangedAccuracy || 0) > 0 ||
            (stats.magicAccuracy || 0) > 0;

        if (!hasAnyOffensiveStats) {
            defensiveMatches.push({ hrid: itemHrid, itemLevel: level });
            continue;
        }

        // Collect every off-hand whose offensive stats match the weapon's damage style.
        let styleMatch = false;
        if (isMagic) {
            styleMatch = hasMagicStats;
        } else if (isRanged) {
            styleMatch = (stats.rangedDamage || 0) > 0 || (stats.rangedAccuracy || 0) > 0;
        } else if (isMelee) {
            const meleeDmg = (stats.stabDamage || 0) + (stats.slashDamage || 0) + (stats.smashDamage || 0);
            const meleeAcc = (stats.stabAccuracy || 0) + (stats.slashAccuracy || 0) + (stats.smashAccuracy || 0);
            styleMatch = meleeDmg > 0 || meleeAcc > 0;
        }
        if (styleMatch) styleMatches.push({ hrid: itemHrid, itemLevel: level });
    }

    // Keep the top few off-hands by item level (not just the single best) — a lower tier
    // can be the more coin-efficient upgrade, and different items bring different utility
    // stats (e.g. a tome vs. a buckler) that only the sim can judge. The single highest-level
    // defensive off-hand (e.g. best shield) always gets its own slot alongside them.
    const topOffHands = styleMatches.sort((a, b) => b.itemLevel - a.itemLevel).slice(0, MAX_OFFHAND_CANDIDATES);
    const topDefensive = defensiveMatches.sort((a, b) => b.itemLevel - a.itemLevel).slice(0, 1);

    const out = [...topOffHands, ...topDefensive.filter((d) => !topOffHands.some((oh) => oh.hrid === d.hrid))];
    if (highest && !out.some((oh) => oh.hrid === highest.hrid)) {
        out.push({ hrid: highest.hrid, itemLevel: highest.itemLevel });
    }
    return out;
}

/**
 * Generate upgrade candidates for a player's equipment and/or abilities.
 * @param {Object} playerDTO - Player DTO with equipment
 * @param {Object} gameData - Game data from buildGameDataPayload()
 * @param {string} [mode='equipment'] - 'equipment' or 'abilities'
 * @param {number} [abilityTargetLevel=0] - Target level or increment for ability upgrades
 * @param {string} [abilityLevelType='increment'] - 'increment' (add N levels) or 'target' (absolute level)
 * @param {number} [equipmentLevelBoost=0] - Levels to add to every skill when checking equip
 *  requirements, for planning upgrades reachable X levels from now.
 * @returns {Array} Candidates: [{slot, currentHrid, currentLevel, upgradeHrid, upgradeLevel, description, type}]
 */
export function generateCandidates(
    playerDTO,
    gameData,
    mode = 'equipment',
    abilityTargetLevel = 0,
    abilityLevelType = 'increment',
    skipBackSlot = false,
    abilitySwapBudget = null,
    abilityLevelBudget = null,
    equipmentBudget = null,
    equipmentLevelBoost = 0,
    abilityReorderEnabled = false,
    specialization = null
) {
    const candidates = [];

    if (mode === 'equipment') {
        const enhancementBudget = equipmentBudget != null && equipmentBudget > 0 ? equipmentBudget : 1_000_000;
        const tierProgression = getEquipmentTierProgression(gameData);
        const upgradeMap = buildUpgradeMap(gameData);
        const skillLevelMap = getSkillLevelMapFromDTO(playerDTO, equipmentLevelBoost);

        // Combat style is set by the equipped weapon, not by whatever's currently in
        // each armor/off-hand slot — e.g. boots with +magic accuracy should be filtered
        // out for a melee player even though the boots themselves aren't a "weapon".
        const weaponEquip =
            playerDTO.equipment['/equipment_types/two_hand'] || playerDTO.equipment['/equipment_types/main_hand'];
        const weaponStats = weaponEquip ? gameData.itemDetailMap[weaponEquip.hrid]?.equipmentDetail?.combatStats : null;

        for (const [slot, equip] of Object.entries(playerDTO.equipment)) {
            if (!equip) continue;

            const currentHrid = equip.hrid;
            const currentLevel = equip.enhancementLevel || 0;
            const itemDetails = gameData.itemDetailMap[currentHrid];

            // Skip trinkets and items with no combat stats (tools, etc.)
            if (slot === '/equipment_types/trinket') continue;
            if (skipBackSlot && slot === '/equipment_types/back') continue;
            if (!hasCombatStats(itemDetails)) continue;

            // Enhancement upgrade: highest breakpoint affordable within budget
            const nextBP = getBudgetMatchedBreakpoint(currentLevel, slot, currentHrid, gameData, enhancementBudget);
            if (nextBP) {
                const itemName = gameData.itemDetailMap[currentHrid]?.name || currentHrid.split('/').pop();
                candidates.push({
                    slot,
                    currentHrid,
                    currentLevel,
                    upgradeHrid: currentHrid,
                    upgradeLevel: nextBP,
                    description: `${itemName} +${currentLevel} → +${nextBP}`,
                    type: 'enhancement',
                });
            }

            // Tier/replacement upgrades: every other item in the same slot that meets skill
            // requirements. Not filtered by item level, since a lower-item-level item
            // (e.g. Shoebill vs. Burble Boots) can still be a real upgrade — even a same-line
            // predecessor of the currently-equipped item isn't excluded, since a cheap ancestor
            // pushed to a high enhancement level can outperform an expensive current-tier item
            // left at a low one. Filtered for damage-style compatibility against the equipped
            // weapon (see isStyleCompatible). All tiers of a same-line crafting chain (e.g.
            // Cheese/Verdant/Azure Chest) are kept, not just the furthest one — a lower tier
            // can still be the coin-efficient pick within budget.
            const slotItems = tierProgression[slot];
            const currentName = itemDetails?.name || currentHrid.split('/').pop();
            const seenHrids = new Set();
            const rawCandidates = [];

            if (slotItems) {
                for (const item of slotItems) {
                    if (item.hrid === currentHrid) continue;
                    if (!meetsItemLevelRequirements(item.hrid, skillLevelMap, gameData)) continue;
                    const candidateStats = gameData.itemDetailMap[item.hrid]?.equipmentDetail?.combatStats;
                    if (!isStyleCompatible(weaponStats, candidateStats)) continue;
                    if (!matchesEquipmentSpecialization(candidateStats, specialization)) continue;

                    seenHrids.add(item.hrid);
                    rawCandidates.push({ hrid: item.hrid, name: item.name, itemLevel: item.itemLevel || 0 });
                }
            }

            // Also walk the crafting-chain upgradeMap for direct upgrade-action targets
            // (e.g. refined/★ variants) at the same item level, which the tier
            // progression above (itemLevel-gated) wouldn't otherwise surface.
            const upgrades = upgradeMap.get(currentHrid);
            if (upgrades) {
                for (const upgradeHrid of upgrades) {
                    if (seenHrids.has(upgradeHrid)) continue;
                    if (upgradeHrid === currentHrid) continue;
                    const upgradeItem = gameData.itemDetailMap[upgradeHrid];
                    if (!upgradeItem?.equipmentDetail) continue;
                    if (upgradeItem.equipmentDetail.type !== slot) continue;
                    if (!isStyleCompatible(weaponStats, upgradeItem.equipmentDetail?.combatStats)) continue;
                    if (!matchesEquipmentSpecialization(upgradeItem.equipmentDetail?.combatStats, specialization))
                        continue;
                    if (!meetsItemLevelRequirements(upgradeHrid, skillLevelMap, gameData)) continue;

                    seenHrids.add(upgradeHrid);
                    rawCandidates.push({
                        hrid: upgradeHrid,
                        name: upgradeItem.name,
                        itemLevel: upgradeItem.itemLevel || 0,
                    });
                }
            }

            const finalCandidates = rawCandidates;
            for (const cand of finalCandidates) {
                const upgradeName = cand.name || cand.hrid.split('/').pop();
                const upgradeLevel = getBudgetMatchedItemLevel(cand.hrid, enhancementBudget);
                candidates.push({
                    slot,
                    currentHrid,
                    currentLevel,
                    upgradeHrid: cand.hrid,
                    upgradeLevel,
                    description: `${currentName} → ${upgradeName} (+${upgradeLevel})`,
                    type: 'tier',
                });
            }
        }

        // Cross-slot candidates: two_hand ↔ main_hand + off_hand
        const twoHandEquip = playerDTO.equipment['/equipment_types/two_hand'];
        const mainHandEquip = playerDTO.equipment['/equipment_types/main_hand'];
        const offHandEquip = playerDTO.equipment['/equipment_types/off_hand'];

        if (twoHandEquip) {
            // Case A: Player has two_hand → suggest main_hand + best off_hand
            const twoHandItem = gameData.itemDetailMap[twoHandEquip.hrid];
            const twoHandStats = twoHandItem?.equipmentDetail?.combatStats;
            const damageStyle = getItemDamageStyle(twoHandStats);

            if (damageStyle !== 'unknown') {
                const twoHandLevel = twoHandItem?.itemLevel || 0;
                const enhLevel = twoHandEquip.enhancementLevel || 0;

                // Find main_hand weapons with matching style at or above current level
                const rawMainHands = [];
                for (const [itemHrid, item] of Object.entries(gameData.itemDetailMap)) {
                    const eq = item.equipmentDetail;
                    if (!eq || eq.type !== '/equipment_types/main_hand') continue;
                    if (!hasCombatStats(item)) continue;
                    if ((item.itemLevel || 0) < twoHandLevel) continue;
                    if (!meetsItemLevelRequirements(itemHrid, skillLevelMap, gameData)) continue;

                    const style = getItemDamageStyle(eq.combatStats);
                    if (style !== damageStyle) continue;
                    if (!matchesEquipmentSpecialization(eq.combatStats, specialization)) continue;

                    rawMainHands.push({ hrid: itemHrid, itemLevel: item.itemLevel || 0 });
                }

                // Consider every eligible main-hand weapon, not just the furthest tier of each
                // line — a lower tier can be the more coin-efficient upgrade, and this mirrors
                // the same-slot tier/replacement loop above, which is likewise unbounded.
                for (const { hrid: itemHrid } of rawMainHands) {
                    const item = gameData.itemDetailMap[itemHrid];

                    // Find candidate off-hands at this tier (a small handful of distinct
                    // style-matched/highest-level options, not just a single "best" pick —
                    // different off-hands bring different utility stats worth simming).
                    const offHandCandidates = findBestOffHand(gameData, damageStyle, item.itemLevel || 999).filter(
                        (oh) =>
                            meetsItemLevelRequirements(oh.hrid, skillLevelMap, gameData) &&
                            matchesEquipmentSpecialization(
                                gameData.itemDetailMap[oh.hrid]?.equipmentDetail?.combatStats,
                                specialization
                            )
                    );
                    if (!offHandCandidates.length) continue;

                    const mainName = item.name || itemHrid.split('/').pop();
                    const currentName = twoHandItem?.name || twoHandEquip.hrid.split('/').pop();

                    for (const bestOH of offHandCandidates) {
                        const ohItem = gameData.itemDetailMap[bestOH.hrid];
                        const ohName = ohItem?.name || bestOH.hrid.split('/').pop();

                        candidates.push({
                            slot: '/equipment_types/two_hand',
                            currentHrid: twoHandEquip.hrid,
                            currentLevel: enhLevel,
                            upgradeHrid: itemHrid,
                            upgradeLevel: enhLevel,
                            addedSlots: {
                                '/equipment_types/main_hand': { hrid: itemHrid, enhancementLevel: enhLevel },
                                '/equipment_types/off_hand': { hrid: bestOH.hrid, enhancementLevel: enhLevel },
                            },
                            clearedSlots: ['/equipment_types/two_hand'],
                            description: `${currentName} → ${mainName} + ${ohName} (+${enhLevel})`,
                            type: 'cross_slot',
                        });
                    }
                }
            }
        } else if (mainHandEquip) {
            // Case B: Player has main_hand (+off_hand) → suggest best two_hand
            const mainHandItem = gameData.itemDetailMap[mainHandEquip.hrid];
            const mainHandStats = mainHandItem?.equipmentDetail?.combatStats;
            const damageStyle = getItemDamageStyle(mainHandStats);

            if (damageStyle !== 'unknown') {
                const mainHandLevel = mainHandItem?.itemLevel || 0;
                const enhLevel = mainHandEquip.enhancementLevel || 0;

                // Find two_hand weapons with matching style above current main_hand level
                for (const [itemHrid, item] of Object.entries(gameData.itemDetailMap)) {
                    const eq = item.equipmentDetail;
                    if (!eq || eq.type !== '/equipment_types/two_hand') continue;
                    if (!hasCombatStats(item)) continue;
                    if ((item.itemLevel || 0) <= mainHandLevel) continue;

                    const style = getItemDamageStyle(eq.combatStats);
                    if (style !== damageStyle) continue;
                    if (getItemRole(eq.combatStats) === 'defensive') continue;
                    if (!matchesEquipmentSpecialization(eq.combatStats, specialization)) continue;
                    if (!meetsItemLevelRequirements(itemHrid, skillLevelMap, gameData)) continue;

                    const twoHandName = item.name || itemHrid.split('/').pop();
                    const currentName = mainHandItem?.name || mainHandEquip.hrid.split('/').pop();

                    const clearedSlots = ['/equipment_types/main_hand'];
                    if (offHandEquip) clearedSlots.push('/equipment_types/off_hand');

                    candidates.push({
                        slot: '/equipment_types/main_hand',
                        currentHrid: mainHandEquip.hrid,
                        currentLevel: enhLevel,
                        upgradeHrid: itemHrid,
                        upgradeLevel: enhLevel,
                        addedSlots: {
                            '/equipment_types/two_hand': { hrid: itemHrid, enhancementLevel: enhLevel },
                        },
                        clearedSlots,
                        description: `${currentName} → ${twoHandName} (+${enhLevel})`,
                        type: 'cross_slot',
                    });
                }
            }
        }

        // Final budget guard over every candidate type. Per-candidate generation above sizes
        // *levels* to budget (e.g. getBudgetMatchedItemLevel picks the highest affordable
        // enhancement level) but can still silently fall back to level 0 when nothing is
        // affordable, and cross-slot two_hand<->main+off_hand swaps never checked cost at all —
        // both could slip a candidate whose real market price is far over budget past the caller.
        // Re-checking actual cost here (the same calculateUpgradeCost() the caller uses to price
        // the pick) is what actually guarantees nothing over budget gets recommended.
        return candidates.filter((c) => calculateUpgradeCost(c, gameData) <= enhancementBudget);
    } else if (mode === 'ability_level' || mode === 'ability_swap') {
        const playerStyle = getPlayerCombatStyle(playerDTO, gameData);
        const equippedAbilityHrids = new Set(playerDTO.abilities.filter((a) => a).map((a) => a.hrid));

        // Swap-mode-only setup: a coin budget used to size swap/reinvest candidates
        // (explicit override if provided, otherwise the average cost already invested
        // in the abilities equipped), and a cache of computed swap-candidate levels
        // (same budget/list is reused across every slot, so compute each level once).
        const swapBudget =
            mode === 'ability_swap'
                ? abilitySwapBudget != null
                    ? abilitySwapBudget
                    : getAverageEquippedAbilityCost(playerDTO)
                : 0;
        const learnedAbilityLevels = mode === 'ability_swap' ? getLearnedAbilityLevels() : null;
        const skillLevelMap = mode === 'ability_swap' ? getSkillLevelMapFromDTO(playerDTO) : null;
        const swapLevelCache = new Map();
        const getSwapTargetLevel = (abHrid) => {
            if (swapLevelCache.has(abHrid)) return swapLevelCache.get(abHrid);
            const budgetLevel = getBudgetMatchedAbilityLevel(abHrid, swapBudget);
            const learnedLevel = learnedAbilityLevels.get(abHrid) || 0;
            const level = Math.min(200, Math.max(budgetLevel, learnedLevel, 1));
            swapLevelCache.set(abHrid, { level, learnedLevel });
            return { level, learnedLevel };
        };

        for (let slotIdx = 0; slotIdx < playerDTO.abilities.length; slotIdx++) {
            const ability = playerDTO.abilities[slotIdx];

            if (mode === 'ability_level') {
                // Level upgrade candidate (existing equipped abilities only)
                if (!ability) continue;
                const abilityDetail = gameData.abilityDetailMap[ability.hrid];
                if (!abilityDetail) continue;
                const abilityName = abilityDetail.name || ability.hrid.split('/').pop();

                if (abilityLevelType === 'budget') {
                    // Budget mode: always show a row, even with zero level gain (e.g. the
                    // budget can't afford another level) so it stays a visible anchor
                    // instead of silently vanishing. Cost is the incremental spend only —
                    // never the sunk cost of levels already owned.
                    const levelXpTable = gameData.levelExperienceTable || [];
                    const currentXp = levelXpTable[ability.level] || 0;
                    const targetLevel = getBudgetMatchedLevelFromCurrent(
                        ability.hrid,
                        ability.level,
                        currentXp,
                        abilityLevelBudget || 0
                    );
                    candidates.push({
                        slot: `ability_${slotIdx}`,
                        currentHrid: ability.hrid,
                        currentLevel: ability.level,
                        upgradeHrid: ability.hrid,
                        upgradeLevel: targetLevel,
                        description:
                            targetLevel > ability.level
                                ? `${abilityName} Lv${ability.level} → Lv${targetLevel}`
                                : `${abilityName} Lv${ability.level} (kept)`,
                        type: 'ability_reinvest',
                    });
                    continue;
                }

                let targetLevel;
                if (abilityLevelType === 'target') {
                    targetLevel =
                        abilityTargetLevel > ability.level
                            ? abilityTargetLevel
                            : getNextAbilityBreakpoint(ability.level);
                } else {
                    const increment = abilityTargetLevel > 0 ? abilityTargetLevel : 5;
                    targetLevel = ability.level + increment;
                }
                targetLevel = Math.min(targetLevel, 200);
                if (targetLevel > ability.level) {
                    candidates.push({
                        slot: `ability_${slotIdx}`,
                        currentHrid: ability.hrid,
                        currentLevel: ability.level,
                        upgradeHrid: ability.hrid,
                        upgradeLevel: targetLevel,
                        description: `${abilityName} Lv${ability.level} → Lv${targetLevel}`,
                        type: 'ability_level',
                    });
                }
            } else {
                // Swap candidates: other compatible abilities not already equipped anywhere,
                // including empty slots (if unlocked). Covers damage, special, and buff
                // abilities alike — the only filters are slot type and weapon-style compatibility.
                if (!ability && !isAbilitySlotUnlocked(slotIdx, playerDTO)) continue;

                const abilityName = ability
                    ? gameData.abilityDetailMap[ability.hrid]?.name || ability.hrid.split('/').pop()
                    : '(empty slot)';

                // Baseline for comparison: what if the same budget spent evaluating swaps
                // was instead reinvested into leveling the ability already in this slot?
                // Always shown (even with zero level gain) so it stays a visible anchor.
                // Cost is the incremental spend only — never the sunk cost of levels
                // already owned.
                if (ability) {
                    const levelXpTable = gameData.levelExperienceTable || [];
                    const currentXp = levelXpTable[ability.level] || 0;
                    const reinvestLevel = getBudgetMatchedLevelFromCurrent(
                        ability.hrid,
                        ability.level,
                        currentXp,
                        swapBudget
                    );
                    candidates.push({
                        slot: `ability_${slotIdx}`,
                        currentHrid: ability.hrid,
                        currentLevel: ability.level,
                        upgradeHrid: ability.hrid,
                        upgradeLevel: reinvestLevel,
                        description:
                            reinvestLevel > ability.level
                                ? `${abilityName} Lv${ability.level} → Lv${reinvestLevel} (reinvest swap budget)`
                                : `${abilityName} Lv${ability.level} (kept)`,
                        type: 'ability_reinvest',
                    });
                }

                for (const [abHrid, abDetail] of Object.entries(gameData.abilityDetailMap)) {
                    if (equippedAbilityHrids.has(abHrid)) continue;
                    if (abDetail.isSpecialAbility && slotIdx !== 0) continue;
                    if (!abDetail.isSpecialAbility && slotIdx === 0) continue;
                    if (SIM_USELESS_ABILITY_HRIDS.has(abHrid)) continue;

                    const abStyle = getAbilityCombatStyle(abDetail);
                    if (!isAbilityCompatible(abStyle, playerStyle)) continue;
                    if (!matchesAbilitySpecialization(abStyle, abDetail, specialization)) continue;
                    if (!meetsAbilityBookRequirements(abHrid, skillLevelMap, gameData)) continue;

                    const swapName = abDetail.name || abHrid.split('/').pop();
                    const { level: targetLevel, learnedLevel } = getSwapTargetLevel(abHrid);

                    candidates.push({
                        slot: `ability_${slotIdx}`,
                        currentHrid: ability ? ability.hrid : null,
                        currentLevel: ability ? ability.level : 0,
                        upgradeHrid: abHrid,
                        upgradeLevel: targetLevel,
                        learnedLevel,
                        description: `${abilityName} → ${swapName} (Lv${targetLevel})`,
                        type: 'ability_swap',
                    });
                }
            }
        }

        // Reorder candidates: try every ordering of the abilities already equipped in
        // the 4 unlocked normal slots (special ability slot 0 is fixed). Slot order can
        // shift cast timing/priority, so this searches for a better arrangement of the
        // *same* abilities rather than swapping in new ones. Capped at 4 slots (4! = 24
        // permutations) so it stays cheap even combined with the swap candidates above.
        if (mode === 'ability_swap' && abilityReorderEnabled) {
            const normalSlotIndices = [1, 2, 3, 4].filter((i) => isAbilitySlotUnlocked(i, playerDTO));
            const equippedInNormalSlots = normalSlotIndices
                .map((slotIdx) => ({ slotIdx, ability: playerDTO.abilities[slotIdx] }))
                .filter((x) => x.ability);

            if (equippedInNormalSlots.length >= 2) {
                const slots = equippedInNormalSlots.map((x) => x.slotIdx);
                const abilities = equippedInNormalSlots.map((x) => x.ability);

                for (const perm of permute(abilities)) {
                    if (perm.every((ab, i) => ab === abilities[i])) continue; // identity == baseline, skip

                    const description = perm
                        .map((ab) => gameData.abilityDetailMap[ab.hrid]?.name || ab.hrid.split('/').pop())
                        .join(' → ');

                    candidates.push({
                        slot: 'ability_reorder',
                        currentHrid: null,
                        currentLevel: 0,
                        upgradeHrid: null,
                        upgradeLevel: 0,
                        description: `Reorder: ${description}`,
                        type: 'ability_reorder',
                        reorderSlots: slots,
                        reorderAbilities: perm,
                    });
                }
            }
        }
    }

    return candidates;
}

/**
 * Calculate the total gold cost for a candidate upgrade.
 * Uses market prices as primary source (buy upgraded - sell current).
 * Falls back to enhancement cost estimate if market data unavailable.
 * @param {Object} candidate - Candidate from generateCandidates()
 * @param {Object} gameData - Game data
 * @returns {number} Total gold cost
 */
export function calculateUpgradeCost(candidate, gameData) {
    if (candidate.type === 'ability_reorder') {
        // Rearranging already-equipped abilities costs nothing.
        return 0;
    }

    if (candidate.type === 'ability_optimize') {
        // Already computed as the sum of each chosen ability's incremental cost.
        return candidate.cost || 0;
    }

    if (candidate.type === 'ability_level' || candidate.type === 'ability_reinvest') {
        // Incremental cost only (current level/xp → target) — never the sunk cost of
        // levels already owned, since that money is already spent regardless.
        const levelXpTable = gameData.levelExperienceTable || [];
        const currentXp = levelXpTable[candidate.currentLevel] || 0;
        return calculateAbilityLevelUpCost(
            candidate.currentHrid,
            candidate.currentLevel,
            currentXp,
            candidate.upgradeLevel
        );
    }

    if (candidate.type === 'ability_swap') {
        const learnedLevel = candidate.learnedLevel || 0;
        const levelXpTable = gameData.levelExperienceTable || [];
        const learnedXp = learnedLevel > 0 ? levelXpTable[learnedLevel] || 0 : 0;
        return calculateAbilityLevelUpCost(candidate.upgradeHrid, learnedLevel, learnedXp, candidate.upgradeLevel);
    }

    if (candidate.type === 'cross_slot') {
        // Buy cost only — never net against selling currently-equipped gear, since
        // keeping or selling old gear is the player's own separate decision.
        let buyCost = 0;
        for (const [, item] of Object.entries(candidate.addedSlots)) {
            const price = resolveItemPrice(item.hrid, {
                side: 'buy',
                enhancementLevel: item.enhancementLevel,
            });
            buyCost += price.price;
        }
        return buyCost;
    }

    if (candidate.type === 'enhancement') {
        // Cost to enhance the item already owned (materials + protection) — never a
        // market buy/sell delta, since that would bake in the value of gear the
        // player may choose to keep rather than sell.
        return calculateEnhancementCost(
            candidate.currentHrid,
            candidate.currentLevel,
            candidate.upgradeLevel,
            gameData,
            {
                slot: candidate.slot,
            }
        );
    }

    // Tier upgrade: buy cost of the new item only — never net against selling the
    // currently-equipped item, since keeping or selling it is the player's own
    // separate decision.
    return resolveItemPrice(candidate.upgradeHrid, {
        side: 'buy',
        enhancementLevel: candidate.upgradeLevel,
    }).price;
}

/** Default size of the top-ranked ability pool searched exhaustively by ability_optimize. */
const ABILITY_OPTIMIZE_POOL_SIZE = 15;

/**
 * Find the best whole ability loadout (special + all unlocked normal slots) for a total
 * coin budget, from scratch — ignoring whatever is currently equipped. Abilities already
 * learned cost only the incremental level-up from their learned level; unlearned abilities
 * cost their full purchase+level cost. Same budget pool competes for both.
 *
 * True exhaustive search over every ability combination is combinatorially infeasible
 * (dozens of compatible abilities choosing 4 for the normal slots is already thousands of
 * arrangements), so this runs a two-phase search instead:
 *   1. Rank every compatible, budget-sized ability in isolation (alone in an otherwise
 *      empty loadout) to score its standalone value.
 *   2. Exhaustively simulate every combination of the top-ranked abilities (poolSize) for
 *      the normal slots, paired with the single best affordable special ability.
 * This is a near-optimal heuristic, not a guaranteed global optimum.
 *
 * @param {Object} params - { playerDTOs, playerIndex, gameData, zoneHrid, difficultyTier,
 *  hours, communityBuffs, budget, poolSize }
 * @param {Function} [onProgress] - Called with { description }
 * @param {Function} [abortSignal] - Returns true if the search should stop early
 * @returns {Promise<Array>} Candidates in the same shape generateCandidates() produces
 */
async function generateAbilityOptimizeCandidates(params, onProgress, abortSignal) {
    const {
        playerDTOs,
        playerIndex,
        gameData,
        zoneHrid,
        difficultyTier,
        hours,
        communityBuffs,
        budget,
        poolSize = ABILITY_OPTIMIZE_POOL_SIZE,
    } = params;

    const playerDTO = playerDTOs[playerIndex];
    const playerHrid = playerDTO.hrid;
    const playerStyle = getPlayerCombatStyle(playerDTO, gameData);
    const learnedAbilityLevels = getLearnedAbilityLevels();
    const skillLevelMap = getSkillLevelMapFromDTO(playerDTO);
    console.log(
        '[UpgradeAdvisor] ability_optimize skill levels used for book requirements:',
        Object.fromEntries(skillLevelMap)
    );
    const levelXpTable = gameData.levelExperienceTable || [];

    const normalSlotIndices = [1, 2, 3, 4].filter((i) => isAbilitySlotUnlocked(i, playerDTO));
    if (normalSlotIndices.length === 0) return [];

    const numSlots = 1 + normalSlotIndices.length;
    const perSlotBudget = budget != null && budget > 0 ? budget / numSlots : getAverageEquippedAbilityCost(playerDTO);

    const buildPoolEntry = (abHrid, abDetail) => {
        const learnedLevel = learnedAbilityLevels.get(abHrid) || 0;
        const learnedXp = learnedLevel > 0 ? levelXpTable[learnedLevel] || 0 : 0;
        const targetLevel = Math.min(
            200,
            Math.max(getBudgetMatchedLevelFromCurrent(abHrid, learnedLevel, learnedXp, perSlotBudget), 1)
        );
        const cost = calculateAbilityLevelUpCost(abHrid, learnedLevel, learnedXp, targetLevel);
        const isDamage = (abDetail.abilityEffects || []).some(
            (effect) => effect.effectType === '/ability_effect_types/damage'
        );
        // 0-cooldown abilities are "always ready" filler/spam abilities — they must be the
        // last equipped ability, since combat picks the first ready ability by slot order and
        // an always-ready ability placed earlier would permanently block everything behind it.
        const isZeroCooldown = (abDetail.cooldownDuration || 0) === 0;
        return {
            hrid: abHrid,
            level: targetLevel,
            cost,
            name: abDetail.name || abHrid.split('/').pop(),
            isDamage,
            isZeroCooldown,
            cooldownDuration: abDetail.cooldownDuration || 0,
        };
    };

    const damagePool = [];
    const supportPool = []; // auras/buffs/heals — no direct damage effect of their own
    const specialPool = [];
    const TRACE_HRID = '/abilities/crippling_slash';
    for (const [abHrid, abDetail] of Object.entries(gameData.abilityDetailMap)) {
        if (SIM_USELESS_ABILITY_HRIDS.has(abHrid)) continue;
        if (!meetsAbilityBookRequirements(abHrid, skillLevelMap, gameData)) {
            if (abHrid === TRACE_HRID) console.log('[UpgradeAdvisor][trace]', abHrid, 'excluded: book requirement');
            continue;
        }

        if (abDetail.isSpecialAbility) {
            specialPool.push(buildPoolEntry(abHrid, abDetail));
            if (abHrid === TRACE_HRID) console.log('[UpgradeAdvisor][trace]', abHrid, 'added to specialPool');
            continue;
        }
        const abStyle = getAbilityCombatStyle(abDetail);
        if (!isAbilityCompatible(abStyle, playerStyle)) {
            if (abHrid === TRACE_HRID)
                console.log('[UpgradeAdvisor][trace]', abHrid, 'excluded: style incompatible', abStyle, playerStyle);
            continue;
        }
        const entry = buildPoolEntry(abHrid, abDetail);
        if (abHrid === TRACE_HRID) console.log('[UpgradeAdvisor][trace]', abHrid, 'pool entry:', entry);
        (entry.isDamage ? damagePool : supportPool).push(entry);
    }

    if (damagePool.length === 0 && supportPool.length === 0) return [];

    const emptyAbilities = new Array(playerDTO.abilities.length).fill(null);
    const runRankSim = async (abilities) => {
        const modifiedDTOs = playerDTOs.slice();
        modifiedDTOs[playerIndex] = { ...playerDTO, abilities };
        const simResult = await runSimulation(
            {
                gameData,
                playerDTOs: modifiedDTOs,
                zoneHrid,
                difficultyTier,
                hours,
                communityBuffs,
                singleWorker: true,
                infiniteMana: true,
            },
            null
        );
        return computeMetrics(simResult, gameData, playerHrid, hours).dps;
    };

    // Rank a pool of candidates, each scored by simulating the loadout buildAbilities(entry)
    // returns and comparing its dps against a fixed baseline — so the score reflects each
    // candidate's own marginal contribution, not the absolute dps of whatever else is present.
    const rankPool = async (pool, buildAbilities, baselineDps) => {
        if (pool.length === 0) return [];
        const scored = [];
        let cursor = 0;
        const workerCount = Math.max(1, Math.min(getMaxBatchWorkers(), pool.length));
        await Promise.all(
            Array.from({ length: workerCount }, async () => {
                while (cursor < pool.length && !abortSignal?.()) {
                    const entry = pool[cursor++];
                    onProgress?.({ description: `Ranking abilities: ${entry.name}` });
                    const dps = await runRankSim(buildAbilities(entry));
                    scored.push({ ...entry, dpsGain: dps - baselineDps });
                }
            })
        );
        scored.sort((a, b) => b.dpsGain - a.dpsGain);
        return scored;
    };

    // Phase 1a: rank damage-dealing abilities alone (nothing else equipped) — their own
    // hit output is what matters, and there's no realistic "kit" to test them against yet.
    const rankedDamage = await rankPool(
        damagePool,
        (entry) => {
            const abilities = emptyAbilities.slice();
            abilities[normalSlotIndices[0]] = { hrid: entry.hrid, level: entry.level, triggers: null };
            return abilities;
        },
        0
    );
    if (abortSignal?.()) return [];

    // Phase 1b: rank support abilities (auras/buffs) alongside a representative "anchor kit"
    // of the best damage abilities found above, not alone. An aura tested completely solo
    // (e.g. an attack-speed aura with nothing else equipped) can look artificially strong
    // since basic attacks are the only thing happening for it to speed up, while a damage%
    // or accuracy-style aura looks artificially weak with no real attacks to amplify. Scoring
    // is the delta over the anchor kit's own dps, so it reflects each aura's real contribution.
    // A real loadout almost always has a 0-cooldown filler ability, so the anchor kit should
    // include the best one too — but it must sit in the *last* anchor slot (immediately before
    // the buff-under-test slot), never earlier, or it would permanently block the buff from
    // ever casting (see isZeroCooldown above). The 0cd ability's own standalone value is
    // already captured separately by its Phase 1a solo ranking.
    const bestZeroCd = rankedDamage.find((entry) => entry.isZeroCooldown) || null;
    const nonZeroCdCandidates = rankedDamage.filter((entry) => !entry.isZeroCooldown);
    const anchorCount = Math.min(normalSlotIndices.length - 1, rankedDamage.length);
    const nonZeroCdSlots = bestZeroCd ? Math.max(0, anchorCount - 1) : anchorCount;
    const anchorKit = nonZeroCdCandidates.slice(0, nonZeroCdSlots);
    if (bestZeroCd && anchorCount > 0) anchorKit.push(bestZeroCd); // last -> rightmost anchor slot
    const anchorSlots = normalSlotIndices.slice(0, anchorKit.length);
    const buffTestSlot = normalSlotIndices[normalSlotIndices.length - 1];

    const buildAnchorAbilities = () => {
        const abilities = emptyAbilities.slice();
        anchorSlots.forEach((slotIdx, i) => {
            abilities[slotIdx] = { hrid: anchorKit[i].hrid, level: anchorKit[i].level, triggers: null };
        });
        return abilities;
    };
    const anchorBaselineDps = anchorCount > 0 ? await runRankSim(buildAnchorAbilities()) : 0;
    if (abortSignal?.()) return [];

    // Phase 1c: re-rank EVERY non-filler damage AND support ability together inside the
    // anchor kit's context (swapped into the last slot alongside the anchor), not just
    // support abilities. Some damage abilities (e.g. AOE/debuff abilities that only pay off
    // alongside other hits) score poorly when tested completely alone in Phase 1a, which
    // would wrongly exclude them from the combination pool even though they're the best
    // pick once paired with the rest of a real kit. Scoring everything the same way here
    // (marginal dpsGain over the same anchor baseline) also keeps damage-vs-support ranking
    // apples-to-apples, instead of comparing "alone" scores against "with anchor" scores.
    // The chosen 0-cooldown filler is excluded — it already occupies the anchor kit itself,
    // so testing another 0cd ability in the same slot would just have it blocked by the
    // anchor's own filler and produce a meaningless near-zero score.
    const contextPool = [...damagePool, ...supportPool].filter((e) => !e.isZeroCooldown);
    const rankedContext = await rankPool(
        contextPool,
        (entry) => {
            const abilities = buildAnchorAbilities();
            abilities[buffTestSlot] = { hrid: entry.hrid, level: entry.level, triggers: null };
            return abilities;
        },
        anchorBaselineDps
    );
    if (abortSignal?.()) return [];

    // The special-ability slot is also where this game puts auras (Fierce Aura, Speed Aura,
    // Mystic Aura, etc. all carry isSpecialAbility: true) alongside true ultimates, sharing
    // one exclusive slot. Auras need the same anchor-kit context as normal-slot support
    // abilities — an attack-speed aura tested totally alone (nothing else equipped to speed
    // up) looks artificially strong, while a damage/accuracy aura looks artificially weak
    // with nothing to amplify. So rank them against the anchor kit, not in isolation.
    const rankedSpecial = await rankPool(
        specialPool,
        (entry) => {
            const abilities = buildAnchorAbilities();
            abilities[0] = { hrid: entry.hrid, level: entry.level, triggers: null };
            return abilities;
        },
        anchorBaselineDps
    );
    if (abortSignal?.()) return [];

    // The 0cd filler's own value was already captured by its Phase 1a solo ranking (it can't
    // be scored in anchor context — see above), so it's merged back in here.
    const rankedNormal = (bestZeroCd ? [bestZeroCd, ...rankedContext] : rankedContext).sort(
        (a, b) => b.dpsGain - a.dpsGain
    );
    console.log(
        '[UpgradeAdvisor] ability_optimize ranking (anchor baseline dps: %s):',
        anchorBaselineDps,
        rankedNormal.map((e) => ({
            name: e.name,
            isDamage: e.isDamage,
            isZeroCooldown: e.isZeroCooldown,
            dpsGain: e.dpsGain,
            cost: e.cost,
            level: e.level,
        }))
    );
    console.log(
        '[UpgradeAdvisor] ability_optimize special/aura ranking:',
        rankedSpecial.map((e) => ({ name: e.name, dpsGain: e.dpsGain, cost: e.cost, level: e.level }))
    );
    const comboSize = Math.min(normalSlotIndices.length, rankedNormal.length);
    const topNormal = rankedNormal.slice(0, poolSize);
    const bestSpecial = rankedSpecial[0] || null;
    const specialCost = bestSpecial ? bestSpecial.cost : 0;
    const totalBudget = budget != null && budget > 0 ? budget : Infinity;

    // Phase 2: exhaustively try every combination (order doesn't matter beyond the
    // zero-cooldown placement below — the separate "Try Reordering" swap-mode option already
    // searches ordering among non-filler abilities) of comboSize abilities from the top-ranked
    // pool, paired with the best affordable special ability. At most one 0-cooldown ability is
    // allowed per combo — equipping a second is never useful, since only the first-checked one
    // would ever fire.
    const combos = [];
    const combine = (start, chosen, zeroCdCount) => {
        if (chosen.length === comboSize) {
            combos.push(chosen.slice());
            return;
        }
        for (let i = start; i < topNormal.length; i++) {
            const nextZeroCdCount = zeroCdCount + (topNormal[i].isZeroCooldown ? 1 : 0);
            if (nextZeroCdCount > 1) continue;
            chosen.push(topNormal[i]);
            combine(i + 1, chosen, nextZeroCdCount);
            chosen.pop();
        }
    };
    combine(0, [], 0);

    // Order a combo's abilities across the given slots by cooldown, longest first. Combat picks
    // the first ready ability by slot order each attack cycle, so a short-cooldown ability placed
    // early is ready almost every cycle and permanently starves everything behind it — the game's
    // priority system, not raw dpsGain, decides who should sit up front. A long-cooldown ability
    // is rarely ready, so giving it first priority lets it fire the instant it's available without
    // blocking the more frequent abilities behind it; a 0-cooldown "always ready" filler is the
    // most extreme case of this and must be last (see isZeroCooldown above).
    const arrangeForSlots = (entries, slotIndices) => {
        const ordered = entries.slice().sort((a, b) => b.cooldownDuration - a.cooldownDuration);
        return ordered.map((entry, i) => ({ slotIdx: slotIndices[i], entry }));
    };

    const candidates = [];
    for (const combo of combos) {
        const normalCost = combo.reduce((s, e) => s + e.cost, 0);
        const totalCost = normalCost + specialCost;
        if (totalCost > totalBudget) continue;

        const arranged = arrangeForSlots(combo, normalSlotIndices);

        const reorderSlots = [];
        const reorderAbilities = [];
        if (bestSpecial) {
            reorderSlots.push(0);
            reorderAbilities.push({ hrid: bestSpecial.hrid, level: bestSpecial.level, triggers: null });
        }
        for (const { slotIdx, entry } of arranged) {
            reorderSlots.push(slotIdx);
            reorderAbilities.push({ hrid: entry.hrid, level: entry.level, triggers: null });
        }

        // Description order must match reorderSlots (left-to-right equip order), not the
        // dpsGain-sorted `combo` order — those can differ now that slot placement is decided by
        // cooldown (longest first), so displaying `combo`'s order would mislabel which ability
        // actually ends up in which slot.
        candidates.push({
            slot: 'ability_optimize',
            currentHrid: null,
            currentLevel: 0,
            upgradeHrid: null,
            upgradeLevel: 0,
            description: `${bestSpecial ? `${bestSpecial.name} (Lv${bestSpecial.level}) + ` : ''}${arranged
                .map(({ entry }) => `${entry.name} (Lv${entry.level})`)
                .join(', ')}`,
            type: 'ability_optimize',
            cost: totalCost,
            reorderSlots,
            reorderAbilities,
        });
    }

    return candidates;
}

/**
 * Labyrinth counterpart of generateAbilityOptimizeCandidates(): same two-phase
 * rank-then-combine search, but ranked/scored by labyrinth win rate against a specific
 * monster/room level (via runLabyrinthSimulation) instead of zone DPS.
 * @param {Object} params - { playerDTOs, playerIndex, gameData, zoneHrid, monsterHrid, roomLevel,
 *  crates, hours, communityBuffs, labyrinthCombatBuffs, budget, poolSize }
 * @param {Function} [onProgress] - Called with { description }
 * @returns {Promise<Array>} Candidates in the same shape generateCandidates() produces
 */
async function generateLabyrinthAbilityOptimizeCandidates(params, onProgress) {
    const {
        playerDTOs,
        playerIndex,
        gameData,
        zoneHrid,
        monsterHrid,
        roomLevel,
        crates,
        hours,
        communityBuffs,
        labyrinthCombatBuffs,
        budget,
        poolSize = ABILITY_OPTIMIZE_POOL_SIZE,
        specialization = null,
    } = params;

    const playerDTO = playerDTOs[playerIndex];
    let playerStyle = getPlayerCombatStyle(playerDTO, gameData);
    if (playerStyle === 'unknown') {
        // Weapon-based detection failed — e.g. the monster's assigned loadout has no weapon
        // resolved in main_hand/two_hand (empty slot, or item data missing combat stats). Fall
        // back to whichever attack skill is trained highest, so normal-slot abilities aren't
        // silently filtered out to nothing just because the weapon lookup came up empty.
        const styleLevels = [
            { style: 'magic', level: playerDTO.magicLevel || 0 },
            { style: 'ranged', level: playerDTO.rangedLevel || 0 },
            { style: 'stab', level: playerDTO.meleeLevel || 0 },
        ];
        const bestStyle = styleLevels.reduce((a, b) => (b.level > a.level ? b : a));
        if (bestStyle.level > 0) playerStyle = bestStyle.style;
    }
    const learnedAbilityLevels = getLearnedAbilityLevels();
    const skillLevelMap = getSkillLevelMapFromDTO(playerDTO);
    const levelXpTable = gameData.levelExperienceTable || [];

    const normalSlotIndices = [1, 2, 3, 4].filter((i) => isAbilitySlotUnlocked(i, playerDTO));
    if (normalSlotIndices.length === 0) {
        console.warn(
            `[UpgradeAdvisor] Labyrinth ability optimize: no unlocked normal ability slots for ${monsterHrid}`
        );
        return [];
    }

    const numSlots = 1 + normalSlotIndices.length;
    const perSlotBudget = budget != null && budget > 0 ? budget / numSlots : getAverageEquippedAbilityCost(playerDTO);

    const buildPoolEntry = (abHrid, abDetail) => {
        const learnedLevel = learnedAbilityLevels.get(abHrid) || 0;
        const learnedXp = learnedLevel > 0 ? levelXpTable[learnedLevel] || 0 : 0;
        const targetLevel = Math.min(
            200,
            Math.max(getBudgetMatchedLevelFromCurrent(abHrid, learnedLevel, learnedXp, perSlotBudget), 1)
        );
        const cost = calculateAbilityLevelUpCost(abHrid, learnedLevel, learnedXp, targetLevel);
        const isDamage = (abDetail.abilityEffects || []).some(
            (effect) => effect.effectType === '/ability_effect_types/damage'
        );
        const isZeroCooldown = (abDetail.cooldownDuration || 0) === 0;
        return {
            hrid: abHrid,
            level: targetLevel,
            cost,
            name: abDetail.name || abHrid.split('/').pop(),
            isDamage,
            isZeroCooldown,
            cooldownDuration: abDetail.cooldownDuration || 0,
        };
    };

    const damagePool = [];
    const supportPool = [];
    const specialPool = [];
    for (const [abHrid, abDetail] of Object.entries(gameData.abilityDetailMap)) {
        if (SIM_USELESS_ABILITY_HRIDS.has(abHrid)) continue;
        if (!meetsAbilityBookRequirements(abHrid, skillLevelMap, gameData)) continue;

        if (abDetail.isSpecialAbility) {
            specialPool.push(buildPoolEntry(abHrid, abDetail));
            continue;
        }
        const abStyle = getAbilityCombatStyle(abDetail);
        if (!isAbilityCompatible(abStyle, playerStyle)) continue;
        if (!matchesAbilitySpecialization(abStyle, abDetail, specialization)) continue;
        const entry = buildPoolEntry(abHrid, abDetail);
        (entry.isDamage ? damagePool : supportPool).push(entry);
    }

    // A weapon style that couldn't be resolved (e.g. an empty/unrecognized main-hand slot in the
    // monster's assigned loadout) would otherwise silently filter out every normal-slot ability
    // here, since isAbilityCompatible only ever passes 'universal' abilities against 'unknown'.
    if (damagePool.length === 0 && supportPool.length === 0 && specialPool.length === 0) {
        console.warn(
            `[UpgradeAdvisor] Labyrinth ability optimize: no compatible abilities found for ${monsterHrid} (weapon style: ${playerStyle})`
        );
        return [];
    }

    const emptyAbilities = new Array(playerDTO.abilities.length).fill(null);
    const runRankSim = async (abilities) => {
        const modifiedDTOs = playerDTOs.slice();
        modifiedDTOs[playerIndex] = { ...playerDTO, abilities };
        const simResult = await runLabyrinthSimulation({
            gameData,
            playerDTOs: modifiedDTOs,
            zoneHrid,
            monsterHrid,
            roomLevel,
            crates,
            hours,
            communityBuffs,
            labyrinthCombatBuffs,
        });
        const attempts = simResult.labyAttemptCount || 1;
        const encounters = simResult.encounters || 0;
        return encounters / attempts;
    };

    const rankPool = async (pool, buildAbilities, baselineWinRate) => {
        if (pool.length === 0) return [];
        const scored = [];
        let cursor = 0;
        const workerCount = Math.max(1, Math.min(getMaxBatchWorkers(), pool.length));
        await Promise.all(
            Array.from({ length: workerCount }, async () => {
                while (cursor < pool.length) {
                    const entry = pool[cursor++];
                    onProgress?.({ description: `Ranking abilities: ${entry.name}` });
                    const winRate = await runRankSim(buildAbilities(entry));
                    scored.push({ ...entry, winRateGain: winRate - baselineWinRate });
                }
            })
        );
        scored.sort((a, b) => b.winRateGain - a.winRateGain);
        return scored;
    };

    const rankedDamage = await rankPool(
        damagePool,
        (entry) => {
            const abilities = emptyAbilities.slice();
            abilities[normalSlotIndices[0]] = { hrid: entry.hrid, level: entry.level, triggers: null };
            return abilities;
        },
        0
    );

    const bestZeroCd = rankedDamage.find((entry) => entry.isZeroCooldown) || null;
    const nonZeroCdCandidates = rankedDamage.filter((entry) => !entry.isZeroCooldown);
    const anchorCount = Math.min(normalSlotIndices.length - 1, rankedDamage.length);
    const nonZeroCdSlots = bestZeroCd ? Math.max(0, anchorCount - 1) : anchorCount;
    const anchorKit = nonZeroCdCandidates.slice(0, nonZeroCdSlots);
    if (bestZeroCd && anchorCount > 0) anchorKit.push(bestZeroCd);
    const anchorSlots = normalSlotIndices.slice(0, anchorKit.length);
    const buffTestSlot = normalSlotIndices[normalSlotIndices.length - 1];

    const buildAnchorAbilities = () => {
        const abilities = emptyAbilities.slice();
        anchorSlots.forEach((slotIdx, i) => {
            abilities[slotIdx] = { hrid: anchorKit[i].hrid, level: anchorKit[i].level, triggers: null };
        });
        return abilities;
    };
    const anchorBaselineWinRate = anchorCount > 0 ? await runRankSim(buildAnchorAbilities()) : 0;

    const contextPool = [...damagePool, ...supportPool].filter((e) => !e.isZeroCooldown);
    const rankedContext = await rankPool(
        contextPool,
        (entry) => {
            const abilities = buildAnchorAbilities();
            abilities[buffTestSlot] = { hrid: entry.hrid, level: entry.level, triggers: null };
            return abilities;
        },
        anchorBaselineWinRate
    );

    const rankedSpecial = await rankPool(
        specialPool,
        (entry) => {
            const abilities = buildAnchorAbilities();
            abilities[0] = { hrid: entry.hrid, level: entry.level, triggers: null };
            return abilities;
        },
        anchorBaselineWinRate
    );

    const rankedNormal = (bestZeroCd ? [bestZeroCd, ...rankedContext] : rankedContext).sort(
        (a, b) => b.winRateGain - a.winRateGain
    );
    const comboSize = Math.min(normalSlotIndices.length, rankedNormal.length);
    const topNormal = rankedNormal.slice(0, poolSize);
    const bestSpecial = rankedSpecial[0] || null;
    const specialCost = bestSpecial ? bestSpecial.cost : 0;
    const totalBudget = budget != null && budget > 0 ? budget : Infinity;

    const combos = [];
    const combine = (start, chosen, zeroCdCount) => {
        if (chosen.length === comboSize) {
            combos.push(chosen.slice());
            return;
        }
        for (let i = start; i < topNormal.length; i++) {
            const nextZeroCdCount = zeroCdCount + (topNormal[i].isZeroCooldown ? 1 : 0);
            if (nextZeroCdCount > 1) continue;
            chosen.push(topNormal[i]);
            combine(i + 1, chosen, nextZeroCdCount);
            chosen.pop();
        }
    };
    combine(0, [], 0);

    const arrangeForSlots = (entries, slotIndices) => {
        const ordered = entries.slice().sort((a, b) => b.cooldownDuration - a.cooldownDuration);
        return ordered.map((entry, i) => ({ slotIdx: slotIndices[i], entry }));
    };

    const candidates = [];
    for (const combo of combos) {
        const normalCost = combo.reduce((s, e) => s + e.cost, 0);
        const totalCost = normalCost + specialCost;
        if (totalCost > totalBudget) continue;

        const arranged = arrangeForSlots(combo, normalSlotIndices);

        const reorderSlots = [];
        const reorderAbilities = [];
        if (bestSpecial) {
            reorderSlots.push(0);
            reorderAbilities.push({ hrid: bestSpecial.hrid, level: bestSpecial.level, triggers: null });
        }
        for (const { slotIdx, entry } of arranged) {
            reorderSlots.push(slotIdx);
            reorderAbilities.push({ hrid: entry.hrid, level: entry.level, triggers: null });
        }

        const parts = [];
        if (bestSpecial) parts.push(`${bestSpecial.name} (Lv${bestSpecial.level})`);
        parts.push(...arranged.map(({ entry }) => `${entry.name} (Lv${entry.level})`));

        candidates.push({
            description: parts.join(', '),
            cost: totalCost,
            reorderSlots,
            reorderAbilities,
        });
    }

    return candidates;
}

/**
 * Find the best whole ability loadout for a single labyrinth monster/room level: generates
 * candidate combinations via generateLabyrinthAbilityOptimizeCandidates(), then sims each one
 * against the real monster to pick the single best by win rate (the generator's own ranking
 * sims run at the same room level but with fewer slots filled, so a final head-to-head pass
 * over the full combos is still needed).
 * @param {Object} params - { playerDTOs, playerIndex, gameData, monsterHrid, roomLevel, crates,
 *  hours, communityBuffs, labyrinthCombatBuffs, budget, poolSize }
 * @param {Function} [onProgress] - Called with { description }
 * @returns {Promise<{winRate: number, abilities: Array, description: string, cost: number}|null>}
 */
export async function optimizeLabyrinthAbilities(params, onProgress) {
    const {
        playerDTOs,
        playerIndex,
        gameData,
        monsterHrid,
        roomLevel,
        crates,
        hours,
        communityBuffs,
        labyrinthCombatBuffs,
        budget,
        poolSize,
        specialization,
    } = params;

    const zoneHrid =
        Object.keys(gameData.actionDetailMap).find((k) => k.includes('/actions/combat/')) || '/actions/combat/fly';

    const basePlayerDTO = playerDTOs[playerIndex];
    const equippedWeaponHrid =
        basePlayerDTO.equipment['/equipment_types/main_hand']?.hrid ||
        basePlayerDTO.equipment['/equipment_types/two_hand']?.hrid ||
        null;
    const weaponSlot = basePlayerDTO.equipment['/equipment_types/two_hand'] ? 'two_hand' : 'main_hand';
    // Magic weapons share stats across elements (fire/water/nature) but aren't named after their
    // element, so the same ability combo can score differently depending which staff is worn —
    // try every same-tier elemental variant and keep whichever performs best. A magic
    // specialization locks this down to just that one element instead of searching all three.
    let elementalVariants = equippedWeaponHrid ? getElementalWeaponVariants(equippedWeaponHrid, gameData) : [];
    if (specialization && SPECIALIZATION_OPTIONS.magic.includes(specialization)) {
        elementalVariants = elementalVariants.filter((v) => v.damageType.split('/').pop() === specialization);
    }
    const weaponRuns =
        elementalVariants.length > 1
            ? elementalVariants
            : elementalVariants.length === 1
              ? [elementalVariants[0]]
              : [null];

    let best = null;
    for (const variant of weaponRuns) {
        const elementLabel = variant ? ELEMENTAL_DAMAGE_TYPE_LABELS[variant.damageType] : null;
        const runPlayerDTOs = playerDTOs.slice();
        if (variant) {
            runPlayerDTOs[playerIndex] = {
                ...basePlayerDTO,
                equipment: {
                    ...basePlayerDTO.equipment,
                    [`/equipment_types/${weaponSlot}`]: {
                        ...basePlayerDTO.equipment[`/equipment_types/${weaponSlot}`],
                        hrid: variant.hrid,
                    },
                },
            };
        }
        const playerDTO = runPlayerDTOs[playerIndex];

        const candidates = await generateLabyrinthAbilityOptimizeCandidates(
            {
                playerDTOs: runPlayerDTOs,
                playerIndex,
                gameData,
                zoneHrid,
                monsterHrid,
                roomLevel,
                crates,
                hours,
                communityBuffs,
                labyrinthCombatBuffs,
                budget,
                poolSize,
                specialization,
            },
            (p) => onProgress?.(elementLabel ? { ...p, description: `[${elementLabel}] ${p?.description || ''}` } : p)
        );
        if (!candidates.length) continue;

        let cursor = 0;
        let comboDone = 0;
        let runBest = null;
        const comboTotal = candidates.length;
        const workerCount = Math.max(1, Math.min(getMaxBatchWorkers(), candidates.length));
        await Promise.all(
            Array.from({ length: workerCount }, async () => {
                while (cursor < candidates.length) {
                    const candidate = candidates[cursor++];
                    const label = elementLabel ? `[${elementLabel}] ${candidate.description}` : candidate.description;
                    onProgress?.({
                        current: comboDone,
                        total: comboTotal,
                        description: `Testing combo: ${label}`,
                    });

                    const abilities = playerDTO.abilities.slice();
                    candidate.reorderSlots.forEach((slotIdx, i) => {
                        abilities[slotIdx] = candidate.reorderAbilities[i];
                    });
                    const modifiedDTOs = runPlayerDTOs.slice();
                    modifiedDTOs[playerIndex] = { ...playerDTO, abilities };

                    const simResult = await runLabyrinthSimulation({
                        gameData,
                        playerDTOs: modifiedDTOs,
                        zoneHrid,
                        monsterHrid,
                        roomLevel,
                        crates,
                        hours,
                        communityBuffs,
                        labyrinthCombatBuffs,
                    });
                    const attempts = simResult.labyAttemptCount || 1;
                    const encounters = simResult.encounters || 0;
                    const deaths = simResult.deaths?.player1 || 0;
                    const totalDamageDealt = simResult.totalDamageDealt?.player1 || 0;
                    const winRate = encounters / attempts;
                    const candidateResult = { winRate, attempts, encounters, deaths, totalDamageDealt };

                    // Below clearing, win rate alone can't tell combos apart — fall back to
                    // damage dealt / deaths (see isLabyrinthResultBetter) so a combo that clearly
                    // hits harder or dies less still gets adopted even while every option is
                    // still stuck at 0% clears.
                    if (!runBest || isLabyrinthResultBetter(candidateResult, runBest)) {
                        runBest = {
                            ...candidateResult,
                            abilities,
                            description: label,
                            cost: candidate.cost,
                            weaponHrid: variant ? variant.hrid : equippedWeaponHrid,
                        };
                    }
                    comboDone++;
                    onProgress?.({ current: comboDone, total: comboTotal, description: label });
                }
            })
        );
        if (runBest && (!best || isLabyrinthResultBetter(runBest, best))) best = runBest;
    }

    return best;
}

/**
 * Find the best equipment loadout for a single labyrinth monster/room level. Unlike abilities
 * (constrained to a handful of interacting slots), equipment slots are effectively independent
 * of each other, so each generated candidate (one slot's enhancement or item swap) is tested
 * individually against the same unmodified baseline, the single best candidate per slot is kept
 * (only if it beats the baseline), and every winning slot change is then combined into one
 * loadout and verified with a final sim.
 * @param {Object} params - { playerDTOs, playerIndex, gameData, monsterHrid, roomLevel, crates,
 *  hours, communityBuffs, labyrinthCombatBuffs, budget }
 * @param {Function} [onProgress] - Called with { current, total, description }
 * @returns {Promise<{winRate: number, attempts: number, encounters: number, deaths: number, equipment: Object, description: string, cost: number}|null>}
 */
export async function optimizeLabyrinthEquipment(params, onProgress) {
    const {
        playerDTOs,
        playerIndex,
        gameData,
        monsterHrid,
        roomLevel,
        crates,
        hours,
        communityBuffs,
        labyrinthCombatBuffs,
        budget,
        specialization,
    } = params;

    const zoneHrid =
        Object.keys(gameData.actionDetailMap).find((k) => k.includes('/actions/combat/')) || '/actions/combat/fly';

    const playerDTO = playerDTOs[playerIndex];
    const candidates = generateCandidates(
        playerDTO,
        gameData,
        'equipment',
        0,
        'increment',
        false,
        null,
        null,
        budget,
        0,
        false,
        specialization
    );
    if (!candidates.length) return null;

    const runEquipmentSim = async (equipment) => {
        const modifiedDTOs = playerDTOs.slice();
        modifiedDTOs[playerIndex] = { ...playerDTO, equipment };
        const simResult = await runLabyrinthSimulation({
            gameData,
            playerDTOs: modifiedDTOs,
            zoneHrid,
            monsterHrid,
            roomLevel,
            crates,
            hours,
            communityBuffs,
            labyrinthCombatBuffs,
        });
        const attempts = simResult.labyAttemptCount || 1;
        const encounters = simResult.encounters || 0;
        const deaths = simResult.deaths?.player1 || 0;
        const totalDamageDealt = simResult.totalDamageDealt?.player1 || 0;
        return { winRate: encounters / attempts, attempts, encounters, deaths, totalDamageDealt };
    };

    // Mutates `equipment` in place with just this candidate's slot change(s), so multiple
    // candidates' changes can be layered onto the same base object without one candidate's
    // delta wiping out another's (each candidate object only ever describes its own slot(s),
    // never the full loadout).
    const applyCandidateDelta = (equipment, candidate) => {
        if (candidate.type === 'cross_slot') {
            for (const slot of candidate.clearedSlots) equipment[slot] = null;
            for (const [slot, item] of Object.entries(candidate.addedSlots)) equipment[slot] = item;
        } else {
            equipment[candidate.slot] = { hrid: candidate.upgradeHrid, enhancementLevel: candidate.upgradeLevel };
        }
    };
    const buildCandidateEquipment = (candidate) => {
        const equipment = { ...playerDTO.equipment };
        applyCandidateDelta(equipment, candidate);
        return equipment;
    };

    const baseline = await runEquipmentSim(playerDTO.equipment);

    const bestPerSlot = new Map(); // slot key -> { candidate, result }
    let cursor = 0;
    let comboDone = 0;
    const comboTotal = candidates.length;
    const workerCount = Math.max(1, Math.min(getMaxBatchWorkers(), candidates.length));
    await Promise.all(
        Array.from({ length: workerCount }, async () => {
            while (cursor < candidates.length) {
                const candidate = candidates[cursor++];
                onProgress?.({
                    current: comboDone,
                    total: comboTotal,
                    description: `Testing: ${candidate.description}`,
                });

                const result = await runEquipmentSim(buildCandidateEquipment(candidate));
                if (isLabyrinthResultBetter(result, baseline)) {
                    const slotKey = candidate.type === 'cross_slot' ? 'cross_slot' : candidate.slot;
                    const existing = bestPerSlot.get(slotKey);
                    if (!existing || isLabyrinthResultBetter(result, existing.result)) {
                        bestPerSlot.set(slotKey, { candidate, result });
                    }
                }
                comboDone++;
                onProgress?.({ current: comboDone, total: comboTotal, description: candidate.description });
            }
        })
    );

    if (bestPerSlot.size === 0) return null;

    // Combine every winning slot's change into one loadout and verify with a final sim, since
    // the per-slot results above were each measured independently against the same baseline.
    const combinedEquipment = { ...playerDTO.equipment };
    const parts = [];
    let totalCost = 0;
    for (const { candidate } of bestPerSlot.values()) {
        applyCandidateDelta(combinedEquipment, candidate);
        parts.push(candidate.description);
        totalCost += calculateUpgradeCost(candidate, gameData);
    }

    const finalResult = await runEquipmentSim(combinedEquipment);

    return {
        winRate: finalResult.winRate,
        attempts: finalResult.attempts,
        encounters: finalResult.encounters,
        deaths: finalResult.deaths,
        totalDamageDealt: finalResult.totalDamageDealt,
        equipment: combinedEquipment,
        description: parts.join('\n'),
        cost: totalCost,
    };
}

/**
 * Find the best combined equipment+ability loadout for a single labyrinth monster/room level by
 * alternating the two optimizers: equipment (bare abilities) → abilities (on that gear) →
 * equipment again (on those abilities, to catch gear picks the first pass couldn't see with the
 * old kit) → abilities again (final polish) — each stage only keeps its change if it beats the
 * best result seen so far, so a stage that finds nothing new leaves the loadout untouched.
 * @param {Object} params - { playerDTOs, playerIndex, gameData, monsterHrid, roomLevel, crates,
 *  hours, communityBuffs, labyrinthCombatBuffs, budget, poolSize }
 * @param {Function} [onProgress] - Called with { current, total, description }
 * @returns {Promise<{winRate: number, attempts: number, encounters: number, deaths: number,
 *  equipment: Object, abilities: Array, description: string, cost: number}|null>}
 */
export async function optimizeLabyrinthEverything(params, onProgress) {
    const {
        playerDTOs,
        playerIndex,
        gameData,
        monsterHrid,
        roomLevel,
        crates,
        hours,
        communityBuffs,
        labyrinthCombatBuffs,
        budget,
        poolSize,
        specialization,
    } = params;

    const zoneHrid =
        Object.keys(gameData.actionDetailMap).find((k) => k.includes('/actions/combat/')) || '/actions/combat/fly';

    let currentDTOs = playerDTOs.slice();
    const equipmentChanges = [];
    const abilityChanges = [];
    let totalCost = 0;

    const runStageSim = async () => {
        const simResult = await runLabyrinthSimulation({
            gameData,
            playerDTOs: currentDTOs,
            zoneHrid,
            monsterHrid,
            roomLevel,
            crates,
            hours,
            communityBuffs,
            labyrinthCombatBuffs,
        });
        const attempts = simResult.labyAttemptCount || 1;
        const encounters = simResult.encounters || 0;
        const deaths = simResult.deaths?.player1 || 0;
        const totalDamageDealt = simResult.totalDamageDealt?.player1 || 0;
        return { winRate: encounters / attempts, attempts, encounters, deaths, totalDamageDealt };
    };

    let best = await runStageSim();

    // Replace each stage's own combo-level description (e.g. "Testing: Fireball Lv10") with just
    // the stage label — showing the constantly-changing combo text in the UI made the progress
    // detail line flicker/spaz as dozens of monsters reported different combos in parallel. The
    // stage label only changes 4 times per monster, so it stays readable.
    const wrapProgress = (stageLabel) => (p) => onProgress?.({ ...p, description: stageLabel });

    // Two-space indents every line of a (possibly multi-line) sub-description, so the final
    // report reads as a nested outline instead of one unbroken run-on sentence.
    const indentLines = (text) =>
        text
            .split('\n')
            .map((line) => `  ${line}`)
            .join('\n');

    const applyEquipmentStage = async (stageLabel) => {
        const result = await optimizeLabyrinthEquipment(
            {
                playerDTOs: currentDTOs,
                playerIndex,
                gameData,
                monsterHrid,
                roomLevel,
                crates,
                hours,
                communityBuffs,
                labyrinthCombatBuffs,
                budget,
                specialization,
            },
            wrapProgress(stageLabel)
        );
        if (!result) {
            equipmentChanges.push(`${stageLabel}: no improvement found`);
            return;
        }
        // Below clearing, win rate alone can't tell weapons apart (see isLabyrinthResultBetter) —
        // fall back to damage dealt / deaths so a gear swap that clearly hits harder or dies less
        // still gets adopted even while every option is still stuck at 0% clears.
        if (isLabyrinthResultBetter(result, best)) {
            currentDTOs = currentDTOs.slice();
            currentDTOs[playerIndex] = { ...currentDTOs[playerIndex], equipment: result.equipment };
            equipmentChanges.push(`${stageLabel}:\n${indentLines(result.description)}`);
            totalCost += result.cost;
            best = await runStageSim();
        } else {
            equipmentChanges.push(`${stageLabel}: no improvement`);
        }
    };

    const applyAbilitiesStage = async (stageLabel) => {
        const result = await optimizeLabyrinthAbilities(
            {
                playerDTOs: currentDTOs,
                playerIndex,
                gameData,
                monsterHrid,
                roomLevel,
                crates,
                hours,
                communityBuffs,
                labyrinthCombatBuffs,
                budget,
                poolSize,
                specialization,
            },
            wrapProgress(stageLabel)
        );
        if (!result) {
            abilityChanges.push(`${stageLabel}: no improvement found`);
            return;
        }
        // Below clearing, win rate alone can't tell ability combos apart — same fallback to
        // damage dealt / deaths as the equipment stage above (see isLabyrinthResultBetter).
        if (isLabyrinthResultBetter(result, best)) {
            currentDTOs = currentDTOs.slice();
            currentDTOs[playerIndex] = { ...currentDTOs[playerIndex], abilities: result.abilities };
            abilityChanges.push(`${stageLabel}:\n${indentLines(result.description)}`);
            totalCost += result.cost;
            best = await runStageSim();
        } else {
            abilityChanges.push(`${stageLabel}: no improvement`);
        }
    };

    await applyEquipmentStage('Equipment 1/4');
    await applyAbilitiesStage('Abilities 2/4');
    await applyEquipmentStage('Equipment 3/4');
    await applyAbilitiesStage('Abilities 4/4');

    const finalDTO = currentDTOs[playerIndex];
    return {
        winRate: best.winRate,
        attempts: best.attempts,
        encounters: best.encounters,
        deaths: best.deaths,
        totalDamageDealt: best.totalDamageDealt,
        equipment: finalDTO.equipment,
        abilities: finalDTO.abilities,
        cost: totalCost,
        description: `Equipment:\n${indentLines(equipmentChanges.join('\n'))}\nAbilities:\n${indentLines(abilityChanges.join('\n'))}`,
    };
}

/**
 * Run the full upgrade analysis: baseline sim + one sim per candidate.
 * @param {Object} params - { playerDTOs, playerIndex, zoneHrid, difficultyTier, hours, communityBuffs, upgradeMode,
 *  abilityOptimizePoolSize }
 * @param {Function} onProgress - Called with { current, total, description }
 * @param {Object} [options] - { abortSignal: () => boolean }
 * @returns {Promise<Object>} { baseline, results: [{candidate, cost, metrics, deltas, goldPer}] }
 */
export async function runUpgradeAnalysis(params, onProgress, options = {}) {
    const {
        playerDTOs,
        playerIndex,
        zoneHrid,
        difficultyTier,
        hours,
        communityBuffs,
        upgradeMode,
        abilityLevelType,
        abilityTargetLevel,
        abilityLevelBudget,
        abilitySwapBudget,
        equipmentBudget,
        equipmentLevelBoost,
        skipBackSlot,
        abilityReorderEnabled,
        abilityOptimizePoolSize,
    } = params;
    const { abortSignal } = options;
    const gameData = buildGameDataPayload();
    if (!gameData) throw new Error('No game data available');

    const playerDTO = playerDTOs[playerIndex];
    const playerHrid = playerDTO.hrid;

    // Generate candidates and compute costs
    let candidatesWithCost;
    if (upgradeMode === 'ability_optimize') {
        // Full from-scratch ability search: its own two-phase (rank, then combine) async
        // pipeline instead of the synchronous per-slot candidate generator above, since it
        // needs ranking sims before it can even produce a candidate list.
        const optimizeCandidates = await generateAbilityOptimizeCandidates(
            {
                playerDTOs,
                playerIndex,
                gameData,
                zoneHrid,
                difficultyTier,
                hours,
                communityBuffs,
                budget: abilitySwapBudget,
                poolSize: abilityOptimizePoolSize,
            },
            onProgress,
            abortSignal
        );
        if (abortSignal?.()) return { baseline: null, results: [] };
        candidatesWithCost = optimizeCandidates.map((c) => ({ ...c, cost: calculateUpgradeCost(c, gameData) }));
    } else {
        const candidates = generateCandidates(
            playerDTO,
            gameData,
            upgradeMode,
            abilityTargetLevel,
            abilityLevelType,
            skipBackSlot,
            abilitySwapBudget,
            abilityLevelBudget,
            equipmentBudget,
            equipmentLevelBoost,
            abilityReorderEnabled
        );
        candidatesWithCost = candidates.map((c) => ({
            ...c,
            cost: calculateUpgradeCost(c, gameData),
        }));
    }

    if (upgradeMode === 'equipment') {
        // Filter out equipment candidates the player can't reasonably afford, so time
        // isn't wasted simulating upgrades far outside their budget. Defaults to 1M if
        // no budget is entered; the UI allows sub-1M budgets (e.g. 0.5) for cheap slots.
        const budget = equipmentBudget != null && equipmentBudget > 0 ? equipmentBudget : 1_000_000;
        candidatesWithCost = candidatesWithCost.filter((c) => c.cost <= budget);
    }

    const total = candidatesWithCost.length + 1; // +1 for baseline

    let current = 0;

    // Ability swaps/optimize are compared on pure ability performance, not on whether the
    // player's current food/mana setup happens to sustain the new abilities — otherwise a
    // strong ability could rank worse than it should just because it runs the sim out of mana.
    const infiniteMana = upgradeMode === 'ability_swap' || upgradeMode === 'ability_optimize';

    // Run baseline sim
    onProgress?.({ current: 0, total, description: 'Running baseline...' });
    const baselineResult = await runSimulation(
        { gameData, playerDTOs, zoneHrid, difficultyTier, hours, communityBuffs, infiniteMana },
        null
    );
    current++;

    if (abortSignal?.()) return { baseline: null, results: [] };

    onProgress?.({ current, total, description: 'Baseline complete' });

    // Calculate baseline metrics
    const baselineMetrics = computeMetrics(baselineResult, gameData, playerHrid, hours);

    // Run sim for each candidate, fanned out across the worker pool instead of one at a time.
    const results = [];
    let cursor = 0;
    const workerCount = Math.max(1, Math.min(getMaxBatchWorkers(), candidatesWithCost.length));
    await Promise.all(
        Array.from({ length: workerCount }, async () => {
            while (cursor < candidatesWithCost.length && !abortSignal?.()) {
                const candidate = candidatesWithCost[cursor++];

                onProgress?.({ current, total, description: `Simulating: ${candidate.description}` });

                // Shallow-clone only what this candidate actually changes (playerDTOs array,
                // the target player, and the one abilities/equipment container it touches) —
                // each candidate gets its own independent objects for the fields it mutates,
                // so concurrent candidates never stomp on each other, without paying for a
                // full JSON deep-clone of the whole (potentially multi-player) DTO tree.
                const modifiedDTOs = playerDTOs.slice();
                const basePlayer = playerDTOs[playerIndex];

                if (candidate.reorderSlots) {
                    // Multi-slot ability change (reorder or full optimize): apply every
                    // touched slot in one shot rather than a single slot mutation.
                    const abilities = basePlayer.abilities.slice();
                    candidate.reorderSlots.forEach((slotIdx, i) => {
                        abilities[slotIdx] = candidate.reorderAbilities[i];
                    });
                    modifiedDTOs[playerIndex] = { ...basePlayer, abilities };
                } else if (candidate.slot.startsWith('ability_')) {
                    // Ability upgrade/swap
                    const slotIdx = parseInt(candidate.slot.split('_')[1]);
                    const abilities = basePlayer.abilities.slice();
                    abilities[slotIdx] = {
                        hrid: candidate.upgradeHrid,
                        level: candidate.upgradeLevel,
                        triggers: null,
                    };
                    modifiedDTOs[playerIndex] = { ...basePlayer, abilities };
                } else {
                    // Equipment upgrade
                    modifiedDTOs[playerIndex] = {
                        ...basePlayer,
                        equipment: {
                            ...basePlayer.equipment,
                            [candidate.slot]: {
                                hrid: candidate.upgradeHrid,
                                enhancementLevel: candidate.upgradeLevel,
                            },
                        },
                    };
                }

                const simResult = await runSimulation(
                    {
                        gameData,
                        playerDTOs: modifiedDTOs,
                        zoneHrid,
                        difficultyTier,
                        hours,
                        communityBuffs,
                        singleWorker: true,
                        infiniteMana,
                    },
                    null
                );

                if (abortSignal?.()) break;

                const metrics = computeMetrics(simResult, gameData, playerHrid, hours);
                const deltas = computeDeltas(baselineMetrics, metrics);
                const goldPer = computeGoldPerImprovement(candidate.cost, deltas);

                results.push({ candidate, cost: candidate.cost, metrics, deltas, goldPer });
                current++;
                onProgress?.({ current, total, description: candidate.description });
            }
        })
    );

    // Sort by best value (lowest gold per 0.01% DPS improvement)
    results.sort((a, b) => {
        const aVal = a.goldPer.dps === Infinity ? Number.MAX_VALUE : a.goldPer.dps;
        const bVal = b.goldPer.dps === Infinity ? Number.MAX_VALUE : b.goldPer.dps;
        return aVal - bVal;
    });

    return { baseline: baselineMetrics, results };
}

/**
 * Compute key metrics from a sim result.
 */
function computeMetrics(simResult, gameData, playerHrid, hours) {
    const simHours = (simResult.simulatedTime || 0) / (3600 * 1e9) || hours;
    const xp = simResult.experienceGained?.[playerHrid] || {};
    const totalXpPerHour = Object.values(xp).reduce((s, v) => s + v, 0) / simHours;
    const deaths = (simResult.deaths?.[playerHrid] || 0) / simHours;
    const encounters = (simResult.encounters || 0) / simHours;

    // Profit/hr
    const revenue = calculateSimRevenue(simResult, gameData, playerHrid, simHours);

    return {
        xpPerHour: totalXpPerHour,
        profitPerHour: revenue.netPerHour,
        deathsPerHour: deaths,
        encountersPerHour: encounters,
        dps: (simResult.totalDamageDealt?.[playerHrid] || 0) / (simHours * 3600),
    };
}

/**
 * Compute percentage deltas between baseline and upgraded metrics.
 */
function computeDeltas(baseline, upgraded) {
    const pctDelta = (base, upg) => {
        if (base === 0) return upg > 0 ? 100 : 0;
        return ((upg - base) / Math.abs(base)) * 100;
    };

    return {
        dps: pctDelta(baseline.dps, upgraded.dps),
        xp: pctDelta(baseline.xpPerHour, upgraded.xpPerHour),
        profit: pctDelta(baseline.profitPerHour, upgraded.profitPerHour),
        deaths: pctDelta(baseline.deathsPerHour, upgraded.deathsPerHour),
        encounters: pctDelta(baseline.encountersPerHour, upgraded.encountersPerHour),
    };
}

/**
 * Compute gold per 0.1% improvement for each metric.
 * Lower = better value.
 */
function computeGoldPerImprovement(cost, deltas) {
    const goldPer = (pctDelta) => {
        if (pctDelta <= 0) return Infinity;
        // Gold per 0.1% = cost / (pctDelta * 10)
        // pctDelta is already in percent (e.g., 2 = 2%)
        return cost / (pctDelta * 10);
    };

    // For deaths, fewer is better — use negative delta (reduction)
    const goldPerReduction = (pctDelta) => {
        if (pctDelta >= 0) return Infinity; // Deaths didn't decrease
        return cost / (Math.abs(pctDelta) * 10);
    };

    return {
        dps: goldPer(deltas.dps),
        xp: goldPer(deltas.xp),
        profit: goldPer(deltas.profit),
        encounters: goldPer(deltas.encounters),
        deaths: goldPerReduction(deltas.deaths),
    };
}

// ─── Labyrinth Buff Upgrade Candidates ──────────────────────────────────────

const LABYRINTH_BUFF_DEFS = [
    {
        key: 'labyrinthCombatDamageLevel',
        name: 'Combat Damage',
        step: 0.01,
        maxLevel: 12,
        tokenCost: 40,
        category: 'combat',
        uniqueKey: 'combat_damage',
        typeHrid: '/buff_types/damage',
        valueKey: 'ratioBoost',
    },
    {
        key: 'labyrinthAttackSpeedLevel',
        name: 'Attack Speed',
        step: 0.01,
        maxLevel: 12,
        tokenCost: 40,
        category: 'combat',
        uniqueKey: 'attack_speed',
        typeHrid: '/buff_types/attack_speed',
        valueKey: 'ratioBoost',
    },
    {
        key: 'labyrinthCastSpeedLevel',
        name: 'Cast Speed',
        step: 0.01,
        maxLevel: 12,
        tokenCost: 40,
        category: 'combat',
        uniqueKey: 'cast_speed',
        typeHrid: '/buff_types/cast_speed',
        valueKey: 'flatBoost',
    },
    {
        key: 'labyrinthCriticalRateLevel',
        name: 'Critical Rate',
        step: 0.01,
        maxLevel: 12,
        tokenCost: 40,
        category: 'combat',
        uniqueKey: 'critical_rate',
        typeHrid: '/buff_types/critical_rate',
        valueKey: 'flatBoost',
    },
    {
        key: 'labyrinthSkillActionSpeedLevel',
        name: 'Skilling Speed',
        step: 0.01,
        maxLevel: 12,
        tokenCost: 40,
        category: 'skilling',
        metric: 'actionSpeedBonus',
    },
    {
        key: 'labyrinthSkillingEfficiencyLevel',
        name: 'Skilling Efficiency',
        step: 0.01,
        maxLevel: 12,
        tokenCost: 40,
        category: 'skilling',
        metric: 'efficiencyBonus',
    },
    {
        key: 'labyrinthSkillingSuccessLevel',
        name: 'Success Rate',
        step: 0.005,
        maxLevel: 12,
        tokenCost: 40,
        category: 'skilling',
        metric: 'successBonus',
    },
    {
        key: 'labyrinthSkillingDoubleProgressLevel',
        name: 'Double Progress',
        step: 0.01,
        maxLevel: 12,
        tokenCost: 40,
        category: 'skilling',
        metric: 'doubleProgressBonus',
    },
    {
        key: 'labyrinthExperienceLevel',
        name: 'Experience',
        step: 0.01,
        maxLevel: 12,
        tokenCost: 80,
        category: 'experience',
    },
];

const LABYRINTH_SKILLS = [
    '/skills/woodcutting',
    '/skills/foraging',
    '/skills/milking',
    '/skills/cooking',
    '/skills/brewing',
    '/skills/cheesesmithing',
    '/skills/crafting',
    '/skills/tailoring',
    '/skills/alchemy',
    '/skills/enhancing',
];

/**
 * Generate labyrinth buff upgrade candidates from characterInfo.
 * @returns {Array} Buff candidates with type 'labyrinth_buff'
 */
export function generateLabyrinthBuffCandidates() {
    const info = dataManager.characterData?.characterInfo;
    if (!info) return [];

    const candidates = [];
    for (const def of LABYRINTH_BUFF_DEFS) {
        const currentLevel = Math.max(0, Math.floor(Number(info[def.key]) || 0));
        if (currentLevel >= def.maxLevel) continue;

        candidates.push({
            type: 'labyrinth_buff',
            category: def.category,
            buffKey: def.key,
            currentLevel,
            step: def.step,
            tokenCost: def.tokenCost * (currentLevel + 1),
            description: `${def.name} Lv${currentLevel}\u2192${currentLevel + 1}`,
            uniqueKey: def.uniqueKey,
            typeHrid: def.typeHrid,
            valueKey: def.valueKey,
            metric: def.metric,
        });
    }
    return candidates;
}

/**
 * Clone labyrinth combat buffs with +1 to a specific buff.
 * @param {Array} baseBuffs - Current labyrinth combat buffs
 * @param {Object} candidate - Buff candidate with uniqueKey/typeHrid/valueKey/step
 * @returns {Array} Modified buffs array
 */
function buildModifiedCombatBuffs(baseBuffs, candidate) {
    const uniqueHrid = `/buff_uniques/labyrinth_upgrade_${candidate.uniqueKey}`;
    const modified = JSON.parse(JSON.stringify(baseBuffs));

    const existing = modified.find((b) => b.uniqueHrid === uniqueHrid);
    if (existing) {
        existing[candidate.valueKey] += candidate.step;
    } else {
        const buff = {
            uniqueHrid,
            typeHrid: candidate.typeHrid,
            ratioBoost: 0,
            ratioBoostLevelBonus: 0,
            flatBoost: 0,
            flatBoostLevelBonus: 0,
            startTime: '0001-01-01T00:00:00Z',
            duration: 0,
        };
        buff[candidate.valueKey] = candidate.step;
        modified.push(buff);
    }
    return modified;
}

/**
 * Run labyrinth upgrade analysis: baseline sim + equipment sims + buff sims.
 * Ranks upgrades by win rate / clear rate delta, grouped by cost type (token vs gold).
 * @param {Object} params
 * @param {Array} params.playerDTOs - Player DTOs (only first used — labyrinth is solo)
 * @param {number} params.playerIndex - Index of the player to analyze
 * @param {string} params.monsterHrid - Labyrinth monster HRID
 * @param {number} params.roomLevel - Room level to test at
 * @param {string[]} params.crates - Crate item HRIDs
 * @param {number} params.hours - Hours to simulate per candidate
 * @param {Object} params.communityBuffs - Community buffs
 * @param {Array} [params.labyrinthCombatBuffs] - Combat buffs from labyrinth upgrades
 * @param {string} params.upgradeMode - 'equipment', 'ability_level', or 'ability_swap'
 * @param {number} [params.abilityTargetLevel] - Target ability level
 * @param {Function} onProgress - Called with { current, total, description }
 * @param {Object} [options] - { abortSignal: () => boolean }
 * @returns {Promise<Object>} { baseline, results: [{candidate, costType, ...}] }
 */
export async function runLabyrinthUpgradeAnalysis(params, onProgress, options = {}) {
    const {
        playerDTOs,
        playerIndex,
        monsterHrid,
        roomLevel,
        crates,
        hours,
        communityBuffs,
        labyrinthCombatBuffs = [],
        upgradeMode,
        abilityLevelType,
        abilityTargetLevel,
        skipBackSlot,
    } = params;
    const { abortSignal } = options;
    const gameData = buildGameDataPayload();
    if (!gameData) throw new Error('No game data available');

    const playerDTO = playerDTOs[playerIndex];

    const zoneHrid =
        Object.keys(gameData.actionDetailMap).find((k) => k.includes('/actions/combat/')) || '/actions/combat/fly';

    // Generate equipment candidates
    const candidates = generateCandidates(
        playerDTO,
        gameData,
        upgradeMode,
        abilityTargetLevel,
        abilityLevelType,
        skipBackSlot
    );
    const candidatesWithCost = candidates.map((c) => ({
        ...c,
        cost: calculateUpgradeCost(c, gameData),
    }));

    // Generate buff candidates (skilling buffs handled in skilling tab)
    const buffCandidates = generateLabyrinthBuffCandidates();
    const combatBuffCandidates = buffCandidates.filter((c) => c.category === 'combat');
    const experienceBuffCandidates = buffCandidates.filter((c) => c.category === 'experience');

    const total = candidatesWithCost.length + combatBuffCandidates.length + experienceBuffCandidates.length + 1;
    let current = 0;

    // Run baseline labyrinth sim
    onProgress?.({ current: 0, total, description: 'Running baseline...' });
    const baselineResult = await runLabyrinthSimulation({
        gameData,
        playerDTOs: [playerDTOs[playerIndex]],
        zoneHrid,
        monsterHrid,
        roomLevel,
        crates,
        hours,
        communityBuffs,
        labyrinthCombatBuffs,
    });
    current++;

    if (abortSignal?.()) return { baseline: null, results: [] };

    const baselineAttempts = baselineResult.labyAttemptCount || 1;
    const baselineEncounters = baselineResult.encounters || 0;
    const baselineWinRate = baselineEncounters / baselineAttempts;

    onProgress?.({ current, total, description: `Baseline: ${(baselineWinRate * 100).toFixed(1)}%` });

    const results = [];

    // ── Equipment / ability sims (fanned out across the worker pool) ──
    let candidateCursor = 0;
    const candidateWorkerCount = Math.max(1, Math.min(getMaxBatchWorkers(), candidatesWithCost.length));
    await Promise.all(
        Array.from({ length: candidateWorkerCount }, async () => {
            while (candidateCursor < candidatesWithCost.length && !abortSignal?.()) {
                const candidate = candidatesWithCost[candidateCursor++];

                onProgress?.({ current, total, description: `Simulating: ${candidate.description}` });

                // Shallow-clone only the container this candidate touches (abilities array or
                // equipment map) instead of deep-cloning the whole player DTO — each candidate
                // still gets its own independent objects, safe for concurrent execution.
                const basePlayer = playerDTOs[playerIndex];
                let modifiedDTO;

                if (candidate.reorderSlots) {
                    const abilities = basePlayer.abilities.slice();
                    candidate.reorderSlots.forEach((slotIdx, i) => {
                        abilities[slotIdx] = candidate.reorderAbilities[i];
                    });
                    modifiedDTO = { ...basePlayer, abilities };
                } else if (candidate.slot.startsWith('ability_')) {
                    const slotIdx = parseInt(candidate.slot.split('_')[1]);
                    const abilities = basePlayer.abilities.slice();
                    abilities[slotIdx] = {
                        hrid: candidate.upgradeHrid,
                        level: candidate.upgradeLevel,
                        triggers: null,
                    };
                    modifiedDTO = { ...basePlayer, abilities };
                } else if (candidate.type === 'cross_slot') {
                    const equipment = { ...basePlayer.equipment };
                    for (const slot of candidate.clearedSlots) {
                        equipment[slot] = null;
                    }
                    for (const [slot, item] of Object.entries(candidate.addedSlots)) {
                        equipment[slot] = item;
                    }
                    modifiedDTO = { ...basePlayer, equipment };
                } else {
                    modifiedDTO = {
                        ...basePlayer,
                        equipment: {
                            ...basePlayer.equipment,
                            [candidate.slot]: {
                                hrid: candidate.upgradeHrid,
                                enhancementLevel: candidate.upgradeLevel,
                            },
                        },
                    };
                }

                const simResult = await runLabyrinthSimulation({
                    gameData,
                    playerDTOs: [modifiedDTO],
                    zoneHrid,
                    monsterHrid,
                    roomLevel,
                    crates,
                    hours,
                    communityBuffs,
                    labyrinthCombatBuffs,
                });

                if (abortSignal?.()) break;

                const attempts = simResult.labyAttemptCount || 1;
                const encounters = simResult.encounters || 0;
                const winRate = encounters / attempts;
                const winRateDelta = winRate - baselineWinRate;

                results.push({
                    candidate,
                    costType: 'gold',
                    cost: candidate.cost,
                    winRate,
                    winRateDelta,
                    goldPerWinRate: winRateDelta > 0 ? candidate.cost / (winRateDelta * 100) : Infinity,
                    metricType: 'winRate',
                });
                current++;
                onProgress?.({ current, total, description: candidate.description });
            }
        })
    );

    // ── Combat buff sims (fanned out across the worker pool) ──
    let buffCursor = 0;
    const buffWorkerCount = Math.max(1, Math.min(getMaxBatchWorkers(), combatBuffCandidates.length));
    await Promise.all(
        Array.from({ length: buffWorkerCount }, async () => {
            while (buffCursor < combatBuffCandidates.length && !abortSignal?.()) {
                const buffCandidate = combatBuffCandidates[buffCursor++];

                onProgress?.({ current, total, description: `Simulating: ${buffCandidate.description}` });

                const modifiedBuffs = buildModifiedCombatBuffs(labyrinthCombatBuffs, buffCandidate);
                const simResult = await runLabyrinthSimulation({
                    gameData,
                    playerDTOs: [playerDTOs[playerIndex]],
                    zoneHrid,
                    monsterHrid,
                    roomLevel,
                    crates,
                    hours,
                    communityBuffs,
                    labyrinthCombatBuffs: modifiedBuffs,
                });

                if (abortSignal?.()) break;

                const attempts = simResult.labyAttemptCount || 1;
                const encounters = simResult.encounters || 0;
                const winRate = encounters / attempts;
                const winRateDelta = winRate - baselineWinRate;

                results.push({
                    candidate: buffCandidate,
                    costType: 'token',
                    tokenCost: buffCandidate.tokenCost,
                    winRate,
                    winRateDelta,
                    metricType: 'winRate',
                });
                current++;
                onProgress?.({ current, total, description: buffCandidate.description });
            }
        })
    );

    // ── Experience buff (flat % increase, no sim needed) ──
    for (const buffCandidate of experienceBuffCandidates) {
        const currentBonus = buffCandidate.currentLevel * buffCandidate.step;
        const newBonus = (buffCandidate.currentLevel + 1) * buffCandidate.step;
        const xpDeltaPct = ((1 + newBonus) / (1 + currentBonus) - 1) * 100;

        results.push({
            candidate: buffCandidate,
            costType: 'token',
            tokenCost: buffCandidate.tokenCost,
            xpDeltaPct,
            metricType: 'experience',
        });
        current++;
        onProgress?.({ current, total, description: buffCandidate.description });
    }

    // Sort: token results first, then gold; within each group by best delta descending
    results.sort((a, b) => {
        if (a.costType !== b.costType) return a.costType === 'token' ? -1 : 1;
        const aDelta = a.winRateDelta ?? a.clearRateDelta ?? a.xpDeltaPct ?? 0;
        const bDelta = b.winRateDelta ?? b.clearRateDelta ?? b.xpDeltaPct ?? 0;
        return bDelta - aDelta;
    });

    return {
        baseline: {
            winRate: baselineWinRate,
            encounters: baselineEncounters,
            attempts: baselineAttempts,
        },
        results,
    };
}

// ─── Editor-Based Skilling Analysis ──────────────────────────────────────────

const SKILLING_DTO_KEYS = {
    '/skills/woodcutting': 'woodcuttingLevel',
    '/skills/foraging': 'foragingLevel',
    '/skills/milking': 'milkingLevel',
    '/skills/cooking': 'cookingLevel',
    '/skills/brewing': 'brewingLevel',
    '/skills/cheesesmithing': 'cheesesmithingLevel',
    '/skills/crafting': 'craftingLevel',
    '/skills/tailoring': 'tailoringLevel',
    '/skills/alchemy': 'alchemyLevel',
    '/skills/enhancing': 'enhancingLevel',
};

/**
 * Compute per-skill clear results from editor state.
 * @param {number} roomLevel
 * @param {Object} editorDTO - Player DTO from editor
 * @param {string[]} crateHrids - Selected crate HRIDs
 * @param {Object} gameData - From buildGameDataPayload()
 * @param {Object} [skillEquipmentMap] - Per-skill equipment overrides { '/skills/X': { slot: { hrid, enhancementLevel } } }
 * @returns {Array<Object>} Per-skill results with skill name, clear chance, etc.
 */
export function computeSkillingClearRatesFromEditor(
    roomLevel,
    editorDTO,
    crateHrids,
    gameData,
    skillEquipmentMap = {}
) {
    return LABYRINTH_SKILLS.map((skillHrid) =>
        computeSkillingClearForSkill(skillHrid, roomLevel, editorDTO, crateHrids, gameData, skillEquipmentMap)
    );
}

/**
 * Compute a single skill's clear result from editor state at a given room level. Shared by
 * computeSkillingClearRatesFromEditor (all skills at one level) and findMaxSkillingLevels
 * (one skill across many levels, via binary search).
 * @param {string} skillHrid
 * @param {number} roomLevel
 * @param {Object} editorDTO - Player DTO from editor
 * @param {string[]} crateHrids - Selected crate HRIDs
 * @param {Object} gameData - From buildGameDataPayload()
 * @param {Object} [skillEquipmentMap] - Per-skill equipment overrides
 * @returns {Object} Clear result with stats
 */
function computeSkillingClearForSkill(skillHrid, roomLevel, editorDTO, crateHrids, gameData, skillEquipmentMap = {}) {
    const skillId = skillHrid.replace('/skills/', '');
    const actionTypeHrid = `/action_types/${skillId}`;
    const dtoKey = SKILLING_DTO_KEYS[skillHrid];
    const baseLevel = editorDTO[dtoKey] || 1;

    const editorState = {
        equipment: skillEquipmentMap[skillHrid] || editorDTO.equipment,
        houseRooms: editorDTO.houseRooms,
        tokenUpgrades: editorDTO.tokenUpgrades,
        communityBuffLevels: editorDTO.communityBuffLevels,
    };

    const overrides = buildOverridesForSkill(editorState, actionTypeHrid, crateHrids, gameData);
    const metrics = labyrinthClearRate.getSkillingMetricsFromOverrides(skillId, actionTypeHrid, overrides);

    let result;
    if (skillHrid === '/skills/enhancing') {
        result = labyrinthClearRate.computeEnhancingClearWithParams(metrics, baseLevel, roomLevel);
    } else {
        result = labyrinthClearRate.computeSkillingClearWithParams(metrics, baseLevel, roomLevel);
    }
    result.skillHrid = skillHrid;
    result.skillId = skillId;
    result.skillName = skillId.charAt(0).toUpperCase() + skillId.slice(1);
    return result;
}

/**
 * Binary search each labyrinth skill for the highest room level where its clear chance is still
 * >= threshold. Unlike the combat "Find Max" search (which needs a stochastic simulation per
 * level), skilling clear chance is a deterministic formula of (baseLevel, roomLevel) that's
 * monotonically non-increasing in roomLevel — success chance and required progress both get
 * worse as the room level rises — so a plain binary search over computeSkillingClearForSkill()
 * is exact and needs no simulation.
 * @param {Object} editorDTO - Player DTO from editor
 * @param {string[]} crateHrids - Selected crate HRIDs
 * @param {Object} gameData - From buildGameDataPayload()
 * @param {Object} [skillEquipmentMap] - Per-skill equipment overrides
 * @param {number} [threshold=0.95] - Clear chance threshold (0-1)
 * @param {number} [minLevel=1] - Minimum room level to search
 * @param {number} [maxLevel=300] - Maximum room level to search
 * @returns {Array<Object>} Per-skill results: clear result at the found max level, plus
 *  `maxLevel` (0 if no level in range meets the threshold).
 */
export function findMaxSkillingLevels(
    editorDTO,
    crateHrids,
    gameData,
    skillEquipmentMap = {},
    threshold = 0.95,
    minLevel = 1,
    maxLevel = 300
) {
    return LABYRINTH_SKILLS.map((skillHrid) => {
        let low = minLevel;
        let high = maxLevel;
        let best = computeSkillingClearForSkill(
            skillHrid,
            minLevel,
            editorDTO,
            crateHrids,
            gameData,
            skillEquipmentMap
        );
        best.maxLevel = 0;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const result = computeSkillingClearForSkill(
                skillHrid,
                mid,
                editorDTO,
                crateHrids,
                gameData,
                skillEquipmentMap
            );

            if (result.clearChance >= threshold) {
                best = result;
                best.maxLevel = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        return best;
    });
}

/**
 * Compute average skilling clear rate from editor state.
 * @param {number} roomLevel
 * @param {Object} editorDTO - Player DTO from editor
 * @param {string[]} crateHrids - Selected crate HRIDs
 * @param {Object} gameData - From buildGameDataPayload()
 * @param {Object} [options]
 * @param {Object} [options.metricOverride] - { key, delta } to add to one metric across all skills
 * @param {Object} [options.skillEquipmentMap] - Per-skill equipment overrides
 * @returns {number} Average clear rate (0-1)
 */
function computeAverageSkillingClearRateFromEditor(roomLevel, editorDTO, crateHrids, gameData, options = {}) {
    const { metricOverride = null, skillEquipmentMap = {}, targetSkill = null } = options;

    let total = 0;
    let count = 0;

    const skillsToEval = targetSkill ? [targetSkill] : LABYRINTH_SKILLS;

    for (const skillHrid of skillsToEval) {
        const skillId = skillHrid.replace('/skills/', '');
        const actionTypeHrid = `/action_types/${skillId}`;
        const dtoKey = SKILLING_DTO_KEYS[skillHrid];
        const baseLevel = editorDTO[dtoKey] || 1;

        const editorState = {
            equipment: skillEquipmentMap[skillHrid] || editorDTO.equipment,
            houseRooms: editorDTO.houseRooms,
            tokenUpgrades: editorDTO.tokenUpgrades,
            communityBuffLevels: editorDTO.communityBuffLevels,
        };

        const overrides = buildOverridesForSkill(editorState, actionTypeHrid, crateHrids, gameData);
        const metrics = labyrinthClearRate.getSkillingMetricsFromOverrides(skillId, actionTypeHrid, overrides);

        if (metricOverride) {
            metrics[metricOverride.key] = (metrics[metricOverride.key] || 0) + metricOverride.delta;
        }

        let clearChance;
        if (skillHrid === '/skills/enhancing') {
            clearChance = labyrinthClearRate.computeEnhancingClearWithParams(metrics, baseLevel, roomLevel).clearChance;
        } else {
            clearChance = labyrinthClearRate.computeSkillingClearWithParams(metrics, baseLevel, roomLevel).clearChance;
        }

        total += clearChance;
        count++;
    }

    return count > 0 ? total / count : 0;
}

/**
 * Generate labyrinth buff candidates from editor token upgrade levels.
 * @param {Object} tokenUpgrades - { speed, efficiency, success, doubleProgress }
 * @returns {Array} Buff candidates with type 'labyrinth_buff'
 */
function generateLabyrinthBuffCandidatesFromEditor(tokenUpgrades) {
    const skillingDefs = LABYRINTH_BUFF_DEFS.filter((d) => d.category === 'skilling');
    const editorKeyMap = {
        labyrinthSkillActionSpeedLevel: 'speed',
        labyrinthSkillingEfficiencyLevel: 'efficiency',
        labyrinthSkillingSuccessLevel: 'success',
        labyrinthSkillingDoubleProgressLevel: 'doubleProgress',
    };

    const candidates = [];
    for (const def of skillingDefs) {
        const editorKey = editorKeyMap[def.key];
        const currentLevel = Math.max(0, Math.floor(Number(tokenUpgrades?.[editorKey]) || 0));
        if (currentLevel >= def.maxLevel) continue;

        candidates.push({
            type: 'labyrinth_buff',
            category: def.category,
            buffKey: def.key,
            editorKey,
            currentLevel,
            step: def.step,
            tokenCost: def.tokenCost * (currentLevel + 1),
            description: `${def.name} Lv${currentLevel}\u2192${currentLevel + 1}`,
            metric: def.metric,
        });
    }
    return candidates;
}

/**
 * Generate skilling equipment enhancement candidates from editor equipment.
 * Considers per-skill equipment overrides to find all unique items that need upgrading.
 * @param {Object} editorDTO - Player DTO from editor
 * @param {Object} gameData - From buildGameDataPayload()
 * @param {Object} [skillEquipmentMap] - Per-skill equipment overrides
 * @returns {Array} Enhancement candidates with gold cost
 */
export function generateSkillingEquipmentCandidates(editorDTO, gameData, skillEquipmentMap = {}) {
    const itemDetailMap = gameData.itemDetailMap || {};
    const candidates = [];
    const seen = new Set();

    const equipmentSets = [editorDTO.equipment || {}];
    for (const skillEquip of Object.values(skillEquipmentMap)) {
        if (skillEquip) equipmentSets.push(skillEquip);
    }

    for (const equipment of equipmentSets) {
        for (const [slot, equip] of Object.entries(equipment)) {
            if (!equip?.hrid) continue;
            if (slot === '/equipment_types/trinket' || slot === '/equipment_types/charm') continue;
            const dedupKey = `${slot}:${equip.hrid}:${equip.enhancementLevel || 0}`;
            if (seen.has(dedupKey)) continue;
            seen.add(dedupKey);

            const itemDetails = itemDetailMap[equip.hrid];
            if (!itemDetails?.equipmentDetail?.noncombatStats) continue;

            const hasNoncombat = Object.values(itemDetails.equipmentDetail.noncombatStats).some((v) => v > 0);
            if (!hasNoncombat) continue;

            const currentLevel = equip.enhancementLevel || 0;
            const nextBP = getNextBreakpoint(currentLevel, slot, equip.hrid);
            if (!nextBP) continue;

            const itemName = itemDetails.name || equip.hrid.split('/').pop();
            const candidate = {
                slot,
                currentHrid: equip.hrid,
                currentLevel,
                upgradeHrid: equip.hrid,
                upgradeLevel: nextBP,
                description: `${itemName} +${currentLevel} \u2192 +${nextBP}`,
                type: 'enhancement',
            };
            candidate.cost = calculateUpgradeCost(candidate, gameData);
            candidates.push(candidate);
        }
    }

    return candidates;
}

/**
 * Run skilling upgrade analysis from editor state.
 * @param {Object} params
 * @param {Object} params.editorDTO - Player DTO from editor
 * @param {number} params.roomLevel - Room level
 * @param {string[]} params.crateHrids - Selected crate HRIDs
 * @param {Object} [params.skillEquipmentMap] - Per-skill equipment overrides
 * @param {Function} onProgress - Called with { current, total, description }
 * @param {Object} [options] - { abortSignal: () => boolean }
 * @returns {Object} { baseline, results }
 */
export function runSkillingUpgradeAnalysis(params, onProgress, options = {}) {
    const { editorDTO, roomLevel, crateHrids, skillEquipmentMap = {}, targetSkill = null } = params;
    const { abortSignal } = options;
    const gameData = buildGameDataPayload();
    if (!gameData) throw new Error('No game data available');

    const tokenUpgrades = editorDTO.tokenUpgrades || {};
    const buffCandidates = generateLabyrinthBuffCandidatesFromEditor(tokenUpgrades);
    const equipCandidates = generateSkillingEquipmentCandidates(editorDTO, gameData, skillEquipmentMap);
    const clearRateOpts = { skillEquipmentMap, targetSkill };

    const total = buffCandidates.length + equipCandidates.length + 1;
    let current = 0;

    onProgress?.({ current: 0, total, description: 'Computing baseline...' });
    const baselineClearRate = computeAverageSkillingClearRateFromEditor(
        roomLevel,
        editorDTO,
        crateHrids,
        gameData,
        clearRateOpts
    );
    current++;

    if (abortSignal?.()) return { baseline: null, results: [] };

    onProgress?.({ current, total, description: `Baseline: ${(baselineClearRate * 100).toFixed(1)}%` });

    const results = [];

    for (const buffCandidate of buffCandidates) {
        if (abortSignal?.()) break;

        onProgress?.({ current, total, description: `Evaluating: ${buffCandidate.description}` });

        const modifiedDTO = JSON.parse(JSON.stringify(editorDTO));
        modifiedDTO.tokenUpgrades[buffCandidate.editorKey] = buffCandidate.currentLevel + 1;

        const modifiedClearRate = computeAverageSkillingClearRateFromEditor(
            roomLevel,
            modifiedDTO,
            crateHrids,
            gameData,
            clearRateOpts
        );
        const clearRateDelta = modifiedClearRate - baselineClearRate;

        results.push({
            candidate: buffCandidate,
            costType: 'token',
            tokenCost: buffCandidate.tokenCost,
            clearRate: modifiedClearRate,
            clearRateDelta,
            metricType: 'clearRate',
        });
        current++;
        onProgress?.({ current, total, description: buffCandidate.description });
    }

    for (const candidate of equipCandidates) {
        if (abortSignal?.()) break;

        onProgress?.({ current, total, description: `Evaluating: ${candidate.description}` });

        const modifiedDTO = JSON.parse(JSON.stringify(editorDTO));
        const modifiedSkillEquipMap = JSON.parse(JSON.stringify(skillEquipmentMap));
        const upgradePayload = { hrid: candidate.upgradeHrid, enhancementLevel: candidate.upgradeLevel };

        if (modifiedDTO.equipment?.[candidate.slot]?.hrid === candidate.currentHrid) {
            modifiedDTO.equipment[candidate.slot] = upgradePayload;
        }
        for (const skillEquip of Object.values(modifiedSkillEquipMap)) {
            if (skillEquip?.[candidate.slot]?.hrid === candidate.currentHrid) {
                skillEquip[candidate.slot] = upgradePayload;
            }
        }

        const modifiedClearRate = computeAverageSkillingClearRateFromEditor(
            roomLevel,
            modifiedDTO,
            crateHrids,
            gameData,
            { skillEquipmentMap: modifiedSkillEquipMap, targetSkill }
        );
        const clearRateDelta = modifiedClearRate - baselineClearRate;

        results.push({
            candidate,
            costType: 'gold',
            cost: candidate.cost,
            clearRate: modifiedClearRate,
            clearRateDelta,
            goldPerClearRate: clearRateDelta > 0 ? candidate.cost / (clearRateDelta * 100) : Infinity,
            metricType: 'clearRate',
        });
        current++;
        onProgress?.({ current, total, description: candidate.description });
    }

    results.sort((a, b) => {
        if (a.costType !== b.costType) return a.costType === 'token' ? -1 : 1;
        return (b.clearRateDelta ?? 0) - (a.clearRateDelta ?? 0);
    });

    return {
        baseline: { clearRate: baselineClearRate },
        results,
    };
}

export default {
    generateCandidates,
    calculateUpgradeCost,
    runUpgradeAnalysis,
    runLabyrinthUpgradeAnalysis,
    generateLabyrinthBuffCandidates,
    getEquipmentTierProgression,
    computeSkillingClearRatesFromEditor,
    generateSkillingEquipmentCandidates,
    runSkillingUpgradeAnalysis,
};

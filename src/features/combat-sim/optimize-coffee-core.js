/**
 * Optimize Coffee Core
 * Headless (DOM-free) combat drink (coffee) combo search, shared by the Optimize Coffee panel
 * and Ultimate Sim. Ranks combos by XP/hr, coins/hr, and a mixed (effective XP/hr) metric.
 */

import dataManager from '../../core/data-manager.js';
import { calculateSimRevenue } from './combat-sim-adapter.js';
import { runWorkerChunk, getMaxBatchWorkers } from './combat-sim-runner.js';
import { getGlobalBestProfitPerHour } from '../../utils/tea-optimizer.js';
import { generateCombos } from './combo-utils.js';

const MAX_DRINK_SLOTS = 3;
const ONE_HOUR_NS = 3600 * 1e9;

let simTaskIdCounter = 0;

/**
 * Tiny counting semaphore so total concurrent sim Workers never exceeds the configured max.
 * @param {number} max
 */
function createSemaphore(max) {
    let active = 0;
    const queue = [];
    return {
        acquire() {
            return new Promise((resolve) => {
                const tryAcquire = () => {
                    if (active < max) {
                        active++;
                        resolve(() => {
                            active--;
                            const next = queue.shift();
                            if (next) next();
                        });
                    } else {
                        queue.push(tryAcquire);
                    }
                };
                tryAcquire();
            });
        },
    };
}

/**
 * Get the buff-conflict grouping key for a consumable, mirroring sim-editor's conflict logic.
 * @param {Object} detail - item.consumableDetail
 * @returns {string|null}
 */
function getConsumableTypeKey(detail) {
    if (!detail) return null;
    const buffs = detail.buffs || [];
    if (buffs.length > 0) return 'buff:' + (buffs[0].uniqueHrid || 'unknown');
    return null;
}

/**
 * Classify a buff type hrid by which combat style it trains/boosts, based on the style name
 * baked into the hrid itself (e.g. '/buff_types/melee_level', '/buff_types/ranged_damage'). Buffs
 * with no style in their hrid (accuracy, generic damage, attack speed, stamina, wisdom, etc.) are
 * applied to every style equally by the sim engine, so they're style-neutral.
 * @param {string|undefined} typeHrid
 * @returns {'melee'|'ranged'|'magic'|null} null means style-neutral (always testable)
 */
function getBuffCombatStyle(typeHrid) {
    if (!typeHrid) return null;
    if (typeHrid.includes('melee')) return 'melee';
    if (typeHrid.includes('ranged')) return 'ranged';
    if (typeHrid.includes('magic')) return 'magic';
    return null;
}

/**
 * Determine the player's current attack style (melee/ranged/magic) from their equipped weapon,
 * mirroring the sim engine's own main_hand/two_hand/unarmed fallback (engine/player.js
 * updateCombatDetails()) — unarmed defaults to melee.
 * @param {Object} playerDTO
 * @param {Object<string, Object>} itemDetailMap
 * @returns {'melee'|'ranged'|'magic'}
 */
export function getAttackStyle(playerDTO, itemDetailMap) {
    const weaponDto =
        playerDTO.equipment?.['/equipment_types/main_hand'] || playerDTO.equipment?.['/equipment_types/two_hand'];
    const primaryTraining = weaponDto && itemDetailMap[weaponDto.hrid]?.equipmentDetail?.combatStats?.primaryTraining;
    if (primaryTraining === '/skills/ranged') return 'ranged';
    if (primaryTraining === '/skills/magic') return 'magic';
    return 'melee';
}

/**
 * Build the candidate drink groups: one best item per conflicting buff type, excluding coffees
 * whose buff is specific to a different combat style than the player's current one (e.g. a
 * melee player never gets tested with Ranged or Magic coffee). Style-neutral coffees (accuracy,
 * stamina, wisdom, attack speed, etc.) are always included.
 * @param {'melee'|'ranged'|'magic'} [attackStyle]
 * @returns {Array<{key: string, hrid: string, name: string}>}
 */
export function getCandidateDrinkGroups(attackStyle) {
    const clientData = dataManager.getInitClientData();
    const itemDetailMap = clientData?.itemDetailMap || {};

    const bestByType = new Map();
    for (const [hrid, item] of Object.entries(itemDetailMap)) {
        if (!item.consumableDetail) continue;
        const cat = item.categoryHrid || '';
        const isDrinkItem =
            (cat.includes('drink') || hrid.includes('coffee')) && item.consumableDetail.cooldownDuration > 0;
        if (!isDrinkItem) continue;

        const key = getConsumableTypeKey(item.consumableDetail);
        if (!key) continue;

        if (attackStyle) {
            const buffStyle = getBuffCombatStyle(item.consumableDetail.buffs?.[0]?.typeHrid);
            if (buffStyle && buffStyle !== attackStyle) continue;
        }

        const itemLevel = item.itemLevel || 0;
        const existing = bestByType.get(key);
        if (!existing || itemLevel > existing.itemLevel) {
            bestByType.set(key, { key, hrid, name: item.name || hrid.split('/').pop(), itemLevel });
        }
    }

    return Array.from(bestByType.values());
}

/**
 * Run one simulation for a given drink loadout and extract the metrics Optimize Coffee ranks on.
 * @param {Object} ctx - Shared run context (semaphore, gameData, playerDTOs, baseIndex, zoneHrid,
 *   difficultyTier, hours, extraBuffs, selfHrid)
 * @param {Array<Object|null>} drinks - Drink DTO for the base player's drink slots
 * @returns {Promise<{xpPerHour: number, profitPerHour: number}>}
 */
async function evaluateCoffee(ctx, drinks) {
    const { semaphore, gameData, playerDTOs, baseIndex, zoneHrid, difficultyTier, hours, extraBuffs, selfHrid } = ctx;
    const modifiedDTOs = playerDTOs.map((p, idx) => (idx === baseIndex ? { ...p, drinks } : p));

    const message = {
        type: 'start_simulation',
        taskId: ++simTaskIdCounter,
        gameData,
        playerDTOs: modifiedDTOs,
        zoneHrid,
        difficultyTier,
        simulationTimeLimit: hours * ONE_HOUR_NS,
        extraBuffs,
    };

    const release = await semaphore.acquire();
    let simResult;
    try {
        simResult = await runWorkerChunk(message);
    } finally {
        release();
    }

    const simHours = (simResult.simulatedTime || 0) / ONE_HOUR_NS || hours;
    const xpMap = simResult.experienceGained?.[selfHrid] || {};
    const xpPerHour = Object.values(xpMap).reduce((s, v) => s + v, 0) / simHours;

    let profitPerHour = 0;
    try {
        const revenue = calculateSimRevenue(simResult, gameData, selfHrid, simHours);
        profitPerHour = revenue.netPerHour;
    } catch {
        // Revenue may not be available for this zone
    }

    return { xpPerHour, profitPerHour };
}

/**
 * "Eff. XP/hr": XP/hr discounted by the time it'd take to recover a profit deficit at the
 * 10th-best skilling money-maker rate (same opportunity-cost anchor the Tea Optimizer uses). A
 * combo that's merely less profitable than another isn't penalized unless it actually loses
 * money relative to that anchor, and even then only in proportion to how much skilling time
 * recovering the loss would actually take. Mutates each result to add `mixedScore`.
 * @param {Array<Object>} results
 * @returns {Array<Object>} same array, mutated
 */
export function scoreCoffeeMixed(results) {
    const profitAnchor = getGlobalBestProfitPerHour();
    for (const r of results) {
        if (r.profitPerHour >= 0 || profitAnchor <= 0) {
            r.mixedScore = r.xpPerHour;
        } else {
            const recoveryRatio = Math.abs(r.profitPerHour) / profitAnchor;
            r.mixedScore = r.xpPerHour / (1 + recoveryRatio);
        }
    }
    return results;
}

/**
 * Search combat drink combos for the given combat context, headless (no DOM).
 * @param {Object} params
 * @param {Object} params.gameData
 * @param {Array<Object>} params.playerDTOs
 * @param {number} params.baseIndex - Index of the player whose drink loadout is being searched
 * @param {string} params.zoneHrid
 * @param {number} params.difficultyTier
 * @param {number} params.hours - Test hours per combo
 * @param {Array<Object>} params.extraBuffs
 * @param {string} params.selfHrid
 * @param {Function} [params.isAborted] - () => boolean
 * @param {Function} [params.onProgress] - ({completed, total}) => void
 * @returns {Promise<Array<Object>>} results, each with combo/label/xpPerHour/profitPerHour/mixedScore
 */
export async function runCoffeeOptimization(params) {
    const {
        gameData,
        playerDTOs,
        baseIndex,
        zoneHrid,
        difficultyTier,
        hours,
        extraBuffs,
        selfHrid,
        isAborted = () => false,
        onProgress = () => {},
    } = params;

    const clientData = dataManager.getInitClientData();
    const attackStyle = getAttackStyle(playerDTOs[baseIndex], clientData?.itemDetailMap || {});
    const groups = getCandidateDrinkGroups(attackStyle);
    const combos = generateCombos(groups, MAX_DRINK_SLOTS);

    const semaphore = createSemaphore(Math.max(1, getMaxBatchWorkers()));
    const ctx = { semaphore, gameData, playerDTOs, baseIndex, zoneHrid, difficultyTier, hours, extraBuffs, selfHrid };

    const results = [];
    let completed = 0;

    const runCombo = async (combo) => {
        const drinks = [];
        for (let s = 0; s < MAX_DRINK_SLOTS; s++) {
            drinks.push(combo[s] ? { hrid: combo[s].hrid, triggers: [] } : null);
        }

        let metrics;
        try {
            metrics = await evaluateCoffee(ctx, drinks);
        } catch (err) {
            if (err.message === 'Cancelled') return;
            console.error('[OptimizeCoffeeCore] Simulation failed for combo', combo, err);
            return;
        }

        completed++;
        onProgress({ completed, total: combos.length });

        results.push({ combo, label: combo.map((c) => c.name).join(' + ') || 'No coffee', ...metrics });
    };

    let nextIndex = 0;
    const workerCount = Math.max(1, Math.min(getMaxBatchWorkers(), combos.length));
    await Promise.all(
        Array.from({ length: workerCount }, async () => {
            while (nextIndex < combos.length && !isAborted()) {
                const combo = combos[nextIndex++];
                await runCombo(combo);
            }
        })
    );

    scoreCoffeeMixed(results);
    return results;
}

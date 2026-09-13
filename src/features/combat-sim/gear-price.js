/**
 * Gear Price
 *
 * Shared helpers for pricing a DTO's equipped gear, and for pricing the incremental
 * upgrade from one equipment loadout to another. Used by the Sim Editor's equipment
 * price display and by the brew-vs-combat progression planner.
 */

import { resolveItemPrice } from '../../utils/profit-helpers.js';

/**
 * Estimate the market buy cost of every item currently equipped in a DTO's equipment map.
 * @param {Object} equipment - dto.equipment: { [equipmentTypeHrid]: { hrid, enhancementLevel } }
 * @returns {{ total: number, hasMissingPrice: boolean, perSlot: Object<string, number> }}
 *   perSlot maps equipmentTypeHrid -> resolved price (0 if empty/unpriced)
 */
export function estimateEquipmentPrice(equipment) {
    const perSlot = {};
    let total = 0;
    let hasMissingPrice = false;

    for (const [slot, item] of Object.entries(equipment || {})) {
        if (!item?.hrid) continue;
        const { price, missing } = resolveItemPrice(item.hrid, {
            enhancementLevel: item.enhancementLevel || 0,
            side: 'buy',
            context: 'profit',
        });
        perSlot[slot] = price;
        total += price;
        if (missing) hasMissingPrice = true;
    }

    return { total, hasMissingPrice, perSlot };
}

/**
 * Calculate the incremental gold cost to go from one equipped loadout to another — i.e. the
 * cost of only the items you don't already have equipped. A slot that already holds the exact
 * same item at the same (or higher) enhancement level in `fromEquipment` costs nothing; a slot
 * that's being removed/left empty also costs nothing (no credit is given for selling gear —
 * that's a separate decision for the player).
 * @param {Object} fromEquipment - Equipment map already owned/equipped
 * @param {Object} toEquipment - Target equipment map
 * @returns {{ total: number, hasMissingPrice: boolean, perSlot: Object<string, number> }}
 */
export function calculateGearUpgradeCost(fromEquipment, toEquipment) {
    const perSlot = {};
    let total = 0;
    let hasMissingPrice = false;

    for (const [slot, toItem] of Object.entries(toEquipment || {})) {
        if (!toItem?.hrid) continue;
        const fromItem = fromEquipment?.[slot];
        const alreadyOwned =
            fromItem?.hrid === toItem.hrid && (fromItem?.enhancementLevel || 0) >= (toItem.enhancementLevel || 0);
        if (alreadyOwned) {
            perSlot[slot] = 0;
            continue;
        }

        const { price, missing } = resolveItemPrice(toItem.hrid, {
            enhancementLevel: toItem.enhancementLevel || 0,
            side: 'buy',
            context: 'profit',
        });
        perSlot[slot] = price;
        total += price;
        if (missing) hasMissingPrice = true;
    }

    return { total, hasMissingPrice, perSlot };
}

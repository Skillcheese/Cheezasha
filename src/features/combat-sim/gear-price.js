/**
 * Gear Price
 *
 * Shared helpers for pricing a DTO's equipped gear, and for pricing the incremental
 * upgrade from one equipment loadout to another. Used by the Sim Editor's equipment
 * price display and by the brew-vs-combat progression planner.
 */

import { resolveItemPrice } from '../../utils/profit-helpers.js';
import { MARKET_TAX } from '../../utils/profit-constants.js';

/**
 * Fraction of an item's buy price recovered when selling it off on the market — a simplifying
 * stand-in for "list it a bit under the going buy price to move it fast", on top of which the
 * usual market tax is still deducted.
 */
export const GEAR_SELL_RECOVERY_RATE = 0.9;

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
 * same item at the same (or higher) enhancement level in `fromEquipment` costs nothing.
 *
 * By default, a slot that's being removed/replaced/left empty costs nothing extra (no credit is
 * given for selling gear). Pass `options.sellOldGear: true` to instead credit `fromEquipment`
 * items that aren't carried forward into `toEquipment`, sold at `GEAR_SELL_RECOVERY_RATE` of
 * their own buy price minus market tax — modeling "sell the old set to help fund the new one".
 * That credit can make `total` negative when the sale nets more than the new gear costs.
 * @param {Object} fromEquipment - Equipment map already owned/equipped
 * @param {Object} toEquipment - Target equipment map
 * @param {Object} [options]
 * @param {boolean} [options.sellOldGear=false] - Credit unused `fromEquipment` items toward the cost
 * @returns {{ total: number, hasMissingPrice: boolean, perSlot: Object<string, number>, sellCredit: number }}
 */
export function calculateGearUpgradeCost(fromEquipment, toEquipment, options = {}) {
    const { sellOldGear = false } = options;
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

    let sellCredit = 0;
    if (sellOldGear) {
        for (const [slot, fromItem] of Object.entries(fromEquipment || {})) {
            if (!fromItem?.hrid) continue;
            const toItem = toEquipment?.[slot];
            const carriedForward =
                toItem?.hrid === fromItem.hrid && (toItem?.enhancementLevel || 0) >= (fromItem.enhancementLevel || 0);
            if (carriedForward) continue;

            const { price, missing } = resolveItemPrice(fromItem.hrid, {
                enhancementLevel: fromItem.enhancementLevel || 0,
                side: 'buy',
                context: 'profit',
            });
            const credit = price * GEAR_SELL_RECOVERY_RATE * (1 - MARKET_TAX);
            sellCredit += credit;
            perSlot[slot] = (perSlot[slot] || 0) - credit;
            if (missing) hasMissingPrice = true;
        }
        total -= sellCredit;
    }

    return { total, hasMissingPrice, perSlot, sellCredit };
}

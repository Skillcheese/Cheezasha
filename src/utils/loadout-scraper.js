/**
 * Loadout Scraper Utilities
 *
 * Shared DOM scraping helpers for reading equipment, abilities, and consumables
 * from the game's LoadoutsPanel_selectedLoadout element.
 *
 * Used by loadout-export-button.js and loadout-snapshot.js.
 */

import dataManager from '../core/data-manager.js';

/**
 * Extract item HRID from an SVG use href attribute
 * e.g. "items_sprite.9c39e2ec.svg#griffin_bulwark_refined" → "/items/griffin_bulwark_refined"
 * @param {string} href
 * @returns {string|null}
 */
export function itemHridFromUseHref(href) {
    if (!href || !href.includes('items_sprite')) return null;
    const fragment = href.split('#')[1];
    if (!fragment) return null;
    return `/items/${fragment}`;
}

/**
 * Extract ability HRID from an SVG use href attribute
 * e.g. "abilities_sprite.fdd1b4de.svg#invincible" → "/abilities/invincible"
 * @param {string} href
 * @returns {string|null}
 */
export function abilityHridFromUseHref(href) {
    if (!href || !href.includes('abilities_sprite')) return null;
    const fragment = href.split('#')[1];
    if (!fragment) return null;
    return `/abilities/${fragment}`;
}

/**
 * Build a map of itemHrid → highest enhancementLevel across all character items.
 * Covers both currently equipped items and inventory items.
 * @returns {Map<string, number>}
 */
export function buildEnhancementLevelMap() {
    const inventory = dataManager.getInventory();
    const map = new Map();
    if (!inventory) return map;

    for (const item of inventory) {
        if (!item.itemHrid || item.count === 0) continue;
        const existing = map.get(item.itemHrid) ?? 0;
        const level = item.enhancementLevel ?? 0;
        if (level > existing) {
            map.set(item.itemHrid, level);
        }
    }
    return map;
}

// Maps equipmentDetail.type → itemLocationHrid
export const EQUIPMENT_TYPE_TO_LOCATION = {
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
};

/**
 * Determine itemLocationHrid for an equipment item using initClientData
 * Maps equipmentDetail.type to the corresponding item_locations HRID.
 * @param {string} itemHrid
 * @returns {string|null}
 */
export function getItemLocationHrid(itemHrid) {
    const clientData = dataManager.getInitClientData();
    if (!clientData) return null;
    const detail = clientData.itemDetailMap?.[itemHrid];
    if (!detail) return null;
    const equipType = detail.equipmentDetail?.type;
    if (!equipType) return null;
    return EQUIPMENT_TYPE_TO_LOCATION[equipType] || null;
}

/**
 * Scrape equipment items from the selected loadout element
 * @param {Element} selectedLoadout
 * @returns {Array<{itemLocationHrid, itemHrid, enhancementLevel}>}
 */
export function scrapeEquipment(selectedLoadout) {
    const equipDiv = selectedLoadout.querySelector('[class*="LoadoutsPanel_equipment"]');
    if (!equipDiv) return [];

    const enhancementMap = buildEnhancementLevelMap();
    const equipment = [];
    const uses = equipDiv.querySelectorAll('use');

    for (const use of uses) {
        const href = use.getAttribute('href') || use.getAttribute('xlink:href') || '';
        const itemHrid = itemHridFromUseHref(href);
        if (!itemHrid) continue;

        const itemLocationHrid = getItemLocationHrid(itemHrid);
        if (!itemLocationHrid) continue;

        const enhancementLevel = enhancementMap.get(itemHrid) ?? 0;
        equipment.push({ itemLocationHrid, itemHrid, enhancementLevel });
    }
    return equipment;
}

/**
 * Scrape abilities from the selected loadout element
 * @param {Element} selectedLoadout
 * @param {Object} clientData - initClientData for isSpecialAbility lookup
 * @returns {Array<{abilityHrid, level}>} 5-slot array, slot 0 = special
 */
export function scrapeAbilities(selectedLoadout, clientData) {
    const abilitiesDiv = selectedLoadout.querySelector('[class*="LoadoutsPanel_abilities"]');

    // Build 5-slot array (slot 0 = special, 1-4 = normal)
    const slots = [
        { abilityHrid: '', level: 1 },
        { abilityHrid: '', level: 1 },
        { abilityHrid: '', level: 1 },
        { abilityHrid: '', level: 1 },
        { abilityHrid: '', level: 1 },
    ];

    if (!abilitiesDiv) return slots;

    // Each ability is a container with an SVG use + level text
    const abilityContainers = abilitiesDiv.querySelectorAll('[class*="Ability_ability"]');

    let normalIndex = 1;

    for (const container of abilityContainers) {
        const use = container.querySelector('use');
        if (!use) continue;

        const href = use.getAttribute('href') || use.getAttribute('xlink:href') || '';
        const abilityHrid = abilityHridFromUseHref(href);
        if (!abilityHrid) continue;

        // Parse level from ".Ability_level__" element: "Lv.59" → 59
        const levelEl = container.querySelector('[class*="Ability_level"]');
        let level = 1;
        if (levelEl) {
            const match = levelEl.textContent.trim().match(/\d+/);
            if (match) level = parseInt(match[0], 10);
        }

        if (clientData?.abilityDetailMap && !clientData.abilityDetailMap[abilityHrid]) {
            console.error(`[LoadoutScraper] Ability not found in abilityDetailMap: ${abilityHrid}`);
        }
        const isSpecial = clientData?.abilityDetailMap?.[abilityHrid]?.isSpecialAbility || false;

        if (isSpecial) {
            slots[0] = { abilityHrid, level };
        } else if (normalIndex < 5) {
            slots[normalIndex++] = { abilityHrid, level };
        }
    }

    return slots;
}

/**
 * Scrape the currently equipped abilities from a live ability-slot grid on the game page —
 * either the Combat Zones panel (CombatZones_abilitiesContainer, shown while picking a combat
 * zone) or the Abilities equip screen (AbilitiesPanel_abilityGrid). Both use the same
 * AbilitySlot_abilitySlot markup. This reflects the character's actual current ability loadout
 * even when it was changed via a loadout swap, which does not trigger any WebSocket message our
 * data layer can observe.
 * @returns {Array<{abilityHrid: string, level: number}>|null} 5-slot array (slot 0 = special),
 *   or null if neither panel is currently open/rendered.
 */
export function scrapeCurrentAbilities() {
    const grid =
        document.querySelector('[class*="CombatZones_abilitiesContainer"]') ||
        document.querySelector('[class*="AbilitiesPanel_abilityGrid"]');
    if (!grid) return null;

    const slots = grid.querySelectorAll('[class*="AbilitySlot_abilitySlot"]');
    if (slots.length === 0) return null;

    const result = [
        { abilityHrid: '', level: 1 },
        { abilityHrid: '', level: 1 },
        { abilityHrid: '', level: 1 },
        { abilityHrid: '', level: 1 },
        { abilityHrid: '', level: 1 },
    ];

    slots.forEach((slot, i) => {
        if (i >= 5) return;
        const use = slot.querySelector('use');
        if (!use) return; // empty or locked slot

        const href = use.getAttribute('href') || use.getAttribute('xlink:href') || '';
        const abilityHrid = abilityHridFromUseHref(href);
        if (!abilityHrid) return;

        const levelEl = slot.querySelector('[class*="Ability_level"]');
        let level = 1;
        if (levelEl) {
            const match = levelEl.textContent.trim().match(/\d+/);
            if (match) level = parseInt(match[0], 10);
        }

        result[i] = { abilityHrid, level };
    });

    return result;
}

/**
 * Scrape the currently equipped combat food/drink slots from the live Combat Zones panel
 * (CombatZones_consumablesContainer, shown while picking a combat zone). Like abilities,
 * consumable slot changes don't reliably keep dataManager's cached character data fresh, so
 * this reads directly from the DOM. The panel renders two ActionTypeConsumableSlots_consumableSlots
 * groups in order: food (3 slots), then drinks (3 slots).
 * @returns {{ food: Array<{itemHrid: string}>, drinks: Array<{itemHrid: string}> }|null}
 *   3-slot arrays for food and drinks, or null if the panel isn't currently open/rendered.
 */
export function scrapeCurrentConsumables() {
    const container = document.querySelector('[class*="CombatZones_consumablesContainer"]');
    if (!container) return null;

    const slotGroups = container.querySelectorAll('[class*="ActionTypeConsumableSlots_consumableSlots"]');
    if (slotGroups.length < 2) return null;

    const scrapeGroup = (group) => {
        const slots = group.querySelectorAll('[class*="ConsumableSlot_consumableSlotContainer"]');
        const result = [];
        slots.forEach((slot) => {
            const use = slot.querySelector('use');
            const href = use?.getAttribute('href') || use?.getAttribute('xlink:href') || '';
            result.push({ itemHrid: itemHridFromUseHref(href) || '' });
        });
        while (result.length < 3) result.push({ itemHrid: '' });
        return result.slice(0, 3);
    };

    return {
        food: scrapeGroup(slotGroups[0]),
        drinks: scrapeGroup(slotGroups[1]),
    };
}

/**
 * Overlay a player DTO's abilities/food/drinks with whatever the live Combat Zones (or
 * Abilities equip screen) panel currently shows in the DOM, in place. dataManager's cached
 * character data is never patched when abilities/consumables are re-equipped or swapped via a
 * loadout — the game sends no WebSocket message for it — so callers that need the character's
 * true current loadout (e.g. "Reset to Current", food/coffee optimizers) should call this right
 * before use. No-ops silently if neither panel is currently open/rendered.
 * @param {Object} playerDTO - Player DTO in sim engine format (mutated in place)
 */
export function applyLiveSelfOverrides(playerDTO) {
    if (!playerDTO) return;

    const liveAbilities = scrapeCurrentAbilities();
    if (liveAbilities) {
        playerDTO.abilities = liveAbilities.map((live, i) => {
            if (!live.abilityHrid) return null;
            const prev = playerDTO.abilities[i];
            return {
                hrid: live.abilityHrid,
                level: live.level,
                triggers: prev?.hrid === live.abilityHrid ? prev.triggers : null,
            };
        });
    }

    const liveConsumables = scrapeCurrentConsumables();
    if (liveConsumables) {
        const mergeSlots = (liveSlots, prevSlots) =>
            liveSlots.map((live, i) => {
                if (!live.itemHrid) return null;
                const prev = prevSlots[i];
                return {
                    hrid: live.itemHrid,
                    triggers: prev?.hrid === live.itemHrid ? prev.triggers : null,
                };
            });
        playerDTO.food = mergeSlots(liveConsumables.food, playerDTO.food);
        playerDTO.drinks = mergeSlots(liveConsumables.drinks, playerDTO.drinks);
    }
}

/**
 * Scrape consumables (food/drinks) from the selected loadout element
 * @param {Element} selectedLoadout
 * @param {Object} clientData - initClientData for item type lookup
 * @returns {{ food: Array, drinks: Array }}
 */
export function scrapeConsumables(selectedLoadout, clientData) {
    const consumablesDiv = selectedLoadout.querySelector('[class*="LoadoutsPanel_consumables"]');

    const food = [{ itemHrid: '' }, { itemHrid: '' }, { itemHrid: '' }];
    const drinks = [{ itemHrid: '' }, { itemHrid: '' }, { itemHrid: '' }];

    if (!consumablesDiv) return { food, drinks };

    const uses = consumablesDiv.querySelectorAll('use');
    let foodIndex = 0;
    let drinkIndex = 0;

    for (const use of uses) {
        const href = use.getAttribute('href') || use.getAttribute('xlink:href') || '';
        const itemHrid = itemHridFromUseHref(href);
        if (!itemHrid) continue;

        const isDrink =
            itemHrid.includes('/drinks/') ||
            itemHrid.includes('coffee') ||
            clientData?.itemDetailMap?.[itemHrid]?.type === 'drink';

        if (isDrink && drinkIndex < 3) {
            drinks[drinkIndex++] = { itemHrid };
        } else if (!isDrink && foodIndex < 3) {
            food[foodIndex++] = { itemHrid };
        }
    }

    return { food, drinks };
}

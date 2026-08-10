/**
 * Loadout Enhancement Display
 * Shows highest-owned enhancement level on equipment icons in the loadout panel
 *
 * Scrapes characterItems for the highest enhancementLevel per itemHrid,
 * then injects a "+N" overlay (upper-right) on each loadout equipment icon.
 */

import config from '../../core/config.js';
import dataManager from '../../core/data-manager.js';
import domObserver from '../../core/dom-observer.js';

const OVERLAY_CLASS = 'script_loadoutEnhLevel';

/**
 * Build a map of itemHrid → highest enhancementLevel across all character items.
 * @returns {Map<string, number>}
 */
function buildEnhancementLevelMap() {
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

/**
 * Inject enhancement level overlays on all equipment icons in the loadout panel.
 */
function annotateLoadout() {
    if (!config.getSetting('loadoutEnhancementDisplay')) return;

    const selectedLoadout = document.querySelector('[class*="LoadoutsPanel_selectedLoadout"]');
    if (!selectedLoadout) return;

    const equipDiv = selectedLoadout.querySelector('[class*="LoadoutsPanel_equipment"]');
    if (!equipDiv) return;

    // Guard: inventory not ready — don't disturb existing overlays
    if (!dataManager.getInventory()) return;

    // Guard: use elements exist but none have item hrefs yet — React is mid-render
    const allUses = equipDiv.querySelectorAll('use');
    const validUses = Array.from(allUses).filter((use) => {
        const href = use.getAttribute('href') || use.getAttribute('xlink:href') || '';
        return href.includes('items_sprite');
    });
    if (allUses.length > 0 && validUses.length === 0) return;

    const enhancementMap = buildEnhancementLevelMap();

    for (const use of validUses) {
        const href = use.getAttribute('href') || use.getAttribute('xlink:href') || '';
        const fragment = href.split('#')[1];
        if (!fragment) continue;
        const itemHrid = `/items/${fragment}`;

        // DOM: use → svg → Item_iconContainer → Item_item__
        const svg = use.closest('svg');
        if (!svg) continue;
        const itemDiv = svg.parentElement?.parentElement;
        if (!itemDiv) continue;

        const enhLevel = enhancementMap.get(itemHrid) ?? 0;
        const desiredText = enhLevel > 0 ? `+${enhLevel}` : null;
        const existingOverlay = itemDiv.querySelector(`.${OVERLAY_CLASS}`);

        // Skip entirely when nothing needs to change — unconditionally clearing and
        // re-adding here would itself be a DOM mutation, which the shared MutationObserver
        // would pick up and use to re-trigger this very handler, creating a self-sustaining
        // loop that never settles (see zone-indices.js for the same bug and its fix).
        if (existingOverlay && existingOverlay.textContent === desiredText) continue;
        if (!existingOverlay && desiredText === null) continue;

        if (existingOverlay) existingOverlay.remove();

        if (desiredText) {
            itemDiv.style.position = 'relative';
            const overlay = document.createElement('div');
            overlay.className = OVERLAY_CLASS;
            overlay.textContent = desiredText;
            overlay.style.cssText = `
                z-index: 1;
                position: absolute;
                top: 2px;
                right: 2px;
                text-align: right;
                color: ${config.COLOR_ACCENT};
                font-size: 10px;
                font-weight: bold;
                text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 3px #000;
                pointer-events: none;
            `;
            itemDiv.appendChild(overlay);
        }
    }
}

/**
 * Remove all loadout enhancement overlays from the page.
 */
function removeOverlays() {
    for (const el of document.querySelectorAll(`.${OVERLAY_CLASS}`)) {
        el.remove();
    }
}

let unregisterHandler = null;

function initialize() {
    if (!config.getSetting('loadoutEnhancementDisplay')) return;

    // Scoped to loadout/item-container class names — the previous unfiltered
    // domObserver.register() ran this handler's DOM scan on every mutation anywhere on the
    // page (scroll-list recycling, unrelated tab switches, etc.), not just when the loadout
    // panel's equipment icons actually appeared.
    unregisterHandler = domObserver.onClass(
        'LoadoutEnhancementDisplay',
        ['LoadoutsPanel_equipment', 'Item_itemContainer'],
        () => {
            annotateLoadout();
        },
        { debounce: true, debounceDelay: 200 }
    );

    // Run immediately for any already-open loadout
    annotateLoadout();

    config.onSettingChange('loadoutEnhancementDisplay', (enabled) => {
        if (enabled) {
            annotateLoadout();
        } else {
            removeOverlays();
        }
    });
}

function cleanup() {
    if (unregisterHandler) {
        unregisterHandler();
        unregisterHandler = null;
    }
    removeOverlays();
}

export default {
    name: 'Loadout Enhancement Display',
    initialize,
    cleanup,
};

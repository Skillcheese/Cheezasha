/**
 * Quick Sell Listing
 * Ctrl+Shift+LeftClick an inventory item to open its marketplace page, open a new sell listing,
 * and click Min price and Max quantity. The listing is left open for the user to post.
 */

import config from '../../core/config.js';
import dataManager from '../../core/data-manager.js';
import marketplaceShortcuts from './marketplace-shortcuts.js';
import { navigateToMarketplace } from '../../utils/marketplace-tabs.js';
import { createTimerRegistry } from '../../utils/timer-registry.js';

const SETTING_KEY = 'market_quickSellListing';
const NAVIGATION_DELAY_MS = 300;
const MODAL_POLL_MS = 50;
const MODAL_TIMEOUT_MS = 3000;
// Lets auto-fill-price and auto-click-max finish first, so they can't overwrite Min/Max
const MODAL_SETTLE_MS = 300;
const INPUT_UPDATE_MS = 80;

const timerRegistry = createTimerRegistry();

let clickHandler = null;
let isRunning = false;
let isActive = false;

/**
 * Wait for a given duration.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function wait(ms) {
    return new Promise((resolve) => {
        timerRegistry.registerTimeout(setTimeout(resolve, ms));
    });
}

/**
 * Wait for the Sell Listing modal to appear.
 * @returns {Promise<HTMLElement|null>}
 */
async function waitForSellListingModal() {
    for (let elapsed = 0; elapsed < MODAL_TIMEOUT_MS; elapsed += MODAL_POLL_MS) {
        const modals = document.querySelectorAll('[class*="Modal_modalContainer"]');
        for (const modal of modals) {
            const header = modal.querySelector('div[class*="MarketplacePanel_header"]');
            if (header?.textContent.includes('Sell Listing')) return modal;
        }
        await wait(MODAL_POLL_MS);
    }
    return null;
}

/**
 * Check that a modal is showing the expected item.
 * @param {HTMLElement} modal
 * @param {string} itemHrid
 * @returns {boolean}
 */
function modalShowsItem(modal, itemHrid) {
    const slug = itemHrid.replace('/items/', '');
    return Array.from(modal.querySelectorAll('svg use')).some((use) => {
        const href = use.getAttribute('href') || use.getAttribute('xlink:href') || '';
        return href.endsWith(`#${slug}`);
    });
}

/**
 * Find a button by exact text within a container.
 * @param {HTMLElement|null} container
 * @param {string} text
 * @returns {HTMLButtonElement|null}
 */
function findButton(container, text) {
    if (!container) return null;
    return Array.from(container.querySelectorAll('button')).find((btn) => btn.textContent.trim() === text) || null;
}

/**
 * Open the sell listing and set Min price and Max quantity, leaving it open for the user to post.
 * @param {string} itemHrid
 * @param {number} enhancementLevel
 * @returns {Promise<void>}
 */
async function listItem(itemHrid, enhancementLevel) {
    if (isRunning) return;
    isRunning = true;

    try {
        navigateToMarketplace(itemHrid, enhancementLevel);
        await wait(NAVIGATION_DELAY_MS);
        await marketplaceShortcuts.clickListingButton('+ New Sell Listing', 'Button_sell');

        const modal = await waitForSellListingModal();
        if (!modal) throw new Error('Sell listing modal did not open');
        await wait(MODAL_SETTLE_MS);

        if (!modalShowsItem(modal, itemHrid)) throw new Error(`Modal is not showing ${itemHrid}`);

        const minButton = findButton(modal.querySelector('div[class*="MarketplacePanel_priceInputs"]'), 'Min');
        const maxButton = findButton(modal.querySelector('div[class*="MarketplacePanel_quantityInputs"]'), 'Max');
        if (!minButton || minButton.disabled) throw new Error('Min button unavailable');
        if (!maxButton || maxButton.disabled) throw new Error('Max button unavailable');

        minButton.click();
        await wait(INPUT_UPDATE_MS);
        maxButton.click();
    } catch (error) {
        console.error('[QuickSellListing] Could not prepare listing:', error);
    } finally {
        isRunning = false;
    }
}

/**
 * Handle Ctrl+Shift+LeftClick on an inventory item.
 * @param {MouseEvent} event
 */
function handleClick(event) {
    if (event.button !== 0 || !event.ctrlKey || !event.shiftKey) return;
    if (!event.target.closest('[class*="Inventory_items"], [class*="Inventory_inventory"]')) return;

    const tile = event.target.closest('[class*="Item_itemContainer"]');
    const href = tile?.querySelector('use[href*="items_sprite"]')?.getAttribute('href');
    const slug = href?.match(/#(.+)$/)?.[1];
    if (!slug) return;

    const itemHrid = `/items/${slug}`;
    const itemDetails = dataManager.getInitClientData()?.itemDetailMap?.[itemHrid];
    if (!itemDetails?.isTradable) return;

    // Stop the game's own click handling from opening the item menu
    event.preventDefault();
    event.stopPropagation();

    const enhancementText = tile.querySelector('[class*="Item_enhancementLevel"]')?.textContent || '';
    const enhancementLevel = parseInt(enhancementText.match(/\+(\d+)/)?.[1] || '0', 10);

    listItem(itemHrid, enhancementLevel);
}

function initialize() {
    if (isActive) return;
    if (!config.getSetting(SETTING_KEY)) return;

    clickHandler = handleClick;
    document.addEventListener('click', clickHandler, true);
    isActive = true;
}

function cleanup() {
    if (clickHandler) {
        document.removeEventListener('click', clickHandler, true);
        clickHandler = null;
    }
    timerRegistry.clearAll();
    isRunning = false;
    isActive = false;
}

config.onSettingChange(SETTING_KEY, (value) => {
    if (value) initialize();
    else cleanup();
});

export default {
    name: 'Quick Sell Listing',
    initialize,
    cleanup,
};

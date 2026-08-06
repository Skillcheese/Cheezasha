/**
 * Flip Chart Link
 * Adds a small chart-icon link next to each item icon in the "My Market Listings" table, and next
 * to "View All Items" / "Refresh" in the currently-viewed item's nav button row — both jumping
 * straight to that item's price chart in the Flipping tool's Charts tab.
 */

import config from '../../../core/config.js';
import dataManager from '../../../core/data-manager.js';
import flipUI from './flip-ui.js';
import { createTimerRegistry } from '../../../utils/timer-registry.js';

const LINK_CLASS = 'mwi-flip-chart-link';
const NAV_BUTTON_ID = 'mwi-flip-chart-nav-button';
const POLL_INTERVAL_MS = 1000;

/**
 * Extract an item's HRID and enhancement level from a My Listings table row.
 * @param {HTMLElement} row
 * @returns {{itemHrid: string, enhancementLevel: number}|null}
 */
function extractItemInfo(row) {
    const useEl = row.querySelector('svg use[href], svg use[xlink\\:href]');
    if (!useEl) return null;

    const href = useEl.getAttribute('href') || useEl.getAttribute('xlink:href');
    if (!href) return null;

    const idMatch = href.match(/#(.+)$/);
    if (!idMatch) return null;

    const itemSlug = idMatch[1];
    if (itemSlug.toLowerCase().includes('coin')) return null;

    const itemHrid = `/items/${itemSlug}`;

    let enhancementLevel = 0;
    const enhNode = row.querySelector('[class*="enhancementLevel"]');
    if (enhNode?.textContent) {
        const match = enhNode.textContent.match(/\+\s*(\d+)/);
        if (match) enhancementLevel = Number(match[1]);
    }

    return { itemHrid, enhancementLevel };
}

class FlipChartLink {
    constructor() {
        this.isInitialized = false;
        this.timerRegistry = createTimerRegistry();
        this.unregisterHandlers = [];
        this.currentItemHrid = null;
    }

    initialize() {
        if (this.isInitialized) return;
        if (!config.getSetting('market_flippingTool')) return;

        this.isInitialized = true;

        const interval = setInterval(() => this._injectAll(), POLL_INTERVAL_MS);
        this.timerRegistry.registerInterval(interval);
        this._injectAll();

        const navHandler = (data) => {
            if (!data.marketItemOrderBooks) return;
            this.currentItemHrid = data.marketItemOrderBooks.itemHrid;
            this._updateNavButton();
        };
        dataManager.on('market_item_order_books_updated', navHandler);
        this.unregisterHandlers.push(() => dataManager.off('market_item_order_books_updated', navHandler));
    }

    /**
     * Get the currently-viewed item's enhancement level from the DOM.
     * @returns {number}
     */
    _getCurrentEnhancementLevel() {
        const currentItem = document.querySelector('[class*="MarketplacePanel_currentItem"]');
        if (!currentItem) return 0;
        const el = currentItem.querySelector('[class*="Item_enhancementLevel"]');
        if (!el) return 0;
        const match = el.textContent.match(/\+(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
    }

    /**
     * Inject/refresh a "View Chart" button next to "View All Items" / "Refresh" for the
     * currently-viewed marketplace item.
     */
    _updateNavButton() {
        const existing = document.getElementById(NAV_BUTTON_ID);
        if (existing) existing.remove();

        if (!this.currentItemHrid) return;

        const itemDetails = dataManager.getItemDetails(this.currentItemHrid);
        if (!itemDetails?.isTradable) return;

        const container = document.querySelector('[class*="MarketplacePanel_marketNavButtonContainer"]');
        if (!container) return;

        const itemHrid = this.currentItemHrid;
        const enhancementLevel = this._getCurrentEnhancementLevel();
        const itemName = itemDetails.name || itemHrid;

        const refreshBtn = Array.from(container.querySelectorAll('button')).find(
            (btn) => btn.textContent.trim() === 'Refresh'
        );

        const btn = document.createElement('button');
        btn.id = NAV_BUTTON_ID;
        btn.textContent = '📈 View Chart';
        btn.className = refreshBtn ? refreshBtn.className : 'Button_button__1Fe9z';
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            flipUI.openChartForItem(itemHrid, enhancementLevel, itemName);
        });

        if (refreshBtn) {
            refreshBtn.insertAdjacentElement('afterend', btn);
        } else {
            container.appendChild(btn);
        }
    }

    _injectAll() {
        const tables = document.querySelectorAll('[class*="MarketplacePanel_myListingsTable"]');
        for (const table of tables) {
            const rows = table.querySelectorAll('tbody tr');
            for (const row of rows) {
                if (row.querySelector(`.${LINK_CLASS}`)) continue;

                const itemContainer = row.querySelector('[class*="Item_itemContainer"]');
                if (!itemContainer) continue;

                const itemInfo = extractItemInfo(row);
                if (!itemInfo) continue;

                const itemDetails = dataManager.getItemDetails(itemInfo.itemHrid);
                const itemName = itemDetails?.name || itemInfo.itemHrid;

                const link = document.createElement('a');
                link.className = LINK_CLASS;
                link.href = '#';
                link.textContent = '📈';
                link.title = 'View price chart';
                link.style.cssText = 'text-decoration:none; cursor:pointer; margin-left:4px; font-size:0.9em;';
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    flipUI.openChartForItem(itemInfo.itemHrid, itemInfo.enhancementLevel, itemName);
                });

                itemContainer.insertAdjacentElement('afterend', link);
            }
        }
    }

    disable() {
        this.timerRegistry.clearAll();
        this.unregisterHandlers.forEach((unregister) => unregister());
        this.unregisterHandlers = [];
        document.querySelectorAll(`.${LINK_CLASS}`).forEach((el) => el.remove());
        document.getElementById(NAV_BUTTON_ID)?.remove();
        this.currentItemHrid = null;
        this.isInitialized = false;
    }
}

const flipChartLink = new FlipChartLink();
export default flipChartLink;

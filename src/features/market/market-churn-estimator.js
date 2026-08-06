/**
 * Market Churn Estimator
 * Estimates how quickly an item's order book actually turns over, using the estimated creation
 * timestamps already collected passively by estimated-listing-age.js whenever you view an item.
 * Purely a display feature: it makes no extra requests and triggers no extra navigation, it just
 * reads the order book data that's already cached from your own browsing.
 *
 * Prices are locked to discrete tick intervals, so "does the top price move" is not a usable
 * liquidity signal (an item can have huge volume and never change its price bucket). Instead this
 * looks at the estimated age of the listings actually sitting at the current best ask price and
 * best bid price (the queue you'd actually be competing in) for the enhancement level you're
 * viewing: a young average age means that queue is getting filled/replaced quickly (fast churn,
 * worth fighting for the front); an old average age means those same listings have been sitting
 * there a long time (slow churn, likely not worth it).
 */

import config from '../../core/config.js';
import dataManager from '../../core/data-manager.js';
import estimatedListingAge from './estimated-listing-age.js';
import { formatRelativeTime } from '../../utils/formatters.js';

const BADGE_ID = 'mwi-market-churn-estimate';

class MarketChurnEstimator {
    constructor() {
        this.isInitialized = false;
        this.unregisterHandler = null;
        this.currentItemHrid = null;
    }

    initialize() {
        if (this.isInitialized) return;
        if (!config.getSetting('market_showChurnEstimate')) return;

        this.isInitialized = true;

        const handler = (data) => {
            if (!data.marketItemOrderBooks) return;
            this.currentItemHrid = data.marketItemOrderBooks.itemHrid;
            // Defer so estimated-listing-age's own handler (which fills in createdTimestamp on
            // each listing) has finished running first, regardless of listener registration order.
            setTimeout(() => this._updateBadge(), 0);
        };

        dataManager.on('market_item_order_books_updated', handler);
        this.unregisterHandler = () => dataManager.off('market_item_order_books_updated', handler);
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
     * Compute a churn estimate from a cached order book, restricted to the listings actually
     * sitting at the best ask price and best bid price (the queue you'd actually be competing
     * in), not the whole book — a listing at a far-off price tells you nothing about how fast
     * the front of the queue is moving.
     * @param {Object} orderBooks - Order book data indexed by enhancement level
     * @param {number} enhancementLevel
     * @returns {{listingCount: number, totalQuantity: number, avgAgeMs: number|null}|null}
     */
    _computeChurn(orderBooks, enhancementLevel) {
        if (!orderBooks) return null;
        const orderBook = Array.isArray(orderBooks) ? orderBooks[enhancementLevel] : orderBooks[enhancementLevel];
        if (!orderBook) return null;

        // asks are sorted ascending (best/lowest first), bids sorted descending (best/highest first)
        const bestAskPrice = orderBook.asks?.[0]?.price;
        const bestBidPrice = orderBook.bids?.[0]?.price;

        const bestAsks = bestAskPrice != null ? orderBook.asks.filter((l) => l.price === bestAskPrice) : [];
        const bestBids = bestBidPrice != null ? orderBook.bids.filter((l) => l.price === bestBidPrice) : [];

        const listings = [...bestAsks, ...bestBids];
        if (listings.length === 0) return { listingCount: 0, totalQuantity: 0, avgAgeMs: null };

        const now = Date.now();
        let ageSum = 0;
        let ageCount = 0;
        let totalQuantity = 0;

        for (const listing of listings) {
            totalQuantity += Math.max(0, (listing.orderQuantity || 0) - (listing.filledQuantity || 0));
            if (listing.createdTimestamp) {
                ageSum += now - new Date(listing.createdTimestamp).getTime();
                ageCount++;
            }
        }

        return {
            listingCount: listings.length,
            totalQuantity,
            avgAgeMs: ageCount > 0 ? ageSum / ageCount : null,
        };
    }

    _updateBadge() {
        const existing = document.getElementById(BADGE_ID);
        if (existing) existing.remove();

        if (!this.currentItemHrid) return;

        const cacheEntry = estimatedListingAge.orderBooksCache[this.currentItemHrid];
        const orderBooks = cacheEntry?.data?.orderBooks;
        if (!orderBooks) return;

        const enhancementLevel = this._getCurrentEnhancementLevel();
        const churn = this._computeChurn(orderBooks, enhancementLevel);
        if (!churn || churn.listingCount === 0) return;

        const container = document.querySelector('[class*="MarketplacePanel_marketNavButtonContainer"]');
        if (!container) return;

        let label;
        let color;
        if (churn.avgAgeMs === null) {
            label = `${churn.listingCount} at best price, age unknown`;
            color = '#888';
        } else {
            const ageText = formatRelativeTime(churn.avgAgeMs);
            label = `avg age ${ageText} (${churn.listingCount} at best price)`;
            if (churn.avgAgeMs < 12 * 60 * 60 * 1000) {
                color = '#4ade80'; // fast churn
            } else if (churn.avgAgeMs < 48 * 60 * 60 * 1000) {
                color = '#facc15'; // moderate
            } else {
                color = '#f87171'; // slow, likely a stale/hard-to-fill queue
            }
        }

        const badge = document.createElement('div');
        badge.id = BADGE_ID;
        badge.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-left: 12px;
            font-size: 0.85rem;
            padding: 6px 12px;
            background: rgba(0, 0, 0, 0.8);
            border-radius: 4px;
            white-space: nowrap;
        `;
        badge.title =
            'Estimated from the creation times of listings currently at the best ask/bid price. ' +
            'Younger average age = the front of the queue is being filled/replaced quickly. ' +
            'Not real volume data, just a rough proxy for queue movement.';

        const labelSpan = document.createElement('span');
        labelSpan.style.cssText = 'color:#aaa; font-weight:500;';
        labelSpan.textContent = 'Churn:';

        const valueSpan = document.createElement('span');
        valueSpan.style.cssText = `color:${color}; font-weight:600;`;
        valueSpan.textContent = label;

        badge.appendChild(labelSpan);
        badge.appendChild(valueSpan);
        container.appendChild(badge);
    }

    disable() {
        if (this.unregisterHandler) {
            this.unregisterHandler();
            this.unregisterHandler = null;
        }
        document.getElementById(BADGE_ID)?.remove();
        this.currentItemHrid = null;
        this.isInitialized = false;
    }
}

const marketChurnEstimator = new MarketChurnEstimator();
export default marketChurnEstimator;

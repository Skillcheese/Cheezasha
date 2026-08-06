/**
 * Flip Sampler
 * Periodically polls the global marketplace.json feed (covers every tradeable
 * item, not just ones the player has opened) and records ask/bid samples over
 * time, so the flip analyzer has price history to compute rolling averages
 * and detect under/over-priced listings. Deliberately does not track the player's own fills,
 * to keep the average an unbiased market signal rather than skewed by our own trading.
 */

import storage from '../../../core/storage.js';
import config from '../../../core/config.js';
import marketAPI from '../../../api/marketplace.js';
import { createTimerRegistry } from '../../../utils/timer-registry.js';

const HISTORY_KEY = 'flipPriceHistory';
const POLL_INTERVAL_MS = 2 * 60 * 1000; // How often we ask marketAPI to check for fresh data; actual snapshots only
// happen when marketAPI's own cache expires and a real fetch occurs, so this just shortens the delay between a
// server-side update landing and us picking it up (fetch() is a no-op while the cache is still valid).
const MAX_SAMPLES_PER_ITEM = 300; // ~3 days of samples at a 15-min effective sampling cadence
const RETENTION_MS = 14 * 24 * 60 * 60 * 1000; // Drop samples older than 14 days

class FlipSampler {
    constructor() {
        this.isInitialized = false;
        this.timerRegistry = createTimerRegistry();
        this.history = {}; // { "itemHrid:enh": [{ t, a, b }, ...] }
        this.lastSampledFetchTimestamp = null;
        this._marketListener = null;
    }

    async initialize() {
        if (this.isInitialized) return;
        if (!config.getSetting('market_flippingTool')) return;

        this.isInitialized = true;

        this.history = (await storage.getJSON(HISTORY_KEY, 'flippingHistory', null)) || {};

        this._marketListener = () => this._maybeSnapshot();
        marketAPI.on(this._marketListener);

        // Keep polling even if nothing else triggers a marketAPI fetch (e.g. player idle
        // outside the marketplace page); fetch() itself no-ops against the 15-min cache.
        const interval = setInterval(() => marketAPI.fetch(), POLL_INTERVAL_MS);
        this.timerRegistry.registerInterval(interval);

        if (marketAPI.isLoaded()) {
            this._maybeSnapshot();
        } else {
            marketAPI.fetch();
        }
    }

    /**
     * Take a full-catalog snapshot only when marketAPI has genuinely fetched new data,
     * to avoid re-sampling identical data on every order-book patch notification.
     */
    _maybeSnapshot() {
        if (marketAPI.lastFetchTimestamp === this.lastSampledFetchTimestamp) return;
        this.lastSampledFetchTimestamp = marketAPI.lastFetchTimestamp;
        this._snapshotAllItems();
    }

    _snapshotAllItems() {
        const marketData = marketAPI.marketData;
        if (!marketData) return;

        const now = Date.now();
        let changed = false;

        for (const [itemHrid, byEnh] of Object.entries(marketData)) {
            if (!byEnh || typeof byEnh !== 'object') continue;

            for (const [enh, price] of Object.entries(byEnh)) {
                const ask = typeof price?.a === 'number' && price.a >= 0 ? price.a : null;
                const bid = typeof price?.b === 'number' && price.b >= 0 ? price.b : null;
                if (ask === null && bid === null) continue;

                const key = `${itemHrid}:${enh}`;
                const series = this.history[key] || (this.history[key] = []);

                // Always record a sample per real fetch, even if the price is unchanged from
                // last time — the rolling average needs enough independent observations to be
                // trustworthy, and skipping unchanged prices meant stable-priced items could
                // never accumulate past 1 sample no matter how long the sampler ran.
                series.push({ t: now, a: ask, b: bid });
                changed = true;

                if (series.length > MAX_SAMPLES_PER_ITEM) {
                    series.splice(0, series.length - MAX_SAMPLES_PER_ITEM);
                }
            }
        }

        if (changed) {
            this._pruneOldSamples(now);
            this._persist();
        }
    }

    _pruneOldSamples(now) {
        const cutoff = now - RETENTION_MS;
        for (const key of Object.keys(this.history)) {
            const series = this.history[key];
            const firstFresh = series.findIndex((sample) => sample.t >= cutoff);
            if (firstFresh > 0) {
                series.splice(0, firstFresh);
            }
            if (series.length === 0) {
                delete this.history[key];
            }
        }
    }

    _persist() {
        storage.setJSON(HISTORY_KEY, this.history, 'flippingHistory', false);
    }

    /**
     * Get the stored price sample history for an item.
     * @param {string} itemHrid
     * @param {number} [enhancementLevel=0]
     * @returns {Array<{t: number, a: number|null, b: number|null}>}
     */
    getHistory(itemHrid, enhancementLevel = 0) {
        return this.history[`${itemHrid}:${enhancementLevel}`] || [];
    }

    /**
     * Get the full history map (all tracked item:enh keys).
     * @returns {Object}
     */
    getAllHistory() {
        return this.history;
    }

    disable() {
        if (this._marketListener) {
            marketAPI.off(this._marketListener);
            this._marketListener = null;
        }
        this.timerRegistry.clearAll();
        this.isInitialized = false;
    }
}

const flipSampler = new FlipSampler();
export default flipSampler;

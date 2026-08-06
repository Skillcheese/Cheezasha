/**
 * Flip Analyzer
 * Pure calculation module: turns sampled price history + live ask/bid into
 * flip opportunities with ROI (after marketplace tax), liquidity signal, and
 * under/over-priced alerts. No DOM access.
 */

import dataManager from '../../../core/data-manager.js';
import marketAPI from '../../../api/marketplace.js';
import flipSampler from './flip-sampler.js';
import { calculatePriceAfterTax } from '../../../utils/profit-helpers.js';
import { MARKET_TAX, COWBELL_BAG_HRID, COWBELL_BAG_TAX } from '../../../utils/profit-constants.js';

const DEFAULT_MIN_SAMPLES = 3;
const DEFAULT_DEVIATION_THRESHOLD = 0.1; // 10% below/above rolling average triggers an alert
const DEFAULT_MARGIN_THRESHOLD = 0.02; // 2% ROI after tax counts as a viable margin flip
const DEFAULT_MAX_SPREAD_RATIO = 3; // ask/bid ratios beyond this are almost always a thin-book
// troll listing (one insane ask or one lowball bid sitting alone), not a real opportunity

/**
 * Compute rolling average ask/bid and sample counts from a price history series.
 * @param {Array<{t: number, a: number|null, b: number|null}>} samples
 * @returns {{avgAsk: number|null, avgBid: number|null, askCount: number, bidCount: number}}
 */
function computeRollingStats(samples) {
    let askSum = 0;
    let askCount = 0;
    let bidSum = 0;
    let bidCount = 0;

    for (const sample of samples) {
        if (typeof sample.a === 'number') {
            askSum += sample.a;
            askCount++;
        }
        if (typeof sample.b === 'number') {
            bidSum += sample.b;
            bidCount++;
        }
    }

    return {
        avgAsk: askCount > 0 ? askSum / askCount : null,
        avgBid: bidCount > 0 ? bidSum / bidCount : null,
        askCount,
        bidCount,
    };
}

/**
 * Analyze a single item:enhancement pair for a flip opportunity.
 * @param {string} itemHrid
 * @param {number} enhancementLevel
 * @param {Object} [options]
 * @param {number} [options.deviationThreshold] - Fraction below/above average to flag as an alert
 * @param {number} [options.minSamples] - Minimum samples required before trusting the average
 * @returns {Object|null} Flip record, or null if there isn't enough data / no tradeable spread
 */
function analyzeItem(itemHrid, enhancementLevel = 0, options = {}) {
    const deviationThreshold = options.deviationThreshold ?? DEFAULT_DEVIATION_THRESHOLD;
    const minSamples = options.minSamples ?? DEFAULT_MIN_SAMPLES;

    const itemDetails = dataManager.getItemDetails(itemHrid);
    if (!itemDetails?.isTradable) return null;

    // Only the ask side needs to be live right now (that's what we'd actually pay to buy in).
    // The bid side is allowed to fall back to its rolling average — requiring a live bid too
    // would drop any item whose buy-side book happens to be momentarily empty, which is common
    // for thinly-traded items and would make most of the catalog silently disappear.
    const currentPrice = marketAPI.getPrice(itemHrid, enhancementLevel);
    if (!currentPrice || currentPrice.ask == null) return null;

    const samples = flipSampler.getHistory(itemHrid, enhancementLevel);
    const { avgAsk, avgBid, askCount, bidCount } = computeRollingStats(samples);

    if (avgBid === null || bidCount < minSamples) {
        return null;
    }

    const taxRate = itemHrid === COWBELL_BAG_HRID ? COWBELL_BAG_TAX : MARKET_TAX;

    // Standard flip: buy at current ask, sell at rolling-average bid (after tax)
    const buyPrice = currentPrice.ask;
    const sellPrice = avgBid;
    const proceedsAfterTax = calculatePriceAfterTax(sellPrice, taxRate);
    const profit = proceedsAfterTax - buyPrice;
    const roi = buyPrice > 0 ? profit / buyPrice : 0;

    const askDeviation = avgAsk != null && avgAsk > 0 ? (currentPrice.ask - avgAsk) / avgAsk : 0;
    const bidDeviation = avgBid > 0 && currentPrice.bid != null ? (currentPrice.bid - avgBid) / avgBid : null;

    const alerts = [];
    if (askCount >= minSamples && askDeviation <= -deviationThreshold) {
        alerts.push('underpriced_sell'); // Someone is offering to sell well below normal — cheap instant-buy
    }
    if (bidDeviation !== null && bidDeviation >= deviationThreshold) {
        alerts.push('overpriced_buy'); // Someone is offering to buy well above normal — lucrative instant-sell
    }

    return {
        itemHrid,
        enhancementLevel,
        itemName: itemDetails.name || itemHrid,
        buyPrice,
        sellPrice,
        avgAsk,
        avgBid,
        currentAsk: currentPrice.ask,
        currentBid: currentPrice.bid,
        taxRate,
        profit,
        roi,
        askDeviation,
        bidDeviation,
        alerts,
        sampleCount: bidCount,
    };
}

/**
 * Analyze every item with tracked price history and return flip opportunities.
 * @param {Object} [options]
 * @param {number} [options.deviationThreshold]
 * @param {number} [options.minSamples]
 * @param {number|null} [options.budget] - Only include flips whose buy price is within budget
 * @param {boolean} [options.alertsOnly] - Only include items with an active under/over-price alert
 * @returns {Array<Object>} Flip records sorted by ROI descending
 */
function analyzeAll(options = {}) {
    const history = flipSampler.getAllHistory();
    const results = [];
    const seen = new Set();

    for (const key of Object.keys(history)) {
        const separatorIndex = key.lastIndexOf(':');
        const itemHrid = key.slice(0, separatorIndex);
        const enhancementLevel = Number(key.slice(separatorIndex + 1)) || 0;

        if (seen.has(key)) continue;
        seen.add(key);

        const record = analyzeItem(itemHrid, enhancementLevel, options);
        if (!record) continue;

        if (options.budget != null && record.buyPrice > options.budget) continue;
        if (options.alertsOnly && record.alerts.length === 0) continue;

        results.push(record);
    }

    results.sort((a, b) => b.roi - a.roi);
    return results;
}

/**
 * Find items whose *current* live bid/ask spread alone is profitable after tax, regardless of
 * price history. This is the patient-flip strategy: place a buy order at the current bid and a
 * sell order at the current ask, rather than instant-buying at the ask and instant-selling into
 * the bid (which is a crossed-spread scenario and essentially never profitable). Unlike
 * analyzeAll/analyzeItem this needs no rolling average or minimum sample count, so it lights up
 * immediately from a single marketplace.json snapshot.
 * Also discards listings where the ask/bid ratio is implausibly wide (default >3x) — a single
 * troll ask or lowball bid sitting alone in a thin book, not a price anyone will realistically
 * trade at.
 * @param {Object} [options]
 * @param {number} [options.marginThreshold] - Minimum ROI (fraction) after tax to qualify
 * @param {number} [options.maxSpreadRatio] - Discard listings whose ask/bid ratio exceeds this
 * @param {number|null} [options.budget] - Only include flips whose buy price is within budget
 * @returns {Array<Object>} Flip records sorted by ROI descending
 */
function analyzeMarginFlips(options = {}) {
    const marginThreshold = options.marginThreshold ?? DEFAULT_MARGIN_THRESHOLD;
    const maxSpreadRatio = options.maxSpreadRatio ?? DEFAULT_MAX_SPREAD_RATIO;
    const marketData = marketAPI.marketData;
    if (!marketData) return [];

    const results = [];

    for (const [itemHrid, byEnh] of Object.entries(marketData)) {
        if (!byEnh || typeof byEnh !== 'object') continue;

        const itemDetails = dataManager.getItemDetails(itemHrid);
        if (!itemDetails?.isTradable) continue;

        for (const [enh, price] of Object.entries(byEnh)) {
            const ask = typeof price?.a === 'number' && price.a >= 0 ? price.a : null;
            const bid = typeof price?.b === 'number' && price.b >= 0 ? price.b : null;
            if (ask == null || bid == null || bid <= 0) continue;

            if (maxSpreadRatio != null && ask / bid > maxSpreadRatio) continue;

            const taxRate = itemHrid === COWBELL_BAG_HRID ? COWBELL_BAG_TAX : MARKET_TAX;
            const proceedsAfterTax = calculatePriceAfterTax(ask, taxRate);
            const profit = proceedsAfterTax - bid;
            const roi = profit / bid;
            if (roi < marginThreshold) continue;

            if (options.budget != null && bid > options.budget) continue;

            const enhancementLevel = Number(enh) || 0;
            results.push({
                itemHrid,
                enhancementLevel,
                itemName: itemDetails.name || itemHrid,
                buyPrice: bid,
                sellPrice: ask,
                profit,
                roi,
            });
        }
    }

    results.sort((a, b) => b.roi - a.roi);
    return results;
}

/**
 * Find items whose current ask or bid deviates significantly from its own rolling average —
 * a mispriced listing rather than a guaranteed-profitable spread. Thin wrapper around analyzeAll
 * that always restricts to alerted items.
 * @param {Object} [options]
 * @param {number} [options.deviationThreshold]
 * @param {number} [options.minSamples]
 * @param {number|null} [options.budget]
 * @returns {Array<Object>}
 */
function analyzeOutliers(options = {}) {
    return analyzeAll({ ...options, alertsOnly: true });
}

export default {
    analyzeItem,
    analyzeAll,
    analyzeMarginFlips,
    analyzeOutliers,
    computeRollingStats,
};

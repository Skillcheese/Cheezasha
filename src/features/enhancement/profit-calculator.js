/**
 * Enhancement Optimizer
 * Ranks all enhanceable items by expected profit/hr and gold-neutral effective XP/hr,
 * using live marketplace buy offers at every enhancement level.
 */

import config from '../../core/config.js';
import domObserver from '../../core/dom-observer.js';
import dataManager from '../../core/data-manager.js';
import marketAPI from '../../api/marketplace.js';
import { calculateEnhancement } from '../../utils/enhancement-calculator.js';
import { calculateSuccessXP, calculateFailureXP } from './enhancement-xp.js';
import { getEnhancingParams, getDetectedGearSettings } from '../../utils/enhancement-config.js';
import { getSettingDefinition } from '../../core/settings-schema.js';
import { calculatePriceAfterTax } from '../../utils/profit-helpers.js';
import { getGlobalBestProfitPerHour } from '../../utils/tea-optimizer.js';
import { formatKMB, formatWithSeparator, formatRelativeTime } from '../../utils/formatters.js';
import { createTimerRegistry } from '../../utils/timer-registry.js';
import { registerFloatingPanel, unregisterFloatingPanel, bringPanelToFront } from '../../utils/panel-z-index.js';
import { getCheapestProtectionPrice } from './tooltip-enhancement.js';

// Sortable table columns (th id suffix -> result field). 'age' is not sortable (global value).
const TABLE_COLUMNS = [
    'name',
    'pph',
    'totalprofit',
    'time',
    'protect',
    'roi',
    'basecost',
    'enhcost',
    'sellprice',
    'totalxp',
    'xph',
    'effxph',
];
const COL_KEY_MAP = {
    name: 'name',
    pph: 'profitPerHour',
    totalprofit: 'totalProfit',
    time: 'totalTime',
    protect: 'protectFrom',
    roi: 'roi',
    basecost: 'baseCost',
    enhcost: 'enhancingCost',
    sellprice: 'sellPrice',
    totalxp: 'totalXP',
    xph: 'xph',
    effxph: 'effXph',
};

// Item/level pruning: enhancement cost grows steeply as target level rises (success rate decays
// geometrically) while sell price grows far more slowly, so profit/hr and eff. XP/hr for a given
// item tend to get monotonically worse at higher levels once they're already deeply bad. Once a
// level comes back "hopeless" by both measures and worse than the previous level for
// PRUNE_CONSECUTIVE_LEVELS levels in a row, stop simulating higher levels for that item — they're
// essentially guaranteed to be worse too, and each level costs a full Markov simulation per
// protect-from candidate.
const PRUNE_PROFIT_MULTIPLE = 20; // profit/hr must be at least this many multiples worse than the anchor
const PRUNE_EFFXPH_FRACTION = 0.05; // ...and eff. XP/hr must be below this fraction of the best seen so far
const PRUNE_CONSECUTIVE_LEVELS = 2; // consecutive worsening "hopeless" levels before giving up on the item
// Market bid prices are independent per-level listings, not a smooth curve — a much higher +level
// can have a disproportionately high buy offer even if lower levels look bad (e.g. rarity demand).
// Before actually giving up on an item, cheaply peek at the raw (unsimulated) bid price for every
// remaining level; if any of them jumps well above what we've seen so far, keep simulating instead
// of trusting the cost/profit trend.
const PRUNE_SPIKE_MULTIPLE = 3; // a remaining level's raw bid must exceed the best bid seen so far by this factor to count as a spike

// Fixed column widths for the Configure tab rows, so the checkbox/label/input "tab stops" line up
// consistently across rows instead of stretching to fill the panel width when it's resized wide.
const CONFIG_CHECKBOX_COL_WIDTH = 18;
const CONFIG_LABEL_COL_WIDTH = 190;

const PANEL_ID = 'mwi-profit-calc-panel';
const BTN_CLASS = 'mwi-profit-calc-btn';
const AUTODETECT_ID = 'enhanceSim_autoDetect';

// Gear/stat settings shown on the Configure tab. These are the same account-wide
// `enhanceSim_*` settings used by the Enhancement Simulator/XPH Calculator elsewhere,
// so edits here apply everywhere and match the Settings page's "Enhancement Simulator" section.
const CONFIG_SCALAR_IDS = ['enhanceSim_enhancingLevel', 'enhanceSim_houseLevel', 'enhanceSim_achievement'];
const CONFIG_BUFF_IDS = [
    'enhanceSim_teaEnabled',
    'enhanceSim_tea',
    'enhanceSim_blessedTea',
    'enhanceSim_wisdomTea',
    'enhanceSim_communityBuff',
    'enhanceSim_communityBuffWisdom',
];
// Rendered together as one combined row (checkbox + tier dropdown) instead of two stacked rows.
const TEA_COMBO_IDS = ['enhanceSim_teaEnabled', 'enhanceSim_tea'];
const CONFIG_GEAR_IDS = [
    'enhanceSim_gear_enhancer',
    'enhanceSim_gear_gloves',
    'enhanceSim_gear_top',
    'enhanceSim_gear_bottoms',
    'enhanceSim_gear_neck',
    'enhanceSim_gear_ring',
    'enhanceSim_gear_earring',
    'enhanceSim_gear_cape',
    'enhanceSim_gear_guzzling',
    'enhanceSim_gear_charm',
];

/**
 * The Markov-chain matrix inversion in calculateEnhancement() depends only on itemLevel/targetLevel/
 * protectFrom and the (fixed, per-run) player stats — not on which specific item is being enhanced.
 * Hundreds of items in the game share the same itemLevel, so caching this result by
 * `itemLevel|targetLevel|protectFrom` for the duration of one _compute() run turns what would be a
 * fresh 20×20 matrix inversion per item into a single shared computation per distinct combination.
 * @param {Map} cache
 * @param {number} itemLevel
 * @param {number} targetLevel
 * @param {number} protectFrom
 * @param {Object} params - from getEnhancingParams()
 * @returns {Object|null} the calculateEnhancement() result, or null if it threw/was invalid
 */
function getCachedEnhancementCalc(cache, itemLevel, targetLevel, protectFrom, params) {
    const key = `${itemLevel}|${targetLevel}|${protectFrom}`;
    if (cache.has(key)) return cache.get(key);

    let calc;
    try {
        calc = calculateEnhancement({
            enhancingLevel: params.enhancingLevel,
            houseLevel: params.houseLevel,
            toolBonus: params.toolBonus,
            speedBonus: params.speedBonus,
            itemLevel,
            targetLevel,
            startLevel: 0,
            protectFrom,
            blessedTea: params.teas.blessed,
            guzzlingBonus: params.guzzlingBonus,
        });
    } catch {
        calc = null;
    }

    if (!calc?.visitCounts || calc.totalTime <= 0) calc = null;
    cache.set(key, calc);
    return calc;
}

/**
 * Run the enhancement simulation + cost/revenue math for one item/target-level/protectFrom
 * combination. Returns null if required price data is unavailable.
 * @param {string} itemHrid
 * @param {Object} itemDetails
 * @param {number} targetLevel
 * @param {number} protectFrom
 * @param {Object} params - from getEnhancingParams()
 * @param {number} anchorProfitPerHour - global recovery anchor (10th-best profit/hr across skills)
 * @param {{price: number}|null} protectionInfo - cheapest protection item price for this item (cached per item)
 * @param {Map} calcCache - shared cache of calculateEnhancement() results for this _compute() run
 * @returns {Object|null}
 */
function simulateItemAtProtectFrom(
    itemHrid,
    itemDetails,
    targetLevel,
    protectFrom,
    params,
    anchorProfitPerHour,
    protectionInfo,
    calcCache
) {
    const itemLevel = itemDetails.itemLevel || 0;

    const calc = getCachedEnhancementCalc(calcCache, itemLevel, targetLevel, protectFrom, params);
    if (!calc) return null;

    // Revenue: live buy offer (insta-sell) at the target level, after market tax
    const targetPrice = marketAPI.getPrice(itemHrid, targetLevel);
    if (!targetPrice?.bid || targetPrice.bid <= 0) return null;
    const revenue = calculatePriceAfterTax(targetPrice.bid);

    // Base item acquisition cost (unenhanced)
    const basePrice = marketAPI.getPrice(itemHrid, 0);
    if (!basePrice?.ask || basePrice.ask <= 0) return null;
    const baseCost = basePrice.ask;
    let enhancingCost = 0;
    let costPartial = false;

    // Material cost for all enhancement attempts
    if (itemDetails.enhancementCosts?.length) {
        for (const matCost of itemDetails.enhancementCosts) {
            if (matCost.itemHrid === '/items/coin') {
                enhancingCost += matCost.count * calc.attempts;
                continue;
            }
            const price = marketAPI.getPrice(matCost.itemHrid);
            if (price?.ask > 0) {
                enhancingCost += matCost.count * price.ask * calc.attempts;
            } else {
                costPartial = true;
            }
        }
    }

    // Protection cost
    if (protectFrom > 0 && calc.protectionCount > 0) {
        if (protectionInfo?.price > 0) {
            enhancingCost += protectionInfo.price * calc.protectionCount;
        } else {
            costPartial = true;
        }
    }

    const cost = baseCost + enhancingCost;

    // XP accumulation
    let totalXP = 0;
    for (let i = 0; i < targetLevel; i++) {
        const visits = calc.visitCounts[i];
        if (!visits) continue;
        const successRate = (calc.successRates[i]?.actualRate ?? 0) / 100;
        const successXP = calculateSuccessXP(i, itemHrid);
        const failXP = calculateFailureXP(i, itemHrid);
        totalXP += visits * (successRate * successXP + (1 - successRate) * failXP);
    }
    if (totalXP <= 0) return null;

    const profit = revenue - cost;
    const profitPerHour = (profit / calc.totalTime) * 3600;
    const xph = Math.round((totalXP / calc.totalTime) * 3600);

    let effTime = calc.totalTime;
    if (profit < 0 && anchorProfitPerHour > 0) {
        const recoveryTime = -profit / (anchorProfitPerHour / 3600);
        effTime += recoveryTime;
    }
    const effXph = Math.round((totalXP / effTime) * 3600);
    const roi = cost > 0 ? (profit / cost) * 100 : 0;

    return {
        itemHrid,
        name: `${itemDetails.name} +${targetLevel}`,
        level: targetLevel,
        protectFrom,
        profitPerHour,
        totalProfit: profit,
        totalTime: calc.totalTime,
        roi,
        baseCost,
        enhancingCost,
        sellPrice: revenue,
        totalXP,
        xph,
        effXph,
        costPartial,
    };
}

/**
 * Calculate profit/hr, XP/hr, and eff. XP/hr for enhancing a single item to a single target level,
 * automatically choosing the protect-from level (0 = never protect) that yields the lowest total
 * cost to reach that level. Ranking by profit/hr instead would let a strategy that takes longer
 * (and costs more overall) look better just because its losses are spread over more hours — this
 * always picks the cheapest way to actually reach the target, matching the enhancement tooltip.
 * protectFrom = 1 is skipped: protection only changes the failure destination for i >= protectFrom,
 * and at i = 1 that destination is level 0 either way, so protectFrom = 1 always costs strictly
 * more than protectFrom = 0 for zero benefit.
 * @param {string} itemHrid
 * @param {Object} itemDetails
 * @param {number} targetLevel
 * @param {Object} params - from getEnhancingParams()
 * @param {number} anchorProfitPerHour - global recovery anchor (10th-best profit/hr across skills)
 * @param {{price: number}|null} protectionInfo - cheapest protection item price for this item (cached per item)
 * @param {Map} calcCache - shared cache of calculateEnhancement() results for this _compute() run
 * @returns {Object|null}
 */
function calculateItemProfit(
    itemHrid,
    itemDetails,
    targetLevel,
    params,
    anchorProfitPerHour,
    protectionInfo,
    calcCache
) {
    let best = null;
    const canProtect = protectionInfo?.price > 0;
    const maxProtectFrom = canProtect ? targetLevel - 1 : 0;

    for (let protectFrom = 0; protectFrom <= maxProtectFrom; protectFrom++) {
        if (protectFrom === 1) continue;
        const result = simulateItemAtProtectFrom(
            itemHrid,
            itemDetails,
            targetLevel,
            protectFrom,
            params,
            anchorProfitPerHour,
            protectionInfo,
            calcCache
        );
        if (result && (!best || result.baseCost + result.enhancingCost < best.baseCost + best.enhancingCost)) {
            best = result;
        }
    }

    return best;
}

class ProfitCalculator {
    constructor() {
        this.isInitialized = false;
        this.unregisterHandlers = [];
        this.timerRegistry = createTimerRegistry();
        this.panel = null;
        this.tableBody = null;
        this.sortColumn = 'profitPerHour';
        this.sortAsc = false;
        this.lastResults = [];
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
    }

    initialize() {
        if (this.isInitialized) return;
        if (!config.getSetting('enhancementProfitCalc')) return;

        this.isInitialized = true;
        this._buildPanel();

        const unregister = domObserver.onClass(
            'ProfitCalculator',
            'EnhancingPanel_enhancingPanel',
            (panel) => this._injectButton(panel),
            { debounce: true }
        );
        this.unregisterHandlers.push(unregister);

        document.querySelectorAll('[class*="EnhancingPanel_enhancingPanel"]').forEach((panel) => {
            this._injectButton(panel);
        });
    }

    _injectButton(panel) {
        if (panel.querySelector(`.${BTN_CLASS}`)) return;

        const btn = document.createElement('button');
        btn.className = BTN_CLASS;
        btn.textContent = 'Optimizer';
        btn.style.cssText = `
            background: linear-gradient(180deg, rgba(230,180,0,0.2) 0%, rgba(230,180,0,0.1) 100%);
            color: #e0e0e0;
            border: 1px solid rgba(230,180,0,0.4);
            border-radius: 6px;
            padding: 5px 12px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            margin: 4px 8px;
            display: block;
        `;
        btn.addEventListener('click', () => this._toggle());
        panel.insertBefore(btn, panel.firstChild);
    }

    _toggle() {
        if (!this.panel) return;
        const visible = this.panel.style.display !== 'none';
        this.panel.style.display = visible ? 'none' : 'flex';
        if (!visible) bringPanelToFront(this.panel);
    }

    _buildPanel() {
        this.panel = document.createElement('div');
        this.panel.id = PANEL_ID;
        this.panel.style.cssText = `
            position: fixed;
            top: 60px;
            right: 60px;
            z-index: ${config.Z_FLOATING_PANEL};
            background: rgba(10, 10, 20, 0.97);
            border: 2px solid rgba(230, 180, 0, 0.5);
            border-radius: 10px;
            width: 600px;
            height: 580px;
            display: none;
            flex-direction: column;
            font-family: 'Segoe UI', sans-serif;
            color: #e0e0e0;
            font-size: 13px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.6);
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 14px;
            cursor: grab;
            background: rgba(230,180,0,0.12);
            border-bottom: 1px solid rgba(230,180,0,0.3);
            border-radius: 8px 8px 0 0;
            flex-shrink: 0;
        `;
        header.innerHTML = `
            <span style="font-weight:700; font-size:14px; color:#e6b400;">Enhancement Optimizer</span>
            <button id="mwi-profit-close" style="
                background:none; border:none; color:#aaa; font-size:22px;
                cursor:pointer; padding:0; line-height:1;">×</button>
        `;
        this._setupDrag(header);

        const tabBar = document.createElement('div');
        tabBar.style.cssText = `
            display: flex;
            gap: 4px;
            padding: 6px 14px 0 14px;
            border-bottom: 1px solid #222;
            flex-shrink: 0;
        `;
        tabBar.innerHTML = `
            <button id="mwi-profit-tab-calc" class="mwi-profit-tab" style="
                background: rgba(230,180,0,0.18); color: #e6b400; border: 1px solid rgba(230,180,0,0.4);
                border-bottom: none; border-radius: 6px 6px 0 0; padding: 5px 12px; font-size: 12px;
                font-weight: 600; cursor: pointer;">Calculator</button>
            <button id="mwi-profit-tab-config" class="mwi-profit-tab" style="
                background: transparent; color: #888; border: 1px solid transparent;
                border-bottom: none; border-radius: 6px 6px 0 0; padding: 5px 12px; font-size: 12px;
                font-weight: 600; cursor: pointer;">Configure</button>
        `;

        const calcTab = document.createElement('div');
        calcTab.id = 'mwi-profit-tab-content-calc';
        calcTab.style.cssText = 'display: flex; flex-direction: column; flex: 1; min-height: 0;';

        const controls = document.createElement('div');
        controls.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 14px;
            border-bottom: 1px solid #222;
            flex-shrink: 0;
        `;

        const defaultMax = config.getSettingValue('enhancementProfitCalc_maxLevel') || '10';
        const defaultExcludeCharms = config.getSettingValue('enhancementProfitCalc_excludeCharms', true);

        const inputStyle =
            'width:46px; background:#1a1a2e; color:#e0e0e0; border:1px solid #444; border-radius:4px; padding:3px 6px; font-size:12px; text-align:center;';

        controls.innerHTML = `
            <label style="color:#888; font-size:12px;">Max level</label>
            <input id="mwi-profit-maxlevel" type="number" min="1" max="20" value="${defaultMax}" style="${inputStyle}">
            <label style="color:#888; font-size:12px; margin-left:6px; display:flex; align-items:center; gap:4px; cursor:pointer;">
                <input id="mwi-profit-exclude-charms" type="checkbox" ${defaultExcludeCharms ? 'checked' : ''}>
                Exclude charms
            </label>
            <button id="mwi-profit-run" style="
                margin-left: auto;
                background: rgba(230,180,0,0.2);
                color: #e6b400;
                border: 1px solid rgba(230,180,0,0.4);
                border-radius: 6px;
                padding: 5px 14px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;">Calculate</button>
        `;

        const tableContainer = document.createElement('div');
        tableContainer.style.cssText = 'overflow-y: auto; flex: 1;';

        const thBase =
            'padding:6px 10px; font-weight:600; font-size:11px; cursor:pointer; white-space:nowrap; border-bottom:1px solid #222; color:#888;';
        tableContainer.innerHTML = `
            <table style="width:100%; border-collapse:collapse;">
                <thead style="position:sticky; top:0; background:#0a0a14; z-index:1;">
                    <tr>
                        <th id="mwi-profit-th-name"  style="${thBase} text-align:left;"># Item</th>
                        <th id="mwi-profit-th-pph"   style="${thBase} text-align:right;">Profit/hr ▼</th>
                        <th id="mwi-profit-th-totalprofit" style="${thBase} text-align:right;">Total Profit</th>
                        <th id="mwi-profit-th-time" style="${thBase} text-align:right;">Total Time</th>
                        <th id="mwi-profit-th-protect" style="${thBase} text-align:right;">Protect From</th>
                        <th id="mwi-profit-th-roi" style="${thBase} text-align:right;">ROI</th>
                        <th id="mwi-profit-th-basecost" style="${thBase} text-align:right;">Base Cost</th>
                        <th id="mwi-profit-th-enhcost" style="${thBase} text-align:right;">Enhancing Cost</th>
                        <th id="mwi-profit-th-sellprice" style="${thBase} text-align:right;">Sell Price</th>
                        <th id="mwi-profit-th-totalxp" style="${thBase} text-align:right;">Total XP</th>
                        <th id="mwi-profit-th-xph"   style="${thBase} text-align:right;">XP/hr</th>
                        <th id="mwi-profit-th-effxph" style="${thBase} text-align:right;">Eff. XP/hr</th>
                        <th id="mwi-profit-th-age" style="${thBase} text-align:right;">Listing Age</th>
                    </tr>
                </thead>
                <tbody id="mwi-profit-tbody"></tbody>
            </table>
        `;

        const status = document.createElement('div');
        status.id = 'mwi-profit-status';
        status.style.cssText =
            'padding:6px 14px; color:#555; font-size:11px; border-top:1px solid #1a1a1a; flex-shrink:0; text-align:center;';
        status.textContent = 'Enter parameters and click Calculate.';

        calcTab.appendChild(controls);
        calcTab.appendChild(tableContainer);
        calcTab.appendChild(status);

        const configTab = this._buildConfigureTab();
        configTab.style.display = 'none';

        this.panel.appendChild(header);
        this.panel.appendChild(tabBar);
        this.panel.appendChild(calcTab);
        this.panel.appendChild(configTab);

        const resizeHandle = document.createElement('div');
        resizeHandle.style.cssText = `
            position: absolute;
            bottom: 0;
            right: 0;
            width: 16px;
            height: 16px;
            cursor: nwse-resize;
            background: linear-gradient(135deg, transparent 50%, rgba(230, 180, 0, 0.4) 50%);
            border-radius: 0 0 8px 0;
            z-index: 1;
        `;
        this.panel.appendChild(resizeHandle);
        this._setupResize(resizeHandle);

        document.body.appendChild(this.panel);
        registerFloatingPanel(this.panel);

        this.calcTab = calcTab;
        this.configTab = configTab;
        this.tableBody = this.panel.querySelector('#mwi-profit-tbody');

        this.panel.querySelector('#mwi-profit-close').addEventListener('click', () => {
            this.panel.style.display = 'none';
        });
        this.panel.querySelector('#mwi-profit-run').addEventListener('click', () => this._run());
        this.panel.addEventListener('mousedown', () => bringPanelToFront(this.panel));
        this.panel.querySelector('#mwi-profit-tab-calc').addEventListener('click', () => this._switchTab('calc'));
        this.panel.querySelector('#mwi-profit-tab-config').addEventListener('click', () => this._switchTab('config'));

        TABLE_COLUMNS.forEach((col) => {
            this.panel.querySelector(`#mwi-profit-th-${col}`)?.addEventListener('click', () => this._sort(col));
        });
    }

    _switchTab(tab) {
        const activeStyle =
            'background: rgba(230,180,0,0.18); color: #e6b400; border: 1px solid rgba(230,180,0,0.4); border-bottom: none;';
        const inactiveStyle =
            'background: transparent; color: #888; border: 1px solid transparent; border-bottom: none;';

        const calcBtn = this.panel.querySelector('#mwi-profit-tab-calc');
        const configBtn = this.panel.querySelector('#mwi-profit-tab-config');
        calcBtn.style.cssText += tab === 'calc' ? activeStyle : inactiveStyle;
        configBtn.style.cssText += tab === 'config' ? activeStyle : inactiveStyle;

        this.calcTab.style.display = tab === 'calc' ? 'flex' : 'none';
        this.configTab.style.display = tab === 'config' ? 'flex' : 'none';
    }

    /**
     * Build the Configure tab: lets the user override the enhancing stats/gear used by the
     * calculator (same account-wide `enhanceSim_*` settings as the Enhancement Simulator),
     * with a "Reset to Current" button that repopulates every field from live character data.
     * @returns {HTMLElement}
     */
    _buildConfigureTab() {
        const tab = document.createElement('div');
        tab.id = 'mwi-profit-tab-content-config';
        tab.style.cssText = 'display: flex; flex-direction: column; flex: 1; min-height: 0;';
        // Assigned now (not after appending to this.panel) so the wiring below — which looks
        // elements up via this.configTab — can find them while the tab is still detached.
        this.configTab = tab;

        const topBar = document.createElement('div');
        topBar.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 14px;
            border-bottom: 1px solid #222;
            flex-shrink: 0;
        `;
        const autoDetectChecked = config.getSetting(AUTODETECT_ID);
        topBar.innerHTML = `
            <label style="color:#ccc; font-size:12px; display:flex; align-items:center; gap:6px; cursor:pointer;">
                <input id="mwi-cfg-autodetect" type="checkbox" ${autoDetectChecked ? 'checked' : ''}>
                Auto-detect my current stats
            </label>
            <button id="mwi-cfg-reset" style="
                margin-left: auto;
                background: rgba(100,150,230,0.2);
                color: #6b9fff;
                border: 1px solid rgba(100,150,230,0.4);
                border-radius: 6px;
                padding: 5px 12px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;">Reset to Current</button>
        `;

        const rowsContainer = document.createElement('div');
        rowsContainer.id = 'mwi-cfg-rows';
        rowsContainer.style.cssText = 'overflow-y: auto; flex: 1; padding: 10px 14px;';

        const sectionHTML = (title, ids) => {
            const rendered = [];
            for (let i = 0; i < ids.length; i++) {
                if (ids[i] === TEA_COMBO_IDS[0] && ids[i + 1] === TEA_COMBO_IDS[1]) {
                    rendered.push(this._renderTeaComboRowHTML());
                    i++;
                    continue;
                }
                rendered.push(this._renderConfigRowHTML(ids[i]));
            }
            return `
                <div style="color:#6b9fff; font-weight:600; font-size:11px; margin:8px 0 4px;">${title}</div>
                ${rendered.join('')}
            `;
        };
        rowsContainer.innerHTML =
            sectionHTML('Stats', CONFIG_SCALAR_IDS) +
            sectionHTML('Buffs', CONFIG_BUFF_IDS) +
            sectionHTML('Gear', CONFIG_GEAR_IDS);

        tab.appendChild(topBar);
        tab.appendChild(rowsContainer);

        topBar.querySelector('#mwi-cfg-reset').addEventListener('click', () => this._resetConfigToCurrent());
        topBar.querySelector('#mwi-cfg-autodetect').addEventListener('change', (e) => {
            config.setSetting(AUTODETECT_ID, e.target.checked);
            if (e.target.checked) this._populateConfigFromDetection();
            this._applyConfigDisabledState();
        });

        [...CONFIG_SCALAR_IDS, ...CONFIG_BUFF_IDS, ...CONFIG_GEAR_IDS].forEach((id) => this._wireConfigRow(id));
        this._applyConfigDisabledState();

        return tab;
    }

    /**
     * Render one Configure-tab row for a given `enhanceSim_*` setting id, based on its schema
     * definition (checkbox / number / select / compound enhanceGear).
     * @param {string} settingId
     * @returns {string} HTML
     */
    _renderConfigRowHTML(settingId) {
        const def = getSettingDefinition(settingId);
        if (!def) return '';

        const rowStyle = 'display:flex; align-items:center; gap:8px; padding:3px 0; font-size:12px;';
        const labelStyle = `color:#aaa; width:${CONFIG_LABEL_COL_WIDTH}px; flex-shrink:0;`;
        const checkboxSlot = `width:${CONFIG_CHECKBOX_COL_WIDTH}px; flex-shrink:0; display:flex; justify-content:center;`;
        const inputStyle =
            'width:56px; background:#1a1a2e; color:#e0e0e0; border:1px solid #444; border-radius:4px; padding:3px 6px; font-size:12px; text-align:center;';

        if (def.type === 'checkbox') {
            const checked = this._getConfigCheckboxDefault(settingId, def.default);
            return `
                <div style="${rowStyle}">
                    <span style="${checkboxSlot}"><input id="mwi-cfg-${settingId}" type="checkbox" ${checked ? 'checked' : ''}></span>
                    <label style="${labelStyle}">${def.label}</label>
                </div>`;
        }

        if (def.type === 'number') {
            const value = this._getConfigNumberDefault(settingId, def.default);
            return `
                <div style="${rowStyle}">
                    <span style="${checkboxSlot}"></span>
                    <label style="${labelStyle}"${def.help ? ` title="${def.help}"` : ''}>${def.label}</label>
                    <input id="mwi-cfg-${settingId}" type="number" min="${def.min ?? 0}" max="${def.max ?? 999}" value="${value}" style="${inputStyle}" ${def.help ? `title="${def.help}"` : ''}>
                </div>`;
        }

        if (def.type === 'select') {
            const value = config.getSettingValue(settingId, def.default);
            const options = def.options
                .map((o) => `<option value="${o.value}" ${o.value === value ? 'selected' : ''}>${o.label}</option>`)
                .join('');
            return `
                <div style="${rowStyle}">
                    <span style="${checkboxSlot}"></span>
                    <label style="${labelStyle}">${def.label}</label>
                    <select id="mwi-cfg-${settingId}" style="${inputStyle} width:140px;">${options}</select>
                </div>`;
        }

        if (def.type === 'enhanceGear') {
            const val = config.getSettingValue(settingId, def.default) || def.default;
            const enabled = val.enabled ?? true;
            const tier = val.tier || '';
            const level = val.level ?? 0;
            let tierHTML = '';
            if (def.tiers?.length) {
                const options = def.tiers
                    .map((t) => `<option value="${t.value}" ${t.value === tier ? 'selected' : ''}>${t.label}</option>`)
                    .join('');
                tierHTML = `<select id="mwi-cfg-${settingId}_tier" style="${inputStyle} width:100px;">${options}</select>`;
            }
            return `
                <div style="${rowStyle}">
                    <span style="${checkboxSlot}"><input id="mwi-cfg-${settingId}_enabled" type="checkbox" ${enabled ? 'checked' : ''} title="Equipped"></span>
                    <label style="${labelStyle}">${def.label}</label>
                    ${tierHTML}
                    <input id="mwi-cfg-${settingId}_level" type="number" min="0" max="20" value="${level}" style="${inputStyle}">
                </div>`;
        }

        return '';
    }

    /**
     * Resolve the display default for a numeric Configure-tab setting: the stored value if the
     * user (or the Settings page) has ever set one, otherwise for Observatory level specifically,
     * the character's actual current house room level rather than the schema's static fallback.
     * @param {string} settingId
     * @param {number} schemaDefault
     * @returns {number}
     */
    _getConfigNumberDefault(settingId, schemaDefault) {
        const stored = config.getSettingValue(settingId, undefined);
        if (stored !== undefined) return stored;
        if (settingId === 'enhanceSim_houseLevel') {
            const live = dataManager.getHouseRoomLevel('/house_rooms/observatory');
            if (typeof live === 'number') return live;
        }
        return schemaDefault;
    }

    /**
     * Resolve the display default for a boolean Configure-tab setting: the stored value if one
     * has ever been set, otherwise for the Achievement bonus specifically, whether the character
     * has actually completed the enhancing success achievement (all 16 Champion achievements)
     * rather than the schema's static "off" fallback.
     * @param {string} settingId
     * @param {boolean} schemaDefault
     * @returns {boolean}
     */
    _getConfigCheckboxDefault(settingId, schemaDefault) {
        const stored = config.getSettingValue(settingId, undefined);
        if (stored !== undefined) return stored;
        if (settingId === 'enhanceSim_achievement') {
            const bonus = dataManager.getAchievementBuffRatioBoost(
                '/action_types/enhancing',
                '/buff_types/enhancing_success'
            );
            return bonus > 0;
        }
        return schemaDefault;
    }

    /**
     * Render the "Enhancing Tea" checkbox + tier-level dropdown as one combined row instead of
     * two stacked rows. Uses the same input ids the generic checkbox/select renderers would
     * produce, so `_wireConfigRow`/`_populateConfigFromDetection` work on it unmodified.
     * @returns {string} HTML
     */
    _renderTeaComboRowHTML() {
        const enabledDef = getSettingDefinition('enhanceSim_teaEnabled');
        const tierDef = getSettingDefinition('enhanceSim_tea');
        if (!enabledDef || !tierDef) return '';

        const rowStyle = 'display:flex; align-items:center; gap:8px; padding:3px 0; font-size:12px;';
        const labelStyle = `color:#aaa; width:${CONFIG_LABEL_COL_WIDTH}px; flex-shrink:0;`;
        const checkboxSlot = `width:${CONFIG_CHECKBOX_COL_WIDTH}px; flex-shrink:0; display:flex; justify-content:center;`;
        const inputStyle =
            'width:56px; background:#1a1a2e; color:#e0e0e0; border:1px solid #444; border-radius:4px; padding:3px 6px; font-size:12px; text-align:center;';

        const enabled = config.getSetting('enhanceSim_teaEnabled');
        const tier = config.getSettingValue('enhanceSim_tea', tierDef.default);
        const options = tierDef.options
            .map((o) => `<option value="${o.value}" ${o.value === tier ? 'selected' : ''}>${o.label}</option>`)
            .join('');

        return `
            <div style="${rowStyle}">
                <span style="${checkboxSlot}"><input id="mwi-cfg-enhanceSim_teaEnabled" type="checkbox" ${enabled ? 'checked' : ''}></span>
                <label style="${labelStyle}">${enabledDef.label}</label>
                <select id="mwi-cfg-enhanceSim_tea" style="${inputStyle} width:100px;">${options}</select>
            </div>`;
    }

    /**
     * Wire a Configure-tab row's inputs to write straight through to the shared config setting.
     * @param {string} settingId
     */
    _wireConfigRow(settingId) {
        const def = getSettingDefinition(settingId);
        if (!def) return;

        if (def.type === 'checkbox') {
            this.configTab.querySelector(`#mwi-cfg-${settingId}`)?.addEventListener('change', (e) => {
                config.setSetting(settingId, e.target.checked);
            });
            return;
        }

        if (def.type === 'number' || def.type === 'select') {
            const el = this.configTab.querySelector(`#mwi-cfg-${settingId}`);
            const eventName = def.type === 'select' ? 'change' : 'input';
            el?.addEventListener(eventName, (e) => {
                const value = def.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
                config.setSettingValue(settingId, value);
            });
            return;
        }

        if (def.type === 'enhanceGear') {
            const write = () => {
                const enabledEl = this.configTab.querySelector(`#mwi-cfg-${settingId}_enabled`);
                const tierEl = this.configTab.querySelector(`#mwi-cfg-${settingId}_tier`);
                const levelEl = this.configTab.querySelector(`#mwi-cfg-${settingId}_level`);
                config.setSettingValue(settingId, {
                    enabled: enabledEl?.checked ?? true,
                    tier: tierEl?.value,
                    level: parseInt(levelEl?.value) || 0,
                });
            };
            this.configTab.querySelector(`#mwi-cfg-${settingId}_enabled`)?.addEventListener('change', write);
            this.configTab.querySelector(`#mwi-cfg-${settingId}_tier`)?.addEventListener('change', write);
            this.configTab.querySelector(`#mwi-cfg-${settingId}_level`)?.addEventListener('input', write);
        }
    }

    /**
     * Enable/disable the manual Configure-tab inputs based on the Auto-detect checkbox —
     * matches the Settings page's `disabledBy: 'enhanceSim_autoDetect'` behavior.
     */
    _applyConfigDisabledState() {
        const autoDetect = config.getSetting(AUTODETECT_ID);
        const rowsContainer = this.configTab.querySelector('#mwi-cfg-rows');
        rowsContainer.style.opacity = autoDetect ? '0.5' : '1';
        rowsContainer.style.pointerEvents = autoDetect ? 'none' : 'auto';
    }

    /**
     * Populate the Configure tab's manual inputs from live character data without changing mode.
     * Used both by "Reset to Current" and when Auto-detect is freshly checked.
     */
    _populateConfigFromDetection() {
        const detected = getDetectedGearSettings();
        if (!detected) return;

        for (const [settingId, value] of Object.entries(detected)) {
            if (value && typeof value === 'object' && 'enabled' in value) {
                const enabledEl = this.configTab.querySelector(`#mwi-cfg-${settingId}_enabled`);
                const tierEl = this.configTab.querySelector(`#mwi-cfg-${settingId}_tier`);
                const levelEl = this.configTab.querySelector(`#mwi-cfg-${settingId}_level`);
                if (enabledEl) enabledEl.checked = value.enabled;
                if (tierEl && value.tier) tierEl.value = value.tier;
                if (levelEl) levelEl.value = value.level;
                config.setSettingValue(settingId, {
                    enabled: enabledEl?.checked ?? value.enabled,
                    tier: tierEl?.value || value.tier,
                    level: levelEl ? parseInt(levelEl.value) || 0 : value.level,
                });
            } else {
                const el = this.configTab.querySelector(`#mwi-cfg-${settingId}`);
                if (!el) continue;
                if (typeof value === 'boolean') {
                    el.checked = value;
                    config.setSetting(settingId, value);
                } else {
                    el.value = value;
                    config.setSettingValue(settingId, value);
                }
            }
        }
    }

    /**
     * "Reset to Current" — turns off Auto-detect (so the values stick as editable manual
     * overrides) and repopulates every field from live character data.
     */
    _resetConfigToCurrent() {
        config.setSetting(AUTODETECT_ID, false);
        const autoDetectEl = this.configTab.querySelector('#mwi-cfg-autodetect');
        if (autoDetectEl) autoDetectEl.checked = false;
        this._populateConfigFromDetection();
        this._applyConfigDisabledState();
    }

    _setupDrag(header) {
        header.addEventListener('mousedown', (e) => {
            if (e.target.id === 'mwi-profit-close') return;
            this.isDragging = true;
            header.style.cursor = 'grabbing';
            const rect = this.panel.getBoundingClientRect();
            this.dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            bringPanelToFront(this.panel);

            const onMove = (ev) => {
                if (!this.isDragging) return;
                this.panel.style.left = `${ev.clientX - this.dragOffset.x}px`;
                this.panel.style.top = `${ev.clientY - this.dragOffset.y}px`;
                this.panel.style.right = 'auto';
            };
            const onUp = () => {
                this.isDragging = false;
                header.style.cursor = 'grab';
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    _setupResize(handle) {
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = this.panel.offsetWidth;
            const startHeight = this.panel.offsetHeight;
            bringPanelToFront(this.panel);

            const onMove = (ev) => {
                const newWidth = Math.max(400, startWidth + (ev.clientX - startX));
                const newHeight = Math.max(300, startHeight + (ev.clientY - startY));
                this.panel.style.width = `${newWidth}px`;
                this.panel.style.height = `${newHeight}px`;
            };
            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    _run() {
        const maxLevel = Math.min(
            20,
            Math.max(1, parseInt(this.panel.querySelector('#mwi-profit-maxlevel').value) || 10)
        );
        const excludeCharms = this.panel.querySelector('#mwi-profit-exclude-charms').checked;

        const status = this.panel.querySelector('#mwi-profit-status');
        status.textContent = 'Calculating…';
        this.tableBody.innerHTML = '';

        const t = setTimeout(() => {
            try {
                this._compute(maxLevel, excludeCharms);
            } catch (err) {
                console.error('[ProfitCalculator] Error:', err);
                status.textContent = 'Error during calculation.';
            }
        }, 10);
        this.timerRegistry.registerTimeout(t);
    }

    _compute(maxLevel, excludeCharms) {
        const gameData = dataManager.getInitClientData();
        const status = this.panel.querySelector('#mwi-profit-status');
        if (!gameData) {
            status.textContent = 'No game data available.';
            return;
        }

        const params = getEnhancingParams();
        const anchorProfitPerHour = getGlobalBestProfitPerHour();
        const results = [];
        let bestEffXphSoFar = 0;
        // Shared across every item this run — see getCachedEnhancementCalc() for why this is safe.
        const calcCache = new Map();

        for (const [itemHrid, itemDetails] of Object.entries(gameData.itemDetailMap || {})) {
            if (!itemDetails.enhancementCosts?.length) continue;
            if (excludeCharms && itemDetails.equipmentDetail?.type === '/equipment_types/charm') continue;

            // Skip items with no live base-item offer at all before running any simulation for them.
            const basePrice = marketAPI.getPrice(itemHrid, 0);
            if (!basePrice?.ask || basePrice.ask <= 0) continue;

            const protectionInfo = getCheapestProtectionPrice(itemHrid);
            let prevProfitPerHour = null;
            let worseningStreak = 0;
            let bestBidSoFar = 0;
            for (let level = 1; level <= maxLevel; level++) {
                const bidAtLevel = marketAPI.getPrice(itemHrid, level)?.bid || 0;
                if (bidAtLevel > bestBidSoFar) bestBidSoFar = bidAtLevel;

                const result = calculateItemProfit(
                    itemHrid,
                    itemDetails,
                    level,
                    params,
                    anchorProfitPerHour,
                    protectionInfo,
                    calcCache
                );
                if (!result) continue;

                results.push(result);
                if (result.effXph > bestEffXphSoFar) bestEffXphSoFar = result.effXph;

                const isHopeless =
                    result.profitPerHour < -Math.abs(anchorProfitPerHour) * PRUNE_PROFIT_MULTIPLE &&
                    result.effXph < bestEffXphSoFar * PRUNE_EFFXPH_FRACTION;
                worseningStreak =
                    isHopeless && prevProfitPerHour !== null && result.profitPerHour <= prevProfitPerHour
                        ? worseningStreak + 1
                        : 0;
                prevProfitPerHour = result.profitPerHour;

                if (worseningStreak >= PRUNE_CONSECUTIVE_LEVELS) {
                    // Don't give up yet if a higher level's raw (unsimulated) bid price spikes well
                    // above anything seen so far — that level could still turn out profitable.
                    let spikeAhead = false;
                    for (let future = level + 1; future <= maxLevel; future++) {
                        const futureBid = marketAPI.getPrice(itemHrid, future)?.bid || 0;
                        if (futureBid > bestBidSoFar * PRUNE_SPIKE_MULTIPLE) {
                            spikeAhead = true;
                            break;
                        }
                    }
                    if (!spikeAhead) break;
                    worseningStreak = 0;
                }
            }
        }

        this.lastResults = results;
        this.dataAge = marketAPI.getDataAge();
        this.sortColumn = 'profitPerHour';
        this.sortAsc = false;
        this._render();
        this._updateSortIndicators();

        const profitable = results.filter((r) => r.profitPerHour > 0).length;
        const partialNote = results.some((r) => r.costPartial) ? ' * = partial price data.' : '';
        status.textContent = `${results.length} item/level rows · ${profitable} profitable.${partialNote}`;
    }

    _sort(col) {
        const key = COL_KEY_MAP[col];
        if (this.sortColumn === key) {
            this.sortAsc = !this.sortAsc;
        } else {
            this.sortColumn = key;
            this.sortAsc = col === 'name';
        }
        this._render();
        this._updateSortIndicators();
    }

    _updateSortIndicators() {
        TABLE_COLUMNS.forEach((col) => {
            const th = this.panel.querySelector(`#mwi-profit-th-${col}`);
            if (!th) return;
            const base = th.textContent.replace(/\s*[▲▼]$/, '').trimEnd();
            th.textContent = COL_KEY_MAP[col] === this.sortColumn ? `${base} ${this.sortAsc ? '▲' : '▼'}` : base;
        });
    }

    _render() {
        const sorted = [...this.lastResults].sort((a, b) => {
            const key = this.sortColumn;
            const av = a[key];
            const bv = b[key];
            if (typeof av === 'string') return this.sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
            return this.sortAsc ? av - bv : bv - av;
        });

        const tdR = 'padding:5px 10px; text-align:right; border-bottom:1px solid #141414;';
        const tdL = `padding:5px 10px; text-align:left; border-bottom:1px solid #141414;
            max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;`;

        const formatTime = (seconds) => {
            const h = Math.floor(seconds / 3600);
            const m = Math.round((seconds % 3600) / 60);
            return h > 0 ? `${h}h ${m}m` : `${m}m`;
        };
        const ageText = this.dataAge != null ? formatRelativeTime(this.dataAge) : '—';

        this.tableBody.innerHTML = sorted
            .map(
                (r, i) => `
            <tr style="${i % 2 ? 'background:rgba(255,255,255,0.02)' : ''}">
                <td style="${tdL}" title="${r.name}${r.protectFrom > 0 ? ` (protect from +${r.protectFrom})` : ' (no protection)'}">${i + 1}. ${r.name}</td>
                <td style="${tdR}${r.profitPerHour < 0 ? ' color:#e05555;' : ' color:#00c896;'}">
                    ${formatKMB(Math.round(r.profitPerHour))}${r.costPartial ? '*' : ''}
                </td>
                <td style="${tdR}${r.totalProfit < 0 ? ' color:#e05555;' : ' color:#00c896;'}">${formatKMB(Math.round(r.totalProfit))}</td>
                <td style="${tdR}">${formatTime(r.totalTime)}</td>
                <td style="${tdR}">${r.protectFrom > 0 ? `+${r.protectFrom}` : '—'}</td>
                <td style="${tdR}${r.roi < 0 ? ' color:#e05555;' : ' color:#00c896;'}">${r.roi.toFixed(1)}%</td>
                <td style="${tdR}">${formatKMB(Math.round(r.baseCost))}</td>
                <td style="${tdR}">${formatKMB(Math.round(r.enhancingCost))}</td>
                <td style="${tdR}">${formatKMB(Math.round(r.sellPrice))}</td>
                <td style="${tdR}">${formatWithSeparator(Math.round(r.totalXP))}</td>
                <td style="${tdR}">${formatWithSeparator(r.xph)}</td>
                <td style="${tdR} color:#e6b400;">${formatWithSeparator(r.effXph)}</td>
                <td style="${tdR}">${ageText}</td>
            </tr>`
            )
            .join('');
    }

    disable() {
        this.unregisterHandlers.forEach((fn) => fn());
        this.unregisterHandlers = [];
        this.timerRegistry.clearAll();
        if (this.panel) {
            unregisterFloatingPanel(this.panel);
            this.panel.remove();
            this.panel = null;
        }
        document.querySelectorAll(`.${BTN_CLASS}`).forEach((el) => el.remove());
        this.isInitialized = false;
    }
}

const profitCalculator = new ProfitCalculator();
export default profitCalculator;

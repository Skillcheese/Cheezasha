/**
 * Optimize Food UI
 * Floating panel that searches food/mana-food combinations for the currently equipped gear,
 * minimizing deaths/hr first, then time spent out of mana, then cost/hr.
 */

import config from '../../core/config.js';
import dataManager from '../../core/data-manager.js';
import marketAPI from '../../api/marketplace.js';
import { registerFloatingPanel, unregisterFloatingPanel, bringPanelToFront } from '../../utils/panel-z-index.js';
import { formatKMB } from '../../utils/formatters.js';
import {
    buildGameDataPayload,
    buildAllPlayerDTOs,
    getCombatZones,
    getCurrentCombatZone,
    getCommunityBuffs,
    getBuyPrice,
} from './combat-sim-adapter.js';
import { runSimulation, cancelSimulation } from './combat-sim-runner.js';
import { generateCombos } from './combo-utils.js';

const PANEL_ID = 'mwi-optimize-food-panel';
const ACCENT = '#4ade80';
const ACCENT_BORDER = 'rgba(74, 222, 128, 0.5)';
const ACCENT_BG = 'rgba(74, 222, 128, 0.12)';
const ACCENT_BTN_BG = 'rgba(74, 222, 128, 0.2)';
const ACCENT_BTN_BORDER = 'rgba(74, 222, 128, 0.4)';
const MAX_FOOD_SLOTS = 3;
const TOP_CHEAP_PER_CATEGORY = 3;
// Food only comes in 4 mutually-exclusive categories — you can't equip two of the same category
// at once (e.g. two donuts), but different categories stack fine (donut + cake, gummy + yogurt).
const FOOD_CATEGORIES = ['hp_instant', 'hp_over_time', 'mp_instant', 'mp_over_time'];
// Combos are considered "tied" on deaths/hr or OOM% if within this margin, to absorb sim noise
// (finite test hours) rather than treating a fractional difference as a real survivability gap.
const TIE_EPSILON = 1e-6;

/**
 * Categorize a food item the same way the sim editor's conflict picker does: instant vs
 * over-time HP/MP restore. Two items in the same category can't be equipped simultaneously.
 * @param {Object} detail - item.consumableDetail
 * @returns {string|null}
 */
function getFoodCategory(detail) {
    const hp = detail.hitpointRestore || 0;
    const mp = detail.manapointRestore || 0;
    const dur = detail.recoveryDuration || 0;
    if (hp > 0) return dur > 0 ? 'hp_over_time' : 'hp_instant';
    if (mp > 0) return dur > 0 ? 'mp_over_time' : 'mp_instant';
    return null;
}

/**
 * Pick the cheapest N candidates of a category, plus the single strongest (highest restore)
 * in case cheap food alone can't prevent deaths/OOM.
 * @param {Array<Object>} list - candidates sorted ascending by price
 * @param {string} restoreKey - 'hp' or 'mp'
 * @returns {Array<Object>}
 */
function selectCandidates(list, restoreKey) {
    const picked = new Map();
    for (const item of list.slice(0, TOP_CHEAP_PER_CATEGORY)) picked.set(item.hrid, item);
    const strongest = [...list].sort((a, b) => b[restoreKey] - a[restoreKey])[0];
    if (strongest) picked.set(strongest.hrid, strongest);
    return Array.from(picked.values());
}

/**
 * Build candidate food items grouped by category, priced via the market.
 * @returns {Object<string, Array<{hrid: string, name: string, hp: number, mp: number, price: number}>>}
 */
function getCandidateFoodGroups() {
    const clientData = dataManager.getInitClientData();
    const itemDetailMap = clientData?.itemDetailMap || {};

    const byCategory = { hp_instant: [], hp_over_time: [], mp_instant: [], mp_over_time: [] };
    for (const [hrid, item] of Object.entries(itemDetailMap)) {
        const detail = item.consumableDetail;
        if (!detail) continue;
        const cat = item.categoryHrid || '';
        if (!cat.includes('food')) continue;

        const category = getFoodCategory(detail);
        if (!category) continue;

        const price = getBuyPrice(marketAPI.getPrice(hrid));
        byCategory[category].push({
            hrid,
            name: item.name || hrid.split('/').pop(),
            hp: detail.hitpointRestore || 0,
            mp: detail.manapointRestore || 0,
            price,
        });
    }

    const groups = {};
    for (const category of FOOD_CATEGORIES) {
        const list = byCategory[category].sort((a, b) => a.price - b.price);
        const restoreKey = category.startsWith('hp') ? 'hp' : 'mp';
        groups[category] = selectCandidates(list, restoreKey);
    }
    return groups;
}

/**
 * Generate all food combos of up to maxSlots items that respect the one-item-per-category rule:
 * pick a subset of categories (up to maxSlots of them), then the cartesian product of each
 * chosen category's candidates.
 * @param {Object<string, Array<Object>>} groups - category → candidate items
 * @param {number} maxSlots
 * @returns {Array<Array<Object>>}
 */
function generateFoodCombos(groups, maxSlots) {
    const categories = FOOD_CATEGORIES.filter((c) => groups[c].length > 0);
    const categorySubsets = generateCombos(categories, maxSlots);

    const combos = [];
    for (const subset of categorySubsets) {
        let partials = [[]];
        for (const category of subset) {
            const next = [];
            for (const partial of partials) {
                for (const item of groups[category]) {
                    next.push([...partial, item]);
                }
            }
            partials = next;
        }
        combos.push(...partials);
    }
    return combos;
}

class OptimizeFoodUI {
    constructor() {
        this.panel = null;
        this.isRunning = false;
        this._aborted = false;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
    }

    buildPanel() {
        if (this.panel) return;

        this.panel = document.createElement('div');
        this.panel.id = PANEL_ID;
        this.panel.style.cssText = `
            position: fixed;
            top: 60px;
            right: 60px;
            z-index: ${config.Z_FLOATING_PANEL};
            background: rgba(10, 10, 20, 0.97);
            border: 2px solid ${ACCENT_BORDER};
            border-radius: 10px;
            width: 620px;
            height: 480px;
            min-width: 460px;
            min-height: 300px;
            max-width: 90vw;
            max-height: 90vh;
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
            background: ${ACCENT_BG};
            border-bottom: 1px solid ${ACCENT_BORDER};
            border-radius: 8px 8px 0 0;
            flex-shrink: 0;
        `;
        header.innerHTML = `
            <span style="font-weight:700; font-size:14px; color:${ACCENT};">Optimize Food</span>
            <button id="mwi-ofood-close" style="
                background:none; border:none; color:#aaa; font-size:22px;
                cursor:pointer; padding:0; line-height:1;">×</button>
        `;
        this._setupDrag(header);

        const selectStyle =
            'background:#1a1a2e; color:#e0e0e0; border:1px solid #444; border-radius:4px; padding:3px 6px; font-size:12px; flex:1; min-width:0;';
        const inputStyle =
            'width:60px; background:#1a1a2e; color:#e0e0e0; border:1px solid #444; border-radius:4px; padding:3px 6px; font-size:12px; text-align:center;';

        const controls = document.createElement('div');
        controls.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 8px;
            padding: 10px 14px;
            border-bottom: 1px solid #222;
            flex-shrink: 0;
        `;
        controls.innerHTML = `
            <label style="color:#888; font-size:12px;">Zone</label>
            <select id="mwi-ofood-zone" style="${selectStyle}"></select>
            <label style="color:#888; font-size:12px;">Tier</label>
            <select id="mwi-ofood-tier" style="${selectStyle} flex:0; width:64px; min-width:64px;"></select>
            <label style="color:#888; font-size:12px;">Test Hours</label>
            <input id="mwi-ofood-hours" type="number" min="1" max="1000" value="${config.getSettingValue('combatSim_optimizeFoodHours', 2)}" style="${inputStyle}">
            <button id="mwi-ofood-run" style="
                margin-left: auto;
                background: ${ACCENT_BTN_BG};
                color: ${ACCENT};
                border: 1px solid ${ACCENT_BTN_BORDER};
                border-radius: 6px;
                padding: 5px 14px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                font-family: inherit;">Optimize</button>
            <button id="mwi-ofood-stop" style="
                display:none;
                background:rgba(244, 67, 54, 0.2);
                border:1px solid rgba(244, 67, 54, 0.4);
                color:#f44336;
                border-radius:4px;
                padding:5px 10px;
                font-size:12px;
                font-weight:600;
                cursor:pointer;
                font-family:inherit;">Stop</button>
        `;

        const progressContainer = document.createElement('div');
        progressContainer.id = 'mwi-ofood-progress-container';
        progressContainer.style.cssText = 'display:none; padding:6px 14px; flex-shrink:0;';
        progressContainer.innerHTML = `
            <div style="
                background:#1a1a2e;
                border-radius:4px;
                height:18px;
                overflow:hidden;
                position:relative;
                border:1px solid #333;">
                <div id="mwi-ofood-progress-fill" style="
                    height:100%;
                    width:0%;
                    background:linear-gradient(90deg, ${ACCENT_BTN_BG}, ${ACCENT});
                    border-radius:3px;
                    transition:width 0.2s ease;"></div>
                <span id="mwi-ofood-progress-text" style="
                    position:absolute;
                    top:0; left:0; right:0;
                    text-align:center;
                    font-size:11px;
                    line-height:18px;
                    color:#e0e0e0;
                    font-weight:600;">0 / 0</span>
            </div>
        `;

        const resultsContainer = document.createElement('div');
        resultsContainer.id = 'mwi-ofood-results';
        resultsContainer.style.cssText = 'flex:1; overflow-y:auto; padding:10px 14px;';
        resultsContainer.innerHTML = `<div style="color:#555; font-size:12px; text-align:center; padding:20px 0;">Select a zone and click Optimize.</div>`;

        const status = document.createElement('div');
        status.id = 'mwi-ofood-status';
        status.style.cssText =
            'padding:6px 14px; color:#555; font-size:11px; border-top:1px solid #1a1a1a; flex-shrink:0; text-align:center;';
        status.textContent = 'Ready.';

        this.panel.appendChild(header);
        this.panel.appendChild(controls);
        this.panel.appendChild(progressContainer);
        this.panel.appendChild(resultsContainer);
        this.panel.appendChild(status);

        document.body.appendChild(this.panel);
        registerFloatingPanel(this.panel);

        this.panel.querySelector('#mwi-ofood-close').addEventListener('click', () => {
            this.panel.style.display = 'none';
        });
        this.panel.querySelector('#mwi-ofood-run').addEventListener('click', () => this._onRun());
        this.panel.querySelector('#mwi-ofood-stop').addEventListener('click', () => {
            this._aborted = true;
            cancelSimulation();
        });
        this.panel.addEventListener('mousedown', () => bringPanelToFront(this.panel));
        this.panel.querySelector('#mwi-ofood-zone').addEventListener('change', () => this._updateTierDropdown());

        this._populateZones();
    }

    _setupDrag(header) {
        header.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            const rect = this.panel.getBoundingClientRect();
            this.dragOffset.x = e.clientX - rect.left;
            this.dragOffset.y = e.clientY - rect.top;
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            this.panel.style.left = `${e.clientX - this.dragOffset.x}px`;
            this.panel.style.top = `${e.clientY - this.dragOffset.y}px`;
            this.panel.style.right = 'auto';
        });
        document.addEventListener('mouseup', () => {
            this.isDragging = false;
        });
    }

    _populateZones() {
        const zoneSelect = this.panel?.querySelector('#mwi-ofood-zone');
        if (!zoneSelect) return;

        const zones = getCombatZones();
        zoneSelect.innerHTML = '';
        for (const zone of zones) {
            const option = document.createElement('option');
            option.value = zone.hrid;
            option.textContent = zone.isDungeon ? `[D] ${zone.name}` : zone.name;
            zoneSelect.appendChild(option);
        }

        const current = getCurrentCombatZone();
        if (current) zoneSelect.value = current.zoneHrid;

        this._updateTierDropdown();

        if (current) {
            const tierSelect = this.panel.querySelector('#mwi-ofood-tier');
            if (tierSelect) tierSelect.value = String(current.difficultyTier);
        }
    }

    _updateTierDropdown() {
        const zoneSelect = this.panel?.querySelector('#mwi-ofood-zone');
        const tierSelect = this.panel?.querySelector('#mwi-ofood-tier');
        if (!zoneSelect || !tierSelect) return;

        const zones = getCombatZones();
        const zone = zones.find((z) => z.hrid === zoneSelect.value);
        const maxTier = zone?.isDungeon ? 2 : 5;

        const currentTier = parseInt(tierSelect.value) || 0;
        tierSelect.innerHTML = Array.from({ length: maxTier + 1 }, (_, i) => `<option value="${i}">${i}</option>`).join(
            ''
        );
        tierSelect.value = String(Math.min(currentTier, maxTier));
    }

    _setStatus(text) {
        const status = this.panel?.querySelector('#mwi-ofood-status');
        if (status) status.textContent = text;
    }

    async _onRun() {
        if (this.isRunning) return;

        const zoneSelect = this.panel?.querySelector('#mwi-ofood-zone');
        const tierSelect = this.panel?.querySelector('#mwi-ofood-tier');
        const hoursEl = this.panel?.querySelector('#mwi-ofood-hours');
        const zoneHrid = zoneSelect?.value;
        const difficultyTier = parseInt(tierSelect?.value) || 0;
        const hours = Math.min(1000, Math.max(1, parseInt(hoursEl?.value) || 2));

        if (!zoneHrid) {
            this._setStatus('Select a zone first.');
            return;
        }

        const gameData = buildGameDataPayload();
        if (!gameData) {
            this._setStatus('No game data available.');
            return;
        }

        const { players: playerDTOs, selfHrid } = await buildAllPlayerDTOs();
        if (!playerDTOs.length) {
            this._setStatus('No character data available.');
            return;
        }

        const selfIndex = playerDTOs.findIndex((p) => p.hrid === selfHrid || p === playerDTOs[0]);
        const baseIndex = selfIndex >= 0 ? selfIndex : 0;

        const groups = getCandidateFoodGroups();
        console.log(
            '[OptimizeFoodUI] Candidate food pool by category (at most 1 per category per combo):',
            Object.fromEntries(
                Object.entries(groups).map(([category, items]) => [
                    category,
                    items.map((item) => `${item.name} (${item.price}c)`),
                ])
            )
        );
        const combos = generateFoodCombos(groups, MAX_FOOD_SLOTS);

        const communityBuffs = getCommunityBuffs();

        this.isRunning = true;
        this._aborted = false;
        const runBtn = this.panel.querySelector('#mwi-ofood-run');
        const stopBtn = this.panel.querySelector('#mwi-ofood-stop');
        const progressContainer = this.panel.querySelector('#mwi-ofood-progress-container');
        const progressFill = this.panel.querySelector('#mwi-ofood-progress-fill');
        const progressText = this.panel.querySelector('#mwi-ofood-progress-text');
        const resultsEl = this.panel.querySelector('#mwi-ofood-results');

        runBtn.disabled = true;
        runBtn.style.opacity = '0.5';
        runBtn.style.cursor = 'not-allowed';
        stopBtn.style.display = '';
        progressContainer.style.display = 'block';
        resultsEl.innerHTML = '';

        const results = [];

        try {
            for (let i = 0; i < combos.length; i++) {
                if (this._aborted) break;

                const combo = combos[i];
                const food = [];
                for (let s = 0; s < MAX_FOOD_SLOTS; s++) {
                    food.push(combo[s] ? { hrid: combo[s].hrid, triggers: [] } : null);
                }

                const modifiedDTOs = playerDTOs.map((p, idx) => (idx === baseIndex ? { ...p, food } : p));

                progressFill.style.width = `${Math.round((i / combos.length) * 100)}%`;
                progressText.textContent = `${i} / ${combos.length}`;
                this._setStatus(`Testing: ${combo.map((c) => c.name).join(' + ') || 'No food'}...`);

                let simResult;
                try {
                    simResult = await runSimulation({
                        gameData,
                        playerDTOs: modifiedDTOs,
                        zoneHrid,
                        difficultyTier,
                        hours,
                        communityBuffs,
                    });
                } catch (err) {
                    if (err.message === 'Cancelled') break;
                    console.error('[OptimizeFoodUI] Simulation failed for combo', combo, err);
                    continue;
                }

                const simHours = (simResult.simulatedTime || 0) / (3600 * 1e9) || hours;
                const deathsPerHour = (simResult.deaths?.[selfHrid] || 0) / simHours;

                const oomStat = simResult.playerRanOutOfManaTime?.[selfHrid];
                const oomPercent = oomStat
                    ? Math.min(100, (oomStat.totalTimeForOutOfMana / simResult.simulatedTime) * 100)
                    : 0;

                // Only cost the food in this combo — consumablesUsed also includes whatever
                // coffee/drinks the player already has equipped (unchanged across every combo
                // tested here), which calculateSimRevenue's costPerHour would otherwise lump in.
                const comboHrids = new Set(combo.map((c) => c.hrid));
                const consumablesUsed = simResult.consumablesUsed?.[selfHrid] || {};
                let costPerHour = 0;
                for (const [itemHrid, count] of Object.entries(consumablesUsed)) {
                    if (!comboHrids.has(itemHrid)) continue;
                    const price = getBuyPrice(marketAPI.getPrice(itemHrid));
                    costPerHour += (count / simHours) * price;
                }

                results.push({
                    combo,
                    label: combo.map((c) => c.name).join(' + ') || 'No food',
                    deathsPerHour,
                    oomPercent,
                    costPerHour,
                });
            }

            progressFill.style.width = '100%';
            progressText.textContent = `${results.length} / ${combos.length}`;

            if (this._aborted) {
                this._setStatus(`Stopped after ${results.length}/${combos.length} combos.`);
            } else {
                this._setStatus(`Done: tested ${results.length} food combos.`);
            }

            this._displayResults(results);
        } finally {
            this.isRunning = false;
            runBtn.disabled = false;
            runBtn.style.opacity = '1';
            runBtn.style.cursor = 'pointer';
            stopBtn.style.display = 'none';
            progressContainer.style.display = 'none';
        }
    }

    /**
     * Rank combos lexicographically: fewest deaths/hr, then least OOM time, then cheapest —
     * and return the top 5 combos that hit (or tie for) the best deaths/hr and OOM% found.
     * @param {Array<Object>} results
     * @returns {Array<Object>}
     */
    _rankResults(results) {
        if (!results.length) return [];

        const minDeaths = Math.min(...results.map((r) => r.deathsPerHour));
        const survivalTier = results.filter((r) => r.deathsPerHour <= minDeaths + TIE_EPSILON);

        const minOOM = Math.min(...survivalTier.map((r) => r.oomPercent));
        const manaTier = survivalTier.filter((r) => r.oomPercent <= minOOM + TIE_EPSILON);

        return [...manaTier].sort((a, b) => a.costPerHour - b.costPerHour).slice(0, 5);
    }

    _displayResults(results) {
        const container = this.panel?.querySelector('#mwi-ofood-results');
        if (!container) return;

        if (!results.length) {
            container.innerHTML = `<div style="color:#888; font-size:12px; padding:20px 0; text-align:center;">No results.</div>`;
            return;
        }

        const ranked = this._rankResults(results);

        const headerCells = ['Food Combination', 'Deaths/hr', 'Mana OOM %', 'Cost/hr']
            .map(
                (label, i) =>
                    `<th style="padding:3px 4px; font-size:10px; font-weight:600; color:#888; text-align:${i === 0 ? 'left' : 'right'}; border-bottom:1px solid #333;">${label}</th>`
            )
            .join('');

        const bodyRows = ranked
            .map((r, i) => {
                const rowColor = i === 0 ? '#4caf50' : '#ccc';
                const rowWeight = i === 0 ? '700' : '400';
                const rowBg = i === 0 ? 'background:rgba(76,175,80,0.08);' : '';
                return `
                    <tr style="border-bottom:1px solid #1a1a1a; ${rowBg}">
                        <td style="padding:4px 4px; font-size:11px; color:${rowColor}; font-weight:${rowWeight};">${r.label}</td>
                        <td style="padding:4px 4px; font-size:11px; text-align:right; color:${rowColor}; font-weight:${rowWeight};">${r.deathsPerHour.toFixed(2)}</td>
                        <td style="padding:4px 4px; font-size:11px; text-align:right; color:${rowColor}; font-weight:${rowWeight};">${r.oomPercent.toFixed(1)}%</td>
                        <td style="padding:4px 4px; font-size:11px; text-align:right; color:${rowColor}; font-weight:${rowWeight};">${formatKMB(Math.round(r.costPerHour))}</td>
                    </tr>
                `;
            })
            .join('');

        container.innerHTML = `
            <div style="color:#888; font-size:11px; margin-bottom:8px;">
                Top 5 cheapest combos that tie for the lowest deaths/hr and lowest mana-OOM% found across ${results.length} tested combos.
            </div>
            <table style="width:100%; border-collapse:collapse;">
                <thead><tr>${headerCells}</tr></thead>
                <tbody>${bodyRows}</tbody>
            </table>
        `;
    }

    toggle() {
        if (!this.panel) this.buildPanel();
        this.panel.style.display = this.panel.style.display === 'none' ? 'flex' : 'none';
        if (this.panel.style.display === 'flex') {
            bringPanelToFront(this.panel);
            this._populateZones();
        }
    }

    destroy() {
        cancelSimulation();
        if (this.panel) {
            unregisterFloatingPanel(this.panel);
            this.panel.remove();
            this.panel = null;
        }
    }
}

const optimizeFoodUI = new OptimizeFoodUI();
export default optimizeFoodUI;

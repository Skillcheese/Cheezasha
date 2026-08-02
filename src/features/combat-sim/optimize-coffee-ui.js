/**
 * Optimize Coffee UI
 * Floating panel that searches combat drink (coffee) combinations for the
 * currently equipped gear and ranks them by XP/hr, coins/hr, and a mixed metric.
 */

import config from '../../core/config.js';
import dataManager from '../../core/data-manager.js';
import { registerFloatingPanel, unregisterFloatingPanel, bringPanelToFront } from '../../utils/panel-z-index.js';
import { formatKMB } from '../../utils/formatters.js';
import { applyLiveSelfOverrides } from '../../utils/loadout-scraper.js';
import {
    buildGameDataPayload,
    buildAllPlayerDTOs,
    getCombatZones,
    getCurrentCombatZone,
    getCommunityBuffs,
    calculateSimRevenue,
} from './combat-sim-adapter.js';
import { runSimulation, cancelSimulation } from './combat-sim-runner.js';
import { getGlobalBestProfitPerHour } from '../../utils/tea-optimizer.js';
import { generateCombos } from './combo-utils.js';

const PANEL_ID = 'mwi-optimize-coffee-panel';
const ACCENT = '#c58b3f';
const ACCENT_BORDER = 'rgba(197, 139, 63, 0.5)';
const ACCENT_BG = 'rgba(197, 139, 63, 0.12)';
const ACCENT_BTN_BG = 'rgba(197, 139, 63, 0.2)';
const ACCENT_BTN_BORDER = 'rgba(197, 139, 63, 0.4)';
const MAX_DRINK_SLOTS = 3;

/**
 * Get the buff-conflict grouping key for a consumable, mirroring sim-editor's conflict logic.
 * @param {Object} detail - item.consumableDetail
 * @returns {string|null}
 */
function getConsumableTypeKey(detail) {
    if (!detail) return null;
    const buffs = detail.buffs || [];
    if (buffs.length > 0) return 'buff:' + (buffs[0].uniqueHrid || 'unknown');
    return null;
}

/**
 * Build the candidate drink groups: one best item per conflicting buff type.
 * @returns {Array<{key: string, hrid: string, name: string}>}
 */
function getCandidateDrinkGroups() {
    const clientData = dataManager.getInitClientData();
    const itemDetailMap = clientData?.itemDetailMap || {};

    const bestByType = new Map();
    for (const [hrid, item] of Object.entries(itemDetailMap)) {
        if (!item.consumableDetail) continue;
        const cat = item.categoryHrid || '';
        const isDrinkItem =
            (cat.includes('drink') || hrid.includes('coffee')) && item.consumableDetail.cooldownDuration > 0;
        if (!isDrinkItem) continue;

        const key = getConsumableTypeKey(item.consumableDetail);
        if (!key) continue;

        const itemLevel = item.itemLevel || 0;
        const existing = bestByType.get(key);
        if (!existing || itemLevel > existing.itemLevel) {
            bestByType.set(key, { key, hrid, name: item.name || hrid.split('/').pop(), itemLevel });
        }
    }

    return Array.from(bestByType.values());
}

class OptimizeCoffeeUI {
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
            width: 720px;
            height: 520px;
            min-width: 480px;
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
            <span style="font-weight:700; font-size:14px; color:${ACCENT};">Optimize Coffee</span>
            <button id="mwi-ocof-close" style="
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
            <select id="mwi-ocof-zone" style="${selectStyle}"></select>
            <label style="color:#888; font-size:12px;">Tier</label>
            <select id="mwi-ocof-tier" style="${selectStyle} flex:0; width:64px; min-width:64px;"></select>
            <label style="color:#888; font-size:12px;">Test Hours</label>
            <input id="mwi-ocof-hours" type="number" min="1" max="1000" value="${config.getSettingValue('combatSim_optimizeCoffeeHours', 2)}" style="${inputStyle}">
            <button id="mwi-ocof-run" style="
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
            <button id="mwi-ocof-stop" style="
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
        progressContainer.id = 'mwi-ocof-progress-container';
        progressContainer.style.cssText = 'display:none; padding:6px 14px; flex-shrink:0;';
        progressContainer.innerHTML = `
            <div style="
                background:#1a1a2e;
                border-radius:4px;
                height:18px;
                overflow:hidden;
                position:relative;
                border:1px solid #333;">
                <div id="mwi-ocof-progress-fill" style="
                    height:100%;
                    width:0%;
                    background:linear-gradient(90deg, ${ACCENT_BTN_BG}, ${ACCENT});
                    border-radius:3px;
                    transition:width 0.2s ease;"></div>
                <span id="mwi-ocof-progress-text" style="
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
        resultsContainer.id = 'mwi-ocof-results';
        resultsContainer.style.cssText = 'flex:1; overflow-y:auto; padding:10px 14px;';
        resultsContainer.innerHTML = `<div style="color:#555; font-size:12px; text-align:center; padding:20px 0;">Select a zone and click Optimize.</div>`;

        const status = document.createElement('div');
        status.id = 'mwi-ocof-status';
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

        this.panel.querySelector('#mwi-ocof-close').addEventListener('click', () => {
            this.panel.style.display = 'none';
        });
        this.panel.querySelector('#mwi-ocof-run').addEventListener('click', () => this._onRun());
        this.panel.querySelector('#mwi-ocof-stop').addEventListener('click', () => {
            this._aborted = true;
            cancelSimulation();
        });
        this.panel.addEventListener('mousedown', () => bringPanelToFront(this.panel));
        this.panel.querySelector('#mwi-ocof-zone').addEventListener('change', () => this._updateTierDropdown());

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
        const zoneSelect = this.panel?.querySelector('#mwi-ocof-zone');
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
            const tierSelect = this.panel.querySelector('#mwi-ocof-tier');
            if (tierSelect) tierSelect.value = String(current.difficultyTier);
        }
    }

    _updateTierDropdown() {
        const zoneSelect = this.panel?.querySelector('#mwi-ocof-zone');
        const tierSelect = this.panel?.querySelector('#mwi-ocof-tier');
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
        const status = this.panel?.querySelector('#mwi-ocof-status');
        if (status) status.textContent = text;
    }

    async _onRun() {
        if (this.isRunning) return;

        const zoneSelect = this.panel?.querySelector('#mwi-ocof-zone');
        const tierSelect = this.panel?.querySelector('#mwi-ocof-tier');
        const hoursEl = this.panel?.querySelector('#mwi-ocof-hours');
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
        applyLiveSelfOverrides(playerDTOs[baseIndex]);

        const groups = getCandidateDrinkGroups();
        console.log(
            `[OptimizeCoffeeUI] Candidate coffee pool (1 per buff family, ${groups.length} families):`,
            groups.map((g) => ({ buffFamily: g.key, chosenItem: g.name }))
        );
        const combos = generateCombos(groups, MAX_DRINK_SLOTS);

        const communityBuffs = getCommunityBuffs();

        this.isRunning = true;
        this._aborted = false;
        const runBtn = this.panel.querySelector('#mwi-ocof-run');
        const stopBtn = this.panel.querySelector('#mwi-ocof-stop');
        const progressContainer = this.panel.querySelector('#mwi-ocof-progress-container');
        const progressFill = this.panel.querySelector('#mwi-ocof-progress-fill');
        const progressText = this.panel.querySelector('#mwi-ocof-progress-text');
        const resultsEl = this.panel.querySelector('#mwi-ocof-results');

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
                const drinks = [];
                for (let s = 0; s < MAX_DRINK_SLOTS; s++) {
                    drinks.push(combo[s] ? { hrid: combo[s].hrid, triggers: [] } : null);
                }

                const modifiedDTOs = playerDTOs.map((p, idx) => (idx === baseIndex ? { ...p, drinks } : p));

                progressFill.style.width = `${Math.round((i / combos.length) * 100)}%`;
                progressText.textContent = `${i} / ${combos.length}`;
                this._setStatus(`Testing: ${combo.map((c) => c.name).join(' + ') || 'No coffee'}...`);

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
                    console.error('[OptimizeCoffeeUI] Simulation failed for combo', combo, err);
                    continue;
                }

                const simHours = (simResult.simulatedTime || 0) / (3600 * 1e9) || hours;
                const xpMap = simResult.experienceGained?.[selfHrid] || {};
                const xpPerHour = Object.values(xpMap).reduce((s, v) => s + v, 0) / simHours;

                let profitPerHour = 0;
                try {
                    const revenue = calculateSimRevenue(simResult, gameData, selfHrid, simHours);
                    profitPerHour = revenue.netPerHour;
                } catch {
                    // Revenue may not be available for this zone
                }

                results.push({
                    combo,
                    label: combo.map((c) => c.name).join(' + ') || 'No coffee',
                    xpPerHour,
                    profitPerHour,
                });
            }

            progressFill.style.width = '100%';
            progressText.textContent = `${results.length} / ${combos.length}`;

            if (this._aborted) {
                this._setStatus(`Stopped after ${results.length}/${combos.length} combos.`);
            } else {
                this._setStatus(`Done: tested ${results.length} coffee combos.`);
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

    _displayResults(results) {
        const container = this.panel?.querySelector('#mwi-ocof-results');
        if (!container) return;

        if (!results.length) {
            container.innerHTML = `<div style="color:#888; font-size:12px; padding:20px 0; text-align:center;">No results.</div>`;
            return;
        }

        // "Eff. XP/hr": XP/hr discounted by the time it'd take to recover a profit deficit at the
        // 10th-best skilling money-maker rate (same opportunity-cost anchor the Tea Optimizer uses).
        // A combo that's merely less profitable than another isn't penalized unless it actually
        // loses money relative to that anchor, and even then only in proportion to how much
        // skilling time recovering the loss would actually take.
        const profitAnchor = getGlobalBestProfitPerHour();
        for (const r of results) {
            if (r.profitPerHour >= 0 || profitAnchor <= 0) {
                r.mixedScore = r.xpPerHour;
            } else {
                const recoveryRatio = Math.abs(r.profitPerHour) / profitAnchor;
                r.mixedScore = r.xpPerHour / (1 + recoveryRatio);
            }
        }

        const byXP = [...results].sort((a, b) => b.xpPerHour - a.xpPerHour).slice(0, 8);
        const byProfit = [...results].sort((a, b) => b.profitPerHour - a.profitPerHour).slice(0, 8);
        const byMixed = [...results].sort((a, b) => b.mixedScore - a.mixedScore).slice(0, 8);

        const fmtXP = (v) => formatKMB(Math.round(v));
        const fmtCoins = (v) => formatKMB(Math.round(v));

        // valueKey/valueFmt describe the primary (sort) metric. Mixed columns show both XP/hr and
        // Coins/hr; XP/hr and Coins/hr columns show their own metric plus the other one (2 cols total).
        const renderColumn = (title, rows, valueKey, valueFmt) => {
            const primaryLabel =
                valueKey === 'xpPerHour' ? 'XP/hr' : valueKey === 'profitPerHour' ? 'Coins/hr' : 'Eff. XP/hr';
            const showXP = valueKey !== 'xpPerHour';
            const showCoins = valueKey !== 'profitPerHour';

            const headerCells = [
                `<th style="padding:2px 4px; font-size:10px; font-weight:600; color:#888; text-align:left; border-bottom:1px solid #333;">Coffee</th>`,
                `<th style="padding:2px 4px; font-size:10px; font-weight:600; color:#888; text-align:right; border-bottom:1px solid #333;">${primaryLabel}</th>`,
            ];
            if (showXP)
                headerCells.push(
                    `<th style="padding:2px 4px; font-size:10px; font-weight:600; color:#888; text-align:right; border-bottom:1px solid #333;">XP/hr</th>`
                );
            if (showCoins)
                headerCells.push(
                    `<th style="padding:2px 4px; font-size:10px; font-weight:600; color:#888; text-align:right; border-bottom:1px solid #333;">Coins/hr</th>`
                );

            const bodyRows = rows
                .map((r, i) => {
                    const rowColor = i === 0 ? '#4caf50' : '#ccc';
                    const rowWeight = i === 0 ? '700' : '400';
                    const rowBg = i === 0 ? 'background:rgba(76,175,80,0.08);' : '';
                    const cells = [
                        `<td style="padding:4px 4px; font-size:11px; color:${rowColor}; font-weight:${rowWeight};">${r.label}</td>`,
                        `<td style="padding:4px 4px; font-size:11px; text-align:right; white-space:nowrap; color:${rowColor}; font-weight:${rowWeight};">${valueFmt(r[valueKey])}</td>`,
                    ];
                    if (showXP)
                        cells.push(
                            `<td style="padding:4px 4px; font-size:11px; text-align:right; white-space:nowrap; color:#999;">${fmtXP(r.xpPerHour)}</td>`
                        );
                    if (showCoins)
                        cells.push(
                            `<td style="padding:4px 4px; font-size:11px; text-align:right; white-space:nowrap; color:#999;">${fmtCoins(r.profitPerHour)}</td>`
                        );
                    return `<tr style="border-bottom:1px solid #1a1a1a; ${rowBg}">${cells.join('')}</tr>`;
                })
                .join('');

            return `
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:700; font-size:12px; color:${ACCENT}; margin-bottom:6px; text-align:center;">${title}</div>
                    <table style="width:100%; border-collapse:collapse;">
                        <thead><tr>${headerCells.join('')}</tr></thead>
                        <tbody>${bodyRows}</tbody>
                    </table>
                </div>
            `;
        };

        container.innerHTML = `
            <div style="display:flex; gap:14px; align-items:flex-start;">
                ${renderColumn('Best XP/hr', byXP, 'xpPerHour', fmtXP)}
                ${renderColumn('Best Coins/hr', byProfit, 'profitPerHour', fmtCoins)}
                ${renderColumn('Best Mixed (Eff. XP/hr)', byMixed, 'mixedScore', fmtXP)}
            </div>
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

const optimizeCoffeeUI = new OptimizeCoffeeUI();
export default optimizeCoffeeUI;

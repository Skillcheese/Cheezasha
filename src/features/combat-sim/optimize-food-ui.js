/**
 * Optimize Food UI
 * Floating panel that searches food/mana-food combinations for the currently equipped gear,
 * minimizing deaths/hr first, then time spent out of mana, then cost/hr.
 */

import config from '../../core/config.js';
import { registerFloatingPanel, unregisterFloatingPanel, bringPanelToFront } from '../../utils/panel-z-index.js';
import { formatKMB } from '../../utils/formatters.js';
import { applyLiveSelfOverrides } from '../../utils/loadout-scraper.js';
import {
    buildGameDataPayload,
    buildAllPlayerDTOs,
    getCombatZones,
    getCurrentCombatZone,
    getCommunityBuffs,
} from './combat-sim-adapter.js';
import { cancelSimulation, buildExtraBuffs } from './combat-sim-runner.js';
import { runFoodOptimization, rankFoodResults, describeFoodTriggers } from './optimize-food-core.js';

const PANEL_ID = 'mwi-optimize-food-panel';
const ACCENT = '#4ade80';
const ACCENT_BORDER = 'rgba(74, 222, 128, 0.5)';
const ACCENT_BG = 'rgba(74, 222, 128, 0.12)';
const ACCENT_BTN_BORDER = 'rgba(74, 222, 128, 0.4)';
const ACCENT_BTN_BG = 'rgba(74, 222, 128, 0.2)';
// Combos are considered "tied" on deaths/hr or OOM% if within this margin (matches optimize-food-core).
const COMBOS_TO_REFINE = 10;

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
        applyLiveSelfOverrides(playerDTOs[baseIndex]);

        const communityBuffs = getCommunityBuffs();
        const guildCombatBuffs = playerDTOs[0]?.guildCombatBuffs;
        const extraBuffs = buildExtraBuffs(communityBuffs, guildCombatBuffs);

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

        try {
            const { results, refined } = await runFoodOptimization({
                gameData,
                playerDTOs,
                baseIndex,
                zoneHrid,
                difficultyTier,
                hours,
                extraBuffs,
                selfHrid,
                isAborted: () => this._aborted,
                onProgress: ({ completed, total, phase }) => {
                    progressFill.style.width = `${Math.round((completed / total) * 100)}%`;
                    progressText.textContent = `${completed} / ${total}`;
                    if (phase === 'search') this._setStatus(`Tested ${completed} food combos (binary search)...`);
                    else if (phase === 'gathering')
                        this._setStatus(`Found a 0-death, 0% OOM combo. Gathering more candidates...`);
                    else if (phase === 'exhaustive')
                        this._setStatus(`No combo reaches 0 deaths/0% OOM — testing all combos...`);
                    else if (phase === 'refining')
                        this._setStatus(`Tested ${completed}/${total} food combos. Refining trigger thresholds...`);
                },
            });

            if (this._aborted) {
                this._setStatus(`Stopped after ${results.length} combos.`);
                this._displayResults(results);
                return;
            }

            this._setStatus(`Done: tested ${results.length} food combos, refined triggers for top ${refined.length}.`);
            this._displayResults(refined, { refined: true });
        } finally {
            this.isRunning = false;
            runBtn.disabled = false;
            runBtn.style.opacity = '1';
            runBtn.style.cursor = 'pointer';
            stopBtn.style.display = 'none';
            progressContainer.style.display = 'none';
        }
    }

    _displayResults(results, options = {}) {
        const container = this.panel?.querySelector('#mwi-ofood-results');
        if (!container) return;

        if (!results.length) {
            container.innerHTML = `<div style="color:#888; font-size:12px; padding:20px 0; text-align:center;">No results.</div>`;
            return;
        }

        // Results passed in are already the refined top-N candidates (or, on abort, the raw
        // per-combo results before refinement). Re-rank rather than plain-sort so a cheaper
        // combo with worse deaths/OOM can never displace a pricier one that survives better.
        const ranked = rankFoodResults(results, 5);

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
                const triggerDesc = describeFoodTriggers(r);
                return `
                    <tr style="border-bottom:1px solid #1a1a1a; ${rowBg}">
                        <td style="padding:4px 4px; font-size:11px; color:${rowColor}; font-weight:${rowWeight};">
                            ${r.label}
                            ${triggerDesc ? `<div style="font-size:10px; color:#888; font-weight:400;">${triggerDesc}</div>` : ''}
                        </td>
                        <td style="padding:4px 4px; font-size:11px; text-align:right; color:${rowColor}; font-weight:${rowWeight};">${r.deathsPerHour.toFixed(2)}</td>
                        <td style="padding:4px 4px; font-size:11px; text-align:right; color:${rowColor}; font-weight:${rowWeight};">${r.oomPercent.toFixed(1)}%</td>
                        <td style="padding:4px 4px; font-size:11px; text-align:right; color:${rowColor}; font-weight:${rowWeight};">${formatKMB(Math.round(r.costPerHour))}</td>
                    </tr>
                `;
            })
            .join('');

        const note = options.refined
            ? `${ranked.length} combo${ranked.length === 1 ? '' : 's'} tied for the lowest deaths/hr and lowest mana-OOM% (of the best ${COMBOS_TO_REFINE} tested), after refining each food's trigger threshold, sorted by cost/hr.`
            : `${ranked.length} cheapest combo${ranked.length === 1 ? '' : 's'} that tie for the lowest deaths/hr and lowest mana-OOM% found across ${results.length} tested combos.`;

        container.innerHTML = `
            <div style="color:#888; font-size:11px; margin-bottom:8px;">
                ${note}
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

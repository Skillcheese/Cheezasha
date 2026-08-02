/**
 * Ultimate Sim UI
 * Floating panel that loops food optimization → coffee optimization → all-zones simulation,
 * moving to whichever zone comes out best each pass, until the best zone stabilizes or repeats.
 */

import config from '../../core/config.js';
import { registerFloatingPanel, unregisterFloatingPanel, bringPanelToFront } from '../../utils/panel-z-index.js';
import { formatKMB } from '../../utils/formatters.js';
import { getCombatZones, getCurrentCombatZone } from './combat-sim-adapter.js';
import { cancelSimulation } from './combat-sim-runner.js';
import { cancelAllZonesSimulation } from './all-zones-runner.js';
import { runUltimateSim } from './ultimate-sim-runner.js';

const PANEL_ID = 'mwi-ultimate-sim-panel';
const ACCENT = '#a78bfa';
const ACCENT_BORDER = 'rgba(167, 139, 250, 0.5)';
const ACCENT_BG = 'rgba(167, 139, 250, 0.12)';
const ACCENT_BTN_BG = 'rgba(167, 139, 250, 0.2)';
const ACCENT_BTN_BORDER = 'rgba(167, 139, 250, 0.4)';

const PHASE_LABELS = {
    food: 'Optimizing food',
    coffee: 'Optimizing coffee',
    zones: 'Simulating all zones',
};

class UltimateSimUI {
    constructor() {
        this.panel = null;
        this.isRunning = false;
        this._aborted = false;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this._lastTopZones = [];
        this._topSortCol = 'score';
        this._topSortAsc = false;
        this._lastTopCoffees = [];
        this._coffeeSortCol = 'score';
        this._coffeeSortAsc = false;
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
            height: 560px;
            min-width: 520px;
            min-height: 340px;
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
            <span style="font-weight:700; font-size:14px; color:${ACCENT};">Ultimate Sim</span>
            <button id="mwi-usim-close" style="
                background:none; border:none; color:#aaa; font-size:22px;
                cursor:pointer; padding:0; line-height:1;">×</button>
        `;
        this._setupDrag(header);

        const selectStyle =
            'background:#1a1a2e; color:#e0e0e0; border:1px solid #444; border-radius:4px; padding:3px 6px; font-size:12px; flex:1; min-width:0;';
        const inputStyle =
            'width:56px; background:#1a1a2e; color:#e0e0e0; border:1px solid #444; border-radius:4px; padding:3px 6px; font-size:12px; text-align:center;';

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
            <label style="color:#888; font-size:12px;">Start Zone</label>
            <select id="mwi-usim-zone" style="${selectStyle}"></select>
            <label style="color:#888; font-size:12px;">Tier</label>
            <select id="mwi-usim-tier" style="${selectStyle} flex:0; width:56px; min-width:56px;"></select>
            <label style="color:#888; font-size:12px;">Optimize for</label>
            <select id="mwi-usim-metric" style="${selectStyle} flex:0; width:110px; min-width:110px;">
                <option value="xp">XP/hr</option>
                <option value="mixed">Best Mixed</option>
                <option value="profit">Profit/hr</option>
            </select>
        `;

        const controls2 = document.createElement('div');
        controls2.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 8px;
            padding: 0 14px 10px 14px;
            border-bottom: 1px solid #222;
            flex-shrink: 0;
        `;
        controls2.innerHTML = `
            <label style="color:#888; font-size:12px;">Food hrs</label>
            <input id="mwi-usim-food-hours" type="number" min="1" max="1000" value="${config.getSettingValue('combatSim_ultimateSimFoodHours', 2)}" style="${inputStyle}">
            <label style="color:#888; font-size:12px;">Coffee hrs</label>
            <input id="mwi-usim-coffee-hours" type="number" min="1" max="1000" value="${config.getSettingValue('combatSim_ultimateSimCoffeeHours', 2)}" style="${inputStyle}">
            <label style="color:#888; font-size:12px;">All-zones hrs</label>
            <input id="mwi-usim-zones-hours" type="number" min="1" max="10000" value="${config.getSettingValue('combatSim_ultimateSimZonesHours', 10)}" style="${inputStyle}">
            <label style="color:#888; font-size:12px;">Max iterations</label>
            <input id="mwi-usim-max-iter" type="number" min="1" max="50" value="${config.getSettingValue('combatSim_ultimateSimMaxIterations', 10)}" style="${inputStyle}">
            <label style="color:#888; font-size:12px; display:flex; align-items:center; gap:4px; cursor:pointer;">
                <input id="mwi-usim-exclude-dungeons" type="checkbox">Exclude dungeons
            </label>
            <label style="color:#888; font-size:12px; display:flex; align-items:center; gap:4px; cursor:pointer;">
                <input id="mwi-usim-include-zones" type="checkbox" checked>Zones
            </label>
            <label style="color:#888; font-size:12px; display:flex; align-items:center; gap:4px; cursor:pointer;">
                <input id="mwi-usim-include-solo" type="checkbox" checked>Individual Mobs
            </label>
            <button id="mwi-usim-run" style="
                margin-left: auto;
                background: ${ACCENT_BTN_BG};
                color: ${ACCENT};
                border: 1px solid ${ACCENT_BTN_BORDER};
                border-radius: 6px;
                padding: 5px 14px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                font-family: inherit;">Start</button>
            <button id="mwi-usim-stop" style="
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
        progressContainer.id = 'mwi-usim-progress-container';
        progressContainer.style.cssText = 'display:none; padding:6px 14px; flex-shrink:0;';
        progressContainer.innerHTML = `
            <div style="
                background:#1a1a2e;
                border-radius:4px;
                height:18px;
                overflow:hidden;
                position:relative;
                border:1px solid #333;">
                <div id="mwi-usim-progress-fill" style="
                    height:100%;
                    width:0%;
                    background:linear-gradient(90deg, ${ACCENT_BTN_BG}, ${ACCENT});
                    border-radius:3px;
                    transition:width 0.2s ease;"></div>
                <span id="mwi-usim-progress-text" style="
                    position:absolute;
                    top:0; left:0; right:0;
                    text-align:center;
                    font-size:11px;
                    line-height:18px;
                    color:#e0e0e0;
                    font-weight:600;">Ready</span>
            </div>
        `;

        const resultsContainer = document.createElement('div');
        resultsContainer.id = 'mwi-usim-results';
        resultsContainer.style.cssText = 'flex:1; overflow-y:auto; padding:10px 14px;';
        resultsContainer.innerHTML = `<div style="color:#555; font-size:12px; text-align:center; padding:20px 0;">Select a start zone and click Start.</div>`;

        const status = document.createElement('div');
        status.id = 'mwi-usim-status';
        status.style.cssText =
            'padding:6px 14px; color:#555; font-size:11px; border-top:1px solid #1a1a1a; flex-shrink:0; text-align:center;';
        status.textContent = 'Ready.';

        this.panel.appendChild(header);
        this.panel.appendChild(controls);
        this.panel.appendChild(controls2);
        this.panel.appendChild(progressContainer);
        this.panel.appendChild(resultsContainer);
        this.panel.appendChild(status);

        document.body.appendChild(this.panel);
        registerFloatingPanel(this.panel);

        this.panel.querySelector('#mwi-usim-close').addEventListener('click', () => {
            this.panel.style.display = 'none';
        });
        this.panel.querySelector('#mwi-usim-run').addEventListener('click', () => this._onRun());
        this.panel.querySelector('#mwi-usim-stop').addEventListener('click', () => {
            this._aborted = true;
            cancelSimulation();
            cancelAllZonesSimulation();
        });
        this.panel.addEventListener('mousedown', () => bringPanelToFront(this.panel));
        this.panel.querySelector('#mwi-usim-zone').addEventListener('change', () => this._updateTierDropdown());

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
        const zoneSelect = this.panel?.querySelector('#mwi-usim-zone');
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
            const tierSelect = this.panel.querySelector('#mwi-usim-tier');
            if (tierSelect) tierSelect.value = String(current.difficultyTier);
        }
    }

    _updateTierDropdown() {
        const zoneSelect = this.panel?.querySelector('#mwi-usim-zone');
        const tierSelect = this.panel?.querySelector('#mwi-usim-tier');
        if (!zoneSelect || !tierSelect) return;

        const zones = getCombatZones();
        const zone = zones.find((z) => z.hrid === zoneSelect.value);
        const maxTier = zone?.maxDifficulty ?? 0;

        const currentTier = parseInt(tierSelect.value) || 0;
        tierSelect.innerHTML = Array.from({ length: maxTier + 1 }, (_, i) => `<option value="${i}">${i}</option>`).join(
            ''
        );
        tierSelect.value = String(Math.min(currentTier, maxTier));
    }

    _setStatus(text) {
        const status = this.panel?.querySelector('#mwi-usim-status');
        if (status) status.textContent = text;
    }

    async _onRun() {
        if (this.isRunning) return;

        const zoneSelect = this.panel?.querySelector('#mwi-usim-zone');
        const tierSelect = this.panel?.querySelector('#mwi-usim-tier');
        const metricSelect = this.panel?.querySelector('#mwi-usim-metric');
        const foodHoursEl = this.panel?.querySelector('#mwi-usim-food-hours');
        const coffeeHoursEl = this.panel?.querySelector('#mwi-usim-coffee-hours');
        const zonesHoursEl = this.panel?.querySelector('#mwi-usim-zones-hours');
        const maxIterEl = this.panel?.querySelector('#mwi-usim-max-iter');
        const excludeDungeonsEl = this.panel?.querySelector('#mwi-usim-exclude-dungeons');
        const includeZonesEl = this.panel?.querySelector('#mwi-usim-include-zones');
        const includeSoloEl = this.panel?.querySelector('#mwi-usim-include-solo');

        const startZoneHrid = zoneSelect?.value;
        if (!startZoneHrid) {
            this._setStatus('Select a zone first.');
            return;
        }
        const startTier = parseInt(tierSelect?.value) || 0;
        const metric = metricSelect?.value || 'mixed';
        const foodHours = Math.min(1000, Math.max(1, parseInt(foodHoursEl?.value) || 2));
        const coffeeHours = Math.min(1000, Math.max(1, parseInt(coffeeHoursEl?.value) || 2));
        const allZonesHours = Math.min(10000, Math.max(1, parseInt(zonesHoursEl?.value) || 10));
        const maxIterations = Math.min(50, Math.max(1, parseInt(maxIterEl?.value) || 10));
        const excludeDungeons = !!excludeDungeonsEl?.checked;
        const includeZones = includeZonesEl ? includeZonesEl.checked : true;
        const includeSoloMobs = includeSoloEl ? includeSoloEl.checked : true;

        if (!includeZones && !includeSoloMobs) {
            this._setStatus('Enable at least one of "Zones" or "Individual Mobs".');
            return;
        }

        this.isRunning = true;
        this._aborted = false;
        const runBtn = this.panel.querySelector('#mwi-usim-run');
        const stopBtn = this.panel.querySelector('#mwi-usim-stop');
        const progressContainer = this.panel.querySelector('#mwi-usim-progress-container');
        const progressFill = this.panel.querySelector('#mwi-usim-progress-fill');
        const progressText = this.panel.querySelector('#mwi-usim-progress-text');
        const resultsEl = this.panel.querySelector('#mwi-usim-results');

        runBtn.disabled = true;
        runBtn.style.opacity = '0.5';
        runBtn.style.cursor = 'not-allowed';
        stopBtn.style.display = '';
        progressContainer.style.display = 'block';
        resultsEl.innerHTML = '';
        this._renderHistory([]);

        try {
            const result = await runUltimateSim({
                startZoneHrid,
                startTier,
                foodHours,
                coffeeHours,
                allZonesHours,
                metric,
                maxIterations,
                excludeDungeons,
                includeZones,
                includeSoloMobs,
                isAborted: () => this._aborted,
                onProgress: (p) => {
                    const phaseLabel = PHASE_LABELS[p.phase] || p.phase;
                    let percent = 0;
                    let detail = '';
                    if (p.phase === 'zones') {
                        percent = p.percent || 0;
                    } else if (p.total) {
                        percent = Math.round((p.completed / p.total) * 100);
                        detail = ` (${p.completed}/${p.total})`;
                    }
                    progressFill.style.width = `${percent}%`;
                    progressText.textContent = `${percent}%`;
                    this._setStatus(`Iteration ${p.iteration + 1}: ${phaseLabel}${detail}...`);
                },
            });

            this._lastTopZones = result.history[result.history.length - 1]?.topZones || [];
            this._lastTopCoffees = result.history[result.history.length - 1]?.topCoffees || [];
            this._renderHistory(result.history, result);

            if (result.reason === 'aborted') {
                this._setStatus(`Stopped after ${result.history.length} iteration(s).`);
            } else if (result.reason === 'stable') {
                this._setStatus(`Converged after ${result.history.length} iteration(s): best zone is stable.`);
            } else if (result.reason === 'repeat') {
                this._setStatus(`Converged after ${result.history.length} iteration(s): zone cycle detected.`);
            } else if (result.reason === 'max_iterations') {
                this._setStatus(`Stopped after reaching the max of ${maxIterations} iterations.`);
            } else {
                this._setStatus(`Stopped: ${result.reason}.`);
            }
        } catch (error) {
            console.error('[UltimateSimUI] Run failed:', error);
            this._setStatus(`Error: ${error.message || 'Unknown error'}`);
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
     * Render the iteration history table (zone tested, food/coffee chosen, best zone found) plus
     * a sortable top-5-zones table for the most recent iteration's all-zones pass.
     * @param {Array<Object>} history
     * @param {Object} [result] - Final result object, if the run has finished
     */
    _renderHistory(history, result) {
        const container = this.panel?.querySelector('#mwi-usim-results');
        if (!container) return;

        if (!history.length) {
            container.innerHTML = `<div style="color:#555; font-size:12px; text-align:center; padding:20px 0;">Running...</div>`;
            return;
        }

        const rows = history
            .map((h) => {
                const foodLabel = h.food?.label || 'None';
                const coffeeLabel = h.coffee?.label || 'None';
                const bestZoneName = h.bestZone?.zone?.name || '?';
                const bestTier = h.bestZone?.zone?.difficultyTier ?? '?';
                const xp = formatKMB(Math.round(h.bestZone?.xpPerHour || 0));
                const profit = formatKMB(Math.round(h.bestZone?.profitPerHour || 0));
                return `
                    <tr style="border-bottom:1px solid #1a1a1a;">
                        <td style="padding:4px 4px; font-size:11px; color:#ccc;">${h.iteration + 1}</td>
                        <td style="padding:4px 4px; font-size:11px; color:#ccc;">${foodLabel}</td>
                        <td style="padding:4px 4px; font-size:11px; color:#ccc;">${coffeeLabel}</td>
                        <td style="padding:4px 4px; font-size:11px; color:${ACCENT}; font-weight:600;">${bestZoneName} (T${bestTier})</td>
                        <td style="padding:4px 4px; font-size:11px; text-align:right; color:#999;">${xp}</td>
                        <td style="padding:4px 4px; font-size:11px; text-align:right; color:#999;">${profit}</td>
                    </tr>
                `;
            })
            .join('');

        const finalNote =
            result && result.finalZone
                ? `<div style="margin:10px 0; padding:10px; background:rgba(76,175,80,0.08); border:1px solid rgba(76,175,80,0.3); border-radius:6px; color:#4caf50; font-weight:600; font-size:12px;">
                    Final zone: ${result.finalZone.zone.name} (Tier ${result.finalZone.zone.difficultyTier}) —
                    ${formatKMB(Math.round(result.finalZone.xpPerHour))} XP/hr,
                    ${formatKMB(Math.round(result.finalZone.profitPerHour))} coins/hr,
                    ${formatKMB(Math.round(result.finalZone.effXpPerHour))} eff. XP/hr
                   </div>`
                : '';

        container.innerHTML = `
            <table style="width:100%; border-collapse:collapse;">
                <thead>
                    <tr>
                        <th style="padding:3px 4px; font-size:10px; font-weight:600; color:#888; text-align:left; border-bottom:1px solid #333;">#</th>
                        <th style="padding:3px 4px; font-size:10px; font-weight:600; color:#888; text-align:left; border-bottom:1px solid #333;">Food</th>
                        <th style="padding:3px 4px; font-size:10px; font-weight:600; color:#888; text-align:left; border-bottom:1px solid #333;">Coffee</th>
                        <th style="padding:3px 4px; font-size:10px; font-weight:600; color:#888; text-align:left; border-bottom:1px solid #333;">Best Zone Found</th>
                        <th style="padding:3px 4px; font-size:10px; font-weight:600; color:#888; text-align:right; border-bottom:1px solid #333;">XP/hr</th>
                        <th style="padding:3px 4px; font-size:10px; font-weight:600; color:#888; text-align:right; border-bottom:1px solid #333;">Profit/hr</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            ${finalNote}
            <div style="font-weight:700; font-size:12px; color:${ACCENT}; margin:12px 0 6px 0;">Top Zones (latest all-zones pass)</div>
            <div id="mwi-usim-top-zones"></div>
            <div style="font-weight:700; font-size:12px; color:${ACCENT}; margin:12px 0 6px 0;">Top Coffees (latest coffee pass)</div>
            <div id="mwi-usim-top-coffees"></div>
        `;

        this._renderTopZonesTable();
        this._renderTopCoffeesTable();
    }

    /**
     * Render the sortable top-5-zones table from the last completed all-zones pass. Re-rendered
     * in place (without rebuilding the rest of the results panel) when a column header is clicked.
     */
    _renderTopZonesTable() {
        const container = this.panel?.querySelector('#mwi-usim-top-zones');
        if (!container) return;

        const topZones = this._lastTopZones;
        if (!topZones.length) {
            container.innerHTML = `<div style="color:#555; font-size:12px; text-align:center; padding:10px 0;">No zone results yet.</div>`;
            return;
        }

        const cols = [
            { key: 'zone', label: 'Zone' },
            { key: 'tier', label: 'Tier' },
            { key: 'xpPerHour', label: 'XP/hr' },
            { key: 'profitPerHour', label: 'Profit/hr' },
            { key: 'effXpPerHour', label: 'Eff. XP/hr' },
        ];

        const sortCol = this._topSortCol;
        const sortAsc = this._topSortAsc;
        const sorted = [...topZones].sort((a, b) => {
            const va = sortCol === 'zone' ? a.zone.name : sortCol === 'tier' ? a.zone.difficultyTier : a[sortCol];
            const vb = sortCol === 'zone' ? b.zone.name : sortCol === 'tier' ? b.zone.difficultyTier : b[sortCol];
            if (typeof va === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
            return sortAsc ? va - vb : vb - va;
        });

        const headerCells = cols
            .map((col) => {
                const arrow = sortCol === col.key ? (sortAsc ? ' ▲' : ' ▼') : '';
                const align = col.key === 'zone' ? 'left' : 'right';
                return `<th data-sort-col="${col.key}" style="padding:3px 4px; font-size:10px; font-weight:600; color:#888; text-align:${align}; border-bottom:1px solid #333; cursor:pointer; user-select:none;">${col.label}${arrow}</th>`;
            })
            .join('');

        const bodyRows = sorted
            .map((r, i) => {
                const rowColor = i === 0 ? '#4caf50' : '#ccc';
                const rowWeight = i === 0 ? '700' : '400';
                const rowBg = i === 0 ? 'background:rgba(76,175,80,0.08);' : '';
                return `
                    <tr style="border-bottom:1px solid #1a1a1a; ${rowBg}">
                        <td style="padding:4px 4px; font-size:11px; color:${rowColor}; font-weight:${rowWeight};">${r.zone.name}${r.zone.isDungeon ? ' [D]' : ''}</td>
                        <td style="padding:4px 4px; font-size:11px; text-align:right; color:${rowColor}; font-weight:${rowWeight};">${r.zone.difficultyTier}</td>
                        <td style="padding:4px 4px; font-size:11px; text-align:right; color:${rowColor}; font-weight:${rowWeight};">${formatKMB(Math.round(r.xpPerHour))}</td>
                        <td style="padding:4px 4px; font-size:11px; text-align:right; color:${rowColor}; font-weight:${rowWeight};">${formatKMB(Math.round(r.profitPerHour))}</td>
                        <td style="padding:4px 4px; font-size:11px; text-align:right; color:${rowColor}; font-weight:${rowWeight};">${formatKMB(Math.round(r.effXpPerHour))}</td>
                    </tr>
                `;
            })
            .join('');

        container.innerHTML = `
            <table style="width:100%; border-collapse:collapse;">
                <thead><tr>${headerCells}</tr></thead>
                <tbody>${bodyRows}</tbody>
            </table>
        `;

        container.querySelectorAll('th[data-sort-col]').forEach((th) => {
            th.addEventListener('click', () => {
                const col = th.getAttribute('data-sort-col');
                if (this._topSortCol === col) {
                    this._topSortAsc = !this._topSortAsc;
                } else {
                    this._topSortCol = col;
                    this._topSortAsc = col === 'zone';
                }
                this._renderTopZonesTable();
            });
        });
    }

    /**
     * Render the sortable top-5-coffee-combos table from the last completed coffee pass. Lets you
     * see runner-up combos when the top "Best Mixed" pick isn't the one you actually want.
     */
    _renderTopCoffeesTable() {
        const container = this.panel?.querySelector('#mwi-usim-top-coffees');
        if (!container) return;

        const topCoffees = this._lastTopCoffees;
        if (!topCoffees.length) {
            container.innerHTML = `<div style="color:#555; font-size:12px; text-align:center; padding:10px 0;">No coffee results yet.</div>`;
            return;
        }

        const cols = [
            { key: 'label', label: 'Coffee' },
            { key: 'xpPerHour', label: 'XP/hr' },
            { key: 'profitPerHour', label: 'Profit/hr' },
            { key: 'mixedScore', label: 'Eff. XP/hr' },
        ];

        const sortCol = this._coffeeSortCol === 'score' ? 'score' : this._coffeeSortCol;
        const sortAsc = this._coffeeSortAsc;
        const sorted = [...topCoffees].sort((a, b) => {
            const va = sortCol === 'label' ? a.label : a[sortCol];
            const vb = sortCol === 'label' ? b.label : b[sortCol];
            if (typeof va === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
            return sortAsc ? va - vb : vb - va;
        });

        const headerCells = cols
            .map((col) => {
                const arrow = this._coffeeSortCol === col.key ? (sortAsc ? ' ▲' : ' ▼') : '';
                const align = col.key === 'label' ? 'left' : 'right';
                return `<th data-sort-col="${col.key}" style="padding:3px 4px; font-size:10px; font-weight:600; color:#888; text-align:${align}; border-bottom:1px solid #333; cursor:pointer; user-select:none;">${col.label}${arrow}</th>`;
            })
            .join('');

        const bodyRows = sorted
            .map((r, i) => {
                const rowColor = i === 0 ? '#4caf50' : '#ccc';
                const rowWeight = i === 0 ? '700' : '400';
                const rowBg = i === 0 ? 'background:rgba(76,175,80,0.08);' : '';
                return `
                    <tr style="border-bottom:1px solid #1a1a1a; ${rowBg}">
                        <td style="padding:4px 4px; font-size:11px; color:${rowColor}; font-weight:${rowWeight};">${r.label}</td>
                        <td style="padding:4px 4px; font-size:11px; text-align:right; color:${rowColor}; font-weight:${rowWeight};">${formatKMB(Math.round(r.xpPerHour))}</td>
                        <td style="padding:4px 4px; font-size:11px; text-align:right; color:${rowColor}; font-weight:${rowWeight};">${formatKMB(Math.round(r.profitPerHour))}</td>
                        <td style="padding:4px 4px; font-size:11px; text-align:right; color:${rowColor}; font-weight:${rowWeight};">${formatKMB(Math.round(r.mixedScore))}</td>
                    </tr>
                `;
            })
            .join('');

        container.innerHTML = `
            <table style="width:100%; border-collapse:collapse;">
                <thead><tr>${headerCells}</tr></thead>
                <tbody>${bodyRows}</tbody>
            </table>
        `;

        container.querySelectorAll('th[data-sort-col]').forEach((th) => {
            th.addEventListener('click', () => {
                const col = th.getAttribute('data-sort-col');
                if (this._coffeeSortCol === col) {
                    this._coffeeSortAsc = !this._coffeeSortAsc;
                } else {
                    this._coffeeSortCol = col;
                    this._coffeeSortAsc = col === 'label';
                }
                this._renderTopCoffeesTable();
            });
        });
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
        cancelAllZonesSimulation();
        if (this.panel) {
            unregisterFloatingPanel(this.panel);
            this.panel.remove();
            this.panel = null;
        }
    }
}

const ultimateSimUI = new UltimateSimUI();
export default ultimateSimUI;

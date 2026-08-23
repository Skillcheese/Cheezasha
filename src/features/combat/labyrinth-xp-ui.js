/**
 * Labyrinth XP UI
 * Small floating panel showing per-skill and total XP/hr for the current labyrinth run.
 */

import config from '../../core/config.js';
import dataManager from '../../core/data-manager.js';
import labyrinthXpTracker from './labyrinth-xp-tracker.js';
import { registerFloatingPanel, unregisterFloatingPanel, bringPanelToFront } from '../../utils/panel-z-index.js';
import { formatKMB } from '../../utils/formatters.js';

const PANEL_ID = 'mwi-lab-xp-panel';
const ACCENT = '#4ecb71';
const ACCENT_BORDER = 'rgba(78, 203, 113, 0.5)';
const ACCENT_BG = 'rgba(78, 203, 113, 0.12)';

/**
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
    const totalSec = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

class LabyrinthXpUI {
    constructor() {
        this.panel = null;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.updateHandler = null;
        this.tickInterval = null;
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
            width: 320px;
            max-height: 70vh;
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
            <span style="font-weight:700; font-size:14px; color:${ACCENT};">Labyrinth XP</span>
            <button id="mwi-lab-xp-close" style="
                background:none; border:none; color:#aaa; font-size:22px;
                cursor:pointer; padding:0; line-height:1;">×</button>
        `;
        this._setupDrag(header);

        const body = document.createElement('div');
        body.id = 'mwi-lab-xp-body';
        body.style.cssText = 'flex:1; overflow-y:auto; padding:10px 14px;';

        this.panel.appendChild(header);
        this.panel.appendChild(body);

        document.body.appendChild(this.panel);
        registerFloatingPanel(this.panel);

        this.panel.querySelector('#mwi-lab-xp-close').addEventListener('click', () => this.toggle());
        this.panel.addEventListener('mousedown', () => bringPanelToFront(this.panel));

        this.updateHandler = () => this._render();
        labyrinthXpTracker.onUpdate(this.updateHandler);

        this._render();
    }

    toggle() {
        if (!this.panel) this.buildPanel();
        const visible = this.panel.style.display !== 'none';
        if (visible) {
            this.panel.style.display = 'none';
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        } else {
            this.panel.style.display = 'flex';
            bringPanelToFront(this.panel);
            this._render();
            clearInterval(this.tickInterval);
            this.tickInterval = setInterval(() => this._render(), 1000);
        }
    }

    destroy() {
        clearInterval(this.tickInterval);
        this.tickInterval = null;
        if (this.updateHandler) {
            labyrinthXpTracker.offUpdate(this.updateHandler);
            this.updateHandler = null;
        }
        if (this.panel) {
            unregisterFloatingPanel(this.panel);
            this.panel.remove();
            this.panel = null;
        }
    }

    /** @private */
    _render() {
        const body = this.panel?.querySelector('#mwi-lab-xp-body');
        if (!body) return;

        const stats = labyrinthXpTracker.getCurrentRunStats();
        const xpEntries = stats ? Object.entries(stats.xpGains) : [];
        if (!stats || xpEntries.length === 0) {
            body.innerHTML =
                '<div style="color:#666; text-align:center; padding:20px 0; font-size:12px;">' +
                'No labyrinth run data yet. Open the "Loot &amp; XP Log" page once (Cheezasha never requests ' +
                'this itself) — this panel will then update automatically as XP comes in.</div>';
            return;
        }

        const hours = stats.totalActiveMillis > 0 ? stats.totalActiveMillis / 3600000 : 0;
        const gameData = dataManager.getInitClientData();
        const nameFor = (hrid) => gameData?.skillDetailMap?.[hrid]?.name || hrid.split('/').pop().replace(/_/g, ' ');

        const rows = xpEntries
            .map(([hrid, xp]) => ({ hrid, xp, xph: hours > 0 ? xp / hours : 0 }))
            .sort((a, b) => b.xp - a.xp);
        const totalXp = rows.reduce((sum, r) => sum + r.xp, 0);
        const totalXph = hours > 0 ? totalXp / hours : 0;

        const gridCols = 'grid-template-columns: minmax(0, 1fr) auto auto;';

        let html = '<div style="display:flex; flex-direction:column;">';
        for (const r of rows) {
            html += `
                <div style="display:grid; ${gridCols} align-items:center; column-gap:8px; padding:4px 2px; border-bottom:1px solid #1a1a1a;">
                    <span style="color:#ccc; text-transform:capitalize; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${nameFor(r.hrid)}</span>
                    <span style="color:#888; text-align:right;">${formatKMB(r.xp)} xp</span>
                    <span style="color:${ACCENT}; font-weight:600; min-width:64px; text-align:right;">${formatKMB(r.xph)} xp/h</span>
                </div>`;
        }
        html += '</div>';

        html += `
            <div style="margin-top:8px; padding-top:8px; border-top:2px solid #333; display:grid; ${gridCols} align-items:center; column-gap:8px; font-weight:700;">
                <span style="color:#fff;">Total</span>
                <span style="color:#aaa; text-align:right;">${formatKMB(totalXp)} xp</span>
                <span style="color:${ACCENT}; min-width:64px; text-align:right;">${formatKMB(totalXph)} xp/h</span>
            </div>
            <div style="margin-top:6px; color:#666; font-size:11px; text-align:center;">
                Run duration: ${formatDuration(stats.totalActiveMillis)} · ${stats.actionCount} actions
            </div>
        `;

        body.innerHTML = html;
    }

    /** @private */
    _setupDrag(handle) {
        handle.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            this.isDragging = true;
            handle.style.cursor = 'grabbing';
            const rect = this.panel.getBoundingClientRect();
            this.dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };

            const onMove = (e2) => {
                if (!this.isDragging) return;
                this.panel.style.left = `${e2.clientX - this.dragOffset.x}px`;
                this.panel.style.top = `${e2.clientY - this.dragOffset.y}px`;
                this.panel.style.right = 'auto';
            };

            const onUp = () => {
                this.isDragging = false;
                handle.style.cursor = 'grab';
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }
}

const labyrinthXpUI = new LabyrinthXpUI();
export default labyrinthXpUI;

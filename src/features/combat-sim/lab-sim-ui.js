/**
 * Lab Sim UI
 * Floating panel for configuring and running labyrinth simulations.
 * Four tabs: Configure (editor + crate selectors), Max Level, Upgrade, Skilling.
 */

import config from '../../core/config.js';
import dataManager from '../../core/data-manager.js';
import storage from '../../core/storage.js';
import {
    buildGameDataPayload,
    buildAllPlayerDTOs,
    getCombatZones,
    getCommunityBuffs,
    getLabyrinthMonsters,
    applyLoadoutSnapshotToDTO,
} from './combat-sim-adapter.js';
import { runLabyrinthSimulation, cancelSimulation, getMaxBatchWorkers } from './combat-sim-runner.js';
import { findMaxLabyrinthLevel } from './labyrinth-level-finder.js';
import {
    runLabyrinthUpgradeAnalysis,
    computeSkillingClearRatesFromEditor,
    runSkillingUpgradeAnalysis,
    optimizeLabyrinthAbilities,
    optimizeLabyrinthEquipment,
    optimizeLabyrinthEverything,
    isLabyrinthResultBetter,
} from './upgrade-advisor.js';
import { registerFloatingPanel, unregisterFloatingPanel, bringPanelToFront } from '../../utils/panel-z-index.js';
import { formatWithSeparator } from '../../utils/formatters.js';
import assetManifest from '../../utils/asset-manifest.js';
import {
    buildItemSquareHtml,
    buildAbilitySquareHtml,
    setupResultSquareInteractions,
} from '../../utils/result-square.js';
import { SimEditor } from './sim-editor.js';
import labyrinthClearRate from '../combat/labyrinth-clear-rate.js';
import loadoutSnapshot from '../combat/loadout-snapshot.js';

const PANEL_ID = 'mwi-lab-sim-panel';
const ACCENT = '#4a9eff';
const ACCENT_BORDER = 'rgba(74, 158, 255, 0.5)';
const ACCENT_BG = 'rgba(74, 158, 255, 0.12)';
const ACCENT_BTN_BG = 'rgba(74, 158, 255, 0.2)';
const ACCENT_BTN_BORDER = 'rgba(74, 158, 255, 0.4)';
/** Win rate above which a monster is already "good enough" and optimization is skipped. */
const OPTIMIZE_SKIP_WIN_RATE = 0.9;

/**
 * @param {number} seconds
 * @returns {string}
 */
function formatElapsed(seconds) {
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toFixed(0);
    return `${m}m ${s}s`;
}

class LabSimUI {
    constructor() {
        this.panel = null;
        this._editor = null;
        this._skillingEditor = null;
        this.isRunning = false;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.elapsedTimer = null;
        this._activeTab = 'configure';
        this._maxLevel = null;
        this._labyFindMaxMode = false;
        this._labyResults = null;
        this._upgradeAborted = false;
        this._skillingAborted = false;
        this._skillLoadouts = {};
        this._skillLoadoutsLoaded = false;
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
            width: 560px;
            height: 600px;
            min-width: 400px;
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

        // Header
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
            <span style="font-weight:700; font-size:14px; color:${ACCENT};">Lab Simulator</span>
            <button id="mwi-labsim-close" style="
                background:none; border:none; color:#aaa; font-size:22px;
                cursor:pointer; padding:0; line-height:1;">\u00d7</button>
        `;
        this._setupDrag(header);

        // Tab bar
        const tabBar = document.createElement('div');
        tabBar.id = 'mwi-labsim-tabbar';
        tabBar.style.cssText = 'display:flex; gap:0; padding:0; flex-shrink:0; border-bottom:1px solid #222;';
        const tabStyle = (active) => `
            flex: 1;
            padding: 7px 0;
            text-align: center;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            border: none;
            font-family: inherit;
            transition: all 0.1s;
            background: ${active ? ACCENT_BG : 'transparent'};
            color: ${active ? ACCENT : '#888'};
            border-bottom: 2px solid ${active ? ACCENT : 'transparent'};
        `;
        tabBar.innerHTML = `
            <button id="mwi-labsim-tab-configure" style="${tabStyle(true)}">Configure</button>
            <button id="mwi-labsim-tab-maxlevel" style="${tabStyle(false)}">Max Level</button>
            <button id="mwi-labsim-tab-upgrade" style="${tabStyle(false)}">Upgrade</button>
            <button id="mwi-labsim-tab-skilling" style="${tabStyle(false)}">Skilling</button>
        `;

        const selectStyle =
            'background:#1a1a2e; color:#e0e0e0; border:1px solid #444; border-radius:4px; padding:3px 6px; font-size:12px; flex:1; min-width:0;';
        const inputStyle =
            'width:60px; background:#1a1a2e; color:#e0e0e0; border:1px solid #444; border-radius:4px; padding:3px 6px; font-size:12px; text-align:center;';

        // ── Configure tab ──
        const configureContent = document.createElement('div');
        configureContent.id = 'mwi-labsim-configure-content';
        configureContent.style.cssText = 'display:flex; flex-direction:column; flex:1; overflow:hidden;';

        const crateRow = document.createElement('div');
        crateRow.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 14px;
            border-bottom: 1px solid #222;
            flex-shrink: 0;
            font-size: 12px;
        `;
        const crateSelectStyle =
            'background:#1a1a2e; color:#e0e0e0; border:1px solid #444; border-radius:4px; padding:3px 6px; font-size:12px;';
        crateRow.innerHTML = `
            <label style="color:#888;">Tea</label>
            <select id="mwi-labsim-tea" style="${crateSelectStyle}">
                <option value="">None</option>
                <option value="/items/basic_tea_crate">Basic</option>
                <option value="/items/advanced_tea_crate">Advanced</option>
                <option value="/items/expert_tea_crate" selected>Expert</option>
            </select>
            <label style="color:#888;">Coffee</label>
            <select id="mwi-labsim-coffee" style="${crateSelectStyle}">
                <option value="">None</option>
                <option value="/items/basic_coffee_crate">Basic</option>
                <option value="/items/advanced_coffee_crate">Advanced</option>
                <option value="/items/expert_coffee_crate" selected>Expert</option>
            </select>
            <label style="color:#888;">Food</label>
            <select id="mwi-labsim-food" style="${crateSelectStyle}">
                <option value="">None</option>
                <option value="/items/basic_food_crate">Basic</option>
                <option value="/items/advanced_food_crate">Advanced</option>
                <option value="/items/expert_food_crate" selected>Expert</option>
            </select>
        `;

        const editorArea = document.createElement('div');
        editorArea.id = 'mwi-labsim-editor';
        editorArea.style.cssText = 'flex:1; overflow-y:auto; padding:10px 14px;';
        editorArea.innerHTML =
            '<div style="color:#555; font-size:12px; text-align:center; padding:20px 0;">Loading loadout...</div>';

        this._editor = new SimEditor({ editorEl: editorArea, labMode: true });

        configureContent.appendChild(crateRow);

        // Collapsible Labyrinth Buffs section
        const buffsSection = document.createElement('div');
        buffsSection.style.cssText = 'border-bottom:1px solid #222; flex-shrink:0;';

        const buffsHeader = document.createElement('div');
        buffsHeader.style.cssText =
            'display:flex; align-items:center; justify-content:space-between; padding:6px 14px; cursor:pointer; color:#888; font-size:12px;';
        buffsHeader.innerHTML = `
            <span>Labyrinth Buffs</span>
            <span id="mwi-labsim-buffs-toggle" style="font-size:10px;">\u25B6</span>
        `;

        const buffsBody = document.createElement('div');
        buffsBody.id = 'mwi-labsim-buffs-body';
        buffsBody.style.cssText = 'display:none; padding:4px 14px 8px; font-size:11px;';

        buffsHeader.addEventListener('click', () => {
            const isOpen = buffsBody.style.display !== 'none';
            buffsBody.style.display = isOpen ? 'none' : 'block';
            this.panel.querySelector('#mwi-labsim-buffs-toggle').textContent = isOpen ? '\u25B6' : '\u25BC';
            if (!isOpen) this._renderBuffsSection();
        });

        buffsSection.appendChild(buffsHeader);
        buffsSection.appendChild(buffsBody);
        configureContent.appendChild(buffsSection);

        configureContent.appendChild(editorArea);

        // ── Max Level tab ──
        const maxLevelContent = document.createElement('div');
        maxLevelContent.id = 'mwi-labsim-maxlevel-content';
        maxLevelContent.style.cssText = 'display:none; flex-direction:column; flex:1; overflow:hidden;';

        const maxLevelControls = document.createElement('div');
        maxLevelControls.style.cssText = `
            display: flex; flex-wrap: wrap; align-items: center; gap: 12px;
            padding: 8px 14px; border-bottom: 1px solid #222; flex-shrink: 0; font-size: 12px;
        `;
        maxLevelControls.innerHTML = `
            <label style="color:#888; font-size:12px;">Level</label>
            <input id="mwi-labsim-level" type="number" min="20" max="300" value="100" style="${inputStyle}">
            <label style="color:#888; font-size:12px;">Hours</label>
            <input id="mwi-labsim-hours" type="number" min="1" max="10000" value="${config.getSettingValue('labyrinthRecommendSimHours', 10)}" style="${inputStyle}">
            <button id="mwi-labsim-run" style="
                background: ${ACCENT_BTN_BG};
                color: ${ACCENT};
                border: 1px solid ${ACCENT_BTN_BORDER};
                border-radius: 6px;
                padding: 5px 14px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;">Simulate</button>
            <label style="display:flex; align-items:center; gap:4px; color:#888; cursor:pointer;" title="Binary search for highest beatable level at the specified win rate threshold">
                <input type="checkbox" id="mwi-labsim-findmax" style="margin:0; cursor:pointer;">
                Find Max \u2265
            </label>
            <input id="mwi-labsim-threshold" type="number" min="1" max="100" value="${config.getSettingValue('labyrinthRecommendTargetRate', 95)}" style="width:44px; background:#1a1a2e; color:#e0e0e0; border:1px solid #444; border-radius:4px; padding:3px 4px; font-size:12px; text-align:center;">
            <span style="color:#888; font-size:12px;">%</span>
            <label style="color:#888; font-size:12px;" title="Re-optimize each monster's abilities or equipment from scratch (like Combat Sim's Optimize Abilities) on top of its best gear loadout. Significantly slower.">Optimize</label>
            <select id="mwi-labsim-optimize-mode" style="background:#1a1a2e; color:#e0e0e0; border:1px solid #444; border-radius:4px; padding:3px 6px; font-size:12px;">
                <option value="none">Don't Optimize</option>
                <option value="abilities">Optimize Abilities</option>
                <option value="equipment">Optimize Equipment</option>
                <option value="everything">Optimize Everything (4-pass)</option>
            </select>
            <span id="mwi-labsim-optimize-budget-group" style="display:none; align-items:center; gap:4px;">
                <label id="mwi-labsim-optimize-budget-label" style="color:#888; font-size:12px;">Budget (M)</label>
                <input id="mwi-labsim-optimize-budget" type="number" min="0" step="0.1" placeholder="avg" title="Total coin budget (millions) to spend on the optimization. Leave blank to size against the average cost already invested." style="width:56px; background:#1a1a2e; color:#e0e0e0; border:1px solid #444; border-radius:4px; padding:3px 4px; font-size:12px; text-align:center;">
            </span>
            <label style="color:#888; font-size:12px;" title="Only simulate/optimize monsters whose Automation-tab loadout assignment matches the selected loadout.">Loadout</label>
            <select id="mwi-labsim-loadout-filter" style="background:#1a1a2e; color:#e0e0e0; border:1px solid #444; border-radius:4px; padding:3px 6px; font-size:12px; max-width:140px;">
                <option value="">All Loadouts</option>
            </select>
        `;

        const monsterFilterSection = document.createElement('div');
        monsterFilterSection.id = 'mwi-labsim-monster-filter-section';
        monsterFilterSection.style.cssText = 'padding:6px 14px; border-bottom:1px solid #222; flex-shrink:0;';
        monsterFilterSection.innerHTML = `
            <div id="mwi-labsim-monster-filter-toggle" style="color:${ACCENT}; font-weight:700; font-size:12px; margin-bottom:4px; cursor:pointer; user-select:none;">
                <span style="display:inline-block; width:14px; font-size:10px;">&#9654;</span> Mobs (optional filter)
            </div>
            <div id="mwi-labsim-monster-filter-grid" style="display:none; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:3px 10px;"></div>
        `;

        const maxLevelProgress = document.createElement('div');
        maxLevelProgress.id = 'mwi-labsim-progress';
        maxLevelProgress.style.cssText = 'display:none; padding:6px 14px; flex-shrink:0;';
        maxLevelProgress.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;">
                <div style="flex:1; background:#1a1a2e; border-radius:4px; height:18px; overflow:hidden; position:relative; border:1px solid #333;">
                    <div id="mwi-labsim-progress-fill" style="height:100%; width:0%; background:linear-gradient(90deg, ${ACCENT_BTN_BG}, ${ACCENT}); border-radius:3px; transition:width 0.2s ease;"></div>
                    <span id="mwi-labsim-progress-text" style="position:absolute; top:0; left:0; right:0; text-align:center; font-size:11px; line-height:18px; color:#e0e0e0; font-weight:600;">0%</span>
                </div>
                <button id="mwi-labsim-stop" style="
                    background:rgba(255,80,80,0.2); color:#f44; border:1px solid rgba(255,80,80,0.4);
                    border-radius:4px; padding:2px 10px; font-size:11px; cursor:pointer; font-weight:600;">Stop</button>
            </div>
            <div id="mwi-labsim-progress2-row" style="display:none; margin-top:5px;">
                <div style="flex:1; background:#1a1a2e; border-radius:4px; height:14px; overflow:hidden; position:relative; border:1px solid #333;">
                    <div id="mwi-labsim-progress2-fill" style="height:100%; width:0%; background:linear-gradient(90deg, rgba(160,120,255,0.35), #a078ff); border-radius:3px; transition:width 0.2s ease;"></div>
                    <span id="mwi-labsim-progress2-text" style="position:absolute; top:0; left:0; right:0; text-align:center; font-size:10px; line-height:14px; color:#e0e0e0; font-weight:600;">Ability combos</span>
                </div>
                <div id="mwi-labsim-progress2-detail" style="margin-top:3px; font-size:10px; color:#888; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"></div>
            </div>
        `;

        const maxLevelResults = document.createElement('div');
        maxLevelResults.id = 'mwi-labsim-results';
        maxLevelResults.style.cssText = 'flex:1; overflow-y:auto; padding:10px 14px;';

        maxLevelContent.appendChild(maxLevelControls);
        maxLevelContent.appendChild(monsterFilterSection);
        maxLevelContent.appendChild(maxLevelProgress);
        maxLevelContent.appendChild(maxLevelResults);

        // ── Upgrade tab ──
        const upgradeContent = document.createElement('div');
        upgradeContent.id = 'mwi-labsim-upgrade-content';
        upgradeContent.style.cssText = 'display:none; flex-direction:column; flex:1; overflow:hidden;';

        const upgradeControls = document.createElement('div');
        upgradeControls.style.cssText = `
            display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
            padding: 10px 14px; border-bottom: 1px solid #222; flex-shrink: 0;
        `;
        upgradeControls.innerHTML = `
            <label style="color:#888; font-size:12px;">Monster</label>
            <select id="mwi-labsim-upgrade-monster" style="${selectStyle}"></select>
            <label style="color:#888; font-size:12px;">Player</label>
            <select id="mwi-labsim-upgrade-player" style="${selectStyle}"></select>
            <button id="mwi-labsim-upgrade-run" style="
                margin-left: auto;
                background: ${ACCENT_BTN_BG};
                color: ${ACCENT};
                border: 1px solid ${ACCENT_BTN_BORDER};
                border-radius: 6px;
                padding: 5px 14px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                font-family: inherit;">Analyze</button>
            <button id="mwi-labsim-upgrade-stop" style="
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

        const upgradeProgress = document.createElement('div');
        upgradeProgress.id = 'mwi-labsim-upgrade-progress';
        upgradeProgress.style.cssText = 'display:none; padding:6px 14px; flex-shrink:0;';
        upgradeProgress.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;">
                <div style="flex:1; background:#1a1a2e; border-radius:4px; height:18px; overflow:hidden; position:relative; border:1px solid #333;">
                    <div id="mwi-labsim-upgrade-progress-fill" style="height:100%; width:0%; background:linear-gradient(90deg, ${ACCENT_BTN_BG}, ${ACCENT}); border-radius:3px; transition:width 0.2s ease;"></div>
                    <span id="mwi-labsim-upgrade-progress-text" style="position:absolute; top:0; left:0; right:0; text-align:center; font-size:11px; line-height:18px; color:#e0e0e0; font-weight:600;">0 / 0</span>
                </div>
            </div>
        `;

        const upgradeResults = document.createElement('div');
        upgradeResults.id = 'mwi-labsim-upgrade-results';
        upgradeResults.style.cssText = 'flex:1; overflow-y:auto; padding:10px 14px;';

        upgradeContent.appendChild(upgradeControls);
        upgradeContent.appendChild(upgradeProgress);
        upgradeContent.appendChild(upgradeResults);

        // ── Skilling tab ──
        const skillingContent = document.createElement('div');
        skillingContent.id = 'mwi-labsim-skilling-content';
        skillingContent.style.cssText = 'display:none; flex-direction:column; flex:1; overflow:hidden;';

        const skillingControls = document.createElement('div');
        skillingControls.style.cssText = `
            display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
            padding: 10px 14px; border-bottom: 1px solid #222; flex-shrink: 0;
        `;
        skillingControls.innerHTML = `
            <label style="color:#888; font-size:12px;">Room Level</label>
            <input id="mwi-labsim-skilling-level" type="number" min="1" max="300" value="100" style="${inputStyle}">
            <button id="mwi-labsim-skilling-calc" style="
                background: ${ACCENT_BTN_BG};
                color: ${ACCENT};
                border: 1px solid ${ACCENT_BTN_BORDER};
                border-radius: 6px;
                padding: 5px 14px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                font-family: inherit;">Calculate</button>
            <button id="mwi-labsim-skilling-upgrade" style="
                background: rgba(255,255,255,0.04);
                border: 1px solid #333;
                color: #aaa;
                border-radius: 6px;
                padding: 5px 10px;
                font-size: 12px;
                cursor: pointer;
                font-family: inherit;">Analyze Upgrades</button>
            <button id="mwi-labsim-skilling-stop" style="
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
            <select id="mwi-labsim-skilling-filter" style="
                background:#1a1a2e;
                color:#e0e0e0;
                border:1px solid #444;
                border-radius:4px;
                padding:4px 6px;
                font-size:11px;
                font-family:inherit;
                margin-left:auto;">
                <option value="">All Skills</option>
                <option value="/skills/woodcutting">Woodcutting</option>
                <option value="/skills/foraging">Foraging</option>
                <option value="/skills/milking">Milking</option>
                <option value="/skills/cooking">Cooking</option>
                <option value="/skills/brewing">Brewing</option>
                <option value="/skills/cheesesmithing">Cheesesmithing</option>
                <option value="/skills/crafting">Crafting</option>
                <option value="/skills/tailoring">Tailoring</option>
                <option value="/skills/alchemy">Alchemy</option>
                <option value="/skills/enhancing">Enhancing</option>
            </select>
        `;

        const skillingCrateRow = document.createElement('div');
        skillingCrateRow.style.cssText = `
            display: flex; align-items: center; gap: 10px;
            padding: 6px 14px; border-bottom: 1px solid #222; flex-shrink: 0; font-size: 12px;
        `;
        skillingCrateRow.innerHTML = `
            <label style="color:#888;">Tea</label>
            <select id="mwi-labsim-skilling-tea" style="${crateSelectStyle}">
                <option value="">None</option>
                <option value="/items/basic_tea_crate">Basic</option>
                <option value="/items/advanced_tea_crate">Advanced</option>
                <option value="/items/expert_tea_crate" selected>Expert</option>
            </select>
            <label style="color:#888;">Coffee</label>
            <select id="mwi-labsim-skilling-coffee" style="${crateSelectStyle}">
                <option value="">None</option>
                <option value="/items/basic_coffee_crate">Basic</option>
                <option value="/items/advanced_coffee_crate">Advanced</option>
                <option value="/items/expert_coffee_crate" selected>Expert</option>
            </select>
            <label style="color:#888;">Food</label>
            <select id="mwi-labsim-skilling-food" style="${crateSelectStyle}">
                <option value="">None</option>
                <option value="/items/basic_food_crate">Basic</option>
                <option value="/items/advanced_food_crate">Advanced</option>
                <option value="/items/expert_food_crate" selected>Expert</option>
            </select>
        `;

        const skillingLoadoutArea = document.createElement('div');
        skillingLoadoutArea.id = 'mwi-labsim-skilling-loadouts';
        skillingLoadoutArea.style.cssText =
            'padding:8px 14px; border-bottom:1px solid #222; flex-shrink:0; overflow-y:auto; max-height:160px;';

        const skillingEditorArea = document.createElement('div');
        skillingEditorArea.id = 'mwi-labsim-skilling-editor';
        skillingEditorArea.style.cssText = 'overflow-y:auto; padding:10px 14px; max-height:200px; flex-shrink:0;';
        skillingEditorArea.innerHTML =
            '<div style="color:#555; font-size:12px; text-align:center; padding:20px 0;">Loading loadout...</div>';

        this._skillingEditor = new SimEditor({ editorEl: skillingEditorArea, labMode: true, skillingMode: true });

        const skillingProgress = document.createElement('div');
        skillingProgress.id = 'mwi-labsim-skilling-progress';
        skillingProgress.style.cssText = 'display:none; padding:6px 14px; flex-shrink:0;';
        skillingProgress.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;">
                <div style="flex:1; background:#1a1a2e; border-radius:4px; height:18px; overflow:hidden; position:relative; border:1px solid #333;">
                    <div id="mwi-labsim-skilling-progress-fill" style="height:100%; width:0%; background:linear-gradient(90deg, ${ACCENT_BTN_BG}, ${ACCENT}); border-radius:3px; transition:width 0.2s ease;"></div>
                    <span id="mwi-labsim-skilling-progress-text" style="position:absolute; top:0; left:0; right:0; text-align:center; font-size:11px; line-height:18px; color:#e0e0e0; font-weight:600;">0 / 0</span>
                </div>
            </div>
        `;

        const skillingResults = document.createElement('div');
        skillingResults.id = 'mwi-labsim-skilling-results';
        skillingResults.style.cssText = 'flex:1; overflow-y:auto; padding:10px 14px;';

        skillingContent.appendChild(skillingControls);
        skillingContent.appendChild(skillingCrateRow);
        skillingContent.appendChild(skillingLoadoutArea);
        skillingContent.appendChild(skillingEditorArea);
        skillingContent.appendChild(skillingProgress);
        skillingContent.appendChild(skillingResults);

        // Status bar
        const status = document.createElement('div');
        status.id = 'mwi-labsim-status';
        status.style.cssText =
            'padding:6px 14px; color:#555; font-size:11px; border-top:1px solid #1a1a1a; flex-shrink:0; text-align:center;';
        status.textContent = 'Set level and hours in Max Level, then Simulate to see all labyrinth mobs.';

        // Assemble
        this.panel.appendChild(header);
        this.panel.appendChild(tabBar);
        this.panel.appendChild(configureContent);
        this.panel.appendChild(maxLevelContent);
        this.panel.appendChild(upgradeContent);
        this.panel.appendChild(skillingContent);
        this.panel.appendChild(status);

        const resizeHandle = document.createElement('div');
        resizeHandle.style.cssText = `
            position: absolute;
            bottom: 0;
            right: 0;
            width: 16px;
            height: 16px;
            cursor: nwse-resize;
            background: linear-gradient(135deg, transparent 50%, rgba(74, 158, 255, 0.4) 50%);
            border-radius: 0 0 8px 0;
            z-index: 1;
        `;
        this.panel.appendChild(resizeHandle);
        this._setupResize(resizeHandle);

        document.body.appendChild(this.panel);
        registerFloatingPanel(this.panel);

        // Event listeners
        this.panel.querySelector('#mwi-labsim-close').addEventListener('click', () => {
            this.panel.style.display = 'none';
        });
        this.panel.addEventListener('mousedown', () => bringPanelToFront(this.panel));

        // Tab switching
        this.panel
            .querySelector('#mwi-labsim-tab-configure')
            .addEventListener('click', () => this._switchTab('configure'));
        this.panel
            .querySelector('#mwi-labsim-tab-maxlevel')
            .addEventListener('click', () => this._switchTab('maxlevel'));
        this.panel.querySelector('#mwi-labsim-tab-upgrade').addEventListener('click', () => this._switchTab('upgrade'));
        this.panel
            .querySelector('#mwi-labsim-tab-skilling')
            .addEventListener('click', () => this._switchTab('skilling'));

        // Upgrade listeners
        this.panel.querySelector('#mwi-labsim-upgrade-monster').addEventListener('change', (e) => {
            this._onMonsterChange(e.target.value);
        });

        // Max Level listeners
        this.panel.querySelector('#mwi-labsim-run').addEventListener('click', () => this._onSimulate());
        this.panel.querySelector('#mwi-labsim-stop').addEventListener('click', () => {
            cancelSimulation();
            this.isRunning = false;
            this._setStatus('Labyrinth simulation cancelled.');
            this.panel.querySelector('#mwi-labsim-progress').style.display = 'none';
        });
        this.panel.querySelector('#mwi-labsim-findmax').addEventListener('change', (e) => {
            this._labyFindMaxMode = e.target.checked;
            const levelInput = this.panel.querySelector('#mwi-labsim-level');
            levelInput.disabled = e.target.checked;
            levelInput.style.opacity = e.target.checked ? '0.4' : '1';
        });
        this.panel.querySelector('#mwi-labsim-optimize-mode').addEventListener('change', (e) => {
            const budgetGroup = this.panel.querySelector('#mwi-labsim-optimize-budget-group');
            const budgetLabel = this.panel.querySelector('#mwi-labsim-optimize-budget-label');
            budgetGroup.style.display = e.target.value === 'none' ? 'none' : 'inline-flex';
            budgetLabel.textContent = e.target.value === 'equipment' ? 'Max Cost (M)' : 'Budget (M)';
        });

        // Upgrade listeners
        this.panel.querySelector('#mwi-labsim-upgrade-run').addEventListener('click', () => this._onUpgradeAnalyze());
        this.panel.querySelector('#mwi-labsim-upgrade-stop').addEventListener('click', () => {
            this._upgradeAborted = true;
        });

        // Skilling listeners
        this.panel
            .querySelector('#mwi-labsim-skilling-calc')
            .addEventListener('click', () => this._onSkillingCalculate());
        this.panel
            .querySelector('#mwi-labsim-skilling-upgrade')
            .addEventListener('click', () => this._onSkillingUpgradeAnalyze());
        this.panel.querySelector('#mwi-labsim-skilling-stop').addEventListener('click', () => {
            this._skillingAborted = true;
        });
        this.panel.querySelector('#mwi-labsim-skilling-filter').addEventListener('change', () => {
            this._renderSkillLoadoutTable();
        });

        this._populateMonsters();
        this._populateLoadoutFilter();
        this._populateMonsterFilter();
        this.panel.querySelector('#mwi-labsim-loadout-filter').addEventListener('change', () => {
            this._populateMonsterFilter();
        });
        this.panel.querySelector('#mwi-labsim-monster-filter-toggle').addEventListener('click', () => {
            const grid = this.panel.querySelector('#mwi-labsim-monster-filter-grid');
            const toggle = this.panel.querySelector('#mwi-labsim-monster-filter-toggle');
            const collapsed = grid.style.display !== 'none';
            grid.style.display = collapsed ? 'none' : 'grid';
            toggle.querySelector('span').innerHTML = collapsed ? '&#9654;' : '&#9660;';
        });
        this._setupResultSquareInteractions();
    }

    /**
     * Wire up the ability and item squares rendered in results tables (see
     * _makeLoadoutCellFormatter) via the shared result-square utility: hover shows an info
     * tooltip, and click additionally opens an action menu for items.
     * @private
     */
    _setupResultSquareInteractions() {
        this._resultSquareCleanup = setupResultSquareInteractions(this.panel, {
            getItemDetailMap: () => this._itemDetailMapForTooltips,
            getAbilityDetailMap: () => this._abilityDetailMapForTooltips,
            getLevelExperienceTable: () => this._levelExperienceTableForTooltips,
        });
    }

    /** @private */
    _populateMonsters() {
        const select = this.panel?.querySelector('#mwi-labsim-upgrade-monster');
        if (!select) return;

        const monsters = getLabyrinthMonsters();
        select.innerHTML = '';
        for (const monster of monsters) {
            const option = document.createElement('option');
            option.value = monster.hrid;
            option.textContent = monster.name;
            select.appendChild(option);
        }
    }

    /**
     * Populate the Max Level tab's loadout filter with the distinct loadout names actually
     * assigned to labyrinth monsters in the Automation tab, so the user can restrict a sim/
     * optimize run to only the monsters that use one specific loadout. Preserves the current
     * selection across re-population if it's still valid.
     * @private
     */
    _populateLoadoutFilter() {
        const select = this.panel?.querySelector('#mwi-labsim-loadout-filter');
        if (!select) return;

        const previous = select.value;
        const monsters = getLabyrinthMonsters();
        const loadoutNames = [...new Set(monsters.map((m) => this._getMonsterLoadoutName(m.hrid)).filter(Boolean))];
        loadoutNames.sort((a, b) => a.localeCompare(b));

        select.innerHTML = '<option value="">All Loadouts</option>';
        for (const name of loadoutNames) {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        }
        if (loadoutNames.includes(previous)) select.value = previous;
    }

    /**
     * Populate the Max Level tab's mob filter with a checkbox per monster under the currently
     * selected loadout filter (or every labyrinth monster if "All Loadouts" is selected), so the
     * user can further restrict a run to one or a few specific mobs instead of the whole loadout.
     * Rendered as a fixed checkbox grid (not a scrolling listbox) so every mob is visible at
     * once. Preserves any checks that are still valid options after re-population.
     * @private
     */
    _populateMonsterFilter() {
        const grid = this.panel?.querySelector('#mwi-labsim-monster-filter-grid');
        if (!grid) return;

        const previouslyChecked = new Set(
            [...grid.querySelectorAll('input[type="checkbox"]:checked')].map((cb) => cb.value)
        );
        const loadoutFilter = this.panel.querySelector('#mwi-labsim-loadout-filter')?.value || '';
        let monsters = getLabyrinthMonsters();
        if (loadoutFilter) {
            monsters = monsters.filter((m) => this._getMonsterLoadoutName(m.hrid) === loadoutFilter);
        }

        grid.innerHTML = monsters
            .map(
                (monster) => `
            <label style="display:flex; align-items:center; gap:4px; color:#ccc; font-size:11px; cursor:pointer; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${monster.name}">
                <input type="checkbox" value="${monster.hrid}" style="margin:0; cursor:pointer; flex-shrink:0;"${previouslyChecked.has(monster.hrid) ? ' checked' : ''}>
                <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${monster.name}</span>
            </label>`
            )
            .join('');
    }

    /** @private */
    _onMonsterChange(monsterHrid) {
        if (!monsterHrid || !this._editor?.isInitialized()) return;
        const monsterId = monsterHrid.split('/').pop();
        const pascal = monsterId
            .split('_')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join('');
        const loadoutId = dataManager.characterData?.characterSetting?.[`labyrinthLoadout${pascal}`];
        if (!loadoutId) return;
        const snapshot = loadoutSnapshot.snapshots[loadoutId];
        if (!snapshot?.name) return;
        this._editor.applyLoadoutByName(snapshot.name);
    }

    /** @private */
    _populateUpgradePlayerSelector() {
        const select = this.panel?.querySelector('#mwi-labsim-upgrade-player');
        if (!select) return;

        const playerInfo = this._editor?.getPlayerInfo() || [];
        select.innerHTML = '';
        playerInfo.forEach((p, i) => {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = p.name || `Player ${i + 1}`;
            select.appendChild(option);
        });

        if (playerInfo.length === 0) {
            const option = document.createElement('option');
            option.value = 0;
            option.textContent = 'Player 1';
            select.appendChild(option);
        }
    }

    /** @private */
    _renderBuffsSection() {
        const container = this.panel?.querySelector('#mwi-labsim-buffs-body');
        if (!container) return;

        const info = dataManager.characterData?.characterInfo;
        if (!info) {
            container.innerHTML = '<div style="color:#555;">No character data available.</div>';
            return;
        }

        const groups = [
            {
                label: 'Combat',
                buffs: [
                    { key: 'labyrinthCombatDamageLevel', name: 'Damage' },
                    { key: 'labyrinthAttackSpeedLevel', name: 'Atk Speed' },
                    { key: 'labyrinthCastSpeedLevel', name: 'Cast Speed' },
                    { key: 'labyrinthCriticalRateLevel', name: 'Crit Rate' },
                ],
            },
            {
                label: 'Skilling',
                buffs: [
                    { key: 'labyrinthSkillActionSpeedLevel', name: 'Speed' },
                    { key: 'labyrinthSkillingEfficiencyLevel', name: 'Efficiency' },
                    { key: 'labyrinthSkillingSuccessLevel', name: 'Success' },
                    { key: 'labyrinthSkillingDoubleProgressLevel', name: 'Double' },
                ],
            },
            {
                label: 'Other',
                buffs: [
                    { key: 'labyrinthExperienceLevel', name: 'Experience' },
                    { key: 'labyrinthCooldownLevel', name: 'Cooldown' },
                    { key: 'labyrinthTorchLevel', name: 'Torch' },
                    { key: 'labyrinthShroudLevel', name: 'Shroud' },
                    { key: 'labyrinthBeaconLevel', name: 'Beacon' },
                    { key: 'labyrinthAutomationLevel', name: 'Automation' },
                ],
            },
        ];

        let html = '';
        for (const group of groups) {
            html += `<div style="color:#666; font-weight:600; font-size:10px; text-transform:uppercase; margin-top:4px; margin-bottom:2px;">${group.label}</div>`;
            html += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:1px 16px;">';
            for (const b of group.buffs) {
                const level = Math.max(0, Math.floor(Number(info[b.key]) || 0));
                const isMaxed = level >= 12;
                const color = isMaxed ? '#4caf50' : '#e0e0e0';
                html += `<div style="display:flex; justify-content:space-between; padding:1px 0;">
                    <span style="color:#aaa;">${b.name}</span>
                    <span style="color:${color}; font-weight:${isMaxed ? '600' : '400'};">${level}/12</span>
                </div>`;
            }
            html += '</div>';
        }
        container.innerHTML = html;
    }

    /**
     * Get selected crate HRIDs from the Configure tab.
     * @returns {string[]}
     */
    getSelectedCrates() {
        const crates = [];
        const teaHrid = this.panel?.querySelector('#mwi-labsim-tea')?.value;
        const coffeeHrid = this.panel?.querySelector('#mwi-labsim-coffee')?.value;
        const foodHrid = this.panel?.querySelector('#mwi-labsim-food')?.value;
        if (teaHrid) crates.push(teaHrid);
        if (coffeeHrid) crates.push(coffeeHrid);
        if (foodHrid) crates.push(foodHrid);
        return crates;
    }

    /** @private */
    _switchTab(tab) {
        this._activeTab = tab;
        const configureContent = this.panel.querySelector('#mwi-labsim-configure-content');
        const maxLevelContent = this.panel.querySelector('#mwi-labsim-maxlevel-content');
        const upgradeContent = this.panel.querySelector('#mwi-labsim-upgrade-content');
        const skillingContent = this.panel.querySelector('#mwi-labsim-skilling-content');
        const tabConfigure = this.panel.querySelector('#mwi-labsim-tab-configure');
        const tabMaxLevel = this.panel.querySelector('#mwi-labsim-tab-maxlevel');
        const tabUpgrade = this.panel.querySelector('#mwi-labsim-tab-upgrade');
        const tabSkilling = this.panel.querySelector('#mwi-labsim-tab-skilling');

        const activeStyle = `flex:1; padding:7px 0; text-align:center; font-size:12px; font-weight:600; cursor:pointer; border:none; font-family:inherit; transition:all 0.1s; background:${ACCENT_BG}; color:${ACCENT}; border-bottom:2px solid ${ACCENT};`;
        const inactiveStyle =
            'flex:1; padding:7px 0; text-align:center; font-size:12px; font-weight:600; cursor:pointer; border:none; font-family:inherit; transition:all 0.1s; background:transparent; color:#888; border-bottom:2px solid transparent;';

        configureContent.style.display = 'none';
        maxLevelContent.style.display = 'none';
        upgradeContent.style.display = 'none';
        skillingContent.style.display = 'none';
        tabConfigure.style.cssText = inactiveStyle;
        tabMaxLevel.style.cssText = inactiveStyle;
        tabUpgrade.style.cssText = inactiveStyle;
        tabSkilling.style.cssText = inactiveStyle;

        if (tab === 'configure') {
            configureContent.style.display = 'flex';
            tabConfigure.style.cssText = activeStyle;
        } else if (tab === 'maxlevel') {
            maxLevelContent.style.display = 'flex';
            tabMaxLevel.style.cssText = activeStyle;
            this._populateLoadoutFilter();
            this._populateMonsterFilter();
        } else if (tab === 'upgrade') {
            upgradeContent.style.display = 'flex';
            tabUpgrade.style.cssText = activeStyle;
            this._populateUpgradePlayerSelector();
        } else if (tab === 'skilling') {
            skillingContent.style.display = 'flex';
            tabSkilling.style.cssText = activeStyle;
            if (!this._skillingEditor.isInitialized()) {
                this._skillingEditor.initEditor().then(() => this._renderSkillLoadoutTable());
            } else {
                this._renderSkillLoadoutTable();
            }
        }
    }

    /** @private */
    _setStatus(text) {
        const el = this.panel?.querySelector('#mwi-labsim-status');
        if (el) el.textContent = text;
    }

    /** @private */
    async _onSimulate() {
        if (this.isRunning) {
            cancelSimulation();
            this.isRunning = false;
            this._setStatus('Labyrinth simulation cancelled.');
            return;
        }

        const roomLevel = parseInt(this.panel.querySelector('#mwi-labsim-level')?.value) || 100;
        const hours = Math.min(
            10000,
            Math.max(1, parseInt(this.panel.querySelector('#mwi-labsim-hours')?.value) || 10)
        );

        const gameData = buildGameDataPayload();
        if (!gameData) {
            this._setStatus('No game data available.');
            return;
        }

        const loadoutFilter = this.panel.querySelector('#mwi-labsim-loadout-filter')?.value || '';
        const selectedMonsterHrids = [
            ...this.panel.querySelectorAll('#mwi-labsim-monster-filter-grid input[type="checkbox"]:checked'),
        ].map((cb) => cb.value);
        let monsters = getLabyrinthMonsters();
        if (loadoutFilter) {
            monsters = monsters.filter((m) => this._getMonsterLoadoutName(m.hrid) === loadoutFilter);
        }
        if (selectedMonsterHrids.length) {
            monsters = monsters.filter((m) => selectedMonsterHrids.includes(m.hrid));
        }
        if (!monsters.length) {
            this._setStatus(
                selectedMonsterHrids.length
                    ? 'No selected mobs match the current loadout filter.'
                    : loadoutFilter
                      ? `No labyrinth monsters use the "${loadoutFilter}" loadout.`
                      : 'No labyrinth monsters found.'
            );
            return;
        }

        const crates = this.getSelectedCrates();
        const labyrinthCombatBuffs = labyrinthClearRate.getLabyrinthCombatBuffs();

        let playerDTOs;
        const editedDTOs = this._editor?.getEditedDTOs();
        if (editedDTOs) {
            playerDTOs = Object.values(editedDTOs);
        } else {
            const result = await buildAllPlayerDTOs();
            playerDTOs = result.players;
        }

        if (!playerDTOs.length) {
            this._setStatus('No character data available.');
            return;
        }

        const baseDTO = playerDTOs[0];

        const optimizeMode = this.panel.querySelector('#mwi-labsim-optimize-mode')?.value || 'none';
        const optimizeBudgetInput = this.panel.querySelector('#mwi-labsim-optimize-budget')?.value;
        const optimizeBudget =
            optimizeBudgetInput && parseFloat(optimizeBudgetInput) > 0
                ? parseFloat(optimizeBudgetInput) * 1_000_000
                : null;

        const communityBuffs = getCommunityBuffs();
        const zones = getCombatZones();
        const zoneHrid = zones[0]?.hrid || '/actions/combat/fly';

        this.isRunning = true;
        const runBtn = this.panel.querySelector('#mwi-labsim-run');
        runBtn.disabled = true;
        runBtn.style.opacity = '0.5';
        runBtn.style.cursor = 'not-allowed';

        const progressContainer = this.panel.querySelector('#mwi-labsim-progress');
        const progressFill = this.panel.querySelector('#mwi-labsim-progress-fill');
        const progressText = this.panel.querySelector('#mwi-labsim-progress-text');
        const progress2Row = this.panel.querySelector('#mwi-labsim-progress2-row');
        const progress2Fill = this.panel.querySelector('#mwi-labsim-progress2-fill');
        const progress2Text = this.panel.querySelector('#mwi-labsim-progress2-text');
        const progress2Detail = this.panel.querySelector('#mwi-labsim-progress2-detail');
        progressContainer.style.display = 'block';
        progressFill.style.width = '0%';
        progressText.textContent = `0 / ${monsters.length}`;
        progress2Row.style.display = optimizeMode !== 'none' ? 'block' : 'none';
        progress2Fill.style.width = '0%';
        progress2Text.textContent = 'Optimization combos';
        progress2Detail.textContent = '';

        const simStartTime = Date.now();

        const onProgress = (done, total, monsterName) => {
            const percent = Math.round((done / total) * 100);
            progressFill.style.width = `${percent}%`;
            progressText.textContent = `${done} / ${total}${monsterName ? ' — ' + monsterName : ''}`;
        };

        // Multiple monsters optimize concurrently across the worker pool, each running its own
        // independent combo search — a single shared {current, total} would flicker as whichever
        // call last reported overwrote the bar. Instead each concurrent search gets its own slot
        // (via makeOptimizeProgress()) and the bar shows the combined remaining count across
        // every search still in flight; a slot is dropped once its search completes. The detail
        // line's description is also kept per-slot (not one shared variable) — a single shared
        // description looked like it was "going backwards" (e.g. 3/4 then 2/4) whenever a slower
        // monster's earlier-stage update landed after a faster monster's later-stage one. Showing
        // every distinct stage currently in flight reflects reality instead.
        const optimizeProgressSlots = new Map();
        let optimizeProgressSeq = 0;
        const renderOptimizeProgress = () => {
            let sumCurrent = 0;
            let sumTotal = 0;
            const activeDescriptions = new Set();
            for (const { current, total, description } of optimizeProgressSlots.values()) {
                sumCurrent += current;
                sumTotal += total;
                if (description) activeDescriptions.add(description);
            }
            if (sumTotal === 0) {
                progress2Fill.style.width = '0%';
                progress2Text.textContent = 'Optimization combos';
                progress2Detail.textContent = '';
                return;
            }
            const percent = Math.round((sumCurrent / sumTotal) * 100);
            progress2Fill.style.width = `${percent}%`;
            progress2Text.textContent = `${sumTotal - sumCurrent} / ${sumTotal} combos left to check`;
            progress2Detail.textContent = [...activeDescriptions].join(' · ');
        };
        const makeOptimizeProgress = () => {
            const slotId = optimizeProgressSeq++;
            return ({ current, total, description }) => {
                if (current == null || !total) return;
                if (current >= total) {
                    optimizeProgressSlots.delete(slotId);
                } else {
                    optimizeProgressSlots.set(slotId, { current, total, description });
                }
                renderOptimizeProgress();
            };
        };

        try {
            if (this._labyFindMaxMode) {
                const threshold =
                    Math.min(
                        100,
                        Math.max(1, parseInt(this.panel.querySelector('#mwi-labsim-threshold')?.value) || 95)
                    ) / 100;
                const results = await this._runAllMonstersFindMax(
                    {
                        monsters,
                        gameData,
                        baseDTO,
                        zoneHrid,
                        crates,
                        hours,
                        communityBuffs,
                        labyrinthCombatBuffs,
                        threshold,
                        optimizeMode,
                        optimizeBudget,
                    },
                    onProgress,
                    makeOptimizeProgress
                );

                this._labyResults = { mode: 'findmax', results };
                await this._displayAllMobsFindMaxResults(results, simStartTime, gameData);
            } else {
                const results = await this._runAllMonstersSim(
                    {
                        monsters,
                        gameData,
                        baseDTO,
                        zoneHrid,
                        roomLevel,
                        crates,
                        hours,
                        communityBuffs,
                        labyrinthCombatBuffs,
                        optimizeMode,
                        optimizeBudget,
                    },
                    onProgress,
                    makeOptimizeProgress
                );

                this._labyResults = { mode: 'sim', results, roomLevel, hours };
                await this._displayAllMobsSimResults(results, roomLevel, hours, simStartTime, gameData);
            }
        } catch (error) {
            if (error.message !== 'Cancelled') {
                console.error('[LabSimUI] Simulation failed:', error);
                this._setStatus('Simulation failed: ' + error.message);
            }
        } finally {
            this.isRunning = false;
            runBtn.disabled = false;
            runBtn.style.opacity = '1';
            runBtn.style.cursor = 'pointer';
            progressContainer.style.display = 'none';
        }
    }

    /**
     * Look up the loadout name assigned to a monster in the Automation tab
     * (characterSetting.labyrinthLoadout{Monster}), the same lookup _onMonsterChange() uses.
     * @param {string} monsterHrid
     * @returns {string|null}
     * @private
     */
    _getMonsterLoadoutName(monsterHrid) {
        const monsterId = monsterHrid.split('/').pop();
        const pascal = monsterId
            .split('_')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join('');
        const loadoutId = dataManager.characterData?.characterSetting?.[`labyrinthLoadout${pascal}`];
        if (!loadoutId) return null;
        const snapshot = loadoutSnapshot.snapshots[loadoutId];
        return snapshot?.name || null;
    }

    /**
     * Build the loadout-column text describing an optimize attempt's outcome. 'everything' mode
     * already returns a full multi-line, per-stage report (see optimizeLabyrinthEverything), so
     * it's shown as-is rather than wrapped in the generic "+ X" / "(tried: X — no improvement)"
     * phrasing used for the single-stage abilities/equipment modes.
     * @param {string} loadoutName - Base loadout name assigned to the monster
     * @param {string} optimizeMode - 'abilities' | 'equipment' | 'everything'
     * @param {Object} optimized - Result from the optimizer (has .description, .winRate)
     * @param {boolean} improved - Whether optimized.winRate beat the pre-optimize baseline
     * @returns {string}
     * @private
     */
    _formatOptimizedLoadoutName(loadoutName, optimizeMode, optimized, improved) {
        if (optimizeMode === 'everything') {
            return `${loadoutName} ${improved ? '(improved)' : '(no net improvement)'}\n${optimized.description}`;
        }
        return improved
            ? `${loadoutName}\n+ ${optimized.description}`
            : `${loadoutName}\n(tried: ${optimized.description} — no improvement)`;
    }

    /**
     * Resolve the optimizer function for the panel's optimize-mode select.
     * @param {string} optimizeMode - 'abilities' | 'equipment' | 'everything'
     * @returns {Function}
     * @private
     */
    _pickOptimizer(optimizeMode) {
        if (optimizeMode === 'abilities') return optimizeLabyrinthAbilities;
        if (optimizeMode === 'everything') return optimizeLabyrinthEverything;
        return optimizeLabyrinthEquipment;
    }

    /**
     * Build the player DTO to simulate a given monster with: the loadout assigned to it in the
     * Automation tab if one is set, otherwise the currently equipped gear.
     * @param {Object} baseDTO - Player DTO built from live/edited character state
     * @param {Object} gameData
     * @param {string} monsterHrid
     * @returns {{playerDTOs: Object[], loadoutName: string}}
     * @private
     */
    _buildMonsterPlayerDTOs(baseDTO, gameData, monsterHrid) {
        const loadoutName = this._getMonsterLoadoutName(monsterHrid);
        if (!loadoutName) return { playerDTOs: [baseDTO], loadoutName: 'Current Gear' };

        const dto = structuredClone(baseDTO);
        applyLoadoutSnapshotToDTO(dto, loadoutName, gameData);
        return { playerDTOs: [dto], loadoutName };
    }

    /**
     * Run a fixed-level sim for every labyrinth monster against every loadout candidate in
     * parallel across the shared worker pool, keeping the best-performing loadout per monster.
     * @private
     */
    async _runAllMonstersSim(params, onProgress, makeOptimizeProgress) {
        const {
            monsters,
            gameData,
            baseDTO,
            zoneHrid,
            roomLevel,
            crates,
            hours,
            communityBuffs,
            labyrinthCombatBuffs,
            optimizeMode,
            optimizeBudget,
        } = params;
        const total = monsters.length;
        let done = 0;
        const results = new Array(total);
        let cursor = 0;
        const workerCount = Math.max(1, Math.min(getMaxBatchWorkers(), total));

        await Promise.all(
            Array.from({ length: workerCount }, async () => {
                while (cursor < monsters.length) {
                    const index = cursor++;
                    const monster = monsters[index];
                    const { playerDTOs: monsterPlayerDTOs, loadoutName } = this._buildMonsterPlayerDTOs(
                        baseDTO,
                        gameData,
                        monster.hrid
                    );

                    const simResult = await runLabyrinthSimulation({
                        gameData,
                        playerDTOs: monsterPlayerDTOs,
                        zoneHrid,
                        monsterHrid: monster.hrid,
                        roomLevel,
                        crates,
                        hours,
                        communityBuffs,
                        labyrinthCombatBuffs,
                    });

                    const attempts = simResult.labyAttemptCount || 0;
                    const encounters = simResult.encounters || 0;
                    const deaths = simResult.deaths?.player1 || 0;
                    const totalDamageDealt = simResult.totalDamageDealt?.player1 || 0;
                    const winRate = attempts > 0 ? encounters / attempts : 0;

                    let best = { winRate, encounters, attempts, deaths, totalDamageDealt, loadoutName };

                    const shouldOptimize =
                        (optimizeMode === 'abilities' ||
                            optimizeMode === 'equipment' ||
                            optimizeMode === 'everything') &&
                        winRate < OPTIMIZE_SKIP_WIN_RATE;
                    if (optimizeMode !== 'none' && winRate >= OPTIMIZE_SKIP_WIN_RATE) {
                        best = {
                            ...best,
                            loadoutName: `${loadoutName} (already ≥${OPTIMIZE_SKIP_WIN_RATE * 100}%, skipped optimize)`,
                        };
                    }

                    if (shouldOptimize) {
                        if (onProgress) onProgress(done, total, `${monster.name} (optimizing ${optimizeMode})`);
                        const optimizer = this._pickOptimizer(optimizeMode);
                        const optimized = await optimizer(
                            {
                                playerDTOs: monsterPlayerDTOs,
                                playerIndex: 0,
                                gameData,
                                monsterHrid: monster.hrid,
                                roomLevel,
                                crates,
                                hours,
                                communityBuffs,
                                labyrinthCombatBuffs,
                                budget: optimizeBudget,
                            },
                            makeOptimizeProgress?.()
                        );
                        if (optimized) {
                            // Always report what optimization tried, even when it didn't help, so
                            // the user can see it actually ran instead of silently doing nothing.
                            // Falls back to damage dealt / deaths when win rate alone can't tell
                            // two options apart (e.g. neither clears yet) — see
                            // isLabyrinthResultBetter.
                            const improved = isLabyrinthResultBetter(optimized, best);
                            best = improved
                                ? {
                                      winRate: optimized.winRate,
                                      encounters: optimized.encounters,
                                      attempts: optimized.attempts,
                                      deaths: optimized.deaths,
                                      totalDamageDealt: optimized.totalDamageDealt,
                                      loadoutName: this._formatOptimizedLoadoutName(
                                          loadoutName,
                                          optimizeMode,
                                          optimized,
                                          true
                                      ),
                                  }
                                : {
                                      ...best,
                                      loadoutName: this._formatOptimizedLoadoutName(
                                          loadoutName,
                                          optimizeMode,
                                          optimized,
                                          false
                                      ),
                                  };
                        } else {
                            best = {
                                ...best,
                                loadoutName: `${loadoutName} (no ${optimizeMode} optimization candidates found)`,
                            };
                        }
                    }

                    results[index] = {
                        monsterHrid: monster.hrid,
                        monsterName: monster.name,
                        ...best,
                    };
                    done++;
                    if (onProgress) onProgress(done, total, monster.name);
                }
            })
        );

        return results;
    }

    /**
     * Binary-search the max beatable level for every labyrinth monster, each simulated with the
     * loadout assigned to it in the Automation tab.
     * @private
     */
    async _runAllMonstersFindMax(params, onProgress, makeOptimizeProgress) {
        const {
            monsters,
            gameData,
            baseDTO,
            zoneHrid,
            crates,
            hours,
            communityBuffs,
            labyrinthCombatBuffs,
            threshold,
            optimizeMode,
            optimizeBudget,
        } = params;
        const total = monsters.length;
        let done = 0;
        const results = new Array(total);
        let cursor = 0;
        const workerCount = Math.max(1, Math.min(getMaxBatchWorkers(), total));

        await Promise.all(
            Array.from({ length: workerCount }, async () => {
                while (cursor < monsters.length) {
                    const index = cursor++;
                    const monster = monsters[index];
                    const { playerDTOs: monsterPlayerDTOs, loadoutName } = this._buildMonsterPlayerDTOs(
                        baseDTO,
                        gameData,
                        monster.hrid
                    );

                    const maxResult = await findMaxLabyrinthLevel({
                        gameData,
                        playerDTOs: monsterPlayerDTOs,
                        zoneHrid,
                        monsterHrid: monster.hrid,
                        crates,
                        simHours: hours,
                        communityBuffs,
                        labyrinthCombatBuffs,
                        threshold,
                        minLevel: 1,
                    });

                    let best = {
                        maxLevel: maxResult.maxLevel,
                        winRate: maxResult.winRate,
                        steps: maxResult.steps,
                        loadoutName,
                    };

                    if (optimizeMode === 'abilities' || optimizeMode === 'equipment' || optimizeMode === 'everything') {
                        if (onProgress) onProgress(done, total, `${monster.name} (optimizing ${optimizeMode})`);
                        // Rank at the best level found so far, or level 1 if even that failed the
                        // threshold — a 0% mob can still improve, it just needs a valid room level
                        // to sim against for the ranking pass.
                        const optimizer = this._pickOptimizer(optimizeMode);
                        const optimized = await optimizer(
                            {
                                playerDTOs: monsterPlayerDTOs,
                                playerIndex: 0,
                                gameData,
                                monsterHrid: monster.hrid,
                                roomLevel: Math.max(best.maxLevel, 1),
                                crates,
                                hours,
                                communityBuffs,
                                labyrinthCombatBuffs,
                                budget: optimizeBudget,
                            },
                            makeOptimizeProgress?.()
                        );
                        if (optimized) {
                            const modifiedDTO = {
                                ...monsterPlayerDTOs[0],
                                ...(optimized.abilities ? { abilities: optimized.abilities } : {}),
                                ...(optimized.equipment ? { equipment: optimized.equipment } : {}),
                            };
                            const reMax = await findMaxLabyrinthLevel({
                                gameData,
                                playerDTOs: [modifiedDTO],
                                zoneHrid,
                                monsterHrid: monster.hrid,
                                crates,
                                simHours: hours,
                                communityBuffs,
                                labyrinthCombatBuffs,
                                threshold,
                                minLevel: 1,
                            });
                            // When both are stuck at maxLevel 0, still adopt the swap if it raises
                            // the win rate — it's the closest thing to progress to show.
                            const improved =
                                reMax.maxLevel > best.maxLevel ||
                                (reMax.maxLevel === best.maxLevel && reMax.winRate > best.winRate);
                            // Always report what optimization tried, even when it didn't help, so
                            // the user can see it actually ran instead of silently doing nothing.
                            best = improved
                                ? {
                                      maxLevel: reMax.maxLevel,
                                      winRate: reMax.winRate,
                                      steps: reMax.steps,
                                      loadoutName: this._formatOptimizedLoadoutName(
                                          loadoutName,
                                          optimizeMode,
                                          optimized,
                                          true
                                      ),
                                  }
                                : {
                                      ...best,
                                      loadoutName: this._formatOptimizedLoadoutName(
                                          loadoutName,
                                          optimizeMode,
                                          optimized,
                                          false
                                      ),
                                  };
                        } else {
                            best = {
                                ...best,
                                loadoutName: `${loadoutName} (no ${optimizeMode} optimization candidates found)`,
                            };
                        }
                    }

                    results[index] = {
                        monsterHrid: monster.hrid,
                        monsterName: monster.name,
                        ...best,
                    };
                    done++;
                    if (onProgress) onProgress(done, total, monster.name);
                }
            })
        );

        return results;
    }

    /**
     * Escape HTML and turn '\n' into '<br>' so multi-line loadout/optimize descriptions (e.g.
     * from optimizeLabyrinthEverything's per-stage report) render as separate lines instead of
     * one unbroken run-on string in a results table cell.
     * @param {string} text
     * @returns {string}
     * @private
     */
    _formatMultilineCell(text) {
        const div = document.createElement('div');
        div.textContent = text ?? '';
        return div.innerHTML.replace(/\n/g, '<br>');
    }

    /**
     * Build a reverse index of display name → {iconName, type} for every item and ability in
     * gameData. Loadout/optimize description text is built elsewhere as plain names (e.g.
     * "Guardian Aura (Lv8)", "Gator Vest +8 → +10") with no hrid attached, so matching against
     * this index by name is how the results table finds which game icon to splice in.
     * @param {Object} gameData
     * @returns {Map<string, {iconName: string, type: 'items'|'abilities'}>}
     * @private
     */
    _buildIconNameIndex(gameData) {
        const index = new Map();
        for (const [hrid, detail] of Object.entries(gameData.itemDetailMap || {})) {
            if (!detail?.name) continue;
            let iconName;
            if (hrid.startsWith('/ability_books/')) iconName = 'ability_book';
            else if (hrid === '/consumables/coin') iconName = 'coin';
            else iconName = hrid.split('/').pop();
            index.set(detail.name, { hrid, iconName, type: 'items' });
        }
        for (const [hrid, detail] of Object.entries(gameData.abilityDetailMap || {})) {
            if (!detail?.name) continue;
            index.set(detail.name, { hrid, iconName: hrid.split('/').pop(), type: 'abilities' });
        }
        return index;
    }

    /**
     * Build a formatter function for the loadout results column that splices the matching game
     * icon (item or ability sprite) in front of every recognized item/ability name in the text,
     * escapes everything else, and converts '\n' to '<br>'. Falls back to the plain
     * escape-and-linebreak formatter if gameData or the sprite manifest isn't available.
     * @param {Object} gameData
     * @returns {Promise<(text: string) => string>}
     * @private
     */
    async _makeLoadoutCellFormatter(gameData) {
        const plainFormatter = (text) => this._formatMultilineCell(text);
        if (!gameData) return plainFormatter;

        if (this._iconNameIndexGameData !== gameData) {
            this._iconNameIndex = this._buildIconNameIndex(gameData);
            this._iconNameIndexGameData = gameData;
            const names = [...this._iconNameIndex.keys()].sort((a, b) => b.length - a.length);
            this._iconNamePattern = names.length
                ? new RegExp(names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g')
                : null;
        }
        if (!this._iconNamePattern) return plainFormatter;

        const [itemsSpriteUrl, abilitiesSpriteUrl] = await Promise.all([
            assetManifest.getSpriteUrl('items'),
            assetManifest.getSpriteUrl('abilities'),
        ]);
        if (!itemsSpriteUrl && !abilitiesSpriteUrl) return plainFormatter;
        const spriteUrls = { items: itemsSpriteUrl, abilities: abilitiesSpriteUrl };
        this._abilityDetailMapForTooltips = gameData.abilityDetailMap;
        this._itemDetailMapForTooltips = gameData.itemDetailMap;
        this._levelExperienceTableForTooltips = gameData.levelExperienceTable;

        const index = this._iconNameIndex;
        const pattern = this._iconNamePattern;
        const levelSuffixPattern = /^ \(Lv(\d+)\)/;
        const escapeHtml = (s) => {
            const div = document.createElement('div');
            div.textContent = s;
            return div.innerHTML;
        };

        return (text) => {
            if (!text) return '';
            let html = '';
            let lastIndex = 0;
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(text))) {
                html += escapeHtml(text.slice(lastIndex, match.index));
                const info = index.get(match[0]);
                const spriteUrl = info && spriteUrls[info.type];
                if (info?.type === 'abilities' && spriteUrl) {
                    // Abilities render as a clickable "ability square" (icon + level badge +
                    // click-to-pin tooltip) like the game's real ability slots, rather than a
                    // bare icon — the level badge absorbs the following " (LvX)" text so it
                    // isn't shown twice.
                    const levelSuffix = text.slice(pattern.lastIndex).match(levelSuffixPattern);
                    const level = levelSuffix ? levelSuffix[1] : null;
                    if (levelSuffix) pattern.lastIndex += levelSuffix[0].length;
                    // Colors/shape match the game's own ability square (rgb(44,46,69) bg,
                    // 4px radius) — confirmed against the live Abilities panel's
                    // .Ability_ability element.
                    html += buildAbilitySquareHtml(info.hrid, info.iconName, level, spriteUrl);
                } else if (info?.type === 'items' && spriteUrl) {
                    // Items also render as a clickable square (same colors as the ability
                    // square, matching the game's inventory slot look), with its own click menu
                    // offering the subset of the real item menu that makes sense for a read-only
                    // report: View Marketplace, Open Item Dictionary, View Action.
                    // Peek ahead for this item's target enhancement level — either
                    // "ItemName +CUR → +NEW" (enhancement candidates) or "ItemName (+NEW)" (tier/
                    // cross-slot swaps) — so "View Marketplace" opens that exact level's listing
                    // instead of always the +0 market.
                    const trailing = text.slice(pattern.lastIndex, pattern.lastIndex + 40);
                    const enhMatch = trailing.match(/^ \+\d+ → \+(\d+)/) || trailing.match(/^ \(\+(\d+)\)/);
                    const itemLevel = enhMatch ? enhMatch[1] : '0';
                    html += buildItemSquareHtml(info.hrid, info.iconName, itemLevel, spriteUrl);
                } else if (spriteUrl) {
                    const ref = `${spriteUrl}#${info.iconName}`;
                    html += `<svg width="14" height="14" style="flex-shrink:0; vertical-align:-3px; margin-right:2px;"><use href="${ref}" xlink:href="${ref}"></use></svg>`;
                }
                html += escapeHtml(match[0]);
                lastIndex = pattern.lastIndex;
            }
            html += escapeHtml(text.slice(lastIndex));
            return html.replace(/\n/g, '<br>');
        };
    }

    /** @private */
    async _displayAllMobsSimResults(results, roomLevel, hours, simStartTime, gameData) {
        const container = this.panel?.querySelector('#mwi-labsim-results');
        if (!container) return;

        const totalElapsed = formatElapsed((Date.now() - simStartTime) / 1000);
        const sorted = [...results].sort((a, b) => b.winRate - a.winRate);
        const thStyle = 'text-align:right; padding:4px; color:#888; border-bottom:1px solid #333;';
        const thLeftStyle = 'text-align:left; padding:4px; color:#888; border-bottom:1px solid #333;';
        const tdStyle = 'padding:3px 4px; text-align:right;';

        let html = `<div style="color:${ACCENT}; font-weight:700; font-size:13px; margin-bottom:6px;">
            All Labyrinth Mobs — Level ${roomLevel} (${hours}h)
        </div>`;
        html += '<table style="width:100%; border-collapse:collapse; font-size:12px;">';
        html += `<thead><tr>
            <th style="${thLeftStyle}">Monster</th>
            <th style="${thStyle}">Win Rate</th>
            <th style="${thStyle}">Encounters</th>
            <th style="${thStyle}">Deaths</th>
            <th style="${thLeftStyle}">Loadout</th>
        </tr></thead><tbody>`;

        const formatCell = await this._makeLoadoutCellFormatter(gameData);
        for (const r of sorted) {
            const winRatePct = r.winRate * 100;
            const color = winRatePct >= 95 ? '#4caf50' : winRatePct >= 50 ? '#ff9800' : '#f44336';
            html += `<tr style="border-bottom:1px solid #1a1a1a;">
                <td style="padding:3px 4px; color:#e0e0e0;">${r.monsterName}</td>
                <td style="${tdStyle} color:${color}; font-weight:600;">${winRatePct.toFixed(2)}%</td>
                <td style="${tdStyle} color:#ccc;">${formatWithSeparator(r.encounters)}</td>
                <td style="${tdStyle} color:${r.deaths > 0 ? '#f44336' : '#4caf50'};">${formatWithSeparator(r.deaths)}</td>
                <td style="padding:3px 4px; color:#888; font-size:11px; max-width:360px; white-space:normal; word-break:break-word; line-height:1.5;">${formatCell(r.loadoutName)}</td>
            </tr>`;
        }

        html += `</tbody></table><div style="color:#555; font-size:10px; margin-top:6px;">Completed in ${totalElapsed}</div>`;
        container.innerHTML = html;

        this._setStatus(`Simulated ${results.length} labyrinth mobs at level ${roomLevel}.`);
    }

    /** @private */
    async _displayAllMobsFindMaxResults(results, simStartTime, gameData) {
        const container = this.panel?.querySelector('#mwi-labsim-results');
        if (!container) return;

        const totalElapsed = formatElapsed((Date.now() - simStartTime) / 1000);
        const effectiveCombatLevel = labyrinthClearRate.getPlayerEffectiveCombatLevel();
        const sorted = [...results].sort((a, b) => b.maxLevel - a.maxLevel);
        const thStyle = 'text-align:right; padding:4px; color:#888; border-bottom:1px solid #333;';
        const thLeftStyle = 'text-align:left; padding:4px; color:#888; border-bottom:1px solid #333;';
        const tdStyle = 'padding:3px 4px; text-align:right;';

        let html = `<div style="color:${ACCENT}; font-weight:700; font-size:13px; margin-bottom:6px;">
            All Labyrinth Mobs \u2014 Find Max Results
        </div>`;
        html += '<table style="width:100%; border-collapse:collapse; font-size:12px;">';
        html += `<thead><tr>
            <th style="${thLeftStyle}">Monster</th>
            <th style="${thStyle}">Max Level</th>
            <th style="${thStyle}">Win Rate</th>
            <th style="${thStyle}">Skip</th>
            <th style="${thLeftStyle}">Loadout</th>
        </tr></thead><tbody>`;

        const formatCell = await this._makeLoadoutCellFormatter(gameData);
        for (const r of sorted) {
            const recommendedSkip = r.maxLevel - effectiveCombatLevel + 1;
            html += `<tr style="border-bottom:1px solid #1a1a1a;">
                <td style="padding:3px 4px; color:#e0e0e0;">${r.monsterName}</td>
                <td style="${tdStyle} color:#4caf50; font-weight:700;">${r.maxLevel}</td>
                <td style="${tdStyle} color:#ccc;">${(r.winRate * 100).toFixed(1)}%</td>
                <td style="${tdStyle} color:#888;">${recommendedSkip}</td>
                <td style="padding:3px 4px; color:#888; font-size:11px; max-width:360px; white-space:normal; word-break:break-word; line-height:1.5;">${formatCell(r.loadoutName)}</td>
            </tr>`;
        }

        html += `</tbody></table><div style="color:#555; font-size:10px; margin-top:6px;">Completed in ${totalElapsed}</div>`;
        container.innerHTML = html;

        this._setStatus(`Found max levels for ${results.length} labyrinth mobs.`);
    }

    /** @private */
    async _onUpgradeAnalyze() {
        const playerIndex = parseInt(this.panel.querySelector('#mwi-labsim-upgrade-player')?.value) || 0;
        const roomLevel = parseInt(this.panel.querySelector('#mwi-labsim-level')?.value) || 100;
        const monsterHrid = this.panel.querySelector('#mwi-labsim-upgrade-monster')?.value;
        const hours = Math.min(
            10000,
            Math.max(1, parseInt(this.panel.querySelector('#mwi-labsim-hours')?.value) || 10)
        );

        if (!monsterHrid) {
            this._setStatus('Select a monster in the Upgrade tab first.');
            return;
        }

        const crates = this.getSelectedCrates();

        const gameData = buildGameDataPayload();
        if (!gameData) {
            this._setStatus('No game data available.');
            return;
        }

        let playerDTOs;
        const editedDTOs = this._editor?.getEditedDTOs();
        if (editedDTOs) {
            playerDTOs = Object.values(editedDTOs);
        } else {
            const result = await buildAllPlayerDTOs();
            playerDTOs = result.players;
        }

        if (!playerDTOs?.length || !playerDTOs[playerIndex]) {
            this._setStatus('No player data available.');
            return;
        }

        const communityBuffs = getCommunityBuffs();
        const labyrinthCombatBuffs = labyrinthClearRate.getLabyrinthCombatBuffs();

        const progressEl = this.panel.querySelector('#mwi-labsim-upgrade-progress');
        const resultsEl = this.panel.querySelector('#mwi-labsim-upgrade-results');
        const runBtn = this.panel.querySelector('#mwi-labsim-upgrade-run');
        const stopBtn = this.panel.querySelector('#mwi-labsim-upgrade-stop');
        progressEl.style.display = 'block';
        resultsEl.innerHTML = '';
        runBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
        this._upgradeAborted = false;

        try {
            const analysisResult = await runLabyrinthUpgradeAnalysis(
                {
                    playerDTOs,
                    playerIndex,
                    monsterHrid,
                    roomLevel,
                    crates,
                    hours,
                    communityBuffs,
                    labyrinthCombatBuffs,
                    upgradeMode: 'equipment',
                },
                ({ current, total, description }) => {
                    if (this._upgradeAborted) return;
                    const fill = this.panel.querySelector('#mwi-labsim-upgrade-progress-fill');
                    const text = this.panel.querySelector('#mwi-labsim-upgrade-progress-text');
                    if (fill) fill.style.width = `${Math.round((current / total) * 100)}%`;
                    if (text) text.textContent = `${current} / ${total}: ${description}`;
                },
                { abortSignal: () => this._upgradeAborted }
            );

            this._renderUpgradeResults(analysisResult, resultsEl);
        } catch (error) {
            if (error.message !== 'Cancelled' && error.message !== 'Aborted') {
                console.error('[LabSimUI] Upgrade analysis failed:', error);
                this._setStatus('Upgrade analysis failed: ' + error.message);
            }
        } finally {
            progressEl.style.display = 'none';
            runBtn.style.display = '';
            stopBtn.style.display = 'none';
        }
    }

    /** @private */
    _renderUpgradeResults(analysisResult, container) {
        const results = analysisResult?.results;
        if (!results || !results.length) {
            container.innerHTML =
                '<div style="color:#888; font-size:12px; padding:20px 0; text-align:center;">No upgrade candidates found.</div>';
            this._setStatus('No upgrade candidates found.');
            return;
        }

        const tokenResults = results.filter((r) => r.costType === 'token');
        const goldResults = results.filter((r) => r.costType === 'gold');
        const thStyle =
            'text-align:right; padding:4px; color:#888; border-bottom:1px solid #333; cursor:pointer; user-select:none;';
        const thLeftStyle =
            'text-align:left; padding:4px; color:#888; border-bottom:1px solid #333; cursor:pointer; user-select:none;';
        const tdStyle = 'padding:3px 4px; text-align:right;';

        // Pre-compute row data for sorting
        const tokenRows = tokenResults.map((r) => {
            let rateVal, deltaVal, rateStr;

            if (r.metricType === 'clearRate') {
                rateVal = (r.clearRate || 0) * 100;
                deltaVal = (r.clearRateDelta || 0) * 100;
                rateStr = rateVal.toFixed(1) + '%';
            } else if (r.metricType === 'experience') {
                rateVal = 0;
                deltaVal = r.xpDeltaPct || 0;
                rateStr = 'XP';
            } else {
                rateVal = (r.winRate || 0) * 100;
                deltaVal = (r.winRateDelta || 0) * 100;
                rateStr = rateVal.toFixed(2) + '%';
            }

            const deltaColor = deltaVal > 0 ? '#4caf50' : deltaVal < 0 ? '#f44336' : '#888';
            const deltaStr = (deltaVal >= 0 ? '+' : '') + deltaVal.toFixed(2) + '%';

            const tokenCost = r.tokenCost || 0;
            const tokensPerPct = deltaVal > 0 ? Math.round(tokenCost / deltaVal) : Infinity;
            const tokensPerPctStr = deltaVal > 0 ? formatWithSeparator(tokensPerPct) : '\u2014';

            return {
                desc: r.candidate?.description || '',
                tokenCost,
                rateVal,
                rateStr,
                deltaVal,
                deltaStr,
                deltaColor,
                tokensPerPct,
                tokensPerPctStr,
            };
        });

        const goldRows = goldResults.map((r) => {
            const delta = (r.winRateDelta || 0) * 100;
            const deltaColor = delta > 0 ? '#4caf50' : delta < 0 ? '#f44336' : '#888';
            const cost = r.cost || 0;
            const winRate = (r.winRate || 0) * 100;
            const goldPerPct = delta > 0 && cost ? Math.round(cost / delta) : Infinity;

            return {
                desc: r.candidate?.description || '',
                cost,
                costStr: cost ? formatWithSeparator(cost) : '\u2014',
                winRate,
                winRateStr: winRate.toFixed(2) + '%',
                deltaVal: delta,
                deltaStr: (delta >= 0 ? '+' : '') + delta.toFixed(2) + '%',
                deltaColor,
                goldPerPct,
                goldPerPctStr: delta > 0 && cost ? formatWithSeparator(goldPerPct) : '\u2014',
            };
        });

        // Sort state
        const sortState = { token: { key: 'tokensPerPct', dir: 'asc' }, gold: { key: 'goldPerPct', dir: 'asc' } };

        const sortRows = (rows, key, dir) => {
            rows.sort((a, b) => {
                const av = a[key],
                    bv = b[key];
                if (typeof av === 'string') return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
                return dir === 'asc' ? av - bv : bv - av;
            });
        };

        const arrow = (dir) => (dir === 'asc' ? ' \u25B2' : ' \u25BC');

        const renderTokenTable = () => {
            const s = sortState.token;
            const th = (label, key, align) => {
                const style = align === 'left' ? thLeftStyle : thStyle;
                const ind = s.key === key ? arrow(s.dir) : '';
                return `<th data-sort-key="${key}" data-table="token" style="${style}">${label}${ind}</th>`;
            };

            let html = `<div style="color:${ACCENT}; font-weight:700; font-size:12px; margin-bottom:4px;">Token Upgrades</div>`;
            html += '<table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:12px;">';
            html += `<thead><tr>
                ${th('Upgrade', 'desc', 'left')}
                ${th('Tokens', 'tokenCost', 'right')}
                ${th('Rate', 'rateVal', 'right')}
                ${th('Delta', 'deltaVal', 'right')}
                ${th('Tokens/1%', 'tokensPerPct', 'right')}
            </tr></thead><tbody>`;

            for (const row of tokenRows) {
                html += `<tr style="border-bottom:1px solid #1a1a1a;">
                    <td style="padding:3px 4px; color:#e0e0e0;">${row.desc}</td>
                    <td style="${tdStyle} color:#ccc;">${row.tokenCost || '\u2014'}</td>
                    <td style="${tdStyle} color:#ccc;">${row.rateStr}</td>
                    <td style="${tdStyle} color:${row.deltaColor}; font-weight:600;">${row.deltaStr}</td>
                    <td style="${tdStyle} color:#888;">${row.tokensPerPctStr}</td>
                </tr>`;
            }
            html += '</tbody></table>';
            return html;
        };

        const renderGoldTable = () => {
            const s = sortState.gold;
            const th = (label, key, align) => {
                const style = align === 'left' ? thLeftStyle : thStyle;
                const ind = s.key === key ? arrow(s.dir) : '';
                return `<th data-sort-key="${key}" data-table="gold" style="${style}">${label}${ind}</th>`;
            };

            let html = `<div style="color:${ACCENT}; font-weight:700; font-size:12px; margin-bottom:4px;">Gold Upgrades</div>`;
            html += '<table style="width:100%; border-collapse:collapse; font-size:11px;">';
            html += `<thead><tr>
                ${th('Upgrade', 'desc', 'left')}
                ${th('Cost', 'cost', 'right')}
                ${th('Win Rate', 'winRate', 'right')}
                ${th('Delta', 'deltaVal', 'right')}
                ${th('Gold/1%', 'goldPerPct', 'right')}
            </tr></thead><tbody>`;

            for (const row of goldRows) {
                html += `<tr style="border-bottom:1px solid #1a1a1a;">
                    <td style="padding:3px 4px; color:#e0e0e0;">${row.desc}</td>
                    <td style="${tdStyle} color:#ccc;">${row.costStr}</td>
                    <td style="${tdStyle} color:#ccc;">${row.winRateStr}</td>
                    <td style="${tdStyle} color:${row.deltaColor}; font-weight:600;">${row.deltaStr}</td>
                    <td style="${tdStyle} color:#888;">${row.goldPerPctStr}</td>
                </tr>`;
            }
            html += '</tbody></table>';
            return html;
        };

        const renderAll = () => {
            sortRows(tokenRows, sortState.token.key, sortState.token.dir);
            sortRows(goldRows, sortState.gold.key, sortState.gold.dir);
            let html = '';
            if (tokenResults.length > 0) html += renderTokenTable();
            if (goldResults.length > 0) html += renderGoldTable();
            container.innerHTML = html;
        };

        renderAll();

        container.addEventListener('click', (e) => {
            const th = e.target.closest('th[data-sort-key]');
            if (!th) return;
            const table = th.dataset.table;
            const key = th.dataset.sortKey;
            const state = sortState[table];
            if (state.key === key) {
                state.dir = state.dir === 'desc' ? 'asc' : 'desc';
            } else {
                state.key = key;
                state.dir = key === 'desc' ? 'asc' : 'desc';
            }
            renderAll();
        });

        this._setStatus(`${results.length} upgrade candidates analyzed.`);
    }

    /** @private */
    _getSkillingCrates() {
        const crates = [];
        const tea = this.panel?.querySelector('#mwi-labsim-skilling-tea')?.value;
        const coffee = this.panel?.querySelector('#mwi-labsim-skilling-coffee')?.value;
        const food = this.panel?.querySelector('#mwi-labsim-skilling-food')?.value;
        if (tea) crates.push(tea);
        if (coffee) crates.push(coffee);
        if (food) crates.push(food);
        return crates;
    }

    /** @private */
    async _renderSkillLoadoutTable() {
        const container = this.panel?.querySelector('#mwi-labsim-skilling-loadouts');
        if (!container) return;

        const allSnapshots = loadoutSnapshot.getAllSnapshots();
        const nonCombatSnapshots = allSnapshots.filter(
            (s) => s.actionTypeHrid && s.actionTypeHrid !== '/action_types/combat'
        );
        const allSkillsSnapshots = allSnapshots.filter((s) => !s.actionTypeHrid);

        const skills = [
            { hrid: '/skills/woodcutting', label: 'Woodcutting', actionType: '/action_types/woodcutting' },
            { hrid: '/skills/foraging', label: 'Foraging', actionType: '/action_types/foraging' },
            { hrid: '/skills/milking', label: 'Milking', actionType: '/action_types/milking' },
            { hrid: '/skills/cooking', label: 'Cooking', actionType: '/action_types/cooking' },
            { hrid: '/skills/brewing', label: 'Brewing', actionType: '/action_types/brewing' },
            { hrid: '/skills/cheesesmithing', label: 'Cheesesmithing', actionType: '/action_types/cheesesmithing' },
            { hrid: '/skills/crafting', label: 'Crafting', actionType: '/action_types/crafting' },
            { hrid: '/skills/tailoring', label: 'Tailoring', actionType: '/action_types/tailoring' },
            { hrid: '/skills/alchemy', label: 'Alchemy', actionType: '/action_types/alchemy' },
            { hrid: '/skills/enhancing', label: 'Enhancing', actionType: '/action_types/enhancing' },
        ];

        // Load persisted overrides once
        if (!this._skillLoadoutsLoaded) {
            this._skillLoadoutsLoaded = true;
            const persisted = await storage.get('labSimSkillingLoadouts', 'settings', null);
            if (persisted && typeof persisted === 'object') {
                this._skillLoadouts = persisted;
            }
        }

        // Auto-populate from game's lab automation settings for any skill not already set
        if (Object.keys(this._skillLoadouts).length < skills.length) {
            const charSetting = dataManager.characterData?.characterSetting;
            const snapshots = loadoutSnapshot.snapshots || {};
            for (const skill of skills) {
                if (this._skillLoadouts[skill.hrid]) continue;
                const skillId = skill.hrid.replace('/skills/', '');
                const pascal = skillId.charAt(0).toUpperCase() + skillId.slice(1);
                const loadoutId = charSetting?.[`labyrinthLoadout${pascal}`];
                if (loadoutId && snapshots[loadoutId]?.name) {
                    this._skillLoadouts[skill.hrid] = snapshots[loadoutId].name;
                } else {
                    const match = nonCombatSnapshots.find((s) => s.actionTypeHrid === skill.actionType);
                    if (match) {
                        this._skillLoadouts[skill.hrid] = match.name;
                    } else if (allSkillsSnapshots.length > 0) {
                        this._skillLoadouts[skill.hrid] = allSkillsSnapshots[0].name;
                    }
                }
            }
        }

        const selectStyle =
            'background:#1a1a2e; color:#e0e0e0; border:1px solid #444; border-radius:3px; padding:1px 4px; font-size:11px; width:100%;';

        const targetSkill = this.panel.querySelector('#mwi-labsim-skilling-filter')?.value || '';
        const visibleSkills = targetSkill ? skills.filter((s) => s.hrid === targetSkill) : skills;
        const collapsed = this._loadoutsCollapsed || false;

        const arrow = collapsed ? '&#9654;' : '&#9660;';
        let html = `<div id="mwi-labsim-loadout-toggle" style="color:${ACCENT}; font-weight:700; font-size:12px; margin-bottom:4px; cursor:pointer; user-select:none;">
            <span style="display:inline-block; width:14px; font-size:10px;">${arrow}</span> Skill Loadouts
        </div>`;
        html += `<div id="mwi-labsim-loadout-grid" style="display:${collapsed ? 'none' : 'grid'}; grid-template-columns:1fr 1fr; gap:3px 10px;">`;

        for (const skill of visibleSkills) {
            const current = this._skillLoadouts[skill.hrid] || '';
            html += `<div style="display:flex; align-items:center; gap:4px; font-size:11px;">`;
            html += `<span style="color:#888; width:85px; flex-shrink:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${skill.label}">${skill.label}</span>`;
            html += `<select data-skill-loadout="${skill.hrid}" style="${selectStyle}">`;
            html += `<option value=""${!current ? ' selected' : ''}>Current Gear</option>`;
            for (const snap of [...nonCombatSnapshots, ...allSkillsSnapshots]) {
                const label = snap.name + (snap.actionTypeHrid ? '' : ' (All)');
                const selected = current === snap.name ? ' selected' : '';
                html += `<option value="${snap.name}"${selected}>${label}</option>`;
            }
            html += '</select></div>';
        }

        html += '</div>';
        container.innerHTML = html;

        container.querySelectorAll('[data-skill-loadout]').forEach((select) => {
            select.addEventListener('change', () => {
                const skillHrid = select.dataset.skillLoadout;
                this._skillLoadouts[skillHrid] = select.value;
                storage.set('labSimSkillingLoadouts', this._skillLoadouts, 'settings');
            });
        });

        container.querySelector('#mwi-labsim-loadout-toggle')?.addEventListener('click', () => {
            this._loadoutsCollapsed = !this._loadoutsCollapsed;
            this._renderSkillLoadoutTable();
        });
    }

    /**
     * Build per-skill equipment map from loadout assignments.
     * @param {Object} gameData
     * @returns {Object} { '/skills/woodcutting': { '/equipment_types/...': { hrid, enhancementLevel } }, ... }
     */
    _buildSkillEquipmentMap(gameData) {
        const itemDetailMap = gameData?.itemDetailMap || {};
        const liveEquipment = dataManager.characterEquipment;
        const allSnapshots = loadoutSnapshot.getAllSnapshots();
        const equipmentMap = {};

        for (const [skillHrid, loadoutName] of Object.entries(this._skillLoadouts)) {
            if (!loadoutName) continue;
            const snapshot = allSnapshots.find((s) => s.name === loadoutName);
            if (!snapshot?.equipment?.length) continue;

            const equipment = {};
            for (const equip of snapshot.equipment) {
                const itemDetail = itemDetailMap[equip.itemHrid];
                const equipType = itemDetail?.equipmentDetail?.type;
                if (!equipType) continue;
                let enhancementLevel = equip.enhancementLevel || 0;
                if (enhancementLevel === 0 && liveEquipment) {
                    for (const [, liveItem] of liveEquipment) {
                        if (liveItem.itemHrid === equip.itemHrid) {
                            enhancementLevel = liveItem.enhancementLevel || 0;
                            break;
                        }
                    }
                }
                equipment[equipType] = { hrid: equip.itemHrid, enhancementLevel };
            }
            equipmentMap[skillHrid] = equipment;
        }

        return equipmentMap;
    }

    /** @private */
    _onSkillingCalculate() {
        const roomLevel = parseInt(this.panel.querySelector('#mwi-labsim-skilling-level')?.value) || 100;
        const gameData = buildGameDataPayload();
        if (!gameData) {
            this._setStatus('No game data available.');
            return;
        }

        const editedDTOs = this._skillingEditor?.getEditedDTOs();
        if (!editedDTOs) {
            this._setStatus('No character data. Wait for editor to load.');
            return;
        }

        const selfHrid = this._skillingEditor.getSelfHrid();
        const dto = editedDTOs[selfHrid] || Object.values(editedDTOs)[0];
        if (!dto) {
            this._setStatus('No player data available.');
            return;
        }

        const crateHrids = this._getSkillingCrates();
        const skillEquipmentMap = this._buildSkillEquipmentMap(gameData);
        const results = computeSkillingClearRatesFromEditor(roomLevel, dto, crateHrids, gameData, skillEquipmentMap);
        this._renderSkillingClearResults(results, roomLevel);
    }

    /** @private */
    _renderSkillingClearResults(results, roomLevel) {
        const container = this.panel?.querySelector('#mwi-labsim-skilling-results');
        if (!container) return;

        const avgClearRate = results.reduce((s, r) => s + (r.clearChance || 0), 0) / results.length;

        const thStyle = 'text-align:right; padding:4px; color:#888; border-bottom:1px solid #333; font-size:10px;';
        const thLeftStyle = 'text-align:left; padding:4px; color:#888; border-bottom:1px solid #333; font-size:10px;';
        const tdStyle = 'padding:3px 4px; text-align:right; font-size:11px;';

        let html = `<div style="color:${ACCENT}; font-weight:700; font-size:13px; margin-bottom:6px;">
            Skilling Room Level ${roomLevel}
            <span style="color:#888; font-weight:400; font-size:11px; margin-left:8px;">
                Avg Clear: <span style="color:${avgClearRate >= 0.95 ? '#4caf50' : avgClearRate >= 0.5 ? '#ff9800' : '#f44336'}; font-weight:600;">${(avgClearRate * 100).toFixed(1)}%</span>
            </span>
        </div>`;

        html += '<table style="width:100%; border-collapse:collapse; font-size:11px;">';
        html += `<thead><tr>
            <th style="${thLeftStyle}">Skill</th>
            <th style="${thStyle}">Level</th>
            <th style="${thStyle}">Eff. Lvl</th>
            <th style="${thStyle}">Success</th>
            <th style="${thStyle}">Clear</th>
            <th style="${thStyle}">Actions</th>
        </tr></thead><tbody>`;

        for (const r of results) {
            const clearColor = r.clearChance >= 0.95 ? '#4caf50' : r.clearChance >= 0.5 ? '#ff9800' : '#f44336';
            const successPct = ((r.successChance || 0) * 100).toFixed(1);
            const clearPct = ((r.clearChance || 0) * 100).toFixed(1);

            html += `<tr style="border-bottom:1px solid #1a1a1a;">
                <td style="padding:3px 4px; color:#e0e0e0;">${r.skillName}</td>
                <td style="${tdStyle} color:#ccc;">${r.baseLevel}</td>
                <td style="${tdStyle} color:#ccc;">${r.effectiveLevel}</td>
                <td style="${tdStyle} color:#ccc;">${successPct}%</td>
                <td style="${tdStyle} color:${clearColor}; font-weight:600;">${clearPct}%</td>
                <td style="${tdStyle} color:#888;">${r.attempts || 0}</td>
            </tr>`;
        }

        html += '</tbody></table>';
        container.innerHTML = html;
        this._setStatus(`Skilling clear rates calculated for level ${roomLevel}.`);
    }

    /** @private */
    async _onSkillingUpgradeAnalyze() {
        const roomLevel = parseInt(this.panel.querySelector('#mwi-labsim-skilling-level')?.value) || 100;
        const gameData = buildGameDataPayload();
        if (!gameData) {
            this._setStatus('No game data available.');
            return;
        }

        const editedDTOs = this._skillingEditor?.getEditedDTOs();
        if (!editedDTOs) {
            this._setStatus('No character data. Wait for editor to load.');
            return;
        }

        const selfHrid = this._skillingEditor.getSelfHrid();
        const dto = editedDTOs[selfHrid] || Object.values(editedDTOs)[0];
        if (!dto) {
            this._setStatus('No player data available.');
            return;
        }

        const crateHrids = this._getSkillingCrates();
        const skillEquipmentMap = this._buildSkillEquipmentMap(gameData);
        const targetSkill = this.panel.querySelector('#mwi-labsim-skilling-filter')?.value || null;

        const progressEl = this.panel.querySelector('#mwi-labsim-skilling-progress');
        const resultsEl = this.panel.querySelector('#mwi-labsim-skilling-results');
        const calcBtn = this.panel.querySelector('#mwi-labsim-skilling-calc');
        const upgradeBtn = this.panel.querySelector('#mwi-labsim-skilling-upgrade');
        const stopBtn = this.panel.querySelector('#mwi-labsim-skilling-stop');
        progressEl.style.display = 'block';
        resultsEl.innerHTML = '';
        calcBtn.style.display = 'none';
        upgradeBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
        this._skillingAborted = false;

        try {
            const analysisResult = runSkillingUpgradeAnalysis(
                { editorDTO: dto, roomLevel, crateHrids, skillEquipmentMap, targetSkill },
                ({ current, total, description }) => {
                    if (this._skillingAborted) return;
                    const fill = this.panel.querySelector('#mwi-labsim-skilling-progress-fill');
                    const text = this.panel.querySelector('#mwi-labsim-skilling-progress-text');
                    if (fill) fill.style.width = `${Math.round((current / total) * 100)}%`;
                    if (text) text.textContent = `${current} / ${total}: ${description}`;
                },
                { abortSignal: () => this._skillingAborted }
            );

            this._renderSkillingUpgradeResults(analysisResult, resultsEl);
        } catch (error) {
            console.error('[LabSimUI] Skilling upgrade analysis failed:', error);
            this._setStatus('Skilling upgrade analysis failed: ' + error.message);
        } finally {
            progressEl.style.display = 'none';
            calcBtn.style.display = '';
            upgradeBtn.style.display = '';
            stopBtn.style.display = 'none';
        }
    }

    /** @private */
    _renderSkillingUpgradeResults(analysisResult, container) {
        const results = analysisResult?.results;
        if (!results || !results.length) {
            container.innerHTML =
                '<div style="color:#888; font-size:12px; padding:20px 0; text-align:center;">No upgrade candidates found.</div>';
            this._setStatus('No skilling upgrade candidates found.');
            return;
        }

        const baseline = analysisResult.baseline;
        const tokenResults = results.filter((r) => r.costType === 'token');
        const goldResults = results.filter((r) => r.costType === 'gold');
        const thStyle =
            'text-align:right; padding:4px; color:#888; border-bottom:1px solid #333; cursor:pointer; user-select:none;';
        const thLeftStyle =
            'text-align:left; padding:4px; color:#888; border-bottom:1px solid #333; cursor:pointer; user-select:none;';
        const tdStyle = 'padding:3px 4px; text-align:right;';

        const tokenRows = tokenResults.map((r) => {
            const clearRate = (r.clearRate || 0) * 100;
            const deltaVal = (r.clearRateDelta || 0) * 100;
            const deltaColor = deltaVal > 0 ? '#4caf50' : deltaVal < 0 ? '#f44336' : '#888';
            const tokenCost = r.tokenCost || 0;
            const tokensPerPct = deltaVal > 0 ? Math.round(tokenCost / deltaVal) : Infinity;

            return {
                desc: r.candidate?.description || '',
                tokenCost,
                clearRate,
                clearRateStr: clearRate.toFixed(1) + '%',
                deltaVal,
                deltaStr: (deltaVal >= 0 ? '+' : '') + deltaVal.toFixed(2) + '%',
                deltaColor,
                tokensPerPct,
                tokensPerPctStr: deltaVal > 0 ? formatWithSeparator(tokensPerPct) : '\u2014',
            };
        });

        const goldRows = goldResults.map((r) => {
            const clearRate = (r.clearRate || 0) * 100;
            const deltaVal = (r.clearRateDelta || 0) * 100;
            const deltaColor = deltaVal > 0 ? '#4caf50' : deltaVal < 0 ? '#f44336' : '#888';
            const cost = r.cost || 0;
            const goldPerPct = deltaVal > 0 && cost ? Math.round(cost / deltaVal) : Infinity;

            return {
                desc: r.candidate?.description || '',
                cost,
                costStr: cost ? formatWithSeparator(cost) : '\u2014',
                clearRate,
                clearRateStr: clearRate.toFixed(1) + '%',
                deltaVal,
                deltaStr: (deltaVal >= 0 ? '+' : '') + deltaVal.toFixed(2) + '%',
                deltaColor,
                goldPerPct,
                goldPerPctStr: deltaVal > 0 && cost ? formatWithSeparator(goldPerPct) : '\u2014',
            };
        });

        const sortState = { token: { key: 'tokensPerPct', dir: 'asc' }, gold: { key: 'goldPerPct', dir: 'asc' } };

        const sortRows = (rows, key, dir) => {
            rows.sort((a, b) => {
                const av = a[key],
                    bv = b[key];
                if (typeof av === 'string') return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
                return dir === 'asc' ? av - bv : bv - av;
            });
        };

        const arrow = (dir) => (dir === 'asc' ? ' \u25B2' : ' \u25BC');

        const renderTokenTable = () => {
            const s = sortState.token;
            const th = (label, key, align) => {
                const style = align === 'left' ? thLeftStyle : thStyle;
                const ind = s.key === key ? arrow(s.dir) : '';
                return `<th data-sort-key="${key}" data-table="token" style="${style}">${label}${ind}</th>`;
            };

            let html = `<div style="color:${ACCENT}; font-weight:700; font-size:12px; margin-bottom:4px;">Token Upgrades</div>`;
            html += '<table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:12px;">';
            html += `<thead><tr>
                ${th('Upgrade', 'desc', 'left')}
                ${th('Tokens', 'tokenCost', 'right')}
                ${th('Clear Rate', 'clearRate', 'right')}
                ${th('Delta', 'deltaVal', 'right')}
                ${th('Tokens/1%', 'tokensPerPct', 'right')}
            </tr></thead><tbody>`;

            for (const row of tokenRows) {
                html += `<tr style="border-bottom:1px solid #1a1a1a;">
                    <td style="padding:3px 4px; color:#e0e0e0;">${row.desc}</td>
                    <td style="${tdStyle} color:#ccc;">${row.tokenCost || '\u2014'}</td>
                    <td style="${tdStyle} color:#ccc;">${row.clearRateStr}</td>
                    <td style="${tdStyle} color:${row.deltaColor}; font-weight:600;">${row.deltaStr}</td>
                    <td style="${tdStyle} color:#888;">${row.tokensPerPctStr}</td>
                </tr>`;
            }
            html += '</tbody></table>';
            return html;
        };

        const renderGoldTable = () => {
            const s = sortState.gold;
            const th = (label, key, align) => {
                const style = align === 'left' ? thLeftStyle : thStyle;
                const ind = s.key === key ? arrow(s.dir) : '';
                return `<th data-sort-key="${key}" data-table="gold" style="${style}">${label}${ind}</th>`;
            };

            let html = `<div style="color:${ACCENT}; font-weight:700; font-size:12px; margin-bottom:4px;">Equipment Upgrades</div>`;
            html += '<table style="width:100%; border-collapse:collapse; font-size:11px;">';
            html += `<thead><tr>
                ${th('Upgrade', 'desc', 'left')}
                ${th('Cost', 'cost', 'right')}
                ${th('Clear Rate', 'clearRate', 'right')}
                ${th('Delta', 'deltaVal', 'right')}
                ${th('Gold/1%', 'goldPerPct', 'right')}
            </tr></thead><tbody>`;

            for (const row of goldRows) {
                html += `<tr style="border-bottom:1px solid #1a1a1a;">
                    <td style="padding:3px 4px; color:#e0e0e0;">${row.desc}</td>
                    <td style="${tdStyle} color:#ccc;">${row.costStr}</td>
                    <td style="${tdStyle} color:#ccc;">${row.clearRateStr}</td>
                    <td style="${tdStyle} color:${row.deltaColor}; font-weight:600;">${row.deltaStr}</td>
                    <td style="${tdStyle} color:#888;">${row.goldPerPctStr}</td>
                </tr>`;
            }
            html += '</tbody></table>';
            return html;
        };

        const renderAll = () => {
            sortRows(tokenRows, sortState.token.key, sortState.token.dir);
            sortRows(goldRows, sortState.gold.key, sortState.gold.dir);
            let html = `<div style="color:#888; font-size:11px; margin-bottom:8px;">
                Baseline Avg Clear: <span style="color:#e0e0e0; font-weight:600;">${((baseline?.clearRate || 0) * 100).toFixed(1)}%</span>
            </div>`;
            if (tokenRows.length > 0) html += renderTokenTable();
            if (goldRows.length > 0) html += renderGoldTable();
            container.innerHTML = html;
        };

        renderAll();

        container.addEventListener('click', (e) => {
            const th = e.target.closest('th[data-sort-key]');
            if (!th) return;
            const table = th.dataset.table;
            const key = th.dataset.sortKey;
            const state = sortState[table];
            if (state.key === key) {
                state.dir = state.dir === 'desc' ? 'asc' : 'desc';
            } else {
                state.key = key;
                state.dir = key === 'desc' ? 'asc' : 'desc';
            }
            renderAll();
        });

        this._setStatus(`${results.length} skilling upgrade candidates analyzed.`);
    }

    toggle() {
        if (!this.panel) return;
        const visible = this.panel.style.display !== 'none';
        this.panel.style.display = visible ? 'none' : 'flex';
        if (!visible) {
            bringPanelToFront(this.panel);
            this._populateMonsters();
            if (!this._editor.isInitialized()) {
                this._editor.initEditor();
            }
        }
    }

    destroy() {
        if (this.elapsedTimer) {
            clearInterval(this.elapsedTimer);
            this.elapsedTimer = null;
        }
        if (this._resultSquareCleanup) {
            this._resultSquareCleanup();
            this._resultSquareCleanup = null;
        }
        if (this.panel) {
            unregisterFloatingPanel(this.panel);
            this.panel.remove();
            this.panel = null;
        }
        this.isRunning = false;
        if (this._editor) this._editor.reset();
        if (this._skillingEditor) this._skillingEditor.reset();
        this._maxLevel = null;
        this._labyResults = null;
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

    /** @private */
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
}

const labSimUI = new LabSimUI();
export default labSimUI;

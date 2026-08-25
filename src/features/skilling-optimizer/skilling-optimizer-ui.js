/**
 * Skilling Simulator UI
 * Injects a "Optimizer" tab next to Loadouts in the character panel.
 * Lets the user configure equipment + teas (optionally loading from a saved loadout),
 * pick which actions to include, and simulate XP/hr + Gold/hr.
 */

import config from '../../core/config.js';
import { createMutationWatcher } from '../../utils/dom-observer-helpers.js';
import {
    calculateSkillPerformance,
    getSkillActionsForDisplay,
    getItemsForSlot,
    getSkillDrinkItems,
    getPlayerSkillLevel,
    optimizeSkill,
    findOptimalTeas,
    SKILL_NAMES,
    SKILLING_LOCATIONS,
    SLOT_DISPLAY_NAMES,
    SKILL_TOOL_LOCATION,
} from './skilling-optimizer-engine.js';
import { formatKMB } from '../../utils/formatters.js';
import { buildEnhancementLevelMap } from '../../utils/loadout-scraper.js';
import loadoutSnapshotLocal from '../combat/loadout-snapshot.js';

function getLoadoutSnapshot() {
    return window.Cheezasha?.Combat?.loadoutSnapshot || loadoutSnapshotLocal;
}

/**
 * Parse a gold shorthand string (e.g. "63M", "500k", "1.2b") into a number. A bare number with no
 * suffix is assumed to be in millions (e.g. "100" → 100M, "1" → 1M) since that's the scale gold
 * budgets are usually discussed in.
 * @param {string} str
 * @returns {number} Parsed value, or NaN if unparseable
 */
function parseKMB(str) {
    const match = str
        .trim()
        .toLowerCase()
        .match(/^(\d+\.?\d*)\s*([kmb]?)$/);
    if (!match) return NaN;
    const multipliers = { k: 1e3, m: 1e6, b: 1e9 };
    return parseFloat(match[1]) * (multipliers[match[2]] || 1e6);
}

const TAB_CLASS = 'cheezasha-skilling-opt-tab';
const PANEL_CLASS = 'cheezasha-skilling-opt-panel';
const HIDE_CLASS = 'cheezasha-opt-hide-content';

const STYLE_EL = document.createElement('style');
STYLE_EL.textContent = `.${HIDE_CLASS} [class*="TabsComponent_tabPanelsContainer"] { display: none !important; }`;

// Columns for the sortable results table. 'type' controls both alignment and comparator.
const RESULT_TABLE_COLUMNS = [
    { key: 'slotName', label: 'Slot', type: 'string' },
    { key: 'itemName', label: 'Item', type: 'string' },
    { key: 'cost', label: 'Cost', type: 'number' },
    { key: 'costPer1Pct', label: 'Cost/1%', type: 'number' },
    { key: 'paybackHours', label: 'Payback', type: 'number' },
    { key: 'xpGain', label: 'ΔXP/hr', type: 'number' },
    { key: 'goldGain', label: 'ΔGold/hr', type: 'number' },
];

class SkillingSimulatorUI {
    constructor() {
        this.tabBtn = null;
        this.panel = null;
        this.isActive = false;
        this.watcher = null;
        this.contentParent = null;

        // Mode
        this.currentMode = 'simulator'; // 'simulator' | 'optimizer'
        this.lastOptimizerResult = null;
        this.optimizerLoadoutName = null;
        this._resultRows = []; // Flattened rows for the results table (cached for re-sorting)
        this._resultsSortKey = null;
        this._resultsSortDir = 'asc';
        this.budget = null; // null = no cap, otherwise max gold cost/slot to show as viable

        // Simulator state
        this.currentSkill = 'Woodcutting';
        this.currentLevel = 1;
        this.equipment = new Map(); // locationHrid → { itemHrid, enhancementLevel }
        this.teas = [null, null, null];
        this.selectedActionHrids = null; // null = all available

        // UI element refs (updated in place without rebuilding panel)
        this._slotBtns = new Map(); // locationHrid → { nameBtn, enhInput, clearBtn }
        this._teaBtns = []; // [{ nameBtn, clearBtn }, ...]
        this._actionBtn = null;
        this._actionBtnGetLabel = null;
        this._resultsArea = null;
        this._picker = null;
        this._pickerCleanup = null;
    }

    initialize() {
        this.currentLevel = getPlayerSkillLevel(this.currentSkill);
        this.watcher = createMutationWatcher(document.body, () => this._tryInjectTabButton(), {
            childList: true,
            subtree: true,
        });
        this._tryInjectTabButton();
    }

    // -------------------------------------------------------------------------
    // Tab injection
    // -------------------------------------------------------------------------

    _findTabList() {
        for (const tl of document.querySelectorAll('[role="tablist"]')) {
            for (const tab of tl.querySelectorAll('[role="tab"]')) {
                if (tab.textContent.trim().startsWith('Loadouts')) return tl;
            }
        }
        return null;
    }

    _tryInjectTabButton() {
        const tabList = this._findTabList();
        if (!tabList) return;
        if (tabList.querySelector(`.${TAB_CLASS}`)) return;

        const existingTab = tabList.querySelector('[role="tab"]');
        const btn = document.createElement('button');
        btn.className = `${TAB_CLASS} ${existingTab ? existingTab.className.replace(/Mui-selected/g, '').trim() : ''}`;
        btn.setAttribute('role', 'tab');
        btn.setAttribute('type', 'button');
        btn.textContent = 'Optimizer';
        btn.style.minWidth = 'auto';
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._activatePanel();
        });

        const loadoutsTab = [...tabList.querySelectorAll('[role="tab"]')].find((t) =>
            t.textContent.trim().startsWith('Loadouts')
        );
        if (loadoutsTab?.nextSibling) tabList.insertBefore(btn, loadoutsTab.nextSibling);
        else tabList.appendChild(btn);
        this.tabBtn = btn;

        const scroller = tabList.parentElement;
        if (scroller?.className?.includes('MuiTabs-scroller')) scroller.style.overflow = 'auto';

        for (const tab of tabList.querySelectorAll(`[role="tab"]:not(.${TAB_CLASS})`)) {
            tab.addEventListener('click', (e) => this._deactivatePanel(e.currentTarget));
        }

        if (this.isActive) this._activatePanel();
    }

    _findContentContainer() {
        const tabList = this._findTabList();
        if (!tabList) return null;
        return tabList.closest('[class*="TabsComponent_tabsContainer"]')?.nextElementSibling || null;
    }

    // -------------------------------------------------------------------------
    // Activation
    // -------------------------------------------------------------------------

    _activatePanel() {
        this.isActive = true;

        if (this.tabBtn) {
            this.tabBtn.classList.add('Mui-selected');
            this.tabBtn.setAttribute('aria-selected', 'true');
        }

        const tabList = this.tabBtn?.parentElement;
        if (tabList) {
            for (const tab of tabList.querySelectorAll(`[role="tab"]:not(.${TAB_CLASS})`)) {
                tab.classList.remove('Mui-selected');
                tab.setAttribute('aria-selected', 'false');
            }
        }

        const contentContainer = this._findContentContainer();
        if (contentContainer?.parentElement) {
            this.contentParent = contentContainer.parentElement;
            this.contentParent.classList.add(HIDE_CLASS);
        }

        this.panel?.remove();
        this._picker?.remove();
        this._picker = null;

        if (contentContainer) {
            this.panel = this._buildPanel();
            contentContainer.parentElement?.insertBefore(this.panel, contentContainer.nextSibling);
        }
    }

    _rebuildPanel() {
        const contentContainer = this._findContentContainer();
        if (!contentContainer) return;
        this._closePicker();
        this.panel?.remove();
        this.panel = this._buildPanel();
        contentContainer.parentElement?.insertBefore(this.panel, contentContainer.nextSibling);
    }

    _deactivatePanel(clickedTab = null) {
        this.isActive = false;
        this._closePicker();
        this.panel?.remove();
        this.panel = null;
        this.contentParent?.classList.remove(HIDE_CLASS);
        this.contentParent = null;
        if (this.tabBtn) {
            this.tabBtn.classList.remove('Mui-selected');
            this.tabBtn.setAttribute('aria-selected', 'false');
        }
        if (clickedTab) {
            clickedTab.classList.add('Mui-selected');
            clickedTab.setAttribute('aria-selected', 'true');
        }
    }

    // -------------------------------------------------------------------------
    // Panel construction
    // -------------------------------------------------------------------------

    _buildPanel() {
        if (!STYLE_EL.isConnected) document.head.appendChild(STYLE_EL);
        this._slotBtns.clear();
        this._teaBtns = [];

        const panel = document.createElement('div');
        panel.className = PANEL_CLASS;
        panel.style.cssText = `
            padding: 12px;
            color: rgba(255,255,255,0.85);
            font-size: 13px;
            overflow-y: auto;
            flex: 1;
            min-height: 0;
            box-sizing: border-box;
        `;

        panel.addEventListener('click', (e) => {
            if (this._picker && !this._picker.contains(e.target)) this._closePicker();
        });

        // Mode selector
        const modeRow = document.createElement('div');
        modeRow.style.cssText = 'display: flex; gap: 6px; margin-bottom: 14px;';

        for (const [mode, label] of [
            ['simulator', 'Simulator'],
            ['optimizer', 'Optimizer'],
        ]) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = label;
            const active = this.currentMode === mode;
            btn.style.cssText = `
                padding: 4px 14px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;
                border: 1px solid ${active ? config.COLOR_ACCENT : 'rgba(255,255,255,0.2)'};
                background: ${active ? config.COLOR_ACCENT + '22' : 'transparent'};
                color: ${active ? config.COLOR_ACCENT : 'rgba(255,255,255,0.5)'};
            `;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.currentMode !== mode) {
                    this.currentMode = mode;
                    this._rebuildPanel();
                }
            });
            modeRow.appendChild(btn);
        }
        panel.appendChild(modeRow);

        panel.appendChild(this._buildTopControls());

        if (this.currentMode === 'simulator') {
            panel.appendChild(this._buildEquipmentSection());
            panel.appendChild(this._buildTeasSection());

            const simulateBtn = document.createElement('button');
            simulateBtn.type = 'button';
            simulateBtn.textContent = 'Simulate';
            simulateBtn.style.cssText = `
                margin-top: 12px; padding: 6px 20px;
                background: ${config.COLOR_ACCENT}; color: #000;
                border: none; border-radius: 4px;
                font-size: 12px; font-weight: 700; cursor: pointer;
            `;
            simulateBtn.addEventListener('click', () => {
                simulateBtn.textContent = 'Simulating…';
                simulateBtn.disabled = true;
                requestAnimationFrame(() =>
                    setTimeout(() => {
                        this._runSimulation();
                        simulateBtn.textContent = 'Simulate';
                        simulateBtn.disabled = false;
                    }, 0)
                );
            });
            panel.appendChild(simulateBtn);

            const resultsArea = document.createElement('div');
            resultsArea.style.marginTop = '16px';
            panel.appendChild(resultsArea);
            this._resultsArea = resultsArea;
        } else {
            // Loadout comparison selector
            const compareRow = document.createElement('div');
            compareRow.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px;';
            const compareLabel = document.createElement('span');
            compareLabel.textContent = 'Compare:';
            compareLabel.style.cssText = 'color: rgba(255,255,255,0.5); font-size: 12px; width: 56px; flex-shrink: 0;';
            const compareSelect = document.createElement('select');
            compareSelect.style.cssText =
                'background: #2a2a2a; color: #fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 4px 8px; font-size: 12px; flex: 1; cursor: pointer;';
            const noneOpt = document.createElement('option');
            noneOpt.value = '';
            noneOpt.textContent = '— None —';
            compareSelect.appendChild(noneOpt);
            for (const snap of getLoadoutSnapshot().getAllSnapshots()) {
                const opt = document.createElement('option');
                opt.value = snap.name;
                opt.textContent = snap.name + (snap.isDefault ? ' ★' : '');
                if (this.optimizerLoadoutName === snap.name) opt.selected = true;
                compareSelect.appendChild(opt);
            }
            compareSelect.addEventListener('change', () => {
                this.optimizerLoadoutName = compareSelect.value || null;
            });
            compareRow.appendChild(compareLabel);
            compareRow.appendChild(compareSelect);

            // Budget filter
            const budgetLabel = document.createElement('span');
            budgetLabel.textContent = 'Budget:';
            budgetLabel.style.cssText =
                'color: rgba(255,255,255,0.5); font-size: 12px; width: 48px; flex-shrink: 0; text-align: right;';
            const budgetInput = document.createElement('input');
            budgetInput.type = 'text';
            budgetInput.placeholder = 'e.g. 63 = 63M';
            budgetInput.value = this.budget != null ? formatKMB(this.budget) : '';
            budgetInput.style.cssText =
                'width: 80px; background: #2a2a2a; color: #fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 4px 8px; font-size: 12px;';
            budgetInput.addEventListener('change', () => {
                const raw = budgetInput.value.trim();
                if (!raw) {
                    this.budget = null;
                    budgetInput.style.borderColor = 'rgba(255,255,255,0.2)';
                    return;
                }
                const value = parseKMB(raw);
                if (isNaN(value) || value <= 0) {
                    budgetInput.style.borderColor = '#c0392b';
                    return;
                }
                this.budget = value;
                budgetInput.style.borderColor = 'rgba(255,255,255,0.2)';
            });
            compareRow.appendChild(budgetLabel);
            compareRow.appendChild(budgetInput);
            panel.appendChild(compareRow);

            const optimizeBtn = document.createElement('button');
            optimizeBtn.type = 'button';
            optimizeBtn.textContent = 'Optimize';
            optimizeBtn.style.cssText = `
                padding: 6px 20px;
                background: ${config.COLOR_ACCENT}; color: #000;
                border: none; border-radius: 4px;
                font-size: 12px; font-weight: 700; cursor: pointer;
            `;

            const progressWrap = document.createElement('div');
            progressWrap.style.cssText = 'display: none; align-items: center; gap: 8px; margin-top: 10px;';
            const progressTrack = document.createElement('div');
            progressTrack.style.cssText =
                'flex: 1; height: 6px; border-radius: 3px; background: rgba(255,255,255,0.1); overflow: hidden;';
            const progressFill = document.createElement('div');
            progressFill.style.cssText = `height: 100%; width: 0%; background: ${config.COLOR_ACCENT}; transition: width 0.15s ease;`;
            progressTrack.appendChild(progressFill);
            const progressLabel = document.createElement('span');
            progressLabel.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.5); flex-shrink: 0;';
            progressWrap.appendChild(progressTrack);
            progressWrap.appendChild(progressLabel);

            const resultsArea = document.createElement('div');
            resultsArea.style.marginTop = '16px';

            optimizeBtn.addEventListener('click', async () => {
                optimizeBtn.textContent = 'Optimizing…';
                optimizeBtn.disabled = true;
                resultsArea.innerHTML = '';
                progressWrap.style.display = 'flex';
                progressFill.style.width = '0%';
                progressLabel.textContent = '';

                // Build the full loadout equipment map for comparison, if one is selected — every
                // slot's candidate is scored with all OTHER slots held fixed to this loadout
                // (rather than your live gear), so results are consistent with what's compared.
                const loadoutEquipment = new Map();
                const selectedLoadout = this.optimizerLoadoutName
                    ? getLoadoutSnapshot()
                          .getAllSnapshots()
                          .find((s) => s.name === this.optimizerLoadoutName)
                    : null;
                if (selectedLoadout) {
                    for (const eq of selectedLoadout.equipment || []) {
                        if (eq.itemHrid)
                            loadoutEquipment.set(eq.itemLocationHrid, {
                                itemHrid: eq.itemHrid,
                                enhancementLevel: eq.enhancementLevel || 0,
                            });
                    }
                }

                const result = await optimizeSkill(
                    this.currentSkill,
                    this.currentLevel,
                    this.selectedActionHrids,
                    (completed, total) => {
                        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                        progressFill.style.width = `${pct}%`;
                        progressLabel.textContent = `${completed}/${total}`;
                    },
                    loadoutEquipment.size > 0 ? loadoutEquipment : null
                );
                this.lastOptimizerResult = result;

                // Build equipment map using player's actual owned enhancement levels
                const enhMap = buildEnhancementLevelMap();
                const achievableEquipment = new Map();
                if (result) {
                    for (const [locationHrid, slotData] of Object.entries(result.slots)) {
                        const best = slotData.progression[slotData.progression.length - 1];
                        if (best?.itemHrid) {
                            achievableEquipment.set(locationHrid, {
                                itemHrid: best.itemHrid,
                                enhancementLevel: enhMap.get(best.itemHrid) ?? 0,
                            });
                        }
                    }
                }

                // Performance with achievable equipment and optimal teas for each goal
                const xpAchievable = result
                    ? findOptimalTeas(
                          this.currentSkill,
                          'xp',
                          null,
                          null,
                          null,
                          null,
                          achievableEquipment,
                          this.selectedActionHrids
                      )
                    : null;
                const goldAchievable = result
                    ? findOptimalTeas(
                          this.currentSkill,
                          'gold',
                          null,
                          null,
                          null,
                          null,
                          achievableEquipment,
                          this.selectedActionHrids
                      )
                    : null;

                // Reuse the same loadout equipment map used as the scoring base above, for the
                // per-slot "≠ loadout item" diff indicator.
                const loadoutItemMap = loadoutEquipment;

                optimizeBtn.textContent = 'Optimize';
                optimizeBtn.disabled = false;
                progressWrap.style.display = 'none';
                resultsArea.innerHTML = '';
                if (result) {
                    this._renderOptimizerResults(
                        resultsArea,
                        result,
                        { xpResult: xpAchievable, goldResult: goldAchievable },
                        loadoutItemMap.size > 0 ? loadoutItemMap : null
                    );
                }
            });

            panel.appendChild(optimizeBtn);
            panel.appendChild(progressWrap);
            panel.appendChild(resultsArea);

            if (this.lastOptimizerResult)
                this._renderOptimizerResults(resultsArea, this.lastOptimizerResult, null, null);
        }

        return panel;
    }

    _buildTopControls() {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display: flex; flex-direction: column; gap: 7px;';

        const makeRow = (labelText) => {
            const row = document.createElement('div');
            row.style.cssText = 'display: flex; align-items: center; gap: 8px;';
            const label = document.createElement('span');
            label.textContent = labelText;
            label.style.cssText = 'color: rgba(255,255,255,0.5); font-size: 12px; width: 56px; flex-shrink: 0;';
            row.appendChild(label);
            return row;
        };

        const inputCss = `
            background: #2a2a2a; color: #fff;
            border: 1px solid rgba(255,255,255,0.2); border-radius: 4px;
            padding: 4px 8px; font-size: 12px;
        `;

        // Skill
        const skillRow = makeRow('Skill:');
        const skillSelect = document.createElement('select');
        skillSelect.style.cssText = inputCss + ' flex: 1; cursor: pointer;';
        for (const s of SKILL_NAMES) {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s;
            if (s === this.currentSkill) opt.selected = true;
            skillSelect.appendChild(opt);
        }
        skillRow.appendChild(skillSelect);
        wrap.appendChild(skillRow);

        // Level
        const levelRow = makeRow('Level:');
        const levelInput = document.createElement('input');
        levelInput.type = 'number';
        levelInput.min = '1';
        levelInput.max = '200';
        levelInput.value = String(this.currentLevel);
        levelInput.style.cssText = inputCss + ' width: 64px;';
        levelRow.appendChild(levelInput);
        wrap.appendChild(levelRow);

        // Loadout (simulator only)
        if (this.currentMode === 'simulator') {
            const loadoutRow = makeRow('Loadout:');
            const loadoutSelect = document.createElement('select');
            loadoutSelect.style.cssText = inputCss + ' flex: 1; cursor: pointer;';
            this._populateLoadoutSelect(loadoutSelect);
            loadoutRow.appendChild(loadoutSelect);
            wrap.appendChild(loadoutRow);
            loadoutSelect.addEventListener('change', () => this._loadLoadout(loadoutSelect.value));
        }
        // Actions
        const actionsRow = makeRow('Actions:');
        actionsRow.style.position = 'relative';
        const actionBtn = document.createElement('button');
        actionBtn.type = 'button';
        actionBtn.style.cssText = inputCss + ' flex: 1; cursor: pointer; text-align: left;';

        const getActionLabel = () => {
            const all = getSkillActionsForDisplay(this.currentSkill, this.currentLevel);
            const avail = all.filter((a) => a.available);
            if (!this.selectedActionHrids) return `All (${avail.length})`;
            const n = [...this.selectedActionHrids].filter((h) => avail.some((a) => a.hrid === h)).length;
            return `${n} / ${avail.length}`;
        };
        actionBtn.textContent = getActionLabel();
        this._actionBtn = actionBtn;
        this._actionBtnGetLabel = getActionLabel;

        actionBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this._picker) {
                this._closePicker();
                return;
            }
            this._openActionPicker(actionBtn, getActionLabel);
        });
        actionsRow.appendChild(actionBtn);
        wrap.appendChild(actionsRow);

        // Wire up skill/level changes
        const resetActions = () => {
            this.selectedActionHrids = null;
            actionBtn.textContent = getActionLabel();
            this._closePicker();
        };

        skillSelect.addEventListener('change', () => {
            this.currentSkill = skillSelect.value;
            this.currentLevel = getPlayerSkillLevel(this.currentSkill);
            this.teas = [null, null, null];
            this.selectedActionHrids = null;
            this._rebuildPanel();
        });

        levelInput.addEventListener('change', () => {
            this.currentLevel = Math.max(1, Math.min(200, parseInt(levelInput.value, 10) || 1));
            levelInput.value = String(this.currentLevel);
            resetActions();
        });

        return wrap;
    }

    _populateLoadoutSelect(select) {
        const empty = document.createElement('option');
        empty.value = '';
        empty.textContent = '— No loadout —';
        select.appendChild(empty);

        const snapshots = getLoadoutSnapshot().getAllSnapshots();
        for (const snap of snapshots) {
            const opt = document.createElement('option');
            opt.value = snap.name;
            opt.textContent = snap.name + (snap.isDefault ? ' ★' : '');
            select.appendChild(opt);
        }
    }

    _loadLoadout(name) {
        if (!name) return;
        const snap = getLoadoutSnapshot()
            .getAllSnapshots()
            .find((s) => s.name === name);
        if (!snap) return;

        // Load equipment
        this.equipment.clear();
        for (const eq of snap.equipment || []) {
            if (eq.itemHrid) {
                this.equipment.set(eq.itemLocationHrid, {
                    itemHrid: eq.itemHrid,
                    enhancementLevel: eq.enhancementLevel || 0,
                });
            }
        }

        // Load drinks
        this.teas = [
            snap.drinks?.[0]?.itemHrid || null,
            snap.drinks?.[1]?.itemHrid || null,
            snap.drinks?.[2]?.itemHrid || null,
        ];

        // Update slot UI
        for (const [locationHrid, refs] of this._slotBtns) {
            const eq = this.equipment.get(locationHrid);
            this._updateSlotUI(locationHrid, refs, eq?.itemHrid || null, eq?.enhancementLevel ?? 0);
        }

        // Update tea UI
        for (let i = 0; i < 3; i++) {
            const refs = this._teaBtns[i];
            if (!refs) continue;
            const hrid = this.teas[i];
            this._updateTeaUI(i, refs, hrid);
        }
    }

    // -------------------------------------------------------------------------
    // Equipment section
    // -------------------------------------------------------------------------

    _buildEquipmentSection() {
        const section = document.createElement('div');
        section.style.marginTop = '14px';
        section.appendChild(this._makeSectionHeader('Equipment'));

        const relevantTool = SKILL_TOOL_LOCATION[this.currentSkill];
        const locations = SKILLING_LOCATIONS.filter((loc) => !loc.endsWith('_tool') || loc === relevantTool);

        for (const locationHrid of locations) {
            if (getItemsForSlot(locationHrid, this.currentSkill).length === 0) continue;
            section.appendChild(this._buildSlotRow(locationHrid));
        }

        return section;
    }

    _buildSlotRow(locationHrid) {
        const eq = this.equipment.get(locationHrid);
        const currentHrid = eq?.itemHrid || null;
        const currentEnh = eq?.enhancementLevel ?? 0;

        const row = document.createElement('div');
        row.style.cssText = 'display: flex; align-items: center; gap: 6px; padding: 2px 0;';

        const label = document.createElement('span');
        label.textContent = SLOT_DISPLAY_NAMES[locationHrid] || locationHrid;
        label.style.cssText =
            'font-size: 10px; color: rgba(255,255,255,0.35); width: 58px; flex-shrink: 0; text-transform: uppercase; letter-spacing: 0.04em;';
        row.appendChild(label);

        const nameBtn = document.createElement('button');
        nameBtn.type = 'button';
        nameBtn.style.cssText = `
            flex: 1; padding: 3px 6px; font-size: 11px; text-align: left;
            background: #2a2a2a; color: ${currentHrid ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)'};
            border: 1px solid rgba(255,255,255,0.15); border-radius: 3px;
            cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        `;
        nameBtn.textContent = currentHrid ? this._getItemName(currentHrid) || currentHrid : '—';

        const enhInput = document.createElement('input');
        enhInput.type = 'number';
        enhInput.min = '0';
        enhInput.max = '20';
        enhInput.value = String(currentEnh);
        enhInput.style.cssText = `
            width: 40px; padding: 3px 4px; font-size: 11px; text-align: center;
            background: #2a2a2a; color: #fff;
            border: 1px solid rgba(255,255,255,0.15); border-radius: 3px;
            display: ${currentHrid ? 'block' : 'none'};
        `;
        enhInput.addEventListener('change', () => {
            const level = Math.max(0, Math.min(20, parseInt(enhInput.value, 10) || 0));
            enhInput.value = String(level);
            const existing = this.equipment.get(locationHrid);
            if (existing) existing.enhancementLevel = level;
        });

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.textContent = '✕';
        clearBtn.style.cssText = `
            padding: 2px 5px; font-size: 10px; cursor: pointer;
            background: transparent; color: rgba(255,255,255,0.3);
            border: 1px solid rgba(255,255,255,0.15); border-radius: 3px;
            display: ${currentHrid ? 'block' : 'none'};
        `;
        clearBtn.addEventListener('click', () => {
            this.equipment.delete(locationHrid);
            this._updateSlotUI(locationHrid, { nameBtn, enhInput, clearBtn }, null, 0);
        });

        nameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this._picker) {
                this._closePicker();
                return;
            }
            const items = getItemsForSlot(locationHrid, this.currentSkill);
            this._openItemPicker(nameBtn, items, this.equipment.get(locationHrid)?.itemHrid || null, (hrid) => {
                if (hrid) {
                    this.equipment.set(locationHrid, { itemHrid: hrid, enhancementLevel: 0 });
                } else {
                    this.equipment.delete(locationHrid);
                }
                this._updateSlotUI(locationHrid, { nameBtn, enhInput, clearBtn }, hrid, 0);
            });
        });

        row.appendChild(nameBtn);
        row.appendChild(enhInput);
        row.appendChild(clearBtn);

        this._slotBtns.set(locationHrid, { nameBtn, enhInput, clearBtn });
        return row;
    }

    _updateSlotUI(locationHrid, refs, itemHrid, enhLevel) {
        const { nameBtn, enhInput, clearBtn } = refs;
        const name = itemHrid ? this._getItemName(itemHrid) || itemHrid : null;
        nameBtn.textContent = name || '—';
        nameBtn.style.color = itemHrid ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)';
        enhInput.value = String(enhLevel);
        enhInput.style.display = itemHrid ? 'block' : 'none';
        clearBtn.style.display = itemHrid ? 'block' : 'none';
    }

    // -------------------------------------------------------------------------
    // Tea section
    // -------------------------------------------------------------------------

    _buildTeasSection() {
        const section = document.createElement('div');
        section.style.marginTop = '14px';
        section.appendChild(this._makeSectionHeader('Teas'));

        for (let i = 0; i < 3; i++) {
            const row = this._buildTeaRow(i);
            section.appendChild(row);
        }

        return section;
    }

    _buildTeaRow(index) {
        const currentHrid = this.teas[index];

        const row = document.createElement('div');
        row.style.cssText = 'display: flex; align-items: center; gap: 6px; padding: 2px 0;';

        const label = document.createElement('span');
        label.textContent = `TEA ${index + 1}`;
        label.style.cssText =
            'font-size: 10px; color: rgba(255,255,255,0.35); width: 58px; flex-shrink: 0; text-transform: uppercase; letter-spacing: 0.04em;';
        row.appendChild(label);

        const nameBtn = document.createElement('button');
        nameBtn.type = 'button';
        nameBtn.style.cssText = `
            flex: 1; padding: 3px 6px; font-size: 11px; text-align: left;
            background: #2a2a2a; color: ${currentHrid ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)'};
            border: 1px solid rgba(255,255,255,0.15); border-radius: 3px;
            cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        `;
        nameBtn.textContent = currentHrid ? this._getItemName(currentHrid) || currentHrid : '—';

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.textContent = '✕';
        clearBtn.style.cssText = `
            padding: 2px 5px; font-size: 10px; cursor: pointer;
            background: transparent; color: rgba(255,255,255,0.3);
            border: 1px solid rgba(255,255,255,0.15); border-radius: 3px;
            display: ${currentHrid ? 'block' : 'none'};
        `;
        clearBtn.addEventListener('click', () => {
            this.teas[index] = null;
            this._updateTeaUI(index, { nameBtn, clearBtn }, null);
        });

        nameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this._picker) {
                this._closePicker();
                return;
            }
            const drinks = getSkillDrinkItems();
            this._openItemPicker(nameBtn, drinks, this.teas[index], (hrid) => {
                this.teas[index] = hrid;
                this._updateTeaUI(index, { nameBtn, clearBtn }, hrid);
            });
        });

        row.appendChild(nameBtn);
        row.appendChild(clearBtn);

        this._teaBtns[index] = { nameBtn, clearBtn };
        return row;
    }

    _updateTeaUI(index, refs, hrid) {
        const { nameBtn, clearBtn } = refs;
        const name = hrid ? this._getItemName(hrid) || hrid : null;
        nameBtn.textContent = name || '—';
        nameBtn.style.color = hrid ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)';
        clearBtn.style.display = hrid ? 'block' : 'none';
    }

    // -------------------------------------------------------------------------
    // Item picker popup
    // -------------------------------------------------------------------------

    _openItemPicker(anchorEl, items, currentHrid, onSelect) {
        this._closePicker();

        const popup = document.createElement('div');
        popup.style.cssText = `
            position: fixed; z-index: 20000;
            background: #1e1e1e; border: 1px solid rgba(255,255,255,0.2);
            border-radius: 6px; width: 260px; max-height: 300px;
            display: flex; flex-direction: column;
            box-shadow: 0 4px 20px rgba(0,0,0,0.6);
        `;

        // Position below anchor, flip up if too close to bottom
        const rect = anchorEl.getBoundingClientRect();
        let top = rect.bottom + 4;
        let left = rect.left;
        if (left + 260 > window.innerWidth - 8) left = window.innerWidth - 268;
        if (top + 300 > window.innerHeight - 8) top = rect.top - 304;
        popup.style.top = `${Math.max(8, top)}px`;
        popup.style.left = `${Math.max(8, left)}px`;

        // Search input
        const search = document.createElement('input');
        search.placeholder = 'Search…';
        search.style.cssText = `
            padding: 7px 10px; background: #2a2a2a; color: #fff; font-size: 12px;
            border: none; border-bottom: 1px solid rgba(255,255,255,0.15); outline: none;
            border-radius: 6px 6px 0 0; flex-shrink: 0;
        `;
        popup.appendChild(search);

        const list = document.createElement('div');
        list.style.cssText = 'overflow-y: auto; flex: 1;';
        popup.appendChild(list);

        const render = (filter) => {
            list.innerHTML = '';

            // Empty option
            const emptyRow = document.createElement('div');
            emptyRow.textContent = '— Empty —';
            emptyRow.style.cssText =
                'padding: 6px 10px; cursor: pointer; font-size: 12px; color: rgba(255,255,255,0.35); font-style: italic; border-bottom: 1px solid rgba(255,255,255,0.08);';
            emptyRow.addEventListener('mouseenter', () => (emptyRow.style.background = 'rgba(255,255,255,0.05)'));
            emptyRow.addEventListener('mouseleave', () => (emptyRow.style.background = ''));
            emptyRow.addEventListener('click', () => {
                onSelect(null);
                this._closePicker();
            });
            list.appendChild(emptyRow);

            const lc = filter.toLowerCase();
            const filtered = filter ? items.filter((i) => i.name.toLowerCase().includes(lc)) : items;
            const avail = filtered.filter((i) => i.available !== false);
            const locked = filtered.filter((i) => i.available === false);

            for (const item of avail) list.appendChild(this._makePickerRow(item, currentHrid, onSelect));

            if (locked.length) {
                const sep = document.createElement('div');
                sep.textContent = '— Level locked —';
                sep.style.cssText =
                    'padding: 4px 10px; font-size: 10px; color: rgba(255,255,255,0.3); border-top: 1px solid rgba(255,255,255,0.08);';
                list.appendChild(sep);
                for (const item of locked) list.appendChild(this._makePickerRow(item, currentHrid, onSelect));
            }
        };

        render('');
        search.addEventListener('input', () => render(search.value));

        document.body.appendChild(popup);
        this._picker = popup;

        const closeHandler = (e) => {
            if (!popup.contains(e.target) && e.target !== anchorEl) {
                this._closePicker();
                document.removeEventListener('click', closeHandler, true);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler, true), 100);
        this._pickerCleanup = () => document.removeEventListener('click', closeHandler, true);

        search.focus();
    }

    _makePickerRow(item, currentHrid, onSelect) {
        const isSelected = item.hrid === currentHrid;
        const isLocked = item.available === false;

        const row = document.createElement('div');
        row.style.cssText = `
            padding: 5px 10px; font-size: 12px; cursor: ${isLocked ? 'default' : 'pointer'};
            color: ${isLocked ? 'rgba(255,255,255,0.2)' : isSelected ? config.COLOR_ACCENT : 'rgba(255,255,255,0.8)'};
            ${isLocked ? 'text-decoration: line-through;' : ''}
            ${isSelected ? 'font-weight: 600; background: rgba(255,255,255,0.04);' : ''}
            display: flex; justify-content: space-between;
        `;

        const name = document.createElement('span');
        name.textContent = item.name;
        row.appendChild(name);

        if (item.itemLevel > 0) {
            const req = document.createElement('span');
            req.textContent = `T${item.itemLevel}`;
            req.style.cssText = 'font-size: 10px; color: rgba(255,255,255,0.25); flex-shrink: 0; margin-left: 6px;';
            row.appendChild(req);
        }

        if (!isLocked) {
            row.addEventListener('mouseenter', () => {
                if (!isSelected) row.style.background = 'rgba(255,255,255,0.06)';
            });
            row.addEventListener('mouseleave', () => {
                row.style.background = isSelected ? 'rgba(255,255,255,0.04)' : '';
            });
            row.addEventListener('click', () => {
                onSelect(item.hrid);
                this._closePicker();
            });
        }

        return row;
    }

    _closePicker() {
        if (this._pickerCleanup) {
            this._pickerCleanup();
            this._pickerCleanup = null;
        }
        this._picker?.remove();
        this._picker = null;
    }

    // -------------------------------------------------------------------------
    // Action picker popup
    // -------------------------------------------------------------------------

    _openActionPicker(anchorBtn, getBtnLabel) {
        this._closePicker();

        const actions = getSkillActionsForDisplay(this.currentSkill, this.currentLevel);
        const available = actions.filter((a) => a.available);

        const popup = document.createElement('div');
        popup.style.cssText = `
            position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 10000;
            background: #1e1e1e; border: 1px solid rgba(255,255,255,0.2);
            border-radius: 6px; max-height: 260px; overflow-y: auto;
            box-shadow: 0 4px 16px rgba(0,0,0,0.5); font-size: 12px;
        `;

        const makeRow = (label, checked, disabled, onToggle) => {
            const row = document.createElement('label');
            row.style.cssText = `
                display: flex; align-items: center; gap: 8px; padding: 5px 10px;
                cursor: ${disabled ? 'default' : 'pointer'};
                color: ${disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.85)'};
                ${disabled ? 'text-decoration: line-through;' : ''}
            `;
            if (!disabled) {
                row.addEventListener('mouseenter', () => (row.style.background = 'rgba(255,255,255,0.06)'));
                row.addEventListener('mouseleave', () => (row.style.background = ''));
            }
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = checked;
            cb.disabled = disabled;
            cb.addEventListener('change', () => onToggle(cb.checked));
            row.appendChild(cb);
            const text = document.createElement('span');
            text.textContent = label;
            row.appendChild(text);
            return { row, cb };
        };

        const allChecked = this.selectedActionHrids === null;
        const itemRows = [];

        const { row: allRow, cb: allCb } = makeRow('All', allChecked, false, (checked) => {
            if (checked) {
                this.selectedActionHrids = null;
                itemRows.forEach(({ cb }) => {
                    cb.checked = true;
                });
            } else {
                this.selectedActionHrids = new Set();
                itemRows.forEach(({ cb }) => {
                    cb.checked = false;
                });
            }
            anchorBtn.textContent = getBtnLabel();
        });
        allRow.style.cssText += ' font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.1);';
        popup.appendChild(allRow);

        for (const action of actions) {
            const isChecked =
                action.available && (this.selectedActionHrids === null || this.selectedActionHrids.has(action.hrid));
            const label = action.available ? action.name : `${action.name} (lv ${action.requiredLevel})`;
            const { row, cb } = makeRow(label, isChecked, !action.available, (checked) => {
                if (this.selectedActionHrids === null) {
                    this.selectedActionHrids = new Set(available.map((a) => a.hrid));
                }
                if (checked) this.selectedActionHrids.add(action.hrid);
                else this.selectedActionHrids.delete(action.hrid);
                if (available.every((a) => this.selectedActionHrids.has(a.hrid))) {
                    this.selectedActionHrids = null;
                    allCb.checked = true;
                } else {
                    allCb.checked = false;
                }
                anchorBtn.textContent = getBtnLabel();
            });
            itemRows.push({ cb, hrid: action.hrid });
            popup.appendChild(row);
        }

        anchorBtn.parentElement.style.position = 'relative';
        anchorBtn.parentElement.appendChild(popup);
        this._picker = popup;

        const closeHandler = (e) => {
            if (!popup.contains(e.target) && e.target !== anchorBtn) {
                this._closePicker();
                document.removeEventListener('click', closeHandler, true);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler, true), 100);
        this._pickerCleanup = () => document.removeEventListener('click', closeHandler, true);
    }

    // -------------------------------------------------------------------------
    // Simulation
    // -------------------------------------------------------------------------

    _runSimulation() {
        if (!this._resultsArea) return;

        const result = calculateSkillPerformance(
            this.currentSkill,
            this.equipment,
            this.teas,
            this.currentLevel,
            this.selectedActionHrids
        );

        this._resultsArea.innerHTML = '';

        const section = document.createElement('div');
        section.appendChild(this._makeSectionHeader('Results'));

        const stats = document.createElement('div');
        stats.style.cssText = 'display: flex; gap: 20px; margin-bottom: 8px;';

        const makeStat = (label, value, color) => {
            const el = document.createElement('div');
            el.innerHTML = `
                <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px;">${label}</div>
                <div style="font-size:15px;font-weight:700;color:${color};">${value > 0 ? formatKMB(value) : '—'}</div>
            `;
            return el;
        };

        stats.appendChild(makeStat('XP / hr', result.xpPerHour, config.COLOR_INFO));
        stats.appendChild(makeStat('Gold / hr', result.goldPerHour, config.COLOR_PROFIT));
        section.appendChild(stats);

        if (result.teaCostPerHour > 0) {
            const cost = document.createElement('div');
            cost.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.4);';
            cost.textContent = `Tea cost: ${formatKMB(result.teaCostPerHour)}/hr`;
            section.appendChild(cost);
        }

        this._resultsArea.appendChild(section);
    }

    // -------------------------------------------------------------------------
    // Optimizer results rendering
    // -------------------------------------------------------------------------

    _renderOptimizerResults(container, result, achievableStats, loadoutItemMap) {
        const { slots } = result;
        const slotEntries = Object.entries(slots);

        if (!slotEntries.length) {
            const empty = document.createElement('div');
            empty.style.color = 'rgba(255,255,255,0.5)';
            empty.textContent = 'No relevant equipment found for this skill at the selected level.';
            container.appendChild(empty);
            return;
        }

        container.appendChild(this._makeSectionHeader('Equipment Progression'));

        this._resultRows = this._collectResultRows(result, loadoutItemMap, this.budget);
        container.appendChild(this._renderResultsTable());

        const xpResult = achievableStats?.xpResult;
        const goldResult = achievableStats?.goldResult;
        const hasXp = xpResult?.optimal?.avgScore > 0;
        const hasGold = goldResult?.optimal?.avgScore > 0;

        if (hasXp || hasGold) {
            const statsRow = document.createElement('div');
            statsRow.style.cssText = 'display: flex; gap: 20px; margin-top: 16px; margin-bottom: 4px;';
            if (hasXp) statsRow.appendChild(this._makeStat('Avg XP/hr', xpResult.optimal.avgScore, config.COLOR_INFO));
            if (hasGold)
                statsRow.appendChild(this._makeStat('Avg Gold/hr', goldResult.optimal.avgScore, config.COLOR_PROFIT));
            container.appendChild(statsRow);
        }

        if (hasXp || hasGold) {
            const teasSection = document.createElement('div');
            teasSection.style.marginTop = '14px';
            teasSection.appendChild(this._makeSectionHeader('Optimal Teas'));
            const cols = document.createElement('div');
            cols.style.cssText = 'display: flex; gap: 16px;';
            if (hasXp) cols.appendChild(this._makeTeaCol('For XP', config.COLOR_INFO, xpResult.optimal.teas));
            if (hasGold) cols.appendChild(this._makeTeaCol('For Gold', config.COLOR_PROFIT, goldResult.optimal.teas));
            teasSection.appendChild(cols);
            container.appendChild(teasSection);
        }

        const note = document.createElement('div');
        note.style.cssText = 'margin-top: 12px; font-size: 10px; color: rgba(255,255,255,0.3); font-style: italic;';
        const baselineNote = loadoutItemMap
            ? 'Gains are measured against your compared loadout item for each slot. Click a column header to sort.'
            : 'Gains are measured against your currently equipped item in each slot (or an empty slot if nothing is equipped there). Select a loadout in Compare to measure against that instead. Click a column header to sort.';
        note.textContent = this.budget
            ? `${baselineNote} Items over your ${formatKMB(this.budget)} budget are hidden; the highlighted row in each slot is the best option within it.`
            : baselineNote;
        container.appendChild(note);
    }

    /**
     * Flatten every slot's candidates into one row list for the sortable results table. The row
     * source depends on view mode: budget view uses the cost-vs-score Pareto frontier (already
     * budget-filtered — see the Optimize click handler), Compare-loadout view uses per-breakpoint
     * entries that beat the compared loadout item, and the default view groups consecutive
     * breakpoints of the same item into tiers that beat the player's live equipment.
     * @param {Object} result - optimizeSkill result
     * @param {Map|null} loadoutItemMap - compared loadout equipment, if one is selected
     * @param {number|null} budget - max gold cost/slot, if a budget filter is set
     * @returns {Array<Object>} row objects for _renderResultsTable
     */
    _collectResultRows(result, loadoutItemMap, budget) {
        const rows = [];

        const pushRow = (slotData, entry, bpLabel, highlight, xpBaseline, goldBaseline) => {
            const goldGain = entry.goldGainPerHour ?? entry.goldScore - goldBaseline;
            const percentGain = goldBaseline > 0 && goldGain > 0 ? (goldGain / goldBaseline) * 100 : null;
            rows.push({
                slotName: slotData.name,
                itemName: entry.itemName,
                bpLabel,
                cost: entry.cost ?? null,
                costPer1Pct: percentGain ? entry.cost / percentGain : null,
                paybackHours: entry.paybackHours ?? null,
                xpGain: entry.xpScore - xpBaseline,
                goldGain,
                highlight,
            });
        };

        for (const [locationHrid, slotData] of Object.entries(result.slots)) {
            const loadoutEntry = loadoutItemMap?.get(locationHrid) ?? null;
            // The engine already scored every candidate (and the baseline) against the same fixed
            // equipment in every other slot — your live gear by default, or the compared loadout
            // when one was selected at Optimize time — so the per-slot baseline it returns is
            // already consistent with these entries. No need to recompute anything here.
            const xpBaseline = slotData.slotXpBaseline ?? result.xpBaseline;
            const goldBaseline = slotData.slotGoldBaseline ?? result.goldBaseline;

            if (budget != null) {
                // Only genuine cost-vs-score improvements (the Pareto frontier computed in
                // optimizeSkill) that are actually affordable — items over budget are dropped
                // entirely. Only worth buying if it actually raises gold/hr — a pure XP or no-op
                // upgrade isn't an "investment" with a payback time, so it doesn't belong here.
                const paretoCandidates = (slotData.paretoCandidates || []).filter((e) => e.goldGainPerHour > 0);
                const withinBudget = paretoCandidates.filter((e) => e.cost <= budget);
                const bestAffordable = withinBudget[withinBudget.length - 1] || null;
                for (const entry of withinBudget) {
                    pushRow(
                        slotData,
                        entry,
                        `+${entry.breakpoint}`,
                        entry === bestAffordable,
                        xpBaseline,
                        goldBaseline
                    );
                }
            } else if (loadoutEntry) {
                // One row per enhancement level where the user has something to gain over the
                // compared loadout. Show every qualifying breakpoint (not just the first) so
                // higher tiers of the same item aren't hidden just because a lower tier already
                // cleared the bar.
                const loadoutItemHrid = loadoutEntry.itemHrid ?? null;
                for (const entry of slotData.progression) {
                    if (!entry.itemHrid) continue;
                    const xpDelta = entry.xpScore - xpBaseline;
                    const goldDelta = entry.goldScore - goldBaseline;
                    if (xpDelta <= 0 && goldDelta <= 0) continue;
                    pushRow(
                        slotData,
                        entry,
                        `+${entry.breakpoint}`,
                        entry.itemHrid !== loadoutItemHrid,
                        xpBaseline,
                        goldBaseline
                    );
                }
            } else {
                // Grouped tier view (no compare selected): collapse same-item runs into one row.
                const tiers = this._groupTiers(slotData.progression);
                for (let i = 0; i < tiers.length; i++) {
                    const tier = tiers[i];
                    const isLast = i === tiers.length - 1;
                    const bpLabel =
                        tier.fromBp === tier.toBp
                            ? `+${tier.fromBp}`
                            : isLast
                              ? `+${tier.fromBp}+`
                              : `+${tier.fromBp} – +${tier.toBp}`;
                    pushRow(slotData, tier, bpLabel, i > 0, xpBaseline, goldBaseline);
                }
            }
        }

        return rows;
    }

    /**
     * Render this._resultRows as a table with clickable, sortable column headers. Re-invoked
     * (replacing itself in place) whenever a header is clicked, since sorting only needs to
     * reorder already-computed rows rather than recompute anything.
     * @returns {HTMLElement}
     */
    _renderResultsTable() {
        const rows = this._resultRows;

        if (!rows.length) {
            const empty = document.createElement('div');
            empty.style.cssText = 'color: rgba(255,255,255,0.25); font-size: 11px; font-style: italic;';
            empty.textContent = 'No items to show.';
            return empty;
        }

        const sortKey = this._resultsSortKey;
        const sortDir = this._resultsSortDir;
        const sortedRows = sortKey
            ? [...rows].sort((a, b) => {
                  const colDef = RESULT_TABLE_COLUMNS.find((c) => c.key === sortKey);
                  const av = a[sortKey];
                  const bv = b[sortKey];
                  if (colDef.type === 'string') {
                      const cmp = (av || '').toLowerCase().localeCompare((bv || '').toLowerCase());
                      return sortDir === 'asc' ? cmp : -cmp;
                  }
                  // Numbers: rows with no value (e.g. no gold/hr gain) always sort to the bottom.
                  if (av == null && bv == null) return 0;
                  if (av == null) return 1;
                  if (bv == null) return -1;
                  const cmp = av - bv;
                  return sortDir === 'asc' ? cmp : -cmp;
              })
            : rows;

        const wrap = document.createElement('div');
        wrap.style.cssText = 'overflow-x: auto;';

        const table = document.createElement('table');
        table.style.cssText = 'width: 100%; border-collapse: collapse; font-size: 12px;';

        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        for (const col of RESULT_TABLE_COLUMNS) {
            const isActive = sortKey === col.key;
            const th = document.createElement('th');
            th.style.cssText = `
                text-align: ${col.type === 'number' ? 'right' : 'left'};
                padding: 4px 8px; border-bottom: 1px solid rgba(255,255,255,0.15);
                color: ${isActive ? config.COLOR_ACCENT : 'rgba(255,255,255,0.5)'};
                font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em;
                cursor: pointer; user-select: none; white-space: nowrap;
            `;
            th.textContent = col.label + (isActive ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');
            th.addEventListener('click', () => {
                if (this._resultsSortKey === col.key) {
                    this._resultsSortDir = this._resultsSortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    this._resultsSortKey = col.key;
                    this._resultsSortDir = 'asc';
                }
                wrap.replaceWith(this._renderResultsTable());
            });
            headRow.appendChild(th);
        }
        thead.appendChild(headRow);
        table.appendChild(thead);

        const fmtCell = (value, formatter) => {
            const td = document.createElement('td');
            td.style.cssText =
                'padding: 3px 8px; text-align: right; color: rgba(255,255,255,0.75); white-space: nowrap;';
            td.textContent = value != null ? formatter(value) : '—';
            return td;
        };

        const tbody = document.createElement('tbody');
        for (const row of sortedRows) {
            const tr = document.createElement('tr');
            tr.style.cssText = `border-bottom: 1px solid rgba(255,255,255,0.06); ${row.highlight ? `background: ${config.COLOR_ACCENT}11;` : ''}`;

            const slotTd = document.createElement('td');
            slotTd.style.cssText = 'padding: 3px 8px; color: rgba(255,255,255,0.55); white-space: nowrap;';
            slotTd.textContent = row.slotName;
            tr.appendChild(slotTd);

            const itemTd = document.createElement('td');
            itemTd.style.cssText = `padding: 3px 8px; white-space: nowrap; color: ${row.highlight ? config.COLOR_PROFIT : 'rgba(255,255,255,0.85)'}; font-weight: ${row.highlight ? '600' : '400'};`;
            itemTd.textContent = `${row.highlight ? '★ ' : ''}${row.itemName} ${row.bpLabel}`;
            tr.appendChild(itemTd);

            tr.appendChild(fmtCell(row.cost, (v) => formatKMB(v)));
            tr.appendChild(fmtCell(row.costPer1Pct, (v) => formatKMB(v)));
            tr.appendChild(fmtCell(row.paybackHours, (v) => this._formatPaybackHours(v)));
            tr.appendChild(fmtCell(row.xpGain, (v) => `${v > 0 ? '+' : ''}${formatKMB(v)}`));
            tr.appendChild(fmtCell(row.goldGain, (v) => `${v > 0 ? '+' : ''}${formatKMB(v)}`));

            tbody.appendChild(tr);
        }
        table.appendChild(tbody);

        wrap.appendChild(table);
        return wrap;
    }

    _formatPaybackHours(hours) {
        if (hours < 24) return `${hours.toFixed(1)}h`;
        const days = hours / 24;
        if (days < 365) return `${days.toFixed(1)}d`;
        return `${(days / 365).toFixed(1)}y`;
    }

    _groupTiers(progression) {
        const tiers = [];
        let current = null;
        for (const entry of progression) {
            if (!entry.itemHrid) {
                current = null;
                continue;
            }
            if (!current || entry.itemHrid !== current.itemHrid) {
                if (current) tiers.push(current);
                current = {
                    itemHrid: entry.itemHrid,
                    itemName: entry.itemName,
                    fromBp: entry.breakpoint,
                    toBp: entry.breakpoint,
                    score: entry.score,
                    xpScore: entry.xpScore,
                    goldScore: entry.goldScore,
                    cost: entry.cost,
                    goldGainPerHour: entry.goldGainPerHour,
                    paybackHours: entry.paybackHours,
                };
            } else {
                current.toBp = entry.breakpoint;
                current.cost = entry.cost;
                current.goldGainPerHour = entry.goldGainPerHour;
                current.paybackHours = entry.paybackHours;
            }
        }
        if (current) tiers.push(current);
        return tiers;
    }

    _makeStat(label, value, color) {
        const el = document.createElement('div');
        el.innerHTML = `
            <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px;">${label}</div>
            <div style="font-size:15px;font-weight:700;color:${color};">${value > 0 ? formatKMB(value) : '—'}</div>
        `;
        return el;
    }

    _makeTeaCol(label, color, teas) {
        const col = document.createElement('div');
        col.style.flex = '1';
        const h = document.createElement('div');
        h.style.cssText = `font-size:11px;font-weight:600;color:${color};margin-bottom:4px;`;
        h.textContent = label;
        col.appendChild(h);
        for (const tea of teas) {
            const row = document.createElement('div');
            row.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.8);padding:1px 0;';
            row.textContent = `• ${tea.name}`;
            col.appendChild(row);
        }
        return col;
    }

    _makeSectionHeader(text) {
        const h = document.createElement('div');
        h.style.cssText = `
            font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.4);
            text-transform: uppercase; letter-spacing: 0.06em;
            margin-bottom: 6px; padding-bottom: 4px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        `;
        h.textContent = text;
        return h;
    }

    _getItemName(hrid) {
        const gameData = window.Cheezasha?.Core?.dataManager?.getInitClientData?.();
        return gameData?.itemDetailMap?.[hrid]?.name || null;
    }

    // -------------------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------------------

    cleanup() {
        if (this.watcher) {
            this.watcher();
            this.watcher = null;
        }
        this._closePicker();
        this.tabBtn?.remove();
        this.panel?.remove();
        this.contentParent?.classList.remove(HIDE_CLASS);
        STYLE_EL.remove();
        this.tabBtn = null;
        this.panel = null;
        this.contentParent = null;
        this.isActive = false;
    }
}

const skillingSimulatorUI = new SkillingSimulatorUI();

export default {
    name: 'Skilling Simulator',
    initialize: () => skillingSimulatorUI.initialize(),
    cleanup: () => skillingSimulatorUI.cleanup(),
};

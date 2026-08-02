/**
 * Skill Optimizer Popup
 * Floating button (next to Best Rates) that opens a modal with two sub-tabs:
 *  - Customize: edit equipment, skill levels, house room levels, and community buffs
 *  - Results: top-3 profit/hr actions per skill (excludes enhancing) under that loadout,
 *    with the best tea combo picked automatically per skill.
 */

import config from '../../core/config.js';
import dataManager from '../../core/data-manager.js';
import {
    SKILLS,
    EQUIPMENT_LOCATIONS,
    SLOT_DISPLAY_NAMES,
    COMMUNITY_BUFF_TYPES,
    getItemsForSlot,
    getRelevantHouseRooms,
    getLiveLoadout,
    computeTopResults,
    applyMaxLoadout,
} from './skill-optimizer-calc.js';
import { formatKMB } from '../../utils/formatters.js';

const TOP_N = 3;

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function styledSelect() {
    const select = document.createElement('select');
    select.style.cssText = `
        background: #1f1f1f;
        color: #ddd;
        border: 1px solid #444;
        border-radius: 4px;
        padding: 3px 6px;
        font-size: 12px;
        flex: 1;
        min-width: 0;
    `;
    return select;
}

function styledNumberInput(width = '52px') {
    const input = document.createElement('input');
    input.type = 'number';
    input.style.cssText = `
        background: #1f1f1f;
        color: #ddd;
        border: 1px solid #444;
        border-radius: 4px;
        padding: 3px 6px;
        font-size: 12px;
        width: ${width};
    `;
    return input;
}

function fieldRow(labelText) {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: center; gap: 6px; padding: 3px 0;';
    const label = document.createElement('span');
    label.textContent = labelText;
    label.style.cssText = 'color: #bbb; font-size: 12px; width: 150px; flex-shrink: 0;';
    row.appendChild(label);
    return row;
}

class SkillOptimizerPopup {
    constructor() {
        this.isInitialized = false;
        this.button = null;
        this.modal = null;
        this.activeTab = 'customize';
        this.loadout = null;
        this.results = null;
    }

    initialize() {
        if (this.isInitialized) return;
        if (!config.getSetting('skillOptimizerPopup')) return;

        this.isInitialized = true;
        this.loadout = getLiveLoadout();
        this.createButton();
    }

    createButton() {
        if (document.getElementById('mwi-skill-optimizer-btn')) return;

        const button = document.createElement('button');
        button.id = 'mwi-skill-optimizer-btn';
        button.textContent = '🧮 Optimizer';
        button.style.cssText = `
            position: fixed;
            bottom: 12px;
            left: 132px;
            z-index: ${config.Z_POPUP};
            padding: 8px 14px;
            background: ${config.COLOR_ACCENT};
            color: #fff;
            border: none;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
        `;
        button.addEventListener('click', () => this.openModal());

        document.body.appendChild(button);
        this.button = button;
    }

    openModal() {
        if (!this.modal) {
            this.createModal();
        }
        this.modal.style.display = 'flex';
        this.renderContent();
    }

    closeModal() {
        if (this.modal) {
            this.modal.style.display = 'none';
        }
    }

    createModal() {
        this.modal = document.createElement('div');
        this.modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: ${config.Z_MODAL};
        `;
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
        });

        const content = document.createElement('div');
        content.style.cssText = `
            background: #2a2a2a;
            border-radius: 8px;
            padding: 20px;
            width: 700px;
            max-width: 95%;
            max-height: 85%;
            overflow: auto;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        `;

        const header = document.createElement('div');
        header.style.cssText =
            'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;';
        const title = document.createElement('h2');
        title.textContent = 'Skill Optimizer';
        title.style.cssText = 'margin: 0; color: #fff;';
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: #fff;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            width: 30px;
            height: 30px;
        `;
        closeBtn.addEventListener('click', () => this.closeModal());
        header.appendChild(title);
        header.appendChild(closeBtn);

        const tabs = document.createElement('div');
        tabs.style.cssText = 'display: flex; gap: 8px; margin-bottom: 16px;';
        tabs.appendChild(this.createTabButton('Customize', 'customize'));
        tabs.appendChild(this.createTabButton('Results', 'results'));

        const body = document.createElement('div');
        body.className = 'mwi-skill-optimizer-body';

        content.appendChild(header);
        content.appendChild(tabs);
        content.appendChild(body);
        this.modal.appendChild(content);
        document.body.appendChild(this.modal);
    }

    createTabButton(label, tabKey) {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.dataset.tab = tabKey;
        btn.addEventListener('click', () => {
            this.activeTab = tabKey;
            this.renderContent();
        });
        this.styleTabButton(btn, tabKey);
        return btn;
    }

    styleTabButton(btn, tabKey) {
        const isActive = this.activeTab === tabKey;
        btn.style.cssText = `
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
            background: ${isActive ? config.COLOR_ACCENT : '#3a3a3a'};
            color: ${isActive ? '#fff' : '#aaa'};
        `;
    }

    renderContent() {
        this.modal.querySelectorAll('button[data-tab]').forEach((btn) => this.styleTabButton(btn, btn.dataset.tab));

        const body = this.modal.querySelector('.mwi-skill-optimizer-body');
        while (body.firstChild) body.removeChild(body.firstChild);

        if (this.activeTab === 'customize') {
            this.renderCustomizeTab(body);
        } else {
            this.renderResultsTab(body);
        }
    }

    // -------------------------------------------------------------------------
    // Customize tab
    // -------------------------------------------------------------------------

    renderCustomizeTab(body) {
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display: flex; gap: 8px; margin-bottom: 12px;';

        const resetBtn = document.createElement('button');
        resetBtn.textContent = 'Reset to current gear/stats';
        resetBtn.style.cssText = `
            padding: 6px 12px;
            background: #3a3a3a;
            color: #ddd;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        `;
        resetBtn.addEventListener('click', () => {
            this.loadout = getLiveLoadout();
            this.renderContent();
        });

        const maxBtn = document.createElement('button');
        maxBtn.textContent = 'Set Max';
        maxBtn.title = 'Level 150 skills, best item at +15 in every slot, level 8 house rooms';
        maxBtn.style.cssText = `
            padding: 6px 12px;
            background: #3a3a3a;
            color: #ddd;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        `;
        maxBtn.addEventListener('click', () => {
            applyMaxLoadout(this.loadout);
            this.renderContent();
        });

        btnRow.appendChild(resetBtn);
        btnRow.appendChild(maxBtn);
        body.appendChild(btnRow);

        body.appendChild(this.renderSection('Skill Levels', this.renderSkillLevelFields()));
        body.appendChild(this.renderSection('Equipment', this.renderEquipmentFields()));
        body.appendChild(this.renderSection('House Rooms', this.renderHouseRoomFields()));
        body.appendChild(this.renderSection('Community Buffs', this.renderCommunityBuffFields()));
    }

    renderSection(title, contentEl) {
        const section = document.createElement('div');
        section.style.cssText = 'margin-bottom: 16px;';
        const heading = document.createElement('div');
        heading.textContent = title;
        heading.style.cssText = 'color: #fff; font-weight: 700; margin-bottom: 6px; font-size: 14px;';
        section.appendChild(heading);
        section.appendChild(contentEl);
        return section;
    }

    renderSkillLevelFields() {
        const container = document.createElement('div');
        container.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px;';
        for (const skill of SKILLS) {
            const row = fieldRow(capitalize(skill));
            const input = styledNumberInput();
            input.min = 1;
            input.max = 200;
            input.value = this.loadout.skillLevels[skill] ?? 1;
            input.addEventListener('change', () => {
                const level = Math.max(1, parseInt(input.value, 10) || 1);
                this.loadout.skillLevels[skill] = level;
                input.value = level;
            });
            row.appendChild(input);
            container.appendChild(row);
        }
        return container;
    }

    renderEquipmentFields() {
        const container = document.createElement('div');
        container.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';

        for (const location of EQUIPMENT_LOCATIONS) {
            const current = this.loadout.equipment.get(location);
            const items = getItemsForSlot(location);

            const row = fieldRow(SLOT_DISPLAY_NAMES[location] || location);

            const select = styledSelect();
            const noneOption = document.createElement('option');
            noneOption.value = '';
            noneOption.textContent = '(none)';
            select.appendChild(noneOption);
            for (const item of items) {
                const option = document.createElement('option');
                option.value = item.hrid;
                option.textContent = item.name;
                if (current?.itemHrid === item.hrid) option.selected = true;
                select.appendChild(option);
            }

            const enhInput = styledNumberInput('44px');
            enhInput.min = 0;
            enhInput.max = 20;
            enhInput.title = 'Enhancement level';
            enhInput.value = current?.enhancementLevel ?? 0;
            enhInput.disabled = !current;

            select.addEventListener('change', () => {
                if (!select.value) {
                    this.loadout.equipment.delete(location);
                    enhInput.value = 0;
                    enhInput.disabled = true;
                } else {
                    const enhancementLevel = parseInt(enhInput.value, 10) || 0;
                    this.loadout.equipment.set(location, { itemHrid: select.value, enhancementLevel });
                    enhInput.disabled = false;
                }
            });

            enhInput.addEventListener('change', () => {
                const existing = this.loadout.equipment.get(location);
                if (!existing) return;
                const level = Math.max(0, Math.min(20, parseInt(enhInput.value, 10) || 0));
                this.loadout.equipment.set(location, { ...existing, enhancementLevel: level });
                enhInput.value = level;
            });

            row.appendChild(select);
            row.appendChild(enhInput);
            container.appendChild(row);
        }

        return container;
    }

    renderHouseRoomFields() {
        const container = document.createElement('div');
        container.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px;';

        for (const room of getRelevantHouseRooms()) {
            const current = this.loadout.houseRooms.get(room.hrid);
            const row = fieldRow(room.name);
            const input = styledNumberInput();
            input.min = 0;
            input.max = 8;
            input.value = current?.level ?? 0;
            input.addEventListener('change', () => {
                const level = Math.max(0, Math.min(8, parseInt(input.value, 10) || 0));
                if (level === 0) {
                    this.loadout.houseRooms.delete(room.hrid);
                } else {
                    this.loadout.houseRooms.set(room.hrid, { houseRoomHrid: room.hrid, level });
                }
                input.value = level;
            });
            row.appendChild(input);
            container.appendChild(row);
        }

        return container;
    }

    renderCommunityBuffFields() {
        const container = document.createElement('div');
        container.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px;';

        for (const buff of COMMUNITY_BUFF_TYPES) {
            const row = fieldRow(buff.name);
            const input = styledNumberInput();
            input.min = 0;
            input.max = 20;
            input.value = this.loadout.communityBuffLevels[buff.hrid] ?? 0;
            input.addEventListener('change', () => {
                const level = Math.max(0, parseInt(input.value, 10) || 0);
                this.loadout.communityBuffLevels[buff.hrid] = level;
                input.value = level;
            });
            row.appendChild(input);
            container.appendChild(row);
        }

        return container;
    }

    // -------------------------------------------------------------------------
    // Results tab
    // -------------------------------------------------------------------------

    renderResultsTab(body) {
        const calcBtn = document.createElement('button');
        calcBtn.textContent = 'Calculate Best Profit/hr';
        calcBtn.style.cssText = `
            padding: 8px 16px;
            margin-bottom: 12px;
            background: ${config.COLOR_ACCENT};
            color: #fff;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
            font-size: 13px;
        `;
        calcBtn.addEventListener('click', () => {
            this.results = computeTopResults(this.loadout, TOP_N);
            this.renderContent();
        });
        body.appendChild(calcBtn);

        if (!this.results) {
            const hint = document.createElement('div');
            hint.textContent = 'Click "Calculate" to see the top 3 profit/hr actions per skill for the loadout above.';
            hint.style.cssText = 'color: #888; font-size: 13px;';
            body.appendChild(hint);
            return;
        }

        for (const skill of SKILLS) {
            const entries = this.results[skill] || [];
            body.appendChild(this.renderSkillSection(skill, entries));
        }
    }

    renderSkillSection(skill, entries) {
        const section = document.createElement('div');
        section.style.cssText = 'margin-bottom: 16px;';

        const heading = document.createElement('div');
        heading.textContent = capitalize(skill);
        heading.style.cssText = 'color: #fff; font-weight: 700; margin-bottom: 4px; font-size: 14px;';
        section.appendChild(heading);

        if (entries.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'No profitable actions found';
            empty.style.cssText = 'color: #888; font-size: 13px; padding-left: 8px;';
            section.appendChild(empty);
            return section;
        }

        const list = document.createElement('div');
        list.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

        entries.forEach((entry) => {
            const row = document.createElement('div');
            row.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                padding: 4px 8px;
                background: #1f1f1f;
                border-radius: 4px;
                color: #ddd;
                font-size: 13px;
            `;

            const left = document.createElement('div');
            const name = document.createElement('span');
            name.textContent = entry.name;
            left.appendChild(name);

            const teaNames = (entry.teaHrids || []).map((hrid) => dataManager.getItemDetails(hrid)?.name || hrid);
            if (teaNames.length > 0) {
                const teaSub = document.createElement('div');
                teaSub.textContent = `Teas: ${teaNames.join(', ')}`;
                teaSub.style.cssText = 'color: #888; font-size: 10px; margin-top: 2px;';
                left.appendChild(teaSub);
            }

            const value = document.createElement('span');
            value.style.color = config.COLOR_ACCENT;
            value.style.whiteSpace = 'nowrap';
            value.textContent = `${formatKMB(entry.profitPerHour, 1)}/hr`;
            row.appendChild(left);
            row.appendChild(value);
            list.appendChild(row);
        });

        section.appendChild(list);
        return section;
    }

    disable() {
        if (this.button) {
            this.button.remove();
            this.button = null;
        }
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
        this.isInitialized = false;
    }
}

const skillOptimizerPopup = new SkillOptimizerPopup();

config.onSettingChange('skillOptimizerPopup', (value) => {
    if (value) {
        skillOptimizerPopup.initialize();
    } else {
        skillOptimizerPopup.disable();
    }
});

export default skillOptimizerPopup;

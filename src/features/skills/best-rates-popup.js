/**
 * Best Rates Popup
 * Floating button that opens a modal listing the top profit/hr and Eff. XP/hr methods per
 * skill, computed from the player's current equipment and the optimal tea combo per goal.
 */

import config from '../../core/config.js';
import dataManager from '../../core/data-manager.js';
import teaOptimizer from '../../utils/tea-optimizer.js';
import { formatKMB } from '../../utils/formatters.js';

const SKILLS = [
    'milking',
    'foraging',
    'woodcutting',
    'cheesesmithing',
    'crafting',
    'tailoring',
    'cooking',
    'brewing',
    'alchemy',
];

const TOP_N = 5;

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Compute gold-neutral "Eff. XP/hr" for a set of action rates, matching the formula used
 * elsewhere in the tool (see gathering-stats.js / max-produceable.js): actions that already
 * profit keep their raw XP/hr; actions that lose gold have their XP discounted by how much
 * time-equivalent it would take on the best-profit action here to recover that loss. Actions
 * with no profitable action to recover against are excluded entirely.
 * @param {Array<{xpPerHour: number, profitPerHour: number}>} rates
 * @returns {Array} rates with an added effectiveXpPerHour field, unprofitable-with-no-recovery entries dropped
 */
function computeEffectiveXpRates(rates) {
    const validRates = rates.filter((r) => r.xpPerHour > 0);
    if (validRates.length === 0) return [];

    let bestProfit = -Infinity;
    let bestProfitExp = 0;
    for (const r of validRates) {
        if (r.profitPerHour > bestProfit) {
            bestProfit = r.profitPerHour;
            bestProfitExp = r.xpPerHour;
        }
    }

    const results = [];
    for (const r of validRates) {
        let effectiveXpPerHour;
        if (r.profitPerHour >= 0) {
            effectiveXpPerHour = r.xpPerHour;
        } else if (bestProfit > 0) {
            const loss = Math.abs(r.profitPerHour);
            const recoveryRatio = loss / bestProfit;
            effectiveXpPerHour = (r.xpPerHour + recoveryRatio * bestProfitExp) / (1 + recoveryRatio);
        } else {
            continue;
        }
        results.push({ ...r, effectiveXpPerHour });
    }
    return results;
}

/**
 * Score actions on both profit/hr and XP/hr at once, anchored to the best-profit action's own
 * numbers: an action's score is (its profit / best profit) + (its XP / best profit's XP). A
 * 5% profit loss paired with a 10% XP gain over the best-profit action nets a higher score and
 * wins. Evaluates each action under both the profit-optimal and XP-optimal tea combos and keeps
 * whichever combo scores higher per action, since a player could equip either.
 * @param {Array} goldRates - getSkillActionRates(..., 'gold') result
 * @param {Array} xpRates - getSkillActionRates(..., 'xp') result
 * @returns {Array} one best-scoring entry per action, with an added balancedScore field
 */
function computeBalancedRates(goldRates, xpRates) {
    const profitable = goldRates.filter((r) => r.profitPerHour > 0);
    if (profitable.length === 0) return [];

    let bestProfitEntry = profitable[0];
    for (const r of profitable) {
        if (r.profitPerHour > bestProfitEntry.profitPerHour) bestProfitEntry = r;
    }
    const bestProfit = bestProfitEntry.profitPerHour;
    const bestProfitExp = bestProfitEntry.xpPerHour;

    const variants = [...goldRates, ...xpRates].filter((r) => r.xpPerHour > 0);
    const scored = variants.map((r) => ({
        ...r,
        balancedScore: r.profitPerHour / bestProfit + (bestProfitExp > 0 ? r.xpPerHour / bestProfitExp : 0),
    }));

    const bestByHrid = new Map();
    for (const entry of scored) {
        const existing = bestByHrid.get(entry.hrid);
        if (!existing || entry.balancedScore > existing.balancedScore) {
            bestByHrid.set(entry.hrid, entry);
        }
    }

    return Array.from(bestByHrid.values());
}

function getPlayerLevel(skillName) {
    const skills = dataManager.getSkills();
    const skillHrid = `/skills/${skillName}`;
    for (const skill of skills || []) {
        if (skill.skillHrid === skillHrid) return skill.level;
    }
    return 1;
}

class BestRatesPopup {
    constructor() {
        this.isInitialized = false;
        this.button = null;
        this.modal = null;
        this.activeTab = 'profit';
    }

    initialize() {
        if (this.isInitialized) return;
        if (!config.getSetting('bestRatesPopup')) return;

        this.isInitialized = true;
        this.createButton();
    }

    createButton() {
        if (document.getElementById('mwi-best-rates-btn')) return;

        const button = document.createElement('button');
        button.id = 'mwi-best-rates-btn';
        button.textContent = '📊 Best Rates';
        button.style.cssText = `
            position: fixed;
            bottom: 12px;
            left: 12px;
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
            width: 600px;
            max-width: 95%;
            max-height: 85%;
            overflow: auto;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        `;
        const title = document.createElement('h2');
        title.textContent = 'Best Rates';
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

        const profitTab = this.createTabButton('Best Profit/hr', 'profit');
        const xpTab = this.createTabButton('Best XP/hr', 'xp');
        const balancedTab = this.createTabButton('Balanced', 'balanced');
        tabs.appendChild(profitTab);
        tabs.appendChild(xpTab);
        tabs.appendChild(balancedTab);

        const body = document.createElement('div');
        body.className = 'mwi-best-rates-body';

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
        const tabsContainer = this.modal.querySelectorAll('button[data-tab]');
        tabsContainer.forEach((btn) => this.styleTabButton(btn, btn.dataset.tab));

        const body = this.modal.querySelector('.mwi-best-rates-body');
        while (body.firstChild) body.removeChild(body.firstChild);

        if (this.activeTab === 'profit') {
            this.renderProfitTab(body);
        } else if (this.activeTab === 'xp') {
            this.renderXpTab(body);
        } else {
            this.renderBalancedTab(body);
        }
    }

    renderProfitTab(body) {
        for (const skill of SKILLS) {
            const playerLevel = getPlayerLevel(skill);
            const rates = teaOptimizer.getSkillActionRates(skill, playerLevel, 'gold');
            const top = rates
                .filter((r) => r.profitPerHour > 0)
                .sort((a, b) => b.profitPerHour - a.profitPerHour)
                .slice(0, TOP_N);

            body.appendChild(this.renderSkillSection(skill, top, (r) => `${formatKMB(r.profitPerHour, 1)}/hr`));
        }
    }

    renderXpTab(body) {
        for (const skill of SKILLS) {
            const playerLevel = getPlayerLevel(skill);
            const rates = teaOptimizer.getSkillActionRates(skill, playerLevel, 'xp');
            const top = computeEffectiveXpRates(rates)
                .sort((a, b) => b.effectiveXpPerHour - a.effectiveXpPerHour)
                .slice(0, TOP_N);

            body.appendChild(
                this.renderSkillSection(skill, top, (r) => {
                    const costText =
                        r.profitPerHour < 0 ? ` (-${formatKMB(Math.abs(r.profitPerHour), 1)}/hr cost)` : '';
                    return `${formatKMB(r.effectiveXpPerHour, 1)} Eff. XP/hr${costText}`;
                })
            );
        }
    }

    renderBalancedTab(body) {
        for (const skill of SKILLS) {
            const playerLevel = getPlayerLevel(skill);
            const goldRates = teaOptimizer.getSkillActionRates(skill, playerLevel, 'gold');
            const xpRates = teaOptimizer.getSkillActionRates(skill, playerLevel, 'xp');
            const top = computeBalancedRates(goldRates, xpRates)
                .sort((a, b) => b.balancedScore - a.balancedScore)
                .slice(0, TOP_N);

            body.appendChild(
                this.renderSkillSection(
                    skill,
                    top,
                    (r) => `${formatKMB(r.profitPerHour, 1)}/hr, ${formatKMB(r.xpPerHour, 1)} XP/hr`,
                    { perEntryTeas: true }
                )
            );
        }
    }

    renderSkillSection(skill, entries, formatValue, options = {}) {
        const { perEntryTeas = false } = options;
        const section = document.createElement('div');
        section.style.cssText = 'margin-bottom: 16px;';

        const heading = document.createElement('div');
        heading.textContent = capitalize(skill);
        heading.style.cssText = 'color: #fff; font-weight: 700; margin-bottom: 2px; font-size: 14px;';
        section.appendChild(heading);

        if (entries.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'No data available';
            empty.style.cssText = 'color: #888; font-size: 13px; padding-left: 8px;';
            section.appendChild(empty);
            return section;
        }

        if (!perEntryTeas) {
            const teaHrids = entries[0]?.teaHrids || [];
            if (teaHrids.length > 0) {
                const teaNames = teaHrids.map((hrid) => dataManager.getItemDetails(hrid)?.name || hrid);
                const teaLine = document.createElement('div');
                teaLine.textContent = `Teas: ${teaNames.join(', ')}`;
                teaLine.style.cssText = 'color: #888; font-size: 11px; margin-bottom: 6px;';
                section.appendChild(teaLine);
            }
        }

        const list = document.createElement('div');
        list.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

        entries.forEach((entry) => {
            const row = document.createElement('div');
            row.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: ${perEntryTeas ? 'flex-start' : 'center'};
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

            if (perEntryTeas) {
                const teaNames = (entry.teaHrids || []).map((hrid) => dataManager.getItemDetails(hrid)?.name || hrid);
                if (teaNames.length > 0) {
                    const teaSub = document.createElement('div');
                    teaSub.textContent = `Teas: ${teaNames.join(', ')}`;
                    teaSub.style.cssText = 'color: #888; font-size: 10px; margin-top: 2px;';
                    left.appendChild(teaSub);
                }
            }

            const value = document.createElement('span');
            value.style.color = config.COLOR_ACCENT;
            value.style.whiteSpace = 'nowrap';
            value.textContent = formatValue(entry);
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

const bestRatesPopup = new BestRatesPopup();

config.onSettingChange('bestRatesPopup', (value) => {
    if (value) {
        bestRatesPopup.initialize();
    } else {
        bestRatesPopup.disable();
    }
});

export default bestRatesPopup;

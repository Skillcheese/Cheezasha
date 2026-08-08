/**
 * Crafting Plan Display
 * Renders the buy-vs-craft decision tree in action panels.
 * Shows a summary comparison plus a shopping list of materials to buy.
 */

import config from '../../core/config.js';
import domObserver from '../../core/dom-observer.js';
import dataManager from '../../core/data-manager.js';
import webSocketHook from '../../core/websocket.js';
import { computeBestCraftingPlan } from './crafting-plan-calculator.js';
import { getItemPrice } from '../../utils/market-data.js';
import { createCollapsibleSection } from '../../utils/ui-components.js';
import { formatKMB, formatWithSeparator, timeReadable } from '../../utils/formatters.js';
import { getActionHridFromName } from '../../utils/game-lookups.js';
import { findActionInput, attachInputListeners } from '../../utils/action-panel-helper.js';
import {
    createMaterialTab,
    removeMaterialTabs,
    setupMarketplaceCleanupObserver,
    navigateToMarketplace,
    updateTabBadge,
} from '../../utils/marketplace-tabs.js';
import { createAutofillManager } from '../../utils/marketplace-autofill.js';
import { calculateActionStats } from '../../utils/action-calculator.js';
import { calculateEfficiencyMultiplier } from '../../utils/efficiency.js';
import { calculateExpPerHour } from '../../utils/experience-calculator.js';
import { setReactInputValue } from '../../utils/react-input.js';
import { createTimerRegistry } from '../../utils/timer-registry.js';

const UI_ID = 'mwi-crafting-plan';

const PRICING_MODES = [
    { value: 'conservative', label: 'Instant Buy' },
    { value: 'hybrid', label: 'Instant Buy / Patient Sell' },
    { value: 'optimistic', label: 'Patient Buy / Patient Sell' },
    { value: 'patientBuy', label: 'Patient Buy' },
];
const craftingPlanTabs = [];
let cleanupObserver = null;
const autofillManager = createAutofillManager('CraftingPlan');
const timerRegistry = createTimerRegistry();
let storedActionHrid = null;
let storedNumActions = 0;
let storedBuyItems = null;
let inventoryUpdateHandler = null;
let tabsPollInterval = null;
let lastMissingMaterials = [];

const PRODUCTION_TYPES = [
    '/action_types/brewing',
    '/action_types/cooking',
    '/action_types/cheesesmithing',
    '/action_types/crafting',
    '/action_types/tailoring',
];

/**
 * Get action HRID from panel element.
 * @param {HTMLElement} panel
 * @returns {string|null}
 */
function getActionHridFromPanel(panel) {
    const nameEl = panel.querySelector('[class*="SkillActionDetail_name"]');
    if (!nameEl) return null;
    const actionName = Array.from(nameEl.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent)
        .join('')
        .trim();
    return getActionHridFromName(actionName);
}

/**
 * Get the primary output item for an action.
 * @param {Object} actionDetail
 * @returns {{ itemHrid: string, count: number }|null}
 */
function getPrimaryOutput(actionDetail) {
    if (!actionDetail?.outputItems?.length) return null;
    return actionDetail.outputItems[0];
}

/**
 * Get the pricing mode from user settings.
 * @returns {string}
 */
function getPricingMode() {
    return config.getSetting('profitCalc_pricingMode') || 'ask';
}

/**
 * Collect all leaf "buy" items from the plan tree into a flat shopping list.
 * Aggregates quantities for the same item across branches.
 * @param {Object} node - CraftingPlanNode
 * @param {Map} buyItems - Map of itemHrid → { itemName, quantity, unitCost, totalCost }
 */
function collectBuyItems(node, buyItems) {
    if (node.strategy === 'buy') {
        const existing = buyItems.get(node.itemHrid);
        if (existing) {
            existing.quantity += node.quantity;
            existing.totalCost += node.totalCost;
        } else {
            buyItems.set(node.itemHrid, {
                itemName: node.itemName,
                quantity: node.quantity,
                unitCost: node.unitCost,
                totalCost: node.totalCost,
            });
        }
        return;
    }

    for (const child of node.children) {
        collectBuyItems(child, buyItems);
    }
}

/**
 * Collect all "craft" steps from the plan tree, merging every instance of the
 * same recipe (e.g. cheese needed by several sub-recipes) into a single
 * combined step, and ordering the result so that steps sharing the same
 * production category (e.g. all cheese items anywhere in the plan) are
 * grouped together as much as possible, while still respecting dependencies
 * (an item's ingredients are always scheduled before it).
 * @param {Object} root - CraftingPlanNode
 * @returns {Array} Ordered, de-duplicated craft steps
 */
function collectCraftSteps(root) {
    // Flatten the tree into craft-only node instances with dependency edges
    // (an instance depends on its direct craft children).
    const instances = [];
    function visit(node) {
        const deps = [];
        for (const child of node.children) {
            if (child.strategy === 'craft' && child.actionHrid) {
                deps.push(visit(child));
            }
        }
        const id = instances.length;
        instances.push({ node, deps });
        return id;
    }
    visit(root);

    // Merge every instance of the same recipe (actionHrid) into one group,
    // summing quantities and combining dependency edges.
    const groupKeys = []; // instanceId -> groupKey
    const groups = new Map(); // groupKey -> { itemName, actionHrid, category, quantity, actionsNeeded, deps: Set }
    for (const { node, deps } of instances) {
        const key = node.actionHrid;
        groupKeys.push(key);
        let group = groups.get(key);
        if (!group) {
            group = {
                itemName: node.itemName,
                actionHrid: node.actionHrid,
                category: node.actionCategory || node.actionHrid,
                quantity: 0,
                actionsNeeded: 0,
                deps: new Set(),
            };
            groups.set(key, group);
        }
        group.quantity += node.quantity;
        group.actionsNeeded += node.actionsNeeded;
        for (const depId of deps) {
            const depKey = groupKeys[depId];
            if (depKey !== key) group.deps.add(depKey);
        }
    }

    const groupKeyList = [...groups.keys()];
    const indexOf = new Map(groupKeyList.map((key, i) => [key, i]));
    const taskNodes = groupKeyList.map((key) => groups.get(key));

    // Kahn-style topological scheduling that prefers to keep scheduling from
    // the current category before switching to a new one.
    const indegree = taskNodes.map((t) => t.deps.size);
    const dependents = taskNodes.map(() => []);
    taskNodes.forEach((t, id) => {
        for (const depKey of t.deps) {
            dependents[indexOf.get(depKey)].push(id);
        }
    });

    const remaining = new Set(taskNodes.map((_, id) => id));
    const orderedIds = [];
    let currentCategory = null;

    while (remaining.size > 0) {
        let chosen = null;
        if (currentCategory !== null) {
            for (const id of remaining) {
                if (indegree[id] === 0 && taskNodes[id].category === currentCategory) {
                    chosen = id;
                    break;
                }
            }
        }
        if (chosen === null) {
            for (const id of remaining) {
                if (indegree[id] === 0) {
                    chosen = id;
                    break;
                }
            }
        }
        if (chosen === null) break; // Safety net; shouldn't happen (would indicate a cycle)

        orderedIds.push(chosen);
        remaining.delete(chosen);
        currentCategory = taskNodes[chosen].category;
        for (const dependentId of dependents[chosen]) {
            indegree[dependentId]--;
        }
    }

    return orderedIds.map((id) => {
        const t = taskNodes[id];
        return {
            itemName: t.itemName,
            quantity: Math.ceil(t.quantity),
            actionsNeeded: t.actionsNeeded,
            actionHrid: t.actionHrid,
        };
    });
}

/**
 * Create a styled row with left label and right value.
 * @param {string} leftText
 * @param {string} rightText
 * @param {Object} [options]
 * @returns {HTMLElement}
 */
function createRow(leftText, rightText, options = {}) {
    const row = document.createElement('div');
    row.style.cssText = `
        display: flex;
        justify-content: space-between;
        gap: 8px;
        padding: 2px 0;
    `;

    const left = document.createElement('span');
    left.style.cssText = 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
    left.textContent = leftText;
    if (options.leftColor) left.style.color = options.leftColor;

    const right = document.createElement('span');
    right.style.cssText = 'flex-shrink: 0; white-space: nowrap;';
    right.textContent = rightText;
    if (options.rightColor) right.style.color = options.rightColor;

    row.appendChild(left);
    row.appendChild(right);
    return row;
}

/**
 * Build the full crafting plan UI for an action.
 * @param {string} actionHrid
 * @param {Function} [onToggle] - Callback when buy-intermediates toggle changes
 * @param {boolean} [defaultOpen=false] - Whether the section should be open
 * @returns {HTMLElement|null}
 */
function buildPlanUI(actionHrid, onToggle, defaultOpen = false, actionCount = 1) {
    const gameData = dataManager.getInitClientData();
    const actionDetail = gameData?.actionDetailMap?.[actionHrid];
    if (!actionDetail) return null;

    // Only production actions
    if (!PRODUCTION_TYPES.includes(actionDetail.type)) return null;

    const output = getPrimaryOutput(actionDetail);
    if (!output) return null;

    const mode = getPricingMode();
    const buyIntermediates = config.getSetting('actionPanel_craftingPlanBuyIntermediates');
    const noProcessing = config.getSetting('actionPanel_craftingPlanNoProcessing');
    const taskMode = config.getSetting('actionPanel_craftingPlanTaskMode');
    const timeCostEnabled = config.getSetting('actionPanel_craftingPlanTimeCost');
    const goldPerHour = config.getSetting('actionPanel_craftingPlanGoldPerHour') || 0;
    const totalQuantity = Math.max(1, actionCount) * (output.count || 1);
    let plan;
    try {
        plan = computeBestCraftingPlan(
            output.itemHrid,
            totalQuantity,
            mode,
            new Set(),
            new Map(),
            0,
            undefined,
            buyIntermediates,
            taskMode,
            timeCostEnabled ? goldPerHour : 0,
            noProcessing
        );
    } catch (e) {
        console.error('[CraftingPlan] computeBestCraftingPlan error:', e);
        return null;
    }

    // Don't show if item has no production recipe (true raw material)
    if (plan.craftCost === null) return null;

    // Build content
    const content = document.createElement('div');

    // === Summary comparison ===
    const unitCostText = plan.unitCost === Infinity ? '?' : formatWithSeparator(Math.round(plan.unitCost));
    const buyText = plan.buyPrice !== null ? formatWithSeparator(Math.round(plan.buyPrice)) : 'N/A';
    const craftText = plan.craftCost !== null ? formatWithSeparator(Math.round(plan.craftCost)) : 'N/A';
    const strategyText = plan.strategy === 'buy' ? 'Buy from market' : 'Craft from materials';

    const summary = document.createElement('div');
    summary.style.cssText = 'margin-bottom: 6px;';
    summary.innerHTML = `
        <div style="display: flex; justify-content: space-between; color: var(--text-color-primary, #fff);">
            <span>Optimal: <strong>${strategyText}</strong></span>
            <span>${unitCostText}/ea</span>
        </div>
        <div style="display: flex; justify-content: space-between; color: var(--text-color-secondary, #888); font-size: 0.9em;">
            <span>Market buy: ${buyText}</span>
            <span>Craft cost: ${craftText}</span>
        </div>
    `;
    content.appendChild(summary);

    // === Pricing mode toggle ===
    const currentMode = PRICING_MODES.find((m) => m.value === mode) || PRICING_MODES[0];
    const pricingRow = document.createElement('div');
    pricingRow.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.85em;
        color: var(--text-color-secondary, #888);
        margin-bottom: 4px;
    `;
    const pricingLabel = document.createElement('span');
    pricingLabel.textContent = 'Pricing:';
    const pricingBtn = document.createElement('button');
    pricingBtn.textContent = currentMode.label;
    pricingBtn.style.cssText = `
        font-size: 0.85em;
        padding: 1px 6px;
        background: var(--bg-color-tertiary, #1a1a1a);
        color: var(--text-color-secondary, #ccc);
        border: 1px solid var(--border-color, #444);
        border-radius: 3px;
        cursor: pointer;
    `;
    pricingBtn.addEventListener('click', () => {
        const idx = PRICING_MODES.findIndex((m) => m.value === mode);
        const next = PRICING_MODES[(idx + 1) % PRICING_MODES.length];
        config.setSetting('profitCalc_pricingMode', next.value);
        if (onToggle) onToggle();
    });
    pricingRow.appendChild(pricingLabel);
    pricingRow.appendChild(pricingBtn);
    content.appendChild(pricingRow);

    // === Buy intermediates toggle ===
    const toggleRow = document.createElement('label');
    toggleRow.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.85em;
        color: var(--text-color-secondary, #888);
        cursor: pointer;
        margin-bottom: 4px;
    `;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = buyIntermediates;
    checkbox.style.cssText = 'margin: 0; cursor: pointer;';
    checkbox.addEventListener('change', () => {
        config.setSetting('actionPanel_craftingPlanBuyIntermediates', checkbox.checked);
        if (onToggle) onToggle();
    });
    toggleRow.appendChild(checkbox);
    toggleRow.appendChild(document.createTextNode('Buy raw materials only'));
    content.appendChild(toggleRow);

    // === No processing toggle ===
    const noProcessingRow = document.createElement('label');
    noProcessingRow.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.85em;
        color: var(--text-color-secondary, #888);
        cursor: pointer;
        margin-bottom: 4px;
    `;
    const noProcessingCheckbox = document.createElement('input');
    noProcessingCheckbox.type = 'checkbox';
    noProcessingCheckbox.checked = noProcessing;
    noProcessingCheckbox.style.cssText = 'margin: 0; cursor: pointer;';
    noProcessingCheckbox.addEventListener('change', () => {
        config.setSetting('actionPanel_craftingPlanNoProcessing', noProcessingCheckbox.checked);
        if (onToggle) onToggle();
    });
    noProcessingRow.appendChild(noProcessingCheckbox);
    noProcessingRow.appendChild(document.createTextNode('No processing (buy intermediates)'));
    content.appendChild(noProcessingRow);

    // === Task mode toggle ===
    const taskToggleRow = document.createElement('label');
    taskToggleRow.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.85em;
        color: var(--text-color-secondary, #888);
        cursor: pointer;
        margin-bottom: 4px;
    `;
    const taskCheckbox = document.createElement('input');
    taskCheckbox.type = 'checkbox';
    taskCheckbox.checked = taskMode;
    taskCheckbox.style.cssText = 'margin: 0; cursor: pointer;';
    taskCheckbox.addEventListener('change', () => {
        config.setSetting('actionPanel_craftingPlanTaskMode', taskCheckbox.checked);
        if (onToggle) onToggle();
    });
    taskToggleRow.appendChild(taskCheckbox);
    taskToggleRow.appendChild(document.createTextNode('Task mode (force last step)'));
    content.appendChild(taskToggleRow);

    // === Time cost toggle ===
    const timeCostRow = document.createElement('label');
    timeCostRow.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.85em;
        color: var(--text-color-secondary, #888);
        cursor: pointer;
        margin-bottom: 4px;
    `;
    const timeCostCheckbox = document.createElement('input');
    timeCostCheckbox.type = 'checkbox';
    timeCostCheckbox.checked = timeCostEnabled;
    timeCostCheckbox.style.cssText = 'margin: 0; cursor: pointer;';
    timeCostRow.appendChild(timeCostCheckbox);
    timeCostRow.appendChild(document.createTextNode('Factor in time cost'));

    const goldInput = document.createElement('input');
    goldInput.type = 'number';
    goldInput.value = goldPerHour || '';
    goldInput.placeholder = '500000';
    goldInput.style.cssText = `
        width: 80px; margin-left: auto; padding: 2px 4px;
        background: var(--input-bg, #1a1a2e); border: 1px solid var(--border-color, #333);
        border-radius: 3px; color: var(--text-color-primary, #fff); font-size: 0.85em;
    `;
    goldInput.style.display = timeCostEnabled ? '' : 'none';
    const goldLabel = document.createElement('span');
    goldLabel.textContent = 'gold/hr';
    goldLabel.style.fontSize = '0.85em';
    goldLabel.style.display = timeCostEnabled ? '' : 'none';

    timeCostCheckbox.addEventListener('change', () => {
        config.setSetting('actionPanel_craftingPlanTimeCost', timeCostCheckbox.checked);
        goldInput.style.display = timeCostCheckbox.checked ? '' : 'none';
        goldLabel.style.display = timeCostCheckbox.checked ? '' : 'none';
        if (onToggle) onToggle();
    });
    goldInput.addEventListener('change', () => {
        config.setSetting('actionPanel_craftingPlanGoldPerHour', parseInt(goldInput.value) || 0);
        if (onToggle) onToggle();
    });

    timeCostRow.appendChild(goldInput);
    timeCostRow.appendChild(goldLabel);
    content.appendChild(timeCostRow);

    // Only show breakdown if crafting is the optimal strategy
    if (plan.strategy !== 'craft' || plan.children.length === 0) {
        const costText = plan.unitCost === Infinity ? '?' : `${formatKMB(Math.round(plan.unitCost))}/ea`;
        const section = createCollapsibleSection('', 'Best Crafting Plan', costText, content, defaultOpen, 0);
        section.id = UI_ID;
        section.className = 'mwi-crafting-plan-section';
        return section;
    }

    // === Shopping List (what to buy) ===
    const buyItems = new Map();
    collectBuyItems(plan, buyItems);

    // Only list what's actually missing - subtract what's already in inventory
    const missingBuyItems = computeMissingMaterialsFromBuyItems(buyItems, { includeUntradeable: true });

    if (missingBuyItems.length > 0) {
        const divider = document.createElement('div');
        divider.style.cssText = 'border-top: 1px solid var(--border-color, #333); margin: 6px 0;';
        content.appendChild(divider);

        const shoppingHeader = document.createElement('div');
        shoppingHeader.style.cssText = `
            font-weight: 500;
            color: var(--text-color-primary, #fff);
            margin-bottom: 4px;
        `;
        shoppingHeader.textContent = 'Shopping List';
        content.appendChild(shoppingHeader);

        // Sort by total cost descending
        const sortedItems = [...missingBuyItems].sort((a, b) => b.totalCost - a.totalCost);

        for (const item of sortedItems) {
            const qty = Math.ceil(item.missing);
            const cost = formatKMB(Math.round(item.totalCost));
            const unit = formatWithSeparator(Math.round(item.unitCost));
            content.appendChild(createRow(`${item.itemName} x${formatWithSeparator(qty)}`, `${cost} (${unit}/ea)`));
        }

        // Total buy cost
        const totalBuyCost = sortedItems.reduce((sum, item) => sum + item.totalCost, 0);
        const totalRow = createRow('Total material cost', formatWithSeparator(Math.round(totalBuyCost)), {
            leftColor: 'var(--text-color-primary, #fff)',
        });
        totalRow.style.borderTop = '1px solid var(--border-color, #333)';
        totalRow.style.marginTop = '4px';
        totalRow.style.paddingTop = '4px';
        content.appendChild(totalRow);

        // === Buy Missing Materials button ===
        const buyButton = document.createElement('button');
        buyButton.textContent = 'Buy Missing Materials';
        buyButton.style.cssText = `
            width: 100%; margin-top: 6px; padding: 6px;
            background: linear-gradient(135deg, #1e40af, #3b82f6);
            border: 1px solid #60a5fa; border-radius: 4px;
            color: white; cursor: pointer; font-size: 0.85em;
        `;
        buyButton.addEventListener('click', async (e) => {
            const panel = e.currentTarget.closest('[class*="SkillActionDetail_skillActionDetail"]');
            const inputField = findActionInput(panel);
            const numActions = parseInt(inputField?.value, 10) || 1;

            const missingMaterials = computeMissingMaterialsFromBuyItems(buyItems);
            if (missingMaterials.length === 0) return;

            storedActionHrid = actionHrid;
            storedNumActions = numActions;
            storedBuyItems = buyItems;

            // Navigate to marketplace via navbar click
            const navButtons = document.querySelectorAll('.NavigationBar_nav__3uuUl');
            const marketplaceButton = Array.from(navButtons).find((nav) => {
                const svg = nav.querySelector('svg[aria-label="navigationBar.marketplace"]');
                return svg !== null;
            });
            if (!marketplaceButton) return;
            marketplaceButton.click();

            // Wait for marketplace to appear
            for (let i = 0; i < 50; i++) {
                const tabsContainer = document.querySelector('.MuiTabs-flexContainer[role="tablist"]');
                if (tabsContainer) {
                    const hasMarketListings = Array.from(tabsContainer.children).some((btn) =>
                        btn.textContent.includes('Market Listings')
                    );
                    if (hasMarketListings) break;
                }
                await new Promise((resolve) => setTimeout(resolve, 100));
            }

            await new Promise((resolve) => setTimeout(resolve, 200));
            // Recalculate fresh (inventory may have changed since the button was rendered)
            const freshMaterials = computeMissingMaterialsFromBuyItems(buyItems);
            createCraftingPlanTabs(freshMaterials);
            setupInventoryListener();
        });
        content.appendChild(buyButton);
    }

    // === Crafting Steps (what to craft, in order) ===
    const craftSteps = collectCraftSteps(plan);

    if (craftSteps.length > 0) {
        const divider2 = document.createElement('div');
        divider2.style.cssText = 'border-top: 1px solid var(--border-color, #333); margin: 6px 0;';
        content.appendChild(divider2);

        const stepsHeader = document.createElement('div');
        stepsHeader.style.cssText = `
            font-weight: 500;
            color: var(--text-color-primary, #fff);
            margin-bottom: 4px;
        `;
        stepsHeader.textContent = 'Crafting Steps';
        content.appendChild(stepsHeader);

        const gameData = dataManager.getInitClientData();
        const skills = dataManager.getSkills();
        const equipment = dataManager.getEquipment();
        let totalCraftSeconds = 0;
        let totalXP = 0;

        for (let i = 0; i < craftSteps.length; i++) {
            const step = craftSteps[i];
            const qty = formatWithSeparator(step.quantity);
            let timeStr = '';
            let xpStr = '';
            if (step.actionHrid) {
                const actionDetails = gameData?.actionDetailMap?.[step.actionHrid];
                if (actionDetails) {
                    const stats = calculateActionStats(actionDetails, {
                        skills,
                        equipment,
                        itemDetailMap: gameData.itemDetailMap,
                    });
                    const effMultiplier = calculateEfficiencyMultiplier(stats.totalEfficiency);
                    const totalSeconds = (stats.actionTime * step.actionsNeeded) / effMultiplier;
                    totalCraftSeconds += totalSeconds;
                    timeStr = ` (${timeReadable(totalSeconds)}`;
                }
                const expData = calculateExpPerHour(step.actionHrid);
                if (expData?.expPerHour > 0 && expData.actionsPerHour > 0) {
                    const xpPerAction = expData.expPerHour / expData.actionsPerHour;
                    totalXP += xpPerAction * step.actionsNeeded;
                    xpStr = ` · ${formatKMB(expData.expPerHour)} xp/hr`;
                }
                if (timeStr) {
                    timeStr += `${xpStr})`;
                } else if (xpStr) {
                    timeStr = ` (${xpStr.slice(3)})`;
                }
            }
            content.appendChild(createRow(`${i + 1}. ${step.itemName}`, `x${qty}${timeStr}`));
        }

        if (totalCraftSeconds > 0) {
            const totalTimeRow = createRow('Total craft time', timeReadable(totalCraftSeconds), {
                leftColor: 'var(--text-color-primary, #fff)',
            });
            totalTimeRow.style.borderTop = '1px solid var(--border-color, #333)';
            totalTimeRow.style.marginTop = '4px';
            totalTimeRow.style.paddingTop = '4px';
            content.appendChild(totalTimeRow);
        }

        if (totalXP > 0) {
            content.appendChild(
                createRow('Total XP', formatKMB(Math.round(totalXP)), {
                    leftColor: 'var(--text-color-primary, #fff)',
                })
            );
        }

        // Profit from crafting = sell value of the crafted output minus total material/action cost
        const itemDetails = dataManager.getItemDetails(plan.itemHrid);
        if (itemDetails?.isTradable) {
            const sellPrice = getItemPrice(plan.itemHrid, { mode, context: 'profit', side: 'sell' });
            if (sellPrice !== null) {
                const profit = sellPrice * plan.quantity - plan.totalCost;
                const profitColor = profit >= 0 ? '#4ade80' : config.COLOR_LOSS;
                content.appendChild(
                    createRow('Profit from crafting', formatWithSeparator(Math.round(profit)), {
                        leftColor: 'var(--text-color-primary, #fff)',
                        rightColor: profitColor,
                    })
                );

                if (totalCraftSeconds > 0) {
                    const profitPerHour = profit * (3600 / totalCraftSeconds);
                    const profitPerHourColor = profitPerHour >= 0 ? '#4ade80' : config.COLOR_LOSS;
                    content.appendChild(
                        createRow('Profit/hr from crafting', formatWithSeparator(Math.round(profitPerHour)), {
                            leftColor: 'var(--text-color-primary, #fff)',
                            rightColor: profitPerHourColor,
                        })
                    );
                }
            }
        }
    }

    const costText = plan.unitCost === Infinity ? '?' : `${formatKMB(Math.round(plan.unitCost))}/ea`;
    const section = createCollapsibleSection('', 'Best Crafting Plan', costText, content, defaultOpen, 0);
    section.id = UI_ID;
    section.className = 'mwi-crafting-plan-section';

    return section;
}

/**
 * Get game object via React fiber tree traversal, to reach handleGoToAction.
 * @returns {Object|null} Game component instance
 */
function getGameObject() {
    const rootEl = document.getElementById('root');
    const rootFiber = rootEl?._reactRootContainer?.current || rootEl?._reactRootContainer?._internalRoot?.current;
    if (!rootFiber) return null;

    function find(fiber) {
        if (!fiber) return null;
        if (fiber.stateNode?.handleGoToAction) return fiber.stateNode;
        return find(fiber.child) || find(fiber.sibling);
    }

    return find(rootFiber);
}

/**
 * Navigate back to the stored crafting action and restore its input value.
 */
async function handleReturnToAction() {
    if (!storedActionHrid) return;

    const game = getGameObject();
    if (!game?.handleGoToAction) return;

    // Capture locally — navigating away hides the marketplace, and the cleanup
    // observer polls for that and resets the module-level stored values, which
    // would otherwise race with the delayed restore below.
    const actionHrid = storedActionHrid;
    const numActions = storedNumActions;

    game.handleGoToAction(actionHrid);

    if (numActions > 0) {
        const maxAttempts = 20;
        for (let i = 0; i < maxAttempts; i++) {
            await new Promise((resolve) => {
                const t = setTimeout(resolve, 100);
                timerRegistry.registerTimeout(t);
            });

            const input =
                document.querySelector('[class*="maxActionCountInput"] input') ||
                document.querySelector('[class*="SkillActionDetail_skillActionDetail"] input[type="number"]');
            if (input) {
                setReactInputValue(input, numActions);
                break;
            }
        }
    }
}

/**
 * Create a "Return to Craft" tab for navigating back after buying materials.
 * @param {HTMLElement} referenceTab - Tab element to clone structure from
 * @returns {HTMLElement|null} Return tab element, or null if no stored context
 */
function createReturnTab(referenceTab) {
    if (!storedActionHrid) return null;

    const details = dataManager.getActionDetails(storedActionHrid);
    let displayName = details?.name || storedActionHrid.split('/').pop();
    if (storedNumActions > 0) displayName += ` (×${formatWithSeparator(storedNumActions)})`;

    const tab = referenceTab.cloneNode(true);
    tab.setAttribute('data-mwi-custom-tab', 'true');
    tab.classList.remove('Mui-selected');
    tab.setAttribute('aria-selected', 'false');
    tab.setAttribute('tabindex', '-1');

    const badgeSpan = tab.querySelector('[class*="TabsComponent_badge"]');
    if (badgeSpan) {
        badgeSpan.innerHTML = `
            <div style="text-align: center;">
                <div>↩ Return to Craft</div>
                <div style="font-size: 0.75em; color: #60a5fa;">${displayName}</div>
            </div>
        `;
    }

    tab.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleReturnToAction();
    });

    return tab;
}

/**
 * Compute missing materials for a crafting plan's shopping list against current inventory.
 * @param {Map} buyItems - Map of itemHrid → { itemName, quantity, unitCost, totalCost }
 * @returns {Array} Array of { itemHrid, itemName, missing, required, isTradeable }
 */
function computeMissingMaterialsFromBuyItems(buyItems, { includeUntradeable = false } = {}) {
    const inventory = dataManager.getInventory() || [];

    const missingMaterials = [];
    for (const [itemHrid, item] of buyItems) {
        const needed = Math.ceil(item.quantity);
        const have = inventory
            .filter((i) => i.itemHrid === itemHrid && !i.enhancementLevel)
            .reduce((sum, i) => sum + (i.count || 0), 0);
        const missing = Math.max(0, needed - have);
        const itemDetails = dataManager.getItemDetails(itemHrid);
        const isTradeable = itemDetails?.isTradable !== false;
        if (missing > 0 && (isTradeable || includeUntradeable)) {
            missingMaterials.push({
                itemHrid,
                itemName: item.itemName,
                missing,
                required: needed,
                isTradeable,
                unitCost: item.unitCost,
                totalCost: item.unitCost * missing,
            });
        }
    }

    return missingMaterials;
}

/**
 * Setup a websocket listener that refreshes the crafting plan marketplace tabs' badges
 * whenever inventory changes (e.g. after buying a material).
 */
function setupInventoryListener() {
    if (inventoryUpdateHandler) {
        webSocketHook.off('*', inventoryUpdateHandler);
    }

    inventoryUpdateHandler = (data) => {
        if (
            data.type?.includes('item') ||
            data.type?.includes('inventory') ||
            data.type?.includes('market') ||
            data.inventory ||
            data.characterItems
        ) {
            updateCraftingPlanTabsOnInventoryChange();
        }
    };

    webSocketHook.on('*', inventoryUpdateHandler);

    // Fallback poll in case the purchase message doesn't match the wildcard filter above
    if (tabsPollInterval) {
        clearInterval(tabsPollInterval);
    }
    tabsPollInterval = setInterval(() => {
        if (craftingPlanTabs.length === 0) {
            clearInterval(tabsPollInterval);
            tabsPollInterval = null;
            return;
        }
        updateCraftingPlanTabsOnInventoryChange();
    }, 2000);
    timerRegistry.registerInterval(tabsPollInterval);
}

/**
 * Recalculate missing materials and refresh the badge on each existing crafting plan tab.
 */
function updateCraftingPlanTabsOnInventoryChange() {
    if (craftingPlanTabs.length === 0 || !storedBuyItems) {
        return;
    }

    const updatedMaterials = computeMissingMaterialsFromBuyItems(storedBuyItems);

    craftingPlanTabs.forEach((tab) => {
        const itemHrid = tab.getAttribute('data-item-hrid');
        if (!itemHrid) return;
        const material = updatedMaterials.find((m) => m.itemHrid === itemHrid);
        if (material) {
            updateTabBadge(tab, material);
        } else {
            // No longer missing (fully bought) - show as sufficient
            const originalNeeded = storedBuyItems.get(itemHrid);
            if (originalNeeded) {
                updateTabBadge(tab, {
                    itemName: originalNeeded.itemName,
                    missing: 0,
                    required: Math.ceil(originalNeeded.quantity),
                    isTradeable: true,
                });
            }
        }
    });
}

/**
 * Create marketplace tabs for crafting plan shopping list materials.
 * @param {Array} missingMaterials - Array of { itemHrid, itemName, missing, required, isTradeable }
 */
function createCraftingPlanTabs(missingMaterials) {
    lastMissingMaterials = missingMaterials;

    const tabsContainer = document.querySelector('.MuiTabs-flexContainer[role="tablist"]');
    if (!tabsContainer) return;

    removeMaterialTabs();
    craftingPlanTabs.length = 0;

    const referenceTab = Array.from(tabsContainer.children).find((btn) => btn.textContent.includes('My Listings'));
    if (!referenceTab) return;

    tabsContainer.style.flexWrap = 'wrap';

    for (const material of missingMaterials) {
        const tabRef = { tab: null };
        const handler = () => {
            autofillManager.setPendingCalculation(() => {
                return parseInt(tabRef.tab?.getAttribute('data-missing-quantity') || '0', 10);
            });
            navigateToMarketplace(material.itemHrid, 0);
        };
        const tab = createMaterialTab(material, referenceTab, handler);
        tabRef.tab = tab;
        tabsContainer.appendChild(tab);
        craftingPlanTabs.push(tab);
    }

    // Add "Return to Craft" tab at the end
    const returnTab = createReturnTab(referenceTab);
    if (returnTab) {
        tabsContainer.appendChild(returnTab);
        craftingPlanTabs.push(returnTab);
    }

    if (!cleanupObserver) {
        cleanupObserver = setupMarketplaceCleanupObserver(
            () => {
                removeMaterialTabs();
                craftingPlanTabs.length = 0;
                storedActionHrid = null;
                storedNumActions = 0;
                storedBuyItems = null;
                lastMissingMaterials = [];

                if (inventoryUpdateHandler) {
                    webSocketHook.off('*', inventoryUpdateHandler);
                    inventoryUpdateHandler = null;
                }
                if (tabsPollInterval) {
                    clearInterval(tabsPollInterval);
                    tabsPollInterval = null;
                }
                autofillManager.clearQuantity();
            },
            craftingPlanTabs,
            () => {
                // Custom tabs vanished from DOM (e.g. clicking a tab re-rendered the tab bar
                // to show that item's detail view) but the marketplace is still open —
                // re-insert the tabs instead of tearing down the inventory listener.
                if (storedActionHrid) {
                    createCraftingPlanTabs(lastMissingMaterials);
                }
            }
        );
    }
}

class CraftingPlanDisplay {
    constructor() {
        this.isInitialized = false;
        this.unregisterHandlers = [];
        this.processedPanels = new WeakSet();
        this.panelObservers = new Map();
        this.inputCleanups = new Map();
    }

    initialize() {
        if (this.isInitialized) return;
        if (!config.getSetting('actionPanel_bestCraftingPlan')) return;

        this.isInitialized = true;
        autofillManager.initialize();

        const unregister = domObserver.onClass('CraftingPlan', 'SkillActionDetail_skillActionDetail', () =>
            this._processActionPanels()
        );
        this.unregisterHandlers.push(unregister);
    }

    _processActionPanels() {
        document.querySelectorAll('[class*="SkillActionDetail_skillActionDetail"]').forEach((panel) => {
            if (this.processedPanels.has(panel)) return;

            const actionHrid = getActionHridFromPanel(panel);
            if (!actionHrid) return;

            this.processedPanels.add(panel);
            this._attachToPanel(panel, actionHrid);
        });
    }

    _attachToPanel(panel, actionHrid) {
        const inputField = findActionInput(panel);
        const getActionCount = () => {
            const val = parseInt(inputField?.value, 10);
            return val > 0 ? val : 1;
        };

        const rebuild = () => {
            const existing = panel.querySelector(`#${UI_ID}`);
            const wasOpen = existing?.querySelector('.mwi-section-header span')?.textContent === '▼';
            if (existing) existing.remove();

            const newUI = buildPlanUI(actionHrid, rebuild, wasOpen, getActionCount());
            if (!newUI) return;

            const profitSection = panel.querySelector('[data-mwi-profit-display]');
            if (profitSection) {
                profitSection.parentNode.insertBefore(newUI, profitSection);
            } else {
                panel.appendChild(newUI);
            }
        };

        const ui = buildPlanUI(actionHrid, rebuild, false, getActionCount());
        if (!ui) return;

        // attachInputListeners also fires on any click within the panel (to catch
        // quick-input-button clicks), which would otherwise destroy/recreate this
        // section — and any input inside it, like the gold/hr field — on every
        // click. Only rebuild when the action count actually changed.
        if (inputField) {
            let lastActionCount = getActionCount();
            const cleanupInput = attachInputListeners(panel, inputField, () => {
                const count = getActionCount();
                if (count === lastActionCount) return;
                lastActionCount = count;
                rebuild();
            });
            this.inputCleanups.set(panel, cleanupInput);
        }

        const position = () => {
            const existing = panel.querySelector(`#${UI_ID}`);
            // Insert before Profitability section
            const profitSection = panel.querySelector('[data-mwi-profit-display]');

            if (profitSection) {
                if (existing) {
                    if (existing.nextElementSibling !== profitSection) {
                        profitSection.parentNode.insertBefore(existing, profitSection);
                    }
                } else {
                    profitSection.parentNode.insertBefore(ui, profitSection);
                }
                return;
            }

            // Fallback: append to panel
            if (!existing) panel.appendChild(ui);
        };

        position();

        // Watch for profit section or crafting plan being added/removed
        const observeTarget = ui.parentNode || panel;
        const obs = new MutationObserver((mutations) => {
            const relevant = mutations.some((m) =>
                [...m.addedNodes, ...m.removedNodes].some(
                    (n) => n.id === UI_ID || (n.getAttribute && n.getAttribute('data-mwi-profit-display'))
                )
            );
            if (relevant) position();
        });
        obs.observe(observeTarget, { childList: true, subtree: true });
        this.panelObservers.set(panel, obs);
    }

    disable() {
        this.unregisterHandlers.forEach((fn) => fn());
        this.unregisterHandlers = [];

        document.querySelectorAll(`#${UI_ID}`).forEach((el) => el.remove());

        // Disconnect panel observers
        this.panelObservers.forEach((obs) => obs.disconnect());
        this.panelObservers = new Map();

        // Remove input listeners
        this.inputCleanups.forEach((cleanup) => cleanup());
        this.inputCleanups = new Map();

        timerRegistry.clearAll();

        if (inventoryUpdateHandler) {
            webSocketHook.off('*', inventoryUpdateHandler);
            inventoryUpdateHandler = null;
        }
        if (tabsPollInterval) {
            clearInterval(tabsPollInterval);
            tabsPollInterval = null;
        }
        if (cleanupObserver) {
            cleanupObserver();
            cleanupObserver = null;
        }
        removeMaterialTabs();
        craftingPlanTabs.length = 0;
        storedActionHrid = null;
        storedNumActions = 0;
        storedBuyItems = null;
        lastMissingMaterials = [];

        this.processedPanels = new WeakSet();
        this.isInitialized = false;
    }
}

const craftingPlanDisplay = new CraftingPlanDisplay();
export default craftingPlanDisplay;

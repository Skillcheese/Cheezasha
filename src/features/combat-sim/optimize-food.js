/**
 * Optimize Food Feature Module
 * Injects an "Optimize Food" button next to the Combat Sim button that searches food/mana-food
 * combinations for minimum deaths/hr, minimum mana-OOM time, and lowest cost among those.
 */

import config from '../../core/config.js';
import domObserver from '../../core/dom-observer.js';
import optimizeFoodUI from './optimize-food-ui.js';

const BUTTON_CLASS = 'toolasha-optimize-food-btn';

class OptimizeFood {
    constructor() {
        this.isInitialized = false;
        this.unregisterHandlers = [];
    }

    initialize() {
        if (this.isInitialized) return;
        if (!config.getSetting('combatSim')) return;

        this.isInitialized = true;

        optimizeFoodUI.buildPanel();

        const unregister = domObserver.onClass('OptimizeFoodButton', 'CombatPanel_combatPanel', (node) => {
            this._injectButton(node);
        });
        this.unregisterHandlers.push(unregister);

        const existingPanel = document.querySelector('[class*="CombatPanel_combatPanel"]');
        if (existingPanel) {
            this._injectButton(existingPanel);
        }
    }

    /**
     * Inject the Optimize Food toggle button into a combat panel, next to the other Toolasha tabs.
     * @param {HTMLElement} combatPanel - The combat panel element
     */
    _injectButton(combatPanel) {
        if (!combatPanel || combatPanel.querySelector(`.${BUTTON_CLASS}`)) {
            return;
        }

        const tabsContainer = combatPanel.querySelector('[class*="TabsComponent_tabsContainer"] > div > div > div');
        if (!tabsContainer) return;

        const button = document.createElement('div');
        button.className = 'MuiButtonBase-root MuiTab-root MuiTab-textColorPrimary css-1q2h7u5 ' + BUTTON_CLASS;
        button.textContent = 'Optimize Food';
        button.style.cssText =
            'cursor: pointer; background: linear-gradient(135deg, #4ade80, #16803f); color: #fff; border-radius: 4px; padding: 4px 10px; font-size: 12px; white-space: nowrap;';

        button.addEventListener('click', () => {
            optimizeFoodUI.toggle();
        });

        tabsContainer.appendChild(button);
    }

    disable() {
        for (const unregister of this.unregisterHandlers) {
            unregister();
        }
        this.unregisterHandlers = [];

        optimizeFoodUI.destroy();

        document.querySelectorAll(`.${BUTTON_CLASS}`).forEach((btn) => btn.remove());

        this.isInitialized = false;
    }
}

const optimizeFood = new OptimizeFood();
export default optimizeFood;

/**
 * Optimize Coffee Feature Module
 * Injects an "Optimize Coffee" button next to the Combat Sim button that
 * searches combat drink combinations for best XP/hr, coins/hr, and a mixed metric.
 */

import config from '../../core/config.js';
import domObserver from '../../core/dom-observer.js';
import optimizeCoffeeUI from './optimize-coffee-ui.js';

const BUTTON_CLASS = 'cheezasha-optimize-coffee-btn';

class OptimizeCoffee {
    constructor() {
        this.isInitialized = false;
        this.unregisterHandlers = [];
    }

    initialize() {
        if (this.isInitialized) return;
        if (!config.getSetting('combatSim')) return;

        this.isInitialized = true;

        optimizeCoffeeUI.buildPanel();

        const unregister = domObserver.onClass('OptimizeCoffeeButton', 'CombatPanel_combatPanel', (node) => {
            this._injectButton(node);
        });
        this.unregisterHandlers.push(unregister);

        const existingPanel = document.querySelector('[class*="CombatPanel_combatPanel"]');
        if (existingPanel) {
            this._injectButton(existingPanel);
        }
    }

    /**
     * Inject the Optimize Coffee toggle button into a combat panel, next to the Combat Sim button.
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
        button.textContent = 'Optimize Coffee';
        button.style.cssText =
            'cursor: pointer; background: linear-gradient(135deg, #c58b3f, #8a5a1f); color: #fff; border-radius: 4px; padding: 4px 10px; font-size: 12px; white-space: nowrap;';

        button.addEventListener('click', () => {
            optimizeCoffeeUI.toggle();
        });

        tabsContainer.appendChild(button);
    }

    disable() {
        for (const unregister of this.unregisterHandlers) {
            unregister();
        }
        this.unregisterHandlers = [];

        optimizeCoffeeUI.destroy();

        document.querySelectorAll(`.${BUTTON_CLASS}`).forEach((btn) => btn.remove());

        this.isInitialized = false;
    }
}

const optimizeCoffee = new OptimizeCoffee();
export default optimizeCoffee;

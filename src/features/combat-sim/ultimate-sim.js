/**
 * Ultimate Sim Feature Module
 * Injects an "Ultimate Sim" button next to the Combat Sim button that loops food optimization,
 * coffee optimization, and an all-zones simulation until the best zone stabilizes.
 */

import config from '../../core/config.js';
import domObserver from '../../core/dom-observer.js';
import ultimateSimUI from './ultimate-sim-ui.js';

const BUTTON_CLASS = 'cheezasha-ultimate-sim-btn';

class UltimateSim {
    constructor() {
        this.isInitialized = false;
        this.unregisterHandlers = [];
    }

    initialize() {
        if (this.isInitialized) return;
        if (!config.getSetting('combatSim')) return;

        this.isInitialized = true;

        ultimateSimUI.buildPanel();

        const unregister = domObserver.onClass('UltimateSimButton', 'CombatPanel_combatPanel', (node) => {
            this._injectButton(node);
        });
        this.unregisterHandlers.push(unregister);

        const existingPanel = document.querySelector('[class*="CombatPanel_combatPanel"]');
        if (existingPanel) {
            this._injectButton(existingPanel);
        }
    }

    /**
     * Inject the Ultimate Sim toggle button into a combat panel, next to the other Cheezasha tabs.
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
        button.textContent = 'Ultimate Sim';
        button.style.cssText =
            'cursor: pointer; background: linear-gradient(135deg, #a78bfa, #6d28d9); color: #fff; border-radius: 4px; padding: 4px 10px; font-size: 12px; white-space: nowrap;';

        button.addEventListener('click', () => {
            ultimateSimUI.toggle();
        });

        tabsContainer.appendChild(button);
    }

    disable() {
        for (const unregister of this.unregisterHandlers) {
            unregister();
        }
        this.unregisterHandlers = [];

        ultimateSimUI.destroy();

        document.querySelectorAll(`.${BUTTON_CLASS}`).forEach((btn) => btn.remove());

        this.isInitialized = false;
    }
}

const ultimateSim = new UltimateSim();
export default ultimateSim;

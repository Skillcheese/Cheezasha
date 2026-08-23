/**
 * Labyrinth XP Feature Module
 * Injects an "XP" tab button (next to Lab Sim) into the game's Labyrinth page,
 * toggling the Labyrinth XP panel.
 */

import config from '../../core/config.js';
import domObserver from '../../core/dom-observer.js';
import labyrinthXpTracker from './labyrinth-xp-tracker.js';
import labyrinthXpUI from './labyrinth-xp-ui.js';

const BUTTON_CLASS = 'cheezasha-lab-xp-btn';

class LabyrinthXp {
    constructor() {
        this.isInitialized = false;
        this.unregisterHandlers = [];
    }

    initialize() {
        if (this.isInitialized) return;
        if (!config.getSetting('labyrinthXpTracker')) return;

        this.isInitialized = true;

        labyrinthXpTracker.initialize();

        const unregister = domObserver.onClass(
            'LabyrinthXpButton',
            'LabyrinthPanel_tabsComponentContainer',
            (node) => {
                this._injectButton(node);
            },
            { debounce: true }
        );
        this.unregisterHandlers.push(unregister);

        const existingPanel = document.querySelector('[class*="LabyrinthPanel_tabsComponentContainer"]');
        if (existingPanel) {
            this._injectButton(existingPanel);
        }
    }

    /**
     * @param {HTMLElement} tabsContainer - The LabyrinthPanel_tabsComponentContainer element
     */
    _injectButton(tabsContainer) {
        if (!tabsContainer || tabsContainer.querySelector(`.${BUTTON_CLASS}`)) return;

        const innerContainer = tabsContainer.querySelector('[class*="TabsComponent_tabsContainer"] > div > div > div');
        if (!innerContainer) return;

        const button = document.createElement('div');
        button.className = 'MuiButtonBase-root MuiTab-root MuiTab-textColorPrimary css-1q2h7u5 ' + BUTTON_CLASS;
        button.textContent = 'XP';
        button.style.cssText =
            'cursor: pointer; background: linear-gradient(135deg, #2e9e4f, #1a6b33); color: #fff; border-radius: 4px; padding: 4px 10px; font-size: 12px; white-space: nowrap;';

        button.addEventListener('click', () => {
            labyrinthXpUI.toggle();
        });

        innerContainer.appendChild(button);
    }

    /**
     * Debug helper — inspect the tracker's raw internal state from the console via
     * window.Cheezasha.Combat.labyrinthXp.getDebugState()
     */
    getDebugState() {
        return {
            local: labyrinthXpTracker.local,
        };
    }

    disable() {
        for (const unregister of this.unregisterHandlers) {
            unregister();
        }
        this.unregisterHandlers = [];

        labyrinthXpUI.destroy();
        labyrinthXpTracker.disable();

        document.querySelectorAll(`.${BUTTON_CLASS}`).forEach((btn) => btn.remove());

        this.isInitialized = false;
    }
}

const labyrinthXp = new LabyrinthXp();
export default labyrinthXp;

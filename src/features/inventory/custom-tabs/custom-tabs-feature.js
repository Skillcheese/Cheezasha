/**
 * Custom Inventory Tabs — Feature Entry Point
 * Adds a "Cheezasha" tab to the character panel for user-defined inventory organization.
 */

import config from '../../../core/config.js';
import CustomTabsUI from './custom-tabs-ui.js';

class CustomTabsFeature {
    constructor() {
        this.ui = null;
    }

    async initialize() {
        if (!config.getSetting('inventoryTabs')) return;
        this.ui = new CustomTabsUI();
        await this.ui.initialize();
    }

    disable() {
        this.ui?.cleanup();
        this.ui = null;
    }
}

const customTabsFeature = new CustomTabsFeature();

export default {
    name: 'Custom Inventory Tabs',
    initialize: () => customTabsFeature.initialize(),
    disable: () => customTabsFeature.disable(),
};

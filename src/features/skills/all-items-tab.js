/**
 * All Items Tab
 * Adds an "All Items" tab next to a production skill's category tabs (e.g. Tailoring's
 * Material/Feet/Hands/Head/... tabs) that shows every recipe from every sub-tab at once,
 * merged into one unified grid.
 *
 * The game keeps every TabPanel mounted at all times and only toggles a CSS class to hide
 * the inactive ones. Recipes stay fully clickable wherever they live in the DOM, so rather
 * than just revealing every panel (which left each category as its own visually separate,
 * independently-scrolling section — and, worse, its own independent group for the existing
 * "sort by profit" feature, which groups tiles by their DOM parent), this physically moves
 * every recipe tile into a single shared grid container. That makes them one real group for
 * both layout (one seamless grid, one scrollbar) and for action-panel-sort.js's profit/xp
 * sorting (which reorders siblings within a shared parent) — no changes to that module needed.
 *
 * Original parent + position is recorded per tile so clicking a normal category tab (or
 * disabling the feature) restores everything exactly as the game rendered it.
 */

import domObserver from '../../core/dom-observer.js';
import actionPanelSort from '../actions/action-panel-sort.js';

const STYLE_ID = 'cheezasha-all-items-style';
const TILE_SELECTOR = '[class*="SkillAction_skillAction"]';

const CSS = `
.cheezasha-all-items-tab {
    cursor: pointer;
}
.cheezasha-all-items-hidden {
    display: none !important;
}
.cheezasha-all-items-grid {
    flex: none !important;
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
}
`;

class AllItemsTab {
    constructor() {
        this._unregister = null;
        this._styleEl = null;
        this._activeWrappers = new WeakSet();
        this._observedWrappers = new WeakSet();
        this._wrapperObservers = [];
        this._mergedGrids = new WeakMap(); // wrapper -> merged grid element
        this._mergedTiles = new WeakMap(); // wrapper -> Set of tiles currently moved into its grid
        this._tileOrigins = new WeakMap(); // tile -> { parent, next }
    }

    initialize() {
        if (!this._styleEl) {
            this._styleEl = document.createElement('style');
            this._styleEl.id = STYLE_ID;
            this._styleEl.textContent = CSS;
            document.head.appendChild(this._styleEl);
        }

        this._unregister = domObserver.onClass('AllItemsTab', 'TabsComponent_tabsContainer', (wrapper) => {
            this._setupWrapper(wrapper);
        });
    }

    cleanup() {
        if (this._unregister) {
            this._unregister();
            this._unregister = null;
        }
        for (const observer of this._wrapperObservers) {
            observer.disconnect();
        }
        this._wrapperObservers = [];
        this._observedWrappers = new WeakSet();

        // Restore any wrappers currently in All Items mode before tearing down.
        document.querySelectorAll('.cheezasha-all-items-tab').forEach((btn) => {
            const tabList = btn.closest('[role="tablist"]');
            const wrapper = tabList?.closest('[class*="TabsComponent_tabsContainer"]');
            const content = wrapper?.nextElementSibling;
            if (wrapper && content && this._activeWrappers.has(wrapper)) {
                this._restoreTiles(wrapper, content);
            }
            btn.remove();
        });
        this._activeWrappers = new WeakSet();
        this._mergedGrids = new WeakMap();
        this._mergedTiles = new WeakMap();
        this._tileOrigins = new WeakMap();

        this._styleEl?.remove();
        this._styleEl = null;
    }

    /**
     * Set up a TabsComponent instance: inject the button (if applicable) and start
     * watching it for React re-renders that would wipe our injected state.
     * @param {HTMLElement} wrapper - The TabsComponent_tabsContainer element
     */
    _setupWrapper(wrapper) {
        this._tryInject(wrapper);

        if (this._observedWrappers.has(wrapper)) return;
        this._observedWrappers.add(wrapper);

        const observer = new MutationObserver(() => this._tryInject(wrapper));
        observer.observe(wrapper, { childList: true, subtree: true });
        const content = wrapper.nextElementSibling;
        if (content) observer.observe(content, { childList: true, subtree: true });
        this._wrapperObservers.push(observer);
    }

    /**
     * Inject the "All Items" tab button into a TabsComponent instance, if it's a
     * production skill's category tab bar (identified by containing skill action grids).
     * Also re-applies the merged view if this wrapper was in "All Items" mode and the
     * game's own re-render put tiles back in their original panels.
     * @param {HTMLElement} wrapper - The TabsComponent_tabsContainer element
     */
    _tryInject(wrapper) {
        try {
            const tabList = wrapper.querySelector('[role="tablist"]');
            if (!tabList) return;

            const content = wrapper.nextElementSibling;
            if (!content || !content.querySelector('[class*="SkillActionGrid_skillActionGrid"]')) return;

            let btn = tabList.querySelector('.cheezasha-all-items-tab');
            if (!btn) {
                const existingTab = tabList.querySelector('[role="tab"]');
                if (!existingTab) return;

                btn = document.createElement('button');
                btn.className = 'cheezasha-all-items-tab ' + existingTab.className.replace(/Mui-selected/g, '');
                btn.setAttribute('role', 'tab');
                btn.setAttribute('type', 'button');
                btn.textContent = 'All Items';
                btn.style.minWidth = 'auto';
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._activate(wrapper, tabList, content, btn);
                });
                tabList.appendChild(btn);
            }

            // Clicking a native category tab restores the game's normal single-tab view.
            for (const tab of tabList.querySelectorAll('[role="tab"]:not(.cheezasha-all-items-tab)')) {
                if (tab.dataset.cheezashaAllItemsBound) continue;
                tab.dataset.cheezashaAllItemsBound = '1';
                tab.addEventListener('click', () => this._deactivate(wrapper, content, btn));
            }

            // Reconcile: if this wrapper was active before a re-render put tiles back, re-merge.
            if (this._activeWrappers.has(wrapper)) {
                this._mergeTiles(wrapper, content, btn);
            }
        } catch (err) {
            console.error('[AllItemsTab] Injection failed:', err);
        }
    }

    _activate(wrapper, tabList, content, btn) {
        for (const tab of tabList.querySelectorAll('[role="tab"]:not(.cheezasha-all-items-tab)')) {
            tab.classList.remove('Mui-selected');
        }
        btn.classList.add('Mui-selected');
        this._activeWrappers.add(wrapper);
        this._mergeTiles(wrapper, content, btn);
    }

    /**
     * Move every recipe tile from every category panel into one shared grid, hiding the
     * (now empty) original panels. Safe to call repeatedly — already-merged tiles are skipped.
     * @param {HTMLElement} wrapper
     * @param {HTMLElement} content
     * @param {HTMLElement} btn
     */
    _mergeTiles(wrapper, content, btn) {
        let grid = this._mergedGrids.get(wrapper);
        if (!grid) {
            const sampleGrid = content.querySelector('[class*="SkillActionGrid_skillActionGrid"]');
            grid = document.createElement('div');
            grid.className = (sampleGrid ? sampleGrid.className + ' ' : '') + 'cheezasha-all-items-grid';
            this._mergedGrids.set(wrapper, grid);
            this._mergedTiles.set(wrapper, new Set());
        }
        if (grid.parentElement !== content) {
            content.insertBefore(grid, content.firstChild);
        }

        for (const panel of content.children) {
            if (panel !== grid) panel.classList.add('cheezasha-all-items-hidden');
        }

        const mergedTiles = this._mergedTiles.get(wrapper);
        const tiles = content.querySelectorAll(TILE_SELECTOR);
        for (const tile of tiles) {
            if (mergedTiles.has(tile)) continue;
            this._tileOrigins.set(tile, { parent: tile.parentElement, next: tile.nextElementSibling });
            grid.appendChild(tile);
            mergedTiles.add(tile);
        }

        actionPanelSort.triggerSort();
        btn.title = `${mergedTiles.size} items`;
    }

    _deactivate(wrapper, content, btn) {
        btn.classList.remove('Mui-selected');
        this._activeWrappers.delete(wrapper);
        this._restoreTiles(wrapper, content);
    }

    /**
     * Move tiles back to their original panel/position and unhide the original panels.
     * @param {HTMLElement} wrapper
     * @param {HTMLElement} content
     */
    _restoreTiles(wrapper, content) {
        const mergedTiles = this._mergedTiles.get(wrapper);
        if (mergedTiles) {
            for (const tile of mergedTiles) {
                const origin = this._tileOrigins.get(tile);
                this._tileOrigins.delete(tile);
                if (!origin?.parent?.isConnected) continue;
                if (origin.next?.isConnected && origin.next.parentElement === origin.parent) {
                    origin.parent.insertBefore(tile, origin.next);
                } else {
                    origin.parent.appendChild(tile);
                }
            }
            mergedTiles.clear();
        }

        for (const panel of content.children) {
            panel.classList.remove('cheezasha-all-items-hidden');
        }

        actionPanelSort.triggerSort();
    }
}

const allItemsTab = new AllItemsTab();

export default {
    name: 'All Items Tab',
    initialize: () => allItemsTab.initialize(),
    cleanup: () => allItemsTab.cleanup(),
    disable: () => allItemsTab.cleanup(),
};

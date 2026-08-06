/**
 * Flip UI
 * Adds a "Flipping" tab to the marketplace tab bar showing a sortable table
 * of flip opportunities: ROI after tax, rolling-average vs. current prices,
 * and alerts for significantly under/over-priced listings.
 */

import storage from '../../../core/storage.js';
import config from '../../../core/config.js';
import dataManager from '../../../core/data-manager.js';
import { createMutationWatcher } from '../../../utils/dom-observer-helpers.js';
import { formatKMB3Digits, formatPercentage } from '../../../utils/formatters.js';
import { navigateToMarketplace } from '../../../utils/marketplace-tabs.js';
import flipAnalyzer from './flip-analyzer.js';
import flipSampler from './flip-sampler.js';

// Matches the combat-sim/skilling-optimizer tool aesthetic, but with a darker green accent
// instead of their blue/light-green so the Flipping tool reads as its own distinct panel.
const ACCENT = '#15803d';
const ACCENT_BORDER = 'rgba(21, 128, 61, 0.5)';
const ACCENT_BG = 'rgba(21, 128, 61, 0.12)';

function parseKMB(str) {
    const s = String(str).trim().toLowerCase();
    const match = s.match(/^(\d+\.?\d*)\s*([kmb]?)$/);
    if (!match) return NaN;
    const multipliers = { k: 1e3, m: 1e6, b: 1e9 };
    return parseFloat(match[1]) * (multipliers[match[2]] || 1);
}

const MARGIN_COLUMNS = [
    { key: 'itemName', label: 'Item' },
    { key: 'buyPrice', label: 'Buy order (bid)' },
    { key: 'sellPrice', label: 'Sell order (ask)' },
    { key: 'profit', label: 'Profit/unit' },
    { key: 'roi', label: 'ROI' },
];

const OUTLIER_COLUMNS = [
    { key: 'itemName', label: 'Item' },
    { key: 'currentAsk', label: 'Current ask' },
    { key: 'avgAsk', label: 'Avg ask' },
    { key: 'currentBid', label: 'Current bid' },
    { key: 'avgBid', label: 'Avg bid' },
    { key: 'profit', label: 'Profit/unit' },
    { key: 'roi', label: 'ROI' },
    { key: 'sampleCount', label: 'Samples' },
    { key: 'alerts', label: 'Alert' },
];

class FlipUI {
    constructor() {
        this.isInitialized = false;
        this.modal = null;
        this.marketplaceTab = null;
        this.tabCleanupObserver = null;
        this.marginSortColumn = 'roi';
        this.marginSortDirection = 'desc';
        this.outlierSortColumn = 'roi';
        this.outlierSortDirection = 'desc';
        this.budget = null;
        this.marginThreshold = 0.02;
        this.maxSpreadRatio = 3;
        this.deviationThreshold = 0.1;
        this.activeTab = 'opportunities'; // 'opportunities' | 'charts'
        this.opportunitySubTab = 'margin'; // 'margin' | 'outliers'
        this.selectedChartItemKey = null; // "itemHrid:enh"
    }

    async initialize() {
        if (this.isInitialized) return;
        if (!config.getSetting('market_flippingTool')) return;

        this.isInitialized = true;

        this.budget = await storage.get('flipBudget', 'settings', null);
        this.marginThreshold = await storage.get('flipMarginThreshold', 'settings', 0.02);
        this.maxSpreadRatio = await storage.get('flipMaxSpreadRatio', 'settings', 3);
        this.deviationThreshold = await storage.get('flipDeviationThreshold', 'settings', 0.1);

        this.addMarketplaceTab();
    }

    addMarketplaceTab() {
        const ensureTabExists = () => {
            const tabsContainer = document.querySelector('.MuiTabs-flexContainer[role="tablist"]');
            if (!tabsContainer) return;

            const hasMarketListingsTab = Array.from(tabsContainer.children).some((btn) =>
                btn.textContent.includes('Market Listings')
            );
            if (!hasMarketListingsTab) return;

            if (tabsContainer.querySelector('[data-mwi-flip-tab="true"]')) return;

            const referenceTab = Array.from(tabsContainer.children).find((btn) =>
                btn.textContent.includes('My Listings')
            );
            if (!referenceTab) return;

            const tab = referenceTab.cloneNode(true);
            tab.setAttribute('data-mwi-flip-tab', 'true');

            const badgeSpan = tab.querySelector('.TabsComponent_badge__1Du26');
            if (badgeSpan) {
                badgeSpan.innerHTML = `<div style="text-align: center;"><div>Flipping</div></div>`;
            }

            tab.classList.remove('Mui-selected');
            tab.setAttribute('aria-selected', 'false');
            tab.setAttribute('tabindex', '-1');

            tab.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.openModal();
            });

            const firstCustomTab = Array.from(tabsContainer.children).find(
                (btn) => btn.getAttribute('data-mwi-custom-tab') === 'true'
            );

            if (firstCustomTab) {
                firstCustomTab.before(tab);
            } else {
                tabsContainer.appendChild(tab);
            }

            this.marketplaceTab = tab;
        };

        if (!this.tabCleanupObserver) {
            this.tabCleanupObserver = createMutationWatcher(
                document.body,
                () => {
                    const tabsContainer = document.querySelector('.MuiTabs-flexContainer[role="tablist"]');
                    if (!tabsContainer) {
                        if (this.marketplaceTab && !document.body.contains(this.marketplaceTab)) {
                            this.marketplaceTab = null;
                        }
                        return;
                    }

                    const hasMarketListingsTab = Array.from(tabsContainer.children).some((btn) =>
                        btn.textContent.includes('Market Listings')
                    );

                    if (!hasMarketListingsTab) {
                        if (this.marketplaceTab && document.body.contains(this.marketplaceTab)) {
                            this.marketplaceTab.remove();
                            this.marketplaceTab = null;
                        }
                        return;
                    }

                    ensureTabExists();
                },
                { childList: true, subtree: true }
            );
        }

        ensureTabExists();
    }

    openModal() {
        if (!this.modal) {
            this.createModal();
        }
        this.modal.style.display = 'flex';
        this._updateTabButtons();
        this._updatePanelVisibility();
        this._updateOpportunitySubTabUI();
        if (this.activeTab === 'charts') {
            this.renderChartsTab();
        } else {
            this.renderTable();
        }
    }

    _updateTabButtons() {
        if (!this.tabButtons) return;
        for (const [key, btn] of Object.entries(this.tabButtons)) {
            const active = key === this.activeTab;
            btn.style.cssText = `
                background:${active ? ACCENT_BG : 'transparent'}; border:none; border-bottom:2px solid ${
                    active ? ACCENT : 'transparent'
                };
                color:${active ? ACCENT : '#888'}; font-weight:600; padding:8px 14px; cursor:pointer; font-size:13px;
            `;
        }
    }

    _updatePanelVisibility() {
        if (!this.opportunitiesPanel || !this.chartsPanel) return;
        this.opportunitiesPanel.style.display = this.activeTab === 'opportunities' ? 'block' : 'none';
        this.chartsPanel.style.display = this.activeTab === 'charts' ? 'block' : 'none';
    }

    _updateOpportunitySubTabUI() {
        if (!this.opportunitySubTabButtons || !this.marginSection || !this.outlierSection) return;

        for (const [key, btn] of Object.entries(this.opportunitySubTabButtons)) {
            const active = key === this.opportunitySubTab;
            btn.style.cssText = `
                background:${active ? ACCENT_BG : 'transparent'}; border:none; border-bottom:2px solid ${
                    active ? ACCENT : 'transparent'
                };
                color:${active ? ACCENT : '#888'}; font-weight:600; padding:6px 12px; cursor:pointer; font-size:13px;
            `;
        }

        this.marginSection.style.display = this.opportunitySubTab === 'margin' ? 'block' : 'none';
        this.outlierSection.style.display = this.opportunitySubTab === 'outliers' ? 'block' : 'none';
    }

    closeModal() {
        if (this.modal) this.modal.style.display = 'none';
    }

    createModal() {
        this.modal = document.createElement('div');
        this.modal.className = 'mwi-flip-modal';
        this.modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: none; justify-content: center; align-items: center;
            z-index: 10000;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: rgba(10, 10, 20, 0.97); border-radius: 10px;
            max-width: 95%; max-height: 90%;
            border: 2px solid ${ACCENT_BORDER};
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
            min-width: 900px;
            display: flex; flex-direction: column;
            font-family: 'Segoe UI', sans-serif;
            color: #e0e0e0;
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            display:flex; justify-content:space-between; align-items:center;
            padding: 12px 20px;
            background: ${ACCENT_BG};
            border-bottom: 1px solid ${ACCENT_BORDER};
            border-radius: 8px 8px 0 0;
            flex-shrink: 0;
        `;

        const title = document.createElement('h2');
        title.textContent = 'Flipping Opportunities';
        title.style.cssText = `margin:0; color:${ACCENT}; font-size:16px;`;

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText =
            'background:none; border:none; color:#aaa; font-size:22px; cursor:pointer; padding:0; width:30px; height:30px; line-height:1;';
        closeBtn.addEventListener('click', () => this.closeModal());

        header.appendChild(title);
        header.appendChild(closeBtn);

        const body = document.createElement('div');
        body.style.cssText = 'padding: 20px; overflow: auto; flex: 1; min-height: 0;';

        const tabBar = document.createElement('div');
        tabBar.style.cssText = 'display:flex; gap:6px; margin-bottom:15px; border-bottom:1px solid #333;';

        const makeTabButton = (key, label) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.dataset.flipTabKey = key;
            btn.addEventListener('click', () => {
                this.activeTab = key;
                this._updateTabButtons();
                this._updatePanelVisibility();
                if (key === 'charts') this.renderChartsTab();
                else this.renderTable();
            });
            tabBar.appendChild(btn);
            return btn;
        };

        this.tabButtons = {
            opportunities: makeTabButton('opportunities', 'Opportunities'),
            charts: makeTabButton('charts', 'Charts'),
        };

        this.opportunitiesPanel = document.createElement('div');

        const budgetLabel = document.createElement('label');
        budgetLabel.textContent = 'Budget:';
        budgetLabel.style.cssText = 'display:flex; align-items:center; gap:4px;';

        const budgetInput = document.createElement('input');
        budgetInput.type = 'text';
        budgetInput.placeholder = 'e.g. 50m (blank = no limit)';
        budgetInput.value = this.budget != null ? formatKMB3Digits(this.budget) : '';
        budgetInput.style.cssText =
            'background:#1a1a2e; color:#e0e0e0; border:1px solid #444; border-radius:6px; padding:5px 8px; font-size:13px; width:170px;';
        budgetInput.addEventListener('change', () => {
            const raw = budgetInput.value.trim();
            if (!raw) {
                this.budget = null;
            } else {
                const parsed = parseKMB(raw);
                this.budget = isNaN(parsed) || parsed <= 0 ? null : parsed;
            }
            storage.set('flipBudget', this.budget, 'settings', true);
            this.renderTable();
        });

        budgetLabel.appendChild(budgetInput);

        const sharedControls = document.createElement('div');
        sharedControls.style.cssText =
            'display:flex; gap:10px; margin-bottom:15px; flex-wrap:wrap; align-items:center; color:#e0e0e0; font-size:13px;';
        sharedControls.appendChild(budgetLabel);

        const subTabBar = document.createElement('div');
        subTabBar.style.cssText = 'display:flex; gap:6px; margin-bottom:15px;';

        const makeSubTabButton = (key, label) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.dataset.flipSubTabKey = key;
            btn.addEventListener('click', () => {
                this.opportunitySubTab = key;
                this._updateOpportunitySubTabUI();
            });
            subTabBar.appendChild(btn);
            return btn;
        };

        this.opportunitySubTabButtons = {
            margin: makeSubTabButton('margin', 'Margin Flips'),
            outliers: makeSubTabButton('outliers', 'Outliers'),
        };

        // --- Margin Flips section: guaranteed-profitable spread on the current live ask/bid ---
        const marginSection = document.createElement('div');

        const marginHeaderRow = document.createElement('div');
        marginHeaderRow.style.cssText =
            'display:flex; gap:10px; align-items:center; margin-bottom:8px; flex-wrap:wrap;';

        const marginHint = document.createElement('span');
        marginHint.textContent = 'Buy order at bid, sell order at ask — spread is profitable right now, after tax.';
        marginHint.style.cssText = 'color:#888; font-size:12px;';

        const marginThresholdLabel = document.createElement('label');
        marginThresholdLabel.style.cssText =
            'display:flex; align-items:center; gap:4px; color:#e0e0e0; font-size:13px;';
        marginThresholdLabel.append('Min margin: ');

        const marginThresholdInput = document.createElement('input');
        marginThresholdInput.type = 'number';
        marginThresholdInput.min = '0';
        marginThresholdInput.max = '90';
        marginThresholdInput.step = '0.5';
        marginThresholdInput.value = Math.round(this.marginThreshold * 1000) / 10;
        marginThresholdInput.style.cssText =
            'background:#1a1a2e; color:#e0e0e0; border:1px solid #444; border-radius:6px; padding:5px 8px; font-size:13px; width:60px;';
        marginThresholdInput.addEventListener('change', () => {
            const pct = Number(marginThresholdInput.value);
            this.marginThreshold = pct >= 0 ? pct / 100 : 0.02;
            storage.set('flipMarginThreshold', this.marginThreshold, 'settings', true);
            this.renderTable();
        });
        marginThresholdLabel.appendChild(marginThresholdInput);
        marginThresholdLabel.append('%');

        const maxSpreadLabel = document.createElement('label');
        maxSpreadLabel.style.cssText = 'display:flex; align-items:center; gap:4px; color:#e0e0e0; font-size:13px;';
        maxSpreadLabel.append('Max ask/bid ratio: ');

        const maxSpreadInput = document.createElement('input');
        maxSpreadInput.type = 'text';
        maxSpreadInput.placeholder = 'blank = no limit';
        maxSpreadInput.value = this.maxSpreadRatio != null ? String(this.maxSpreadRatio) : '';
        maxSpreadInput.style.cssText =
            'background:#1a1a2e; color:#e0e0e0; border:1px solid #444; border-radius:6px; padding:5px 8px; font-size:13px; width:90px;';
        maxSpreadInput.addEventListener('change', () => {
            const raw = maxSpreadInput.value.trim();
            const parsed = Number(raw);
            this.maxSpreadRatio = raw && !isNaN(parsed) && parsed > 0 ? parsed : null;
            storage.set('flipMaxSpreadRatio', this.maxSpreadRatio, 'settings', true);
            this.renderTable();
        });
        maxSpreadLabel.appendChild(maxSpreadInput);
        maxSpreadLabel.title =
            'Filters out thin-book listings with an insanely high ask or lowball bid (e.g. 3 = ask can be at most 3x the bid)';

        marginHeaderRow.appendChild(marginHint);
        marginHeaderRow.appendChild(marginThresholdLabel);
        marginHeaderRow.appendChild(maxSpreadLabel);

        const marginTableContainer = document.createElement('div');
        marginTableContainer.className = 'mwi-flip-table-container';

        marginSection.appendChild(marginHeaderRow);
        marginSection.appendChild(marginTableContainer);

        // --- Outliers section: listings that deviate significantly from their own rolling average ---
        const outlierSection = document.createElement('div');
        outlierSection.style.cssText = 'display:none;';

        const outlierHeaderRow = document.createElement('div');
        outlierHeaderRow.style.cssText =
            'display:flex; gap:10px; align-items:center; margin-bottom:8px; flex-wrap:wrap;';

        const outlierHint = document.createElement('span');
        outlierHint.textContent = 'A buy or sell order is priced way off its own recent average.';
        outlierHint.style.cssText = 'color:#888; font-size:12px;';

        const thresholdLabel = document.createElement('label');
        thresholdLabel.style.cssText = 'display:flex; align-items:center; gap:4px; color:#e0e0e0; font-size:13px;';
        thresholdLabel.append('Deviation: ');

        const thresholdInput = document.createElement('input');
        thresholdInput.type = 'number';
        thresholdInput.min = '1';
        thresholdInput.max = '90';
        thresholdInput.step = '1';
        thresholdInput.value = Math.round(this.deviationThreshold * 100);
        thresholdInput.style.cssText =
            'background:#1a1a2e; color:#e0e0e0; border:1px solid #444; border-radius:6px; padding:5px 8px; font-size:13px; width:60px;';
        thresholdInput.addEventListener('change', () => {
            const pct = Number(thresholdInput.value);
            this.deviationThreshold = pct > 0 ? pct / 100 : 0.1;
            storage.set('flipDeviationThreshold', this.deviationThreshold, 'settings', true);
            this.renderTable();
        });

        thresholdLabel.appendChild(thresholdInput);
        thresholdLabel.append('%');

        outlierHeaderRow.appendChild(outlierHint);
        outlierHeaderRow.appendChild(thresholdLabel);

        const outlierTableContainer = document.createElement('div');
        outlierTableContainer.className = 'mwi-flip-table-container';

        outlierSection.appendChild(outlierHeaderRow);
        outlierSection.appendChild(outlierTableContainer);

        this.opportunitiesPanel.appendChild(sharedControls);
        this.opportunitiesPanel.appendChild(subTabBar);
        this.opportunitiesPanel.appendChild(marginSection);
        this.opportunitiesPanel.appendChild(outlierSection);

        this.marginSection = marginSection;
        this.outlierSection = outlierSection;

        this.chartsPanel = document.createElement('div');
        this.chartsPanel.style.cssText = 'display:none;';
        this.buildChartsTab(this.chartsPanel);

        body.appendChild(tabBar);
        body.appendChild(this.opportunitiesPanel);
        body.appendChild(this.chartsPanel);

        content.appendChild(header);
        content.appendChild(body);
        // Only close on a genuine backdrop click (mousedown AND click both land on the backdrop
        // itself), not when a text-selection drag inside the modal happens to release over it.
        this.modal.addEventListener('mousedown', (e) => {
            this._backdropMouseDown = e.target === this.modal;
        });
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal && this._backdropMouseDown) this.closeModal();
            this._backdropMouseDown = false;
        });

        this._escHandler = (e) => {
            if (e.key === 'Escape' && this.modal.style.display !== 'none') this.closeModal();
        };
        document.addEventListener('keydown', this._escHandler);

        this.modal.appendChild(content);
        document.body.appendChild(this.modal);

        this.marginTableContainer = marginTableContainer;
        this.outlierTableContainer = outlierTableContainer;
    }

    renderTable() {
        this._renderSection({
            container: this.marginTableContainer,
            columns: MARGIN_COLUMNS,
            records: flipAnalyzer.analyzeMarginFlips({
                marginThreshold: this.marginThreshold,
                maxSpreadRatio: this.maxSpreadRatio,
                budget: this.budget,
            }),
            sortColumnKey: 'marginSortColumn',
            sortDirectionKey: 'marginSortDirection',
            emptyText: 'No profitable margin flips right now — try lowering the min margin.',
        });

        this._renderSection({
            container: this.outlierTableContainer,
            columns: OUTLIER_COLUMNS,
            records: flipAnalyzer.analyzeOutliers({
                deviationThreshold: this.deviationThreshold,
                budget: this.budget,
            }),
            sortColumnKey: 'outlierSortColumn',
            sortDirectionKey: 'outlierSortDirection',
            emptyText: 'No outliers yet — the sampler needs a few marketplace.json polls before deviations show up.',
        });
    }

    _renderSection({ container, columns, records, sortColumnKey, sortDirectionKey, emptyText }) {
        if (!container) return;

        this._sortRecords(records, sortColumnKey, sortDirectionKey);

        const table = document.createElement('table');
        table.style.cssText = 'width:100%; border-collapse:collapse; color:#e0e0e0; font-size:13px;';

        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');

        for (const col of columns) {
            const th = document.createElement('th');
            const isActive = this[sortColumnKey] === col.key;
            th.textContent = col.label + (isActive ? (this[sortDirectionKey] === 'desc' ? ' ▼' : ' ▲') : '');
            th.style.cssText =
                'text-align:left; padding:6px 10px; border-bottom:2px solid #444; cursor:pointer; white-space:nowrap; color:#aaa;';
            th.addEventListener('click', () => {
                if (this[sortColumnKey] === col.key) {
                    this[sortDirectionKey] = this[sortDirectionKey] === 'desc' ? 'asc' : 'desc';
                } else {
                    this[sortColumnKey] = col.key;
                    this[sortDirectionKey] = 'desc';
                }
                this.renderTable();
            });
            headRow.appendChild(th);
        }
        thead.appendChild(headRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');

        if (records.length === 0) {
            const emptyRow = document.createElement('tr');
            const emptyCell = document.createElement('td');
            emptyCell.colSpan = columns.length;
            emptyCell.textContent = emptyText;
            emptyCell.style.cssText = 'padding:20px; text-align:center; color:#888;';
            emptyRow.appendChild(emptyCell);
            tbody.appendChild(emptyRow);
        }

        for (const record of records) {
            const row = document.createElement('tr');
            row.style.cssText = 'border-bottom:1px solid #333;';

            const formatOrDash = (value) => (value != null ? formatKMB3Digits(value) : '—');

            const cells = {
                itemName: record.itemName + (record.enhancementLevel ? ` +${record.enhancementLevel}` : ''),
                buyPrice: formatKMB3Digits(record.buyPrice),
                sellPrice: formatKMB3Digits(record.sellPrice),
                currentAsk: formatOrDash(record.currentAsk),
                avgAsk: formatOrDash(record.avgAsk),
                currentBid: formatOrDash(record.currentBid),
                avgBid: formatOrDash(record.avgBid),
                profit: formatKMB3Digits(record.profit),
                roi: formatPercentage(record.roi),
                sampleCount: record.sampleCount != null ? String(record.sampleCount) : '',
                alerts: record.alerts?.length
                    ? record.alerts.map((a) => (a === 'underpriced_sell' ? '🟢 Cheap ask' : '🔵 Rich bid')).join(', ')
                    : '',
            };

            const isCheapAsk = record.alerts?.includes('underpriced_sell');
            const isRichBid = record.alerts?.includes('overpriced_buy');

            for (const col of columns) {
                const td = document.createElement('td');
                td.style.cssText = 'padding:5px 10px; white-space:nowrap;';

                if (col.key === 'itemName') {
                    td.appendChild(this._buildItemNameCell(record, cells.itemName));
                } else {
                    td.textContent = cells[col.key];
                }

                if (col.key === 'profit') {
                    td.style.color = record.profit >= 0 ? '#7ec87e' : '#e8a87c';
                }
                if (col.key === 'roi') {
                    td.style.color = record.roi >= 0 ? '#7ec87e' : '#e8a87c';
                }
                // Highlight whichever current price actually triggered the alert on this row.
                if ((col.key === 'currentAsk' && isCheapAsk) || (col.key === 'currentBid' && isRichBid)) {
                    td.style.fontWeight = 'bold';
                    td.style.color = '#ffd27f';
                }
                row.appendChild(td);
            }

            tbody.appendChild(row);
        }

        table.appendChild(tbody);
        container.innerHTML = '';
        container.appendChild(table);
    }

    _buildItemNameCell(record, label) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex; align-items:center; gap:6px;';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = label;
        wrap.appendChild(nameSpan);

        const marketLink = document.createElement('a');
        marketLink.href = '#';
        marketLink.textContent = '🛒';
        marketLink.title = 'View in marketplace';
        marketLink.style.cssText = 'text-decoration:none; cursor:pointer;';
        marketLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            navigateToMarketplace(record.itemHrid, record.enhancementLevel);
        });
        wrap.appendChild(marketLink);

        const chartLink = document.createElement('a');
        chartLink.href = '#';
        chartLink.textContent = '📈';
        chartLink.title = 'View price chart';
        chartLink.style.cssText = 'text-decoration:none; cursor:pointer;';
        chartLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._goToChartForItem(record);
        });
        wrap.appendChild(chartLink);

        return wrap;
    }

    _goToChartForItem(record) {
        this.selectedChartItemKey = `${record.itemHrid}:${record.enhancementLevel}`;
        this.activeTab = 'charts';
        this._updateTabButtons();
        this._updatePanelVisibility();
        if (this.chartSearchInput) {
            this.chartSearchInput.value = record.itemName;
        }
        this.renderChartsTab();
    }

    /**
     * Public entry point for other features (e.g. a chart-link icon on the marketplace listings
     * page) to open the Flipping modal directly on the Charts tab for a specific item.
     * @param {string} itemHrid
     * @param {number} [enhancementLevel=0]
     * @param {string} [itemName] - Display name, used to prefill the search box
     */
    openChartForItem(itemHrid, enhancementLevel = 0, itemName) {
        this.openModal();
        const resolvedName = itemName || dataManager.getItemDetails(itemHrid)?.name || itemHrid;
        this._goToChartForItem({ itemHrid, enhancementLevel, itemName: resolvedName });
    }

    _sortRecords(records, sortColumnKey, sortDirectionKey) {
        const col = this[sortColumnKey];
        const dir = this[sortDirectionKey] === 'asc' ? 1 : -1;

        records.sort((a, b) => {
            const va = col === 'alerts' ? (a.alerts?.length ?? 0) : a[col];
            const vb = col === 'alerts' ? (b.alerts?.length ?? 0) : b[col];

            if (typeof va === 'string') {
                return va.localeCompare(vb) * dir;
            }
            return ((va ?? 0) - (vb ?? 0)) * dir;
        });
    }

    buildChartsTab(container) {
        container.style.cssText = 'display:flex; gap:15px; min-height:400px;';

        const leftPanel = document.createElement('div');
        leftPanel.style.cssText = 'width:240px; flex-shrink:0; display:flex; flex-direction:column; gap:8px;';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search item...';
        searchInput.style.cssText =
            'background:#1a1a2e; color:#e0e0e0; border:1px solid #444; border-radius:6px; padding:6px 8px; font-size:13px;';
        searchInput.addEventListener('input', () => this._renderChartItemList());

        const listLabel = document.createElement('div');
        listLabel.textContent = 'Search results';
        listLabel.style.cssText = 'color:#aaa; font-size:12px; margin-top:4px;';
        this.chartListLabel = listLabel;

        const itemList = document.createElement('div');
        itemList.style.cssText = 'overflow-y:auto; max-height:400px; border:1px solid #333; border-radius:6px;';

        leftPanel.appendChild(searchInput);
        leftPanel.appendChild(listLabel);
        leftPanel.appendChild(itemList);

        const rightPanel = document.createElement('div');
        rightPanel.style.cssText = 'flex:1; min-width:0; display:flex; flex-direction:column; gap:8px;';

        const chartTitle = document.createElement('div');
        chartTitle.style.cssText = 'color:#fff; font-size:14px; font-weight:600;';

        const legend = document.createElement('div');
        legend.style.cssText = 'display:flex; gap:16px; font-size:12px; color:#ccc;';
        legend.innerHTML = `
            <span><span style="color:#e8a87c;">&#9632;</span> Ask (sell offers)</span>
            <span><span style="color:#7ec8ff;">&#9632;</span> Bid (buy offers)</span>
        `;

        const chartContainer = document.createElement('div');
        chartContainer.style.cssText = 'flex:1; min-height:320px;';

        rightPanel.appendChild(chartTitle);
        rightPanel.appendChild(legend);
        rightPanel.appendChild(chartContainer);

        container.appendChild(leftPanel);
        container.appendChild(rightPanel);

        this.chartSearchInput = searchInput;
        this.chartItemListEl = itemList;
        this.chartTitleEl = chartTitle;
        this.chartContainerEl = chartContainer;
    }

    renderChartsTab() {
        this._renderChartItemList();
        this._renderChartForSelection();
    }

    _renderChartItemList() {
        if (!this.chartItemListEl) return;

        const query = (this.chartSearchInput?.value || '').trim().toLowerCase();

        this.chartItemListEl.innerHTML = '';

        if (!query) {
            this.chartListLabel.textContent = 'Search results';
            const hint = document.createElement('div');
            hint.textContent = 'Start typing above to find an item.';
            hint.style.cssText = 'padding:12px; color:#888; font-size:12px;';
            this.chartItemListEl.appendChild(hint);
            return;
        }

        this.chartListLabel.textContent = 'Search results';
        const itemMap = dataManager.initClientData?.itemDetailMap || {};
        const entries = Object.entries(itemMap)
            .filter(([, details]) => details?.isTradable && details.name?.toLowerCase().includes(query))
            .slice(0, 30)
            .map(([itemHrid, details]) => ({ itemHrid, enhancementLevel: 0, itemName: details.name }));

        if (!this.selectedChartItemKey && entries.length > 0) {
            this.selectedChartItemKey = `${entries[0].itemHrid}:${entries[0].enhancementLevel}`;
        }

        if (entries.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'No matching tradeable items.';
            empty.style.cssText = 'padding:12px; color:#888; font-size:12px;';
            this.chartItemListEl.appendChild(empty);
            return;
        }

        for (const entry of entries) {
            const key = `${entry.itemHrid}:${entry.enhancementLevel}`;
            const row = document.createElement('div');
            const label = entry.itemName + (entry.enhancementLevel ? ` +${entry.enhancementLevel}` : '');
            row.textContent = label;
            row.style.cssText = `
                padding:6px 10px; cursor:pointer; font-size:12px; color:#e0e0e0;
                background:${key === this.selectedChartItemKey ? ACCENT_BG : 'transparent'};
                border-left:2px solid ${key === this.selectedChartItemKey ? ACCENT : 'transparent'};
                border-bottom:1px solid #2a2a2a;
            `;
            row.addEventListener('click', () => {
                this.selectedChartItemKey = key;
                this._renderChartItemList();
                this._renderChartForSelection();
            });
            this.chartItemListEl.appendChild(row);
        }
    }

    _renderChartForSelection() {
        if (!this.chartContainerEl) return;

        if (!this.selectedChartItemKey) {
            this.chartTitleEl.textContent = '';
            this.chartContainerEl.innerHTML =
                '<div style="color:#888; font-size:13px; padding:20px;">Select an item to view its price/volume history.</div>';
            return;
        }

        const separatorIndex = this.selectedChartItemKey.lastIndexOf(':');
        const itemHrid = this.selectedChartItemKey.slice(0, separatorIndex);
        const enhancementLevel = Number(this.selectedChartItemKey.slice(separatorIndex + 1)) || 0;
        const itemDetails = dataManager.getItemDetails(itemHrid);

        this.chartTitleEl.textContent =
            (itemDetails?.name || itemHrid) + (enhancementLevel ? ` +${enhancementLevel}` : '');

        const priceSamples = flipSampler
            .getHistory(itemHrid, enhancementLevel)
            .filter((s) => typeof s.a === 'number' || typeof s.b === 'number')
            .sort((a, b) => a.t - b.t);

        if (priceSamples.length === 0) {
            this.chartContainerEl.innerHTML =
                '<div style="color:#888; font-size:13px; padding:20px;">No history recorded yet for this item.</div>';
            return;
        }

        this.chartContainerEl.innerHTML = '';
        this.chartContainerEl.appendChild(this._buildOverlayChart(priceSamples));
    }

    /**
     * Build an ask/bid overlay chart with labeled axes and a hover tooltip showing both
     * values for the nearest sampled time slot.
     * @param {Array<{t: number, a: number|null, b: number|null}>} samples - sorted by time
     * @returns {HTMLElement}
     */
    _buildOverlayChart(samples) {
        const width = 700;
        const height = 320;
        const padding = { top: 10, right: 15, bottom: 28, left: 60 };
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;

        const minT = samples[0].t;
        const maxT = samples[samples.length - 1].t;
        const timeRange = maxT - minT || 1;

        const values = samples.flatMap((s) => [s.a, s.b]).filter((v) => typeof v === 'number');
        const minV = Math.min(...values);
        const maxV = Math.max(...values);
        const span = maxV - minV || Math.max(1, minV * 0.1) || 1;

        const xForT = (t) => padding.left + ((t - minT) / timeRange) * plotWidth;
        const yForV = (v) => padding.top + plotHeight - ((v - minV) / span) * plotHeight;

        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', String(height));
        svg.setAttribute('preserveAspectRatio', 'none');

        // Y-axis gridlines + labels
        const yTickCount = 5;
        for (let i = 0; i <= yTickCount; i++) {
            const value = minV + (span * i) / yTickCount;
            const y = yForV(value);

            const gridLine = document.createElementNS(svgNS, 'line');
            gridLine.setAttribute('x1', String(padding.left));
            gridLine.setAttribute('y1', String(y));
            gridLine.setAttribute('x2', String(padding.left + plotWidth));
            gridLine.setAttribute('y2', String(y));
            gridLine.setAttribute('stroke', '#333');
            svg.appendChild(gridLine);

            const label = document.createElementNS(svgNS, 'text');
            label.setAttribute('x', String(padding.left - 8));
            label.setAttribute('y', String(y + 4));
            label.setAttribute('text-anchor', 'end');
            label.setAttribute('fill', '#999');
            label.setAttribute('font-size', '11');
            label.textContent = formatKMB3Digits(value);
            svg.appendChild(label);
        }

        // X-axis ticks + labels
        const xTickCount = Math.min(6, samples.length - 1) || 1;
        for (let i = 0; i <= xTickCount; i++) {
            const t = minT + (timeRange * i) / xTickCount;
            const x = xForT(t);

            const tick = document.createElementNS(svgNS, 'line');
            tick.setAttribute('x1', String(x));
            tick.setAttribute('y1', String(padding.top + plotHeight));
            tick.setAttribute('x2', String(x));
            tick.setAttribute('y2', String(padding.top + plotHeight + 4));
            tick.setAttribute('stroke', '#444');
            svg.appendChild(tick);

            const label = document.createElementNS(svgNS, 'text');
            label.setAttribute('x', String(x));
            label.setAttribute('y', String(padding.top + plotHeight + 16));
            label.setAttribute('text-anchor', i === xTickCount ? 'end' : i === 0 ? 'start' : 'middle');
            label.setAttribute('fill', '#999');
            label.setAttribute('font-size', '11');
            label.textContent = new Date(t).toLocaleString(undefined, {
                month: 'numeric',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
            });
            svg.appendChild(label);
        }

        const drawLine = (key, color) => {
            const points = samples.filter((s) => typeof s[key] === 'number');
            if (points.length === 0) return;

            const pathData = points
                .map((p, i) => `${i === 0 ? 'M' : 'L'}${xForT(p.t).toFixed(1)},${yForV(p[key]).toFixed(1)}`)
                .join(' ');

            const path = document.createElementNS(svgNS, 'path');
            path.setAttribute('d', pathData);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', color);
            path.setAttribute('stroke-width', '2');
            svg.appendChild(path);
        };

        drawLine('a', '#e8a87c');
        drawLine('b', '#7ec8ff');

        const axisLine = document.createElementNS(svgNS, 'line');
        axisLine.setAttribute('x1', String(padding.left));
        axisLine.setAttribute('y1', String(padding.top + plotHeight));
        axisLine.setAttribute('x2', String(padding.left + plotWidth));
        axisLine.setAttribute('y2', String(padding.top + plotHeight));
        axisLine.setAttribute('stroke', '#444');
        svg.appendChild(axisLine);

        // Hover crosshair + point markers
        const hoverLine = document.createElementNS(svgNS, 'line');
        hoverLine.setAttribute('y1', String(padding.top));
        hoverLine.setAttribute('y2', String(padding.top + plotHeight));
        hoverLine.setAttribute('stroke', '#666');
        hoverLine.setAttribute('stroke-dasharray', '3,3');
        hoverLine.style.display = 'none';
        svg.appendChild(hoverLine);

        const makeDot = (color) => {
            const dot = document.createElementNS(svgNS, 'circle');
            dot.setAttribute('r', '4');
            dot.setAttribute('fill', color);
            dot.style.display = 'none';
            svg.appendChild(dot);
            return dot;
        };
        const askDot = makeDot('#e8a87c');
        const bidDot = makeDot('#7ec8ff');

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position:relative;';

        const tooltip = document.createElement('div');
        tooltip.style.cssText = `
            position:absolute; pointer-events:none; display:none; z-index:1;
            background:#1a1a2e; border:1px solid #444; border-radius:6px; padding:6px 10px;
            font-size:12px; color:#e0e0e0; white-space:nowrap;
        `;
        wrapper.appendChild(svg);
        wrapper.appendChild(tooltip);

        const hitArea = document.createElementNS(svgNS, 'rect');
        hitArea.setAttribute('x', String(padding.left));
        hitArea.setAttribute('y', String(padding.top));
        hitArea.setAttribute('width', String(plotWidth));
        hitArea.setAttribute('height', String(plotHeight));
        hitArea.setAttribute('fill', 'transparent');
        svg.appendChild(hitArea);

        const findNearestSample = (t) => {
            let nearest = samples[0];
            let nearestDiff = Math.abs(samples[0].t - t);
            for (const sample of samples) {
                const diff = Math.abs(sample.t - t);
                if (diff < nearestDiff) {
                    nearest = sample;
                    nearestDiff = diff;
                }
            }
            return nearest;
        };

        hitArea.addEventListener('mousemove', (e) => {
            const rect = svg.getBoundingClientRect();
            const svgX = ((e.clientX - rect.left) / rect.width) * width;
            const clampedX = Math.min(Math.max(svgX, padding.left), padding.left + plotWidth);
            const t = minT + ((clampedX - padding.left) / plotWidth) * timeRange;
            const sample = findNearestSample(t);
            const x = xForT(sample.t);

            hoverLine.setAttribute('x1', String(x));
            hoverLine.setAttribute('x2', String(x));
            hoverLine.style.display = 'block';

            if (typeof sample.a === 'number') {
                askDot.setAttribute('cx', String(x));
                askDot.setAttribute('cy', String(yForV(sample.a)));
                askDot.style.display = 'block';
            } else {
                askDot.style.display = 'none';
            }

            if (typeof sample.b === 'number') {
                bidDot.setAttribute('cx', String(x));
                bidDot.setAttribute('cy', String(yForV(sample.b)));
                bidDot.style.display = 'block';
            } else {
                bidDot.style.display = 'none';
            }

            const timeLabel = new Date(sample.t).toLocaleString();
            tooltip.innerHTML = `
                <div>${timeLabel}</div>
                <div style="color:#e8a87c;">Ask: ${typeof sample.a === 'number' ? formatKMB3Digits(sample.a) : '—'}</div>
                <div style="color:#7ec8ff;">Bid: ${typeof sample.b === 'number' ? formatKMB3Digits(sample.b) : '—'}</div>
            `;
            tooltip.style.display = 'block';

            const tooltipX = Math.min((x / width) * rect.width + 12, rect.width - 160);
            tooltip.style.left = `${tooltipX}px`;
            tooltip.style.top = '4px';
        });

        hitArea.addEventListener('mouseleave', () => {
            hoverLine.style.display = 'none';
            askDot.style.display = 'none';
            bidDot.style.display = 'none';
            tooltip.style.display = 'none';
        });

        return wrapper;
    }

    disable() {
        if (this.tabCleanupObserver) {
            this.tabCleanupObserver();
            this.tabCleanupObserver = null;
        }
        if (this.marketplaceTab) {
            this.marketplaceTab.remove();
            this.marketplaceTab = null;
        }
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }
        this.isInitialized = false;
    }
}

const flipUI = new FlipUI();
export default flipUI;

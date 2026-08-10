/**
 * Result Square Utility
 *
 * Shared "square icon with click menu" rendering used across combat-sim result tables
 * (lab sim, upgrade advisor, food/coffee optimizer, ultimate sim): a small sprite-icon box
 * (matching the game's own inventory/ability slot look) with an optional level badge, that on
 * hover shows an info tooltip and on click (items only) opens an action menu (View Marketplace /
 * Open Item Dictionary / View Action).
 *
 * Extracted from the combat-sim "Lab Sim" panel so any results panel can reuse the same markup
 * and interaction wiring without re-implementing the tooltip/menu machinery per feature.
 */

import { getEnhancementMultiplier } from './enhancement-multipliers.js';
import { formatWithSeparator } from './formatters.js';
import { navigateToMarketplace } from './marketplace-tabs.js';
import { findActionForItem, getGameObject } from './item-navigation.js';

const ACCENT_BORDER = 'rgba(74, 158, 255, 0.5)';
const ACCENT_BG = 'rgba(74, 158, 255, 0.12)';

/** Combat stat keys shown (in order) in the item tooltip's stat block. */
export const RESULT_SQUARE_COMBAT_STATS = [
    'stabAccuracy',
    'stabDamage',
    'slashAccuracy',
    'slashDamage',
    'bluntAccuracy',
    'bluntDamage',
    'rangedAccuracy',
    'rangedDamage',
    'magicAccuracy',
    'magicDamage',
    'defenseArmor',
    'evasion',
    'armor',
    'waterResistance',
    'fireResistance',
    'natureResistance',
    'earthResistance',
    'lightningResistance',
    'stunResistance',
    'attackSpeed',
    'castSpeed',
    'maxHitpoints',
    'maxManapoints',
    'lifeSteal',
    'critChance',
    'critDamage',
];

/**
 * Convert a game hrid ("/equipment_types/main_hand", "/skills/magic") into its display label
 * ("Main Hand", "Magic") — matches the plain title-casing the game itself uses for these.
 * @param {string} hrid
 * @returns {string}
 */
export function hridToLabel(hrid) {
    if (!hrid) return '';
    return hrid
        .split('/')
        .pop()
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

/**
 * Format a combat stat's raw numeric value the way the game's item tooltip does: values stored
 * as fractions (< 1 in magnitude, e.g. 0.6 magicAccuracy) render as a percentage; values stored
 * as whole numbers (e.g. 20 waterResistance) render as a plain signed number.
 * @param {number} value
 * @returns {string}
 */
export function formatStatValue(value) {
    const sign = value > 0 ? '+' : '';
    if (Math.abs(value) < 1) return `${sign}${(value * 100).toFixed(1)}%`;
    return `${sign}${value}`;
}

/**
 * Convert a camelCase stat key ("magicAccuracy") into its display label ("Magic Accuracy").
 * @param {string} key
 * @returns {string}
 */
export function camelToLabel(key) {
    const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Derive the sprite icon name for an item hrid, matching the game's own asset naming.
 * @param {string} hrid
 * @returns {string}
 */
export function iconNameForItemHrid(hrid) {
    if (hrid.startsWith('/ability_books/')) return 'ability_book';
    if (hrid === '/consumables/coin') return 'coin';
    return hrid.split('/').pop();
}

/**
 * Build the HTML for a clickable "item square" — icon + optional enhancement-level badge,
 * styled to match the game's own inventory slot (rgb(44,46,69) bg, 4px radius).
 * @param {string} hrid - Item hrid.
 * @param {string} iconName - Sprite fragment id within the items sprite sheet.
 * @param {number} level - Enhancement level (0 for none).
 * @param {string} spriteUrl - Base sprite sheet URL (from assetManifest.getSpriteUrl('items')).
 * @returns {string}
 */
export function buildItemSquareHtml(hrid, iconName, level, spriteUrl) {
    const itemLevel = level || 0;
    const ref = `${spriteUrl}#${iconName}`;
    let html = `<span class="mwi-result-item-square" data-item-hrid="${hrid}" data-item-level="${itemLevel}" style="display:inline-flex; position:relative; width:32px; height:32px; vertical-align:-9px; margin:0 2px; border-radius:4px; background:rgb(44,46,69); overflow:hidden; cursor:pointer;">`;
    html += `<svg width="32" height="32"><use href="${ref}" xlink:href="${ref}"></use></svg>`;
    html += '</span>';
    return html;
}

/**
 * Build the HTML for a clickable "ability square" — icon + optional level badge, styled to
 * match the game's own ability slot (rgb(44,46,69) bg, 4px radius).
 * @param {string} hrid - Ability hrid.
 * @param {string} iconName - Sprite fragment id within the abilities sprite sheet.
 * @param {number|null} level - Ability level, or falsy to omit the badge.
 * @param {string} spriteUrl - Base sprite sheet URL (from assetManifest.getSpriteUrl('abilities')).
 * @returns {string}
 */
export function buildAbilitySquareHtml(hrid, iconName, level, spriteUrl) {
    const ref = `${spriteUrl}#${iconName}`;
    let html = `<span class="mwi-result-ability-square" data-ability-hrid="${hrid}"${level ? ` data-ability-level="${level}"` : ''} style="display:inline-flex; position:relative; width:36px; height:36px; vertical-align:-10px; margin:0 2px; border-radius:4px; background:rgb(44,46,69); overflow:hidden; cursor:pointer;">`;
    html += `<svg width="36" height="36"><use href="${ref}" xlink:href="${ref}"></use></svg>`;
    if (level) {
        html += `<span style="position:absolute; bottom:-1px; right:-1px; font-size:11px; line-height:1; background:rgba(0,0,0,0.8); color:#e7e7e7; padding:1px 3px 0; border-radius:2px; pointer-events:none;">${level}</span>`;
    }
    html += '</span>';
    return html;
}

/**
 * Wire up hover-tooltip + click-menu interactions for `.mwi-result-item-square` /
 * `.mwi-result-ability-square` elements rendered anywhere inside `container`, using event
 * delegation so it keeps working across innerHTML re-renders of the results table.
 *
 * @param {HTMLElement} container - Root element to delegate mouseover/click listeners on
 *  (results are rebuilt via innerHTML, so per-square listeners would be lost each render).
 * @param {Object} options
 * @param {() => Object} options.getItemDetailMap - Returns the current gameData.itemDetailMap.
 * @param {() => Object} options.getAbilityDetailMap - Returns the current gameData.abilityDetailMap.
 * @param {() => Array} [options.getLevelExperienceTable] - Returns gameData.levelExperienceTable.
 * @returns {() => void} Cleanup function — removes the tooltip/menu elements and listeners.
 */
export function setupResultSquareInteractions(container, options) {
    const { getItemDetailMap, getAbilityDetailMap, getLevelExperienceTable } = options;
    const itemSelector = '.mwi-result-item-square';
    const abilitySelector = '.mwi-result-ability-square';
    const bothSelector = `${itemSelector}, ${abilitySelector}`;

    const popupStyle = `
        display: none; position: fixed; z-index: 999999;
        background: rgba(187, 197, 241, 0.95); border-radius: 4px; color: #000;
        box-shadow: 2px 2px 10px 6px rgba(0,0,0,0.3);
    `;

    const tooltip = document.createElement('div');
    tooltip.className = 'mwi-result-square-tooltip';
    tooltip.style.cssText = `${popupStyle} max-width: 318px; padding: 6px 8px; font-family: Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 500; line-height: 19.25px; letter-spacing: 0.15px; pointer-events: none;`;
    document.body.appendChild(tooltip);

    const menu = document.createElement('div');
    menu.className = 'mwi-result-square-menu';
    menu.style.cssText = `
        display: none; position: fixed; z-index: 999999; min-width: 160px; padding: 4px; font-size: 12px;
        background: #12121f; border: 1px solid ${ACCENT_BORDER}; border-radius: 6px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    `;
    document.body.appendChild(menu);

    const positionPopup = (popup, square) => {
        const rect = square.getBoundingClientRect();
        popup.style.display = 'block';
        let left = rect.left;
        const maxLeft = window.innerWidth - popup.offsetWidth - 8;
        if (left > maxLeft) left = Math.max(8, maxLeft);
        popup.style.top = `${rect.bottom + 6}px`;
        popup.style.left = `${left}px`;
    };

    const buildAbilityTooltipHtml = (square) => {
        const hrid = square.dataset.abilityHrid;
        const level = square.dataset.abilityLevel ? parseInt(square.dataset.abilityLevel) : null;
        const detail = getAbilityDetailMap?.()?.[hrid];
        const name = detail?.name || hrid?.split('/').pop() || 'Unknown Ability';
        const xpTable = getLevelExperienceTable?.();

        let html = `<div style="font-size:16px;">${name}</div>`;
        if (level) {
            html += `<div>Level: ${level}</div>`;
            if (xpTable?.[level] != null) {
                html += `<div>Total Experience: ${formatWithSeparator(xpTable[level])}</div>`;
                if (xpTable[level + 1] != null) {
                    html += `<div>Exp to Level Up: ${formatWithSeparator(xpTable[level + 1] - xpTable[level])}</div>`;
                }
            }
        }
        let details = '';
        if (detail?.description) details += `<div>Description: ${detail.description}</div>`;
        if (detail?.cooldownDuration) details += `<div>Cooldown: ${(detail.cooldownDuration / 1e9).toFixed(1)}s</div>`;
        if (detail?.castDuration) details += `<div>Cast Time: ${(detail.castDuration / 1e9).toFixed(1)}s</div>`;
        if (detail?.manaCost) details += `<div>MP Cost: ${detail.manaCost} MP</div>`;
        if (details) html += `<div style="margin-top:8px;">${details}</div>`;
        return html;
    };

    const buildItemTooltipHtml = (square) => {
        const hrid = square.dataset.itemHrid;
        const itemLevel = parseInt(square.dataset.itemLevel) || 0;
        const detail = getItemDetailMap?.()?.[hrid];
        const name = detail?.name || hrid?.split('/').pop() || 'Unknown Item';
        const eq = detail?.equipmentDetail;

        let html = `<div style="font-size:16px;">${name}</div>`;
        if (itemLevel > 0) html += `<div>+${itemLevel}</div>`;

        let details = '';
        if (eq?.type) details += `<div>Type: ${hridToLabel(eq.type)}</div>`;
        for (const req of eq?.levelRequirements || []) {
            if (!req.skillHrid) continue;
            details += `<div>Requires: ${req.level} ${hridToLabel(req.skillHrid)}</div>`;
        }
        const combatStyles = eq?.combatStats?.combatStyleHrids;
        if (combatStyles?.length) details += `<div>Combat Style: ${combatStyles.map(hridToLabel).join(', ')}</div>`;
        if (eq?.combatStats?.damageType) details += `<div>Damage Type: ${hridToLabel(eq.combatStats.damageType)}</div>`;
        if (eq?.combatStats?.attackInterval) {
            details += `<div>Attack Interval: ${(eq.combatStats.attackInterval / 1e9).toFixed(1)}s</div>`;
        }
        if (eq?.combatStats?.autoAttackDamage) {
            details += `<div>Auto Attack Damage: ${formatStatValue(eq.combatStats.autoAttackDamage)}</div>`;
        }

        const stats = eq?.combatStats;
        const enhancementBonuses = eq?.combatEnhancementBonuses || {};
        if (stats) {
            for (const key of RESULT_SQUARE_COMBAT_STATS) {
                const baseValue = stats[key];
                if (!baseValue) continue;
                const value =
                    itemLevel > 0 && key in enhancementBonuses
                        ? baseValue * getEnhancementMultiplier(detail, itemLevel)
                        : baseValue;
                details += `<div>${camelToLabel(key)}: ${formatStatValue(value)}</div>`;
            }
        }
        if (eq?.combatStats?.primaryTraining) {
            details += `<div>Primary Training: ${hridToLabel(eq.combatStats.primaryTraining)}</div>`;
        }
        if (details) html += `<div style="margin-top:8px;">${details}</div>`;
        return html;
    };

    const btnStyle =
        'display:block; width:100%; text-align:left; background:transparent; border:none; color:#e0e0e0; padding:6px 8px; font-size:12px; cursor:pointer; border-radius:4px;';

    const wireMenuButtons = () => {
        menu.querySelectorAll('button').forEach((btn) => {
            btn.addEventListener('mouseenter', () => (btn.style.background = ACCENT_BG));
            btn.addEventListener('mouseleave', () => (btn.style.background = 'transparent'));
        });
    };

    const renderAbilitySquareMenu = (abilityHrid) => {
        const bookItemHrid = abilityHrid.replace('/abilities/', '/items/');
        menu.innerHTML = `<button data-menu-action="marketplace" style="${btnStyle}">View Marketplace</button>`;
        wireMenuButtons();
        menu.querySelectorAll('button').forEach((btn) => {
            btn.addEventListener('click', () => {
                menu.style.display = 'none';
                navigateToMarketplace(bookItemHrid, 0);
            });
        });
    };

    const renderItemSquareMenu = (hrid, itemLevel) => {
        const actionInfo = findActionForItem(hrid);
        menu.innerHTML = `
            <button data-menu-action="marketplace" style="${btnStyle}">View Marketplace</button>
            <button data-menu-action="dictionary" style="${btnStyle}">Open Item Dictionary</button>
            ${actionInfo ? `<button data-menu-action="action" style="${btnStyle}">View Action</button>` : ''}
        `;
        wireMenuButtons();
        menu.querySelectorAll('button').forEach((btn) => {
            btn.addEventListener('click', () => {
                menu.style.display = 'none';
                const action = btn.dataset.menuAction;
                if (action === 'marketplace') {
                    navigateToMarketplace(hrid, itemLevel);
                } else if (action === 'dictionary') {
                    getGameObject()?.handleOpenItemDictionary?.(hrid);
                } else if (action === 'action' && actionInfo) {
                    getGameObject()?.handleGoToAction?.(actionInfo.actionHrid);
                }
            });
        });
    };

    const onMouseOver = (e) => {
        const square = e.target.closest(bothSelector);
        if (!square || square.contains(e.relatedTarget)) return;
        tooltip.innerHTML = square.matches(abilitySelector)
            ? buildAbilityTooltipHtml(square)
            : buildItemTooltipHtml(square);
        positionPopup(tooltip, square);
    };
    const onMouseOut = (e) => {
        const square = e.target.closest(bothSelector);
        if (!square || square.contains(e.relatedTarget)) return;
        tooltip.style.display = 'none';
    };
    const onClick = (e) => {
        const square = e.target.closest(bothSelector);
        if (!square) {
            menu.style.display = 'none';
            return;
        }
        e.stopPropagation();

        const isAbility = square.matches(abilitySelector);
        const hrid = isAbility ? square.dataset.abilityHrid : square.dataset.itemHrid;
        const itemLevel = isAbility ? 0 : parseInt(square.dataset.itemLevel) || 0;
        if (menu.style.display !== 'none' && menu.dataset.forHrid === hrid) {
            menu.style.display = 'none';
            return;
        }
        if (isAbility) {
            renderAbilitySquareMenu(hrid);
        } else {
            renderItemSquareMenu(hrid, itemLevel);
        }
        menu.dataset.forHrid = hrid;
        positionPopup(menu, square);
    };
    const onDocClick = (e) => {
        if (!e.target.closest(bothSelector)) menu.style.display = 'none';
    };

    container.addEventListener('mouseover', onMouseOver);
    container.addEventListener('mouseout', onMouseOut);
    container.addEventListener('click', onClick);
    document.addEventListener('click', onDocClick);

    return () => {
        container.removeEventListener('mouseover', onMouseOver);
        container.removeEventListener('mouseout', onMouseOut);
        container.removeEventListener('click', onClick);
        document.removeEventListener('click', onDocClick);
        tooltip.remove();
        menu.remove();
    };
}

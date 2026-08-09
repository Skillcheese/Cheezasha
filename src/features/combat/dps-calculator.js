/**
 * DPS Calculator
 * Injects a small DPS readout directly below the player's own combat unit
 * card. Shows damage-per-second for the current battle and for the whole
 * combat session (the current combat action, across all battles/waves).
 *
 * Live enemy hitpoints aren't exposed over the websocket, so damage is
 * inferred from the "current/max" HP text on each monster's HitpointsBar.
 * A MutationObserver watches that text directly, so a hit is tallied the
 * moment the DOM reflects it rather than on the next polling tick — this
 * also avoids the race where a poll interval could still be holding
 * un-tallied damage when a new-battle reset arrives. New monsters
 * spawning at full HP register as an increase and are ignored, so kills
 * and respawns never get counted as negative damage.
 *
 * A separate low-frequency interval only re-renders the DPS text (time
 * keeps moving even between hits) and repositions the panel — it never
 * touches the damage totals.
 */

import config from '../../core/config.js';
import webSocketHook from '../../core/websocket.js';
import domObserver from '../../core/dom-observer.js';
import dataManager from '../../core/data-manager.js';
import { createTimerRegistry } from '../../utils/timer-registry.js';

const PANEL_ID = 'mwi-dps-calculator';
const PLAYERS_AREA_SELECTOR = 'BattlePanel_playersArea';
const BATTLE_AREA_SELECTOR = '[class*="BattlePanel_battleArea"]';
const MONSTERS_AREA_SELECTOR = 'BattlePanel_monstersArea';
const COMBAT_UNIT_SELECTOR = '[class*="CombatUnit_combatUnit"]';
const HP_VALUE_SELECTOR = '[class*="HitpointsBar_hpValue"]';
const DISPLAY_REFRESH_MS = 1000;

class DpsCalculator {
    constructor() {
        this.initialized = false;
        this.unregisterPlayersObserver = null;
        this.unregisterMonstersObserver = null;
        this.hpObserver = null;
        this.observedMonstersArea = null;
        this.newBattleHandler = null;
        this.onActionsUpdated = null;
        this.timerRegistry = null;

        this.combatActive = false;
        this.prevMonsterHp = [];

        this.battleDamage = 0;
        this.battleStartTime = null;

        this.totalDamage = 0;
        this.totalStartTime = null;
    }

    initialize() {
        if (this.initialized) return;
        if (!config.getSetting('dpsCalculator')) return;

        this.newBattleHandler = () => this._onNewBattle();
        webSocketHook.on('new_battle', this.newBattleHandler);

        this.onActionsUpdated = (data) => this._onActionsUpdated(data);
        dataManager.on('actions_updated', this.onActionsUpdated);

        this.unregisterPlayersObserver = domObserver.onClass('DpsCalculator', PLAYERS_AREA_SELECTOR, (node) =>
            this._injectPanel(node)
        );
        this.unregisterMonstersObserver = domObserver.onClass('DpsCalculatorMonsters', MONSTERS_AREA_SELECTOR, (node) =>
            this._watchMonstersArea(node)
        );

        this.timerRegistry = createTimerRegistry();
        this.timerRegistry.registerInterval(setInterval(() => this._refreshDisplay(), DISPLAY_REFRESH_MS));

        // domObserver.onClass only fires for elements inserted after this point —
        // if the page loads/refreshes while combat is already on screen, the
        // battle panel is already there and nothing would ever trigger the
        // initial injection/watch. Do one manual scan for that case.
        const existingPlayersArea = document.querySelector(`[class*="${PLAYERS_AREA_SELECTOR}"]`);
        const existingMonstersArea = document.querySelector(`[class*="${MONSTERS_AREA_SELECTOR}"]`);
        if (existingPlayersArea && existingMonstersArea) {
            // We don't know when the in-progress battle/session actually
            // started, so DPS accounting starts fresh from now.
            this.combatActive = true;
            this.battleStartTime = Date.now();
            this.totalStartTime = Date.now();
            this._injectPanel(existingPlayersArea);
            this._watchMonstersArea(existingMonstersArea);
        }

        this.initialized = true;
    }

    _onNewBattle() {
        // Capture whatever damage already landed on the outgoing monsters
        // (including a killing blow) before wiping the per-battle tracking —
        // the mutation observer is async, so this guards against losing a hit
        // that happened right as the new battle event arrives.
        this._captureDamage();

        // new_battle is the reliable "a battle is starting" signal (fires for
        // the first battle of a session too), unlike actions_updated's
        // currentCount, which isn't a dependable start marker.
        if (!this.combatActive) {
            this.combatActive = true;
            this.totalDamage = 0;
            this.totalStartTime = Date.now();
        }

        this.battleDamage = 0;
        this.battleStartTime = Date.now();
        this.prevMonsterHp = [];
        this._refreshDisplay();
    }

    _onActionsUpdated(data) {
        const combatEnded = data.endCharacterActions?.some(
            (a) => a.isDone && a.actionHrid?.startsWith('/actions/combat/')
        );
        const hasCombatAction = data.endCharacterActions?.some(
            (a) => !a.isDone && a.actionHrid?.startsWith('/actions/combat/')
        );
        const hasNewNonCombatAction = data.endCharacterActions?.some(
            (a) => !a.isDone && !a.actionHrid?.startsWith('/actions/combat/') && a.currentCount === 0
        );

        // A wave transition also reports the finished wave's action as isDone in
        // the same event as the next wave's action — that must NOT be treated as
        // leaving combat, or the session totals would reset every battle.
        if ((combatEnded && !hasCombatAction) || (hasNewNonCombatAction && !hasCombatAction)) {
            this.combatActive = false;
            this.battleStartTime = null;
            this.totalStartTime = null;
            document.getElementById(PANEL_ID)?.remove();
        }
    }

    _injectPanel(node) {
        if (!config.getSetting('dpsCalculator')) return;

        const className = typeof node.className === 'string' ? node.className : '';
        const playersArea = className.includes(PLAYERS_AREA_SELECTOR)
            ? node
            : node.querySelector?.(`[class*="${PLAYERS_AREA_SELECTOR}"]`);
        if (!playersArea) return;

        // The player's own combat unit is always the first card in playersArea.
        const unit = playersArea.querySelector(COMBAT_UNIT_SELECTOR);
        const battleArea = playersArea.closest(BATTLE_AREA_SELECTOR);
        if (!unit || !battleArea) return;

        let el = document.getElementById(PANEL_ID);
        if (!el || !el.isConnected) {
            el = this._buildPanel();
        }
        if (el.parentElement !== battleArea) {
            battleArea.appendChild(el);
        }
        this._positionPanel(battleArea, unit, el);
    }

    // playersArea/monstersArea are fixed-height, overflow:auto boxes sized to the
    // game's own content — appending inside them gets scroll-clipped whenever a
    // party is present. Instead the panel is anchored (absolute, within the
    // position:relative battleArea) directly under the player's own card.
    _positionPanel(battleArea, unit, el) {
        const battleRect = battleArea.getBoundingClientRect();
        const unitRect = unit.getBoundingClientRect();
        el.style.left = `${unitRect.left - battleRect.left}px`;
        el.style.top = `${unitRect.bottom - battleRect.top + 6}px`;
        el.style.width = `${unitRect.width}px`;
    }

    _buildPanel() {
        const textColor = config.getSettingValue('color_text_primary') || config.COLOR_TEXT_PRIMARY;

        const el = document.createElement('div');
        el.id = PANEL_ID;
        el.style.cssText = `
            position: absolute;
            padding: 4px 8px;
            text-align: center;
            font-size: 13px;
            line-height: 1.4;
            color: ${textColor};
            pointer-events: none;
            z-index: 1;
        `;

        const line1 = document.createElement('div');
        line1.className = 'mwi-dps-line1';
        line1.textContent = 'DPS 0.0';

        const line2 = document.createElement('div');
        line2.className = 'mwi-dps-line2';
        line2.textContent = 'Total DPS 0.0';

        el.appendChild(line1);
        el.appendChild(line2);
        return el;
    }

    _watchMonstersArea(node) {
        const className = typeof node.className === 'string' ? node.className : '';
        const monstersArea = className.includes(MONSTERS_AREA_SELECTOR)
            ? node
            : node.querySelector?.(`[class*="${MONSTERS_AREA_SELECTOR}"]`);
        if (!monstersArea || monstersArea === this.observedMonstersArea) return;

        if (this.hpObserver) {
            this.hpObserver.disconnect();
        }
        this.observedMonstersArea = monstersArea;
        this.prevMonsterHp = [];

        this.hpObserver = new MutationObserver(() => this._captureDamage());
        this.hpObserver.observe(monstersArea, { characterData: true, childList: true, subtree: true });
    }

    // Reads the live "current/max" HP text for every monster and tallies any
    // decrease since the last read. Called from the MutationObserver (so a hit
    // is tallied the instant the DOM shows it) and defensively before a
    // new-battle reset.
    _captureDamage() {
        if (!this.combatActive || !this.observedMonstersArea?.isConnected) return;

        const units = this.observedMonstersArea.querySelectorAll(COMBAT_UNIT_SELECTOR);
        let dealt = false;
        units.forEach((unit, i) => {
            const hpText = unit.querySelector(HP_VALUE_SELECTOR)?.textContent;
            if (!hpText) return;

            const current = parseInt(hpText.split('/')[0], 10);
            if (Number.isNaN(current)) return;

            const previous = this.prevMonsterHp[i];
            if (typeof previous === 'number' && current < previous) {
                const damage = previous - current;
                this.battleDamage += damage;
                this.totalDamage += damage;
                dealt = true;
            }
            this.prevMonsterHp[i] = current;
        });
        this.prevMonsterHp.length = units.length;

        if (dealt) this._refreshDisplay();
    }

    _refreshDisplay() {
        if (!this.combatActive) return;

        const el = document.getElementById(PANEL_ID);
        const playersArea = document.querySelector(`[class*="${PLAYERS_AREA_SELECTOR}"]`);
        const unit = playersArea?.querySelector(COMBAT_UNIT_SELECTOR);
        const battleArea = playersArea?.closest(BATTLE_AREA_SELECTOR);
        if (el && unit && battleArea) {
            this._positionPanel(battleArea, unit, el);
        }

        this._updateDisplay();
    }

    _updateDisplay() {
        const el = document.getElementById(PANEL_ID);
        if (!el) return;

        const now = Date.now();
        const battleElapsedSec = this.battleStartTime ? (now - this.battleStartTime) / 1000 : 0;
        const totalElapsedSec = this.totalStartTime ? (now - this.totalStartTime) / 1000 : 0;

        const dps = battleElapsedSec > 0 ? this.battleDamage / battleElapsedSec : 0;
        const totalDps = totalElapsedSec > 0 ? this.totalDamage / totalElapsedSec : 0;

        const line1 = el.querySelector('.mwi-dps-line1');
        const line2 = el.querySelector('.mwi-dps-line2');
        if (line1) line1.textContent = `DPS ${dps.toFixed(1)}`;
        if (line2) line2.textContent = `Total DPS ${totalDps.toFixed(1)}`;
    }

    disable() {
        if (this.newBattleHandler) {
            webSocketHook.off('new_battle', this.newBattleHandler);
            this.newBattleHandler = null;
        }
        if (this.onActionsUpdated) {
            dataManager.off('actions_updated', this.onActionsUpdated);
            this.onActionsUpdated = null;
        }
        if (this.unregisterPlayersObserver) {
            this.unregisterPlayersObserver();
            this.unregisterPlayersObserver = null;
        }
        if (this.unregisterMonstersObserver) {
            this.unregisterMonstersObserver();
            this.unregisterMonstersObserver = null;
        }
        if (this.hpObserver) {
            this.hpObserver.disconnect();
            this.hpObserver = null;
        }
        this.observedMonstersArea = null;
        if (this.timerRegistry) {
            this.timerRegistry.clearAll();
            this.timerRegistry = null;
        }
        document.getElementById(PANEL_ID)?.remove();

        this.combatActive = false;
        this.prevMonsterHp = [];
        this.battleDamage = 0;
        this.battleStartTime = null;
        this.totalDamage = 0;
        this.totalStartTime = null;
        this.initialized = false;
    }
}

const dpsCalculator = new DpsCalculator();

export default dpsCalculator;

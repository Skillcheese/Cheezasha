/**
 * Labyrinth Trial Timer Marker
 * Overlays a thin marker on the action progress bar during labyrinth combat/skilling
 * trial rooms, showing where the room's 2 minute timer currently sits — independent of
 * the bar's own fill, which tracks kill/gather progress toward the room's target. The
 * marker starts at the left edge (2:00 remaining) and lerps linearly to the right edge (0s).
 */

import config from '../../core/config.js';

const ROOM_DURATION_SECONDS = 120;
const MARKER_CLASS = 'mwi-labyrinth-trial-timer-marker';
// Labyrinth trial rooms are the only actions that render this "<percent>% - <time>"
// compound text on the action progress bar; every other action just shows a plain
// duration (e.g. "5.0s"), so matching this shape is enough to detect a trial room.
const TRIAL_TEXT_RE = /^(\d+)%\s*-\s*(?:(\d+)m\s*)?(\d+(?:\.\d+)?)s/;
// Several other ProgressBar_text elements can be on screen at once (queued-action
// counters, other skill panels, etc.), so the header's action bar must be found by
// scoping into its container rather than matching the class name alone.
const HEADER_TEXT_SELECTOR = "[class*='Header_progressBarContainer'] [class*='ProgressBar_text']";

class LabyrinthTrialTimer {
    constructor() {
        this.initialized = false;
        this.timerId = null;
        this.settingChangeHandler = null;
    }

    initialize() {
        if (this.initialized) return;

        if (!this.settingChangeHandler) {
            this.settingChangeHandler = (enabled) => {
                if (enabled) {
                    this.initialized = false;
                    this.initialize();
                } else {
                    this.disable();
                }
            };
            config.onSettingChange('labyrinthTrialTimerMarker', this.settingChangeHandler);
        }

        if (!config.getSetting('labyrinthTrialTimerMarker')) return;

        this.initialized = true;
        this._startLoop();
    }

    /**
     * DOM: progressBar > innerBarContainer > innerBar (fill), text (sibling of innerBarContainer)
     * @private
     */
    _findBarContainer(textEl) {
        const parent = textEl.parentElement;
        if (!parent) return null;
        for (const child of parent.children) {
            if (child === textEl) continue;
            if (child.className?.includes?.('innerBarContainer')) return child;
        }
        return null;
    }

    /** @private */
    _removeMarker() {
        document.querySelectorAll(`.${MARKER_CLASS}`).forEach((el) => el.remove());
    }

    /** @private */
    _startLoop() {
        if (this.timerId) return;
        this._tick();
    }

    /** @private */
    _stopLoop() {
        if (this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }
    }

    /** @private */
    _tick() {
        this.timerId = setTimeout(() => this._tick(), 200);

        const textEl = document.querySelector(HEADER_TEXT_SELECTOR);
        const span = textEl?.querySelector('span');
        const match = span ? TRIAL_TEXT_RE.exec(span.textContent) : null;
        if (!match) {
            this._removeMarker();
            return;
        }

        const minutes = match[2] ? parseInt(match[2], 10) : 0;
        const seconds = parseFloat(match[3]);
        const remaining = minutes * 60 + seconds;
        const fraction = Math.min(1, Math.max(0, 1 - remaining / ROOM_DURATION_SECONDS));

        const container = this._findBarContainer(textEl);
        if (!container) {
            this._removeMarker();
            return;
        }

        let marker = container.querySelector(`.${MARKER_CLASS}`);
        if (!marker) {
            this._removeMarker();
            marker = document.createElement('div');
            marker.className = MARKER_CLASS;
            marker.style.cssText = `
                position: absolute;
                top: 0;
                bottom: 0;
                width: 2px;
                margin-left: -1px;
                background: #fff;
                box-shadow: 0 0 3px rgba(255, 255, 255, 0.9);
                pointer-events: none;
                z-index: 2;
            `;
            if (getComputedStyle(container).position === 'static') {
                container.style.position = 'relative';
            }
            container.appendChild(marker);
        }
        marker.style.left = `${(fraction * 100).toFixed(2)}%`;
    }

    disable() {
        this._stopLoop();
        this._removeMarker();
        this.initialized = false;
    }
}

const labyrinthTrialTimer = new LabyrinthTrialTimer();

export default labyrinthTrialTimer;

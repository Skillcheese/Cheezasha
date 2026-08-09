/**
 * Tooltip Observer
 * Centralized observer for tooltip/popper appearances
 * Any feature can subscribe to be notified when tooltips appear
 */

import domObserver from './dom-observer.js';

class TooltipObserver {
    constructor() {
        this.subscribers = new Map(); // name -> callback
        this.unregisterObserver = null;
        this.isInitialized = false;
    }

    /**
     * Initialize the observer (call once)
     */
    initialize() {
        if (this.isInitialized) {
            return;
        }

        this.isInitialized = true;

        // Watch for tooltip/popper elements appearing
        // These are the common classes used by MUI tooltips/poppers
        this.unregisterObserver = domObserver.onClass('TooltipObserver', ['MuiPopper', 'MuiTooltip'], (element) => {
            this.notifySubscribers(element);
        });
    }

    /**
     * Subscribe to tooltip appearance events
     * @param {string} name - Unique subscriber name
     * @param {Function} callback - Function(element) to call when tooltip appears
     */
    subscribe(name, callback) {
        this.subscribers.set(name, callback);

        // Auto-initialize if first subscriber
        if (!this.isInitialized) {
            this.initialize();
        }
    }

    /**
     * Unsubscribe from tooltip events
     * @param {string} name - Subscriber name
     */
    unsubscribe(name) {
        this.subscribers.delete(name);

        // If no subscribers left, could optionally stop observing
        // For now, keep observer active for simplicity
    }

    /**
     * Notify all subscribers that a tooltip appeared
     * @param {Element} element - The tooltip/popper element
     * @private
     */
    notifySubscribers(element) {
        // Keep the tooltip fully on-screen regardless of its size/placement
        const styleObserver = this.constrainToViewport(element);

        // Set up observer to detect when this specific tooltip is removed
        const removalObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const removedNode of mutation.removedNodes) {
                    if (removedNode === element) {
                        if (styleObserver) {
                            styleObserver.disconnect();
                        }

                        // Notify subscribers that tooltip closed
                        for (const [name, callback] of this.subscribers.entries()) {
                            try {
                                callback(element, 'closed');
                            } catch (error) {
                                console.error(`[TooltipObserver] Error in subscriber "${name}" (close):`, error);
                            }
                        }
                        removalObserver.disconnect();
                        return;
                    }
                }
            }
        });

        // Watch the parent for removal of this tooltip
        if (element.parentNode) {
            removalObserver.observe(element.parentNode, {
                childList: true,
            });
        }

        // Notify subscribers that tooltip opened
        for (const [name, callback] of this.subscribers.entries()) {
            try {
                callback(element, 'opened');
            } catch (error) {
                console.error(`[TooltipObserver] Error in subscriber "${name}" (open):`, error);
            }
        }
    }

    /**
     * Clamp a tooltip/popper element so it never renders off-screen.
     * MUI positions poppers via an inline `transform: translate(...)`; we layer an
     * additional CSS `translate` offset on top so it survives React re-renders and
     * re-positioning (e.g. hovering to a different row) without fighting MUI's own styles.
     * @param {Element} element - The tooltip/popper element
     * @returns {MutationObserver|null} Observer watching for re-positioning, or null
     * @private
     */
    constrainToViewport(element) {
        if (!(element instanceof HTMLElement)) {
            return null;
        }

        const margin = 8;
        let adjusting = false;

        const apply = () => {
            if (adjusting || !element.isConnected) {
                return;
            }

            // Reset any previous adjustment before measuring the natural position
            if (element.style.translate) {
                element.style.translate = '';
            }

            const rect = element.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) {
                return;
            }

            const maxRight = window.innerWidth - margin;
            const maxBottom = window.innerHeight - margin;

            let dx = 0;
            if (rect.right > maxRight) {
                dx = maxRight - rect.right;
            }
            if (rect.left + dx < margin) {
                dx = margin - rect.left;
            }

            let dy = 0;
            if (rect.bottom > maxBottom) {
                dy = maxBottom - rect.bottom;
            }
            if (rect.top + dy < margin) {
                dy = margin - rect.top;
            }

            if (dx !== 0 || dy !== 0) {
                adjusting = true;
                element.style.translate = `${Math.round(dx)}px ${Math.round(dy)}px`;
                requestAnimationFrame(() => {
                    adjusting = false;
                });
            }
        };

        requestAnimationFrame(apply);

        // Re-clamp whenever MUI repositions the popper (e.g. hovering a different target)
        const styleObserver = new MutationObserver(() => {
            if (adjusting) {
                return;
            }
            requestAnimationFrame(apply);
        });
        styleObserver.observe(element, { attributes: true, attributeFilter: ['style'] });

        return styleObserver;
    }

    /**
     * Cleanup and disable
     */
    disable() {
        if (this.unregisterObserver) {
            this.unregisterObserver();
            this.unregisterObserver = null;
        }
        this.subscribers.clear();
        this.isInitialized = false;
    }
}

const tooltipObserver = new TooltipObserver();

export default tooltipObserver;

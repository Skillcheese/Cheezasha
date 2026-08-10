/**
 * Chat History Extender
 * Preserves chat messages that the game evicts from the live buffer,
 * keeping them visible in a history section above the live messages.
 * Based on the original script by SilkyPanda.
 */

import config from '../../core/config.js';
import domObserver from '../../core/dom-observer.js';
import { addStyles, removeStyles } from '../../utils/dom.js';
import { createTimerRegistry } from '../../utils/timer-registry.js';

const STYLE_ID = 'mwi-chat-history-extender-css';
const CSS = `
    .mwi-history-buffer {
        display: flex;
        flex-direction: column;
        width: 100%;
        background-color: rgba(0, 0, 0, 0.45);
        border-bottom: 2px dashed #555;
        margin-bottom: 5px;
    }
    .mwi-history-buffer > div { opacity: 0.9; position: relative; }
    .mwi-history-buffer > div:hover { opacity: 1; background-color: rgba(255, 255, 255, 0.05); }
    .mwi-interactive { cursor: pointer; }
`;

/**
 * Read React props off a DOM node via the __reactProps$ key.
 * @param {Element} domNode
 * @returns {object|null}
 */
function getReactProps(domNode) {
    if (!domNode) return null;
    const key = Object.keys(domNode).find((k) => k.startsWith('__reactProps'));
    return key ? domNode[key] : null;
}

/**
 * Manages the history buffer for a single chat tab container.
 */
class ChatTabHandler {
    /**
     * @param {Element} containerEl - The ChatHistory_chatHistory element
     * @param {Map} interactionCache - Shared cache of UID → React handlers
     * @param {() => number} getMaxHistory - Returns current max history setting
     */
    constructor(containerEl, interactionCache, getMaxHistory) {
        this.container = containerEl;
        this.interactionCache = interactionCache;
        this.getMaxHistory = getMaxHistory;

        this.bufferEl = document.createElement('div');
        this.bufferEl.className = 'mwi-history-buffer';
        this.container.insertBefore(this.bufferEl, this.container.firstChild);

        const events = ['click', 'contextmenu', 'dblclick', 'mousedown', 'mouseup', 'mouseover', 'mouseout'];
        events.forEach((evt) => this.bufferEl.addEventListener(evt, this._handleEmulatedEvent.bind(this), true));

        this.observer = new MutationObserver(this._onMutation.bind(this));
        this.observer.observe(this.container, { childList: true });
    }

    /**
     * Hydrate a live message node by caching its React event handlers before the game removes it.
     * @param {Element} messageNode
     */
    hydrateMessage(messageNode) {
        if (messageNode.dataset.mwiHydrated) return;

        const eventsOfInterest = [
            'onClick',
            'onContextMenu',
            'onDoubleClick',
            'onMouseEnter',
            'onMouseLeave',
            'onMouseOver',
            'onMouseOut',
            'onMouseDown',
            'onMouseUp',
        ];

        [messageNode, ...messageNode.querySelectorAll('*')].forEach((el) => {
            const props = getReactProps(el);
            if (!props) return;

            const handlers = {};
            let hasHandler = false;

            eventsOfInterest.forEach((evtName) => {
                if (typeof props[evtName] === 'function') {
                    handlers[evtName] = props[evtName];
                    hasHandler = true;
                }
            });

            if (typeof props.goToMarketplaceHandler === 'function') {
                handlers.onClick = (e) => props.goToMarketplaceHandler(e, true);
                hasHandler = true;
            }

            if (hasHandler) {
                const uid = Date.now().toString(36) + Math.random().toString(36).substring(2);
                el.setAttribute('data-mwi-uid', uid);
                el.classList.add('mwi-interactive');
                this.interactionCache.set(uid, handlers);
            }
        });

        messageNode.dataset.mwiHydrated = 'true';
    }

    /**
     * Re-emit a React synthetic event for history buffer interactions.
     * @param {Event} e
     */
    _handleEmulatedEvent(e) {
        const targetEl = e.target.closest('[data-mwi-uid]');
        if (!targetEl) return;

        const uid = targetEl.getAttribute('data-mwi-uid');
        const handlers = this.interactionCache.get(uid);
        if (!handlers) return;

        const eventMap = {
            click: 'onClick',
            contextmenu: 'onContextMenu',
            dblclick: 'onDoubleClick',
            mousedown: 'onMouseDown',
            mouseup: 'onMouseUp',
            mouseover: 'onMouseOver',
            mouseout: 'onMouseOut',
        };

        let reactEventName = eventMap[e.type];

        if (e.type === 'mouseover') {
            reactEventName = handlers.onMouseEnter ? 'onMouseEnter' : 'onMouseOver';
        }
        if (e.type === 'mouseout') {
            reactEventName = handlers.onMouseLeave ? 'onMouseLeave' : 'onMouseOut';
        }

        const handler = handlers[reactEventName];
        if (typeof handler !== 'function') return;

        const fakeEvent = {
            ...e,
            nativeEvent: e,
            target: e.target,
            currentTarget: targetEl,
            preventDefault: () => e.preventDefault(),
            stopPropagation: () => e.stopPropagation(),
            persist: () => {},
            isDefaultPrevented: () => e.defaultPrevented,
            isPropagationStopped: () => e.cancelBubble,
            type: e.type,
        };

        if (e.clientX !== undefined) {
            fakeEvent.clientX = e.clientX;
            fakeEvent.clientY = e.clientY;
        }

        try {
            handler(fakeEvent);
        } catch (err) {
            console.error('[ChatHistoryExtender] Handler failed:', err);
        }
    }

    /**
     * Handle mutations on the chat container.
     * @param {MutationRecord[]} mutations
     */
    _onMutation(mutations) {
        const isAtBottom = this.container.scrollHeight - this.container.scrollTop - this.container.clientHeight < 50;
        const maxHistory = this.getMaxHistory();

        mutations.forEach((mut) => {
            mut.addedNodes.forEach((node) => {
                if (node.nodeType === 1 && node.className?.includes('ChatMessage_chatMessage')) {
                    this.hydrateMessage(node);
                }
            });

            mut.removedNodes.forEach((node) => {
                if (
                    node.nodeType === 1 &&
                    node.className?.includes('ChatMessage_chatMessage') &&
                    node !== this.bufferEl
                ) {
                    const clone = node.cloneNode(true);
                    this.bufferEl.appendChild(clone);

                    while (this.bufferEl.childElementCount > maxHistory) {
                        const oldNode = this.bufferEl.firstChild;
                        oldNode.querySelectorAll('[data-mwi-uid]').forEach((u) => {
                            this.interactionCache.delete(u.getAttribute('data-mwi-uid'));
                        });
                        if (oldNode.hasAttribute('data-mwi-uid')) {
                            this.interactionCache.delete(oldNode.getAttribute('data-mwi-uid'));
                        }
                        oldNode.remove();
                    }
                }
            });

            if (this.container.firstChild !== this.bufferEl) {
                this.container.prepend(this.bufferEl);
            }
        });

        if (isAtBottom) {
            this.container.scrollTop = this.container.scrollHeight;
        }
    }

    /**
     * Disconnect the observer and remove the buffer element.
     */
    destroy() {
        this.observer.disconnect();
        this.bufferEl.querySelectorAll('[data-mwi-uid]').forEach((el) => {
            this.interactionCache.delete(el.getAttribute('data-mwi-uid'));
        });
        this.bufferEl.remove();
    }
}

class ChatHistoryExtender {
    constructor() {
        this.isInitialized = false;
        this.unregisterHandlers = [];
        this.timerRegistry = createTimerRegistry();
        this.interactionCache = new Map();
        this.tabHandlers = new WeakMap();
        this.activeHandlers = new Set();
    }

    initialize() {
        if (this.isInitialized) return;
        if (!config.getSetting('chatHistoryExtender')) return;

        this.isInitialized = true;
        addStyles(CSS, STYLE_ID);

        const getMaxHistory = () => {
            const raw = parseInt(config.getSettingValue('chatHistoryExtender_maxHistory'));
            return isFinite(raw) && raw > 0 ? raw : 150;
        };

        const attachHandler = (containerEl) => {
            if (this.tabHandlers.has(containerEl)) return;
            const handler = new ChatTabHandler(containerEl, this.interactionCache, getMaxHistory);
            this.tabHandlers.set(containerEl, handler);
            this.activeHandlers.add(handler);
            containerEl.querySelectorAll('[class*="ChatMessage_chatMessage"]').forEach((msg) => {
                handler.hydrateMessage(msg);
            });
        };

        // Watch for new chat tab containers
        const unregister = domObserver.onClass('ChatHistoryExtender', 'ChatHistory_chatHistory', attachHandler, {
            debounce: true,
        });
        this.unregisterHandlers.push(unregister);

        // Attach to any already-open containers
        document.querySelectorAll('[class*="ChatHistory_chatHistory"]').forEach(attachHandler);

        // Periodic cache cleanup to prevent unbounded memory growth
        const cleanupInterval = setInterval(() => {
            if (this.interactionCache.size > 8000) {
                this.interactionCache.clear();
            }
        }, 600000);
        this.timerRegistry.registerInterval(cleanupInterval);
    }

    disable() {
        for (const handler of this.activeHandlers) {
            handler.destroy();
        }
        this.activeHandlers.clear();
        this.tabHandlers = new WeakMap();
        this.unregisterHandlers.forEach((unregister) => unregister());
        this.unregisterHandlers = [];
        this.timerRegistry.clearAll();
        this.interactionCache.clear();
        removeStyles(STYLE_ID);
        this.isInitialized = false;
    }
}

const chatHistoryExtender = new ChatHistoryExtender();
export default chatHistoryExtender;

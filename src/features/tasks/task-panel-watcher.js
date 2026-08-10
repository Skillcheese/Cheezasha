/**
 * Task Panel Watcher
 * Single shared domObserver registration for the two task-panel DOM signals that
 * multiple features need (task list appearing, individual task cards appearing).
 * Several features used to each register their own onClass watcher for the same
 * two class names, which meant every task-panel re-render triggered N independent
 * debounce cycles and N independent full re-scans instead of one.
 */

import domObserver from '../../core/dom-observer.js';

class TaskPanelWatcher {
    constructor() {
        this.listListeners = new Set();
        this.taskListeners = new Set();
        this.started = false;
    }

    /**
     * Start the underlying domObserver registrations (idempotent, lazy).
     * @private
     */
    _start() {
        if (this.started) return;
        this.started = true;

        domObserver.onClass(
            'TaskPanelWatcher-TaskList',
            'TasksPanel_taskList',
            (node) => {
                this.listListeners.forEach((callback) => {
                    try {
                        callback(node);
                    } catch (error) {
                        console.error('[TaskPanelWatcher] Task list listener failed:', error);
                    }
                });
            },
            { debounce: true }
        );

        domObserver.onClass(
            'TaskPanelWatcher-Task',
            'RandomTask_randomTask',
            (node) => {
                this.taskListeners.forEach((callback) => {
                    try {
                        callback(node);
                    } catch (error) {
                        console.error('[TaskPanelWatcher] Task node listener failed:', error);
                    }
                });
            },
            { debounce: true }
        );
    }

    /**
     * Subscribe to the task list container appearing/re-rendering.
     * @param {Function} callback - Called with the matching DOM node
     * @returns {Function} Unsubscribe function
     */
    onTaskListChange(callback) {
        this._start();
        this.listListeners.add(callback);
        return () => this.listListeners.delete(callback);
    }

    /**
     * Subscribe to individual task card nodes appearing.
     * @param {Function} callback - Called with the matching DOM node
     * @returns {Function} Unsubscribe function
     */
    onTaskNodeAdded(callback) {
        this._start();
        this.taskListeners.add(callback);
        return () => this.taskListeners.delete(callback);
    }
}

const taskPanelWatcher = new TaskPanelWatcher();

export default taskPanelWatcher;

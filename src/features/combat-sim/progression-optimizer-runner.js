/**
 * Progression Optimizer Runner
 *
 * Runs `optimizeProgression` in a Web Worker (see progression-optimizer-worker-entry.js) so the
 * exhaustive plan search can take as long as it needs without freezing the game. One worker per
 * run; `cancelProgressionOptimization` terminates it.
 */

import WORKER_SCRIPT from './progression-optimizer-worker-entry.js?worker';

let activeRun = null;

/**
 * Run optimizeProgression off the main thread.
 * @param {Array<Object>} stages - See optimizeProgression
 * @param {Object} options - See optimizeProgression (minus `onProgress`, which can't cross threads)
 * @param {Function} [onProgress] - Called with each progress report (see optimizeProgression)
 * @returns {Promise<{candidates: Array<Object>, recommended: Object|null}|null>} null when cancelled
 */
export function runProgressionOptimization(stages, options, onProgress) {
    cancelProgressionOptimization();

    const blobUrl = URL.createObjectURL(new Blob([WORKER_SCRIPT], { type: 'application/javascript' }));
    const worker = new Worker(blobUrl);

    return new Promise((resolve, reject) => {
        const finish = () => {
            worker.terminate();
            URL.revokeObjectURL(blobUrl);
            if (activeRun?.worker === worker) activeRun = null;
        };
        activeRun = {
            worker,
            cancel: () => {
                finish();
                resolve(null);
            },
        };

        worker.onmessage = (event) => {
            const { type } = event.data;
            if (type === 'progress') {
                onProgress?.(event.data.progress);
            } else if (type === 'result') {
                finish();
                resolve(event.data.result);
            } else if (type === 'error') {
                finish();
                reject(new Error(event.data.message));
            }
        };
        worker.onerror = (error) => {
            finish();
            reject(new Error(error.message || 'Progression optimizer worker failed'));
        };

        worker.postMessage({ stages, options });
    });
}

/**
 * Stop the running progression optimization, if any (its promise resolves to null).
 */
export function cancelProgressionOptimization() {
    activeRun?.cancel();
}

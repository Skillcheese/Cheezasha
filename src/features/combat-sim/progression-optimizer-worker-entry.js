/**
 * Progression Optimizer Worker Entry
 *
 * Bundled into a string at build time by the workerBundlePlugin and run inside a Web Worker (see
 * progression-optimizer-runner.js), so the exhaustive plan search never blocks the page. Receives
 * `{stages, options}`, posts `progress` messages while searching and one `result` (or `error`).
 */

import { optimizeProgression } from './progression-optimizer.js';

onmessage = function (event) {
    const { stages, options } = event.data;
    try {
        const result = optimizeProgression(stages, {
            ...options,
            onProgress: (progress) => postMessage({ type: 'progress', progress }),
        });
        postMessage({ type: 'result', result });
    } catch (error) {
        postMessage({ type: 'error', message: error?.message || String(error) });
    }
};

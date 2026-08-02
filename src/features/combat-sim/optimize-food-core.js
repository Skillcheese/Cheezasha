/**
 * Optimize Food Core
 * Headless (DOM-free) food/mana-food combo search, shared by the Optimize Food panel and
 * Ultimate Sim. Minimizes deaths/hr first, then time spent out of mana, then cost/hr.
 */

import dataManager from '../../core/data-manager.js';
import marketAPI from '../../api/marketplace.js';
import { getBuyPrice } from './combat-sim-adapter.js';
import { runWorkerChunk, getMaxWorkers } from './combat-sim-runner.js';
import { generateCombos } from './combo-utils.js';

const MAX_FOOD_SLOTS = 3;
const TOP_CHEAP_PER_CATEGORY = 3;
// Food only comes in 4 mutually-exclusive categories — you can't equip two of the same category
// at once (e.g. two donuts), but different categories stack fine (donut + cake, gummy + yogurt).
const FOOD_CATEGORIES = ['hp_instant', 'hp_over_time', 'mp_instant', 'mp_over_time'];
// Combos are considered "tied" on deaths/hr or OOM% if within this margin, to absorb sim noise
// (finite test hours) rather than treating a fractional difference as a real survivability gap.
const TIE_EPSILON = 1e-6;
// After ranking food combos, this many of the cheapest/best combos get their trigger thresholds
// refined (rather than just the single best), since a slightly pricier combo can end up winning
// once its triggers are tuned.
const COMBOS_TO_REFINE = 10;
const ONE_HOUR_NS = 3600 * 1e9;
// Trigger threshold candidates, expressed as a multiple of the food's own HP/MP restore amount,
// ordered from most aggressive/safest (triggers earliest) to most lenient/cheapest (triggers
// latest). Small fractions are included since a mana food may need to trigger well before it's
// "efficient" (early/often) to fully prevent OOM. The item's own default in-game trigger is
// always tested too, separately, as a baseline candidate.
const TRIGGER_MULTIPLIERS = [0.1, 0.25, 0.5, 1, 1.5, 2, 3];
// After the binary search locates the cheapest combo that reaches the 0-death/0-OOM floor, this
// many additional (pricier) combos are also tested so there's a real pool to rank/refine from —
// otherwise only the single boundary combo would ever be known to reach the floor.
const FILL_WINDOW = COMBOS_TO_REFINE * 3;

let simTaskIdCounter = 0;

/**
 * Tiny counting semaphore so we can cap total concurrent sim Workers across both the food-combo
 * search and the (per-combo) trigger-threshold refinement, no matter how those calls are nested.
 * @param {number} max
 */
function createSemaphore(max) {
    let active = 0;
    const queue = [];
    return {
        acquire() {
            return new Promise((resolve) => {
                const tryAcquire = () => {
                    if (active < max) {
                        active++;
                        resolve(() => {
                            active--;
                            const next = queue.shift();
                            if (next) next();
                        });
                    } else {
                        queue.push(tryAcquire);
                    }
                };
                tryAcquire();
            });
        },
    };
}

/**
 * Lexicographic comparator matching the panel's ranking rules: fewest deaths/hr, then least
 * mana-OOM time, then cheapest.
 * @param {Object} a
 * @param {Object} b
 * @returns {number}
 */
function compareMetrics(a, b) {
    if (Math.abs(a.deathsPerHour - b.deathsPerHour) > TIE_EPSILON) return a.deathsPerHour - b.deathsPerHour;
    if (Math.abs(a.oomPercent - b.oomPercent) > TIE_EPSILON) return a.oomPercent - b.oomPercent;
    return a.costPerHour - b.costPerHour;
}

/**
 * @param {{deathsPerHour: number, oomPercent: number}} metrics
 * @returns {boolean} True if this hits the absolute floor: 0 deaths/hr and 0% mana-OOM time.
 */
function passesFloor(metrics) {
    return metrics.deathsPerHour <= TIE_EPSILON && metrics.oomPercent <= TIE_EPSILON;
}

/**
 * Categorize a food item the same way the sim editor's conflict picker does: instant vs
 * over-time HP/MP restore. Two items in the same category can't be equipped simultaneously.
 * @param {Object} detail - item.consumableDetail
 * @returns {string|null}
 */
function getFoodCategory(detail) {
    const hp = detail.hitpointRestore || 0;
    const mp = detail.manapointRestore || 0;
    const dur = detail.recoveryDuration || 0;
    if (hp > 0) return dur > 0 ? 'hp_over_time' : 'hp_instant';
    if (mp > 0) return dur > 0 ? 'mp_over_time' : 'mp_instant';
    return null;
}

/**
 * Pick the cheapest N candidates of a category, plus the single strongest (highest restore)
 * in case cheap food alone can't prevent deaths/OOM.
 * @param {Array<Object>} list - candidates sorted ascending by price
 * @param {string} restoreKey - 'hp' or 'mp'
 * @returns {Array<Object>}
 */
function selectCandidates(list, restoreKey) {
    const picked = new Map();
    for (const item of list.slice(0, TOP_CHEAP_PER_CATEGORY)) picked.set(item.hrid, item);
    const strongest = [...list].sort((a, b) => b[restoreKey] - a[restoreKey])[0];
    if (strongest) picked.set(strongest.hrid, strongest);

    // Also test the most cost-efficient food (restore per coin) plus the next pricier item past
    // it. A stronger, pricier food that only needs to trigger occasionally can beat a cheap food
    // that has to fire constantly, so it's worth checking one tier above the raw efficiency
    // optimum rather than assuming cheapest-per-restore always wins once triggers are tuned.
    const byEfficiency = [...list]
        .filter((item) => item.price > 0)
        .sort((a, b) => b[restoreKey] / b.price - a[restoreKey] / a.price);
    if (byEfficiency.length) {
        const mostEfficient = byEfficiency[0];
        picked.set(mostEfficient.hrid, mostEfficient);

        const nextTier = [...list]
            .filter((item) => item.price > mostEfficient.price)
            .sort((a, b) => a.price - b.price)[0];
        if (nextTier) picked.set(nextTier.hrid, nextTier);
    }

    return Array.from(picked.values());
}

/**
 * Build candidate food items grouped by category, priced via the market.
 * @returns {Object<string, Array<{hrid: string, name: string, hp: number, mp: number, price: number}>>}
 */
export function getCandidateFoodGroups() {
    const clientData = dataManager.getInitClientData();
    const itemDetailMap = clientData?.itemDetailMap || {};

    const byCategory = { hp_instant: [], hp_over_time: [], mp_instant: [], mp_over_time: [] };
    for (const [hrid, item] of Object.entries(itemDetailMap)) {
        const detail = item.consumableDetail;
        if (!detail) continue;
        const cat = item.categoryHrid || '';
        if (!cat.includes('food')) continue;

        const category = getFoodCategory(detail);
        if (!category) continue;

        const price = getBuyPrice(marketAPI.getPrice(hrid));
        byCategory[category].push({
            hrid,
            name: item.name || hrid.split('/').pop(),
            hp: detail.hitpointRestore || 0,
            mp: detail.manapointRestore || 0,
            price,
        });
    }

    const groups = {};
    for (const category of FOOD_CATEGORIES) {
        const list = byCategory[category].sort((a, b) => a.price - b.price);
        const restoreKey = category.startsWith('hp') ? 'hp' : 'mp';
        groups[category] = selectCandidates(list, restoreKey);
    }
    return groups;
}

/**
 * Generate all food combos of up to maxSlots items that respect the one-item-per-category rule:
 * pick a subset of categories (up to maxSlots of them), then the cartesian product of each
 * chosen category's candidates.
 * @param {Object<string, Array<Object>>} groups - category → candidate items
 * @param {number} maxSlots
 * @returns {Array<Array<Object>>}
 */
export function generateFoodCombos(groups, maxSlots) {
    const categories = FOOD_CATEGORIES.filter((c) => groups[c].length > 0);
    const categorySubsets = generateCombos(categories, maxSlots);

    const combos = [];
    for (const subset of categorySubsets) {
        let partials = [[]];
        for (const category of subset) {
            const next = [];
            for (const partial of partials) {
                for (const item of groups[category]) {
                    next.push([...partial, item]);
                }
            }
            partials = next;
        }
        combos.push(...partials);
    }
    return combos;
}

/**
 * Build a MAX_FOOD_SLOTS-padded food DTO array for a combo, given a per-slot trigger override
 * (null → use the item's default in-game triggers).
 * @param {Array<Object>} combo
 * @param {Array<Array<Object>|null>} slotTriggers
 * @returns {Array<Object|null>}
 */
export function buildFoodDTO(combo, slotTriggers) {
    const food = [];
    for (let s = 0; s < MAX_FOOD_SLOTS; s++) {
        if (!combo[s]) {
            food.push(null);
            continue;
        }
        food.push({ hrid: combo[s].hrid, triggers: slotTriggers[s] || [] });
    }
    return food;
}

/**
 * Run one simulation for a given food loadout and extract the metrics Optimize Food ranks on.
 * @param {Object} ctx - Shared run context (semaphore, gameData, playerDTOs, baseIndex, zoneHrid,
 *   difficultyTier, hours, extraBuffs, selfHrid)
 * @param {Array<Object|null>} food - Food DTO for the base player's food slots
 * @param {Set<string>} comboHrids - Item hrids in this combo, to isolate their cost from other
 *   already-equipped consumables (coffee/drinks) that stay constant across every test.
 * @returns {Promise<{deathsPerHour: number, oomPercent: number, costPerHour: number}>}
 */
async function evaluateFood(ctx, food, comboHrids) {
    // The exact same food+trigger config can come up more than once (e.g. refineTriggers's
    // slot-0 default candidate duplicates the combo's original all-default search result, or two
    // combos happen to share a slot config) — cache by the config itself so repeats never pay for
    // another sim.
    const cacheKey = JSON.stringify(food);
    if (ctx.simCache.has(cacheKey)) return ctx.simCache.get(cacheKey);

    const { semaphore, gameData, playerDTOs, baseIndex, zoneHrid, difficultyTier, hours, extraBuffs, selfHrid } = ctx;
    const modifiedDTOs = playerDTOs.map((p, idx) => (idx === baseIndex ? { ...p, food } : p));

    const message = {
        type: 'start_simulation',
        taskId: ++simTaskIdCounter,
        gameData,
        playerDTOs: modifiedDTOs,
        zoneHrid,
        difficultyTier,
        simulationTimeLimit: hours * ONE_HOUR_NS,
        extraBuffs,
    };

    const release = await semaphore.acquire();
    let simResult;
    try {
        simResult = await runWorkerChunk(message);
    } finally {
        release();
    }

    const simHours = (simResult.simulatedTime || 0) / ONE_HOUR_NS || hours;
    const deathsPerHour = (simResult.deaths?.[selfHrid] || 0) / simHours;

    const oomStat = simResult.playerRanOutOfManaTime?.[selfHrid];
    const oomPercent = oomStat ? Math.min(100, (oomStat.totalTimeForOutOfMana / simResult.simulatedTime) * 100) : 0;

    const consumablesUsed = simResult.consumablesUsed?.[selfHrid] || {};
    let costPerHour = 0;
    for (const [itemHrid, count] of Object.entries(consumablesUsed)) {
        if (!comboHrids.has(itemHrid)) continue;
        const price = getBuyPrice(marketAPI.getPrice(itemHrid));
        costPerHour += (count / simHours) * price;
    }

    const metrics = { deathsPerHour, oomPercent, costPerHour };
    ctx.simCache.set(cacheKey, metrics);
    return metrics;
}

/**
 * Per food slot, binary search TRIGGER_MULTIPLIERS (ordered most-aggressive/safest to
 * most-lenient/cheapest) for the loosest threshold that still reaches the 0-death/0-OOM floor,
 * instead of testing every candidate. Assumes safety is monotonic in aggressiveness (triggering
 * earlier/more often can't hurt survival, only cost) — same shortcut the combo search uses, just
 * applied per-slot. Falls back to testing every candidate only if even the most aggressive
 * threshold can't reach the floor (the monotonic shortcut no longer applies). The item's default
 * in-game trigger is always tested too, in case it's already at or near optimal.
 * One slot at a time, holding the other (already-decided) slots fixed — coordinate descent
 * across slots, binary search within each slot.
 * @param {Object} entry - A ranked combo result from the initial (default-trigger) search
 * @param {Object} ctx - Shared run context, see evaluateFood
 * @returns {Promise<Object>} entry with refined metrics + slotTriggers
 */
async function refineTriggers(entry, ctx) {
    const { combo } = entry;
    const comboHrids = new Set(combo.map((c) => c.hrid));
    const slotTriggers = combo.map(() => null);
    let bestMetrics = {
        deathsPerHour: entry.deathsPerHour,
        oomPercent: entry.oomPercent,
        costPerHour: entry.costPerHour,
    };

    for (let s = 0; s < combo.length; s++) {
        if (ctx.isAborted()) break;

        const item = combo[s];
        const restoreAmount = item.hp > 0 ? item.hp : item.mp;
        if (!restoreAmount) continue;
        const conditionHrid =
            item.hp > 0 ? '/combat_trigger_conditions/missing_hp' : '/combat_trigger_conditions/missing_mp';

        const buildTriggers = (multiplier) => [
            {
                dependencyHrid: '/combat_trigger_dependencies/self',
                conditionHrid,
                comparatorHrid: '/combat_trigger_comparators/greater_than_equal',
                value: Math.max(1, Math.round(restoreAmount * multiplier)),
            },
        ];

        const testCandidate = async (triggers) => {
            const testTriggers = [...slotTriggers];
            testTriggers[s] = triggers;
            const food = buildFoodDTO(combo, testTriggers);
            const metrics = await evaluateFood(ctx, food, comboHrids);
            return { triggers, metrics };
        };

        const cache = new Map();
        const testMultiplierAt = async (i) => {
            if (cache.has(i)) return cache.get(i);
            const result = await testCandidate(buildTriggers(TRIGGER_MULTIPLIERS[i]));
            cache.set(i, result);
            return result;
        };

        const mostAggressive = await testMultiplierAt(0);
        if (passesFloor(mostAggressive.metrics)) {
            // Find the rightmost (loosest/cheapest) multiplier that still passes the floor.
            let lo = 0;
            let hi = TRIGGER_MULTIPLIERS.length - 1;
            while (lo < hi) {
                const mid = Math.ceil((lo + hi) / 2);
                const result = await testMultiplierAt(mid);
                if (passesFloor(result.metrics)) {
                    lo = mid;
                } else {
                    hi = mid - 1;
                }
            }
        } else {
            // Even the most aggressive threshold can't reach the floor for this slot — the
            // monotonic-safety shortcut doesn't apply, so test the rest to find the best
            // achievable result instead of just the boundary.
            for (let i = 1; i < TRIGGER_MULTIPLIERS.length; i++) {
                await testMultiplierAt(i);
            }
        }

        // At slot 0, every slotTriggers entry is still null, so this "default" test is the exact
        // same all-default-trigger config already simulated once for this combo during the
        // initial search — reuse that result instead of re-running an identical sim.
        const defaultCandidate = s === 0 ? { triggers: null, metrics: bestMetrics } : await testCandidate(null);

        const candidates = [...cache.values(), defaultCandidate];
        candidates.sort((a, b) => compareMetrics(a.metrics, b.metrics));
        const winner = candidates[0];
        slotTriggers[s] = winner.triggers;
        bestMetrics = winner.metrics;
    }

    return { ...entry, ...bestMetrics, slotTriggers };
}

/**
 * Rank combos fewest deaths/hr first, then least OOM time, then cheapest — the same priority
 * order used throughout this module (see compareMetrics) — and return the top N overall. A
 * cheaper combo with worse deaths/OOM can never outrank a pricier one that actually survives
 * better, since that comparison always wins first; cost only breaks ties within the same
 * deaths/OOM tier.
 * @param {Array<Object>} results
 * @param {number} [limit]
 * @returns {Array<Object>}
 */
export function rankFoodResults(results, limit = 5) {
    if (!results.length) return [];
    return [...results].sort(compareMetrics).slice(0, limit);
}

/**
 * Describe a combo's per-slot trigger thresholds, e.g. "Cake (missing HP ≥ 320) + Coffee
 * (default)". Omitted (undefined slotTriggers) means the combo wasn't refined.
 * @param {Object} entry
 * @returns {string|null}
 */
export function describeFoodTriggers(entry) {
    if (!entry.slotTriggers) return null;
    return entry.combo
        .map((item, i) => {
            const triggers = entry.slotTriggers[i];
            if (!triggers || !triggers.length) return `${item.name}: default`;
            const t = triggers[0];
            const stat = t.conditionHrid.endsWith('missing_hp') ? 'HP' : 'MP';
            return `${item.name}: missing ${stat} ≥ ${t.value}`;
        })
        .join(', ');
}

/**
 * Search food/mana-food combos for the given combat context, headless (no DOM). Binary-searches
 * the cheapest combo reaching a 0-death/0-OOM floor, then refines trigger thresholds on the
 * top candidates.
 * @param {Object} params
 * @param {Object} params.gameData
 * @param {Array<Object>} params.playerDTOs
 * @param {number} params.baseIndex - Index of the player whose food loadout is being searched
 * @param {string} params.zoneHrid
 * @param {number} params.difficultyTier
 * @param {number} params.hours - Test hours per combo
 * @param {Array<Object>} params.extraBuffs
 * @param {string} params.selfHrid
 * @param {Function} [params.isAborted] - () => boolean
 * @param {Function} [params.onProgress] - ({completed, total, phase}) => void
 * @returns {Promise<{results: Array<Object>, refined: Array<Object>, reachedFloor: boolean}>}
 */
export async function runFoodOptimization(params) {
    const {
        gameData,
        playerDTOs,
        baseIndex,
        zoneHrid,
        difficultyTier,
        hours,
        extraBuffs,
        selfHrid,
        isAborted = () => false,
        onProgress = () => {},
    } = params;

    const groups = getCandidateFoodGroups();
    // Cheapest-first order. Combined with the floor early-exit below: once a combo hits the
    // absolute floor (0 deaths, 0% OOM) nothing can beat it — everything already tested was
    // cheaper, and everything still untested is guaranteed pricier by this ordering. Short of
    // that floor we can't prove a cheaper-but-untested combo won't do better without running
    // it, so no combo is ever skipped unless that guarantee actually holds.
    const combos = generateFoodCombos(groups, MAX_FOOD_SLOTS).sort(
        (a, b) => a.reduce((s, c) => s + c.price, 0) - b.reduce((s, c) => s + c.price, 0)
    );

    const semaphore = createSemaphore(Math.max(1, getMaxWorkers()));
    const ctx = {
        semaphore,
        gameData,
        playerDTOs,
        baseIndex,
        zoneHrid,
        difficultyTier,
        hours,
        extraBuffs,
        selfHrid,
        isAborted,
        simCache: new Map(),
    };

    const results = [];
    const tested = new Map();
    let completed = 0;

    const testIndex = async (i) => {
        if (tested.has(i)) return tested.get(i);
        const combo = combos[i];
        const food = buildFoodDTO(
            combo,
            combo.map(() => null)
        );
        const comboHrids = new Set(combo.map((c) => c.hrid));

        let metrics;
        try {
            metrics = await evaluateFood(ctx, food, comboHrids);
        } catch (err) {
            if (err.message === 'Cancelled') return null;
            console.error('[OptimizeFoodCore] Simulation failed for combo', combo, err);
            return null;
        }

        completed++;
        onProgress({ completed, total: combos.length, phase: 'search' });

        const entry = { combo, label: combo.map((c) => c.name).join(' + ') || 'No food', ...metrics };
        tested.set(i, entry);
        results.push(entry);
        return entry;
    };

    const testIndicesInParallel = async (indices) => {
        let cursor = 0;
        const workerCount = Math.max(1, Math.min(getMaxWorkers(), indices.length));
        await Promise.all(
            Array.from({ length: workerCount }, async () => {
                while (cursor < indices.length && !isAborted()) {
                    await testIndex(indices[cursor++]);
                }
            })
        );
    };

    // Binary search the price-sorted combo list for the cheapest one that reaches the
    // 0-death/0-OOM floor, rather than scanning cheapest-first.
    let lo = 0;
    let hi = combos.length;
    let boundaryIndex = combos.length;
    while (lo < hi && !isAborted()) {
        const mid = (lo + hi) >> 1;
        const entry = await testIndex(mid);
        if (entry && passesFloor(entry)) {
            boundaryIndex = mid;
            hi = mid;
        } else {
            lo = mid + 1;
        }
    }

    const reachedFloor = boundaryIndex < combos.length;

    if (!isAborted()) {
        if (reachedFloor) {
            onProgress({ completed, total: combos.length, phase: 'gathering' });
            const windowEnd = Math.min(combos.length, boundaryIndex + FILL_WINDOW);
            const fillIndices = [];
            for (let i = boundaryIndex; i < windowEnd; i++) {
                if (!tested.has(i)) fillIndices.push(i);
            }
            await testIndicesInParallel(fillIndices);
        } else {
            // No combo reaches the 0-death/0-OOM floor (e.g. the build takes too much damage for
            // food alone to fully prevent deaths) — the boundary-search shortcut above doesn't
            // apply, since there's no floor to binary-search a boundary against. Rather than
            // falling back to testing all combos, ternary-search the price-sorted list for the
            // region of lowest deaths/hr (then OOM%, then cost): each round tests two interior
            // points and discards the third of the range on the worse side, assuming
            // survivability is roughly non-decreasing with price (stronger/pricier food is never
            // less safe) — the same shortcut the floor-search already relies on, just aimed at
            // minimizing instead of hitting an exact floor. Once the range narrows to a normal
            // fill-window size, that final (small) window is tested in full for a real pool to
            // rank/refine from.
            onProgress({ completed, total: combos.length, phase: 'narrowing' });
            let lo = 0;
            let hi = combos.length - 1;
            while (hi - lo > FILL_WINDOW && !isAborted()) {
                const third = Math.floor((hi - lo) / 3);
                const m1 = lo + third;
                const m2 = hi - third;
                const [r1, r2] = await Promise.all([testIndex(m1), testIndex(m2)]);
                if (!r1 || !r2) break;
                if (compareMetrics(r1, r2) <= 0) {
                    hi = m2;
                } else {
                    lo = m1;
                }
            }

            onProgress({ completed, total: combos.length, phase: 'gathering' });
            const windowIndices = [];
            for (let i = lo; i <= hi; i++) {
                if (!tested.has(i)) windowIndices.push(i);
            }
            await testIndicesInParallel(windowIndices);
        }
    }

    if (isAborted()) {
        return { results, refined: results, reachedFloor };
    }

    // Refine trigger thresholds on the best few combos rather than just the single best — a
    // slightly pricier combo can end up winning once its food's triggers are tuned. Report
    // progress as combos finish refining (each one runs its own multi-sim binary search
    // internally) so the bar keeps moving through what would otherwise look like a long stall.
    const toRefine = [...results].sort(compareMetrics).slice(0, COMBOS_TO_REFINE);
    let refinedCount = 0;
    onProgress({ completed: refinedCount, total: toRefine.length, phase: 'refining' });
    const refined = isAborted()
        ? toRefine
        : await Promise.all(
              toRefine.map(async (entry) => {
                  const result = await refineTriggers(entry, ctx);
                  refinedCount++;
                  onProgress({ completed: refinedCount, total: toRefine.length, phase: 'refining' });
                  return result;
              })
          );

    return { results, refined, reachedFloor };
}

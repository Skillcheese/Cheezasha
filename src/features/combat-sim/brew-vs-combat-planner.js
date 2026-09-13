/**
 * Brew vs Combat Planner
 *
 * Pure decision-support math for the classic idle-game tradeoff: keep running a
 * high gold/hr skilling loop (e.g. brewing) to fund gear, or switch to combat now
 * to start earning combat XP (and gear it up as you go), or some sequenced mix.
 *
 * Inputs are plain numbers the caller gathers from elsewhere in the tool:
 *   - `currentCombat` / `targetCombat` — { goldPerHr, xpPerHr } from running the
 *     Combat Sim (Configure > Simulate) against your current gear and against a
 *     saved Build representing your gear target (see sim-builds.js).
 *   - `gearCost` — gold needed to go from current gear to the target build, e.g.
 *     from the Sim Editor's equipment price estimate (current build price minus
 *     current gear price, or the full target price if starting from nothing).
 *   - `targetXp` — combat XP still needed to reach whatever milestone you're
 *     aiming for (read off the in-game skill panel, or sum of several levels).
 *
 * This module deliberately does not know about the game's level/XP curve or pull
 * live data — that only exists inside the running userscript. It only does the
 * money/time arithmetic once you have the four numbers above.
 */

/**
 * Effective gold cost (or gain, if negative) per XP earned from fighting at the
 * given combat rates, relative to what you'd have made brewing instead.
 * Negative means combat already pays better than brewing — an unambiguous
 * "just fight" signal, independent of any milestone math below.
 * @param {number} brewGoldPerHr
 * @param {{goldPerHr: number, xpPerHr: number}} combat
 * @returns {number|null} gold per XP, or null if xpPerHr is 0 (undefined ratio)
 */
export function effectiveCostPerXp(brewGoldPerHr, combat) {
    if (!combat || !(combat.xpPerHr > 0)) return null;
    const opportunityCostPerHr = brewGoldPerHr - combat.goldPerHr;
    return opportunityCostPerHr / combat.xpPerHr;
}

/**
 * Strategy: brew until you can afford the full gear target, then switch to
 * combat at the geared-up rates for the rest of the way.
 * @private
 */
function planBrewThenCombat({ brewGoldPerHr, targetCombat, gearCost, targetXp }) {
    if (!(targetCombat.xpPerHr > 0)) return null;
    const brewHours = brewGoldPerHr > 0 ? Math.max(0, gearCost) / brewGoldPerHr : Infinity;
    const combatHours = targetXp / targetCombat.xpPerHr;
    const totalHours = brewHours + combatHours;
    const goldEarned = brewGoldPerHr * brewHours + targetCombat.goldPerHr * combatHours;
    return {
        key: 'brewThenCombat',
        label: 'Brew now, buy full gear, then switch to combat',
        totalHours,
        phases: [
            { activity: 'brew', hours: brewHours },
            { activity: 'combat (geared)', hours: combatHours },
        ],
        goldLeftover: goldEarned - Math.max(0, gearCost),
    };
}

/**
 * Strategy: fight at today's gear the whole way, never upgrading. The naive
 * baseline — useful to see how much an upgrade is actually worth.
 * @private
 */
function planCombatNowNoUpgrade({ currentCombat, targetXp }) {
    if (!(currentCombat.xpPerHr > 0)) return null;
    const totalHours = targetXp / currentCombat.xpPerHr;
    return {
        key: 'combatNowNoUpgrade',
        label: 'Fight now at current gear, never upgrade',
        totalHours,
        phases: [{ activity: 'combat (current gear)', hours: totalHours }],
        goldLeftover: currentCombat.goldPerHr * totalHours,
    };
}

/**
 * Strategy: fight now at current gear, self-fund the gear target from combat's
 * own gold income, then continue at the geared-up rates. Falls back to null if
 * combat doesn't earn gold at all (can't self-fund).
 * @private
 */
function planHybrid({ currentCombat, targetCombat, gearCost, targetXp }) {
    if (!(currentCombat.xpPerHr > 0) || !(targetCombat.xpPerHr > 0)) return null;
    if (!(currentCombat.goldPerHr > 0)) return null;

    const cost = Math.max(0, gearCost);
    const phase1Hours = cost / currentCombat.goldPerHr;
    const phase1Xp = currentCombat.xpPerHr * phase1Hours;

    if (phase1Xp >= targetXp) {
        // Reach the XP goal before you'd even have afforded the upgrade — gear was moot.
        const totalHours = targetXp / currentCombat.xpPerHr;
        return {
            key: 'hybrid',
            label: 'Fight now, self-fund gear from combat income',
            totalHours,
            phases: [{ activity: 'combat (current gear)', hours: totalHours }],
            goldLeftover: currentCombat.goldPerHr * totalHours,
            gearBoughtMidway: false,
        };
    }

    const remainingXp = targetXp - phase1Xp;
    const phase2Hours = remainingXp / targetCombat.xpPerHr;
    const totalHours = phase1Hours + phase2Hours;
    const goldEarned = currentCombat.goldPerHr * phase1Hours + targetCombat.goldPerHr * phase2Hours;
    return {
        key: 'hybrid',
        label: 'Fight now, self-fund gear from combat income',
        totalHours,
        phases: [
            { activity: 'combat (current gear)', hours: phase1Hours },
            { activity: 'combat (geared)', hours: phase2Hours },
        ],
        goldLeftover: goldEarned - cost,
        gearBoughtMidway: true,
    };
}

/**
 * Compare strategies for reaching a combat XP milestone and recommend the fastest.
 * @param {Object} params
 * @param {number} params.brewGoldPerHr - Gold/hr from your alternative skilling loop
 * @param {{goldPerHr: number, xpPerHr: number}} params.currentCombat - Sim result at current gear
 * @param {{goldPerHr: number, xpPerHr: number}} params.targetCombat - Sim result at target gear
 * @param {number} params.gearCost - Gold needed to reach the target gear from current gear
 * @param {number} params.targetXp - Combat XP remaining to the goal
 * @returns {{
 *   strategies: Array<Object>,
 *   recommended: Object|null,
 *   diagnostics: {
 *     opportunityCostPerHrNow: number,
 *     costPerXpNow: number|null,
 *     costPerXpAfterGearing: number|null,
 *     combatAlreadyBeatsBrewing: boolean
 *   }
 * }}
 */
export function planBrewVsCombat({ brewGoldPerHr, currentCombat, targetCombat, gearCost, targetXp }) {
    const strategies = [
        planBrewThenCombat({ brewGoldPerHr, targetCombat, gearCost, targetXp }),
        planCombatNowNoUpgrade({ currentCombat, targetXp }),
        planHybrid({ currentCombat, targetCombat, gearCost, targetXp }),
    ].filter(Boolean);

    let recommended = null;
    for (const strategy of strategies) {
        if (!recommended) {
            recommended = strategy;
            continue;
        }
        if (strategy.totalHours < recommended.totalHours) {
            recommended = strategy;
        } else if (strategy.totalHours === recommended.totalHours && strategy.goldLeftover > recommended.goldLeftover) {
            recommended = strategy;
        }
    }

    const costPerXpNow = effectiveCostPerXp(brewGoldPerHr, currentCombat);
    const costPerXpAfterGearing = effectiveCostPerXp(brewGoldPerHr, targetCombat);

    return {
        strategies,
        recommended,
        diagnostics: {
            opportunityCostPerHrNow: brewGoldPerHr - currentCombat.goldPerHr,
            costPerXpNow,
            costPerXpAfterGearing,
            combatAlreadyBeatsBrewing: targetCombat.goldPerHr >= brewGoldPerHr,
        },
    };
}

/**
 * Event-driven simulation of climbing through an ordered list of gear stages via combat alone.
 *
 * Gold and combat XP accrue simultaneously while fighting, so the wait before the next stage's
 * gear can be worn is max(time to afford it, time to reach its required XP) — banking extra gold
 * ahead of time (see `planProgression`'s pre-brew candidates) only ever shortens the gold half of
 * that max, never the XP half. A stage whose `requiredXp` you haven't reached is not skippable by
 * having more money: there is no way to buy a combat level in this game.
 *
 * @param {Array<{name: string, cost: number, goldPerHr: number, xpPerHr: number, requiredXp?: number}>} stages
 *   Ordered from current gear (stages[0]; cost should be 0) to the final target. Each `cost` is
 *   the INCREMENTAL gold needed over the previous stage — e.g. from the gear-price estimator,
 *   this stage's total gear price minus the previous stage's. `requiredXp` (optional, default 0)
 *   is the cumulative combat XP needed before that stage's gear can be worn at all (from item
 *   level requirements) — omit it if the stage has no level gate over the previous one.
 * @param {Object} options
 * @param {number} options.targetXp - Combat XP to reach, counted from 0 at the start of the climb
 * @param {number} [options.startingGold=0] - Gold already banked before the climb starts (e.g. from pre-brewing)
 * @returns {{
 *   timeline: Array<{stage: string, startHour: number, endHour: number, reason: string}>,
 *   totalHours: number,
 *   finalGold: number,
 *   reachedStageIndex: number,
 *   feasible: boolean,
 *   blockedReason: string|null
 * }}
 */
export function simulateClimb(stages, { targetXp, startingGold = 0 }) {
    if (!stages || stages.length === 0) {
        return {
            timeline: [],
            totalHours: 0,
            finalGold: startingGold,
            reachedStageIndex: -1,
            feasible: false,
            blockedReason: 'No stages provided',
        };
    }

    let gold = startingGold;
    let xp = 0;
    let hour = 0;
    const timeline = [];

    for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        const next = stages[i + 1];

        if (!(stage.xpPerHr > 0)) {
            return {
                timeline,
                totalHours: Infinity,
                finalGold: gold,
                reachedStageIndex: i,
                feasible: false,
                blockedReason: `${stage.name} earns no combat XP`,
            };
        }

        const xpNeededForGoal = targetXp - xp;
        if (xpNeededForGoal <= 0) break;
        const hoursToGoal = xpNeededForGoal / stage.xpPerHr;

        if (!next) {
            // Final stage — fight it out to the goal.
            timeline.push({
                stage: stage.name,
                startHour: hour,
                endHour: hour + hoursToGoal,
                reason: 'reached target XP',
            });
            hour += hoursToGoal;
            gold += stage.goldPerHr * hoursToGoal;
            return {
                timeline,
                totalHours: hour,
                finalGold: gold,
                reachedStageIndex: i,
                feasible: true,
                blockedReason: null,
            };
        }

        // Time to both afford and qualify for the next stage, fighting at this stage's rates.
        const neededGold = Math.max(0, next.cost - gold);
        const goldTimeHours = neededGold > 0 ? (stage.goldPerHr > 0 ? neededGold / stage.goldPerHr : Infinity) : 0;
        const neededXp = Math.max(0, (next.requiredXp || 0) - xp);
        const xpTimeHours = neededXp > 0 ? neededXp / stage.xpPerHr : 0;
        const transitionHours = Math.max(goldTimeHours, xpTimeHours);

        if (transitionHours >= hoursToGoal) {
            // Reach the XP goal before the next stage ever unlocks — this also covers the case
            // where the next stage can never be afforded at all (transitionHours = Infinity):
            // earning zero gold at this stage doesn't stop you from eventually grinding out the
            // XP goal here, it just means you never get to upgrade past this gear.
            timeline.push({
                stage: stage.name,
                startHour: hour,
                endHour: hour + hoursToGoal,
                reason: 'reached target XP',
            });
            hour += hoursToGoal;
            gold += stage.goldPerHr * hoursToGoal;
            return {
                timeline,
                totalHours: hour,
                finalGold: gold,
                reachedStageIndex: i,
                feasible: true,
                blockedReason: null,
            };
        }

        timeline.push({
            stage: stage.name,
            startHour: hour,
            endHour: hour + transitionHours,
            reason: `unlocked ${next.name}`,
        });
        hour += transitionHours;
        gold += stage.goldPerHr * transitionHours - next.cost;
        xp += stage.xpPerHr * transitionHours;
    }

    return {
        timeline,
        totalHours: hour,
        finalGold: gold,
        reachedStageIndex: stages.length - 1,
        feasible: xp >= targetXp,
        blockedReason: xp < targetXp ? 'Ran out of stages before reaching target XP' : null,
    };
}

/**
 * Compare pure combat-funded climbing against climbing with a pre-brewed gold head start, across
 * an ordered list of gear stages (typically your current gear plus a run of saved Builds sorted
 * cheapest-to-priciest). Only pre-brewing enough to cover a stage's incremental cost can help —
 * and only at stages where gold, not the XP/level requirement, is the actual bottleneck.
 * @param {Array<{name: string, cost: number, goldPerHr: number, xpPerHr: number, requiredXp?: number}>} stages
 *   stages[0] should represent gear you already have equipped, with cost 0 — later stages' `cost`
 *   is the incremental gold for items you don't already own (see calculateGearUpgradeCost in
 *   gear-price.js), not each stage's full gear-set price.
 * @param {Object} options
 * @param {number} options.brewGoldPerHr - Gold/hr from your alternative skilling loop
 * @param {number} options.targetXp - Combat XP to reach, counted from 0 at the start of the climb
 * @param {number} [options.startingGold=0] - Gold already on hand before any brewing or fighting
 * @returns {{
 *   candidates: Array<Object>,
 *   recommended: Object|null
 * }}
 */
export function planProgression(stages, { brewGoldPerHr, targetXp, startingGold = 0 }) {
    if (!stages || stages.length === 0) return { candidates: [], recommended: null };

    const cumulativeCosts = [];
    let running = 0;
    for (const stage of stages) {
        running += stage.cost || 0;
        cumulativeCosts.push(running);
    }

    const candidates = [];

    const pureClimb = simulateClimb(stages, { targetXp, startingGold });
    candidates.push({
        label: 'Fight now, climb gear tiers as you can afford/qualify for them',
        preBrewHours: 0,
        totalHoursWithPreBrew: pureClimb.totalHours,
        ...pureClimb,
    });

    for (let k = 1; k < stages.length; k++) {
        // Only pre-brew whatever's still missing beyond gold already on hand — never re-bank
        // money you already have.
        const additionalNeeded = Math.max(0, cumulativeCosts[k] - startingGold);
        const preBrewHours =
            additionalNeeded > 0 ? (brewGoldPerHr > 0 ? additionalNeeded / brewGoldPerHr : Infinity) : 0;
        const climb = simulateClimb(stages, { targetXp, startingGold: startingGold + additionalNeeded });
        candidates.push({
            label: `Brew first to bank ${stages[k].name}'s gear cost, then climb`,
            preBrewHours,
            totalHoursWithPreBrew: preBrewHours + climb.totalHours,
            ...climb,
        });
    }

    let recommended = null;
    for (const candidate of candidates) {
        if (!candidate.feasible || !Number.isFinite(candidate.totalHoursWithPreBrew)) continue;
        if (!recommended || candidate.totalHoursWithPreBrew < recommended.totalHoursWithPreBrew) {
            recommended = candidate;
        }
    }

    return { candidates, recommended };
}

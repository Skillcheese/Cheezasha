/**
 * Progression Optimizer
 *
 * The core "plan my next T hours" engine. Generalizes brew-vs-combat-planner.js's
 * single-skill climb to a real per-skill XP vector (attack/defense/melee/ranged/magic/etc. —
 * a fight trains several skills at once, and gear (weapons, charms) can bias which skills gain
 * XP and how fast), gated by the game's real level requirements per equipped item, using the
 * hardcoded level curve in combat-level-xp-table.js. Fully pure and unit-testable — the only
 * things that require the live game are the inputs themselves (each stage's simulated
 * gold/hr and per-skill xp/hr, and each item's level requirements), which come from
 * progression-planner.js's zone scan.
 *
 * Stages are walked in the order given (the caller is expected to have sorted them, typically
 * ascending by profit/hr) — this module doesn't search over stage orderings, it assumes better
 * gear is monotonically further along that list, and just works out the timing.
 */

import { getXpForLevel } from './combat-level-xp-table.js';

/**
 * @typedef {Object} ProgressionStage
 * @property {string} name
 * @property {number} cost - Incremental gold over the previous stage in the list
 * @property {number} goldPerHr
 * @property {Object<string, number>} xpPerHrBySkill - e.g. { '/skills/attack': 12000, '/skills/defense': 8000 }
 * @property {Array<{skillHrid: string, level: number}>} [requiredLevels] - Level gate to wear this stage's gear
 */

/**
 * Which combat skills actually matter for each fighting style — used to keep XP gained in an
 * off-target skill (e.g. melee XP from a melee weapon while planning a magic progression) from
 * inflating the objective score just because it happened to be earned along the way (typically
 * while bridging from current gear to the first eligible build of the intended style).
 */
export const STYLE_RELEVANT_SKILLS = {
    melee: ['/skills/attack', '/skills/melee', '/skills/defense', '/skills/stamina'],
    ranged: ['/skills/ranged', '/skills/defense', '/skills/stamina'],
    magic: ['/skills/magic', '/skills/intelligence', '/skills/defense', '/skills/stamina'],
};

/**
 * Sum every skill's XP into a single scalar, for scoring/reporting.
 * @param {Object<string, number>} skillXp
 * @returns {number}
 */
export function sumSkillXp(skillXp) {
    return Object.values(skillXp || {}).reduce((sum, xp) => sum + xp, 0);
}

/**
 * XP actually GAINED (final minus starting) in the given skills, defaulting to every skill
 * present in `finalSkillXp` when no specific list is given. Use this for "progress made" —
 * `sumSkillXp` alone includes XP the character already had before the plan even started.
 * @param {Object<string, number>} finalSkillXp
 * @param {Object<string, number>} startingSkillXp
 * @param {Array<string>} [relevantSkillHrids] - Restrict to these skills only, if given
 * @returns {number}
 */
export function sumGainedXp(finalSkillXp, startingSkillXp, relevantSkillHrids) {
    const keys =
        relevantSkillHrids && relevantSkillHrids.length > 0 ? relevantSkillHrids : Object.keys(finalSkillXp || {});
    let sum = 0;
    for (const key of keys) {
        sum += (finalSkillXp?.[key] || 0) - (startingSkillXp?.[key] || 0);
    }
    return sum;
}

/**
 * Whether every one of a stage's level requirements is currently met.
 * @param {ProgressionStage} stage
 * @param {Object<string, number>} skillXp - Current cumulative XP per skill
 * @returns {boolean}
 */
export function isStageEligible(stage, skillXp) {
    return (stage.requiredLevels || []).every((req) => {
        const currentXp = skillXp?.[req.skillHrid] || 0;
        return currentXp >= getXpForLevel(req.level);
    });
}

/**
 * Total XP/hr across every skill a stage trains — used as the "how good is this stage" figure for
 * both scoring and timing.
 * @param {ProgressionStage} stage
 * @returns {number}
 */
function totalXpRate(stage) {
    return Object.values(stage.xpPerHrBySkill || {}).reduce((sum, v) => sum + v, 0);
}

/**
 * The direct gold cost to go from `fromStage`'s owned equipment straight to `toStage`'s, bypassing
 * whatever sits between them in the stage list. Prefers `fromStage.directCosts[toStage.name]`
 * (see `buildStagesFromResults` in progression-planner.js, which prices every stage pair against
 * real game data); falls back to `toStage.cost` — the cost from the PREVIOUS stage in list order —
 * for simple hand-built stage lists (e.g. in tests) that never intend to skip a stage anyway.
 * @param {ProgressionStage} fromStage
 * @param {ProgressionStage} toStage
 * @returns {number}
 */
function directCostBetween(fromStage, toStage) {
    const fromDirect = fromStage.directCosts?.[toStage.name];
    return fromDirect !== undefined ? fromDirect : toStage.cost || 0;
}

/**
 * How long it takes, fighting at `fromStage`'s rates, to reach `toStage`: the slowest of every
 * required skill level (xpTimeHours) and however long it then takes to bank the direct gold cost —
 * either by continuing to fight at `fromStage`'s own gold/hr, or by fighting only until the XP
 * gate clears and then switching to a faster alternative skilling activity (`brewGoldPerHr`) for
 * the rest, whichever is faster.
 * @param {ProgressionStage} fromStage
 * @param {ProgressionStage} toStage
 * @param {number} gold - Gold currently banked
 * @param {Object<string, number>} skillXp - Current cumulative XP per skill
 * @param {number} brewGoldPerHr
 * @returns {{timeToReach: number, directCost: number, xpTimeHours: number, useSwitch: boolean}}
 */
function timeToReachStage(fromStage, toStage, gold, skillXp, brewGoldPerHr) {
    const directCost = directCostBetween(fromStage, toStage);
    const neededGold = Math.max(0, directCost - gold);
    const goldTimeHours = neededGold > 0 ? (fromStage.goldPerHr > 0 ? neededGold / fromStage.goldPerHr : Infinity) : 0;

    let xpTimeHours = 0;
    for (const req of toStage.requiredLevels || []) {
        const neededXp = Math.max(0, getXpForLevel(req.level) - (skillXp[req.skillHrid] || 0));
        if (neededXp <= 0) continue;
        const rate = fromStage.xpPerHrBySkill?.[req.skillHrid] || 0;
        const t = rate > 0 ? neededXp / rate : Infinity;
        if (t > xpTimeHours) xpTimeHours = t;
    }

    const fightOnlyHours = Math.max(goldTimeHours, xpTimeHours);

    let switchHours = Infinity;
    if (brewGoldPerHr > 0) {
        const goldAfterXpGate = gold + fromStage.goldPerHr * xpTimeHours;
        const remainingGold = Math.max(0, directCost - goldAfterXpGate);
        switchHours = xpTimeHours + remainingGold / brewGoldPerHr;
    }

    const useSwitch = switchHours < fightOnlyHours;
    return { timeToReach: useSwitch ? switchHours : fightOnlyHours, directCost, xpTimeHours, useSwitch };
}

/**
 * Simulate climbing through a set of gear stages via combat alone, over a fixed time horizon
 * (rather than until a target is reached — see brew-vs-combat-planner.js's simulateClimb for the
 * target-XP version). At every decision point, EVERY not-yet-worn stage is considered as the next
 * target — not just the next-cheapest one in the list — and whichever reachable stage has the best
 * blended gold/XP quality is pursued directly, so a stage that isn't worth detouring through (e.g.
 * a minor incremental upgrade on the way to something much better) gets skipped entirely rather
 * than bought out of forced sequential order. If nothing reachable beats the current stage, the
 * climb just rides out the current stage to the end of the horizon.
 *
 * Reaching a stage means both affording its direct gear cost from the current stage AND meeting
 * its per-skill level requirements — whichever takes longer, since gold and every skill's XP
 * accrue simultaneously while fighting. Once the XP gate is already cleared but the gold cost
 * isn't, fighting further only banks gold at the current stage's own (possibly weak) rate; if an
 * alternative skilling activity (`brewGoldPerHr`) earns gold faster, switching to it for the rest
 * of the gold requirement reaches the target sooner. See `timeToReachStage` for both options.
 *
 * @param {Array<ProgressionStage>} stages - stages[0] should be current gear, cost 0, no requiredLevels
 * @param {Object} options
 * @param {number} options.targetHours - Total hours to simulate
 * @param {number} [options.startingGold=0]
 * @param {Object<string, number>} [options.startingSkillXp={}] - Current cumulative XP per skill
 * @param {number} [options.brewGoldPerHr=0] - Gold/hr from the alternative skilling activity, used
 *   only to bank gold once the current stage's XP gate to the target stage is already cleared
 * @param {number} [options.objectiveWeight=1] - 0 = prefer the best gold/hr stage, 1 = prefer the
 *   best total xp/hr stage, in between blends both — used to decide which reachable stage is
 *   actually worth climbing toward
 * @returns {{
 *   timeline: Array<{stage: string, startHour: number, endHour: number, reason: string}>,
 *   totalHours: number,
 *   finalGold: number,
 *   finalSkillXp: Object<string, number>,
 *   reachedStageIndex: number
 * }}
 */
export function simulateMultiSkillClimb(
    stages,
    { targetHours, startingGold = 0, startingSkillXp = {}, brewGoldPerHr = 0, objectiveWeight = 1 }
) {
    if (!stages || stages.length === 0) {
        return {
            timeline: [],
            totalHours: 0,
            finalGold: startingGold,
            finalSkillXp: { ...startingSkillXp },
            reachedStageIndex: -1,
        };
    }

    let gold = startingGold;
    const skillXp = { ...startingSkillXp };
    let hour = 0;
    let currentIndex = 0;
    let reachedStageIndex = 0;
    const timeline = [];

    const addXp = (xpPerHrBySkill, hours) => {
        for (const [skill, rate] of Object.entries(xpPerHrBySkill || {})) {
            skillXp[skill] = (skillXp[skill] || 0) + rate * hours;
        }
    };

    // Small epsilon guards against floating-point rounding making a just-reachable candidate
    // (timeToReach === hoursLeft) look infinitesimally out of reach.
    const EPS = 1e-9;

    while (hour < targetHours) {
        const hoursLeft = targetHours - hour;
        if (hoursLeft <= 0) break;
        const current = stages[currentIndex];
        const startingXp = sumSkillXp(skillXp);

        // Rank every option by its PROJECTED outcome at the end of the horizon — assuming you
        // transition to it and then ride it out for whatever time remains — not by its raw
        // gold/hr or xp/hr rate. A stage with a better rate isn't worth chasing if the cost/time
        // to reach it eats too much of the remaining horizon to pay off; this lookahead accounts
        // for that directly instead of comparing rates in a vacuum.
        const outcomes = [
            {
                index: currentIndex,
                timeToReach: 0,
                directCost: 0,
                xpTimeHours: 0,
                useSwitch: false,
                projectedGold: gold + current.goldPerHr * hoursLeft,
                projectedXp: startingXp + totalXpRate(current) * hoursLeft,
            },
        ];

        for (let j = 0; j < stages.length; j++) {
            if (j === currentIndex) continue;
            const candidate = stages[j];
            const { timeToReach, directCost, xpTimeHours, useSwitch } = timeToReachStage(
                current,
                candidate,
                gold,
                skillXp,
                brewGoldPerHr
            );
            if (timeToReach > hoursLeft + EPS) continue; // not reachable within the remaining horizon

            const cappedTime = Math.min(timeToReach, hoursLeft);
            const remaining = hoursLeft - cappedTime;
            const fightHours = useSwitch ? Math.min(xpTimeHours, cappedTime) : cappedTime;
            const brewHours = cappedTime - fightHours;

            const goldDuringTransition = current.goldPerHr * fightHours + brewGoldPerHr * brewHours;
            const xpDuringTransition = totalXpRate(current) * fightHours; // brewing gives no combat xp

            outcomes.push({
                index: j,
                timeToReach: cappedTime,
                directCost,
                xpTimeHours,
                useSwitch,
                projectedGold: gold + goldDuringTransition - directCost + candidate.goldPerHr * remaining,
                projectedXp: startingXp + xpDuringTransition + totalXpRate(candidate) * remaining,
            });
        }

        const golds = outcomes.map((o) => o.projectedGold);
        const xps = outcomes.map((o) => o.projectedXp);
        const minGold = Math.min(...golds);
        const maxGold = Math.max(...golds);
        const minXp = Math.min(...xps);
        const maxXp = Math.max(...xps);
        const normalize = (value, min, max) => (max > min ? (value - min) / (max - min) : 1);

        let best = outcomes[0];
        let bestScore = -Infinity;
        for (const outcome of outcomes) {
            const score =
                (1 - objectiveWeight) * normalize(outcome.projectedGold, minGold, maxGold) +
                objectiveWeight * normalize(outcome.projectedXp, minXp, maxXp);
            if (score > bestScore) {
                bestScore = score;
                best = outcome;
            }
        }

        if (best.index === currentIndex) {
            // Nothing reachable projects to a better outcome — ride out the current stage.
            timeline.push({ stage: current.name, startHour: hour, endHour: targetHours, reason: 'end of horizon' });
            gold += current.goldPerHr * hoursLeft;
            addXp(current.xpPerHrBySkill, hoursLeft);
            hour = targetHours;
            break;
        }

        const { index: nextIndex, timeToReach: cappedHours, directCost, xpTimeHours, useSwitch } = best;
        const target = stages[nextIndex];
        const reason = `unlocked ${target.name}`;

        if (useSwitch) {
            const fightHours = Math.min(xpTimeHours, cappedHours);
            const brewHours = cappedHours - fightHours;
            if (fightHours > 0) {
                timeline.push({
                    stage: current.name,
                    startHour: hour,
                    endHour: hour + fightHours,
                    reason: 'xp gate cleared',
                });
            }
            gold += current.goldPerHr * fightHours;
            addXp(current.xpPerHrBySkill, fightHours);
            hour += fightHours;
            if (brewHours > 0) {
                timeline.push({
                    stage: `${current.name} (brewing for gold)`,
                    startHour: hour,
                    endHour: hour + brewHours,
                    reason: 'earning money',
                });
                gold += brewGoldPerHr * brewHours;
                hour += brewHours;
            }
        } else {
            timeline.push({ stage: current.name, startHour: hour, endHour: hour + cappedHours, reason });
            gold += current.goldPerHr * cappedHours;
            addXp(current.xpPerHrBySkill, cappedHours);
            hour += cappedHours;
        }

        gold -= directCost;
        currentIndex = nextIndex;
        reachedStageIndex = nextIndex;
    }

    return { timeline, totalHours: hour, finalGold: gold, finalSkillXp: skillXp, reachedStageIndex };
}

/**
 * Find the pre-brew duration (if any) that best serves the chosen gold/XP objective within a
 * fixed hour budget, then climb for the rest. Pre-brewing never advances any combat skill, so it
 * can only ever help reach a stage you're ALREADY level-eligible for (at your starting XP)
 * faster by paying its gold cost up front — it can never skip a level requirement. Candidates are
 * therefore: no pre-brew, pre-brewing to each starting-eligible stage's cumulative cost, and (for
 * completeness at the gold end of the objective slider) brewing for the entire horizon.
 *
 * @param {Array<ProgressionStage>} stages
 * @param {Object} options
 * @param {number} options.targetHours - Total hours to plan for
 * @param {number} options.brewGoldPerHr - Gold/hr from the alternative skilling activity
 * @param {number} [options.startingGold=0]
 * @param {Object<string, number>} [options.startingSkillXp={}]
 * @param {number} [options.objectiveWeight=1] - 0 = maximize gold, 1 = maximize total combat XP, in between blends both (min-max normalized across the candidates considered)
 * @param {Array<string>} [options.relevantSkillHrids] - Restrict the XP objective to these skills
 *   only (see STYLE_RELEVANT_SKILLS) — e.g. don't let melee XP earned in a bridge phase count
 *   toward a magic progression's score. Omit to count every skill that gained any XP.
 * @returns {{ candidates: Array<Object>, recommended: Object|null }}
 */
export function optimizeProgression(
    stages,
    { targetHours, brewGoldPerHr, startingGold = 0, startingSkillXp = {}, objectiveWeight = 1, relevantSkillHrids }
) {
    if (!stages || stages.length === 0) return { candidates: [], recommended: null };

    const makeCandidate = (label, preBrewHours) => {
        const remainingHours = Math.max(0, targetHours - preBrewHours);
        const climb = simulateMultiSkillClimb(stages, {
            targetHours: remainingHours,
            startingGold: startingGold + brewGoldPerHr * preBrewHours,
            startingSkillXp,
            brewGoldPerHr,
            objectiveWeight,
        });
        return {
            label,
            preBrewHours,
            totalHours: preBrewHours + climb.totalHours,
            finalGold: climb.finalGold,
            finalSkillXp: climb.finalSkillXp,
            // XP actually gained during the plan, in the skills relevant to the chosen style —
            // never raw cumulative XP (which would include everything the character already had
            // before this plan even started), and never off-target skills that happened to gain
            // XP along the way but don't represent progress toward the intended build style.
            totalXp: sumGainedXp(climb.finalSkillXp, startingSkillXp, relevantSkillHrids),
            timeline: climb.timeline,
            reachedStageIndex: climb.reachedStageIndex,
        };
    };

    const candidates = [makeCandidate('Fight now, climb gear tiers as you can afford/qualify for them', 0)];

    for (let k = 1; k < stages.length; k++) {
        if (!isStageEligible(stages[k], startingSkillXp)) continue; // pre-brewing can't reach a level gate
        // Direct cost from Current Gear to this stage — bypasses any cheaper stage in between,
        // since pre-brewing to bank money for one specific target shouldn't force buying gear
        // for stages you never intend to wear along the way.
        const directCost = directCostBetween(stages[0], stages[k]);
        const additionalNeeded = Math.max(0, directCost - startingGold);
        if (additionalNeeded <= 0) continue; // already affordable — identical to the H=0 candidate
        const preBrewHours = brewGoldPerHr > 0 ? Math.min(targetHours, additionalNeeded / brewGoldPerHr) : targetHours;
        candidates.push(makeCandidate(`Brew first to bank ${stages[k].name}'s gear cost, then climb`, preBrewHours));
    }

    candidates.push(makeCandidate('Brew for the entire time budget, never fight', targetHours));

    const golds = candidates.map((c) => c.finalGold);
    const xps = candidates.map((c) => c.totalXp);
    const minGold = Math.min(...golds);
    const maxGold = Math.max(...golds);
    const minXp = Math.min(...xps);
    const maxXp = Math.max(...xps);
    const normalize = (value, min, max) => (max > min ? (value - min) / (max - min) : 1);

    let recommended = null;
    for (const candidate of candidates) {
        const normGold = normalize(candidate.finalGold, minGold, maxGold);
        const normXp = normalize(candidate.totalXp, minXp, maxXp);
        candidate.score = (1 - objectiveWeight) * normGold + objectiveWeight * normXp;
        if (!recommended || candidate.score > recommended.score) recommended = candidate;
    }

    return { candidates, recommended };
}

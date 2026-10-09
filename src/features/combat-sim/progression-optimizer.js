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
 * `simulateMultiSkillClimb` climbs greedily; `searchBestClimb` searches every order of stages
 * (branch and bound) for the plan with the best final score, which is what `optimizeProgression` uses.
 */

import { getXpForLevel } from './combat-level-xp-table.js';

/**
 * @typedef {Object} ProgressionStage
 * @property {string} name
 * @property {string} [buildName] - The gear this stage wears. Stages sharing a buildName are the
 *   same gear fought in different zones, so moving between them is free. Defaults to `name`.
 * @property {number} cost - Incremental gold over the previous stage in the list
 * @property {number} goldPerHr
 * @property {Object<string, number>} xpPerHrBySkill - e.g. { '/skills/attack': 12000, '/skills/defense': 8000 }
 * @property {Array<{skillHrid: string, level: number}>} [requiredLevels] - Level gate to wear this stage's gear
 * @property {number} [gearValue] - Resale value of this stage's equipment. Counted toward net worth
 *   (gold + gear value) so that selling gear — e.g. downgrading just to cash out a big sell credit
 *   in `directCosts` — never looks like profit by itself. Omit/0 when gear is treated as sunk cost.
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
 * Timeline `stage` label used for every brewing leg (never a specific gear name — see
 * `simulateMultiSkillClimb`'s `BREWING_LABEL`). Exported so callers rendering the timeline (e.g.
 * combat-sim-ui.js) can recognize a brewing leg without re-deriving or hardcoding the string.
 */
export const BREWING_STAGE_LABEL = 'Earning money (not fighting)';

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
    // Zones of the same set share its gear: moving between them is always free.
    if (fromStage.buildName !== undefined && fromStage.buildName === toStage.buildName) return 0;
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
 * Build the blended gold/XP scoring function for a climb: a fixed linear scale where one unit of
 * net worth is worth `(1 - objectiveWeight) / goldScale` and one XP `objectiveWeight / xpScale`,
 * with both scales taken from the best rate across EVERY stage (not just the options on the
 * table at one decision). Being fixed for the whole climb is the point: a per-decision min-max
 * normalization re-ranks the same two stages differently depending on what else happens to be
 * reachable at that moment, which let the climb buy one set and immediately abandon it for
 * another it had just ranked lower.
 * @param {Array<ProgressionStage>} stages
 * @param {number} objectiveWeight - 0 = net worth only, 1 = XP only
 * @returns {(netWorth: number, xp: number) => number}
 */
function makeObjective(stages, objectiveWeight) {
    const goldScale = Math.max(...stages.map((s) => Math.abs(s.goldPerHr || 0))) || 1;
    const xpScale = Math.max(...stages.map(totalXpRate)) || 1;
    return (netWorth, xp) => ((1 - objectiveWeight) * netWorth) / goldScale + (objectiveWeight * xp) / xpScale;
}

/**
 * The earliest time in `(0, maxHours]` at which some OTHER stage — any index not in
 * `excludeIndices` — would newly become both affordable (its `directCostBetween` cost from
 * `current` covered by `gold`, accruing at `goldRate`) and level-eligible (any remaining
 * `requiredLevels` cleared by `skillXp`, accruing at `xpRateBySkill`), assuming those rates hold
 * for the whole window. A stage already affordable+eligible at t=0 is NOT "new" and is ignored —
 * callers are expected to have already offered it as a stepping stone (see `simulateMultiSkillClimb`).
 * Returns `maxHours` (i.e. "nothing new unlocks before this phase would end anyway") when no
 * stage qualifies.
 *
 * Used to cut a long fight/brew phase short the instant a better option opens up, instead of
 * blindly committing to a whole multi-hour transition and only reconsidering once it finishes —
 * see the two call sites in `simulateMultiSkillClimb` for why that matters (a cheap, fast
 * intermediate stage reached mid-wait can genuinely shorten the total time to the ultimate
 * target, not just look tempting in isolation).
 * @param {Array<ProgressionStage>} stages
 * @param {ProgressionStage} current
 * @param {Set<number>} excludeIndices
 * @param {number} gold
 * @param {Object<string, number>} skillXp
 * @param {number} goldRate
 * @param {Object<string, number>} xpRateBySkill
 * @param {number} maxHours
 * @returns {number}
 */
function nextNewUnlockTime(stages, current, excludeIndices, gold, skillXp, goldRate, xpRateBySkill, maxHours) {
    const EPS = 1e-9;
    let earliest = maxHours;

    for (let k = 0; k < stages.length; k++) {
        if (excludeIndices.has(k)) continue;
        const candidate = stages[k];

        const cost = directCostBetween(current, candidate);
        const goldTime = cost <= gold ? 0 : goldRate > 0 ? (cost - gold) / goldRate : Infinity;

        let xpTime = 0;
        for (const req of candidate.requiredLevels || []) {
            const neededXp = Math.max(0, getXpForLevel(req.level) - (skillXp[req.skillHrid] || 0));
            if (neededXp <= 0) continue;
            const rate = xpRateBySkill?.[req.skillHrid] || 0;
            const t = rate > 0 ? neededXp / rate : Infinity;
            if (t > xpTime) xpTime = t;
        }

        const unlockTime = Math.max(goldTime, xpTime);
        if (unlockTime > EPS && unlockTime < earliest) earliest = unlockTime;
    }

    return earliest;
}

/**
 * Simulate climbing through a set of gear stages via combat alone, over a fixed time horizon
 * (rather than until a target is reached — see brew-vs-combat-planner.js's simulateClimb for the
 * target-XP version). At every decision point, EVERY not-yet-worn stage is considered as the next
 * target — not just the next-cheapest one in the list — and whichever reachable stage has the best
 * blended gold/XP quality is pursued directly, so a stage that isn't worth detouring through (e.g.
 * a minor incremental upgrade on the way to something much better) gets skipped entirely rather
 * than bought out of forced sequential order. Each target is also weighed by way of every stage
 * that could be switched into right now (a "stepping stone": another zone for the same gear, or an
 * already-affordable, already-eligible set) and fought in on the way — e.g. a high-XP zone that
 * clears the target's level gate sooner. If nothing reachable beats the current stage, the
 * climb just rides out the current stage to the end of the horizon. It never stops fighting for
 * good to brew: brewing only happens on the way to buying a stage, and the gold it earns isn't
 * scored for its own sake — only what the gear it pays for earns afterwards is.
 *
 * Reaching a stage means both affording its direct gear cost from the current stage AND meeting
 * its per-skill level requirements — whichever takes longer, since gold and every skill's XP
 * accrue simultaneously while fighting. Once the XP gate is already cleared but the gold cost
 * isn't, fighting further only banks gold at the current stage's own (possibly weak) rate; if an
 * alternative skilling activity (`brewGoldPerHr`) earns gold faster, switching to it for the rest
 * of the gold requirement reaches the target sooner. See `timeToReachStage` for both options.
 *
 * The long grind/brew toward a picked target isn't simulated blindly start-to-finish, either: it's
 * cut short the instant some OTHER stage newly becomes affordable+eligible mid-wait (see
 * `nextNewUnlockTime`), and the whole decision is replanned from there. This is what lets the climb discover a cheap, fast intermediate stage
 * that reaches the ultimate target sooner than grinding it out directly would, not just whatever
 * was reachable at the moment the target was first picked.
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
 *   finalGearValue: number,
 *   brewGold: number,
 *   finalSkillXp: Object<string, number>,
 *   reachedStageIndex: number
 * }} `finalGearValue` is the `gearValue` of the stage worn at the end (0 when not set);
 *   `brewGold` is how much of the gold came from brewing (already included in `finalGold`)
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
            finalGearValue: 0,
            brewGold: 0,
            finalSkillXp: { ...startingSkillXp },
            reachedStageIndex: -1,
        };
    }

    let gold = startingGold;
    const skillXp = { ...startingSkillXp };
    let hour = 0;
    let currentIndex = 0;
    let reachedStageIndex = 0;
    let brewGold = 0;
    const timeline = [];

    const addXp = (xpPerHrBySkill, hours) => {
        for (const [skill, rate] of Object.entries(xpPerHrBySkill || {})) {
            skillXp[skill] = (skillXp[skill] || 0) + rate * hours;
        }
    };

    // Gear is irrelevant while brewing — every brew leg shares this one label (never a specific
    // stage name) so back-to-back brew legs (e.g. from repeated mid-wait re-checks below) merge
    // into a single continuous entry via pushLeg instead of fragmenting into a dozen near-zero-
    // length ones.
    const BREWING_LABEL = BREWING_STAGE_LABEL;

    // Appends a timeline entry, EXTENDING the previous one in place instead when it's the same
    // activity and picks up exactly where the last one left off — avoids littering the timeline
    // with a new near-zero-length entry every time a phase gets cut short (see nextNewUnlockTime)
    // to re-check something that turns out not to change anything.
    // Zero-length legs (an instant gear swap, a phase cut short at t=0) are never recorded — a
    // "0h–0h" row says nothing about how the time was actually spent.
    const pushLeg = (stage, startHour, endHour, reason) => {
        if (endHour - startHour <= 1e-9) return;
        const last = timeline[timeline.length - 1];
        if (last && last.stage === stage && last.endHour === startHour) {
            last.endHour = endHour;
            last.reason = reason;
            return;
        }
        timeline.push({ stage, startHour, endHour, reason });
    };

    const objective = makeObjective(stages, objectiveWeight);
    const gearOf = (stage) => stage.buildName ?? stage.name;

    // Small epsilon guards against floating-point rounding making a just-reachable candidate
    // (timeToReach === hoursLeft) look infinitesimally out of reach.
    const EPS = 1e-9;

    // Every stepping-stone switch below is followed by a replan at the same hour. Each one should
    // only ever improve the best projected outcome, so this can't cycle — but if floating-point
    // noise ever made two options leapfrog each other, stop taking stepping stones at that hour.
    let switchHour = -1;
    let switchesAtHour = 0;

    while (hour < targetHours) {
        const hoursLeft = targetHours - hour;
        if (hoursLeft <= 0) break;

        const current = stages[currentIndex];
        const startingXp = sumSkillXp(skillXp);

        // Stepping stones: stages that could be switched into right now (already affordable and
        // eligible) and fought in on the way to a target. Includes the other zones of the gear
        // already worn, which cost nothing to move between — e.g. training in a high-XP zone to
        // clear the target's level gate sooner, even while the target is picked purely for gold.
        const viaIndices = [currentIndex];
        if (!(hour === switchHour && switchesAtHour > stages.length)) {
            for (let v = 0; v < stages.length; v++) {
                if (v === currentIndex || !isStageEligible(stages[v], skillXp)) continue;
                if (directCostBetween(current, stages[v]) <= gold) viaIndices.push(v);
            }
        }

        // Rank every option by its PROJECTED outcome at the end of the horizon — assuming you
        // transition to it and then ride it out for whatever time remains — not by its raw
        // gold/hr or xp/hr rate. A stage with a better rate isn't worth chasing if the cost/time
        // to reach it eats too much of the remaining horizon to pay off; this lookahead accounts
        // for that directly instead of comparing rates in a vacuum. The gold side is net worth
        // (gold + the gear you'd be wearing), so a sell credit only ever counts as converting
        // gear into gold at a loss, never as income. Each target is also tried by way of every
        // stepping stone (`via`), paying the stepping stone's cost first and fighting in it on the
        // way; the current stage (no detour) is always tried first, so it wins ties.
        const outcomes = [
            {
                index: currentIndex,
                via: currentIndex,
                timeToReach: 0,
                directCost: 0,
                xpTimeHours: 0,
                useSwitch: false,
                projectedGold: gold + (current.gearValue || 0) + current.goldPerHr * hoursLeft,
                projectedXp: startingXp + totalXpRate(current) * hoursLeft,
            },
        ];

        for (const viaIndex of viaIndices) {
            const via = stages[viaIndex];
            const viaGold = gold - (viaIndex === currentIndex ? 0 : directCostBetween(current, via));

            for (let j = 0; j < stages.length; j++) {
                if (j === viaIndex) continue;
                // From a stepping stone, going back to where we are or to another zone of the
                // stepping stone's own gear is just a direct move, already tried from `current`.
                if (viaIndex !== currentIndex && (j === currentIndex || gearOf(stages[j]) === gearOf(via))) continue;
                const candidate = stages[j];
                const { timeToReach, directCost, xpTimeHours, useSwitch } = timeToReachStage(
                    via,
                    candidate,
                    viaGold,
                    skillXp,
                    brewGoldPerHr
                );
                if (timeToReach > hoursLeft + EPS) continue; // not reachable within the remaining horizon

                const cappedTime = Math.min(timeToReach, hoursLeft);
                const remaining = hoursLeft - cappedTime;
                const fightHours = useSwitch ? Math.min(xpTimeHours, cappedTime) : cappedTime;

                // Brewing income (for the rest of cappedTime) is deliberately left out of the
                // projection: brewing is only ever a faster way to fund gear, never a goal in itself
                // (see optimizeProgression's scoring). The target still wins on what the gear earns
                // once bought, net of its cost, and loses the brew hours as time spent not fighting.
                const goldDuringTransition = via.goldPerHr * fightHours;
                const xpDuringTransition = totalXpRate(via) * fightHours; // brewing gives no combat xp

                outcomes.push({
                    index: j,
                    via: viaIndex,
                    timeToReach: cappedTime,
                    directCost,
                    xpTimeHours,
                    useSwitch,
                    projectedGold:
                        viaGold +
                        goldDuringTransition -
                        directCost +
                        (candidate.gearValue || 0) +
                        candidate.goldPerHr * remaining,
                    projectedXp: startingXp + xpDuringTransition + totalXpRate(candidate) * remaining,
                });
            }
        }

        let best = outcomes[0];
        let bestScore = -Infinity;
        for (const outcome of outcomes) {
            const score = objective(outcome.projectedGold, outcome.projectedXp);
            if (score > bestScore) {
                bestScore = score;
                best = outcome;
            }
        }

        if (best.via !== currentIndex) {
            // Step into the stepping stone now and replan from there. The swap itself isn't
            // logged — the stage's own leg, pushed once fighting happens, already says which set
            // and zone are in use.
            gold -= directCostBetween(current, stages[best.via]);
            currentIndex = best.via;
            reachedStageIndex = best.via;
            if (hour !== switchHour) {
                switchHour = hour;
                switchesAtHour = 0;
            }
            switchesAtHour++;
            continue;
        }

        if (best.index === currentIndex) {
            pushLeg(current.name, hour, targetHours, 'end of horizon');
            gold += current.goldPerHr * hoursLeft;
            addXp(current.xpPerHrBySkill, hoursLeft);
            hour = targetHours;
            break;
        }

        const { index: nextIndex, timeToReach: cappedHours, directCost, xpTimeHours, useSwitch } = best;
        const target = stages[nextIndex];
        const reason = `unlocked ${gearOf(target)}`;

        // Anything reachable is already either `current` or `target` — a fresh unlock partway
        // through this phase means some OTHER stage just opened up that wasn't in the running
        // when `best` was picked, and might change the plan (see nextNewUnlockTime).
        const exclude = new Set([currentIndex, nextIndex]);
        const midWaitReason = 'a better stage became reachable mid-wait';

        if (useSwitch) {
            const fightHours = Math.min(xpTimeHours, cappedHours);
            const brewHours = cappedHours - fightHours;

            if (fightHours > EPS) {
                const unlock = nextNewUnlockTime(
                    stages,
                    current,
                    exclude,
                    gold,
                    skillXp,
                    current.goldPerHr,
                    current.xpPerHrBySkill,
                    fightHours
                );
                if (unlock < fightHours - EPS) {
                    pushLeg(current.name, hour, hour + unlock, midWaitReason);
                    gold += current.goldPerHr * unlock;
                    addXp(current.xpPerHrBySkill, unlock);
                    hour += unlock;
                    continue;
                }

                pushLeg(current.name, hour, hour + fightHours, 'xp gate cleared');
                gold += current.goldPerHr * fightHours;
                addXp(current.xpPerHrBySkill, fightHours);
                hour += fightHours;
            }

            if (brewHours > EPS) {
                const unlock = nextNewUnlockTime(stages, current, exclude, gold, skillXp, brewGoldPerHr, {}, brewHours);
                if (unlock < brewHours - EPS) {
                    pushLeg(BREWING_LABEL, hour, hour + unlock, midWaitReason);
                    gold += brewGoldPerHr * unlock;
                    brewGold += brewGoldPerHr * unlock;
                    hour += unlock;
                    continue;
                }

                pushLeg(BREWING_LABEL, hour, hour + brewHours, `earning money for ${gearOf(target)}`);
                gold += brewGoldPerHr * brewHours;
                brewGold += brewGoldPerHr * brewHours;
                hour += brewHours;
            }
        } else {
            // Not switching to brewing at all — this whole capped duration is fight time.
            const unlock = nextNewUnlockTime(
                stages,
                current,
                exclude,
                gold,
                skillXp,
                current.goldPerHr,
                current.xpPerHrBySkill,
                cappedHours
            );
            if (unlock < cappedHours - EPS) {
                pushLeg(current.name, hour, hour + unlock, midWaitReason);
                gold += current.goldPerHr * unlock;
                addXp(current.xpPerHrBySkill, unlock);
                hour += unlock;
                continue;
            }

            pushLeg(current.name, hour, hour + cappedHours, reason);
            gold += current.goldPerHr * cappedHours;
            addXp(current.xpPerHrBySkill, cappedHours);
            hour += cappedHours;
        }

        gold -= directCost;
        currentIndex = nextIndex;
        reachedStageIndex = nextIndex;
    }

    return {
        timeline,
        totalHours: hour,
        finalGold: gold,
        finalGearValue: stages[currentIndex].gearValue || 0,
        brewGold,
        finalSkillXp: skillXp,
        reachedStageIndex,
    };
}

/**
 * Exhaustive branch-and-bound search over whole climbs — the exact counterpart to the greedy
 * `simulateMultiSkillClimb`. A plan is the ORDER you move through stages in; once that's fixed,
 * the timing follows (each move happens as soon as `timeToReachStage` says it can, brewing for
 * the gold when that's faster). So this depth-first searches every order: from each state
 * (stage worn, hour, gold, XP) it branches into every stage reachable before the horizon, and
 * also scores riding the current stage out to the end.
 *
 * Kept tractable by:
 * - an optimistic bound per state (see `optimisticScoreGain`, plus the most net worth each
 *   not-yet-worn set could possibly add when bought) — a branch whose bound can't beat the best
 *   plan found so far is skipped;
 * - dominance: a state no better (same stage, no earlier, no more gold, no more scored XP, no more
 *   XP in any gating skill up to the highest gate, no fewer sets still open to it) than one
 *   already explored is skipped;
 * - dropping zones that are no better than another zone of the same set on gold, scored XP and
 *   every gating skill's XP;
 * - never going back to a set already left (a zone switch within the worn set is fine, but not
 *   two in a row, which would just cycle).
 *
 * Seed `incumbentScore` with a known plan (e.g. the greedy one) so pruning bites from the start;
 * the search then only returns a climb that strictly beats it. Stops at `deadline` (Date.now()
 * ms) and returns the best found so far with `timedOut: true`.
 *
 * Not searched: deliberately waiting longer than needed before a move, or switching zones partway
 * through a wait — neither pays off when every stage's rates are constant.
 *
 * @param {Array<ProgressionStage>} stages - stages[0] is current gear
 * @param {Object} options
 * @param {number} options.targetHours
 * @param {number} [options.startingGold=0]
 * @param {Object<string, number>} [options.startingSkillXp={}]
 * @param {number} [options.brewGoldPerHr=0]
 * @param {number} [options.objectiveWeight=1]
 * @param {Array<string>} [options.relevantSkillHrids] - Skills the XP side of the score counts
 * @param {number} [options.incumbentScore=-Infinity] - Score (see `makeObjective`) to beat
 * @param {number} [options.deadline=Infinity] - Date.now() timestamp to stop searching at
 * @param {Function} [options.onProgress] - Called at most every ~200ms with `{fraction, nodes,
 *   bestNetWorth, bestXp}`: `fraction` (0-1) is the share of the search tree finished so far
 *   (each branch weighted evenly among its siblings, so it's an estimate, not linear in time);
 *   `bestNetWorth`/`bestXp` describe the best plan this search has found (null until one)
 * @returns {{climb: Object|null, timedOut: boolean, nodes: number}} `climb` has the same shape as
 *   `simulateMultiSkillClimb`'s result, or is null when nothing beat `incumbentScore`
 */
export function searchBestClimb(
    stages,
    {
        targetHours,
        startingGold = 0,
        startingSkillXp = {},
        brewGoldPerHr = 0,
        objectiveWeight = 1,
        relevantSkillHrids,
        incumbentScore = -Infinity,
        deadline = Infinity,
        onProgress,
    }
) {
    if (!stages || stages.length === 0 || !(targetHours > 0)) return { climb: null, timedOut: false, nodes: 0 };

    const EPS = 1e-9;
    const objective = makeObjective(stages, objectiveWeight);
    const gearOf = (stage) => stage.buildName ?? stage.name;
    const gearNames = [...new Set(stages.map(gearOf))];
    const gearIdOf = stages.map((s) => gearNames.indexOf(gearOf(s)));
    const bitOf = (gearId) => 1n << BigInt(gearId);

    const relevant = relevantSkillHrids ? new Set(relevantSkillHrids) : null;
    const relevantXpRate = (stage) =>
        Object.entries(stage.xpPerHrBySkill || {}).reduce(
            (sum, [skill, rate]) => (!relevant || relevant.has(skill) ? sum + Math.max(0, rate) : sum),
            0
        );
    const xpScore = (skillXp) => sumGainedXp(skillXp, startingSkillXp, relevantSkillHrids);

    const maxGoldRate = Math.max(0, brewGoldPerHr, ...stages.map((s) => s.goldPerHr || 0));
    const maxSkillRate = {};
    for (const stage of stages) {
        for (const [skill, rate] of Object.entries(stage.xpPerHrBySkill || {})) {
            maxSkillRate[skill] = Math.max(maxSkillRate[skill] || 0, rate);
        }
    }
    // Skills some stage is gated on, and the most XP any gate needs in each: past that, more XP in
    // the skill can't unlock anything, so states are compared on XP capped there.
    const gateCap = {};
    for (const stage of stages) {
        for (const req of stage.requiredLevels || []) {
            gateCap[req.skillHrid] = Math.max(gateCap[req.skillHrid] || 0, getXpForLevel(req.level));
        }
    }
    const gateSkills = Object.keys(gateCap);
    const gateXpOf = (skillXp) => gateSkills.map((skill) => Math.min(skillXp[skill] || 0, gateCap[skill]));

    // Cheapest any move into each stage could ever be (from a different set).
    // Score per hour of each stage and of brewing (the objective is linear, so rates score too).
    const stageRate = stages.map((stage) => objective(stage.goldPerHr || 0, relevantXpRate(stage)));
    const brewRate = 0; // brew income isn't scored
    const minCostInto = stages.map((to, j) =>
        stages.reduce(
            (min, from, i) => (gearIdOf[i] === gearIdOf[j] ? min : Math.min(min, directCostBetween(from, to))),
            Infinity
        )
    );

    // Most net worth entering each set could ever add in one move (gear value gained minus what was
    // paid, e.g. when sell credits make a move cheaper than the value it adds). Each set is entered
    // at most once, so the sum over not-yet-worn sets bounds what future moves can add.
    const gearBonus = gearNames.map(() => 0);
    for (let j = 0; j < stages.length; j++) {
        for (let i = 0; i < stages.length; i++) {
            if (gearIdOf[i] === gearIdOf[j]) continue;
            const cost = directCostBetween(stages[i], stages[j]);
            if (!Number.isFinite(cost)) continue;
            const gain = (stages[j].gearValue || 0) - (stages[i].gearValue || 0) - cost;
            if (gain > gearBonus[gearIdOf[j]]) gearBonus[gearIdOf[j]] = gain;
        }
    }
    const bonusLeft = (visited) =>
        gearBonus.reduce((sum, bonus, g) => ((visited & bitOf(g)) === 0n ? sum + bonus : sum), 0);

    let bestScore = incumbentScore;
    let bestLeaf = null;
    let bestNetWorth = null;
    let bestXp = null;
    let nodes = 0;
    let timedOut = false;
    let finishedShare = 0;
    let lastReport = Date.now();
    const seen = new Map(); // stageIndex -> explored states, for dominance

    // A zone that's no better than another zone of the same set on gold, scored XP AND XP in every
    // skill some set is gated on can never be part of a better plan (moving between a set's zones
    // is free) — drop it. XP in any other skill changes nothing about the plan or its score.
    const zoneCovers = (k, i) =>
        (stages[k].goldPerHr || 0) >= (stages[i].goldPerHr || 0) &&
        relevantXpRate(stages[k]) >= relevantXpRate(stages[i]) &&
        gateSkills.every(
            (skill) => (stages[k].xpPerHrBySkill?.[skill] || 0) >= (stages[i].xpPerHrBySkill?.[skill] || 0)
        );
    const usable = stages.map(
        (_, i) =>
            i === 0 ||
            !stages.some(
                (_, k) =>
                    k !== i &&
                    k !== 0 &&
                    gearIdOf[k] === gearIdOf[i] &&
                    zoneCovers(k, i) &&
                    (!zoneCovers(i, k) || k < i) // identical zones: keep the first
            )
    );
    // Every zone of a set costs the same to buy and has the same level gate, so buying into any of
    // them is the same move: the search enters a new set through its first usable zone only, then
    // picks the zone to fight in with a free switch.
    const entryZone = gearNames.map((_, g) => stages.findIndex((_, i) => usable[i] && gearIdOf[i] === g));

    const addXp = (skillXp, rates, hours) => {
        const next = { ...skillXp };
        for (const [skill, rate] of Object.entries(rates || {})) next[skill] = (next[skill] || 0) + rate * hours;
        return next;
    };

    // How many explored states to remember per set for dominance checks. Only a memory/speed guard:
    // forgetting states never makes the result wrong, just prunes less — and too small a cap
    // prunes far too little (256 left 5-skill, 40-zone searches running for minutes; this finishes
    // them in seconds).
    const MAX_SEEN_PER_SET = 20000;
    // Keyed by set, not zone: a state that can still switch zones for free covers every zone of its
    // set, so it dominates a state in any of them.
    const isDominated = (state) => {
        const gear = gearIdOf[state.index];
        const list = seen.get(gear) || [];
        for (const other of list) {
            if (other.hour > state.hour + EPS || other.gold < state.gold - EPS || other.xp < state.xp - EPS) continue;
            if (other.gold - other.brewGold < state.gold - state.brewGold - EPS) continue;
            // `other` must have had at least the options this state has: no set worn that this one
            // hasn't, and able to fight in this state's zone (already there, or free to switch).
            // Never by its own parent, though: a state reached BY a free switch from `other` is
            // exactly how `other` covers that zone, so pruning it would leave the zone unexplored.
            if ((other.visited & ~state.visited) !== 0n) continue;
            if (other.index !== state.index && (other.freeZoneSwitch || state.parent === other)) continue;
            if (other.freeZoneSwitch && !state.freeZoneSwitch) continue;
            if (other.gateXp.every((xp, g) => xp >= state.gateXp[g] - EPS)) return true;
        }
        if (list.length < MAX_SEEN_PER_SET) list.push(state);
        seen.set(gear, list);
        return false;
    };

    // Upper bound on the score the rest of the horizon could add from `state`. Each hour is spent on
    // exactly one thing, so it's worth at most the best blended (gold and XP together, as scored)
    // rate of anything available by then; each still-enterable stage counts only from the earliest it
    // could possibly be worn — its cheapest entry cost banked at the best gold/hr anywhere, and its
    // level gate cleared at the best XP/hr for each skill anywhere.
    const optimisticScoreGain = (state, hoursLeft) => {
        const currentGear = gearIdOf[state.index];
        const unlocks = [];
        for (let k = 0; k < stages.length; k++) {
            if (!usable[k]) continue;
            const sameGear = gearIdOf[k] === currentGear;
            if (!sameGear && (state.visited & bitOf(gearIdOf[k])) !== 0n) continue;
            const cost = sameGear ? 0 : minCostInto[k];
            let t = cost <= state.gold ? 0 : maxGoldRate > 0 ? (cost - state.gold) / maxGoldRate : Infinity;
            for (const req of stages[k].requiredLevels || []) {
                const neededXp = getXpForLevel(req.level) - (state.skillXp[req.skillHrid] || 0);
                if (neededXp <= 0) continue;
                const rate = maxSkillRate[req.skillHrid] || 0;
                t = Math.max(t, rate > 0 ? neededXp / rate : Infinity);
            }
            if (t < hoursLeft) unlocks.push({ t, rate: stageRate[k] });
        }
        unlocks.sort((a, b) => a.t - b.t);

        let gain = 0;
        let rate = Math.max(0, brewRate);
        let t = 0;
        for (const unlock of unlocks) {
            gain += rate * (unlock.t - t);
            t = unlock.t;
            rate = Math.max(rate, unlock.rate);
        }
        return gain + rate * (hoursLeft - t);
    };

    // A state: `legs` are the timeline entries that led into it from `parent`.
    // `share` is this state's slice of the whole tree (for progress): split evenly among its
    // children, and counted as finished once its subtree is fully explored or pruned.
    const visit = (state, share) => {
        if (timedOut) return;
        nodes++;
        if ((nodes & 255) === 0) {
            const now = Date.now();
            if (now > deadline) {
                timedOut = true;
                return;
            }
            if (onProgress && now - lastReport >= 200) {
                lastReport = now;
                onProgress({ fraction: finishedShare, nodes, bestNetWorth, bestXp });
            }
        }

        const current = stages[state.index];
        const hoursLeft = targetHours - state.hour;
        // Scored net worth leaves brew income out (see optimizeProgression): brewing only helps by
        // getting into better gear sooner, never as income in itself.
        const netWorth = state.gold + (current.gearValue || 0) - state.brewGold;
        const xpNow = state.xp;

        const bound = objective(netWorth + bonusLeft(state.visited), xpNow) + optimisticScoreGain(state, hoursLeft);
        if (bound <= bestScore + EPS || isDominated(state)) {
            finishedShare += share;
            return;
        }

        // Leaf: ride the current stage out to the end of the horizon.
        const rideScore = objective(
            netWorth + (current.goldPerHr || 0) * hoursLeft,
            xpNow + relevantXpRate(current) * hoursLeft
        );
        if (rideScore > bestScore + EPS) {
            bestScore = rideScore;
            bestLeaf = state;
            bestNetWorth = netWorth + (current.goldPerHr || 0) * hoursLeft;
            bestXp = xpNow + relevantXpRate(current) * hoursLeft;
        }

        const children = [];
        for (let j = 0; j < stages.length; j++) {
            if (j === state.index || !usable[j]) continue;
            const sameGear = gearIdOf[j] === gearIdOf[state.index];
            if (sameGear ? state.freeZoneSwitch : (state.visited & bitOf(gearIdOf[j])) !== 0n) continue;
            if (!sameGear && j !== entryZone[gearIdOf[j]]) continue;

            const target = stages[j];
            const { timeToReach, directCost, xpTimeHours, useSwitch } = timeToReachStage(
                current,
                target,
                state.gold,
                state.skillXp,
                brewGoldPerHr
            );
            if (!(timeToReach <= hoursLeft + EPS)) continue;

            const hours = Math.min(timeToReach, hoursLeft);
            // Leaving a set the same hour it was bought (buy-and-resell through it) is never a real
            // plan — it only exploits price differences between the two moves.
            if (!sameGear && state.hour + hours - state.enteredHour <= EPS) continue;
            const fightHours = useSwitch ? Math.min(xpTimeHours, hours) : hours;
            const brewHours = hours - fightHours;
            const legs = [];
            if (fightHours > EPS) {
                const reason = useSwitch ? 'xp gate cleared' : `unlocked ${gearOf(target)}`;
                legs.push({ stage: current.name, hours: fightHours, reason });
            }
            if (brewHours > EPS) {
                legs.push({
                    stage: BREWING_STAGE_LABEL,
                    hours: brewHours,
                    reason: `earning money for ${gearOf(target)}`,
                });
            }

            const child = {
                parent: state,
                legs,
                index: j,
                hour: state.hour + hours,
                gold: state.gold + (current.goldPerHr || 0) * fightHours + brewGoldPerHr * brewHours - directCost,
                brewGold: state.brewGold + brewGoldPerHr * brewHours,
                skillXp: addXp(state.skillXp, current.xpPerHrBySkill, fightHours),
                visited: state.visited | bitOf(gearIdOf[j]),
                freeZoneSwitch: sameGear && hours <= EPS,
                enteredHour: sameGear ? state.enteredHour : state.hour + hours,
            };
            child.xp = xpScore(child.skillXp);
            child.gateXp = gateXpOf(child.skillXp);
            // Explore the most promising moves first (by riding the new stage out), so good plans
            // are found early and prune everything else.
            const left = targetHours - child.hour;
            child.priority = objective(
                child.gold - child.brewGold + (target.gearValue || 0) + (target.goldPerHr || 0) * left,
                child.xp + relevantXpRate(target) * left
            );
            children.push(child);
        }

        children.sort((a, b) => b.priority - a.priority);
        if (children.length === 0) finishedShare += share;
        for (const child of children) visit(child, share / children.length);
    };

    visit(
        {
            parent: null,
            legs: [],
            index: 0,
            hour: 0,
            gold: startingGold,
            brewGold: 0,
            skillXp: { ...startingSkillXp },
            xp: 0,
            gateXp: gateXpOf(startingSkillXp),
            visited: bitOf(gearIdOf[0]),
            freeZoneSwitch: false,
            enteredHour: -Infinity, // starting gear: free to leave right away
        },
        1
    );

    if (!bestLeaf) return { climb: null, timedOut, nodes };

    // Rebuild the timeline from the winning leaf back to the root, then add the ride-out.
    const chain = [];
    for (let s = bestLeaf; s; s = s.parent) chain.unshift(s);
    const timeline = [];
    let hour = 0;
    const pushLeg = (stage, hours, reason) => {
        if (hours <= EPS) return;
        const last = timeline[timeline.length - 1];
        if (last && last.stage === stage) {
            last.endHour = hour + hours;
            last.reason = reason;
        } else {
            timeline.push({ stage, startHour: hour, endHour: hour + hours, reason });
        }
        hour += hours;
    };
    for (const s of chain) for (const leg of s.legs) pushLeg(leg.stage, leg.hours, leg.reason);

    const last = stages[bestLeaf.index];
    const rideHours = targetHours - bestLeaf.hour;
    pushLeg(last.name, rideHours, 'end of horizon');

    return {
        climb: {
            timeline,
            totalHours: targetHours,
            finalGold: bestLeaf.gold + (last.goldPerHr || 0) * rideHours,
            finalGearValue: last.gearValue || 0,
            brewGold: bestLeaf.brewGold,
            finalSkillXp: addXp(bestLeaf.skillXp, last.xpPerHrBySkill, rideHours),
            reachedStageIndex: bestLeaf.index,
        },
        timedOut,
        nodes,
    };
}

/**
 * Put a plan's up-front brewing into its timeline: the climb's own timeline starts at hour 0 of
 * the climb, which is `preBrewHours` into the plan. Shifts every leg by that much and prepends the
 * brewing leg (merged into the climb's first leg when that's brewing too).
 * @param {Array<{stage: string, startHour: number, endHour: number, reason: string}>} timeline
 * @param {number} preBrewHours
 * @param {string} [preBrewFor] - Name of the set the brewing pays for
 * @returns {Array<{stage: string, startHour: number, endHour: number, reason: string}>}
 */
function withPreBrew(timeline, preBrewHours, preBrewFor) {
    if (!(preBrewHours > 0)) return timeline;
    const shifted = timeline.map((leg) => ({
        ...leg,
        startHour: leg.startHour + preBrewHours,
        endHour: leg.endHour + preBrewHours,
    }));
    const reason = preBrewFor ? `earning money for ${preBrewFor}` : 'earning money';
    if (shifted[0]?.stage === BREWING_STAGE_LABEL) {
        shifted[0] = { ...shifted[0], startHour: 0 };
        return shifted;
    }
    return [{ stage: BREWING_STAGE_LABEL, startHour: 0, endHour: preBrewHours, reason }, ...shifted];
}

/**
 * Find the pre-brew duration (if any) that best serves the chosen gold/XP objective within a
 * fixed hour budget, then climb for the rest. Pre-brewing never advances any combat skill, so it
 * can only ever help reach a stage you're ALREADY level-eligible for (at your starting XP)
 * faster by paying its gold cost up front — it can never skip a level requirement. Candidates are
 * therefore: no pre-brew, and pre-brewing to each starting-eligible stage's cumulative cost (when
 * that leaves any time to fight). Brewing for the entire horizon is never a candidate.
 *
 * @param {Array<ProgressionStage>} stages
 * @param {Object} options
 * @param {number} options.targetHours - Total hours to plan for
 * @param {number} options.brewGoldPerHr - Gold/hr from the alternative skilling activity
 * @param {number} [options.startingGold=0]
 * @param {Object<string, number>} [options.startingSkillXp={}]
 * @param {number} [options.objectiveWeight=1] - 0 = maximize net worth earned by fighting (gold + final gear value, minus brew income), 1 = maximize total combat XP, in between blends both (min-max normalized across the candidates considered)
 * @param {Array<string>} [options.relevantSkillHrids] - Restrict the XP objective to these skills
 *   only (see STYLE_RELEVANT_SKILLS) — e.g. don't let melee XP earned in a bridge phase count
 *   toward a magic progression's score. Omit to count every skill that gained any XP.
 * @param {number} [options.searchTimeMs=Infinity] - Total time budget for the exhaustive plan
 *   search (see searchBestClimb); each candidate's `searchTimedOut` says whether it hit its share
 * @param {Function} [options.onProgress] - Called during the search with `{fraction, start,
 *   starts, nodes, bestNetWorth, bestXp}`: overall progress (0-1), which starting option (1-based)
 *   of how many is being searched, plans checked so far, and the best plan found so far (its net worth not counting brew income)
 * @returns {{ candidates: Array<Object>, recommended: Object|null }}
 */
export function optimizeProgression(
    stages,
    {
        targetHours,
        brewGoldPerHr,
        startingGold = 0,
        startingSkillXp = {},
        objectiveWeight = 1,
        relevantSkillHrids,
        searchTimeMs = Infinity,
        onProgress,
    }
) {
    if (!stages || stages.length === 0) return { candidates: [], recommended: null };

    // `preBrewFor` names the set the up-front brewing banks money for (shown in the timeline).
    const toCandidate = (label, preBrewHours, preBrewFor, climb) => {
        return {
            label,
            preBrewHours,
            totalHours: preBrewHours + climb.totalHours,
            finalGold: climb.finalGold,
            finalGearValue: climb.finalGearValue,
            finalNetWorth: climb.finalGold + climb.finalGearValue,
            // Gold that came from brewing rather than fighting — already in finalGold/finalNetWorth,
            // broken out for display only.
            brewGold: brewGoldPerHr * preBrewHours + climb.brewGold,
            finalSkillXp: climb.finalSkillXp,
            // XP actually gained during the plan, in the skills relevant to the chosen style —
            // never raw cumulative XP (which would include everything the character already had
            // before this plan even started), and never off-target skills that happened to gain
            // XP along the way but don't represent progress toward the intended build style.
            totalXp: sumGainedXp(climb.finalSkillXp, startingSkillXp, relevantSkillHrids),
            timeline: withPreBrew(climb.timeline, preBrewHours, preBrewFor),
            reachedStageIndex: climb.reachedStageIndex,
        };
    };

    // Greedy fallback, only used if the search returns no plan at all (e.g. a zero-hour horizon).
    const makeCandidate = (label, preBrewHours, preBrewFor) => {
        const climb = simulateMultiSkillClimb(stages, {
            targetHours: Math.max(0, targetHours - preBrewHours),
            startingGold: startingGold + brewGoldPerHr * preBrewHours,
            startingSkillXp,
            brewGoldPerHr,
            objectiveWeight,
        });
        return toCandidate(label, preBrewHours, preBrewFor, climb);
    };

    // Fixed (not min-max) score for comparing whole plans against each other during the search.
    const objective = makeObjective(stages, objectiveWeight);
    // Net worth minus brew income: brewing only counts as a way to pay for gear (see below).
    const combatNetWorth = (c) => c.finalNetWorth - c.brewGold;
    const planScore = (c) => objective(combatNetWorth(c), c.totalXp);

    const specs = [{ label: 'Fight now, climb gear tiers as you can afford/qualify for them', preBrewHours: 0 }];

    const preBrewedGears = new Set();
    for (let k = 1; k < stages.length; k++) {
        if (!isStageEligible(stages[k], startingSkillXp)) continue; // pre-brewing can't reach a level gate
        // Zones of the same gear cost the same — one pre-brew candidate per set, not per zone.
        const gearName = stages[k].buildName ?? stages[k].name;
        if (preBrewedGears.has(gearName)) continue;
        preBrewedGears.add(gearName);
        // Direct cost from Current Gear to this stage — bypasses any cheaper stage in between,
        // since pre-brewing to bank money for one specific target shouldn't force buying gear
        // for stages you never intend to wear along the way.
        const directCost = directCostBetween(stages[0], stages[k]);
        const additionalNeeded = Math.max(0, directCost - startingGold);
        if (additionalNeeded <= 0) continue; // already affordable — identical to the H=0 candidate
        if (!(brewGoldPerHr > 0) || additionalNeeded / brewGoldPerHr >= targetHours) continue; // would never fight
        const preBrewHours = additionalNeeded / brewGoldPerHr;
        specs.push({
            label: `Brew first to bank ${gearName}'s gear cost, then climb`,
            preBrewHours,
            preBrewFor: gearName,
        });
    }

    // Each start is planned by the exhaustive search (searchBestClimb). The greedy climb isn't used
    // to seed it: it's slower than the whole search on big stage lists (every decision re-ranks
    // every stage via every stepping stone) and would hold up the first progress report. The time
    // budget is shared: each start gets an equal slice of whatever is left.
    const searchDeadline = Date.now() + searchTimeMs;
    let nodesBefore = 0;
    let best = null; // best-scoring plan across every start so far, for progress reports
    const bestOf = (plan) => {
        if (!best || plan.score > best.score) best = plan;
    };
    const candidates = specs.map(({ label, preBrewHours, preBrewFor }, n) => {
        const report = (fraction, nodes) =>
            onProgress?.({
                fraction: (n + fraction) / specs.length,
                start: n + 1,
                starts: specs.length,
                nodes: nodesBefore + nodes,
                bestNetWorth: best ? best.netWorth : null,
                bestXp: best ? best.xp : null,
            });
        report(0, 0);
        const now = Date.now();
        const { climb, timedOut, nodes } = searchBestClimb(stages, {
            targetHours: Math.max(0, targetHours - preBrewHours),
            startingGold: startingGold + brewGoldPerHr * preBrewHours,
            startingSkillXp,
            brewGoldPerHr,
            objectiveWeight,
            relevantSkillHrids,
            deadline: now + Math.max(0, searchDeadline - now) / (specs.length - n),
            onProgress: onProgress
                ? (p) => {
                      if (p.bestNetWorth !== null) {
                          bestOf({
                              score: objective(p.bestNetWorth, p.bestXp),
                              netWorth: p.bestNetWorth,
                              xp: p.bestXp,
                          });
                      }
                      report(p.fraction, p.nodes);
                  }
                : undefined,
        });
        nodesBefore += nodes;
        const chosen = climb
            ? toCandidate(label, preBrewHours, preBrewFor, climb)
            : makeCandidate(label, preBrewHours, preBrewFor);
        chosen.searchTimedOut = timedOut;
        bestOf({ score: planScore(chosen), netWorth: combatNetWorth(chosen), xp: chosen.totalXp });
        report(1, 0);
        return chosen;
    });

    // No "brew the whole time" candidate: this plans combat progression, and brewing only counts
    // as a way to pay for gear. So the gold side is net worth (gold + resale value of the gear
    // worn at the end — see ProgressionStage.gearValue) MINUS brew income, i.e. what fighting
    // itself earned net of gear bought. Counting brew income would make "brew as long as any
    // purchase can justify" the best plan whenever brewing out-earns fighting.
    const golds = candidates.map(combatNetWorth);
    const xps = candidates.map((c) => c.totalXp);
    const minGold = Math.min(...golds);
    const maxGold = Math.max(...golds);
    const minXp = Math.min(...xps);
    const maxXp = Math.max(...xps);
    const normalize = (value, min, max) => (max > min ? (value - min) / (max - min) : 1);

    let recommended = null;
    for (const candidate of candidates) {
        const normGold = normalize(combatNetWorth(candidate), minGold, maxGold);
        const normXp = normalize(candidate.totalXp, minXp, maxXp);
        candidate.score = (1 - objectiveWeight) * normGold + objectiveWeight * normXp;
        if (!recommended || candidate.score > recommended.score) recommended = candidate;
    }

    return { candidates, recommended };
}

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
 * Simulate climbing through an ordered list of gear stages via combat alone, over a fixed time
 * horizon (rather than until a target is reached — see brew-vs-combat-planner.js's simulateClimb
 * for the target-XP version). At each stage you fight until you can both afford AND qualify
 * (per-skill level requirements) for the next one — whichever takes longer, since gold and every
 * skill's XP accrue simultaneously while fighting. Stops at `targetHours` regardless of where
 * that lands in the stage list.
 *
 * @param {Array<ProgressionStage>} stages - stages[0] should be current gear, cost 0, no requiredLevels
 * @param {Object} options
 * @param {number} options.targetHours - Total hours to simulate
 * @param {number} [options.startingGold=0]
 * @param {Object<string, number>} [options.startingSkillXp={}] - Current cumulative XP per skill
 * @returns {{
 *   timeline: Array<{stage: string, startHour: number, endHour: number, reason: string}>,
 *   totalHours: number,
 *   finalGold: number,
 *   finalSkillXp: Object<string, number>,
 *   reachedStageIndex: number
 * }}
 */
export function simulateMultiSkillClimb(stages, { targetHours, startingGold = 0, startingSkillXp = {} }) {
    let gold = startingGold;
    const skillXp = { ...startingSkillXp };
    let hour = 0;
    let reachedStageIndex = stages.length > 0 ? 0 : -1;
    const timeline = [];

    const addXp = (xpPerHrBySkill, hours) => {
        for (const [skill, rate] of Object.entries(xpPerHrBySkill || {})) {
            skillXp[skill] = (skillXp[skill] || 0) + rate * hours;
        }
    };

    for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        const next = stages[i + 1];
        const hoursLeft = targetHours - hour;
        if (hoursLeft <= 0) break;

        if (!next) {
            timeline.push({ stage: stage.name, startHour: hour, endHour: hour + hoursLeft, reason: 'end of horizon' });
            gold += stage.goldPerHr * hoursLeft;
            addXp(stage.xpPerHrBySkill, hoursLeft);
            hour = targetHours;
            break;
        }

        const neededGold = Math.max(0, next.cost - gold);
        const goldTimeHours = neededGold > 0 ? (stage.goldPerHr > 0 ? neededGold / stage.goldPerHr : Infinity) : 0;

        let xpTimeHours = 0;
        for (const req of next.requiredLevels || []) {
            const neededXp = Math.max(0, getXpForLevel(req.level) - (skillXp[req.skillHrid] || 0));
            if (neededXp <= 0) continue;
            const rate = stage.xpPerHrBySkill?.[req.skillHrid] || 0;
            const t = rate > 0 ? neededXp / rate : Infinity;
            if (t > xpTimeHours) xpTimeHours = t;
        }

        const transitionHours = Math.max(goldTimeHours, xpTimeHours);
        const cappedHours = Math.min(transitionHours, hoursLeft);
        const ranOutOfTime = cappedHours < transitionHours;

        timeline.push({
            stage: stage.name,
            startHour: hour,
            endHour: hour + cappedHours,
            reason: ranOutOfTime ? 'end of horizon' : `unlocked ${next.name}`,
        });
        gold += stage.goldPerHr * cappedHours;
        addXp(stage.xpPerHrBySkill, cappedHours);
        hour += cappedHours;

        if (ranOutOfTime) break;

        gold -= next.cost;
        reachedStageIndex = i + 1;
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

    const cumulativeCosts = [];
    let running = 0;
    for (const stage of stages) {
        running += stage.cost || 0;
        cumulativeCosts.push(running);
    }

    const makeCandidate = (label, preBrewHours) => {
        const remainingHours = Math.max(0, targetHours - preBrewHours);
        const climb = simulateMultiSkillClimb(stages, {
            targetHours: remainingHours,
            startingGold: startingGold + brewGoldPerHr * preBrewHours,
            startingSkillXp,
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
        const additionalNeeded = Math.max(0, cumulativeCosts[k] - startingGold);
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

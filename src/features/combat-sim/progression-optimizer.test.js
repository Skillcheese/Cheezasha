import { describe, expect, it } from 'vitest';

import { getXpForLevel } from './combat-level-xp-table.js';
import {
    isStageEligible,
    optimizeProgression,
    simulateMultiSkillClimb,
    sumGainedXp,
    sumSkillXp,
} from './progression-optimizer.js';

const ATK = '/skills/attack';
const DEF = '/skills/defense';

describe('sumSkillXp', () => {
    it('sums across skills', () => {
        expect(sumSkillXp({ [ATK]: 100, [DEF]: 50 })).toBe(150);
    });
    it('handles empty/undefined', () => {
        expect(sumSkillXp(undefined)).toBe(0);
        expect(sumSkillXp({})).toBe(0);
    });
});

describe('sumGainedXp', () => {
    it('returns final minus starting, not the raw total', () => {
        const starting = { [ATK]: 1_000_000, [DEF]: 500_000 };
        const final = { [ATK]: 1_050_000, [DEF]: 500_000 };
        expect(sumGainedXp(final, starting)).toBe(50_000);
    });

    it('restricts to only the given skills when relevantSkillHrids is provided', () => {
        const starting = { [ATK]: 0, [DEF]: 0, '/skills/melee': 0 };
        const final = { [ATK]: 100, [DEF]: 50, '/skills/melee': 1_000_000 }; // huge off-target gain
        expect(sumGainedXp(final, starting, [ATK, DEF])).toBe(150);
    });

    it('defaults to every skill present in finalSkillXp when no list is given', () => {
        const starting = { [ATK]: 0, [DEF]: 0 };
        const final = { [ATK]: 100, [DEF]: 50 };
        expect(sumGainedXp(final, starting)).toBe(150);
    });

    it('handles missing/undefined inputs without throwing', () => {
        expect(sumGainedXp(undefined, undefined)).toBe(0);
        expect(sumGainedXp({ [ATK]: 100 }, undefined)).toBe(100);
    });
});

describe('isStageEligible', () => {
    it('is eligible with no requirements', () => {
        expect(isStageEligible({ requiredLevels: [] }, {})).toBe(true);
        expect(isStageEligible({}, {})).toBe(true);
    });

    it('checks every required skill against the real level curve', () => {
        const stage = { requiredLevels: [{ skillHrid: ATK, level: 10 }] };
        expect(isStageEligible(stage, { [ATK]: getXpForLevel(10) })).toBe(true);
        expect(isStageEligible(stage, { [ATK]: getXpForLevel(10) - 1 })).toBe(false);
    });

    it('requires ALL listed skills to qualify', () => {
        const stage = {
            requiredLevels: [
                { skillHrid: ATK, level: 10 },
                { skillHrid: DEF, level: 10 },
            ],
        };
        expect(isStageEligible(stage, { [ATK]: getXpForLevel(10), [DEF]: getXpForLevel(5) })).toBe(false);
        expect(isStageEligible(stage, { [ATK]: getXpForLevel(10), [DEF]: getXpForLevel(10) })).toBe(true);
    });
});

describe('simulateMultiSkillClimb', () => {
    it('climbs to the next stage once both gold and every required skill level are met', () => {
        const stages = [
            { name: 'Current Gear', cost: 0, goldPerHr: 100_000, xpPerHrBySkill: { [ATK]: 5_000, [DEF]: 5_000 } },
            {
                name: 'Tier 2',
                cost: 1_000_000,
                goldPerHr: 200_000,
                xpPerHrBySkill: { [ATK]: 10_000, [DEF]: 10_000 },
                requiredLevels: [{ skillHrid: ATK, level: 10 }], // needs 791 xp
            },
        ];

        // Gold time: 1,000,000 / 100,000 = 10h. XP time for ATK level 10 (791 xp) at 5,000/hr: 0.1582h.
        // Gold dominates — transition at 10h.
        const result = simulateMultiSkillClimb(stages, { targetHours: 20 });

        expect(result.reachedStageIndex).toBe(1);
        expect(result.timeline[0].endHour).toBeCloseTo(10);
        expect(result.timeline[0].reason).toBe('unlocked Tier 2');
    });

    it('is gated on the SLOWEST of several required skills, not the fastest', () => {
        const stages = [
            { name: 'Current Gear', cost: 0, goldPerHr: 1_000_000, xpPerHrBySkill: { [ATK]: 50_000, [DEF]: 1_000 } },
            {
                // Total xp/hr (70,000) and gold/hr both beat Current Gear's, so it's worth
                // climbing to at all — this test is about which required skill gates the climb,
                // not whether the climb is worthwhile in the first place.
                name: 'Tier 2',
                cost: 100, // trivial gold cost
                goldPerHr: 2_000_000,
                xpPerHrBySkill: { [ATK]: 60_000, [DEF]: 10_000 },
                requiredLevels: [
                    { skillHrid: ATK, level: 10 }, // 791 xp / 50,000 per hr ≈ 0.0158h
                    { skillHrid: DEF, level: 10 }, // 791 xp / 1,000 per hr = 0.791h — the real bottleneck
                ],
            },
        ];

        const result = simulateMultiSkillClimb(stages, { targetHours: 5 });

        expect(result.timeline[0].endHour).toBeCloseTo(0.791, 2);
    });

    it('stops exactly at the time horizon mid-transition without ever completing it', () => {
        const stages = [
            { name: 'Current Gear', cost: 0, goldPerHr: 100_000, xpPerHrBySkill: { [ATK]: 5_000 } },
            { name: 'Tier 2', cost: 1_000_000, goldPerHr: 200_000, xpPerHrBySkill: { [ATK]: 10_000 } },
        ];

        const result = simulateMultiSkillClimb(stages, { targetHours: 5 }); // needs 10h to afford tier 2

        expect(result.totalHours).toBe(5);
        expect(result.reachedStageIndex).toBe(0);
        expect(result.timeline[0].reason).toBe('end of horizon');
        expect(result.finalGold).toBeCloseTo(500_000);
    });

    it('rides out the final stage in the list to the full horizon', () => {
        const stages = [{ name: 'Endgame', cost: 0, goldPerHr: 1_000_000, xpPerHrBySkill: { [ATK]: 50_000 } }];

        const result = simulateMultiSkillClimb(stages, { targetHours: 10 });

        expect(result.totalHours).toBe(10);
        expect(result.finalGold).toBe(10_000_000);
        expect(result.finalSkillXp[ATK]).toBe(500_000);
    });

    it('carries starting gold and starting skill Xp into the simulation', () => {
        const stages = [
            { name: 'Current Gear', cost: 0, goldPerHr: 100_000, xpPerHrBySkill: { [ATK]: 5_000 } },
            {
                name: 'Tier 2',
                cost: 1_000_000,
                goldPerHr: 200_000,
                xpPerHrBySkill: { [ATK]: 10_000 },
                requiredLevels: [{ skillHrid: ATK, level: 10 }],
            },
        ];

        const result = simulateMultiSkillClimb(stages, {
            targetHours: 5,
            startingGold: 1_000_000, // already enough
            startingSkillXp: { [ATK]: getXpForLevel(10) }, // already qualified
        });

        // Switches to Tier 2 instantly and rides it out for the whole horizon — a single
        // continuous leg, not a separate zero-length "switched" entry followed by a ride-out one.
        expect(result.timeline).toHaveLength(1);
        expect(result.timeline[0].stage).toBe('Tier 2');
        expect(result.timeline[0].startHour).toBe(0);
        expect(result.timeline[0].endHour).toBe(5);
        expect(result.reachedStageIndex).toBe(1);
    });

    it('discovers a faster multi-hop route through a cheap intermediate stage when it reaches the ultimate target sooner', () => {
        const MAGIC = '/skills/magic';
        const stages = [
            {
                name: 'Current Gear',
                cost: 0,
                goldPerHr: 10_000,
                xpPerHrBySkill: { [MAGIC]: 25_000 },
            },
            {
                // Much weaker than Best on its own, but cheap and reachable early — banking gold
                // at its higher rate reaches Best's direct cost sooner than grinding it out at
                // Current Gear's rate the whole way, even counting the cost to stop here first.
                name: 'MidTier',
                cost: 5_000_000,
                goldPerHr: 80_000,
                xpPerHrBySkill: { [MAGIC]: 65_000 },
                directCosts: { 'Current Gear': 5_000_000, Best: 12_000_000 },
            },
            {
                name: 'Best',
                cost: 500_000_000, // sequential cost through MidTier — should NOT be used
                goldPerHr: 1_900_000,
                xpPerHrBySkill: { [MAGIC]: 250_000 },
                directCosts: { 'Current Gear': 8_000_000, MidTier: 12_000_000 },
            },
        ];
        // Patch Current Gear's directCosts (needs the other two stage names available).
        stages[0].directCosts = { MidTier: 5_000_000, Best: 8_000_000 };

        // Direct: 8,000,000 / 10,000/hr = 800h to reach Best.
        // Via MidTier: 5,000,000 / 10,000/hr = 500h to reach MidTier, then 12,000,000 / 80,000/hr
        // = 150h more to reach Best from there — 650h total, 150h sooner than going direct, which
        // more than makes up for however weak MidTier's own rates are along the way.
        const result = simulateMultiSkillClimb(stages, { targetHours: 2000, objectiveWeight: 1 });

        expect(result.reachedStageIndex).toBe(2); // still ends up at Best
        expect(result.timeline.some((leg) => leg.stage === 'MidTier')).toBe(true); // stops there first now
        // Reaches Best 150h sooner than the direct route, so more time is spent at Best's high rate.
        expect(result.finalGold).toBeCloseTo(1_900_000 * (2000 - 650), 0);
    });

    it('hops to a strictly better already-affordable/eligible stage instead of grinding a far-off target in weaker gear', () => {
        const MAGIC = '/skills/magic';
        const stages = [
            { name: 'Weaker', cost: 0, goldPerHr: 135_400, xpPerHrBySkill: { [MAGIC]: 23_255 } },
            {
                // Cheap and already eligible/affordable — dominates Weaker on both gold and xp.
                name: 'Better',
                cost: 3_000_000,
                goldPerHr: 135_700,
                xpPerHrBySkill: { [MAGIC]: 25_511 },
                directCosts: { Weaker: 3_000_000, BigTarget: 8_500_000_000 },
            },
            {
                // Far bigger payoff, but gated behind a level requirement that takes a while to clear.
                name: 'BigTarget',
                cost: 8_500_000_000,
                goldPerHr: 1_600_000,
                xpPerHrBySkill: { [MAGIC]: 241_314 },
                requiredLevels: [{ skillHrid: MAGIC, level: 125 }],
                directCosts: { Weaker: 8_500_000_000, Better: 8_500_000_000 },
            },
        ];
        stages[0].directCosts = { Better: 3_000_000, BigTarget: 8_500_000_000 };

        const result = simulateMultiSkillClimb(stages, {
            targetHours: 2000,
            startingGold: 183_200_000,
            objectiveWeight: 0.5,
        });

        // Better was affordable and eligible from hour 0 — the climb should hop to it immediately
        // instead of grinding the whole way to BigTarget's level gate in Weaker. The zero-length
        // "switched" entry merges straight into the fight that follows, since it's the same gear.
        expect(result.timeline[0].stage).toBe('Better');
        expect(result.timeline[0].startHour).toBe(0);
        expect(result.timeline.some((leg) => leg.stage === 'Weaker' && leg.endHour > leg.startHour)).toBe(false);
    });

    it('never buys gear it will only brew in, and merges consecutive brew legs into one', () => {
        const MAGIC = '/skills/magic';
        const stages = [
            { name: 'Weaker', cost: 0, goldPerHr: 135_400, xpPerHrBySkill: { [MAGIC]: 23_255 } },
            {
                // Fought in briefly to clear BigTarget's level gate, then never touched again.
                name: 'Better',
                cost: 3_000_000,
                goldPerHr: 135_700,
                xpPerHrBySkill: { [MAGIC]: 25_511 },
                directCosts: { Weaker: 3_000_000, BigTarget: 8_500_000_000 },
            },
            {
                name: 'BigTarget',
                cost: 8_500_000_000,
                goldPerHr: 1_600_000,
                xpPerHrBySkill: { [MAGIC]: 241_314 },
                requiredLevels: [{ skillHrid: MAGIC, level: 125 }],
                directCosts: { Weaker: 8_500_000_000, Better: 8_500_000_000 },
            },
        ];
        stages[0].directCosts = { Better: 3_000_000, BigTarget: 8_500_000_000 };

        // Reaches BigTarget's level gate while fighting in Better, then spends a very long time
        // just brewing for the rest of BigTarget's 8.5B gold cost — during which "Weaker" being
        // cheaper than "Better" should never look like a reason to switch back, since neither is
        // actually being fought in anymore (this is the exact "FireSoon"/"FireSoon2" thrash
        // reported against a live sim, reproduced with synthetic rates).
        const result = simulateMultiSkillClimb(stages, {
            targetHours: 10_000,
            startingGold: 183_200_000,
            brewGoldPerHr: 2_300_000,
            objectiveWeight: 0.5,
        });

        // No leg should ever show buying/wearing "Weaker" once "Better" has been reached — the
        // old bug bounced back to a worse, cheaper stage mid-brew for zero actual combat benefit.
        const betterReachedAt = result.timeline.find((leg) => leg.stage === 'Better')?.startHour ?? 0;
        expect(result.timeline.some((leg) => leg.stage === 'Weaker' && leg.startHour >= betterReachedAt)).toBe(false);

        // Every brewing leg shares one generic label and merges into a single continuous entry —
        // no fragmenting into a dozen near-zero-length "Earning money" entries in a row.
        const brewLegs = result.timeline.filter((leg) => leg.stage === 'Earning money (not fighting)');
        expect(brewLegs.length).toBeLessThanOrEqual(1);
    });

    it('treats a required level as already cleared when only floating-point dust remains, without inserting a near-zero fight leg', () => {
        const stages = [
            { name: 'Weaker', cost: 0, goldPerHr: 10_000, xpPerHrBySkill: { [ATK]: 5_000 } },
            {
                name: 'Target',
                cost: 999_000_000,
                goldPerHr: 1_000,
                xpPerHrBySkill: { [ATK]: 5_100 },
                requiredLevels: [{ skillHrid: ATK, level: 50 }],
            },
        ];

        const result = simulateMultiSkillClimb(stages, {
            targetHours: 1000,
            startingGold: 0,
            startingSkillXp: { [ATK]: getXpForLevel(50) - 1e-9 }, // effectively already met
            brewGoldPerHr: 2_000_000,
            objectiveWeight: 1,
        });

        // Should go straight to brewing rather than inserting a near-zero "xp gate cleared" fight
        // leg first just because of floating-point dust in the requirement check.
        expect(result.timeline.filter((leg) => leg.reason === 'xp gate cleared')).toHaveLength(0);
    });

    it('prefers staying put when a switch-to-brew detour sacrifices far more xp than the upgrade earns back', () => {
        const stages = [
            // Already trains xp very well — the thing worth protecting.
            { name: 'Current Gear', cost: 0, goldPerHr: 10_000, xpPerHrBySkill: { [ATK]: 100_000 } },
            {
                // Only a marginal xp/hr improvement, but so expensive that (with no level gate to
                // force any fighting first) the switch-to-brew logic would spend almost the WHOLE
                // horizon brewing — earning zero combat xp — for one hour at a barely-better rate.
                name: 'TooExpensive',
                cost: 999_000_000,
                goldPerHr: 1_000,
                xpPerHrBySkill: { [ATK]: 105_000 },
            },
        ];

        const result = simulateMultiSkillClimb(stages, {
            targetHours: 1000,
            brewGoldPerHr: 1_000_000,
            objectiveWeight: 1,
        });

        expect(result.reachedStageIndex).toBe(0);
        expect(result.finalSkillXp[ATK]).toBeCloseTo(100_000_000, -3); // rode out Current Gear the whole time
    });
});

describe('optimizeProgression', () => {
    const stages = [
        { name: 'Current Gear', cost: 0, goldPerHr: 100_000, xpPerHrBySkill: { [ATK]: 8_000 } },
        {
            // No level requirement — isolates the "gold, not level, is the bottleneck" case.
            // (A level-1 requirement is satisfied by 0 starting XP too, but omitting it entirely
            // is clearer about what's being tested here.)
            name: 'Endgame',
            cost: 500_000_000,
            goldPerHr: 1_800_000,
            xpPerHrBySkill: { [ATK]: 40_000 },
        },
    ];

    it('maximizes total XP by switching to brewing mid-climb once fighting stops paying off', () => {
        const result = optimizeProgression(stages, {
            targetHours: 300,
            brewGoldPerHr: 2_300_000,
            objectiveWeight: 1,
        });

        // Endgame has no level gate, so simulateMultiSkillClimb itself now switches from fighting
        // Current Gear to brewing as soon as that beats grinding at Current Gear's own gold/hr —
        // making the "Fight now" candidate reach Endgame just as fast as an explicit pre-brew plan.
        const pureClimb = result.candidates.find((c) => c.label.includes('Fight now'));
        expect(pureClimb.reachedStageIndex).toBe(1);
        expect(result.recommended.totalXp).toBe(pureClimb.totalXp);
    });

    it('recommends brewing the whole time when weight is pure gold and combat never out-earns brewing', () => {
        const result = optimizeProgression(stages, {
            targetHours: 300,
            brewGoldPerHr: 2_300_000, // beats Endgame's 1,800,000 gold/hr too
            objectiveWeight: 0,
        });

        expect(result.recommended.label).toMatch(/never fight/);
    });

    it('does not offer pre-brewing toward a stage that is not yet level-eligible at the start', () => {
        const gatedStages = [
            { name: 'Current Gear', cost: 0, goldPerHr: 100_000, xpPerHrBySkill: { [ATK]: 8_000 } },
            {
                name: 'Endgame',
                cost: 500_000_000,
                goldPerHr: 1_800_000,
                xpPerHrBySkill: { [ATK]: 40_000 },
                requiredLevels: [{ skillHrid: ATK, level: 150 }], // far above starting level
            },
        ];

        const result = optimizeProgression(gatedStages, {
            targetHours: 300,
            brewGoldPerHr: 2_300_000,
            objectiveWeight: 1,
        });

        expect(result.candidates.some((c) => c.label.includes('bank'))).toBe(false);
    });

    it('skips a pre-brew candidate when starting gold already covers that stage', () => {
        const result = optimizeProgression(stages, {
            targetHours: 300,
            brewGoldPerHr: 2_300_000,
            startingGold: 1_000_000_000,
            objectiveWeight: 1,
        });

        // No "bank X's cost" candidate should appear since starting gold already covers everything.
        expect(result.candidates.some((c) => c.label.includes('bank'))).toBe(false);
    });

    it('a blended weight lands between the pure-gold and pure-xp recommendations', () => {
        const pureXp = optimizeProgression(stages, { targetHours: 300, brewGoldPerHr: 2_300_000, objectiveWeight: 1 });
        const pureGold = optimizeProgression(stages, {
            targetHours: 300,
            brewGoldPerHr: 2_300_000,
            objectiveWeight: 0,
        });
        const blended = optimizeProgression(stages, {
            targetHours: 300,
            brewGoldPerHr: 2_300_000,
            objectiveWeight: 0.5,
        });

        expect(blended.recommended.totalXp).toBeLessThanOrEqual(pureXp.recommended.totalXp);
        expect(blended.recommended.finalGold).toBeLessThanOrEqual(pureGold.recommended.finalGold);
    });

    it('returns no candidates for an empty stage list', () => {
        const result = optimizeProgression([], { targetHours: 100, brewGoldPerHr: 1_000_000 });
        expect(result.candidates).toEqual([]);
        expect(result.recommended).toBeNull();
    });

    it("reports totalXp as XP gained during the plan, not the character's pre-existing total", () => {
        // Current gear alone, at a fixed horizon, riding out the whole time (no other stages).
        const soloStage = [{ name: 'Current Gear', cost: 0, goldPerHr: 100_000, xpPerHrBySkill: { [ATK]: 10_000 } }];
        const startingSkillXp = { [ATK]: 1_000_000 }; // character already has a lot of ATK xp banked

        const result = optimizeProgression(soloStage, {
            targetHours: 10,
            brewGoldPerHr: 0,
            startingSkillXp,
            objectiveWeight: 1,
        });

        // 10h * 10,000/hr = 100,000 gained — NOT 1,000,000 (starting) + 100,000.
        expect(result.recommended.totalXp).toBe(100_000);
    });

    it('does not let off-target skill XP (e.g. melee, while planning magic) count toward the objective', () => {
        const MAGIC = '/skills/magic';
        const MELEE = '/skills/melee';
        // Current gear (melee weapon) trains melee; reaching the saved magic build takes real
        // gold current gear alone can't quickly afford, so the climb genuinely lingers on
        // current gear for the whole (short) horizon here — mirroring the reported case where
        // current gear "gives more xp/hr, but in the wrong stat."
        const mixedStages = [
            { name: 'Current Gear', cost: 0, goldPerHr: 50_000, xpPerHrBySkill: { [MELEE]: 100_000 } },
            { name: 'Magic Build', cost: 1_000_000, goldPerHr: 50_000, xpPerHrBySkill: { [MAGIC]: 30_000 } },
        ];
        // 1,000,000 / 50,000 = 20h to afford Magic Build — never reached within a 10h horizon.

        const unfiltered = optimizeProgression(mixedStages, { targetHours: 10, brewGoldPerHr: 0, objectiveWeight: 1 });
        const climbCandidateUnfiltered = unfiltered.candidates.find((c) => c.label.includes('Fight now'));
        // Without a relevance filter, the melee XP earned while stuck on current gear counts in full.
        expect(climbCandidateUnfiltered.totalXp).toBe(1_000_000); // 100,000/hr * 10h

        const filtered = optimizeProgression(mixedStages, {
            targetHours: 10,
            brewGoldPerHr: 0,
            objectiveWeight: 1,
            relevantSkillHrids: [MAGIC, '/skills/intelligence', '/skills/defense', '/skills/stamina'],
        });
        const climbCandidateFiltered = filtered.candidates.find((c) => c.label.includes('Fight now'));
        // With the magic-relevant filter, that same melee XP contributes nothing — correctly
        // reflecting that no real magic progress was made, even though gross XP looks large.
        expect(climbCandidateFiltered.totalXp).toBe(0);
    });
});

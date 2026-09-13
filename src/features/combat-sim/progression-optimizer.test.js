import { describe, expect, it } from 'vitest';

import { getXpForLevel } from './combat-level-xp-table.js';
import { isStageEligible, optimizeProgression, simulateMultiSkillClimb, sumSkillXp } from './progression-optimizer.js';

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
                name: 'Tier 2',
                cost: 100, // trivial gold cost
                goldPerHr: 200_000,
                xpPerHrBySkill: { [ATK]: 10_000, [DEF]: 10_000 },
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

        expect(result.timeline[0].endHour).toBe(0); // instant transition
        expect(result.reachedStageIndex).toBe(1);
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

    it('maximizes total XP by pre-brewing to skip the slow gold grind, when weight favors XP', () => {
        const result = optimizeProgression(stages, {
            targetHours: 300,
            brewGoldPerHr: 2_300_000,
            objectiveWeight: 1,
        });

        expect(result.recommended.label).toMatch(/Brew first/);
        // Sanity: recommended candidate should out-XP the pure-climb candidate.
        const pureClimb = result.candidates.find((c) => c.label.includes('Fight now'));
        expect(result.recommended.totalXp).toBeGreaterThan(pureClimb.totalXp);
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
});

import { describe, expect, it } from 'vitest';

import { effectiveCostPerXp, planBrewVsCombat, planProgression, simulateClimb } from './brew-vs-combat-planner.js';

describe('effectiveCostPerXp', () => {
    it('is positive when combat earns less than brewing', () => {
        const result = effectiveCostPerXp(2_300_000, { goldPerHr: 285_000, xpPerHr: 10_000 });
        expect(result).toBeCloseTo((2_300_000 - 285_000) / 10_000);
    });

    it('is negative when combat already out-earns brewing', () => {
        const result = effectiveCostPerXp(2_300_000, { goldPerHr: 3_000_000, xpPerHr: 10_000 });
        expect(result).toBeLessThan(0);
    });

    it('returns null when xpPerHr is zero', () => {
        expect(effectiveCostPerXp(1000, { goldPerHr: 500, xpPerHr: 0 })).toBeNull();
    });
});

describe('planBrewVsCombat', () => {
    it('recommends brewing first when the gear payoff is large and current combat XP/hr is low', () => {
        // Matches the user's real numbers: 2.3M/hr brewing vs 285k/hr combat now.
        const result = planBrewVsCombat({
            brewGoldPerHr: 2_300_000,
            currentCombat: { goldPerHr: 285_000, xpPerHr: 8_000 },
            targetCombat: { goldPerHr: 1_800_000, xpPerHr: 40_000 },
            gearCost: 500_000_000,
            targetXp: 20_000_000,
        });

        expect(result.strategies.length).toBe(3);
        expect(result.recommended).not.toBeNull();
        expect(result.diagnostics.opportunityCostPerHrNow).toBe(2_300_000 - 285_000);
        expect(result.diagnostics.combatAlreadyBeatsBrewing).toBe(false);

        // Brewing first should win here: buying the gear (500M / 2.3M/hr ≈ 217h) then
        // fighting at 40k xp/hr is much faster than grinding 20M xp at 8k/hr (2500h).
        expect(result.recommended.key).toBe('brewThenCombat');
    });

    it('recommends fighting now (no upgrade) when the target gear barely helps', () => {
        const result = planBrewVsCombat({
            brewGoldPerHr: 2_300_000,
            currentCombat: { goldPerHr: 285_000, xpPerHr: 50_000 },
            targetCombat: { goldPerHr: 300_000, xpPerHr: 52_000 },
            gearCost: 2_000_000_000, // huge cost for a tiny xp/hr gain
            targetXp: 1_000_000,
        });

        expect(result.recommended.key).toBe('combatNowNoUpgrade');
    });

    it('flags when combat already out-earns brewing at the target gear', () => {
        const result = planBrewVsCombat({
            brewGoldPerHr: 1_000_000,
            currentCombat: { goldPerHr: 500_000, xpPerHr: 10_000 },
            targetCombat: { goldPerHr: 1_500_000, xpPerHr: 30_000 },
            gearCost: 100_000_000,
            targetXp: 5_000_000,
        });

        expect(result.diagnostics.combatAlreadyBeatsBrewing).toBe(true);
        expect(result.diagnostics.costPerXpAfterGearing).toBeLessThan(0);
    });

    it('hybrid strategy finishes without ever buying gear when the XP goal is reached first', () => {
        const result = planBrewVsCombat({
            brewGoldPerHr: 2_300_000,
            currentCombat: { goldPerHr: 500_000, xpPerHr: 100_000 },
            targetCombat: { goldPerHr: 1_800_000, xpPerHr: 150_000 },
            gearCost: 1_000_000_000, // would take 2000h of combat income to afford
            targetXp: 1_000, // trivially small goal, reached in a fraction of an hour
        });

        const hybrid = result.strategies.find((s) => s.key === 'hybrid');
        expect(hybrid).toBeDefined();
        expect(hybrid.gearBoughtMidway).toBe(false);
        expect(hybrid.phases.length).toBe(1);
    });

    it('omits the hybrid strategy when current combat earns no gold', () => {
        const result = planBrewVsCombat({
            brewGoldPerHr: 2_300_000,
            currentCombat: { goldPerHr: 0, xpPerHr: 10_000 },
            targetCombat: { goldPerHr: 1_800_000, xpPerHr: 40_000 },
            gearCost: 500_000_000,
            targetXp: 20_000_000,
        });

        expect(result.strategies.find((s) => s.key === 'hybrid')).toBeUndefined();
    });

    it('handles zero gear cost by skipping the brew phase entirely', () => {
        const result = planBrewVsCombat({
            brewGoldPerHr: 2_300_000,
            currentCombat: { goldPerHr: 285_000, xpPerHr: 8_000 },
            targetCombat: { goldPerHr: 1_800_000, xpPerHr: 40_000 },
            gearCost: 0,
            targetXp: 20_000_000,
        });

        const brewThenCombat = result.strategies.find((s) => s.key === 'brewThenCombat');
        expect(brewThenCombat.phases[0].hours).toBe(0);
        expect(brewThenCombat.totalHours).toBeCloseTo(20_000_000 / 40_000);
    });
});

describe('simulateClimb', () => {
    it('climbs through stages once both gold and XP requirements are met', () => {
        const stages = [
            { name: 'Current Gear', cost: 0, goldPerHr: 100_000, xpPerHr: 10_000 },
            { name: 'Tier 2', cost: 1_000_000, goldPerHr: 200_000, xpPerHr: 20_000, requiredXp: 5_000 },
        ];

        // Gold time for tier 2: 1,000,000 / 100,000 = 10h. XP time for requiredXp 5,000: 5,000/10,000 = 0.5h.
        // Gold is the bottleneck, so the transition happens at 10h. Target XP is set past that
        // point (10h * 10,000/hr = 100,000, plus 5h more at tier 2's 20,000/hr) so the climb
        // actually reaches tier 2 before finishing.
        const result = simulateClimb(stages, { targetXp: 100_000 + 20_000 * 5 });

        expect(result.feasible).toBe(true);
        expect(result.timeline[0].reason).toBe('unlocked Tier 2');
        expect(result.timeline[0].endHour).toBeCloseTo(10);
        expect(result.reachedStageIndex).toBe(1);
    });

    it('is gated by required XP even with unlimited gold banked ahead of time', () => {
        const stages = [
            { name: 'Current Gear', cost: 0, goldPerHr: 100_000, xpPerHr: 10_000 },
            { name: 'Endgame', cost: 1_000_000, goldPerHr: 500_000, xpPerHr: 50_000, requiredXp: 100_000 },
        ];

        // Bank far more gold than needed up front — the level requirement (100,000 xp at
        // 10,000 xp/hr = 10h) must still be earned by fighting; money alone can't skip it.
        const result = simulateClimb(stages, { targetXp: 150_000, startingGold: 1_000_000_000 });

        expect(result.timeline[0].endHour).toBeCloseTo(10);
        expect(result.timeline[0].reason).toBe('unlocked Endgame');
    });

    it('reaches the target XP before ever unlocking the next stage', () => {
        const stages = [
            { name: 'Current Gear', cost: 0, goldPerHr: 100_000, xpPerHr: 10_000 },
            { name: 'Tier 2', cost: 100_000_000, goldPerHr: 500_000, xpPerHr: 50_000 },
        ];

        const result = simulateClimb(stages, { targetXp: 1_000 });

        expect(result.reachedStageIndex).toBe(0);
        expect(result.timeline).toHaveLength(1);
        expect(result.timeline[0].reason).toBe('reached target XP');
        expect(result.totalHours).toBeCloseTo(0.1);
    });

    it('gets permanently stuck at a zero-gold-income stage, but still reaches the XP goal by grinding there', () => {
        // A stage that earns no gold can never afford the next tier — it just never upgrades.
        // It doesn't block reaching the XP goal itself, since XP alone doesn't cost money.
        const stages = [
            { name: 'Current Gear', cost: 0, goldPerHr: 0, xpPerHr: 10_000 },
            { name: 'Tier 2', cost: 1_000_000, goldPerHr: 500_000, xpPerHr: 50_000 },
        ];

        const result = simulateClimb(stages, { targetXp: 1_000_000 });

        expect(result.feasible).toBe(true);
        expect(result.reachedStageIndex).toBe(0);
        expect(result.timeline[0].reason).toBe('reached target XP');
        expect(result.totalHours).toBeCloseTo(100);
    });

    it('is infeasible when a stage earns no combat XP at all', () => {
        const stages = [{ name: 'Current Gear', cost: 0, goldPerHr: 100_000, xpPerHr: 0 }];

        const result = simulateClimb(stages, { targetXp: 1_000 });

        expect(result.feasible).toBe(false);
        expect(result.blockedReason).toMatch(/no combat XP/);
    });
});

describe('planProgression', () => {
    const stages = [
        { name: 'Current Gear', cost: 0, goldPerHr: 100_000, xpPerHr: 10_000 },
        { name: 'Tier 2', cost: 2_000_000, goldPerHr: 300_000, xpPerHr: 30_000, requiredXp: 2_000 },
    ];

    it('recommends pre-brewing when gold, not XP, is the bottleneck', () => {
        // Gold time at tier 1 rates: 2,000,000/100,000 = 20h. XP time for requiredXp 2,000: 0.2h.
        // Gold dominates, so banking the 2,000,000 via a much faster brewing loop should win.
        const result = planProgression(stages, { brewGoldPerHr: 2_000_000, targetXp: 32_000 });

        expect(result.recommended).not.toBeNull();
        expect(result.recommended.label).toMatch(/Brew first/);
    });

    it('recommends pure climbing when XP, not gold, is the bottleneck', () => {
        const gatedStages = [
            { name: 'Current Gear', cost: 0, goldPerHr: 100_000, xpPerHr: 10_000 },
            { name: 'Tier 2', cost: 100_000, goldPerHr: 300_000, xpPerHr: 30_000, requiredXp: 500_000 },
        ];
        // Gold time: 100,000/100,000 = 1h. XP time: 500,000/10,000 = 50h. XP dominates —
        // pre-brewing the trivial gold cost buys nothing since you still wait on the level.
        const result = planProgression(gatedStages, { brewGoldPerHr: 2_000_000, targetXp: 530_000 });

        expect(result.recommended.label).toMatch(/Fight now/);
    });

    it('needs no pre-brewing when starting gold already covers the stage', () => {
        const result = planProgression(stages, {
            brewGoldPerHr: 2_000_000,
            targetXp: 32_000,
            startingGold: 5_000_000,
        });

        const brewCandidate = result.candidates.find((c) => c.label.includes('Brew first'));
        expect(brewCandidate.preBrewHours).toBe(0);
    });

    it('returns no candidates for an empty stage list', () => {
        const result = planProgression([], { brewGoldPerHr: 1_000_000, targetXp: 1_000 });
        expect(result.candidates).toEqual([]);
        expect(result.recommended).toBeNull();
    });
});

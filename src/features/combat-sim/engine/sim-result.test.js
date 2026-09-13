import { beforeEach, describe, expect, it } from 'vitest';

import { setGameData } from './game-data.js';
import SimResult from './sim-result.js';

function makeUnit({ primaryTraining, focusTraining = '', combatStyleHrid = '/combat_styles/burn' }) {
    return {
        isPlayer: true,
        hrid: 'player1',
        debuffOnLevelGap: 0,
        combatDetails: {
            combatStats: {
                primaryTraining,
                focusTraining,
                combatStyleHrid,
                combatExperience: 0,
                staminaExperience: 0,
                intelligenceExperience: 0,
                attackExperience: 0,
                meleeExperience: 0,
                defenseExperience: 0,
                rangedExperience: 0,
                magicExperience: 0,
            },
        },
    };
}

describe('SimResult.addExperienceGain', () => {
    beforeEach(() => {
        // A magic combat style whose OWN secondary pool never lists magic itself (it's already
        // covered by the fixed 30% primaryTraining share) — mirrors the real game data shape that
        // exposed this bug.
        setGameData({
            combatStyleDetailMap: {
                '/combat_styles/burn': {
                    skillExpMap: {
                        '/skills/attack': 1,
                        '/skills/intelligence': 1,
                        '/skills/defense': 1,
                        '/skills/stamina': 1,
                    },
                },
            },
        });
    });

    it("sends the full 70% focus share to a main-stat charm target, even when that skill is not in the style's own secondary pool", () => {
        const unit = makeUnit({ primaryTraining: '/skills/magic', focusTraining: '/skills/magic' });
        const result = new SimResult({ hrid: '/zone/a', difficultyTier: 0 }, 1);

        result.addExperienceGain(unit, 1000);

        // 30% (primary) + 70% (focus, redirected onto the same skill) = 100% to magic.
        expect(result.experienceGained.player1.magic).toBe(1000);
        expect(result.experienceGained.player1.attack).toBe(0);
        expect(result.experienceGained.player1.intelligence).toBe(0);
        expect(result.experienceGained.player1.defense).toBe(0);
        expect(result.experienceGained.player1.stamina).toBe(0);
    });

    it("splits the 70% evenly across the style's secondary skills when no charm is worn", () => {
        const unit = makeUnit({ primaryTraining: '/skills/magic', focusTraining: '' });
        const result = new SimResult({ hrid: '/zone/a', difficultyTier: 0 }, 1);

        result.addExperienceGain(unit, 1000);

        expect(result.experienceGained.player1.magic).toBe(300); // 30% primary only
        expect(result.experienceGained.player1.attack).toBeCloseTo(175); // 70% / 4
        expect(result.experienceGained.player1.intelligence).toBeCloseTo(175);
        expect(result.experienceGained.player1.defense).toBeCloseTo(175);
        expect(result.experienceGained.player1.stamina).toBeCloseTo(175);
    });

    it("redirects the focus share onto a support skill that IS one of the style's own secondary skills too", () => {
        const unit = makeUnit({ primaryTraining: '/skills/magic', focusTraining: '/skills/defense' });
        const result = new SimResult({ hrid: '/zone/a', difficultyTier: 0 }, 1);

        result.addExperienceGain(unit, 1000);

        expect(result.experienceGained.player1.magic).toBe(300);
        expect(result.experienceGained.player1.defense).toBe(700);
        expect(result.experienceGained.player1.attack).toBe(0);
        expect(result.experienceGained.player1.intelligence).toBe(0);
        expect(result.experienceGained.player1.stamina).toBe(0);
    });

    it('does not apply a charm whose target skill is unrelated to the weapon being used', () => {
        // A magic charm worn with a MELEE weapon — magic isn't the primary skill, and (per the
        // beforeEach setup) melee's own style doesn't list magic as a secondary skill either.
        const unit = makeUnit({
            primaryTraining: '/skills/melee',
            focusTraining: '/skills/magic',
            combatStyleHrid: '/combat_styles/burn', // reuses the fixture's non-magic-inclusive pool
        });
        const result = new SimResult({ hrid: '/zone/a', difficultyTier: 0 }, 1);

        result.addExperienceGain(unit, 1000);

        // No magic XP at all — the mismatched charm has no effect, same as wearing none.
        expect(result.experienceGained.player1.magic).toBe(0);
        expect(result.experienceGained.player1.melee).toBe(300); // 30% primary
        expect(result.experienceGained.player1.attack).toBeCloseTo(175); // even 70% split, charm ignored
    });

    it('ignores non-player units', () => {
        const result = new SimResult({ hrid: '/zone/a', difficultyTier: 0 }, 1);
        result.addExperienceGain({ isPlayer: false }, 1000);
        expect(result.experienceGained).toEqual({});
    });
});

import { describe, expect, it } from 'vitest';

import { getLevelForXp, getXpForLevel, LEVEL_XP_TABLE, MAX_LEVEL } from './combat-level-xp-table.js';

describe('LEVEL_XP_TABLE', () => {
    it('has 201 entries (index 0 unused, levels 1-200)', () => {
        expect(LEVEL_XP_TABLE.length).toBe(201);
        expect(MAX_LEVEL).toBe(200);
    });

    it('matches known checkpoints from the game', () => {
        expect(LEVEL_XP_TABLE[1]).toBe(0);
        expect(LEVEL_XP_TABLE[10]).toBe(791);
        expect(LEVEL_XP_TABLE[100]).toBe(10_000_000);
        expect(LEVEL_XP_TABLE[125]).toBe(100_000_000);
        expect(LEVEL_XP_TABLE[200]).toBe(100_000_000_000);
    });

    it('is strictly increasing from level 1 to 200', () => {
        for (let i = 2; i <= MAX_LEVEL; i++) {
            expect(LEVEL_XP_TABLE[i]).toBeGreaterThan(LEVEL_XP_TABLE[i - 1]);
        }
    });
});

describe('getXpForLevel', () => {
    it('returns 0 for level 1 or below', () => {
        expect(getXpForLevel(1)).toBe(0);
        expect(getXpForLevel(0)).toBe(0);
    });

    it('returns the table value for a known level', () => {
        expect(getXpForLevel(50)).toBe(93_311);
    });

    it('clamps above the max level', () => {
        expect(getXpForLevel(500)).toBe(100_000_000_000);
    });
});

describe('getLevelForXp', () => {
    it('returns level 1 for 0 or negative xp', () => {
        expect(getLevelForXp(0)).toBe(1);
        expect(getLevelForXp(-100)).toBe(1);
    });

    it('returns the exact level at an exact threshold', () => {
        expect(getLevelForXp(791)).toBe(10);
    });

    it('returns the level just below the next threshold', () => {
        expect(getLevelForXp(790)).toBe(9);
        expect(getLevelForXp(963)).toBe(10);
    });

    it('clamps at the max level for huge XP totals', () => {
        expect(getLevelForXp(1e15)).toBe(200);
    });

    it('round-trips with getXpForLevel at every level', () => {
        for (let level = 1; level <= MAX_LEVEL; level++) {
            const xp = getXpForLevel(level);
            expect(getLevelForXp(xp)).toBe(level);
        }
    });
});

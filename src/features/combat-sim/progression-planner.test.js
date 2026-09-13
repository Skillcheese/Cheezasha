import { describe, expect, it, vi } from 'vitest';

const prices = new Map([
    ['/items/starter_sword::0', 100],
    ['/items/mid_sword::0', 10_000],
    ['/items/end_sword::10', 500_000],
    ['/items/end_shield::10', 300_000],
]);

vi.mock('../../utils/profit-helpers.js', () => ({
    resolveItemPrice: vi.fn((itemHrid, { enhancementLevel = 0 } = {}) => {
        const key = `${itemHrid}::${enhancementLevel}`;
        return prices.has(key)
            ? { price: prices.get(key), custom: false, missing: false }
            : { price: 0, custom: false, missing: true };
    }),
}));

const { buildStagesFromResults } = await import('./progression-planner.js');

describe('buildStagesFromResults', () => {
    it('always puts current gear first regardless of price, with zero cost', () => {
        const currentStage = {
            equipment: { '/equipment_types/main_hand': { hrid: '/items/mid_sword', enhancementLevel: 0 } },
            goldPerHr: 285_000,
            xpPerHr: 8_000,
        };
        const builds = [
            {
                name: 'Endgame',
                equipment: {
                    '/equipment_types/main_hand': { hrid: '/items/end_sword', enhancementLevel: 10 },
                    '/equipment_types/off_hand': { hrid: '/items/end_shield', enhancementLevel: 10 },
                },
                goldPerHr: 1_800_000,
                xpPerHr: 40_000,
            },
        ];

        const stages = buildStagesFromResults({ currentStage, builds });

        expect(stages[0].name).toBe('Current Gear');
        expect(stages[0].cost).toBe(0);
        expect(stages[0].goldPerHr).toBe(285_000);
        expect(stages[0].xpPerHr).toBe(8_000);
    });

    it('sorts builds cheapest-to-priciest and charges only the incremental delta between them', () => {
        const currentStage = {
            equipment: { '/equipment_types/main_hand': { hrid: '/items/starter_sword', enhancementLevel: 0 } },
            goldPerHr: 285_000,
            xpPerHr: 8_000,
        };
        const builds = [
            {
                // Listed second here, but is the cheaper build — should sort before "Endgame".
                name: 'Mid Tier',
                equipment: { '/equipment_types/main_hand': { hrid: '/items/mid_sword', enhancementLevel: 0 } },
                goldPerHr: 600_000,
                xpPerHr: 20_000,
            },
            {
                name: 'Endgame',
                equipment: {
                    '/equipment_types/main_hand': { hrid: '/items/end_sword', enhancementLevel: 10 },
                    '/equipment_types/off_hand': { hrid: '/items/end_shield', enhancementLevel: 10 },
                },
                goldPerHr: 1_800_000,
                xpPerHr: 40_000,
            },
        ];

        const stages = buildStagesFromResults({ currentStage, builds });

        expect(stages.map((s) => s.name)).toEqual(['Current Gear', 'Mid Tier', 'Endgame']);
        // Mid Tier from starter gear: full mid_sword price (10,000), since it's a different item.
        expect(stages[1].cost).toBe(10_000);
        // Endgame from Mid Tier: main_hand changes again (500,000) plus a brand new off_hand slot (300,000).
        expect(stages[2].cost).toBe(500_000 + 300_000);
    });

    it('does not re-charge for an item already owned from the previous stage', () => {
        const currentStage = {
            equipment: {
                '/equipment_types/main_hand': { hrid: '/items/end_sword', enhancementLevel: 10 },
            },
            goldPerHr: 1_000_000,
            xpPerHr: 25_000,
        };
        const builds = [
            {
                name: 'Add Shield',
                equipment: {
                    '/equipment_types/main_hand': { hrid: '/items/end_sword', enhancementLevel: 10 }, // already owned
                    '/equipment_types/off_hand': { hrid: '/items/end_shield', enhancementLevel: 10 }, // new
                },
                goldPerHr: 1_500_000,
                xpPerHr: 35_000,
            },
        ];

        const stages = buildStagesFromResults({ currentStage, builds });

        expect(stages[1].cost).toBe(300_000); // only the shield, not the sword again
    });

    it('carries extra metadata (e.g. bestZone) through unchanged', () => {
        const currentStage = { equipment: {}, goldPerHr: 100, xpPerHr: 100 };
        const builds = [
            {
                name: 'Tier 1',
                equipment: { '/equipment_types/main_hand': { hrid: '/items/mid_sword', enhancementLevel: 0 } },
                goldPerHr: 500,
                xpPerHr: 500,
                bestZone: { zoneHrid: '/actions/combat/some_zone', name: 'Some Zone' },
            },
        ];

        const stages = buildStagesFromResults({ currentStage, builds });

        expect(stages[1].bestZone).toEqual({ zoneHrid: '/actions/combat/some_zone', name: 'Some Zone' });
    });

    it('returns just the current stage when there are no builds', () => {
        const currentStage = { equipment: {}, goldPerHr: 100, xpPerHr: 100 };
        const stages = buildStagesFromResults({ currentStage, builds: [] });
        expect(stages).toHaveLength(1);
        expect(stages[0].name).toBe('Current Gear');
    });
});

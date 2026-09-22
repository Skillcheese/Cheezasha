import { describe, expect, it, vi } from 'vitest';

const prices = new Map();

vi.mock('../../utils/profit-helpers.js', () => ({
    resolveItemPrice: vi.fn((itemHrid, { enhancementLevel = 0 } = {}) => {
        const key = `${itemHrid}::${enhancementLevel}`;
        if (prices.has(key)) return { price: prices.get(key), custom: false, missing: false };
        return { price: 0, custom: false, missing: true };
    }),
}));

const { estimateEquipmentPrice, calculateGearUpgradeCost } = await import('./gear-price.js');

beforeSetPrices();

function beforeSetPrices() {
    prices.set('/items/sword::0', 1000);
    prices.set('/items/sword::5', 5000);
    prices.set('/items/shield::0', 800);
    prices.set('/items/helm::10', 20000);
}

describe('estimateEquipmentPrice', () => {
    it('sums resolved prices for every equipped slot', () => {
        const equipment = {
            '/equipment_types/main_hand': { hrid: '/items/sword', enhancementLevel: 5 },
            '/equipment_types/off_hand': { hrid: '/items/shield', enhancementLevel: 0 },
        };

        const result = estimateEquipmentPrice(equipment);

        expect(result.total).toBe(5800);
        expect(result.hasMissingPrice).toBe(false);
        expect(result.perSlot['/equipment_types/main_hand']).toBe(5000);
    });

    it('flags missing prices without crashing', () => {
        const equipment = {
            '/equipment_types/main_hand': { hrid: '/items/unknown', enhancementLevel: 0 },
        };

        const result = estimateEquipmentPrice(equipment);

        expect(result.total).toBe(0);
        expect(result.hasMissingPrice).toBe(true);
    });

    it('ignores empty slots', () => {
        const result = estimateEquipmentPrice({ '/equipment_types/main_hand': null });
        expect(result.total).toBe(0);
    });

    it('handles an empty/undefined equipment map', () => {
        expect(estimateEquipmentPrice(undefined).total).toBe(0);
        expect(estimateEquipmentPrice({}).total).toBe(0);
    });
});

describe('calculateGearUpgradeCost', () => {
    it('charges nothing for a slot already holding the same item at the same enhancement', () => {
        const from = { '/equipment_types/main_hand': { hrid: '/items/sword', enhancementLevel: 5 } };
        const to = { '/equipment_types/main_hand': { hrid: '/items/sword', enhancementLevel: 5 } };

        const result = calculateGearUpgradeCost(from, to);

        expect(result.total).toBe(0);
        expect(result.perSlot['/equipment_types/main_hand']).toBe(0);
    });

    it('charges nothing when you already own a higher enhancement than the target', () => {
        const from = { '/equipment_types/main_hand': { hrid: '/items/sword', enhancementLevel: 5 } };
        const to = { '/equipment_types/main_hand': { hrid: '/items/sword', enhancementLevel: 0 } };

        const result = calculateGearUpgradeCost(from, to);

        expect(result.total).toBe(0);
    });

    it('charges the full price for a slot with a different item', () => {
        const from = { '/equipment_types/main_hand': { hrid: '/items/sword', enhancementLevel: 0 } };
        const to = { '/equipment_types/main_hand': { hrid: '/items/sword', enhancementLevel: 5 } };

        const result = calculateGearUpgradeCost(from, to);

        expect(result.total).toBe(5000);
    });

    it('charges nothing for removing a slot (no sell credit given)', () => {
        const from = { '/equipment_types/off_hand': { hrid: '/items/shield', enhancementLevel: 0 } };
        const to = {};

        const result = calculateGearUpgradeCost(from, to);

        expect(result.total).toBe(0);
    });

    it('only charges for the slots that actually change across a whole loadout', () => {
        const from = {
            '/equipment_types/main_hand': { hrid: '/items/sword', enhancementLevel: 0 },
            '/equipment_types/off_hand': { hrid: '/items/shield', enhancementLevel: 0 },
        };
        const to = {
            '/equipment_types/main_hand': { hrid: '/items/sword', enhancementLevel: 5 }, // upgraded
            '/equipment_types/off_hand': { hrid: '/items/shield', enhancementLevel: 0 }, // unchanged
            '/equipment_types/head': { hrid: '/items/helm', enhancementLevel: 10 }, // new slot
        };

        const result = calculateGearUpgradeCost(from, to);

        expect(result.total).toBe(5000 + 20000);
        expect(result.perSlot['/equipment_types/off_hand']).toBe(0);
    });

    it('handles starting from no gear at all', () => {
        const to = { '/equipment_types/main_hand': { hrid: '/items/sword', enhancementLevel: 0 } };
        const result = calculateGearUpgradeCost(undefined, to);
        expect(result.total).toBe(1000);
    });

    describe('with sellOldGear', () => {
        it('credits selling a replaced item at 90% of its buy price minus 5% market tax', () => {
            const from = { '/equipment_types/off_hand': { hrid: '/items/shield', enhancementLevel: 0 } };
            const to = { '/equipment_types/off_hand': { hrid: '/items/helm', enhancementLevel: 10 } };

            const result = calculateGearUpgradeCost(from, to, { sellOldGear: true });

            const sellCredit = 800 * 0.9 * 0.95;
            expect(result.sellCredit).toBeCloseTo(sellCredit);
            expect(result.total).toBeCloseTo(20000 - sellCredit);
        });

        it('credits selling gear left behind entirely (an empty slot in the target)', () => {
            const from = { '/equipment_types/off_hand': { hrid: '/items/shield', enhancementLevel: 0 } };
            const to = {};

            const result = calculateGearUpgradeCost(from, to, { sellOldGear: true });

            expect(result.sellCredit).toBeCloseTo(800 * 0.9 * 0.95);
            expect(result.total).toBeCloseTo(-800 * 0.9 * 0.95);
        });

        it('gives no credit for an item carried forward into the same slot', () => {
            const from = { '/equipment_types/main_hand': { hrid: '/items/sword', enhancementLevel: 5 } };
            const to = { '/equipment_types/main_hand': { hrid: '/items/sword', enhancementLevel: 5 } };

            const result = calculateGearUpgradeCost(from, to, { sellOldGear: true });

            expect(result.sellCredit).toBe(0);
            expect(result.total).toBe(0);
        });

        it('defaults to no credit when sellOldGear is omitted', () => {
            const from = { '/equipment_types/off_hand': { hrid: '/items/shield', enhancementLevel: 0 } };
            const to = {};

            const result = calculateGearUpgradeCost(from, to);

            expect(result.sellCredit).toBe(0);
            expect(result.total).toBe(0);
        });
    });
});

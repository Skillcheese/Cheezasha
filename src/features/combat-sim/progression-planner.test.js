import { describe, expect, it, vi } from 'vitest';

const prices = new Map([
    ['/items/starter_sword::0', 100],
    ['/items/mid_sword::0', 10_000],
    ['/items/end_sword::10', 500_000],
    ['/items/end_shield::10', 300_000],
    ['/items/fire_staff::0', 10_000],
    ['/items/shared_shield::0', 5_000],
]);

vi.mock('../../utils/profit-helpers.js', () => ({
    resolveItemPrice: vi.fn((itemHrid, { enhancementLevel = 0 } = {}) => {
        const key = `${itemHrid}::${enhancementLevel}`;
        return prices.has(key)
            ? { price: prices.get(key), custom: false, missing: false }
            : { price: 0, custom: false, missing: true };
    }),
}));

const mockRunAllZonesSimulation = vi.fn();
vi.mock('./all-zones-runner.js', () => ({
    runAllZonesSimulation: (...args) => mockRunAllZonesSimulation(...args),
}));

const mockCalculateSimRevenue = vi.fn();
vi.mock('./combat-sim-adapter.js', () => ({
    calculateSimRevenue: (...args) => mockCalculateSimRevenue(...args),
}));

const {
    buildStagesFromResults,
    findBestZoneForDTO,
    getRequiredLevelsForEquipment,
    runProgressionZoneSearch,
    simulateDtoAcrossZones,
} = await import('./progression-planner.js');

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

    it('credits selling the previous stage gear toward the next stage cost when sellOldGear is set', () => {
        const currentStage = {
            equipment: { '/equipment_types/main_hand': { hrid: '/items/starter_sword', enhancementLevel: 0 } },
            goldPerHr: 285_000,
            xpPerHr: 8_000,
        };
        const builds = [
            {
                name: 'Mid Tier',
                equipment: { '/equipment_types/main_hand': { hrid: '/items/mid_sword', enhancementLevel: 0 } },
                goldPerHr: 600_000,
                xpPerHr: 20_000,
            },
        ];

        const withoutSell = buildStagesFromResults({ currentStage, builds });
        const withSell = buildStagesFromResults({ currentStage, builds, sellOldGear: true });

        // Selling the 100-gold starter sword nets 100 * 0.9 * 0.95 = 85.5, credited off the 10,000 cost.
        expect(withoutSell[1].cost).toBe(10_000);
        expect(withSell[1].cost).toBeCloseTo(10_000 - 100 * 0.9 * 0.95);
        expect(withSell[0].directCosts['Mid Tier']).toBeCloseTo(10_000 - 100 * 0.9 * 0.95);
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

    it('computes a directCosts map so any stage can price a jump straight to any other', () => {
        const currentStage = {
            equipment: { '/equipment_types/main_hand': { hrid: '/items/starter_sword', enhancementLevel: 0 } },
            goldPerHr: 285_000,
            xpPerHr: 8_000,
        };
        const builds = [
            {
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
        const current = stages.find((s) => s.name === 'Current Gear');
        const midTier = stages.find((s) => s.name === 'Mid Tier');
        const endgame = stages.find((s) => s.name === 'Endgame');

        // Straight from Current Gear to Endgame, bypassing Mid Tier entirely.
        expect(current.directCosts.Endgame).toBe(500_000 + 300_000);
        // From Mid Tier to Endgame directly (identical to the sequential price here, since Mid
        // Tier's main_hand isn't reused by Endgame).
        expect(midTier.directCosts.Endgame).toBe(500_000 + 300_000);
        expect(endgame.directCosts['Current Gear']).toBeGreaterThan(0);
    });
});

describe('getRequiredLevelsForEquipment', () => {
    const gameData = {
        itemDetailMap: {
            '/items/sword': {
                equipmentDetail: { levelRequirements: [{ skillHrid: '/skills/attack', level: 30 }] },
            },
            '/items/heavy_armor': {
                equipmentDetail: {
                    levelRequirements: [
                        { skillHrid: '/skills/defense', level: 20 },
                        { skillHrid: '/skills/stamina', level: 10 },
                    ],
                },
            },
            '/items/no_requirement_item': { equipmentDetail: { levelRequirements: [] } },
            '/items/utility_pouch': {
                equipmentDetail: {
                    levelRequirements: [
                        { skillHrid: '/skills/alchemy', level: 80 },
                        { skillHrid: '/skills/total_level', level: 1250 },
                        { skillHrid: '/skills/magic', level: 95 }, // still counted — it's a combat skill
                    ],
                },
            },
        },
    };

    it('takes the max requirement per skill across all equipped items', () => {
        const equipment = {
            '/equipment_types/main_hand': { hrid: '/items/sword', enhancementLevel: 0 },
            '/equipment_types/body': { hrid: '/items/heavy_armor', enhancementLevel: 0 },
        };

        const result = getRequiredLevelsForEquipment(equipment, gameData);

        expect(result).toEqual(
            expect.arrayContaining([
                { skillHrid: '/skills/attack', level: 30 },
                { skillHrid: '/skills/defense', level: 20 },
                { skillHrid: '/skills/stamina', level: 10 },
            ])
        );
        expect(result).toHaveLength(3);
    });

    it('returns an empty array for gear with no requirements', () => {
        const equipment = { '/equipment_types/main_hand': { hrid: '/items/no_requirement_item', enhancementLevel: 0 } };
        expect(getRequiredLevelsForEquipment(equipment, gameData)).toEqual([]);
    });

    it('ignores non-combat skill requirements (artisan skills, total level) entirely', () => {
        const equipment = { '/equipment_types/pouch': { hrid: '/items/utility_pouch', enhancementLevel: 0 } };

        const result = getRequiredLevelsForEquipment(equipment, gameData);

        // Only the magic requirement survives — alchemy and total_level are dropped.
        expect(result).toEqual([{ skillHrid: '/skills/magic', level: 95 }]);
    });

    it('handles empty equipment and missing item data gracefully', () => {
        expect(getRequiredLevelsForEquipment({}, gameData)).toEqual([]);
        expect(getRequiredLevelsForEquipment(undefined, gameData)).toEqual([]);
        const equipment = { '/equipment_types/main_hand': { hrid: '/items/unknown_item', enhancementLevel: 0 } };
        expect(getRequiredLevelsForEquipment(equipment, gameData)).toEqual([]);
    });
});

describe('findBestZoneForDTO', () => {
    function mockZoneResults(entries) {
        // entries: [{ simulatedTime (ns), experienceGained: {atk, def}, netPerHour }]
        mockRunAllZonesSimulation.mockResolvedValue(
            entries.map((e, idx) => ({
                _testIdx: idx, // disambiguates entries that share the same simulatedTime
                simulatedTime: e.simulatedTime,
                experienceGained: { player1: e.experienceGained },
            }))
        );
        mockCalculateSimRevenue.mockImplementation((simResult) => ({
            netPerHour: entries[simResult._testIdx].netPerHour,
        }));
    }

    const zones = [
        { zoneHrid: '/zone/a', difficultyTier: 0, name: 'Zone A' },
        { zoneHrid: '/zone/b', difficultyTier: 0, name: 'Zone B' },
    ];
    const ONE_HOUR_NS = 3600 * 1e9;

    it('picks the best gold/hr zone when objectiveWeight is 0', async () => {
        // simResult.experienceGained uses short skill keys ('attack'), not full hrids.
        mockZoneResults([
            { simulatedTime: ONE_HOUR_NS, experienceGained: { attack: 10_000 }, netPerHour: 500_000 },
            { simulatedTime: ONE_HOUR_NS, experienceGained: { attack: 5_000 }, netPerHour: 900_000 },
        ]);

        const best = await findBestZoneForDTO({ hrid: 'player1' }, zones, {}, { objectiveWeight: 0 });

        expect(best.zoneHrid).toBe('/zone/b');
    });

    it('picks the best xp/hr zone when objectiveWeight is 1', async () => {
        mockZoneResults([
            { simulatedTime: ONE_HOUR_NS, experienceGained: { attack: 10_000 }, netPerHour: 500_000 },
            { simulatedTime: ONE_HOUR_NS, experienceGained: { attack: 5_000 }, netPerHour: 900_000 },
        ]);

        const best = await findBestZoneForDTO({ hrid: 'player1' }, zones, {}, { objectiveWeight: 1 });

        expect(best.zoneHrid).toBe('/zone/a');
    });

    it('sums xp across multiple skills for the xp/hr metric, keyed to full skill hrids', async () => {
        mockZoneResults([
            {
                simulatedTime: ONE_HOUR_NS,
                experienceGained: { attack: 5_000, defense: 5_000 },
                netPerHour: 100_000,
            },
        ]);

        const best = await findBestZoneForDTO({ hrid: 'player1' }, [zones[0]], {}, { objectiveWeight: 1 });

        expect(best.xpPerHr).toBe(10_000);
        // Converted to full hrids so they line up with gameData's levelRequirements[].skillHrid.
        expect(best.xpPerHrBySkill).toEqual({ '/skills/attack': 5_000, '/skills/defense': 5_000 });
    });

    it('returns null when there are no zones', async () => {
        const best = await findBestZoneForDTO({ hrid: 'player1' }, [], {}, {});
        expect(best).toBeNull();
    });

    describe('caching', () => {
        it('reuses a cached result for the same DTO/zones/hours instead of re-simulating', async () => {
            mockRunAllZonesSimulation.mockClear();
            mockZoneResults([
                { simulatedTime: ONE_HOUR_NS, experienceGained: { attack: 10_000 }, netPerHour: 500_000 },
            ]);
            const cache = new Map();
            const dto = { hrid: 'player1' };

            const first = await findBestZoneForDTO(dto, [zones[0]], {}, { objectiveWeight: 1, cache, hours: 1 });
            const second = await findBestZoneForDTO(dto, [zones[0]], {}, { objectiveWeight: 1, cache, hours: 1 });

            expect(mockRunAllZonesSimulation).toHaveBeenCalledTimes(1);
            expect(first.cached).toBeFalsy();
            expect(second.cached).toBe(true);
            expect(second.xpPerHr).toBe(first.xpPerHr);
        });

        it('re-simulates when the DTO content changes (e.g. different gear)', async () => {
            mockRunAllZonesSimulation.mockClear();
            mockZoneResults([
                { simulatedTime: ONE_HOUR_NS, experienceGained: { attack: 10_000 }, netPerHour: 500_000 },
            ]);
            const cache = new Map();

            await findBestZoneForDTO({ hrid: 'player1', gear: 'A' }, [zones[0]], {}, { objectiveWeight: 1, cache });
            await findBestZoneForDTO({ hrid: 'player1', gear: 'B' }, [zones[0]], {}, { objectiveWeight: 1, cache });

            expect(mockRunAllZonesSimulation).toHaveBeenCalledTimes(2);
        });

        it('does not use the cache at all when none is provided', async () => {
            mockRunAllZonesSimulation.mockClear();
            mockZoneResults([
                { simulatedTime: ONE_HOUR_NS, experienceGained: { attack: 10_000 }, netPerHour: 500_000 },
            ]);
            const dto = { hrid: 'player1' };

            await findBestZoneForDTO(dto, [zones[0]], {}, { objectiveWeight: 1 });
            await findBestZoneForDTO(dto, [zones[0]], {}, { objectiveWeight: 1 });

            expect(mockRunAllZonesSimulation).toHaveBeenCalledTimes(2);
        });
    });
});

describe('simulateDtoAcrossZones', () => {
    it('returns raw unranked per-zone candidates', async () => {
        mockRunAllZonesSimulation.mockClear();
        mockRunAllZonesSimulation.mockResolvedValue([
            { _testIdx: 0, simulatedTime: 3600 * 1e9, experienceGained: { player1: { attack: 10_000 } } },
            { _testIdx: 1, simulatedTime: 3600 * 1e9, experienceGained: { player1: { attack: 5_000 } } },
        ]);
        mockCalculateSimRevenue.mockImplementation((simResult) => ({
            netPerHour: [500_000, 900_000][simResult._testIdx],
        }));
        const zones = [
            { zoneHrid: '/zone/a', difficultyTier: 0, name: 'Zone A' },
            { zoneHrid: '/zone/b', difficultyTier: 0, name: 'Zone B' },
        ];

        const candidates = await simulateDtoAcrossZones({ hrid: 'player1' }, zones, {}, {});

        expect(candidates).toHaveLength(2);
        expect(candidates[0].goldPerHr).toBe(500_000);
        expect(candidates[1].goldPerHr).toBe(900_000);
    });

    it('returns an empty array when there are no zones', async () => {
        expect(await simulateDtoAcrossZones({ hrid: 'player1' }, [], {}, {})).toEqual([]);
    });
});

describe('runProgressionZoneSearch', () => {
    it('never simulates current gear — only saved builds are scanned and ranked', async () => {
        mockRunAllZonesSimulation.mockClear();
        mockRunAllZonesSimulation.mockResolvedValue([
            { simulatedTime: 0.5 * 3600 * 1e9, experienceGained: { player1: { magic: 20_000 } } },
        ]);
        mockCalculateSimRevenue.mockReturnValue({ netPerHour: 400_000 });

        const currentDTO = {
            hrid: 'player1',
            equipment: { '/equipment_types/main_hand': { hrid: '/items/melee_sword', enhancementLevel: 0 } },
        };
        const builds = [
            {
                name: 'Fire Build',
                dto: {
                    hrid: 'player1',
                    equipment: { '/equipment_types/main_hand': { hrid: '/items/fire_staff', enhancementLevel: 0 } },
                },
            },
        ];

        const stages = await runProgressionZoneSearch({
            currentDTO,
            builds,
            zones: [{ zoneHrid: '/zone/a', difficultyTier: 0, name: 'Zone A' }],
            gameData: {},
            options: {},
        });

        // Only one call to the simulator — for the saved build, never for current gear.
        expect(mockRunAllZonesSimulation).toHaveBeenCalledTimes(1);

        const currentStage = stages.find((s) => s.name === 'Current Gear');
        expect(currentStage.goldPerHr).toBe(0);
        expect(currentStage.xpPerHrBySkill).toEqual({});
        expect(currentStage.bestZone).toBeNull();
        expect(currentStage.requiredLevels).toEqual([]);

        const fireStage = stages.find((s) => s.name === 'Fire Build');
        expect(fireStage.goldPerHr).toBe(400_000);
        expect(fireStage.bestZone).not.toBeNull();
    });

    it('still uses current gear as the cost-diffing baseline, so already-owned items are free', async () => {
        mockRunAllZonesSimulation.mockResolvedValue([
            { simulatedTime: 0.5 * 3600 * 1e9, experienceGained: { player1: { magic: 20_000 } } },
        ]);
        mockCalculateSimRevenue.mockReturnValue({ netPerHour: 400_000 });

        const currentDTO = {
            hrid: 'player1',
            equipment: { '/equipment_types/off_hand': { hrid: '/items/shared_shield', enhancementLevel: 0 } },
        };
        const builds = [
            {
                name: 'Fire Build',
                dto: {
                    hrid: 'player1',
                    equipment: {
                        '/equipment_types/off_hand': { hrid: '/items/shared_shield', enhancementLevel: 0 }, // already owned
                        '/equipment_types/main_hand': { hrid: '/items/fire_staff', enhancementLevel: 0 },
                    },
                },
            },
        ];

        const stages = await runProgressionZoneSearch({
            currentDTO,
            builds,
            zones: [{ zoneHrid: '/zone/a', difficultyTier: 0, name: 'Zone A' }],
            gameData: {},
            options: {},
        });

        const fireStage = stages.find((s) => s.name === 'Fire Build');
        // Shield already owned (free): main_hand staff = 10,000, per the mocked price table.
        expect(fireStage.cost).toBe(10_000);
    });
});

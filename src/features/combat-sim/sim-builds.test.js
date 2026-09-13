import { beforeEach, describe, expect, it, vi } from 'vitest';

const storageState = new Map();

vi.mock('../../core/storage.js', () => ({
    default: {
        getJSON: vi.fn(async (key) => (storageState.has(key) ? storageState.get(key) : null)),
        setJSON: vi.fn((key, value) => {
            storageState.set(key, value);
        }),
    },
}));

vi.mock('../../core/data-manager.js', () => ({
    default: {
        getCurrentCharacterId: vi.fn(() => 'char1'),
    },
}));

vi.mock('./combat-sim-adapter.js', () => ({
    buildGameDataPayload: vi.fn(() => ({
        itemDetailMap: { '/items/sword': {}, '/items/shield': {} },
        abilityDetailMap: { '/abilities/slash': {} },
    })),
}));

// Import after mocks so the module under test picks up the mocked deps.
const { default: simBuilds } = await import('./sim-builds.js');

function makeDTO() {
    return {
        hrid: 'player1',
        equipment: {
            '/equipment_types/main_hand': { hrid: '/items/sword', enhancementLevel: 5 },
        },
        abilities: [null, { hrid: '/abilities/slash', level: 10, triggers: null }, null, null, null],
        food: [null, null, null],
        drinks: [null, null, null],
        houseRooms: { '/house_rooms/dining_room': 8 },
        attackLevel: 100,
    };
}

beforeEach(() => {
    storageState.clear();
    simBuilds.builds = {};
    simBuilds.isInitialized = false;
});

describe('simBuilds', () => {
    it('saves and retrieves a build with a deep-cloned dto', async () => {
        await simBuilds.initialize();
        const dto = makeDTO();

        simBuilds.save('Endgame Melee', dto);
        dto.attackLevel = 999; // mutate original — must not affect stored copy

        const retrieved = simBuilds.get('Endgame Melee');
        expect(retrieved.attackLevel).toBe(100);
        expect(retrieved.equipment['/equipment_types/main_hand'].hrid).toBe('/items/sword');
    });

    it('lists saved builds sorted by name', async () => {
        await simBuilds.initialize();
        simBuilds.save('Zeta Build', makeDTO());
        simBuilds.save('Alpha Build', makeDTO());

        const names = simBuilds.list().map((b) => b.name);
        expect(names).toEqual(['Alpha Build', 'Zeta Build']);
    });

    it('overwrites an existing build on save with the same name', async () => {
        await simBuilds.initialize();
        const dto = makeDTO();
        simBuilds.save('My Build', dto);

        const dto2 = makeDTO();
        dto2.attackLevel = 250;
        simBuilds.save('My Build', dto2);

        expect(simBuilds.list().length).toBe(1);
        expect(simBuilds.get('My Build').attackLevel).toBe(250);
    });

    it('renames a build', async () => {
        await simBuilds.initialize();
        simBuilds.save('Old Name', makeDTO());

        const result = simBuilds.rename('Old Name', 'New Name');

        expect(result).toBe(true);
        expect(simBuilds.has('Old Name')).toBe(false);
        expect(simBuilds.has('New Name')).toBe(true);
    });

    it('refuses to rename onto an existing build name', async () => {
        await simBuilds.initialize();
        simBuilds.save('Build A', makeDTO());
        simBuilds.save('Build B', makeDTO());

        const result = simBuilds.rename('Build A', 'Build B');

        expect(result).toBe(false);
        expect(simBuilds.has('Build A')).toBe(true);
        expect(simBuilds.has('Build B')).toBe(true);
    });

    it('deletes a build', async () => {
        await simBuilds.initialize();
        simBuilds.save('Doomed Build', makeDTO());

        simBuilds.remove('Doomed Build');

        expect(simBuilds.has('Doomed Build')).toBe(false);
        expect(simBuilds.get('Doomed Build')).toBeNull();
    });

    it('persists builds to storage and reloads them on re-initialize', async () => {
        await simBuilds.initialize();
        simBuilds.save('Persisted Build', makeDTO());

        // Simulate a fresh module state (e.g. new page load) by resetting in-memory
        // state and re-initializing, which should reload from the mocked storage.
        simBuilds.builds = {};
        simBuilds.isInitialized = false;
        await simBuilds.initialize();

        expect(simBuilds.has('Persisted Build')).toBe(true);
    });

    it('prunes equipment, abilities, food, and drinks referencing unknown hrids on get', async () => {
        await simBuilds.initialize();
        const dto = makeDTO();
        dto.equipment['/equipment_types/off_hand'] = { hrid: '/items/unknown_relic', enhancementLevel: 0 };
        dto.abilities[2] = { hrid: '/abilities/forgotten_skill', level: 5, triggers: null };
        dto.food[0] = { hrid: '/items/unknown_food', triggers: null };
        simBuilds.save('Stale Build', dto);

        const retrieved = simBuilds.get('Stale Build');

        expect(retrieved.equipment['/equipment_types/off_hand']).toBeUndefined();
        expect(retrieved.equipment['/equipment_types/main_hand'].hrid).toBe('/items/sword');
        expect(retrieved.abilities[2]).toBeNull();
        expect(retrieved.abilities[1].hrid).toBe('/abilities/slash');
        expect(retrieved.food[0]).toBeNull();
    });

    it('returns null for a build that does not exist', async () => {
        await simBuilds.initialize();
        expect(simBuilds.get('Nonexistent')).toBeNull();
    });
});

/**
 * Level Target
 * Given a zone/loadout and a target level per combat skill, runs several independent sims of the
 * zone and extrapolates how many hours/kills are needed to reach each target level, taking the
 * worst (highest) result across the runs as the estimate — sim XP/hr and kill rate both vary
 * run-to-run (monster mix, RNG), so a single sim can understate what it actually takes. XP/hr
 * already reflects charm/weapon focusTraining XP redirection, since that's computed by the normal
 * combat sim engine (see SimResult.addExperienceGain).
 */

import { runSimulation } from './combat-sim-runner.js';
import { buildGameDataPayload } from './combat-sim-adapter.js';
import dataManager from '../../core/data-manager.js';

const ONE_HOUR_NS = 3600 * 1e9;
const RUN_COUNT = 5;

export const COMBAT_SKILLS = [
    { key: 'stamina', label: 'Stamina' },
    { key: 'intelligence', label: 'Intelligence' },
    { key: 'attack', label: 'Attack' },
    { key: 'melee', label: 'Melee' },
    { key: 'defense', label: 'Defense' },
    { key: 'ranged', label: 'Ranged' },
    { key: 'magic', label: 'Magic' },
];

/**
 * Run RUN_COUNT independent sims of the given zone/loadout, then for each requested skill target
 * take the worst-case (slowest) hours-needed and kills-needed across those runs.
 * @param {Object} params - { playerDTOs, playerIndex, zoneHrid, difficultyTier, hours, communityBuffs, targets }
 * @param {Object<string, number>} params.targets - { skillKey: targetLevel } for skills the user entered a target for
 * @param {Function} [onProgress] - Called with (percent: 0-100)
 * @returns {Promise<Object>} { encountersPerHour, deathsPerHour, simHours, skillResults }
 */
export async function runLevelTargetAnalysis(params, onProgress) {
    const { playerDTOs, playerIndex, zoneHrid, difficultyTier, hours, communityBuffs, targets } = params;

    const gameData = buildGameDataPayload();
    if (!gameData) throw new Error('No game data available');

    const playerDTO = playerDTOs[playerIndex];
    const playerHrid = playerDTO.hrid;
    const levelXpTable = gameData.levelExperienceTable || [];

    const runProgress = new Array(RUN_COUNT).fill(0);
    const reportProgress = () => {
        if (!onProgress) return;
        onProgress(Math.round(runProgress.reduce((a, b) => a + b, 0) / RUN_COUNT));
    };

    const simResults = await Promise.all(
        Array.from({ length: RUN_COUNT }, (_, i) =>
            runSimulation(
                { gameData, playerDTOs, zoneHrid, difficultyTier, hours, communityBuffs, singleWorker: true },
                (percent) => {
                    runProgress[i] = percent;
                    reportProgress();
                }
            )
        )
    );

    const perRun = simResults.map((simResult) => {
        const simHours = (simResult.simulatedTime || 0) / ONE_HOUR_NS || hours;
        return {
            simHours,
            xpGained: simResult.experienceGained?.[playerHrid] || {},
            encountersPerHour: (simResult.encounters || 0) / simHours,
            deathsPerHour: (simResult.deaths?.[playerHrid] || 0) / simHours,
        };
    });

    // Report the worst-case (highest) deaths/hr and worst-case (lowest) kills/hr across runs as
    // the headline zone stats, consistent with the worst-case framing used per-skill below.
    const encountersPerHour = Math.min(...perRun.map((r) => r.encountersPerHour));
    const deathsPerHour = Math.max(...perRun.map((r) => r.deathsPerHour));
    const simHours = perRun.reduce((sum, r) => sum + r.simHours, 0) / perRun.length;

    const skillResults = [];
    for (const [skillKey, targetLevel] of Object.entries(targets)) {
        const currentLevel = playerDTO[skillKey + 'Level'] || 1;

        if (targetLevel <= currentLevel) {
            skillResults.push({ skillKey, currentLevel, targetLevel, status: 'already-met' });
            continue;
        }

        const xpPerHourRuns = perRun.map((r) => (r.xpGained[skillKey] || 0) / r.simHours);
        if (xpPerHourRuns.some((xpPerHour) => xpPerHour <= 0)) {
            skillResults.push({ skillKey, currentLevel, targetLevel, xpPerHour: 0, status: 'invalid' });
            continue;
        }

        // Use the player's actual accumulated XP within the current level when it's available and
        // still matches the DTO's level (i.e. the DTO wasn't hand-edited to a hypothetical level),
        // rather than assuming zero progress into the level — otherwise xpNeeded is overstated by
        // however much XP the player already has banked toward the next level.
        const liveSkill = dataManager.getSkills()?.find((s) => s.skillHrid === `/skills/${skillKey}`);
        const currentLevelXp =
            liveSkill && liveSkill.level === currentLevel ? liveSkill.experience : levelXpTable[currentLevel] || 0;
        const targetLevelXp = levelXpTable[targetLevel] || 0;
        const xpNeeded = Math.max(0, targetLevelXp - currentLevelXp);

        // Worst case across the runs: the hours/kills each run itself would've taken to hit the
        // target (each computed self-consistently from that run's own rates), then the max of each.
        const hoursPerRun = xpPerHourRuns.map((xpPerHour) => xpNeeded / xpPerHour);
        const killsPerRun = perRun.map((r, i) => hoursPerRun[i] * r.encountersPerHour);

        const hoursNeeded = Math.max(...hoursPerRun);
        const killsNeeded = Math.max(...killsPerRun);
        const xpPerHour = Math.min(...xpPerHourRuns);

        skillResults.push({
            skillKey,
            currentLevel,
            targetLevel,
            xpPerHour,
            xpNeeded,
            hoursNeeded,
            killsNeeded,
            status: 'ok',
        });
    }

    return { encountersPerHour, deathsPerHour, simHours, skillResults };
}

/**
 * Debug script to extract trigger data from profile
 *
 * Usage:
 * 1. Open someone's profile in game
 * 2. Paste this into browser console
 * 3. Copy the output
 */

(async function() {
    console.log('=== Trigger Data Extractor ===');

    // Try to get profile data from getCurrentProfile
    const getCurrentProfile = window.Cheezasha?.Core?.profileManager?.getCurrentProfile;

    if (getCurrentProfile) {
        const profile = getCurrentProfile();

        if (profile && profile.profile) {
            console.log('\n--- Profile Data Found ---');
            console.log('Player Name:', profile.profile.sharableCharacter?.name);

            console.log('\n--- Equipped Abilities ---');
            console.log(JSON.stringify(profile.profile.equippedAbilities, null, 2));

            console.log('\n--- Ability Combat Triggers Map ---');
            console.log(JSON.stringify(profile.profile.abilityCombatTriggersMap, null, 2));

            console.log('\n--- Consumable Combat Triggers Map ---');
            console.log(JSON.stringify(profile.profile.consumableCombatTriggersMap, null, 2));

            console.log('\n--- Full Trigger Data (Copy This) ---');
            const triggerData = {
                abilities: profile.profile.equippedAbilities,
                abilityTriggers: profile.profile.abilityCombatTriggersMap,
                consumableTriggers: profile.profile.consumableCombatTriggersMap,
            };
            console.log(JSON.stringify(triggerData, null, 2));

        } else {
            console.error('No profile data found. Make sure you have a profile open.');
        }
    } else {
        console.error('Cheezasha not loaded or profile manager not available.');
        console.log('Trying direct WebSocket hook approach...');

        // Fallback: hook into next profile_shared message
        if (window.Cheezasha?.Core?.webSocketHook) {
            console.log('Listening for next profile_shared message...');
            console.log('(Open a profile now)');

            window.Cheezasha.Core.webSocketHook.on('profile_shared', (data) => {
                console.log('\n--- Profile Shared Data Received ---');
                console.log('Player Name:', data.profile?.sharableCharacter?.name);

                console.log('\n--- Equipped Abilities ---');
                console.log(JSON.stringify(data.profile?.equippedAbilities, null, 2));

                console.log('\n--- Ability Combat Triggers Map ---');
                console.log(JSON.stringify(data.profile?.abilityCombatTriggersMap, null, 2));

                console.log('\n--- Consumable Combat Triggers Map ---');
                console.log(JSON.stringify(data.profile?.consumableCombatTriggersMap, null, 2));

                console.log('\n--- Full Trigger Data (Copy This) ---');
                const triggerData = {
                    abilities: data.profile?.equippedAbilities,
                    abilityTriggers: data.profile?.abilityCombatTriggersMap,
                    consumableTriggers: data.profile?.consumableCombatTriggersMap,
                };
                console.log(JSON.stringify(triggerData, null, 2));
            });
        } else {
            console.error('WebSocket hook not available either. Is Cheezasha loaded?');
        }
    }
})();

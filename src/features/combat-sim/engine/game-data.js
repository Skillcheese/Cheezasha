/**
 * Game Data Singleton
 *
 * Replaces static JSON imports across the ported combat simulator engine.
 * Game data maps are set once per simulation run from Cheezasha's live data.
 */

let _gameData = null;

/**
 * Set all game data maps for the simulation.
 * @param {Object} data - Game data maps from dataManager.getInitClientData()
 */
export function setGameData(data) {
    _gameData = data;
}

/**
 * Get the current game data maps.
 * @returns {Object} Game data maps
 */
export function getGameData() {
    return _gameData;
}

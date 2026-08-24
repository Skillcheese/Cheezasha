/**
 * Cheezasha Utils Library
 * All utility modules
 * Version: 3.17.1
 * License: CC-BY-NC-SA-4.0
 */

(function (config, dataManager, webSocketHook, storage, marketAPI, domObserver) {
    'use strict';

    /**
     * Formatting Utilities
     * Pure functions for formatting numbers and time
     */


    /**
     * Check if number abbreviation (K/M/B) is enabled based on user settings.
     * Returns true for both 'compact' and 'threshold' modes, false for 'full'.
     * Also handles legacy boolean values from old settings.
     * @returns {boolean}
     */
    function isAbbreviationEnabled() {
        const mode = config.getSettingValue('formatting_useKMBFormat', 'compact');
        if (mode === false || mode === 'full') return false;
        return true;
    }

    /**
     * Format numbers with thousand separators
     * @param {number} num - The number to format
     * @param {number} digits - Number of decimal places (default: 0 for whole numbers)
     * @returns {string} Formatted number (e.g., "1,500", "1,500,000")
     *
     * @example
     * numberFormatter(1500) // "1,500"
     * numberFormatter(1500000) // "1,500,000"
     * numberFormatter(1500.5, 1) // "1,500.5"
     */
    function numberFormatter(num, digits = 0) {
        if (num === null || num === undefined) {
            return null;
        }

        // Round to specified decimal places
        const rounded = digits > 0 ? num.toFixed(digits) : Math.round(num);

        // Format with thousand separators
        return new Intl.NumberFormat().format(rounded);
    }

    /**
     * Convert seconds to human-readable time format
     * @param {number} sec - Seconds to convert
     * @returns {string} Formatted time (e.g., "1h 23m 45s" or "3 years 5 months 3 days")
     *
     * @example
     * timeReadable(3661) // "1h 01m 01s"
     * timeReadable(90000) // "1 day"
     * timeReadable(31536000) // "1 year"
     * timeReadable(100000000) // "3 years 2 months 3 days"
     */
    function timeReadable(sec) {
        // For times >= 1 year, show in years/months/days
        if (sec >= 31536000) {
            // 365 days
            const years = Math.floor(sec / 31536000);
            const remainingAfterYears = sec - years * 31536000;
            const months = Math.floor(remainingAfterYears / 2592000); // 30 days
            const remainingAfterMonths = remainingAfterYears - months * 2592000;
            const days = Math.floor(remainingAfterMonths / 86400);

            const parts = [];
            if (years > 0) parts.push(`${years} year${years !== 1 ? 's' : ''}`);
            if (months > 0) parts.push(`${months} month${months !== 1 ? 's' : ''}`);
            if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);

            return parts.join(' ');
        }

        // For times >= 1 day, show in days/hours/minutes
        if (sec >= 86400) {
            const days = Math.floor(sec / 86400);
            const remainingAfterDays = sec - days * 86400;
            const hours = Math.floor(remainingAfterDays / 3600);
            const remainingAfterHours = remainingAfterDays - hours * 3600;
            const minutes = Math.floor(remainingAfterHours / 60);

            const parts = [];
            if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
            if (hours > 0) parts.push(`${hours}h`);
            if (minutes > 0) parts.push(`${minutes}m`);

            return parts.join(' ');
        }

        // For times < 1 day, show as HH:MM:SS
        const d = new Date(Math.round(sec * 1000));
        function pad(i) {
            return ('0' + i).slice(-2);
        }

        const hours = d.getUTCHours();
        const minutes = d.getUTCMinutes();
        const seconds = d.getUTCSeconds();

        // For times < 1 minute, just show seconds
        if (hours === 0 && minutes === 0) {
            return seconds + 's';
        }

        const str = hours + 'h ' + pad(minutes) + 'm ' + pad(seconds) + 's';
        return str;
    }

    /**
     * Format a number with thousand separators based on locale
     * @param {number} num - The number to format
     * @returns {string} Formatted number with separators
     *
     * @example
     * formatWithSeparator(1000000) // "1,000,000" (US locale)
     */
    function formatWithSeparator(num) {
        return new Intl.NumberFormat().format(num);
    }

    /**
     * Format large numbers in K/M/B notation
     * @param {number} num - The number to format
     * @param {number} decimals - Number of decimal places (default: 1)
     * @returns {string} Formatted number (e.g., "1.5K", "2.3M", "1.2B")
     *
     * @example
     * formatKMB(1500) // "1.5K"
     * formatKMB(2300000) // "2.3M"
     * formatKMB(1234567890) // "1.2B"
     */
    function formatKMB(num, decimals = 1) {
        if (num === null || num === undefined) {
            return null;
        }

        const absNum = Math.abs(num);
        const sign = num < 0 ? '-' : '';

        if (absNum >= 1e9) {
            return sign + (absNum / 1e9).toFixed(decimals) + 'B';
        } else if (absNum >= 1e6) {
            return sign + (absNum / 1e6).toFixed(decimals) + 'M';
        } else if (absNum >= 1e3) {
            return sign + (absNum / 1e3).toFixed(decimals) + 'K';
        } else {
            return sign + absNum.toFixed(0);
        }
    }

    /**
     * Format large numbers in K/M/B notation with 3 significant digits
     * @param {number} num - The number to format
     * @returns {string} Formatted number (e.g., "999", "1.25K", "82.1K", "825K", "1.25M")
     *
     * Handles rounding edge cases properly:
     * - 9999 rounds to "10.0K" (not "10.00K")
     * - 99999 rounds to "100K" (not "100.0K")
     * - 999999 promotes to "1.00M" (not "1000K")
     *
     * @example
     * formatKMB3Digits(999) // "999"
     * formatKMB3Digits(1250) // "1.25K"
     * formatKMB3Digits(8210) // "8.21K"
     * formatKMB3Digits(9999) // "10.0K"
     * formatKMB3Digits(82100) // "82.1K"
     * formatKMB3Digits(99999) // "100K"
     * formatKMB3Digits(825000) // "825K"
     * formatKMB3Digits(999999) // "1.00M"
     * formatKMB3Digits(1250000) // "1.25M"
     * formatKMB3Digits(82300000) // "82.3M"
     */
    function formatKMB3Digits(num) {
        if (num === null || num === undefined) {
            return null;
        }

        const absNum = Math.abs(num);
        const sign = num < 0 ? '-' : '';

        if (absNum >= 1e9) {
            const value = absNum / 1e9;
            // Round to 2 decimals first to check actual display value
            const rounded = parseFloat(value.toFixed(2));
            let decimals = 2;
            if (rounded >= 100) decimals = 0;
            else if (rounded >= 10) decimals = 1;
            return sign + value.toFixed(decimals) + 'B';
        } else if (absNum >= 1e6) {
            const value = absNum / 1e6;
            const rounded = parseFloat(value.toFixed(2));
            if (rounded >= 1000) {
                // Promote to B (e.g., 999999999 -> 1.00B not 1000M)
                return sign + (value / 1000).toFixed(2) + 'B';
            }
            let decimals = 2;
            if (rounded >= 100) decimals = 0;
            else if (rounded >= 10) decimals = 1;
            return sign + value.toFixed(decimals) + 'M';
        } else if (absNum >= 1e3) {
            const value = absNum / 1e3;
            const rounded = parseFloat(value.toFixed(2));
            if (rounded >= 1000) {
                // Promote to M (e.g., 999999 -> 1.00M not 1000K)
                return sign + (value / 1000).toFixed(2) + 'M';
            }
            let decimals = 2;
            if (rounded >= 100) decimals = 0;
            else if (rounded >= 10) decimals = 1;
            return sign + value.toFixed(decimals) + 'K';
        } else {
            return sign + Math.floor(absNum).toString();
        }
    }

    /**
     * Format numbers using game-style coin notation (4-digit maximum display)
     * @param {number} num - The number to format
     * @returns {string} Formatted number (e.g., "999", "1,000", "10K", "9,999K", "10M")
     *
     * Game formatting rules (4-digit bounded notation):
     * - 0-999: Raw number (no formatting)
     * - 1,000-9,999: Comma format
     * - 10,000-9,999,999: K suffix (10K to 9,999K)
     * - 10,000,000-9,999,999,999: M suffix (10M to 9,999M)
     * - 10,000,000,000-9,999,999,999,999: B suffix (10B to 9,999B)
     * - 10,000,000,000,000+: T suffix (10T+)
     *
     * Key rule: Display never exceeds 4 numeric digits. When a 5th digit is needed,
     * promote to the next unit (K→M→B→T).
     *
     * @example
     * coinFormatter(999) // "999"
     * coinFormatter(1000) // "1,000"
     * coinFormatter(9999) // "9,999"
     * coinFormatter(10000) // "10K"
     * coinFormatter(999999) // "999K"
     * coinFormatter(1000000) // "1,000K"
     * coinFormatter(9999999) // "9,999K"
     * coinFormatter(10000000) // "10M"
     */
    function coinFormatter(num) {
        if (num === null || num === undefined) {
            return null;
        }

        const absNum = Math.abs(num);
        const sign = num < 0 ? '-' : '';

        // 0-999: raw number
        if (absNum < 1000) {
            return sign + Math.floor(absNum).toString();
        }
        // 1,000-9,999: comma format
        if (absNum < 10000) {
            return sign + new Intl.NumberFormat().format(Math.floor(absNum));
        }
        // 10K-9,999K (10,000 to 9,999,999)
        if (absNum < 10000000) {
            const val = Math.floor(absNum / 1000);
            const formatted = val >= 1000 ? new Intl.NumberFormat().format(val) : val;
            return sign + formatted + 'K';
        }
        // 10M-9,999M (10,000,000 to 9,999,999,999)
        if (absNum < 10000000000) {
            const val = Math.floor(absNum / 1000000);
            const formatted = val >= 1000 ? new Intl.NumberFormat().format(val) : val;
            return sign + formatted + 'M';
        }
        // 10B-9,999B (10,000,000,000 to 9,999,999,999,999)
        if (absNum < 10000000000000) {
            const val = Math.floor(absNum / 1000000000);
            const formatted = val >= 1000 ? new Intl.NumberFormat().format(val) : val;
            return sign + formatted + 'B';
        }
        // 10T+ (10,000,000,000,000+)
        const val = Math.floor(absNum / 1000000000000);
        const formatted = val >= 1000 ? new Intl.NumberFormat().format(val) : val;
        return sign + formatted + 'T';
    }

    /**
     * Format milliseconds as relative time
     * @param {number} ageMs - Age in milliseconds
     * @returns {string} Formatted relative time (e.g., "5m", "2h 30m", "3d 12h", "14d")
     *
     * @example
     * formatRelativeTime(30000) // "Just now" (< 1 min)
     * formatRelativeTime(300000) // "5m" (5 minutes)
     * formatRelativeTime(7200000) // "2h 0m" (2 hours)
     * formatRelativeTime(93600000) // "1d 2h" (26 hours)
     * formatRelativeTime(864000000) // "10d" (10 days)
     * formatRelativeTime(2678400000) // "30+ days" (31 days)
     */
    function formatRelativeTime(ageMs) {
        const minutes = Math.floor(ageMs / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        // Edge cases
        if (minutes < 1) return 'Just now';
        if (days > 30) return '30+ days';

        // Format based on age
        if (days > 7) return `${days}d`;
        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        return `${minutes}m`;
    }

    /**
     * Format numbers for networth display with decimal precision
     * Uses 2 decimal places for better readability in detailed breakdowns
     * @param {number} num - The number to format
     * @returns {string} Formatted number (e.g., "1.23K", "45.67M", "89.01B")
     *
     * @example
     * networthFormatter(1234) // "1.23K"
     * networthFormatter(45678) // "45.68K"
     * networthFormatter(1234567) // "1.23M"
     * networthFormatter(89012345) // "89.01M"
     * networthFormatter(1234567890) // "1.23B"
     */
    function networthFormatter(num) {
        if (num === null || num === undefined) {
            return null;
        }

        const absNum = Math.abs(num);
        const sign = num < 0 ? '-' : '';

        // 0-999: raw number (no decimals needed)
        if (absNum < 1000) {
            return sign + Math.floor(absNum).toString();
        }
        // 1,000-999,999: K with 2 decimals
        if (absNum < 1000000) {
            return sign + (absNum / 1000).toFixed(2) + 'K';
        }
        // 1M-999,999,999: M with 2 decimals
        if (absNum < 1000000000) {
            return sign + (absNum / 1000000).toFixed(2) + 'M';
        }
        // 1B+: B with 2 decimals
        return sign + (absNum / 1000000000).toFixed(2) + 'B';
    }

    /**
     * Format a decimal value as a percentage
     * @param {number} value - The decimal value to format (e.g., 0.05 for 5%)
     * @param {number} decimals - Number of decimal places (default: 1)
     * @returns {string} Formatted percentage (e.g., "5.0%", "12.5%")
     *
     * @example
     * formatPercentage(0.05) // "5.0%"
     * formatPercentage(0.125, 1) // "12.5%"
     * formatPercentage(0.00123, 2) // "0.12%"
     * formatPercentage(0.00123, 3) // "0.123%"
     */
    function formatPercentage(value, decimals = 1) {
        if (value === null || value === undefined) {
            return null;
        }

        const percentage = value * 100;
        const formatted = new Intl.NumberFormat(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        }).format(percentage);

        return formatted + '%';
    }

    /**
     * Format currency/coin amounts intelligently based on context
     * @param {number} amount - The amount to format
     * @param {Object} options - Formatting options
     * @param {string} options.style - 'game' (4-digit), 'compact' (K/M/B), 'full' (thousand separators), 'networth' (2 decimals)
     * @param {number} options.decimals - Decimal places for compact style (default: 1)
     * @returns {string} Formatted currency string
     *
     * @example
     * formatCurrency(1500, {style: 'game'}) // "1,500"
     * formatCurrency(1500000, {style: 'game'}) // "1,500K"
     * formatCurrency(1500000, {style: 'compact'}) // "1.5M"
     * formatCurrency(1500000, {style: 'full'}) // "1,500,000"
     * formatCurrency(1234, {style: 'networth'}) // "1.23K"
     */
    function formatCurrency(amount, options = {}) {
        const style = options.style || 'game';
        const decimals = options.decimals !== undefined ? options.decimals : 1;

        switch (style) {
            case 'game':
                return coinFormatter(amount);
            case 'compact':
                return formatKMB(amount, decimals);
            case 'networth':
                return networthFormatter(amount);
            case 'full':
                return formatWithSeparator(amount);
            default:
                return coinFormatter(amount);
        }
    }

    /**
     * Format numbers in compact notation (K/M/B)
     * Alias for formatKMB for clearer naming
     * @param {number} value - The number to format
     * @param {number} decimals - Number of decimal places (default: 1)
     * @returns {string} Formatted number (e.g., "1.5K", "2.3M", "1.2B")
     *
     * @example
     * formatCompactNumber(1500) // "1.5K"
     * formatCompactNumber(2300000) // "2.3M"
     * formatCompactNumber(1234567890) // "1.2B"
     */
    function formatCompactNumber(value, decimals = 1) {
        return formatKMB(value, decimals);
    }

    /**
     * Format large numbers with threshold-based abbreviation.
     * Keeps full comma-separated digits until the number exceeds 4 display digits,
     * then abbreviates with the configured precision.
     * @param {number} num - The number to format
     * @param {number} decimals - Number of decimal places (default: user setting)
     * @returns {string} Formatted number (e.g., "9,999" or "10.0K" or "1.25M")
     *
     * @example
     * formatThreshold(9999, 2) // "9,999"
     * formatThreshold(10000, 2) // "10.00K"
     * formatThreshold(1250000, 2) // "1.25M"
     */
    function formatThreshold(num, decimals = 1) {
        if (num === null || num === undefined) {
            return null;
        }

        const absNum = Math.abs(num);
        const sign = num < 0 ? '-' : '';

        if (absNum < 10000) {
            return sign + new Intl.NumberFormat().format(Math.round(absNum));
        }

        return sign + _abbreviate(absNum, decimals);
    }

    /**
     * Internal: abbreviate a positive number with K/M/B suffix.
     * @private
     */
    function _abbreviate(absNum, decimals) {
        if (absNum >= 1e9) {
            return (absNum / 1e9).toFixed(decimals) + 'B';
        } else if (absNum >= 1e6) {
            return (absNum / 1e6).toFixed(decimals) + 'M';
        } else if (absNum >= 1e3) {
            return (absNum / 1e3).toFixed(decimals) + 'K';
        }
        return absNum.toFixed(0);
    }

    /**
     * Format large numbers based on user preference
     * Dispatches to full, threshold, or compact format based on settings
     * @param {number} value - The number to format
     * @param {number} [decimals] - Override decimal places (if omitted, uses user setting)
     * @returns {string} Formatted number
     *
     * @example
     * // compact mode, precision 2: formatLargeNumber(1500000) → "1.50M"
     * // threshold mode, precision 2: formatLargeNumber(9999) → "9,999", formatLargeNumber(10000) → "10.00K"
     * // full mode: formatLargeNumber(1500000) → "1,500,000"
     */
    function formatLargeNumber(value, decimals) {
        const mode = config.getSettingValue('formatting_useKMBFormat', 'compact');

        if (mode === 'full' || mode === false) {
            return formatWithSeparator(value);
        }

        const precision = decimals !== undefined ? decimals : Number(config.getSettingValue('formatting_precision', '2'));

        if (mode === 'threshold') {
            return formatThreshold(value, precision);
        }

        return formatKMB(value, precision);
    }

    /**
     * Format a Date using the user's date/time format settings.
     * @param {Date} date - The date to format
     * @param {Object} [options]
     * @param {boolean} [options.includeDate=true] - Include the date portion (MM-DD or DD-MM)
     * @param {boolean} [options.includeTime=true] - Include the time portion
     * @param {boolean} [options.includeSeconds=true] - Include seconds in time
     * @returns {string}
     */
    function formatDateTime(date, options = {}) {
        const { includeDate = true, includeTime = true, includeSeconds = true, includeYear = false } = options;
        const use24h = config.getSettingValue('market_listingTimeFormat', '24hour') === '24hour';
        const dateFormat = config.getSettingValue('market_listingDateFormat', 'MM-DD');

        const parts = [];

        if (includeDate) {
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            let datePart = dateFormat === 'DD-MM' ? `${day}-${month}` : `${month}-${day}`;
            if (includeYear) datePart += `-${String(date.getFullYear()).slice(-2)}`;
            parts.push(datePart);
        }

        if (includeTime) {
            const timeOpts = { hour: 'numeric', minute: '2-digit', hour12: !use24h };
            if (includeSeconds) timeOpts.second = '2-digit';
            parts.push(date.toLocaleString('en-US', timeOpts).trim());
        }

        return parts.join(' ');
    }

    var formatters = /*#__PURE__*/Object.freeze({
        __proto__: null,
        coinFormatter: coinFormatter,
        formatCompactNumber: formatCompactNumber,
        formatCurrency: formatCurrency,
        formatDateTime: formatDateTime,
        formatKMB: formatKMB,
        formatKMB3Digits: formatKMB3Digits,
        formatLargeNumber: formatLargeNumber,
        formatPercentage: formatPercentage,
        formatRelativeTime: formatRelativeTime,
        formatThreshold: formatThreshold,
        formatWithSeparator: formatWithSeparator,
        isAbbreviationEnabled: isAbbreviationEnabled,
        networthFormatter: networthFormatter,
        numberFormatter: numberFormatter,
        timeReadable: timeReadable
    });

    /**
     * Loadout Snapshot
     *
     * Listens for `loadouts_updated` WebSocket messages to capture all loadout configurations
     * (equipment, abilities, consumables, enhancement levels) in real time.
     *
     * Stored snapshots are used by profit calculators to apply the correct tool/equipment
     * bonuses for a skill even when that loadout is not currently equipped.
     *
     * Skill matching: the loadout's actionTypeHrid (e.g. "/action_types/brewing") is compared
     * to the action type of the profit calculation. An "All Skills" loadout (empty actionTypeHrid)
     * is used as a fallback when no skill-specific snapshot is found.
     *
     * Priority: skill default > all skills default > skill non-default > all skills non-default
     */


    const STORAGE_KEY_PREFIX = 'loadout_snapshots';

    /**
     * Returns the active WebSocket hook instance.
     * In the multi-bundle production build each library bundles its own copy of websocket.js,
     * but only the Core library's instance has install() called on it.
     * Prefer window.Cheezasha.Core.webSocketHook so listeners actually receive messages.
     * Falls back to the bundled copy for the dev standalone build (single bundle, one instance).
     */
    function getWebSocketHook() {
        return (typeof window !== 'undefined' && window.Cheezasha?.Core?.webSocketHook) || webSocketHook;
    }

    /**
     * Get character-scoped storage key.
     * @returns {string}
     */
    function getStorageKey() {
        const charId = dataManager.getCurrentCharacterId() || 'default';
        return `${STORAGE_KEY_PREFIX}_${charId}`;
    }

    /**
     * Parse a wearable hash string into itemLocationHrid, itemHrid, and enhancementLevel.
     * Format: "characterId::/item_locations/location::/items/item_hrid::enhancementLevel"
     * Empty string means no item in that slot.
     * @param {string} itemLocationHrid - The equipment slot key (e.g. "/item_locations/body")
     * @param {string} wearableHash - The wearable hash value
     * @returns {{ itemLocationHrid: string, itemHrid: string, enhancementLevel: number }|null}
     */
    function parseWearable(itemLocationHrid, wearableHash) {
        if (!wearableHash) return null;

        const parts = wearableHash.split('::');
        const itemHrid = parts.find((p) => p.startsWith('/items/'));
        if (!itemHrid) return null;

        const lastPart = parts[parts.length - 1];
        const enhancementLevel = !lastPart.startsWith('/') ? parseInt(lastPart, 10) || 0 : 0;

        return { itemLocationHrid, itemHrid, enhancementLevel };
    }

    /**
     * Convert a server loadout object into our snapshot format.
     * @param {Object} loadout - A loadout entry from characterLoadoutMap
     * @returns {Object} snapshot
     */
    function buildSnapshot(loadout) {
        // Parse equipment from wearableMap
        const equipment = [];
        for (const [locationHrid, hash] of Object.entries(loadout.wearableMap || {})) {
            const parsed = parseWearable(locationHrid, hash);
            if (parsed) equipment.push(parsed);
        }

        // Parse drinks
        const drinks = (loadout.drinkItemHrids || []).map((hrid) => ({
            itemHrid: hrid || '',
        }));

        // Parse food
        const food = (loadout.foodItemHrids || []).map((hrid) => ({
            itemHrid: hrid || '',
        }));

        // Parse abilities
        const abilities = [];
        for (const [slot, hrid] of Object.entries(loadout.abilityMap || {})) {
            if (hrid) abilities.push({ abilityHrid: hrid, slot: parseInt(slot, 10) });
        }

        return {
            name: loadout.name,
            actionTypeHrid: loadout.actionTypeHrid || '',
            isDefault: !!loadout.isDefault,
            useExactEnhancement: loadout.useExactEnhancement ?? false,
            ordinal: loadout.ordinal || 0,
            equipment,
            abilities,
            food,
            drinks,
            abilityCombatTriggersMap: loadout.abilityCombatTriggersMap || {},
            consumableCombatTriggersMap: loadout.consumableCombatTriggersMap || {},
            savedAt: Date.now(),
        };
    }

    class LoadoutSnapshot {
        constructor() {
            this.snapshots = {}; // In-memory cache: { [loadoutName]: snapshot }
            this.characterInitializedHandler = null;
            this.updateListeners = [];
            this.isInitialized = false;

            // Register WebSocket handler at module load time so in-session loadout
            // changes are captured whenever loadouts_updated fires.
            this.loadoutsUpdatedHandler = (data) => this._onLoadoutsUpdated(data);
            getWebSocketHook().on('loadouts_updated', this.loadoutsUpdatedHandler);
        }

        /**
         * Register a callback to be called whenever snapshots are updated.
         * @param {Function} fn
         */
        onUpdate(fn) {
            this.updateListeners.push(fn);
        }

        /**
         * Remove a previously registered update callback.
         * @param {Function} fn
         */
        offUpdate(fn) {
            this.updateListeners = this.updateListeners.filter((l) => l !== fn);
        }

        _emitUpdate() {
            this.updateListeners.forEach((fn) => fn());
        }

        async initialize() {
            if (this.isInitialized) return;
            this.isInitialized = true;

            // Re-register WS handler if it was cleared by disable()
            if (!this.loadoutsUpdatedHandler) {
                this.loadoutsUpdatedHandler = (data) => this._onLoadoutsUpdated(data);
                getWebSocketHook().on('loadouts_updated', this.loadoutsUpdatedHandler);
            }

            // Load from storage — loadouts_updated only fires when the user visits the loadouts
            // UI, so storage is always the source of snapshots at startup.
            if (Object.keys(this.snapshots).length === 0) {
                const storageKey = getStorageKey();
                // NOTE: getCurrentCharacterId() may be null at this point (before init_character_data
                // arrives), so getStorageKey() may return 'loadout_snapshots_default'. We will reload
                // from the correct key once character_initialized fires.
                this.snapshots = (await storage.getJSON(storageKey, 'settings', null)) || {};

                // Fallback for Steam users: if storage is also empty, bootstrap from
                // the characterLoadoutMap embedded in init_character_data (already in dataManager).
                if (Object.keys(this.snapshots).length === 0) {
                    const characterLoadoutMap = dataManager.characterData?.characterLoadoutMap;
                    if (characterLoadoutMap && Object.keys(characterLoadoutMap).length > 0) {
                        this._onLoadoutsUpdated({ characterLoadoutMap });
                    }
                }
            }

            // Reload from the correct character-scoped key once character data is available
            this.characterInitializedHandler = async () => {
                const storageKey = getStorageKey();
                const fresh = (await storage.getJSON(storageKey, 'settings', null)) || {};
                if (Object.keys(fresh).length > 0) {
                    this.snapshots = fresh;
                    this._emitUpdate();
                }
            };
            dataManager.on('character_initialized', this.characterInitializedHandler);
        }

        /**
         * Handle a loadouts_updated WebSocket message.
         * Replaces all snapshots with the server's current state.
         * @param {Object} data - The WebSocket message payload
         */
        _onLoadoutsUpdated(data) {
            const loadoutMap = data.characterLoadoutMap;
            if (!loadoutMap) {
                console.warn('[LoadoutSnapshot] loadouts_updated received but no characterLoadoutMap');
                return;
            }

            const newSnapshots = {};
            for (const [id, loadout] of Object.entries(loadoutMap)) {
                if (!loadout.name) continue;
                newSnapshots[id] = buildSnapshot(loadout);
            }

            this.snapshots = newSnapshots;
            storage.setJSON(getStorageKey(), this.snapshots, 'settings');
            this._emitUpdate();
        }

        /**
         * Update a snapshot equipment item's enhancement level.
         * Used when the highest owned enhancement of a loadout item changes (up or down).
         * @param {string} itemHrid - Base item HRID (e.g. "/items/sword")
         * @param {number} newLevel - New enhancement level (highest currently owned)
         * @returns {boolean} True if any snapshot was updated
         */
        updateEnhancementLevel(itemHrid, newLevel) {
            let changed = false;
            for (const snapshot of Object.values(this.snapshots)) {
                // Exact-mode snapshots intentionally hold a frozen level — never auto-update them.
                if (snapshot.useExactEnhancement) continue;
                for (const eq of snapshot.equipment || []) {
                    if (eq.itemHrid === itemHrid && eq.enhancementLevel !== newLevel) {
                        eq.enhancementLevel = newLevel;
                        snapshot.savedAt = Date.now();
                        changed = true;
                    }
                }
            }
            if (changed) {
                storage.setJSON(getStorageKey(), this.snapshots, 'settings');
                this._emitUpdate();
            }
            return changed;
        }

        /**
         * Find the best snapshot for a given action type.
         * Priority: skill default > all skills default > skill non-default > all skills non-default
         * @param {string} actionTypeHrid - e.g. "/action_types/brewing"
         * @returns {Object|null} snapshot entry or null
         */
        _findSnapshot(actionTypeHrid) {
            if (!config.getSetting('loadoutSnapshot')) return null;

            let skillDefault = null;
            let allSkillsDefault = null;
            let skillNonDefault = null;
            let allSkillsNonDefault = null;

            for (const snapshot of Object.values(this.snapshots)) {
                if (snapshot.actionTypeHrid === actionTypeHrid) {
                    if (snapshot.isDefault) {
                        skillDefault = snapshot;
                    } else {
                        skillNonDefault = snapshot;
                    }
                } else if (snapshot.actionTypeHrid === '') {
                    if (snapshot.isDefault) {
                        allSkillsDefault = snapshot;
                    } else {
                        allSkillsNonDefault = snapshot;
                    }
                }
            }

            return skillDefault || allSkillsDefault || skillNonDefault || allSkillsNonDefault || null;
        }

        /**
         * Get a Map<itemLocationHrid, item> for the best loadout snapshot matching the given
         * action type. Returns null if no snapshot exists or the feature is disabled.
         * The returned Map has the same format as dataManager.getEquipment().
         * @param {string} actionTypeHrid
         * @returns {Map<string, Object>|null}
         */
        getSnapshotForSkill(actionTypeHrid) {
            const snapshot = this._findSnapshot(actionTypeHrid);
            if (!snapshot || !snapshot.equipment?.length) return null;
            return new Map(snapshot.equipment.map((e) => [e.itemLocationHrid, e]));
        }

        /**
         * Get the drink slots array for the best loadout snapshot matching the given
         * action type. Returns null if no snapshot exists or the feature is disabled.
         * The returned array has the same format as dataManager.getActionDrinkSlots().
         * @param {string} actionTypeHrid
         * @returns {Array<{itemHrid: string}>|null}
         */
        getSnapshotDrinksForSkill(actionTypeHrid) {
            const snapshot = this._findSnapshot(actionTypeHrid);
            if (!snapshot) return null;
            // Filter out empty slots so callers get only actual items
            const filled = (snapshot.drinks || []).filter((d) => d.itemHrid);
            return filled.length > 0 ? filled : null;
        }

        /**
         * Get all saved loadout snapshots as a flat array.
         * @returns {Array<Object>} Array of snapshot objects
         */
        getAllSnapshots() {
            return Object.values(this.snapshots).sort((a, b) => a.ordinal - b.ordinal);
        }

        /**
         * Get the name and default status of the saved loadout being used for a given action type.
         * Returns an object with name and isDefault, or null if no snapshot exists or feature is disabled.
         * @param {string} actionTypeHrid
         * @returns {{ name: string, isDefault: boolean }|null}
         */
        getSnapshotInfoForSkill(actionTypeHrid) {
            const snapshot = this._findSnapshot(actionTypeHrid);
            if (!snapshot) return null;
            return { name: snapshot.name, isDefault: !!snapshot.isDefault };
        }

        disable() {
            if (this.loadoutsUpdatedHandler) {
                getWebSocketHook().off('loadouts_updated', this.loadoutsUpdatedHandler);
                this.loadoutsUpdatedHandler = null;
            }

            if (this.characterInitializedHandler) {
                dataManager.off('character_initialized', this.characterInitializedHandler);
                this.characterInitializedHandler = null;
            }

            this.updateListeners = [];
            this.isInitialized = false;
        }
    }

    const loadoutSnapshot = new LoadoutSnapshot();

    /**
     * Action context resolver
     *
     * Returns the equipment and active drinks to use when predicting an action's
     * outcome (XP, time, profit, materials). When the loadoutSnapshot feature is
     * enabled and a saved loadout matches the action type, that snapshot is used
     * — so predictions reflect the gear the user would auto-equip rather than
     * whatever happens to be on their character right now.
     *
     * Resolution priority (handled inside loadoutSnapshot._findSnapshot):
     *   1. Skill-specific default loadout
     *   2. All-skills default loadout
     *   3. Skill-specific non-default
     *   4. All-skills non-default
     *   5. Fall back to currently-equipped gear / current drinks
     *
     * Equipment and drinks are resolved independently — it's valid to inherit the
     * snapshot's equipment while no snapshot drinks exist, in which case the
     * current drinks are used (and vice-versa).
     */


    /**
     * @param {string} actionTypeHrid - e.g. "/action_types/cooking"
     * @returns {{equipment: Map, drinks: Array}}
     */
    function resolveActionContext(actionTypeHrid) {
        const rawDrinks =
            loadoutSnapshot.getSnapshotDrinksForSkill(actionTypeHrid) ?? dataManager.getActionDrinkSlots(actionTypeHrid);

        // Only include drinks that are actually in stock — slotted-but-empty teas give no buff
        const inventory = dataManager.getInventory();
        const drinks = (rawDrinks || []).filter(
            (d) => d?.itemHrid && inventory.some((i) => i.itemHrid === d.itemHrid && (i.count || 0) > 0)
        );

        return {
            equipment: loadoutSnapshot.getSnapshotForSkill(actionTypeHrid) ?? dataManager.getEquipment(),
            drinks,
        };
    }

    /**
     * Equipment Parser Utility
     * Parses equipment bonuses for action calculations
     *
     * PART OF EFFICIENCY SYSTEM (Phase 1 of 3):
     * - Phase 1 ✅: Equipment speed bonuses (this module) + level advantage
     * - Phase 2 ✅: Community buffs + house rooms (WebSocket integration)
     * - Phase 3 ✅: Consumable buffs (tea parser integration)
     *
     * Speed bonuses are MULTIPLICATIVE with time (reduce duration).
     * Efficiency bonuses are ADDITIVE with each other, then MULTIPLICATIVE with time.
     *
     * Formula: actionTime = baseTime / (1 + totalEfficiency + totalSpeed)
     */

    /**
     * Map action type HRID to equipment field name
     * @param {string} actionTypeHrid - Action type HRID (e.g., "/action_types/cheesesmithing")
     * @param {string} suffix - Field suffix (e.g., "Speed", "Efficiency", "RareFind")
     * @param {Array<string>} validFields - Array of valid field names
     * @returns {string|null} Field name (e.g., "cheesesmithingSpeed") or null
     */
    function getFieldForActionType(actionTypeHrid, suffix, validFields) {
        if (!actionTypeHrid) {
            return null;
        }

        // Extract skill name from action type HRID
        // e.g., "/action_types/cheesesmithing" -> "cheesesmithing"
        const skillName = actionTypeHrid.replace('/action_types/', '');

        // Map to field name with suffix
        // e.g., "cheesesmithing" + "Speed" -> "cheesesmithingSpeed"
        const fieldName = skillName + suffix;

        return validFields.includes(fieldName) ? fieldName : null;
    }

    /**
     * Enhancement percentage table (based on game mechanics)
     * Each enhancement level provides a percentage boost to base stats
     */
    const ENHANCEMENT_PERCENTAGES = {
        0: 0.0,
        1: 0.02, // 2.0%
        2: 0.042, // 4.2%
        3: 0.066, // 6.6%
        4: 0.092, // 9.2%
        5: 0.12, // 12.0%
        6: 0.15, // 15.0%
        7: 0.182, // 18.2%
        8: 0.216, // 21.6%
        9: 0.252, // 25.2%
        10: 0.29, // 29.0%
        11: 0.334, // 33.4%
        12: 0.384, // 38.4%
        13: 0.44, // 44.0%
        14: 0.502, // 50.2%
        15: 0.57, // 57.0%
        16: 0.644, // 64.4%
        17: 0.724, // 72.4%
        18: 0.81, // 81.0%
        19: 0.902, // 90.2%
        20: 1.0, // 100.0%
    };

    /**
     * Slot multipliers for enhancement bonuses
     * Accessories get 5× bonus, weapons/armor get 1× bonus
     * Keys use item_locations (not equipment_types) to match characterEquipment map keys
     */
    const SLOT_MULTIPLIERS = {
        '/item_locations/neck': 5, // Necklace
        '/item_locations/ring': 5, // Ring
        '/item_locations/earrings': 5, // Earrings
        '/item_locations/back': 5, // Back/Cape
        '/item_locations/trinket': 5, // Trinket
        '/item_locations/charm': 5, // Charm
        '/item_locations/main_hand': 1, // Main hand weapon
        '/item_locations/two_hand': 1, // Two-handed weapon
        '/item_locations/off_hand': 1, // Off-hand/shield
        '/item_locations/head': 1, // Head armor
        '/item_locations/body': 1, // Body armor
        '/item_locations/legs': 1, // Leg armor
        '/item_locations/hands': 1, // Hand armor
        '/item_locations/feet': 1, // Feet armor
        '/item_locations/pouch': 1, // Pouch
    };

    /**
     * Calculate enhancement scaling for equipment stats
     * Uses percentage-based enhancement system with slot multipliers
     *
     * Formula: base × (1 + enhancementPercentage × slotMultiplier)
     *
     * @param {number} baseValue - Base stat value from item data
     * @param {number} enhancementLevel - Enhancement level (0-20)
     * @param {string} slotHrid - Equipment slot HRID (e.g., "/equipment_types/neck")
     * @returns {number} Scaled stat value
     *
     * @example
     * // Philosopher's Necklace +4 (4% base speed, neck slot 5×)
     * calculateEnhancementScaling(0.04, 4, '/equipment_types/neck')
     * // = 0.04 × (1 + 0.092 × 5) = 0.04 × 1.46 = 0.0584 (5.84%)
     *
     * // Lumberjack's Top +10 (10% base efficiency, body slot 1×)
     * calculateEnhancementScaling(0.10, 10, '/equipment_types/body')
     * // = 0.10 × (1 + 0.290 × 1) = 0.10 × 1.29 = 0.129 (12.9%)
     */
    function calculateEnhancementScaling(baseValue, enhancementLevel, slotHrid) {
        if (enhancementLevel === 0) {
            return baseValue;
        }

        // Get enhancement percentage from table
        const enhancementPercentage = ENHANCEMENT_PERCENTAGES[enhancementLevel] || 0;

        // Get slot multiplier (default to 1× if slot not found)
        const slotMultiplier = SLOT_MULTIPLIERS[slotHrid] || 1;

        // Apply formula: base × (1 + percentage × multiplier)
        return baseValue * (1 + enhancementPercentage * slotMultiplier);
    }

    /**
     * Generic equipment stat parser - handles all noncombat stats with consistent logic
     * @param {Map} characterEquipment - Equipment map from dataManager.getEquipment()
     * @param {Object} itemDetailMap - Item details from init_client_data
     * @param {Object} config - Parser configuration
     * @param {string|null} config.skillSpecificField - Skill-specific field (e.g., "brewingSpeed")
     * @param {string|null} config.genericField - Generic skilling field (e.g., "skillingSpeed")
     * @param {boolean} config.returnAsPercentage - Whether to convert to percentage (multiply by 100)
     * @returns {number} Total stat bonus
     *
     * @example
     * // Parse speed bonuses for brewing
     * parseEquipmentStat(equipment, items, {
     *   skillSpecificField: "brewingSpeed",
     *   genericField: "skillingSpeed",
     *   returnAsPercentage: false
     * })
     */
    function parseEquipmentStat(characterEquipment, itemDetailMap, config) {
        if (!characterEquipment || characterEquipment.size === 0) {
            return 0; // No equipment
        }

        if (!itemDetailMap) {
            return 0; // Missing item data
        }

        const { skillSpecificField, genericField, returnAsPercentage } = config;

        let totalBonus = 0;

        // Iterate through all equipped items
        for (const [slotHrid, equippedItem] of characterEquipment) {
            // Get item details from game data
            const itemDetails = itemDetailMap[equippedItem.itemHrid];

            if (!itemDetails || !itemDetails.equipmentDetail) {
                continue; // Not an equipment item
            }

            // Check if item has noncombat stats
            const noncombatStats = itemDetails.equipmentDetail.noncombatStats;

            if (!noncombatStats) {
                continue; // No noncombat stats
            }

            // Get enhancement level from equipped item
            const enhancementLevel = equippedItem.enhancementLevel || 0;

            // Check for skill-specific stat (e.g., brewingSpeed, brewingEfficiency, brewingRareFind)
            if (skillSpecificField) {
                const baseValue = noncombatStats[skillSpecificField];

                if (baseValue && baseValue > 0) {
                    const scaledValue = calculateEnhancementScaling(baseValue, enhancementLevel, slotHrid);
                    totalBonus += scaledValue;
                }
            }

            // Check for generic skilling stat (e.g., skillingSpeed, skillingEfficiency, skillingRareFind, skillingEssenceFind)
            if (genericField) {
                const baseValue = noncombatStats[genericField];

                if (baseValue && baseValue > 0) {
                    const scaledValue = calculateEnhancementScaling(baseValue, enhancementLevel, slotHrid);
                    totalBonus += scaledValue;
                }
            }
        }

        // Convert to percentage if requested (0.15 -> 15%)
        return returnAsPercentage ? totalBonus * 100 : totalBonus;
    }

    /**
     * Valid speed fields from game data
     */
    const VALID_SPEED_FIELDS = [
        'milkingSpeed',
        'foragingSpeed',
        'woodcuttingSpeed',
        'cheesesmithingSpeed',
        'craftingSpeed',
        'tailoringSpeed',
        'brewingSpeed',
        'cookingSpeed',
        'alchemySpeed',
        'enhancingSpeed',
        'taskSpeed',
    ];

    /**
     * Parse equipment speed bonuses for a specific action type
     * @param {Map} characterEquipment - Equipment map from dataManager.getEquipment()
     * @param {string} actionTypeHrid - Action type HRID
     * @param {Object} itemDetailMap - Item details from init_client_data
     * @returns {number} Total speed bonus as decimal (e.g., 0.15 for 15%)
     *
     * @example
     * parseEquipmentSpeedBonuses(equipment, "/action_types/brewing", items)
     * // Cheese Pot (base 0.15, bonus 0.003) +0: 0.15 (15%)
     * // Cheese Pot (base 0.15, bonus 0.003) +10: 0.18 (18%)
     * // Azure Pot (base 0.3, bonus 0.006) +10: 0.36 (36%)
     */
    function parseEquipmentSpeedBonuses(characterEquipment, actionTypeHrid, itemDetailMap) {
        const skillSpecificField = getFieldForActionType(actionTypeHrid, 'Speed', VALID_SPEED_FIELDS);

        return parseEquipmentStat(characterEquipment, itemDetailMap, {
            skillSpecificField,
            genericField: 'skillingSpeed',
            returnAsPercentage: false,
        });
    }

    /**
     * Valid efficiency fields from game data
     */
    const VALID_EFFICIENCY_FIELDS = [
        'milkingEfficiency',
        'foragingEfficiency',
        'woodcuttingEfficiency',
        'cheesesmithingEfficiency',
        'craftingEfficiency',
        'tailoringEfficiency',
        'brewingEfficiency',
        'cookingEfficiency',
        'alchemyEfficiency',
    ];

    /**
     * Parse equipment efficiency bonuses for a specific action type
     * @param {Map} characterEquipment - Equipment map from dataManager.getEquipment()
     * @param {string} actionTypeHrid - Action type HRID
     * @param {Object} itemDetailMap - Item details from init_client_data
     * @returns {number} Total efficiency bonus as percentage (e.g., 12 for 12%)
     *
     * @example
     * parseEquipmentEfficiencyBonuses(equipment, "/action_types/brewing", items)
     * // Brewer's Top (base 0.1, bonus 0.002) +0: 10%
     * // Brewer's Top (base 0.1, bonus 0.002) +10: 12%
     * // Philosopher's Necklace (skillingEfficiency 0.02, bonus 0.002) +10: 4%
     * // Total: 16%
     */
    function parseEquipmentEfficiencyBonuses(characterEquipment, actionTypeHrid, itemDetailMap) {
        const skillSpecificField = getFieldForActionType(actionTypeHrid, 'Efficiency', VALID_EFFICIENCY_FIELDS);

        return parseEquipmentStat(characterEquipment, itemDetailMap, {
            skillSpecificField,
            genericField: 'skillingEfficiency',
            returnAsPercentage: true,
        });
    }

    /**
     * Parse Essence Find bonus from equipment
     * @param {Map} characterEquipment - Equipment map from dataManager.getEquipment()
     * @param {Object} itemDetailMap - Item details from init_client_data
     * @returns {number} Total essence find bonus as percentage (e.g., 15 for 15%)
     *
     * @example
     * parseEssenceFindBonus(equipment, items)
     * // Ring of Essence Find (base 0.15, bonus 0.015) +0: 15%
     * // Ring of Essence Find (base 0.15, bonus 0.015) +10: 30%
     */
    function parseEssenceFindBonus(characterEquipment, itemDetailMap) {
        return parseEquipmentStat(characterEquipment, itemDetailMap, {
            skillSpecificField: null, // No skill-specific essence find
            genericField: 'skillingEssenceFind',
            returnAsPercentage: true,
        });
    }

    /**
     * Get total gathering quantity bonus from equipment.
     * @param {Map} characterEquipment - Equipment map
     * @param {Object} itemDetailMap - Item details
     * @returns {number} Total gathering quantity bonus (decimal, e.g. 0.02)
     */
    function parseGatheringQuantityBonus(characterEquipment, itemDetailMap) {
        return parseEquipmentStat(characterEquipment, itemDetailMap, {
            skillSpecificField: null,
            genericField: 'gatheringQuantity',
            returnAsPercentage: false,
        });
    }

    /**
     * Valid rare find fields from game data
     */
    const VALID_RARE_FIND_FIELDS = [
        'milkingRareFind',
        'foragingRareFind',
        'woodcuttingRareFind',
        'cheesesmithingRareFind',
        'craftingRareFind',
        'tailoringRareFind',
        'brewingRareFind',
        'cookingRareFind',
        'alchemyRareFind',
        'enhancingRareFind',
    ];

    /**
     * Parse Rare Find bonus from equipment
     * @param {Map} characterEquipment - Equipment map from dataManager.getEquipment()
     * @param {string} actionTypeHrid - Action type HRID (for skill-specific rare find)
     * @param {Object} itemDetailMap - Item details from init_client_data
     * @returns {number} Total rare find bonus as percentage (e.g., 15 for 15%)
     *
     * @example
     * parseRareFindBonus(equipment, "/action_types/brewing", items)
     * // Brewer's Top (base 0.15, bonus 0.003) +0: 15%
     * // Brewer's Top (base 0.15, bonus 0.003) +10: 18%
     * // Earrings of Rare Find (base 0.08, bonus 0.002) +0: 8%
     * // Total: 26%
     */
    function parseRareFindBonus(characterEquipment, actionTypeHrid, itemDetailMap) {
        const skillSpecificField = getFieldForActionType(actionTypeHrid, 'RareFind', VALID_RARE_FIND_FIELDS);

        return parseEquipmentStat(characterEquipment, itemDetailMap, {
            skillSpecificField,
            genericField: 'skillingRareFind',
            returnAsPercentage: true,
        });
    }

    /**
     * Generic per-item equipment stat breakdown
     * @param {Map} characterEquipment - Equipment map
     * @param {Object} itemDetailMap - Item details
     * @param {string|null} skillSpecificField - e.g. "foragingEfficiency"
     * @param {string|null} genericField - e.g. "skillingEfficiency"
     * @param {boolean} returnAsPercentage - Multiply by 100
     * @returns {Array<{name, enhancementLevel, value}>}
     */
    function parseEquipmentStatBreakdown(
        characterEquipment,
        itemDetailMap,
        skillSpecificField,
        genericField,
        returnAsPercentage
    ) {
        if (!characterEquipment || characterEquipment.size === 0) return [];
        if (!itemDetailMap) return [];

        const items = [];

        for (const [slotHrid, equippedItem] of characterEquipment) {
            const itemDetails = itemDetailMap[equippedItem.itemHrid];
            if (!itemDetails?.equipmentDetail?.noncombatStats) continue;

            const noncombatStats = itemDetails.equipmentDetail.noncombatStats;
            const enhancementLevel = equippedItem.enhancementLevel || 0;
            let value = 0;

            if (skillSpecificField) {
                const base = noncombatStats[skillSpecificField];
                if (base > 0) value += calculateEnhancementScaling(base, enhancementLevel, slotHrid);
            }
            if (genericField) {
                const base = noncombatStats[genericField];
                if (base > 0) value += calculateEnhancementScaling(base, enhancementLevel, slotHrid);
            }

            if (value > 0) {
                items.push({
                    name: itemDetails.name,
                    enhancementLevel,
                    value: value * 100 ,
                });
            }
        }

        return items;
    }

    /**
     * Get per-item efficiency bonus breakdown for an action type
     * @param {Map} characterEquipment - Equipment map
     * @param {string} actionTypeHrid - Action type HRID
     * @param {Object} itemDetailMap - Item details
     * @returns {Array<{name, enhancementLevel, value}>}
     */
    function parseEquipmentEfficiencyBreakdown(characterEquipment, actionTypeHrid, itemDetailMap) {
        const skillSpecificField = getFieldForActionType(actionTypeHrid, 'Efficiency', VALID_EFFICIENCY_FIELDS);
        return parseEquipmentStatBreakdown(
            characterEquipment,
            itemDetailMap,
            skillSpecificField,
            'skillingEfficiency');
    }

    /**
     * Get per-item rare find bonus breakdown for an action type
     * @param {Map} characterEquipment - Equipment map
     * @param {string} actionTypeHrid - Action type HRID
     * @param {Object} itemDetailMap - Item details
     * @returns {Array<{name, enhancementLevel, value}>}
     */
    function parseRareFindBreakdown(characterEquipment, actionTypeHrid, itemDetailMap) {
        const skillSpecificField = getFieldForActionType(actionTypeHrid, 'RareFind', VALID_RARE_FIND_FIELDS);
        return parseEquipmentStatBreakdown(characterEquipment, itemDetailMap, skillSpecificField, 'skillingRareFind');
    }

    /**
     * Get all speed bonuses for debugging
     * @param {Map} characterEquipment - Equipment map
     * @param {Object} itemDetailMap - Item details
     * @returns {Array} Array of speed bonus objects
     */
    function debugEquipmentSpeedBonuses(characterEquipment, itemDetailMap) {
        if (!characterEquipment || characterEquipment.size === 0) {
            return [];
        }

        const bonuses = [];

        for (const [slotHrid, equippedItem] of characterEquipment) {
            const itemDetails = itemDetailMap[equippedItem.itemHrid];

            if (!itemDetails || !itemDetails.equipmentDetail) {
                continue;
            }

            const noncombatStats = itemDetails.equipmentDetail.noncombatStats;

            if (!noncombatStats) {
                continue;
            }

            // Find all speed bonuses on this item
            for (const [statName, value] of Object.entries(noncombatStats)) {
                if (statName.endsWith('Speed') && value > 0) {
                    const enhancementLevel = equippedItem.enhancementLevel || 0;
                    const scaledValue = calculateEnhancementScaling(value, enhancementLevel, slotHrid);

                    bonuses.push({
                        itemName: itemDetails.name,
                        itemHrid: equippedItem.itemHrid,
                        slot: slotHrid,
                        speedType: statName,
                        baseBonus: value,
                        enhancementLevel,
                        scaledBonus: scaledValue,
                    });
                }
            }
        }

        return bonuses;
    }

    var equipmentParser = /*#__PURE__*/Object.freeze({
        __proto__: null,
        debugEquipmentSpeedBonuses: debugEquipmentSpeedBonuses,
        parseEquipmentEfficiencyBonuses: parseEquipmentEfficiencyBonuses,
        parseEquipmentEfficiencyBreakdown: parseEquipmentEfficiencyBreakdown,
        parseEquipmentSpeedBonuses: parseEquipmentSpeedBonuses,
        parseEssenceFindBonus: parseEssenceFindBonus,
        parseGatheringQuantityBonus: parseGatheringQuantityBonus,
        parseRareFindBonus: parseRareFindBonus,
        parseRareFindBreakdown: parseRareFindBreakdown
    });

    /**
     * Enhancement Multiplier System
     *
     * Handles enhancement bonus calculations for equipment.
     * Different equipment slots have different multipliers:
     * - Accessories (neck/ring/earring), Back, Trinket, Charm: 5× multiplier
     * - All other slots (weapons, armor, pouch): 1× multiplier
     */

    /**
     * Enhancement multiplier by equipment slot type
     */
    const ENHANCEMENT_MULTIPLIERS = {
        '/equipment_types/neck': 5,
        '/equipment_types/ring': 5,
        '/equipment_types/earring': 5,
        '/equipment_types/back': 5,
        '/equipment_types/trinket': 5,
        '/equipment_types/charm': 5,
        // All other slots: 1× (default)
    };

    /**
     * Enhancement bonus table
     * Maps enhancement level to percentage bonus
     */
    const ENHANCEMENT_BONUSES = {
        1: 0.02,
        2: 0.042,
        3: 0.066,
        4: 0.092,
        5: 0.12,
        6: 0.15,
        7: 0.182,
        8: 0.216,
        9: 0.252,
        10: 0.29,
        11: 0.334,
        12: 0.384,
        13: 0.44,
        14: 0.502,
        15: 0.57,
        16: 0.644,
        17: 0.724,
        18: 0.81,
        19: 0.902,
        20: 1.0,
    };

    /**
     * Get enhancement multiplier for an item
     * @param {Object} itemDetails - Item details from itemDetailMap
     * @param {number} enhancementLevel - Current enhancement level of item
     * @returns {number} Multiplier to apply to bonuses
     */
    function getEnhancementMultiplier(itemDetails, enhancementLevel) {
        if (enhancementLevel === 0) {
            return 1;
        }

        const equipmentType = itemDetails?.equipmentDetail?.type;
        const slotMultiplier = ENHANCEMENT_MULTIPLIERS[equipmentType] || 1;
        const enhancementBonus = ENHANCEMENT_BONUSES[enhancementLevel] || 0;

        return 1 + enhancementBonus * slotMultiplier;
    }

    var enhancementMultipliers = /*#__PURE__*/Object.freeze({
        __proto__: null,
        ENHANCEMENT_BONUSES: ENHANCEMENT_BONUSES,
        ENHANCEMENT_MULTIPLIERS: ENHANCEMENT_MULTIPLIERS,
        getEnhancementMultiplier: getEnhancementMultiplier
    });

    /**
     * Tea Buff Parser Utility
     * Calculates efficiency bonuses from active tea buffs
     *
     * Tea efficiency comes from two buff types:
     * 1. /buff_types/efficiency - Generic efficiency (e.g., Efficiency Tea: 10%)
     * 2. /buff_types/{skill}_level - Skill level bonuses (e.g., Brewing Tea: +3 levels)
     *
     * All tea effects scale with Drink Concentration equipment stat.
     */


    /**
     * Generic tea buff parser - handles all tea buff types with consistent logic
     * @param {Array} activeDrinks - Array of active drink items from actionTypeDrinkSlotsMap
     * @param {Object} itemDetailMap - Item details from init_client_data
     * @param {number} drinkConcentration - Drink Concentration stat (as decimal, e.g., 0.12 for 12%)
     * @param {Object} config - Parser configuration
     * @param {Array<string>} config.buffTypeHrids - Buff type HRIDs to check (e.g., ['/buff_types/artisan'])
     * @returns {number} Total buff bonus
     *
     * @example
     * // Parse artisan bonus
     * parseTeaBuff(drinks, items, 0.12, { buffTypeHrids: ['/buff_types/artisan'] })
     */
    function parseTeaBuff(activeDrinks, itemDetailMap, drinkConcentration, config) {
        if (!activeDrinks || activeDrinks.length === 0) {
            return 0; // No active teas
        }

        if (!itemDetailMap) {
            return 0; // Missing required data
        }

        const { buffTypeHrids } = config;
        let totalBonus = 0;

        // Process each active tea/drink
        for (const drink of activeDrinks) {
            if (!drink || !drink.itemHrid) {
                continue; // Empty slot
            }

            const itemDetails = itemDetailMap[drink.itemHrid];
            if (!itemDetails || !itemDetails.consumableDetail || !itemDetails.consumableDetail.buffs) {
                continue; // Not a consumable or has no buffs
            }

            // Check each buff on this tea
            for (const buff of itemDetails.consumableDetail.buffs) {
                // Check if this buff matches any of the target types
                if (buffTypeHrids.includes(buff.typeHrid)) {
                    const baseValue = buff.flatBoost;
                    const scaledValue = baseValue * (1 + drinkConcentration);
                    totalBonus += scaledValue;
                }
            }
        }

        return totalBonus;
    }

    /**
     * Parse tea efficiency bonuses for a specific action type
     * @param {string} actionTypeHrid - Action type HRID (e.g., "/action_types/brewing")
     * @param {Array} activeDrinks - Array of active drink items from actionTypeDrinkSlotsMap
     * @param {Object} itemDetailMap - Item details from init_client_data
     * @param {number} drinkConcentration - Drink Concentration stat (as decimal, e.g., 0.12 for 12%)
     * @returns {number} Total tea efficiency bonus as percentage (e.g., 12 for 12%)
     *
     * @example
     * // With Efficiency Tea (10% base) and 12% Drink Concentration:
     * parseTeaEfficiency("/action_types/brewing", activeDrinks, items, 0.12)
     * // Returns: 11.2 (10% × 1.12 = 11.2%)
     */
    function parseTeaEfficiency(actionTypeHrid, activeDrinks, itemDetailMap, drinkConcentration = 0) {
        if (!activeDrinks || activeDrinks.length === 0) {
            return 0; // No active teas
        }

        if (!actionTypeHrid || !itemDetailMap) {
            return 0; // Missing required data
        }

        let totalEfficiency = 0;

        // Process each active tea/drink
        for (const drink of activeDrinks) {
            if (!drink || !drink.itemHrid) {
                continue; // Empty slot
            }

            const itemDetails = itemDetailMap[drink.itemHrid];
            if (!itemDetails || !itemDetails.consumableDetail || !itemDetails.consumableDetail.buffs) {
                continue; // Not a consumable or has no buffs
            }

            // Check each buff on this tea
            for (const buff of itemDetails.consumableDetail.buffs) {
                // Generic efficiency buff (e.g., Efficiency Tea)
                if (buff.typeHrid === '/buff_types/efficiency') {
                    const baseEfficiency = buff.flatBoost * 100; // Convert to percentage
                    const scaledEfficiency = baseEfficiency * (1 + drinkConcentration);
                    totalEfficiency += scaledEfficiency;
                }
                // Note: Skill-specific level buffs are NOT counted here
                // They affect Level Bonus calculation, not Tea Bonus
            }
        }

        return totalEfficiency;
    }

    /**
     * Parse tea efficiency bonuses with breakdown by individual tea
     * @param {string} actionTypeHrid - Action type HRID (e.g., "/action_types/brewing")
     * @param {Array} activeDrinks - Array of active drink items from actionTypeDrinkSlotsMap
     * @param {Object} itemDetailMap - Item details from init_client_data
     * @param {number} drinkConcentration - Drink Concentration stat (as decimal, e.g., 0.12 for 12%)
     * @returns {Array<{name: string, efficiency: number, baseEfficiency: number, dcContribution: number}>} Array of tea contributions
     *
     * @example
     * // With Efficiency Tea (10% base) and Ultra Cheesesmithing Tea (6% base) with 12% DC:
     * parseTeaEfficiencyBreakdown("/action_types/cheesesmithing", activeDrinks, items, 0.12)
     * // Returns: [
     * //   { name: "Efficiency Tea", efficiency: 11.2, baseEfficiency: 10.0, dcContribution: 1.2 },
     * //   { name: "Ultra Cheesesmithing Tea", efficiency: 6.72, baseEfficiency: 6.0, dcContribution: 0.72 }
     * // ]
     */
    function parseTeaEfficiencyBreakdown(actionTypeHrid, activeDrinks, itemDetailMap, drinkConcentration = 0) {
        if (!activeDrinks || activeDrinks.length === 0) {
            return []; // No active teas
        }

        if (!actionTypeHrid || !itemDetailMap) {
            return []; // Missing required data
        }

        const teaBreakdown = [];

        // Process each active tea/drink
        for (const drink of activeDrinks) {
            if (!drink || !drink.itemHrid) {
                continue; // Empty slot
            }

            const itemDetails = itemDetailMap[drink.itemHrid];
            if (!itemDetails || !itemDetails.consumableDetail || !itemDetails.consumableDetail.buffs) {
                continue; // Not a consumable or has no buffs
            }

            let baseEfficiency = 0;
            let totalEfficiency = 0;

            // Check each buff on this tea
            for (const buff of itemDetails.consumableDetail.buffs) {
                // Generic efficiency buff (e.g., Efficiency Tea)
                if (buff.typeHrid === '/buff_types/efficiency') {
                    const baseValue = buff.flatBoost * 100; // Convert to percentage
                    const scaledValue = baseValue * (1 + drinkConcentration);
                    baseEfficiency += baseValue;
                    totalEfficiency += scaledValue;
                }
                // Note: Skill-specific level buffs are NOT counted here
                // They affect Level Bonus calculation, not Tea Bonus
            }

            // Only add to breakdown if this tea contributes efficiency
            if (totalEfficiency > 0) {
                teaBreakdown.push({
                    name: itemDetails.name,
                    efficiency: totalEfficiency,
                    baseEfficiency: baseEfficiency,
                    dcContribution: totalEfficiency - baseEfficiency,
                });
            }
        }

        return teaBreakdown;
    }

    /**
     * Get Drink Concentration stat from equipped items
     * @param {Map} characterEquipment - Equipment map from dataManager.getEquipment()
     * @param {Object} itemDetailMap - Item details from init_client_data
     * @returns {number} Total drink concentration as decimal (e.g., 0.12 for 12%)
     *
     * @example
     * getDrinkConcentration(equipment, items)
     * // Returns: 0.12 (if wearing items with 12% total drink concentration)
     */
    function getDrinkConcentration(characterEquipment, itemDetailMap) {
        if (!characterEquipment || characterEquipment.size === 0) {
            return 0; // No equipment
        }

        if (!itemDetailMap) {
            return 0; // Missing item data
        }

        let totalDrinkConcentration = 0;

        // Iterate through all equipped items
        for (const [_slotHrid, equippedItem] of characterEquipment) {
            const itemDetails = itemDetailMap[equippedItem.itemHrid];

            if (!itemDetails || !itemDetails.equipmentDetail) {
                continue; // Not an equipment item
            }

            const noncombatStats = itemDetails.equipmentDetail.noncombatStats;
            if (!noncombatStats) {
                continue; // No noncombat stats
            }

            // Check for drink concentration stat
            const baseDrinkConcentration = noncombatStats.drinkConcentration;
            if (!baseDrinkConcentration || baseDrinkConcentration <= 0) {
                continue; // No drink concentration on this item
            }

            // Get enhancement level from equipped item
            const enhancementLevel = equippedItem.enhancementLevel || 0;

            // Calculate scaled drink concentration with enhancement
            // Uses enhancement multiplier table (e.g., +10 = 1.29× for 1× slots like pouch)
            const enhancementMultiplier = getEnhancementMultiplier(itemDetails, enhancementLevel);
            const scaledDrinkConcentration = baseDrinkConcentration * enhancementMultiplier;

            totalDrinkConcentration += scaledDrinkConcentration;
        }

        return totalDrinkConcentration;
    }

    /**
     * Parse Artisan bonus from active tea buffs
     * @param {Array} activeDrinks - Array of active drink items from actionTypeDrinkSlotsMap
     * @param {Object} itemDetailMap - Item details from init_client_data
     * @param {number} drinkConcentration - Drink Concentration stat (as decimal, e.g., 0.12 for 12%)
     * @returns {number} Artisan material reduction as decimal (e.g., 0.112 for 11.2% reduction)
     *
     * @example
     * // With Artisan Tea (10% base) and 12% Drink Concentration:
     * parseArtisanBonus(activeDrinks, items, 0.12)
     * // Returns: 0.112 (10% × 1.12 = 11.2% reduction)
     */
    function parseArtisanBonus(activeDrinks, itemDetailMap, drinkConcentration = 0) {
        return parseTeaBuff(activeDrinks, itemDetailMap, drinkConcentration, {
            buffTypeHrids: ['/buff_types/artisan'],
        });
    }

    /**
     * Parse Gourmet bonus from active tea buffs
     * @param {Array} activeDrinks - Array of active drink items from actionTypeDrinkSlotsMap
     * @param {Object} itemDetailMap - Item details from init_client_data
     * @param {number} drinkConcentration - Drink Concentration stat (as decimal, e.g., 0.12 for 12%)
     * @returns {number} Gourmet bonus chance as decimal (e.g., 0.1344 for 13.44% bonus items)
     *
     * @example
     * // With Gourmet Tea (12% base) and 12% Drink Concentration:
     * parseGourmetBonus(activeDrinks, items, 0.12)
     * // Returns: 0.1344 (12% × 1.12 = 13.44% bonus items)
     */
    function parseGourmetBonus(activeDrinks, itemDetailMap, drinkConcentration = 0) {
        return parseTeaBuff(activeDrinks, itemDetailMap, drinkConcentration, {
            buffTypeHrids: ['/buff_types/gourmet'],
        });
    }

    /**
     * Parse Processing bonus from active tea buffs
     * @param {Array} activeDrinks - Array of active drink items from actionTypeDrinkSlotsMap
     * @param {Object} itemDetailMap - Item details from init_client_data
     * @param {number} drinkConcentration - Drink Concentration stat (as decimal, e.g., 0.12 for 12%)
     * @returns {number} Processing conversion chance as decimal (e.g., 0.168 for 16.8% conversion chance)
     *
     * @example
     * // With Processing Tea (15% base) and 12% Drink Concentration:
     * parseProcessingBonus(activeDrinks, items, 0.12)
     * // Returns: 0.168 (15% × 1.12 = 16.8% conversion chance)
     */
    function parseProcessingBonus(activeDrinks, itemDetailMap, drinkConcentration = 0) {
        return parseTeaBuff(activeDrinks, itemDetailMap, drinkConcentration, {
            buffTypeHrids: ['/buff_types/processing'],
        });
    }

    /**
     * Parse Action Level bonus from active tea buffs
     * @param {Array} activeDrinks - Array of active drink items from actionTypeDrinkSlotsMap
     * @param {Object} itemDetailMap - Item details from init_client_data
     * @param {number} drinkConcentration - Drink Concentration stat (as decimal, e.g., 0.12 for 12%)
     * @returns {number} Action Level bonus as flat number (e.g., 5.645 for +5.645 levels, floored to 5 when used)
     *
     * @example
     * // With Artisan Tea (+5 Action Level base) and 12% Drink Concentration:
     * parseActionLevelBonus(activeDrinks, items, 0.129)
     * // Returns: 5.645 (scales with DC, but game floors this to 5 when calculating requirement)
     */
    function parseActionLevelBonus(activeDrinks, itemDetailMap, drinkConcentration = 0) {
        // Action Level DOES scale with DC (like all other buffs)
        // However, the game floors the result when calculating effective requirement
        return parseTeaBuff(activeDrinks, itemDetailMap, drinkConcentration, {
            buffTypeHrids: ['/buff_types/action_level'],
        });
    }

    /**
     * Parse Action Level bonus with breakdown by individual tea
     * @param {Array} activeDrinks - Array of active drink items from actionTypeDrinkSlotsMap
     * @param {Object} itemDetailMap - Item details from init_client_data
     * @param {number} drinkConcentration - Drink Concentration stat (as decimal, e.g., 0.12 for 12%)
     * @returns {Array<{name: string, actionLevel: number, baseActionLevel: number, dcContribution: number}>} Array of tea contributions
     *
     * @example
     * // With Artisan Tea (+5 Action Level base) and 12.9% Drink Concentration:
     * parseActionLevelBonusBreakdown(activeDrinks, items, 0.129)
     * // Returns: [{ name: "Artisan Tea", actionLevel: 5.645, baseActionLevel: 5.0, dcContribution: 0.645 }]
     * // Note: Game floors actionLevel to 5 when calculating requirement, but we show full precision
     */
    function parseActionLevelBonusBreakdown(activeDrinks, itemDetailMap, drinkConcentration = 0) {
        if (!activeDrinks || activeDrinks.length === 0) {
            return []; // No active teas
        }

        if (!itemDetailMap) {
            return []; // Missing required data
        }

        const teaBreakdown = [];

        // Process each active tea/drink
        for (const drink of activeDrinks) {
            if (!drink || !drink.itemHrid) {
                continue; // Empty slot
            }

            const itemDetails = itemDetailMap[drink.itemHrid];
            if (!itemDetails || !itemDetails.consumableDetail || !itemDetails.consumableDetail.buffs) {
                continue; // Not a consumable or has no buffs
            }

            let baseActionLevel = 0;
            let totalActionLevel = 0;

            // Check each buff on this tea
            for (const buff of itemDetails.consumableDetail.buffs) {
                // Action Level buff (e.g., Artisan Tea: +5 Action Level)
                if (buff.typeHrid === '/buff_types/action_level') {
                    const baseValue = buff.flatBoost;
                    // Action Level DOES scale with DC (like all other buffs)
                    const scaledValue = baseValue * (1 + drinkConcentration);
                    baseActionLevel += baseValue;
                    totalActionLevel += scaledValue;
                }
            }

            // Only add to breakdown if this tea contributes action level
            if (totalActionLevel > 0) {
                teaBreakdown.push({
                    name: itemDetails.name,
                    actionLevel: totalActionLevel,
                    baseActionLevel: baseActionLevel,
                    dcContribution: totalActionLevel - baseActionLevel,
                });
            }
        }

        return teaBreakdown;
    }

    /**
     * Parse Gathering bonus from active tea buffs
     * @param {Array} activeDrinks - Array of active drink items from actionTypeDrinkSlotsMap
     * @param {Object} itemDetailMap - Item details from init_client_data
     * @param {number} drinkConcentration - Drink Concentration stat (as decimal, e.g., 0.12 for 12%)
     * @returns {number} Gathering quantity bonus as decimal (e.g., 0.168 for 16.8% more items)
     *
     * @example
     * // With Gathering Tea (+15% base) and 12% Drink Concentration:
     * parseGatheringBonus(activeDrinks, items, 0.12)
     * // Returns: 0.168 (15% × 1.12 = 16.8% gathering quantity)
     */
    function parseGatheringBonus(activeDrinks, itemDetailMap, drinkConcentration = 0) {
        return parseTeaBuff(activeDrinks, itemDetailMap, drinkConcentration, {
            buffTypeHrids: ['/buff_types/gathering'],
        });
    }

    /**
     * Parse skill level bonus from active tea buffs for a specific action type
     * @param {string} actionTypeHrid - Action type HRID (e.g., "/action_types/cheesesmithing")
     * @param {Array} activeDrinks - Array of active drink items from actionTypeDrinkSlotsMap
     * @param {Object} itemDetailMap - Item details from init_client_data
     * @param {number} drinkConcentration - Drink Concentration stat (as decimal, e.g., 0.129 for 12.9%)
     * @returns {number} Total skill level bonus (e.g., 9.032 for +8 base × 1.129 DC)
     *
     * @example
     * // With Ultra Cheesesmithing Tea (+8 Cheesesmithing base) and 12.9% DC:
     * parseTeaSkillLevelBonus("/action_types/cheesesmithing", activeDrinks, items, 0.129)
     * // Returns: 9.032 (8 × 1.129 = 9.032 levels)
     */
    function parseTeaSkillLevelBonus(actionTypeHrid, activeDrinks, itemDetailMap, drinkConcentration = 0) {
        if (!activeDrinks || activeDrinks.length === 0) {
            return 0; // No active teas
        }

        if (!actionTypeHrid || !itemDetailMap) {
            return 0; // Missing required data
        }

        // Extract skill name from action type HRID
        // "/action_types/cheesesmithing" -> "cheesesmithing"
        const skillName = actionTypeHrid.split('/').pop();
        const skillLevelBuffType = `/buff_types/${skillName}_level`;

        let totalLevelBonus = 0;

        // Process each active tea/drink
        for (const drink of activeDrinks) {
            if (!drink || !drink.itemHrid) {
                continue; // Empty slot
            }

            const itemDetails = itemDetailMap[drink.itemHrid];
            if (!itemDetails || !itemDetails.consumableDetail || !itemDetails.consumableDetail.buffs) {
                continue; // Not a consumable or has no buffs
            }

            // Check each buff on this tea
            for (const buff of itemDetails.consumableDetail.buffs) {
                // Skill-specific level buff (e.g., "/buff_types/cheesesmithing_level")
                if (buff.typeHrid === skillLevelBuffType) {
                    const baseValue = buff.flatBoost;
                    const scaledValue = baseValue * (1 + drinkConcentration);
                    totalLevelBonus += scaledValue;
                }
            }
        }

        return totalLevelBonus;
    }

    var teaParser = {
        parseTeaEfficiency,
        getDrinkConcentration,
        parseArtisanBonus,
        parseGourmetBonus,
        parseProcessingBonus,
        parseActionLevelBonus,
        parseGatheringBonus,
        parseTeaSkillLevelBonus,
    };

    var teaParser$1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        default: teaParser,
        getDrinkConcentration: getDrinkConcentration,
        parseActionLevelBonus: parseActionLevelBonus,
        parseActionLevelBonusBreakdown: parseActionLevelBonusBreakdown,
        parseArtisanBonus: parseArtisanBonus,
        parseGatheringBonus: parseGatheringBonus,
        parseGourmetBonus: parseGourmetBonus,
        parseProcessingBonus: parseProcessingBonus,
        parseTeaEfficiency: parseTeaEfficiency,
        parseTeaEfficiencyBreakdown: parseTeaEfficiencyBreakdown,
        parseTeaSkillLevelBonus: parseTeaSkillLevelBonus
    });

    /**
     * House Efficiency Utility
     * Calculates efficiency bonuses from house rooms
     *
     * PART OF EFFICIENCY SYSTEM (Phase 2):
     * - House rooms provide +1.5% efficiency per level to matching actions
     * - Formula: houseLevel × 1.5%
     * - Data source: WebSocket (characterHouseRoomMap)
     */


    /**
     * Map action type HRID to house room HRID
     * @param {string} actionTypeHrid - Action type HRID (e.g., "/action_types/brewing")
     * @returns {string|null} House room HRID or null
     */
    function getHouseRoomForActionType(actionTypeHrid) {
        // Mapping matches original MWI Tools
        const actionTypeToHouseRoomMap = {
            '/action_types/brewing': '/house_rooms/brewery',
            '/action_types/cheesesmithing': '/house_rooms/forge',
            '/action_types/cooking': '/house_rooms/kitchen',
            '/action_types/crafting': '/house_rooms/workshop',
            '/action_types/foraging': '/house_rooms/garden',
            '/action_types/milking': '/house_rooms/dairy_barn',
            '/action_types/tailoring': '/house_rooms/sewing_parlor',
            '/action_types/woodcutting': '/house_rooms/log_shed',
            '/action_types/alchemy': '/house_rooms/laboratory',
        };

        return actionTypeToHouseRoomMap[actionTypeHrid] || null;
    }

    /**
     * Calculate house efficiency bonus for an action type
     * @param {string} actionTypeHrid - Action type HRID
     * @returns {number} Efficiency bonus percentage (e.g., 12 for 12%)
     *
     * @example
     * calculateHouseEfficiency("/action_types/brewing")
     * // Returns: 12 (if brewery is level 8: 8 × 1.5% = 12%)
     */
    function calculateHouseEfficiency(actionTypeHrid) {
        // Get the house room for this action type
        const houseRoomHrid = getHouseRoomForActionType(actionTypeHrid);

        if (!houseRoomHrid) {
            return 0; // No house room for this action type
        }

        // Get house room level from game data (via dataManager)
        const roomLevel = dataManager.getHouseRoomLevel(houseRoomHrid);

        // Formula: houseLevel × 1.5%
        // Returns as percentage (e.g., 12 for 12%)
        return roomLevel * 1.5;
    }

    /**
     * Get friendly name for house room
     * @param {string} houseRoomHrid - House room HRID
     * @returns {string} Friendly name
     */
    function getHouseRoomName(houseRoomHrid) {
        const names = {
            '/house_rooms/brewery': 'Brewery',
            '/house_rooms/forge': 'Forge',
            '/house_rooms/kitchen': 'Kitchen',
            '/house_rooms/workshop': 'Workshop',
            '/house_rooms/garden': 'Garden',
            '/house_rooms/dairy_barn': 'Dairy Barn',
            '/house_rooms/sewing_parlor': 'Sewing Parlor',
            '/house_rooms/log_shed': 'Log Shed',
            '/house_rooms/laboratory': 'Laboratory',
        };

        return names[houseRoomHrid] || 'Unknown';
    }

    /**
     * Calculate total Rare Find bonus from all house rooms
     * @returns {number} Total rare find bonus as percentage (e.g., 1.6 for 1.6%)
     *
     * @example
     * calculateHouseRareFind()
     * // Returns: 1.6 (if total house room levels = 8: 8 × 0.2% per level = 1.6%)
     *
     * Formula from game data:
     * - flatBoostLevelBonus: 0.2% per level
     * - Total: totalLevels × 0.2%
     * - Max: 8 rooms × 8 levels = 64 × 0.2% = 12.8%
     */
    function calculateHouseRareFind() {
        // Get all house rooms
        const houseRooms = dataManager.getHouseRooms();

        if (!houseRooms || houseRooms.size === 0) {
            return 0; // No house rooms
        }

        // Sum all house room levels
        let totalLevels = 0;
        for (const [_hrid, room] of houseRooms) {
            totalLevels += room.level || 0;
        }

        // Formula: totalLevels × flatBoostLevelBonus
        // flatBoostLevelBonus: 0.2% per level (no base bonus)
        const flatBoostLevelBonus = 0.2;

        return totalLevels * flatBoostLevelBonus;
    }

    var houseEfficiency = {
        calculateHouseEfficiency,
        getHouseRoomName,
        calculateHouseRareFind,
    };

    var houseEfficiency$1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        calculateHouseEfficiency: calculateHouseEfficiency,
        calculateHouseRareFind: calculateHouseRareFind,
        default: houseEfficiency,
        getHouseRoomName: getHouseRoomName
    });

    /**
     * Profit Calculation Constants
     * Shared constants used across profit calculators
     */

    /**
     * Marketplace tax rate (5%)
     */
    const MARKET_TAX = 0.05;

    /**
     * Bag of 10 Cowbells item HRID (subject to 18% market tax)
     */
    const COWBELL_BAG_HRID = '/items/bag_of_10_cowbells';

    /**
     * Bag of 10 Cowbells market tax rate (18%)
     */
    const COWBELL_BAG_TAX = 0.18;

    /**
     * Base drink consumption rate per hour (before Drink Concentration)
     */
    const DRINKS_PER_HOUR_BASE = 12;

    /**
     * Seconds per hour (for rate conversions)
     */
    const SECONDS_PER_HOUR = 3600;

    /**
     * Minimum action time in seconds (game-enforced cap)
     */
    const MIN_ACTION_TIME_SECONDS = 3;

    /**
     * Hours per day (for daily profit calculations)
     */
    const HOURS_PER_DAY = 24;

    /**
     * Gathering skill action types
     * Skills that gather raw materials from the world
     */
    const GATHERING_TYPES = ['/action_types/foraging', '/action_types/woodcutting', '/action_types/milking'];

    /**
     * Production skill action types
     * Skills that craft items from materials
     */
    const PRODUCTION_TYPES = [
        '/action_types/brewing',
        '/action_types/cooking',
        '/action_types/cheesesmithing',
        '/action_types/crafting',
        '/action_types/tailoring',
    ];

    /**
     * All non-combat skill action types
     */
    const ALL_SKILL_TYPES = [...GATHERING_TYPES, ...PRODUCTION_TYPES];

    var profitConstants = {
        MARKET_TAX,
        COWBELL_BAG_HRID,
        COWBELL_BAG_TAX,
        DRINKS_PER_HOUR_BASE,
        SECONDS_PER_HOUR,
        MIN_ACTION_TIME_SECONDS,
        HOURS_PER_DAY,
        GATHERING_TYPES,
        PRODUCTION_TYPES,
        ALL_SKILL_TYPES,
    };

    var profitConstants$1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        ALL_SKILL_TYPES: ALL_SKILL_TYPES,
        COWBELL_BAG_HRID: COWBELL_BAG_HRID,
        COWBELL_BAG_TAX: COWBELL_BAG_TAX,
        DRINKS_PER_HOUR_BASE: DRINKS_PER_HOUR_BASE,
        GATHERING_TYPES: GATHERING_TYPES,
        HOURS_PER_DAY: HOURS_PER_DAY,
        MARKET_TAX: MARKET_TAX,
        MIN_ACTION_TIME_SECONDS: MIN_ACTION_TIME_SECONDS,
        PRODUCTION_TYPES: PRODUCTION_TYPES,
        SECONDS_PER_HOUR: SECONDS_PER_HOUR,
        default: profitConstants
    });

    /**
     * Efficiency Utilities Module
     * Calculations for efficiency stacking and breakdowns
     */


    /**
     * Stack additive bonuses (most game bonuses)
     * @param {number[]} bonuses - Array of bonus percentages
     * @returns {number} Total stacked bonus percentage
     *
     * @example
     * stackAdditive([10, 20, 5])
     * // Returns: 35
     * // Because: 10% + 20% + 5% = 35%
     */
    function stackAdditive(...bonuses) {
        return bonuses.reduce((total, bonus) => total + bonus, 0);
    }

    /**
     * Calculate efficiency multiplier from efficiency percentage
     * Efficiency gives bonus action completions per time-consuming action
     *
     * @param {number} efficiencyPercent - Efficiency as percentage (e.g., 150 for 150%)
     * @returns {number} Multiplier (e.g., 2.5 for 150% efficiency)
     *
     * @example
     * calculateEfficiencyMultiplier(0)   // Returns 1.0 (no bonus)
     * calculateEfficiencyMultiplier(50)  // Returns 1.5
     * calculateEfficiencyMultiplier(150) // Returns 2.5
     */
    function calculateEfficiencyMultiplier(efficiencyPercent) {
        return 1 + (efficiencyPercent || 0) / 100;
    }

    /**
     * Calculate efficiency breakdown from supplied sources
     * @param {Object} params - Efficiency inputs
     * @param {number} params.requiredLevel - Action required level
     * @param {number} params.skillLevel - Player skill level
     * @param {number} [params.teaSkillLevelBonus=0] - Bonus skill levels from tea
     * @param {number} [params.actionLevelBonus=0] - Action level bonus from tea (affects requirement)
     * @param {number} [params.houseEfficiency=0] - House room efficiency bonus
     * @param {number} [params.equipmentEfficiency=0] - Equipment efficiency bonus
     * @param {number} [params.teaEfficiency=0] - Tea efficiency bonus
     * @param {number} [params.communityEfficiency=0] - Community buff efficiency bonus
     * @param {number} [params.achievementEfficiency=0] - Achievement efficiency bonus
     * @param {number} [params.personalEfficiency=0] - Personal buff (seal) efficiency bonus
     * @returns {Object} Efficiency breakdown
     */
    function calculateEfficiencyBreakdown({
        requiredLevel,
        skillLevel,
        teaSkillLevelBonus = 0,
        actionLevelBonus = 0,
        houseEfficiency = 0,
        equipmentEfficiency = 0,
        teaEfficiency = 0,
        communityEfficiency = 0,
        achievementEfficiency = 0,
        personalEfficiency = 0,
        guildEfficiency = 0,
    }) {
        const effectiveRequirement = (requiredLevel || 0) + actionLevelBonus;
        const baseSkillLevel = Math.max(skillLevel || 0, requiredLevel || 0);
        const effectiveLevel = baseSkillLevel + teaSkillLevelBonus;
        const levelEfficiency = Math.max(0, effectiveLevel - effectiveRequirement);
        const totalEfficiency = stackAdditive(
            levelEfficiency,
            houseEfficiency,
            equipmentEfficiency,
            teaEfficiency,
            communityEfficiency,
            achievementEfficiency,
            personalEfficiency,
            guildEfficiency
        );

        return {
            totalEfficiency,
            levelEfficiency,
            effectiveRequirement,
            effectiveLevel,
            breakdown: {
                houseEfficiency,
                equipmentEfficiency,
                teaEfficiency,
                communityEfficiency,
                achievementEfficiency,
                personalEfficiency,
                guildEfficiency,
                actionLevelBonus,
                teaSkillLevelBonus,
            },
        };
    }

    /**
     * Build the shared efficiency context for a production or gathering action.
     * Consolidates equipment lookup, tea parsing, house bonus, skill level, and
     * efficiency breakdown calculation that would otherwise be duplicated across
     * profit-calculator.js (production) and gathering-profit.js (gathering).
     *
     * @param {Object} actionDetails - Action detail object from dataManager
     * @param {Object} [options={}] - Configuration flags
     * @param {boolean} [options.isProduction=false] - True for production actions.
     *   When true: includes artisanBonus, actionLevelBonus, uses calculateHouseEfficiency.
     *   When false (gathering): uses inline houseRooms loop, includes gatheringQuantity.
     * @param {Object} [options.gameData=null] - Pre-fetched gameData (required for gathering path).
     * @param {number} [options.communityEfficiency=0] - Community buff efficiency (production only).
     *   Caller computes this via their own method (e.g. calculateCommunityBuffBonus) and passes it in.
     * @returns {Object} Efficiency context with all computed values
     */
    function getActionEfficiencyContext(actionDetails, options = {}) {
        const { isProduction = false, gameData = null, communityEfficiency = 0 } = options;

        const skills = dataManager.getSkills();
        const { equipment, drinks: drinkSlots } = resolveActionContext(actionDetails.type);
        const itemDetailMap = gameData?.itemDetailMap ?? dataManager.getInitClientData()?.itemDetailMap ?? {};

        // Drink concentration
        const drinkConcentration = getDrinkConcentration(equipment, itemDetailMap);

        // Action time (nanoseconds → seconds)
        const baseTimePerActionSec = actionDetails.baseTimeCost / 1e9;
        const speedBonus = parseEquipmentSpeedBonuses(equipment, actionDetails.type, itemDetailMap);
        const personalSpeedBonus = dataManager.getPersonalBuffFlatBoost(actionDetails.type, '/buff_types/action_speed');

        const guildBuffs = dataManager.characterData?.guildActionTypeBuffsMap?.[actionDetails.type] || [];
        const guildSpeedBonus = guildBuffs.reduce(
            (sum, b) => (b.typeHrid === '/buff_types/action_speed' ? sum + (b.flatBoost || 0) + (b.ratioBoost || 0) : sum),
            0
        );
        const guildEfficiency = guildBuffs.reduce(
            (sum, b) =>
                b.typeHrid === '/buff_types/efficiency' ? sum + ((b.flatBoost || 0) + (b.ratioBoost || 0)) * 100 : sum,
            0
        );

        const actionTime = baseTimePerActionSec / (1 + speedBonus + personalSpeedBonus + guildSpeedBonus);

        // Skill level
        const baseRequirement = actionDetails.levelRequirement?.level || 1;
        const skillHrid = actionDetails.levelRequirement?.skillHrid;
        let skillLevel = baseRequirement;
        if (skills) {
            for (const skill of skills) {
                if (skill.skillHrid === skillHrid) {
                    skillLevel = skill.level;
                    break;
                }
            }
        }

        // Tea bonuses (shared by both paths)
        const teaSkillLevelBonus = parseTeaSkillLevelBonus(
            actionDetails.type,
            drinkSlots,
            itemDetailMap,
            drinkConcentration
        );
        const teaEfficiency = parseTeaEfficiency(actionDetails.type, drinkSlots, itemDetailMap, drinkConcentration);
        const processingBonus = GATHERING_TYPES.includes(actionDetails.type)
            ? parseProcessingBonus(drinkSlots, itemDetailMap, drinkConcentration) +
              dataManager.getPersonalBuffFlatBoost(actionDetails.type, '/buff_types/processing')
            : 0;
        const gourmetBonus = PRODUCTION_TYPES.includes(actionDetails.type)
            ? parseGourmetBonus(drinkSlots, itemDetailMap, drinkConcentration) +
              dataManager.getPersonalBuffFlatBoost(actionDetails.type, '/buff_types/gourmet')
            : 0;

        // Equipment efficiency
        const equipmentEfficiency = parseEquipmentEfficiencyBonuses(equipment, actionDetails.type, itemDetailMap);
        const equipmentEfficiencyItems = parseEquipmentEfficiencyBreakdown(equipment, actionDetails.type, itemDetailMap);
        const achievementEfficiency =
            dataManager.getAchievementBuffFlatBoost(actionDetails.type, '/buff_types/efficiency') * 100;
        const personalEfficiency = dataManager.getPersonalBuffFlatBoost(actionDetails.type, '/buff_types/efficiency') * 100;

        // Production-specific: artisan bonus, action level bonus, house via calculateHouseEfficiency
        // Gathering-specific: house via inline houseRooms loop
        let artisanBonus = 0;
        let actionLevelBonus = 0;
        let houseEfficiency = 0;

        if (isProduction) {
            artisanBonus = parseArtisanBonus(drinkSlots, itemDetailMap, drinkConcentration);
            actionLevelBonus = parseActionLevelBonus(drinkSlots, itemDetailMap, drinkConcentration);
            houseEfficiency = calculateHouseEfficiency(actionDetails.type);
        } else {
            // Gathering: compute house efficiency from houseRooms + houseRoomDetailMap
            const houseRooms = Array.from(dataManager.getHouseRooms().values());
            const initData = gameData ?? dataManager.getInitClientData();
            for (const room of houseRooms) {
                const roomDetail = initData?.houseRoomDetailMap?.[room.houseRoomHrid];
                if (roomDetail?.usableInActionTypeMap?.[actionDetails.type]) {
                    houseEfficiency += (room.level || 0) * 1.5;
                }
            }
        }

        // Gathering-only: gathering quantity bonuses
        let totalGathering = 0;
        let gatheringDetails = null;

        if (!isProduction && GATHERING_TYPES.includes(actionDetails.type)) {
            const gatheringTea = parseGatheringBonus(drinkSlots, itemDetailMap, drinkConcentration);
            const communityBuffLevel = dataManager.getCommunityBuffLevel('/community_buff_types/gathering_quantity');
            const communityGathering = communityBuffLevel ? 0.2 + (communityBuffLevel - 1) * 0.005 : 0;
            const achievementGathering = dataManager.getAchievementBuffFlatBoost(
                actionDetails.type,
                '/buff_types/gathering'
            );
            const personalGathering = dataManager.getPersonalBuffFlatBoost(actionDetails.type, '/buff_types/gathering');
            totalGathering = gatheringTea + communityGathering + achievementGathering + personalGathering;
            gatheringDetails = { gatheringTea, communityGathering, achievementGathering, personalGathering };
        }

        // Build efficiency breakdown
        const efficiencyBreakdown = calculateEfficiencyBreakdown({
            requiredLevel: baseRequirement,
            skillLevel,
            teaSkillLevelBonus,
            actionLevelBonus,
            houseEfficiency,
            equipmentEfficiency,
            teaEfficiency,
            communityEfficiency,
            achievementEfficiency,
            personalEfficiency,
            guildEfficiency,
        });

        const efficiencyMultiplier = calculateEfficiencyMultiplier(efficiencyBreakdown.totalEfficiency);

        return {
            // Equipment / drinks
            equipment,
            drinkSlots,
            drinkConcentration,
            itemDetailMap,
            // Timing
            actionTime,
            speedBonus,
            personalSpeedBonus,
            guildSpeedBonus,
            baseTimePerActionSec,
            // Skill
            skillLevel,
            baseRequirement,
            // Tea bonuses
            teaSkillLevelBonus,
            teaEfficiency,
            processingBonus,
            gourmetBonus,
            // Equipment efficiency
            equipmentEfficiency,
            equipmentEfficiencyItems,
            achievementEfficiency,
            personalEfficiency,
            guildEfficiency,
            // Production-only (zero for gathering)
            artisanBonus,
            actionLevelBonus,
            houseEfficiency,
            communityEfficiency,
            // Gathering-only (zero/null for production)
            totalGathering,
            gatheringDetails,
            // Final efficiency results
            efficiencyBreakdown,
            efficiencyMultiplier,
        };
    }

    var efficiency = {
        stackAdditive,
        calculateEfficiencyMultiplier,
        calculateEfficiencyBreakdown,
        getActionEfficiencyContext,
    };

    var efficiency$1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        calculateEfficiencyBreakdown: calculateEfficiencyBreakdown,
        calculateEfficiencyMultiplier: calculateEfficiencyMultiplier,
        default: efficiency,
        getActionEfficiencyContext: getActionEfficiencyContext,
        stackAdditive: stackAdditive
    });

    /**
     * Custom Price Overrides
     * Manages user-defined buy/sell price overrides for profit calculations.
     * Overrides are stored in IndexedDB and cached in memory.
     */


    const STORAGE_KEY = 'Cheezasha_customPriceOverrides';

    /** @type {Object|null} In-memory cache of overrides */
    let overridesCache = null;

    /**
     * Load overrides from storage into cache
     * @returns {Promise<Object>} The overrides object
     */
    async function loadOverrides() {
        if (overridesCache === null) {
            overridesCache = (await storage.getJSON(STORAGE_KEY, 'settings', {})) || {};
        }
        return overridesCache;
    }

    /**
     * Get all custom price overrides
     * @returns {Object} The overrides object (may be empty if not yet loaded)
     */
    function getCustomPriceOverrides() {
        if (overridesCache === null) {
            // Trigger async load but return empty for now
            loadOverrides();
            return {};
        }
        return overridesCache;
    }

    /**
     * Get a custom price for a specific item, enhancement level, and transaction side.
     * @param {string} itemHrid - Item HRID
     * @param {number} enhancementLevel - Enhancement level (default 0)
     * @param {string} side - Transaction side ('buy' or 'sell')
     * @returns {number|null} Custom price or null if no override exists
     */
    function getCustomPrice(itemHrid, enhancementLevel = 0, side = 'sell') {
        const overrides = getCustomPriceOverrides();
        const key = `${itemHrid}:${enhancementLevel}`;
        const override = overrides[key];
        if (!override) {
            return null;
        }
        const price = override[side];
        if (price === undefined || price === null || price === '') {
            return null;
        }
        return price;
    }

    /**
     * Market Data Utility
     * Centralized access to market prices with smart pricing mode handling
     */


    // Track logged warnings to prevent console spam
    const loggedWarnings = new Set();

    /**
     * Get item price based on pricing mode and context
     * @param {string} itemHrid - Item HRID
     * @param {Object} options - Configuration options
     * @param {number} [options.enhancementLevel=0] - Enhancement level
     * @param {string} [options.mode] - Pricing mode ('ask'|'bid'|'average'). If not provided, uses context or user settings
     * @param {string} [options.context] - Context hint ('profit'|'networth'|null). Used to determine pricing mode from settings
     * @param {string} [options.side='sell'] - Transaction side ('buy'|'sell') - used with 'profit' context to determine correct price
     * @returns {number|null} Price in gold, or null if no market data
     */
    function getItemPrice(itemHrid, options = {}) {
        // Validate inputs
        if (!itemHrid || typeof itemHrid !== 'string') {
            return null;
        }

        // Handle case where someone passes enhancementLevel as second arg (old API)
        if (typeof options === 'number') {
            options = { enhancementLevel: options };
        }

        // Ensure options is an object
        if (typeof options !== 'object' || options === null) {
            options = {};
        }

        const { enhancementLevel = 0, mode, context, side = 'sell' } = options;

        // Check for custom price override
        const customPrice = getCustomPrice(itemHrid, enhancementLevel, side);
        if (customPrice !== null) {
            return customPrice;
        }

        // Get raw price data from API
        const priceData = marketAPI.getPrice(itemHrid, enhancementLevel);

        if (!priceData) {
            return null;
        }

        // Determine pricing mode
        const pricingMode = mode || getPricingMode(context, side);

        // Validate pricing mode
        const validModes = ['ask', 'bid', 'average'];
        if (!validModes.includes(pricingMode)) {
            const warningKey = `mode:${pricingMode}`;
            if (!loggedWarnings.has(warningKey)) {
                console.warn(`[Market Data] Unknown pricing mode: ${pricingMode}, defaulting to ask`);
                loggedWarnings.add(warningKey);
            }
            return priceData.ask || 0;
        }

        const resolvePrice = (value) => {
            if (typeof value !== 'number') {
                return null;
            }

            if (value < 0) {
                return null;
            }

            return value;
        };

        // Return price based on mode
        switch (pricingMode) {
            case 'ask':
                return resolvePrice(priceData.ask);
            case 'bid':
                return resolvePrice(priceData.bid);
            case 'average':
                if (typeof priceData.ask !== 'number' || typeof priceData.bid !== 'number') {
                    return null;
                }

                if (priceData.ask < 0 || priceData.bid < 0) {
                    return null;
                }

                return (priceData.ask + priceData.bid) / 2;
            default:
                return resolvePrice(priceData.ask);
        }
    }

    /**
     * Get all price variants for an item
     * @param {string} itemHrid - Item HRID
     * @param {number} [enhancementLevel=0] - Enhancement level
     * @returns {Object|null} Object with {ask, bid, average} or null if no market data
     */
    function getItemPrices(itemHrid, enhancementLevel = 0) {
        const priceData = marketAPI.getPrice(itemHrid, enhancementLevel);

        if (!priceData) {
            return null;
        }

        return {
            ask: priceData.ask,
            bid: priceData.bid,
            average: (priceData.ask + priceData.bid) / 2,
        };
    }

    /**
     * Format price with K/M/B suffixes
     * @param {number} amount - Amount to format
     * @param {Object} options - Formatting options
     * @param {number} [options.decimals=1] - Number of decimal places
     * @param {boolean} [options.showZero=true] - Whether to show '0' for zero values
     * @returns {string} Formatted price string
     */
    function formatPrice(amount, options = {}) {
        const { decimals = 1, showZero = true } = options;

        if (amount === null || amount === undefined) {
            return '--';
        }

        if (amount === 0) {
            return showZero ? '0' : '--';
        }

        const absAmount = Math.abs(amount);
        const sign = amount < 0 ? '-' : '';

        if (absAmount >= 1_000_000_000) {
            return `${sign}${(absAmount / 1_000_000_000).toFixed(decimals)}B`;
        } else if (absAmount >= 1_000_000) {
            return `${sign}${(absAmount / 1_000_000).toFixed(decimals)}M`;
        } else if (absAmount >= 1_000) {
            return `${sign}${(absAmount / 1_000).toFixed(decimals)}K`;
        } else {
            return `${sign}${absAmount.toFixed(decimals)}`;
        }
    }

    /**
     * Determine pricing mode from context and user settings
     * @param {string} [context] - Context hint ('profit'|'networth'|null)
     * @param {string} [side='sell'] - Transaction side ('buy'|'sell') - used with 'profit' context
     * @returns {string} Pricing mode ('ask'|'bid'|'average')
     */
    function getPricingMode(context, side = 'sell') {
        // If no context, default to 'ask'
        if (!context) {
            return 'ask';
        }

        // Validate context is a string
        if (typeof context !== 'string') {
            return 'ask';
        }

        // Get pricing mode from settings based on context
        switch (context) {
            case 'profit': {
                const profitMode = config.getSettingValue('profitCalc_pricingMode');

                // Convert profit calculation modes to price types based on transaction side
                // Conservative: Ask/Bid (instant buy materials, instant sell output)
                // Hybrid: Ask/Ask (instant buy materials, patient sell output)
                // Optimistic: Bid/Ask (patient buy materials, patient sell output)
                // Patient Buy: Bid/Bid (patient buy materials, instant sell output)
                let selectedPriceType;
                switch (profitMode) {
                    case 'conservative':
                        selectedPriceType = side === 'buy' ? 'ask' : 'bid';
                        break;
                    case 'hybrid':
                        selectedPriceType = 'ask'; // Ask for both buy and sell
                        break;
                    case 'optimistic':
                        selectedPriceType = side === 'buy' ? 'bid' : 'ask';
                        break;
                    case 'patientBuy':
                        selectedPriceType = 'bid'; // Bid for both buy and sell
                        break;
                    default:
                        selectedPriceType = 'ask';
                }
                return selectedPriceType;
            }
            case 'networth': {
                return config.getSettingValue('networth_pricingMode') || 'ask';
            }
            default: {
                const warningKey = `context:${context}`;
                if (!loggedWarnings.has(warningKey)) {
                    console.warn(`[Market Data] Unknown context: ${context}, defaulting to ask`);
                    loggedWarnings.add(warningKey);
                }
                return 'ask';
            }
        }
    }

    /**
     * Get prices for multiple items in batch
     * @param {Array<{itemHrid: string, enhancementLevel?: number}>} items - Array of items to price
     * @param {Object} options - Configuration options
     * @param {string} [options.mode] - Pricing mode ('ask'|'bid'|'average')
     * @param {string} [options.context] - Context hint ('profit'|'networth'|null)
     * @param {string} [options.side='sell'] - Transaction side ('buy'|'sell')
     * @returns {Map<string, number>} Map of itemHrid+enhancementLevel to price
     */
    function getItemPricesBatch(items, options = {}) {
        const result = new Map();

        for (const item of items) {
            const key = `${item.itemHrid}:${item.enhancementLevel || 0}`;
            const price = getItemPrice(item.itemHrid, {
                enhancementLevel: item.enhancementLevel || 0,
                mode: options.mode,
                context: options.context,
                side: options.side,
            });

            if (price !== null) {
                result.set(key, price);
            }
        }

        return result;
    }

    var marketData = {
        getItemPrice,
        getItemPrices,
        formatPrice,
        getPricingMode,
        getItemPricesBatch,
    };

    var marketData$1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        default: marketData,
        formatPrice: formatPrice,
        getItemPrice: getItemPrice,
        getItemPrices: getItemPrices,
        getItemPricesBatch: getItemPricesBatch,
        getPricingMode: getPricingMode
    });

    /**
     * Game Data Lookup Utilities
     *
     * Centralized functions for resolving display names to HRIDs.
     * Handles the ★ ↔ (R) refined item display name difference between
     * test server and live server.
     */


    /**
     * Get the coin cost of an item from the in-game shop.
     * Returns 0 if the item is not available in the shop or not purchasable with coins.
     * @param {string} itemHrid - Item HRID
     * @returns {number} Coin cost, or 0 if not available in shop
     */
    function getShopCoinCost(itemHrid) {
        const gameData = dataManager.getInitClientData();
        if (!gameData?.shopItemDetailMap) return 0;

        for (const shopItem of Object.values(gameData.shopItemDetailMap)) {
            if (shopItem.itemHrid === itemHrid) {
                if (shopItem.costs && shopItem.costs.length > 0) {
                    const coinCost = shopItem.costs.find((cost) => cost.itemHrid === '/items/coin');
                    if (coinCost) {
                        return coinCost.count;
                    }
                }
            }
        }

        return 0;
    }

    /**
     * Enhancement Calculator
     *
     * Uses Markov Chain matrix math to calculate exact expected values for enhancement attempts.
     * Based on the original MWI Tools Enhancelate() function.
     *
     * Math.js library is loaded via userscript @require header.
     */


    /**
     * Base success rates by enhancement level (before bonuses)
     */
    const BASE_SUCCESS_RATES$1 = [
        50, // +1
        45, // +2
        45, // +3
        40, // +4
        40, // +5
        40, // +6
        35, // +7
        35, // +8
        35, // +9
        35, // +10
        30, // +11
        30, // +12
        30, // +13
        30, // +14
        30, // +15
        30, // +16
        30, // +17
        30, // +18
        30, // +19
        30, // +20
    ];

    /**
     * Calculate total success rate bonus multiplier
     * @param {Object} params - Enhancement parameters
     * @param {number} params.enhancingLevel - Effective enhancing level (base + tea bonus)
     * @param {number} params.toolBonus - Tool success bonus % (already includes equipment + house bonus)
     * @param {number} params.itemLevel - Item level being enhanced
     * @returns {number} Success rate multiplier (e.g., 1.0519 = 105.19% of base rates)
     */
    function calculateSuccessMultiplier(params) {
        const { enhancingLevel, toolBonus, itemLevel } = params;

        // Total bonus calculation
        // toolBonus already includes equipment + house success bonus from config
        // We only need to add level advantage here

        let totalBonus;

        if (enhancingLevel >= itemLevel) {
            // Above or at item level: +0.05% per level above item level
            const levelAdvantage = 0.05 * (enhancingLevel - itemLevel);
            totalBonus = 1 + (toolBonus + levelAdvantage) / 100;
        } else {
            // Below item level: Penalty based on level deficit
            totalBonus = 1 - 0.5 * (1 - enhancingLevel / itemLevel) + toolBonus / 100;
        }

        return totalBonus;
    }

    /**
     * Calculate per-action time for enhancement
     * Simple calculation that doesn't require Markov chain analysis
     * @param {number} enhancingLevel - Effective enhancing level (includes tea bonus)
     * @param {number} itemLevel - Item level being enhanced
     * @param {number} speedBonus - Speed bonus % (for action time calculation)
     * @returns {number} Per-action time in seconds
     */
    function calculatePerActionTime(enhancingLevel, itemLevel, speedBonus = 0) {
        const baseActionTime = 12; // seconds
        let speedMultiplier;

        if (enhancingLevel > itemLevel) {
            // Above item level: Get speed bonus from level advantage + equipment + house
            // Note: speedBonus already includes house level bonus (1% per level)
            speedMultiplier = 1 + (enhancingLevel - itemLevel + speedBonus) / 100;
        } else {
            // Below item level: Only equipment + house speed bonus
            // Note: speedBonus already includes house level bonus (1% per level)
            speedMultiplier = 1 + speedBonus / 100;
        }

        return Math.max(MIN_ACTION_TIME_SECONDS, baseActionTime / speedMultiplier);
    }

    /**
     * Calculate enhancement statistics using Markov Chain matrix inversion
     * @param {Object} params - Enhancement parameters
     * @param {number} params.enhancingLevel - Effective enhancing level (includes tea bonus)
     * @param {number} params.houseLevel - Observatory house room level (used for speed calculation only)
     * @param {number} params.toolBonus - Tool success bonus % (already includes equipment + house success bonus from config)
     * @param {number} params.speedBonus - Speed bonus % (for action time calculation)
     * @param {number} params.itemLevel - Item level being enhanced
     * @param {number} params.targetLevel - Target enhancement level (1-20)
     * @param {number} params.startLevel - Starting enhancement level (0-19, default 0)
     * @param {number} params.protectFrom - Start using protection items at this level (0 = never)
     * @param {boolean} params.blessedTea - Whether Blessed Tea is active (1% double jump)
     * @param {number} params.guzzlingBonus - Drink concentration multiplier (1.0 = no bonus, scales blessed tea)
     * @returns {Object} Enhancement statistics
     */
    function calculateEnhancement(params) {
        const {
            enhancingLevel,
            _houseLevel,
            toolBonus,
            speedBonus = 0,
            itemLevel,
            targetLevel,
            startLevel = 0,
            protectFrom = 0,
            blessedTea = false,
            guzzlingBonus = 1.0,
        } = params;

        // Validate inputs
        if (targetLevel < 1 || targetLevel > 20) {
            throw new Error('Target level must be between 1 and 20');
        }
        if (protectFrom < 0 || protectFrom > targetLevel) {
            throw new Error('Protection level must be between 0 and target level');
        }

        // Calculate success rate multiplier
        const successMultiplier = calculateSuccessMultiplier({
            enhancingLevel,
            toolBonus,
            itemLevel,
        });

        // Build Markov Chain transition matrix (20×20)
        const markov = math.zeros(20, 20);

        for (let i = 0; i < targetLevel; i++) {
            const baseSuccessRate = BASE_SUCCESS_RATES$1[i] / 100.0;
            const successChance = baseSuccessRate * successMultiplier;

            // Where do we go on failure?
            // Protection only applies when protectFrom > 0 AND we're at or above that level
            const failureDestination = protectFrom > 0 && i >= protectFrom ? i - 1 : 0;

            if (blessedTea) {
                // Blessed Tea: 1% base chance to jump +2, scaled by guzzling bonus
                // Remaining success chance goes to +1 (after accounting for skip chance)
                const skipChance = successChance * 0.01 * guzzlingBonus;
                const remainingSuccess = successChance * (1 - 0.01 * guzzlingBonus);

                markov.set([i, i + 2], skipChance);
                markov.set([i, i + 1], remainingSuccess);
                markov.set([i, failureDestination], 1 - successChance);
            } else {
                // Normal: Success goes to +1, failure goes to destination
                markov.set([i, i + 1], successChance);
                markov.set([i, failureDestination], 1.0 - successChance);
            }
        }

        // Absorbing state at target level
        markov.set([targetLevel, targetLevel], 1.0);

        // Extract transient matrix Q (all states before target)
        const Q = markov.subset(math.index(math.range(0, targetLevel), math.range(0, targetLevel)));

        // Fundamental matrix: M = (I - Q)^-1
        const I = math.identity(targetLevel);
        const M = math.inv(math.subtract(I, Q));

        // Expected attempts from startLevel to target
        // Sum all elements in startLevel row of M from startLevel to targetLevel
        let attempts = 0;
        for (let i = startLevel; i < targetLevel; i++) {
            attempts += M.get([startLevel, i]);
        }

        // Expected protection item uses
        let protects = 0;
        if (protectFrom > 0 && protectFrom < targetLevel) {
            for (let i = protectFrom; i < targetLevel; i++) {
                const timesAtLevel = M.get([startLevel, i]);
                const failureChance = markov.get([i, i - 1]);
                protects += timesAtLevel * failureChance;
            }
        }

        // Action time calculation
        const baseActionTime = 12; // seconds
        let speedMultiplier;

        if (enhancingLevel > itemLevel) {
            // Above item level: Get speed bonus from level advantage + equipment + house
            // Note: speedBonus already includes house level bonus (1% per level)
            speedMultiplier = 1 + (enhancingLevel - itemLevel + speedBonus) / 100;
        } else {
            // Below item level: Only equipment + house speed bonus
            // Note: speedBonus already includes house level bonus (1% per level)
            speedMultiplier = 1 + speedBonus / 100;
        }

        const perActionTime = Math.max(MIN_ACTION_TIME_SECONDS, baseActionTime / speedMultiplier);
        const totalTime = perActionTime * attempts;

        return {
            attempts: attempts, // Keep exact decimal value for calculations
            attemptsRounded: Math.round(attempts), // Rounded for display
            protectionCount: protects, // Keep decimal precision
            perActionTime: perActionTime,
            totalTime: totalTime,
            successMultiplier: successMultiplier,

            // Detailed success rates for each level
            successRates: BASE_SUCCESS_RATES$1.slice(0, targetLevel).map((base, i) => {
                return {
                    level: i + 1,
                    baseRate: base,
                    actualRate: Math.min(100, base * successMultiplier),
                };
            }),

            // Expected number of times each state is visited (from fundamental matrix M)
            visitCounts: Array.from({ length: targetLevel }, (_, i) => M.get([startLevel, i])),
        };
    }

    var enhancementCalculator = /*#__PURE__*/Object.freeze({
        __proto__: null,
        BASE_SUCCESS_RATES: BASE_SUCCESS_RATES$1,
        calculateEnhancement: calculateEnhancement,
        calculatePerActionTime: calculatePerActionTime
    });

    /**
     * Enhancement Tooltip Module
     *
     * Provides enhancement analysis for item tooltips.
     * Calculates optimal enhancement path and total costs for reaching current enhancement level.
     *
     * This module is part of Phase 2 of Option D (Hybrid Approach):
     * - Enhancement panel: Shows 20-level enhancement table
     * - Item tooltips: Shows optimal path to reach current enhancement level
     */


    const _costCache = new Map();
    const _chainTimeCache = new Map();

    marketAPI.on(() => {
        _costCache.clear();
        _chainTimeCache.clear();
    });

    /**
     * Calculate production cost from crafting recipe
     * Matches original MWI Tools v25.0 getBaseItemProductionCost logic
     * @param {string} itemHrid
     * @param {'ask'|'bid'} [mode='ask'] - Pricing side to use for input materials
     * @private
     */
    function getProductionCost(itemHrid, mode = 'ask') {
        const cacheKey = `${itemHrid}|${mode}`;
        if (_costCache.has(cacheKey)) return _costCache.get(cacheKey);
        const result = _computeProductionCost(itemHrid, mode);
        _costCache.set(cacheKey, result);
        return result;
    }

    function _computeProductionCost(itemHrid, mode = 'ask') {
        const gameData = dataManager.getInitClientData();
        const itemDetails = gameData.itemDetailMap[itemHrid];

        if (!itemDetails || !itemDetails.name) {
            return 0;
        }

        // Find the action that produces this item
        let actionHrid = null;
        let outputCount = 1;
        for (const [hrid, action] of Object.entries(gameData.actionDetailMap)) {
            if (action.outputItems && action.outputItems.length > 0) {
                const output = action.outputItems[0];
                if (output.itemHrid === itemHrid) {
                    actionHrid = hrid;
                    outputCount = output.count || 1;
                    break;
                }
            }
        }

        if (!actionHrid) {
            return 0;
        }

        const action = gameData.actionDetailMap[actionHrid];
        let totalPrice = 0;

        // Compute artisan tea reduction dynamically (same approach as material-calculator.js)
        let artisanBonus = 0;
        try {
            const equipment = dataManager.getEquipment();
            const itemDetailMap = gameData.itemDetailMap || {};
            const drinkConcentration = getDrinkConcentration(equipment, itemDetailMap);
            const activeDrinks = dataManager.getActionDrinkSlots(action.type);
            artisanBonus = parseArtisanBonus(activeDrinks, itemDetailMap, drinkConcentration);
        } catch {
            // Fall back to no reduction if data unavailable
        }

        // Sum up input material costs (artisan tea reduces material quantities, not upgrade items)
        if (action.inputItems) {
            for (const input of action.inputItems) {
                if (input.itemHrid === '/items/coin') {
                    totalPrice += input.count * (1 - artisanBonus);
                    continue;
                }
                let inputPrice = getItemPrice(input.itemHrid, { mode }) || 0;
                if (inputPrice === 0) {
                    inputPrice = getProductionCost(input.itemHrid, mode);
                }
                totalPrice += inputPrice * input.count * (1 - artisanBonus);
            }
        }

        // Add upgrade item cost if this is an upgrade recipe (not affected by artisan tea)
        // Use min(market, craft) so refined items reflect the cheapest way to obtain the base item
        if (action.upgradeItemHrid) {
            const upgradeMarketPrice = getItemPrice(action.upgradeItemHrid, { mode }) || 0;
            const upgradeCraftPrice = getProductionCost(action.upgradeItemHrid, mode);
            let upgradePrice;
            if (upgradeMarketPrice > 0 && upgradeCraftPrice > 0) {
                upgradePrice = Math.min(upgradeMarketPrice, upgradeCraftPrice);
            } else {
                upgradePrice = upgradeMarketPrice || upgradeCraftPrice;
            }
            totalPrice += upgradePrice;
        }

        return totalPrice / outputCount;
    }

    /**
     * Profit Calculation Helpers
     * Pure functions for profit/rate calculations used across features
     *
     * These functions consolidate duplicated calculations from:
     * - profit-calculator.js
     * - gathering-profit.js
     * - task-profit-calculator.js
     * - action-time-display.js
     * - tooltip-prices.js
     */


    /**
     * Calculate actions per hour from action time
     * @param {number} actionTimeSeconds - Time per action in seconds
     * @returns {number} Actions per hour (0 if invalid input)
     *
     * @example
     * calculateActionsPerHour(6) // Returns 600 (3600 / 6)
     * calculateActionsPerHour(0) // Returns 0 (invalid)
     */
    function calculateActionsPerHour(actionTimeSeconds) {
        if (!actionTimeSeconds || actionTimeSeconds <= 0) {
            return 0;
        }
        return SECONDS_PER_HOUR / Math.max(MIN_ACTION_TIME_SECONDS, actionTimeSeconds);
    }

    /**
     * Calculate effective actions per hour after efficiency
     * @param {number} actionsPerHour - Base actions per hour (without efficiency)
     * @param {number} [efficiencyMultiplier=1] - Efficiency multiplier (1 + efficiencyPercent/100)
     * @returns {number} Effective actions per hour (0 if invalid input)
     *
     * @example
     * calculateEffectiveActionsPerHour(600, 1.2) // Returns 720
     */
    function calculateEffectiveActionsPerHour(actionsPerHour, efficiencyMultiplier = 1) {
        if (!actionsPerHour || actionsPerHour <= 0) {
            return 0;
        }
        if (!efficiencyMultiplier || efficiencyMultiplier <= 0) {
            return 0;
        }
        return actionsPerHour * efficiencyMultiplier;
    }

    /**
     * Calculate hours needed for a number of actions
     * @param {number} actionCount - Number of queued actions
     * @param {number} actionsPerHour - Actions per hour rate
     * @returns {number} Hours needed (0 if invalid input)
     *
     * @example
     * calculateHoursForActions(600, 600) // Returns 1
     * calculateHoursForActions(1200, 600) // Returns 2
     */
    function calculateHoursForActions(actionCount, actionsPerHour) {
        if (!actionsPerHour || actionsPerHour <= 0) {
            return 0;
        }
        return actionCount / actionsPerHour;
    }

    /**
     * Calculate seconds needed for a number of actions
     * @param {number} actionCount - Number of queued actions
     * @param {number} actionsPerHour - Actions per hour rate
     * @returns {number} Seconds needed (0 if invalid input)
     *
     * @example
     * calculateSecondsForActions(100, 600) // Returns 600 (100/600 * 3600)
     */
    function calculateSecondsForActions(actionCount, actionsPerHour) {
        return calculateHoursForActions(actionCount, actionsPerHour) * SECONDS_PER_HOUR;
    }

    /**
     * Calculate profit per action from hourly profit data
     *
     * IMPORTANT: This assumes profitPerHour already includes efficiency.
     * The formula works because:
     * - profitPerHour = actionsPerHour × efficiencyMultiplier × profitPerItem
     * - profitPerHour / actionsPerHour = efficiencyMultiplier × profitPerItem
     * - This gives profit per ATTEMPT (what the queue shows)
     *
     * @param {number} profitPerHour - Profit per hour (includes efficiency)
     * @param {number} actionsPerHour - Base actions per hour (without efficiency)
     * @returns {number} Profit per action (0 if invalid input)
     *
     * @example
     * // With 150% efficiency (2.5x), 600 actions/hr, 50 profit/item:
     * // profitPerHour = 600 × 2.5 × 50 = 75,000
     * calculateProfitPerAction(75000, 600) // Returns 125 (profit per action)
     */
    function calculateProfitPerAction(profitPerHour, actionsPerHour) {
        if (!actionsPerHour || actionsPerHour <= 0) {
            return 0;
        }
        return profitPerHour / actionsPerHour;
    }

    /**
     * Calculate total profit for a number of actions
     *
     * @param {number} profitPerHour - Profit per hour (includes efficiency)
     * @param {number} actionsPerHour - Base actions per hour (without efficiency)
     * @param {number} actionCount - Number of queued actions
     * @returns {number} Total profit (0 if invalid input)
     *
     * @example
     * // Queue shows "Produce 100 times" with 75,000 profit/hr and 600 actions/hr
     * calculateTotalProfitForActions(75000, 600, 100) // Returns 12,500
     */
    function calculateTotalProfitForActions(profitPerHour, actionsPerHour, actionCount) {
        const profitPerAction = calculateProfitPerAction(profitPerHour, actionsPerHour);
        return profitPerAction * actionCount;
    }

    /**
     * Calculate profit per day from hourly profit
     * @param {number} profitPerHour - Profit per hour
     * @returns {number} Profit per day
     *
     * @example
     * calculateProfitPerDay(10000) // Returns 240,000
     */
    function calculateProfitPerDay(profitPerHour) {
        return profitPerHour * HOURS_PER_DAY;
    }

    /**
     * Calculate drink consumption rate with Drink Concentration
     * @param {number} drinkConcentration - Drink Concentration stat as decimal (e.g., 0.15 for 15%)
     * @returns {number} Drinks consumed per hour
     *
     * @example
     * calculateDrinksPerHour(0)    // Returns 12 (base rate)
     * calculateDrinksPerHour(0.15) // Returns 13.8 (12 × 1.15)
     */
    function calculateDrinksPerHour(drinkConcentration = 0) {
        return DRINKS_PER_HOUR_BASE * (1 + drinkConcentration);
    }

    /**
     * Calculate tea consumption costs per hour
     * @param {Object} params - Tea cost inputs
     * @param {Array} params.drinkSlots - Equipped drink slots
     * @param {number} params.drinkConcentration - Drink Concentration stat as decimal
     * @param {Object} params.itemDetailMap - Item detail map for names
     * @param {Function} params.getItemPrice - Price resolver function
     * @returns {Object} Tea costs breakdown
     */
    function calculateTeaCostsPerHour({
        drinkSlots = [],
        drinkConcentration = 0,
        itemDetailMap = {},
        getItemPrice,
    }) {
        if (!Array.isArray(drinkSlots) || drinkSlots.length === 0) {
            return {
                costs: [],
                totalCostPerHour: 0,
                hasMissingPrices: false,
                drinksPerHour: calculateDrinksPerHour(drinkConcentration),
            };
        }

        const drinksPerHour = calculateDrinksPerHour(drinkConcentration);

        const costs = drinkSlots.reduce((entries, drink) => {
            if (!drink || !drink.itemHrid) {
                return entries;
            }

            const itemDetails = itemDetailMap[drink.itemHrid];
            const itemName = itemDetails?.name || 'Unknown';
            const price =
                typeof getItemPrice === 'function'
                    ? getItemPrice(drink.itemHrid, { context: 'profit', side: 'buy' })
                    : null;
            const isPriceMissing = price === null;
            const resolvedPrice = isPriceMissing ? 0 : price;
            const totalCost = resolvedPrice * drinksPerHour;

            entries.push({
                itemHrid: drink.itemHrid,
                itemName,
                pricePerDrink: resolvedPrice,
                drinksPerHour,
                totalCost,
                missingPrice: isPriceMissing,
            });

            return entries;
        }, []);

        const totalCostPerHour = costs.reduce((sum, entry) => sum + entry.totalCost, 0);
        const hasMissingPrices = costs.some((entry) => entry.missingPrice);

        return {
            costs,
            totalCostPerHour,
            hasMissingPrices,
            drinksPerHour,
        };
    }

    /**
     * Calculate price after marketplace tax
     * @param {number} price - Price before tax
     * @param {number} [taxRate=MARKET_TAX] - Tax rate (e.g., 0.05 for 5%)
     * @returns {number} Price after tax deduction
     *
     * @example
     * calculatePriceAfterTax(100) // Returns 98
     */
    function calculatePriceAfterTax(price, taxRate = MARKET_TAX) {
        return price * (1 - taxRate);
    }

    /**
     * Create a memoized price lookup closure backed by a fresh Map per calculation.
     * Caches results keyed on itemHrid + side + enhancementLevel to avoid redundant
     * market API calls within a single profit calculation pass.
     *
     * @param {Function} getItemPriceFn - Price resolver function (itemHrid, options) => number|null
     * @returns {Function} getCachedPrice(itemHrid, options) closure
     *
     * @example
     * const getCachedPrice = createPriceCache(getItemPrice);
     * const price = getCachedPrice('/items/cotton', { context: 'profit', side: 'sell' });
     */
    function createPriceCache(getItemPriceFn) {
        const priceCache = new Map();

        return function getCachedPrice(itemHrid, options) {
            const side = options?.side || '';
            const enhancementLevel = options?.enhancementLevel ?? '';
            const cacheKey = `${itemHrid}|${side}|${enhancementLevel}`;

            if (priceCache.has(cacheKey)) {
                return priceCache.get(cacheKey);
            }

            const price = getItemPriceFn(itemHrid, options);
            priceCache.set(cacheKey, price);
            return price;
        };
    }

    /**
     * Calculate action-based totals for production actions
     * Uses per-action base inputs (efficiency only affects time)
     *
     * @param {Object} params - Calculation parameters
     * @param {number} params.actionsCount - Number of queued actions
     * @param {number} params.actionsPerHour - Base actions per hour
     * @param {number} params.outputAmount - Items produced per action
     * @param {number} params.outputPrice - Output price per item (pre-tax)
     * @param {number} params.gourmetBonus - Gourmet bonus as decimal (e.g., 0.1 for 10%)
     * @param {Array} [params.bonusDrops] - Bonus drop entries with revenuePerAction
     * @param {Array} [params.materialCosts] - Material cost entries per action
     * @param {number} params.totalTeaCostPerHour - Tea cost per hour
     * @param {number} [params.efficiencyMultiplier=1] - Efficiency multiplier for time scaling
     * @returns {Object} Totals and time values
     */
    function calculateProductionActionTotalsFromBase({
        actionsCount,
        actionsPerHour,
        outputAmount,
        outputPrice,
        gourmetBonus,
        bonusDrops = [],
        materialCosts = [],
        totalTeaCostPerHour,
        efficiencyMultiplier = 1,
    }) {
        const effectiveActionsPerHour = calculateEffectiveActionsPerHour(actionsPerHour, efficiencyMultiplier);
        if (!effectiveActionsPerHour || effectiveActionsPerHour <= 0) {
            return {
                totalBaseItems: 0,
                totalGourmetItems: 0,
                totalBaseRevenue: 0,
                totalGourmetRevenue: 0,
                totalBonusRevenue: 0,
                totalRevenue: 0,
                totalMarketTax: 0,
                totalMaterialCost: 0,
                totalTeaCost: 0,
                totalCosts: 0,
                totalProfit: 0,
                hoursNeeded: 0,
            };
        }
        // actionsCount represents completed actions (including efficiency repeats), so no
        // additional efficiencyMultiplier scaling is needed — it's already baked into the count.
        const totalBaseItems = outputAmount * actionsCount;
        const totalGourmetItems = outputAmount * gourmetBonus * actionsCount;
        const totalBaseRevenue = totalBaseItems * outputPrice;
        const totalGourmetRevenue = totalGourmetItems * outputPrice;
        const totalBonusRevenue = bonusDrops.reduce((sum, drop) => sum + (drop.revenuePerAction || 0) * actionsCount, 0);
        const totalRevenue = totalBaseRevenue + totalGourmetRevenue + totalBonusRevenue;
        const totalMarketTax = totalRevenue * MARKET_TAX;
        const totalMaterialCost = materialCosts.reduce((sum, material) => sum + material.totalCost * actionsCount, 0);
        const hoursNeeded = calculateHoursForActions(actionsCount, effectiveActionsPerHour);
        const totalTeaCost = totalTeaCostPerHour * hoursNeeded;
        const totalCosts = totalMaterialCost + totalTeaCost + totalMarketTax;
        const totalProfit = totalRevenue - totalCosts;

        return {
            totalBaseItems,
            totalGourmetItems,
            totalBaseRevenue,
            totalGourmetRevenue,
            totalBonusRevenue,
            totalRevenue,
            totalMarketTax,
            totalMaterialCost,
            totalTeaCost,
            totalCosts,
            totalProfit,
            hoursNeeded,
        };
    }

    /**
     * Calculate action-based totals for gathering actions
     * Uses per-action base inputs (efficiency only affects time)
     *
     * @param {Object} params - Calculation parameters
     * @param {number} params.actionsCount - Number of queued actions
     * @param {number} params.actionsPerHour - Base actions per hour
     * @param {Array} [params.baseOutputs] - Base outputs with revenuePerAction
     * @param {Array} [params.bonusDrops] - Bonus drop entries with revenuePerAction
     * @param {number} params.processingRevenueBonusPerAction - Processing bonus per action
     * @param {number} params.gourmetRevenueBonusPerAction - Gourmet bonus revenue per action
     * @param {number} params.drinkCostPerHour - Drink costs per hour
     * @param {number} [params.efficiencyMultiplier=1] - Efficiency multiplier for time scaling
     * @returns {Object} Totals and time values
     */
    function calculateGatheringActionTotalsFromBase({
        actionsCount,
        actionsPerHour,
        baseOutputs = [],
        bonusDrops = [],
        processingRevenueBonusPerAction,
        gourmetRevenueBonusPerAction,
        drinkCostPerHour,
        efficiencyMultiplier = 1,
    }) {
        const effectiveActionsPerHour = calculateEffectiveActionsPerHour(actionsPerHour, efficiencyMultiplier);
        if (!effectiveActionsPerHour || effectiveActionsPerHour <= 0) {
            return {
                totalBaseRevenue: 0,
                totalBonusRevenue: 0,
                totalProcessingRevenue: 0,
                totalGourmetRevenue: 0,
                totalRevenue: 0,
                totalMarketTax: 0,
                totalDrinkCost: 0,
                totalCosts: 0,
                totalProfit: 0,
                hoursNeeded: 0,
            };
        }
        const totalBaseRevenue = baseOutputs.reduce(
            (sum, output) => sum + (output.revenuePerAction || 0) * actionsCount,
            0
        );
        const totalBonusRevenue = bonusDrops.reduce((sum, drop) => sum + (drop.revenuePerAction || 0) * actionsCount, 0);
        const totalProcessingRevenue = (processingRevenueBonusPerAction || 0) * actionsCount;
        const totalGourmetRevenue = (gourmetRevenueBonusPerAction || 0) * actionsCount;
        const totalRevenue = totalBaseRevenue + totalGourmetRevenue + totalBonusRevenue + totalProcessingRevenue;
        const totalMarketTax = totalRevenue * MARKET_TAX;
        const hoursNeeded = calculateHoursForActions(actionsCount, effectiveActionsPerHour);
        const totalDrinkCost = drinkCostPerHour * hoursNeeded;
        const totalCosts = totalDrinkCost + totalMarketTax;
        const totalProfit = totalRevenue - totalCosts;

        return {
            totalBaseRevenue,
            totalBonusRevenue,
            totalProcessingRevenue,
            totalGourmetRevenue,
            totalRevenue,
            totalMarketTax,
            totalDrinkCost,
            totalCosts,
            totalProfit,
            hoursNeeded,
        };
    }

    /**
     * Resolve the best available price for an item through the full resolution chain:
     * custom override → shop floor → market price → production cost fallback
     *
     * @param {string} itemHrid - Item HRID
     * @param {Object} options - Configuration options
     * @param {number} [options.enhancementLevel=0] - Enhancement level
     * @param {string} [options.mode] - Pricing mode ('ask'|'bid'|'average')
     * @param {string} [options.context] - Context for pricing mode ('profit'|'networth')
     * @param {string} [options.side='sell'] - Transaction side ('buy'|'sell')
     * @returns {{ price: number, custom: boolean, missing: boolean }}
     */
    function resolveItemPrice(itemHrid, options = {}) {
        const { enhancementLevel = 0, mode, context, side = 'sell' } = options;

        // 1. Custom override — absolute priority
        const customPrice = getCustomPrice(itemHrid, enhancementLevel, side);
        if (customPrice !== null) {
            return { price: customPrice, custom: true, missing: false };
        }

        // 2. Market price (via getItemPrice which handles pricing mode)
        const marketPrice = getItemPrice(itemHrid, { enhancementLevel, mode, context, side });

        // 3. Shop price floor (buy-side only)
        if (side === 'buy') {
            const shopCost = getShopCoinCost(itemHrid);
            if (shopCost > 0 && (marketPrice === null || shopCost < marketPrice)) {
                return { price: shopCost, custom: false, missing: false };
            }
        }

        if (marketPrice !== null) {
            return { price: marketPrice, custom: false, missing: false };
        }

        // 4. Production cost fallback
        const prodCost = getProductionCost(itemHrid, mode || getPricingMode(context, side));
        if (prodCost > 0) {
            return { price: prodCost, custom: false, missing: false };
        }

        // 5. No price found
        return { price: 0, custom: false, missing: true };
    }

    var profitHelpers = {
        // Rate conversions
        calculateActionsPerHour,
        calculateEffectiveActionsPerHour,
        calculateHoursForActions,
        calculateSecondsForActions,

        // Profit
        calculateProfitPerAction,
        calculateTotalProfitForActions,
        calculateProfitPerDay,

        // Costs
        calculateDrinksPerHour,
        calculateTeaCostsPerHour,
        calculatePriceAfterTax,
        createPriceCache,
        resolveItemPrice,

        calculateProductionActionTotalsFromBase,
        calculateGatheringActionTotalsFromBase,
    };

    var profitHelpers$1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        calculateActionsPerHour: calculateActionsPerHour,
        calculateDrinksPerHour: calculateDrinksPerHour,
        calculateEffectiveActionsPerHour: calculateEffectiveActionsPerHour,
        calculateGatheringActionTotalsFromBase: calculateGatheringActionTotalsFromBase,
        calculateHoursForActions: calculateHoursForActions,
        calculatePriceAfterTax: calculatePriceAfterTax,
        calculateProductionActionTotalsFromBase: calculateProductionActionTotalsFromBase,
        calculateProfitPerAction: calculateProfitPerAction,
        calculateProfitPerDay: calculateProfitPerDay,
        calculateSecondsForActions: calculateSecondsForActions,
        calculateTeaCostsPerHour: calculateTeaCostsPerHour,
        calculateTotalProfitForActions: calculateTotalProfitForActions,
        createPriceCache: createPriceCache,
        default: profitHelpers,
        resolveItemPrice: resolveItemPrice
    });

    /**
     * DOM Utilities Module
     * Helpers for DOM manipulation and element creation
     */


    // Compiled regex pattern (created once, reused for performance)
    const REGEX_TRANSFORM3D = /translate3d\(([^,]+),\s*([^,]+),\s*([^)]+)\)/;

    /**
     * Wait for an element to appear in the DOM
     * @param {string} selector - CSS selector
     * @param {number} timeout - Max wait time in ms (default: 10000)
     * @param {number} interval - Check interval in ms (default: 100)
     * @returns {Promise<Element|null>} The element or null if timeout
     */
    function waitForElement(selector, timeout = 10000, interval = 100) {
        return new Promise((resolve) => {
            const startTime = Date.now();

            const check = () => {
                const element = document.querySelector(selector);

                if (element) {
                    resolve(element);
                } else if (Date.now() - startTime >= timeout) {
                    console.warn(`[DOM] Timeout waiting for: ${selector}`);
                    resolve(null);
                } else {
                    setTimeout(check, interval);
                }
            };

            check();
        });
    }

    /**
     * Wait for multiple elements to appear
     * @param {string} selector - CSS selector
     * @param {number} minCount - Minimum number of elements to wait for (default: 1)
     * @param {number} timeout - Max wait time in ms (default: 10000)
     * @returns {Promise<NodeList|null>} The elements or null if timeout
     */
    function waitForElements(selector, minCount = 1, timeout = 10000) {
        return new Promise((resolve) => {
            const startTime = Date.now();

            const check = () => {
                const elements = document.querySelectorAll(selector);

                if (elements.length >= minCount) {
                    resolve(elements);
                } else if (Date.now() - startTime >= timeout) {
                    console.warn(`[DOM] Timeout waiting for ${minCount}× ${selector}`);
                    resolve(null);
                } else {
                    setTimeout(check, 100);
                }
            };

            check();
        });
    }

    /**
     * Create a styled div element
     * @param {Object} styles - CSS styles object
     * @param {string} text - Optional text content
     * @param {string} className - Optional class name
     * @returns {HTMLDivElement} Created div
     */
    function createStyledDiv(styles = {}, text = '', className = '') {
        const div = document.createElement('div');

        if (className) {
            div.className = className;
        }

        if (text) {
            div.textContent = text;
        }

        Object.assign(div.style, styles);

        return div;
    }

    /**
     * Create a styled span element
     * @param {Object} styles - CSS styles object
     * @param {string} text - Text content
     * @param {string} className - Optional class name
     * @returns {HTMLSpanElement} Created span
     */
    function createStyledSpan(styles = {}, text = '', className = '') {
        const span = document.createElement('span');

        if (className) {
            span.className = className;
        }

        if (text) {
            span.textContent = text;
        }

        Object.assign(span.style, styles);

        return span;
    }

    /**
     * Create a colored text span (uses script colors from config)
     * @param {string} text - Text content
     * @param {string} colorType - 'main', 'tooltip', or 'alert' (default: 'main')
     * @returns {HTMLSpanElement} Created span with color
     */
    function createColoredText(text, colorType = 'main') {
        let color;

        switch (colorType) {
            case 'main':
                color = config.SCRIPT_COLOR_MAIN;
                break;
            case 'tooltip':
                color = config.SCRIPT_COLOR_TOOLTIP;
                break;
            case 'alert':
                color = config.SCRIPT_COLOR_ALERT;
                break;
            default:
                color = config.SCRIPT_COLOR_MAIN;
        }

        return createStyledSpan({ color }, text);
    }

    /**
     * Insert element before another element
     * @param {Element} newElement - Element to insert
     * @param {Element} referenceElement - Element to insert before
     */
    function insertBefore(newElement, referenceElement) {
        if (!referenceElement?.parentNode) {
            console.warn('[DOM] Cannot insert: reference element has no parent');
            return;
        }

        referenceElement.parentNode.insertBefore(newElement, referenceElement);
    }

    /**
     * Insert element after another element
     * @param {Element} newElement - Element to insert
     * @param {Element} referenceElement - Element to insert after
     */
    function insertAfter(newElement, referenceElement) {
        if (!referenceElement?.parentNode) {
            console.warn('[DOM] Cannot insert: reference element has no parent');
            return;
        }

        referenceElement.parentNode.insertBefore(newElement, referenceElement.nextSibling);
    }

    /**
     * Remove all elements matching selector
     * @param {string} selector - CSS selector
     * @returns {number} Number of elements removed
     */
    function removeElements(selector) {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => el.parentNode?.removeChild(el));
        return elements.length;
    }

    /**
     * Get original text from element (strips our injected content)
     * @param {Element} element - Element to get text from
     * @returns {string} Original text content
     */
    function getOriginalText(element) {
        if (!element) return '';

        // Clone element to avoid modifying original
        const clone = element.cloneNode(true);

        // Remove inserted spans/divs (our injected content)
        clone.querySelectorAll('.insertedSpan, .script-injected').forEach((el) => el.remove());

        return clone.textContent.trim();
    }

    /**
     * Add CSS to page
     * @param {string} css - CSS rules to add
     * @param {string} id - Optional style element ID (for removal later)
     */
    function addStyles(css, id = '') {
        const style = document.createElement('style');

        if (id) {
            style.id = id;
        }

        style.textContent = css;
        document.head.appendChild(style);
    }

    /**
     * Remove CSS by ID
     * @param {string} id - Style element ID to remove
     */
    function removeStyles(id) {
        const style = document.getElementById(id);
        if (style) {
            style.remove();
        }
    }

    /**
     * Dismiss all open MUI tooltips by dispatching mouseleave events
     * Useful when DOM elements are reordered (e.g., sorting action panels)
     * which can cause tooltips to get "stuck" since no natural mouseleave fires
     */
    function dismissTooltips() {
        const tooltips = document.querySelectorAll('.MuiTooltip-popper');
        tooltips.forEach((tooltip) => {
            // Find the element that triggered this tooltip and dispatch mouseleave
            // MUI tooltips listen for mouseleave on the trigger element
            const triggerId = tooltip.id?.replace('-tooltip', '');
            if (triggerId) {
                const trigger = document.querySelector(`[aria-describedby="${tooltip.id}"]`);
                if (trigger) {
                    if (trigger.matches(':hover')) {
                        return;
                    }
                    trigger.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
                    trigger.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
                }
            }
        });
    }

    /**
     * Set up scroll listener to dismiss tooltips when scrolling
     * Prevents tooltips from getting stuck when scrolling quickly
     * @returns {Function} Cleanup function to remove the listener
     */
    function setupScrollTooltipDismissal() {
        let scrollTimeout = null;
        let lastUserScrollTime = 0;
        const USER_SCROLL_WINDOW_MS = 200;

        const markUserScroll = () => {
            lastUserScrollTime = Date.now();
        };

        const handleUserKeyScroll = (event) => {
            const key = event.key;
            if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'PageUp' || key === 'PageDown' || key === ' ') {
                markUserScroll();
            }
        };

        const handleScroll = (event) => {
            const target = event.target;
            if (target?.closest?.('.MuiTooltip-tooltip, .MuiTooltip-popper')) {
                return;
            }

            if (Date.now() - lastUserScrollTime > USER_SCROLL_WINDOW_MS) {
                return;
            }

            // Early exit: skip if no tooltips are visible
            if (!document.querySelector('.MuiTooltip-popper')) {
                return;
            }

            // Debounce: only dismiss after scrolling stops for 50ms
            // This prevents excessive calls during continuous scrolling
            if (scrollTimeout) {
                clearTimeout(scrollTimeout);
            }
            scrollTimeout = setTimeout(() => {
                dismissTooltips();
                scrollTimeout = null;
            }, 50);
        };

        // Listen on document with capture to catch all scroll events
        // (including scrolls in nested containers)
        document.addEventListener('scroll', handleScroll, { capture: true, passive: true });

        // Track user-driven scrolling intent
        document.addEventListener('wheel', markUserScroll, { capture: true, passive: true });
        document.addEventListener('touchmove', markUserScroll, { capture: true, passive: true });
        document.addEventListener('keydown', handleUserKeyScroll, { capture: true });

        // Return cleanup function
        return () => {
            document.removeEventListener('scroll', handleScroll, { capture: true });
            document.removeEventListener('wheel', markUserScroll, { capture: true });
            document.removeEventListener('touchmove', markUserScroll, { capture: true });
            document.removeEventListener('keydown', handleUserKeyScroll, { capture: true });
            if (scrollTimeout) {
                clearTimeout(scrollTimeout);
            }
        };
    }

    /**
     * Fix tooltip overflow to ensure it stays within viewport
     * @param {Element} tooltipElement - The tooltip popper element
     * @param {Object} [options={}]
     * @param {boolean} [options.forceTop=false] - Pin the tooltip centered at the top of the viewport
     */
    function fixTooltipOverflow(tooltipElement, { forceTop = false } = {}) {
        // Use triple requestAnimationFrame to ensure MUI positioning is complete
        // Frame 1: MUI does initial positioning
        // Frame 2: Content finishes rendering (especially for long lists)
        // Frame 3: We check and fix overflow
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (!tooltipElement.isConnected) {
                        return; // Tooltip already removed
                    }

                    const bBox = tooltipElement.getBoundingClientRect();
                    const viewportHeight = window.innerHeight;
                    const viewportWidth = window.innerWidth;

                    // Find the actual tooltip content element (child of popper)
                    const tooltipContent = tooltipElement.querySelector('.MuiTooltip-tooltip');

                    if (forceTop) {
                        // Use position:fixed to place tooltip at top-center, bypassing
                        // MUI's transform-based positioning which breaks at low browser
                        // zoom levels (the offset parent may not be at viewport origin).
                        const targetTop = 10;
                        const targetLeft = Math.round((viewportWidth - bBox.width) / 2);

                        tooltipElement.style.position = 'fixed';
                        tooltipElement.style.top = `${targetTop}px`;
                        tooltipElement.style.left = `${targetLeft}px`;
                        tooltipElement.style.transform = 'none';

                        // Cap height if tooltip is taller than viewport
                        if (tooltipContent && bBox.height >= viewportHeight - 20) {
                            tooltipContent.style.maxHeight = `${viewportHeight - 20}px`;
                            tooltipContent.style.overflowY = 'auto';
                        }
                        return;
                    }

                    // Check if tooltip extends beyond viewport
                    if (bBox.top < 0 || bBox.bottom > viewportHeight) {
                        // Get current transform
                        const transformString = tooltipElement.style.transform;

                        if (transformString) {
                            // Parse transform3d(x, y, z)
                            const match = transformString.match(REGEX_TRANSFORM3D);

                            if (match) {
                                const x = match[1];
                                const currentY = parseFloat(match[2]);
                                const z = match[3];

                                // Calculate how much to adjust Y
                                let newY;

                                if (bBox.height >= viewportHeight - 20) {
                                    // Tooltip is taller than viewport - position at top
                                    newY = 0;

                                    // Force max-height on the tooltip content to enable scrolling
                                    if (tooltipContent) {
                                        tooltipContent.style.maxHeight = `${viewportHeight - 20}px`;
                                        tooltipContent.style.overflowY = 'auto';
                                    }
                                } else if (bBox.top < 0) {
                                    // Tooltip extends above viewport - move it down
                                    newY = currentY - bBox.top;
                                } else if (bBox.bottom > viewportHeight) {
                                    // Tooltip extends below viewport - move it up
                                    newY = currentY - (bBox.bottom - viewportHeight) - 10;
                                }

                                if (newY !== undefined) {
                                    // Ensure tooltip never goes above viewport (minimum y=0)
                                    newY = Math.max(0, newY);
                                    tooltipElement.style.transform = `translate3d(${x}, ${newY}px, ${z})`;
                                }
                            }
                        }
                    }
                });
            });
        });
    }

    var dom = {
        waitForElement,
        waitForElements,
        createStyledDiv,
        createStyledSpan,
        createColoredText,
        insertBefore,
        insertAfter,
        removeElements,
        getOriginalText,
        addStyles,
        removeStyles,
        dismissTooltips,
        setupScrollTooltipDismissal,
        fixTooltipOverflow,
    };

    var dom$1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        addStyles: addStyles,
        createColoredText: createColoredText,
        createStyledDiv: createStyledDiv,
        createStyledSpan: createStyledSpan,
        default: dom,
        dismissTooltips: dismissTooltips,
        fixTooltipOverflow: fixTooltipOverflow,
        getOriginalText: getOriginalText,
        insertAfter: insertAfter,
        insertBefore: insertBefore,
        removeElements: removeElements,
        removeStyles: removeStyles,
        setupScrollTooltipDismissal: setupScrollTooltipDismissal,
        waitForElement: waitForElement,
        waitForElements: waitForElements
    });

    /**
     * DOM Observer Helper Utilities
     * Standardized wrappers around domObserver to reduce boilerplate
     */


    /**
     * Create a singleton observer that automatically prevents duplicate processing
     * Uses an internal WeakSet to track processed elements
     *
     * @param {string} name - Observer name for debugging
     * @param {string|string[]} classNames - Class name(s) to watch for
     * @param {Function} handler - Handler function (receives element)
     * @param {Object} options - Optional configuration
     * @param {boolean} options.debounce - Enable debouncing
     * @param {number} options.debounceDelay - Debounce delay in ms
     * @returns {Function} Unregister function
     *
     * @example
     * // Before (20 lines)
     * this.processedDivs = new WeakSet();
     * this.unregister = domObserver.onClass('MyFeature', 'selector', (elem) => {
     *     if (this.processedDivs.has(elem)) return;
     *     this.processedDivs.add(elem);
     *     // do work
     * });
     *
     * // After (5 lines)
     * this.unregister = createSingletonObserver('MyFeature', 'selector', (elem) => {
     *     // do work (processed flag automatic)
     * });
     */
    function createSingletonObserver(name, classNames, handler, options = {}) {
        const processedElements = new WeakSet();

        return domObserver.onClass(
            name,
            classNames,
            (element) => {
                if (processedElements.has(element)) {
                    return;
                }

                // Mark as processed
                processedElements.add(element);

                // Call user handler
                handler(element);
            },
            options
        );
    }

    /**
     * Create a tracked observer that manages cleanup functions for processed elements
     * Uses an internal Map to track element → cleanup function pairs
     * Automatically calls cleanup functions when unregistered
     *
     * @param {string} name - Observer name for debugging
     * @param {string|string[]} classNames - Class name(s) to watch for
     * @param {Function} handler - Handler function (receives element, should return cleanup function or null)
     * @param {Object} options - Optional configuration
     * @param {boolean} options.debounce - Enable debouncing
     * @param {number} options.debounceDelay - Debounce delay in ms
     * @returns {Function} Unregister function (also calls all cleanup functions)
     *
     * @example
     * // Before (15 lines)
     * this.trackedElements = new Map();
     * this.unregister = domObserver.onClass('MyFeature', 'selector', (elem) => {
     *     if (this.trackedElements.has(elem)) return;
     *     const cleanup = attachListeners(...);
     *     this.trackedElements.set(elem, cleanup);
     * });
     *
     * // After (5 lines)
     * this.unregister = createTrackedObserver('MyFeature', 'selector', (elem) => {
     *     return attachListeners(...); // Return cleanup function
     * });
     */
    function createTrackedObserver(name, classNames, handler, options = {}) {
        const trackedElements = new Map();

        const unregister = domObserver.onClass(
            name,
            classNames,
            (element) => {
                // Skip if already tracked
                if (trackedElements.has(element)) {
                    return;
                }

                // Call user handler and store cleanup function
                const cleanup = handler(element);
                if (cleanup && typeof cleanup === 'function') {
                    trackedElements.set(element, cleanup);
                } else {
                    // Mark as tracked even if no cleanup function returned
                    trackedElements.set(element, null);
                }
            },
            options
        );

        // Return enhanced unregister that also calls all cleanup functions
        return () => {
            // Call all cleanup functions
            for (const [_element, cleanup] of trackedElements.entries()) {
                if (cleanup && typeof cleanup === 'function') {
                    try {
                        cleanup();
                    } catch (error) {
                        console.error(`[DOM Observer Helpers] Cleanup error for ${name}:`, error);
                    }
                }
            }

            // Clear tracked elements
            trackedElements.clear();

            unregister();
        };
    }

    /**
     * Create a simplified MutationObserver with automatic cleanup
     * Wrapper around native MutationObserver that returns unwatch function
     *
     * @param {Element} element - Element to observe
     * @param {Function} callback - Callback function (receives mutations, observer)
     * @param {Object} options - MutationObserver options (default: { childList: true, subtree: true })
     * @returns {Function} Unwatch function (disconnects observer)
     *
     * @example
     * // Before (25 lines)
     * let observer = null;
     * const cleanup = () => {
     *     if (observer) {
     *         observer.disconnect();
     *         observer = null;
     *     }
     * };
     * observer = new MutationObserver(() => { ... });
     * observer.observe(element, { childList: true });
     *
     * // After (5 lines)
     * const unwatch = createMutationWatcher(element, () => {
     *     // callback
     * }, { childList: true });
     */
    function createMutationWatcher(element, callback, options = null) {
        if (!element) {
            console.warn('[DOM Observer Helpers] createMutationWatcher called with null element');
            return () => {}; // Return no-op unwatch function
        }

        // Default options
        const observerOptions = options || {
            childList: true,
            subtree: true,
        };

        const observer = new MutationObserver((mutations) => {
            callback(mutations, observer);
        });

        observer.observe(element, observerOptions);

        // Return unwatch function
        return () => {
            observer.disconnect();
        };
    }

    /**
     * Create a persistent display helper
     * Handles cleanup and re-creation of DOM elements on re-render
     *
     * @param {string} name - Helper name for debugging
     * @param {string|string[]} classNames - Class name(s) to watch for
     * @param {Function} createFn - Function to create display element (receives container)
     * @param {Object} options - Optional configuration
     * @param {boolean} options.debounce - Enable debouncing
     * @param {number} options.debounceDelay - Debounce delay in ms
     * @returns {Function} Unregister function
     *
     * @example
     * this.unregister = createPersistentDisplay(
     *     'MyDisplay',
     *     'container-class',
     *     (container) => {
     *         const display = document.createElement('div');
     *         display.className = 'my-display';
     *         display.textContent = 'Hello';
     *         container.appendChild(display);
     *     }
     * );
     */
    function createPersistentDisplay(name, classNames, createFn, options = {}) {
        return createSingletonObserver(
            name,
            classNames,
            (container) => {
                try {
                    createFn(container);
                } catch (error) {
                    console.error(`[DOM Observer Helpers] createPersistentDisplay error for ${name}:`, error);
                }
            },
            options
        );
    }

    var domObserverHelpers = /*#__PURE__*/Object.freeze({
        __proto__: null,
        createMutationWatcher: createMutationWatcher,
        createPersistentDisplay: createPersistentDisplay,
        createSingletonObserver: createSingletonObserver,
        createTrackedObserver: createTrackedObserver
    });

    /**
     * Timer Registry Utility
     * Centralized registration for intervals and timeouts.
     */

    /**
     * Create a timer registry for deterministic teardown.
     * @returns {{
     *   registerInterval: (intervalId: number) => void,
     *   registerTimeout: (timeoutId: number) => void,
     *   clearAll: () => void
     * }} Timer registry API
     */
    function createTimerRegistry() {
        const intervals = [];
        const timeouts = [];

        const registerInterval = (intervalId) => {
            if (!intervalId) {
                console.warn('[TimerRegistry] registerInterval called with invalid interval id');
                return;
            }

            intervals.push(intervalId);
        };

        const registerTimeout = (timeoutId) => {
            if (!timeoutId) {
                console.warn('[TimerRegistry] registerTimeout called with invalid timeout id');
                return;
            }

            timeouts.push(timeoutId);
        };

        const clearAll = () => {
            intervals.forEach((intervalId) => {
                try {
                    clearInterval(intervalId);
                } catch (error) {
                    console.error('[TimerRegistry] Failed to clear interval:', error);
                }
            });
            intervals.length = 0;

            timeouts.forEach((timeoutId) => {
                try {
                    clearTimeout(timeoutId);
                } catch (error) {
                    console.error('[TimerRegistry] Failed to clear timeout:', error);
                }
            });
            timeouts.length = 0;
        };

        return {
            registerInterval,
            registerTimeout,
            clearAll,
        };
    }

    var timerRegistry = /*#__PURE__*/Object.freeze({
        __proto__: null,
        createTimerRegistry: createTimerRegistry
    });

    /**
     * Token Valuation Utility
     * Shared logic for calculating dungeon token and task token values
     */


    /**
     * Calculate dungeon token value based on best shop item value
     * Uses "best market value per token" approach: finds the shop item with highest (market price / token cost)
     * @param {string} tokenHrid - Token HRID (e.g., '/items/chimerical_token')
     * @param {string} pricingModeSetting - Config setting key for pricing mode (default: 'profitCalc_pricingMode')
     * @param {string} respectModeSetting - Config setting key for respect pricing mode flag (default: 'expectedValue_respectPricingMode')
     * @returns {number|null} Value per token, or null if no data
     */
    function calculateDungeonTokenValue(
        tokenHrid,
        pricingModeSetting = 'profitCalc_pricingMode',
        respectModeSetting = 'expectedValue_respectPricingMode'
    ) {
        const gameData = dataManager.getInitClientData();
        if (!gameData) return null;

        // Get all shop items for this token type
        const shopItems = Object.values(gameData.shopItemDetailMap || {}).filter(
            (item) => item.costs && item.costs[0]?.itemHrid === tokenHrid
        );

        if (shopItems.length === 0) return null;

        let bestValuePerToken = 0;

        // For each shop item, calculate market price / token cost
        for (const shopItem of shopItems) {
            const itemHrid = shopItem.itemHrid;
            const tokenCost = shopItem.costs[0].count;

            // Get market price for this item
            const prices = marketAPI.getPrice(itemHrid, 0);
            if (!prices) continue;

            // Use pricing mode to determine which price to use
            const pricingMode = config.getSettingValue(pricingModeSetting, 'conservative');
            const respectPricingMode = config.getSettingValue(respectModeSetting, true);

            let marketPrice = 0;
            if (respectPricingMode) {
                // Conservative/Patient Buy: Bid, Hybrid/Optimistic: Ask
                marketPrice = pricingMode === 'conservative' || pricingMode === 'patientBuy' ? prices.bid : prices.ask;
            } else {
                // Always conservative
                marketPrice = prices.bid;
            }

            if (marketPrice <= 0) continue;

            // Calculate value per token
            const valuePerToken = marketPrice / tokenCost;

            // Keep track of best value
            if (valuePerToken > bestValuePerToken) {
                bestValuePerToken = valuePerToken;
            }
        }

        // Fallback to essence price if no shop items found
        if (bestValuePerToken === 0) {
            const essenceMap = {
                '/items/chimerical_token': '/items/chimerical_essence',
                '/items/sinister_token': '/items/sinister_essence',
                '/items/enchanted_token': '/items/enchanted_essence',
                '/items/pirate_token': '/items/pirate_essence',
            };

            const essenceHrid = essenceMap[tokenHrid];
            if (essenceHrid) {
                const essencePrice = marketAPI.getPrice(essenceHrid, 0);
                if (essencePrice) {
                    const pricingMode = config.getSettingValue(pricingModeSetting, 'conservative');
                    const respectPricingMode = config.getSettingValue(respectModeSetting, true);

                    let marketPrice = 0;
                    if (respectPricingMode) {
                        marketPrice =
                            pricingMode === 'conservative' || pricingMode === 'patientBuy'
                                ? essencePrice.bid
                                : essencePrice.ask;
                    } else {
                        marketPrice = essencePrice.bid;
                    }

                    return marketPrice > 0 ? marketPrice : null;
                }
            }
        }

        return bestValuePerToken > 0 ? bestValuePerToken : null;
    }

    /**
     * Calculate task token value based on best chest expected value
     * @returns {number} Value per token, or 0 if no data
     */
    function calculateTaskTokenValue() {
        const gameData = dataManager.getInitClientData();
        if (!gameData) return 0;

        // Get all chest items (Large Artisan's Crate, Large Meteorite Cache, Large Treasure Chest)
        const chestHrids = ['/items/large_artisans_crate', '/items/large_meteorite_cache', '/items/large_treasure_chest'];

        const bestChestValue = 0;

        for (const chestHrid of chestHrids) {
            const itemDetails = dataManager.getItemDetails(chestHrid);
            if (!itemDetails || !itemDetails.isOpenable) continue;

            // Calculate expected value for this chest
            // Note: This would require expectedValueCalculator, but to avoid circular dependency,
            // we'll let the caller handle this or import it locally where needed
            // For now, return 0 as placeholder
        }

        // Task Token cost for chests is 30
        const tokenCost = 30;

        return bestChestValue / tokenCost;
    }

    var tokenValuation = /*#__PURE__*/Object.freeze({
        __proto__: null,
        calculateDungeonTokenValue: calculateDungeonTokenValue,
        calculateTaskTokenValue: calculateTaskTokenValue
    });

    /**
     * Worker Pool Manager
     * Manages a pool of Web Workers for parallel task execution
     */

    class WorkerPool {
        constructor(workerScript, poolSize = null) {
            // Auto-detect optimal pool size (max 4 workers)
            this.poolSize = poolSize || Math.min(navigator.hardwareConcurrency || 2, 4);
            this.workerScript = workerScript;
            this.workers = [];
            this.taskQueue = [];
            this.activeWorkers = new Set();
            this.nextTaskId = 0;
            this.initialized = false;
        }

        /**
         * Initialize the worker pool
         */
        async initialize() {
            if (this.initialized) {
                return;
            }

            try {
                // Create workers
                for (let i = 0; i < this.poolSize; i++) {
                    const worker = new Worker(URL.createObjectURL(this.workerScript));
                    this.workers.push({
                        id: i,
                        worker,
                        busy: false,
                        currentTask: null,
                    });
                }

                this.initialized = true;
            } catch (error) {
                console.error('[WorkerPool] Failed to initialize:', error);
                throw error;
            }
        }

        /**
         * Execute a task in the worker pool
         * @param {Object} taskData - Data to send to worker
         * @returns {Promise} Promise that resolves with worker result
         */
        async execute(taskData) {
            if (!this.initialized) {
                await this.initialize();
            }

            return new Promise((resolve, reject) => {
                const taskId = this.nextTaskId++;
                const task = {
                    id: taskId,
                    data: taskData,
                    resolve,
                    reject,
                    timestamp: Date.now(),
                };

                // Try to assign to an available worker immediately
                const availableWorker = this.workers.find((w) => !w.busy);

                if (availableWorker) {
                    this.assignTask(availableWorker, task);
                } else {
                    // Queue the task if all workers are busy
                    this.taskQueue.push(task);
                }
            });
        }

        /**
         * Execute multiple tasks in parallel
         * @param {Array} taskDataArray - Array of task data objects
         * @returns {Promise<Array>} Promise that resolves with array of results
         */
        async executeAll(taskDataArray) {
            if (!this.initialized) {
                await this.initialize();
            }

            const promises = taskDataArray.map((taskData) => this.execute(taskData));
            return Promise.all(promises);
        }

        /**
         * Assign a task to a worker
         * @private
         */
        assignTask(workerWrapper, task) {
            workerWrapper.busy = true;
            workerWrapper.currentTask = task;

            // Set up message handler for this specific task
            const messageHandler = (e) => {
                const { taskId, result, error } = e.data;

                if (taskId === task.id) {
                    // Clean up
                    workerWrapper.worker.removeEventListener('message', messageHandler);
                    workerWrapper.worker.removeEventListener('error', errorHandler);
                    workerWrapper.busy = false;
                    workerWrapper.currentTask = null;

                    // Resolve or reject the promise
                    if (error) {
                        task.reject(new Error(error));
                    } else {
                        task.resolve(result);
                    }

                    // Process next task in queue
                    this.processQueue();
                }
            };

            const errorHandler = (error) => {
                console.error('[WorkerPool] Worker error:', error);
                workerWrapper.worker.removeEventListener('message', messageHandler);
                workerWrapper.worker.removeEventListener('error', errorHandler);
                workerWrapper.busy = false;
                workerWrapper.currentTask = null;

                task.reject(error);

                // Process next task in queue
                this.processQueue();
            };

            workerWrapper.worker.addEventListener('message', messageHandler);
            workerWrapper.worker.addEventListener('error', errorHandler);

            // Send task to worker
            workerWrapper.worker.postMessage({
                taskId: task.id,
                data: task.data,
            });
        }

        /**
         * Process the next task in the queue
         * @private
         */
        processQueue() {
            if (this.taskQueue.length === 0) {
                return;
            }

            const availableWorker = this.workers.find((w) => !w.busy);
            if (availableWorker) {
                const task = this.taskQueue.shift();
                this.assignTask(availableWorker, task);
            }
        }

        /**
         * Get pool statistics
         */
        getStats() {
            return {
                poolSize: this.poolSize,
                busyWorkers: this.workers.filter((w) => w.busy).length,
                queuedTasks: this.taskQueue.length,
                totalWorkers: this.workers.length,
            };
        }

        /**
         * Terminate all workers and clean up
         */
        terminate() {
            for (const workerWrapper of this.workers) {
                workerWrapper.worker.terminate();
            }

            this.workers = [];
            this.taskQueue = [];
            this.initialized = false;
        }
    }

    /**
     * Expected Value Calculator Worker Manager
     * Manages a worker pool for parallel EV container calculations
     */


    // Worker pool instance
    let workerPool = null;

    // Worker script as inline string
    const WORKER_SCRIPT = `
// Cache for EV calculation results
const evCache = new Map();

/**
 * Calculate expected value for a single container
 * @param {Object} data - Container calculation data
 * @returns {Object} {containerHrid, ev}
 */
function calculateContainerEV(data) {
    const { containerHrid, dropTable, priceMap, COIN_HRID, MARKET_TAX } = data;

    if (!dropTable || dropTable.length === 0) {
        return { containerHrid, ev: null };
    }

    let totalExpectedValue = 0;

    // Calculate expected value for each drop
    for (const drop of dropTable) {
        const itemHrid = drop.itemHrid;
        const dropRate = drop.dropRate || 0;
        const minCount = drop.minCount || 0;
        const maxCount = drop.maxCount || 0;

        // Skip invalid drops
        if (dropRate <= 0 || (minCount === 0 && maxCount === 0)) {
            continue;
        }

        // Calculate average drop count
        const avgCount = (minCount + maxCount) / 2;

        // Get price for this drop
        const priceData = priceMap[itemHrid];
        if (!priceData || priceData.price === null) {
            continue; // Skip drops with missing data
        }

        const price = priceData.price;
        const canBeSold = priceData.canBeSold;
        const isCoin = itemHrid === COIN_HRID;

        // Calculate drop value with tax
        const dropValue = isCoin
            ? avgCount * dropRate * price
            : canBeSold
              ? avgCount * dropRate * price * (1 - MARKET_TAX)
              : avgCount * dropRate * price;

        totalExpectedValue += dropValue;
    }

    return { containerHrid, ev: totalExpectedValue };
}

/**
 * Calculate EV for a batch of containers
 * @param {Array} containers - Array of container data objects
 * @returns {Array} Array of {containerHrid, ev} results
 */
function calculateBatchEV(containers) {
    const results = [];

    for (const container of containers) {
        const result = calculateContainerEV(container);
        if (result.ev !== null) {
            evCache.set(result.containerHrid, result.ev);
        }
        results.push(result);
    }

    return results;
}

self.onmessage = function (e) {
    const { taskId, data } = e.data;
    try {
        const { action, params } = data;

        if (action === 'calculateBatch') {
            const results = calculateBatchEV(params.containers);
            self.postMessage({ taskId, result: results });
        } else if (action === 'clearCache') {
            evCache.clear();
            self.postMessage({ taskId, result: { success: true, message: 'Cache cleared' } });
        } else {
            throw new Error(\`Unknown action: \${action}\`);
        }
    } catch (error) {
        self.postMessage({ taskId, error: error.message || String(error) });
    }
};
`;

    /**
     * Get or create the worker pool instance
     */
    async function getWorkerPool() {
        if (workerPool) {
            return workerPool;
        }

        try {
            // Create worker blob from inline script
            const blob = new Blob([WORKER_SCRIPT], { type: 'application/javascript' });

            // Initialize worker pool with 2-4 workers
            workerPool = new WorkerPool(blob);
            await workerPool.initialize();

            return workerPool;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Calculate EV for multiple containers in parallel
     * @param {Array} containers - Array of container data objects
     * @returns {Promise<Array>} Array of {containerHrid, ev} results
     */
    async function calculateEVBatch(containers) {
        const pool = await getWorkerPool();

        // Split containers into chunks for parallel processing
        const chunkSize = Math.ceil(containers.length / pool.getStats().poolSize);
        const chunks = [];

        for (let i = 0; i < containers.length; i += chunkSize) {
            chunks.push(containers.slice(i, i + chunkSize));
        }

        // Process chunks in parallel
        const tasks = chunks.map((chunk) => ({
            action: 'calculateBatch',
            params: { containers: chunk },
        }));

        const results = await pool.executeAll(tasks);

        // Flatten results
        return results.flat();
    }

    /**
     * Expected Value Calculator Module
     * Calculates expected value for openable containers
     */


    /**
     * ExpectedValueCalculator class handles EV calculations for openable containers
     */
    class ExpectedValueCalculator {
        constructor() {
            // Constants
            this.MARKET_TAX = MARKET_TAX;
            this.CONVERGENCE_ITERATIONS = 4; // Nested container convergence

            // Cache for container EVs
            this.containerCache = new Map();

            // Special item HRIDs
            this.COIN_HRID = '/items/coin';
            this.COWBELL_HRID = '/items/cowbell';
            this.COWBELL_BAG_HRID = '/items/bag_of_10_cowbells';

            // Dungeon token HRIDs
            this.DUNGEON_TOKENS = [
                '/items/chimerical_token',
                '/items/sinister_token',
                '/items/enchanted_token',
                '/items/pirate_token',
            ];

            // Flag to track if initialized
            this.isInitialized = false;

            // Retry handler reference for cleanup
            this.retryHandler = null;
        }

        /**
         * Initialize the calculator
         * Pre-calculates all openable containers with nested convergence
         */
        async initialize() {
            if (this.isInitialized) {
                return true;
            }

            if (!dataManager.getInitClientData()) {
                // Init data not yet available - set up retry on next character update
                if (!this.retryHandler) {
                    this.retryHandler = () => {
                        this.initialize(); // Retry initialization
                    };
                    dataManager.on('character_initialized', this.retryHandler);
                }
                return false;
            }

            // Data is available - remove retry handler if it exists
            if (this.retryHandler) {
                dataManager.off('character_initialized', this.retryHandler);
                this.retryHandler = null;
            }

            // Wait for market data to load
            if (!marketAPI.isLoaded()) {
                await marketAPI.fetch(true); // Force fresh fetch on init
            }

            // Calculate all containers with 4-iteration convergence for nesting (now async with workers)
            await this.calculateNestedContainers();

            this.isInitialized = true;

            // Notify listeners that calculator is ready
            dataManager.emit('expected_value_initialized', { timestamp: Date.now() });

            return true;
        }

        /**
         * Calculate all containers with nested convergence using workers
         * Iterates 4 times to resolve nested container values
         */
        async calculateNestedContainers() {
            const initData = dataManager.getInitClientData();
            if (!initData || !initData.openableLootDropMap) {
                return;
            }

            // Get all openable container HRIDs
            const containerHrids = Object.keys(initData.openableLootDropMap);

            // Iterate 4 times for convergence (handles nesting depth)
            for (let iteration = 0; iteration < this.CONVERGENCE_ITERATIONS; iteration++) {
                // Build price map for all items (includes cached container EVs from previous iterations)
                const priceMap = this.buildPriceMap(containerHrids, initData);

                // Prepare container data for workers
                const containerData = containerHrids.map((containerHrid) => ({
                    containerHrid,
                    dropTable: initData.openableLootDropMap[containerHrid],
                    priceMap,
                    COIN_HRID: this.COIN_HRID,
                    MARKET_TAX: this.MARKET_TAX,
                }));

                // Calculate all containers in parallel using workers
                try {
                    const results = await calculateEVBatch(containerData);

                    // Update cache with results
                    for (const result of results) {
                        if (result.ev !== null) {
                            this.containerCache.set(result.containerHrid, result.ev);
                        }
                    }
                } catch (error) {
                    // Worker failed, fall back to main thread calculation
                    console.warn('[ExpectedValueCalculator] Worker failed, falling back to main thread:', error);
                    for (const containerHrid of containerHrids) {
                        const ev = this.calculateSingleContainer(containerHrid, initData);
                        if (ev !== null) {
                            this.containerCache.set(containerHrid, ev);
                        }
                    }
                }
            }
        }

        /**
         * Build price map for all items needed for container calculations
         * @param {Array} containerHrids - Array of container HRIDs
         * @param {Object} initData - Game data
         * @returns {Object} Map of itemHrid to {price, canBeSold}
         */
        buildPriceMap(containerHrids, initData) {
            const priceMap = {};
            const processedItems = new Set();

            // Collect all unique items from all containers
            for (const containerHrid of containerHrids) {
                const dropTable = initData.openableLootDropMap[containerHrid];
                if (!dropTable) continue;

                for (const drop of dropTable) {
                    const itemHrid = drop.itemHrid;
                    if (processedItems.has(itemHrid)) continue;
                    processedItems.add(itemHrid);

                    // Get price and tradeable status
                    const price = this.getDropPrice(itemHrid);
                    const itemDetails = dataManager.getItemDetails(itemHrid);
                    const canBeSold = itemDetails?.isTradable !== false;

                    priceMap[itemHrid] = {
                        price,
                        canBeSold,
                    };
                }
            }

            return priceMap;
        }

        /**
         * Calculate expected value for a single container
         * @param {string} containerHrid - Container item HRID
         * @param {Object} initData - Cached game data (optional, will fetch if not provided)
         * @returns {number|null} Expected value or null if unavailable
         */
        calculateSingleContainer(containerHrid, initData = null) {
            // Use cached data if provided, otherwise fetch
            if (!initData) {
                initData = dataManager.getInitClientData();
            }
            if (!initData || !initData.openableLootDropMap) {
                return null;
            }

            // Get drop table for this container
            const dropTable = initData.openableLootDropMap[containerHrid];
            if (!dropTable || dropTable.length === 0) {
                return null;
            }

            let totalExpectedValue = 0;

            // Calculate expected value for each drop
            for (const drop of dropTable) {
                const itemHrid = drop.itemHrid;
                const dropRate = drop.dropRate || 0;
                const minCount = drop.minCount || 0;
                const maxCount = drop.maxCount || 0;

                // Skip invalid drops
                if (dropRate <= 0 || (minCount === 0 && maxCount === 0)) {
                    continue;
                }

                // Calculate average drop count
                const avgCount = (minCount + maxCount) / 2;

                // Get price for this drop
                const price = this.getDropPrice(itemHrid);

                if (price === null) {
                    continue; // Skip drops with missing data
                }

                // Check if item is tradeable (for tax calculation)
                const itemDetails = dataManager.getItemDetails(itemHrid);
                const canBeSold = itemDetails?.isTradable !== false;

                // Special case: Coin never has market tax (it's currency, not a market item)
                const isCoin = itemHrid === this.COIN_HRID;

                const dropValue = isCoin
                    ? avgCount * dropRate * price // No tax for coins
                    : canBeSold
                      ? calculatePriceAfterTax(avgCount * dropRate * price, this.MARKET_TAX)
                      : avgCount * dropRate * price;
                totalExpectedValue += dropValue;
            }

            // Cache the result for future lookups
            if (totalExpectedValue > 0) {
                this.containerCache.set(containerHrid, totalExpectedValue);
            }

            return totalExpectedValue;
        }

        /**
         * Get price for a drop item
         * Handles special cases (Coin, Cowbell, Dungeon Tokens, nested containers)
         * @param {string} itemHrid - Item HRID
         * @returns {number|null} Price or null if unavailable
         */
        getDropPrice(itemHrid) {
            // Special case: Coin (face value = 1)
            if (itemHrid === this.COIN_HRID) {
                return 1;
            }

            // Special case: Cowbell (use bag price ÷ 10, with 18% tax)
            if (itemHrid === this.COWBELL_HRID) {
                if (!config.getSetting('expectedValue_includeCowbells')) {
                    return 0;
                }
                // Get Cowbell Bag price using profit context (sell side - you're selling the bag)
                const bagValue = getItemPrice(this.COWBELL_BAG_HRID, { context: 'profit', side: 'sell' }) || 0;

                if (bagValue > 0) {
                    // Apply 18% market tax (Cowbell Bag only), then divide by 10
                    return calculatePriceAfterTax(bagValue, 0.18) / 10;
                }
                return null; // No bag price available
            }

            // Special case: Dungeon Tokens (calculate value from shop items)
            if (this.DUNGEON_TOKENS.includes(itemHrid)) {
                return calculateDungeonTokenValue(itemHrid, 'profitCalc_pricingMode', 'expectedValue_respectPricingMode');
            }

            // Check if this is a nested container (use cached EV)
            if (this.containerCache.has(itemHrid)) {
                return this.containerCache.get(itemHrid);
            }

            // Regular market item - get price based on pricing mode (sell side - you're selling drops)
            const dropPrice = getItemPrice(itemHrid, { enhancementLevel: 0, context: 'profit', side: 'sell' });
            return dropPrice > 0 ? dropPrice : null;
        }

        /**
         * Calculate expected value for an openable container
         * @param {string} itemHrid - Container item HRID
         * @returns {Object|null} EV data or null
         */
        calculateExpectedValue(itemHrid) {
            if (!this.isInitialized) {
                console.warn('[ExpectedValueCalculator] Not initialized');
                return null;
            }

            // Get item details
            const itemDetails = dataManager.getItemDetails(itemHrid);
            if (!itemDetails) {
                return null;
            }

            // Verify this is an openable container
            if (!itemDetails.isOpenable) {
                return null; // Not an openable container
            }

            // Get detailed drop breakdown (calculates with fresh market prices)
            const drops = this.getDropBreakdown(itemHrid);

            // Calculate total expected value from fresh drop data
            const expectedReturn = drops.reduce((sum, drop) => sum + drop.expectedValue, 0);

            return {
                itemName: itemDetails.name,
                itemHrid,
                expectedValue: expectedReturn,
                drops,
            };
        }

        /**
         * Get cached expected value for a container (for use by other modules)
         * @param {string} itemHrid - Container item HRID
         * @returns {number|null} Cached EV or null
         */
        getCachedValue(itemHrid) {
            return this.containerCache.get(itemHrid) || null;
        }

        /**
         * Get detailed drop breakdown for display
         * @param {string} containerHrid - Container HRID
         * @returns {Array} Array of drop objects
         */
        getDropBreakdown(containerHrid) {
            const initData = dataManager.getInitClientData();
            if (!initData || !initData.openableLootDropMap) {
                return [];
            }

            const dropTable = initData.openableLootDropMap[containerHrid];
            if (!dropTable) {
                return [];
            }

            const drops = [];

            for (const drop of dropTable) {
                const itemHrid = drop.itemHrid;
                const dropRate = drop.dropRate || 0;
                const minCount = drop.minCount || 0;
                const maxCount = drop.maxCount || 0;

                if (dropRate <= 0) {
                    continue;
                }

                // Get item details
                const itemDetails = dataManager.getItemDetails(itemHrid);
                if (!itemDetails) {
                    continue;
                }

                // Calculate average count
                const avgCount = (minCount + maxCount) / 2;

                // Get price
                const price = this.getDropPrice(itemHrid);

                // Calculate expected value for this drop
                const itemCanBeSold = itemDetails.isTradable !== false;

                // Special case: Coin never has market tax (it's currency, not a market item)
                const isCoin = itemHrid === this.COIN_HRID;

                const dropValue =
                    price !== null
                        ? isCoin
                            ? avgCount * dropRate * price // No tax for coins
                            : itemCanBeSold
                              ? calculatePriceAfterTax(avgCount * dropRate * price, this.MARKET_TAX)
                              : avgCount * dropRate * price
                        : 0;

                drops.push({
                    itemHrid,
                    itemName: itemDetails.name,
                    dropRate,
                    avgCount,
                    priceEach: price || 0,
                    expectedValue: dropValue,
                    hasPriceData: price !== null,
                });
            }

            // Sort by expected value (highest first)
            drops.sort((a, b) => b.expectedValue - a.expectedValue);

            return drops;
        }

        /**
         * Invalidate cache (call when market data refreshes)
         */
        invalidateCache() {
            this.containerCache.clear();
            this.isInitialized = false;

            // Re-initialize if data is available
            if (dataManager.getInitClientData() && marketAPI.isLoaded()) {
                this.initialize();
            }
        }

        /**
         * Cleanup calculator state and handlers
         */
        cleanup() {
            if (this.retryHandler) {
                dataManager.off('character_initialized', this.retryHandler);
                this.retryHandler = null;
            }

            this.containerCache.clear();
            this.isInitialized = false;
        }

        disable() {
            this.cleanup();
        }
    }

    const expectedValueCalculator = new ExpectedValueCalculator();

    /**
     * Bonus Revenue Calculator Utility
     * Calculates revenue from essence and rare find drops
     * Shared by both gathering and production profit calculators
     */


    /**
     * Calculate bonus revenue from essence and rare find drops
     * @param {Object} actionDetails - Action details from game data
     * @param {number} actionsPerHour - Base actions per hour (efficiency not applied)
     * @param {Map} characterEquipment - Equipment map
     * @param {Object} itemDetailMap - Item details map
     * @param {Object} [options] - Optional flags
     * @param {boolean} [options.excludePersonalBuffs=false] - Skip personal (Labyrinth seal/scroll) buffs.
     *  Used by the skilling optimizer, which scores hypothetical equipment/tea setups to inform a
     *  purchase decision — a temporary scroll buff that happens to be active right now isn't something
     *  a gear purchase should be justified against, so it's excluded there while still applying normally
     *  for real-time tile/profit displays elsewhere.
     * @returns {Object} Bonus revenue data with essence and rare find drops
     */
    function calculateBonusRevenue(actionDetails, actionsPerHour, characterEquipment, itemDetailMap, options = {}) {
        const { excludePersonalBuffs = false } = options;
        // Get Essence Find bonus from equipment
        const essenceFindBonus = parseEssenceFindBonus(characterEquipment, itemDetailMap);

        // Get Rare Find bonus from BOTH equipment and house rooms
        const equipmentRareFindBonus = parseRareFindBonus(characterEquipment, actionDetails.type, itemDetailMap);
        const houseRareFindBonus = calculateHouseRareFind();
        const achievementRareFindBonus =
            dataManager.getAchievementBuffFlatBoost(actionDetails.type, '/buff_types/rare_find') * 100;
        const personalRareFindBonus = excludePersonalBuffs
            ? 0
            : dataManager.getPersonalBuffFlatBoost(actionDetails.type, '/buff_types/rare_find') * 100;

        const guildBuffs = dataManager.characterData?.guildActionTypeBuffsMap?.[actionDetails.type] || [];
        const guildRareFindBonus =
            guildBuffs.reduce(
                (sum, b) => (b.typeHrid === '/buff_types/rare_find' ? sum + (b.flatBoost || 0) + (b.ratioBoost || 0) : sum),
                0
            ) * 100;
        const guildEssenceFindBonus =
            guildBuffs.reduce(
                (sum, b) =>
                    b.typeHrid === '/buff_types/essence_find' ? sum + (b.flatBoost || 0) + (b.ratioBoost || 0) : sum,
                0
            ) * 100;

        const totalEssenceFindBonus = essenceFindBonus + guildEssenceFindBonus;
        const rareFindBonus =
            equipmentRareFindBonus +
            houseRareFindBonus +
            achievementRareFindBonus +
            personalRareFindBonus +
            guildRareFindBonus;
        const equipmentRareFindItems = parseRareFindBreakdown(characterEquipment, actionDetails.type, itemDetailMap);
        const rareFindBreakdown = {
            equipment: equipmentRareFindBonus,
            equipmentItems: equipmentRareFindItems,
            house: houseRareFindBonus,
            achievement: achievementRareFindBonus,
            personal: personalRareFindBonus,
            guild: guildRareFindBonus,
        };

        const bonusDrops = [];
        let totalBonusRevenue = 0;
        let hasMissingPrices = false;

        // Process essence drops
        if (actionDetails.essenceDropTable && actionDetails.essenceDropTable.length > 0) {
            for (const drop of actionDetails.essenceDropTable) {
                const itemDetails = itemDetailMap[drop.itemHrid];
                if (!itemDetails) continue;

                // Calculate average drop count
                const avgCount = (drop.minCount + drop.maxCount) / 2;

                // Apply Essence Find multiplier to drop rate
                const finalDropRate = drop.dropRate * (1 + totalEssenceFindBonus / 100);

                // Expected drops per hour
                const dropsPerHour = actionsPerHour * finalDropRate * avgCount;

                // Get price: Check if openable container (use EV), otherwise market price
                let itemPrice = 0;
                let isMissingPrice = false;
                if (itemDetails.isOpenable) {
                    // Use expected value for openable containers (with on-demand fallback)
                    itemPrice =
                        expectedValueCalculator.getCachedValue(drop.itemHrid) ||
                        expectedValueCalculator.calculateSingleContainer(drop.itemHrid) ||
                        0;
                    if (itemPrice === 0) {
                        console.warn(`[BonusRevenue] EV lookup returned 0 for openable container: ${drop.itemHrid}`);
                        isMissingPrice = true;
                    }
                } else {
                    // Use market price for regular items
                    const price = marketAPI.getPrice(drop.itemHrid, 0);
                    itemPrice = price?.bid ?? 0; // Use bid price (instant sell)
                    isMissingPrice = price?.bid === null || price?.bid === undefined;
                }

                // Revenue per hour from this drop
                const revenuePerHour = dropsPerHour * itemPrice;
                const dropsPerAction = actionsPerHour > 0 ? dropsPerHour / actionsPerHour : 0;
                const revenuePerAction = actionsPerHour > 0 ? revenuePerHour / actionsPerHour : 0;

                bonusDrops.push({
                    itemHrid: drop.itemHrid,
                    itemName: itemDetails.name,
                    dropRate: finalDropRate,
                    dropsPerHour,
                    dropsPerAction,
                    priceEach: itemPrice,
                    revenuePerHour,
                    revenuePerAction,
                    type: 'essence',
                    missingPrice: isMissingPrice,
                });

                totalBonusRevenue += revenuePerHour;
                if (isMissingPrice) {
                    hasMissingPrices = true;
                }
            }
        }

        // Process rare find drops
        if (actionDetails.rareDropTable && actionDetails.rareDropTable.length > 0) {
            for (const drop of actionDetails.rareDropTable) {
                const itemDetails = itemDetailMap[drop.itemHrid];
                if (!itemDetails) continue;

                // Calculate average drop count
                const avgCount = (drop.minCount + drop.maxCount) / 2;

                // Apply Rare Find multiplier to drop rate
                const finalDropRate = drop.dropRate * (1 + rareFindBonus / 100);

                // Expected drops per hour
                const dropsPerHour = actionsPerHour * finalDropRate * avgCount;

                // Get price: Check if openable container (use EV), otherwise market price
                let itemPrice = 0;
                let isMissingPrice = false;
                if (itemDetails.isOpenable) {
                    // Use expected value for openable containers (with on-demand fallback)
                    itemPrice =
                        expectedValueCalculator.getCachedValue(drop.itemHrid) ||
                        expectedValueCalculator.calculateSingleContainer(drop.itemHrid) ||
                        0;
                    if (itemPrice === 0) {
                        console.warn(`[BonusRevenue] EV lookup returned 0 for openable container: ${drop.itemHrid}`);
                        isMissingPrice = true;
                    }
                } else {
                    // Use market price for regular items
                    const price = marketAPI.getPrice(drop.itemHrid, 0);
                    itemPrice = price?.bid ?? 0; // Use bid price (instant sell)
                    isMissingPrice = price?.bid === null || price?.bid === undefined;
                }

                // Revenue per hour from this drop
                const revenuePerHour = dropsPerHour * itemPrice;
                const dropsPerAction = actionsPerHour > 0 ? dropsPerHour / actionsPerHour : 0;
                const revenuePerAction = actionsPerHour > 0 ? revenuePerHour / actionsPerHour : 0;

                bonusDrops.push({
                    itemHrid: drop.itemHrid,
                    itemName: itemDetails.name,
                    dropRate: finalDropRate,
                    dropsPerHour,
                    dropsPerAction,
                    priceEach: itemPrice,
                    revenuePerHour,
                    revenuePerAction,
                    type: 'rare_find',
                    missingPrice: isMissingPrice,
                });

                totalBonusRevenue += revenuePerHour;
                if (isMissingPrice) {
                    hasMissingPrices = true;
                }
            }
        }

        return {
            essenceFindBonus: totalEssenceFindBonus, // Essence Find % from equipment + guild
            rareFindBonus, // Rare Find % from equipment + house rooms + achievements (combined)
            rareFindBreakdown,
            bonusDrops, // Array of all bonus drops with details
            totalBonusRevenue, // Total revenue/hour from all bonus drops
            hasMissingPrices,
        };
    }

    var bonusRevenueCalculator = /*#__PURE__*/Object.freeze({
        __proto__: null,
        calculateBonusRevenue: calculateBonusRevenue
    });

    /**
     * Experience Parser Utility
     * Parses wisdom and experience bonuses from all sources
     *
     * Experience Formula (Skilling):
     * Final XP = Base XP × (1 + Wisdom + Charm Experience)
     *
     * Where Wisdom and Charm Experience are ADDITIVE
     */


    /**
     * Parse equipment wisdom bonus (skillingExperience stat)
     * @param {Map} equipment - Character equipment map
     * @param {Object} itemDetailMap - Item details from game data
     * @returns {Object} {total: number, breakdown: Array} Total wisdom and item breakdown
     */
    function parseEquipmentWisdom(equipment, itemDetailMap) {
        let totalWisdom = 0;
        const breakdown = [];

        for (const [_slot, item] of equipment) {
            const itemDetails = itemDetailMap[item.itemHrid];
            if (!itemDetails?.equipmentDetail) continue;

            const noncombatStats = itemDetails.equipmentDetail.noncombatStats || {};

            // Get base skillingExperience
            const baseWisdom = noncombatStats.skillingExperience || 0;
            if (baseWisdom === 0) continue;

            const enhancementLevel = item.enhancementLevel || 0;
            const multiplier = getEnhancementMultiplier(itemDetails, enhancementLevel);
            const itemWisdom = baseWisdom * multiplier * 100;
            totalWisdom += itemWisdom;

            // Add to breakdown
            breakdown.push({
                name: itemDetails.name,
                value: itemWisdom,
                enhancementLevel: enhancementLevel,
            });
        }

        return {
            total: totalWisdom,
            breakdown: breakdown,
        };
    }

    /**
     * Parse skill-specific charm experience (e.g., foragingExperience)
     * @param {Map} equipment - Character equipment map
     * @param {string} skillHrid - Skill HRID (e.g., "/skills/foraging")
     * @param {Object} itemDetailMap - Item details from game data
     * @returns {Object} {total: number, breakdown: Array} Total charm XP and item breakdown
     */
    function parseCharmExperience(equipment, skillHrid, itemDetailMap) {
        let totalCharmXP = 0;
        const breakdown = [];

        // Convert skill HRID to stat name (e.g., "/skills/foraging" → "foragingExperience")
        const skillName = skillHrid.replace('/skills/', '');
        const statName = `${skillName}Experience`;

        for (const [_slot, item] of equipment) {
            const itemDetails = itemDetailMap[item.itemHrid];
            if (!itemDetails?.equipmentDetail) continue;

            const noncombatStats = itemDetails.equipmentDetail.noncombatStats || {};

            // Get base charm experience
            const baseCharmXP = noncombatStats[statName] || 0;
            if (baseCharmXP === 0) continue;

            const enhancementLevel = item.enhancementLevel || 0;
            const multiplier = getEnhancementMultiplier(itemDetails, enhancementLevel);
            const itemCharmXP = baseCharmXP * multiplier * 100;
            totalCharmXP += itemCharmXP;

            // Add to breakdown
            breakdown.push({
                name: itemDetails.name,
                value: itemCharmXP,
                enhancementLevel: enhancementLevel,
            });
        }

        return {
            total: totalCharmXP,
            breakdown: breakdown,
        };
    }

    /**
     * Parse house room wisdom bonus
     * All house rooms provide +0.05% wisdom per level
     * @returns {number} Total wisdom from house rooms (e.g., 0.4 for 8 total levels)
     */
    function parseHouseRoomWisdom() {
        const houseRooms = dataManager.getHouseRooms();
        if (!houseRooms || houseRooms.size === 0) {
            return 0;
        }

        // Sum all house room levels
        let totalLevels = 0;
        for (const [_hrid, room] of houseRooms) {
            totalLevels += room.level || 0;
        }

        // Formula: totalLevels × 0.05% per level
        return totalLevels * 0.05;
    }

    /**
     * Parse community buff wisdom bonus
     * Formula: 20% + ((level - 1) × 0.5%)
     * @returns {number} Wisdom percentage from community buff (e.g., 29.5 for T20)
     */
    function parseCommunityBuffWisdom() {
        const buffLevel = dataManager.getCommunityBuffLevel('/community_buff_types/experience');
        if (!buffLevel) {
            return 0;
        }

        // Formula: 20% base + 0.5% per level above 1
        return 20 + (buffLevel - 1) * 0.5;
    }

    /**
     * Parse MooPass wisdom bonus
     * MooPass provides a flat 5% wisdom boost
     * @returns {number} Wisdom percentage from MooPass (5% if active, 0 if not)
     */
    function parseMooPassWisdom() {
        const mooPassBuffs = dataManager.getMooPassBuffs();
        if (!mooPassBuffs || mooPassBuffs.length === 0) {
            return 0;
        }

        // Check for wisdom buff from MooPass
        const wisdomBuff = mooPassBuffs.find((buff) => buff.typeHrid === '/buff_types/wisdom');

        if (!wisdomBuff || !wisdomBuff.flatBoost) {
            return 0;
        }

        // Convert to percentage (0.05 → 5%)
        return wisdomBuff.flatBoost * 100;
    }

    /**
     * Parse wisdom from active consumables (Wisdom Tea/Coffee)
     * @param {Array} drinkSlots - Active drink slots for the action type
     * @param {Object} itemDetailMap - Item details from game data
     * @param {number} drinkConcentration - Drink concentration bonus (e.g., 12.16 for 12.16%)
     * @returns {number} Wisdom percentage from consumables (e.g., 13.46 for 12% × 1.1216)
     */
    function parseConsumableWisdom(drinkSlots, itemDetailMap, drinkConcentration) {
        if (!drinkSlots || drinkSlots.length === 0) {
            return 0;
        }

        let totalWisdom = 0;

        for (const drink of drinkSlots) {
            if (!drink || !drink.itemHrid) continue; // Skip empty slots

            const itemDetails = itemDetailMap[drink.itemHrid];
            if (!itemDetails?.consumableDetail) continue;

            // Check for wisdom buff (typeHrid === "/buff_types/wisdom")
            const buffs = itemDetails.consumableDetail.buffs || [];
            for (const buff of buffs) {
                // Check if this is a wisdom buff by typeHrid
                if (buff.typeHrid === '/buff_types/wisdom' && buff.flatBoost) {
                    // Base wisdom (e.g., 0.12 for 12%)
                    const baseWisdom = buff.flatBoost * 100;

                    // Scale with drink concentration
                    const scaledWisdom = baseWisdom * (1 + drinkConcentration / 100);

                    totalWisdom += scaledWisdom;
                }
            }
        }

        return totalWisdom;
    }

    /**
     * Calculate total experience multiplier and breakdown
     * @param {string} skillHrid - Skill HRID (e.g., "/skills/foraging")
     * @param {string} actionTypeHrid - Action type HRID (e.g., "/action_types/foraging")
     * @returns {Object} Experience data with breakdown
     */
    function calculateExperienceMultiplier(skillHrid, actionTypeHrid) {
        const { equipment, drinks: activeDrinks } = resolveActionContext(actionTypeHrid);
        const gameData = dataManager.getInitClientData();
        const itemDetailMap = gameData?.itemDetailMap || {};

        // Get drink concentration
        const drinkConcentration = equipment ? calculateDrinkConcentration(equipment, itemDetailMap) : 0;

        // Parse wisdom from all sources
        const equipmentWisdomData = parseEquipmentWisdom(equipment, itemDetailMap);
        const equipmentWisdom = equipmentWisdomData.total;
        const houseWisdom = parseHouseRoomWisdom();
        const communityWisdom = parseCommunityBuffWisdom();
        const consumableWisdom = parseConsumableWisdom(activeDrinks, itemDetailMap, drinkConcentration);
        const achievementWisdom = dataManager.getAchievementBuffFlatBoost(actionTypeHrid, '/buff_types/wisdom') * 100;
        const mooPassWisdom = parseMooPassWisdom();
        const personalWisdom = dataManager.getPersonalBuffFlatBoost(actionTypeHrid, '/buff_types/wisdom') * 100;
        const guildBuffs = dataManager.characterData?.guildActionTypeBuffsMap?.[actionTypeHrid] || [];
        const guildWisdom =
            guildBuffs.reduce(
                (sum, b) => (b.typeHrid === '/buff_types/wisdom' ? sum + (b.flatBoost || 0) + (b.ratioBoost || 0) : sum),
                0
            ) * 100;

        const totalWisdom =
            equipmentWisdom +
            houseWisdom +
            communityWisdom +
            consumableWisdom +
            achievementWisdom +
            mooPassWisdom +
            personalWisdom +
            guildWisdom;

        // Parse charm experience (skill-specific) - now returns object with total and breakdown
        const charmData = parseCharmExperience(equipment, skillHrid, itemDetailMap);
        const charmExperience = charmData.total;

        // Total multiplier (additive)
        const totalMultiplier = 1 + totalWisdom / 100 + charmExperience / 100;

        return {
            totalMultiplier,
            totalWisdom,
            charmExperience,
            charmBreakdown: charmData.breakdown,
            wisdomBreakdown: equipmentWisdomData.breakdown,
            breakdown: {
                equipmentWisdom,
                houseWisdom,
                communityWisdom,
                consumableWisdom,
                achievementWisdom,
                mooPassWisdom,
                personalWisdom,
                guildWisdom,
                charmExperience,
            },
        };
    }

    /**
     * Calculate drink concentration from Guzzling Pouch
     * @param {Map} equipment - Character equipment map
     * @param {Object} itemDetailMap - Item details from game data
     * @returns {number} Drink concentration percentage (e.g., 12.16 for 12.16%)
     */
    function calculateDrinkConcentration(equipment, itemDetailMap) {
        // Find Guzzling Pouch in equipment
        const pouchItem = equipment.get('/item_locations/pouch');
        if (!pouchItem || !pouchItem.itemHrid.includes('guzzling_pouch')) {
            return 0;
        }

        const itemDetails = itemDetailMap[pouchItem.itemHrid];
        if (!itemDetails?.equipmentDetail) {
            return 0;
        }

        // Get base drink concentration
        const noncombatStats = itemDetails.equipmentDetail.noncombatStats || {};
        const baseDrinkConcentration = noncombatStats.drinkConcentration || 0;

        if (baseDrinkConcentration === 0) {
            return 0;
        }

        const enhancementLevel = pouchItem.enhancementLevel || 0;
        const multiplier = getEnhancementMultiplier(itemDetails, enhancementLevel);
        return baseDrinkConcentration * multiplier * 100;
    }

    var experienceParser = {
        parseEquipmentWisdom,
        parseCharmExperience,
        parseHouseRoomWisdom,
        parseCommunityBuffWisdom,
        parseMooPassWisdom,
        parseConsumableWisdom,
        calculateExperienceMultiplier,
    };

    var experienceParser$1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        calculateExperienceMultiplier: calculateExperienceMultiplier,
        default: experienceParser,
        parseCharmExperience: parseCharmExperience,
        parseCommunityBuffWisdom: parseCommunityBuffWisdom,
        parseConsumableWisdom: parseConsumableWisdom,
        parseEquipmentWisdom: parseEquipmentWisdom,
        parseHouseRoomWisdom: parseHouseRoomWisdom,
        parseMooPassWisdom: parseMooPassWisdom
    });

    /**
     * Merge market listing updates into the current list.
     * @param {Array} currentListings - Existing market listings.
     * @param {Array} updatedListings - Updated listings from WebSocket.
     * @returns {Array} New merged listings array.
     */
    const mergeMarketListings = (currentListings = [], updatedListings = []) => {
        const safeCurrent = Array.isArray(currentListings) ? currentListings : [];
        const safeUpdates = Array.isArray(updatedListings) ? updatedListings : [];

        if (safeUpdates.length === 0) {
            return [...safeCurrent];
        }

        const indexById = new Map();
        safeCurrent.forEach((listing, index) => {
            if (!listing || listing.id === undefined || listing.id === null) {
                return;
            }
            indexById.set(listing.id, index);
        });

        const merged = [...safeCurrent];

        for (const listing of safeUpdates) {
            if (!listing || listing.id === undefined || listing.id === null) {
                continue;
            }

            const existingIndex = indexById.get(listing.id);
            if (existingIndex !== undefined) {
                merged[existingIndex] = listing;
            } else {
                merged.push(listing);
            }
        }

        // Remove dead listings: cancelled/expired immediately, filled once fully claimed
        return merged.filter((listing) => {
            if (!listing) return false;
            if (
                listing.status === '/market_listing_status/cancelled' ||
                listing.status === '/market_listing_status/expired'
            ) {
                return false;
            }
            if (
                listing.status === '/market_listing_status/filled' &&
                (listing.unclaimedItemCount || 0) === 0 &&
                (listing.unclaimedCoinCount || 0) === 0
            ) {
                return false;
            }
            return true;
        });
    };

    var marketListings = /*#__PURE__*/Object.freeze({
        __proto__: null,
        mergeMarketListings: mergeMarketListings
    });

    /**
     * Action Calculator
     * Shared calculation logic for action time and efficiency
     * Used by action-time-display.js and quick-input-buttons.js
     */


    /**
     * Calculate complete action statistics (time + efficiency)
     * @param {Object} actionDetails - Action detail object from game data
     * @param {Object} options - Configuration options
     * @param {Array} options.skills - Character skills array
     * @param {Array} options.equipment - Character equipment array
     * @param {Object} options.itemDetailMap - Item detail map from game data
     * @param {string} options.actionHrid - Action HRID for task detection (optional)
     * @param {boolean} options.includeCommunityBuff - Include community buff in efficiency (default: false)
     * @param {boolean} options.includeBreakdown - Include detailed breakdown data (default: false)
     * @param {number} options.levelRequirementOverride - Override base level requirement (e.g., item level for alchemy)
     * @param {Array|null} options.drinksOverride - If provided, use these drinks instead of resolving the
     *  live/snapshot loadout — lets callers evaluate a hypothetical tea combination (e.g. the tea optimizer).
     * @returns {Object} { actionTime, totalEfficiency, breakdown? }
     */
    function calculateActionStats(actionDetails, options = {}) {
        const {
            skills,
            equipment,
            itemDetailMap,
            actionHrid,
            includeCommunityBuff = false,
            includeBreakdown = false,
            levelRequirementOverride,
            drinksOverride = null,
        } = options;

        try {
            // Calculate base action time
            const baseTime = actionDetails.baseTimeCost / 1e9; // nanoseconds to seconds

            // Get equipment speed bonus
            const speedBonus = parseEquipmentSpeedBonuses(equipment, actionDetails.type, itemDetailMap);
            const personalSpeedBonus = dataManager.getPersonalBuffFlatBoost(actionDetails.type, '/buff_types/action_speed');

            const guildBuffs = dataManager.characterData?.guildActionTypeBuffsMap?.[actionDetails.type] || [];
            const guildSpeedBonus = guildBuffs.reduce(
                (sum, b) =>
                    b.typeHrid === '/buff_types/action_speed' ? sum + (b.flatBoost || 0) + (b.ratioBoost || 0) : sum,
                0
            );
            const guildEfficiency = guildBuffs.reduce(
                (sum, b) =>
                    b.typeHrid === '/buff_types/efficiency' ? sum + ((b.flatBoost || 0) + (b.ratioBoost || 0)) * 100 : sum,
                0
            );

            // Calculate action time with equipment speed
            let actionTime = baseTime / (1 + speedBonus + personalSpeedBonus + guildSpeedBonus);

            // Apply task speed multiplicatively (if action is an active task)
            if (actionHrid && dataManager.isTaskAction(actionHrid)) {
                const taskSpeedBonus = dataManager.getTaskSpeedBonus(); // Returns percentage (e.g., 15 for 15%)
                actionTime = actionTime / (1 + taskSpeedBonus / 100); // Apply multiplicatively
            }

            // Enforce game minimum action time
            actionTime = Math.max(MIN_ACTION_TIME_SECONDS, actionTime);

            // Calculate efficiency
            const skillLevel = getSkillLevel(skills, actionDetails.type);
            const baseRequirement = levelRequirementOverride ?? actionDetails.levelRequirement?.level ?? 1;

            // Get drink concentration
            const drinkConcentration = getDrinkConcentration(equipment, itemDetailMap);

            // Get active drinks for this action type (loadout-snapshot aware), unless a hypothetical
            // combination was supplied by the caller (e.g. the tea optimizer evaluating a combo)
            const activeDrinks = drinksOverride ?? resolveActionContext(actionDetails.type).drinks;

            // Calculate Action Level bonus from teas
            const actionLevelBonus = parseActionLevelBonus(activeDrinks, itemDetailMap, drinkConcentration);

            // Get Action Level bonus breakdown (if requested)
            let actionLevelBreakdown = null;
            if (includeBreakdown) {
                actionLevelBreakdown = parseActionLevelBonusBreakdown(activeDrinks, itemDetailMap, drinkConcentration);
            }

            // Calculate effective requirement
            // Game uses full fractional action level bonus (no flooring)
            const effectiveRequirement = baseRequirement + actionLevelBonus;

            // Calculate tea skill level bonus (e.g., +8 Cheesesmithing from Ultra Cheesesmithing Tea)
            const teaSkillLevelBonus = parseTeaSkillLevelBonus(
                actionDetails.type,
                activeDrinks,
                itemDetailMap,
                drinkConcentration
            );

            // Calculate efficiency components
            // Apply tea skill level bonus to effective player level
            const effectiveLevel = skillLevel + teaSkillLevelBonus;
            const levelEfficiency = Math.max(0, effectiveLevel - effectiveRequirement);
            const houseEfficiency = calculateHouseEfficiency(actionDetails.type);
            const equipmentEfficiency = parseEquipmentEfficiencyBonuses(equipment, actionDetails.type, itemDetailMap);
            const achievementEfficiency =
                dataManager.getAchievementBuffFlatBoost(actionDetails.type, '/buff_types/efficiency') * 100;
            const personalEfficiency =
                dataManager.getPersonalBuffFlatBoost(actionDetails.type, '/buff_types/efficiency') * 100;

            // Calculate tea efficiency
            let teaEfficiency;
            let teaBreakdown = null;
            if (includeBreakdown) {
                // Get detailed breakdown
                teaBreakdown = parseTeaEfficiencyBreakdown(
                    actionDetails.type,
                    activeDrinks,
                    itemDetailMap,
                    drinkConcentration
                );
                teaEfficiency = teaBreakdown.reduce((sum, tea) => sum + tea.efficiency, 0);
            } else {
                // Simple total
                teaEfficiency = parseTeaEfficiency(actionDetails.type, activeDrinks, itemDetailMap, drinkConcentration);
            }

            // Get community buff efficiency (if requested)
            let communityEfficiency = 0;
            if (includeCommunityBuff) {
                // Production Efficiency buff applies to production skills and alchemy
                const productionSkills = [
                    '/action_types/alchemy',
                    '/action_types/brewing',
                    '/action_types/cheesesmithing',
                    '/action_types/cooking',
                    '/action_types/crafting',
                    '/action_types/tailoring',
                ];

                if (productionSkills.includes(actionDetails.type)) {
                    const communityBuffLevel = dataManager.getCommunityBuffLevel(
                        '/community_buff_types/production_efficiency'
                    );
                    communityEfficiency = communityBuffLevel ? (0.14 + (communityBuffLevel - 1) * 0.003) * 100 : 0;
                }
            }

            // Total efficiency (stack all components additively)
            const totalEfficiency = stackAdditive(
                levelEfficiency,
                houseEfficiency,
                equipmentEfficiency,
                teaEfficiency,
                communityEfficiency,
                achievementEfficiency,
                personalEfficiency,
                guildEfficiency
            );

            // Build result object
            const result = {
                actionTime,
                totalEfficiency,
            };

            // Add breakdown if requested
            if (includeBreakdown) {
                result.efficiencyBreakdown = {
                    levelEfficiency,
                    houseEfficiency,
                    equipmentEfficiency,
                    teaEfficiency,
                    teaBreakdown,
                    communityEfficiency,
                    achievementEfficiency,
                    personalEfficiency,
                    guildEfficiency,
                    skillLevel,
                    baseRequirement,
                    actionLevelBonus,
                    actionLevelBreakdown,
                    effectiveRequirement,
                };
            }

            return result;
        } catch (error) {
            console.error('[Action Calculator] Error calculating action stats:', error);
            return null;
        }
    }

    /**
     * Get character skill level for a skill type
     * @param {Array} skills - Character skills array
     * @param {string} skillType - Skill type HRID (e.g., "/action_types/cheesesmithing")
     * @returns {number} Skill level
     */
    function getSkillLevel(skills, skillType) {
        // Combat/labyrinth actions don't map to a single skill — efficiency scaling doesn't apply
        if (skillType === '/action_types/combat' || skillType === '/action_types/labyrinth') {
            return 1;
        }
        // Map action type to skill HRID
        const skillHrid = skillType.replace('/action_types/', '/skills/');
        const skill = skills.find((s) => s.skillHrid === skillHrid);
        if (!skill) {
            console.error(`[ActionCalculator] Skill not found: ${skillHrid}`);
        }
        return skill?.level || 1;
    }

    var actionCalculator = /*#__PURE__*/Object.freeze({
        __proto__: null,
        calculateActionStats: calculateActionStats
    });

    /**
     * Action Panel Display Helper
     * Utilities for working with action detail panels (gathering, production, enhancement)
     */

    /**
     * Find the action count input field within a panel
     * @param {HTMLElement} panel - The action detail panel
     * @returns {HTMLInputElement|null} The input element or null if not found
     */
    function findActionInput(panel) {
        const inputContainer = panel.querySelector('[class*="maxActionCountInput"]');
        if (!inputContainer) {
            return null;
        }

        const inputField = inputContainer.querySelector('input');
        return inputField || null;
    }

    /**
     * Attach input listeners to an action panel for tracking value changes
     * Sets up three listeners:
     * - keyup: For manual typing
     * - input: For quick input button clicks (React dispatches input events)
     * - panel click: For any panel interactions with 50ms delay
     *
     * @param {HTMLElement} panel - The action detail panel
     * @param {HTMLInputElement} input - The input element
     * @param {Function} updateCallback - Callback function(value) called on input changes
     * @param {Object} options - Optional configuration
     * @param {number} options.clickDelay - Delay in ms for panel click handler (default: 50)
     * @returns {Function} Cleanup function to remove all listeners
     */
    function attachInputListeners(panel, input, updateCallback, options = {}) {
        const { clickDelay = 50 } = options;

        // Handler for keyup and input events
        const updateHandler = () => {
            updateCallback(input.value);
        };

        // Handler for panel clicks (with delay to allow React updates)
        const panelClickHandler = (event) => {
            // Skip if click is on the input box itself
            if (event.target === input) {
                return;
            }
            setTimeout(() => {
                updateCallback(input.value);
            }, clickDelay);
        };

        // Attach all listeners
        input.addEventListener('keyup', updateHandler);
        input.addEventListener('input', updateHandler);
        panel.addEventListener('click', panelClickHandler);

        // Return cleanup function
        return () => {
            input.removeEventListener('keyup', updateHandler);
            input.removeEventListener('input', updateHandler);
            panel.removeEventListener('click', panelClickHandler);
        };
    }

    /**
     * Perform initial update if input already has a valid value
     * @param {HTMLInputElement} input - The input element
     * @param {Function} updateCallback - Callback function(value) called if valid
     * @returns {boolean} True if initial update was performed
     */
    function performInitialUpdate(input, updateCallback) {
        if (input.value) {
            updateCallback(input.value);
            return true;
        }
        return false;
    }

    var actionPanelHelper = /*#__PURE__*/Object.freeze({
        __proto__: null,
        attachInputListeners: attachInputListeners,
        findActionInput: findActionInput,
        performInitialUpdate: performInitialUpdate
    });

    /**
     * Buff Parser Utilities
     * Parse active buffs from character data
     */


    /**
     * Get alchemy success rate bonus from active buffs
     * @returns {number} Alchemy success rate bonus (0-1, e.g., 0.087 for 8.7% multiplicative bonus)
     */
    function getAlchemySuccessBonus() {
        try {
            const characterData = dataManager.characterData;
            if (!characterData || !characterData.consumableActionTypeBuffsMap) {
                return 0;
            }

            const alchemyBuffs = characterData.consumableActionTypeBuffsMap['/action_types/alchemy'];
            if (!Array.isArray(alchemyBuffs)) {
                return 0;
            }

            let bonus = 0;
            for (const buff of alchemyBuffs) {
                if (buff.typeHrid === '/buff_types/alchemy_success') {
                    // ratioBoost is already scaled with drink concentration by the game
                    bonus += buff.ratioBoost || 0;
                }
            }

            return bonus;
        } catch (error) {
            console.error('[BuffParser] Failed to get alchemy success bonus:', error);
            return 0;
        }
    }

    var buffParser = /*#__PURE__*/Object.freeze({
        __proto__: null,
        getAlchemySuccessBonus: getAlchemySuccessBonus
    });

    /**
     * DOM Selector Constants
     * Centralized selector strings for querying game elements
     * If game class names change, update here only
     */

    /**
     * Game UI Selectors (class names from game code)
     */
    const GAME = {
        // Header
        TOTAL_LEVEL: '[class*="Header_totalLevel"]',

        // Settings Panel
        SETTINGS_PANEL_TITLE: '[class*="SettingsPanel_title"]',
        SETTINGS_TABS_CONTAINER: 'div[class*="SettingsPanel_tabsComponentContainer"]',
        TABS_FLEX_CONTAINER: '[class*="MuiTabs-flexContainer"]',
        TAB_PANELS_CONTAINER: '[class*="TabsComponent_tabPanelsContainer"]',
        TAB_PANEL: '[class*="TabPanel_tabPanel"]',

        // Game Panel
        GAME_PANEL: 'div[class*="GamePage_gamePanel"]',

        // Skill Action Detail
        SKILL_ACTION_DETAIL: '[class*="SkillActionDetail_skillActionDetail"]',
        SKILL_ACTION_NAME: '[class*="SkillActionDetail_name"]',
        ENHANCING_COMPONENT: 'div.SkillActionDetail_enhancingComponent__17bOx',

        // Action Queue
        QUEUED_ACTIONS: '[class*="QueuedActions_action"]',
        MAX_ACTION_COUNT_INPUT: '[class*="maxActionCountInput"]',

        // Tasks
        TASK_PANEL: '[class*="TasksPanel_taskSlotCount"]',
        TASK_LIST: '[class*="TasksPanel_taskList"]',
        TASK_CARD: '[class*="RandomTask_randomTask"]',
        TASK_NAME: '[class*="RandomTask_name"]',
        TASK_INFO: '.RandomTask_taskInfo__1uasf',
        TASK_ACTION: '.RandomTask_action__3eC6o',
        TASK_REWARDS: '.RandomTask_rewards__YZk7D',
        TASK_CONTENT: '[class*="RandomTask_content"]',
        TASK_NAME_DIV: 'div[class*="RandomTask_name"]',

        // House Panel
        HOUSE_HEADER: '[class*="HousePanel_header"]',
        HOUSE_COSTS: '[class*="HousePanel_costs"]',
        HOUSE_ITEM_REQUIREMENTS: '[class*="HousePanel_itemRequirements"]',

        // Loot Log
        LOOT_LOG_CONTAINER: '.LootLogPanel_actionLoots__3oTid',
        LOOT_LOG_ENTRY: '.LootLogPanel_actionLoot__32gl_',

        // Inventory
        INVENTORY_ITEMS: '[class*="Inventory_items"]',
        INVENTORY_CATEGORY_BUTTON: '.Inventory_categoryButton__35s1x',
        INVENTORY_LABEL: '.Inventory_label__XEOAx',

        // Items
        ITEM_CONTAINER: '.Item_itemContainer__x7kH1',
        ITEM_ITEM: '.Item_item__2De2O',
        ITEM_COUNT: '.Item_count__1HVvv',
        ITEM_TOOLTIP_TEXT: '.ItemTooltipText_itemTooltipText__zFq3A',

        // Navigation/Experience Bars
        NAV_LEVEL: '[class*="NavigationBar_level"]',
        NAV_CURRENT_EXPERIENCE: '[class*="NavigationBar_currentExperience"]',

        // Enhancement
        PROTECTION_ITEM_INPUT: '[class*="protectionItemInputContainer"]',

        // Tooltips
        MUI_TOOLTIP: '.MuiTooltip-tooltip',
    };

    /**
     * Cheezasha-specific selectors (our injected elements)
     */
    const CHEEZASHA = {
        // Settings
        SETTINGS_TAB: '#cheezasha-settings-tab',
        SETTING_WITH_DEPS: '.cheezasha-setting[data-dependencies]',

        // Task features
        TASK_PROFIT: '.mwi-task-profit',
        REROLL_COST_DISPLAY: '.mwi-reroll-cost-display',
        TASK_STATS_BTN: '.cheezasha-task-stats-btn',
        TASK_STATS_OVERLAY: '.cheezasha-task-stats-overlay',

        // Action features
        QUEUE_TOTAL_TIME: '#mwi-queue-total-time',
        FORAGING_PROFIT: '#mwi-foraging-profit',
        PRODUCTION_PROFIT: '#mwi-production-profit',

        // House features
        HOUSE_PRICING: '.mwi-house-pricing',
        HOUSE_PRICING_EMPTY: '.mwi-house-pricing-empty',
        HOUSE_TOTAL: '.mwi-house-total',
        HOUSE_TO_LEVEL: '.mwi-house-to-level',

        // Profile/Combat Score
        SCORE_CLOSE_BTN: '#mwi-score-close-btn',
        SCORE_TOGGLE: '#mwi-score-toggle',
        SCORE_DETAILS: '#mwi-score-details',
        HOUSE_TOGGLE: '#mwi-house-toggle',
        HOUSE_BREAKDOWN: '#mwi-house-breakdown',
        ABILITY_TOGGLE: '#mwi-ability-toggle',
        ABILITY_BREAKDOWN: '#mwi-ability-breakdown',
        EQUIPMENT_TOGGLE: '#mwi-equipment-toggle',
        EQUIPMENT_BREAKDOWN: '#mwi-equipment-breakdown',

        // Market features
        MARKET_PRICE_INJECTED: '.market-price-injected',
        MARKET_PROFIT_INJECTED: '.market-profit-injected',
        MARKET_EV_INJECTED: '.market-ev-injected',
        MARKET_ENHANCEMENT_INJECTED: '.market-enhancement-injected',

        // UI features
        ALCHEMY_DIMMED: '.mwi-alchemy-dimmed',
        EXP_PERCENTAGE: '.mwi-exp-percentage',
        STACK_PRICE: '.mwi-stack-price',
        NETWORTH_HEADER: '.mwi-networth-header',

        // Enhancement
        ENHANCEMENT_STATS: '#mwi-enhancement-stats',

        // Generic
        COLLAPSIBLE_SECTION: '.mwi-collapsible-section',
        EXPANDABLE_HEADER: '.mwi-expandable-header',
        SECTION_HEADER_NEXT: '.mwi-section-header + div',

        // Legacy/cleanup markers
        INSERTED_SPAN: '.insertedSpan',
        SCRIPT_INJECTED: '.script-injected',
        CONSUMABLE_STATS_INJECTED: '.consumable-stats-injected',
    };

    /**
     * Enhancement-specific input IDs
     */
    const ENHANCEMENT = {
        TILL_LEVEL: '#tillLevel',
        TILL_LEVEL_INPUT: '#tillLevelInput',
        TILL_LEVEL_NUMBER: '#tillLevelNumber',
    };

    /**
     * Combat Sim Integration
     */
    const COMBAT_SIM = {
        GROUP_COMBAT_TAB: 'a#group-combat-tab',
        GET_PRICES_BUTTON: 'button#buttonGetPrices',
    };

    var selectors = /*#__PURE__*/Object.freeze({
        __proto__: null,
        CHEEZASHA: CHEEZASHA,
        COMBAT_SIM: COMBAT_SIM,
        ENHANCEMENT: ENHANCEMENT,
        GAME: GAME
    });

    /**
     * Experience Calculator
     * Shared utility for calculating experience per hour across features
     *
     * Calculates accurate XP/hour including:
     * - Base experience from action
     * - Experience multipliers (Wisdom + Charm Experience)
     * - Action time with speed bonuses
     * - Efficiency repeats (critical for accuracy)
     */


    /**
     * Calculate experience per hour for an action
     * @param {string} actionHrid - The action HRID (e.g., "/actions/cheesesmithing/cheese")
     * @returns {Object|null} Experience data or null if not applicable
     *   {
     *     expPerHour: number,           // Total XP per hour (with all bonuses)
     *     baseExp: number,              // Base XP per action
     *     modifiedXP: number,           // XP per action after multipliers
     *     actionsPerHour: number,       // Actions per hour (with efficiency)
     *     xpMultiplier: number,         // Total XP multiplier (Wisdom + Charm)
     *     actionTime: number,           // Time per action in seconds
     *     totalEfficiency: number       // Total efficiency percentage
     *   }
     */
    function calculateExpPerHour(actionHrid) {
        const actionDetails = dataManager.getActionDetails(actionHrid);

        // Validate action has experience gain
        if (!actionDetails || !actionDetails.experienceGain || !actionDetails.experienceGain.value) {
            return null;
        }

        // Get character data
        const skills = dataManager.getSkills();
        const { equipment } = resolveActionContext(actionDetails.type);
        const gameData = dataManager.getInitClientData();

        if (!gameData || !skills || !equipment) {
            return null;
        }

        // Calculate action stats (time + efficiency)
        const stats = calculateActionStats(actionDetails, {
            skills,
            equipment,
            itemDetailMap: gameData.itemDetailMap,
            includeCommunityBuff: true,
            includeBreakdown: false,
        });

        if (!stats) {
            return null;
        }

        const { actionTime, totalEfficiency } = stats;

        // Calculate actions per hour (base rate)
        const baseActionsPerHour = calculateActionsPerHour(actionTime);

        // Calculate average queued actions completed per time-consuming action
        // Efficiency gives guaranteed repeats + chance for extra
        const avgActionsPerBaseAction = calculateEfficiencyMultiplier(totalEfficiency);

        // Calculate actions per hour WITH efficiency (total completions including instant repeats)
        const actionsPerHourWithEfficiency = calculateEffectiveActionsPerHour(baseActionsPerHour, avgActionsPerBaseAction);

        // Calculate experience multiplier (Wisdom + Charm Experience)
        const skillHrid = actionDetails.experienceGain.skillHrid;
        const xpData = calculateExperienceMultiplier(skillHrid, actionDetails.type);

        // Calculate exp per hour with all bonuses
        const baseExp = actionDetails.experienceGain.value;
        const modifiedXP = baseExp * xpData.totalMultiplier;
        const expPerHour = actionsPerHourWithEfficiency * modifiedXP;

        return {
            expPerHour: Math.floor(expPerHour),
            baseExp,
            modifiedXP,
            actionsPerHour: actionsPerHourWithEfficiency,
            xpMultiplier: xpData.totalMultiplier,
            actionTime,
            totalEfficiency,
        };
    }

    /**
     * Calculate actions and time needed to reach a target level
     * Accounts for progressive efficiency gains (+1% per level)
     * @param {number} currentLevel - Current skill level
     * @param {number} currentXP - Current experience points
     * @param {number} targetLevel - Target skill level
     * @param {number} baseEfficiency - Starting efficiency percentage
     * @param {number} actionTime - Time per action in seconds
     * @param {number} xpPerAction - Modified XP per action (with multipliers, success rate, etc.)
     * @param {Object} levelExperienceTable - XP requirements per level
     * @returns {{ actionsNeeded: number, timeNeeded: number }}
     */
    function calculateMultiLevelProgress(
        currentLevel,
        currentXP,
        targetLevel,
        baseEfficiency,
        actionTime,
        xpPerAction,
        levelExperienceTable
    ) {
        let totalActions = 0;
        let totalTime = 0;

        for (let level = currentLevel; level < targetLevel; level++) {
            let xpNeeded;
            if (level === currentLevel) {
                xpNeeded = levelExperienceTable[level + 1] - currentXP;
            } else {
                xpNeeded = levelExperienceTable[level + 1] - levelExperienceTable[level];
            }

            // Progressive efficiency: +1% per level gained during grind
            const levelsGained = level - currentLevel;
            const progressiveEfficiency = baseEfficiency + levelsGained;
            const efficiencyMultiplier = 1 + progressiveEfficiency / 100;

            const xpPerPerformedAction = xpPerAction * efficiencyMultiplier;
            const baseActionsForLevel = Math.ceil(xpNeeded / xpPerPerformedAction);
            const actionsToQueue = Math.round(baseActionsForLevel * efficiencyMultiplier);
            totalActions += actionsToQueue;
            totalTime += baseActionsForLevel * actionTime;
        }

        return { actionsNeeded: totalActions, timeNeeded: totalTime };
    }

    var experienceCalculator = {
        calculateExpPerHour,
        calculateMultiLevelProgress,
    };

    var experienceCalculator$1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        calculateExpPerHour: calculateExpPerHour,
        calculateMultiLevelProgress: calculateMultiLevelProgress,
        default: experienceCalculator
    });

    /**
     * Ability Cost Calculator Utility
     * Calculates the cost to reach a specific ability level
     * Extracted from ability-book-calculator.js for reuse in combat score
     */


    /**
     * List of starter abilities that give 50 XP per book (others give 500)
     */
    const STARTER_ABILITIES = [
        'poke',
        'scratch',
        'smack',
        'quick_shot',
        'water_strike',
        'fireball',
        'entangle',
        'minor_heal',
    ];

    /**
     * Check if an ability is a starter ability (50 XP per book)
     * @param {string} abilityHrid - Ability HRID
     * @returns {boolean} True if starter ability
     */
    function isStarterAbility(abilityHrid) {
        return STARTER_ABILITIES.some((skill) => abilityHrid.includes(skill));
    }

    /**
     * Calculate the cost to reach a specific ability level from level 0
     * @param {string} abilityHrid - Ability HRID (e.g., '/abilities/fireball')
     * @param {number} targetLevel - Target level to reach
     * @returns {number} Total cost in coins
     */
    function calculateAbilityCost(abilityHrid, targetLevel) {
        const gameData = dataManager.getInitClientData();
        if (!gameData) return 0;

        const levelXpTable = gameData.levelExperienceTable;
        if (!levelXpTable) return 0;

        // Get XP needed to reach target level from level 0
        const targetXp = levelXpTable[targetLevel] || 0;

        // Determine XP per book (50 for starters, 500 for advanced)
        const xpPerBook = isStarterAbility(abilityHrid) ? 50 : 500;

        // Calculate books needed
        let booksNeeded = targetXp / xpPerBook;
        booksNeeded += 1; // +1 book to learn the ability initially

        // Get market price for ability book
        const itemHrid = abilityHrid.replace('/abilities/', '/items/');
        const prices = marketAPI.getPrice(itemHrid, 0);

        if (!prices) return 0;

        // Match MCS behavior: if one price is positive and other is negative, use positive for both
        let ask = prices.ask;
        let bid = prices.bid;

        if (ask > 0 && bid < 0) {
            bid = ask;
        }
        if (bid > 0 && ask < 0) {
            ask = bid;
        }

        // Use weighted average
        const weightedPrice = (ask + bid) / 2;

        return booksNeeded * weightedPrice;
    }

    /**
     * Calculate the cost to level up an ability from current level to target level
     * @param {string} abilityHrid - Ability HRID
     * @param {number} currentLevel - Current ability level
     * @param {number} currentXp - Current ability XP
     * @param {number} targetLevel - Target ability level
     * @returns {number} Cost in coins
     */
    function calculateAbilityLevelUpCost(abilityHrid, currentLevel, currentXp, targetLevel) {
        const gameData = dataManager.getInitClientData();
        if (!gameData) return 0;

        const levelXpTable = gameData.levelExperienceTable;
        if (!levelXpTable) return 0;

        // Calculate XP needed
        const targetXp = levelXpTable[targetLevel] || 0;
        const xpNeeded = targetXp - currentXp;

        // Determine XP per book
        const xpPerBook = isStarterAbility(abilityHrid) ? 50 : 500;

        // Calculate books needed
        let booksNeeded = xpNeeded / xpPerBook;

        // If starting from level 0, need +1 book to learn initially
        if (currentLevel === 0) {
            booksNeeded += 1;
        }

        // Get market price
        const itemHrid = abilityHrid.replace('/abilities/', '/items/');
        const prices = marketAPI.getPrice(itemHrid, 0);

        if (!prices) return 0;

        // Match MCS behavior: if one price is positive and other is negative, use positive for both
        let ask = prices.ask;
        let bid = prices.bid;

        if (ask > 0 && bid < 0) {
            bid = ask;
        }
        if (bid > 0 && ask < 0) {
            ask = bid;
        }

        // Weighted average
        const weightedPrice = (ask + bid) / 2;

        return booksNeeded * weightedPrice;
    }

    var abilityCalc = /*#__PURE__*/Object.freeze({
        __proto__: null,
        calculateAbilityCost: calculateAbilityCost,
        calculateAbilityLevelUpCost: calculateAbilityLevelUpCost,
        isStarterAbility: isStarterAbility
    });

    /**
     * Shared UI Components
     *
     * Reusable UI component builders for MWI Tools
     */

    /**
     * Create a collapsible section with expand/collapse functionality
     * @param {string} icon - Icon/emoji for the section (optional, pass empty string to omit)
     * @param {string} title - Section title
     * @param {string} summary - Summary text shown when collapsed (optional)
     * @param {HTMLElement} content - Content element to show/hide
     * @param {boolean} defaultOpen - Whether section starts open (default: false)
     * @param {number} indent - Indentation level: 0 = root, 1 = nested, etc. (default: 0)
     * @returns {HTMLElement} Section container
     */
    function createCollapsibleSection(icon, title, summary, content, defaultOpen = false, indent = 0) {
        const section = document.createElement('div');
        section.className = 'mwi-collapsible-section';
        section.style.cssText = `
        margin-top: ${indent > 0 ? '4px' : '8px'};
        margin-bottom: ${indent > 0 ? '4px' : '8px'};
        margin-left: ${indent * 16}px;
    `;

        // Create header
        const header = document.createElement('div');
        header.className = 'mwi-section-header';
        header.style.cssText = `
        display: flex;
        align-items: center;
        cursor: pointer;
        user-select: none;
        padding: 4px 0;
        color: var(--text-color-primary, #fff);
        font-weight: ${indent === 0 ? '500' : '400'};
        font-size: ${indent > 0 ? '0.9em' : '1em'};
    `;

        const arrow = document.createElement('span');
        arrow.textContent = defaultOpen ? '▼' : '▶';
        arrow.style.cssText = `
        margin-right: 6px;
        font-size: 0.7em;
        transition: transform 0.2s;
    `;

        const label = document.createElement('span');
        if (icon) {
            // Emojis that need spacing fix (stopwatch has rendering issues in some browsers)
            const needsSpacingFix = icon === '⏱';
            if (needsSpacingFix) {
                label.innerHTML = `<span style="display: inline-block; margin-right: 0.25em;">${icon}</span> ${title}`;
            } else {
                label.textContent = `${icon} ${title}`;
            }
        } else {
            label.textContent = title;
        }

        header.appendChild(arrow);
        header.appendChild(label);

        // Create summary (shown when collapsed)
        const summaryDiv = document.createElement('div');
        summaryDiv.style.cssText = `
        margin-left: 16px;
        margin-top: 2px;
        color: var(--text-color-secondary, #888);
        font-size: 0.9em;
        display: ${defaultOpen ? 'none' : 'block'};
    `;
        if (summary) {
            summaryDiv.textContent = summary;
        }

        // Create content wrapper
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'mwi-section-content';
        contentWrapper.style.cssText = `
        display: ${defaultOpen ? 'block' : 'none'};
        margin-left: ${indent === 0 ? '16px' : '0px'};
        margin-top: 4px;
        color: var(--text-color-secondary, #888);
        font-size: 0.9em;
        line-height: 1.6;
        text-align: left;
    `;
        contentWrapper.appendChild(content);

        // Toggle functionality
        header.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event from bubbling to parent collapsible sections
            const isOpen = contentWrapper.style.display === 'block';
            contentWrapper.style.display = isOpen ? 'none' : 'block';
            if (summary) {
                summaryDiv.style.display = isOpen ? 'block' : 'none';
            }
            arrow.textContent = isOpen ? '▶' : '▼';
        });

        section.appendChild(header);
        if (summary) {
            section.appendChild(summaryDiv);
        }
        section.appendChild(contentWrapper);

        return section;
    }

    var uiComponents = {
        createCollapsibleSection,
    };

    var uiComponents$1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        createCollapsibleSection: createCollapsibleSection,
        default: uiComponents
    });

    /**
     * Skill Gear Detector
     *
     * Auto-detects gear and buffs from character equipment for any skill.
     * Originally designed for enhancing, now works generically for all skills.
     */


    /**
     * Detect best gear for a specific skill by equipment slot
     * @param {string} skillName - Skill name (e.g., 'enhancing', 'cooking', 'milking')
     * @param {Map} equipment - Character equipment map (equipped items only)
     * @param {Object} itemDetailMap - Item details map from init_client_data
     * @returns {Object} Best gear per slot with bonuses
     */
    function detectSkillGear(skillName, equipment, itemDetailMap) {
        const gear = {
            // Totals for calculations
            toolBonus: 0,
            speedBonus: 0,
            rareFindBonus: 0,
            experienceBonus: 0,

            // Per-slot breakdown for display
            slotBreakdown: [],

            // Best items per slot for display
            toolSlot: null, // main_hand or two_hand
            bodySlot: null, // body
            legsSlot: null, // legs
            handsSlot: null, // hands
        };

        // Get items to scan - only use equipment map (already filtered to equipped items only)
        let itemsToScan = [];

        if (equipment) {
            // Scan only equipped items from equipment map
            itemsToScan = Array.from(equipment.values()).filter((item) => item && item.itemHrid);
        }

        // Track best item per slot (by item level, then enhancement level)
        const slotCandidates = {
            tool: [], // main_hand or two_hand or skill-specific tool
            body: [], // body
            legs: [], // legs
            hands: [], // hands
            neck: [], // neck (accessories have 5× multiplier)
            ring: [], // ring (accessories have 5× multiplier)
            earrings: [], // earrings (accessories have 5× multiplier)
            back: [], // back (capes)
            charm: [], // charm (5× multiplier)
        };

        // Dynamic stat names based on skill
        const successStat = `${skillName}Success`;
        const speedStat = `${skillName}Speed`;
        const rareFindStat = `${skillName}RareFind`;
        const experienceStat = `${skillName}Experience`;

        // Search all items for skill-related bonuses and group by slot
        for (const item of itemsToScan) {
            const itemDetails = itemDetailMap[item.itemHrid];
            if (!itemDetails?.equipmentDetail?.noncombatStats) {
                continue;
            }

            const stats = itemDetails.equipmentDetail.noncombatStats;
            const enhancementLevel = item.enhancementLevel || 0;
            const multiplier = getEnhancementMultiplier(itemDetails, enhancementLevel);
            const equipmentType = itemDetails.equipmentDetail.type;

            // Generic stat calculation: Loop over ALL stats and apply multiplier
            const allStats = {};
            for (const [statName, statValue] of Object.entries(stats)) {
                if (typeof statValue !== 'number') continue; // Skip non-numeric values
                allStats[statName] = statValue * 100 * multiplier;
            }

            // Check if item has any skill-related stats (including universal skills)
            const hasSkillStats =
                allStats[successStat] ||
                allStats[speedStat] ||
                allStats[rareFindStat] ||
                allStats[experienceStat] ||
                allStats.skillingSpeed ||
                allStats.skillingRareFind ||
                allStats.skillingExperience;

            if (!hasSkillStats) {
                continue;
            }

            // Calculate bonuses for this item (backward-compatible output)
            const itemBonuses = {
                item: item,
                itemDetails: itemDetails,
                itemLevel: itemDetails.itemLevel || 0,
                enhancementLevel: enhancementLevel,
                // Named bonuses (dynamic based on skill)
                toolBonus: allStats[successStat] || 0,
                speedBonus: (allStats[speedStat] || 0) + (allStats.skillingSpeed || 0), // Combine speed sources
                rareFindBonus: (allStats[rareFindStat] || 0) + (allStats.skillingRareFind || 0),
                experienceBonus: (allStats[experienceStat] || 0) + (allStats.skillingExperience || 0), // Combine experience sources
                // Generic access to all stats
                allStats: allStats,
            };

            // Group by slot
            // Tool slots: skill-specific tools (e.g., enhancing_tool, cooking_tool) plus main_hand/two_hand
            const skillToolType = `/equipment_types/${skillName}_tool`;
            if (
                equipmentType === skillToolType ||
                equipmentType === '/equipment_types/main_hand' ||
                equipmentType === '/equipment_types/two_hand'
            ) {
                slotCandidates.tool.push(itemBonuses);
            } else if (equipmentType === '/equipment_types/body') {
                slotCandidates.body.push(itemBonuses);
            } else if (equipmentType === '/equipment_types/legs') {
                slotCandidates.legs.push(itemBonuses);
            } else if (equipmentType === '/equipment_types/hands') {
                slotCandidates.hands.push(itemBonuses);
            } else if (equipmentType === '/equipment_types/neck') {
                slotCandidates.neck.push(itemBonuses);
            } else if (equipmentType === '/equipment_types/ring') {
                slotCandidates.ring.push(itemBonuses);
            } else if (equipmentType === '/equipment_types/earrings') {
                slotCandidates.earrings.push(itemBonuses);
            } else if (equipmentType === '/equipment_types/back') {
                slotCandidates.back.push(itemBonuses);
            } else if (equipmentType === '/equipment_types/charm') {
                slotCandidates.charm.push(itemBonuses);
            }
        }

        // Select best item per slot (highest item level, then highest enhancement level)
        const selectBest = (candidates) => {
            if (candidates.length === 0) return null;

            return candidates.reduce((best, current) => {
                // Compare by item level first
                if (current.itemLevel > best.itemLevel) return current;
                if (current.itemLevel < best.itemLevel) return best;

                // If item levels are equal, compare by enhancement level
                if (current.enhancementLevel > best.enhancementLevel) return current;
                return best;
            });
        };

        const bestTool = selectBest(slotCandidates.tool);
        const bestBody = selectBest(slotCandidates.body);
        const bestLegs = selectBest(slotCandidates.legs);
        const bestHands = selectBest(slotCandidates.hands);
        const bestNeck = selectBest(slotCandidates.neck);
        const bestRing = selectBest(slotCandidates.ring);
        const bestEarrings = selectBest(slotCandidates.earrings);
        const bestBack = selectBest(slotCandidates.back);
        const bestCharm = selectBest(slotCandidates.charm);

        // Add bonuses from best items in each slot
        const addSlot = (best) => {
            if (!best) return;
            gear.toolBonus += best.toolBonus;
            gear.speedBonus += best.speedBonus;
            gear.rareFindBonus += best.rareFindBonus;
            gear.experienceBonus += best.experienceBonus;
            gear.slotBreakdown.push({
                name: best.itemDetails.name,
                enhancementLevel: best.enhancementLevel,
                success: best.toolBonus,
                speed: best.speedBonus,
                rareFind: best.rareFindBonus,
                experience: best.experienceBonus,
            });
            return { name: best.itemDetails.name, enhancementLevel: best.enhancementLevel };
        };

        gear.toolSlot = addSlot(bestTool) || null;
        gear.bodySlot = addSlot(bestBody) || null;
        gear.legsSlot = addSlot(bestLegs) || null;
        gear.handsSlot = addSlot(bestHands) || null;
        addSlot(bestNeck);
        addSlot(bestRing);
        addSlot(bestEarrings);
        addSlot(bestBack);
        addSlot(bestCharm);

        return gear;
    }

    /**
     * Detect active enhancing teas from drink slots
     * @param {Array} drinkSlots - Active drink slots for enhancing action type
     * @param {Object} itemDetailMap - Item details map from init_client_data
     * @returns {Object} Active teas { enhancing, superEnhancing, ultraEnhancing, blessed }
     */
    function detectEnhancingTeas(drinkSlots, _itemDetailMap) {
        const teas = {
            enhancing: false, // Enhancing Tea (+3 levels)
            superEnhancing: false, // Super Enhancing Tea (+6 levels)
            ultraEnhancing: false, // Ultra Enhancing Tea (+8 levels)
            blessed: false, // Blessed Tea (1% double jump)
        };

        if (!drinkSlots || drinkSlots.length === 0) {
            return teas;
        }

        // Tea HRIDs to check for
        const teaMap = {
            '/items/enhancing_tea': 'enhancing',
            '/items/super_enhancing_tea': 'superEnhancing',
            '/items/ultra_enhancing_tea': 'ultraEnhancing',
            '/items/blessed_tea': 'blessed',
        };

        for (const drink of drinkSlots) {
            if (!drink || !drink.itemHrid) continue;

            const teaKey = teaMap[drink.itemHrid];
            if (teaKey) {
                teas[teaKey] = true;
            }
        }

        return teas;
    }

    /**
     * Get enhancing tea level bonus
     * @param {Object} teas - Active teas from detectEnhancingTeas()
     * @returns {number} Total level bonus from teas
     */
    function getEnhancingTeaLevelBonus(teas) {
        // Teas don't stack - highest one wins
        if (teas.ultraEnhancing) return 8;
        if (teas.superEnhancing) return 6;
        if (teas.enhancing) return 3;

        return 0;
    }

    /**
     * Get enhancing tea speed bonus (base, before concentration)
     * @param {Object} teas - Active teas from detectEnhancingTeas()
     * @returns {number} Base speed bonus % from teas
     */
    function getEnhancingTeaSpeedBonus(teas) {
        // Teas don't stack - highest one wins
        // Base speed bonuses (before drink concentration):
        if (teas.ultraEnhancing) return 6; // +6% base
        if (teas.superEnhancing) return 4; // +4% base
        if (teas.enhancing) return 2; // +2% base

        return 0;
    }

    /**
     * Backward-compatible wrapper for enhancing gear detection
     * @param {Map} equipment - Character equipment map (equipped items only)
     * @param {Object} itemDetailMap - Item details map from init_client_data
     * @returns {Object} Best enhancing gear per slot with bonuses
     */
    function detectEnhancingGear(equipment, itemDetailMap) {
        return detectSkillGear('enhancing', equipment, itemDetailMap);
    }

    var enhancementGearDetector = /*#__PURE__*/Object.freeze({
        __proto__: null,
        detectEnhancingGear: detectEnhancingGear,
        detectEnhancingTeas: detectEnhancingTeas,
        detectSkillGear: detectSkillGear,
        getEnhancingTeaLevelBonus: getEnhancingTeaLevelBonus,
        getEnhancingTeaSpeedBonus: getEnhancingTeaSpeedBonus
    });

    /**
     * Enhancement Configuration Manager
     *
     * Combines auto-detected enhancing parameters with manual overrides from settings.
     * Provides single source of truth for enhancement simulator inputs.
     */


    /**
     * Get enhancing parameters (auto-detected or manual)
     * @returns {Object} Enhancement parameters for simulator
     */
    function getEnhancingParams() {
        const autoDetect = config.getSettingValue('enhanceSim_autoDetect', false);

        if (autoDetect) {
            return getAutoDetectedParams();
        } else {
            return getManualParams();
        }
    }

    /**
     * Get auto-detected enhancing parameters from character data
     * @returns {Object} Auto-detected parameters
     */
    function getAutoDetectedParams() {
        // Get character data
        const equipment = dataManager.getEquipment();
        const skills = dataManager.getSkills();
        const drinkSlots = dataManager.getActionDrinkSlots('/action_types/enhancing');
        const itemDetailMap = dataManager.getInitClientData()?.itemDetailMap || {};

        // Detect gear from equipped items only
        const gear = detectEnhancingGear(equipment, itemDetailMap);

        // Detect drink concentration from equipment (Guzzling Pouch)
        // IMPORTANT: Only scan equipped items, not entire inventory
        let drinkConcentration = 0;
        const itemsToScan = equipment ? Array.from(equipment.values()).filter((item) => item && item.itemHrid) : [];

        for (const item of itemsToScan) {
            const itemDetails = itemDetailMap[item.itemHrid];
            if (!itemDetails?.equipmentDetail?.noncombatStats?.drinkConcentration) continue;

            const concentration = itemDetails.equipmentDetail.noncombatStats.drinkConcentration;
            const enhancementLevel = item.enhancementLevel || 0;
            const multiplier = getEnhancementMultiplier(itemDetails, enhancementLevel);
            const scaledConcentration = concentration * 100 * multiplier;

            // Only keep the highest concentration (shouldn't have multiple, but just in case)
            if (scaledConcentration > drinkConcentration) {
                drinkConcentration = scaledConcentration;
            }
        }

        // Detect teas
        const teas = detectEnhancingTeas(drinkSlots);

        // Get tea level bonus (base, then scale with concentration)
        const baseTeaLevel = getEnhancingTeaLevelBonus(teas);
        const teaLevelBonus = baseTeaLevel > 0 ? baseTeaLevel * (1 + drinkConcentration / 100) : 0;

        // Get tea speed bonus (base, then scale with concentration)
        const baseTeaSpeed = getEnhancingTeaSpeedBonus(teas);
        const teaSpeedBonus = baseTeaSpeed > 0 ? baseTeaSpeed * (1 + drinkConcentration / 100) : 0;

        // Get tea wisdom bonus (base, then scale with concentration)
        // Wisdom Tea/Coffee provide 12% wisdom, scales with drink concentration
        let baseTeaWisdom = 0;
        if (drinkSlots && drinkSlots.length > 0) {
            for (const drink of drinkSlots) {
                if (!drink || !drink.itemHrid) continue;
                const drinkDetails = itemDetailMap[drink.itemHrid];
                if (!drinkDetails?.consumableDetail?.buffs) continue;

                const wisdomBuff = drinkDetails.consumableDetail.buffs.find(
                    (buff) => buff.typeHrid === '/buff_types/wisdom'
                );

                if (wisdomBuff && wisdomBuff.flatBoost) {
                    baseTeaWisdom += wisdomBuff.flatBoost * 100; // Convert to percentage
                }
            }
        }
        const teaWisdomBonus = baseTeaWisdom > 0 ? baseTeaWisdom * (1 + drinkConcentration / 100) : 0;

        // Get Enhancing skill level
        const enhancingSkill = skills?.find((s) => s.skillHrid === '/skills/enhancing');
        if (!enhancingSkill) {
            console.error('[EnhancementConfig] Skill not found: /skills/enhancing');
        }
        const enhancingLevel = enhancingSkill?.level || 1;

        // Get Observatory house room level (enhancing uses observatory, NOT laboratory!)
        const houseLevel = dataManager.getHouseRoomLevel('/house_rooms/observatory');

        // Calculate global house buffs from ALL house rooms
        // Rare Find: 0.2% base + 0.2% per level (per room, only if level >= 1)
        // Wisdom: 0.05% base + 0.05% per level (per room, only if level >= 1)
        const houseRooms = dataManager.getHouseRooms();
        let houseRareFindBonus = 0;
        let houseWisdomBonus = 0;

        for (const [_hrid, room] of houseRooms) {
            const level = room.level || 0;
            if (level >= 1) {
                // Each room: 0.2% per level (NOT 0.2% base + 0.2% per level)
                houseRareFindBonus += 0.2 * level;
                // Each room: 0.05% per level (NOT 0.05% base + 0.05% per level)
                houseWisdomBonus += 0.05 * level;
            }
        }

        // Get Enhancing Speed community buff level
        const communityBuffLevel = dataManager.getCommunityBuffLevel('/community_buff_types/enhancing_speed');
        // Formula: 20% base + 0.5% per level
        const communitySpeedBonus = communityBuffLevel > 0 ? 20 + (communityBuffLevel - 1) * 0.5 : 0;

        // Get Experience (Wisdom) community buff level
        const communityWisdomLevel = dataManager.getCommunityBuffLevel('/community_buff_types/experience');
        // Formula: 20% base + 0.5% per level (same as other community buffs)
        const communityWisdomBonus = communityWisdomLevel > 0 ? 20 + (communityWisdomLevel - 1) * 0.5 : 0;

        const achievementWisdomBonus =
            dataManager.getAchievementBuffFlatBoost('/action_types/enhancing', '/buff_types/wisdom') * 100;
        const achievementRareFindBonus =
            dataManager.getAchievementBuffFlatBoost('/action_types/enhancing', '/buff_types/rare_find') * 100;

        // Calculate total success rate bonus
        // Equipment + house + achievement
        const houseSuccessBonus = houseLevel * 0.05; // 0.05% per level for success
        const equipmentSuccessBonus = gear.toolBonus;
        const achievementSuccessBonus =
            dataManager.getAchievementBuffRatioBoost('/action_types/enhancing', '/buff_types/enhancing_success') * 100;
        const totalSuccessBonus = equipmentSuccessBonus + houseSuccessBonus + achievementSuccessBonus;

        // Calculate total speed bonus
        // Speed bonus (from equipment) + house bonus (1% per level) + community buff + tea speed
        const houseSpeedBonus = houseLevel * 1.0; // 1% per level for action speed
        const totalSpeedBonus = gear.speedBonus + houseSpeedBonus + communitySpeedBonus + teaSpeedBonus;

        // Calculate total experience bonus
        // Equipment + house wisdom + tea wisdom + community wisdom + achievement wisdom
        const totalExperienceBonus =
            gear.experienceBonus + houseWisdomBonus + teaWisdomBonus + communityWisdomBonus + achievementWisdomBonus;

        // Calculate guzzling bonus multiplier (1.0 at level 0, scales with drink concentration)
        const guzzlingBonus = 1 + drinkConcentration / 100;

        return {
            // Core values for calculations
            enhancingLevel: enhancingLevel + teaLevelBonus, // Base level + tea bonus
            houseLevel: houseLevel,
            toolBonus: totalSuccessBonus, // Tool + house combined
            speedBonus: totalSpeedBonus, // Speed + house + community + tea combined
            rareFindBonus: gear.rareFindBonus + houseRareFindBonus + achievementRareFindBonus, // Rare find (equipment + house rooms + achievements)
            experienceBonus: totalExperienceBonus, // Experience (equipment + house + tea + community wisdom)
            guzzlingBonus: guzzlingBonus, // Drink concentration multiplier for blessed tea
            teas: teas,

            // Display info (for UI) - show best item per slot
            toolSlot: gear.toolSlot,
            bodySlot: gear.bodySlot,
            legsSlot: gear.legsSlot,
            handsSlot: gear.handsSlot,
            detectedTeaBonus: teaLevelBonus,
            communityBuffLevel: communityBuffLevel, // For display (speed)
            communitySpeedBonus: communitySpeedBonus, // For display
            communityWisdomLevel: communityWisdomLevel, // For display
            communityWisdomBonus: communityWisdomBonus, // For display
            achievementWisdomBonus: achievementWisdomBonus, // For display
            teaSpeedBonus: teaSpeedBonus, // For display
            teaWisdomBonus: teaWisdomBonus, // For display
            drinkConcentration: drinkConcentration, // For display
            houseRareFindBonus: houseRareFindBonus, // For display
            achievementRareFindBonus: achievementRareFindBonus, // For display
            houseWisdomBonus: houseWisdomBonus, // For display
            equipmentRareFind: gear.rareFindBonus, // For display
            equipmentExperience: gear.experienceBonus, // For display
            equipmentSuccessBonus: equipmentSuccessBonus, // For display
            houseSuccessBonus: houseSuccessBonus, // For display
            achievementSuccessBonus: achievementSuccessBonus, // For display
            equipmentSpeedBonus: gear.speedBonus, // For display
            houseSpeedBonus: houseSpeedBonus, // For display
            slotBreakdown: gear.slotBreakdown || [], // Per-item breakdown for display
        };
    }

    /**
     * Detect current character's enhancing gear and return values mapped to setting keys.
     * Used by settings UI to populate gear inputs when auto-detect is toggled on.
     * @returns {Object} Map of settingId → detected value
     */
    function getDetectedGearSettings() {
        const equipment = dataManager.getEquipment();
        const skills = dataManager.getSkills();
        const drinkSlots = dataManager.getActionDrinkSlots('/action_types/enhancing');

        const result = {};

        // Enhancing level
        const enhancingSkill = skills?.find((s) => s.skillHrid === '/skills/enhancing');
        result.enhanceSim_enhancingLevel = enhancingSkill?.level || 1;

        // Observatory
        result.enhanceSim_houseLevel = dataManager.getHouseRoomLevel('/house_rooms/observatory');

        // Community buffs
        result.enhanceSim_communityBuff = dataManager.getCommunityBuffLevel('/community_buff_types/enhancing_speed');
        result.enhanceSim_communityBuffWisdom = dataManager.getCommunityBuffLevel('/community_buff_types/experience');

        // Achievement
        const achievementBonus = dataManager.getAchievementBuffRatioBoost(
            '/action_types/enhancing',
            '/buff_types/enhancing_success'
        );
        result.enhanceSim_achievement = achievementBonus > 0;

        // Tea detection
        const teaMap = {
            '/items/ultra_enhancing_tea': 'ultra',
            '/items/super_enhancing_tea': 'super',
            '/items/enhancing_tea': 'basic',
        };
        const WISDOM_TEA_HRIDS = ['/items/wisdom_tea', '/items/wisdom_coffee'];
        let detectedTea = 'none';
        let hasBlessed = false;
        let hasWisdom = false;
        if (drinkSlots) {
            for (const drink of drinkSlots) {
                if (!drink?.itemHrid) continue;
                if (teaMap[drink.itemHrid]) detectedTea = teaMap[drink.itemHrid];
                if (drink.itemHrid === '/items/blessed_tea') hasBlessed = true;
                if (WISDOM_TEA_HRIDS.includes(drink.itemHrid)) hasWisdom = true;
            }
        }
        result.enhanceSim_teaEnabled = detectedTea !== 'none';
        result.enhanceSim_tea = detectedTea === 'none' ? 'ultra' : detectedTea;
        result.enhanceSim_blessedTea = hasBlessed;
        result.enhanceSim_wisdomTea = hasWisdom;

        // Gear detection — match equipped items to known gear HRIDs
        const ENHANCER_HRIDS = {
            '/items/cheese_enhancer': 'cheese',
            '/items/verdant_enhancer': 'verdant',
            '/items/azure_enhancer': 'azure',
            '/items/burble_enhancer': 'burble',
            '/items/crimson_enhancer': 'crimson',
            '/items/rainbow_enhancer': 'rainbow',
            '/items/holy_enhancer': 'holy',
            '/items/celestial_enhancer': 'celestial',
        };
        const CAPE_HRIDS = {
            '/items/chance_cape': 'normal',
            '/items/chance_cape_refined': 'refined',
        };
        const CHARM_HRIDS = {
            '/items/trainee_enhancing_charm': 'trainee',
            '/items/basic_enhancing_charm': 'basic',
            '/items/advanced_enhancing_charm': 'advanced',
            '/items/expert_enhancing_charm': 'expert',
            '/items/master_enhancing_charm': 'master',
            '/items/grandmaster_enhancing_charm': 'grandmaster',
        };
        const FIXED_HRIDS = {
            '/items/enchanted_gloves': 'gloves',
            '/items/enhancers_top': 'top',
            '/items/enhancers_bottoms': 'bottoms',
            '/items/guzzling_pouch': 'guzzling',
        };
        const NECK_HRIDS = {
            '/items/philosophers_necklace': 'philo',
            '/items/necklace_of_speed': 'speed',
        };
        const RING_HRIDS = {
            '/items/philosophers_ring': 'philo',
            '/items/ring_of_rare_find': 'rarefind',
        };
        const EARRING_HRIDS = {
            '/items/philosophers_earrings': 'philo',
            '/items/earrings_of_rare_find': 'rarefind',
        };

        // Default all gear to disabled (not detected)
        result.enhanceSim_gear_enhancer = { enabled: false, tier: 'celestial', level: 0 };
        result.enhanceSim_gear_gloves = { enabled: false, level: 0 };
        result.enhanceSim_gear_top = { enabled: false, level: 0 };
        result.enhanceSim_gear_bottoms = { enabled: false, level: 0 };
        result.enhanceSim_gear_neck = { enabled: false, tier: 'philo', level: 0 };
        result.enhanceSim_gear_ring = { enabled: false, tier: 'philo', level: 0 };
        result.enhanceSim_gear_earring = { enabled: false, tier: 'philo', level: 0 };
        result.enhanceSim_gear_cape = { enabled: false, tier: 'normal', level: 0 };
        result.enhanceSim_gear_guzzling = { enabled: false, level: 0 };
        result.enhanceSim_gear_charm = { enabled: false, tier: 'grandmaster', level: 0 };

        if (equipment) {
            for (const item of equipment.values()) {
                if (!item?.itemHrid) continue;
                const hrid = item.itemHrid;
                const enhLevel = item.enhancementLevel || 0;

                if (ENHANCER_HRIDS[hrid]) {
                    result.enhanceSim_gear_enhancer = { enabled: true, tier: ENHANCER_HRIDS[hrid], level: enhLevel };
                } else if (CAPE_HRIDS[hrid]) {
                    result.enhanceSim_gear_cape = { enabled: true, tier: CAPE_HRIDS[hrid], level: enhLevel };
                } else if (CHARM_HRIDS[hrid]) {
                    result.enhanceSim_gear_charm = { enabled: true, tier: CHARM_HRIDS[hrid], level: enhLevel };
                } else if (NECK_HRIDS[hrid]) {
                    result.enhanceSim_gear_neck = { enabled: true, tier: NECK_HRIDS[hrid], level: enhLevel };
                } else if (RING_HRIDS[hrid]) {
                    result.enhanceSim_gear_ring = { enabled: true, tier: RING_HRIDS[hrid], level: enhLevel };
                } else if (EARRING_HRIDS[hrid]) {
                    result.enhanceSim_gear_earring = { enabled: true, tier: EARRING_HRIDS[hrid], level: enhLevel };
                } else if (FIXED_HRIDS[hrid]) {
                    const slot = FIXED_HRIDS[hrid];
                    result[`enhanceSim_gear_${slot}`] = { enabled: true, level: enhLevel };
                }
            }
        }

        return result;
    }

    /**
     * Get manual enhancing parameters from gear-based config settings
     * @returns {Object} Manual parameters
     */
    function getManualParams() {
        const getValue = (key, defaultValue) => {
            return config.getSettingValue(key, defaultValue);
        };

        const itemDetailMap = dataManager.getInitClientData()?.itemDetailMap || {};

        // --- ENHANCING ---
        const houseLevel = getValue('enhanceSim_houseLevel', 8);
        const baseEnhancingLevel = getValue('enhanceSim_enhancingLevel', 140);

        // --- TEA ---
        const teaEnabled = getValue('enhanceSim_teaEnabled', true);
        const teaSelection = teaEnabled ? getValue('enhanceSim_tea', 'ultra') : 'none';
        const wisdomTeaEnabled = getValue('enhanceSim_wisdomTea', true);
        const teas = {
            enhancing: teaSelection === 'basic',
            superEnhancing: teaSelection === 'super',
            ultraEnhancing: teaSelection === 'ultra',
            blessed: getValue('enhanceSim_blessedTea', true),
            wisdom: wisdomTeaEnabled,
        };
        const teaLevelBonus =
            teaSelection === 'ultra' ? 8 : teaSelection === 'super' ? 6 : teaSelection === 'basic' ? 3 : 0;
        const teaSpeedBonus =
            teaSelection === 'ultra' ? 6 : teaSelection === 'super' ? 4 : teaSelection === 'basic' ? 2 : 0;

        // --- GEAR ---
        const ENHANCER_TIERS = {
            cheese: '/items/cheese_enhancer',
            verdant: '/items/verdant_enhancer',
            azure: '/items/azure_enhancer',
            burble: '/items/burble_enhancer',
            crimson: '/items/crimson_enhancer',
            rainbow: '/items/rainbow_enhancer',
            holy: '/items/holy_enhancer',
            celestial: '/items/celestial_enhancer',
        };
        const CAPE_TIERS = {
            normal: '/items/chance_cape',
            refined: '/items/chance_cape_refined',
        };
        const CHARM_TIERS = {
            trainee: '/items/trainee_enhancing_charm',
            basic: '/items/basic_enhancing_charm',
            advanced: '/items/advanced_enhancing_charm',
            expert: '/items/expert_enhancing_charm',
            master: '/items/master_enhancing_charm',
            grandmaster: '/items/grandmaster_enhancing_charm',
        };
        const FIXED_GEAR = {
            gloves: '/items/enchanted_gloves',
            top: '/items/enhancers_top',
            bottoms: '/items/enhancers_bottoms',
            guzzling: '/items/guzzling_pouch',
        };
        const NECK_TIERS = {
            philo: '/items/philosophers_necklace',
            speed: '/items/necklace_of_speed',
        };
        const RING_TIERS = {
            philo: '/items/philosophers_ring',
            rarefind: '/items/ring_of_rare_find',
        };
        const EARRING_TIERS = {
            philo: '/items/philosophers_earrings',
            rarefind: '/items/earrings_of_rare_find',
        };

        // Helper to read compound gear setting
        const getGear = (key, defaults) => {
            const val = getValue(key, defaults);
            // Handle both object (new format) and missing/null
            if (val && typeof val === 'object') return val;
            return defaults;
        };

        // Calculate bonuses from each gear slot
        let equipmentSuccessBonus = 0;
        let equipmentSpeedBonus = 0;
        let equipmentRareFind = 0;
        let equipmentExperience = 0;
        let drinkConcentration = 0;
        const slotBreakdown = [];

        // Enhancer
        const enhancer = getGear('enhanceSim_gear_enhancer', { enabled: true, tier: 'celestial', level: 13 });
        if (enhancer.enabled) {
            const hrid = ENHANCER_TIERS[enhancer.tier] || ENHANCER_TIERS.celestial;
            const bonus = getGearSlotBonus(hrid, enhancer.level, itemDetailMap);
            equipmentSuccessBonus += bonus.success;
            equipmentSpeedBonus += bonus.speed;
            equipmentRareFind += bonus.rareFind;
            equipmentExperience += bonus.experience;
            const details = itemDetailMap[hrid];
            slotBreakdown.push({
                name: details?.name || 'Enhancer',
                enhancementLevel: enhancer.level,
                success: bonus.success,
                speed: bonus.speed,
                rareFind: bonus.rareFind,
                experience: bonus.experience,
            });
        }

        // Gloves
        const gloves = getGear('enhanceSim_gear_gloves', { enabled: true, level: 10 });
        if (gloves.enabled) {
            const bonus = getGearSlotBonus(FIXED_GEAR.gloves, gloves.level, itemDetailMap);
            equipmentSpeedBonus += bonus.speed;
            equipmentExperience += bonus.experience;
            const details = itemDetailMap[FIXED_GEAR.gloves];
            slotBreakdown.push({
                name: details?.name || 'Gloves',
                enhancementLevel: gloves.level,
                success: 0,
                speed: bonus.speed,
                rareFind: 0,
                experience: bonus.experience,
            });
        }

        // Top
        const top = getGear('enhanceSim_gear_top', { enabled: true, level: 10 });
        if (top.enabled) {
            const bonus = getGearSlotBonus(FIXED_GEAR.top, top.level, itemDetailMap);
            equipmentSpeedBonus += bonus.speed;
            equipmentRareFind += bonus.rareFind;
            equipmentExperience += bonus.experience;
            const details = itemDetailMap[FIXED_GEAR.top];
            slotBreakdown.push({
                name: details?.name || 'Top',
                enhancementLevel: top.level,
                success: 0,
                speed: bonus.speed,
                rareFind: bonus.rareFind,
                experience: bonus.experience,
            });
        }

        // Bottoms
        const bottoms = getGear('enhanceSim_gear_bottoms', { enabled: true, level: 10 });
        if (bottoms.enabled) {
            const bonus = getGearSlotBonus(FIXED_GEAR.bottoms, bottoms.level, itemDetailMap);
            equipmentSpeedBonus += bonus.speed;
            equipmentExperience += bonus.experience;
            const details = itemDetailMap[FIXED_GEAR.bottoms];
            slotBreakdown.push({
                name: details?.name || 'Bottoms',
                enhancementLevel: bottoms.level,
                success: 0,
                speed: bonus.speed,
                rareFind: 0,
                experience: bonus.experience,
            });
        }

        // Neck
        const neck = getGear('enhanceSim_gear_neck', { enabled: true, tier: 'philo', level: 10 });
        if (neck.enabled) {
            const hrid = NECK_TIERS[neck.tier] || NECK_TIERS.philo;
            const bonus = getGearSlotBonus(hrid, neck.level, itemDetailMap);
            equipmentSpeedBonus += bonus.speed;
            equipmentRareFind += bonus.rareFind;
            equipmentExperience += bonus.experience;
            const details = itemDetailMap[hrid];
            slotBreakdown.push({
                name: details?.name || 'Necklace',
                enhancementLevel: neck.level,
                success: 0,
                speed: bonus.speed,
                rareFind: bonus.rareFind,
                experience: bonus.experience,
            });
        }

        // Ring
        const ring = getGear('enhanceSim_gear_ring', { enabled: true, tier: 'philo', level: 10 });
        if (ring.enabled) {
            const hrid = RING_TIERS[ring.tier] || RING_TIERS.philo;
            const bonus = getGearSlotBonus(hrid, ring.level, itemDetailMap);
            equipmentSpeedBonus += bonus.speed;
            equipmentRareFind += bonus.rareFind;
            equipmentExperience += bonus.experience;
            const details = itemDetailMap[hrid];
            slotBreakdown.push({
                name: details?.name || 'Ring',
                enhancementLevel: ring.level,
                success: 0,
                speed: bonus.speed,
                rareFind: bonus.rareFind,
                experience: bonus.experience,
            });
        }

        // Earring
        const earring = getGear('enhanceSim_gear_earring', { enabled: true, tier: 'philo', level: 10 });
        if (earring.enabled) {
            const hrid = EARRING_TIERS[earring.tier] || EARRING_TIERS.philo;
            const bonus = getGearSlotBonus(hrid, earring.level, itemDetailMap);
            equipmentSpeedBonus += bonus.speed;
            equipmentRareFind += bonus.rareFind;
            equipmentExperience += bonus.experience;
            const details = itemDetailMap[hrid];
            slotBreakdown.push({
                name: details?.name || 'Earrings',
                enhancementLevel: earring.level,
                success: 0,
                speed: bonus.speed,
                rareFind: bonus.rareFind,
                experience: bonus.experience,
            });
        }

        // Cape
        const cape = getGear('enhanceSim_gear_cape', { enabled: true, tier: 'normal', level: 5 });
        if (cape.enabled) {
            const hrid = CAPE_TIERS[cape.tier] || CAPE_TIERS.normal;
            const bonus = getGearSlotBonus(hrid, cape.level, itemDetailMap);
            equipmentSpeedBonus += bonus.speed;
            equipmentExperience += bonus.experience;
            const details = itemDetailMap[hrid];
            slotBreakdown.push({
                name: details?.name || 'Cape',
                enhancementLevel: cape.level,
                success: 0,
                speed: bonus.speed,
                rareFind: 0,
                experience: bonus.experience,
            });
        }

        // Guzzling Pouch (provides drink concentration)
        const guzzling = getGear('enhanceSim_gear_guzzling', { enabled: true, level: 10 });
        if (guzzling.enabled) {
            const bonus = getGearSlotBonus(FIXED_GEAR.guzzling, guzzling.level, itemDetailMap);
            drinkConcentration = bonus.drinkConc;
        }

        // Charm (provides experience/wisdom bonus)
        const charm = getGear('enhanceSim_gear_charm', { enabled: true, tier: 'grandmaster', level: 0 });
        if (charm.enabled) {
            const hrid = CHARM_TIERS[charm.tier] || CHARM_TIERS.grandmaster;
            const bonus = getGearSlotBonus(hrid, charm.level, itemDetailMap);
            equipmentExperience += bonus.experience;
            const details = itemDetailMap[hrid];
            slotBreakdown.push({
                name: details?.name || 'Charm',
                enhancementLevel: charm.level,
                success: 0,
                speed: 0,
                rareFind: 0,
                experience: bonus.experience,
            });
        }

        // --- COMMUNITY BUFF ---
        const communityBuffLevel = getValue('enhanceSim_communityBuff', 0);
        const communitySpeedBonus = communityBuffLevel > 0 ? 20 + (communityBuffLevel - 1) * 0.5 : 0;

        // --- ACHIEVEMENT ---
        const achievementEnabled = getValue('enhanceSim_achievement', false);
        const achievementSuccessBonus = achievementEnabled ? 0.2 : 0;

        // --- HOUSE BONUSES ---
        const houseSpeedBonus = houseLevel * 1.0;
        const houseSuccessBonus = houseLevel * 0.05;

        // House wisdom: 0.05% per level per room (same as auto-detect)
        const houseRooms = dataManager.getHouseRooms();
        let houseWisdomBonus = 0;
        for (const [_hrid, room] of houseRooms) {
            const level = room.level || 0;
            if (level >= 1) {
                houseWisdomBonus += 0.05 * level;
            }
        }

        // --- SCALE TEA BONUSES WITH DRINK CONCENTRATION ---
        const scaledTeaLevelBonus = teaLevelBonus > 0 ? teaLevelBonus * (1 + drinkConcentration / 100) : 0;
        const scaledTeaSpeedBonus = teaSpeedBonus > 0 ? teaSpeedBonus * (1 + drinkConcentration / 100) : 0;

        // Tea wisdom bonus (Wisdom Tea/Coffee provide 12% wisdom, scales with drink concentration)
        const baseTeaWisdom = wisdomTeaEnabled ? 12 : 0;
        const teaWisdomBonus = baseTeaWisdom > 0 ? baseTeaWisdom * (1 + drinkConcentration / 100) : 0;

        // Community wisdom buff
        const communityWisdomLevel = getValue('enhanceSim_communityBuffWisdom', 0);
        const communityWisdomBonus = communityWisdomLevel > 0 ? 20 + (communityWisdomLevel - 1) * 0.5 : 0;

        // Achievement wisdom buff
        const achievementWisdomBonus =
            dataManager.getAchievementBuffFlatBoost('/action_types/enhancing', '/buff_types/wisdom') * 100;

        // --- TOTALS ---
        const totalToolBonus = equipmentSuccessBonus + houseSuccessBonus + achievementSuccessBonus;
        const totalSpeedBonus = equipmentSpeedBonus + houseSpeedBonus + communitySpeedBonus + scaledTeaSpeedBonus;
        const totalExperienceBonus =
            equipmentExperience + houseWisdomBonus + teaWisdomBonus + communityWisdomBonus + achievementWisdomBonus;
        const guzzlingBonus = 1 + drinkConcentration / 100;

        return {
            enhancingLevel: baseEnhancingLevel + scaledTeaLevelBonus,
            houseLevel: houseLevel,
            toolBonus: totalToolBonus,
            speedBonus: totalSpeedBonus,
            rareFindBonus: equipmentRareFind,
            experienceBonus: totalExperienceBonus,
            guzzlingBonus: guzzlingBonus,
            teas: teas,

            // Display info for manual mode
            toolSlot: null,
            bodySlot: null,
            legsSlot: null,
            handsSlot: null,
            detectedTeaBonus: scaledTeaLevelBonus,
            communityBuffLevel: communityBuffLevel,
            communitySpeedBonus: communitySpeedBonus,
            teaSpeedBonus: scaledTeaSpeedBonus,
            equipmentSpeedBonus: equipmentSpeedBonus,
            houseSpeedBonus: houseSpeedBonus,
            equipmentSuccessBonus: equipmentSuccessBonus,
            houseSuccessBonus: houseSuccessBonus,
            achievementSuccessBonus: achievementSuccessBonus,
            slotBreakdown: slotBreakdown,
        };
    }

    /**
     * Calculate enhancing bonuses from a single gear slot
     * @param {string} itemHrid - Item HRID
     * @param {number} enhancementLevel - Enhancement level (0-20)
     * @param {Object} itemDetailMap - Item details map
     * @returns {Object} { success, speed, rareFind, experience, drinkConc }
     */
    function getGearSlotBonus(itemHrid, enhancementLevel, itemDetailMap) {
        const itemDetails = itemDetailMap[itemHrid];
        if (!itemDetails) return { success: 0, speed: 0, rareFind: 0, experience: 0, drinkConc: 0 };

        const multiplier = getEnhancementMultiplier(itemDetails, enhancementLevel);
        const stats = itemDetails.equipmentDetail?.noncombatStats || {};

        return {
            success: (stats.enhancingSuccess || 0) * 100 * multiplier,
            speed: ((stats.enhancingSpeed || 0) + (stats.skillingSpeed || 0)) * 100 * multiplier,
            rareFind: ((stats.enhancingRareFind || 0) + (stats.skillingRareFind || 0)) * 100 * multiplier,
            experience: ((stats.enhancingExperience || 0) + (stats.skillingExperience || 0)) * 100 * multiplier,
            drinkConc: (stats.drinkConcentration || 0) * 100 * multiplier,
        };
    }

    var enhancementConfig = /*#__PURE__*/Object.freeze({
        __proto__: null,
        getAutoDetectedParams: getAutoDetectedParams,
        getDetectedGearSettings: getDetectedGearSettings,
        getEnhancingParams: getEnhancingParams
    });

    /**
     * React Input Utility
     * Handles programmatic updates to React-controlled input elements
     *
     * React uses an internal _valueTracker to detect changes. When setting
     * input values programmatically, we must manipulate this tracker to
     * ensure React recognizes the change and updates its state.
     */

    /**
     * Set value on a React-controlled input element
     * This is the critical pattern for making React recognize programmatic changes
     *
     * @param {HTMLInputElement} input - Input element (text, number, etc.)
     * @param {string|number} value - Value to set
     * @param {Object} options - Optional configuration
     * @param {boolean} options.focus - Whether to focus the input after setting (default: true)
     * @param {boolean} options.dispatchInput - Whether to dispatch input event (default: true)
     * @param {boolean} options.dispatchChange - Whether to dispatch change event (default: false)
     */
    function setReactInputValue(input, value, options = {}) {
        const { focus = true, dispatchInput = true, dispatchChange = false } = options;

        if (!input) {
            console.warn('[React Input] No input element provided');
            return;
        }

        // Save the current value
        const lastValue = input.value;

        // Set the new value directly on the DOM
        input.value = value;

        // This is the critical part: React stores an internal _valueTracker
        // We need to set it to the old value before dispatching the event
        // so React sees the difference and updates its state
        const tracker = input._valueTracker;
        if (tracker) {
            tracker.setValue(lastValue);
        }

        // Dispatch events based on options
        if (dispatchInput) {
            const inputEvent = new Event('input', { bubbles: true });
            inputEvent.simulated = true;
            input.dispatchEvent(inputEvent);
        }

        if (dispatchChange) {
            const changeEvent = new Event('change', { bubbles: true });
            changeEvent.simulated = true;
            input.dispatchEvent(changeEvent);
        }

        // Focus the input to show the value
        if (focus) {
            input.focus();
        }
    }

    /**
     * Check if an input element is React-controlled
     * React-controlled inputs have an internal _valueTracker property
     *
     * @param {HTMLInputElement} input - Input element to check
     * @returns {boolean} True if React-controlled
     */
    function isReactControlledInput(input) {
        return input && input._valueTracker !== undefined;
    }

    /**
     * Set value on a select element (non-React pattern, for completeness)
     *
     * @param {HTMLSelectElement} select - Select element
     * @param {string} value - Value to select
     * @param {boolean} dispatchChange - Whether to dispatch change event (default: true)
     */
    function setSelectValue(select, value, dispatchChange = true) {
        if (!select) {
            console.warn('[React Input] No select element provided');
            return;
        }

        // Find and select the option
        for (let i = 0; i < select.options.length; i++) {
            if (select.options[i].value === value) {
                select.options[i].selected = true;
                break;
            }
        }

        // Dispatch change event
        if (dispatchChange) {
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    /**
     * Set checked state on a checkbox/radio input (non-React pattern, for completeness)
     *
     * @param {HTMLInputElement} input - Checkbox or radio input
     * @param {boolean} checked - Checked state
     * @param {boolean} dispatchChange - Whether to dispatch change event (default: true)
     */
    function setCheckboxValue(input, checked, dispatchChange = true) {
        if (!input) {
            console.warn('[React Input] No input element provided');
            return;
        }

        input.checked = checked;

        // Dispatch change event
        if (dispatchChange) {
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    var reactInput = /*#__PURE__*/Object.freeze({
        __proto__: null,
        isReactControlledInput: isReactControlledInput,
        setCheckboxValue: setCheckboxValue,
        setReactInputValue: setReactInputValue,
        setSelectValue: setSelectValue
    });

    /**
     * Material Calculator Utility
     * Shared calculation logic for material requirements with artisan bonus
     */


    const ARTISAN_MATERIAL_MODE = {
        EXPECTED: 'expected',
        WORST_CASE: 'worst-case',
    };

    function normalizeArtisanMode(mode) {
        return mode === ARTISAN_MATERIAL_MODE.WORST_CASE
            ? ARTISAN_MATERIAL_MODE.WORST_CASE
            : ARTISAN_MATERIAL_MODE.EXPECTED;
    }

    /**
     * Get artisan material mode setting.
     * @returns {string}
     */
    function getArtisanMaterialMode() {
        const setting = config.getSettingValue('actions_artisanMaterialMode', ARTISAN_MATERIAL_MODE.EXPECTED);
        return normalizeArtisanMode(setting);
    }
    /**
     * Calculate total materials required, optionally using conservative per-action rounding.
     * @param {number} basePerAction
     * @param {number} artisanBonus
     * @param {number} numActions
     * @param {string} artisanMode
     * @returns {number}
     */
    function calculateTotalRequired(basePerAction, artisanBonus, numActions, artisanMode) {
        const materialsPerAction = basePerAction * (1 - artisanBonus);
        if (artisanMode === ARTISAN_MATERIAL_MODE.WORST_CASE) {
            return Math.ceil(materialsPerAction) * numActions;
        }
        return Math.ceil(materialsPerAction * numActions);
    }

    /**
     * Calculate materials reserved by queued actions
     * @param {string} actionHrid - Action HRID to check queue for (optional - if null, calculates for ALL queued actions)
     * @returns {Map<string, number>} Map of itemHrid -> queued quantity
     */
    function calculateQueuedMaterialsForAction(actionHrid = null) {
        const queuedMaterials = new Map();
        const gameData = dataManager.getInitClientData();

        if (!gameData) {
            return queuedMaterials;
        }

        // Get all queued actions
        const queuedActions = dataManager.getCurrentActions();

        if (!queuedActions || queuedActions.length === 0) {
            return queuedMaterials;
        }

        const artisanMode = getArtisanMaterialMode();

        // Process each queued action
        for (const queuedAction of queuedActions) {
            // If actionHrid is specified, only process matching actions
            if (actionHrid && queuedAction.actionHrid !== actionHrid) {
                continue;
            }

            const actionDetails = dataManager.getActionDetails(queuedAction.actionHrid);
            if (!actionDetails) {
                continue;
            }

            // Calculate remaining actions for this queued action
            // Finite actions: maxCount is target, currentCount is progress
            // Infinite actions: Skip for now (would require material limit calculation which is complex)
            let actionCount = 0;
            if (queuedAction.hasMaxCount) {
                actionCount = queuedAction.maxCount - queuedAction.currentCount;
            } else {
                // Infinite action - skip for now (materials for infinite actions are complex)
                // User can use the "Ignore queue" setting if they queue many infinite actions
                continue;
            }

            if (actionCount <= 0) {
                continue;
            }

            // Calculate artisan bonus for this action type
            const artisanBonus = calculateArtisanBonus(actionDetails);

            // Process regular input items
            if (actionDetails.inputItems && actionDetails.inputItems.length > 0) {
                for (const input of actionDetails.inputItems) {
                    const basePerAction = input.count || input.amount || 1;

                    // Calculate total materials needed for this queued action
                    const totalForAction = calculateTotalRequired(basePerAction, artisanBonus, actionCount, artisanMode);

                    // Add to queued total
                    const currentQueued = queuedMaterials.get(input.itemHrid) || 0;
                    queuedMaterials.set(input.itemHrid, currentQueued + totalForAction);
                }
            }

            // Process upgrade item (if exists)
            if (actionDetails.upgradeItemHrid) {
                // Upgrade items always need exactly 1 per action, no artisan reduction
                const totalForAction = actionCount;

                const currentQueued = queuedMaterials.get(actionDetails.upgradeItemHrid) || 0;
                queuedMaterials.set(actionDetails.upgradeItemHrid, currentQueued + totalForAction);
            }
        }

        return queuedMaterials;
    }

    /**
     * Calculate material requirements for an action
     * @param {string} actionHrid - Action HRID (e.g., "/actions/crafting/celestial_enhancer")
     * @param {number} numActions - Number of actions to perform
     * @param {boolean} accountForQueue - Whether to subtract queued materials from available inventory (default: false)
     * @returns {Array<Object>} Array of material requirement objects (includes upgrade items)
     */
    function calculateMaterialRequirements(actionHrid, numActions, accountForQueue = false) {
        const actionDetails = dataManager.getActionDetails(actionHrid);
        const inventory = dataManager.getInventory();
        const gameData = dataManager.getInitClientData();

        if (!actionDetails) {
            return [];
        }

        const artisanMode = getArtisanMaterialMode();

        // Calculate artisan bonus (material reduction from Artisan Tea)
        const artisanBonus = calculateArtisanBonus(actionDetails);

        // Get queued materials if accounting for queue
        // Pass null to get materials for ALL queued actions (not just matching actionHrid)
        const queuedMaterialsMap = accountForQueue ? calculateQueuedMaterialsForAction(null) : new Map();

        const materials = [];

        // Process regular input items first
        if (actionDetails.inputItems && actionDetails.inputItems.length > 0) {
            for (const input of actionDetails.inputItems) {
                const basePerAction = input.count || input.amount || 1;

                // Calculate total materials needed for requested actions
                const totalRequired = calculateTotalRequired(basePerAction, artisanBonus, numActions, artisanMode);

                // Only count unenhanced items — enhanced copies are distinct items the player
                // would not want consumed as crafting materials
                const have = inventory
                    .filter((i) => i.itemHrid === input.itemHrid && !i.enhancementLevel)
                    .reduce((sum, i) => sum + (i.count || 0), 0);

                // Calculate queued and available amounts
                const queued = queuedMaterialsMap.get(input.itemHrid) || 0;
                const available = Math.max(0, have - queued);
                const missingAmount = Math.max(0, totalRequired - available);

                const itemDetails = gameData.itemDetailMap[input.itemHrid];
                if (!itemDetails) {
                    continue;
                }

                materials.push({
                    itemHrid: input.itemHrid,
                    itemName: itemDetails.name,
                    required: totalRequired,
                    have: have,
                    queued: queued,
                    available: available,
                    missing: missingAmount,
                    isTradeable: itemDetails.isTradable === true, // British spelling
                    isUpgradeItem: false,
                });
            }
        }

        // Process upgrade item at the end (if exists)
        if (actionDetails.upgradeItemHrid) {
            // Upgrade items always need exactly 1 per action, no artisan reduction
            const totalRequired = numActions;

            const have = inventory
                .filter((i) => i.itemHrid === actionDetails.upgradeItemHrid && !i.enhancementLevel)
                .reduce((sum, i) => sum + (i.count || 0), 0);

            // Calculate queued and available amounts
            const queued = queuedMaterialsMap.get(actionDetails.upgradeItemHrid) || 0;
            const available = Math.max(0, have - queued);
            const missingAmount = Math.max(0, totalRequired - available);

            const itemDetails = gameData.itemDetailMap[actionDetails.upgradeItemHrid];
            if (itemDetails) {
                materials.push({
                    itemHrid: actionDetails.upgradeItemHrid,
                    itemName: itemDetails.name,
                    required: totalRequired,
                    have: have,
                    queued: queued,
                    available: available,
                    missing: missingAmount,
                    isTradeable: itemDetails.isTradable === true, // British spelling
                    isUpgradeItem: true, // Flag to identify upgrade items
                });
            }
        }

        return materials;
    }

    /**
     * Calculate artisan bonus (material reduction) for an action
     * @param {Object} actionDetails - Action details from game data
     * @returns {number} Artisan bonus (0-1 decimal, e.g., 0.1129 for 11.29% reduction)
     */
    function calculateArtisanBonus(actionDetails) {
        try {
            const gameData = dataManager.getInitClientData();
            if (!gameData) {
                return 0;
            }

            const { equipment, drinks: activeDrinks } = resolveActionContext(actionDetails.type);
            const itemDetailMap = gameData.itemDetailMap || {};
            const drinkConcentration = getDrinkConcentration(equipment, itemDetailMap);

            return parseArtisanBonus(activeDrinks, itemDetailMap, drinkConcentration);
        } catch (error) {
            console.error('[Material Calculator] Error calculating artisan bonus:', error);
            return 0;
        }
    }

    /**
     * Returns true if artisan tea is selected in a drink slot but has 0 quantity in inventory.
     * Used to warn the user that material counts reflect no artisan reduction.
     * @param {string} actionHrid
     * @returns {boolean}
     */
    function isArtisanTeaOutOfStock(actionHrid) {
        try {
            const actionDetails = dataManager.getActionDetails(actionHrid);
            if (!actionDetails) return false;

            const gameData = dataManager.getInitClientData();
            if (!gameData) return false;

            const itemDetailMap = gameData.itemDetailMap || {};

            // Raw slotted drinks (ignoring stock)
            const rawDrinks = dataManager.getActionDrinkSlots(actionDetails.type);
            if (!rawDrinks?.length) return false;

            // In-stock drinks come from resolveActionContext (already filtered)
            const { equipment, drinks: inStockDrinks } = resolveActionContext(actionDetails.type);
            const drinkConcentration = getDrinkConcentration(equipment, itemDetailMap);

            return (
                parseArtisanBonus(rawDrinks, itemDetailMap, drinkConcentration) > 0 &&
                parseArtisanBonus(inStockDrinks, itemDetailMap, drinkConcentration) === 0
            );
        } catch (error) {
            console.error('[Material Calculator] Error checking artisan tea stock:', error);
            return false;
        }
    }

    /**
     * Calculate material requirements for enhancement actions
     * Uses Markov chain statistics to determine expected materials needed
     * @param {string} itemHrid - Item HRID being enhanced
     * @param {number} startLevel - Current enhancement level (0-19)
     * @param {number} targetLevel - Target enhancement level (1-20)
     * @param {string|null} protectionItemHrid - Protection item HRID or null
     * @param {number} protectFromLevel - Level at which protection begins (0 = never)
     * @returns {Array<Object>} Array of material requirement objects (same format as calculateMaterialRequirements)
     */
    function calculateEnhancementMaterialRequirements(
        itemHrid,
        startLevel,
        targetLevel,
        protectionItemHrid,
        protectFromLevel,
        repeatCount
    ) {
        const gameData = dataManager.getInitClientData();
        if (!gameData) {
            return [];
        }

        const itemDetails = gameData.itemDetailMap[itemHrid];
        if (!itemDetails) {
            return [];
        }

        const enhancementCosts = itemDetails.enhancementCosts || [];
        if (enhancementCosts.length === 0) {
            return [];
        }

        // Get enhancing parameters (level, tool bonus, teas, etc.)
        const params = getEnhancingParams();
        const effectiveProtect = protectFromLevel >= 2 && protectFromLevel <= targetLevel ? protectFromLevel : 0;

        // Single Markov chain call for the full level range
        const calc = calculateEnhancement({
            enhancingLevel: params.enhancingLevel,
            houseLevel: params.houseLevel,
            toolBonus: params.toolBonus,
            speedBonus: params.speedBonus,
            itemLevel: itemDetails.itemLevel || 1,
            targetLevel: targetLevel,
            startLevel: startLevel,
            protectFrom: effectiveProtect,
            blessedTea: params.teas.blessed,
            guzzlingBonus: params.guzzlingBonus,
        });

        const inventory = dataManager.getInventory();
        const materials = [];

        // Process enhancement cost materials
        for (const cost of enhancementCosts) {
            // Skip coins — not tradeable, auto-deducted by the game
            if (cost.itemHrid === '/items/coin') {
                continue;
            }

            const matDetails = gameData.itemDetailMap[cost.itemHrid];
            if (!matDetails) {
                continue;
            }

            const totalQuantity = Math.ceil(cost.count * (repeatCount ?? calc.attempts));
            const have = inventory
                .filter((i) => i.itemHrid === cost.itemHrid && !i.enhancementLevel)
                .reduce((sum, i) => sum + (i.count || 0), 0);
            const missing = Math.max(0, totalQuantity - have);

            materials.push({
                itemHrid: cost.itemHrid,
                itemName: matDetails.name,
                required: totalQuantity,
                have: have,
                queued: 0,
                available: have,
                missing: missing,
                isTradeable: matDetails.isTradable === true,
                isUpgradeItem: false,
            });
        }

        // Add protection item if applicable
        // Skip Philosopher's Mirror — special mechanic, not consumed as standard protection
        if (calc.protectionCount > 0 && protectionItemHrid && protectionItemHrid !== '/items/philosophers_mirror') {
            const totalProtection = Math.ceil(calc.protectionCount);
            const protDetails = gameData.itemDetailMap[protectionItemHrid];

            if (protDetails) {
                const have = inventory
                    .filter((i) => i.itemHrid === protectionItemHrid && !i.enhancementLevel)
                    .reduce((sum, i) => sum + (i.count || 0), 0);
                const missing = Math.max(0, totalProtection - have);

                materials.push({
                    itemHrid: protectionItemHrid,
                    itemName: protDetails.name,
                    required: totalProtection,
                    have: have,
                    queued: 0,
                    available: have,
                    missing: missing,
                    isTradeable: protDetails.isTradable === true,
                    isUpgradeItem: false,
                });
            }
        }

        return materials;
    }

    var materialCalculator = /*#__PURE__*/Object.freeze({
        __proto__: null,
        ARTISAN_MATERIAL_MODE: ARTISAN_MATERIAL_MODE,
        calculateArtisanBonus: calculateArtisanBonus,
        calculateEnhancementMaterialRequirements: calculateEnhancementMaterialRequirements,
        calculateMaterialRequirements: calculateMaterialRequirements,
        calculateQueuedMaterialsForAction: calculateQueuedMaterialsForAction,
        isArtisanTeaOutOfStock: isArtisanTeaOutOfStock
    });

    /**
     * Pricing Helper Utility
     * Shared logic for selecting market prices based on pricing mode settings
     */


    /**
     * Select appropriate price from market data based on pricing mode settings
     * @param {Object} priceData - Market price data with bid/ask properties
     * @param {string} modeSetting - Config setting key for pricing mode (default: 'profitCalc_pricingMode')
     * @param {string} respectSetting - Config setting key for respect pricing mode flag (default: 'expectedValue_respectPricingMode')
     * @returns {number} Selected price (bid or ask)
     */
    function selectPrice(
        priceData,
        modeSetting = 'profitCalc_pricingMode',
        respectSetting = 'expectedValue_respectPricingMode'
    ) {
        if (!priceData) return 0;

        const pricingMode = config.getSettingValue(modeSetting, 'conservative');
        const respectPricingMode = config.getSettingValue(respectSetting, true);

        // If not respecting mode or mode is conservative/patientBuy, always use bid
        if (!respectPricingMode || pricingMode === 'conservative' || pricingMode === 'patientBuy') {
            return priceData.bid || 0;
        }

        // Hybrid/Optimistic: Use ask
        return priceData.ask || 0;
    }

    var pricingHelper = /*#__PURE__*/Object.freeze({
        __proto__: null,
        selectPrice: selectPrice
    });

    /**
     * Cleanup Registry Utility
     * Centralized registration for listeners, observers, timers, and custom cleanup.
     */

    /**
     * Create a cleanup registry for deterministic teardown.
     * @returns {{
     *   registerListener: (target: EventTarget, event: string, handler: Function, options?: Object) => void,
     *   registerObserver: (observer: MutationObserver|{ disconnect: Function }) => void,
     *   registerInterval: (intervalId: number) => void,
     *   registerTimeout: (timeoutId: number) => void,
     *   registerCleanup: (cleanupFn: Function) => void,
     *   cleanupAll: () => void
     * }} Cleanup registry API
     */
    function createCleanupRegistry() {
        const listeners = [];
        const observers = [];
        const intervals = [];
        const timeouts = [];
        const customCleanups = [];

        const registerListener = (target, event, handler, options) => {
            if (!target || !event || !handler) {
                console.warn('[CleanupRegistry] registerListener called with invalid arguments');
                return;
            }

            target.addEventListener(event, handler, options);
            listeners.push({ target, event, handler, options });
        };

        const registerObserver = (observer) => {
            if (!observer || typeof observer.disconnect !== 'function') {
                console.warn('[CleanupRegistry] registerObserver called with invalid observer');
                return;
            }

            observers.push(observer);
        };

        const registerInterval = (intervalId) => {
            if (!intervalId) {
                console.warn('[CleanupRegistry] registerInterval called with invalid interval id');
                return;
            }

            intervals.push(intervalId);
        };

        const registerTimeout = (timeoutId) => {
            if (!timeoutId) {
                console.warn('[CleanupRegistry] registerTimeout called with invalid timeout id');
                return;
            }

            timeouts.push(timeoutId);
        };

        const registerCleanup = (cleanupFn) => {
            if (typeof cleanupFn !== 'function') {
                console.warn('[CleanupRegistry] registerCleanup called with invalid function');
                return;
            }

            customCleanups.push(cleanupFn);
        };

        const cleanupAll = () => {
            listeners.forEach(({ target, event, handler, options }) => {
                try {
                    target.removeEventListener(event, handler, options);
                } catch (error) {
                    console.error('[CleanupRegistry] Failed to remove listener:', error);
                }
            });
            listeners.length = 0;

            observers.forEach((observer) => {
                try {
                    observer.disconnect();
                } catch (error) {
                    console.error('[CleanupRegistry] Failed to disconnect observer:', error);
                }
            });
            observers.length = 0;

            intervals.forEach((intervalId) => {
                try {
                    clearInterval(intervalId);
                } catch (error) {
                    console.error('[CleanupRegistry] Failed to clear interval:', error);
                }
            });
            intervals.length = 0;

            timeouts.forEach((timeoutId) => {
                try {
                    clearTimeout(timeoutId);
                } catch (error) {
                    console.error('[CleanupRegistry] Failed to clear timeout:', error);
                }
            });
            timeouts.length = 0;

            customCleanups.forEach((cleanupFn) => {
                try {
                    cleanupFn();
                } catch (error) {
                    console.error('[CleanupRegistry] Custom cleanup failed:', error);
                }
            });
            customCleanups.length = 0;
        };

        return {
            registerListener,
            registerObserver,
            registerInterval,
            registerTimeout,
            registerCleanup,
            cleanupAll,
        };
    }

    var cleanupRegistry = /*#__PURE__*/Object.freeze({
        __proto__: null,
        createCleanupRegistry: createCleanupRegistry
    });

    /**
     * House Cost Calculator Utility
     * Calculates the total cost to build house rooms to specific levels
     * Used for combat score calculation
     */


    /**
     * Calculate the total cost to build a house room to a specific level
     * @param {string} houseRoomHrid - House room HRID (e.g., '/house_rooms/dojo')
     * @param {number} currentLevel - Target level (1-8)
     * @returns {number} Total build cost in coins
     */
    function calculateHouseBuildCost(houseRoomHrid, currentLevel) {
        const gameData = dataManager.getInitClientData();
        if (!gameData) return 0;

        const houseRoomDetailMap = gameData.houseRoomDetailMap;
        if (!houseRoomDetailMap) return 0;

        const houseDetail = houseRoomDetailMap[houseRoomHrid];
        if (!houseDetail) return 0;

        const upgradeCostsMap = houseDetail.upgradeCostsMap;
        if (!upgradeCostsMap) return 0;

        let totalCost = 0;

        // Sum costs for all levels from 1 to current
        for (let level = 1; level <= currentLevel; level++) {
            const levelUpgrades = upgradeCostsMap[level];
            if (!levelUpgrades) continue;

            // Add cost for each material required at this level
            for (const item of levelUpgrades) {
                // Special case: Coins have face value of 1 (no market price)
                if (item.itemHrid === '/items/coin') {
                    const itemCost = item.count * 1;
                    totalCost += itemCost;
                    continue;
                }

                const prices = marketAPI.getPrice(item.itemHrid, 0);
                if (!prices) continue;

                // Match MCS behavior: if one price is positive and other is negative, use positive for both
                let ask = prices.ask;
                let bid = prices.bid;

                if (ask > 0 && bid < 0) {
                    bid = ask;
                }
                if (bid > 0 && ask < 0) {
                    ask = bid;
                }

                // Use weighted average
                const weightedPrice = (ask + bid) / 2;

                const itemCost = item.count * weightedPrice;
                totalCost += itemCost;
            }
        }

        return totalCost;
    }

    /**
     * Calculate total cost for all battle houses
     * @param {Object} characterHouseRooms - Map of character house rooms from profile data
     * @returns {Object} {totalCost, breakdown: [{name, level, cost}]}
     */
    function calculateBattleHousesCost(characterHouseRooms) {
        const battleHouses = ['dining_room', 'library', 'dojo', 'gym', 'armory', 'archery_range', 'mystical_study'];

        const gameData = dataManager.getInitClientData();
        if (!gameData) return { totalCost: 0, breakdown: [] };

        const houseRoomDetailMap = gameData.houseRoomDetailMap;
        if (!houseRoomDetailMap) return { totalCost: 0, breakdown: [] };

        let totalCost = 0;
        const breakdown = [];

        for (const [houseRoomHrid, houseData] of Object.entries(characterHouseRooms)) {
            // Check if this is a battle house
            const isBattleHouse = battleHouses.some((battleHouse) => houseRoomHrid.includes(battleHouse));

            if (!isBattleHouse) continue;

            const level = houseData.level || 0;
            if (level === 0) continue;

            const cost = calculateHouseBuildCost(houseRoomHrid, level);
            totalCost += cost;

            // Get human-readable name
            const houseDetail = houseRoomDetailMap[houseRoomHrid];
            const houseName = houseDetail?.name || houseRoomHrid.replace('/house_rooms/', '');

            breakdown.push({
                name: houseName,
                level: level,
                cost: cost,
            });
        }

        // Sort by cost descending
        breakdown.sort((a, b) => b.cost - a.cost);

        return { totalCost, breakdown };
    }

    var houseCostCalculator = /*#__PURE__*/Object.freeze({
        __proto__: null,
        calculateBattleHousesCost: calculateBattleHousesCost,
        calculateHouseBuildCost: calculateHouseBuildCost
    });

    /**
     * Alchemy Profit Calculator Module
     * Calculates profit for alchemy actions (Coinify, Decompose, Transmute) from game JSON data
     *
     * Success Rates (Base, Unmodified):
     * - Coinify: 70% (0.7)
     * - Decompose: 60% (0.6)
     * - Transmute: Varies by item (from item.alchemyDetail.transmuteSuccessRate)
     *
     * Success Rate Modifiers:
     * - Tea: Catalytic Tea provides /buff_types/alchemy_success (5% ratio boost, scales with Drink Concentration)
     * - Catalyst (type-specific): +15% multiplicative, consumed once per successful action
     * - Catalyst (prime): +25% multiplicative, consumed once per successful action
     * - Transmute under-level penalty: perLevel = 0.9 / itemLevel, applied when alchemyLevel < itemLevel
     * - Formula (coinify/decompose): finalRate = min(1, baseRate × (1 + catalystBonus + teaBonus))
     * - Formula (transmute): finalRate = min(1, baseRate × (1 + catalyst + perLevel × (alchemyLvl - itemLvl) + tea))
     */


    // Base success rates for alchemy actions
    const BASE_SUCCESS_RATES = {
        COINIFY: 0.7, // 70%
        DECOMPOSE: 0.6, // 60%
        // TRANSMUTE: varies by item (from alchemyDetail.transmuteSuccessRate)
    };

    // Catalyst item HRIDs — type-specific catalysts and the universal prime catalyst
    const CATALYST_HRIDS = {
        coinify: '/items/catalyst_of_coinification',
        decompose: '/items/catalyst_of_decomposition',
        transmute: '/items/catalyst_of_transmutation',
        prime: '/items/prime_catalyst',
    };

    // Multiplicative success rate bonuses for catalysts (hardcoded — not in game data structures)
    const CATALYST_BONUSES = {
        typeSpecific: 0.15, // 15% multiplicative
        prime: 0.25, // 25% multiplicative
    };

    /**
     * @param {Object} itemDetails - Item details from dataManager
     * @param {'decompose'|'transmute'} alchemyType - Which alchemy action
     * @returns {number} Gold cost per alchemy action (includes bulkMultiplier)
     */
    function calculateAlchemyCoinCost(itemDetails, alchemyType) {
        const bulkMultiplier = itemDetails.alchemyDetail?.bulkMultiplier || 1;
        if (alchemyType === 'transmute') {
            const sellPrice = itemDetails.sellPrice || 0;
            return Math.max(50, Math.floor(sellPrice / 5)) * bulkMultiplier;
        }
        // Decompose / Unrefine
        const level = itemDetails.itemLevel || 1;
        return (10 + level) * 5 * bulkMultiplier;
    }

    /**
     * Calculate alchemy-specific bonus drops (essences + rares) from item level.
     * Alchemy actions don't have essenceDropTable/rareDropTable in game data,
     * so we compute them from the item's level using reverse-engineered formulas.
     *
     * Essence: baseRate = (100 + itemLevel) / 1800
     * Rare (Small, level 1-34):  baseRate = (100 + itemLevel) / 144000
     * Rare (Medium, level 35-69): baseRate = (65 + itemLevel) / 216000
     * Rare (Large, level 70+):    baseRate = (30 + itemLevel) / 288000
     *
     * @param {number} itemLevel - The item's level (from itemDetails.itemLevel)
     * @param {number} actionsPerHour - Actions per hour (with efficiency)
     * @param {Map} equipment - Character equipment map
     * @param {Object} itemDetailMap - Item details map
     * @returns {Object} Bonus drop data with drops array and breakdowns
     */
    function calculateAlchemyBonusDrops(itemLevel, actionsPerHour, equipment, itemDetailMap) {
        const essenceFindBonus = parseEssenceFindBonus(equipment, itemDetailMap);

        const equipmentRareFindBonus = parseRareFindBonus(equipment, '/action_types/alchemy', itemDetailMap);
        const houseRareFindBonus = calculateHouseRareFind();
        const achievementRareFindBonus =
            dataManager.getAchievementBuffFlatBoost('/action_types/alchemy', '/buff_types/rare_find') * 100;
        const personalRareFindBonus =
            dataManager.getPersonalBuffFlatBoost('/action_types/alchemy', '/buff_types/rare_find') * 100;

        const guildBuffs = dataManager.characterData?.guildActionTypeBuffsMap?.['/action_types/alchemy'] || [];
        const guildRareFindBonus =
            guildBuffs.reduce(
                (sum, b) => (b.typeHrid === '/buff_types/rare_find' ? sum + (b.flatBoost || 0) + (b.ratioBoost || 0) : sum),
                0
            ) * 100;
        const guildEssenceFindBonus =
            guildBuffs.reduce(
                (sum, b) =>
                    b.typeHrid === '/buff_types/essence_find' ? sum + (b.flatBoost || 0) + (b.ratioBoost || 0) : sum,
                0
            ) * 100;

        const totalEssenceFindBonus = essenceFindBonus + guildEssenceFindBonus;
        const rareFindBonus =
            equipmentRareFindBonus +
            houseRareFindBonus +
            achievementRareFindBonus +
            personalRareFindBonus +
            guildRareFindBonus;

        const bonusDrops = [];
        let totalBonusRevenue = 0;

        // Essence drop: Alchemy Essence
        const baseEssenceRate = (100 + itemLevel) / 1800;
        const finalEssenceRate = baseEssenceRate * (1 + totalEssenceFindBonus / 100);
        const essenceDropsPerHour = actionsPerHour * finalEssenceRate;

        let essencePrice = 0;
        const essenceItemDetails = itemDetailMap['/items/alchemy_essence'];
        if (essenceItemDetails?.isOpenable) {
            essencePrice = expectedValueCalculator.getCachedValue('/items/alchemy_essence') || 0;
        } else {
            const price = marketAPI.getPrice('/items/alchemy_essence', 0);
            essencePrice = calculatePriceAfterTax(price?.bid ?? 0);
        }

        const essenceRevenuePerHour = essenceDropsPerHour * essencePrice;
        bonusDrops.push({
            itemHrid: '/items/alchemy_essence',
            count: 1,
            dropRate: finalEssenceRate,
            effectiveDropRate: finalEssenceRate,
            price: essencePrice,
            isEssence: true,
            isRare: false,
            revenuePerAttempt: finalEssenceRate * essencePrice,
            revenuePerHour: essenceRevenuePerHour,
            dropsPerHour: essenceDropsPerHour,
        });
        totalBonusRevenue += essenceRevenuePerHour;

        // Rare drop: Artisan's Crate (size depends on item level)
        let baseRareRate;
        let crateHrid;
        if (itemLevel < 35) {
            baseRareRate = (100 + itemLevel) / 144000;
            crateHrid = '/items/small_artisans_crate';
        } else if (itemLevel < 70) {
            baseRareRate = (65 + itemLevel) / 216000;
            crateHrid = '/items/medium_artisans_crate';
        } else {
            baseRareRate = (30 + itemLevel) / 288000;
            crateHrid = '/items/large_artisans_crate';
        }

        const finalRareRate = baseRareRate * (1 + rareFindBonus / 100);
        const rareDropsPerHour = actionsPerHour * finalRareRate;

        let cratePrice = 0;
        const crateItemDetails = itemDetailMap[crateHrid];
        if (crateItemDetails?.isOpenable) {
            // Try cached EV first, then compute on-demand if cache is empty
            cratePrice =
                expectedValueCalculator.getCachedValue(crateHrid) ||
                expectedValueCalculator.calculateSingleContainer(crateHrid) ||
                0;
        } else {
            const price = marketAPI.getPrice(crateHrid, 0);
            cratePrice = calculatePriceAfterTax(price?.bid ?? 0);
        }

        const rareRevenuePerHour = rareDropsPerHour * cratePrice;
        bonusDrops.push({
            itemHrid: crateHrid,
            count: 1,
            dropRate: finalRareRate,
            effectiveDropRate: finalRareRate,
            price: cratePrice,
            isEssence: false,
            isRare: true,
            revenuePerAttempt: finalRareRate * cratePrice,
            revenuePerHour: rareRevenuePerHour,
            dropsPerHour: rareDropsPerHour,
        });
        totalBonusRevenue += rareRevenuePerHour;

        return {
            bonusDrops,
            totalBonusRevenue,
            essenceFindBonus: totalEssenceFindBonus,
            rareFindBonus,
            rareFindBreakdown: {
                equipment: equipmentRareFindBonus,
                house: houseRareFindBonus,
                achievement: achievementRareFindBonus,
                personal: personalRareFindBonus,
                guild: guildRareFindBonus,
                total: rareFindBonus,
            },
            essenceFindBreakdown: {
                equipment: essenceFindBonus,
                guild: guildEssenceFindBonus,
                total: totalEssenceFindBonus,
            },
        };
    }

    class AlchemyProfitCalculator {
        constructor() {
            // Cache for item detail map
            this._itemDetailMap = null;
        }

        /**
         * Get item detail map (lazy-loaded and cached)
         * @returns {Object} Item details map from init_client_data
         */
        getItemDetailMap() {
            if (!this._itemDetailMap) {
                const initData = dataManager.getInitClientData();
                this._itemDetailMap = initData?.itemDetailMap || {};
            }
            return this._itemDetailMap;
        }

        /**
         * Calculate success rate with detailed breakdown
         * @param {number} baseRate - Base success rate (0-1)
         * @param {number} catalystBonus - Catalyst multiplicative bonus (0, 0.15, or 0.25)
         * @param {number|null} teaBonusOverride - If provided, use this instead of reading live buffs
         * @param {number} levelPenalty - Under-level penalty term (negative when below item level, 0 otherwise)
         * @returns {Object} Success rate breakdown { total, base, tea, catalyst, levelPenalty }
         */
        calculateSuccessRateBreakdown(baseRate, catalystBonus = 0, teaBonusOverride = null, levelPenalty = 0) {
            try {
                const teaBonus = teaBonusOverride !== null ? teaBonusOverride : getAlchemySuccessBonus();

                // Calculate final success rate:
                // base × (1 + catalyst + levelPenalty + tea)
                // levelPenalty is 0 when at or above item level
                const total = Math.min(1.0, baseRate * (1 + catalystBonus + levelPenalty + teaBonus));

                return {
                    total: Math.max(0, total),
                    base: baseRate,
                    tea: teaBonus,
                    catalyst: catalystBonus,
                    levelPenalty,
                };
            } catch (error) {
                console.error('[AlchemyProfitCalculator] Failed to calculate success rate breakdown:', error);
                return {
                    total: baseRate,
                    base: baseRate,
                    tea: 0,
                    catalyst: 0,
                };
            }
        }

        /**
         * Find the best catalyst+tea combination for an alchemy action.
         * Evaluates 6 combinations (no/type/prime catalyst × no/live tea) and returns
         * the combo that yields the highest profitPerHour.
         *
         * @param {Object} params
         * @param {string} params.actionType - 'coinify' | 'decompose' | 'transmute'
         * @param {number} params.baseSuccessRate - Base success rate before modifiers
         * @param {number} params.actionsPerHour - Actions per hour (with efficiency)
         * @param {number} params.efficiencyDecimal - Efficiency as decimal
         * @param {number} params.actionTime - Action time in seconds
         * @param {number} params.alchemyBonusRevenue - Bonus revenue per hour (essences + rares)
         * @param {Function} params.computeNetProfit - fn(successRate) => netProfitPerAttempt
         * @param {Function} params.computeTeaCost - fn(teaBonus) => totalTeaCostPerHour
         * @param {number} [params.levelPenalty=0] - Under-level penalty for transmute
         * @returns {Object} { catalystBonus, catalystHrid, catalystPrice, teaBonus, teaCostPerHour, successRateBreakdown }
         */
        _bestCatalystCombo({
            actionType,
            baseSuccessRate,
            actionsPerHour,
            efficiencyDecimal,
            actionTime,
            alchemyBonusRevenue,
            computeNetProfit,
            computeTeaCost,
            levelPenalty = 0,
            teaBonusOverride = null,
        }) {
            const liveTeaBonus = teaBonusOverride !== null ? teaBonusOverride : getAlchemySuccessBonus();
            const typeSpecificHrid = CATALYST_HRIDS[actionType];
            const primeCatalystHrid = CATALYST_HRIDS.prime;
            const typeSpecificPrice = getItemPrice(typeSpecificHrid, { context: 'profit', side: 'buy' }) ?? 0;
            const primeCatalystPrice = getItemPrice(primeCatalystHrid, { context: 'profit', side: 'buy' }) ?? 0;

            const combinations = [
                { catalystBonus: 0, catalystHrid: null, catalystPrice: 0, teaBonus: liveTeaBonus },
                { catalystBonus: 0, catalystHrid: null, catalystPrice: 0, teaBonus: 0 },
                {
                    catalystBonus: CATALYST_BONUSES.typeSpecific,
                    catalystHrid: typeSpecificHrid,
                    catalystPrice: typeSpecificPrice,
                    teaBonus: liveTeaBonus,
                },
                {
                    catalystBonus: CATALYST_BONUSES.typeSpecific,
                    catalystHrid: typeSpecificHrid,
                    catalystPrice: typeSpecificPrice,
                    teaBonus: 0,
                },
                {
                    catalystBonus: CATALYST_BONUSES.prime,
                    catalystHrid: primeCatalystHrid,
                    catalystPrice: primeCatalystPrice,
                    teaBonus: liveTeaBonus,
                },
                {
                    catalystBonus: CATALYST_BONUSES.prime,
                    catalystHrid: primeCatalystHrid,
                    catalystPrice: primeCatalystPrice,
                    teaBonus: 0,
                },
            ];

            let best = null;
            let bestProfitPerHour = -Infinity;

            for (const combo of combinations) {
                const successRateBreakdown = this.calculateSuccessRateBreakdown(
                    baseSuccessRate,
                    combo.catalystBonus,
                    combo.teaBonus,
                    levelPenalty
                );
                const successRate = successRateBreakdown.total;

                // Catalyst cost: consumed once per successful action
                const catalystCostPerAttempt = combo.catalystPrice * successRate;
                const catalystCostPerHour = catalystCostPerAttempt * actionsPerHour;

                const netProfitPerAttempt = computeNetProfit(successRate) - catalystCostPerAttempt;
                const teaCostPerHour = combo.teaBonus > 0 ? computeTeaCost(combo.teaBonus) : 0;

                const profitPerSecond = (netProfitPerAttempt * (1 + efficiencyDecimal)) / actionTime;
                const profitPerHour = profitPerSecond * SECONDS_PER_HOUR + alchemyBonusRevenue - teaCostPerHour;

                if (profitPerHour > bestProfitPerHour) {
                    bestProfitPerHour = profitPerHour;
                    best = {
                        ...combo,
                        successRateBreakdown,
                        successRate,
                        catalystCostPerAttempt,
                        catalystCostPerHour,
                        teaCostPerHour,
                        netProfitPerAttempt,
                        profitPerHour,
                    };
                }
            }

            return best;
        }

        _liveSetupCombo({
            baseSuccessRate,
            actionsPerHour,
            efficiencyDecimal,
            actionTime,
            alchemyBonusRevenue,
            computeNetProfit,
            computeTeaCost,
            levelPenalty = 0,
        }) {
            const liveTeaBonus = getAlchemySuccessBonus();

            // Read the live catalyst from the DOM slot
            const catalystUse = document.querySelector(
                '[class*="SkillActionDetail_catalystItemInputContainer"] [class*="Item_itemContainer"] svg use'
            );
            const iconName = catalystUse?.getAttribute('href')?.match(/#(.+)$/)?.[1] || null;
            const liveCatalystHrid = iconName ? `/items/${iconName}` : null;

            let catalystBonus = 0;
            let catalystHrid = null;
            let catalystPrice = 0;

            if (liveCatalystHrid === CATALYST_HRIDS.prime) {
                catalystBonus = CATALYST_BONUSES.prime;
                catalystHrid = liveCatalystHrid;
            } else if (liveCatalystHrid && Object.values(CATALYST_HRIDS).includes(liveCatalystHrid)) {
                catalystBonus = CATALYST_BONUSES.typeSpecific;
                catalystHrid = liveCatalystHrid;
            }
            if (catalystHrid) {
                catalystPrice = getItemPrice(catalystHrid, { context: 'profit', side: 'buy' }) ?? 0;
            }

            const successRateBreakdown = this.calculateSuccessRateBreakdown(
                baseSuccessRate,
                catalystBonus,
                liveTeaBonus,
                levelPenalty
            );
            const successRate = successRateBreakdown.total;
            const catalystCostPerAttempt = catalystPrice * successRate;
            const catalystCostPerHour = catalystCostPerAttempt * actionsPerHour;
            const teaCostPerHour = liveTeaBonus > 0 ? computeTeaCost(liveTeaBonus) : 0;
            const netProfitPerAttempt = computeNetProfit(successRate) - catalystCostPerAttempt;
            const profitPerSecond = (netProfitPerAttempt * (1 + efficiencyDecimal)) / actionTime;
            const profitPerHour = profitPerSecond * SECONDS_PER_HOUR + alchemyBonusRevenue - teaCostPerHour;
            return {
                catalystBonus,
                catalystHrid,
                catalystPrice,
                teaBonus: liveTeaBonus,
                successRateBreakdown,
                successRate,
                catalystCostPerAttempt,
                catalystCostPerHour,
                teaCostPerHour,
                netProfitPerAttempt,
                profitPerHour,
            };
        }

        /**
         * @param {string} itemHrid - Item HRID
         * @param {number} enhancementLevel - Enhancement level (default 0)
         * @returns {Object|null} Detailed profit data or null if not coinifiable
         */
        calculateCoinifyProfit(
            itemHrid,
            enhancementLevel = 0,
            useLiveSetup = false,
            teaBonusOverride = null,
            drinksOverride = null
        ) {
            try {
                const gameData = dataManager.getInitClientData();
                const itemDetails = dataManager.getItemDetails(itemHrid);

                if (!gameData || !itemDetails) {
                    return null;
                }

                // Check if item is coinifiable
                if (!itemDetails.alchemyDetail || itemDetails.alchemyDetail.isCoinifiable !== true) {
                    return null;
                }

                // Get alchemy action details
                const actionDetails = gameData.actionDetailMap['/actions/alchemy/coinify'];
                if (!actionDetails) {
                    return null;
                }

                // Get pricing mode
                const pricingMode = config.getSettingValue('profitCalc_pricingMode', 'hybrid');

                // Calculate action stats (time + efficiency) using shared helper
                // Alchemy uses item level (not action requirement) for efficiency calculation
                const actionStats = calculateActionStats(actionDetails, {
                    skills: dataManager.getSkills(),
                    equipment: dataManager.getEquipment(),
                    itemDetailMap: gameData.itemDetailMap,
                    includeCommunityBuff: true,
                    includeBreakdown: true,
                    levelRequirementOverride: itemDetails.itemLevel || 1,
                    drinksOverride,
                });

                const { actionTime, totalEfficiency, efficiencyBreakdown } = actionStats;

                // Get equipment for drink concentration and speed calculation
                const equipment = dataManager.getEquipment();

                // Calculate action speed breakdown with details
                const _baseTime = actionDetails.baseTimeCost / 1e9;
                const speedBonus = parseEquipmentSpeedBonuses(equipment, actionDetails.type, gameData.itemDetailMap);

                // Get detailed equipment speed breakdown
                const allSpeedBonuses = debugEquipmentSpeedBonuses(equipment, gameData.itemDetailMap);
                const skillName = actionDetails.type.replace('/action_types/', '');
                const skillSpecificSpeed = skillName + 'Speed';
                const relevantSpeeds = allSpeedBonuses.filter((item) => {
                    return item.speedType === skillSpecificSpeed || item.speedType === 'skillingSpeed';
                });

                // TODO: Add tea speed bonuses when tea-parser supports it
                const teaSpeed = 0;
                const actionSpeedBreakdown = {
                    total: speedBonus + teaSpeed,
                    equipment: speedBonus,
                    tea: teaSpeed,
                    equipmentDetails: relevantSpeeds.map((item) => ({
                        name: item.itemName,
                        enhancementLevel: item.enhancementLevel,
                        speedBonus: item.scaledBonus,
                    })),
                    teaDetails: [], // TODO: Add when tea speed is supported
                };

                // Get drink concentration separately (not in breakdown from calculateActionStats)
                const drinkConcentration = getDrinkConcentration(equipment, gameData.itemDetailMap);

                // Calculate input cost (material cost)
                const bulkMultiplier = itemDetails.alchemyDetail?.bulkMultiplier || 1;
                const pricePerItem = getItemPrice(itemHrid, { context: 'profit', side: 'buy', enhancementLevel });
                if (pricePerItem === null) {
                    return null; // No market data
                }
                const materialCost = pricePerItem * bulkMultiplier;

                // Coinify has no coin cost — items go in, coins come out
                const coinCost = 0;

                // Calculate output value (coins produced)
                // Formula: sellPrice × bulkMultiplier × 5
                const coinsProduced = (itemDetails.sellPrice || 0) * bulkMultiplier * 5;

                // Calculate per-hour values
                // Actions per hour (for display breakdown) - includes efficiency for display purposes
                // Convert efficiency from percentage to decimal (81.516% -> 0.81516)
                const efficiencyDecimal = totalEfficiency / 100;
                const actionsPerHourWithEfficiency = calculateActionsPerHour(actionTime) * (1 + efficiencyDecimal);

                // Calculate bonus revenue (essences + rares) from item level
                const itemLevel = itemDetails.itemLevel || 1;
                const alchemyBonus = calculateAlchemyBonusDrops(
                    itemLevel,
                    actionsPerHourWithEfficiency,
                    equipment,
                    gameData.itemDetailMap
                );

                // Calculate live tea cost (used for tea combinations)
                const teaCostData = calculateTeaCostsPerHour({
                    drinkSlots: dataManager.getActionDrinkSlots('/action_types/alchemy'),
                    drinkConcentration,
                    itemDetailMap: gameData.itemDetailMap,
                    getItemPrice: (hrid) => getItemPrice(hrid, { context: 'profit', side: 'buy' }),
                });

                // Find the best catalyst+tea combination (tooltip) or use live setup (action page)
                const _comboFn = useLiveSetup ? this._liveSetupCombo.bind(this) : this._bestCatalystCombo.bind(this);
                const combo = _comboFn({
                    actionType: 'coinify',
                    baseSuccessRate: BASE_SUCCESS_RATES.COINIFY,
                    actionsPerHour: actionsPerHourWithEfficiency,
                    efficiencyDecimal,
                    actionTime,
                    alchemyBonusRevenue: alchemyBonus.totalBonusRevenue,
                    computeNetProfit: (successRate) => coinsProduced * successRate - (materialCost + coinCost),
                    computeTeaCost: () => teaCostData.totalCostPerHour,
                    teaBonusOverride,
                });

                const {
                    successRateBreakdown,
                    successRate,
                    catalystCostPerAttempt,
                    catalystCostPerHour,
                    teaCostPerHour,
                    netProfitPerAttempt,
                    profitPerHour: comboProfitPerHour,
                } = combo;

                // Revenue per attempt using winning combo's success rate
                const revenuePerAttempt = coinsProduced * successRate;
                const costPerAttempt = materialCost + coinCost + catalystCostPerAttempt;

                // Per-hour totals
                const materialCostPerHour = (materialCost + coinCost) * actionsPerHourWithEfficiency;
                const revenuePerHour = revenuePerAttempt * actionsPerHourWithEfficiency + alchemyBonus.totalBonusRevenue;

                const profitPerHour = comboProfitPerHour;
                const profitPerDay = calculateProfitPerDay(profitPerHour);

                // Build detailed breakdowns
                const requirementCosts = [
                    {
                        itemHrid,
                        count: bulkMultiplier,
                        price: pricePerItem,
                        costPerAction: materialCost,
                        costPerHour: materialCost * actionsPerHourWithEfficiency,
                        enhancementLevel: enhancementLevel || 0,
                    },
                ];

                // Add coin cost entry if applicable
                if (coinCost > 0) ;

                const coinRevenuePerHour = revenuePerAttempt * actionsPerHourWithEfficiency;

                const dropRevenues = [
                    {
                        itemHrid: '/items/coin',
                        count: coinsProduced,
                        dropRate: 1.0, // Coins always drop
                        effectiveDropRate: 1.0,
                        price: 1, // Coins are 1:1
                        isEssence: false,
                        isRare: false,
                        revenuePerAttempt,
                        revenuePerHour: coinRevenuePerHour,
                        dropsPerHour: coinsProduced * successRate * actionsPerHourWithEfficiency,
                    },
                ];

                // Add alchemy essence and rare drops
                for (const drop of alchemyBonus.bonusDrops) {
                    dropRevenues.push(drop);
                }

                const catalystCost = {
                    itemHrid: combo.catalystHrid,
                    price: combo.catalystPrice,
                    costPerSuccess: combo.catalystPrice,
                    costPerAttempt: catalystCostPerAttempt,
                    costPerHour: catalystCostPerHour,
                };

                const consumableCosts = teaCostData.costs.map((cost) => ({
                    itemHrid: cost.itemHrid,
                    price: cost.pricePerDrink,
                    drinksPerHour: cost.drinksPerHour,
                    costPerHour: cost.totalCost,
                }));

                // Return comprehensive data matching what action panel needs
                return {
                    // Basic info
                    actionType: 'coinify',
                    itemHrid,
                    enhancementLevel,

                    // Summary totals
                    profitPerHour,
                    profitPerDay,
                    revenuePerHour,

                    // Actions and rates
                    actionsPerHour: actionsPerHourWithEfficiency,
                    actionTime,

                    // Per-attempt economics
                    materialCost,
                    catalystPrice: combo.catalystPrice,
                    costPerAttempt,
                    incomePerAttempt: revenuePerAttempt,
                    netProfitPerAttempt,
                    profitPerAction: profitPerHour / actionsPerHourWithEfficiency,

                    // Per-hour costs
                    materialCostPerHour,
                    catalystCostPerHour,
                    totalTeaCostPerHour: teaCostPerHour,

                    // Detailed breakdowns
                    requirementCosts,
                    dropRevenues,
                    catalystCost,
                    consumableCosts,

                    // Core stats
                    successRate,
                    efficiency: efficiencyDecimal, // Decimal form (0.81516 for 81.516%)

                    // Modifier breakdowns
                    successRateBreakdown,
                    efficiencyBreakdown,
                    actionSpeedBreakdown,
                    rareFindBreakdown: alchemyBonus.rareFindBreakdown,
                    essenceFindBreakdown: alchemyBonus.essenceFindBreakdown,

                    // Winning catalyst/tea combo indicators (for tooltip icons)
                    winningCatalystHrid: combo.catalystHrid,
                    winningTeaUsed: combo.teaBonus > 0,

                    // Pricing info
                    pricingMode,
                };
            } catch (error) {
                console.error('[AlchemyProfitCalculator] Failed to calculate coinify profit:', error);
                return null;
            }
        }

        /**
         * Calculate Decompose profit for an item with full detailed breakdown
         * @param {string} itemHrid - Item HRID
         * @param {number} enhancementLevel - Enhancement level (default 0)
         * @returns {Object|null} Profit data or null if not decomposable
         */
        calculateDecomposeProfit(
            itemHrid,
            enhancementLevel = 0,
            useLiveSetup = false,
            teaBonusOverride = null,
            drinksOverride = null
        ) {
            try {
                const gameData = dataManager.getInitClientData();
                const itemDetails = dataManager.getItemDetails(itemHrid);

                if (!gameData || !itemDetails) {
                    return null;
                }

                // Check if item is decomposable
                if (!itemDetails.alchemyDetail || !itemDetails.alchemyDetail.decomposeItems) {
                    return null;
                }

                // Get alchemy action details
                const actionDetails = gameData.actionDetailMap['/actions/alchemy/decompose'];
                if (!actionDetails) {
                    return null;
                }

                // Get pricing mode
                const pricingMode = config.getSettingValue('profitCalc_pricingMode', 'hybrid');

                // Calculate action stats (time + efficiency) using shared helper
                // Alchemy uses item level (not action requirement) for efficiency calculation
                const actionStats = calculateActionStats(actionDetails, {
                    skills: dataManager.getSkills(),
                    equipment: dataManager.getEquipment(),
                    itemDetailMap: gameData.itemDetailMap,
                    includeCommunityBuff: true,
                    includeBreakdown: true,
                    levelRequirementOverride: itemDetails.itemLevel || 1,
                    drinksOverride,
                });

                const { actionTime, totalEfficiency, efficiencyBreakdown } = actionStats;

                // Get equipment for drink concentration and speed calculation
                const equipment = dataManager.getEquipment();

                // Calculate action speed breakdown with details
                const _baseTime = actionDetails.baseTimeCost / 1e9;
                const speedBonus = parseEquipmentSpeedBonuses(equipment, actionDetails.type, gameData.itemDetailMap);

                // Get detailed equipment speed breakdown
                const allSpeedBonuses = debugEquipmentSpeedBonuses(equipment, gameData.itemDetailMap);
                const skillName = actionDetails.type.replace('/action_types/', '');
                const skillSpecificSpeed = skillName + 'Speed';
                const relevantSpeeds = allSpeedBonuses.filter((item) => {
                    return item.speedType === skillSpecificSpeed || item.speedType === 'skillingSpeed';
                });

                // TODO: Add tea speed bonuses when tea-parser supports it
                const teaSpeed = 0;
                const actionSpeedBreakdown = {
                    total: speedBonus + teaSpeed,
                    equipment: speedBonus,
                    tea: teaSpeed,
                    equipmentDetails: relevantSpeeds.map((item) => ({
                        name: item.itemName,
                        enhancementLevel: item.enhancementLevel,
                        speedBonus: item.scaledBonus,
                    })),
                    teaDetails: [], // TODO: Add when tea speed is supported
                };
                const drinkConcentration = getDrinkConcentration(equipment, gameData.itemDetailMap);

                // Get input cost (market price of the item being decomposed)
                const inputPrice = getItemPrice(itemHrid, { context: 'profit', side: 'buy', enhancementLevel });
                if (inputPrice === null) {
                    return null; // No market data
                }

                // Calculate output value
                let outputValue = 0;
                const dropDetails = [];

                // 1. Base decompose items (always received on success)
                for (const output of itemDetails.alchemyDetail.decomposeItems) {
                    const outputPrice = getItemPrice(output.itemHrid, { context: 'profit', side: 'sell' });
                    if (outputPrice !== null) {
                        const afterTax = calculatePriceAfterTax(outputPrice);
                        const dropValue = afterTax * output.count;
                        outputValue += dropValue;

                        dropDetails.push({
                            itemHrid: output.itemHrid,
                            count: output.count,
                            price: afterTax,
                            afterTax,
                            isEssence: false,
                            expectedValue: dropValue,
                        });
                    }
                }

                // 2. Enhancing Essence (if item is enhanced)
                let essenceAmount = 0;
                if (enhancementLevel > 0) {
                    const itemLevel = itemDetails.itemLevel || 1;
                    essenceAmount = Math.round(2 * (0.5 + 0.1 * Math.pow(1.05, itemLevel)) * Math.pow(2, enhancementLevel));

                    const essencePrice = getItemPrice('/items/enhancing_essence', { context: 'profit', side: 'sell' });
                    if (essencePrice !== null) {
                        const afterTax = calculatePriceAfterTax(essencePrice);
                        const dropValue = afterTax * essenceAmount;
                        outputValue += dropValue;

                        dropDetails.push({
                            itemHrid: '/items/enhancing_essence',
                            count: essenceAmount,
                            price: afterTax,
                            afterTax,
                            isEssence: true,
                            expectedValue: dropValue,
                        });
                    }
                }

                const coinCost = calculateAlchemyCoinCost(itemDetails, 'decompose');

                // Calculate per-hour values
                // Convert efficiency from percentage to decimal
                const efficiencyDecimal = totalEfficiency / 100;
                const actionsPerHourWithEfficiency = calculateActionsPerHour(actionTime) * (1 + efficiencyDecimal);

                // Calculate bonus revenue (essences + rares) from item level
                const itemLevel = itemDetails.itemLevel || 1;
                const alchemyBonus = calculateAlchemyBonusDrops(
                    itemLevel,
                    actionsPerHourWithEfficiency,
                    equipment,
                    gameData.itemDetailMap
                );

                // Calculate live tea cost (used for tea combinations)
                const teaCostData = calculateTeaCostsPerHour({
                    drinkSlots: dataManager.getActionDrinkSlots('/action_types/alchemy'),
                    drinkConcentration,
                    itemDetailMap: gameData.itemDetailMap,
                    getItemPrice: (hrid) => getItemPrice(hrid, { context: 'profit', side: 'buy' }),
                });

                // Find the best catalyst+tea combination (tooltip) or use live setup (action page)
                const _comboFn = useLiveSetup ? this._liveSetupCombo.bind(this) : this._bestCatalystCombo.bind(this);
                const combo = _comboFn({
                    actionType: 'decompose',
                    baseSuccessRate: BASE_SUCCESS_RATES.DECOMPOSE,
                    actionsPerHour: actionsPerHourWithEfficiency,
                    efficiencyDecimal,
                    actionTime,
                    alchemyBonusRevenue: alchemyBonus.totalBonusRevenue,
                    computeNetProfit: (successRate) => outputValue * successRate - (inputPrice + coinCost),
                    computeTeaCost: () => teaCostData.totalCostPerHour,
                    teaBonusOverride,
                });

                const {
                    successRateBreakdown,
                    successRate,
                    catalystCostPerAttempt,
                    catalystCostPerHour,
                    teaCostPerHour,
                    netProfitPerAttempt,
                    profitPerHour: comboProfitPerHour,
                } = combo;

                // Revenue and cost using winning combo's success rate
                const revenuePerAttempt = outputValue * successRate;
                const costPerAttempt = inputPrice + coinCost + catalystCostPerAttempt;

                // Per-hour totals
                const materialCostPerHour = (inputPrice + coinCost) * actionsPerHourWithEfficiency;
                const revenuePerHour = revenuePerAttempt * actionsPerHourWithEfficiency + alchemyBonus.totalBonusRevenue;

                const profitPerHour = comboProfitPerHour;
                const profitPerDay = calculateProfitPerDay(profitPerHour);

                // Build detailed breakdowns
                const requirementCosts = [
                    {
                        itemHrid,
                        count: 1,
                        price: inputPrice,
                        costPerAction: inputPrice,
                        costPerHour: inputPrice * actionsPerHourWithEfficiency,
                        enhancementLevel: enhancementLevel || 0,
                    },
                ];

                // Add coin cost entry if applicable
                if (coinCost > 0) {
                    requirementCosts.push({
                        itemHrid: '/items/coin',
                        count: coinCost,
                        price: 1,
                        costPerAction: coinCost,
                        costPerHour: coinCost * actionsPerHourWithEfficiency,
                        enhancementLevel: 0,
                    });
                }

                const dropRevenues = dropDetails.map((drop) => ({
                    itemHrid: drop.itemHrid,
                    count: drop.count,
                    dropRate: 1.0, // Decompose drops are guaranteed on success
                    effectiveDropRate: 1.0,
                    price: drop.price,
                    isEssence: drop.isEssence,
                    isRare: false,
                    revenuePerAttempt: drop.expectedValue * successRate,
                    revenuePerHour: drop.expectedValue * successRate * actionsPerHourWithEfficiency,
                    dropsPerHour: drop.count * successRate * actionsPerHourWithEfficiency,
                }));

                // Add alchemy essence and rare drops
                for (const drop of alchemyBonus.bonusDrops) {
                    dropRevenues.push(drop);
                }

                const catalystCost = {
                    itemHrid: combo.catalystHrid,
                    price: combo.catalystPrice,
                    costPerSuccess: combo.catalystPrice,
                    costPerAttempt: catalystCostPerAttempt,
                    costPerHour: catalystCostPerHour,
                };

                const consumableCosts = teaCostData.costs.map((cost) => ({
                    itemHrid: cost.itemHrid,
                    price: cost.pricePerDrink,
                    drinksPerHour: cost.drinksPerHour,
                    costPerHour: cost.totalCost,
                }));

                // Return comprehensive data matching what action panel needs
                return {
                    // Basic info
                    actionType: 'decompose',
                    itemHrid,
                    enhancementLevel,

                    // Summary totals
                    profitPerHour,
                    profitPerDay,
                    revenuePerHour,

                    // Actions and rates
                    actionsPerHour: actionsPerHourWithEfficiency,
                    actionTime,

                    // Per-attempt economics
                    materialCost: inputPrice,
                    catalystPrice: combo.catalystPrice,
                    costPerAttempt,
                    incomePerAttempt: revenuePerAttempt,
                    netProfitPerAttempt,
                    profitPerAction: profitPerHour / actionsPerHourWithEfficiency,

                    // Per-hour costs
                    materialCostPerHour,
                    catalystCostPerHour,
                    totalTeaCostPerHour: teaCostPerHour,

                    // Detailed breakdowns
                    requirementCosts,
                    dropRevenues,
                    catalystCost,
                    consumableCosts,

                    // Core stats
                    successRate,
                    efficiency: efficiencyDecimal,

                    // Modifier breakdowns
                    successRateBreakdown,
                    efficiencyBreakdown,
                    actionSpeedBreakdown,
                    rareFindBreakdown: alchemyBonus.rareFindBreakdown,
                    essenceFindBreakdown: alchemyBonus.essenceFindBreakdown,

                    // Winning catalyst/tea combo indicators (for tooltip icons)
                    winningCatalystHrid: combo.catalystHrid,
                    winningTeaUsed: combo.teaBonus > 0,

                    // Pricing info
                    pricingMode,
                };
            } catch (error) {
                console.error('[AlchemyProfitCalculator] Failed to calculate decompose profit:', error);
                return null;
            }
        }

        /**
         * Calculate Transmute profit for an item with full detailed breakdown
         * @param {string} itemHrid - Item HRID
         * @returns {Object|null} Profit data or null if not transmutable
         */
        calculateTransmuteProfit(itemHrid, useLiveSetup = false, teaBonusOverride = null, drinksOverride = null) {
            try {
                const gameData = dataManager.getInitClientData();
                const itemDetails = dataManager.getItemDetails(itemHrid);

                if (!gameData || !itemDetails) {
                    return null;
                }

                // Check if item is transmutable
                if (!itemDetails.alchemyDetail || !itemDetails.alchemyDetail.transmuteDropTable) {
                    return null;
                }

                // Get base success rate from item
                const baseSuccessRate = itemDetails.alchemyDetail.transmuteSuccessRate || 0;
                if (baseSuccessRate === 0) {
                    return null; // Cannot transmute
                }

                // Calculate under-level penalty for transmute
                // Formula: perLevel × (alchemyLevel - itemLevel) where perLevel = 0.9 / itemLevel
                const itemLevel = itemDetails.itemLevel || 1;
                const skills = dataManager.getSkills();
                const alchemySkill = skills?.find((s) => s.skillHrid === '/skills/alchemy');
                const alchemyLevel = alchemySkill?.level || 1;
                const levelPenalty = alchemyLevel < itemLevel ? (0.9 / itemLevel) * (alchemyLevel - itemLevel) : 0;

                // Get alchemy action details
                const actionDetails = gameData.actionDetailMap['/actions/alchemy/transmute'];
                if (!actionDetails) {
                    return null;
                }

                // Get pricing mode
                const pricingMode = config.getSettingValue('profitCalc_pricingMode', 'hybrid');

                // Calculate action stats (time + efficiency) using shared helper
                // Alchemy uses item level (not action requirement) for efficiency calculation
                const actionStats = calculateActionStats(actionDetails, {
                    skills: dataManager.getSkills(),
                    equipment: dataManager.getEquipment(),
                    itemDetailMap: gameData.itemDetailMap,
                    includeCommunityBuff: true,
                    includeBreakdown: true,
                    levelRequirementOverride: itemDetails.itemLevel || 1,
                    drinksOverride,
                });

                const { actionTime, totalEfficiency, efficiencyBreakdown } = actionStats;

                // Get equipment for drink concentration and speed calculation
                const equipment = dataManager.getEquipment();

                // Calculate action speed breakdown with details
                const _baseTime = actionDetails.baseTimeCost / 1e9;
                const speedBonus = parseEquipmentSpeedBonuses(equipment, actionDetails.type, gameData.itemDetailMap);

                // Get detailed equipment speed breakdown
                const allSpeedBonuses = debugEquipmentSpeedBonuses(equipment, gameData.itemDetailMap);
                const skillName = actionDetails.type.replace('/action_types/', '');
                const skillSpecificSpeed = skillName + 'Speed';
                const relevantSpeeds = allSpeedBonuses.filter((item) => {
                    return item.speedType === skillSpecificSpeed || item.speedType === 'skillingSpeed';
                });

                // TODO: Add tea speed bonuses when tea-parser supports it
                const teaSpeed = 0;
                const actionSpeedBreakdown = {
                    total: speedBonus + teaSpeed,
                    equipment: speedBonus,
                    tea: teaSpeed,
                    equipmentDetails: relevantSpeeds.map((item) => ({
                        name: item.itemName,
                        enhancementLevel: item.enhancementLevel,
                        speedBonus: item.scaledBonus,
                    })),
                    teaDetails: [], // TODO: Add when tea speed is supported
                };
                const drinkConcentration = getDrinkConcentration(equipment, gameData.itemDetailMap);

                // Get input cost (market price of the item being transmuted)
                const inputPrice = getItemPrice(itemHrid, { context: 'profit', side: 'buy' });
                if (inputPrice === null) {
                    return null; // No market data
                }

                // Get bulk multiplier (number of items consumed AND produced per action)
                const bulkMultiplier = itemDetails.alchemyDetail?.bulkMultiplier || 1;

                // Calculate expected value of outputs, excluding self-returns (Milkonomy-style)
                // Self-returns are when you get the same item back - these don't count as income
                let expectedOutputValue = 0;
                let selfReturnRate = 0;
                let selfReturnCount = 0;
                const dropDetails = [];

                for (const drop of itemDetails.alchemyDetail.transmuteDropTable) {
                    const isSelfReturn = drop.itemHrid === itemHrid;
                    const averageCount = (drop.minCount + drop.maxCount) / 2;

                    if (isSelfReturn) {
                        // Track self-return for cost adjustment
                        selfReturnRate = drop.dropRate;
                        selfReturnCount = averageCount * bulkMultiplier;
                    }

                    const outputPrice = getItemPrice(drop.itemHrid, { context: 'profit', side: 'sell' });
                    if (outputPrice !== null) {
                        const afterTax = calculatePriceAfterTax(outputPrice);
                        // Expected value: price × dropRate × averageCount × bulkMultiplier
                        const dropValue = afterTax * drop.dropRate * averageCount * bulkMultiplier;

                        // Only add to revenue if NOT a self-return
                        if (!isSelfReturn) {
                            expectedOutputValue += dropValue;
                        }

                        dropDetails.push({
                            itemHrid: drop.itemHrid,
                            dropRate: drop.dropRate,
                            minCount: drop.minCount,
                            maxCount: drop.maxCount,
                            averageCount,
                            price: afterTax,
                            expectedValue: isSelfReturn ? 0 : dropValue, // Self-return has 0 effective value
                            isSelfReturn,
                        });
                    }
                }

                const coinCost = calculateAlchemyCoinCost(itemDetails, 'transmute');

                // Gross material cost (before self-return adjustment)
                const grossMaterialCost = inputPrice * bulkMultiplier;

                // Calculate per-hour values
                // Convert efficiency from percentage to decimal
                const efficiencyDecimal = totalEfficiency / 100;
                const actionsPerHourWithEfficiency = calculateActionsPerHour(actionTime) * (1 + efficiencyDecimal);

                // Calculate bonus revenue (essences + rares) from item level
                const alchemyBonus = calculateAlchemyBonusDrops(
                    itemLevel,
                    actionsPerHourWithEfficiency,
                    equipment,
                    gameData.itemDetailMap
                );

                // Calculate live tea cost (used for tea combinations)
                const teaCostData = calculateTeaCostsPerHour({
                    drinkSlots: dataManager.getActionDrinkSlots('/action_types/alchemy'),
                    drinkConcentration,
                    itemDetailMap: gameData.itemDetailMap,
                    getItemPrice: (hrid) => getItemPrice(hrid, { context: 'profit', side: 'buy' }),
                });

                // Find the best catalyst+tea combination (tooltip) or use live setup (action page).
                // Note: selfReturnValue depends on successRate so it must be computed inside the combo loop.
                const _comboFn = useLiveSetup ? this._liveSetupCombo.bind(this) : this._bestCatalystCombo.bind(this);
                const combo = _comboFn({
                    actionType: 'transmute',
                    baseSuccessRate,
                    actionsPerHour: actionsPerHourWithEfficiency,
                    efficiencyDecimal,
                    actionTime,
                    alchemyBonusRevenue: alchemyBonus.totalBonusRevenue,
                    computeNetProfit: (successRate) => {
                        const selfReturnVal = inputPrice * selfReturnRate * successRate * selfReturnCount;
                        const netMat = grossMaterialCost - selfReturnVal;
                        return expectedOutputValue * successRate - (netMat + coinCost);
                    },
                    computeTeaCost: () => teaCostData.totalCostPerHour,
                    levelPenalty,
                    teaBonusOverride,
                });

                const {
                    successRateBreakdown,
                    successRate,
                    catalystCostPerAttempt,
                    catalystCostPerHour,
                    teaCostPerHour,
                    netProfitPerAttempt,
                    profitPerHour: comboProfitPerHour,
                } = combo;

                // Compute final self-return and material cost using winning combo's success rate
                const selfReturnValue = inputPrice * selfReturnRate * successRate * selfReturnCount;
                const netMaterialCost = grossMaterialCost - selfReturnValue;

                // Revenue and cost using winning combo
                const revenuePerAttempt = expectedOutputValue * successRate;
                const costPerAttempt = netMaterialCost + coinCost + catalystCostPerAttempt;

                // Per-hour totals
                const materialCostPerHour = (netMaterialCost + coinCost) * actionsPerHourWithEfficiency;
                const revenuePerHour = revenuePerAttempt * actionsPerHourWithEfficiency + alchemyBonus.totalBonusRevenue;

                const profitPerHour = comboProfitPerHour;
                const profitPerDay = calculateProfitPerDay(profitPerHour);

                // Build detailed breakdowns
                const requirementCosts = [
                    {
                        itemHrid,
                        count: bulkMultiplier,
                        price: inputPrice,
                        costPerAction: netMaterialCost, // Net cost after self-return
                        costPerHour: netMaterialCost * actionsPerHourWithEfficiency,
                        enhancementLevel: 0,
                        selfReturnRate: selfReturnRate > 0 ? selfReturnRate : undefined,
                        selfReturnValue: selfReturnValue > 0 ? selfReturnValue : undefined,
                    },
                ];

                // Add coin cost entry if applicable
                if (coinCost > 0) {
                    requirementCosts.push({
                        itemHrid: '/items/coin',
                        count: coinCost,
                        price: 1,
                        costPerAction: coinCost,
                        costPerHour: coinCost * actionsPerHourWithEfficiency,
                        enhancementLevel: 0,
                    });
                }

                const dropRevenues = dropDetails.map((drop) => ({
                    itemHrid: drop.itemHrid,
                    count: drop.averageCount * bulkMultiplier,
                    dropRate: drop.dropRate,
                    effectiveDropRate: drop.dropRate,
                    price: drop.price,
                    isEssence: false,
                    isRare: false,
                    isSelfReturn: drop.isSelfReturn || false,
                    revenuePerAttempt: drop.expectedValue * successRate,
                    revenuePerHour: drop.expectedValue * successRate * actionsPerHourWithEfficiency,
                    dropsPerHour:
                        drop.averageCount * bulkMultiplier * drop.dropRate * successRate * actionsPerHourWithEfficiency,
                }));

                // Add alchemy essence and rare drops
                for (const drop of alchemyBonus.bonusDrops) {
                    dropRevenues.push(drop);
                }

                const catalystCost = {
                    itemHrid: combo.catalystHrid,
                    price: combo.catalystPrice,
                    costPerSuccess: combo.catalystPrice,
                    costPerAttempt: catalystCostPerAttempt,
                    costPerHour: catalystCostPerHour,
                };

                const consumableCosts = teaCostData.costs.map((cost) => ({
                    itemHrid: cost.itemHrid,
                    price: cost.pricePerDrink,
                    drinksPerHour: cost.drinksPerHour,
                    costPerHour: cost.totalCost,
                }));

                // Return comprehensive data matching what action panel needs
                return {
                    // Basic info
                    actionType: 'transmute',
                    itemHrid,
                    enhancementLevel: 0, // Transmute doesn't care about enhancement

                    // Summary totals
                    profitPerHour,
                    profitPerDay,
                    revenuePerHour,

                    // Actions and rates
                    actionsPerHour: actionsPerHourWithEfficiency,
                    actionTime,

                    // Per-attempt economics
                    materialCost: netMaterialCost, // Net cost after self-return adjustment
                    grossMaterialCost,
                    selfReturnValue,
                    catalystPrice: combo.catalystPrice,
                    costPerAttempt,
                    incomePerAttempt: revenuePerAttempt,
                    netProfitPerAttempt,
                    profitPerAction: comboProfitPerHour / actionsPerHourWithEfficiency,

                    // Per-hour costs
                    materialCostPerHour,
                    catalystCostPerHour,
                    totalTeaCostPerHour: teaCostPerHour,

                    // Detailed breakdowns
                    requirementCosts,
                    dropRevenues,
                    catalystCost,
                    consumableCosts,

                    // Core stats
                    successRate,
                    efficiency: efficiencyDecimal,

                    // Modifier breakdowns
                    successRateBreakdown,
                    efficiencyBreakdown,
                    actionSpeedBreakdown,
                    rareFindBreakdown: alchemyBonus.rareFindBreakdown,
                    essenceFindBreakdown: alchemyBonus.essenceFindBreakdown,

                    // Winning catalyst/tea combo indicators (for tooltip icons)
                    winningCatalystHrid: combo.catalystHrid,
                    winningTeaUsed: combo.teaBonus > 0,

                    // Pricing info
                    pricingMode,
                };
            } catch (error) {
                console.error('[AlchemyProfitCalculator] Failed to calculate transmute profit:', error);
                return null;
            }
        }

        /**
         * Calculate all applicable profits for an item
         * @param {string} itemHrid - Item HRID
         * @param {number} enhancementLevel - Enhancement level (default 0)
         * @returns {Object} Object with all applicable profit calculations
         */
        calculateAllProfits(itemHrid, enhancementLevel = 0) {
            const results = {};

            // Try coinify
            const coinifyProfit = this.calculateCoinifyProfit(itemHrid, enhancementLevel);
            if (coinifyProfit) {
                results.coinify = coinifyProfit;
            }

            // Try decompose
            const decomposeProfit = this.calculateDecomposeProfit(itemHrid, enhancementLevel);
            if (decomposeProfit) {
                results.decompose = decomposeProfit;
            }

            // Try transmute (only for base items)
            if (enhancementLevel === 0) {
                const transmuteProfit = this.calculateTransmuteProfit(itemHrid);
                if (transmuteProfit) {
                    results.transmute = transmuteProfit;
                }
            }

            return results;
        }
    }

    const alchemyProfitCalculator = new AlchemyProfitCalculator();

    /**
     * Tea Optimizer Utility
     * Calculates optimal tea combinations for XP or Gold optimization
     */


    // Skill name to action type mapping
    const SKILL_TO_ACTION_TYPE = {
        milking: '/action_types/milking',
        foraging: '/action_types/foraging',
        woodcutting: '/action_types/woodcutting',
        cheesesmithing: '/action_types/cheesesmithing',
        crafting: '/action_types/crafting',
        tailoring: '/action_types/tailoring',
        cooking: '/action_types/cooking',
        brewing: '/action_types/brewing',
        alchemy: '/action_types/alchemy',
    };

    const GATHERING_SKILLS = ['milking', 'foraging', 'woodcutting'];
    const PRODUCTION_SKILLS = ['cheesesmithing', 'crafting', 'tailoring', 'cooking', 'brewing', 'alchemy'];

    // Rank used for profit-opportunity anchors: the Nth-highest profit/hr rather than the single
    // highest, so one item with a wildly inflated market price (a common occurrence) doesn't
    // single-handedly set the "gold-neutral" bar for every XP action's effective XP/hr.
    const PROFIT_ANCHOR_RANK = 10;

    /**
     * Pick a robust profit/xp anchor from a list of {profit, xp} entries: the Nth-highest by profit
     * (see PROFIT_ANCHOR_RANK) instead of the single highest, to avoid one outlier-priced item
     * dictating the opportunity-cost bar.
     * @param {Array<{profit: number, xp: number}>} entries
     * @returns {{profit: number, xp: number}|null} null if no entry has positive profit
     */
    function pickRankedProfitAnchor(entries) {
        const profitable = entries.filter((e) => e.profit > 0).sort((a, b) => b.profit - a.profit);
        if (profitable.length === 0) return null;
        const rankIndex = Math.min(PROFIT_ANCHOR_RANK - 1, profitable.length - 1);
        return profitable[rankIndex];
    }

    /**
     * Get all relevant teas for a skill and optimization goal
     * Returns teas grouped by exclusivity (skill teas are mutually exclusive)
     * @param {string} skillName - Skill name (e.g., 'milking')
     * @param {string} goal - 'xp' or 'gold'
     * @returns {Object} { skillTeas: [], generalTeas: [] }
     */
    function getRelevantTeas(skillName, goal) {
        const skill = skillName.toLowerCase();
        const isGathering = GATHERING_SKILLS.includes(skill);

        // Skill-specific teas (mutually exclusive - can only equip ONE)
        const skillTeas = [`/items/${skill}_tea`, `/items/super_${skill}_tea`, `/items/ultra_${skill}_tea`];

        // General teas (can equip any combination)
        const generalTeas = new Set();

        // Universal efficiency tea
        generalTeas.add('/items/efficiency_tea');

        // Artisan tea - action level helps everyone, artisan buff helps production gold (not alchemy)
        if (skill !== 'alchemy') {
            generalTeas.add('/items/artisan_tea');
        }

        // Catalytic tea - alchemy success rate boost
        if (skill === 'alchemy') {
            generalTeas.add('/items/catalytic_tea');
        }

        // Wisdom tea - always shown so users can evaluate the XP/gold trade-off in any mode
        generalTeas.add('/items/wisdom_tea');

        if (goal === 'xp') {
            if (skill === 'cooking' || skill === 'brewing') {
                // Gourmet tea shown on XP tab too — users may want to run it alongside XP teas
                generalTeas.add('/items/gourmet_tea');
            }
        } else if (goal === 'gold') {
            if (isGathering) {
                // Gathering-specific gold teas
                generalTeas.add('/items/gathering_tea');
                generalTeas.add('/items/processing_tea');
            } else if (skill === 'cooking' || skill === 'brewing') {
                // Gourmet tea only applies to cooking and brewing
                generalTeas.add('/items/gourmet_tea');
            }
        }

        // Filter to only teas that exist in game data
        const gameData = dataManager.getInitClientData();
        if (!gameData?.itemDetailMap) {
            return { skillTeas: [], generalTeas: [] };
        }

        return {
            skillTeas: skillTeas.filter((hrid) => gameData.itemDetailMap[hrid]),
            generalTeas: Array.from(generalTeas).filter((hrid) => gameData.itemDetailMap[hrid]),
        };
    }

    /**
     * Generate all valid tea combinations respecting exclusivity rules
     * - Can only use ONE skill-specific tea (mutually exclusive)
     * - Can use any combination of general teas
     * - Max 3 teas total
     * @param {Object} teaGroups - { skillTeas: [], generalTeas: [] }
     * @returns {Array<Array<string>>} Array of valid tea combinations
     */
    function generateCombinations(teaGroups, constraints = null) {
        const { skillTeas, generalTeas } = teaGroups;
        const combinations = [];

        // Helper to add combination if valid
        const addCombo = (combo) => {
            if (combo.length > 0 && combo.length <= 3) {
                if (constraints) {
                    if ([...constraints.pinned].some((t) => !combo.includes(t))) return;
                    if (combo.some((t) => constraints.banned.has(t))) return;
                }
                combinations.push(combo);
            }
        };

        // Option 1: No skill tea, only general teas (1-3 general teas)
        for (let i = 0; i < generalTeas.length; i++) {
            addCombo([generalTeas[i]]);
            for (let j = i + 1; j < generalTeas.length; j++) {
                addCombo([generalTeas[i], generalTeas[j]]);
                for (let k = j + 1; k < generalTeas.length; k++) {
                    addCombo([generalTeas[i], generalTeas[j], generalTeas[k]]);
                }
            }
        }

        // Option 2: One skill tea + general teas (1 skill + 0-2 general)
        for (const skillTea of skillTeas) {
            // Just skill tea alone
            addCombo([skillTea]);

            // Skill tea + 1 general tea
            for (let i = 0; i < generalTeas.length; i++) {
                addCombo([skillTea, generalTeas[i]]);

                // Skill tea + 2 general teas
                for (let j = i + 1; j < generalTeas.length; j++) {
                    addCombo([skillTea, generalTeas[i], generalTeas[j]]);
                }
            }
        }

        return combinations;
    }

    /**
     * Parse tea buffs from a tea combination
     * @param {Array<string>} teaHrids - Array of tea item HRIDs
     * @param {Object} itemDetailMap - Item details from game data
     * @param {number} drinkConcentration - Drink concentration as decimal
     * @returns {Object} Aggregated buff values
     */
    function parseTeaBuffs(teaHrids, itemDetailMap, drinkConcentration) {
        const buffs = {
            efficiency: 0,
            wisdom: 0,
            gathering: 0,
            processing: 0,
            artisan: 0,
            gourmet: 0,
            actionLevel: 0,
            alchemySuccess: 0,
            skillLevels: {}, // skill name → level bonus
        };

        for (const teaHrid of teaHrids) {
            const itemDetails = itemDetailMap[teaHrid];
            if (!itemDetails?.consumableDetail?.buffs) continue;

            for (const buff of itemDetails.consumableDetail.buffs) {
                const baseValue = buff.flatBoost || 0;
                const scaledValue = baseValue * (1 + drinkConcentration);

                switch (buff.typeHrid) {
                    case '/buff_types/efficiency':
                        buffs.efficiency += scaledValue * 100; // Convert to percentage
                        break;
                    case '/buff_types/wisdom':
                        buffs.wisdom += scaledValue * 100;
                        break;
                    case '/buff_types/gathering':
                        buffs.gathering += scaledValue;
                        break;
                    case '/buff_types/processing':
                        buffs.processing += scaledValue;
                        break;
                    case '/buff_types/artisan':
                        buffs.artisan += scaledValue;
                        break;
                    case '/buff_types/gourmet':
                        buffs.gourmet += scaledValue;
                        break;
                    case '/buff_types/action_level':
                        buffs.actionLevel += scaledValue;
                        break;
                    case '/buff_types/alchemy_success':
                        // alchemy_success uses ratioBoost, not flatBoost
                        buffs.alchemySuccess += (buff.ratioBoost || 0) * (1 + drinkConcentration);
                        break;
                    default:
                        // Check for skill level buffs (e.g., /buff_types/milking_level)
                        if (buff.typeHrid.endsWith('_level')) {
                            const skillMatch = buff.typeHrid.match(/\/buff_types\/(\w+)_level/);
                            if (skillMatch) {
                                const skill = skillMatch[1];
                                buffs.skillLevels[skill] = (buffs.skillLevels[skill] || 0) + scaledValue;
                            }
                        }
                }
            }
        }

        return buffs;
    }

    /**
     * Calculate XP/hour for an action with a specific tea combination
     * @param {Object} actionDetails - Action details from game data
     * @param {Object} buffs - Parsed tea buffs
     * @param {number} playerLevel - Player's skill level
     * @param {Object} otherEfficiency - Other efficiency sources (house, equipment, etc.)
     * @param {Object} context - Additional context (equipment, itemDetailMap)
     * @returns {number} XP per hour
     */
    function calculateXpPerHour(actionDetails, buffs, playerLevel, otherEfficiency, context) {
        if (!actionDetails.experienceGain?.value) {
            return 0;
        }

        const { equipment, itemDetailMap } = context;
        const requiredLevel = actionDetails.levelRequirement?.level || 1;
        const skillName = actionDetails.type.split('/').pop();

        // Calculate tea skill level bonus for this skill
        const teaSkillLevelBonus = buffs.skillLevels[skillName] || 0;

        // Get equipment speed bonus
        const equipmentSpeedBonus = parseEquipmentSpeedBonuses(equipment, actionDetails.type, itemDetailMap) || 0;

        // Get equipment efficiency bonus
        const equipmentEfficiencyBonus = parseEquipmentEfficiencyBonuses(equipment, actionDetails.type, itemDetailMap) || 0;

        // Calculate efficiency breakdown
        const efficiencyData = calculateEfficiencyBreakdown({
            requiredLevel,
            skillLevel: playerLevel,
            teaSkillLevelBonus,
            actionLevelBonus: buffs.actionLevel,
            houseEfficiency: otherEfficiency.house || 0,
            equipmentEfficiency: equipmentEfficiencyBonus,
            teaEfficiency: buffs.efficiency,
            communityEfficiency: otherEfficiency.community || 0,
            achievementEfficiency: otherEfficiency.achievement || 0,
        });

        const totalEfficiency = efficiencyData.totalEfficiency;
        const efficiencyMultiplier = calculateEfficiencyMultiplier(totalEfficiency);

        // Calculate actions per hour with equipment speed bonus
        const baseTime = (actionDetails.baseTimeCost || 3e9) / 1e9;
        const actionTime = baseTime / (1 + equipmentSpeedBonus);
        const baseActionsPerHour = calculateActionsPerHour(actionTime);
        const actionsPerHour = calculateEffectiveActionsPerHour(baseActionsPerHour, efficiencyMultiplier);

        // Get the FULL XP multiplier from all sources
        const skillHrid = actionDetails.experienceGain.skillHrid;
        const currentXpData = calculateExperienceMultiplier(skillHrid, actionDetails.type);

        // calculateExperienceMultiplier reads equipment/charm wisdom from the player's LIVE gear
        // (via resolveActionContext), not from the candidate `equipment` being scored here — so a
        // wisdom/experience-granting item (e.g. Philosopher's ring/earrings) being tested as a
        // candidate would never show its own bonus unless it happened to already be equipped live.
        // Swap those two components out for ones computed from the candidate equipment instead.
        const currentTeaWisdom = currentXpData.breakdown?.consumableWisdom || 0;
        const liveEquipmentWisdom = currentXpData.breakdown?.equipmentWisdom || 0;
        const baseWisdomWithoutTeaOrEquipment = currentXpData.totalWisdom - currentTeaWisdom - liveEquipmentWisdom;
        const candidateEquipmentWisdom = parseEquipmentWisdom(equipment, itemDetailMap).total;
        const totalWisdomWithOurTea = baseWisdomWithoutTeaOrEquipment + buffs.wisdom + candidateEquipmentWisdom;
        const charmExperience = parseCharmExperience(equipment, skillHrid, itemDetailMap).total;
        const xpMultiplier = 1 + totalWisdomWithOurTea / 100 + charmExperience / 100;

        // XP per hour
        const baseXp = actionDetails.experienceGain.value;
        return actionsPerHour * baseXp * xpMultiplier;
    }

    /**
     * Calculate Gold/hour for a gathering action with a specific tea combination
     * @param {Object} actionDetails - Action details from game data
     * @param {Object} buffs - Parsed tea buffs
     * @param {number} playerLevel - Player's skill level
     * @param {Object} otherEfficiency - Other efficiency sources
     * @param {Object} gameData - Full game data
     * @param {Object} context - Additional context (equipment, itemDetailMap)
     * @returns {number} Gold per hour (profit after market tax)
     */
    function calculateGatheringGoldPerHour(actionDetails, buffs, playerLevel, otherEfficiency, gameData, context) {
        const { equipment, itemDetailMap } = context;
        const requiredLevel = actionDetails.levelRequirement?.level || 1;
        const skillName = actionDetails.type.split('/').pop();

        // Calculate tea skill level bonus for this skill
        const teaSkillLevelBonus = buffs.skillLevels[skillName] || 0;

        // Get equipment speed bonus
        const equipmentSpeedBonus = parseEquipmentSpeedBonuses(equipment, actionDetails.type, itemDetailMap) || 0;

        // Get equipment efficiency bonus
        const equipmentEfficiencyBonus = parseEquipmentEfficiencyBonuses(equipment, actionDetails.type, itemDetailMap) || 0;

        // Calculate efficiency
        const efficiencyData = calculateEfficiencyBreakdown({
            requiredLevel,
            skillLevel: playerLevel,
            teaSkillLevelBonus,
            actionLevelBonus: buffs.actionLevel,
            houseEfficiency: otherEfficiency.house || 0,
            equipmentEfficiency: equipmentEfficiencyBonus,
            teaEfficiency: buffs.efficiency,
            communityEfficiency: otherEfficiency.community || 0,
            achievementEfficiency: otherEfficiency.achievement || 0,
        });

        const totalEfficiency = efficiencyData.totalEfficiency;
        const efficiencyMultiplier = calculateEfficiencyMultiplier(totalEfficiency);

        // Calculate actions per hour (with speed bonus, WITHOUT efficiency - efficiency applied to outputs)
        const baseTime = (actionDetails.baseTimeCost || 3e9) / 1e9;
        const actionTime = baseTime / (1 + equipmentSpeedBonus);
        const actionsPerHour = calculateActionsPerHour(actionTime);

        // Calculate revenue from drops
        let totalRevenue = 0;
        const dropTable = actionDetails.dropTable || [];
        const gatheringBonus = 1 + buffs.gathering + (otherEfficiency.gathering || 0);

        for (const drop of dropTable) {
            const dropRate = drop.dropRate || 1;
            const minCount = drop.minCount || 1;
            const maxCount = drop.maxCount || minCount;
            const avgCount = (minCount + maxCount) / 2;

            // Apply gathering bonus to quantity
            const avgAmountPerAction = avgCount * gatheringBonus;

            // Get item price (use 'sell' side for output items to match tile calculation)
            const rawPrice = resolveItemPrice(drop.itemHrid, { context: 'profit', side: 'sell' }).price || 0;

            // Check for processing conversion
            if (buffs.processing > 0) {
                const processedData = findProcessingConversion(drop.itemHrid, gameData);
                if (processedData) {
                    const processedPrice =
                        resolveItemPrice(processedData.outputItemHrid, { context: 'profit', side: 'sell' }).price || 0;
                    const conversionRatio = processedData.conversionRatio;

                    // Processing Tea check happens per action:
                    // If procs (processingBonus% chance): Convert to processed
                    const processedIfProcs = Math.floor(avgAmountPerAction / conversionRatio);

                    // Expected processed items per action
                    const processedPerAction = buffs.processing * processedIfProcs;

                    // Net processing bonus = processed value - cost of raw converted
                    const processingNetValue =
                        actionsPerHour *
                        dropRate *
                        efficiencyMultiplier *
                        (processedPerAction * (processedPrice - conversionRatio * rawPrice));

                    // Total = base raw revenue + processing net gain
                    const baseRawItemsPerHour = actionsPerHour * dropRate * avgAmountPerAction * efficiencyMultiplier;
                    totalRevenue += baseRawItemsPerHour * rawPrice + processingNetValue;
                    continue;
                }
            }

            // No processing - simple calculation
            const itemsPerHour = actionsPerHour * dropRate * avgAmountPerAction * efficiencyMultiplier;
            totalRevenue += itemsPerHour * rawPrice;
        }

        // Add bonus revenue from essence and rare find drops. Personal (scroll) buffs are excluded —
        // a temporary Labyrinth seal buff shouldn't inflate the numbers used to justify a gear purchase.
        const bonusRevenue = calculateBonusRevenue(actionDetails, actionsPerHour, equipment, itemDetailMap, {
            excludePersonalBuffs: true,
        });
        const efficiencyBoostedBonusRevenue = bonusRevenue.totalBonusRevenue * efficiencyMultiplier;
        totalRevenue += efficiencyBoostedBonusRevenue;

        // Apply market tax
        const profitPerHour = totalRevenue * (1 - MARKET_TAX);

        return profitPerHour;
    }

    /**
     * Calculate Gold/hour for a production action with a specific tea combination
     * @param {Object} actionDetails - Action details from game data
     * @param {Object} buffs - Parsed tea buffs
     * @param {number} playerLevel - Player's skill level
     * @param {Object} otherEfficiency - Other efficiency sources
     * @param {Object} gameData - Full game data
     * @param {Object} context - Additional context (equipment, itemDetailMap)
     * @returns {number} Gold per hour (profit after market tax)
     */
    function calculateProductionGoldPerHour(actionDetails, buffs, playerLevel, otherEfficiency, gameData, context) {
        const { equipment, itemDetailMap } = context;
        const requiredLevel = actionDetails.levelRequirement?.level || 1;
        const skillName = actionDetails.type.split('/').pop();

        // Calculate tea skill level bonus for this skill
        const teaSkillLevelBonus = buffs.skillLevels[skillName] || 0;

        // Get equipment speed bonus
        const equipmentSpeedBonus = parseEquipmentSpeedBonuses(equipment, actionDetails.type, itemDetailMap) || 0;

        // Get equipment efficiency bonus
        const equipmentEfficiencyBonus = parseEquipmentEfficiencyBonuses(equipment, actionDetails.type, itemDetailMap) || 0;

        // Calculate efficiency
        const efficiencyData = calculateEfficiencyBreakdown({
            requiredLevel,
            skillLevel: playerLevel,
            teaSkillLevelBonus,
            actionLevelBonus: buffs.actionLevel,
            houseEfficiency: otherEfficiency.house || 0,
            equipmentEfficiency: equipmentEfficiencyBonus,
            teaEfficiency: buffs.efficiency,
            communityEfficiency: otherEfficiency.community || 0,
            achievementEfficiency: otherEfficiency.achievement || 0,
        });

        const totalEfficiency = efficiencyData.totalEfficiency;
        const efficiencyMultiplier = calculateEfficiencyMultiplier(totalEfficiency);

        // Calculate actions per hour (with speed bonus, WITHOUT efficiency - efficiency applied to outputs)
        const baseTime = (actionDetails.baseTimeCost || 3e9) / 1e9;
        const actionTime = baseTime / (1 + equipmentSpeedBonus);
        const actionsPerHour = calculateActionsPerHour(actionTime);

        // Calculate input costs (with artisan reduction for regular inputs)
        // Use 'buy' side for inputs to match tile calculation
        let inputCost = 0;
        const artisanReduction = 1 - buffs.artisan;

        // Add upgrade item cost (NOT affected by Artisan Tea)
        if (actionDetails.upgradeItemHrid) {
            let upgradePrice =
                resolveItemPrice(actionDetails.upgradeItemHrid, { context: 'profit', side: 'buy' }).price || 0;
            // Special case: Coins have no market price but have face value of 1
            if (actionDetails.upgradeItemHrid === '/items/coin' && upgradePrice === 0) {
                upgradePrice = 1;
            }
            inputCost += upgradePrice; // Always 1 upgrade item, no artisan reduction
        }

        // Add regular input item costs (affected by Artisan Tea)
        for (const input of actionDetails.inputItems || []) {
            let price = resolveItemPrice(input.itemHrid, { context: 'profit', side: 'buy' }).price || 0;
            // Special case: Coins have no market price but have face value of 1
            if (input.itemHrid === '/items/coin' && price === 0) {
                price = 1;
            }
            const effectiveCount = input.count * artisanReduction;
            inputCost += price * effectiveCount;
        }

        // Calculate output revenue (with gourmet bonus - only for cooking/brewing)
        // Use 'sell' side for outputs to match tile calculation
        let outputRevenue = 0;
        const isCookingOrBrewing =
            actionDetails.type === '/action_types/cooking' || actionDetails.type === '/action_types/brewing';
        const gourmetBonus = isCookingOrBrewing ? 1 + buffs.gourmet : 1;
        for (const output of actionDetails.outputItems || []) {
            const price = resolveItemPrice(output.itemHrid, { context: 'profit', side: 'sell' }).price || 0;
            const effectiveCount = output.count * gourmetBonus;
            outputRevenue += price * effectiveCount;
        }

        // Profit per action (before market tax)
        const profitPerAction = outputRevenue - inputCost;

        // Profit per hour (with efficiency applied once)
        const grossProfitPerHour = actionsPerHour * profitPerAction * efficiencyMultiplier;

        // Add bonus revenue from essence and rare find drops (same as tile calculation). Personal
        // (scroll) buffs are excluded — a temporary Labyrinth seal buff shouldn't inflate the numbers
        // used to justify a gear purchase.
        const bonusRevenue = calculateBonusRevenue(actionDetails, actionsPerHour, equipment, itemDetailMap, {
            excludePersonalBuffs: true,
        });
        const efficiencyBoostedBonusRevenue = (bonusRevenue?.totalBonusRevenue || 0) * efficiencyMultiplier;

        // Apply market tax to revenue portion only (including bonus revenue)
        const revenuePerHour = actionsPerHour * outputRevenue * efficiencyMultiplier;
        const marketTax = (revenuePerHour + efficiencyBoostedBonusRevenue) * MARKET_TAX;
        const netProfitPerHour = grossProfitPerHour + efficiencyBoostedBonusRevenue - marketTax;

        return netProfitPerHour;
    }

    /**
     * Calculate Gold/hour for an alchemy action with a specific tea combination
     * @param {Object} alchemyContext - { actionType: 'coinify'|'decompose'|'transmute', itemHrid, enhancementLevel }
     * @param {Object} buffs - Parsed tea buffs (includes alchemySuccess)
     * @param {Array<string>} teaHrids - Tea HRIDs in this combo, passed through as a drinks override so
     *  non-catalytic teas (efficiency, wisdom, etc.) actually influence the computed action speed/efficiency
     *  instead of the profit calculator silently falling back to whatever tea is live-equipped in-game.
     * @returns {number} Gold per hour (profit after all costs)
     */
    function calculateAlchemyGoldPerHour(alchemyContext, buffs, teaHrids = []) {
        const { actionType, itemHrid, enhancementLevel = 0 } = alchemyContext;
        const teaBonusOverride = buffs.alchemySuccess || 0;
        const drinksOverride = teaHrids.map((itemHrid) => ({ itemHrid }));

        let profitData = null;
        if (actionType === 'coinify') {
            profitData = alchemyProfitCalculator.calculateCoinifyProfit(
                itemHrid,
                enhancementLevel,
                false,
                teaBonusOverride,
                drinksOverride
            );
        } else if (actionType === 'decompose') {
            profitData = alchemyProfitCalculator.calculateDecomposeProfit(
                itemHrid,
                enhancementLevel,
                false,
                teaBonusOverride,
                drinksOverride
            );
        } else if (actionType === 'transmute') {
            profitData = alchemyProfitCalculator.calculateTransmuteProfit(
                itemHrid,
                false,
                teaBonusOverride,
                drinksOverride
            );
        }

        if (!profitData) return 0;
        return profitData.profitPerHour || 0;
    }

    /**
     * Calculate XP/hour for an alchemy action with a specific tea combination.
     * Alchemy XP is derived from item level, not from actionDetails.experienceGain.
     * @param {Object} alchemyContext - { actionType, itemHrid, enhancementLevel }
     * @param {Object} buffs - Parsed tea buffs
     * @param {number} playerLevel - Player's alchemy level
     * @param {Object} otherEfficiency - Non-tea efficiency sources
     * @param {Object} calcContext - { equipment, itemDetailMap }
     * @returns {number} XP per hour
     */
    function calculateAlchemyXpPerHour(alchemyContext, buffs, playerLevel, otherEfficiency, calcContext) {
        const { actionType, itemHrid } = alchemyContext;
        const gameData = dataManager.getInitClientData();
        if (!gameData?.actionDetailMap) return 0;

        const actionHrid = `/actions/alchemy/${actionType}`;
        const actionDetails = gameData.actionDetailMap[actionHrid];
        if (!actionDetails) return 0;

        const itemDetails = gameData.itemDetailMap?.[itemHrid];
        if (!itemDetails?.itemLevel) return 0;

        // Base XP from alchemy formula (depends on action type + item level)
        const itemLevel = itemDetails.itemLevel;
        let baseXP;
        switch (actionType) {
            case 'coinify':
                baseXP = itemLevel + 10;
                break;
            case 'decompose':
                baseXP = itemLevel * 1.4 + 14;
                break;
            case 'transmute':
                baseXP = itemLevel * 1.6 + 16;
                break;
            default:
                return 0;
        }

        // Success rate with this tea's alchemy bonus (affects XP: failures give 10%)
        const teaBonusOverride = buffs.alchemySuccess || 0;
        let baseSuccessRate;
        if (actionType === 'coinify') baseSuccessRate = 0.7;
        else if (actionType === 'decompose') baseSuccessRate = 0.6;
        else baseSuccessRate = itemDetails.alchemyDetail?.transmuteSuccessRate || 0;

        // Level penalty (transmute only)
        const levelPenalty =
            actionType === 'transmute' && playerLevel < itemLevel ? (0.9 / itemLevel) * (playerLevel - itemLevel) : 0;

        const successRate = Math.max(0, Math.min(1.0, baseSuccessRate * (1 + levelPenalty) * (1 + teaBonusOverride)));

        // XP per action: success gives full XP, failure gives 10%
        // Wisdom multiplier — replace current tea wisdom AND live equipment/charm wisdom with the
        // hypothetical tea and the candidate equipment being scored (calculateExperienceMultiplier
        // otherwise always reads the player's currently-equipped gear, not calcContext.equipment).
        const xpData = calculateExperienceMultiplier('/skills/alchemy', '/action_types/alchemy');
        const currentTeaWisdom = xpData.breakdown?.consumableWisdom || 0;
        const liveEquipmentWisdom = xpData.breakdown?.equipmentWisdom || 0;
        const baseWisdomWithoutTeaOrEquipment = xpData.totalWisdom - currentTeaWisdom - liveEquipmentWisdom;
        const candidateEquipmentWisdom = parseEquipmentWisdom(calcContext.equipment, calcContext.itemDetailMap).total;
        const totalWisdomWithOurTea = baseWisdomWithoutTeaOrEquipment + buffs.wisdom + candidateEquipmentWisdom;
        const charmExperience = parseCharmExperience(
            calcContext.equipment,
            '/skills/alchemy',
            calcContext.itemDetailMap
        ).total;
        const wisdomMultiplier = 1 + totalWisdomWithOurTea / 100 + charmExperience / 100;

        const fullXP = baseXP * wisdomMultiplier;
        const xpPerAction = successRate * fullXP + (1 - successRate) * fullXP * 0.1;

        // Actions per hour (uses item level for efficiency, not action level requirement)
        const requiredLevel = itemLevel;
        const { equipment, itemDetailMap } = calcContext;
        const teaSkillLevelBonus = buffs.skillLevels['alchemy'] || 0;
        const equipmentSpeedBonus = parseEquipmentSpeedBonuses(equipment, actionDetails.type, itemDetailMap) || 0;
        const equipmentEfficiencyBonus = parseEquipmentEfficiencyBonuses(equipment, actionDetails.type, itemDetailMap) || 0;

        const efficiencyData = calculateEfficiencyBreakdown({
            requiredLevel,
            skillLevel: playerLevel,
            teaSkillLevelBonus,
            actionLevelBonus: buffs.actionLevel,
            houseEfficiency: otherEfficiency.house || 0,
            equipmentEfficiency: equipmentEfficiencyBonus,
            teaEfficiency: buffs.efficiency,
            communityEfficiency: otherEfficiency.community || 0,
            achievementEfficiency: otherEfficiency.achievement || 0,
        });

        const efficiencyMultiplier = calculateEfficiencyMultiplier(efficiencyData.totalEfficiency);
        const baseTime = (actionDetails.baseTimeCost || 20e9) / 1e9;
        const actionTime = baseTime / (1 + equipmentSpeedBonus);
        const baseActionsPerHour = calculateActionsPerHour(actionTime);
        const actionsPerHour = calculateEffectiveActionsPerHour(baseActionsPerHour, efficiencyMultiplier);

        return actionsPerHour * xpPerAction;
    }

    /**
     * Find processing conversion for an item
     * @param {string} itemHrid - Item HRID
     * @param {Object} gameData - Game data
     * @returns {Object|null} Conversion data or null
     */
    function findProcessingConversion(itemHrid, gameData) {
        const validProcessingTypes = ['/action_types/cheesesmithing', '/action_types/crafting', '/action_types/tailoring'];

        for (const [_actionHrid, action] of Object.entries(gameData.actionDetailMap)) {
            if (!validProcessingTypes.includes(action.type)) continue;

            const inputItem = action.inputItems?.[0];
            const outputItem = action.outputItems?.[0];

            if (inputItem?.itemHrid === itemHrid && outputItem) {
                return {
                    outputItemHrid: outputItem.itemHrid,
                    conversionRatio: inputItem.count,
                };
            }
        }

        return null;
    }

    /**
     * Get all actions for a skill that the player can do
     * @param {string} skillName - Skill name
     * @param {number} playerLevel - Player's skill level
     * @returns {Array<Object>} Array of action details
     */
    /**
     * Get all actions for a skill, separating available from excluded
     * @param {string} skillName - Skill name
     * @param {number} playerLevel - Player's skill level
     * @returns {Object} { available: [], excluded: [] } with exclusion reasons
     */
    function getActionsForSkill(skillName, playerLevel, selectedActionHrids = null) {
        const gameData = dataManager.getInitClientData();
        if (!gameData?.actionDetailMap) return { available: [], excluded: [] };

        const actionType = SKILL_TO_ACTION_TYPE[skillName.toLowerCase()];
        if (!actionType) return { available: [], excluded: [] };

        const available = [];
        const excluded = [];

        for (const [hrid, action] of Object.entries(gameData.actionDetailMap)) {
            if (action.type !== actionType) continue;
            if (selectedActionHrids && !selectedActionHrids.has(hrid)) continue;

            const requiredLevel = action.levelRequirement?.level || 1;
            if (playerLevel >= requiredLevel) {
                available.push(action);
            } else {
                excluded.push({ action, reason: 'level', requiredLevel });
            }
        }

        return { available, excluded };
    }

    /**
     * Get all actions for a skill for display purposes, including level-locked ones.
     * @param {string} skillName
     * @param {number} playerLevel
     * @returns {Array<{ hrid, name, requiredLevel, available }>} Sorted by level requirement
     */
    function getSkillActionsForDisplay(skillName, playerLevel) {
        const gameData = dataManager.getInitClientData();
        if (!gameData?.actionDetailMap) return [];

        const actionType = SKILL_TO_ACTION_TYPE[skillName.toLowerCase()];
        if (!actionType) return [];

        const result = [];
        for (const [hrid, action] of Object.entries(gameData.actionDetailMap)) {
            if (action.type !== actionType) continue;
            const requiredLevel = action.levelRequirement?.level || 1;
            result.push({ hrid, name: action.name, requiredLevel, available: playerLevel >= requiredLevel });
        }
        return result.sort((a, b) => a.requiredLevel - b.requiredLevel || a.name.localeCompare(b.name));
    }

    /**
     * Calculate tea consumption cost per hour for a tea combination
     * Uses the same pricing logic as the tile calculation
     * @param {Array<string>} teaHrids - Array of tea item HRIDs
     * @param {number} drinkConcentration - Drink concentration as decimal
     * @returns {{ total: number, breakdown: Array<{hrid: string, name: string, unitsPerHour: number, unitPrice: number, costPerHour: number}> }}
     */
    function calculateTeaCostPerHour(teaHrids, drinkConcentration) {
        const gameData = dataManager.getInitClientData();
        const drinksPerHour = calculateDrinksPerHour(drinkConcentration);
        const breakdown = [];
        let total = 0;

        for (const teaHrid of teaHrids) {
            // Use getItemPrice with 'profit' context and 'buy' side to match tile calculation
            const unitPrice = resolveItemPrice(teaHrid, { context: 'profit', side: 'buy' }).price || 0;
            const costPerHour = unitPrice * drinksPerHour;
            const name = gameData?.itemDetailMap?.[teaHrid]?.name || teaHrid;
            breakdown.push({ hrid: teaHrid, name, unitsPerHour: drinksPerHour, unitPrice, costPerHour });
            total += costPerHour;
        }

        return { total, breakdown };
    }

    /**
     * Get other efficiency sources (non-tea)
     * @param {string} actionType - Action type HRID
     * @param {Object|null} overrides - Optional custom-loadout overrides: { houseRooms: Map, communityBuffLevels: Object }.
     *  Falls back to live player data for any field not present.
     * @returns {Object} Other efficiency values
     */
    function getOtherEfficiencySources(actionType, overrides = null) {
        const houseRoomsMap = overrides?.houseRooms ?? dataManager.getHouseRooms();
        const houseRooms = houseRoomsMap ? Array.from(houseRoomsMap.values()) : [];
        const gameData = dataManager.getInitClientData();

        const result = {
            house: 0,
            equipment: 0,
            community: 0,
            achievement: 0,
            wisdom: 0,
            gathering: 0,
        };

        if (!gameData) return result;

        // House efficiency
        if (houseRooms) {
            for (const room of houseRooms) {
                const roomDetail = gameData.houseRoomDetailMap?.[room.houseRoomHrid];
                if (roomDetail?.usableInActionTypeMap?.[actionType]) {
                    result.house += (room.level || 0) * 1.5;
                }
            }
        }

        // Community efficiency buff - use production_efficiency for production skills
        // Match the tile's calculation from profit-calculator.js
        const isProductionType = PRODUCTION_SKILLS.some((skill) => actionType.includes(skill));
        const communityBuffType = isProductionType
            ? '/community_buff_types/production_efficiency'
            : '/community_buff_types/efficiency';
        const communityEffLevel =
            overrides?.communityBuffLevels?.[communityBuffType] ?? dataManager.getCommunityBuffLevel(communityBuffType);
        if (communityEffLevel) {
            // Get buff definition from game data for accurate calculation
            const buffDef = gameData.communityBuffTypeDetailMap?.[communityBuffType];
            if (buffDef?.usableInActionTypeMap?.[actionType] && buffDef?.buff) {
                // Formula: flatBoost + (level - 1) × flatBoostLevelBonus
                const baseBonus = (buffDef.buff.flatBoost || 0) * 100;
                const levelBonus = (communityEffLevel - 1) * (buffDef.buff.flatBoostLevelBonus || 0) * 100;
                result.community = baseBonus + levelBonus;
            } else {
                // Fallback to old formula if buff doesn't apply to this action
                result.community = 0;
            }
        }

        // Community gathering buff
        const communityGatheringLevel =
            overrides?.communityBuffLevels?.['/community_buff_types/gathering_quantity'] ??
            dataManager.getCommunityBuffLevel('/community_buff_types/gathering_quantity');
        if (communityGatheringLevel) {
            result.gathering = 0.2 + (communityGatheringLevel - 1) * 0.005;
        }

        // Achievement gathering buff (stacks with community gathering)
        const achievementGathering = dataManager.getAchievementBuffFlatBoost(actionType, '/buff_types/gathering');
        result.gathering += achievementGathering;

        // Community wisdom buff
        const communityWisdomLevel =
            overrides?.communityBuffLevels?.['/community_buff_types/experience'] ??
            dataManager.getCommunityBuffLevel('/community_buff_types/experience');
        if (communityWisdomLevel) {
            result.wisdom = 20 + (communityWisdomLevel - 1) * 0.5;
        }

        // Achievement buffs
        result.achievement = dataManager.getAchievementBuffFlatBoost(actionType, '/buff_types/efficiency') * 100;

        // Equipment efficiency (simplified - would need full parser for accuracy)
        // For now, we'll skip this as it requires more complex parsing

        return result;
    }

    /**
     * Find optimal tea combination for a skill and goal
     * @param {string} skillName - Skill name (e.g., 'Milking')
     * @param {string} goal - 'xp' or 'gold'
     * @param {string|null} locationName - Optional location name to filter actions (e.g., "Silly Cow Valley")
     * @param {string|null} actionNameFilter - Optional action name to restrict optimization to a single action
     * @param {number|null} globalBestProfit - When goal is 'xp', the best profit/hr achievable across ALL
     *  skills (not just this one), used as the recovery-ratio denominator for gold-neutral effective XP.
     *  Falls back to this skill's own best-profit action if omitted.
     * @param {Object|null} overrides - Optional custom-loadout overrides: { equipment, skillLevels, houseRooms,
     *  communityBuffLevels }. Any field not present falls back to live player data. `equipmentOverride` (above)
     *  takes precedence over `overrides.equipment` when both are given.
     * @returns {Object} Optimization result
     */
    function findOptimalTeas(
        skillName,
        goal,
        locationName = null,
        actionNameFilter = null,
        constraints = null,
        alchemyContext = null,
        equipmentOverride = null,
        selectedActionHrids = null,
        globalBestProfit = null,
        overrides = null
    ) {
        const normalizedSkill = skillName.toLowerCase();
        const isGathering = GATHERING_SKILLS.includes(normalizedSkill);
        const isProduction = PRODUCTION_SKILLS.includes(normalizedSkill);

        if (!isGathering && !isProduction) {
            return { error: `Unknown skill: ${skillName}` };
        }

        const gameData = dataManager.getInitClientData();
        if (!gameData?.itemDetailMap) {
            return { error: 'Game data not loaded' };
        }

        // Get player's skill level
        const overrideLevel = overrides?.skillLevels?.[normalizedSkill];
        let playerLevel;
        if (overrideLevel != null) {
            playerLevel = overrideLevel;
        } else {
            const skills = dataManager.getSkills();
            const skillHrid = `/skills/${normalizedSkill}`;
            playerLevel = 1;
            for (const skill of skills || []) {
                if (skill.skillHrid === skillHrid) {
                    playerLevel = skill.level;
                    break;
                }
            }
        }

        // Get drink concentration
        const equipment = equipmentOverride ?? overrides?.equipment ?? dataManager.getEquipment();
        const drinkConcentration = getDrinkConcentration(equipment, gameData.itemDetailMap);

        // Get relevant teas and generate combinations
        const relevantTeas = getRelevantTeas(normalizedSkill, goal);
        const combinations = generateCombinations(relevantTeas, constraints);

        // Get actions for this skill (available and excluded)
        const actionData = getActionsForSkill(normalizedSkill, playerLevel, selectedActionHrids);
        let actions = actionData.available;
        let excludedActions = actionData.excluded;

        // Filter to specific location if provided (using game data category)
        if (locationName && gameData.actionCategoryDetailMap) {
            // Find the category HRID that matches this location name AND skill
            // Multiple skills can have categories with the same name (e.g., "Material" exists for both Tailoring and Cheesesmithing)
            // So we need to match the skill-specific category path
            let targetCategoryHrid = null;
            const skillPrefix = `/action_categories/${normalizedSkill}/`;

            for (const [categoryHrid, categoryDetail] of Object.entries(gameData.actionCategoryDetailMap)) {
                // Match both the category name AND ensure it's for the correct skill
                if (categoryDetail.name === locationName && categoryHrid.startsWith(skillPrefix)) {
                    targetCategoryHrid = categoryHrid;
                    break;
                }
            }

            // Filter actions to only those in this category
            if (targetCategoryHrid) {
                // Filter available actions
                actions = actions.filter((action) => action.category === targetCategoryHrid);

                // Also filter excluded actions to same category (so we only show relevant excluded items)
                excludedActions = excludedActions.filter((item) => item.action.category === targetCategoryHrid);
            }
        }

        // Optionally narrow to a single action by name
        if (actionNameFilter) {
            actions = actions.filter((a) => a.name === actionNameFilter);
            excludedActions = excludedActions.filter((item) => item.action.name === actionNameFilter);
        }

        // Check if there are no available actions (even if there are excluded ones)
        if (actions.length === 0) {
            const locationSuffix = locationName ? ` at ${locationName}` : '';
            if (excludedActions.length > 0) {
                const lowestLevel = Math.min(...excludedActions.map((item) => item.requiredLevel));
                return {
                    error: `No actions available for ${skillName}${locationSuffix} at level ${playerLevel}. All actions require level ${lowestLevel}+.`,
                };
            } else {
                return { error: `No actions available for ${skillName}${locationSuffix} at level ${playerLevel}` };
            }
        }

        // Get other efficiency sources
        const actionType = SKILL_TO_ACTION_TYPE[normalizedSkill];
        const otherEfficiency = getOtherEfficiencySources(actionType, overrides);

        // Score each combination
        const results = [];

        // Create context for calculations
        const calcContext = {
            equipment,
            itemDetailMap: gameData.itemDetailMap,
        };

        for (const combo of combinations) {
            const buffs = parseTeaBuffs(combo, gameData.itemDetailMap, drinkConcentration);

            // Calculate tea cost per hour for this combo
            const teaCostPerHour = calculateTeaCostPerHour(combo, drinkConcentration);

            let totalScore = 0;
            let profitableCount = 0;
            const actionScores = [];

            // Alchemy mode: score the specific item, not all actions
            if (alchemyContext) {
                const actionName = `${alchemyContext.actionType}: ${alchemyContext.itemName || alchemyContext.itemHrid}`;
                let score;
                if (goal === 'xp') {
                    score = calculateAlchemyXpPerHour(alchemyContext, buffs, playerLevel, otherEfficiency, calcContext);
                    totalScore += score;
                } else {
                    score = calculateAlchemyGoldPerHour(alchemyContext, buffs, combo) - teaCostPerHour.total;
                    if (score > 0) {
                        totalScore += score;
                        profitableCount++;
                    }
                }
                actionScores.push({ action: actionName, score });
            } else if (goal === 'xp') {
                // Score combos by gold-neutral effective XP/hr, not raw XP/hr, so a combo that
                // trades away a huge amount of profit for a tiny XP bump doesn't win by default.
                const perActionData = actions.map((action) => {
                    const xp = calculateXpPerHour(action, buffs, playerLevel, otherEfficiency, calcContext);
                    const rawProfit = isGathering
                        ? calculateGatheringGoldPerHour(action, buffs, playerLevel, otherEfficiency, gameData, calcContext)
                        : calculateProductionGoldPerHour(
                              action,
                              buffs,
                              playerLevel,
                              otherEfficiency,
                              gameData,
                              calcContext
                          );
                    const profit = rawProfit - teaCostPerHour.total;
                    return { action, xp, profit };
                });

                const localAnchor = pickRankedProfitAnchor(perActionData);
                const localBestProfit = localAnchor?.profit ?? -Infinity;
                // The recovery-ratio denominator represents the true opportunity cost of your time,
                // which is the best profit/hr available anywhere, not just within this skill.
                const profitAnchor =
                    globalBestProfit != null ? Math.max(globalBestProfit, localBestProfit) : localBestProfit;

                for (const { action, xp, profit } of perActionData) {
                    let effectiveXp;
                    if (profit >= 0) {
                        effectiveXp = xp;
                    } else if (profitAnchor > 0) {
                        const recoveryRatio = Math.abs(profit) / profitAnchor;
                        // The recovery action's own XP isn't fungible with this skill's XP (it's often a
                        // different skill entirely), so it's never blended in — recovery time is dead
                        // time for this skill's XP, diluting the rate rather than adding to it.
                        effectiveXp = xp / (1 + recoveryRatio);
                    } else {
                        effectiveXp = 0;
                    }
                    totalScore += effectiveXp;
                    actionScores.push({ action: action.name, score: xp });
                }
            } else {
                for (const action of actions) {
                    let score;
                    if (isGathering) {
                        score = calculateGatheringGoldPerHour(
                            action,
                            buffs,
                            playerLevel,
                            otherEfficiency,
                            gameData,
                            calcContext
                        );
                        // Deduct tea costs from gold score
                        score -= teaCostPerHour.total;
                        // Only include profitable actions in gold calculations
                        if (score > 0) {
                            totalScore += score;
                            profitableCount++;
                        }
                    } else {
                        score = calculateProductionGoldPerHour(
                            action,
                            buffs,
                            playerLevel,
                            otherEfficiency,
                            gameData,
                            calcContext
                        );
                        // Deduct tea costs from gold score
                        score -= teaCostPerHour.total;
                        // Only include profitable actions in gold calculations
                        if (score > 0) {
                            totalScore += score;
                            profitableCount++;
                        }
                    }

                    actionScores.push({ action: action.name, score });
                }
            }

            // For gold, average across profitable actions only; for XP, average across all
            const avgDivisor = goal === 'gold' ? profitableCount || 1 : alchemyContext ? 1 : actions.length;

            results.push({
                teas: combo,
                totalScore,
                avgScore: totalScore / avgDivisor,
                actionScores,
                buffs,
                teaCostPerHour,
                profitableCount, // Track how many actions are profitable
            });
        }

        // Sort by total score (descending)
        results.sort((a, b) => b.totalScore - a.totalScore);

        // Get tea names for display
        const getTeaName = (hrid) => gameData.itemDetailMap[hrid]?.name || hrid;

        // Format excluded actions for display
        const excludedForDisplay = excludedActions
            .map((item) => ({
                action: item.action.name,
                reason: item.reason,
                requiredLevel: item.requiredLevel,
            }))
            .sort((a, b) => a.requiredLevel - b.requiredLevel);

        // Handle case where no actions are available (all excluded by level)
        if (results.length === 0 || !results[0]) {
            return {
                optimal: null,
                isConsistent: false,
                skill: skillName,
                goal,
                playerLevel,
                drinkConcentration,
                otherEfficiency,
                actionsEvaluated: 0,
                profitableActionsCount: 0,
                combinationsEvaluated: combinations.length,
                allResults: [],
                excludedActions: excludedForDisplay,
                teaCostPerHour: { total: 0, breakdown: [] },
            };
        }

        // Check if top result is consistent across all actions
        const topResult = results[0];
        const isConsistent = topResult.actionScores.every((as, _i, _arr) => {
            return as.score > 0;
        });

        return {
            optimal: {
                teas: topResult.teas.map((hrid) => ({
                    hrid,
                    name: getTeaName(hrid),
                })),
                totalScore: topResult.totalScore,
                avgScore: topResult.avgScore,
                actionScores: topResult.actionScores,
                buffs: topResult.buffs, // Include for UI debugging
                profitableCount: topResult.profitableCount, // How many actions are profitable
            },
            isConsistent,
            skill: skillName,
            goal,
            playerLevel,
            drinkConcentration,
            otherEfficiency,
            actionsEvaluated: alchemyContext ? 1 : actions.length,
            profitableActionsCount: topResult.profitableCount, // For display in stats
            combinationsEvaluated: combinations.length,
            allResults: results.slice(0, 5).map((r) => ({
                teas: r.teas.map(getTeaName),
                avgScore: r.avgScore,
                teaCostPerHour: r.teaCostPerHour,
            })),
            excludedActions: excludedForDisplay, // Actions excluded due to level
            // Include top result's tea cost for debug
            teaCostPerHour: topResult.teaCostPerHour,
        };
    }

    /**
     * Find the highest-level item at or below the player's alchemy level for use as a scoring reference.
     * Falls back to the lowest available alchemy item if none are at/below the player's level.
     * @param {number} playerLevel
     * @param {Object} itemDetailMap
     * @returns {string|null}
     */
    const ALCHEMY_ACTION_TYPES = ['coinify', 'decompose', 'transmute'];

    /**
     * Check whether an item supports a given alchemy action type.
     * @param {'coinify'|'decompose'|'transmute'} actionType
     * @param {Object} itemDetail
     * @returns {boolean}
     */
    function isAlchemyActionEligible(actionType, itemDetail) {
        if (actionType === 'coinify') return itemDetail.alchemyDetail?.isCoinifiable === true;
        if (actionType === 'decompose') return (itemDetail.alchemyDetail?.decomposeItems?.length ?? 0) > 0;
        if (actionType === 'transmute') {
            return (
                (itemDetail.alchemyDetail?.transmuteDropTable?.length ?? 0) > 0 &&
                (itemDetail.alchemyDetail?.transmuteSuccessRate || 0) > 0
            );
        }
        return false;
    }

    /**
     * Compute Coinify/Decompose/Transmute rates for every alchemizable item at or below the player's
     * level, each with its own optimal tea combo — unlike other skills' single action-list loop,
     * alchemy's "actions" are per-item, so every eligible item/action-type pair is evaluated.
     * @returns {Array<{name: string, hrid: string, actionType: string, requiredLevel: number,
     *  xpPerHour: number, profitPerHour: number, teaHrids: Array<string>}>}
     */
    function getAlchemyActionRates(
        playerLevel,
        goal,
        equipment,
        drinkConcentration,
        otherEfficiency,
        calcContext,
        globalBestProfit,
        overrides
    ) {
        const gameData = dataManager.getInitClientData();
        const itemDetailMap = gameData?.itemDetailMap;
        if (!itemDetailMap) return [];

        const results = [];
        for (const [itemHrid, detail] of Object.entries(itemDetailMap)) {
            if (!detail.alchemyDetail || !detail.itemLevel || detail.itemLevel > playerLevel) continue;

            for (const actionType of ALCHEMY_ACTION_TYPES) {
                if (!isAlchemyActionEligible(actionType, detail)) continue;

                const alchemyContext = { actionType, itemHrid };
                const optimalResult = findOptimalTeas(
                    'alchemy',
                    goal,
                    null,
                    null,
                    null,
                    alchemyContext,
                    equipment,
                    null,
                    globalBestProfit,
                    overrides
                );
                const teaHrids = optimalResult?.optimal?.teas?.map((t) => t.hrid) || [];

                const buffs = parseTeaBuffs(teaHrids, itemDetailMap, drinkConcentration);
                const teaCostPerHour = calculateTeaCostPerHour(teaHrids, drinkConcentration).total;

                const xpPerHour = calculateAlchemyXpPerHour(
                    alchemyContext,
                    buffs,
                    playerLevel,
                    otherEfficiency,
                    calcContext
                );
                const profitPerHour = calculateAlchemyGoldPerHour(alchemyContext, buffs, teaHrids) - teaCostPerHour;
                if (xpPerHour <= 0 && profitPerHour <= 0) continue;

                const actionLabel = actionType.charAt(0).toUpperCase() + actionType.slice(1);
                results.push({
                    name: `${actionLabel}: ${detail.name || itemHrid}`,
                    hrid: `/actions/alchemy/${actionType}#${itemHrid}`,
                    actionType,
                    requiredLevel: detail.itemLevel,
                    xpPerHour,
                    profitPerHour,
                    teaHrids,
                });
            }
        }
        return results;
    }

    function getRepresentativeAlchemyItemHrid(playerLevel, itemDetailMap) {
        let bestHrid = null;
        let bestLevel = 0;
        let fallbackHrid = null;
        let fallbackLevel = Infinity;
        for (const [hrid, detail] of Object.entries(itemDetailMap)) {
            if (!detail.alchemyDetail || !detail.itemLevel) continue;
            if (detail.itemLevel <= playerLevel) {
                if (detail.itemLevel > bestLevel) {
                    bestLevel = detail.itemLevel;
                    bestHrid = hrid;
                }
            } else if (detail.itemLevel < fallbackLevel) {
                fallbackLevel = detail.itemLevel;
                fallbackHrid = hrid;
            }
        }
        return bestHrid ?? fallbackHrid;
    }

    /**
     * Score a hypothetical equipment setup for a skill and goal with zero tea buffs.
     * Used by the skilling optimizer to rank equipment candidates per slot independently of teas.
     * @param {string} skillName
     * @param {string} goal - 'xp' or 'gold'
     * @param {Map} equipment - Map<itemLocationHrid, { itemHrid, enhancementLevel }>
     * @param {number} playerLevel
     * @param {Object|null} overrides - Optional custom-loadout overrides: { houseRooms, communityBuffLevels }.
     * @returns {number} Average XP/hr or Gold/hr across available actions
     */
    function scoreEquipmentSetup(
        skillName,
        goal,
        equipment,
        playerLevel,
        selectedActionHrids = null,
        overrides = null
    ) {
        const normalizedSkill = skillName.toLowerCase();
        const isGathering = GATHERING_SKILLS.includes(normalizedSkill);
        const isProduction = PRODUCTION_SKILLS.includes(normalizedSkill);

        if (!isGathering && !isProduction) return 0;

        const gameData = dataManager.getInitClientData();
        if (!gameData?.itemDetailMap) return 0;

        const actionType = SKILL_TO_ACTION_TYPE[normalizedSkill];
        if (!actionType) return 0;

        const otherEfficiency = getOtherEfficiencySources(actionType, overrides);

        // Add equipment gathering quantity bonus — not captured by the standard speed/efficiency parsers
        if (isGathering) {
            const equipGathering = parseGatheringQuantityBonus(equipment, gameData.itemDetailMap);
            if (equipGathering > 0) otherEfficiency.gathering = (otherEfficiency.gathering || 0) + equipGathering;
        }

        const { available: actions } = getActionsForSkill(normalizedSkill, playerLevel, selectedActionHrids);
        if (!actions.length) return 0;

        const emptyBuffs = {
            efficiency: 0,
            wisdom: 0,
            gathering: 0,
            processing: 0,
            artisan: 0,
            gourmet: 0,
            actionLevel: 0,
            alchemySuccess: 0,
            skillLevels: {},
        };

        const calcContext = { equipment, itemDetailMap: gameData.itemDetailMap };

        // Alchemy XP is derived from item level, not from action data — standard calculateXpPerHour
        // always returns 0 for alchemy. Use a dedicated path with a representative item instead.
        if (normalizedSkill === 'alchemy') {
            const repItemHrid = getRepresentativeAlchemyItemHrid(playerLevel, gameData.itemDetailMap);
            if (!repItemHrid) return 0;
            return calculateAlchemyXpPerHour(
                { actionType: 'decompose', itemHrid: repItemHrid },
                emptyBuffs,
                playerLevel,
                otherEfficiency,
                calcContext
            );
        }

        let totalScore = 0;
        let count = 0;

        for (const action of actions) {
            let score;
            if (goal === 'xp') {
                score = calculateXpPerHour(action, emptyBuffs, playerLevel, otherEfficiency, calcContext);
                totalScore += score;
                count++;
            } else if (isGathering) {
                score = calculateGatheringGoldPerHour(
                    action,
                    emptyBuffs,
                    playerLevel,
                    otherEfficiency,
                    gameData,
                    calcContext
                );
                if (score > 0) {
                    totalScore += score;
                    count++;
                }
            } else {
                score = calculateProductionGoldPerHour(
                    action,
                    emptyBuffs,
                    playerLevel,
                    otherEfficiency,
                    gameData,
                    calcContext
                );
                if (score > 0) {
                    totalScore += score;
                    count++;
                }
            }
        }

        return count > 0 ? totalScore / count : 0;
    }

    /**
     * Get per-action XP/hr or profit/hr (net of tea cost) for every available action in a skill,
     * using the player's current equipment and the optimal tea combination for the given goal.
     * Used to rank actions for "best rates" displays.
     * @param {string} skillName - Skill name (e.g., 'milking')
     * @param {number} playerLevel - Player's skill level
     * @param {string} goal - 'xp' or 'gold' — determines which optimal tea combo is used
     * @param {number|null} globalBestProfit - When goal is 'xp', the best profit/hr across ALL skills,
     *  used as the opportunity-cost anchor for gold-neutral effective XP. See {@link getGlobalBestProfitPerHour}.
     * @param {Object|null} overrides - Optional custom-loadout overrides: { equipment, houseRooms,
     *  communityBuffLevels }. Any field not present falls back to live player data.
     * @returns {Array<{name: string, hrid: string, requiredLevel: number, xpPerHour: number, profitPerHour: number, teaHrids: Array<string>}>}
     */
    function getSkillActionRates(skillName, playerLevel, goal, globalBestProfit = null, overrides = null) {
        const normalizedSkill = skillName.toLowerCase();
        const isGathering = GATHERING_SKILLS.includes(normalizedSkill);
        const isProduction = PRODUCTION_SKILLS.includes(normalizedSkill);
        if (!isGathering && !isProduction) return [];

        const gameData = dataManager.getInitClientData();
        if (!gameData?.itemDetailMap || !gameData?.actionDetailMap) return [];

        const actionType = SKILL_TO_ACTION_TYPE[normalizedSkill];
        if (!actionType) return [];

        const equipment = overrides?.equipment ?? dataManager.getEquipment();
        const drinkConcentration = getDrinkConcentration(equipment, gameData.itemDetailMap);
        const otherEfficiency = getOtherEfficiencySources(actionType, overrides);
        if (isGathering) {
            const equipGathering = parseGatheringQuantityBonus(equipment, gameData.itemDetailMap);
            if (equipGathering > 0) otherEfficiency.gathering = (otherEfficiency.gathering || 0) + equipGathering;
        }

        const calcContext = { equipment, itemDetailMap: gameData.itemDetailMap };

        if (normalizedSkill === 'alchemy') {
            return getAlchemyActionRates(
                playerLevel,
                goal,
                equipment,
                drinkConcentration,
                otherEfficiency,
                calcContext,
                globalBestProfit,
                overrides
            );
        }

        const results = [];
        for (const [hrid, action] of Object.entries(gameData.actionDetailMap)) {
            if (action.type !== actionType) continue;

            const requiredLevel = action.levelRequirement?.level || 1;
            if (playerLevel < requiredLevel) continue;

            // Optimize teas per action, not per skill-average — a combo that's best in aggregate can
            // easily be beaten, for one specific action, by a different combo (e.g. gourmet/artisan
            // relevance and action time/cost vary a lot between actions in the same skill).
            const optimalResult = findOptimalTeas(
                skillName,
                goal,
                null,
                action.name,
                null,
                null,
                equipment,
                null,
                globalBestProfit,
                overrides
            );
            const teaHrids = optimalResult?.optimal?.teas?.map((t) => t.hrid) || [];
            const buffs = parseTeaBuffs(teaHrids, gameData.itemDetailMap, drinkConcentration);
            const teaCostPerHour = calculateTeaCostPerHour(teaHrids, drinkConcentration).total;

            const xpPerHour = calculateXpPerHour(action, buffs, playerLevel, otherEfficiency, calcContext);
            const rawProfitPerHour = isGathering
                ? calculateGatheringGoldPerHour(action, buffs, playerLevel, otherEfficiency, gameData, calcContext)
                : calculateProductionGoldPerHour(action, buffs, playerLevel, otherEfficiency, gameData, calcContext);
            const profitPerHour = rawProfitPerHour - teaCostPerHour;

            results.push({ name: action.name, hrid, requiredLevel, xpPerHour, profitPerHour, teaHrids });
        }

        return results;
    }

    /**
     * Get the Nth-best profit/hr entry achievable across ALL skills (gold-optimal teas per skill), for
     * use as the opportunity-cost anchor when computing gold-neutral effective XP/hr. Using the Nth-best
     * (see PROFIT_ANCHOR_RANK) instead of the single best avoids letting one outlier-priced item —
     * which can trade far above its "real" value — dictate the bar for every XP action.
     * @returns {{profitPerHour: number, xpPerHour: number, name: string, hrid: string}|null} the anchor
     *  entry, or null if fewer than 1 profitable action exists across all skills
     */
    // 5 minutes: this anchor doesn't need to track prices/levels in near-real-time — it's an
    // opportunity-cost reference bar, not a live number. gathering-stats and max-produceable both
    // call this synchronously from their per-action-completion display refresh, so a short TTL meant
    // this ~600ms multi-skill/action/tea-combo search (findOptimalTeas × every gathering+production
    // action) was re-running on or near every single action completion and blocking the main thread
    // for the duration. A long TTL plus a background refresh (see below) means it now only actually
    // computes a few times per session, off the completion path.
    const GLOBAL_BEST_PROFIT_CACHE_TTL_MS = 5 * 60 * 1000;
    let globalProfitAnchorCache = { value: null, expiresAt: 0 };
    let globalProfitAnchorRefreshPending = false;

    function computeGlobalProfitAnchor() {
        const skills = dataManager.getSkills();
        const allEntries = [];
        for (const skillName of [...GATHERING_SKILLS, ...PRODUCTION_SKILLS]) {
            const skillHrid = `/skills/${skillName}`;
            let playerLevel = 1;
            for (const skill of skills || []) {
                if (skill.skillHrid === skillHrid) {
                    playerLevel = skill.level;
                    break;
                }
            }
            const rates = getSkillActionRates(skillName, playerLevel, 'gold');
            for (const r of rates) {
                if (r.profitPerHour > 0) {
                    allEntries.push({ profitPerHour: r.profitPerHour, xpPerHour: r.xpPerHour, name: r.name, hrid: r.hrid });
                }
            }
        }

        let result = null;
        if (allEntries.length > 0) {
            allEntries.sort((a, b) => b.profitPerHour - a.profitPerHour);
            const rankIndex = Math.min(PROFIT_ANCHOR_RANK - 1, allEntries.length - 1);
            result = allEntries[rankIndex];
        }
        return result;
    }

    /**
     * Returns the cached anchor immediately (stale or not) and kicks off a background recompute if
     * the cache is stale, rather than blocking the caller — callers on the action-completion display
     * path can't afford to wait on a ~600ms synchronous search.
     */
    function getGlobalProfitAnchor() {
        const now = Date.now();
        const isFresh = now < globalProfitAnchorCache.expiresAt;

        if (!isFresh && !globalProfitAnchorRefreshPending) {
            globalProfitAnchorRefreshPending = true;
            setTimeout(() => {
                globalProfitAnchorRefreshPending = false;
                const result = computeGlobalProfitAnchor();
                globalProfitAnchorCache = { value: result, expiresAt: Date.now() + GLOBAL_BEST_PROFIT_CACHE_TTL_MS };
            }, 0);
        }

        return globalProfitAnchorCache.value;
    }

    /**
     * Convenience wrapper around {@link getGlobalProfitAnchor} for callers that only need the number.
     * @returns {number} Nth-best profit/hr across all skills (0 if fewer than 1 profitable action)
     */
    function getGlobalBestProfitPerHour() {
        return getGlobalProfitAnchor()?.profitPerHour ?? 0;
    }

    /**
     * Get buff description for a tea
     * @param {string} teaHrid - Tea item HRID
     * @returns {string} Human-readable buff description
     */
    function getTeaBuffDescription(teaHrid, drinkConcentration = 0) {
        const gameData = dataManager.getInitClientData();
        if (!gameData?.itemDetailMap) return '';

        const itemDetails = gameData.itemDetailMap[teaHrid];
        if (!itemDetails?.consumableDetail?.buffs) return '';

        const dcMultiplier = 1 + drinkConcentration;
        const descriptions = [];

        for (const buff of itemDetails.consumableDetail.buffs) {
            const baseValue = buff.flatBoost || 0;
            const scaledValue = baseValue * dcMultiplier;
            const dcBonus = baseValue * drinkConcentration;

            switch (buff.typeHrid) {
                case '/buff_types/efficiency':
                    descriptions.push(formatBuffWithDC(scaledValue * 100, dcBonus * 100, '% eff', true));
                    break;
                case '/buff_types/wisdom':
                    descriptions.push(formatBuffWithDC(scaledValue * 100, dcBonus * 100, '% XP', true));
                    break;
                case '/buff_types/gathering':
                    descriptions.push(formatBuffWithDC(scaledValue * 100, dcBonus * 100, '% gathering', true));
                    break;
                case '/buff_types/processing':
                    descriptions.push(formatBuffWithDC(scaledValue * 100, dcBonus * 100, '% processing', true));
                    break;
                case '/buff_types/artisan':
                    descriptions.push(formatBuffWithDC(scaledValue * 100, dcBonus * 100, '% mat savings', true));
                    break;
                case '/buff_types/gourmet':
                    descriptions.push(formatBuffWithDC(scaledValue * 100, dcBonus * 100, '% extra output', true));
                    break;
                case '/buff_types/action_level':
                    descriptions.push(formatBuffWithDC(scaledValue, dcBonus, ' action lvl', false));
                    break;
                default:
                    if (buff.typeHrid.endsWith('_level')) {
                        const skill = buff.typeHrid.match(/\/buff_types\/(\w+)_level/)?.[1];
                        if (skill) {
                            descriptions.push(formatBuffWithDC(scaledValue, dcBonus, ` ${skill}`, false));
                        }
                    }
            }
        }

        return descriptions.join(', ');
    }

    /**
     * Format a buff value with optional drink concentration bonus
     * @param {number} scaledValue - Total value including DC
     * @param {number} dcBonus - Just the DC bonus portion
     * @param {string} suffix - Unit suffix (e.g., '% eff', ' tailoring')
     * @param {boolean} isPercent - Whether to format as percentage
     * @returns {string} Formatted string like "+8.8 tailoring (+.8)"
     */
    function formatBuffWithDC(scaledValue, dcBonus, suffix, isPercent) {
        // Format the main value
        const mainFormatted = isPercent
            ? `+${Number.isInteger(scaledValue) ? scaledValue : scaledValue.toFixed(1)}${suffix}`
            : `+${Number.isInteger(scaledValue) ? scaledValue : scaledValue.toFixed(1)}${suffix}`;

        // If no DC bonus, just return the main value
        if (dcBonus === 0) {
            return mainFormatted;
        }

        // Format the DC bonus (with % suffix if percentage)
        const dcFormatted = isPercent
            ? `(+${dcBonus < 1 ? dcBonus.toFixed(1) : dcBonus.toFixed(0)}%)`
            : `(+${dcBonus < 1 ? dcBonus.toFixed(1) : dcBonus.toFixed(0)})`;

        return `${mainFormatted} ${dcFormatted}`;
    }

    /**
     * Calculate XP/hr and Gold/hr for a specific equipment and tea setup.
     * Unlike scoreEquipmentSetup (which uses empty teas for equipment comparison),
     * this evaluates a real configured setup and returns both metrics.
     * @param {string} skillName
     * @param {Map} equipment - Map<itemLocationHrid, { itemHrid, enhancementLevel }>
     * @param {string[]} teaHrids - Tea item HRIDs (null/empty entries are filtered)
     * @param {number} playerLevel
     * @param {Set<string>|null} selectedActionHrids
     * @returns {{ xpPerHour: number, goldPerHour: number, teaCostPerHour: number }}
     */
    function calculateSkillPerformance(skillName, equipment, teaHrids, playerLevel, selectedActionHrids = null) {
        const normalizedSkill = skillName.toLowerCase();
        const isGathering = GATHERING_SKILLS.includes(normalizedSkill);
        const isProduction = PRODUCTION_SKILLS.includes(normalizedSkill);

        const empty = { xpPerHour: 0, goldPerHour: 0, teaCostPerHour: 0 };
        if (!isGathering && !isProduction) return empty;
        if (selectedActionHrids !== null && selectedActionHrids.size === 0) return empty;

        const gameData = dataManager.getInitClientData();
        if (!gameData?.itemDetailMap) return empty;

        const actionType = SKILL_TO_ACTION_TYPE[normalizedSkill];
        if (!actionType) return empty;

        const { available: actions } = getActionsForSkill(normalizedSkill, playerLevel, selectedActionHrids);
        if (!actions.length) return empty;

        const filteredTeas = (teaHrids || []).filter(Boolean);
        const drinkConcentration = getDrinkConcentration(equipment, gameData.itemDetailMap);
        const buffs = parseTeaBuffs(filteredTeas, gameData.itemDetailMap, drinkConcentration);

        const otherEfficiency = getOtherEfficiencySources(actionType);
        if (isGathering) {
            const equipGathering = parseGatheringQuantityBonus(equipment, gameData.itemDetailMap);
            if (equipGathering > 0) otherEfficiency.gathering = (otherEfficiency.gathering || 0) + equipGathering;
        }

        const teaCost = calculateTeaCostPerHour(filteredTeas, drinkConcentration);
        const calcContext = { equipment, itemDetailMap: gameData.itemDetailMap };

        let totalXp = 0,
            xpCount = 0;
        let totalGold = 0,
            goldCount = 0;

        for (const action of actions) {
            const xp = calculateXpPerHour(action, buffs, playerLevel, otherEfficiency, calcContext);
            if (xp > 0) {
                totalXp += xp;
                xpCount++;
            }

            const gold = isGathering
                ? calculateGatheringGoldPerHour(action, buffs, playerLevel, otherEfficiency, gameData, calcContext) -
                  teaCost.total
                : calculateProductionGoldPerHour(action, buffs, playerLevel, otherEfficiency, gameData, calcContext) -
                  teaCost.total;
            if (gold > 0) {
                totalGold += gold;
                goldCount++;
            }
        }

        return {
            xpPerHour: xpCount > 0 ? totalXp / xpCount : 0,
            goldPerHour: goldCount > 0 ? totalGold / goldCount : 0,
            teaCostPerHour: teaCost.total,
        };
    }

    var teaOptimizer = {
        findOptimalTeas,
        getRelevantTeas,
        getTeaBuffDescription,
        scoreEquipmentSetup,
        getSkillActionsForDisplay,
        calculateSkillPerformance,
        getSkillActionRates,
        getGlobalBestProfitPerHour,
        getGlobalProfitAnchor,
    };

    var teaOptimizer$1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        calculateSkillPerformance: calculateSkillPerformance,
        default: teaOptimizer,
        findOptimalTeas: findOptimalTeas,
        getGlobalBestProfitPerHour: getGlobalBestProfitPerHour,
        getGlobalProfitAnchor: getGlobalProfitAnchor,
        getRelevantTeas: getRelevantTeas,
        getSkillActionRates: getSkillActionRates,
        getSkillActionsForDisplay: getSkillActionsForDisplay,
        getTeaBuffDescription: getTeaBuffDescription,
        scoreEquipmentSetup: scoreEquipmentSetup
    });

    /**
     * Foundation Utils Library
     * All utility modules
     *
     * Exports to: window.Cheezasha.Utils
     */


    // Export to global namespace
    const cheezashaRoot = window.Cheezasha || {};
    window.Cheezasha = cheezashaRoot;

    if (typeof unsafeWindow !== 'undefined') {
        unsafeWindow.Cheezasha = cheezashaRoot;
    }

    cheezashaRoot.Utils = {
        formatters,
        efficiency: efficiency$1,
        profitHelpers: profitHelpers$1,
        profitConstants: profitConstants$1,
        dom: dom$1,
        domObserverHelpers,
        timerRegistry,
        bonusRevenueCalculator,
        enhancementMultipliers,
        experienceParser: experienceParser$1,
        marketListings,
        actionCalculator,
        actionPanelHelper,
        teaParser: teaParser$1,
        buffParser,
        selectors,
        houseEfficiency: houseEfficiency$1,
        experienceCalculator: experienceCalculator$1,
        marketData: marketData$1,
        abilityCalc,
        equipmentParser,
        uiComponents: uiComponents$1,
        enhancementConfig,
        enhancementGearDetector,
        reactInput,
        materialCalculator,
        tokenValuation,
        pricingHelper,
        cleanupRegistry,
        houseCostCalculator,
        enhancementCalculator,
        teaOptimizer: teaOptimizer$1,
    };

    console.log('[Cheezasha] Utils library loaded');

})(Cheezasha.Core.config, Cheezasha.Core.dataManager, Cheezasha.Core.webSocketHook, Cheezasha.Core.storage, Cheezasha.Core.marketAPI, Cheezasha.Core.domObserver);

/**
 * Combinatorics helper shared by the coffee and food optimizers.
 */

/**
 * Generate all combinations of up to maxSlots items (including the empty combo), no repetition.
 * @param {Array} items
 * @param {number} maxSlots
 * @returns {Array<Array>}
 */
export function generateCombos(items, maxSlots) {
    const combos = [[]];
    const recurse = (start, current) => {
        if (current.length > 0) combos.push([...current]);
        if (current.length >= maxSlots) return;
        for (let i = start; i < items.length; i++) {
            current.push(items[i]);
            recurse(i + 1, current);
            current.pop();
        }
    };
    recurse(0, []);
    return combos;
}

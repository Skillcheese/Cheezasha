/**
 * Combat Level XP Table
 *
 * Hardcoded cumulative-XP-per-level curve (levels 1-200), shared across all skills in this
 * game — the same table the live client exposes as gameData.levelExperienceTable. Hardcoded
 * here (rather than read from live game data) so the progression planner's level-gating math
 * can run as plain, fully unit-testable logic without a browser.
 *
 * Indexed by level to match the convention already used where the live table is read
 * elsewhere in this codebase (e.g. upgrade-advisor.js's `levelExperienceTable[level]`):
 * LEVEL_XP_TABLE[1] === 0, LEVEL_XP_TABLE[2] === 33, ..., LEVEL_XP_TABLE[200] === 100e9.
 * Index 0 is unused (always 0).
 */

export const LEVEL_XP_TABLE = [
    0, 0, 33, 76, 132, 202, 286, 386, 503, 637, 791, 964, 1_159, 1_377, 1_620, 1_891, 2_192, 2_525, 2_893, 3_300, 3_750,
    4_247, 4_795, 5_400, 6_068, 6_805, 7_618, 8_517, 9_508, 10_604, 11_814, 13_151, 14_629, 16_262, 18_068, 20_064,
    22_271, 24_712, 27_411, 30_396, 33_697, 37_346, 41_381, 45_842, 50_773, 56_222, 62_243, 68_895, 76_242, 84_355,
    93_311, 103_195, 114_100, 126_127, 139_390, 154_009, 170_118, 187_863, 207_403, 228_914, 252_584, 278_623, 307_256,
    338_731, 373_318, 411_311, 453_030, 498_824, 549_074, 604_193, 664_632, 730_881, 803_472, 882_985, 970_050,
    1_065_351, 1_169_633, 1_283_701, 1_408_433, 1_544_780, 1_693_774, 1_856_536, 2_034_279, 2_228_321, 2_440_088,
    2_671_127, 2_923_113, 3_197_861, 3_497_335, 3_823_663, 4_179_145, 4_566_274, 4_987_741, 5_446_463, 5_945_587,
    6_488_521, 7_078_945, 7_720_834, 8_418_485, 9_176_537, 10_000_000, 11_404_976, 12_904_567, 14_514_400, 16_242_080,
    18_095_702, 20_083_886, 22_215_808, 24_501_230, 26_950_540, 29_574_787, 32_385_721, 35_395_838, 38_618_420,
    42_067_584, 45_758_332, 49_706_603, 53_929_328, 58_444_489, 63_271_179, 68_429_670, 73_941_479, 79_829_440,
    86_117_783, 92_832_214, 100_000_000, 114_406_130, 130_118_394, 147_319_656, 166_147_618, 186_752_428, 209_297_771,
    233_962_072, 260_939_787, 290_442_814, 322_702_028, 357_968_938, 396_517_495, 438_646_053, 484_679_494, 534_971_538,
    589_907_252, 649_905_763, 715_423_218, 786_955_977, 865_044_093, 950_275_074, 1_043_287_971, 1_144_777_804,
    1_255_500_373, 1_376_277_458, 1_508_002_470, 1_651_646_566, 1_808_265_285, 1_979_005_730, 2_165_114_358,
    2_367_945_418, 2_588_970_089, 2_829_786_381, 3_092_129_857, 3_377_885_250, 3_689_099_031, 4_027_993_033,
    4_396_979_184, 4_798_675_471, 5_235_923_207, 5_711_805_728, 6_229_668_624, 6_793_141_628, 7_406_162_301,
    8_073_001_662, 8_798_291_902, 9_587_056_372, 10_444_742_007, 11_377_254_401, 12_390_995_728, 13_492_905_745,
    14_690_506_120, 15_991_948_361, 17_406_065_609, 18_942_428_633, 20_611_406_335, 22_424_231_139, 24_393_069_640,
    26_531_098_945, 28_852_589_138, 31_372_992_363, 34_109_039_054, 37_078_841_860, 40_302_007_875, 43_799_759_843,
    47_595_067_021, 51_712_786_465, 56_179_815_564, 61_025_256_696, 66_280_594_953, 71_979_889_960, 78_159_982_881,
    84_860_719_814, 92_125_192_822, 100_000_000_000,
];

export const MAX_LEVEL = LEVEL_XP_TABLE.length - 1;

/**
 * Cumulative XP required to reach a given level.
 * @param {number} level - 1-200
 * @returns {number} cumulative XP at that level (0 for level 1, or for anything below it)
 */
export function getXpForLevel(level) {
    if (level <= 1) return 0;
    if (level >= MAX_LEVEL) return LEVEL_XP_TABLE[MAX_LEVEL];
    return LEVEL_XP_TABLE[Math.floor(level)];
}

/**
 * Level reached at a given cumulative XP total.
 * @param {number} xp - Cumulative XP
 * @returns {number} level (1-200)
 */
export function getLevelForXp(xp) {
    if (!(xp > 0)) return 1;
    if (xp >= LEVEL_XP_TABLE[MAX_LEVEL]) return MAX_LEVEL;

    // Table is short (200 entries) and monotonically increasing — linear scan is plenty fast
    // and keeps this simple; swap for a binary search if this ever runs in a hot loop.
    let level = 1;
    for (let i = 2; i <= MAX_LEVEL; i++) {
        if (LEVEL_XP_TABLE[i] > xp) break;
        level = i;
    }
    return level;
}

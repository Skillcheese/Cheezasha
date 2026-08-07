# Changelog

## [3.6.0](https://github.com/Skillcheese/Cheezasha/compare/v3.5.0...v3.6.0) (2026-08-07)


### Features

* break down alchemy rates by action type in skill optimizer and best-rates popup ([d29acdd](https://github.com/Skillcheese/Cheezasha/commit/d29acdd0676087f25d01d25784da1928f2b4aadc))
* improve crafting plan ordering, dedup, live updates, and profit stats ([e5501d7](https://github.com/Skillcheese/Cheezasha/commit/e5501d798827475f234f641ee326e4f204583ed4))

## [3.5.0](https://github.com/Skillcheese/Cheezasha/compare/v3.4.0...v3.5.0) (2026-08-07)

### Features

- add Disable Charms filter to skill optimizer and best-rates popup ([fcfdea7](https://github.com/Skillcheese/Cheezasha/commit/fcfdea777bdb02d45c444d65b796d89485f20c48))

### Bug Fixes

- pick lowest-cost protect-from level in enhancing optimizer ([303e114](https://github.com/Skillcheese/Cheezasha/commit/303e1141a7bb454fc10a5f00c4cc15b8e0939da1))
- re-enable combat sim player import and fix equipment type mapping ([8762d35](https://github.com/Skillcheese/Cheezasha/commit/8762d358a8c702d6e66af7058035a954f4aa101a))

### Performance Improvements

- fix input freeze on action completion from layout thrashing and gold-anchor recompute ([07d0b4e](https://github.com/Skillcheese/Cheezasha/commit/07d0b4e4869876210051b6ce36ce4c4feef5e52a))
- throttle action countdown loop and debounce XP nav bar updates ([6e86b28](https://github.com/Skillcheese/Cheezasha/commit/6e86b2877575166d1a617514531573f53a19bc3a))

## [3.4.0](https://github.com/Skillcheese/Cheezasha/compare/v3.3.0...v3.4.0) (2026-08-06)

### Features

- add marketplace flipping tool, churn estimator, and combat ETA/level-target analysis ([86d19ef](https://github.com/Skillcheese/Cheezasha/commit/86d19ef7c5f4e59ccc46af8cbc909a1bf0e1d082))

### Performance Improvements

- **combat-sim:** reduce allocations and redundant work in simulator hot path ([f5e567d](https://github.com/Skillcheese/Cheezasha/commit/f5e567da9abc65f2f06c711dccaa907a418c40f7))

## [3.3.0](https://github.com/Skillcheese/Cheezasha/compare/v3.2.1...v3.3.0) (2026-08-03)

### Features

- **combat-sim:** parallelize upgrade/labyrinth optimizers, add ultimate sim food display ([1453836](https://github.com/Skillcheese/Cheezasha/commit/14538362a1e68bbe3f3753b6d6e34ec5168e1f94))

### Documentation

- document release-please version-sync workflow in CLAUDE.md ([d366462](https://github.com/Skillcheese/Cheezasha/commit/d366462c19ad25387caf6152cedae5c2496ef1a0))

## [3.2.1](https://github.com/Skillcheese/Cheezasha/compare/v3.2.0...v3.2.1) (2026-08-02)

### Bug Fixes

- **combat-sim:** fix upgrade equipment +levels box, speed up food/coffee/ultimate sim ([416f9d8](https://github.com/Skillcheese/Cheezasha/commit/416f9d880b3968828523eb56db0656ea59fe6a72))

## [3.2.0](https://github.com/Skillcheese/Cheezasha/compare/v3.1.0...v3.2.0) (2026-08-02)

### Features

- merge Optimize Food/Coffee and Ultimate Sim into Combat Sim panel ([d911330](https://github.com/Skillcheese/Cheezasha/commit/d9113307a4f484606403f72203a3b5c9be840942))

### Documentation

- add install-from-URL instructions including Steam client ([0882d30](https://github.com/Skillcheese/Cheezasha/commit/0882d3031b1f7027d4156a8b98315841f57582f5))

## [3.1.0](https://github.com/Skillcheese/Cheezasha/compare/v3.0.1...v3.1.0) (2026-08-02)

### Features

- add Ultimate Sim (food/coffee/zone optimization loop) ([2eea285](https://github.com/Skillcheese/Cheezasha/commit/2eea285f9a2dd301cd1b9cb603cefc05ecf6b4f9))

## [3.0.1](https://github.com/Skillcheese/Cheezasha/compare/v3.0.0...v3.0.1) (2026-08-02)

### Bug Fixes

- export getSettingDefinition/getSettingDependencies from Core library ([b1fc68f](https://github.com/Skillcheese/Cheezasha/commit/b1fc68fbd94511235f99d9f1fc203427e8fbfb94))

## [3.0.0](https://github.com/Skillcheese/Cheezasha/compare/v2.87.1...v3.0.0) (2026-08-02)

### ⚠ BREAKING CHANGES

- The userscript name, IndexedDB database, window global namespace, and CSS variable prefixes are renamed from Toolasha/toolasha to Cheezasha/cheezasha. A one-time migration copies existing users' IndexedDB data from ToolashaDB to CheezashaDB on first load so settings and history are preserved. The GitHub repo is renamed to Skillcheese/Cheezasha and downloadURL/updateURL now point at the releases branch instead of the old Greasy Fork listing.

### Features

- rename project from Toolasha to Cheezasha ([d4e31c1](https://github.com/Skillcheese/Cheezasha/commit/d4e31c11fe941c24710392f1cdcf4f8e5965cc44))

## [2.87.1](https://github.com/Skillcheese/Toolasha/compare/v2.87.0...v2.87.1) (2026-08-02)

### Bug Fixes

- point userscript update URLs to the Skillcheese fork and refresh docs ([c7b116c](https://github.com/Skillcheese/Toolasha/commit/c7b116c2d079f2f7cc956a584b933d5ff6b7fd00))

## [2.87.0](https://github.com/Skillcheese/Toolasha/compare/v2.86.0...v2.87.0) (2026-08-02)

### Features

- add Best Rates popup showing top profit/hr and XP/hr per skill ([1a449a2](https://github.com/Skillcheese/Toolasha/commit/1a449a222e3ea32a5eaed6f7bdf5872704b565c9))
- add budget-based Ability Levels/Swaps sizing and fix cost calc ([70b3b0d](https://github.com/Skillcheese/Toolasha/commit/70b3b0daf9eb8ad0d2ed9631ea44af7533efc8cf))
- add mana OOM column to combat sim all-zones table ([c60a53d](https://github.com/Skillcheese/Toolasha/commit/c60a53d31a9c7c67bf91a07c68e7eef42c404162))
- add Optimize Coffee button to combat sim panel ([89925f1](https://github.com/Skillcheese/Toolasha/commit/89925f10f8ecb4e23aa01a3f5472b8e04d9b1db5))
- add Optimize Food button to combat sim panel ([3daae51](https://github.com/Skillcheese/Toolasha/commit/3daae512e90b52c867a685d734730794acb12867))
- add Skill Optimizer and Enhancement Optimizer popups ([e7f33fa](https://github.com/Skillcheese/Toolasha/commit/e7f33fa24b2833e9a7a0ede74df609063db8e649))
- expand Ability Swaps to empty slots with level-gated, budget-scaled candidates ([aa3def0](https://github.com/Skillcheese/Toolasha/commit/aa3def0d7ef598312709b5bc96d4a139de6f7c00))
- rework Equipment upgrade advisor to budget-gated, flat sortable results ([00d60df](https://github.com/Skillcheese/Toolasha/commit/00d60df2434f08649320399a521fbc9f55af4da0))
- show top 5 per skill and add a Balanced tab to Best Rates ([aed9ab2](https://github.com/Skillcheese/Toolasha/commit/aed9ab2d3d053f445431b626ff74c4d4366e0c1e))

### Bug Fixes

- align Best Rates and tooltip profit calc to same price resolution ([1deb937](https://github.com/Skillcheese/Toolasha/commit/1deb93795f2ad61f1734f8e7de7e26f7cd8d3a85))
- apply market tax to alchemy bonus drop revenue ([9e300a5](https://github.com/Skillcheese/Toolasha/commit/9e300a590692c71a15746bbbb0b89e99d982ed8c))
- combat sim always uses current character, disable stale import ([6cd9463](https://github.com/Skillcheese/Toolasha/commit/6cd94637bd6208f828243e329dfc4811df4f41df))
- don't claim success rate applies to alchemy bonus drop labels ([bfd5a59](https://github.com/Skillcheese/Toolasha/commit/bfd5a5910e27bcc4d9dc40536a7821a85759da48))
- enforce food category exclusivity in Optimize Food ([52595ad](https://github.com/Skillcheese/Toolasha/commit/52595ad7229ff674aadb2bdc81546f35c0dd0e98))
- exclude drink cost from Optimize Food cost/hr ([46aa3cb](https://github.com/Skillcheese/Toolasha/commit/46aa3cb1b2d021a27f19c882b8aec6361bed61b5))
- filter Equipment upgrade candidates by combat style and chain tier ([dbc32ea](https://github.com/Skillcheese/Toolasha/commit/dbc32ea29c1628121d71e7dd06fe8f4582f97485))
- make gold-neutral effective xp/hr robust and never inflate raw xp ([b0b62c3](https://github.com/Skillcheese/Toolasha/commit/b0b62c3c03fa9b9c5b5ff09d7acad06d8f3ecdf1))
- rank best XP/hr tab by gold-neutral effective XP/hr ([fa83f3e](https://github.com/Skillcheese/Toolasha/commit/fa83f3e7b51538078269c91a143e199837663fd1))
- reset to current re-fetches live character instead of stale snapshot ([66e56ff](https://github.com/Skillcheese/Toolasha/commit/66e56ff5267d8fc5fedc6d599b29b060812d85d9))
- respect pricing mode setting in production-cost fallbacks ([30afa38](https://github.com/Skillcheese/Toolasha/commit/30afa381bd6f6e1f8ae54e0d286616de457f2859))
- show after-tax price in alchemy drop breakdowns ([11c553b](https://github.com/Skillcheese/Toolasha/commit/11c553b1e4bd56b5ef3ae00befb3dd9bfed28a6d))
- use 10th-best profit/hr as gold-neutral recovery anchor ([5c45918](https://github.com/Skillcheese/Toolasha/commit/5c45918ad5984d3317db04983e67daa73f4cdbdd))
- use shared global profit anchor and drop unrelated-skill XP from gold-neutral blend ([70ebfe2](https://github.com/Skillcheese/Toolasha/commit/70ebfe25d262009c051fc26d4f06b877f9682547))

### Performance Improvements

- early-exit Optimize Food search once the survival floor is hit ([0dfadcb](https://github.com/Skillcheese/Toolasha/commit/0dfadcb041a17845cc1bfa31fc1f72ea66fc778d))

### Miscellaneous Chores

- log candidate pools for Optimize Coffee/Food ([c77440b](https://github.com/Skillcheese/Toolasha/commit/c77440b566cf61d4754f75fb603e9665c2fc9563))

### Reverts

- restore one-time editor init on combat sim panel open ([7e62bde](https://github.com/Skillcheese/Toolasha/commit/7e62bdeba9bb8a8fe60b188fce859fe34064cc79))

## [2.86.0](https://github.com/Skillcheese/Toolasha/compare/v2.85.1...v2.86.0) (2026-07-31)

### Features

- add "Skip Back" toggle to combat sim upgrade analysis ([5375caf](https://github.com/Skillcheese/Toolasha/commit/5375caf711e2bd61186ec64f6e13177c15f693ca))
- add configurable number format mode and precision settings ([53349ba](https://github.com/Skillcheese/Toolasha/commit/53349bacc7d4b84a56285ebf661382fbd45ce313))
- add configurable whisper template for guild trial unsigned members ([f8cd052](https://github.com/Skillcheese/Toolasha/commit/f8cd052aa0252aa0fc6b7e07fb969f86a7b3709a))
- add Copy List button to guild trial signup modals ([c60b883](https://github.com/Skillcheese/Toolasha/commit/c60b88345846320592a50a44f2b7b96e548199c9))
- add cost summary block to production action panels ([655dfd2](https://github.com/Skillcheese/Toolasha/commit/655dfd2b2c3140db9efbebc1de8620505d00af59))
- add current action profit display to action bar ([9f4a5a4](https://github.com/Skillcheese/Toolasha/commit/9f4a5a408619c8cda3e78391d0811df7e5910610))
- add default loadout setting for combat sim estimates ([7f7d2fa](https://github.com/Skillcheese/Toolasha/commit/7f7d2fab6051d11d91ebe4cb180e3fec162d846c))
- add draggable modals with remembered position ([5d41e5a](https://github.com/Skillcheese/Toolasha/commit/5d41e5a4e3d315d1e479908f2e26efa13dd7279f))
- add drink timer to skill panel consumables section ([08409f2](https://github.com/Skillcheese/Toolasha/commit/08409f2ce281a7a00ec7cfbd4fb1b612f392f6d3))
- add exchange advisor to guild credit modal ([66d11b5](https://github.com/Skillcheese/Toolasha/commit/66d11b5e5a09b261642df3b2ad14d3452ee2c259))
- add Expand All / Collapse All buttons to Custom Tabs ([8d4e367](https://github.com/Skillcheese/Toolasha/commit/8d4e367c2fe1c31b42231e8379b7099246f7054c))
- add global reroll-at-cap protection to task reroll protection ([e0aef30](https://github.com/Skillcheese/Toolasha/commit/e0aef30b3a19437f60a4356e8b3cf188985f0eb7))
- add gold cost per credit table to guild credit exchange modals ([5af726c](https://github.com/Skillcheese/Toolasha/commit/5af726c4217ed0a5bef51119abe68caf8f92ea66))
- add gold-neutral effective XP/hr ranking for best overall action ([7bfa90b](https://github.com/Skillcheese/Toolasha/commit/7bfa90ba2cb9f7d41ff856a7f467b6f2699b1802))
- add guild activity calculator and simulator ([955c78e](https://github.com/Skillcheese/Toolasha/commit/955c78e3242b550158934d98f1db2ab63d1354c6))
- add idle members list to Guild Overview tab ([46ed6bd](https://github.com/Skillcheese/Toolasha/commit/46ed6bd6c4dfeadde5205d68f15ec2fd5f722c80))
- add item icons to pinned actions overview tab ([e980a16](https://github.com/Skillcheese/Toolasha/commit/e980a1618c6a392fb2273e69e8b4757eb1adc08d))
- add listing refresh navigator to My Listings page ([107c118](https://github.com/Skillcheese/Toolasha/commit/107c11877a34cd2315e8a94255fc6d833a28a3c3))
- add mana run out, debuff on level gap, and wipe event log to combat sim results ([0a8fbd9](https://github.com/Skillcheese/Toolasha/commit/0a8fbd9dc016720d351bd026217594ea249872a8))
- add max threads setting for combat simulator ([4f8105c](https://github.com/Skillcheese/Toolasha/commit/4f8105c5931103258a29a3badb597ad27d18630e))
- add missing mats marketplace button to shrine upgrade cost table ([89f51bc](https://github.com/Skillcheese/Toolasha/commit/89f51bc02fcd1d6684aa45f19f34eff7084f0043))
- add missing mats marketplace tabs to shrine upgrade modal ([3656e84](https://github.com/Skillcheese/Toolasha/commit/3656e843fd44210d7fad91f86fcfe62b288f358d))
- add net worth pricing mode setting (ask/bid) ([4b0026e](https://github.com/Skillcheese/Toolasha/commit/4b0026e9c15f7195ccd7e09a41326db40c974057))
- add option to hide Guild notification badge in sidebar ([a75e91f](https://github.com/Skillcheese/Toolasha/commit/a75e91fe25f397773bf880aa71467719b7955234))
- add per-character selector to Copy Settings button ([507501b](https://github.com/Skillcheese/Toolasha/commit/507501b14163781703be0fd73bb170fc2fc43841))
- add per-column toggles and tab routing for guild Members columns ([7841384](https://github.com/Skillcheese/Toolasha/commit/78413843607b00404a4f2f3ff5c8a743c68ef12a))
- add per-player DPS to combat sim results ([65b564d](https://github.com/Skillcheese/Toolasha/commit/65b564d91c68fa5640eb72829cb3300f8f810aea))
- add per-skill filter for skilling upgrade analysis ([c9091f0](https://github.com/Skillcheese/Toolasha/commit/c9091f015a3ec8b50e8b13c0d2297769a19387c9))
- add Protection sort mode to task sorter ([f160f54](https://github.com/Skillcheese/Toolasha/commit/f160f548e66cda38d68c41b8313bcec3ee6aad36))
- add resizable combat simulator panel ([d30d0b8](https://github.com/Skillcheese/Toolasha/commit/d30d0b86731ee415d841a6990e0331efc55d08d2))
- add Sell Queue — Shift+RightClick inventory items to sell ([c38aa7b](https://github.com/Skillcheese/Toolasha/commit/c38aa7b8ae918e6c070184e758f0cca9503d4afd))
- add shrine upgrade cost table and ask/bid columns to guild credit modals ([501cc92](https://github.com/Skillcheese/Toolasha/commit/501cc92a0d94aa6258ae6357c200b1ac14c64d8e))
- add shrine upgrade planner to guild credit exchange panel ([783a04a](https://github.com/Skillcheese/Toolasha/commit/783a04a0639c52931dc2c98c2b005e73c2ae0e82))
- add skilling room simulation tab to Lab Simulator ([3e85838](https://github.com/Skillcheese/Toolasha/commit/3e858385c3f68c37ec3650c165885f500687c85c))
- add Skilling Simulator and Optimizer tab to character panel ([3318f48](https://github.com/Skillcheese/Toolasha/commit/3318f48634cce30a4f3338deb999213128f2d4f8))
- add sortable Progress column header to My Listings table ([3b1191e](https://github.com/Skillcheese/Toolasha/commit/3b1191ee06a15e3ef0987deeec51ff1b64b85a69))
- add transmute recycle time estimate to action timer ([f1bfb84](https://github.com/Skillcheese/Toolasha/commit/f1bfb849d3c088bb9d8393be1a7e529348d5ebc9))
- add zone mode for combat task estimates with multi-task aggregate ([91dc511](https://github.com/Skillcheese/Toolasha/commit/91dc51114282402f130a9812b752813589ebc55f))
- auto-advance to next sell queue tab when item sells out ([0ffb3e6](https://github.com/Skillcheese/Toolasha/commit/0ffb3e6933a2621b4cdda17ebc77e54ecc55b715))
- auto-fill enhancement target level from settings ([54dfa65](https://github.com/Skillcheese/Toolasha/commit/54dfa659813313e240f88550889af1ecefb9b16a))
- auto-fill optimal protect-from level when protection item is set ([7b44dba](https://github.com/Skillcheese/Toolasha/commit/7b44dba83598026aa7121a6a35359c5f9273464e))
- auto-run combat estimates when task cards appear ([6727c0f](https://github.com/Skillcheese/Toolasha/commit/6727c0fd6298f9571a7f013586c3164c3d10f049))
- consolidate lab sim inputs into Configure tab with auto-loadout ([7cb624e](https://github.com/Skillcheese/Toolasha/commit/7cb624e89db01aa0a6f43c33fa001932ef7b7631))
- make all My Listings table headers sortable ([81f1a54](https://github.com/Skillcheese/Toolasha/commit/81f1a54e5817f60c25aae4f183a7355ab2db79a2))
- overhaul skilling optimizer to show loadout-relative progression ([efb990f](https://github.com/Skillcheese/Toolasha/commit/efb990f21a67ab5de8fe80f5454987b7bb1aa810))
- prefix queue completion times with date when not today ([ebab9d2](https://github.com/Skillcheese/Toolasha/commit/ebab9d2c57590f97f5c8b1750ab2e6b28803e69e))
- show efficiency rating on combat task estimates ([d86a727](https://github.com/Skillcheese/Toolasha/commit/d86a7273c2ac186e1fa8ce335a1534f5d98a9b75))
- show tier label on guild trial tiles ([5692a3e](https://github.com/Skillcheese/Toolasha/commit/5692a3e0af918805c106cf94b5831773f73c726f))
- show unsigned trial members list in guild Trials tab ([2fc01ce](https://github.com/Skillcheese/Toolasha/commit/2fc01ceb574df0fe311a3e6a13e283f4507e3dec))
- use session-based XP/hr for combat skills ([2494e52](https://github.com/Skillcheese/Toolasha/commit/2494e52d5cea024baf55a50b12157bb4cdf02afd))

### Bug Fixes

- action panel button labels resetting to defaults on page reload ([67ad2a3](https://github.com/Skillcheese/Toolasha/commit/67ad2a3548871764bdca10591c090ce7a1c18a88))
- action time display flickering due to missing space in parsed action name ([9c158eb](https://github.com/Skillcheese/Toolasha/commit/9c158eb9156d76e9cb28f30e75518efcf6d2db48))
- add "Move to bottom" button in custom tab editor ([e47b4cb](https://github.com/Skillcheese/Toolasha/commit/e47b4cb396e80fc4ba5c119c931817765f94f904))
- add action speed & time breakdown to task profit display ([5ede675](https://github.com/Skillcheese/Toolasha/commit/5ede675adba889f15c5c624e1d1e2e2b54453252))
- add Activity column to guild Contributions tab ([7c70384](https://github.com/Skillcheese/Toolasha/commit/7c703843a88466bfeadb7321c72a274d29710539))
- add alchemy action profit to queue tooltip and action bar ([371c236](https://github.com/Skillcheese/Toolasha/commit/371c236f15584ae21316158ac16568b60429b83e))
- add clickable ask/bid column sorting to guild credit modals ([739f516](https://github.com/Skillcheese/Toolasha/commit/739f516a1516129fb99dcd2ec70ee3f8ef023ac4))
- add configurable thresholds to cap reroll protection ([1fb551c](https://github.com/Skillcheese/Toolasha/commit/1fb551c4478e4238eae13e1668f16a1c501a9343))
- add cross-slot weapon upgrade suggestions to combat advisor ([1b92f8e](https://github.com/Skillcheese/Toolasha/commit/1b92f8e12aa15ee14bc6c3f852f3f1eafbcc00cf))
- add diagnostic logging for listing N/A display bug ([f01aed3](https://github.com/Skillcheese/Toolasha/commit/f01aed3cd99054d0ea9c260f013a7b734eef68a5))
- add effective (after-tax) price display to item tooltips ([10c1cf7](https://github.com/Skillcheese/Toolasha/commit/10c1cf77eaf39234f8f4738fd1f74f4ef7d9022c))
- add expand button to abilities & triggers panel to avoid scrolling ([40e68c7](https://github.com/Skillcheese/Toolasha/commit/40e68c747267ff93cce4c6e5d1ef69eeb54741b9))
- add marketplace links to alchemy best items breakdown ([1a83a5d](https://github.com/Skillcheese/Toolasha/commit/1a83a5d74c22ebc7944a8b48d85fd1ecc858b44d))
- add marketplace navigation links to alchemy best items ([48f85ae](https://github.com/Skillcheese/Toolasha/commit/48f85aee814d2b5780d7f7a06c3746fe93087b3e))
- add missing Help channel to pop-out chat ([b497147](https://github.com/Skillcheese/Toolasha/commit/b49714755c57e2a603ee615e12b34c60e3dbc4af))
- add pricing mode toggle and XP/hr to best crafting plan ([55b1912](https://github.com/Skillcheese/Toolasha/commit/55b19126df2637cc13191640e5fc599c729862c6))
- add quick input count presets to combat action modals ([df5fe78](https://github.com/Skillcheese/Toolasha/commit/df5fe78ad596a495880851334c1363ff048df00d))
- add resizable lab sim panel and collapsible loadout section ([e1178f5](https://github.com/Skillcheese/Toolasha/commit/e1178f5d5f13942cde1d61b18ea346e0feb8de89))
- add setting to disable task speed & time breakdown ([363582e](https://github.com/Skillcheese/Toolasha/commit/363582ed1efc77350fe0645d8c52623922e4dfe3))
- add setting to hide combat estimate on task cards ([569fcdb](https://github.com/Skillcheese/Toolasha/commit/569fcdb95b00bae29f8b4f01a79ada307900a1b0))
- align move buttons in tab editor by rendering hidden placeholders ([e57d6aa](https://github.com/Skillcheese/Toolasha/commit/e57d6aa6c660f5b75d33232bd74c44e951c8962b))
- always initialize max-produceable feature regardless of setting ([a4c0198](https://github.com/Skillcheese/Toolasha/commit/a4c0198cce5bfddb875c436109c0212c1150d5fd))
- always show ×count in item tooltip price line ([17ed970](https://github.com/Skillcheese/Toolasha/commit/17ed9701e475ab6a6e481e726b8043a55d74928f))
- always show all categories in net worth chart tooltip ([9c19648](https://github.com/Skillcheese/Toolasha/commit/9c1964845ad1043b25fc3fae3fda243a5247449a))
- apply correct dungeon chest quantity formula in combat sim ([3662b7c](https://github.com/Skillcheese/Toolasha/commit/3662b7c9052a0b7fb2c074a95c0f41333bcd724e))
- apply Custom Tab drag-drop layout before debounced save ([cf80e06](https://github.com/Skillcheese/Toolasha/commit/cf80e064d42c611a8ff1c6f287e8718defb2fa95))
- bump dev dependency versions ([bdd4528](https://github.com/Skillcheese/Toolasha/commit/bdd452861d4a71d7e2c33fbb2c81300465ddcf6f))
- calculate enhancement time correctly when using Philosopher's Mirror ([60b1f2a](https://github.com/Skillcheese/Toolasha/commit/60b1f2afb672a45e556b4421342b74195139dc6c))
- calculate task gold/hr using total task time instead of time remaining ([09a6168](https://github.com/Skillcheese/Toolasha/commit/09a61687d0751dc4333a583c391977c9b4cf91ba))
- capitalize monster names and show recommended skip in lab sim results ([3a0a689](https://github.com/Skillcheese/Toolasha/commit/3a0a689b70b8d2f9a86b0d2229731e5f17379a75))
- classify defensiveDamage-only items as defensive in upgrade advisor ([3ba942c](https://github.com/Skillcheese/Toolasha/commit/3ba942c8d72ec058d5f0be723f1799b26f8bd6ad))
- clean up history buffers and observers when chat extender is disabled ([53f8ce5](https://github.com/Skillcheese/Toolasha/commit/53f8ce502491f6ebf0f21cc28af571d6ce21eb38))
- clear battle counter when switching from combat to skilling ([1047c0b](https://github.com/Skillcheese/Toolasha/commit/1047c0bbb42c55d679e0368e9d21eeb024dd0e33))
- clear history now persists across page refresh ([af9a9f1](https://github.com/Skillcheese/Toolasha/commit/af9a9f154e7b4d198aa40d530fce19e63f4d46c1))
- clear labyrinth attempt flag when entering regular combat ([6722bd8](https://github.com/Skillcheese/Toolasha/commit/6722bd8ebdf912c891454e3026ae36c670185cad))
- close remaining TLA-002 lifecycle leaks across six features ([4282b9e](https://github.com/Skillcheese/Toolasha/commit/4282b9e6dda79528766bdc210d467bfb6863f70e))
- collection tiles displaced when unfavoriting an item ([ca97fb1](https://github.com/Skillcheese/Toolasha/commit/ca97fb1aac35a11776881322ff7723aaa85fb928))
- compute upgrade advisor DPS from actual damage dealt instead of XP/hr ([cf83826](https://github.com/Skillcheese/Toolasha/commit/cf83826bc534adfb1629e9458942c3ed56ab5553))
- correct alchemy action type detection and missing level progress ([5f51513](https://github.com/Skillcheese/Toolasha/commit/5f51513185e1d4ee9a12d4808a1286bd3b27eb1c))
- correct Chance Cape (R) HRID in enhancement auto-detect ([463352d](https://github.com/Skillcheese/Toolasha/commit/463352dd74f58c24424074c470833da1e66f3e30))
- correct character isolation in settings importer (TLA-006) ([da4021f](https://github.com/Skillcheese/Toolasha/commit/da4021f4359214e3bdde146dde10e1dc951557f9))
- correct efficiency in level calculator and Total time display ([419c4c8](https://github.com/Skillcheese/Toolasha/commit/419c4c822ade9ec6c18db078373aa6eb6c245c5a))
- correct Game Mode sort misalignment and Activity hidden-status ordering ([3fc4b2a](https://github.com/Skillcheese/Toolasha/commit/3fc4b2a02fbb470edad6940f7bed66cea5e8882b))
- correct guild shrine costs and enhance protect-from race condition ([81796a1](https://github.com/Skillcheese/Toolasha/commit/81796a1be4512436b92b1868a9928062b01216b4))
- correct labyrinth combat skip recommendations and add MooPass buffs ([b44dd1b](https://github.com/Skillcheese/Toolasha/commit/b44dd1b3c7395d8f22accbe6c02b94ef41c40843))
- correct max produceable calculation for self-upgrade recipes ([9144a02](https://github.com/Skillcheese/Toolasha/commit/9144a020e7c686c2eb2d1edef96ca9d73837c8f7))
- correct onSettingChange cleanup in four additional features ([56b9c5b](https://github.com/Skillcheese/Toolasha/commit/56b9c5b310ec6fd94e6eef05e80da356d817e9a9))
- crash in \_checkBindingEnhancements when cache is nulled mid-loop ([8b2155e](https://github.com/Skillcheese/Toolasha/commit/8b2155eb13e839853fdef7dc82c1d83848dcf31f))
- decouple action speed/time section from profit detail setting ([8e3793a](https://github.com/Skillcheese/Toolasha/commit/8e3793a1ed6b8ad98182a64100086cae1221473a))
- decouple queue length estimation from listing age display setting ([41d29f4](https://github.com/Skillcheese/Toolasha/commit/41d29f403cdabd0971ed06707215b3d0f3d89fd1))
- decrement and remove shrine missing mats tabs on purchase ([2a3032a](https://github.com/Skillcheese/Toolasha/commit/2a3032a4bf13a6bb14564c208a1c8b8215632407))
- defer skilling optimizer style injection until DOM is ready ([dba550b](https://github.com/Skillcheese/Toolasha/commit/dba550ba4692b814f684c3ebf5375a5ce4f4e779))
- detect earrings and back slot in gear scanner, add per-item breakdowns ([3af542d](https://github.com/Skillcheese/Toolasha/commit/3af542d9859f95ba9e16db5c7671b58062e0bf51))
- enhancement calculator speed uses manual override params ([2d41428](https://github.com/Skillcheese/Toolasha/commit/2d4142836b60a977870c3db5cf50e82c76f3d74a))
- exclude enhanced items from inventory count and add dynamic toggle ([6103c4f](https://github.com/Skillcheese/Toolasha/commit/6103c4f01f08b3b24285eea6a4d31e742d0f74aa))
- exclude magic off-hands from melee upgrade recommendations ([9a11465](https://github.com/Skillcheese/Toolasha/commit/9a114655f1c04b126d8fd1edaa22186fb974b1ca))
- exclude new members from unsigned trial list until next reset ([d128583](https://github.com/Skillcheese/Toolasha/commit/d12858389805c8aaa66c0377e8fc5a47e38b3f9c))
- exclude out-of-stock drinks from artisan bonus calculations ([421f3db](https://github.com/Skillcheese/Toolasha/commit/421f3db9fc012ce639b0685549b6bf24442a824e))
- exclude own listings from Top Order Price/Age on My Listings ([445f2ba](https://github.com/Skillcheese/Toolasha/commit/445f2baee87866061e7ebe93cd95cc8e1c9f646e))
- give Lab Simulator its own independent setting ([33e405a](https://github.com/Skillcheese/Toolasha/commit/33e405ad21e0847564726f8ae1c4bb94b9ec699d))
- guard null price at both unguarded call sites in listing age (TLA-008) ([2452994](https://github.com/Skillcheese/Toolasha/commit/2452994dea63e413d34d7f8738e40837fc67b03b))
- handle DD/MM date format in dungeon tracker chat timestamp parser ([903c353](https://github.com/Skillcheese/Toolasha/commit/903c3534705ae182d602e377cf38ef016b40a9e9))
- hide newly registered panels that don't match active filter ([8ff33ff](https://github.com/Skillcheese/Toolasha/commit/8ff33ffccb6c8f4f8337cb23d120726946296184))
- hide pin icons on tiles when pinned actions page is disabled ([d238dc9](https://github.com/Skillcheese/Toolasha/commit/d238dc9728cf32eb98c66d40a87932d8c7fc29a9))
- hide Scroll Simulation button when setting is disabled ([58c1ef7](https://github.com/Skillcheese/Toolasha/commit/58c1ef7777b821066cf9c6e5d9db98fd3edfea6e))
- include boss spawns in Seek zone drop lookup ([593e913](https://github.com/Skillcheese/Toolasha/commit/593e913c2dc8d5f86c7339322bcc6c31a8636c02))
- include coin costs in enhancement XPH calculator metrics ([bdf146e](https://github.com/Skillcheese/Toolasha/commit/bdf146e5334d5f284c4ac46ab962fee2f1d35d4e))
- include gathering/gourmet buffs in labyrinth double progress chance ([99ef59e](https://github.com/Skillcheese/Toolasha/commit/99ef59e3b1bf85aec1bc4e3e5c378d443bba1b49))
- include guild shrine buffs in all skilling calculations ([f2b444f](https://github.com/Skillcheese/Toolasha/commit/f2b444f8bf89abd85103309ce00a55deac19cc5a))
- include guild shrine buffs in combat simulator ([667a2e7](https://github.com/Skillcheese/Toolasha/commit/667a2e7ac6548bb39227ccbc6349cf75bc8ac5b5))
- include skillingRareFind in auto-detect gear calculations ([832ee94](https://github.com/Skillcheese/Toolasha/commit/832ee94c02b25304c71517ee8010b3d038ba32d4))
- include task speed bonus in task completion time estimate ([2121c5d](https://github.com/Skillcheese/Toolasha/commit/2121c5d40219fc3abc2dad93bbfe49d2612ee39b))
- initialize order book cache before listing price display ([ffb2779](https://github.com/Skillcheese/Toolasha/commit/ffb2779e955e58a06b515cbb82c3a1a5f82ee1ae))
- keep action-bar time/icon line together on narrow screens ([96eda6a](https://github.com/Skillcheese/Toolasha/commit/96eda6af4a1975e3d7143086a535cdd5042d292d))
- keep guild Joined date on a single line ([860b373](https://github.com/Skillcheese/Toolasha/commit/860b3730dd21a7ac1aa8c142d7e8d02dca5395dc))
- key player leaderboard XP history by category to prevent cross-category contamination ([9090a6a](https://github.com/Skillcheese/Toolasha/commit/9090a6aad1cd5f787e74ee65cde9dfb312256a74))
- labyrinth recommendations allow negative thresholds and exclude tea from combat level ([0ffa5d1](https://github.com/Skillcheese/Toolasha/commit/0ffa5d11f6ec37c1a4c408fa616f7e73652732e7))
- make action panel bottom section scrollable ([9708195](https://github.com/Skillcheese/Toolasha/commit/9708195dd489e0c008eec0f707a8837e2003abf2))
- make enhancement stat breakdowns click-to-expand ([1683f25](https://github.com/Skillcheese/Toolasha/commit/1683f25a81a6b52103576effaabcd242077c5992))
- make Marketplace "Count equipped items" setting actually toggle ([1dab506](https://github.com/Skillcheese/Toolasha/commit/1dab50651af54a632d93a532b0ee53040b480c51))
- make skilling optimizer score alchemy equipment correctly ([400b148](https://github.com/Skillcheese/Toolasha/commit/400b148715a6b908bf2da8375736d92e0da6d35a))
- match enhanced items in queue by stripping +N level suffix ([11514be](https://github.com/Skillcheese/Toolasha/commit/11514beab84ae8156f7fb03dd2fe225c9f78ef8b))
- parse K/M/B suffixes in listing quantity matching ([98400c9](https://github.com/Skillcheese/Toolasha/commit/98400c92dfabc37e06f5de9cf3b2f0640c327bb6))
- persist custom tab drag/drop changes across page reload ([1d1ec72](https://github.com/Skillcheese/Toolasha/commit/1d1ec726748e63fcf7eb8f6ff37e0ce751a10e74))
- preserve alchemy target level calculator input across updates ([35d9409](https://github.com/Skillcheese/Toolasha/commit/35d9409059bff79226e0a71b0292e9a8b7e85455))
- preserve blue ocean badges when hiding guild and labyrinth badges ([5e026d8](https://github.com/Skillcheese/Toolasha/commit/5e026d8dedd84534cd5c5f407032e376912fd6d1))
- preserve queued writes across IndexedDB failures (TLA-007) ([71f9e3c](https://github.com/Skillcheese/Toolasha/commit/71f9e3c4313f4d3f6355072554ef7efa26feae7d))
- preserve scroll position when removing items in tab editor ([d7e0f39](https://github.com/Skillcheese/Toolasha/commit/d7e0f3957801d1ba99167350cd2241bd062ecef6))
- preserve target level calculator input across action completions ([a9661fa](https://github.com/Skillcheese/Toolasha/commit/a9661faa003b8d4804dbd0e96ec269a2ccdd7fea))
- prevent action filter from clearing panels registered in same mutation batch ([67a706a](https://github.com/Skillcheese/Toolasha/commit/67a706a5f5d29ded6463dec667b17e9fd0f56605))
- prevent Add to Tab dropdown from leaking document click listeners ([2682ca1](https://github.com/Skillcheese/Toolasha/commit/2682ca15a38da2fb4f19c636f4c6f947bae891e7))
- prevent Build button collapse when cumulative section is tall ([4f6b0a3](https://github.com/Skillcheese/Toolasha/commit/4f6b0a33e231650d09e998d2136cc98e11b6bfea))
- prevent claim reward button from resizing with count ([01656bc](https://github.com/Skillcheese/Toolasha/commit/01656bcaebdf18e24280eaa33dba99867d4e1be0))
- prevent combat quick input buttons from duplicating ([5cc9cf1](https://github.com/Skillcheese/Toolasha/commit/5cc9cf1a540a96e928bb0151722bb7e0612dd043))
- prevent drag listener accumulation on custom inventory tab tiles ([cae18f3](https://github.com/Skillcheese/Toolasha/commit/cae18f370b9c3045748d63fee5bdc5bd55a3facf))
- prevent orphan outside-click listeners from deferred attachment race ([9500b1b](https://github.com/Skillcheese/Toolasha/commit/9500b1b5461af1fe429f8fc6d236ad09ebe1b303))
- prevent resource accumulation on same-character resyncs ([21102e5](https://github.com/Skillcheese/Toolasha/commit/21102e52cadecad3ed582fb10201a572772bd33b))
- prevent skilling editor overlap when upgrade results display ([88b8a54](https://github.com/Skillcheese/Toolasha/commit/88b8a54b49cbd460ffd025565d6d5f0b712b4827))
- prevent stat line text from briefly shrinking during tab switch ([60b2e03](https://github.com/Skillcheese/Toolasha/commit/60b2e039ff073bb145cfa934b24c858cb7eafd1b))
- pull skilling loadouts from game lab automation settings ([b212e47](https://github.com/Skillcheese/Toolasha/commit/b212e473cae738556286a228296ad66e684e4eb7))
- re-sync action panel marginBottom after layout and tab changes ([c9b9644](https://github.com/Skillcheese/Toolasha/commit/c9b964408d8d5d549e4bdeea35b67c81f34b52b4))
- rebuild equipment section when skill changes in simulator ([fd2d06a](https://github.com/Skillcheese/Toolasha/commit/fd2d06a2a9425900f3daf405a3071ffaad0e8778))
- recognize short numeric character IDs during settings import ([4659c45](https://github.com/Skillcheese/Toolasha/commit/4659c455c2fce56364d4911c126dda5341a80155))
- recommend tooltip now reflects actual target rate used ([e063be5](https://github.com/Skillcheese/Toolasha/commit/e063be51cf4f8ec8ac6576889754823e1bf6f358))
- recover WebSocket hook when primary interception fails ([bd538c2](https://github.com/Skillcheese/Toolasha/commit/bd538c29b2c408025b313c3695b3353a44c968ce))
- refresh action-bar profit when pricing mode changes ([4976742](https://github.com/Skillcheese/Toolasha/commit/4976742fa86d7baade06425c4e58050a1adaf1a5))
- refresh production profit UI when drinks or equipment change ([e254edf](https://github.com/Skillcheese/Toolasha/commit/e254edf9983ecd94132b6a320a9d109cee741658))
- register production panels with sort manager when pinned page is off ([f79a20c](https://github.com/Skillcheese/Toolasha/commit/f79a20c5c55c0e09101069f6957f8b1f10eee3b3))
- register skillingOptimizer in config features map ([dc53b94](https://github.com/Skillcheese/Toolasha/commit/dc53b94f8bc969df00de090106b3fa95452001f4))
- relocate Activity column and correct per-tab placement ([209577e](https://github.com/Skillcheese/Toolasha/commit/209577e215924f00789ce03518322c00524a1522))
- remove document listeners when transient modals and popups close ([cf5314a](https://github.com/Skillcheese/Toolasha/commit/cf5314ac8b7f01be96adc4640ecf31d7c777a4ea))
- remove duplicate character_switching listener from chat-commands ([df80f51](https://github.com/Skillcheese/Toolasha/commit/df80f511e9a0c624fe02977bbec3020fb7e6e0d4))
- remove duplicate parsePrice that discarded B suffix (TLA-008) ([ee4eed7](https://github.com/Skillcheese/Toolasha/commit/ee4eed74a609bb2e73d7ce0c22ca092b2a4302ea))
- remove parentheses from trial tier badge to prevent line wrap ([4f9f484](https://github.com/Skillcheese/Toolasha/commit/4f9f4848b9ef1cd3de025d4a0dae58af7a7b9a4a))
- remove stale Rec badge when skip threshold is edited ([e2d5ad6](https://github.com/Skillcheese/Toolasha/commit/e2d5ad68d880a5cec4ee0c10192c096343844c68))
- remove task card min-height style when reroll tracker is disabled ([2d3a2b0](https://github.com/Skillcheese/Toolasha/commit/2d3a2b0759ccda9cd8d3a83d2bb983d35f7d6850))
- remove WebSocket prototype addEventListener/onmessage wrapping ([5824eca](https://github.com/Skillcheese/Toolasha/commit/5824ecad6c7d1f85f26c46960b17ac66a2fb9d24))
- replace unbounded debounce array with O(1) latest-value retention ([e9ef830](https://github.com/Skillcheese/Toolasha/commit/e9ef83020e90f5bb991e094e7008023750a7b47f))
- replace undefined SCRIPT_COLOR_PRIMARY/SECONDARY references (TLA-009) ([4135ecc](https://github.com/Skillcheese/Toolasha/commit/4135eccf11b4b76056f122a62b301dccf4d2b6d9))
- resolve [Unknown action] for items with mismatched display name and HRID ([3190702](https://github.com/Skillcheese/Toolasha/commit/3190702ce5c704b94c3face20a1ad1a0c0d32137))
- resolve enhancement levels from all owned items in combat loadout ([e9d52ad](https://github.com/Skillcheese/Toolasha/commit/e9d52ad0308ef026338857974215a34379684ecd))
- resolve hanging Promises from debounced storage writes ([8ed8cc9](https://github.com/Skillcheese/Toolasha/commit/8ed8cc91996fc705eec24f665dd1a1ccb9e6b2cd))
- respect "Use highest enhancement level" setting in custom tab auto-sync ([da843dd](https://github.com/Skillcheese/Toolasha/commit/da843dd6acbd5e60741f2aa654c2e4706eb6917c))
- respect 24-hour time format setting in action completion times ([1323558](https://github.com/Skillcheese/Toolasha/commit/1323558f413f5b279c53d01c8b348357f4178994))
- restore click-to-view-details on comparison scenario rows ([f74420c](https://github.com/Skillcheese/Toolasha/commit/f74420ccf64eafdb9279903804d73040b4f75127))
- restore original package-lock.json ([5692f01](https://github.com/Skillcheese/Toolasha/commit/5692f01b8a615bd32dd7347ed2ff720980947f06))
- restore year on guild Joined column ([ba2b5e1](https://github.com/Skillcheese/Toolasha/commit/ba2b5e172ebfde77b69c5cc81dd53b89698b810c))
- return defaultValue from storage.get when stored value is null ([7e5ce1e](https://github.com/Skillcheese/Toolasha/commit/7e5ce1eb0ceff763a5c92cf545e6ca29dfd4c6b9))
- revert markdownlint-cli/terser bump that broke npm ci ([5d9aa11](https://github.com/Skillcheese/Toolasha/commit/5d9aa11d954d3dad62af868f3a0e12f2c0979caa))
- separate melee damage styles in upgrade tier progression ([f303d2e](https://github.com/Skillcheese/Toolasha/commit/f303d2e788c141316e1632e899a9ed63db814363))
- show ask total in tooltip even when bid is missing ([b74a82c](https://github.com/Skillcheese/Toolasha/commit/b74a82c02ee1825759ad77e101eef08ceb066104))
- show drink timer on Alchemy and Enhancing panels ([2a3c25e](https://github.com/Skillcheese/Toolasha/commit/2a3c25e467c4e63255ce158c91ec56155db2579d))
- show expandable speed breakdown on tasks without profit enabled ([7b71d99](https://github.com/Skillcheese/Toolasha/commit/7b71d9953a1d8bdf819315cc1b0df04918d215f0))
- show expected time for repeat-∞ enhancement queue actions ([ab3f26f](https://github.com/Skillcheese/Toolasha/commit/ab3f26f04869ac67d91c5afdcc4efd5815208d74))
- show guild shrine buffs in action breakdown displays ([93e47fc](https://github.com/Skillcheese/Toolasha/commit/93e47fc268ddd4a5f3219daf2c0b3ea2deccb782))
- show labyrinth attempt number in battle counter ([5cbbcf3](https://github.com/Skillcheese/Toolasha/commit/5cbbcf30160e9d23d8fdb5ca6f2a0d26c4ef47ca))
- show MooPass wisdom line in XP bonus breakdown ([95d5146](https://github.com/Skillcheese/Toolasha/commit/95d5146a1e286a49671a949fe5593292a1f598cb))
- show remaining/total time in live countdown timer ([1606675](https://github.com/Skillcheese/Toolasha/commit/160667521e33da4b60912e6c53f8b3cf2355ecee))
- show top-3 conversion options in shrine upgrade cost table ([17eb9f4](https://github.com/Skillcheese/Toolasha/commit/17eb9f4705270581507085af8c334938b100e98a))
- skip battle counter injection when no active combat action ([46db6ec](https://github.com/Skillcheese/Toolasha/commit/46db6ecae50f76260dd2149525189b2dbe75e794))
- skip sort registration in max-produceable for gathering panels ([afbaa9a](https://github.com/Skillcheese/Toolasha/commit/afbaa9a60d58815b929a640ea5746afa383f13c7))
- sort loadout dropdowns by server ordinal ([acfca19](https://github.com/Skillcheese/Toolasha/commit/acfca19dd0a4227a2bc39bbad57afaa4d24d3264))
- sort upgrade tables by cost efficiency and skip irrelevant slots ([1b4a4b8](https://github.com/Skillcheese/Toolasha/commit/1b4a4b88441aa60d18238f21d4fa04a3b6749365))
- sort Weekly XP column numerically with K/M suffix support ([6687524](https://github.com/Skillcheese/Toolasha/commit/66875241f18e849289c65e47e2ef8906fe23cef7))
- stabilize task card heights and fix task reroll tracker display ([7c6aa23](https://github.com/Skillcheese/Toolasha/commit/7c6aa230b9a906c4163e39886974a60bf78dbd5d))
- stop stale Attempt #N label from leaking into regular combat ([a85b867](https://github.com/Skillcheese/Toolasha/commit/a85b867cf0201e44cf065d3be5247443520581c8))
- surface refined weapon as upgrade for offensive items ([4595d1c](https://github.com/Skillcheese/Toolasha/commit/4595d1cf79d154f935ae151884ad922be670c5e6))
- surface T95 tier jumps and style-matched off-hands in upgrade advisor ([f31dbc1](https://github.com/Skillcheese/Toolasha/commit/f31dbc1f10f73d84b29e66f47343cde8d0d0d294))
- sync per-loadout Custom Tab binding independently of mixed exact mode ([36f07d1](https://github.com/Skillcheese/Toolasha/commit/36f07d1ced4b92d4a06489dffa84f20b02620b09))
- sync pop-out chat channel list with visible game tabs ([f03fd2b](https://github.com/Skillcheese/Toolasha/commit/f03fd2bd0111025d9dc9524d1310c2d08fcc9044))
- sync recommend inputs with saved settings on re-inject ([6e1ec07](https://github.com/Skillcheese/Toolasha/commit/6e1ec0777e61328e21d550dc9cf394d72609c2da))
- sync Settings UI disabled state and checkboxWithButton after All Off ([424bca0](https://github.com/Skillcheese/Toolasha/commit/424bca018f554ca1cd0cf75d9f5b365a2adf0e84))
- unify action panel into a single scroll container ([1139933](https://github.com/Skillcheese/Toolasha/commit/1139933f0e218e21cfdd0180fc7228f1289ea21e))
- update market item counts when inventory changes ([c460c9c](https://github.com/Skillcheese/Toolasha/commit/c460c9c44cb0a469dce5846563d72e2f9fe46e81))
- use 2-digit year in formatDateTime to keep guild Joined column on one line ([ced1d5c](https://github.com/Skillcheese/Toolasha/commit/ced1d5c52ee50e502d3de60cd7878702f6bd4ae6))
- use approximate quantity matching for K/M/B abbreviated listings ([2bb092e](https://github.com/Skillcheese/Toolasha/commit/2bb092e86d0db816eca4680f586cabe50c6af9a8))
- use base + tea crate only for labyrinth room-assignment effective level ([832da33](https://github.com/Skillcheese/Toolasha/commit/832da336fab14fddbe91f6b8b5dda1ebb79354f8))
- use correct config method for labyrinth number settings ([94b0802](https://github.com/Skillcheese/Toolasha/commit/94b08028b1351a5ae3b8dd8184e14dcb587b564e))
- use DOM observer for chat commands input attachment ([a7a120b](https://github.com/Skillcheese/Toolasha/commit/a7a120b84af9e25c3e027e91d9ca2cd5aeea90f0))
- use full zone data for boss task sim estimates ([8794215](https://github.com/Skillcheese/Toolasha/commit/8794215ab14b5b9cb66322d36ac389f051b865d3))
- use handleChangeNavTarget for enhancement return navigation ([0e8e6b8](https://github.com/Skillcheese/Toolasha/commit/0e8e6b8d9918e3f24b4ab6458a618af0062ab635))
- use inline-flex to force action-bar time line to one row ([e4b6260](https://github.com/Skillcheese/Toolasha/commit/e4b62603fe1bc58525065227f205f2faf7f836cb))
- use labyrinth loadout equipment for skilling clear rate ([a220eb9](https://github.com/Skillcheese/Toolasha/commit/a220eb998fbaa00f75dca567bff0461752685dcc))
- use live networth for rate/hr calculation instead of last snapshot ([ef61b79](https://github.com/Skillcheese/Toolasha/commit/ef61b79ee40c3e8f3764b392a40f1896a4fb63d4))
- use matchCurrentActionFromText for queue ETA current action detection ([993bbd1](https://github.com/Skillcheese/Toolasha/commit/993bbd1247c1b87469e8d67d73b0670c92535b3e))
- use profit as secondary sort when sorting Best Items by XP, and vice versa ([bb6b66e](https://github.com/Skillcheese/Toolasha/commit/bb6b66e83ce6b9be1f36cc0f2d0570c669cf166b))
- use refined item costs for mirror path instead of non-refined base item ([9dd1941](https://github.com/Skillcheese/Toolasha/commit/9dd1941bebad166edf33cdafe008fe9c5c143cbc))
- use ResizeObserver to sync stats layout on hidden→visible tab switches ([84d29fd](https://github.com/Skillcheese/Toolasha/commit/84d29fd7b4cf9df0d95bb6b00d6bec5f9ef2b403))
- use saved loadout snapshot for XP, time, and material predictions ([1722782](https://github.com/Skillcheese/Toolasha/commit/17227821b0f0eac052ae513baecadc705bfc2f82))
- wire combatStats setting to feature gate ([5f63226](https://github.com/Skillcheese/Toolasha/commit/5f63226220a71d02b8ce5bb1ac959eefa3c01939))

### Code Refactoring

- remove skilling buff candidates from combat upgrade analysis ([5446f6a](https://github.com/Skillcheese/Toolasha/commit/5446f6a451eddc6209352011928f7adf0901b67a))
- reorganize settings into 25 focused groups ([3117c91](https://github.com/Skillcheese/Toolasha/commit/3117c910ed6ea70071da9ba49716763413ffba73))
- split leaderboard XP tracking into independent feature ([4d2fc58](https://github.com/Skillcheese/Toolasha/commit/4d2fc58defa8dbe45fe067ea449be39117d828dd))
- split profit/hr and exp/hr tile settings by action type ([6b6d533](https://github.com/Skillcheese/Toolasha/commit/6b6d533d203822fa16245bbb42568dc5ed1273df))
- unify date/time and number formatting across all features ([a4a609e](https://github.com/Skillcheese/Toolasha/commit/a4a609ea25674412a3c1bf7bdceffe6dbbb2ffa3))

### Performance Improvements

- also gate badge fallback enhancement-cost calc on networth feature ([9d62d61](https://github.com/Skillcheese/Toolasha/commit/9d62d614a5e71aedc7de18e377e5a2ebdcf6389b))
- make combatStats and chatCommands initialize non-blocking ([304b742](https://github.com/Skillcheese/Toolasha/commit/304b742e9935fafe1beef07055d825cca02eda22))
- skip enhancement-cost badge calc when networth is disabled ([e95445f](https://github.com/Skillcheese/Toolasha/commit/e95445f6dfe19b5e9c3d0fac63bd0a0a74202bca))
- use immediate writes for login-time storage snapshots ([18db361](https://github.com/Skillcheese/Toolasha/commit/18db36182633bee222481c7eeca2590d049ea6bc))

### Documentation

- clarify networth setting labels to match actual behavior ([eb833aa](https://github.com/Skillcheese/Toolasha/commit/eb833aaaa3dddefc094b039396fa4e21aa41647e))

### Tests

- add source-scan guard for forbidden config color names (TLA-009) ([0be2418](https://github.com/Skillcheese/Toolasha/commit/0be2418c77b04b2108368bea4593af0ad8723881))

### Continuous Integration

- run format workflow on bot pushes to release-please PRs ([eed699d](https://github.com/Skillcheese/Toolasha/commit/eed699dcbeece9c6bef6104e5c9748fa2816fc66))

### Miscellaneous Chores

- add diagnostics for custom tab items disappearing on auto-switch ([885d42b](https://github.com/Skillcheese/Toolasha/commit/885d42b6ded0d978d2629136dc1d10be5a6d33b7))
- add Paradoxian to userscript header acknowledgements ([16378aa](https://github.com/Skillcheese/Toolasha/commit/16378aa3e35fbeca556636e1a7537c2e19ed2000))
- display version number in settings tab title ([c3128f6](https://github.com/Skillcheese/Toolasha/commit/c3128f649d05dc55f65a0d490e4a77ed6afececc))
- format release notes ([38444c6](https://github.com/Skillcheese/Toolasha/commit/38444c65a6185dd42824b6388baa0ec41b7f284f))
- **main:** release 2.56.0 ([90355a6](https://github.com/Skillcheese/Toolasha/commit/90355a641ffe74da0a759525b88387bb78a3209d))
- **main:** release 2.57.0 ([fcf1eb4](https://github.com/Skillcheese/Toolasha/commit/fcf1eb48d8748ca893715e58d6c31a6e1982b8af))
- **main:** release 2.57.0 ([18624e9](https://github.com/Skillcheese/Toolasha/commit/18624e92b2ded25d14c69731a68257a2d86cc7b5))
- **main:** release 2.57.1 ([186fbce](https://github.com/Skillcheese/Toolasha/commit/186fbce9259f1ba5efef43e9a3e025dbfc9b1b1d))
- **main:** release 2.57.1 ([cd7cd47](https://github.com/Skillcheese/Toolasha/commit/cd7cd4789434cb8a268f9f288c16167c8597d499))
- **main:** release 2.58.0 ([33b474a](https://github.com/Skillcheese/Toolasha/commit/33b474a1431710eaa2c1463a1b1dfc7c68a38f49))
- **main:** release 2.58.0 ([76dffad](https://github.com/Skillcheese/Toolasha/commit/76dffadaced17f909bfd0938e70dabb9a3f69038))
- **main:** release 2.58.1 ([feccf69](https://github.com/Skillcheese/Toolasha/commit/feccf698fc88dc8ea3b2d2dd3369472e6af7fc61))
- **main:** release 2.58.1 ([d2b7372](https://github.com/Skillcheese/Toolasha/commit/d2b73723048e745e61bfdccfe48bc09e508a0647))
- **main:** release 2.58.2 ([14d6a2c](https://github.com/Skillcheese/Toolasha/commit/14d6a2cdc3f6a13b67ef72aff3c2e752cae7aa28))
- **main:** release 2.58.2 ([530a7fe](https://github.com/Skillcheese/Toolasha/commit/530a7fe521460a422039833f997cd8adf67cca3c))
- **main:** release 2.58.3 ([3ec930c](https://github.com/Skillcheese/Toolasha/commit/3ec930c66d1acdb17e159f71a7ef235b822e717d))
- **main:** release 2.58.3 ([a927d5f](https://github.com/Skillcheese/Toolasha/commit/a927d5f15663e6f3d72078326276f9d7bcb367f8))
- **main:** release 2.58.4 ([4de2889](https://github.com/Skillcheese/Toolasha/commit/4de2889c9efb107664683c1c43fab53d77f6870d))
- **main:** release 2.58.4 ([3114474](https://github.com/Skillcheese/Toolasha/commit/31144744a2156b5c78dcea6c2d1396b9b546cf2d))
- **main:** release 2.58.5 ([e57af85](https://github.com/Skillcheese/Toolasha/commit/e57af856b7805784071a58270d8ed0c90596f0b7))
- **main:** release 2.58.5 ([d71e647](https://github.com/Skillcheese/Toolasha/commit/d71e6472718e730997e7cc6c58bd35dd1777dd48))
- **main:** release 2.59.0 ([f0ce462](https://github.com/Skillcheese/Toolasha/commit/f0ce4629a0ec9ac1e67f781e3d95585571045f16))
- **main:** release 2.59.0 ([e102cbf](https://github.com/Skillcheese/Toolasha/commit/e102cbf8b08922d560de8190991d8ca7c15e0b85))
- **main:** release 2.59.1 ([e78f8ad](https://github.com/Skillcheese/Toolasha/commit/e78f8adf46e2d3486b7ef7d32be76cb16d5b70d1))
- **main:** release 2.59.1 ([8052a19](https://github.com/Skillcheese/Toolasha/commit/8052a19fd50a42e5e75b920941abf38358a56848))
- **main:** release 2.59.2 ([cc52fb5](https://github.com/Skillcheese/Toolasha/commit/cc52fb51db5bed2e44fa42baf07f9e0a1f4eb040))
- **main:** release 2.59.2 ([07b11ae](https://github.com/Skillcheese/Toolasha/commit/07b11ae2c7f492e978d45d5941d1ddb2bcdf5497))
- **main:** release 2.59.3 ([ac430f2](https://github.com/Skillcheese/Toolasha/commit/ac430f25d46f62a9883fae67618fc9e8ba9710ab))
- **main:** release 2.59.3 ([e20728f](https://github.com/Skillcheese/Toolasha/commit/e20728fc4cbbdb61b40948fa30f881312e5fc680))
- **main:** release 2.59.4 ([e486757](https://github.com/Skillcheese/Toolasha/commit/e4867574b2124e5951fcb7bbba0a52fbc9701391))
- **main:** release 2.59.4 ([13596b0](https://github.com/Skillcheese/Toolasha/commit/13596b0aee9f8e08e551c01ebb7c4ca9776cb7a3))
- **main:** release 2.59.5 ([16b7b59](https://github.com/Skillcheese/Toolasha/commit/16b7b595b49acc7d848b22f3140ca31c55998a59))
- **main:** release 2.59.5 ([99bf070](https://github.com/Skillcheese/Toolasha/commit/99bf070467b8e9183995b127a2ce4295825cc6c9))
- **main:** release 2.60.0 ([8b1bda2](https://github.com/Skillcheese/Toolasha/commit/8b1bda2fd86379da089e4cf33e8807eea088e07c))
- **main:** release 2.60.0 ([9bf3b91](https://github.com/Skillcheese/Toolasha/commit/9bf3b9187e4efa4261e6c66fb2bded0f4b8b750d))
- **main:** release 2.61.0 ([b561ceb](https://github.com/Skillcheese/Toolasha/commit/b561ceb32afac92adfb0dd75d37d976ea4691fec))
- **main:** release 2.61.0 ([7c5a604](https://github.com/Skillcheese/Toolasha/commit/7c5a604b8bf7b31c3be81ab0876c66ab2cade511))
- **main:** release 2.61.1 ([cac3150](https://github.com/Skillcheese/Toolasha/commit/cac31501fc3ed79aa61009ba4a9e1f5e22cc0402))
- **main:** release 2.61.1 ([ec571a5](https://github.com/Skillcheese/Toolasha/commit/ec571a55c179b1fa7c4e077df2337cca1f941794))
- **main:** release 2.61.2 ([b7ba4d8](https://github.com/Skillcheese/Toolasha/commit/b7ba4d8d11a9559f6a1e6b04540319ca7d58c9a9))
- **main:** release 2.61.2 ([2432262](https://github.com/Skillcheese/Toolasha/commit/2432262b6fd65e208ac82a8832f31f75abb0003d))
- **main:** release 2.61.3 ([f2dbb1b](https://github.com/Skillcheese/Toolasha/commit/f2dbb1be322edfe1e0265774c6e2a915972f8335))
- **main:** release 2.61.3 ([38ee22d](https://github.com/Skillcheese/Toolasha/commit/38ee22dc19f52a08024ede3872fbde95aad652b9))
- **main:** release 2.61.4 ([7255ac8](https://github.com/Skillcheese/Toolasha/commit/7255ac8129cde7e3c84cdec76fa8f1206586fa63))
- **main:** release 2.61.4 ([d7c3920](https://github.com/Skillcheese/Toolasha/commit/d7c3920b36d81dc6715c6e672100a3aaeaa2e502))
- **main:** release 2.61.5 ([e7deb6c](https://github.com/Skillcheese/Toolasha/commit/e7deb6c703d45f72c324c185138f4093c3f2727a))
- **main:** release 2.61.5 ([2fe92ac](https://github.com/Skillcheese/Toolasha/commit/2fe92ac6359103583f8617b1e123f0569327d4d0))
- **main:** release 2.62.0 ([3e920d5](https://github.com/Skillcheese/Toolasha/commit/3e920d555e8e4bae893e33d2b929dc05fa2d50d0))
- **main:** release 2.62.0 ([4d4a5b8](https://github.com/Skillcheese/Toolasha/commit/4d4a5b89dddcbe8d385901a33eae0b2281cfc4d0))
- **main:** release 2.62.1 ([cc4b89b](https://github.com/Skillcheese/Toolasha/commit/cc4b89bd4e4454e11535dbad46037e6c4e3e7c08))
- **main:** release 2.62.1 ([a506b8a](https://github.com/Skillcheese/Toolasha/commit/a506b8a5cf15fc19c4bbbc813b231d7bb17ef01e))
- **main:** release 2.62.10 ([ba8eb57](https://github.com/Skillcheese/Toolasha/commit/ba8eb57d2c8b0e4935f6d13d5463534195d389bb))
- **main:** release 2.62.10 ([0eb23b0](https://github.com/Skillcheese/Toolasha/commit/0eb23b0911fe082324f42d69c49b03ce0740d2d4))
- **main:** release 2.62.11 ([90e4b70](https://github.com/Skillcheese/Toolasha/commit/90e4b70a07c8f18db0e55581438bffcb90ff15fe))
- **main:** release 2.62.11 ([5a50a3c](https://github.com/Skillcheese/Toolasha/commit/5a50a3c30fab2ccae320b4484c7b48537d3f15c2))
- **main:** release 2.62.12 ([724964f](https://github.com/Skillcheese/Toolasha/commit/724964f6257d706c6c485293d09b7e5759a4db89))
- **main:** release 2.62.12 ([e292d29](https://github.com/Skillcheese/Toolasha/commit/e292d298726f8152e1d1a3d5e71a661e1edc00a8))
- **main:** release 2.62.13 ([950a2e3](https://github.com/Skillcheese/Toolasha/commit/950a2e34297cdde7dc72d510cded5414c947c5c6))
- **main:** release 2.62.13 ([82f1b36](https://github.com/Skillcheese/Toolasha/commit/82f1b36487f959d878c757c777af87e544a12ebc))
- **main:** release 2.62.14 ([b8c1cdc](https://github.com/Skillcheese/Toolasha/commit/b8c1cdc8941b28b5a88cf3fd9d866e2ac9c149d5))
- **main:** release 2.62.14 ([0e81238](https://github.com/Skillcheese/Toolasha/commit/0e812380de7eb244d2c0eec25d5e5fa4670c5af1))
- **main:** release 2.62.2 ([38838bc](https://github.com/Skillcheese/Toolasha/commit/38838bc900ef2d3d9b60fee25b17a0fd918663a8))
- **main:** release 2.62.2 ([16f4250](https://github.com/Skillcheese/Toolasha/commit/16f4250f2ecd1a24f9dbf5c6d52e863a09882886))
- **main:** release 2.62.3 ([2325215](https://github.com/Skillcheese/Toolasha/commit/23252152075ee0fd5442c11576460b956cfe2f51))
- **main:** release 2.62.3 ([c6592ff](https://github.com/Skillcheese/Toolasha/commit/c6592ffb61850b7c4d2dfd470e85f8de4eb3138b))
- **main:** release 2.62.4 ([95fa78c](https://github.com/Skillcheese/Toolasha/commit/95fa78c0c0c0aa668c3c4c21af89742043b4efa3))
- **main:** release 2.62.4 ([35425bb](https://github.com/Skillcheese/Toolasha/commit/35425bbf2f6a6f61c12fb9285ee336dda543d254))
- **main:** release 2.62.5 ([8a1484f](https://github.com/Skillcheese/Toolasha/commit/8a1484fd045b79ad4b44bb4c7e24bac592094026))
- **main:** release 2.62.5 ([767a70b](https://github.com/Skillcheese/Toolasha/commit/767a70b4b853edbf00f39bc612edbc64ccca98cf))
- **main:** release 2.62.6 ([f529d7e](https://github.com/Skillcheese/Toolasha/commit/f529d7edb9c6b6c3f9461d36ea36abd6ea15100c))
- **main:** release 2.62.6 ([0f12df4](https://github.com/Skillcheese/Toolasha/commit/0f12df4f9bae3aa7db413e9a9404fefd6833600d))
- **main:** release 2.62.7 ([31709cc](https://github.com/Skillcheese/Toolasha/commit/31709cc8d21cb9f597a3836e5f071797b15e7b78))
- **main:** release 2.62.7 ([7427b42](https://github.com/Skillcheese/Toolasha/commit/7427b429bf1912b8b7d6fba7d15f8073af77172b))
- **main:** release 2.62.8 ([1d439fc](https://github.com/Skillcheese/Toolasha/commit/1d439fc3245680b340c7c9b5e90e9f47221a5634))
- **main:** release 2.62.8 ([225fad6](https://github.com/Skillcheese/Toolasha/commit/225fad6b84f79fc9a0f912052cfa26f008300029))
- **main:** release 2.62.9 ([e4a005f](https://github.com/Skillcheese/Toolasha/commit/e4a005f7d5820e56d38ebcf4e73ec518510674de))
- **main:** release 2.62.9 ([b45b48d](https://github.com/Skillcheese/Toolasha/commit/b45b48d8001a5def8613d3cddd68d8df55b4fe05))
- **main:** release 2.63.0 ([d212223](https://github.com/Skillcheese/Toolasha/commit/d212223009bff27141ac67b293f2ebb28bc055ea))
- **main:** release 2.63.0 ([fa9ef2c](https://github.com/Skillcheese/Toolasha/commit/fa9ef2c654217361966e77307cce7bdb24513a0c))
- **main:** release 2.64.0 ([24fe5a2](https://github.com/Skillcheese/Toolasha/commit/24fe5a297307265e5fe898720023af6eed2bf9d1))
- **main:** release 2.64.0 ([3c98946](https://github.com/Skillcheese/Toolasha/commit/3c989468efed9abf03f2a7ab7123ed50e55d6b43))
- **main:** release 2.64.1 ([0bd4e64](https://github.com/Skillcheese/Toolasha/commit/0bd4e6454aa1cba9be0f6c5d87da837f0324c144))
- **main:** release 2.64.1 ([6928ec1](https://github.com/Skillcheese/Toolasha/commit/6928ec1755eeb93c48805b8a0403a53469cd441e))
- **main:** release 2.64.2 ([ffd60de](https://github.com/Skillcheese/Toolasha/commit/ffd60de073f4c28326604e1554a31694fc286375))
- **main:** release 2.64.2 ([87dae54](https://github.com/Skillcheese/Toolasha/commit/87dae548c78ca6777cdfef6d2b7e23ef405f1bf9))
- **main:** release 2.64.3 ([f9d1b3a](https://github.com/Skillcheese/Toolasha/commit/f9d1b3a5a7a4a5c5f81575fffef5e547d52f3c62))
- **main:** release 2.64.3 ([8abf904](https://github.com/Skillcheese/Toolasha/commit/8abf9049dc8fe1f12e92ce845628a4f2cd67e8bc))
- **main:** release 2.64.4 ([bd6fc21](https://github.com/Skillcheese/Toolasha/commit/bd6fc21b451a8012df7d00b060630381ce4c2c97))
- **main:** release 2.64.4 ([5cd1397](https://github.com/Skillcheese/Toolasha/commit/5cd13978f7235dbc93081e422e4e5efe57622387))
- **main:** release 2.64.5 ([7ff3b10](https://github.com/Skillcheese/Toolasha/commit/7ff3b109a397a238638b2908f28ec36ba825d2e7))
- **main:** release 2.64.5 ([465cac2](https://github.com/Skillcheese/Toolasha/commit/465cac226e39e8c4638201bd9aef136fc65e9fd3))
- **main:** release 2.65.0 ([e8b53c7](https://github.com/Skillcheese/Toolasha/commit/e8b53c7998756d3b70e931440266ce19f73d5154))
- **main:** release 2.65.0 ([b73d995](https://github.com/Skillcheese/Toolasha/commit/b73d99544c9bc6be08eff0b7b854ae612c0759f9))
- **main:** release 2.66.0 ([ddb6353](https://github.com/Skillcheese/Toolasha/commit/ddb63535c899af81f2c3128e29e9a0fc0a8d91a8))
- **main:** release 2.66.0 ([0dd53ce](https://github.com/Skillcheese/Toolasha/commit/0dd53cec24cac58c9962696f28ac734ddfe545a5))
- **main:** release 2.67.0 ([e0ef933](https://github.com/Skillcheese/Toolasha/commit/e0ef933cc5b5aba9e1b8d7a0c511b1d207a78861))
- **main:** release 2.67.0 ([ce0817f](https://github.com/Skillcheese/Toolasha/commit/ce0817f0b2cecc2b2c638e0c979fa24ced9686a1))
- **main:** release 2.67.1 ([b6cc809](https://github.com/Skillcheese/Toolasha/commit/b6cc809e9092c3330148c8e0dfaa4f0823367855))
- **main:** release 2.67.1 ([2f841d2](https://github.com/Skillcheese/Toolasha/commit/2f841d29167aab0132fdfdd6694087fe7791a9d1))
- **main:** release 2.67.2 ([ff1ebdc](https://github.com/Skillcheese/Toolasha/commit/ff1ebdc9fd89270a7e60487a896bf506cd661928))
- **main:** release 2.67.2 ([bb1e955](https://github.com/Skillcheese/Toolasha/commit/bb1e955f22739ca9d06ca67a63ec68856487fb7e))
- **main:** release 2.67.3 ([99a9953](https://github.com/Skillcheese/Toolasha/commit/99a9953eb7bbe7f1eca9936f3d2e402b1c1c4b66))
- **main:** release 2.67.3 ([c46b15c](https://github.com/Skillcheese/Toolasha/commit/c46b15c1a9d2d19fe5dc9e8d28550e1b5b282be9))
- **main:** release 2.67.4 ([a5566ae](https://github.com/Skillcheese/Toolasha/commit/a5566aec6ff29ac88dbea3b706cf203838c2569f))
- **main:** release 2.67.4 ([eb6840c](https://github.com/Skillcheese/Toolasha/commit/eb6840c7a6bedabc51f16e18a532bfa238fb69d1))
- **main:** release 2.67.5 ([e6cfaf4](https://github.com/Skillcheese/Toolasha/commit/e6cfaf4c2938eb209cca5f8dd82a9bfed0c9428e))
- **main:** release 2.67.5 ([8c73ceb](https://github.com/Skillcheese/Toolasha/commit/8c73ceb41d84eb7645d74dc2a59a9a1fc33e7347))
- **main:** release 2.67.6 ([aae8b9a](https://github.com/Skillcheese/Toolasha/commit/aae8b9a796e464c5102fb8ccf3b0185540447c94))
- **main:** release 2.67.6 ([0a70c07](https://github.com/Skillcheese/Toolasha/commit/0a70c0773905d03ac90cc09e4fc2974844b3dce1))
- **main:** release 2.67.7 ([b570a91](https://github.com/Skillcheese/Toolasha/commit/b570a9138bdf5a8bbc7a7c9e9727f90972d2e636))
- **main:** release 2.67.7 ([d555d99](https://github.com/Skillcheese/Toolasha/commit/d555d998e1dd51d2a9db9246226f8a2e4d7ce881))
- **main:** release 2.68.0 ([d0a22a1](https://github.com/Skillcheese/Toolasha/commit/d0a22a1a484b17fd430b8c2481816aec127bee89))
- **main:** release 2.68.0 ([49dc233](https://github.com/Skillcheese/Toolasha/commit/49dc233f2b8ebd202ad3f9a623df44acd5bd812d))
- **main:** release 2.68.1 ([5bd259d](https://github.com/Skillcheese/Toolasha/commit/5bd259d47d1e1051573f038c8df6e7b465c7d46c))
- **main:** release 2.68.1 ([2b6f4ea](https://github.com/Skillcheese/Toolasha/commit/2b6f4ea0eab939fcb78b7d219af12ca1a0205c0e))
- **main:** release 2.69.0 ([ec7f8e5](https://github.com/Skillcheese/Toolasha/commit/ec7f8e54f02562e9545383e714aacb563a0005d2))
- **main:** release 2.69.0 ([6de5853](https://github.com/Skillcheese/Toolasha/commit/6de585374cd0b59d3ceee4a9a0bd4dcdb44ec0d8))
- **main:** release 2.69.1 ([3591cbf](https://github.com/Skillcheese/Toolasha/commit/3591cbf3dde637b5d0978e000bfdaa417652669b))
- **main:** release 2.69.1 ([18cc463](https://github.com/Skillcheese/Toolasha/commit/18cc463f2421cc43b5e3d76e0bc1ab349f8088e5))
- **main:** release 2.69.2 ([66305a4](https://github.com/Skillcheese/Toolasha/commit/66305a4d187326b18b51c88ad3e1ff98aa65ddbc))
- **main:** release 2.69.2 ([469a1ea](https://github.com/Skillcheese/Toolasha/commit/469a1eaa1f82817fd4f7a602b3f1c8d7ac6df779))
- **main:** release 2.70.0 ([a20320d](https://github.com/Skillcheese/Toolasha/commit/a20320d45649750a18d30377f92e6d7dc91b940b))
- **main:** release 2.70.0 ([e88a298](https://github.com/Skillcheese/Toolasha/commit/e88a2984b2665062d71f3b615cd69005b93b81b5))
- **main:** release 2.70.1 ([c2e2263](https://github.com/Skillcheese/Toolasha/commit/c2e2263371561c784bcdb2cdabd72fa2a5b0b835))
- **main:** release 2.70.1 ([750e9a1](https://github.com/Skillcheese/Toolasha/commit/750e9a17257714c9ddcc9c093bbfee1e799e59e3))
- **main:** release 2.70.2 ([617a670](https://github.com/Skillcheese/Toolasha/commit/617a67084ed2132450f5ba6f0a04656e05e14a02))
- **main:** release 2.70.2 ([653406c](https://github.com/Skillcheese/Toolasha/commit/653406cbf9d7f976acbc82e87a4d37a48ddca51c))
- **main:** release 2.71.0 ([48728da](https://github.com/Skillcheese/Toolasha/commit/48728dae6bad290804fbab3a0b8fe81c431f8eb9))
- **main:** release 2.71.0 ([5a3ecf1](https://github.com/Skillcheese/Toolasha/commit/5a3ecf19aa201478f4758ce2956f95099bb00624))
- **main:** release 2.71.1 ([b996872](https://github.com/Skillcheese/Toolasha/commit/b996872ee430ff90e4538f188847b88432f65804))
- **main:** release 2.71.1 ([8de13ac](https://github.com/Skillcheese/Toolasha/commit/8de13ac7a131f2ecb38875817315a48771c0539d))
- **main:** release 2.72.0 ([5f03b21](https://github.com/Skillcheese/Toolasha/commit/5f03b21afe8efe51514b592d429d9c79571ee737))
- **main:** release 2.72.0 ([44c0261](https://github.com/Skillcheese/Toolasha/commit/44c0261aacefbe8e2dfe40057489729bd4240187))
- **main:** release 2.72.1 ([428a3a2](https://github.com/Skillcheese/Toolasha/commit/428a3a2199adf3381843485267c58e561a4ff167))
- **main:** release 2.72.1 ([e4c1008](https://github.com/Skillcheese/Toolasha/commit/e4c1008c406fc70ec4ba6a028e1229413e09a1eb))
- **main:** release 2.72.2 ([35d2d6a](https://github.com/Skillcheese/Toolasha/commit/35d2d6a146074917197cd530752063be1fcb4b14))
- **main:** release 2.72.2 ([f860e9e](https://github.com/Skillcheese/Toolasha/commit/f860e9e9d122fdb108ada913ffd96342c04232e8))
- **main:** release 2.73.0 ([19c2735](https://github.com/Skillcheese/Toolasha/commit/19c2735f205af2c6c57cdfbf4574a04b386385cf))
- **main:** release 2.73.0 ([dd6cbdf](https://github.com/Skillcheese/Toolasha/commit/dd6cbdfbbdf4a50551a70331b8b44a438a8c1c3d))
- **main:** release 2.74.0 ([9366189](https://github.com/Skillcheese/Toolasha/commit/9366189beda3a2aebc2eb43058d4427db16c1f5f))
- **main:** release 2.74.0 ([b1990f2](https://github.com/Skillcheese/Toolasha/commit/b1990f2282463bd208fcc328c1a6bd3fff2d7e80))
- **main:** release 2.74.1 ([12a514d](https://github.com/Skillcheese/Toolasha/commit/12a514da69c36c331db456329a1cf702fec4cb95))
- **main:** release 2.74.1 ([9b1a95f](https://github.com/Skillcheese/Toolasha/commit/9b1a95fce869692a175a4799f07f498fce43864f))
- **main:** release 2.74.2 ([08459dc](https://github.com/Skillcheese/Toolasha/commit/08459dc228a22dd334eae77cf34b0c75912c29d3))
- **main:** release 2.74.2 ([8230963](https://github.com/Skillcheese/Toolasha/commit/82309637820c920416703e837631c710a7acb861))
- **main:** release 2.75.0 ([6677a51](https://github.com/Skillcheese/Toolasha/commit/6677a517a2e05c173cbfbdb2e8264d5964537e57))
- **main:** release 2.75.0 ([732456e](https://github.com/Skillcheese/Toolasha/commit/732456e8e04cd77029b3f542ede95bd1aa8456bb))
- **main:** release 2.76.0 ([579eb67](https://github.com/Skillcheese/Toolasha/commit/579eb674dfb9aa24573afcc6ff8095e7b75a1952))
- **main:** release 2.76.0 ([8c16118](https://github.com/Skillcheese/Toolasha/commit/8c1611818caae05cfc4985fed89b742b528b4fdb))
- **main:** release 2.77.0 ([7b65bb9](https://github.com/Skillcheese/Toolasha/commit/7b65bb96bb988512bf00cb04fbe29419c9d6e05d))
- **main:** release 2.77.0 ([1c560a6](https://github.com/Skillcheese/Toolasha/commit/1c560a60fa40a32124f9284433b95c12d99c1440))
- **main:** release 2.77.1 ([a3170dc](https://github.com/Skillcheese/Toolasha/commit/a3170dca101fbe03eabe1ca36cbfe304733c0ba4))
- **main:** release 2.77.1 ([14a107b](https://github.com/Skillcheese/Toolasha/commit/14a107b481ec6bb7b19bffa73bbc657486773a3c))
- **main:** release 2.77.2 ([03f7024](https://github.com/Skillcheese/Toolasha/commit/03f7024ac2aace2c78da99c0ee99716ad326d789))
- **main:** release 2.77.2 ([bc96ce7](https://github.com/Skillcheese/Toolasha/commit/bc96ce7c2a9fe7a14fc3fe2eb3ceca1d84777b27))
- **main:** release 2.78.0 ([02a618a](https://github.com/Skillcheese/Toolasha/commit/02a618aeb052009c80525919f798627df7cb85fc))
- **main:** release 2.78.0 ([19e446b](https://github.com/Skillcheese/Toolasha/commit/19e446b196a9d8291db70739e881e4eb18a3ab64))
- **main:** release 2.79.0 ([d9a8c15](https://github.com/Skillcheese/Toolasha/commit/d9a8c150acea8a623cd70d36c97796d43399e832))
- **main:** release 2.79.0 ([926b54b](https://github.com/Skillcheese/Toolasha/commit/926b54beb01799d5a547c224e0ec6eb52a529fe6))
- **main:** release 2.80.0 ([02a1efd](https://github.com/Skillcheese/Toolasha/commit/02a1efdb75feedd55ff2c35e01be8c1957b30513))
- **main:** release 2.80.0 ([7be3b0f](https://github.com/Skillcheese/Toolasha/commit/7be3b0fb2ab0def760f3380d6f1e2c7f43166a4b))
- **main:** release 2.80.1 ([2b109b5](https://github.com/Skillcheese/Toolasha/commit/2b109b518e3510ace0f9b1e26d43e4c249a5cd37))
- **main:** release 2.80.1 ([4c5ddfd](https://github.com/Skillcheese/Toolasha/commit/4c5ddfdb58ba8e8ca5e984b20bbd3a7dcfea0aae))
- **main:** release 2.80.2 ([03517b0](https://github.com/Skillcheese/Toolasha/commit/03517b09437148b69106b646f5b0617a34910401))
- **main:** release 2.80.2 ([f112d55](https://github.com/Skillcheese/Toolasha/commit/f112d5511631b04be9ecb6d34a9532fde2b700ab))
- **main:** release 2.81.0 ([e28c835](https://github.com/Skillcheese/Toolasha/commit/e28c835438898e1e3f80bc4a9d703e74aba78f93))
- **main:** release 2.81.0 ([fd52d1b](https://github.com/Skillcheese/Toolasha/commit/fd52d1bfa77e641d799b5bd1f175f8af7e47a39f))
- **main:** release 2.82.0 ([2ad4963](https://github.com/Skillcheese/Toolasha/commit/2ad4963eed7a8c8eabc6ee245096afc2b2e0d1b0))
- **main:** release 2.82.0 ([ca923f6](https://github.com/Skillcheese/Toolasha/commit/ca923f654c61e7dacb5070b0a7c844972a77bebe))
- **main:** release 2.82.1 ([fac675a](https://github.com/Skillcheese/Toolasha/commit/fac675afc8f828698280d40a16245fb7af5e0fcd))
- **main:** release 2.82.1 ([2c41327](https://github.com/Skillcheese/Toolasha/commit/2c413278d025a20f35c842db21de6df023d8ef38))
- **main:** release 2.83.0 ([c8f2ca7](https://github.com/Skillcheese/Toolasha/commit/c8f2ca7fde0f02f6c854dadd10321e7f24ce10e4))
- **main:** release 2.83.0 ([83eda7a](https://github.com/Skillcheese/Toolasha/commit/83eda7a68cb9f389451c3cce5c3ee64261a59dc6))
- **main:** release 2.84.0 ([77e9ddb](https://github.com/Skillcheese/Toolasha/commit/77e9ddb8a0120c84bfbae7b530e4b7e02df78fd9))
- **main:** release 2.84.0 ([fe22bdf](https://github.com/Skillcheese/Toolasha/commit/fe22bdfc6046b6f495d9d3abcc0c883c68fef093))
- **main:** release 2.85.0 ([9b9e5cb](https://github.com/Skillcheese/Toolasha/commit/9b9e5cbda0d327fc5e051a9962cf61e0191ba540))
- **main:** release 2.85.0 ([b3b9e7e](https://github.com/Skillcheese/Toolasha/commit/b3b9e7e0edaf63c7d3c14328d8f0bae1ab19ee1a))
- **main:** release 2.85.1 ([e8dae78](https://github.com/Skillcheese/Toolasha/commit/e8dae788d6e1f79e0b876cb40d3a4c0147480ca5))
- **main:** release 2.85.1 ([4f5cb54](https://github.com/Skillcheese/Toolasha/commit/4f5cb545cfdde8aa192918843b6e47f24da29c9a))
- remove guild activity calculator (pending game redesign) ([2250ef1](https://github.com/Skillcheese/Toolasha/commit/2250ef1b4bea777d4423f49342608830a060220c))
- remove loadoutSort feature superseded by native game drag-and-drop ([b44502c](https://github.com/Skillcheese/Toolasha/commit/b44502cff80e8a0d863ccb706f6249850f1607c6))
- sync version and format release notes ([83458d7](https://github.com/Skillcheese/Toolasha/commit/83458d772bd2695f1d9b1b81335c304a158c27c9))
- sync version and format release notes ([ea6cbf5](https://github.com/Skillcheese/Toolasha/commit/ea6cbf5b6ff8a530d6ebca707e945bef3c009891))
- sync version and format release notes ([9e7c1e1](https://github.com/Skillcheese/Toolasha/commit/9e7c1e1a103a15e86118955082e086448474b97f))
- sync version and format release notes ([c5971dc](https://github.com/Skillcheese/Toolasha/commit/c5971dc9fef3d6feb116b0ccd73d54904f59f4b4))
- sync version and format release notes ([ff629a8](https://github.com/Skillcheese/Toolasha/commit/ff629a84cc3568f9c5d50da23ee8e537c5b43926))
- sync version and format release notes ([5fb163a](https://github.com/Skillcheese/Toolasha/commit/5fb163a50f669087d4cf5ede0a5c5bdd4ba4bcaf))
- sync version and format release notes ([11d1b2c](https://github.com/Skillcheese/Toolasha/commit/11d1b2ca7ae0ea48b71c82af008d375baa383bd6))
- sync version and format release notes ([fc253bb](https://github.com/Skillcheese/Toolasha/commit/fc253bb1322ae273ec8d69196b9779023f7845a0))
- sync version and format release notes ([55326ad](https://github.com/Skillcheese/Toolasha/commit/55326adcfae21f4e74f79081d52513f9833c9f5d))
- sync version and format release notes ([76337d6](https://github.com/Skillcheese/Toolasha/commit/76337d65d5fe364a210c22b2cfc0362a506fe67c))
- sync version and format release notes ([e690b8c](https://github.com/Skillcheese/Toolasha/commit/e690b8cecfe5c6f3607ab7cb70262e0074833240))
- sync version and format release notes ([1da5317](https://github.com/Skillcheese/Toolasha/commit/1da53172d28882796efe13251c65ca58adbb1bab))
- sync version and format release notes ([b4133de](https://github.com/Skillcheese/Toolasha/commit/b4133de4ec9f5b8d07602f6cd09979cb46ae04b4))
- sync version and format release notes ([630dc92](https://github.com/Skillcheese/Toolasha/commit/630dc92c35410bb4c82300ab9945a0e7ecd205a9))
- sync version and format release notes ([fced384](https://github.com/Skillcheese/Toolasha/commit/fced38440aedbab7e9081fa94d98a949921f188a))
- sync version and format release notes ([625b2d0](https://github.com/Skillcheese/Toolasha/commit/625b2d010776013212c9e6742ff8a37a2d9f81ce))
- sync version and format release notes ([f37852e](https://github.com/Skillcheese/Toolasha/commit/f37852e8741ac779943b77b375ab8a4723a3fc37))
- sync version and format release notes ([61931d9](https://github.com/Skillcheese/Toolasha/commit/61931d94ac1fd209d3ea339f56b48d98186bbfce))
- sync version and format release notes ([2f8a2c8](https://github.com/Skillcheese/Toolasha/commit/2f8a2c8af054f0d9ad80a5ceb375a5169a26d710))
- sync version and format release notes ([72852d0](https://github.com/Skillcheese/Toolasha/commit/72852d0c7161bf6d3ae9d1cf1e244854ab262d84))
- sync version and format release notes ([fb02fd7](https://github.com/Skillcheese/Toolasha/commit/fb02fd7b2aeb0fa5579feb121d1d0ce8b07a2e67))
- sync version and format release notes ([11a42e4](https://github.com/Skillcheese/Toolasha/commit/11a42e4726d0f3c19422525d877d0440acd188a5))
- sync version and format release notes ([ae31ec0](https://github.com/Skillcheese/Toolasha/commit/ae31ec061353016a9dd97e56ab1698a2725b135d))
- sync version and format release notes ([1a2d93f](https://github.com/Skillcheese/Toolasha/commit/1a2d93fd3dbe6b32f5e16aa19ee663fb2a804f15))
- sync version and format release notes ([0898e16](https://github.com/Skillcheese/Toolasha/commit/0898e1693dfaf8ade929d4901b4f666ee70d63e1))
- sync version and format release notes ([adca1d9](https://github.com/Skillcheese/Toolasha/commit/adca1d92fb387628a2ba91191980d11de1b5f180))
- sync version and format release notes ([1c8fabf](https://github.com/Skillcheese/Toolasha/commit/1c8fabf649b3795a157ba94e33ce85b854a4656f))
- sync version and format release notes ([9f92a18](https://github.com/Skillcheese/Toolasha/commit/9f92a18e988c2073eb686fafc7297569fedd3030))
- sync version and format release notes ([9904f00](https://github.com/Skillcheese/Toolasha/commit/9904f0036d87f35ba90f94e56a2e97a8b5e5d499))
- sync version and format release notes ([c061463](https://github.com/Skillcheese/Toolasha/commit/c061463591105f3b1c7f227e04d84ed33b1a1cdf))
- sync version and format release notes ([c3771dc](https://github.com/Skillcheese/Toolasha/commit/c3771dc4edcc3daa86be8d6c7f8b9064283f7028))
- sync version and format release notes ([56a3421](https://github.com/Skillcheese/Toolasha/commit/56a34215d30e5a74cbdc61f129f2330641159efd))
- sync version and format release notes ([edba626](https://github.com/Skillcheese/Toolasha/commit/edba626e0e798cfe1edaaccb8165ddd0e46656da))
- sync version and format release notes ([1aac023](https://github.com/Skillcheese/Toolasha/commit/1aac023230d5cfbc345208c589cd45ada600116d))
- sync version and format release notes ([a732a5f](https://github.com/Skillcheese/Toolasha/commit/a732a5f49c04c1cf551968982a6a4d9824d330f9))
- sync version and format release notes ([a242b24](https://github.com/Skillcheese/Toolasha/commit/a242b241c260ba0b6642478ae251de89421ba4b2))
- sync version and format release notes ([2b2385b](https://github.com/Skillcheese/Toolasha/commit/2b2385b547fbfca510154733fa17dfe7179c63cf))
- sync version and format release notes ([d711729](https://github.com/Skillcheese/Toolasha/commit/d711729bf008183f97d75037d85ae8cae5f067aa))
- sync version and format release notes ([904ab7d](https://github.com/Skillcheese/Toolasha/commit/904ab7d2388295963349e849efc9d3f6f9148c2c))
- sync version and format release notes ([2cc91ed](https://github.com/Skillcheese/Toolasha/commit/2cc91ed5a54735b53dcda0dd4501b30a1ad65926))
- sync version and format release notes ([6665acf](https://github.com/Skillcheese/Toolasha/commit/6665acfc072597a853f9ecbae3f46af7138a5dbd))
- sync version and format release notes ([9490d27](https://github.com/Skillcheese/Toolasha/commit/9490d27fd0eab1b7472511dbb718ff3449dca961))
- sync version and format release notes ([7f303b9](https://github.com/Skillcheese/Toolasha/commit/7f303b93734a5012dcee08fa22709d0c1408c432))
- sync version and format release notes ([a80b86f](https://github.com/Skillcheese/Toolasha/commit/a80b86f4a050370d4d6715156ac6dfadcf97d27f))
- sync version and format release notes ([d34ce25](https://github.com/Skillcheese/Toolasha/commit/d34ce256472386145cf1478853deb0c79a9abd4b))
- sync version and format release notes ([97e54b8](https://github.com/Skillcheese/Toolasha/commit/97e54b8b16ca0e7431b5e9bf2ccf10701711f81a))
- sync version and format release notes ([1270a1b](https://github.com/Skillcheese/Toolasha/commit/1270a1bcfe1887f5b4ca12bd2d883d8549e378a5))
- sync version and format release notes ([5303575](https://github.com/Skillcheese/Toolasha/commit/5303575d2151453c0bfe3804ba196796f7cee85b))
- sync version and format release notes ([93e5025](https://github.com/Skillcheese/Toolasha/commit/93e5025d511657b3f6a80185c062f9d4d969f84a))
- sync version and format release notes ([5ad24c0](https://github.com/Skillcheese/Toolasha/commit/5ad24c04cac69f831e5059c6eabf2554c3464de8))
- sync version and format release notes ([5486887](https://github.com/Skillcheese/Toolasha/commit/548688774ab110cbf995f3a24087edb04c4ff44b))
- sync version and format release notes ([757d5d5](https://github.com/Skillcheese/Toolasha/commit/757d5d5ddd4ae3b3fc9fa8108bd066050067f3e6))
- sync version and format release notes ([9e7ca0b](https://github.com/Skillcheese/Toolasha/commit/9e7ca0b989f30cd48ec172722d14e31d1585fcc7))
- sync version and format release notes ([638e02a](https://github.com/Skillcheese/Toolasha/commit/638e02ac26e44452d2f17cbb10e038666c38d308))
- sync version and format release notes ([d8d207a](https://github.com/Skillcheese/Toolasha/commit/d8d207ac6d9c70441ecf39d8623856df0b7510d6))
- sync version and format release notes ([3520a58](https://github.com/Skillcheese/Toolasha/commit/3520a588c9038202460c054125c637113fe35dd5))
- sync version and format release notes ([e549011](https://github.com/Skillcheese/Toolasha/commit/e549011393c5557687e4f7c801cc2edd446d033d))
- sync version and format release notes ([570f1e6](https://github.com/Skillcheese/Toolasha/commit/570f1e663c9933703b4af8382e103facdc11dbfe))
- sync version and format release notes ([0dc5d05](https://github.com/Skillcheese/Toolasha/commit/0dc5d056653c8ffe7e4738d155509befc3fcbb2a))
- sync version and format release notes ([72d3840](https://github.com/Skillcheese/Toolasha/commit/72d384096f09792cf88b4db5211c1366ddf1b169))
- sync version and format release notes ([3703a79](https://github.com/Skillcheese/Toolasha/commit/3703a79a62a84c0d41ef8173bbe1c567056f44dd))
- sync version and format release notes ([8742dc6](https://github.com/Skillcheese/Toolasha/commit/8742dc6a973160251d3ed369b56b40fa551888a4))
- sync version and format release notes ([ca2eaa9](https://github.com/Skillcheese/Toolasha/commit/ca2eaa9ff2af7413827b37ff987355d5115f5d9b))
- sync version and format release notes ([a5565d6](https://github.com/Skillcheese/Toolasha/commit/a5565d61ecd407bca82f665789504770e3c86784))
- sync version and format release notes ([5962c5a](https://github.com/Skillcheese/Toolasha/commit/5962c5a954b126391637a9e5fffb1c846ee8f54c))
- sync version and format release notes ([868a7e9](https://github.com/Skillcheese/Toolasha/commit/868a7e98874b1eba44a8ab0d518a63a142b1db4d))
- sync version and format release notes ([c3a048e](https://github.com/Skillcheese/Toolasha/commit/c3a048e009737214be4c8f000dd3e87d5363dbab))
- sync version and format release notes ([aacceca](https://github.com/Skillcheese/Toolasha/commit/aaccecad7ce8fb897f170749349a4e3d87e42b36))
- sync version and format release notes ([d1b0548](https://github.com/Skillcheese/Toolasha/commit/d1b0548995405270d9f2f29f800f5e5f6bef8ec4))
- sync version and format release notes ([424b02a](https://github.com/Skillcheese/Toolasha/commit/424b02a6a69f6d4a39ce5308e343460244685724))
- sync version and format release notes ([65c4246](https://github.com/Skillcheese/Toolasha/commit/65c42462e120ef38f369bebe9a8c93734058d986))
- sync version and format release notes ([d5efe94](https://github.com/Skillcheese/Toolasha/commit/d5efe94ec0403de8044c98765ee40a61169c2390))
- sync version and format release notes ([04ec4a4](https://github.com/Skillcheese/Toolasha/commit/04ec4a42cef8da4282afe044ca6bfc3f6720dd28))
- sync version and format release notes ([4f2e049](https://github.com/Skillcheese/Toolasha/commit/4f2e0496f7501f091f5f1f12c4eb2b02a6bfd17e))
- sync version and format release notes ([8b715fa](https://github.com/Skillcheese/Toolasha/commit/8b715fa8ee88e9e3d0ba9a7fda87a17e5ec0ff18))
- sync version and format release notes ([7b57b9a](https://github.com/Skillcheese/Toolasha/commit/7b57b9a22425ad81517d8da3e82e2a4ac426f586))
- sync version and format release notes ([0b78899](https://github.com/Skillcheese/Toolasha/commit/0b788996cb216f3d4d2a9edf86964ee6b463c09f))
- sync version and format release notes ([18c1566](https://github.com/Skillcheese/Toolasha/commit/18c156638787af9f9c7a9ad6b62abab7e79cbfc2))
- sync version and format release notes ([b0ef776](https://github.com/Skillcheese/Toolasha/commit/b0ef776b683d70f98b573fe95e45e20b3eff6fec))
- sync version and format release notes ([e874cf1](https://github.com/Skillcheese/Toolasha/commit/e874cf165e1e936520f80389c2aa4c0ca6db335d))
- sync version and format release notes ([b4a1f4a](https://github.com/Skillcheese/Toolasha/commit/b4a1f4a63001999c00aa79d09d6753c1a2fd8de4))
- sync version and format release notes ([7f42397](https://github.com/Skillcheese/Toolasha/commit/7f423975828fcb3b43cdd1a5a7f386c249c6a9a7))
- sync version and format release notes ([aa6ba61](https://github.com/Skillcheese/Toolasha/commit/aa6ba6145794bce09a1d4bc2bc10368c05dd4939))
- sync version and format release notes ([92b8dae](https://github.com/Skillcheese/Toolasha/commit/92b8daecddc94ebf2ab1752c8f0218ad6c6eb2a3))
- sync version and format release notes ([3cbc745](https://github.com/Skillcheese/Toolasha/commit/3cbc745a3b7379a09822cbdaaf07bdbf1c7c8116))
- sync version and format release notes ([3e51fb8](https://github.com/Skillcheese/Toolasha/commit/3e51fb8e7f64684f09af067931f8374392d2990f))

## [2.85.1](https://github.com/Celasha/Toolasha/compare/v2.85.0...v2.85.1) (2026-07-30)

### Performance Improvements

- use immediate writes for login-time storage snapshots ([18db361](https://github.com/Celasha/Toolasha/commit/18db36182633bee222481c7eeca2590d049ea6bc))

## [2.85.0](https://github.com/Celasha/Toolasha/compare/v2.84.0...v2.85.0) (2026-07-30)

### Features

- add idle members list to Guild Overview tab ([46ed6bd](https://github.com/Celasha/Toolasha/commit/46ed6bd6c4dfeadde5205d68f15ec2fd5f722c80))

### Bug Fixes

- close remaining TLA-002 lifecycle leaks across six features ([4282b9e](https://github.com/Celasha/Toolasha/commit/4282b9e6dda79528766bdc210d467bfb6863f70e))
- correct character isolation in settings importer (TLA-006) ([da4021f](https://github.com/Celasha/Toolasha/commit/da4021f4359214e3bdde146dde10e1dc951557f9))
- correct onSettingChange cleanup in four additional features ([56b9c5b](https://github.com/Celasha/Toolasha/commit/56b9c5b310ec6fd94e6eef05e80da356d817e9a9))
- guard null price at both unguarded call sites in listing age (TLA-008) ([2452994](https://github.com/Celasha/Toolasha/commit/2452994dea63e413d34d7f8738e40837fc67b03b))
- include boss spawns in Seek zone drop lookup ([593e913](https://github.com/Celasha/Toolasha/commit/593e913c2dc8d5f86c7339322bcc6c31a8636c02))
- preserve queued writes across IndexedDB failures (TLA-007) ([71f9e3c](https://github.com/Celasha/Toolasha/commit/71f9e3c4313f4d3f6355072554ef7efa26feae7d))
- prevent resource accumulation on same-character resyncs ([21102e5](https://github.com/Celasha/Toolasha/commit/21102e52cadecad3ed582fb10201a572772bd33b))
- remove document listeners when transient modals and popups close ([cf5314a](https://github.com/Celasha/Toolasha/commit/cf5314ac8b7f01be96adc4640ecf31d7c777a4ea))
- remove duplicate character_switching listener from chat-commands ([df80f51](https://github.com/Celasha/Toolasha/commit/df80f511e9a0c624fe02977bbec3020fb7e6e0d4))
- remove duplicate parsePrice that discarded B suffix (TLA-008) ([ee4eed7](https://github.com/Celasha/Toolasha/commit/ee4eed74a609bb2e73d7ce0c22ca092b2a4302ea))
- remove task card min-height style when reroll tracker is disabled ([2d3a2b0](https://github.com/Celasha/Toolasha/commit/2d3a2b0759ccda9cd8d3a83d2bb983d35f7d6850))
- remove WebSocket prototype addEventListener/onmessage wrapping ([5824eca](https://github.com/Celasha/Toolasha/commit/5824ecad6c7d1f85f26c46960b17ac66a2fb9d24))
- replace unbounded debounce array with O(1) latest-value retention ([e9ef830](https://github.com/Celasha/Toolasha/commit/e9ef83020e90f5bb991e094e7008023750a7b47f))
- replace undefined SCRIPT_COLOR_PRIMARY/SECONDARY references (TLA-009) ([4135ecc](https://github.com/Celasha/Toolasha/commit/4135eccf11b4b76056f122a62b301dccf4d2b6d9))
- separate melee damage styles in upgrade tier progression ([f303d2e](https://github.com/Celasha/Toolasha/commit/f303d2e788c141316e1632e899a9ed63db814363))

### Tests

- add source-scan guard for forbidden config color names (TLA-009) ([0be2418](https://github.com/Celasha/Toolasha/commit/0be2418c77b04b2108368bea4593af0ad8723881))

## [2.84.0](https://github.com/Celasha/Toolasha/compare/v2.83.0...v2.84.0) (2026-07-27)

### Features

- add Protection sort mode to task sorter ([f160f54](https://github.com/Celasha/Toolasha/commit/f160f548e66cda38d68c41b8313bcec3ee6aad36))

### Bug Fixes

- remove stale Rec badge when skip threshold is edited ([e2d5ad6](https://github.com/Celasha/Toolasha/commit/e2d5ad68d880a5cec4ee0c10192c096343844c68))
- skip battle counter injection when no active combat action ([46db6ec](https://github.com/Celasha/Toolasha/commit/46db6ecae50f76260dd2149525189b2dbe75e794))

## [2.83.0](https://github.com/Celasha/Toolasha/compare/v2.82.1...v2.83.0) (2026-07-26)

### Features

- add draggable modals with remembered position ([5d41e5a](https://github.com/Celasha/Toolasha/commit/5d41e5a4e3d315d1e479908f2e26efa13dd7279f))
- consolidate lab sim inputs into Configure tab with auto-loadout ([7cb624e](https://github.com/Celasha/Toolasha/commit/7cb624e89db01aa0a6f43c33fa001932ef7b7631))
- overhaul skilling optimizer to show loadout-relative progression ([efb990f](https://github.com/Celasha/Toolasha/commit/efb990f21a67ab5de8fe80f5454987b7bb1aa810))

### Bug Fixes

- give Lab Simulator its own independent setting ([33e405a](https://github.com/Celasha/Toolasha/commit/33e405ad21e0847564726f8ae1c4bb94b9ec699d))
- make skilling optimizer score alchemy equipment correctly ([400b148](https://github.com/Celasha/Toolasha/commit/400b148715a6b908bf2da8375736d92e0da6d35a))
- register skillingOptimizer in config features map ([dc53b94](https://github.com/Celasha/Toolasha/commit/dc53b94f8bc969df00de090106b3fa95452001f4))
- sort loadout dropdowns by server ordinal ([acfca19](https://github.com/Celasha/Toolasha/commit/acfca19dd0a4227a2bc39bbad57afaa4d24d3264))

## [2.82.1](https://github.com/Celasha/Toolasha/compare/v2.82.0...v2.82.1) (2026-07-24)

### Bug Fixes

- defer skilling optimizer style injection until DOM is ready ([dba550b](https://github.com/Celasha/Toolasha/commit/dba550ba4692b814f684c3ebf5375a5ce4f4e779))
- rebuild equipment section when skill changes in simulator ([fd2d06a](https://github.com/Celasha/Toolasha/commit/fd2d06a2a9425900f3daf405a3071ffaad0e8778))

### Code Refactoring

- split leaderboard XP tracking into independent feature ([4d2fc58](https://github.com/Celasha/Toolasha/commit/4d2fc58defa8dbe45fe067ea449be39117d828dd))

## [2.82.0](https://github.com/Celasha/Toolasha/compare/v2.81.0...v2.82.0) (2026-07-24)

### Features

- add Skilling Simulator and Optimizer tab to character panel ([3318f48](https://github.com/Celasha/Toolasha/commit/3318f48634cce30a4f3338deb999213128f2d4f8))
- make all My Listings table headers sortable ([81f1a54](https://github.com/Celasha/Toolasha/commit/81f1a54e5817f60c25aae4f183a7355ab2db79a2))

### Bug Fixes

- show drink timer on Alchemy and Enhancing panels ([2a3c25e](https://github.com/Celasha/Toolasha/commit/2a3c25e467c4e63255ce158c91ec56155db2579d))
- use profit as secondary sort when sorting Best Items by XP, and vice versa ([bb6b66e](https://github.com/Celasha/Toolasha/commit/bb6b66e83ce6b9be1f36cc0f2d0570c669cf166b))

## [2.81.0](https://github.com/Celasha/Toolasha/compare/v2.80.2...v2.81.0) (2026-07-23)

### Features

- add listing refresh navigator to My Listings page ([107c118](https://github.com/Celasha/Toolasha/commit/107c11877a34cd2315e8a94255fc6d833a28a3c3))

## [2.80.2](https://github.com/Celasha/Toolasha/compare/v2.80.1...v2.80.2) (2026-07-22)

### Bug Fixes

- compute upgrade advisor DPS from actual damage dealt instead of XP/hr ([cf83826](https://github.com/Celasha/Toolasha/commit/cf83826bc534adfb1629e9458942c3ed56ab5553))
- key player leaderboard XP history by category to prevent cross-category contamination ([9090a6a](https://github.com/Celasha/Toolasha/commit/9090a6aad1cd5f787e74ee65cde9dfb312256a74))
- use refined item costs for mirror path instead of non-refined base item ([9dd1941](https://github.com/Celasha/Toolasha/commit/9dd1941bebad166edf33cdafe008fe9c5c143cbc))

## [2.80.1](https://github.com/Celasha/Toolasha/compare/v2.80.0...v2.80.1) (2026-07-22)

### Bug Fixes

- skip sort registration in max-produceable for gathering panels ([afbaa9a](https://github.com/Celasha/Toolasha/commit/afbaa9a60d58815b929a640ea5746afa383f13c7))

## [2.80.0](https://github.com/Celasha/Toolasha/compare/v2.79.0...v2.80.0) (2026-07-22)

### Features

- use session-based XP/hr for combat skills ([2494e52](https://github.com/Celasha/Toolasha/commit/2494e52d5cea024baf55a50b12157bb4cdf02afd))

### Bug Fixes

- register production panels with sort manager when pinned page is off ([f79a20c](https://github.com/Celasha/Toolasha/commit/f79a20c5c55c0e09101069f6957f8b1f10eee3b3))

## [2.79.0](https://github.com/Celasha/Toolasha/compare/v2.78.0...v2.79.0) (2026-07-22)

### Features

- add configurable whisper template for guild trial unsigned members ([f8cd052](https://github.com/Celasha/Toolasha/commit/f8cd052aa0252aa0fc6b7e07fb969f86a7b3709a))
- add per-player DPS to combat sim results ([65b564d](https://github.com/Celasha/Toolasha/commit/65b564d91c68fa5640eb72829cb3300f8f810aea))

### Bug Fixes

- correct guild shrine costs and enhance protect-from race condition ([81796a1](https://github.com/Celasha/Toolasha/commit/81796a1be4512436b92b1868a9928062b01216b4))
- stabilize task card heights and fix task reroll tracker display ([7c6aa23](https://github.com/Celasha/Toolasha/commit/7c6aa230b9a906c4163e39886974a60bf78dbd5d))

## [2.78.0](https://github.com/Celasha/Toolasha/compare/v2.77.2...v2.78.0) (2026-07-21)

### Features

- add exchange advisor to guild credit modal ([66d11b5](https://github.com/Celasha/Toolasha/commit/66d11b5e5a09b261642df3b2ad14d3452ee2c259))
- add mana run out, debuff on level gap, and wipe event log to combat sim results ([0a8fbd9](https://github.com/Celasha/Toolasha/commit/0a8fbd9dc016720d351bd026217594ea249872a8))
- add shrine upgrade planner to guild credit exchange panel ([783a04a](https://github.com/Celasha/Toolasha/commit/783a04a0639c52931dc2c98c2b005e73c2ae0e82))

### Bug Fixes

- return defaultValue from storage.get when stored value is null ([7e5ce1e](https://github.com/Celasha/Toolasha/commit/7e5ce1eb0ceff763a5c92cf545e6ca29dfd4c6b9))

## [2.77.2](https://github.com/Celasha/Toolasha/compare/v2.77.1...v2.77.2) (2026-07-19)

### Bug Fixes

- resolve [Unknown action] for items with mismatched display name and HRID ([3190702](https://github.com/Celasha/Toolasha/commit/3190702ce5c704b94c3face20a1ad1a0c0d32137))

## [2.77.1](https://github.com/Celasha/Toolasha/compare/v2.77.0...v2.77.1) (2026-07-19)

### Bug Fixes

- remove parentheses from trial tier badge to prevent line wrap ([4f9f484](https://github.com/Celasha/Toolasha/commit/4f9f4848b9ef1cd3de025d4a0dae58af7a7b9a4a))

## [2.77.0](https://github.com/Celasha/Toolasha/compare/v2.76.0...v2.77.0) (2026-07-19)

### Features

- show tier label on guild trial tiles ([5692a3e](https://github.com/Celasha/Toolasha/commit/5692a3e0af918805c106cf94b5831773f73c726f))

## [2.76.0](https://github.com/Celasha/Toolasha/compare/v2.75.0...v2.76.0) (2026-07-19)

### Features

- add Copy List button to guild trial signup modals ([c60b883](https://github.com/Celasha/Toolasha/commit/c60b88345846320592a50a44f2b7b96e548199c9))
- auto-fill enhancement target level from settings ([54dfa65](https://github.com/Celasha/Toolasha/commit/54dfa659813313e240f88550889af1ecefb9b16a))
- auto-fill optimal protect-from level when protection item is set ([7b44dba](https://github.com/Celasha/Toolasha/commit/7b44dba83598026aa7121a6a35359c5f9273464e))

### Bug Fixes

- decrement and remove shrine missing mats tabs on purchase ([2a3032a](https://github.com/Celasha/Toolasha/commit/2a3032a4bf13a6bb14564c208a1c8b8215632407))

## [2.75.0](https://github.com/Celasha/Toolasha/compare/v2.74.2...v2.75.0) (2026-07-18)

### Features

- add missing mats marketplace button to shrine upgrade cost table ([89f51bc](https://github.com/Celasha/Toolasha/commit/89f51bc02fcd1d6684aa45f19f34eff7084f0043))
- add missing mats marketplace tabs to shrine upgrade modal ([3656e84](https://github.com/Celasha/Toolasha/commit/3656e843fd44210d7fad91f86fcfe62b288f358d))

### Bug Fixes

- include guild shrine buffs in combat simulator ([667a2e7](https://github.com/Celasha/Toolasha/commit/667a2e7ac6548bb39227ccbc6349cf75bc8ac5b5))
- show guild shrine buffs in action breakdown displays ([93e47fc](https://github.com/Celasha/Toolasha/commit/93e47fc268ddd4a5f3219daf2c0b3ea2deccb782))

## [2.74.2](https://github.com/Celasha/Toolasha/compare/v2.74.1...v2.74.2) (2026-07-18)

### Bug Fixes

- add expand button to abilities & triggers panel to avoid scrolling ([40e68c7](https://github.com/Celasha/Toolasha/commit/40e68c747267ff93cce4c6e5d1ef69eeb54741b9))

## [2.74.1](https://github.com/Celasha/Toolasha/compare/v2.74.0...v2.74.1) (2026-07-18)

### Bug Fixes

- include guild shrine buffs in all skilling calculations ([f2b444f](https://github.com/Celasha/Toolasha/commit/f2b444f8bf89abd85103309ce00a55deac19cc5a))

## [2.74.0](https://github.com/Celasha/Toolasha/compare/v2.73.0...v2.74.0) (2026-07-17)

### Features

- add option to hide Guild notification badge in sidebar ([a75e91f](https://github.com/Celasha/Toolasha/commit/a75e91fe25f397773bf880aa71467719b7955234))
- auto-advance to next sell queue tab when item sells out ([0ffb3e6](https://github.com/Celasha/Toolasha/commit/0ffb3e6933a2621b4cdda17ebc77e54ecc55b715))

### Bug Fixes

- correct Game Mode sort misalignment and Activity hidden-status ordering ([3fc4b2a](https://github.com/Celasha/Toolasha/commit/3fc4b2a02fbb470edad6940f7bed66cea5e8882b))
- handle DD/MM date format in dungeon tracker chat timestamp parser ([903c353](https://github.com/Celasha/Toolasha/commit/903c3534705ae182d602e377cf38ef016b40a9e9))
- preserve blue ocean badges when hiding guild and labyrinth badges ([5e026d8](https://github.com/Celasha/Toolasha/commit/5e026d8dedd84534cd5c5f407032e376912fd6d1))

## [2.73.0](https://github.com/Celasha/Toolasha/compare/v2.72.2...v2.73.0) (2026-07-15)

### Features

- add Sell Queue — Shift+RightClick inventory items to sell ([c38aa7b](https://github.com/Celasha/Toolasha/commit/c38aa7b8ae918e6c070184e758f0cca9503d4afd))

## [2.72.2](https://github.com/Celasha/Toolasha/compare/v2.72.1...v2.72.2) (2026-07-15)

### Bug Fixes

- add clickable ask/bid column sorting to guild credit modals ([739f516](https://github.com/Celasha/Toolasha/commit/739f516a1516129fb99dcd2ec70ee3f8ef023ac4))
- show top-3 conversion options in shrine upgrade cost table ([17eb9f4](https://github.com/Celasha/Toolasha/commit/17eb9f4705270581507085af8c334938b100e98a))

## [2.72.1](https://github.com/Celasha/Toolasha/compare/v2.72.0...v2.72.1) (2026-07-15)

### Bug Fixes

- hide pin icons on tiles when pinned actions page is disabled ([d238dc9](https://github.com/Celasha/Toolasha/commit/d238dc9728cf32eb98c66d40a87932d8c7fc29a9))
- relocate Activity column and correct per-tab placement ([209577e](https://github.com/Celasha/Toolasha/commit/209577e215924f00789ce03518322c00524a1522))

### Code Refactoring

- reorganize settings into 25 focused groups ([3117c91](https://github.com/Celasha/Toolasha/commit/3117c910ed6ea70071da9ba49716763413ffba73))
- split profit/hr and exp/hr tile settings by action type ([6b6d533](https://github.com/Celasha/Toolasha/commit/6b6d533d203822fa16245bbb42568dc5ed1273df))

## [2.72.0](https://github.com/Celasha/Toolasha/compare/v2.71.1...v2.72.0) (2026-07-15)

### Features

- add gold cost per credit table to guild credit exchange modals ([5af726c](https://github.com/Celasha/Toolasha/commit/5af726c4217ed0a5bef51119abe68caf8f92ea66))
- add per-character selector to Copy Settings button ([507501b](https://github.com/Celasha/Toolasha/commit/507501b14163781703be0fd73bb170fc2fc43841))
- add per-column toggles and tab routing for guild Members columns ([7841384](https://github.com/Celasha/Toolasha/commit/78413843607b00404a4f2f3ff5c8a743c68ef12a))
- add shrine upgrade cost table and ask/bid columns to guild credit modals ([501cc92](https://github.com/Celasha/Toolasha/commit/501cc92a0d94aa6258ae6357c200b1ac14c64d8e))

### Bug Fixes

- always initialize max-produceable feature regardless of setting ([a4c0198](https://github.com/Celasha/Toolasha/commit/a4c0198cce5bfddb875c436109c0212c1150d5fd))
- exclude new members from unsigned trial list until next reset ([d128583](https://github.com/Celasha/Toolasha/commit/d12858389805c8aaa66c0377e8fc5a47e38b3f9c))

## [2.71.1](https://github.com/Celasha/Toolasha/compare/v2.71.0...v2.71.1) (2026-07-14)

### Bug Fixes

- unify action panel into a single scroll container ([1139933](https://github.com/Celasha/Toolasha/commit/1139933f0e218e21cfdd0180fc7228f1289ea21e))

## [2.71.0](https://github.com/Celasha/Toolasha/compare/v2.70.2...v2.71.0) (2026-07-14)

### Features

- show unsigned trial members list in guild Trials tab ([2fc01ce](https://github.com/Celasha/Toolasha/commit/2fc01ceb574df0fe311a3e6a13e283f4507e3dec))

### Bug Fixes

- add Activity column to guild Contributions tab ([7c70384](https://github.com/Celasha/Toolasha/commit/7c703843a88466bfeadb7321c72a274d29710539))
- sort Weekly XP column numerically with K/M suffix support ([6687524](https://github.com/Celasha/Toolasha/commit/66875241f18e849289c65e47e2ef8906fe23cef7))

### Miscellaneous Chores

- remove loadoutSort feature superseded by native game drag-and-drop ([b44502c](https://github.com/Celasha/Toolasha/commit/b44502cff80e8a0d863ccb706f6249850f1607c6))

## [2.70.2](https://github.com/Celasha/Toolasha/compare/v2.70.1...v2.70.2) (2026-07-13)

### Bug Fixes

- make action panel bottom section scrollable ([9708195](https://github.com/Celasha/Toolasha/commit/9708195dd489e0c008eec0f707a8837e2003abf2))
- prevent Build button collapse when cumulative section is tall ([4f6b0a3](https://github.com/Celasha/Toolasha/commit/4f6b0a33e231650d09e998d2136cc98e11b6bfea))

## [2.70.1](https://github.com/Celasha/Toolasha/compare/v2.70.0...v2.70.1) (2026-07-10)

### Bug Fixes

- show ask total in tooltip even when bid is missing ([b74a82c](https://github.com/Celasha/Toolasha/commit/b74a82c02ee1825759ad77e101eef08ceb066104))

## [2.70.0](https://github.com/Celasha/Toolasha/compare/v2.69.2...v2.70.0) (2026-07-10)

### Features

- add drink timer to skill panel consumables section ([08409f2](https://github.com/Celasha/Toolasha/commit/08409f2ce281a7a00ec7cfbd4fb1b612f392f6d3))

### Bug Fixes

- always show ×count in item tooltip price line ([17ed970](https://github.com/Celasha/Toolasha/commit/17ed9701e475ab6a6e481e726b8043a55d74928f))

## [2.69.2](https://github.com/Celasha/Toolasha/compare/v2.69.1...v2.69.2) (2026-07-06)

### Bug Fixes

- exclude out-of-stock drinks from artisan bonus calculations ([421f3db](https://github.com/Celasha/Toolasha/commit/421f3db9fc012ce639b0685549b6bf24442a824e))

## [2.69.1](https://github.com/Celasha/Toolasha/compare/v2.69.0...v2.69.1) (2026-07-06)

### Bug Fixes

- add configurable thresholds to cap reroll protection ([1fb551c](https://github.com/Celasha/Toolasha/commit/1fb551c4478e4238eae13e1668f16a1c501a9343))

## [2.69.0](https://github.com/Celasha/Toolasha/compare/v2.68.1...v2.69.0) (2026-07-06)

### Features

- add global reroll-at-cap protection to task reroll protection ([e0aef30](https://github.com/Celasha/Toolasha/commit/e0aef30b3a19437f60a4356e8b3cf188985f0eb7))

## [2.68.1](https://github.com/Celasha/Toolasha/compare/v2.68.0...v2.68.1) (2026-07-01)

### Bug Fixes

- correct efficiency in level calculator and Total time display ([419c4c8](https://github.com/Celasha/Toolasha/commit/419c4c822ade9ec6c18db078373aa6eb6c245c5a))
- keep guild Joined date on a single line ([860b373](https://github.com/Celasha/Toolasha/commit/860b3730dd21a7ac1aa8c142d7e8d02dca5395dc))
- use saved loadout snapshot for XP, time, and material predictions ([1722782](https://github.com/Celasha/Toolasha/commit/17227821b0f0eac052ae513baecadc705bfc2f82))

## [2.68.0](https://github.com/Celasha/Toolasha/compare/v2.67.7...v2.68.0) (2026-06-27)

### Features

- add Expand All / Collapse All buttons to Custom Tabs ([8d4e367](https://github.com/Celasha/Toolasha/commit/8d4e367c2fe1c31b42231e8379b7099246f7054c))
- prefix queue completion times with date when not today ([ebab9d2](https://github.com/Celasha/Toolasha/commit/ebab9d2c57590f97f5c8b1750ab2e6b28803e69e))

### Bug Fixes

- show MooPass wisdom line in XP bonus breakdown ([95d5146](https://github.com/Celasha/Toolasha/commit/95d5146a1e286a49671a949fe5593292a1f598cb))

## [2.67.7](https://github.com/Celasha/Toolasha/compare/v2.67.6...v2.67.7) (2026-06-26)

### Bug Fixes

- use inline-flex to force action-bar time line to one row ([e4b6260](https://github.com/Celasha/Toolasha/commit/e4b62603fe1bc58525065227f205f2faf7f836cb))

## [2.67.6](https://github.com/Celasha/Toolasha/compare/v2.67.5...v2.67.6) (2026-06-26)

### Bug Fixes

- keep action-bar time/icon line together on narrow screens ([96eda6a](https://github.com/Celasha/Toolasha/commit/96eda6af4a1975e3d7143086a535cdd5042d292d))
- use 2-digit year in formatDateTime to keep guild Joined column on one line ([ced1d5c](https://github.com/Celasha/Toolasha/commit/ced1d5c52ee50e502d3de60cd7878702f6bd4ae6))

## [2.67.5](https://github.com/Celasha/Toolasha/compare/v2.67.4...v2.67.5) (2026-06-24)

### Bug Fixes

- restore year on guild Joined column ([ba2b5e1](https://github.com/Celasha/Toolasha/commit/ba2b5e172ebfde77b69c5cc81dd53b89698b810c))

### Documentation

- clarify networth setting labels to match actual behavior ([eb833aa](https://github.com/Celasha/Toolasha/commit/eb833aaaa3dddefc094b039396fa4e21aa41647e))

## [2.67.4](https://github.com/Celasha/Toolasha/compare/v2.67.3...v2.67.4) (2026-06-21)

### Performance Improvements

- also gate badge fallback enhancement-cost calc on networth feature ([9d62d61](https://github.com/Celasha/Toolasha/commit/9d62d614a5e71aedc7de18e377e5a2ebdcf6389b))

## [2.67.3](https://github.com/Celasha/Toolasha/compare/v2.67.2...v2.67.3) (2026-06-21)

### Performance Improvements

- skip enhancement-cost badge calc when networth is disabled ([e95445f](https://github.com/Celasha/Toolasha/commit/e95445f6dfe19b5e9c3d0fac63bd0a0a74202bca))

### Continuous Integration

- run format workflow on bot pushes to release-please PRs ([eed699d](https://github.com/Celasha/Toolasha/commit/eed699dcbeece9c6bef6104e5c9748fa2816fc66))

## [2.67.2](https://github.com/Celasha/Toolasha/compare/v2.67.1...v2.67.2) (2026-06-21)

### Miscellaneous Chores

- format release notes ([38444c6](https://github.com/Celasha/Toolasha/commit/38444c65a6185dd42824b6388baa0ec41b7f284f))

## [2.67.1](https://github.com/Celasha/Toolasha/compare/v2.67.0...v2.67.1) (2026-06-21)

### Bug Fixes

- stop stale Attempt #N label from leaking into regular combat ([a85b867](https://github.com/Celasha/Toolasha/commit/a85b867cf0201e44cf065d3be5247443520581c8))
- surface refined weapon as upgrade for offensive items ([4595d1c](https://github.com/Celasha/Toolasha/commit/4595d1cf79d154f935ae151884ad922be670c5e6))
- surface T95 tier jumps and style-matched off-hands in upgrade advisor ([f31dbc1](https://github.com/Celasha/Toolasha/commit/f31dbc1f10f73d84b29e66f47343cde8d0d0d294))
- wire combatStats setting to feature gate ([5f63226](https://github.com/Celasha/Toolasha/commit/5f63226220a71d02b8ce5bb1ac959eefa3c01939))

## [2.67.0](https://github.com/Celasha/Toolasha/compare/v2.66.0...v2.67.0) (2026-06-20)

### Features

- add cost summary block to production action panels ([655dfd2](https://github.com/Celasha/Toolasha/commit/655dfd2b2c3140db9efbebc1de8620505d00af59))
- add sortable Progress column header to My Listings table ([3b1191e](https://github.com/Celasha/Toolasha/commit/3b1191ee06a15e3ef0987deeec51ff1b64b85a69))

### Bug Fixes

- apply correct dungeon chest quantity formula in combat sim ([3662b7c](https://github.com/Celasha/Toolasha/commit/3662b7c9052a0b7fb2c074a95c0f41333bcd724e))
- apply Custom Tab drag-drop layout before debounced save ([cf80e06](https://github.com/Celasha/Toolasha/commit/cf80e064d42c611a8ff1c6f287e8718defb2fa95))
- exclude own listings from Top Order Price/Age on My Listings ([445f2ba](https://github.com/Celasha/Toolasha/commit/445f2baee87866061e7ebe93cd95cc8e1c9f646e))
- make Marketplace "Count equipped items" setting actually toggle ([1dab506](https://github.com/Celasha/Toolasha/commit/1dab50651af54a632d93a532b0ee53040b480c51))
- prevent orphan outside-click listeners from deferred attachment race ([9500b1b](https://github.com/Celasha/Toolasha/commit/9500b1b5461af1fe429f8fc6d236ad09ebe1b303))
- refresh action-bar profit when pricing mode changes ([4976742](https://github.com/Celasha/Toolasha/commit/4976742fa86d7baade06425c4e58050a1adaf1a5))
- sync per-loadout Custom Tab binding independently of mixed exact mode ([36f07d1](https://github.com/Celasha/Toolasha/commit/36f07d1ced4b92d4a06489dffa84f20b02620b09))

### Miscellaneous Chores

- add Paradoxian to userscript header acknowledgements ([16378aa](https://github.com/Celasha/Toolasha/commit/16378aa3e35fbeca556636e1a7537c2e19ed2000))

## [2.66.0](https://github.com/Celasha/Toolasha/compare/v2.65.0...v2.66.0) (2026-06-18)

### Features

- add current action profit display to action bar ([9f4a5a4](https://github.com/Celasha/Toolasha/commit/9f4a5a408619c8cda3e78391d0811df7e5910610))

### Bug Fixes

- add alchemy action profit to queue tooltip and action bar ([371c236](https://github.com/Celasha/Toolasha/commit/371c236f15584ae21316158ac16568b60429b83e))
- capitalize monster names and show recommended skip in lab sim results ([3a0a689](https://github.com/Celasha/Toolasha/commit/3a0a689b70b8d2f9a86b0d2229731e5f17379a75))
- clean up history buffers and observers when chat extender is disabled ([53f8ce5](https://github.com/Celasha/Toolasha/commit/53f8ce502491f6ebf0f21cc28af571d6ce21eb38))
- include coin costs in enhancement XPH calculator metrics ([bdf146e](https://github.com/Celasha/Toolasha/commit/bdf146e5334d5f284c4ac46ab962fee2f1d35d4e))
- recognize short numeric character IDs during settings import ([4659c45](https://github.com/Celasha/Toolasha/commit/4659c455c2fce56364d4911c126dda5341a80155))
- resolve hanging Promises from debounced storage writes ([8ed8cc9](https://github.com/Celasha/Toolasha/commit/8ed8cc91996fc705eec24f665dd1a1ccb9e6b2cd))
- sync pop-out chat channel list with visible game tabs ([f03fd2b](https://github.com/Celasha/Toolasha/commit/f03fd2bd0111025d9dc9524d1310c2d08fcc9044))
- sync Settings UI disabled state and checkboxWithButton after All Off ([424bca0](https://github.com/Celasha/Toolasha/commit/424bca018f554ca1cd0cf75d9f5b365a2adf0e84))
- use DOM observer for chat commands input attachment ([a7a120b](https://github.com/Celasha/Toolasha/commit/a7a120b84af9e25c3e027e91d9ca2cd5aeea90f0))

### Miscellaneous Chores

- remove guild activity calculator (pending game redesign) ([2250ef1](https://github.com/Celasha/Toolasha/commit/2250ef1b4bea777d4423f49342608830a060220c))

## [2.65.0](https://github.com/Celasha/Toolasha/compare/v2.64.5...v2.65.0) (2026-06-16)

### Features

- add max threads setting for combat simulator ([4f8105c](https://github.com/Celasha/Toolasha/commit/4f8105c5931103258a29a3badb597ad27d18630e))

### Bug Fixes

- clear labyrinth attempt flag when entering regular combat ([6722bd8](https://github.com/Celasha/Toolasha/commit/6722bd8ebdf912c891454e3026ae36c670185cad))
- use handleChangeNavTarget for enhancement return navigation ([0e8e6b8](https://github.com/Celasha/Toolasha/commit/0e8e6b8d9918e3f24b4ab6458a618af0062ab635))

## [2.64.5](https://github.com/Celasha/Toolasha/compare/v2.64.4...v2.64.5) (2026-06-15)

### Bug Fixes

- restore click-to-view-details on comparison scenario rows ([f74420c](https://github.com/Celasha/Toolasha/commit/f74420ccf64eafdb9279903804d73040b4f75127))

## [2.64.4](https://github.com/Celasha/Toolasha/compare/v2.64.3...v2.64.4) (2026-06-15)

### Bug Fixes

- resolve enhancement levels from all owned items in combat loadout ([e9d52ad](https://github.com/Celasha/Toolasha/commit/e9d52ad0308ef026338857974215a34379684ecd))

## [2.64.3](https://github.com/Celasha/Toolasha/compare/v2.64.2...v2.64.3) (2026-06-15)

### Bug Fixes

- include gathering/gourmet buffs in labyrinth double progress chance ([99ef59e](https://github.com/Celasha/Toolasha/commit/99ef59e3b1bf85aec1bc4e3e5c378d443bba1b49))

## [2.64.2](https://github.com/Celasha/Toolasha/compare/v2.64.1...v2.64.2) (2026-06-15)

### Bug Fixes

- use labyrinth loadout equipment for skilling clear rate ([a220eb9](https://github.com/Celasha/Toolasha/commit/a220eb998fbaa00f75dca567bff0461752685dcc))

### Performance Improvements

- make combatStats and chatCommands initialize non-blocking ([304b742](https://github.com/Celasha/Toolasha/commit/304b742e9935fafe1beef07055d825cca02eda22))

## [2.64.1](https://github.com/Celasha/Toolasha/compare/v2.64.0...v2.64.1) (2026-06-14)

### Bug Fixes

- use base + tea crate only for labyrinth room-assignment effective level ([832da33](https://github.com/Celasha/Toolasha/commit/832da336fab14fddbe91f6b8b5dda1ebb79354f8))

## [2.64.0](https://github.com/Celasha/Toolasha/compare/v2.63.0...v2.64.0) (2026-06-14)

### Features

- add net worth pricing mode setting (ask/bid) ([4b0026e](https://github.com/Celasha/Toolasha/commit/4b0026e9c15f7195ccd7e09a41326db40c974057))

### Bug Fixes

- correct max produceable calculation for self-upgrade recipes ([9144a02](https://github.com/Celasha/Toolasha/commit/9144a020e7c686c2eb2d1edef96ca9d73837c8f7))
- decouple queue length estimation from listing age display setting ([41d29f4](https://github.com/Celasha/Toolasha/commit/41d29f403cdabd0971ed06707215b3d0f3d89fd1))
- labyrinth recommendations allow negative thresholds and exclude tea from combat level ([0ffa5d1](https://github.com/Celasha/Toolasha/commit/0ffa5d11f6ec37c1a4c408fa616f7e73652732e7))
- persist custom tab drag/drop changes across page reload ([1d1ec72](https://github.com/Celasha/Toolasha/commit/1d1ec726748e63fcf7eb8f6ff37e0ce751a10e74))
- prevent Add to Tab dropdown from leaking document click listeners ([2682ca1](https://github.com/Celasha/Toolasha/commit/2682ca15a38da2fb4f19c636f4c6f947bae891e7))
- refresh production profit UI when drinks or equipment change ([e254edf](https://github.com/Celasha/Toolasha/commit/e254edf9983ecd94132b6a320a9d109cee741658))
- respect "Use highest enhancement level" setting in custom tab auto-sync ([da843dd](https://github.com/Celasha/Toolasha/commit/da843dd6acbd5e60741f2aa654c2e4706eb6917c))

## [2.63.0](https://github.com/Celasha/Toolasha/compare/v2.62.14...v2.63.0) (2026-06-13)

### Features

- add configurable number format mode and precision settings ([53349ba](https://github.com/Celasha/Toolasha/commit/53349bacc7d4b84a56285ebf661382fbd45ce313))
- add guild activity calculator and simulator ([955c78e](https://github.com/Celasha/Toolasha/commit/955c78e3242b550158934d98f1db2ab63d1354c6))

### Bug Fixes

- add missing Help channel to pop-out chat ([b497147](https://github.com/Celasha/Toolasha/commit/b49714755c57e2a603ee615e12b34c60e3dbc4af))
- calculate task gold/hr using total task time instead of time remaining ([09a6168](https://github.com/Celasha/Toolasha/commit/09a61687d0751dc4333a583c391977c9b4cf91ba))
- correct labyrinth combat skip recommendations and add MooPass buffs ([b44dd1b](https://github.com/Celasha/Toolasha/commit/b44dd1b3c7395d8f22accbe6c02b94ef41c40843))
- use matchCurrentActionFromText for queue ETA current action detection ([993bbd1](https://github.com/Celasha/Toolasha/commit/993bbd1247c1b87469e8d67d73b0670c92535b3e))

## [2.62.14](https://github.com/Celasha/Toolasha/compare/v2.62.13...v2.62.14) (2026-06-11)

### Code Refactoring

- unify date/time and number formatting across all features ([a4a609e](https://github.com/Celasha/Toolasha/commit/a4a609ea25674412a3c1bf7bdceffe6dbbb2ffa3))

## [2.62.13](https://github.com/Celasha/Toolasha/compare/v2.62.12...v2.62.13) (2026-06-11)

### Bug Fixes

- exclude enhanced items from inventory count and add dynamic toggle ([6103c4f](https://github.com/Celasha/Toolasha/commit/6103c4f01f08b3b24285eea6a4d31e742d0f74aa))

## [2.62.12](https://github.com/Celasha/Toolasha/compare/v2.62.11...v2.62.12) (2026-06-10)

### Bug Fixes

- prevent action filter from clearing panels registered in same mutation batch ([67a706a](https://github.com/Celasha/Toolasha/commit/67a706a5f5d29ded6463dec667b17e9fd0f56605))

## [2.62.11](https://github.com/Celasha/Toolasha/compare/v2.62.10...v2.62.11) (2026-06-09)

### Bug Fixes

- hide newly registered panels that don't match active filter ([8ff33ff](https://github.com/Celasha/Toolasha/commit/8ff33ffccb6c8f4f8337cb23d120726946296184))

## [2.62.10](https://github.com/Celasha/Toolasha/compare/v2.62.9...v2.62.10) (2026-06-08)

### Bug Fixes

- align move buttons in tab editor by rendering hidden placeholders ([e57d6aa](https://github.com/Celasha/Toolasha/commit/e57d6aa6c660f5b75d33232bd74c44e951c8962b))
- crash in \_checkBindingEnhancements when cache is nulled mid-loop ([8b2155e](https://github.com/Celasha/Toolasha/commit/8b2155eb13e839853fdef7dc82c1d83848dcf31f))

## [2.62.9](https://github.com/Celasha/Toolasha/compare/v2.62.8...v2.62.9) (2026-06-08)

### Bug Fixes

- add "Move to bottom" button in custom tab editor ([e47b4cb](https://github.com/Celasha/Toolasha/commit/e47b4cb396e80fc4ba5c119c931817765f94f904))
- preserve scroll position when removing items in tab editor ([d7e0f39](https://github.com/Celasha/Toolasha/commit/d7e0f3957801d1ba99167350cd2241bd062ecef6))
- prevent drag listener accumulation on custom inventory tab tiles ([cae18f3](https://github.com/Celasha/Toolasha/commit/cae18f370b9c3045748d63fee5bdc5bd55a3facf))

## [2.62.8](https://github.com/Celasha/Toolasha/compare/v2.62.7...v2.62.8) (2026-06-07)

### Bug Fixes

- action panel button labels resetting to defaults on page reload ([67ad2a3](https://github.com/Celasha/Toolasha/commit/67ad2a3548871764bdca10591c090ce7a1c18a88))
- hide Scroll Simulation button when setting is disabled ([58c1ef7](https://github.com/Celasha/Toolasha/commit/58c1ef7777b821066cf9c6e5d9db98fd3edfea6e))
- use live networth for rate/hr calculation instead of last snapshot ([ef61b79](https://github.com/Celasha/Toolasha/commit/ef61b79ee40c3e8f3764b392a40f1896a4fb63d4))

## [2.62.7](https://github.com/Celasha/Toolasha/compare/v2.62.6...v2.62.7) (2026-06-07)

### Bug Fixes

- add setting to disable task speed & time breakdown ([363582e](https://github.com/Celasha/Toolasha/commit/363582ed1efc77350fe0645d8c52623922e4dfe3))

## [2.62.6](https://github.com/Celasha/Toolasha/compare/v2.62.5...v2.62.6) (2026-06-07)

### Bug Fixes

- calculate enhancement time correctly when using Philosopher's Mirror ([60b1f2a](https://github.com/Celasha/Toolasha/commit/60b1f2afb672a45e556b4421342b74195139dc6c))
- show expandable speed breakdown on tasks without profit enabled ([7b71d99](https://github.com/Celasha/Toolasha/commit/7b71d9953a1d8bdf819315cc1b0df04918d215f0))

## [2.62.5](https://github.com/Celasha/Toolasha/compare/v2.62.4...v2.62.5) (2026-06-06)

### Bug Fixes

- use ResizeObserver to sync stats layout on hidden→visible tab switches ([84d29fd](https://github.com/Celasha/Toolasha/commit/84d29fd7b4cf9df0d95bb6b00d6bec5f9ef2b403))

## [2.62.4](https://github.com/Celasha/Toolasha/compare/v2.62.3...v2.62.4) (2026-06-06)

### Bug Fixes

- match enhanced items in queue by stripping +N level suffix ([11514be](https://github.com/Celasha/Toolasha/commit/11514beab84ae8156f7fb03dd2fe225c9f78ef8b))
- re-sync action panel marginBottom after layout and tab changes ([c9b9644](https://github.com/Celasha/Toolasha/commit/c9b964408d8d5d549e4bdeea35b67c81f34b52b4))

## [2.62.3](https://github.com/Celasha/Toolasha/compare/v2.62.2...v2.62.3) (2026-06-06)

### Bug Fixes

- add action speed & time breakdown to task profit display ([5ede675](https://github.com/Celasha/Toolasha/commit/5ede675adba889f15c5c624e1d1e2e2b54453252))
- prevent stat line text from briefly shrinking during tab switch ([60b2e03](https://github.com/Celasha/Toolasha/commit/60b2e039ff073bb145cfa934b24c858cb7eafd1b))
- show expected time for repeat-∞ enhancement queue actions ([ab3f26f](https://github.com/Celasha/Toolasha/commit/ab3f26f04869ac67d91c5afdcc4efd5815208d74))

## [2.62.2](https://github.com/Celasha/Toolasha/compare/v2.62.1...v2.62.2) (2026-06-06)

### Bug Fixes

- include task speed bonus in task completion time estimate ([2121c5d](https://github.com/Celasha/Toolasha/commit/2121c5d40219fc3abc2dad93bbfe49d2612ee39b))

## [2.62.1](https://github.com/Celasha/Toolasha/compare/v2.62.0...v2.62.1) (2026-06-06)

### Bug Fixes

- enhancement calculator speed uses manual override params ([2d41428](https://github.com/Celasha/Toolasha/commit/2d4142836b60a977870c3db5cf50e82c76f3d74a))
- respect 24-hour time format setting in action completion times ([1323558](https://github.com/Celasha/Toolasha/commit/1323558f413f5b279c53d01c8b348357f4178994))

## [2.62.0](https://github.com/Celasha/Toolasha/compare/v2.61.5...v2.62.0) (2026-06-06)

### Features

- add "Skip Back" toggle to combat sim upgrade analysis ([5375caf](https://github.com/Celasha/Toolasha/commit/5375caf711e2bd61186ec64f6e13177c15f693ca))

### Bug Fixes

- add effective (after-tax) price display to item tooltips ([10c1cf7](https://github.com/Celasha/Toolasha/commit/10c1cf77eaf39234f8f4738fd1f74f4ef7d9022c))
- exclude magic off-hands from melee upgrade recommendations ([9a11465](https://github.com/Celasha/Toolasha/commit/9a114655f1c04b126d8fd1edaa22186fb974b1ca))
- show labyrinth attempt number in battle counter ([5cbbcf3](https://github.com/Celasha/Toolasha/commit/5cbbcf30160e9d23d8fdb5ca6f2a0d26c4ef47ca))
- use correct config method for labyrinth number settings ([94b0802](https://github.com/Celasha/Toolasha/commit/94b08028b1351a5ae3b8dd8184e14dcb587b564e))
- use full zone data for boss task sim estimates ([8794215](https://github.com/Celasha/Toolasha/commit/8794215ab14b5b9cb66322d36ac389f051b865d3))

## [2.61.5](https://github.com/Celasha/Toolasha/compare/v2.61.4...v2.61.5) (2026-06-04)

### Bug Fixes

- add pricing mode toggle and XP/hr to best crafting plan ([55b1912](https://github.com/Celasha/Toolasha/commit/55b19126df2637cc13191640e5fc599c729862c6))

## [2.61.4](https://github.com/Celasha/Toolasha/compare/v2.61.3...v2.61.4) (2026-06-04)

### Bug Fixes

- initialize order book cache before listing price display ([ffb2779](https://github.com/Celasha/Toolasha/commit/ffb2779e955e58a06b515cbb82c3a1a5f82ee1ae))

## [2.61.3](https://github.com/Celasha/Toolasha/compare/v2.61.2...v2.61.3) (2026-06-04)

### Bug Fixes

- use approximate quantity matching for K/M/B abbreviated listings ([2bb092e](https://github.com/Celasha/Toolasha/commit/2bb092e86d0db816eca4680f586cabe50c6af9a8))

## [2.61.2](https://github.com/Celasha/Toolasha/compare/v2.61.1...v2.61.2) (2026-06-04)

### Bug Fixes

- add diagnostic logging for listing N/A display bug ([f01aed3](https://github.com/Celasha/Toolasha/commit/f01aed3cd99054d0ea9c260f013a7b734eef68a5))

## [2.61.1](https://github.com/Celasha/Toolasha/compare/v2.61.0...v2.61.1) (2026-06-04)

### Bug Fixes

- parse K/M/B suffixes in listing quantity matching ([98400c9](https://github.com/Celasha/Toolasha/commit/98400c92dfabc37e06f5de9cf3b2f0640c327bb6))

## [2.61.0](https://github.com/Celasha/Toolasha/compare/v2.60.0...v2.61.0) (2026-06-03)

### Features

- add item icons to pinned actions overview tab ([e980a16](https://github.com/Celasha/Toolasha/commit/e980a1618c6a392fb2273e69e8b4757eb1adc08d))
- add zone mode for combat task estimates with multi-task aggregate ([91dc511](https://github.com/Celasha/Toolasha/commit/91dc51114282402f130a9812b752813589ebc55f))
- auto-run combat estimates when task cards appear ([6727c0f](https://github.com/Celasha/Toolasha/commit/6727c0fd6298f9571a7f013586c3164c3d10f049))

### Bug Fixes

- add marketplace links to alchemy best items breakdown ([1a83a5d](https://github.com/Celasha/Toolasha/commit/1a83a5d74c22ebc7944a8b48d85fd1ecc858b44d))
- correct Chance Cape (R) HRID in enhancement auto-detect ([463352d](https://github.com/Celasha/Toolasha/commit/463352dd74f58c24424074c470833da1e66f3e30))
- prevent claim reward button from resizing with count ([01656bc](https://github.com/Celasha/Toolasha/commit/01656bcaebdf18e24280eaa33dba99867d4e1be0))

### Miscellaneous Chores

- add diagnostics for custom tab items disappearing on auto-switch ([885d42b](https://github.com/Celasha/Toolasha/commit/885d42b6ded0d978d2629136dc1d10be5a6d33b7))

## [2.60.0](https://github.com/Celasha/Toolasha/compare/v2.59.5...v2.60.0) (2026-06-03)

### Features

- add default loadout setting for combat sim estimates ([7f7d2fa](https://github.com/Celasha/Toolasha/commit/7f7d2fab6051d11d91ebe4cb180e3fec162d846c))
- show efficiency rating on combat task estimates ([d86a727](https://github.com/Celasha/Toolasha/commit/d86a7273c2ac186e1fa8ce335a1534f5d98a9b75))

### Bug Fixes

- detect earrings and back slot in gear scanner, add per-item breakdowns ([3af542d](https://github.com/Celasha/Toolasha/commit/3af542d9859f95ba9e16db5c7671b58062e0bf51))
- prevent combat quick input buttons from duplicating ([5cc9cf1](https://github.com/Celasha/Toolasha/commit/5cc9cf1a540a96e928bb0151722bb7e0612dd043))
- update market item counts when inventory changes ([c460c9c](https://github.com/Celasha/Toolasha/commit/c460c9c44cb0a469dce5846563d72e2f9fe46e81))

## [2.59.5](https://github.com/Celasha/Toolasha/compare/v2.59.4...v2.59.5) (2026-06-02)

### Bug Fixes

- add setting to hide combat estimate on task cards ([569fcdb](https://github.com/Celasha/Toolasha/commit/569fcdb95b00bae29f8b4f01a79ada307900a1b0))
- make enhancement stat breakdowns click-to-expand ([1683f25](https://github.com/Celasha/Toolasha/commit/1683f25a81a6b52103576effaabcd242077c5992))

## [2.59.4](https://github.com/Celasha/Toolasha/compare/v2.59.3...v2.59.4) (2026-06-02)

### Bug Fixes

- add marketplace navigation links to alchemy best items ([48f85ae](https://github.com/Celasha/Toolasha/commit/48f85aee814d2b5780d7f7a06c3746fe93087b3e))
- clear battle counter when switching from combat to skilling ([1047c0b](https://github.com/Celasha/Toolasha/commit/1047c0bbb42c55d679e0368e9d21eeb024dd0e33))
- include skillingRareFind in auto-detect gear calculations ([832ee94](https://github.com/Celasha/Toolasha/commit/832ee94c02b25304c71517ee8010b3d038ba32d4))

### Miscellaneous Chores

- display version number in settings tab title ([c3128f6](https://github.com/Celasha/Toolasha/commit/c3128f649d05dc55f65a0d490e4a77ed6afececc))

## [2.59.3](https://github.com/Celasha/Toolasha/compare/v2.59.2...v2.59.3) (2026-06-02)

### Bug Fixes

- recover WebSocket hook when primary interception fails ([bd538c2](https://github.com/Celasha/Toolasha/commit/bd538c29b2c408025b313c3695b3353a44c968ce))

## [2.59.2](https://github.com/Celasha/Toolasha/compare/v2.59.1...v2.59.2) (2026-06-01)

### Bug Fixes

- correct alchemy action type detection and missing level progress ([5f51513](https://github.com/Celasha/Toolasha/commit/5f51513185e1d4ee9a12d4808a1286bd3b27eb1c))

## [2.59.1](https://github.com/Celasha/Toolasha/compare/v2.59.0...v2.59.1) (2026-05-31)

### Bug Fixes

- action time display flickering due to missing space in parsed action name ([9c158eb](https://github.com/Celasha/Toolasha/commit/9c158eb9156d76e9cb28f30e75518efcf6d2db48))
- preserve alchemy target level calculator input across updates ([35d9409](https://github.com/Celasha/Toolasha/commit/35d9409059bff79226e0a71b0292e9a8b7e85455))

## [2.59.0](https://github.com/Celasha/Toolasha/compare/v2.58.5...v2.59.0) (2026-05-31)

### Features

- add gold-neutral effective XP/hr ranking for best overall action ([7bfa90b](https://github.com/Celasha/Toolasha/commit/7bfa90ba2cb9f7d41ff856a7f467b6f2699b1802))

## [2.58.5](https://github.com/Celasha/Toolasha/compare/v2.58.4...v2.58.5) (2026-05-31)

### Bug Fixes

- decouple action speed/time section from profit detail setting ([8e3793a](https://github.com/Celasha/Toolasha/commit/8e3793a1ed6b8ad98182a64100086cae1221473a))
- preserve target level calculator input across action completions ([a9661fa](https://github.com/Celasha/Toolasha/commit/a9661faa003b8d4804dbd0e96ec269a2ccdd7fea))

## [2.58.4](https://github.com/Celasha/Toolasha/compare/v2.58.3...v2.58.4) (2026-05-30)

### Bug Fixes

- always show all categories in net worth chart tooltip ([9c19648](https://github.com/Celasha/Toolasha/commit/9c1964845ad1043b25fc3fae3fda243a5247449a))

## [2.58.3](https://github.com/Celasha/Toolasha/compare/v2.58.2...v2.58.3) (2026-05-29)

### Bug Fixes

- add cross-slot weapon upgrade suggestions to combat advisor ([1b92f8e](https://github.com/Celasha/Toolasha/commit/1b92f8e12aa15ee14bc6c3f852f3f1eafbcc00cf))
- add quick input count presets to combat action modals ([df5fe78](https://github.com/Celasha/Toolasha/commit/df5fe78ad596a495880851334c1363ff048df00d))
- classify defensiveDamage-only items as defensive in upgrade advisor ([3ba942c](https://github.com/Celasha/Toolasha/commit/3ba942c8d72ec058d5f0be723f1799b26f8bd6ad))
- recommend tooltip now reflects actual target rate used ([e063be5](https://github.com/Celasha/Toolasha/commit/e063be51cf4f8ec8ac6576889754823e1bf6f358))
- sync recommend inputs with saved settings on re-inject ([6e1ec07](https://github.com/Celasha/Toolasha/commit/6e1ec0777e61328e21d550dc9cf394d72609c2da))

### Code Refactoring

- remove skilling buff candidates from combat upgrade analysis ([5446f6a](https://github.com/Celasha/Toolasha/commit/5446f6a451eddc6209352011928f7adf0901b67a))

## [2.58.2](https://github.com/Celasha/Toolasha/compare/v2.58.1...v2.58.2) (2026-05-29)

### Bug Fixes

- clear history now persists across page refresh ([af9a9f1](https://github.com/Celasha/Toolasha/commit/af9a9f154e7b4d198aa40d530fce19e63f4d46c1))

## [2.58.1](https://github.com/Celasha/Toolasha/compare/v2.58.0...v2.58.1) (2026-05-28)

### Bug Fixes

- add resizable lab sim panel and collapsible loadout section ([e1178f5](https://github.com/Celasha/Toolasha/commit/e1178f5d5f13942cde1d61b18ea346e0feb8de89))

## [2.58.0](https://github.com/Celasha/Toolasha/compare/v2.57.1...v2.58.0) (2026-05-28)

### Features

- add per-skill filter for skilling upgrade analysis ([c9091f0](https://github.com/Celasha/Toolasha/commit/c9091f015a3ec8b50e8b13c0d2297769a19387c9))
- add resizable combat simulator panel ([d30d0b8](https://github.com/Celasha/Toolasha/commit/d30d0b86731ee415d841a6990e0331efc55d08d2))
- add transmute recycle time estimate to action timer ([f1bfb84](https://github.com/Celasha/Toolasha/commit/f1bfb849d3c088bb9d8393be1a7e529348d5ebc9))

### Bug Fixes

- prevent skilling editor overlap when upgrade results display ([88b8a54](https://github.com/Celasha/Toolasha/commit/88b8a54b49cbd460ffd025565d6d5f0b712b4827))
- pull skilling loadouts from game lab automation settings ([b212e47](https://github.com/Celasha/Toolasha/commit/b212e473cae738556286a228296ad66e684e4eb7))
- sort upgrade tables by cost efficiency and skip irrelevant slots ([1b4a4b8](https://github.com/Celasha/Toolasha/commit/1b4a4b88441aa60d18238f21d4fa04a3b6749365))

## [2.57.1](https://github.com/Celasha/Toolasha/compare/v2.57.0...v2.57.1) (2026-05-28)

### Bug Fixes

- collection tiles displaced when unfavoriting an item ([ca97fb1](https://github.com/Celasha/Toolasha/commit/ca97fb1aac35a11776881322ff7723aaa85fb928))

## [2.57.0](https://github.com/Celasha/Toolasha/compare/v2.56.0...v2.57.0) (2026-05-28)

### Features

- add skilling room simulation tab to Lab Simulator ([3e85838](https://github.com/Celasha/Toolasha/commit/3e858385c3f68c37ec3650c165885f500687c85c))

### Bug Fixes

- show remaining/total time in live countdown timer ([1606675](https://github.com/Celasha/Toolasha/commit/160667521e33da4b60912e6c53f8b3cf2355ecee))

## [2.56.0](https://github.com/Celasha/Toolasha/compare/v2.55.1...v2.56.0) (2026-05-28)

### Features

- add inline target win rate and sim hours to recommend controls ([63bc8b9](https://github.com/Celasha/Toolasha/commit/63bc8b9dba8232bbf3701a0522a2bb68643f5dff))
- add Tokens/1% column and sortable headers to upgrade tables ([2df1c7a](https://github.com/Celasha/Toolasha/commit/2df1c7a8e27ef0f8ec2339f3298cc19310d7db32))
- use custom loadout order in sim editor dropdowns ([28d0867](https://github.com/Celasha/Toolasha/commit/28d086790848e1160fa8395c3ffae06885c8672d))

### Bug Fixes

- include bulkMultiplier in alchemy coin cost formulas ([4e6d9e2](https://github.com/Celasha/Toolasha/commit/4e6d9e233926c33144677f27c39317ea26e38f69))
- use correct dev-confirmed coin cost formulas for alchemy ([f29d1f4](https://github.com/Celasha/Toolasha/commit/f29d1f46e8fe72c19bb48c37575247b8420436df))

## [2.55.1](https://github.com/Celasha/Toolasha/compare/v2.55.0...v2.55.1) (2026-05-27)

### Bug Fixes

- match action bar display against front action by ordinal ([7149e1a](https://github.com/Celasha/Toolasha/commit/7149e1a202a6a337c2e9896f4e4b9fb8fcf8ebce))

## [2.55.0](https://github.com/Celasha/Toolasha/compare/v2.54.0...v2.55.0) (2026-05-27)

### Features

- add favorites section to collection panel ([65f9b0c](https://github.com/Celasha/Toolasha/commit/65f9b0c29acdbf7f41c358dc3427fd3b2449f2a1))

### Bug Fixes

- correct lab sim win rate to use attempt count ([735d34d](https://github.com/Celasha/Toolasha/commit/735d34d60b8b9cfdeadc45d3379bae549d5a9fc6))
- decouple task timing and materials from profit display setting ([5b09b73](https://github.com/Celasha/Toolasha/commit/5b09b73d2ad996e8c2e0d0b91313d85d67ef953c))
- improve action bar info reliability and alchemy cost calculation ([dded17b](https://github.com/Celasha/Toolasha/commit/dded17ba0992f0575060b18f8e1ba5c056d6928c))
- prevent queue monitor race from showing stale snapshots ([e03375b](https://github.com/Celasha/Toolasha/commit/e03375bcf883699ceba12f3d5907a9dd6da2a878))
- scale labyrinth token upgrade costs by level ([9875ca8](https://github.com/Celasha/Toolasha/commit/9875ca8d03c24e281294bd1143c5e8f8e27ab9d9))
- strip equipped food and drinks from labyrinth simulations ([457f75e](https://github.com/Celasha/Toolasha/commit/457f75e1dd75de310152e7d62abf5b3754d23a41))

## [2.54.0](https://github.com/Celasha/Toolasha/compare/v2.53.1...v2.54.0) (2026-05-26)

### Features

- add task auto-reroll reminder ([4bd3267](https://github.com/Celasha/Toolasha/commit/4bd326792cada05301f416ac530dbcf2540690a4))
- persist and display historical loot log entries ([0739f97](https://github.com/Celasha/Toolasha/commit/0739f97a8d6f6442c485c275fc0df604d7e191e3))

### Bug Fixes

- correct parameter passing in lab simulator max level search ([aedc6c5](https://github.com/Celasha/Toolasha/commit/aedc6c5940362001c739a79c79c4cd1afd334df1))
- refresh action bar stats when actions_updated arrives ([a8f7da9](https://github.com/Celasha/Toolasha/commit/a8f7da95d8416e8fd058934020715764817e220f))
- write queue snapshots immediately to prevent stale data on re-init ([640ba90](https://github.com/Celasha/Toolasha/commit/640ba900207626eff56371ef82d0ee78fec3160d))

## [2.53.1](https://github.com/Celasha/Toolasha/compare/v2.53.0...v2.53.1) (2026-05-25)

### Bug Fixes

- use additive formula for alchemy success rate with catalyst and tea ([4fd39f9](https://github.com/Celasha/Toolasha/commit/4fd39f91362861f329ffac745851d177493fc3d2))

## [2.53.0](https://github.com/Celasha/Toolasha/compare/v2.52.1...v2.53.0) (2026-05-25)

### Features

- add ÷2 and ×2 multiplier buttons to marketplace order dialogs ([d2c288f](https://github.com/Celasha/Toolasha/commit/d2c288f8071f5cd41174b8120009dcc04a264090))
- add labyrinth clear rate calculator with tooltips, recommendations, and live progress ([15eefb8](https://github.com/Celasha/Toolasha/commit/15eefb8fc774411abe8dfda40b6969b4bfe5be54))
- adjust tooltip prices for Artisan Tea material reduction ([ed3ade8](https://github.com/Celasha/Toolasha/commit/ed3ade872856def0b0a6a10e54f482489ff6f8c3))
- show owned item count in buy marketplace dialogs ([c4295cf](https://github.com/Celasha/Toolasha/commit/c4295cfbb747e4ada0864988783451054bdfbd8d))
- split combat sim into separate Combat Sim and Lab Sim dialogs ([0fc8ecd](https://github.com/Celasha/Toolasha/commit/0fc8ecdc000c8d9146e6639d16a38d12c56a1b9c))

### Bug Fixes

- alchemy tooltip per-action profit now includes tea costs and bonus drops ([c0157e9](https://github.com/Celasha/Toolasha/commit/c0157e9ad23123545e33b8a0bfc42fb719ce6777))
- restore action bar display when starting new actions after character switch ([3b2a9b0](https://github.com/Celasha/Toolasha/commit/3b2a9b0665dfb3ea671631462cb4346426de8b1c))
- update item level overlay when enhancement selector changes items ([987728e](https://github.com/Celasha/Toolasha/commit/987728e20c9119a9524d320f248e6fbf6a5dd7a6))
- use itemLevel instead of equip requirement for enhancement calculations ([27a6a36](https://github.com/Celasha/Toolasha/commit/27a6a36441bc162238a91f1b84f7cc734884a8fe))

## [2.52.1](https://github.com/Celasha/Toolasha/compare/v2.52.0...v2.52.1) (2026-05-23)

### Bug Fixes

- add individual toggles for skill page filter bar elements ([64fa177](https://github.com/Celasha/Toolasha/commit/64fa177d237e83f8770e25ff44ed191735234e54))

## [2.52.0](https://github.com/Celasha/Toolasha/compare/v2.51.3...v2.52.0) (2026-05-23)

### Features

- add option to hide item tooltips in enhance selector ([41ec17f](https://github.com/Celasha/Toolasha/commit/41ec17f62efa8239752a2d66b268a1a68c006744))

## [2.51.3](https://github.com/Celasha/Toolasha/compare/v2.51.2...v2.51.3) (2026-05-23)

### Bug Fixes

- remove double-counted catalyst cost from alchemy profit/hr ([00f7fdf](https://github.com/Celasha/Toolasha/commit/00f7fdfab8a0870ea43e1e81a2af6d741479ffce))

## [2.51.2](https://github.com/Celasha/Toolasha/compare/v2.51.1...v2.51.2) (2026-05-22)

### Bug Fixes

- include boss drops in combat sim Seek item list ([67ae395](https://github.com/Celasha/Toolasha/commit/67ae395c333a7023093778be781e922ede17d387))

## [2.51.1](https://github.com/Celasha/Toolasha/compare/v2.51.0...v2.51.1) (2026-05-22)

### Bug Fixes

- restore total action time when countdown is disabled ([a87f195](https://github.com/Celasha/Toolasha/commit/a87f195445947cd190601c8c210055e4019000dc))

### Code Refactoring

- replace action bar preset modes with granular toggles ([c95f106](https://github.com/Celasha/Toolasha/commit/c95f10623611436209145567bb5d777c095294e1))

## [2.51.0](https://github.com/Celasha/Toolasha/compare/v2.50.2...v2.51.0) (2026-05-21)

### Features

- add "Return to Action" tab in missing materials marketplace ([4d3fc7d](https://github.com/Celasha/Toolasha/commit/4d3fc7dd5ad57b73634ee9a5f476b27f392e9b9d))
- add expandable profit breakdown to alchemy Best Items rows ([bc2c0a6](https://github.com/Celasha/Toolasha/commit/bc2c0a63a6ed3f812455822373642761a75490ed))

### Bug Fixes

- use precise formatting for listing price columns ([80c497b](https://github.com/Celasha/Toolasha/commit/80c497b89259268909235351adfd9da797e0b106))

## [2.50.2](https://github.com/Celasha/Toolasha/compare/v2.50.1...v2.50.2) (2026-05-21)

### Bug Fixes

- refresh pinned actions page immediately when pins change ([5d8b11c](https://github.com/Celasha/Toolasha/commit/5d8b11c88dae336648ba64db8f9215e232742aa6))

### Performance Improvements

- memoize craft chain calculations and replace recursive fibonacci ([d047c54](https://github.com/Celasha/Toolasha/commit/d047c54c969d61fbc858b163dcf658048cd61f29))

## [2.50.1](https://github.com/Celasha/Toolasha/compare/v2.50.0...v2.50.1) (2026-05-20)

### Bug Fixes

- avoid double-wrapping WebSocket when other userscripts are present ([f966430](https://github.com/Celasha/Toolasha/commit/f966430b98d183273e1638895ca5ff0f99779bbc))
- show limiting material icon on active action timer ([3ed1db6](https://github.com/Celasha/Toolasha/commit/3ed1db6eb6279a37ddaf2636f3e95cd0a7a32e28))

## [2.50.0](https://github.com/Celasha/Toolasha/compare/v2.49.3...v2.50.0) (2026-05-20)

### Features

- add pin icon to alchemy actions for item-specific pinning ([eb77a5e](https://github.com/Celasha/Toolasha/commit/eb77a5e7b1057c205d00780517bccbd07a5a35ee))

### Bug Fixes

- check gold and catalyst limits in alchemy depletion timer ([420bec3](https://github.com/Celasha/Toolasha/commit/420bec3f1c6ed226a8718460d53685cfd88eabc0))

## [2.49.3](https://github.com/Celasha/Toolasha/compare/v2.49.2...v2.49.3) (2026-05-20)

### Bug Fixes

- include enhancement level in badge manager inventory lookup key ([f6a3832](https://github.com/Celasha/Toolasha/commit/f6a38323cff5d7fce8750105d1fbb7634d25b7a2))
- replace own-property anti-loop with WeakSet guard in WS hook ([cce3f2b](https://github.com/Celasha/Toolasha/commit/cce3f2be30e6e44074deac4153b6a2edde9ddd5c))
- use setSetting for craft toggle button ([107f943](https://github.com/Celasha/Toolasha/commit/107f943b93a087d5c7c8e26d1f30f5dc99e5771a))

## [2.49.2](https://github.com/Celasha/Toolasha/compare/v2.49.1...v2.49.2) (2026-05-19)

### Bug Fixes

- deduct key cost from chest badge values ([33f6de2](https://github.com/Celasha/Toolasha/commit/33f6de27b67f5d9bba7c1ca7d2dd8e0810e401e0))

### Code Refactoring

- add craft toggle button to action panel ([bd77461](https://github.com/Celasha/Toolasha/commit/bd774618be0c26540dad000b67657967b36a74f8))

## [2.49.1](https://github.com/Celasha/Toolasha/compare/v2.49.0...v2.49.1) (2026-05-19)

### Bug Fixes

- include crafting chain time in profit/hr for upgrade items ([0f656d6](https://github.com/Celasha/Toolasha/commit/0f656d69542d8002832dc6a7470a0705ca385181))

## [2.49.0](https://github.com/Celasha/Toolasha/compare/v2.48.3...v2.49.0) (2026-05-19)

### Features

- add colored delta indicators to net worth chart tooltip ([4638dd5](https://github.com/Celasha/Toolasha/commit/4638dd5e3d114ac841482286b0875d5dfbd590c0))
- auto-calculate optimal protection for enhancement missing mats ([a423a44](https://github.com/Celasha/Toolasha/commit/a423a44f53f7bcc47ed8fdab9d8e926695202333))

### Bug Fixes

- guard against null skills in auto-detected enhancement params ([6c7ad15](https://github.com/Celasha/Toolasha/commit/6c7ad15f39d1d1afdb9d2dc487edd43956fcd40f))
- improve enhancement tooltip protection labels ([eb8843d](https://github.com/Celasha/Toolasha/commit/eb8843dad53a9d3f6a5dbb2c28c65d65a62434a2))

## [2.48.3](https://github.com/Celasha/Toolasha/compare/v2.48.2...v2.48.3) (2026-05-18)

### Bug Fixes

- add ring, earring, and speed necklace to enhancement simulator ([a182d46](https://github.com/Celasha/Toolasha/commit/a182d46ea32e6e14d449ff628717c3ca219fb64e))
- protect Add to Queue button in alchemy action protection ([1794bb6](https://github.com/Celasha/Toolasha/commit/1794bb6295bb4083574cbdccb78ffded2245f1df))
- reposition alchemy protection shield above item icon box ([b6f95cb](https://github.com/Celasha/Toolasha/commit/b6f95cbb6f41689a8fba12efdf47978573ec6d95))
- update housing missing mats display when room level changes ([e375cff](https://github.com/Celasha/Toolasha/commit/e375cff2cec5e779dc0cd26ee8a265ae44ab6ac4))
- use correct property name for item tradeability checks ([bb6bcd3](https://github.com/Celasha/Toolasha/commit/bb6bcd3cae283c4daac6ff108de88bc3a889b886))

### Styles

- reduce alchemy protection popup spacing to avoid scrolling ([75d9342](https://github.com/Celasha/Toolasha/commit/75d934237811833044fadceb92d1bc6daaefe25d))

## [2.48.2](https://github.com/Celasha/Toolasha/compare/v2.48.1...v2.48.2) (2026-05-18)

### Bug Fixes

- show buy vs craft label on upgrade items in tooltip ([a3039c9](https://github.com/Celasha/Toolasha/commit/a3039c945d388b646d2f429cb15326e60debc793))

## [2.48.1](https://github.com/Celasha/Toolasha/compare/v2.48.0...v2.48.1) (2026-05-18)

### Bug Fixes

- use blob URL for popout chat to prevent Firefox game disconnect ([7c6230f](https://github.com/Celasha/Toolasha/commit/7c6230fcb4b984bcab44d3f5f812cb2bbb07f5bc))
- use min(market, craft) for upgrade items in tooltip material cost ([0fba5bb](https://github.com/Celasha/Toolasha/commit/0fba5bbf50a6024fbafdfb1ec02534ec92b23952))

## [2.48.0](https://github.com/Celasha/Toolasha/compare/v2.47.5...v2.48.0) (2026-05-17)

### Features

- add alchemy action protection for item categories ([b5abb5f](https://github.com/Celasha/Toolasha/commit/b5abb5fd97222ea14aceaa25e3474a36f1203279))

### Bug Fixes

- hide action queue profit display in iron cow mode ([5b9f86e](https://github.com/Celasha/Toolasha/commit/5b9f86ed26ba29051be278942c08a653f28a5712))

### Miscellaneous Chores

- add comprehensive debugging to chat popout for Firefox issue ([19bcb1d](https://github.com/Celasha/Toolasha/commit/19bcb1da22bfa4278ec41c2ebf258ef97621438d))

## [2.47.5](https://github.com/Celasha/Toolasha/compare/v2.47.4...v2.47.5) (2026-05-17)

### Bug Fixes

- include houses, abilities, and listings in 24h networth breakdown ([f8c33ce](https://github.com/Celasha/Toolasha/commit/f8c33ce5f876e322d389e376c2d0118740474a5e))

## [2.47.4](https://github.com/Celasha/Toolasha/compare/v2.47.3...v2.47.4) (2026-05-17)

### Bug Fixes

- clear combat sim cached state on destroy to prevent stale data after character switch ([1e74b18](https://github.com/Celasha/Toolasha/commit/1e74b182adcaa0f158f07bfc5f454c460bdf25de))
- separate gold from inventory in chart breakdown and prevent popout from closing chart ([7bba3c9](https://github.com/Celasha/Toolasha/commit/7bba3c92aa04b13317fb47e116a9c492beee23d9))
- use cheaper of market vs craft cost for upgrade items in production cost ([e5febe3](https://github.com/Celasha/Toolasha/commit/e5febe33fb74c70153bb20f52de949877375d1ec))

## [2.47.3](https://github.com/Celasha/Toolasha/compare/v2.47.2...v2.47.3) (2026-05-17)

### Bug Fixes

- remove orphaned timer element before creating new display panel ([40146c6](https://github.com/Celasha/Toolasha/commit/40146c6d62ad96a4fde390b45070e8fca043fbd7))

## [2.47.2](https://github.com/Celasha/Toolasha/compare/v2.47.1...v2.47.2) (2026-05-17)

### Bug Fixes

- exclude filter flags from buildFlags when filters setting is disabled ([a501f12](https://github.com/Celasha/Toolasha/commit/a501f12b4e402fe516f3b83918fcb0903bc4372d))
- use standard enhancement multiplier for XP bonus calculations ([06c2fd7](https://github.com/Celasha/Toolasha/commit/06c2fd70b0a7ecaa59693c2ec8c6b444943a6465))

## [2.47.1](https://github.com/Celasha/Toolasha/compare/v2.47.0...v2.47.1) (2026-05-16)

### Bug Fixes

- add charm slot and missing wisdom sources to enhancement sim ([c9bc783](https://github.com/Celasha/Toolasha/commit/c9bc783ee70f26d3f8dc0b7d4569d419cef81478))
- use auto-detected stats for untradeable item enhancement paths ([91a41eb](https://github.com/Celasha/Toolasha/commit/91a41ebfa9792f724350e1cac963b6dabb987f02))
- use live tab data for missing mats buy quantity autofill ([c8cb565](https://github.com/Celasha/Toolasha/commit/c8cb565f6648faebecd3982b3f87539c1d683ba7))

## [2.47.0](https://github.com/Celasha/Toolasha/compare/v2.46.1...v2.47.0) (2026-05-16)

### Features

- add custom quick input presets for marketplace dialogs ([6625952](https://github.com/Celasha/Toolasha/commit/66259523701fe0a8d2e4d7d13fb14651fa3bb681))

### Bug Fixes

- add toggle to exclude cowbell value from EV calculations ([b41bdde](https://github.com/Celasha/Toolasha/commit/b41bdde53d7b2b5a4c8fc89ab986e66a847c2d25))
- split collection filters and favorites into independent settings ([347c288](https://github.com/Celasha/Toolasha/commit/347c28827494f71415abba9a0cc0259e1966ba11))

## [2.46.1](https://github.com/Celasha/Toolasha/compare/v2.46.0...v2.46.1) (2026-05-15)

### Bug Fixes

- resolve PFormance empty data in library-split production build ([273b997](https://github.com/Celasha/Toolasha/commit/273b997214dbf9719541b6d2447285adbd4e0829))

## [2.46.0](https://github.com/Celasha/Toolasha/compare/v2.45.1...v2.46.0) (2026-05-15)

### Features

- add increment-based ability level targeting to upgrade advisor ([cdb0677](https://github.com/Celasha/Toolasha/commit/cdb0677f42d65ee15fe99c7483dee0f1e5131722))
- add PFormance panel and fix ability book cost calculation ([a23127d](https://github.com/Celasha/Toolasha/commit/a23127d3d6ee1a2f39a4fda95b9d7e4fc8cda021))

### Performance Improvements

- gate PFormance monitoring to only run when panel is open ([f7ad9f6](https://github.com/Celasha/Toolasha/commit/f7ad9f659dbc37be4e774a5b28f2498f86988937))

## [2.45.1](https://github.com/Celasha/Toolasha/compare/v2.45.0...v2.45.1) (2026-05-15)

### Bug Fixes

- populate auto-detected enhancement values on settings panel open ([24ff25c](https://github.com/Celasha/Toolasha/commit/24ff25cfc1ffb7db59e651c73716df7c9fbfa30d))

## [2.45.0](https://github.com/Celasha/Toolasha/compare/v2.44.1...v2.45.0) (2026-05-15)

### Features

- add live countdown timer to action progress bar ([a01b93d](https://github.com/Celasha/Toolasha/commit/a01b93d2a90d832ffc90c86802816a1046a172c5))

### Bug Fixes

- add equipment and ability picker dropdowns to combat sim ([bd4dcde](https://github.com/Celasha/Toolasha/commit/bd4dcde231918e0c3d5b795cba154042ca4a963a))
- detect achievement and community buff in enhancement auto-detect ([6bdebde](https://github.com/Celasha/Toolasha/commit/6bdebde1f9623d249186e18e85ccb7664c084042))
- prevent chat popout from loading full game URL in Firefox ([4c6ff67](https://github.com/Celasha/Toolasha/commit/4c6ff67ed9830968d29cc4324b70afceb8a82df0))
- update housing missing mats marketplace tabs on inventory change ([0d3888a](https://github.com/Celasha/Toolasha/commit/0d3888a0972797787cbe04c56fdcd3b713ce2812))
- use centered moving average for networth chart ([444bf8f](https://github.com/Celasha/Toolasha/commit/444bf8fb8e2692a204b9ef41bc43652e968c3726))

## [2.44.1](https://github.com/Celasha/Toolasha/compare/v2.44.0...v2.44.1) (2026-05-14)

### Bug Fixes

- recreate action timer display when React re-renders orphan it ([c5215de](https://github.com/Celasha/Toolasha/commit/c5215de2cdb6b0e92d4c34724d56e66a0b19cf07))

## [2.44.0](https://github.com/Celasha/Toolasha/compare/v2.43.0...v2.44.0) (2026-05-12)

### Features

- auto-sync custom tab items when loadout equipment changes ([2aea8f9](https://github.com/Celasha/Toolasha/commit/2aea8f9418dc1ab58794274d038b6a0ad1ab6467))
- auto-update bindings and snapshots when higher enhancement is acquired ([e51274a](https://github.com/Celasha/Toolasha/commit/e51274a91e39bc07597a1632b48eff72c1e50525))

### Bug Fixes

- export all Toolasha settings and filter imports by character ID ([7852573](https://github.com/Celasha/Toolasha/commit/7852573ce96459b44e645fd13073bf2d25141662))
- floating point precision in enhancement calculator level display ([577b8fa](https://github.com/Celasha/Toolasha/commit/577b8fabf2bbba95650a3e16e30a7cdda22ff14c))
- handle enhancement downgrades when higher version is sold ([e18ef23](https://github.com/Celasha/Toolasha/commit/e18ef23b0021c2b801f72705287d16b42c2fbe2f))
- update housing missing mats display when inventory changes ([99f0e54](https://github.com/Celasha/Toolasha/commit/99f0e54ebc81db2fd3689b941c495d57fbae0cf9))
- use all learned ability levels when applying loadout ([10cd391](https://github.com/Celasha/Toolasha/commit/10cd3914967324ef8c54d04d9048675f64b45bad))

### Code Refactoring

- replace raw enhancement sim inputs with gear-based settings ([8a15d64](https://github.com/Celasha/Toolasha/commit/8a15d64df657a7ea8d95bb50636437309e74af58))

## [2.43.0](https://github.com/Celasha/Toolasha/compare/v2.42.3...v2.43.0) (2026-05-11)

### Features

- add labyrinth combat simulator ([68ada69](https://github.com/Celasha/Toolasha/commit/68ada69e9bfd9dbb6b565b5b35efdb9cb7a2b50a))

## [2.42.3](https://github.com/Celasha/Toolasha/compare/v2.42.2...v2.42.3) (2026-05-11)

### Performance Improvements

- optimize fury stack calculations in combat sim ([ca2ebe3](https://github.com/Celasha/Toolasha/commit/ca2ebe371ed45a894efedcb90e96565c3d03d89b))

## [2.42.2](https://github.com/Celasha/Toolasha/compare/v2.42.1...v2.42.2) (2026-05-10)

### Bug Fixes

- exclude enhanced items when counting enhancement protection materials ([853f416](https://github.com/Celasha/Toolasha/commit/853f41675ca73002489704ec5c8ae3406bef52f3))
- show each enhancement level separately in exclude list ([7ba4a46](https://github.com/Celasha/Toolasha/commit/7ba4a4626b3e5ef37d3bbedb7b0f078e19f41e11))

## [2.42.1](https://github.com/Celasha/Toolasha/compare/v2.42.0...v2.42.1) (2026-05-10)

### Bug Fixes

- use auto-detected enhancing stats for back slot upgrade costs ([f3b4803](https://github.com/Celasha/Toolasha/commit/f3b480372f2a8c12c7badb0ef1070e62879bc3c3))

## [2.42.0](https://github.com/Celasha/Toolasha/compare/v2.41.6...v2.42.0) (2026-05-10)

### Features

- add ability upgrade testing and revamp results display in combat sim ([1fbf4c3](https://github.com/Celasha/Toolasha/commit/1fbf4c3c7546115e3d19dc732c9cfa3a5cba49ba))
- add search and price/profit filters to alchemy best items ([c689870](https://github.com/Celasha/Toolasha/commit/c689870b2a4aefa4adf3c26194c2cae4f4f87bce))
- add slot-specific enhancement breakpoints for upgrade advisor ([7d745ce](https://github.com/Celasha/Toolasha/commit/7d745ce678b9fb82affd92c7b5e4f812f620675b))

### Bug Fixes

- prevent chart from closing when clicking delete point popup ([4c1840a](https://github.com/Celasha/Toolasha/commit/4c1840a5c0c6228e874bd57279e3d8c54d8d593e))
- use crafting chain for defensive equipment tier upgrades in combat sim ([9341c99](https://github.com/Celasha/Toolasha/commit/9341c9972a89ee0b6e60e154b65c72efaa65dae9))

## [2.41.6](https://github.com/Celasha/Toolasha/compare/v2.41.5...v2.41.6) (2026-05-10)

### Bug Fixes

- add 48h, 7d, and custom duration options to chart moving average ([443a21f](https://github.com/Celasha/Toolasha/commit/443a21f36de68d8fff29832c774138b181ddfa56))
- factor alchemy success rate into estimated output totals ([81cb107](https://github.com/Celasha/Toolasha/commit/81cb107e6c837b35a42efe9cf9fc5ca86c838913))
- prevent bar chart whitespace and y-axis starting at zero ([4052653](https://github.com/Celasha/Toolasha/commit/4052653db99016dfa037a9308c2eaa701bc9b85b))
- prioritize selected tab over queued action in tea optimizer ([df92d56](https://github.com/Celasha/Toolasha/commit/df92d56c45371e15b95d3bbea6b79e2d68cfe693))

## [2.41.5](https://github.com/Celasha/Toolasha/compare/v2.41.4...v2.41.5) (2026-05-09)

### Bug Fixes

- use action category to identify processing instead of input count ([400ea88](https://github.com/Celasha/Toolasha/commit/400ea887fcaf01ac33c75bd51da2591dc156b466))

## [2.41.4](https://github.com/Celasha/Toolasha/compare/v2.41.3...v2.41.4) (2026-05-09)

### Bug Fixes

- open marketplace with material tabs instead of just first item ([9ff7daf](https://github.com/Celasha/Toolasha/commit/9ff7daf9efda3042a67dae417c6416aa03fad366))

## [2.41.3](https://github.com/Celasha/Toolasha/compare/v2.41.2...v2.41.3) (2026-05-09)

### Bug Fixes

- use game shop price in crafting plan when cheaper than market ([f0e95bf](https://github.com/Celasha/Toolasha/commit/f0e95bfb22ad12dba49d3b75512128cd61057def))

## [2.41.2](https://github.com/Celasha/Toolasha/compare/v2.41.1...v2.41.2) (2026-05-09)

### Bug Fixes

- use action-based filter for no-processing instead of depth limit ([61369d7](https://github.com/Celasha/Toolasha/commit/61369d738f80a4b9f116ee9a20eff05ebe36a86f))

## [2.41.1](https://github.com/Celasha/Toolasha/compare/v2.41.0...v2.41.1) (2026-05-09)

### Bug Fixes

- prioritize maxActionCountInput over generic number input lookup ([8b7e8fa](https://github.com/Celasha/Toolasha/commit/8b7e8fa67c372236aa0b4a69a5e52c506bca7e4d))

## [2.41.0](https://github.com/Celasha/Toolasha/compare/v2.40.7...v2.41.0) (2026-05-09)

### Features

- add task mode, no processing, and missing mats button to crafting plan ([8a8f96a](https://github.com/Celasha/Toolasha/commit/8a8f96a1a86521a8dd8200bb528dfa1e9d8c4639))
- add time cost factor to crafting plan buy-vs-craft decisions ([51e0966](https://github.com/Celasha/Toolasha/commit/51e096633e36b71bbe95e4b413d5d57b4e8ec90b))

### Bug Fixes

- add setting to hide green highlight on protected tasks ([1f322ae](https://github.com/Celasha/Toolasha/commit/1f322ae40816272d9ce6b280ef392bb9935ec7c7))
- clear autofill quantity after single use in buy modals ([8c99961](https://github.com/Celasha/Toolasha/commit/8c99961c16fb8478c296de255a72a331e2f7f71f))
- restrict action header match to current action only ([b5671c7](https://github.com/Celasha/Toolasha/commit/b5671c78fbec5c7c0e06ff8b0bd692a3f13ce0f9))

## [2.40.7](https://github.com/Celasha/Toolasha/compare/v2.40.6...v2.40.7) (2026-05-08)

### Bug Fixes

- correct combat level formula for party level gap debuff ([7a51549](https://github.com/Celasha/Toolasha/commit/7a515498e6698971150c1f56b98cf0ab2f87dba9))

## [2.40.6](https://github.com/Celasha/Toolasha/compare/v2.40.5...v2.40.6) (2026-05-07)

### Bug Fixes

- use incremental cost approach for upgrade advisor enhancement pricing ([0fa2275](https://github.com/Celasha/Toolasha/commit/0fa22753e2f57489fbd50408e1d30a9501feadd5))

## [2.40.5](https://github.com/Celasha/Toolasha/compare/v2.40.4...v2.40.5) (2026-05-07)

### Bug Fixes

- use direct market lookups for upgrade advisor cost to prevent false zero costs ([56d7281](https://github.com/Celasha/Toolasha/commit/56d72818a42c1c753f9945ef5863ba56e3b386a2))

## [2.40.4](https://github.com/Celasha/Toolasha/compare/v2.40.3...v2.40.4) (2026-05-07)

### Bug Fixes

- handle null market prices in upgrade advisor fallback and add debug logging ([0691b78](https://github.com/Celasha/Toolasha/commit/0691b781e3a2877a6345579ec3c85f817e96168f))

## [2.40.3](https://github.com/Celasha/Toolasha/compare/v2.40.2...v2.40.3) (2026-05-07)

### Bug Fixes

- correct upgrade advisor enhancement cost fallback pricing ([4635e80](https://github.com/Celasha/Toolasha/commit/4635e806e3e383d71e0e2ab6948e332e3e30e4e4))

## [2.40.2](https://github.com/Celasha/Toolasha/compare/v2.40.1...v2.40.2) (2026-05-07)

### Bug Fixes

- use market price deltas for upgrade advisor cost calculation ([6b9cc7d](https://github.com/Celasha/Toolasha/commit/6b9cc7da4769af04d176b8718c989c6d6795bd03))

## [2.40.1](https://github.com/Celasha/Toolasha/compare/v2.40.0...v2.40.1) (2026-05-07)

### Bug Fixes

- distinguish magic elements in upgrade advisor tier comparisons ([d4892f9](https://github.com/Celasha/Toolasha/commit/d4892f90637ae08b9849808bcf2c1b80249cf0ea))

## [2.40.0](https://github.com/Celasha/Toolasha/compare/v2.39.5...v2.40.0) (2026-05-07)

### Features

- add combat sim upgrade advisor tab ([a3fe6a4](https://github.com/Celasha/Toolasha/commit/a3fe6a4f849ccff0cc1843bf82469dd71644905b))
- add setting to show dungeon completion time as decimal minutes ([064d645](https://github.com/Celasha/Toolasha/commit/064d6454ad0283f66173f7a8b23965adbfd668e0))

### Bug Fixes

- allow disabling currency token tooltips setting ([c4a2941](https://github.com/Celasha/Toolasha/commit/c4a29415ca506f72bc579f1e1676e22e0b78a911))
- correct dungeon sim profit calculation and comparison deltas ([4aa724e](https://github.com/Celasha/Toolasha/commit/4aa724e764f6f421171073bf966862f386345cc8))
- use correct storage method and key in settings reset ([6fcc73e](https://github.com/Celasha/Toolasha/commit/6fcc73e4e8b669317bc05151df5451ed243e82d4))
- use index 0 for best bid in listing price display ([cf864be](https://github.com/Celasha/Toolasha/commit/cf864bece8e9e7c456ed4561ee7b9bea947e35bf))

## [2.39.5](https://github.com/Celasha/Toolasha/compare/v2.39.4...v2.39.5) (2026-05-07)

### Bug Fixes

- correct 11 combat sim engine discrepancies vs reference implementation ([8e6bbc3](https://github.com/Celasha/Toolasha/commit/8e6bbc36a7c3d56cfe6fa82529cfdb373fbf0a20))
- remove premature storage read in networth chart constructor ([3c8c485](https://github.com/Celasha/Toolasha/commit/3c8c485a705fc94c009fabd339a68b9972d43af2))

## [2.39.4](https://github.com/Celasha/Toolasha/compare/v2.39.3...v2.39.4) (2026-05-07)

### Bug Fixes

- aggregate healingAmplify from buffs in combat sim ([7620a76](https://github.com/Celasha/Toolasha/commit/7620a764955bef03b1defc0305b200f7d74c870b))

## [2.39.3](https://github.com/Celasha/Toolasha/compare/v2.39.2...v2.39.3) (2026-05-06)

### Bug Fixes

- close net worth chart on click outside ([e90306b](https://github.com/Celasha/Toolasha/commit/e90306bd176035bf5b837098522be889712cf4e0))
- limit gear score setting scope to only hide score display ([63d8aaa](https://github.com/Celasha/Toolasha/commit/63d8aaaa66886899c51f9acce179ca9e72e27f12))
- resolve intermittent time-to-level tooltip not appearing ([86bdd20](https://github.com/Celasha/Toolasha/commit/86bdd204934efe459573c594249f987c31545c73))

## [2.39.2](https://github.com/Celasha/Toolasha/compare/v2.39.1...v2.39.2) (2026-05-06)

### Bug Fixes

- force full rebuild after drag-and-drop tile operations ([eb42a34](https://github.com/Celasha/Toolasha/commit/eb42a34a59aab942ed4a29d8340ec345f3c39877))
- limit pin-to-top positioning to item and collection tooltips only ([1df6dae](https://github.com/Celasha/Toolasha/commit/1df6dae167aed72b96aa65401318088fffe84922))
- prevent chest EV display from being blocked by disabled price setting ([690726b](https://github.com/Celasha/Toolasha/commit/690726b22a8b750ca5c917807c203a832f8cbb68))
- restore skill calculator on Shykai page via GM storage fallback ([4522ae6](https://github.com/Celasha/Toolasha/commit/4522ae60e9b0df754954901c27a7e6336199c362))
- show unclaimed enhanced items in Unorganized bucket ([d47a649](https://github.com/Celasha/Toolasha/commit/d47a649174f07fae6c61fbdc1528e6e82520d73e))

## [2.39.1](https://github.com/Celasha/Toolasha/compare/v2.39.0...v2.39.1) (2026-05-06)

### Bug Fixes

- resolve missing enhancement levels in loadout-based combat sim export ([fcb3c4e](https://github.com/Celasha/Toolasha/commit/fcb3c4ed9975bfab3d44a273508f435040dd9cee))

## [2.39.0](https://github.com/Celasha/Toolasha/compare/v2.38.5...v2.39.0) (2026-05-06)

### Features

- add drag and drop for custom inventory tab items ([3af3d37](https://github.com/Celasha/Toolasha/commit/3af3d37e673f872a283f9193f1899b091020d692))

### Bug Fixes

- ceil books needed calculation and guard null trigger dependencies ([3fec882](https://github.com/Celasha/Toolasha/commit/3fec882aaeb3b552cb7018729bf969f3ec019d89))
- correct custom tab tile claiming order for collapsed tabs ([1ea9817](https://github.com/Celasha/Toolasha/commit/1ea9817ec5d99a80797a163c389ac21c6a3f1707))
- decouple listing total price colors from shared color settings ([43e3c1c](https://github.com/Celasha/Toolasha/commit/43e3c1c85e1cb413113efb1608b0cd93d24615ff))
- display house rooms in combat sim Configure tab ([678d547](https://github.com/Celasha/Toolasha/commit/678d547ad859766029d2e4084844140b7cbf4af8))
- pin-top tooltip positioning at low browser zoom levels ([a1f22fe](https://github.com/Celasha/Toolasha/commit/a1f22fe2dab6c4d92782a0f510f77f718bd02e40))
- use live equipment Map to preserve enhancement levels in sim export ([12dd6f7](https://github.com/Celasha/Toolasha/commit/12dd6f7770af2deecf4d5cb2c6b5414693c29902))
- use stored duration when loading combat stats from previous session ([d93411f](https://github.com/Celasha/Toolasha/commit/d93411f43599242673b9e052fa6cca8f7ce1084a))

## [2.38.5](https://github.com/Celasha/Toolasha/compare/v2.38.4...v2.38.5) (2026-05-05)

### Bug Fixes

- guard null friendlies/enemies in combat trigger evaluation ([5743b64](https://github.com/Celasha/Toolasha/commit/5743b64cbfe1e84ce4366a7b0b8f657d42e405dc))

## [2.38.4](https://github.com/Celasha/Toolasha/compare/v2.38.3...v2.38.4) (2026-05-05)

### Bug Fixes

- add comprehensive debug logging to all zone spawn paths ([45dd705](https://github.com/Celasha/Toolasha/commit/45dd705be7607977800c8f8733c4ab098a02ad8e))

## [2.38.3](https://github.com/Celasha/Toolasha/compare/v2.38.2...v2.38.3) (2026-05-05)

### Bug Fixes

- add debug logging and defensive guard for dungeon wave spawn crash ([873449d](https://github.com/Celasha/Toolasha/commit/873449d6c356d5991c4f2a6b4bd2a6503ce9a837))

## [2.38.2](https://github.com/Celasha/Toolasha/compare/v2.38.1...v2.38.2) (2026-05-05)

### Bug Fixes

- guard against null fixedSpawnsMap entries in dungeon waves ([f8c8762](https://github.com/Celasha/Toolasha/commit/f8c8762634a802c738d5183c008b94c55407275b))

## [2.38.1](https://github.com/Celasha/Toolasha/compare/v2.38.0...v2.38.1) (2026-05-05)

### Bug Fixes

- handle unmatched dungeon wave ranges in spawn lookup ([594a483](https://github.com/Celasha/Toolasha/commit/594a483246b3a6d7463bd230d28c79e0b54e3194))
- reset to defaults now uses actual schema default values ([65cc577](https://github.com/Celasha/Toolasha/commit/65cc57751eae58750817ed4b1e2c5975b8fdd50f))

## [2.38.0](https://github.com/Celasha/Toolasha/compare/v2.37.0...v2.38.0) (2026-05-05)

### Features

- add avg completion time and totals to dungeon sim results ([68df358](https://github.com/Celasha/Toolasha/commit/68df358fe96c6a727c5ad7bccfed7f1ebbc2a0dd))

### Bug Fixes

- resolve dungeon sim crash on exact wave key boundary ([d99b792](https://github.com/Celasha/Toolasha/commit/d99b7927f4c47a3e5514483b527d0b98155b9343))

## [2.37.0](https://github.com/Celasha/Toolasha/compare/v2.36.1...v2.37.0) (2026-05-05)

### Features

- change "Buy intermediates" to only buy uncraftable raw materials ([36eea27](https://github.com/Celasha/Toolasha/commit/36eea27aa9e017e7d1b2899a922acc3f0079b357))

### Bug Fixes

- use combatAbilities with positional aura detection for sim export ([d576c25](https://github.com/Celasha/Toolasha/commit/d576c25c4cd99328224550c3ad11b08d19835076))

## [2.36.1](https://github.com/Celasha/Toolasha/compare/v2.36.0...v2.36.1) (2026-05-05)

### Miscellaneous Chores

- add debug logging for self ability import diagnosis ([ca6dc96](https://github.com/Celasha/Toolasha/commit/ca6dc96ec6d701e2689f0b5a0cec27e6e733f36d))

## [2.36.0](https://github.com/Celasha/Toolasha/compare/v2.35.0...v2.36.0) (2026-05-04)

### Features

- add configurable default hours settings for combat sim modes ([ec4fc4d](https://github.com/Celasha/Toolasha/commit/ec4fc4db596bd35bb2b9d327fcb1bf1a10e05cbf))

### Bug Fixes

- add Profit/day column, two-decimal Deaths/hr, and base-item click in inventory search ([6e77e66](https://github.com/Celasha/Toolasha/commit/6e77e664a6d4062b4698ebb2d6b94f83a5aa2433))
- use characterLoadoutMap for ability slot assignment in sim export ([fad3e8c](https://github.com/Celasha/Toolasha/commit/fad3e8c2c1aa3fb421d655733d92923eb7912be4))

## [2.35.0](https://github.com/Celasha/Toolasha/compare/v2.34.0...v2.35.0) (2026-05-03)

### Features

- add early exit and seek best source to all zones combat sim ([473299d](https://github.com/Celasha/Toolasha/commit/473299d61487317cba48f9d498a335842033c666))

### Bug Fixes

- restore GM storage for cross-domain Import from Toolasha on Shykai ([1f5f1ff](https://github.com/Celasha/Toolasha/commit/1f5f1ff57f6b782979c56c35c85a67498c3dcd9f))

## [2.34.0](https://github.com/Celasha/Toolasha/compare/v2.33.1...v2.34.0) (2026-05-03)

### Features

- add topmost-tab priority for custom inventory tabs ([b5f3b4c](https://github.com/Celasha/Toolasha/commit/b5f3b4cc33d75860bfad61b5635bbd8fdb3c73ba))

### Bug Fixes

- resolve history.some is not a function in combat sim comparison panel ([c41bec4](https://github.com/Celasha/Toolasha/commit/c41bec4e70fa778dc548ed87e61fc87cd1186626))

## [2.33.1](https://github.com/Celasha/Toolasha/compare/v2.33.0...v2.33.1) (2026-05-03)

### Bug Fixes

- catch async WS handler rejections and guard action_completed null characterItems ([e65a5fb](https://github.com/Celasha/Toolasha/commit/e65a5fb65076584ce178163a3a9c12e3a7bdb7a4))

## [2.33.0](https://github.com/Celasha/Toolasha/compare/v2.32.4...v2.33.0) (2026-05-03)

### Features

- fix custom tab tile-stealing and add "Add all levels" shortcut for equipment items ([95ea23c](https://github.com/Celasha/Toolasha/commit/95ea23c3cfb9a8ffdbe6b693d2eb82cd942463ce))
- fix preset consumable trigger calculation and add delete result buttons ([506dec4](https://github.com/Celasha/Toolasha/commit/506dec49c96adadc086e42122d0e6b2c6348998a))

### Bug Fixes

- force full layout rebuild when config item count changes to prevent tile cascading ([ec207fb](https://github.com/Celasha/Toolasha/commit/ec207fb4aaccffe42ccc2922d5bfe77dd6f7b92d))
- use equipment presence instead of missing maxEnhancementLevel field to detect expandable items ([741b3c1](https://github.com/Celasha/Toolasha/commit/741b3c1393d8152d96f664cd86b762100845fbe7))

## [2.32.4](https://github.com/Celasha/Toolasha/compare/v2.32.3...v2.32.4) (2026-05-03)

### Bug Fixes

- show all enhancement levels in custom tab item picker, mark owned with indicator ([eea2cce](https://github.com/Celasha/Toolasha/commit/eea2cced159a26e079da4fa04b03a31fdac4d340))
- write profile list to IndexedDB immediately on profile_shared ([3fbdb96](https://github.com/Celasha/Toolasha/commit/3fbdb962a9571d932facee6051195385eca44546))

## [2.32.3](https://github.com/Celasha/Toolasha/compare/v2.32.2...v2.32.3) (2026-05-03)

### Bug Fixes

- replace GM storage with IndexedDB for profile list and dataManager for character/battle data ([e92e0a9](https://github.com/Celasha/Toolasha/commit/e92e0a9e836b987adc2e25ec4732e22341332d71))

## [2.32.2](https://github.com/Celasha/Toolasha/compare/v2.32.1...v2.32.2) (2026-05-03)

### Bug Fixes

- fall back to characterLoadoutMap from init_character_data for Steam users ([c53c2b3](https://github.com/Celasha/Toolasha/commit/c53c2b3828db2100365f11c28b4dcd53de57d41d))

## [2.32.1](https://github.com/Celasha/Toolasha/compare/v2.32.0...v2.32.1) (2026-05-03)

### Miscellaneous Chores

- add diagnostic logging to loadout snapshot pipeline ([7078324](https://github.com/Celasha/Toolasha/commit/70783248d15e18b4caf6e2a3364d74583a8e9d18))

## [2.32.0](https://github.com/Celasha/Toolasha/compare/v2.31.2...v2.32.0) (2026-05-03)

### Features

- add all-zones combat simulation with player import and sortable results ([4e1df65](https://github.com/Celasha/Toolasha/commit/4e1df65d20c8af35da4695f1b11d5c28504a134c))

### Bug Fixes

- register loadouts_updated handler at module load time ([aad1dd1](https://github.com/Celasha/Toolasha/commit/aad1dd18bc97d4d82a71e62681f8d2c6f65e822f))

## [2.31.2](https://github.com/Celasha/Toolasha/compare/v2.31.1...v2.31.2) (2026-05-02)

### Bug Fixes

- guard GM storage calls for environments without GM APIs ([6a519df](https://github.com/Celasha/Toolasha/commit/6a519dfbaa046a2c9e6b0100846fcbf14c93f1d3))

## [2.31.1](https://github.com/Celasha/Toolasha/compare/v2.31.0...v2.31.1) (2026-05-02)

### Bug Fixes

- add "buy intermediates" toggle to crafting plan ([c60c216](https://github.com/Celasha/Toolasha/commit/c60c21688e9c7d3eada8941d1e85f70de2ce02fb))
- add catalytic tea and remove artisan tea from alchemy optimizer ([9f88c2e](https://github.com/Celasha/Toolasha/commit/9f88c2ec6b1e98b611739d1902d660ae0d36aa42))
- add IndexedDB auto-reconnection and storage diagnostics ([39d87e5](https://github.com/Celasha/Toolasha/commit/39d87e52b959332b964395f41272e524f48ba9e9))
- correct double /items/ prefix in milkyway market link URL ([7161bdb](https://github.com/Celasha/Toolasha/commit/7161bdb6a44d72df7d6f674c42388c08fb602218))
- split XP color into separate rate and hours-to-level settings ([ef80baa](https://github.com/Celasha/Toolasha/commit/ef80baa7992c22a07dfc24b76a03cd5ee2273682))

### Miscellaneous Chores

- deprecate Steam build and remove all Steam-specific code ([3a72bbe](https://github.com/Celasha/Toolasha/commit/3a72bbe574484891de7e7461f347f30e70a382fd))

## [2.31.0](https://github.com/Celasha/Toolasha/compare/v2.30.2...v2.31.0) (2026-05-01)

### Features

- add best crafting plan to action panels ([a2dec28](https://github.com/Celasha/Toolasha/commit/a2dec281900d7dde899404cb40b595294f6a28bd))
- add milkyway market link to marketplace order books ([e43abfa](https://github.com/Celasha/Toolasha/commit/e43abfa17c59299121af4b3761ce8d3b2271e644))
- add seals, achievement buffs, and back slot to milkonomy export ([68405c2](https://github.com/Celasha/Toolasha/commit/68405c2c92ba728cf27a2a8d31fe81f999c08135))

### Bug Fixes

- default all collection filters to checked for new users ([2a066ec](https://github.com/Celasha/Toolasha/commit/2a066ec3e0425f343828957c045f60f26e0a2b48))

## [2.30.2](https://github.com/Celasha/Toolasha/compare/v2.30.1...v2.30.2) (2026-05-01)

### Bug Fixes

- hook page MessageEvent prototype and remove instanceof guard ([e8490a5](https://github.com/Celasha/Toolasha/commit/e8490a5255735267ff9427e3af73c34ecc83296e))

## [2.30.1](https://github.com/Celasha/Toolasha/compare/v2.30.0...v2.30.1) (2026-05-01)

### Bug Fixes

- use correct setting key for inventory networth panel ([5fcbea0](https://github.com/Celasha/Toolasha/commit/5fcbea0663323380cd9247d51d9a52b6e1e81c11))

## [2.30.0](https://github.com/Celasha/Toolasha/compare/v2.29.0...v2.30.0) (2026-05-01)

### Features

- add alchemy best items ranking by profit and XP ([1250222](https://github.com/Celasha/Toolasha/commit/12502220111895c604f8c20d3a081941ba3d89eb))

## [2.29.0](https://github.com/Celasha/Toolasha/compare/v2.28.2...v2.29.0) (2026-05-01)

### Features

- add materials availability indicator on production task cards ([89b5a92](https://github.com/Celasha/Toolasha/commit/89b5a92b61465d2a2dacae345fb38b8f3ee20d47))

## [2.28.2](https://github.com/Celasha/Toolasha/compare/v2.28.1...v2.28.2) (2026-05-01)

### Bug Fixes

- use getSetting for sub-settings incorrectly using isFeatureEnabled ([0d455e9](https://github.com/Celasha/Toolasha/commit/0d455e9023f34412e952ad86a1485a41ea13079f))

## [2.28.1](https://github.com/Celasha/Toolasha/compare/v2.28.0...v2.28.1) (2026-05-01)

### Bug Fixes

- decouple tooltip pin-to-top from market prices setting ([97c59a8](https://github.com/Celasha/Toolasha/commit/97c59a80622ceafad06e0082f684df6a7c98568f))

## [2.28.0](https://github.com/Celasha/Toolasha/compare/v2.27.0...v2.28.0) (2026-04-30)

### Features

- add alchemy tea recommendation support ([1596c7d](https://github.com/Celasha/Toolasha/commit/1596c7db8903c4c481031ac3a91321c2611dcaf4))
- add timing display to queue hover tooltip ([7e57ba3](https://github.com/Celasha/Toolasha/commit/7e57ba3455c4fa1dab74d5dc3064261a2610b4d7))

### Bug Fixes

- collection badge setting not persisting after refresh ([d3c036d](https://github.com/Celasha/Toolasha/commit/d3c036da3b4f66051551d8fe493e6eb813d74a38))
- labyrinth best-level badge position shifting after edit/save ([ea80a49](https://github.com/Celasha/Toolasha/commit/ea80a4902416322d7803cf8dbcbe702c5cd0753c))
- preserve customCheck when converting features to registry format ([51cb2a4](https://github.com/Celasha/Toolasha/commit/51cb2a46ccc1219cb3c882e28c978998a2f87c5d))
- re-render trade history display when DOM element is removed ([3177897](https://github.com/Celasha/Toolasha/commit/3177897a73ca5100e9d96b57c09254ad28e2e34e))
- show trade history when order book has only one side ([c785da8](https://github.com/Celasha/Toolasha/commit/c785da8b45e20930f60aaccefe6f082db7bb5999))

### Miscellaneous Chores

- remove stale debug console.log statements ([cad180c](https://github.com/Celasha/Toolasha/commit/cad180ccad7705024d8b4c7674914b120d5d98c0))

## [2.27.0](https://github.com/Celasha/Toolasha/compare/v2.26.0...v2.27.0) (2026-04-30)

### Features

- add staleness indicator to collection skilling badges ([fabe9ab](https://github.com/Celasha/Toolasha/commit/fabe9abaebb867cbc0d222b9208aad49ac06bcd0))

### Bug Fixes

- count failed attempts in alchemy history trackers ([8b97a9b](https://github.com/Celasha/Toolasha/commit/8b97a9b73c1c9bf5d761c6f8e5b24f577247cf00))
- decouple level progress from profit detail toggle ([d877757](https://github.com/Celasha/Toolasha/commit/d8777574ceae58f89a3560eb0ba7548182c3d1d2))

### Miscellaneous Chores

- add diagnostic logging for alchemy coinify display ([2e5cee2](https://github.com/Celasha/Toolasha/commit/2e5cee267bbaf12a93ad0b85b42db9ae4eeadcb0))

## [2.26.0](https://github.com/Celasha/Toolasha/compare/v2.25.1...v2.26.0) (2026-04-29)

### Features

- add Sim Character button to profile page ([81dbbf2](https://github.com/Celasha/Toolasha/commit/81dbbf2e8b63df65b1201f61345b588c7634e5af))

### Bug Fixes

- anchor abilities panel to bottom of screen and make it draggable ([b4cd9d7](https://github.com/Celasha/Toolasha/commit/b4cd9d750929088c8150a59199632a2d6d4efe12))
- initialize task Go merge when profit calculator is disabled ([7e52bd0](https://github.com/Celasha/Toolasha/commit/7e52bd030c2dfa4445114e3825391a22a61c81e4))
- reload pinned actions using correct character ID after switch ([ae586c7](https://github.com/Celasha/Toolasha/commit/ae586c7f75a90d779cb97774ae29a643be0be02d))

## [2.25.1](https://github.com/Celasha/Toolasha/compare/v2.25.0...v2.25.1) (2026-04-29)

### Bug Fixes

- exclude Toolasha zone-index span from task description text in profit display ([1363340](https://github.com/Celasha/Toolasha/commit/13633401830ef36cca5f46a31a90f8057fa621ac))

## [2.25.0](https://github.com/Celasha/Toolasha/compare/v2.24.8...v2.25.0) (2026-04-29)

### Features

- add inline Auto/Manual mode toggle to enhancement calculator ([eed0222](https://github.com/Celasha/Toolasha/commit/eed0222bd41f4a8eba941eb0621f8363c61f5190))

### Bug Fixes

- strip zone suffix from monster name before lookup in combat task estimate ([6184df0](https://github.com/Celasha/Toolasha/commit/6184df0a14821bb780ce605f8122a76907c65dd4))

## [2.24.8](https://github.com/Celasha/Toolasha/compare/v2.24.7...v2.24.8) (2026-04-29)

### Miscellaneous Chores

- add diagnostic logging for task identification failures ([7abc65c](https://github.com/Celasha/Toolasha/commit/7abc65ccee73a740d597945f9ef3653f1a0ec078))

## [2.24.7](https://github.com/Celasha/Toolasha/compare/v2.24.6...v2.24.7) (2026-04-29)

### Bug Fixes

- use lazy runtime accessor for loadout-snapshot in task display ([da169b3](https://github.com/Celasha/Toolasha/commit/da169b3301a0e6b942f4023515e83a6d6a54c3c5))

## [2.24.6](https://github.com/Celasha/Toolasha/compare/v2.24.5...v2.24.6) (2026-04-29)

### Bug Fixes

- deduplicate loadout-snapshot instance across split bundles ([3c48a4f](https://github.com/Celasha/Toolasha/commit/3c48a4fef1843163d9bee57f1dcf86d51a44ea1a))

## [2.24.5](https://github.com/Celasha/Toolasha/compare/v2.24.4...v2.24.5) (2026-04-29)

### Bug Fixes

- load loadout snapshots after character ID is available ([1841289](https://github.com/Celasha/Toolasha/commit/1841289c5ed01a6d8d2f48728bab274d6c975d11))

## [2.24.4](https://github.com/Celasha/Toolasha/compare/v2.24.3...v2.24.4) (2026-04-29)

### Bug Fixes

- refresh task combat loadout dropdown when loadouts_updated fires ([966a4dc](https://github.com/Celasha/Toolasha/commit/966a4dc17ebdcbfd6417dae5267f4c479b72569c))

## [2.24.3](https://github.com/Celasha/Toolasha/compare/v2.24.2...v2.24.3) (2026-04-29)

### Bug Fixes

- await loadout snapshot initialization to prevent race condition ([4f515eb](https://github.com/Celasha/Toolasha/commit/4f515ebd8c48b5f2915ba9252afb9eb30b224b22))
- re-query input and action details at click time in quick input buttons ([4a23387](https://github.com/Celasha/Toolasha/commit/4a2338770b828c778a08ab794f09f351d9fb87b5))

## [2.24.2](https://github.com/Celasha/Toolasha/compare/v2.24.1...v2.24.2) (2026-04-29)

### Bug Fixes

- make action sort mode per-character instead of global ([5f1c9fd](https://github.com/Celasha/Toolasha/commit/5f1c9fd6cb90b149de9a5df61fb9bc998e821fe9))
- prevent empty alchemy history sessions from queue changes ([52a9fa5](https://github.com/Celasha/Toolasha/commit/52a9fa53c7d8567f8d9ff460516a5e1841b88649))
- prevent labyrinth best-level badge from breaking extension ([8ce4ee6](https://github.com/Celasha/Toolasha/commit/8ce4ee68dcc9cc2f94b675a736fdd0028d5ef9d3))
- target correct CSS class for labyrinth panel width override ([bfd5284](https://github.com/Celasha/Toolasha/commit/bfd5284b368795f2a70f7ff5ecdf10c20ff223a6))

## [2.24.1](https://github.com/Celasha/Toolasha/compare/v2.24.0...v2.24.1) (2026-04-28)

### Bug Fixes

- support live setting toggle for queue monitor ([08f13e6](https://github.com/Celasha/Toolasha/commit/08f13e65bf25d70ed9662e19e03bd24cc302f7de))

## [2.24.0](https://github.com/Celasha/Toolasha/compare/v2.23.0...v2.24.0) (2026-04-28)

### Features

- add combat task time and profit estimator ([cc425d2](https://github.com/Celasha/Toolasha/commit/cc425d2b1f26d289012c620d52ad37f9d640ddee))
- add cross-character queue monitor ([325eba4](https://github.com/Celasha/Toolasha/commit/325eba43544ad1a14b453c0b63b7520606480df5))
- add decompose session history tracking and viewer ([9e456d1](https://github.com/Celasha/Toolasha/commit/9e456d1d694f4d5620f5f1e9adb82c5791c102bb))
- add per-pane message filters to pop-out chat ([059d73d](https://github.com/Celasha/Toolasha/commit/059d73ddf61f4a28031cdae6d3f89c222a9c162c))

## [2.23.0](https://github.com/Celasha/Toolasha/compare/v2.22.2...v2.23.0) (2026-04-27)

### Features

- add All Off / Restore buttons to settings panel ([95291c5](https://github.com/Celasha/Toolasha/commit/95291c5c5184312427e07435c8b0b10ac88932ba))

### Bug Fixes

- correct actionPanel_showExpPerHour label and help text ([9a9f4ae](https://github.com/Celasha/Toolasha/commit/9a9f4aea46be579141554dfcd8e26e8c6b5fa3e9))

## [2.22.2](https://github.com/Celasha/Toolasha/compare/v2.22.1...v2.22.2) (2026-04-27)

### Bug Fixes

- restore querySelectorAll descent in DOMObserver.onClass for container nodes ([620caff](https://github.com/Celasha/Toolasha/commit/620caffa964e3a1f260075e75706465bc6fe6449))
- sort combat statistics drop list by total value descending ([49ea6f3](https://github.com/Celasha/Toolasha/commit/49ea6f3073a14f5a06dbf8a62153f351456c15a8))
- split action panel profit setting into tile and detail controls ([0eeee58](https://github.com/Celasha/Toolasha/commit/0eeee5801f3703c1450107e512e2c9be422420e3))
- use substring class selector for missing mats badge to survive game updates ([87e7691](https://github.com/Celasha/Toolasha/commit/87e7691d6ff6df3e24992b496d36897e03d8211e))
- use top bid (bids[0]) instead of lowest bid when reading order books ([4f5cac8](https://github.com/Celasha/Toolasha/commit/4f5cac89ea02adcf8d7da0e4652588e3210ac1db))

### Code Refactoring

- remove diagnostic logs from alchemy profit display ([ce314ea](https://github.com/Celasha/Toolasha/commit/ce314ea0399a4d1837562d2c2ad06dac70f02d81))

## [2.22.1](https://github.com/Celasha/Toolasha/compare/v2.22.0...v2.22.1) (2026-04-27)

### Bug Fixes

- remove redundant querySelectorAll descent in DOMObserver.onClass ([0203a8d](https://github.com/Celasha/Toolasha/commit/0203a8d2403b6b389bdeb9b3b21a6bb3af36c809))

### Code Refactoring

- exclude taskDamage from player damage roll in combat sim ([af25935](https://github.com/Celasha/Toolasha/commit/af259355e66de26e0c3dd9e9db9e0e01e221fe99))
- remove leftover debug logging from combat sim ([5d636c6](https://github.com/Celasha/Toolasha/commit/5d636c6ddfd1de2692afba138f241576dbf30d38))

## [2.22.0](https://github.com/Celasha/Toolasha/compare/v2.21.0...v2.22.0) (2026-04-26)

### Features

- add consumable editing and comparison table to combat sim ([0cdbe7c](https://github.com/Celasha/Toolasha/commit/0cdbe7c030e55266958aa8f52554728c038e2ab3))

### Bug Fixes

- use loose equality when resetting absent monster combat stats to zero ([7d61522](https://github.com/Celasha/Toolasha/commit/7d61522610983ef540f023a5b07613b05354bcd6))

## [2.21.0](https://github.com/Celasha/Toolasha/compare/v2.20.1...v2.21.0) (2026-04-25)

### Features

- add drag-and-drop tab reordering for character panel ([6367cbb](https://github.com/Celasha/Toolasha/commit/6367cbb11b72edafacda5972d43aed75ccfe5509))
- add setting to toggle protection items in enhancement material limit ([ebbe621](https://github.com/Celasha/Toolasha/commit/ebbe621307e902d09bbd69be364a6b76735797cc))
- add zone-level protection toggle to task reroll protection ([41921ff](https://github.com/Celasha/Toolasha/commit/41921ffc640db88e5df19cbf3dca2e31a71565de))

### Bug Fixes

- include gathering dropTable items in collection time-to-tier sort ([9077a6a](https://github.com/Celasha/Toolasha/commit/9077a6a53715c73cbf4b527b293a989199731164))

## [2.20.1](https://github.com/Celasha/Toolasha/compare/v2.20.0...v2.20.1) (2026-04-24)

### Bug Fixes

- add 3-second lockdown to task reroll protection ([2f78f28](https://github.com/Celasha/Toolasha/commit/2f78f289dd070841a792b5a4020b318ccf7dad33))

## [2.20.0](https://github.com/Celasha/Toolasha/compare/v2.19.2...v2.20.0) (2026-04-24)

### Features

- add task reroll protection with configurable protected zones ([f5cc111](https://github.com/Celasha/Toolasha/commit/f5cc111aa134ee32ec48cfe1e868e8e7ae1849fa))

### Bug Fixes

- correct combat sim trigger handling and null enemies crash ([ea01ff5](https://github.com/Celasha/Toolasha/commit/ea01ff593295b0a71ccacbc33b0de995fb8288dc))

## [2.19.2](https://github.com/Celasha/Toolasha/compare/v2.19.1...v2.19.2) (2026-04-23)

### Bug Fixes

- add dungeon key costs to combat sim profit calculations ([1aed228](https://github.com/Celasha/Toolasha/commit/1aed228d2f7d1b201893ea23c35d44493d333b1e))

## [2.19.1](https://github.com/Celasha/Toolasha/compare/v2.19.0...v2.19.1) (2026-04-23)

### Bug Fixes

- limit combat sim tier dropdown to T0-T5 for zones and T0-T2 for dungeons ([1a7af0f](https://github.com/Celasha/Toolasha/commit/1a7af0f6207333388b88edfee417fcb4c4ddb2e5))
- use dungeon completion rewards instead of monster drops for dungeon sims ([79affc5](https://github.com/Celasha/Toolasha/commit/79affc54f2d5b1c96454c1f7a1a7ba21bedcf47c))

## [2.19.0](https://github.com/Celasha/Toolasha/compare/v2.18.2...v2.19.0) (2026-04-23)

### Features

- add session history, loadout selection, and auto-labeled comparisons to combat sim ([7e427f3](https://github.com/Celasha/Toolasha/commit/7e427f3390a65877f9e0d6e92e843b9767c5bc02))
- add tooltip valuations for task tokens, labyrinth tokens, seals, and cowbells ([6c5b7c1](https://github.com/Celasha/Toolasha/commit/6c5b7c1661b0dd9fd7d990f752f9cfd33e5b67f9))

### Bug Fixes

- add deltas to per-day columns in combat sim results ([de7ad59](https://github.com/Celasha/Toolasha/commit/de7ad598b4160c6c1610cdf5b715cf1c63f4b969))
- clear stale action stats and battle counter on action switch ([2ee57cb](https://github.com/Celasha/Toolasha/commit/2ee57cb44d7b3d7140338425bf9b6d945da3686c))
- scope pinned actions storage per character ([7a90c65](https://github.com/Celasha/Toolasha/commit/7a90c658e16c8fbbea08a471a1efc083d28fd365))
- use highest bid for top order price in trade history display ([05fc3f6](https://github.com/Celasha/Toolasha/commit/05fc3f66241951afc358297a3d39eeab0a228d39))

## [2.18.2](https://github.com/Celasha/Toolasha/compare/v2.18.1...v2.18.2) (2026-04-22)

### Bug Fixes

- add quantity/day columns and fix overlapping text in combat sim ([935538d](https://github.com/Celasha/Toolasha/commit/935538d5384b4c9ed1195fe0f350182bee4ee53a))

## [2.18.1](https://github.com/Celasha/Toolasha/compare/v2.18.0...v2.18.1) (2026-04-22)

### Bug Fixes

- add per-day gold columns to combat sim results ([33aca03](https://github.com/Celasha/Toolasha/commit/33aca030d50296a8a2dc47fd7a189bb6b4059be6))

## [2.18.0](https://github.com/Celasha/Toolasha/compare/v2.17.2...v2.18.0) (2026-04-22)

### Features

- add loadout editor and comparison deltas to combat sim ([3236ff6](https://github.com/Celasha/Toolasha/commit/3236ff68a44ce5b7a83e4355a57d50b23b0aaf4d))

## [2.17.2](https://github.com/Celasha/Toolasha/compare/v2.17.1...v2.17.2) (2026-04-22)

### Bug Fixes

- show per-player data in combat sim results for party sims ([dc03026](https://github.com/Celasha/Toolasha/commit/dc03026f6cdd405c69d203e7f8db2634915ee2e6))

## [2.17.1](https://github.com/Celasha/Toolasha/compare/v2.17.0...v2.17.1) (2026-04-21)

### Bug Fixes

- show only self XP/hr in combat sim results ([43ce37a](https://github.com/Celasha/Toolasha/commit/43ce37a5fc6a7779a35f44010dee02179540c59b))

## [2.17.0](https://github.com/Celasha/Toolasha/compare/v2.16.0...v2.17.0) (2026-04-21)

### Features

- add in-game Combat Simulator ([84d9763](https://github.com/Celasha/Toolasha/commit/84d9763fe14dbcb8cf584ba4c91226220bb97825))

### Bug Fixes

- add missing daily profit rate to gathering tooltip ([9818e86](https://github.com/Celasha/Toolasha/commit/9818e860e3a770597ac9cae3287b779041258dba))

### Miscellaneous Chores

- bump Steam bundle size limit to 6MB for combat sim engine ([478414e](https://github.com/Celasha/Toolasha/commit/478414e8bc3639ea823b4f7ed76c634fff83bf11))

## [2.16.0](https://github.com/Celasha/Toolasha/compare/v2.15.0...v2.16.0) (2026-04-20)

### Features

- add Enhancement XPH Calculator ([22bf42e](https://github.com/Celasha/Toolasha/commit/22bf42e863fd66353c1249a1b0fd52dfa2f67b56))

### Bug Fixes

- raise dungeon tracker z-index to floating panel level when expanded ([b992489](https://github.com/Celasha/Toolasha/commit/b992489914ad7ced619dc01911302fd37687bbd1))
- use highest bid (last element) for top order price on buy listings ([9984e68](https://github.com/Celasha/Toolasha/commit/9984e6829b192d2b315227de80cce0e238d6abb7))

## [2.15.0](https://github.com/Celasha/Toolasha/compare/v2.14.0...v2.15.0) (2026-04-19)

### Features

- add budget calculator to production action panels ([9f22477](https://github.com/Celasha/Toolasha/commit/9f22477450ebdf00963becc2c3e191f47e75bde9))

## [2.14.0](https://github.com/Celasha/Toolasha/compare/v2.13.3...v2.14.0) (2026-04-19)

### Features

- add chat history extender to preserve evicted messages ([24a0a3b](https://github.com/Celasha/Toolasha/commit/24a0a3b86b0ab30ab8c31e814590a47559eab9ad))
- add customizable quick input presets for action panels ([7ed4ac1](https://github.com/Celasha/Toolasha/commit/7ed4ac1f198b2646a829e61a6e40992ada8f2a40))
- add option to hide Labyrinth ping badge in nav sidebar ([66c2ce7](https://github.com/Celasha/Toolasha/commit/66c2ce7257a827b6a49ea71f193defef5770db60))

### Bug Fixes

- preserve market listings expand state across net worth re-renders ([fd4b240](https://github.com/Celasha/Toolasha/commit/fd4b240b61d4c88a56f591b61fdebbdc8500a2d3))
- prevent negative count and focus input after View Action navigation ([1f2d448](https://github.com/Celasha/Toolasha/commit/1f2d448bc8e40e6e10da96d33d67e81485f4ba15))
- show limiting material icon in enhancing time display ([5851deb](https://github.com/Celasha/Toolasha/commit/5851deb9f829ee9294817622ac3bdfa8bd74d688))

## [2.13.3](https://github.com/Celasha/Toolasha/compare/v2.13.2...v2.13.3) (2026-04-18)

### Bug Fixes

- reconcile stale active listings against myMarketListings snapshots ([f4688b3](https://github.com/Celasha/Toolasha/commit/f4688b30d8ee37d4d567cd188d4f6c2c33393bf1))

## [2.13.2](https://github.com/Celasha/Toolasha/compare/v2.13.1...v2.13.2) (2026-04-18)

### Code Refactoring

- replace volatile target-based time with stable material time in enhancing display ([3165a39](https://github.com/Celasha/Toolasha/commit/3165a39429b981c772e742d0a26129f44e98deee))

## [2.13.1](https://github.com/Celasha/Toolasha/compare/v2.13.0...v2.13.1) (2026-04-18)

### Bug Fixes

- export correct ability levels and triggers for non-equipped loadout abilities ([60fafae](https://github.com/Celasha/Toolasha/commit/60fafae972c74a8baffcfa6c4de131aff1554c4c))
- guard against null characterItems in items_updated handler ([e6739c2](https://github.com/Celasha/Toolasha/commit/e6739c2eb5257513f3ba3addb10fde1a5d3086bf))
- lower dungeon tracker z-index below game countdown overlays ([12acb27](https://github.com/Celasha/Toolasha/commit/12acb27c2d0b6dfdbddec711abe2d48468ea660c))
- populate market listings breakdown in net worth calculator ([22e47fc](https://github.com/Celasha/Toolasha/commit/22e47fc2b5e4a84186f188e90ab8a9fc66f33243))
- use repeat count for enhancement missing mats when repeat is finite ([bb6a286](https://github.com/Celasha/Toolasha/commit/bb6a286e6c076883aa8bb9d3f5e972493b343033))

## [2.13.0](https://github.com/Celasha/Toolasha/compare/v2.12.1...v2.13.0) (2026-04-17)

### Features

- add material-based countdown timer for enhancement actions ([9c80cd7](https://github.com/Celasha/Toolasha/commit/9c80cd764e1028971dd6258a1566d18c65448b55))

### Bug Fixes

- detect marketplace navigation via CSS visibility instead of DOM mutations ([9b4f086](https://github.com/Celasha/Toolasha/commit/9b4f0863c7c3142637b0e19fa15089cd3b42a878))
- persist net worth chart range selection across sessions ([fe6b630](https://github.com/Celasha/Toolasha/commit/fe6b63081e3a09bf046ad4748ff9388000349c3d))

## [2.12.1](https://github.com/Celasha/Toolasha/compare/v2.12.0...v2.12.1) (2026-04-17)

### Bug Fixes

- add per-row delete button to market history ([a84dc6b](https://github.com/Celasha/Toolasha/commit/a84dc6bd4b6d35a1e5c42459855fa4483f39b71b))
- clear battle counter on combat exit and hide scroll sim for combat loadouts ([d8cd43a](https://github.com/Celasha/Toolasha/commit/d8cd43aa04c53322bbbbaac6cbfc42c255c231be))
- eliminate custom tab flicker when enhancing items ([482b9bc](https://github.com/Celasha/Toolasha/commit/482b9bc53847675674ea07f6d1d25e574ddbcc5d))
- resolve view action button failing for refined items ([4f8a972](https://github.com/Celasha/Toolasha/commit/4f8a972b9f6c6656e324803835e0e13ab0bbfe0f))

### Code Refactoring

- move combat sim loadout export from loadout page to score panel dropdown ([384741f](https://github.com/Celasha/Toolasha/commit/384741f6bbe5110eda7deba1a43a3cc4702f041a))

## [2.12.0](https://github.com/Celasha/Toolasha/compare/v2.11.0...v2.12.0) (2026-04-17)

### Features

- add battle/wave counter to combat action bar ([89471be](https://github.com/Celasha/Toolasha/commit/89471bef9395a5ace516b62edec3dad48fecc8b3))
- add per-loadout scroll simulation for profit/XP calculations ([49648bd](https://github.com/Celasha/Toolasha/commit/49648bd189eccf82b7105b4c913194fffb3381bd))

### Bug Fixes

- correct three row-matching bugs in My Listings price display ([aa7da12](https://github.com/Celasha/Toolasha/commit/aa7da1270c4d23a52ce811ced1da0a922b371b80))
- remove redundant quantity from coin line in net worth breakdown ([ea6d6c1](https://github.com/Celasha/Toolasha/commit/ea6d6c12f264ee24525f7330ea9a7821fd1d58e8))
- rename "Seal of" to "Scroll of" following game update ([ead6bf5](https://github.com/Celasha/Toolasha/commit/ead6bf5d92a7674a44b7a694d353f6836a5e8e53))
- update Milkonomy external link URL ([753658a](https://github.com/Celasha/Toolasha/commit/753658a7f642600d7bb0daf5cc0561092d768c1f))

## [2.11.0](https://github.com/Celasha/Toolasha/compare/v2.10.1...v2.11.0) (2026-04-16)

### Features

- add Claim Reward proxy button to task panel header ([0061b3e](https://github.com/Celasha/Toolasha/commit/0061b3ef59a22c30b3f30da86b9c1940ca03d2aa))
- generate Tib character sheet from a saved loadout snapshot ([b72d009](https://github.com/Celasha/Toolasha/commit/b72d0099d65632b20c147cd7935d4392be1e1f7b))

### Bug Fixes

- guard loadout enhancement overlays against mid-render and stale inventory ([ea1c9aa](https://github.com/Celasha/Toolasha/commit/ea1c9aaa83e24894371e03027d2fb37136649d89))
- populate XP/h columns on main player leaderboard ([0b2b684](https://github.com/Celasha/Toolasha/commit/0b2b6849d28665b2aca8bc7f6d09b0ac0c7bd360))
- show + prefix on net worth toggle from initial render ([0c18fe2](https://github.com/Celasha/Toolasha/commit/0c18fe2dfc73f8fc6cd37d6c14e25106161277db))
- show Coin as explicit line item in inventory breakdown ([d6b061f](https://github.com/Celasha/Toolasha/commit/d6b061fb8de1149005eedafb7cf33df8a7d31106))
- use direct index lookup for enhanced item order books in Top Order Price ([5d6ae04](https://github.com/Celasha/Toolasha/commit/5d6ae04b51f7bdf81af0c31de6d29bd3bc66e497))

## [2.10.1](https://github.com/Celasha/Toolasha/compare/v2.10.0...v2.10.1) (2026-04-15)

### Bug Fixes

- resolve exclusion chip names from game data instead of search list ([1e08a4b](https://github.com/Celasha/Toolasha/commit/1e08a4b9c97ed7f785c24086ce6817ed1880ed1e))

## [2.10.0](https://github.com/Celasha/Toolasha/compare/v2.9.2...v2.10.0) (2026-04-14)

### Features

- add Clear All button to exclusion popup and fix double-exclusion ([20ce818](https://github.com/Celasha/Toolasha/commit/20ce8182e18c725f8c04fd74210fcc050b4f3bb8))

### Bug Fixes

- exclude Coin from currency category grouping in net worth ([6ab4118](https://github.com/Celasha/Toolasha/commit/6ab41182bbac5c258e9c9ad4c0ce602f2c274b98))
- restore correct amounts for excluded items in exclusion popup ([84df111](https://github.com/Celasha/Toolasha/commit/84df111329513dae00d224ca995997710a6119e2))

### Styles

- center tab names and right-align count/value in custom tab headers ([7846de3](https://github.com/Celasha/Toolasha/commit/7846de3b05a39d3cfc12ab955a0f46bfa2f11392))

## [2.9.2](https://github.com/Celasha/Toolasha/compare/v2.9.1...v2.9.2) (2026-04-14)

### Bug Fixes

- add expandable detail view for multi-item exclusions ([65943bf](https://github.com/Celasha/Toolasha/commit/65943bfaa0034e9a5b1e3e141d0373179c71a7b8))

## [2.9.1](https://github.com/Celasha/Toolasha/compare/v2.9.0...v2.9.1) (2026-04-14)

### Bug Fixes

- eliminate blank padding on chart x-axis edges ([75d78d8](https://github.com/Celasha/Toolasha/commit/75d78d8df8efb67f34e8b051cbac44af6c15a09e))

### Performance Improvements

- avoid blocking on 3s debounced save in exclusion toggles ([9f1f957](https://github.com/Celasha/Toolasha/commit/9f1f9571b4332d8737f26ff28505730c76c2e78b))

## [2.9.0](https://github.com/Celasha/Toolasha/compare/v2.8.1...v2.9.0) (2026-04-14)

### Features

- add net worth exclusions and Non-Excluded history chart line ([90fe8d7](https://github.com/Celasha/Toolasha/commit/90fe8d73a64401c483e24f37d53d29346a99e9c9))

### Bug Fixes

- show wisdom tea on gold tab and gourmet tea on XP tab for cooking/brewing ([2a2f2bf](https://github.com/Celasha/Toolasha/commit/2a2f2bf80106b0b536d96491bf5ea2b654a5ff9f))

### Styles

- rename "Networth" to "Net Worth" in all user-facing text ([01d427e](https://github.com/Celasha/Toolasha/commit/01d427e18c6a6c27d17dac635f4d1acf4282dae6))

## [2.8.1](https://github.com/Celasha/Toolasha/compare/v2.8.0...v2.8.1) (2026-04-12)

### Bug Fixes

- make action panel display settings take effect without page reload ([c346437](https://github.com/Celasha/Toolasha/commit/c346437db308af221e4ec1115cec0e1c2f27b252))

## [2.8.0](https://github.com/Celasha/Toolasha/compare/v2.7.3...v2.8.0) (2026-04-12)

### Features

- add click-to-delete datapoints from networth history chart ([0dbaef6](https://github.com/Celasha/Toolasha/commit/0dbaef6fdb1fcde6269966a24a35bc25a1b4a198))
- add pin/ban tea constraints to tea recommendation popup ([8321ccf](https://github.com/Celasha/Toolasha/commit/8321ccfed5575ab5be2652f93bf7ef3a154a0685))

### Bug Fixes

- divide tooltip per-action profit by effective actions rate ([7b5f310](https://github.com/Celasha/Toolasha/commit/7b5f31070f956da0ccb2ea60e51fcb6ec516be1d))
- force full layout rebuild when inventory tile count changes ([ccaec79](https://github.com/Celasha/Toolasha/commit/ccaec79ff9b818b2b3bd6de45b05aacbeb58c91c))
- prevent duplicate action entries inflating queued material counts ([cfea250](https://github.com/Celasha/Toolasha/commit/cfea2504de2aae1577ffa4a4c4427bf7a43a4304))

## [2.7.3](https://github.com/Celasha/Toolasha/compare/v2.7.2...v2.7.3) (2026-04-12)

### Styles

- reduce inventory tab category header size for compactness ([4b61244](https://github.com/Celasha/Toolasha/commit/4b61244973f4be10e15386be3f3376553369d570))

## [2.7.2](https://github.com/Celasha/Toolasha/compare/v2.7.1...v2.7.2) (2026-04-12)

### Bug Fixes

- prevent duplicate reroll cost display for identical tasks ([07694ff](https://github.com/Celasha/Toolasha/commit/07694ffe5ba62b4ae74d26e06b2a80c87fdbc786))

## [2.7.1](https://github.com/Celasha/Toolasha/compare/v2.7.0...v2.7.1) (2026-04-11)

### Bug Fixes

- apply KMB formatting to Profit and Primary Outputs labels in action panel ([9e7a6e7](https://github.com/Celasha/Toolasha/commit/9e7a6e7758001a8442e8af43ec7c2a6fe53fedec))
- correct double-counted efficiency in production action totals ([0fc6738](https://github.com/Celasha/Toolasha/commit/0fc6738c2433b393f1e74ffb4a3d12d7727a8956))
- show average in parentheses alongside output range totals ([0d64bd2](https://github.com/Celasha/Toolasha/commit/0d64bd240142ff764a84f4d69126108b5d6a5e97))

### Performance Improvements

- debounce order books cache saves and evict stale entries on load ([d7fbecd](https://github.com/Celasha/Toolasha/commit/d7fbecd2210520a3ee2e06a135de675eacc05f42))

## [2.7.0](https://github.com/Celasha/Toolasha/compare/v2.6.2...v2.7.0) (2026-04-11)

### Features

- add custom price overrides for profit calculations ([93d7f77](https://github.com/Celasha/Toolasha/commit/93d7f775c3fa22cf12f066a4d886962a9f5ce7f3))
- use shop prices as cost floor for production material costs ([2cb98b0](https://github.com/Celasha/Toolasha/commit/2cb98b0795557bac8def675ecfa954f9441d099d))

### Code Refactoring

- unify price resolution and fix tooltip accuracy for refined items ([afb5510](https://github.com/Celasha/Toolasha/commit/afb55107e7a8e64a0f3276bf515cd9cccd22439a))

## [2.6.2](https://github.com/Celasha/Toolasha/compare/v2.6.1...v2.6.2) (2026-04-11)

### Bug Fixes

- handle ★ ↔ (R) refined item name resolution and skip profit for untradable items ([75f90d8](https://github.com/Celasha/Toolasha/commit/75f90d8835fae82d6ed8a8a4a8e330275abb8b92))

### Miscellaneous Chores

- remove diagnostic log from loadout snapshot rendering ([743d77d](https://github.com/Celasha/Toolasha/commit/743d77d93749aab37bf09cee1525d253dee8dac9))
- retrigger release-please ([fbe2842](https://github.com/Celasha/Toolasha/commit/fbe28424d91131197f80d056fe61180a5de52e6e))

## [2.6.1](https://github.com/Celasha/Toolasha/compare/v2.6.0...v2.6.1) (2026-04-11)

### Miscellaneous Chores

- format CHANGELOG.md after release-please update ([9d5ae7d](https://github.com/Celasha/Toolasha/commit/9d5ae7dce3a7ea091dc81b7b5cb17859bd61814c))

## [2.6.0](https://github.com/Celasha/Toolasha/compare/v2.5.1...v2.6.0) (2026-04-11)

### Features

- add "Filled or Active" status filter to market history ([48df8dc](https://github.com/Celasha/Toolasha/commit/48df8dcfb89b2ea8334f22aca70c489d50f0a7bc))
- show rolled-up value on collapsed custom inventory tab headers ([2ca8947](https://github.com/Celasha/Toolasha/commit/2ca8947f73e9e01dcab106e0f04ad641b6adea2c))

### Bug Fixes

- make custom tabs import apply layout immediately ([5e32ce2](https://github.com/Celasha/Toolasha/commit/5e32ce2012deb5ccd98874e3722bed40a36e8216))
- resolve loadout snapshots not showing in custom tab editor on production builds ([644043f](https://github.com/Celasha/Toolasha/commit/644043f8b6094574c4864dadceb3614a482cca08))
- show partially-filled cancelled orders as filled in market history ([d58697d](https://github.com/Celasha/Toolasha/commit/d58697dfef0397e0ccbd80f5e58023d01e97f6b9))

## [2.5.1](https://github.com/Celasha/Toolasha/compare/v2.5.0...v2.5.1) (2026-04-10)

### Bug Fixes

- allow time-till-level tooltip to work without XP/hr sidebar enabled ([368e2d0](https://github.com/Celasha/Toolasha/commit/368e2d044bb8acdf47baa156f14dcdb36121ad2e))
- disable collection filters and skilling badges when toggled off ([feb43ac](https://github.com/Celasha/Toolasha/commit/feb43acfa23398e09630a4311d9db8410c89273a))
- remove duplicate Iron Cow Mode checkbox from settings UI ([989ea99](https://github.com/Celasha/Toolasha/commit/989ea996cdb51fe184aa4e522e73e6355de835ce))
- restore task Go merge and queued indicator in Iron Cow mode ([cfb0959](https://github.com/Celasha/Toolasha/commit/cfb0959f9553fecf1dc1f6ca8ad3218f8405c003))

## [2.5.0](https://github.com/Celasha/Toolasha/compare/v2.4.0...v2.5.0) (2026-04-10)

### Features

- add line breaks and move-to-top to custom tab item editor ([9c6ce2c](https://github.com/Celasha/Toolasha/commit/9c6ce2ccdb5bd98c99861c65edf5fc7cc120ef0c))

## [2.4.0](https://github.com/Celasha/Toolasha/compare/v2.3.1...v2.4.0) (2026-04-10)

### Features

- pre-fill action count when navigating via "View Action" from missing materials ([ac40f58](https://github.com/Celasha/Toolasha/commit/ac40f58c14c0a136adbd8686925cef924e77d73a))
- show level gap and tooltip on Automations best-level badges ([140f827](https://github.com/Celasha/Toolasha/commit/140f82746bb4eb35891a4aa7a1b094f719cf6d61))

## [2.3.1](https://github.com/Celasha/Toolasha/compare/v2.3.0...v2.3.1) (2026-04-09)

### Code Refactoring

- move "add all items" toggle into tab editor ([4016d10](https://github.com/Celasha/Toolasha/commit/4016d104c1403d948ea076d275fbc00daf47bf65))

## [2.3.0](https://github.com/Celasha/Toolasha/compare/v2.2.2...v2.3.0) (2026-04-09)

### Features

- add configurable tile spacing setting for Toolasha tab ([eb39e5e](https://github.com/Celasha/Toolasha/commit/eb39e5e896b76ff5193f40a47b11da8203ddd900))

### Bug Fixes

- exclude collapsed-tab enhanced items from Unorganized bucket ([902ed44](https://github.com/Celasha/Toolasha/commit/902ed44fcd3a46f042c78d96ccc4f9f93e94539f))
- only show hidden-items warning when owned items are absent from DOM ([5e25f99](https://github.com/Celasha/Toolasha/commit/5e25f9960e2184e3f9281e5fac73ba065f7d6976))
- prevent concurrent layout calls and update layout on editor item changes ([1bacc33](https://github.com/Celasha/Toolasha/commit/1bacc33d98e358afb4da04675a20b6df741af50f))
- update Unorganized chevron immediately on toggle ([2845a25](https://github.com/Celasha/Toolasha/commit/2845a253994ec2f07c3c49da510d750e369238f7))

### Styles

- compact inventory panel header rows and unify button styles ([ca3e209](https://github.com/Celasha/Toolasha/commit/ca3e209b99bd0ada2187e655d3fa1bfdb43d66e9))

## [2.2.2](https://github.com/Celasha/Toolasha/compare/v2.2.1...v2.2.2) (2026-04-09)

### Bug Fixes

- remove ownership filter from item search; increase tab header color opacity ([8e64979](https://github.com/Celasha/Toolasha/commit/8e64979da78c566bfed11f546cbfb8b1bdaa337b))

## [2.2.1](https://github.com/Celasha/Toolasha/compare/v2.2.0...v2.2.1) (2026-04-09)

### Bug Fixes

- sort category items and category list by game sortIndex ([6057eff](https://github.com/Celasha/Toolasha/commit/6057effdf30efd65132e5bd2e6a3d833feacb087))

## [2.2.0](https://github.com/Celasha/Toolasha/compare/v2.1.0...v2.2.0) (2026-04-09)

### Features

- add "Add to Tab" button to item action menu ([53d8c27](https://github.com/Celasha/Toolasha/commit/53d8c279fb15f14f4c65172c2d59d15ab3f19f77))
- add "From Loadout" section in tab editor to bulk-add loadout items ([5061283](https://github.com/Celasha/Toolasha/commit/50612830d27250fd457665422faafe2a8a0e5b38))
- add color picker and hex input to custom tab color selector ([1b83c2c](https://github.com/Celasha/Toolasha/commit/1b83c2c52b6cd6e059248ab95f16c8a038e6b55c))
- add drag-and-drop item reordering in tab editor ([a9e5e60](https://github.com/Celasha/Toolasha/commit/a9e5e60fd699ca2539fae0071b1dd92b3482fbed))
- add export/import for custom inventory tab layouts ([8fcc6db](https://github.com/Celasha/Toolasha/commit/8fcc6db7b69c8eb93c4d33e6fa57f54581ef20c9))

### Bug Fixes

- pin tab editor footer buttons outside the scrollable modal body ([cfd2b7b](https://github.com/Celasha/Toolasha/commit/cfd2b7b31f2f5562cb4c929bd929d2b89ba76919))
- show summed badge value in custom tab section headers ([4bb15a2](https://github.com/Celasha/Toolasha/commit/4bb15a299dde6833765c95f488535f8b2f591b6d))
- show warning indicator when custom tab items are hidden by collapsed inventory category ([e6cc182](https://github.com/Celasha/Toolasha/commit/e6cc1829bdfd3afe9ed2a67e6544ce11657b6f05))
- sort Unorganized section by game sortIndex ([b3d97be](https://github.com/Celasha/Toolasha/commit/b3d97be8311366c4263fc468ef92670eae6af04b))
- support per-enhancement-level item assignment in custom tabs ([c1924b1](https://github.com/Celasha/Toolasha/commit/c1924b1cb65740421f24c16b3e123fda2c95c140))

### Code Refactoring

- move material tab click handler outside loop to fix no-loop-func lint warning ([cdb8fce](https://github.com/Celasha/Toolasha/commit/cdb8fcefd4fc81f58d55f6544d290451f1cd37b8))

### Styles

- fix Prettier formatting ([b56443b](https://github.com/Celasha/Toolasha/commit/b56443bcb43e073d2d95067322cacf1cb35d26e9))

## [2.1.0](https://github.com/Celasha/Toolasha/compare/v2.0.0...v2.1.0) (2026-04-08)

### Features

- add Clear All button and category remove in tab editor; fix layout order collision ([363120d](https://github.com/Celasha/Toolasha/commit/363120d96ff39ee3a421bfc6698678bdcf4b51e6))

### Bug Fixes

- re-sort custom tabs layout when inventory sort mode changes ([a44da6f](https://github.com/Celasha/Toolasha/commit/a44da6f71e2510c4750e50bcc08c6e87087f8b36))

## [2.0.0](https://github.com/Celasha/Toolasha/compare/v1.67.0...v2.0.0) (2026-04-08)

### ⚠ BREAKING CHANGES

- add Custom Inventory Tabs with drag-and-drop reordering

### Features

- add Custom Inventory Tabs with drag-and-drop reordering ([9d03ca5](https://github.com/Celasha/Toolasha/commit/9d03ca541b5e00470fb1f7610eff849d52fb13ce))

## [1.67.0](https://github.com/Celasha/Toolasha/compare/v1.66.0...v1.67.0) (2026-04-05)

### Features

- add "time to next tier" sort to Collections panel ([ae8d4a3](https://github.com/Celasha/Toolasha/commit/ae8d4a3a1e10a03b5367c7c07650f5870cb6c292))

### Code Refactoring

- decouple queue length estimator from estimated listing age ([2c38628](https://github.com/Celasha/Toolasha/commit/2c38628f45a20a2c7f7b3020af8e1a25e1c70129))
- move and rename combatStats_keyPricing to profitCalc_keyPricingMode ([6d2cbc5](https://github.com/Celasha/Toolasha/commit/6d2cbc56086c8c3c8f1facdb0d7a39b83b7b0323))

## [1.66.0](https://github.com/Celasha/Toolasha/compare/v1.65.5...v1.66.0) (2026-04-05)

### Features

- add Iron Cow mode to disable market and profit settings ([b0f038d](https://github.com/Celasha/Toolasha/commit/b0f038d5673b916e714d2f7d8d2d0647feb93437))

### Bug Fixes

- add mwilinks to external navigation links ([93b3dc8](https://github.com/Celasha/Toolasha/commit/93b3dc8146653c00e5ff96b93368a61fd3bf4e7a))

## [1.65.5](https://github.com/Celasha/Toolasha/compare/v1.65.4...v1.65.5) (2026-04-04)

### Bug Fixes

- restrict mirror path base item lookup to refined items only ([9b8853e](https://github.com/Celasha/Toolasha/commit/9b8853eb55f56e4204fde6815ff427809093f349))
- use same-item costs to determine mirror optimization trigger level ([187095a](https://github.com/Celasha/Toolasha/commit/187095a9ed73fec07917878bcfb6f29f23f4ef60))

## [1.65.4](https://github.com/Celasha/Toolasha/compare/v1.65.3...v1.65.4) (2026-04-04)

### Bug Fixes

- revert erroneous refined item exclusion from protection pricing ([9a3aa6a](https://github.com/Celasha/Toolasha/commit/9a3aa6a09900fb1a2116949c540adb5ebaa66aac))

## [1.65.3](https://github.com/Celasha/Toolasha/compare/v1.65.2...v1.65.3) (2026-04-04)

### Bug Fixes

- exclude refined items from enhancement protection and mirror path costs ([214b050](https://github.com/Celasha/Toolasha/commit/214b050086b7aad671d9e4c02b726c884627031f))
- skip dedup for actions_updated to process isDone:true removals ([08b38c4](https://github.com/Celasha/Toolasha/commit/08b38c4d9981ecb37b9fbc97b6563fec9e061bb1))

## [1.65.2](https://github.com/Celasha/Toolasha/compare/v1.65.1...v1.65.2) (2026-04-02)

### Bug Fixes

- break enhancement panel mutation watcher feedback loop ([ac534cb](https://github.com/Celasha/Toolasha/commit/ac534cbf87ca9d2284948c7d0b8539ba8e343fb8))

## [1.65.1](https://github.com/Celasha/Toolasha/compare/v1.65.0...v1.65.1) (2026-04-02)

### Bug Fixes

- autofill missing mats quantity from live inventory on each buy modal ([4bbb2c2](https://github.com/Celasha/Toolasha/commit/4bbb2c2b52444d455b448eef9c628936f788ea2e))

## [1.65.0](https://github.com/Celasha/Toolasha/compare/v1.64.0...v1.65.0) (2026-04-02)

### Features

- add option to pin item tooltips to top-center of screen ([41bfee3](https://github.com/Celasha/Toolasha/commit/41bfee35a540d058a793ff2eb3c693481bdfed40))

## [1.64.0](https://github.com/Celasha/Toolasha/compare/v1.63.1...v1.64.0) (2026-04-02)

### Features

- add expandable chest rows in net worth inventory panel ([7e2f171](https://github.com/Celasha/Toolasha/commit/7e2f171a1f96597738a606560d4c44d9586aeee4))
- deduct chest key cost from dungeon chest EV in net worth and tooltips ([2d8609f](https://github.com/Celasha/Toolasha/commit/2d8609f6c3a30393f5ddc77728f5ac565745700b))

### Code Refactoring

- eliminate top 5 duplications across profit and market modules ([25cd3d0](https://github.com/Celasha/Toolasha/commit/25cd3d0360b1381030b51f9d8c8f967815177467))

## [1.63.1](https://github.com/Celasha/Toolasha/compare/v1.63.0...v1.63.1) (2026-04-01)

### Bug Fixes

- update alchemy profit display to reflect live catalyst selection ([0282ef7](https://github.com/Celasha/Toolasha/commit/0282ef7f8159edde043de99d6369124eb070351c))

## [1.63.0](https://github.com/Celasha/Toolasha/compare/v1.62.0...v1.63.0) (2026-04-01)

### Features

- add pricing mode naming convention setting ([36efea9](https://github.com/Celasha/Toolasha/commit/36efea9e516d4f37093fcad99e866f1b45838e81))

## [1.62.0](https://github.com/Celasha/Toolasha/compare/v1.61.1...v1.62.0) (2026-03-31)

### Features

- add Buy on Marketplace button to ability book calculator ([154c59a](https://github.com/Celasha/Toolasha/commit/154c59aad4014a5f7838f340f812382606626048))

### Bug Fixes

- split collection filter 10k+ into 10k-100k and 100k+ ([4f824a8](https://github.com/Celasha/Toolasha/commit/4f824a8d69074bba956f940b119427ed6758cc5b))

## [1.61.1](https://github.com/Celasha/Toolasha/compare/v1.61.0...v1.61.1) (2026-03-30)

### Bug Fixes

- include coin costs in crafting cost calculation ([121c021](https://github.com/Celasha/Toolasha/commit/121c021c2af40156830d33e2d47fee1ad5f9cd13))

## [1.61.0](https://github.com/Celasha/Toolasha/compare/v1.60.5...v1.61.0) (2026-03-30)

### Features

- store character gameMode in dataManager ([20801e3](https://github.com/Celasha/Toolasha/commit/20801e39d696c33ccb0902ea2401507c14395e05))

### Bug Fixes

- harden dungeon tracker scrubbing, debounce, and deduplication ([1003dc9](https://github.com/Celasha/Toolasha/commit/1003dc93e4bda4b42a0c2878af370946f1f12507))
- use border-right on chart bars to ensure visible separator ([8103197](https://github.com/Celasha/Toolasha/commit/8103197de1431dff3e1d68c2107a788e1e4e1d25))

## [1.60.5](https://github.com/Celasha/Toolasha/compare/v1.60.4...v1.60.5) (2026-03-29)

### Bug Fixes

- color task profit and efficiency rating by profit/loss ([9fcc247](https://github.com/Celasha/Toolasha/commit/9fcc2470ef7196980f8e1b5d20ea110b6d1c3db6))

## [1.60.4](https://github.com/Celasha/Toolasha/compare/v1.60.3...v1.60.4) (2026-03-29)

### Bug Fixes

- apply collection filters when catsEl is replaced on first load ([ea94ec8](https://github.com/Celasha/Toolasha/commit/ea94ec8b34ea530a2ce84052a57813cec1b63c4c))
- use KMB formatting for task efficiency rating value ([3ea9090](https://github.com/Celasha/Toolasha/commit/3ea9090c8138edf6016d358e03636c8c0f444cef))

## [1.60.3](https://github.com/Celasha/Toolasha/compare/v1.60.2...v1.60.3) (2026-03-29)

### Bug Fixes

- correct per-action and N-actions breakdowns to handle efficiency consistently ([9e1b7d1](https://github.com/Celasha/Toolasha/commit/9e1b7d1bf80f80028c6af26d676489f12f157d96))

### Code Refactoring

- make ask the sole driver for base item crafting cost in enhancement path ([4326459](https://github.com/Celasha/Toolasha/commit/43264595aa1ae912dc107285c5b02f4a047865f7))
- rename pricing modes to Buy/Sell ask/bid labels throughout UI ([d0e94b0](https://github.com/Celasha/Toolasha/commit/d0e94b0e0e04c23af4d8ed1f487a1b88ae85eb7a))

## [1.60.2](https://github.com/Celasha/Toolasha/compare/v1.60.1...v1.60.2) (2026-03-29)

### Bug Fixes

- fall back to production cost when only ask or bid is missing in crafting path tooltip ([8c4e7ba](https://github.com/Celasha/Toolasha/commit/8c4e7ba29510d131d301e9afc049f843455efb4b))

## [1.60.1](https://github.com/Celasha/Toolasha/compare/v1.60.0...v1.60.1) (2026-03-29)

### Bug Fixes

- fix config shadowing and add crafting cost option for enhancement path base item ([f37b621](https://github.com/Celasha/Toolasha/commit/f37b621f3cfe78ea5e69b27aef20fe42bc0bc48f))

## [1.60.0](https://github.com/Celasha/Toolasha/compare/v1.59.2...v1.60.0) (2026-03-29)

### Features

- add setting to use crafting cost for base item in enhancement path ([4c975c5](https://github.com/Celasha/Toolasha/commit/4c975c5b2171fa82f825f979ad7b5447c9b3e364))

## [1.59.2](https://github.com/Celasha/Toolasha/compare/v1.59.1...v1.59.2) (2026-03-29)

### Miscellaneous Chores

- trigger release-please regeneration ([c1de77f](https://github.com/Celasha/Toolasha/commit/c1de77f69ceb14df919aec18198e9450e7f29741))

## [1.59.1](https://github.com/Celasha/Toolasha/compare/v1.59.0...v1.59.1) (2026-03-29)

### Bug Fixes

- prevent Show Uncollected toggle from getting stuck checked ([e39cd66](https://github.com/Celasha/Toolasha/commit/e39cd66a2c8be82499d22adc0ad192ccb6923a90))

## [1.59.0](https://github.com/Celasha/Toolasha/compare/v1.58.0...v1.59.0) (2026-03-29)

### Features

- add sort by items/gold cost to next tier in collection filters ([e216160](https://github.com/Celasha/Toolasha/commit/e216160c1e8aafac779b46f572e2c286243a201a))

## [1.58.0](https://github.com/Celasha/Toolasha/compare/v1.57.1...v1.58.0) (2026-03-29)

### Features

- add Collection Filters feature ([6802499](https://github.com/Celasha/Toolasha/commit/6802499e9a1e58cbae77ba0e99973fc93f0983ef))

## [1.57.1](https://github.com/Celasha/Toolasha/compare/v1.57.0...v1.57.1) (2026-03-28)

### Bug Fixes

- fall back to production cost for unpriced crafting materials ([c2f575c](https://github.com/Celasha/Toolasha/commit/c2f575c914b0f6ce1e8dadef6d87098116989c2f))

### Code Refactoring

- make Philosopher's Mirror color configurable ([1c21e2b](https://github.com/Celasha/Toolasha/commit/1c21e2b5dec49ade06da844140eee1d136d96f2d))

## [1.57.0](https://github.com/Celasha/Toolasha/compare/v1.56.0...v1.57.0) (2026-03-28)

### Features

- improve networth history chart with category lines and UX fixes ([8e8c4c4](https://github.com/Celasha/Toolasha/commit/8e8c4c4480e8de0389ee347d3722e75068852546))

## [1.56.0](https://github.com/Celasha/Toolasha/compare/v1.55.1...v1.56.0) (2026-03-28)

### Features

- show per-category rate stats in networth history chart stats row ([a48db9b](https://github.com/Celasha/Toolasha/commit/a48db9b1de27f5254b3731958dde526ae95db17e))

## [1.55.1](https://github.com/Celasha/Toolasha/compare/v1.55.0...v1.55.1) (2026-03-28)

### Bug Fixes

- use dynamic artisan tea and correct pricing mode in base item production cost ([163ee28](https://github.com/Celasha/Toolasha/commit/163ee2816eee84611adc80b72522ea2338941ade))
- use KMB formatting for all coin and profit values ([b59f25b](https://github.com/Celasha/Toolasha/commit/b59f25bb77f3c42b176f4abd946da73fb92ad243))

## [1.55.0](https://github.com/Celasha/Toolasha/compare/v1.54.0...v1.55.0) (2026-03-28)

### Features

- add per-category line toggles to networth history chart ([230e870](https://github.com/Celasha/Toolasha/commit/230e8700291f1df28fec450ae101067fa12125d0))

### Bug Fixes

- show correct session number in tracker header on load ([c4c6147](https://github.com/Celasha/Toolasha/commit/c4c6147d2bb1319c699e7ddfad8c49916eaacdeb))

## [1.54.0](https://github.com/Celasha/Toolasha/compare/v1.53.3...v1.54.0) (2026-03-28)

### Features

- sort completed tasks to top when using Sort Tasks button ([d72f308](https://github.com/Celasha/Toolasha/commit/d72f308f6d9d7475204129f13b56b0a0458402cb))

### Bug Fixes

- clean up tooltip display when output item has no market data ([6ab8509](https://github.com/Celasha/Toolasha/commit/6ab8509c793aa847989c52cfeda8b5700677707f))
- exclude enhanced items from material requirement inventory count ([dcf8de0](https://github.com/Celasha/Toolasha/commit/dcf8de07d4074a33c756206d38800a25734f8371))

## [1.53.3](https://github.com/Celasha/Toolasha/compare/v1.53.2...v1.53.3) (2026-03-28)

### Bug Fixes

- remove efficiency multiplier from per-action material cost display ([3e4178b](https://github.com/Celasha/Toolasha/commit/3e4178bed6df6b90225a190fb8e5b1b4c00e5df5))
- reserve upgrade item from input count when same item is used for both ([0021e22](https://github.com/Celasha/Toolasha/commit/0021e2294aed9d1030be242c59d797ebd05a1c89))

## [1.53.2](https://github.com/Celasha/Toolasha/compare/v1.53.1...v1.53.2) (2026-03-27)

### Bug Fixes

- apply disabledBy state after settings panel is in the document ([63798a6](https://github.com/Celasha/Toolasha/commit/63798a6a8e28dfc381bacdc4d2670b194194b3c2))

## [1.53.1](https://github.com/Celasha/Toolasha/compare/v1.53.0...v1.53.1) (2026-03-27)

### Bug Fixes

- default enhancement tracker to latest session on load ([7234db4](https://github.com/Celasha/Toolasha/commit/7234db49b40571f4805fde09317f92aa52dc27f2))
- read disabledBy state from currentSettings on panel open ([b32e488](https://github.com/Celasha/Toolasha/commit/b32e488e5b4a0dac12e4463e2bfbbf7e2643c734))

### Miscellaneous Chores

- add [@icon](https://github.com/icon) to userscript header ([b7179de](https://github.com/Celasha/Toolasha/commit/b7179de276c9ce9c200d96a7f4614a876a948378))

## [1.53.0](https://github.com/Celasha/Toolasha/compare/v1.52.0...v1.53.0) (2026-03-27)

### Features

- add loadout snapshot system for accurate profit calculations ([149fcbe](https://github.com/Celasha/Toolasha/commit/149fcbe0fc9960bfb3431083bec8cb3e84b4bf11))

## [1.52.0](https://github.com/Celasha/Toolasha/compare/v1.51.1...v1.52.0) (2026-03-26)

### Features

- add profit mode toggle button to action panel title bar ([0c4b4ba](https://github.com/Celasha/Toolasha/commit/0c4b4baa3b8a67bc262cedb0ef0bff7c39deaa65))

### Miscellaneous Chores

- **main:** release 1.51.1 ([778e102](https://github.com/Celasha/Toolasha/commit/778e102222e28216396ec4915ab76d417ae9255d))
- sync version and format release notes ([461f1a5](https://github.com/Celasha/Toolasha/commit/461f1a5f4367b4474d39cf7a88c5f34e4383c37a))
- trigger release-please re-run ([77644bc](https://github.com/Celasha/Toolasha/commit/77644bc1af7a4c8b26279910d9fd64195235fa48))
- trigger release-please re-run after tag fix ([8d68a42](https://github.com/Celasha/Toolasha/commit/8d68a426569a692b0a5eceeacfa8b8637d009645))
- trim CHANGELOG to last 10 releases ([1f6958e](https://github.com/Celasha/Toolasha/commit/1f6958ee6a8ae74f6189ab11001c60b3e9d40065))

## [1.51.1](https://github.com/Celasha/Toolasha/compare/v1.51.0...v1.51.1) (2026-03-26)

### Bug Fixes

- call disable() on all features during character switch ([20b89ae](https://github.com/Celasha/Toolasha/commit/20b89aedbd5f133d656eb33d3e4caff3f68f8831))

## [1.51.0](https://github.com/Celasha/Toolasha/compare/v1.50.0...v1.51.0) (2026-03-26)

### Features

- add ask/bid prices to Labyrinth Shop tab ([04f91d6](https://github.com/Celasha/Toolasha/commit/04f91d621ab13c314b151005b3226ddfff7b9ceb))

## [1.50.0](https://github.com/Celasha/Toolasha/compare/v1.49.5...v1.50.0) (2026-03-26)

### Features

- add Materials tab to pinned actions page ([286691c](https://github.com/Celasha/Toolasha/commit/286691c1c2833532d661aa665da2e05243796f9e))
- add z-index tier system and bring-to-front for floating panels ([644aef3](https://github.com/Celasha/Toolasha/commit/644aef32c65304c7e39a68a25a914184599626f6))

## [1.49.5](https://github.com/Celasha/Toolasha/compare/v1.49.4...v1.49.5) (2026-03-25)

### Bug Fixes

- correct milkonomy export equipment handling for non-self profiles ([71c1bf2](https://github.com/Celasha/Toolasha/commit/71c1bf286a1953507969fab24d76aa9ac21c96b3))

## [1.49.4](https://github.com/Celasha/Toolasha/compare/v1.49.3...v1.49.4) (2026-03-25)

### Bug Fixes

- always include enhanceLevel in milkonomy export for other profiles ([5a76675](https://github.com/Celasha/Toolasha/commit/5a76675b651002acf9007ca10ce04f6314f7f6a2))

## [1.49.3](https://github.com/Celasha/Toolasha/compare/v1.49.2...v1.49.3) (2026-03-25)

### Bug Fixes

- improve missing mats accuracy and enhancement display polish ([c363b42](https://github.com/Celasha/Toolasha/commit/c363b424da880a5d3fea2d8a92a89c79df32dca0))
- persist collapsed state of settings groups ([6cb7304](https://github.com/Celasha/Toolasha/commit/6cb730455939fb36e66552ef24538ba45e1e772e))

## [1.49.2](https://github.com/Celasha/Toolasha/compare/v1.49.1...v1.49.2) (2026-03-25)

### Code Refactoring

- convert enhancement tooltip costs to table format ([e2cacc2](https://github.com/Celasha/Toolasha/commit/e2cacc23c24bdb4a9f0fcf8470e67750205772d8))

## [1.49.1](https://github.com/Celasha/Toolasha/compare/v1.49.0...v1.49.1) (2026-03-25)

### Bug Fixes

- use tooltip color settings for enhancement total cost ([5c8a1f6](https://github.com/Celasha/Toolasha/commit/5c8a1f694b5c7783e542e7f0a9349d674fd19e30))

## [1.49.0](https://github.com/Celasha/Toolasha/compare/v1.48.1...v1.49.0) (2026-03-25)

### Features

- add missing mats marketplace button to enhancement panels ([ba55e1a](https://github.com/Celasha/Toolasha/commit/ba55e1aeda0aaae5168e3bff1f906142277825ac))

---

_Older entries have been trimmed. Full history is available in the [git log](https://github.com/Celasha/Toolasha/commits/main)._

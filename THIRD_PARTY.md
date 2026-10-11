# Third-party code and asset sources

Camp Glowstick deliberately prefers established human-authored/open assets and algorithms over generated stand-ins.

## Kenney asset packs

Environment models, furniture, props, vehicles and several utility assets are imported from Kenney's CC0 asset packs through the pinned `shorepine/kenney` mirror. See `public/assets/CREDITS.md` for the per-model table and exact pinned source commit.

## Quaternius character and vehicle packs

The school bus and smooth male/female character meshes are imported from pinned Quaternius CC0 packs through `beep2bleep/FreeAssetsByKenneyNLandQuaternius`. Campers and counselors now clone these preloaded skinned assets instead of generating SDF/surface-net character meshes at runtime.

- Source mirror: https://github.com/beep2bleep/FreeAssetsByKenneyNLandQuaternius
- License: CC0 1.0

## OpenAgents / Quaternius camp structures

The one-storey log cabin, woodshed, boathouse and trail shelter are pinned CC0 GLBs from `OpenAgentsInc/openagents/assets/verse/generated/buildings`. OpenAgents' `PROVENANCE.md` records that these models were generated from Quaternius's Medieval Village MegaKit Standard, whose source pieces/textures are CC0 1.0, and explicitly states the generated models remain CC0 1.0.

- Source: https://github.com/OpenAgentsInc/openagents
- Pinned commit: `d9779941e1021274ef240295715f48ef6448f876`
- Provenance: `assets/verse/generated/buildings/PROVENANCE.md`
- License: CC0 1.0
- `log_cabin.glb`: one-storey round-log cabin with porch/chimney, 1,086 triangles
- `woodshed.glb`: open-fronted woodshed with stacked logs/chopping block, 478 triangles
- `boathouse.glb`: timber waterfront boathouse, 2,570 triangles
- `trail_shelter.glb`: open trail shelter with bench/notice board, 228 triangles

These replace the suburban Quaternius `House1`/`House2` models in sleeping/service-camp roles while keeping the browser triangle budget low.

## Poisson-disk sampling

`src/vendor/poissonDiskSampling.ts` is a typed 2D adaptation of Kevin Chapelier's `kchapelier/poisson-disk-sampling` fixed-density implementation. It replaces the project's older home-grown `poisson2d` path in the live map generator, semantic vegetation scatter, maintenance-yard dressing and instanced ground-brush placement.

- Source: https://github.com/kchapelier/poisson-disk-sampling
- Original author: Kevin Chapelier
- Upstream fixed-density implementation: `src/implementations/fixed-density.js`
- License: MIT

Camp Glowstick preserves the upstream process-list/neighbourhood algorithm, deterministic RNG injection, grid acceleration and min/max distance behaviour while specializing it to the game's 2D X/Z world.

## three-pathfinding A* core

`src/vendor/threePathfindingAStar.ts` is a typed adaptation of the A* + binary-heap core from Don McCurdy's `three-pathfinding`, which in turn credits `javascript-astar` for the underlying search implementation. The live camper/monster route function uses this imported A* core instead of Camp Glowstick's previous hand-written open-list search.

- Source: https://github.com/donmccurdy/three-pathfinding
- Upstream files: `src/AStar.js`, `src/BinaryHeap.js`
- Original project: Don McCurdy / three-pathfinding contributors
- License: MIT

The adapter currently feeds a collision-aware grid into the upstream search core. True navmesh/Recast-style walkability remains a separate migration gate and is not represented here as complete.

## YUKA game AI finite-state machine

`src/vendor/yukaFSM.ts` is a small typed adaptation of the finite-state-machine core from Mugen87's YUKA game-AI library. It preserves YUKA's current/previous/global state model and enter/execute/exit transition semantics so Camp Glowstick can build the creature hunter around a proven game-AI primitive rather than another ad-hoc chain of booleans.

- Source: https://github.com/Mugen87/yuka
- Upstream file: `src/fsm/StateMachine.js`
- Original author/project: Mugen87 / YUKA contributors
- License: MIT

Only the FSM core is vendored; the rest of YUKA is not bundled.

## Camp Snallygaster systems

Camp Glowstick also reuses and adapts systems from the owner's earlier `johnwbstanger/Camp_Snallygaster` project. In particular, camper escort formation constants/slot math are ported from `shared/GameHost.ts`, and the physical-prop design (camera-directed throwing, mass-dependent motion, sleeping rigid bodies and impact-noise events) is used as the reference implementation for Glowstick's multiplayer host simulation.

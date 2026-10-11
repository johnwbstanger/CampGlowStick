# Third-party code and asset sources

Camp Glowstick deliberately prefers established human-authored assets and algorithms over generated stand-ins.

## Kenney asset packs

Environment models, furniture, props, vehicles and several placeholder characters are imported from Kenney's CC0 asset packs through the pinned `shorepine/kenney` mirror. See `public/assets/CREDITS.md` for the per-model table and exact pinned source commit.

## Poisson-disk sampling

`src/vendor/poissonDiskSampling.ts` is a typed 2D adaptation of Kevin Chapelier's `kchapelier/poisson-disk-sampling` fixed-density implementation. It replaces the project's older home-grown `poisson2d` path in the live map generator and semantic vegetation scatter.

- Source: https://github.com/kchapelier/poisson-disk-sampling
- Original author: Kevin Chapelier
- Upstream fixed-density implementation: `src/implementations/fixed-density.js`
- License: MIT

Camp Glowstick preserves the upstream Bridson-style process-list/neighbourhood algorithm, deterministic RNG injection, grid acceleration and min/max distance behaviour while specializing it to the game's 2D X/Z world.

## three-pathfinding A* core

`src/vendor/threePathfindingAStar.ts` is a typed adaptation of the A* + binary-heap core from Don McCurdy's `three-pathfinding`, which in turn credits `javascript-astar` for the underlying search implementation. The live camper/monster route function now uses this imported A* core instead of Camp Glowstick's previous hand-written open-list search.

- Source: https://github.com/donmccurdy/three-pathfinding
- Upstream files: `src/AStar.js`, `src/BinaryHeap.js`
- Original project: Don McCurdy / three-pathfinding contributors
- License: MIT

The current adapter still feeds a collision-aware temporary grid into the upstream search core. This is intentionally an intermediate integration point; the same call site can later receive a true authored navmesh/Recast zone without rewriting the monster/camper state machines.

## YUKA game AI finite-state machine

`src/vendor/yukaFSM.ts` is a small typed adaptation of the finite-state-machine core from Mugen87's YUKA game-AI library. It preserves YUKA's current/previous/global state model and enter/execute/exit transition semantics so Camp Glowstick can build the creature hunter around a proven game-AI primitive rather than another ad-hoc chain of booleans.

- Source: https://github.com/Mugen87/yuka
- Upstream file: `src/fsm/StateMachine.js`
- Original author/project: Mugen87 / YUKA contributors
- License: MIT

Only the FSM core is vendored; the rest of YUKA is not bundled.

## Camp Snallygaster systems

Camp Glowstick also reuses and adapts systems from the owner's earlier `johnwbstanger/Camp_Snallygaster` project. In particular, camper escort formation constants/slot math are ported from `shared/GameHost.ts`, and the physical-prop design (camera-directed throwing, mass-dependent motion, sleeping rigid bodies and impact-noise events) is used as the reference implementation for Glowstick's multiplayer host simulation.

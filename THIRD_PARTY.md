# Third-party code and asset sources

Camp Glowstick deliberately prefers established human-authored assets and algorithms over generated stand-ins.

## Kenney asset packs

Environment models, furniture, props, vehicles and several placeholder characters are imported from Kenney's CC0 asset packs through the pinned `shorepine/kenney` mirror. See `public/assets/CREDITS.md` for the per-model table and exact pinned source commit.

## Poisson-disk sampling

`src/vendor/poisson2d.ts` is a 2D specialization/adaptation of Kevin Chapelier's `kchapelier/poisson-disk-sampling` project, used to create natural blue-noise spacing for prop yards and activity zones instead of naive uniform scatter.

- Source: https://github.com/kchapelier/poisson-disk-sampling
- Original author: Kevin Chapelier
- License: MIT

The upstream project remains the design/source reference; Camp Glowstick's specialized version removes the arbitrary-dimensional helpers and accepts the game's deterministic seeded RNG.

## YUKA game AI finite-state machine

`src/vendor/yukaFSM.ts` is a small typed adaptation of the finite-state-machine core from Mugen87's YUKA game-AI library. It preserves YUKA's current/previous/global state model and enter/execute/exit transition semantics so Camp Glowstick can build the creature hunter around a proven game-AI primitive rather than another ad-hoc chain of booleans.

- Source: https://github.com/Mugen87/yuka
- Upstream file: `src/fsm/StateMachine.js`
- Original author/project: Mugen87 / YUKA contributors
- License: MIT

Only the FSM core is vendored; the rest of YUKA is not bundled.

## Camp Snallygaster systems

Camp Glowstick also reuses and adapts systems from the owner's earlier `johnwbstanger/Camp_Snallygaster` project. In particular, camper escort formation constants/slot math are ported from `shared/GameHost.ts`, and the physical-prop design (camera-directed throwing, mass-dependent motion, sleeping rigid bodies and impact-noise events) is used as the reference implementation for Glowstick's multiplayer host simulation.

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

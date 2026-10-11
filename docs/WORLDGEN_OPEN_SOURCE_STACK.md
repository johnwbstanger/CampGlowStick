# Camp Glowstick world-generation stack

This document is the sourcing contract for the environment rewrite. Major systems should be imported/adapted from permissively licensed public projects instead of reimplemented ad hoc.

## Planning references

- Camp Shenandoah master plan — real overnight-camp organization reference for sleeping areas, dining, service, program spaces, circulation and showerhouse relationships.
  - https://www.campshenandoah.org/about-camp-shenandoah/camp-master-plan/
- Camp Y-Noah — precedent for cabin, dining, office, maintenance, waterfront and toilet/shower zoning.
  - https://tcarchitects.com/project/akron-area-ymca-camp-y-noah/
- Deer Lake — precedent for dining-hall-centered camp organization, administration, health, shower/toilet and campsite relationships.
  - https://www.huestistucker.com/projects/deer-lake-dining-hall

These references guide functional relationships. They are not copied as copyrighted architectural drawings.

## Runtime/code libraries to integrate

### recast-navigation-js
- Repository: https://github.com/isaac-mason/recast-navigation-js
- Role: navmesh generation, camper navigation, monster navigation, doorway/interior routing, bus boarding routes.
- Integration rule: replace straight-line/grid-only NPC movement incrementally after browser/iPad profiling.

### three-mesh-bvh
- Repository: https://github.com/gkjohnson/three-mesh-bvh
- Role: accelerated spatial queries against imported static geometry.
- Uses: line of sight, gun rays, interaction rays, placement validation, interior/floor queries, vegetation/building overlap rejection.

### poisson-disk-sampling / existing vendored Poisson implementation
- Repository reference: https://github.com/kchapelier/poisson-disk-sampling
- Role: blue-noise distribution for trees, shrubs and ground-cover clusters.
- Camp Glowstick currently has a small vendored permissive Poisson implementation; semantic masks must wrap it so distribution never overrides building/road/room logic.

### YUKA
- Repository: https://github.com/Mugen87/yuka
- Role: finite-state-machine semantics for the hunter/monster and future NPC behavior.
- Status: the small FSM core is already adapted in `src/vendor/yukaFSM.ts`.

### glTF-Transform
- Repository: https://github.com/donmccurdy/glTF-Transform
- Role: asset preprocessing rather than runtime world logic.
- Uses: deduplication, simplification, Meshopt/KTX2-ready asset optimization, converting richer source art into browser-suitable GLB assets.

### SeedThree / procedural vegetation reference
- Repository: https://github.com/SkyeShark/SeedThree
- Role: reference/source for efficient procedural vegetation, variation and LOD/impostor strategies.
- Integration rule: prefer generating/exporting a curated lightweight vegetation library or adapting efficient instancing concepts rather than shipping an unnecessarily heavy editor/runtime layer.

## Public asset libraries

### Quaternius
- Source: https://quaternius.com/
- License family used by the relevant packs: CC0.
- Intended use: buildings/modules where architecturally appropriate, nature assets, props, characters if they fit the visual target.
- Important rule: generic suburban `House1` is not an acceptable final summer-camp cabin merely because it is available.

### Kenney
- Source: https://kenney.nl/assets
- License: CC0 for Kenney game assets.
- Existing useful Camp Glowstick pieces include beds/bunks, tables, chairs, sinks, storage, camp props, canoes, paddles, tents and small clutter.
- Placement must be semantic; assets are not allowed to scatter simply because there is empty world space.

### Poly Haven
- Source: https://polyhaven.com/models
- License: CC0.
- Intended use: selective hero/environment assets after aggressive optimization. Do not use unoptimized high-poly models for repeated vegetation on mobile.

## Generation order

1. Blueprint/master-plan topology
2. Circulation and districts
3. Building footprints and entrances
4. Building templates / real one-story camp-building proportions
5. Interior room program
6. Furniture sockets
7. Functional props
8. Surface/socket-aware clutter
9. Narrative dressing
10. Exterior activity templates
11. Tree canopy
12. Secondary trees/shrubs
13. Ground brush/grass
14. NPC hiding anchors
15. Validation
16. Runtime instancing/LOD/culling

No lower layer may ignore constraints created by a higher layer.

# Camp Glowstick Environment Upgrade — Milestone A Audit

Date: 2026-10-11
Branch: `env-upgrade/milestone-a-audit`
Base inspected: `main` at `fabbd5c2b3d64398e3f570765af186e990ac3a98`

## Scope and verification status

This milestone is audit/documentation only. No gameplay source was changed.

The connected GitHub repository was inspected directly. A local clone/install was attempted from the execution environment, but DNS resolution to `github.com` is unavailable there, so `npm install`, `npm run build`, `npm test`, browser smoke tests, and physical-iPad FPS checks could **not** be executed in this session. I am not marking those checks as passed. The repository contains scripts for `build`, unit tests, general smoke tests, `smoke:lobby15`, and `smoke:touch`; they must be run by CI or a machine with repository/network access before Milestone A is accepted.

GitHub's combined-status endpoint returned no commit statuses for the inspected `main` SHA, so there is no status result I can use as a substitute for actually running the suite.

## Executive diagnosis

The handoff's high-level diagnosis is correct: the game logic is materially ahead of presentation. However, the repository has progressed beyond several assumptions in the handoff. It already has an authored deterministic campground layout, several Quaternius/OpenAgents models, smooth Quaternius counselor/camper models, Poisson-disk forest placement, imported real camp structures, a lake, roads/clearings, custom landmarks, instancing, ACES tone mapping, and a semantic worldgen library.

The biggest remaining environment problem is therefore not "there is no map system." It is that the current map is split across overlapping systems and still renders much of the world as flat/procedural geometry with placeholder-like materials and simple static AABB collision. The next environment work should consolidate and improve that foundation rather than restart it.

## 1. Current runtime asset system

`src/assets/manifest.ts` is the runtime logical-name manifest. It currently supports GLB plus FBX and normalises source assets to gameplay metres at load time.

### GLB-backed logical assets currently referenced by the manifest

Blocky characters / fallback character family:
- `camper1` → `models/blocky-characters/character-a.glb`
- `camper2` → `models/blocky-characters/character-b.glb`
- `camper3` → `models/blocky-characters/character-c.glb`
- `camper4` → `models/blocky-characters/character-d.glb`
- `camper5` → `models/blocky-characters/character-e.glb`
- `camper6` → `models/blocky-characters/character-f.glb`
- `camper7` → `models/blocky-characters/character-g.glb`
- `camper8` → `models/blocky-characters/character-h.glb`

Monster / props / environment:
- `monster` → `models/graveyard/character-zombie.glb`
- `bunk` → `models/furniture/bedBunk.glb`
- `bedSingle` → `models/furniture/bedSingle.glb`
- `chair` → `models/furniture/chair.glb`
- `table` → `models/furniture/table.glb`
- `bookshelf` → `models/furniture/bookcaseOpen.glb`
- `sink` → `models/furniture/bathroomSink.glb`
- `teddy` → `models/furniture/bear.glb`
- `cooler` → `models/survival/box-large.glb`
- `crate` → `models/survival/box.glb`
- `backpack` → `models/survival/bedroll-packed.glb`
- `lantern` → `models/holiday/lantern.glb`
- `tent` → `models/nature/tent_detailedClosed.glb`
- `tree` → `models/nature/tree_pineTallA.glb`
- `tree2` → `models/nature/tree_pineTallB.glb`
- `tree3` → `models/nature/tree_pineDefaultA.glb`
- `groundBrush` → `models/nature/ground_grass.glb`
- `campfire` → `models/survival/campfire-pit.glb`
- `mug` → `models/food/mug.glb`
- `can` → `models/food/can.glb`
- `canoe` → `models/nature/canoe.glb`
- `paddle` → `models/nature/canoe_paddle.glb`
- `bucket` → `models/survival/bucket.glb`
- `bottle` → `models/survival/bottle.glb`
- `barrel` → `models/survival/barrel.glb`
- `radio` → `models/furniture/radio.glb`
- `sock` → `models/holiday/sock-red.glb`
- `axe` → `models/survival/tool-axe.glb`
- `logs` → `models/nature/log_stack.glb`
- `rock` → `models/nature/rock_largeA.glb`
- `boulder` → `models/survival/rock-a.glb`
- `sign` → `models/survival/signpost.glb`
- `ground` → `models/nature/ground_grass.glb`

OpenAgents GLB structures:
- `cabin` → `models/openagents/log_cabin.glb`
- `shed` → `models/openagents/woodshed.glb`
- `boathouse` → `models/openagents/boathouse.glb`
- `trailShelter` → `models/openagents/trail_shelter.glb`

### FBX-backed production assets already in the repo

These contradict the assumption that all characters are still Kenney/blocky placeholders:
- `camperMale` → Quaternius `Smooth_Male_Casual.fbx`, normalised to 1.28 m
- `camperFemale` → Quaternius `Smooth_Female_Casual.fbx`, normalised to 1.24 m
- `counselorMale` → Quaternius `Smooth_Male_Shirt.fbx`, normalised to 1.82 m
- `counselorFemale` → Quaternius `Smooth_Female_Casual.fbx`, normalised to 1.74 m
- `lodge` → Quaternius `Building1_Small.fbx`
- `bus` → Quaternius `SchoolBus.fbx`

This means character work should first audit how these Quaternius models are actually presented/animated before shopping for an entirely new character family.

## 2. Loader / rendering behavior

`src/assets/loader.ts` already does several things requested by the handoff:
- one cached `GLTFLoader`
- Meshopt decoder already configured
- FBX loading supported
- `SkeletonUtils.clone` used for fresh skinned clones
- shared cache by logical asset id
- material normalisation toward a matte Camp Glowstick finish
- imported model scaling to manifest dimensions
- bottom-centre pivot normalisation
- magenta labelled placeholder fallback
- imported shadow casting disabled on touch-like devices while retaining shadow receiving
- `modelMeshes()` exposes imported meshes for instanced rendering

Not yet present in this loader:
- DRACO loader
- KTX2 loader/transcoder
- machine-readable license/collider/mass metadata per asset
- explicit per-asset LOD definitions
- sector lifetime/disposal manager

The proposed Milestone B pipeline is still useful, but it should extend this loader instead of replacing it.

## 3. Primitive-generated / procedural presentation found

Primitive geometry is not limited to placeholders. Significant visible world content is still built in code.

Known primitive/procedural categories:
- missing-asset magenta wireframe boxes in `src/assets/loader.ts`
- terrain: one large subdivided `PlaneGeometry` in `src/game/world.ts`
- lake: `CircleGeometry` with a simple `MeshPhysicalMaterial`
- roads: repeated `PlaneGeometry` segments plus `CircleGeometry` joints
- clearings: flat `CircleGeometry` overlays
- custom landmark buildings/interiors in `src/game/world.ts`: extensive `BoxGeometry` panels for floors, walls, trim, roofs, tables, counters, fixtures and doors
- signage/decals: canvas textures on plane geometry
- director gun in `src/game/gun.ts`: procedurally assembled primitive geometry
- procedural creature details in `src/game/creature.ts`: sphere/box and other primitive parts
- glowstick and associated VFX: code-generated meshes/effects
- muzzle flash sphere in `src/game/game.ts`

The hero-environment problem is therefore more specific than "all assets are blocks": imported structures exist, but important landmarks/interiors/roads/terrain are still primitive-authored and visually simplistic.

## 4. Current map/layout architecture

### Runtime layout

The active runtime map is primarily authored in `src/game/layout.ts`.

Important findings:
- the map is deterministic from a shared seed
- major cabin positions are authored constants rather than random scatter
- roads are authored polyline networks with explicit widths
- clearings are authored ellipses
- water has an authored ellipse/position
- buildings are placed before furniture, props and forest
- cabins are oriented toward camp circulation/core
- interior bunk/bookshelf/table placement is transformed from cabin-local offsets
- tents are grouped into authored activity compounds
- signs/rocks/logs/canoes are authored
- vegetation is placed last using deterministic Poisson-disk sampling and exclusions around infrastructure/roads/clearings/lake
- item scatter is seeded and deterministic

This is substantially better than the handoff's assumption of flat random scatter.

### Separate semantic worldgen library

`src/worldgen/` already contains:
- `campBlueprint.ts`
- `placement.ts`
- `semanticRules.ts`
- `semanticTypes.ts`

`campBlueprint.ts` defines one-story cabin, dining hall, bathhouse and maintenance semantic templates plus district footprints. `placement.ts` has deterministic semantic Poisson scatter and masks.

However, the runtime `src/game/layout.ts` remains a separate implementation. The semantic blueprint system appears to be tested and documented but is not the single runtime source of truth proposed by the new handoff.

Recommendation for Milestone D: do **not** immediately create a third independent `src/world/campLayout.ts`. First choose whether `src/game/layout.ts` becomes the canonical authored layout or whether the semantic worldgen types are promoted into it. Consolidate instead of duplicating.

## 5. Terrain findings

This is the clearest direct contradiction with the desired environment plan.

`src/game/terrain.ts` intentionally returns `0` for every `terrainHeight(x,z)` query. The file explicitly says the ground is deliberately flat so buildings, roads, props, campers, physics bodies and touch movement share one trustworthy floor plane.

Consequences:
- the visible terrain mesh in `world.ts` is subdivided but all vertices remain at Y=0
- roads/clearings sit as small offsets above that plane
- AI, player placement and monster Y currently depend on the same flat height function

This is good news architecturally: a shared `terrainHeight()` function already exists. Milestone D should replace the implementation behind that API and preserve callers rather than introduce a competing height API.

## 6. Forest findings

The forest is no longer uniform grid scatter:
- three pine variants are used
- placement is deterministic Poisson-disk blue-noise
- roads, clearings, lake, buildings, tents and the bus area mask trees out
- the runtime layout caps forest placement at 500 trees
- `world.ts` can use `InstancedMesh` via `modelMeshes()`

Still missing relative to the handoff:
- ecological density map / biome bands
- canopy vs secondary trees vs understory layers
- bushes/ferns/ground plants as independent layers
- scale/lean variation in the active `Placed` type
- billboard/far-tree LOD
- authored forest-edge composition
- ground-cover fade system
- wind shader

Thus the right next step is forest layering, not simply "switch to Poisson sampling" (already done).

## 7. Collision architecture

Static player/monster collision is primarily a custom lightweight AABB system, not cannon-es geometry everywhere.

`src/game/colliders.ts` defines a vertical capsule resolver against arrays of axis-aligned `Box` colliders. It pushes the capsule out in XZ and clamps to the world boundary.

`src/game/world.ts` derives or authors collision boxes:
- `boxOf()` creates an AABB from rendered object bounds
- building shells are approximated by wall-segment AABBs with a front doorway gap
- open-frame structures use post boxes
- doors mutate their AABB; when open the collider is parked outside the map

This is a major constraint for richer rotated buildings and sculpted terrain. The current static collision system is intentionally simple and may become the first real technical blocker as environment geometry becomes less axis-aligned.

`cannon-es` **is** genuinely used in `src/game/hostsim.ts` for host-side simulation, so it is not merely a stale dependency. The handoff is correct not to remove it without evidence.

Recommendation: before a Rapier migration, benchmark the current split architecture (custom capsule/AABB static collision + Cannon dynamic bodies). A full physics-engine swap is not automatically required just to improve static world collision; oriented collider proxies or a nav/collision layer could potentially preserve Cannon for dynamic props.

## 8. Navigation / AI movement findings

There is no evidence in the inspected runtime of a baked Recast navmesh.

Camper following currently uses the inherited Camp Snallygaster formation math in `src/game/followerSteering.ts`, producing target slots behind a counselor, then HostSim applies collision/navigation behavior afterward. The file explicitly describes later navmesh/crowd integration as future work.

Current navigation therefore appears to be target steering plus static collision resolution rather than authored navmesh routing.

This makes Milestone G valid, but the new terrain/building work in D/E must not outpace AI traversal. Any new elevation, stairs, doors and interiors must be introduced with a reachability strategy from the start.

## 9. Lighting / atmosphere baseline

Already present:
- ACES filmic tone mapping in `Game`
- dedicated `Lighting` class and host-synced time calls
- existing 1k HDRI (`public/assets/hdri/venice_sunset_1k.hdr`)
- touch-specific shadow reduction
- water surface
- existing time/night state

The planned lighting milestone should therefore evolve existing systems rather than add them from scratch.

## 10. Multiplayer / systems that environment work must preserve

The active `Game` construction confirms the environment is integrated with:
- deterministic `buildLayout(start.seed, start.need)`
- asset preload based on layout contents
- host authoritative `HostSim`
- custom static colliders handed into HostSim
- touch controls
- multiplayer remote avatars
- campers
- monster
- glowsticks/items
- doors
- camp map UI
- bus/extraction systems elsewhere in `src/game`

The handoff rule not to rewrite those systems merely to improve presentation is correct.

## 11. Contradictions / updates to the handoff

1. **"No authored composition" is outdated.** There is already an authored road network, cabin clusters, clearings, water, activity compounds and landmark placement in `src/game/layout.ts`.
2. **"Uniform forest" is partly outdated.** Three tree variants are already Poisson-disk distributed with semantic exclusions. What is still missing is ecological layering, density variation, understory and LOD.
3. **"Only Kenney stand-ins" is outdated.** Quaternius smooth human FBXs, Quaternius lodge/bus, and OpenAgents cabin/shed/boathouse/trail shelter are already in the manifest.
4. **Flat terrain is intentional, not accidental.** `terrainHeight()` explicitly returns zero to keep gameplay stable. Replacing it requires coordinated collision/AI work.
5. **There is already a semantic worldgen subsystem.** Creating `src/world/campLayout.ts` without reconciling `src/game/layout.ts` and `src/worldgen/*` would create unnecessary duplication.
6. **Meshopt and `SkeletonUtils.clone` are already configured.** Milestone B should add DRACO/KTX2/licensing/validation/LODs rather than reimplement existing loader capabilities.
7. **Static collision is not primarily Cannon shapes.** It is a custom capsule-vs-AABB resolver; Cannon is used host-side for simulation/dynamics. Physics upgrades must account for this split.
8. **The current bus is already a Quaternius SchoolBus FBX**, not the documented Kenney Car Kit van stand-in.
9. **Production counselor/camper assets are already Quaternius smooth humans.** Character replacement may still be warranted, but it is no longer correct to assume block characters are the only current models.

## 12. Milestone C–D asset shopping list

Do not buy/download everything at once. The current repository already contains many Kenney/Quaternius/OpenAgents assets, so the first shopping pass should target missing categories that materially improve the arrival sector and forest.

### Highest-priority additions

1. **Quaternius nature/forest pack**
   - Need: multiple deciduous/conifer canopy trees, saplings, bushes, ferns/ground plants, rocks, logs, stumps.
   - Purpose: replace the current three-pine-only ecology with layered vegetation.
   - Verify current pack title/license on Quaternius before downloading. Prefer CC0.

2. **Quaternius or another CC0 modular wooden-building pack**
   - Need: wall, window, door, roof, porch/step, trim modules suitable for rustic structures.
   - Purpose: make arrival/admin/cabins visually coherent and allow real interiors without procedural box walls.
   - Existing OpenAgents log cabin can remain as a reference/secondary asset if it matches.

3. **Kenney Building Kit (CC0)**
   - Current official Kenney listing exists and is CC0.
   - Use mainly for compatible modular components/secondary structures, not automatically as the hero cabin style.

4. **Kenney Survival Kit (CC0)**
   - Already represented in current assets, so only download/reimport if the local source pack is incomplete.
   - Need: campfire, tools, storage, barrels/buckets and utility dressing.

5. **Kenney Furniture Kit / equivalent CC0 furniture source**
   - Existing furniture GLBs are already present; verify whether source pack completeness is enough before downloading duplicates.
   - Need specifically: bunks, tables, chairs, shelves, office furniture, bathroom fixtures.

6. **Ground/material source: ambientCG or Poly Haven CC0 PBR textures**
   Acquire 1–2k versions of:
   - forest grass / meadow grass
   - packed dirt / forest soil
   - gravel
   - rock
   - weathered or painted wood
   - rusted/weathered metal
   - optional sand/mud for shoreline

7. **Poly Haven HDRI: Bismarckturm Hillside, 1k**
   - CC0.
   - Strong fit for warm low-contrast sunset/open-camp ambient lighting.
   - Alternative: Treetop Balcony 1k if a more forest-enclosed sunset is preferred.
   - The repo already has `venice_sunset_1k.hdr`; this is optional until side-by-side lighting proves it improves the camp.

8. **Hero bus replacement/upgrade**
   - Do not download another generic car kit just because the handoff says so: the repo already uses Quaternius `SchoolBus.fbx`.
   - First inspect/render the existing bus. If inadequate, search Poly Pizza or another source for **school bus** with explicit CC0/CC-BY terms and record author/license.
   - Required qualities: recognizable school/camp bus proportions, doors/interior possibility, repaintable material separation.

9. **Canoe/dock/arrival-detail assets**
   - Canoe already exists in the current nature assets.
   - Search only for missing hero pieces: wooden dock modules, canoe rack, bulletin board, entrance sign, utility poles, flagpole, picnic tables.
   - Poly Pizza licenses vary; record author/license per model and skip anything unclear.

### Character shopping — defer until after environment Milestone D

Do **not** immediately replace current Quaternius smooth humans. First evaluate them in the improved environment.

If replacement is still desired, KayKit currently has:
- `Characters : Adventurers` — CC0, rigged/animated, GLTF/FBX
- `Character Animations` — CC0, 133 humanoid animations, GLTF/FBX, including movement/crouch/crawl/interact/etc.

These are technically suitable and mobile-friendly, but their RPG-adventurer costume direction may require significant visual adaptation for 1980s camp counselors. A more neutral human pack would be preferable if available.

## 13. Proposed Milestone B adjustment

Keep the intent of Milestone B but adapt it to current code:

1. Extend the existing TypeScript manifest rather than replacing it blindly.
2. Add source/author/license/url/modified/collider/noiseMaterial/mass/LOD metadata.
3. Add a build validator and generated `CREDITS.md`.
4. Keep current Meshopt support.
5. Add KTX2/Basis support if assets actually use it.
6. Add DRACO only if chosen source assets require or benefit from it.
7. Preserve FBX support until all production FBX assets have a deliberate GLB migration path.
8. Add sector-aware resource ownership/disposal separately; do not couple that rewrite to license validation.

## 14. Acceptance blockers for Milestone A

Repository audit/documentation: complete.
Gameplay changes: none.
Branch: created.
`AUDIT.md`: created.

Not verified because this execution environment cannot clone/install from GitHub:
- `npm install`
- `npm run build`
- `npm test`
- `npm run smoke`
- `npm run smoke:lobby15`
- `npm run smoke:touch`
- live two-browser play
- physical iPad FPS/touch test

Milestone A should be considered **code-audit complete but execution-verification pending** until those commands run successfully in CI or a development machine.

## 15. Recommendation before Milestone B

The most important architectural decision is not which new asset pack to download. It is to preserve the existing deterministic gameplay layout while consolidating the duplicated runtime-layout and semantic-worldgen concepts.

Do not rebuild the map from scratch. Use the current `buildLayout(seed)` contract as the compatibility boundary, replace flat terrain and presentation behind it incrementally, and keep host/client determinism intact.

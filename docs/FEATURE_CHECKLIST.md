# Camp Glowstick — master feature checklist

This file mirrors the 153-item feature backlog and is the implementation source of truth.

Legend: `- [x]` = implemented **and** covered by a deterministic/unit/browser check where practical. `- [ ]` = still needs implementation or verification. `PARTIAL` means useful code exists but it is not yet production-complete.

Two requirements supersede the older spreadsheet wording:
- **CG-071 / CG-127:** no fatigue system. Sprint is unlimited and the stamina UI must be removed.
- **CG-096:** dusk progression target is **about six minutes**, not two minutes.

## 1. Core loop

- [x] **CG-001** Host / join lobby — PeerJS lobby codes and 3-client smoke coverage.
- [ ] **CG-002** 10–15 player lobby — cap is 15; still needs a dedicated 15-client stress smoke.
- [x] **CG-003** Ready-up flow — host cannot start until guests ready.
- [ ] **CG-004** Arrival sequence — needs Gary board → load → spawn outside bus narrative sequence.
- [x] **CG-005** Find campers objective — seven authoritative camper entities and interaction.
- [x] **CG-006** Escort / rescue campers — bounded follower formation is smoke tested.
- [x] **CG-007** Return campers to bus — follower-to-bus boarding is smoke tested.
- [ ] **CG-008** Successful extraction — PARTIAL: win state exists; final extraction presentation needs finishing.
- [x] **CG-009** Failure state — authoritative monster loss is smoke tested.
- [ ] **CG-010** Round reset / replay — needs replay flow without a page reload.

## 2. World and map

- [ ] **CG-011** Large camp footprint — PARTIAL; current large layout exists, but staged smaller Level 1 is now the desired design.
- [ ] **CG-012** Illustrated-map layout overlay — PARTIAL; map UI exists, art/layout needs authored camp-map treatment.
- [ ] **CG-013** Terrain elevation — requirement under review; current priority is stable/flat walkable ground rather than broken height planes.
- [ ] **CG-014** Natural road grading — PARTIAL road overlay; must match the final terrain strategy.
- [x] **CG-015** Grass regions — rendered camp ground regions exist.
- [x] **CG-016** Forest density zones — deterministic tree zones avoid roads/clearings/lake.
- [ ] **CG-017** Named areas — PARTIAL: named landmark buildings exist; level/map labels need completion.
- [x] **CG-018** Navigation landmarks — campfire, bus, buildings, roads, lake, signs.
- [x] **CG-019** Playable lake / waterfront — lake and waterfront props render; collision polish remains under CG-107.
- [ ] **CG-020** Dock — not production complete.
- [x] **CG-021** Campfire clearing — central clearing + campfire exists.
- [x] **CG-022** Campsite clusters — tents and activity clusters exist.
- [x] **CG-023** Map boundaries — player collision is bounded by world limits.
- [x] **CG-024** In-game map item / UI — map overlay exists and shows player data.

## 3. Buildings

- [ ] **CG-025** Cabin exteriors — PARTIAL: Quaternius House1 now replaces the old frame art; visual review still required.
- [ ] **CG-026** Enterable cabins — current Quaternius shells are intentionally non-solid until doorway-accurate colliders are authored.
- [ ] **CG-027** Cabin wall collision — must be authored against visible walls, not whole-model AABBs.
- [ ] **CG-028** Cabin doors — needs opening/closing door system.
- [ ] **CG-029** Cabin interiors — PARTIAL furniture scenes; needs finished layouts and collision-safe anchoring.
- [ ] **CG-030** Dining hall — PARTIAL: gameplay landmark exists; replace primitive shell with imported authored art.
- [ ] **CG-031** Kitchen / pantry — PARTIAL landmark exists; needs imported shell and richer interior.
- [ ] **CG-032** Bathhouse — PARTIAL landmark exists; needs imported shell and richer interior.
- [ ] **CG-033** Arts & crafts — PARTIAL landmark exists; needs imported shell and richer interior.
- [ ] **CG-034** Maintenance shed — PARTIAL: Quaternius House2 art now used for utility structures.
- [ ] **CG-035** Director office — PARTIAL: gameplay location exists; needs imported building/furniture pass.
- [ ] **CG-036** Treehouse — pending.

## 4. Bus / extraction vehicle

- [ ] **CG-037** Full-size camp bus — PARTIAL: Quaternius SchoolBus imported; visual scale/orientation still needs device review.
- [ ] **CG-038** Enterable bus interior — PARTIAL collision shell; imported exterior does not yet provide a finished interior.
- [ ] **CG-039** Bus enter / exit interaction — safe-zone walking exists; explicit enter/exit state still pending.
- [x] **CG-040** Bus safe zone — monster prey logic excludes players inside extraction zone.
- [x] **CG-041** Camper seating / occupancy — seven transformed seat locations exist inside bus coordinates.
- [x] **CG-042** Final boarding — all rescued campers can be assigned interior seats.
- [ ] **CG-043** Outro bus departure — pending cinematic/end sequence.

## 5. Campers

- [x] **CG-044** Seven distinct camper characters — seven identities exist; final visual variants are still refined under character polish.
- [x] **CG-045** Camper spawn system — seven deterministic authoritative spawns.
- [ ] **CG-046** Indoor camper spawns — needs room-anchor spawning after buildings are finalized.
- [x] **CG-047** Outdoor camper spawns — supported.
- [ ] **CG-048** Camper idle animation — PARTIAL.
- [x] **CG-049** Scared / hiding poses — hidden camper posture exists.
- [x] **CG-050** Camper dialogue — dialogue system exists; writing polish continues.
- [x] **CG-051** Follow counselor — compact, bounded per-counselor formation with hard recovery; smoke tested.
- [ ] **CG-052** Carry camper — pending.
- [ ] **CG-053** Drop camper — pending.
- [x] **CG-054** Camper rescue counter — authoritative rescued count in snapshots/HUD.
- [x] **CG-055** Camper safety in bus — rescued campers leave follow/chase exposure and occupy bus seats.

## 6. Player characters

- [ ] **CG-056** Polished counselor avatar style — PARTIAL: Quaternius Smooth characters imported; final outfit/art direction needs review.
- [x] **CG-057** Multiple counselor variants — male/female authored variants available.
- [ ] **CG-058** First-person body presence — pending finished body/hands treatment.
- [ ] **CG-059** Remote walk / run animation — PARTIAL.
- [ ] **CG-060** Crouch animation — PARTIAL.
- [x] **CG-061** Jump state — movement supports jumping; animation polish pending elsewhere.

## 7. Controls and interaction

- [x] **CG-062** Tap Space = jump — input behavior implemented.
- [x] **CG-063** Hold Space = crouch — input behavior implemented.
- [x] **CG-064** Mouse click = interact / pickup — same gameplay action path as E.
- [x] **CG-065** E interact fallback — implemented.
- [x] **CG-066** Click to throw held item — implemented.
- [x] **CG-067** Click-hold charged throw — hold duration maps to throw force.
- [x] **CG-068** Gentle drop / place — separate drop action exists.
- [x] **CG-069** Context prompt — camper/item/bus/gun contextual prompt exists.
- [x] **CG-070** Flashlight toggle — implemented.
- [ ] **CG-071** Unlimited sprint / no fatigue — **OVERRIDE:** remove remaining stamina logic entirely.

## 8. Props and physics

- [x] **CG-072** Context-aware prop placement — activity zones + human-authored camp decor used.
- [x] **CG-073** No props falling from sky — item placement is terrain-aware on spawn.
- [ ] **CG-074** Tabletop placement — PARTIAL authored decor; needs explicit surface anchors.
- [ ] **CG-075** Wall-lean placement — needs wall anchors and safe rotation rules.
- [x] **CG-076** Picnic-table clutter — authored picnic-area decor exists.
- [x] **CG-077** Campsite clutter — zone-based camp clutter exists.
- [ ] **CG-078** Precarious stacks — needs stable initial stacks that become dynamic when disturbed.
- [x] **CG-079** Noise from impacts — material/impact noise bus is authoritative.
- [x] **CG-080** Throw collision — Cannon physics + thrown-impact noise.
- [x] **CG-081** Pickup reach / facing test — server validates reach/facing.
- [x] **CG-082** Physics sleep — Cannon bodies use sleep thresholds.

## 9. Monster

- [ ] **CG-083** Scary final creature model — placeholder zombie must be replaced.
- [x] **CG-084** Monster cannot pass through walls — navigation/collision path uses world colliders; needs building-regression coverage as colliders are rebuilt.
- [x] **CG-085** Pathfinding / navigation — navigation module exists; continue obstacle quality pass.
- [ ] **CG-086** Door interaction — pending with door system.
- [x] **CG-087** Indoor search — PARTIAL search state exists; final interiors need validation.
- [x] **CG-088** Bus exclusion — monster cannot target player inside bus safe zone.
- [x] **CG-089** Line of sight — monster perception supports LOS.
- [x] **CG-090** Hearing — noise bus drives investigation.
- [x] **CG-091** Chase burst — chase state exists.
- [x] **CG-092** Search state — search/investigate behavior exists.
- [ ] **CG-093** Attack animation — needs final creature animation.
- [ ] **CG-094** Monster audio cues — PARTIAL synthetic growl; needs authored audio library pass.

## 10. Lighting / atmosphere

- [x] **CG-095** Sunset starting state — game begins around warm sunset/dusk.
- [ ] **CG-096** Six-minute dusk progression — **OVERRIDE:** verify and lock to ~6 minutes with regression test.
- [x] **CG-097** Blue hour — lighting timeline includes intermediate blue-hour state.
- [x] **CG-098** Long sunset shadows — directional sun/shadow treatment exists.
- [x] **CG-099** Night endpoint — authoritative night state exists.
- [x] **CG-100** Sky gradient — sunset-to-night sky treatment exists.
- [x] **CG-101** Building interior lighting — PARTIAL practical lights; final building pass required.
- [x] **CG-102** Camp practical lights — campfires/lanterns/path lighting exist.
- [x] **CG-103** Fog / haze — atmospheric scene fog/haze exists.
- [ ] **CG-104** Weather hooks — pending extensible weather state.

## 11. Water

- [x] **CG-105** Water shader / surface — physical lake material exists.
- [ ] **CG-106** Shoreline blending — pending finished shoreline transition.
- [ ] **CG-107** Water collision / bounds — visual lake exists; gameplay water boundary needs dedicated behavior.
- [x] **CG-108** Canoes — imported canoe assets placed at waterfront.
- [ ] **CG-109** Ambient lake audio — pending authored ambience.

## 12. Audio / voice

- [ ] **CG-110** Proximity voice chat — PARTIAL: WebRTC + HRTF proximity exists; coordinated mic readiness/heartbeat fix is under CI now; TURN remains separate.
- [ ] **CG-111** Footstep materials — PARTIAL step noise exists; audible material-specific footsteps need imported sample pass.
- [x] **CG-112** Prop impact sounds — material-specific WebAudio sounds respond to impact noise.
- [ ] **CG-113** Camp ambience — pending imported ambience loop(s).
- [ ] **CG-114** Night ambience — pending imported night/cricket/woods ambience.
- [ ] **CG-115** Interior occlusion — pending audio occlusion/low-pass by walls.

## 13. Multiplayer / networking

- [x] **CG-116** Reliable position sync — 20 Hz host-authoritative player snapshots; remote movement smoke test.
- [x] **CG-117** State interpolation — client interpolation module is used for remote state.
- [x] **CG-118** Item sync — multiplayer thrown-item/glowstick smoke test.
- [x] **CG-119** Camper sync — authoritative camper snapshots; follower state is cross-client.
- [x] **CG-120** Monster authority — monster simulation is host authoritative.
- [ ] **CG-121** Reconnect handling — heartbeat diagnostics added; transparent reconnection still pending.
- [ ] **CG-122** TURN relay — code supports TURN env vars; production relay credentials/service not configured.
- [ ] **CG-123** Dedicated / server-backed path — pending production networking architecture beyond host peer.
- [ ] **CG-124** Latency diagnostics — PARTIAL: ping/pong RTT is now implemented; surface it in lobby/debug UI and test it.

## 14. HUD / UX

- [x] **CG-125** Objective HUD — camper count / return-to-bus objective exists.
- [x] **CG-126** Interaction reticle — center reticle + contextual prompt exists.
- [ ] **CG-127** Remove stamina display — **OVERRIDE:** spreadsheet's stamina display is obsolete; delete it.
- [x] **CG-128** Held item display — current held item is shown.
- [ ] **CG-129** Camper roster — rescue count exists; named camper roster UI still pending.
- [x] **CG-130** Map screen — implemented; staged-level art polish pending.
- [ ] **CG-131** Lobby diagnostics — PARTIAL: player/ready/voice exists; add RTT/connection/voice status.
- [x] **CG-132** Endgame screen — win/lose result display exists; cinematic polish remains CG-043.

## 15. Story / secrets / loot

- [x] **CG-133** Funny camp signs — decal/sign system exists.
- [ ] **CG-134** Camper journals — pending authored journal pickups/read UI.
- [ ] **CG-135** Environmental storytelling — PARTIAL signs/graffiti; needs narrative placements and Gary intro.
- [ ] **CG-136** Director desk key sequence — pending piggy-bank/key/locked desk chain.
- [ ] **CG-137** Rare large firearm reward — PARTIAL gun exists; reward sequence/model/destruction behavior not final.
- [x] **CG-138** Loot / fun finds — loot pool and extraction exist; continue variety pass.

## 16. Performance / platforms

- [ ] **CG-139** 60 FPS desktop — performance counters exist; needs automated/representative budget check.
- [ ] **CG-140** iPad browser target — touch support exists, but physical-device validation is still required.
- [ ] **CG-141** Phone support — responsive touch exists; physical-device validation required.
- [x] **CG-142** Tree instancing / LOD — trees are instanced; LOD can still be expanded.
- [ ] **CG-143** Prop instancing / batching — static repeated props need broader batching pass.
- [x] **CG-144** Asset preload progress — loading/progress pipeline exists.
- [x] **CG-145** No missing assets — asset manifest tests validate fetched GLB/FBX files and runtime smoke rejects placeholders.

## 17. Tests / deployment

- [x] **CG-146** Smoke test robustness — 3-client browser smoke covers lobby, multiplayer, campers, throw, monster, rendering and console errors; voice is being hardened further.
- [ ] **CG-147** World visual regression — needs screenshot/pixel-regression baselines for camp/sunset/night.
- [ ] **CG-148** Building entry test — add after final doorway colliders.
- [ ] **CG-149** Bus safe-zone test — behavior exists; add explicit browser assertion.
- [x] **CG-150** Camper rescue test — follower range and boarding path is smoke tested.
- [ ] **CG-151** Sunset timeline test — pending six-minute lighting regression.
- [x] **CG-152** GitHub Pages deploy from main — workflow deploy path is main-gated.
- [x] **CG-153** Branch discipline — work is isolated in feature/fix branches and merged only after checks.

## Current execution order

1. **Stabilize:** finish CG-002, CG-110, CG-121/122/124, then require repeatable green CI.
2. **Core loop:** CG-004, CG-008, CG-010 and bus/extraction polish.
3. **World/buildings:** CG-011–043 with staged Level 1 and imported authored structures.
4. **Characters/interaction:** CG-044–082, including complete stamina removal.
5. **Monster:** CG-083–094.
6. **Atmosphere/audio:** CG-095–115, including six-minute dusk and real ambience.
7. **Networking/UX/story:** CG-116–138.
8. **Optimization/QA:** CG-139–153 with real-device and visual-regression checks.

A box is only checked when the implementation is present and there is a meaningful verification path. We do not mark a feature complete merely because a placeholder or TODO exists.

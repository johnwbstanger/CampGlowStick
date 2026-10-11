# Camp Glowstick Feature Checklist

This checklist is the working source of truth for the spreadsheet-driven rebuild. Items are marked complete only when the implementation exists in the branch and is covered by build/unit/smoke checks where practical.

## Current pass — gameplay, characters, mobile, horror loop

- [x] Gary briefing is click-to-continue rather than timed.
- [x] Gary portrait is shown in the small briefing-frame treatment.
- [x] Camper escort movement uses the Snallygaster-style loose formation/catch-up behavior rather than a teleport leash.
- [x] Campers finish rescue by entering/occupying the bus rather than waiting exposed outside.
- [x] Held props inherit player/camera orientation instead of staying fixed to world north.
- [x] Dropped/thrown props use orientation-aware support and angular motion instead of center-height snapping.
- [x] Gun gameplay uses forward hitscan, recoil, muzzle flash, cooldown, loud-noise attraction and monster hit response.
- [x] User-selected CGTrader M1911 is documented as the intended final gun visual; gameplay remains mesh-independent until the authenticated asset binary is supplied.
- [x] Monster is night-gated and supports stalk/chase/search/noise-investigation behavior.
- [x] Thrown objects and gunshots can distract/redirect the monster when it does not have a stronger visual target.
- [x] Campfires and practical building lights are boosted for dusk/night visibility.
- [x] Named building doors have synchronized open/closed state and mutable collision.
- [x] iPad touch controls include movement, camera look, USE/tap interaction, jump, sprint, crouch, flashlight, glowstick, map and drop.
- [x] Sprint/fatigue drain is removed; sprint is unlimited.
- [x] Touch smoke test exercises jump, joystick movement and USE without keyboard input.
- [x] 15-player lobby capacity has dedicated smoke coverage.
- [x] Camper/counselor rendering now uses the user-provided smooth SDF character system instead of the imported Quaternius character bodies.
- [x] Seven distinct camper looks are wired to the network camper IDs.
- [x] Six distinct ranger/counselor looks are wired to remote-player IDs.
- [x] Hidden campers use the dedicated hunched/hiding pose; walk/run/scared poses remain render-only and do not change network physics.

## Still open / future passes

- [ ] Final authenticated M1911 binary import and PBR optimization for browser/mobile.
- [ ] Final destructive-prop damage pass for gunshots (coolers, lamps, breakables, vegetation response).
- [ ] Dedicated door-breaking monster interaction for selected doors.
- [ ] Full authored building-interior pass with wall/door colliders matched to visible meshes.
- [ ] Additional cabin furniture and shelf/table prop anchor scenes.
- [ ] Precarious stack authoring and richer impact/noise reactions.
- [ ] Full environmental audio library pass and material-specific footsteps.
- [ ] TURN-backed proximity voice reliability across restrictive/campus/cellular networks.
- [ ] Authoritative server-backed Internet multiplayer architecture for robust 10–15 player sessions.
- [ ] Reconnect/host migration hardening and network diagnostics UI.
- [ ] Level-by-level map progression beginning with a smaller authored Level 1 central camp.
- [ ] Director desk / key / piggy-bank progression.
- [ ] Journals and environmental storytelling pass.
- [ ] Camper dialogue expansion and roster-specific jokes/voice barks.
- [ ] Lake animation/shoreline/audio/canoe interaction polish.
- [ ] Final bus interior interaction/boarding polish and departure cinematic.
- [ ] Mobile/iPad performance budget, LOD/instancing audit and visual regression screenshots.
- [ ] Full rescue end-to-end automated test including all seven campers boarding and extraction.
- [ ] Sunset/dusk/night screenshot regression timeline.
- [ ] Building-entry and bus-safe-zone automated regression tests.

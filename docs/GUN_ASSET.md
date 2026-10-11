# Camp Director Gun Asset

## Chosen visual asset

- **Model:** M1911 - Post Apocalyptic Series
- **Creator:** creation-wasteland
- **Source:** https://www.cgtrader.com/free-3d-models/military/gun/m1911-post-apocalyptic-series
- **Marketplace status:** Free model on CGTrader
- **License shown on product page:** Royalty Free License (no AI)
- **Available formats:** FBX, OBJ, DAE, Unity package, textures
- **Art features:** real-world scale, articulated moving parts, 4K PBR maps, fire/hammer/slide/trigger animation content in the Unity package

## Integration status

The gameplay gun system is already implemented and stable: pickup, held orientation, muzzle socket, firing cooldown, hitscan, recoil, muzzle flash, loud authoritative gunshot noise, monster attraction, and stun response.

The CGTrader binary is **not vendored yet** because CGTrader serves the actual download through an authenticated marketplace download rather than a stable anonymous asset URL. Do not scrape or mirror an unverified copy. Once the downloaded FBX/OBJ + textures are supplied to the repository, replace only the visual mesh while keeping the existing gameplay gun entity and `muzzle-socket` contract.

## Expected repository target

Place the downloaded source under a dedicated vendored folder, for example:

`public/assets/models/cgtrader/m1911-post-apocalyptic/`

Preferred runtime conversion is a compact GLB with PBR textures resized for browser use. Keep the original license/provenance text beside the source asset.

## Browser optimization target

- Keep the original high-resolution source outside the runtime preload set if it is too large.
- Produce a game GLB with sensible texture compression/resolution for iPad and phone browsers.
- Preserve moving slide/hammer/trigger nodes if practical.
- Preserve the barrel-forward local axis expected by the current gun code, or add a wrapper transform so the muzzle faces local `-Z`.
- Preserve/add a `muzzle-socket` child at the bore so muzzle flash remains exact.
- Gameplay collision must stay independent of render-mesh complexity.

# Camp Glowstick

A browser co-op horror-salvage game set at a late-70s/80s summer camp. Vite + vanilla TypeScript + Three.js +
PeerJS (WebRTC) + cannon-es. No backend, no paid services: it runs on free static hosting (GitHub Pages).
The original concept/art-direction text lives in [`docs/CONCEPT.md`](docs/CONCEPT.md).

This is a **vertical slice**: menu → lobby → loading card → play scene, all working end to end.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build (base /CampGlowStick/)
npm test           # Vitest unit tests
npm run smoke      # Playwright headless-Chromium end-to-end smoke test
```

Open the game in two browser windows (or two devices): **START CAMP** in one, type the code in the other.

### Controls
WASD move · mouse look (click to capture) · Shift sprint (uses stamina) · C crouch · E pick up / drop ·
left-click throw · F flashlight · G snap a glowstick · 1–5 glowstick colour (green, yellow, orange, pink, blue) · N night/day (host).
Day lasts 25 s, then night falls automatically and the monster hunts. Collect 3 loot items and reach the extraction
ring together, or get caught.

## Lobby codes
The host generates a short word+number code (`pine21`, `neon42`, `lake07` …) from a themed word list plus two digits,
retrying until the PeerJS id is free. The code maps to the host's peer id `campglowstick-<code>`, so any device that
can reach the PeerJS signaling server can join by typing it or by opening `?join=<code>`. Lobbies hold 4–8 players.
Topology is host-authoritative star; the host simulates physics, noise, monster and win/lose and broadcasts snapshots at 20 Hz
(JSON). Remote players are interpolated. Errors are shown for an invalid code, a full lobby, a lobby already started,
a connection timeout and an unreachable signaling server.

### Signaling, STUN and TURN
By default the public PeerJS cloud (`0.peerjs.com`) and public Google STUN servers are used. Direct WebRTC works for most
home/mobile networks but **can fail behind strict/symmetric NATs without a TURN relay**. Add one at build time:

```
VITE_TURN_URL=turn:turn.example.com:3478   # comma-separate several URLs if needed
VITE_TURN_USER=user
VITE_TURN_PASS=pass
```

To self-host signaling set `VITE_PEER_HOST`, `VITE_PEER_PORT`, `VITE_PEER_PATH`, `VITE_PEER_SECURE`. In GitHub Actions set
`VITE_TURN_URL` as a repository variable and `VITE_TURN_USER`/`VITE_TURN_PASS` as secrets. Note these values are
bundled into the client, so use short-lived or low-privilege TURN credentials.

Proximity voice is optional (lobby toggle). The mic is only requested when you switch it on and it never blocks gameplay.

## Assets
All characters, cabins, props, trees, vehicles etc. are **imported CC0 GLB files** loaded with `GLTFLoader`; nothing is
hand-built in code except UI, canvas graffiti decals, the glowstick (capsule + emissive material) and the flashlight cookie.
A missing GLB shows a labelled placeholder box and logs a warning.

- `public/assets/models|hdri` – files (see [`public/assets/CREDITS.md`](public/assets/CREDITS.md) for name, author, source URL, license).
- `src/assets/manifest.ts` – logical name → GLB path.
- `npm run fetch-assets` – re-downloads everything reproducibly (pinned commit of a GitHub mirror of Kenney's CC0 packs) and regenerates CREDITS.

Honest notes: kenney.nl / Poly Haven were not reachable from the build sandbox, so the Kenney files come from a pinned
mirror and the HDRI from the three.js examples repo (Poly Haven, CC0). The packs have no exact camp cooler, backpack,
cabin or bus, so closest matches stand in (crate for cooler, bedroll for backpack, Survival Kit hut for cabin, Car Kit van for
the bus, Graveyard zombie for the monster; see CREDITS). The look is stylized-blocky Kenney rather than the full "restored
1984 photo" art direction. GLBs are not Draco/meshopt-compressed because the source files are already small
(~3.4 MB total); the loader supports meshopt. Textures sit beside the GLBs (`Textures/`) because glTF references them by relative URI.

## Scripts
| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `preview` | Vite dev server / type-check + build / preview |
| `npm test` | Unit tests: lobby codes, stamina, noise, monster, colliders, layout, asset manifest + CREDITS coverage, placeholder fallback |
| `npm run smoke` | Builds, then drives 2–5 headless Chromium contexts: join by code and `?join=`, bad code / full / disconnect / host-left, start, play scene, sync latency, glowstick sync, non-blank canvas, win and lose, no console errors |
| `npm run fetch-assets` | Re-download assets + regenerate CREDITS |

The smoke test uses the public PeerJS cloud if reachable, otherwise (or with `SMOKE_LOCAL_PEER=1`) a local `peer` server.
Env: `PEER_HOST`, `PEER_PORT`, `PEER_PATH`, `PEER_SECURE` point it at another server; `PW_CHROMIUM` overrides the browser binary.

## Deploy
`.github/workflows/deploy.yml` builds, runs unit + smoke tests and publishes `dist` to GitHub Pages (enable
Settings → Pages → Source: GitHub Actions). Vite `base` is `/CampGlowStick/` (override with `VITE_BASE`).

## Deploying to GitHub Pages
The `Build, test and deploy` workflow publishes with `actions/deploy-pages`, so the repo must be set to
**Settings → Pages → Build and deployment → Source = GitHub Actions** (not "Deploy from a branch"). This is a repository
setting and cannot be changed from the workflow; if it is wrong, `actions/configure-pages` fails the build with a clear message.

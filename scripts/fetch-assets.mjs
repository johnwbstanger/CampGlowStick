// Re-downloads every external asset used by Camp Glowstick (all CC0) and regenerates public/assets/CREDITS.md.
// Usage: node scripts/fetch-assets.mjs [--force]
import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets');
// Kenney's CC0 packs, mirrored on GitHub at a pinned commit (kenney.nl itself is the canonical source).
const MIRROR = 'shorepine/kenney';
const SHA = '3694c6879e487c108f55677be7dd2ca75b07cc3b';
const RAW = `https://raw.githubusercontent.com/${MIRROR}/${SHA}`;
const KITS = {
  'blocky-characters': ['Blocky Characters', 'https://kenney.nl/assets/blocky-characters'],
  survival: ['Survival Kit', 'https://kenney.nl/assets/survival-kit'],
  nature: ['Nature Kit', 'https://kenney.nl/assets/nature-kit'],
  furniture: ['Furniture Kit', 'https://kenney.nl/assets/furniture-kit'],
  holiday: ['Holiday Kit', 'https://kenney.nl/assets/holiday-kit'],
  graveyard: ['Graveyard Kit', 'https://kenney.nl/assets/graveyard-kit'],
  food: ['Food Kit', 'https://kenney.nl/assets/food-kit'],
  car: ['Car Kit', 'https://kenney.nl/assets/car-kit'],
};
const MODELS = {
  'blocky-characters': 'abcdefgh'.split('').map((c) => `character-${c}`),
  survival: ['structure', 'structure-metal', 'box-large', 'box', 'bucket', 'barrel', 'bottle', 'campfire-pit', 'bedroll-packed', 'signpost', 'rock-a', 'tool-axe'],
  nature: ['tent_detailedClosed', 'canoe', 'canoe_paddle', 'tree_pineTallA', 'tree_pineTallB', 'tree_pineDefaultA', 'ground_grass', 'log_stack', 'rock_largeA'],
  // Furniture Kit additions are intentionally imported instead of being rebuilt as primitive boxes.
  // These are used to make cabins, dining areas, bathhouse and hiding spots feel authored and inhabited.
  furniture: ['bedBunk', 'bedSingle', 'chair', 'table', 'bookcaseOpen', 'bathroomSink', 'bear', 'radio'],
  holiday: ['lantern', 'sock-red'],
  graveyard: ['character-zombie'],
  food: ['mug', 'can'],
  car: ['van'],
};
const HDRI = {
  file: 'hdri/venice_sunset_1k.hdr',
  url: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/equirectangular/venice_sunset_1k.hdr',
  name: 'Venice Sunset (1k)', author: 'Greg Zaal / Poly Haven', source: 'https://polyhaven.com/a/venice_sunset', license: 'CC0 1.0',
};

const force = process.argv.includes('--force');
const exists = (p) => access(p).then(() => true, () => false);
async function get(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
}
async function save(rel, url) {
  const dest = join(ROOT, rel);
  if (!force && (await exists(dest))) return null;
  await mkdir(dirname(dest), { recursive: true });
  const buf = await get(url);
  await writeFile(dest, buf);
  console.log('fetched', rel, buf.length);
  return buf;
}
function externalUris(glb) {
  const len = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + len).toString('utf8'));
  return (json.images ?? []).map((i) => i.uri).filter((u) => u && !u.startsWith('data:'));
}

const rows = [];
for (const [kit, files] of Object.entries(MODELS)) {
  for (const f of files) {
    const rel = `models/${kit}/${f}.glb`;
    await save(rel, `${RAW}/3d/${kit}/${f}.glb`);
    const glb = await (await import('node:fs/promises')).readFile(join(ROOT, rel));
    for (const uri of externalUris(glb)) await save(posix.join('models', kit, uri), `${RAW}/3d/${kit}/${uri}`);
    rows.push(`| ${f} | ${KITS[kit][0]} | Kenney | [${KITS[kit][1].replace('https://', '')}](${KITS[kit][1]}) | CC0 1.0 | \`${rel}\` |`);
  }
}
await save(HDRI.file, HDRI.url);
rows.push(`| ${HDRI.name} | HDRI | ${HDRI.author} | [${HDRI.source.replace('https://', '')}](${HDRI.source}) | ${HDRI.license} | \`${HDRI.file}\` |`);

const credits = `# Asset credits

Every 3D model, texture and HDRI used by Camp Glowstick is licensed CC0 (public domain) and is loaded from an
external file. Environment dressing deliberately prefers human-authored asset packs over generated primitive
stand-ins. Regenerate this file and re-download everything with \`npm run fetch-assets\` (pinned to commit
\`${SHA.slice(0, 7)}\` of the [${MIRROR}](https://github.com/${MIRROR}) mirror of Kenney's CC0 packs).

Kenney's glTF files reference their colour atlas by relative URI (\`Textures/*.png\`), so those PNGs live beside
the GLBs in \`models/<kit>/Textures/\` and are covered by the same CC0 license as the kit.

Substitutions (no exact CC0 match was found, so the closest imported asset stands in): \`cooler\` = Survival Kit
\`box-large\` crate, \`backpack\` = Survival Kit \`bedroll-packed\`, \`cabin\` = Survival Kit \`structure\`, \`shed\` =
Survival Kit \`structure-metal\`, \`bus\` = Car Kit \`van\`, \`monster\` = Graveyard Kit \`character-zombie\`.

| Asset | Pack | Author | Source URL | License | File |
| --- | --- | --- | --- | --- | --- |
${rows.join('\n')}
`;
await writeFile(join(ROOT, 'CREDITS.md'), credits);
console.log(`done: ${rows.length} assets`);

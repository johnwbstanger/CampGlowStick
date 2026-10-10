// Re-downloads every external asset used by Camp Glowstick and regenerates public/assets/CREDITS.md.
// Usage: node scripts/fetch-assets.mjs [--force]
import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets');

// Kenney CC0 packs, mirrored on GitHub at a pinned commit.
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
  furniture: ['bedBunk', 'bedSingle', 'chair', 'table', 'bookcaseOpen', 'bathroomSink', 'bear', 'radio'],
  holiday: ['lantern', 'sock-red'],
  graveyard: ['character-zombie'],
  food: ['mug', 'can'],
  car: ['van'],
};

// Quaternius human-authored CC0 assets. Pinned to an immutable repository commit so art does not
// silently change between deployments.
const Q_REPO = 'beep2bleep/FreeAssetsByKenneyNLandQuaternius';
const Q_SHA = 'dea756baf3b3a4889d8c245e456a4791f961578a';
const Q_ROOT = 'FreeModels by Quaternius[Patreon]';
const qRaw = (rel) => `https://raw.githubusercontent.com/${Q_REPO}/${Q_SHA}/${[Q_ROOT, rel].join('/').split('/').map(encodeURIComponent).join('/')}`;
const Q_ASSETS = [
  {
    file: 'models/quaternius/SchoolBus.fbx',
    source: 'Vehicles/Public Transport Pack - Feb 2017/FBX/SchoolBus.fbx',
    name: 'SchoolBus', pack: 'Public Transport Pack',
  },
  {
    file: 'models/quaternius/Smooth_Male_Casual.fbx',
    source: 'Characters and Animals/Animated Men Characters - Feb 2019/FBX/Smooth_Male_Casual.fbx',
    name: 'Smooth_Male_Casual', pack: 'Animated Men Characters',
  },
  {
    file: 'models/quaternius/Smooth_Male_Shirt.fbx',
    source: 'Characters and Animals/Animated Men Characters - Feb 2019/FBX/Smooth_Male_Shirt.fbx',
    name: 'Smooth_Male_Shirt', pack: 'Animated Men Characters',
  },
  {
    file: 'models/quaternius/Smooth_Female_Casual.fbx',
    source: 'Characters and Animals/Animated Women Characters - Feb 2019/FBX/Smooth_Female_Casual.fbx',
    name: 'Smooth_Female_Casual', pack: 'Animated Women Characters',
  },
  {
    file: 'models/quaternius/House1.fbx',
    source: 'Home and Buildings/Buildings Pack - Jan 2019/FBX/House1.fbx',
    name: 'House1', pack: 'Buildings Pack - Jan 2019',
  },
  {
    file: 'models/quaternius/House2.fbx',
    source: 'Home and Buildings/Buildings Pack - Jan 2019/FBX/House2.fbx',
    name: 'House2', pack: 'Buildings Pack - Jan 2019',
  },
  {
    file: 'models/quaternius/Building1_Small.fbx',
    source: 'Home and Buildings/Buildings Pack - Jan 2019/FBX/Building1_Small.fbx',
    name: 'Building1_Small', pack: 'Buildings Pack - Jan 2019',
  },
];

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

for (const q of Q_ASSETS) {
  await save(q.file, qRaw(q.source));
  rows.push(`| ${q.name} | ${q.pack} | Quaternius | [github.com/${Q_REPO}](https://github.com/${Q_REPO}) | CC0 1.0 | \`${q.file}\` |`);
}

await save(HDRI.file, HDRI.url);
rows.push(`| ${HDRI.name} | HDRI | ${HDRI.author} | [${HDRI.source.replace('https://', '')}](${HDRI.source}) | ${HDRI.license} | \`${HDRI.file}\` |`);

const credits = `# Asset credits

Camp Glowstick deliberately prefers human-authored asset packs over generated primitive stand-ins. Kenney and
Quaternius assets below are CC0/public domain. Regenerate the exact pinned set with \`npm run fetch-assets\`.

Kenney assets are pinned to commit \`${SHA.slice(0, 7)}\` of [${MIRROR}](https://github.com/${MIRROR}).
Quaternius assets are pinned to commit \`${Q_SHA.slice(0, 7)}\` of [${Q_REPO}](https://github.com/${Q_REPO}); the
repository's Quaternius License.txt declares the models CC0 1.0 Universal.

Kenney glTF files may reference their colour atlas by relative URI (\`Textures/*.png\`), so those PNGs live beside
the GLBs in \`models/<kit>/Textures/\` and are covered by the same license as the kit.

| Asset | Pack | Author | Source URL | License | File |
| --- | --- | --- | --- | --- | --- |
${rows.join('\n')}
`;
await writeFile(join(ROOT, 'CREDITS.md'), credits);
console.log(`done: ${rows.length} assets`);

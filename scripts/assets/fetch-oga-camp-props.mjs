import { mkdir, writeFile, access, cp, readdir, rm } from 'node:fs/promises';
import { dirname, join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'assets', 'models', 'cc0-camp-props');
const BACKPACK_REPO = 'VitexSoftware/ishtaria-client';
const BACKPACK_SHA = '33034c160e6d3f1cc39a3267a3594baad7722f8b';
const BACKPACK_PATH = 'assets/quaternius/ultimate-rpg-items/Models/backpack.glb';
const backpack = {
  id: 'backpack',
  url: `https://raw.githubusercontent.com/${BACKPACK_REPO}/${BACKPACK_SHA}/${BACKPACK_PATH}`,
  page: `https://github.com/${BACKPACK_REPO}/blob/${BACKPACK_SHA}/${BACKPACK_PATH}`,
  author: 'Quaternius',
  source: 'Ultimate RPG Items Bundle — backpack',
  license: 'CC0-1.0',
};
const cooler = {
  id: 'cooler',
  url: 'https://opengameart.org/sites/default/files/cooking_assets.zip',
  page: 'https://opengameart.org/content/cooking-assets',
  author: 'MilkAndBanana',
  source: 'Cooking Assets',
  license: 'CC0-1.0',
  match: /cooler/i,
};

const exists = (p) => access(p).then(() => true, () => false);
async function walk(dir) {
  const out = [];
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...await walk(p)); else out.push(p);
  }
  return out;
}
function validGlb(bytes) { return bytes.length >= 20 && bytes.toString('ascii', 0, 4) === 'glTF'; }
function unzip(zip, out) {
  const result = spawnSync('unzip', ['-oq', zip, '-d', out], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`unzip failed for ${basename(zip)}: ${result.stderr || result.stdout}`);
}
async function expandNestedZips(root) {
  const seen = new Set();
  for (let depth = 0; depth < 4; depth++) {
    const zips = (await walk(root)).filter((p) => extname(p).toLowerCase() === '.zip' && !seen.has(p));
    if (!zips.length) break;
    for (const zip of zips) {
      seen.add(zip);
      const out = join(dirname(zip), `${basename(zip, extname(zip))}-expanded`);
      await mkdir(out, { recursive: true });
      unzip(zip, out);
    }
  }
}
async function fetchBackpack(dest) {
  const r = await fetch(backpack.url, { headers: { 'User-Agent': 'CampGlowstick-asset-import/1.0' } });
  if (!r.ok) throw new Error(`backpack: ${r.status} ${backpack.url}`);
  const bytes = Buffer.from(await r.arrayBuffer());
  if (!validGlb(bytes)) throw new Error(`backpack: pinned Quaternius source is not a valid GLB (${bytes.length} bytes)`);
  await writeFile(dest, bytes);
}
async function fetchCooler(dest) {
  const tmp = join(tmpdir(), `campglow-cooler-${process.pid}`);
  await mkdir(tmp, { recursive: true });
  try {
    const zip = join(tmp, 'source.zip');
    const r = await fetch(cooler.url, { headers: { 'User-Agent': 'CampGlowstick-asset-import/1.0' } });
    if (!r.ok) throw new Error(`cooler: ${r.status} ${cooler.url}`);
    const bytes = Buffer.from(await r.arrayBuffer());
    if (bytes.length < 256 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
      throw new Error(`cooler: download was not a ZIP (${bytes.length} bytes, ${r.headers.get('content-type') ?? 'unknown content type'})`);
    }
    await writeFile(zip, bytes);
    unzip(zip, tmp);
    await expandNestedZips(tmp);
    const files = await walk(tmp);
    const models = files.filter((p) => ['.glb', '.gltf', '.fbx'].includes(extname(p).toLowerCase()));
    const candidates = models.filter((p) => cooler.match.test(basename(p)) && extname(p).toLowerCase() === '.glb');
    if (!candidates.length) {
      const names = models.map((p) => basename(p)).slice(0, 150);
      throw new Error(`cooler: no matching GLB found after nested-archive expansion. Archive models: ${names.join(', ')}`);
    }
    const chosen = candidates.sort((a, b) => a.length - b.length)[0];
    const glb = await import('node:fs/promises').then((fs) => fs.readFile(chosen));
    if (!validGlb(glb)) throw new Error(`cooler: selected ${basename(chosen)} is not a valid binary glTF`);
    await cp(chosen, dest);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

await mkdir(ROOT, { recursive: true });
const backpackDest = join(ROOT, 'backpack.glb');
const coolerDest = join(ROOT, 'cooler.glb');
if (!await exists(backpackDest)) await fetchBackpack(backpackDest);
if (!await exists(coolerDest)) await fetchCooler(coolerDest);

const catalog = [
  {
    id: 'backpack', file: 'models/cc0-camp-props/backpack.glb', category: 'camp_prop',
    source: backpack.source, author: backpack.author, license: backpack.license,
    url: backpack.page, download: backpack.url, collider: 'box', noiseMaterial: 'cloth', mass: 1.0,
  },
  {
    id: 'cooler', file: 'models/cc0-camp-props/cooler.glb', category: 'camp_prop',
    source: cooler.source, author: cooler.author, license: cooler.license,
    url: cooler.page, download: cooler.url, collider: 'box', noiseMaterial: 'plastic', mass: 2.6,
  },
];
await writeFile(join(ROOT, 'catalog.json'), JSON.stringify({ license: 'CC0-1.0', entries: catalog }, null, 2));
console.log('CC0 camp props ready:', catalog.map((x) => x.id).join(', '));

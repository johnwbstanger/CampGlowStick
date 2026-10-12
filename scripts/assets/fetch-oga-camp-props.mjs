import { mkdir, writeFile, access, cp, readdir, rm } from 'node:fs/promises';
import { dirname, join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'assets', 'models', 'cc0-camp-props');
const sources = [
  {
    id: 'backpack',
    url: 'https://opengameart.org/sites/default/files/low_poly_camping_assets.zip',
    page: 'https://opengameart.org/content/low-poly-camping-assets',
    author: 'Saraskau',
    source: 'Low Poly Camping Assets',
    match: /back[ _-]?pack/i,
  },
  {
    id: 'cooler',
    url: 'https://opengameart.org/sites/default/files/cooking_assets.zip',
    page: 'https://opengameart.org/content/cooking-assets',
    author: 'MilkAndBanana',
    source: 'Cooking Assets',
    match: /cooler/i,
  },
];
const exists = (p) => access(p).then(() => true, () => false);
async function walk(dir) {
  const out = [];
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...await walk(p)); else out.push(p);
  }
  return out;
}
function unzip(zip, out) {
  const result = spawnSync('unzip', ['-oq', zip, '-d', out], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`unzip failed for ${basename(zip)}: ${result.stderr || result.stdout}`);
}
async function expandNestedZips(root) {
  // OpenGameArt packs commonly wrap GLB/FBX variants in child archives. Expand until no unseen
  // nested zip remains, with a hard depth cap so malformed/self-containing archives cannot loop.
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

await mkdir(ROOT, { recursive: true });
const catalog = [];
for (const src of sources) {
  const dest = join(ROOT, `${src.id}.glb`);
  if (!await exists(dest)) {
    const tmp = join(tmpdir(), `campglow-${src.id}-${process.pid}`);
    await mkdir(tmp, { recursive: true });
    try {
      const zip = join(tmp, 'source.zip');
      const r = await fetch(src.url, { headers: { 'User-Agent': 'CampGlowstick-asset-import/1.0' } });
      if (!r.ok) throw new Error(`${src.id}: ${r.status} ${src.url}`);
      const bytes = Buffer.from(await r.arrayBuffer());
      if (bytes.length < 256 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
        throw new Error(`${src.id}: download was not a ZIP (${bytes.length} bytes, ${r.headers.get('content-type') ?? 'unknown content type'})`);
      }
      await writeFile(zip, bytes);
      unzip(zip, tmp);
      await expandNestedZips(tmp);

      const files = await walk(tmp);
      const models = files.filter((p) => ['.glb', '.gltf', '.fbx'].includes(extname(p).toLowerCase()));
      const candidates = models.filter((p) => src.match.test(basename(p)) && extname(p).toLowerCase() === '.glb');
      if (!candidates.length) {
        const names = models.map((p) => basename(p)).slice(0, 150);
        throw new Error(`${src.id}: no matching GLB found after nested-archive expansion. Archive models: ${names.join(', ')}`);
      }
      const chosen = candidates.sort((a, b) => a.length - b.length)[0];
      const glb = await import('node:fs/promises').then((fs) => fs.readFile(chosen));
      if (glb.length < 20 || glb.toString('ascii', 0, 4) !== 'glTF') throw new Error(`${src.id}: selected ${basename(chosen)} is not a valid binary glTF`);
      await cp(chosen, dest);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  }
  catalog.push({
    id: src.id,
    file: `models/cc0-camp-props/${src.id}.glb`,
    category: 'camp_prop',
    source: src.source,
    author: src.author,
    license: 'CC0-1.0',
    url: src.page,
    download: src.url,
    collider: 'box',
    noiseMaterial: src.id === 'cooler' ? 'plastic' : 'cloth',
    mass: src.id === 'cooler' ? 2.6 : 1.0,
  });
}
await writeFile(join(ROOT, 'catalog.json'), JSON.stringify({ license: 'CC0-1.0', entries: catalog }, null, 2));
console.log('CC0 camp props ready:', catalog.map((x) => x.id).join(', '));

import { mkdir, writeFile, readFile, access, cp, readdir, rm } from 'node:fs/promises';
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

await mkdir(ROOT, { recursive: true });
const catalog = [];
for (const src of sources) {
  const dest = join(ROOT, `${src.id}.glb`);
  if (!await exists(dest)) {
    const tmp = join(tmpdir(), `campglow-${src.id}-${process.pid}`);
    await mkdir(tmp, { recursive: true });
    const zip = join(tmp, 'source.zip');
    const r = await fetch(src.url);
    if (!r.ok) throw new Error(`${src.id}: ${r.status} ${src.url}`);
    await writeFile(zip, Buffer.from(await r.arrayBuffer()));
    const result = spawnSync('unzip', ['-oq', zip, '-d', tmp], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`${src.id}: unzip failed: ${result.stderr || result.stdout}`);
    const files = await walk(tmp);
    const candidates = files.filter((p) => src.match.test(basename(p)) && extname(p).toLowerCase() === '.glb');
    if (!candidates.length) {
      const names = files.filter((p) => /\.(glb|gltf|fbx)$/i.test(p)).map((p) => basename(p)).slice(0, 100);
      throw new Error(`${src.id}: no matching GLB found. Archive models: ${names.join(', ')}`);
    }
    await cp(candidates[0], dest);
    await rm(tmp, { recursive: true, force: true });
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

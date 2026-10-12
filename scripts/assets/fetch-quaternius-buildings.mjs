import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join, basename, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'agentkaerf/FreeModels';
const SHA = 'db3df04d1e4714298a09510b26fb6de6645138a2';
const PACK = 'Medieval Village MegaKit[Standard]';
const PREFIX = `${PACK}/glTF/`;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'assets');
const DEST = join(ROOT, 'buildings', 'quaternius-modular');
const force = process.argv.includes('--force');
const githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const exists = (p) => access(p).then(() => true, () => false);
const raw = (path) => `https://raw.githubusercontent.com/${REPO}/${SHA}/${path.split('/').map(encodeURIComponent).join('/')}`;

async function json(url) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'CampGlowstick-asset-import/1.0' };
  if (githubToken) headers.Authorization = `Bearer ${githubToken}`;
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${r.status} ${url}${r.status === 403 && !githubToken ? ' (set GITHUB_TOKEN to avoid GitHub API rate limits)' : ''}`);
  return r.json();
}
async function bytes(url) {
  const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
}
async function save(rel, url) {
  const dest = join(DEST, rel);
  if (!force && await exists(dest)) return;
  await mkdir(dirname(dest), { recursive: true });
  const b = await bytes(url); await writeFile(dest, b); console.log('fetched building', rel, b.length);
}

const tree = await json(`https://api.github.com/repos/${REPO}/git/trees/${SHA}?recursive=1`);
const gltfs = tree.tree.filter((e) => e.type === 'blob' && e.path.startsWith(PREFIX) && e.path.endsWith('.gltf')).map((e) => e.path);
const useful = gltfs.filter((path) => /(wall|door|window|roof|floor|stair|beam|pillar|post|fence|balcony|plank|wood)/i.test(basename(path)));
if (!useful.length) throw new Error(`No modular building files found in ${PACK}`);

const downloaded = new Set();
async function fetchRel(rel) {
  if (downloaded.has(rel)) return;
  downloaded.add(rel);
  await save(rel, raw(`${PREFIX}${rel}`));
}

const classify = (name) => {
  const n = name.toLowerCase();
  if (n.includes('door')) return 'door';
  if (n.includes('window')) return 'window';
  if (n.includes('roof')) return 'roof';
  if (n.includes('floor')) return 'floor';
  if (n.includes('stair')) return 'stairs';
  if (/(pillar|post|beam)/.test(n)) return 'structure';
  if (n.includes('fence')) return 'fence';
  if (n.includes('balcony')) return 'porch';
  return 'wall';
};
const entries = [];
for (const path of useful) {
  const rel = path.slice(PREFIX.length);
  const gltfBytes = await bytes(raw(path));
  await mkdir(dirname(join(DEST, rel)), { recursive: true });
  await writeFile(join(DEST, rel), gltfBytes);
  downloaded.add(rel);
  const doc = JSON.parse(gltfBytes.toString('utf8'));
  for (const buffer of doc.buffers ?? []) if (buffer.uri && !buffer.uri.startsWith('data:')) await fetchRel(posix.normalize(posix.join(posix.dirname(rel), buffer.uri)));
  for (const image of doc.images ?? []) if (image.uri && !image.uri.startsWith('data:')) await fetchRel(posix.normalize(posix.join(posix.dirname(rel), image.uri)));
  entries.push({
    id: `qbuild_${basename(rel, '.gltf').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`,
    file: `buildings/quaternius-modular/${rel}`,
    sourceFile: rel,
    category: classify(basename(rel, '.gltf')),
    source: 'Quaternius Medieval Village MegaKit [Standard]',
    author: 'Quaternius',
    license: 'CC0-1.0',
    sourceRepository: `https://github.com/${REPO}/tree/${SHA}/${encodeURIComponent(PACK)}`,
  });
}
await mkdir(DEST, { recursive: true });
await writeFile(join(DEST, 'catalog.json'), JSON.stringify({ pack: PACK, repository: REPO, commit: SHA, license: 'CC0-1.0', entries }, null, 2));
console.log(`Quaternius modular building import ready: ${entries.length} modules`);

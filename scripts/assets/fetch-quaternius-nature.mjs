import { mkdir, writeFile, access, readFile } from 'node:fs/promises';
import { dirname, join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'agentkaerf/FreeModels';
const SHA = 'db3df04d1e4714298a09510b26fb6de6645138a2';
const PACK = 'Stylized Nature MegaKit[Standard]';
const PREFIX = `${PACK}/glTF/`;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'assets');
const DEST = join(ROOT, 'nature', 'quaternius-megakit');
const CATALOG = join(DEST, 'catalog.json');
const force = process.argv.includes('--force');
const githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

const exists = (p) => access(p).then(() => true, () => false);
const raw = (path) => `https://raw.githubusercontent.com/${REPO}/${SHA}/${path.split('/').map(encodeURIComponent).join('/')}`;

async function getJson(url) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'CampGlowstick-asset-import/1.0' };
  if (githubToken) headers.Authorization = `Bearer ${githubToken}`;
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${r.status} ${url}${r.status === 403 && !githubToken ? ' (set GITHUB_TOKEN to avoid GitHub API rate limits)' : ''}`);
  return r.json();
}
async function save(rel, url) {
  const out = join(DEST, rel);
  if (!force && await exists(out)) return;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const data = Buffer.from(await r.arrayBuffer());
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, data);
  console.log('fetched nature', rel, data.length);
}

const tree = await getJson(`https://api.github.com/repos/${REPO}/git/trees/${SHA}?recursive=1`);
const files = tree.tree
  .filter((e) => e.type === 'blob' && e.path.startsWith(PREFIX))
  .map((e) => e.path)
  .filter((p) => ['.gltf', '.bin', '.png', '.jpg', '.jpeg', '.webp'].includes(extname(p).toLowerCase()));

if (!files.length) throw new Error(`No ${PACK} glTF files found at pinned commit ${SHA}`);
for (const path of files) await save(path.slice(PREFIX.length), raw(path));

const gltfs = files.filter((p) => p.endsWith('.gltf')).map((path) => path.slice(PREFIX.length));
const classify = (file) => {
  const n = basename(file, '.gltf').toLowerCase();
  if (/tree|pine|fir|birch|oak|willow|stump/.test(n)) return 'tree';
  if (/bush|shrub|fern|plant|flower|grass|mushroom|reed/.test(n)) return 'understory';
  if (/rock|stone|boulder/.test(n)) return 'rock';
  if (/log|branch/.test(n)) return 'deadwood';
  return 'nature';
};
const entries = gltfs.map((file, i) => ({
  id: `qnm_${basename(file, '.gltf').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`,
  file: `nature/quaternius-megakit/${file}`,
  sourceFile: file,
  category: classify(file),
  source: 'Quaternius Stylized Nature MegaKit [Standard]',
  author: 'Quaternius',
  license: 'CC0-1.0',
  sourceRepository: `https://github.com/${REPO}/tree/${SHA}/${encodeURIComponent(PACK)}`,
  collider: classify(file) === 'tree' ? 'trunk' : classify(file) === 'rock' ? 'convex' : 'none',
  noiseMaterial: classify(file) === 'rock' ? 'rock' : 'wood',
  mass: 0,
  order: i,
}));
await mkdir(DEST, { recursive: true });
await writeFile(CATALOG, JSON.stringify({ pack: PACK, repository: REPO, commit: SHA, license: 'CC0-1.0', entries }, null, 2));

const globalPath = join(ROOT, 'manifest.json');
let global = { version: 1, assets: [] };
try { global = JSON.parse(await readFile(globalPath, 'utf8')); } catch {}
global.assets = [...(global.assets ?? []).filter((a) => a.source !== 'Quaternius Stylized Nature MegaKit [Standard]'), ...entries];
await writeFile(globalPath, JSON.stringify(global, null, 2));
console.log(`Quaternius nature import ready: ${entries.length} glTF models (${files.length} pack files)`);

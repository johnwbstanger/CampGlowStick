import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'assets', 'environment');
const THREE_TAG = 'r186';
const FILES = [
  {
    file: 'waternormals.jpg',
    url: `https://raw.githubusercontent.com/mrdoob/three.js/${THREE_TAG}/examples/textures/waternormals.jpg`,
    source: `three.js ${THREE_TAG} examples`,
    license: 'MIT',
  },
];
const force = process.argv.includes('--force');
const exists = (p) => access(p).then(() => true, () => false);
for (const asset of FILES) {
  const dest = join(ROOT, asset.file);
  if (!force && await exists(dest)) continue;
  const r = await fetch(asset.url);
  if (!r.ok) throw new Error(`${r.status} ${asset.url}`);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await r.arrayBuffer()));
}
await mkdir(ROOT, { recursive: true });
await writeFile(join(ROOT, 'CREDITS.json'), JSON.stringify(FILES, null, 2));
console.log(`Three.js environment support fetched (${FILES.length} file)`);

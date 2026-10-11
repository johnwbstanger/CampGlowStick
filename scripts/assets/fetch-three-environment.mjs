import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'assets', 'environment');
const THREE_TAG = 'r186';
const raw = (path) => `https://raw.githubusercontent.com/mrdoob/three.js/${THREE_TAG}/${path}`;
const FILES = [
  { file: 'waternormals.jpg', path: 'examples/textures/waternormals.jpg', source: `three.js ${THREE_TAG} Water example`, license: 'MIT' },
  { file: 'draco/draco_decoder.js', path: 'examples/jsm/libs/draco/gltf/draco_decoder.js', source: `three.js ${THREE_TAG} Draco decoder`, license: 'Apache-2.0/MIT distribution' },
  { file: 'draco/draco_decoder.wasm', path: 'examples/jsm/libs/draco/gltf/draco_decoder.wasm', source: `three.js ${THREE_TAG} Draco decoder`, license: 'Apache-2.0/MIT distribution' },
  { file: 'draco/draco_wasm_wrapper.js', path: 'examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js', source: `three.js ${THREE_TAG} Draco decoder`, license: 'Apache-2.0/MIT distribution' },
  { file: 'basis/basis_transcoder.js', path: 'examples/jsm/libs/basis/basis_transcoder.js', source: `three.js ${THREE_TAG} Basis Universal transcoder`, license: 'Apache-2.0' },
  { file: 'basis/basis_transcoder.wasm', path: 'examples/jsm/libs/basis/basis_transcoder.wasm', source: `three.js ${THREE_TAG} Basis Universal transcoder`, license: 'Apache-2.0' },
].map((x) => ({ ...x, url: raw(x.path) }));

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
console.log(`Three.js environment/decoder support fetched (${FILES.length} files)`);

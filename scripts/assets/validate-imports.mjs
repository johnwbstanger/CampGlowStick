import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'assets');
const required = [
  'nature/quaternius-megakit/catalog.json',
  'buildings/quaternius-modular/catalog.json',
  'models/cc0-camp-props/catalog.json',
  'environment/CREDITS.json',
];
const errors = [];
const exists = (p) => access(p).then(() => true, () => false);
for (const rel of required) if (!await exists(join(ROOT, rel))) errors.push(`missing required catalog ${rel}`);

async function validateCatalog(rel) {
  const file = join(ROOT, rel);
  const data = JSON.parse(await readFile(file, 'utf8'));
  const entries = data.entries ?? data;
  if (!Array.isArray(entries) || !entries.length) errors.push(`${rel}: empty catalog`);
  for (const entry of entries) {
    if (!entry.license) errors.push(`${rel}: ${entry.id ?? entry.file} missing license`);
    if (!/CC0|MIT/i.test(entry.license)) errors.push(`${rel}: ${entry.id ?? entry.file} unexpected license ${entry.license}`);
    if (!entry.file) continue;
    const abs = join(ROOT, entry.file);
    if (!await exists(abs)) errors.push(`${rel}: missing ${entry.file}`);
    if (entry.file.endsWith('.gltf') && await exists(abs)) {
      try {
        const gltf = JSON.parse(await readFile(abs, 'utf8'));
        for (const buffer of gltf.buffers ?? []) if (buffer.uri && !buffer.uri.startsWith('data:')) {
          const dep = join(dirname(abs), buffer.uri);
          if (!await exists(dep)) errors.push(`${entry.file}: missing buffer ${buffer.uri}`);
        }
        for (const image of gltf.images ?? []) if (image.uri && !image.uri.startsWith('data:')) {
          const dep = join(dirname(abs), image.uri);
          if (!await exists(dep)) errors.push(`${entry.file}: missing image ${image.uri}`);
        }
      } catch (e) { errors.push(`${entry.file}: invalid glTF JSON (${e instanceof Error ? e.message : e})`); }
    }
  }
}
for (const rel of required.slice(0, 3)) await validateCatalog(rel);

const credits = JSON.parse(await readFile(join(ROOT, 'environment/CREDITS.json'), 'utf8'));
for (const item of credits) if (!item.license || !item.url) errors.push(`environment credit incomplete: ${JSON.stringify(item)}`);

for (const top of ['nature/quaternius-megakit', 'buildings/quaternius-modular', 'models/cc0-camp-props']) {
  const files = await readdir(join(ROOT, top));
  if (!files.length) errors.push(`${top}: empty directory`);
}

if (errors.length) {
  console.error(`Imported asset validation failed (${errors.length}):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log('Imported asset validation passed: environment licenses, catalogs, glTF dependencies and CC0 camp props are present. Handmade SDF characters require no external asset pack.');

import { describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { MANIFEST, HDRI_FILE } from '../../src/assets/manifest';
import { createPlaceholder } from '../../src/assets/loader';

const ROOT = join(__dirname, '../../public/assets');
const credits = readFileSync(join(ROOT, 'CREDITS.md'), 'utf8');
const files = [...new Set(Object.values(MANIFEST).map((d) => d.file))];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
}

describe('asset manifest', () => {
  it('has the required logical names', () => {
    for (const n of ['camperMale', 'camperFemale', 'counselorMale', 'counselorFemale', 'bus', 'cabin', 'bunk', 'cooler', 'backpack', 'lantern', 'tent', 'tree', 'campfire', 'mug', 'canoe']) expect(MANIFEST).toHaveProperty(n);
  });
  it.each(files)('%s exists and has the expected model format', (f) => {
    const p = join(ROOT, f);
    expect(existsSync(p)).toBe(true);
    const buf = readFileSync(p);
    expect(buf.length).toBeGreaterThan(512);
    if (f.endsWith('.glb')) {
      expect(buf.subarray(0, 4).toString()).toBe('glTF');
      const json = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
      expect(json.asset.version).toBe('2.0');
      expect(json.meshes.length).toBeGreaterThan(0);
      for (const img of json.images ?? []) if (img.uri) expect(existsSync(join(dirname(p), img.uri)), img.uri).toBe(true);
    } else if (f.endsWith('.fbx')) {
      // Quaternius FBXs are binary FBX 7.x files. This catches HTML/404 responses or corrupt downloads.
      expect(buf.subarray(0, 18).toString()).toContain('Kaydara FBX Binary');
    } else {
      throw new Error(`unsupported model format: ${f}`);
    }
  });
  it('CREDITS.md covers every asset (model, HDRI) with license + source', () => {
    for (const f of [...files, HDRI_FILE]) expect(credits, f).toContain(f);
    expect(credits).toMatch(/CC0/);
    expect(credits).toMatch(/https:\/\//);
  });
  it('no stray imported models are shipped without a credit', () => {
    for (const p of walk(join(ROOT, 'models')).filter((x) => x.endsWith('.glb') || x.endsWith('.fbx'))) {
      expect(credits, p).toContain(p.slice(ROOT.length + 1));
    }
  });
});

describe('missing-asset fallback', () => {
  it('returns a labelled placeholder and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const g = createPlaceholder('cooler');
    expect(g.name).toBe('placeholder:cooler');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

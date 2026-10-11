// campers.ts — smooth, contiguous, matte stylized characters for Camp Glowstick / Snallygaster
// User-supplied SDF character system. Each body part is a continuous sculpted mesh, cached by character id.
import * as THREE from 'three';

export type HairStyle = 'bowl' | 'shag' | 'feather' | 'curly' | 'buzz' | 'pigtails' | 'mop'
  | 'short' | 'crop' | 'ponytail' | 'bob' | 'bun' | 'long' | 'none';
export type TopStyle = 'tee' | 'sleeveless' | 'ringer' | 'stripes' | 'layered';
export type Extra = 'headband' | 'glasses' | 'freckles' | 'cap' | 'neckerchief';
export type Pose = 'idle' | 'walk' | 'run' | 'hide' | 'scared';

export interface AdultOpts { gender: 'm' | 'f'; hat?: number; hatBand?: number; belt: number; pack?: number; glasses?: boolean; mustache?: number; }
export interface CamperSpec {
  id: string; name: string; blurb: string;
  height: number; build: number; skin: number; hair: number; hairStyle: HairStyle;
  top: number; topStyle: TopStyle; accent?: number; decal?: number;
  bottom: number; long?: boolean; sock?: number; sockStripes?: number; sockLen?: 'ankle' | 'crew' | 'tube';
  shoe: number; extras?: Extra[]; extraColor?: number; adult?: AdultOpts;
}
export interface Camper {
  root: THREE.Group; hips: THREE.Group; torso: THREE.Group; head: THREE.Group;
  mouth: THREE.Object3D; armL: THREE.Group; armR: THREE.Group; legL: THREE.Group; legR: THREE.Group;
  spec: CamperSpec; hip: number; sit: number;
}

type V3 = [number, number, number];
type Paint = (x: number, y: number, z: number, col: number) => number;
interface Prim { f: (x: number, y: number, z: number) => number; col: number; k: number; pri: number; lo: V3; hi: V3; }
const mk = (f: Prim['f'], col: number, k: number, pri: number, lo: V3, hi: V3): Prim => ({ f, col, k, pri, lo, hi });
const E = (c: V3, r: V3, col: number, k = 0.04, pri = 0): Prim => {
  const m = Math.min(...r);
  return mk((x, y, z) => {
    const a = (x - c[0]) / r[0], b = (y - c[1]) / r[1], d = (z - c[2]) / r[2];
    const k0 = Math.hypot(a, b, d); if (k0 < 1e-6) return -m;
    return (k0 * (k0 - 1)) / Math.hypot(a / r[0], b / r[1], d / r[2]);
  }, col, k, pri, [c[0] - r[0], c[1] - r[1], c[2] - r[2]], [c[0] + r[0], c[1] + r[1], c[2] + r[2]]);
};
const C = (a: V3, b: V3, r1: number, r2: number, col: number, k = 0.04, pri = 0): Prim => {
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2], l2 = bx * bx + by * by + bz * bz || 1e-9, R = Math.max(r1, r2);
  return mk((x, y, z) => {
    const px = x - a[0], py = y - a[1], pz = z - a[2];
    let h = (px * bx + py * by + pz * bz) / l2; h = h < 0 ? 0 : h > 1 ? 1 : h;
    return Math.hypot(px - bx * h, py - by * h, pz - bz * h) - (r1 + (r2 - r1) * h);
  }, col, k, pri, [Math.min(a[0], b[0]) - R, Math.min(a[1], b[1]) - R, Math.min(a[2], b[2]) - R], [Math.max(a[0], b[0]) + R, Math.max(a[1], b[1]) + R, Math.max(a[2], b[2]) + R]);
};
const B = (c: V3, h: V3, rad: number, col: number, k = 0.004, pri = 0): Prim => mk((x, y, z) => {
  const qx = Math.abs(x - c[0]) - h[0] + rad, qy = Math.abs(y - c[1]) - h[1] + rad, qz = Math.abs(z - c[2]) - h[2] + rad;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - rad;
}, col, k, pri, [c[0] - h[0], c[1] - h[1], c[2] - h[2]], [c[0] + h[0], c[1] + h[1], c[2] + h[2]]);
const Y = (c: V3, R: number, hy: number, rad: number, col: number, k = 0.004, pri = 0): Prim => mk((x, y, z) => {
  const qx = Math.hypot(x - c[0], z - c[2]) - R + rad, qy = Math.abs(y - c[1]) - hy + rad;
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - rad;
}, col, k, pri, [c[0] - R, c[1] - hy, c[2] - R], [c[0] + R, c[1] + hy, c[2] + R]);
const O = (c: V3, rx: number, rz: number, r: number, col: number, k = 0.004, pri = 0): Prim => {
  const m = Math.min(rx, rz);
  return mk((x, y, z) => Math.hypot((Math.hypot((x - c[0]) / rx, (z - c[2]) / rz) - 1) * m, y - c[1]) - r,
    col, k, pri, [c[0] - rx - r, c[1] - r, c[2] - rz - r], [c[0] + rx + r, c[1] + r, c[2] + rz + r]);
};
const smin = (a: number, b: number, k: number) => {
  if (k <= 0) return a < b ? a : b;
  const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25;
};
const fieldOf = (list: Prim[]) => {
  const ps = [...list].sort((a, b) => (b.hi[0] - b.lo[0]) * (b.hi[1] - b.lo[1]) * (b.hi[2] - b.lo[2]) - (a.hi[0] - a.lo[0]) * (a.hi[1] - a.lo[1]) * (a.hi[2] - a.lo[2]));
  const n = ps.length;
  return (x: number, y: number, z: number) => {
    let d = ps[0].f(x, y, z);
    for (let i = 1; i < n; i++) {
      const p = ps[i], t = d + p.k;
      if (t > 0) {
        const dx = Math.max(p.lo[0] - x, 0, x - p.hi[0]), dy = Math.max(p.lo[1] - y, 0, y - p.hi[1]), dz = Math.max(p.lo[2] - z, 0, z - p.hi[2]);
        if (dx * dx + dy * dy + dz * dz >= t * t) continue;
      } else continue;
      d = smin(d, p.f(x, y, z), p.k);
    }
    return d;
  };
};
const surfZ = (f: (x: number, y: number, z: number) => number, x: number, y: number, zOut = 0.4) => {
  let a = 0, b = zOut; if (f(x, y, 0) >= 0) return 0;
  for (let i = 0; i < 18; i++) { const m = (a + b) / 2; if (f(x, y, m) < 0) a = m; else b = m; }
  return a;
};

function polygonize(ps: Prim[], res: number, paint?: Paint): THREE.BufferGeometry {
  const f = fieldOf(ps), pad = 0.03;
  const lo: V3 = [1e9, 1e9, 1e9], hi: V3 = [-1e9, -1e9, -1e9];
  for (const p of ps) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], p.lo[a] - pad); hi[a] = Math.max(hi[a], p.hi[a] + pad); }
  const nx = Math.ceil((hi[0] - lo[0]) / res) + 1, ny = Math.ceil((hi[1] - lo[1]) / res) + 1, nz = Math.ceil((hi[2] - lo[2]) / res) + 1;
  const F = new Float32Array(nx * ny * nz);
  const S = 4, cs = res * S, cx = Math.ceil((nx - 1) / S) + 1, cy = Math.ceil((ny - 1) / S) + 1, cz = Math.ceil((nz - 1) / S) + 1;
  const Fc = new Float32Array(cx * cy * cz);
  for (let k = 0, n = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) Fc[n++] = f(lo[0] + i * cs, lo[1] + j * cs, lo[2] + k * cs);
  const cat = (i: number, j: number, k: number) => i + cx * (j + cy * k), thr = 2 * cs, flag = new Uint8Array(cx * cy * cz);
  for (let k = 0; k < cz - 1; k++) for (let j = 0; j < cy - 1; j++) for (let i = 0; i < cx - 1; i++) {
    let near = false;
    for (let c = 0; c < 8 && !near; c++) if (Math.abs(Fc[cat(i + (c & 1), j + ((c >> 1) & 1), k + (c >> 2))]) < thr) near = true;
    if (near) flag[cat(i, j, k)] = 1;
  }
  for (let k = 0, n = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++, n++) {
    const ci = Math.min(Math.floor(i / S), cx - 2), cj = Math.min(Math.floor(j / S), cy - 2), ck = Math.min(Math.floor(k / S), cz - 2);
    if (flag[cat(ci, cj, ck)]) F[n] = f(lo[0] + i * res, lo[1] + j * res, lo[2] + k * res);
    else F[n] = Fc[cat(ci + ((i - ci * S) * 2 >= S ? 1 : 0), cj + ((j - cj * S) * 2 >= S ? 1 : 0), ck + ((k - ck * S) * 2 >= S ? 1 : 0))];
  }
  const at = (i: number, j: number, k: number) => i + nx * (j + ny * k);
  const cell = new Int32Array(nx * ny * nz).fill(-1), vp: number[] = [];
  const co = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges: number[][] = []; for (const b of [1, 2, 4]) for (let a = 0; a < 8; a++) if (!(a & b)) edges.push([a, a | b]);
  const v = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let m = 0;
    for (let c = 0; c < 8; c++) { v[c] = F[at(i + co[c][0], j + co[c][1], k + co[c][2])]; if (v[c] < 0) m |= 1 << c; }
    if (m === 0 || m === 255) continue;
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (const [a, b] of edges) if (((m >> a) & 1) !== ((m >> b) & 1)) {
      const t = v[a] / (v[a] - v[b]);
      sx += co[a][0] + (co[b][0] - co[a][0]) * t; sy += co[a][1] + (co[b][1] - co[a][1]) * t; sz += co[a][2] + (co[b][2] - co[a][2]) * t; cnt++;
    }
    cell[at(i, j, k)] = vp.length / 3;
    vp.push(lo[0] + (i + sx / cnt) * res, lo[1] + (j + sy / cnt) * res, lo[2] + (k + sz / cnt) * res);
  }
  const idx: number[] = [], dim = [nx, ny, nz];
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const p = [i, j, k];
    for (let d = 0; d < 3; d++) {
      const u = (d + 1) % 3, w = (d + 2) % 3;
      if (p[d] > dim[d] - 2 || p[u] < 1 || p[w] < 1 || p[u] > dim[u] - 2 || p[w] > dim[w] - 2) continue;
      const q = [i, j, k]; q[d]++;
      const a = F[at(i, j, k)], b = F[at(q[0], q[1], q[2])];
      if ((a < 0) === (b < 0)) continue;
      const cc = (du: number, dw: number) => { const r = [i, j, k]; r[u] -= du; r[w] -= dw; return cell[at(r[0], r[1], r[2])]; };
      const c0 = cc(0, 0), c1 = cc(1, 0), c2 = cc(1, 1), c3 = cc(0, 1);
      if (c0 < 0 || c1 < 0 || c2 < 0 || c3 < 0) continue;
      if (a < 0) idx.push(c0, c1, c2, c0, c2, c3); else idx.push(c0, c2, c1, c0, c3, c2);
    }
  }
  const nv = vp.length / 3, pos = new Float32Array(vp), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), e = res * 0.5, c = new THREE.Color();
  const g = [0, 0, 0];
  const grad = (x: number, y: number, z: number) => {
    const gx = f(x + e, y, z) - f(x - e, y, z), gy = f(x, y + e, z) - f(x, y - e, z), gz = f(x, y, z + e) - f(x, y, z - e), l = Math.hypot(gx, gy, gz) || 1;
    g[0] = gx / l; g[1] = gy / l; g[2] = gz / l;
  };
  for (let i = 0; i < nv; i++) {
    let x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    const d = f(x, y, z); grad(x, y, z); x -= g[0] * d; y -= g[1] * d; z -= g[2] * d;
    grad(x, y, z); pos.set([x, y, z], i * 3); nor.set(g, i * 3);
    let best = 0, bs = 1e9;
    for (let p = 0; p < ps.length; p++) { const s = Math.abs(ps[p].f(x, y, z)) - ps[p].pri * 0.0015; if (s < bs) { bs = s; best = p; } }
    c.setHex(paint ? paint(x, y, z, ps[best].col) : ps[best].col); col.set([c.r, c.g, c.b], i * 3);
  }
  let flip = 0;
  for (let t = 0; t < Math.min(idx.length / 3, 400); t++) {
    const a = idx[t * 3], b = idx[t * 3 + 1], d = idx[t * 3 + 2];
    const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const wx = pos[d * 3] - pos[a * 3], wy = pos[d * 3 + 1] - pos[a * 3 + 1], wz = pos[d * 3 + 2] - pos[a * 3 + 2];
    flip += (uy * wz - uz * wy) * nor[a * 3] + (uz * wx - ux * wz) * nor[a * 3 + 1] + (ux * wy - uy * wx) * nor[a * 3 + 2];
  }
  if (flip < 0) for (let t = 0; t < idx.length; t += 3) { const s = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = s; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx); return geo;
}

interface Dims {
  legLen: number; shoeH: number; thigh: number; tr: number; kr: number; ar: number; TL: number; neck: number; neckR: number;
  sw: number; cW: number; cD: number; wW: number; wD: number; hW: number; hD: number; ul: number; fl: number; ur: number; fr: number;
  hand: V3; rx: number; ry: number; rz: number; legX: number; res: number; sleeve: number; shorts: number; sit: number; eyeR: number; nose: V3;
}
const KID: Dims = { legLen: 0.46, shoeH: 0.06, thigh: 0.22, tr: 0.058, kr: 0.046, ar: 0.033, TL: 0.32, neck: 0.05, neckR: 0.04, sw: 0.15, cW: 0.125, cD: 0.085,
  wW: 0.11, wD: 0.078, hW: 0.115, hD: 0.076, ul: 0.19, fl: 0.17, ur: 0.04, fr: 0.032, hand: [0.032, 0.048, 0.022], rx: 0.1, ry: 0.115, rz: 0.1,
  legX: 0.068, res: 0.011, sleeve: 0.09, shorts: 0.12, sit: 0.055, eyeR: 0.03, nose: [0.019, 0.025, 0.026] };
const ADULT: Dims = { legLen: 0.8, shoeH: 0.17, thigh: 0.4, tr: 0.075, kr: 0.058, ar: 0.042, TL: 0.5, neck: 0.07, neckR: 0.05, sw: 0.2, cW: 0.17, cD: 0.105,
  wW: 0.14, wD: 0.09, hW: 0.138, hD: 0.086, ul: 0.3, fl: 0.27, ur: 0.05, fr: 0.04, hand: [0.04, 0.06, 0.027], rx: 0.098, ry: 0.125, rz: 0.108,
  legX: 0.095, res: 0.014, sleeve: 0.15, shorts: 0, sit: 0.09, eyeR: 0.027, nose: [0.024, 0.032, 0.034] };
const mixc = (a: number, b: number, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();

function hairPrims(st: HairStyle, D: Dims, col: number, rc: number): Prim[] {
  const { rx, ry, rz } = D, out: Prim[] = [], tsx = D.sw > 0.18 ? 1 : 0.9;
  const h = (c: V3, r: V3, k = 0.04) => out.push(E(c, r, col, k, 1));
  const dome = (sx = 1.07, sy = 1.0, sz = 1.08, y = 0.2, z = -0.1) => h([0, ry * y, rz * z], [rx * sx, ry * sy, rz * sz]);
  const sideB = (ox: number, y: number, z: number, a: number, b: number, c: number) => { for (const s of [-1, 1]) h([s * rx * ox, ry * y, rz * z], [rx * a, ry * b, rz * c]); };
  const back = (y: number, a: number, b: number, c: number, z = -0.6) => h([0, ry * y, rz * z], [rx * a, ry * b, rz * c]);
  const fringe = (w = 0.88) => h([0, ry * 0.46, rz * 0.8], [rx * w, ry * 0.2, rz * 0.34]);
  switch (st) {
    case 'buzz': case 'crop': dome(1.03, 0.94, 1.03, 0.18, -0.08); break;
    case 'short': case 'bowl': dome(); fringe(); sideB(0.9, -0.02, -0.1, 0.22, 0.55, 0.6); back(-0.15, 0.95, 0.72, 0.4); break;
    case 'feather': dome(); sideB(1.0, -0.1, -0.3, 0.3, 0.62, 0.6); back(-0.1, 0.95, 0.75, 0.4); break;
    case 'shag': dome(1.1, 1.02, 1.1); back(-0.4, 1.02, 1.0, 0.4, -0.68); sideB(0.95, -0.15, -0.15, 0.26, 0.8, 0.55); for (const k of [-1, 0, 1]) h([k * rx * 0.55, ry * 0.46, rz * 0.82], [rx * 0.3, ry * 0.2, rz * 0.3]); break;
    case 'mop': dome(1.17, 1.06, 1.15); fringe(1.0); back(-0.4, 1.12, 1.05, 0.45, -0.7); sideB(1.0, -0.2, -0.1, 0.3, 0.85, 0.6); break;
    case 'curly': dome(1.0, 0.95, 1.0, 0.2, -0.1); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, sx = Math.sin(a), cz = Math.cos(a), r = 0.05 * tsx + 0.012; if (cz < 0.7) h([sx * rx * 1.0, ry * 0.5, cz * rz * 0.95], [r, r, r], 0.03); if (cz < 0.2) h([sx * rx * 1.06, ry * -0.15, cz * rz * 1.0], [r, r, r], 0.03); } h([0, ry * 1.0, -rz * 0.1], [rx * 0.7, ry * 0.3, rz * 0.7], 0.03); break;
    case 'pigtails': dome(1.07, 1.0, 1.08); fringe(); back(-0.1, 0.95, 0.7, 0.4); for (const s of [-1, 1]) { out.push(C([s * rx * 1.05, -ry * 0.05, -rz * 0.25], [s * rx * 1.18, -ry * 1.0, -rz * 0.3], 0.036, 0.024, col, 0.03, 1)); out.push(O([s * rx * 1.07, -ry * 0.1, -rz * 0.26], 0.03, 0.03, 0.011, rc, 0.003, 3)); } break;
    case 'ponytail': dome(); back(-0.1, 0.95, 0.75, 0.4); fringe(0.8); out.push(C([0, ry * 0.15, -rz * 1.0], [0, -ry * 0.9, -rz * 1.3], 0.04, 0.022, col, 0.03, 1)); out.push(E([0, ry * 0.1, -rz * 1.03], [0.026, 0.026, 0.026], rc, 0.003, 3)); break;
    case 'bob': dome(); fringe(0.9); sideB(0.95, -0.4, -0.1, 0.22, 0.85, 0.65); back(-0.4, 1.0, 0.92, 0.45); break;
    case 'bun': dome(); back(-0.1, 0.95, 0.7, 0.4); fringe(0.8); h([0, ry * 1.0, -rz * 0.45], [0.055, 0.055, 0.055], 0.03); break;
    case 'long': dome(); fringe(0.85); back(-1.1, 1.0, 1.75, 0.42, -0.58); sideB(0.95, -0.7, -0.15, 0.2, 1.1, 0.5); break;
    case 'none': break;
  }
  return out;
}

interface Face { brows: V3[][]; smile: V3[]; freckles: V3[]; }
interface Parts { face: Face; D: Dims; torso: THREE.BufferGeometry; head: THREE.BufferGeometry; arm: THREE.BufferGeometry; leg: THREE.BufferGeometry; eye: V3; mouth: [number, number]; }

function torsoPrims(s: CamperSpec, D: Dims): { ps: Prim[]; paint?: Paint } {
  const { TL, sw, cW, cD, wW, wD, hW, hD } = D, ad = s.adult, sx2 = sw / 0.2, ex = s.extras ?? [];
  const base: Prim[] = [E([0, TL * 0.1, 0], [hW, TL * 0.18, hD], s.bottom, 0.04, 0), E([0, TL * 0.36, 0], [wW, TL * 0.3, wD], s.top, 0.05, 1), E([0, TL * 0.68, 0], [cW, TL * 0.36, cD], s.top, 0.05, 1), E([-(sw - 0.04), TL - 0.05, 0], [0.07 * sx2, 0.065, 0.068 * sx2], s.top, 0.04, 1), E([sw - 0.04, TL - 0.05, 0], [0.07 * sx2, 0.065, 0.068 * sx2], s.top, 0.04, 1), C([0, TL - 0.02, 0], [0, TL + 0.06, 0], D.neckR, D.neckR * 0.92, s.skin, 0.03, 2)];
  const bf = fieldOf(base), zc = (x: number, y: number) => surfZ(bf, x, y, 0.3);
  const ext = (y: number): [number, number] => { let a = 0, b = 0.35; for (let i = 0; i < 16; i++) { const m = (a + b) / 2; if (bf(m, y, 0) < 0) a = m; else b = m; } return [a, zc(0, y)]; };
  const out = [...base], brown = 0x5a3a22, acc = s.accent ?? 0xffffff; let paint: Paint | undefined;
  if (!ad) {
    const bands = s.topStyle === 'stripes' ? [0, 1, 2, 3].map(i => TL * (0.38 + 0.13 * i)) : [], dy = TL * 0.6;
    if (s.topStyle === 'ringer' || s.topStyle === 'layered') out.push(O([0, TL + 0.005, 0], D.neckR + 0.014, D.neckR + 0.014, 0.011, acc, 0.004, 3));
    paint = (x, y, z, c) => { if (c !== s.top) return c; for (const by of bands) if (Math.abs(y - by) < 0.013) return acc; if (s.decal !== undefined && z > 0.02 && Math.abs(x) < 0.05 && Math.abs(y - dy) < 0.036) return s.decal; return c; };
    if (ex.includes('neckerchief')) { const ec = s.extraColor ?? 0xd33a3a; out.push(O([0, TL + 0.002, 0], D.neckR + 0.016, D.neckR + 0.016, 0.014, ec, 0.005, 3)); out.push(C([0, TL - 0.01, zc(0, TL - 0.01) + 0.01], [0, TL - 0.095, zc(0, TL - 0.095) + 0.012], 0.035, 0.008, ec, 0.01, 3)); }
  } else {
    const dk = mixc(s.top, 0x000000, 0.12), dk2 = mixc(s.top, 0x000000, 0.2), col = mixc(s.top, 0xffffff, 0.22);
    for (const sg of [-1, 1]) { const px = sg * cW * 0.52, py = TL * 0.5, pz = zc(px, py); out.push(B([px, py, pz - 0.002], [0.046, 0.044, 0.011], 0.008, dk, 0.004, 2)); out.push(B([px, py + 0.034, pz + 0.001], [0.044, 0.017, 0.011], 0.007, dk2, 0.003, 2)); out.push(E([px, py + 0.026, pz + 0.01], [0.009, 0.009, 0.006], brown, 0.002, 3)); out.push(B([sg * (sw - 0.07), TL + 0.01, 0], [0.034, 0.009, 0.027], 0.006, dk, 0.004, 2)); out.push(E([sg * (sw - 0.07), TL + 0.018, 0], [0.008, 0.007, 0.008], brown, 0.002, 3)); }
    out.push(O([0, TL + 0.004, 0], D.neckR + 0.022, D.neckR + 0.022, 0.013, col, 0.004, 3));
    for (const f of [0.74, 0.56, 0.4]) out.push(E([0, TL * f, zc(0, f * TL) + 0.003], [0.009, 0.009, 0.006], brown, 0.002, 3));
    const qx = cW * 0.55, qy = TL * 0.82, qz = zc(qx, qy); out.push(B([qx, qy, qz - 0.003], [0.05, 0.034, 0.008], 0.01, 0x2c5a50, 0.002, 2));
    paint = (x, y, z, c) => { if (c !== 0x2c5a50 || z < 0) return c; const u = (x - qx) / 0.034, v = (y - (qy - 0.006)) / 0.017; if ((u * u + v * v < 1 && y < qy + 0.004) || (Math.abs(y - (qy + 0.017)) < 0.005 && Math.abs(x - qx) < 0.032)) return 0xe8702a; return c; };
    const by = TL * 0.2, [bx, bz] = ext(by); out.push(O([0, by, 0], bx + 0.002, bz + 0.002, 0.014, s.adult.belt, 0.004, 2)); out.push(B([0, by, bz + 0.002], [0.03, 0.022, 0.01], 0.006, 0xd9b24a, 0.003, 3));
  }
  return { ps: out, paint };
}

function headPrims(s: CamperSpec, D: Dims) {
  const { rx, ry, rz } = D, ad = s.adult, sk = s.skin, ec = s.extraColor ?? 0xd33a3a, ex = s.extras ?? [];
  const base: Prim[] = [E([0, 0, 0], [rx, ry, rz], sk, 0.04), E([0, -ry * 0.38, rz * 0.08], [rx * 0.84, ry * 0.66, rz * 0.88], sk, 0.05), C([0, -ry * 0.55, -0.01], [0, -ry - D.neck - 0.03, -0.01], D.neckR, D.neckR, sk, 0.03), E([-rx * 0.98, -ry * 0.04, -0.005], [0.017, 0.03, 0.022], sk, 0.02), E([rx * 0.98, -ry * 0.04, -0.005], [0.017, 0.03, 0.022], sk, 0.02), E([0, -ry * 0.14, rz * 0.95], D.nose, mixc(sk, 0xe0705a, 0.12), 0.03, 1)];
  const bf = fieldOf(base), zs = (x: number, y: number) => surfZ(bf, x, y, 0.3), out = [...base]; out.push(...hairPrims(s.hairStyle, D, s.hair, s.extraColor ?? 0xe05a8a));
  const on = (x: number, y: number, o = 0.003): V3 => [x, y, zs(x, y) + o];
  const brows = [-1, 1].map(sg => [on(sg * rx * 0.2, ry * 0.5), on(sg * rx * 0.44, ry * 0.56), on(sg * rx * 0.68, ry * 0.54)]);
  const my = -ry * 0.52, mw = rx * 0.34, smile: V3[] = []; for (let i = 0; i <= 4; i++) { const x = -mw + (i * mw) / 2; smile.push(on(x, my + 0.014 * (x / mw) ** 2)); }
  const freckles: V3[] = []; if (ex.includes('freckles')) for (const sg of [-1, 1]) for (let i = 0; i < 3; i++) { const x = sg * (0.04 + 0.012 * i), y = -ry * 0.2 - (i % 2) * 0.012; freckles.push(on(x, y, 0.0)); }
  if (ad?.mustache !== undefined) for (const sg of [-1, 1]) { const y = -ry * 0.4; out.push(C([sg * 0.004, y, zs(sg * 0.004, y) + 0.012], [sg * 0.042, y - 0.004, zs(sg * 0.042, y - 0.004) + 0.006], 0.013, 0.009, ad.mustache, 0.01, 3)); }
  if (ex.includes('cap')) { out.push(E([0, ry * 0.3, -rz * 0.06], [rx * 1.12, ry * 0.78, rz * 1.12], ec, 0.03, 4)); out.push(E([0, ry * 0.3, rz * 1.05], [rx * 0.85, 0.01, rz * 0.5], ec, 0.01, 4)); }
  if (ad?.hat !== undefined) { const y0 = ry * 0.62; out.push(Y([0, y0, 0], 0.24, 0.01, 0.008, ad.hat, 0.004, 4)); out.push(E([0, y0 + 0.06, 0], [0.122, 0.085, 0.128], ad.hat, 0.03, 4)); out.push(O([0, y0 + 0.022, 0], 0.125, 0.13, 0.013, ad.hatBand ?? 0x4a2f22, 0.003, 5)); }
  const paint: Paint | undefined = ex.includes('headband') ? (x, y, z, c) => (c === s.hair && y > ry * 0.24 && y < ry * 0.4 ? ec : c) : undefined;
  return { paint, ps: out, eye: [rx * 0.43, ry * 0.1, zs(rx * 0.43, ry * 0.1)] as V3, mouth: [my - 0.004, zs(0, my)] as [number, number], face: { brows, smile, freckles } };
}

function armPrims(s: CamperSpec, D: Dims): Prim[] {
  const { ul, fl, ur, fr, hand } = D, ad = s.adult, el: V3 = [0, -ul, 0.012], wr: V3 = [0, -ul - fl, 0];
  const sleeveCol = s.topStyle === 'layered' ? (s.accent ?? 0xffffff) : s.top;
  const ps: Prim[] = [C([0, 0, 0], el, ur, ur * 0.88, s.skin, 0.03), C(el, wr, fr * 1.02, fr * 0.8, s.skin, 0.03), E([0, -ul - fl - hand[1] * 0.8, 0.004], hand, s.skin, 0.02)];
  if (s.topStyle === 'sleeveless' && !ad) { ps.push(E([0, 0, 0], [ur * 1.15, ur * 1.1, ur * 1.15], s.top, 0.03, 1)); return ps; }
  const sl = (a: V3, b: V3, r1: number, r2: number) => ps.push(C(a, b, r1, r2, sleeveCol, 0.02, 1));
  const L = s.topStyle === 'layered' ? ul + fl * 0.82 : D.sleeve; let cz: number, cr: number;
  if (L <= ul) { cz = 0.012 * (L / ul); cr = ur * 1.22; sl([0, 0, 0], [0, -L, cz], ur * 1.3, cr); }
  else { cz = 0.012 * (1 - (L - ul) / fl); cr = fr * 1.25; sl([0, 0, 0], el, ur * 1.28, ur * 1.2); sl(el, [0, -L, cz], ur * 1.2, cr); }
  if (ad || s.topStyle === 'ringer') ps.push(O([0, -L + 0.008, cz], cr + 0.002, cr + 0.002, 0.009, ad ? mixc(s.top, 0x000000, 0.15) : (s.accent ?? 0xffffff), 0.003, 2));
  return ps;
}

function legPrims(s: CamperSpec, D: Dims): { ps: Prim[]; paint?: Paint } {
  const { legLen, shoeH, thigh, tr, kr, ar } = D, ad = s.adult, ank = legLen - shoeH;
  const ps: Prim[] = [C([0, 0, 0], [0, -thigh, 0.008], tr, kr, s.skin, 0.04), C([0, -thigh, 0.008], [0, -ank, 0], kr * 0.98, ar, s.skin, 0.04)]; let paint: Paint | undefined;
  if (ad) { ps.push(C([0, 0.03, 0], [0, -(legLen - 0.21), 0], tr * 1.18, kr * 1.2, s.bottom, 0.03, 1)); ps.push(C([0, -(legLen - 0.22), 0], [0, -(legLen - 0.06), 0], 0.06, 0.062, s.shoe, 0.02, 1)); ps.push(E([0, -legLen + 0.042, 0.05], [0.056, 0.042, 0.115], s.shoe, 0.03, 1)); ps.push(O([0, -(legLen - 0.15), 0], 0.065, 0.065, 0.011, mixc(s.shoe, 0x000000, 0.3), 0.004, 2)); ps.push(E([0, -legLen + 0.012, 0.05], [0.058, 0.016, 0.12], 0x2a1c12, 0.003, 2)); }
  else { if (s.long) ps.push(C([0, 0.02, 0], [0, -ank, 0], tr * 1.18, ar * 1.5, s.bottom, 0.03, 1)); else { ps.push(C([0, 0.02, 0], [0, -D.shorts, 0], tr * 1.14, 0.064, s.bottom, 0.03, 1)); const sl = { ankle: 0.05, crew: 0.12, tube: 0.2 }[s.sockLen ?? 'crew'], sc = s.sock ?? 0xf4f1e8, top = -ank + sl; ps.push(C([0, top, 0], [0, -ank - 0.005, 0], ar * 1.28, ar * 1.28, sc, 0.01, 1)); if (s.sockStripes !== undefined && s.sockLen !== 'ankle') { const vt = Math.min(top, -D.shorts - 0.064) - 0.014; paint = (x, y, z, c) => (c === sc && ((y < vt && y > vt - 0.022) || (y < vt - 0.04 && y > vt - 0.062)) ? s.sockStripes! : c); } } ps.push(E([0, -legLen + 0.036, 0.045], [0.046, 0.038, 0.098], s.shoe, 0.03, 1)); ps.push(E([0, -legLen + 0.011, 0.045], [0.048, 0.015, 0.101], 0xf2efe6, 0.003, 2)); }
  return { ps, paint };
}

const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
const SCL = new THREE.MeshStandardMaterial({ color: 0xfaf7f0, roughness: 0.4 });
const PUP = new THREE.MeshStandardMaterial({ color: 0x15100e, roughness: 0.3 });
const HLT = new THREE.MeshBasicMaterial({ color: 0xffffff });
const MOU = new THREE.MeshStandardMaterial({ color: 0x3a1418, roughness: 0.8 });
const SMI = new THREE.MeshStandardMaterial({ color: 0x5a2226, roughness: 0.7 });
const FRK = new THREE.MeshStandardMaterial({ color: 0xb0623e, roughness: 0.9 });
const SPH = new THREE.SphereGeometry(1, 16, 12); const cache = new Map<string, Parts>();
function getParts(s: CamperSpec, res?: number): Parts {
  const key = s.id + ':' + (res ?? ''); let P = cache.get(key); if (P) return P;
  const D: Dims = { ...(s.adult ? ADULT : KID) }; if (s.adult?.gender === 'f') { D.sw *= 0.9; D.cW *= 0.9; D.wW *= 0.93; D.ur *= 0.92; D.fr *= 0.92; D.rx *= 0.97; D.hand = [D.hand[0] * 0.92, D.hand[1] * 0.95, D.hand[2] * 0.92]; } if (res) D.res = res;
  const h = headPrims(s, D), t = torsoPrims(s, D), l = legPrims(s, D);
  P = { D, torso: polygonize(t.ps, s.adult ? D.res * 0.8 : D.res, t.paint), head: polygonize(h.ps, D.res * 0.8, h.paint), face: h.face, arm: polygonize(armPrims(s, D), D.res), leg: polygonize(l.ps, D.res, l.paint), eye: h.eye, mouth: h.mouth }; cache.set(key, P); return P;
}
const grp = (p: THREE.Object3D, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); return g; };
const part = (g: THREE.BufferGeometry, p: THREE.Object3D) => { const m = new THREE.Mesh(g, MAT); m.castShadow = true; p.add(m); return m; };
const ball = (p: THREE.Object3D, m: THREE.Material, r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(SPH, m); o.scale.set(r * sx, r * sy, r * sz); o.position.set(x, y, z); p.add(o); return o; };

export function buildCamper(s: CamperSpec, res?: number): Camper {
  const P = getParts(s, res), D = P.D, hip = D.legLen; const root = new THREE.Group(); root.name = s.id; const hips = grp(root, 0, hip, 0), torso = grp(hips); part(P.torso, torso);
  const mkArm = (sg: number) => { const a = grp(torso, sg * (D.sw - 0.015), D.TL - 0.055, 0); part(P.arm, a); return a; }; const armL = mkArm(1), armR = mkArm(-1);
  const mkLeg = (sg: number) => { const l = grp(root, sg * D.legX, hip, 0); part(P.leg, l); return l; }; const legL = mkLeg(1), legR = mkLeg(-1);
  const head = grp(torso, 0, D.TL + D.neck + D.ry, 0); part(P.head, head); const [ex, ey, ez] = P.eye, r = D.eyeR, cz = ez - 0.006;
  for (const sg of [-1, 1]) { ball(head, SCL, r, sg * ex, ey, cz); ball(head, PUP, r * 0.52, sg * ex - sg * 0.002, ey, cz + r * 0.82, 1, 1, 0.6); ball(head, HLT, r * 0.15, sg * ex - sg * 0.002 + r * 0.16, ey + r * 0.18, cz + r * 1.0); }
  const tube = (pts: V3[], rad: number, m: THREE.Material) => { const t = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2]))), 12, rad, 6, false), m); head.add(t); };
  const bm = new THREE.MeshStandardMaterial({ color: mixc(s.hair, 0x2a1a10, 0.35), roughness: 0.9 }); for (const b of P.face.brows) tube(b, 0.0085, bm); tube(P.face.smile, 0.0048, SMI); for (const f of P.face.freckles) ball(head, FRK, 0.0055, f[0], f[1], f[2], 1, 1, 0.5);
  const mouth = grp(head, 0, P.mouth[0], P.mouth[1]); ball(mouth, MOU, 0.02, 0, 0, 0.002, 1, 0.8, 0.5); mouth.visible = false;
  if ((s.extras ?? []).includes('glasses') || s.adult?.glasses) { const gm = new THREE.MeshStandardMaterial({ color: s.adult ? 0xc9a24a : 0x2a2a2a, roughness: 0.5, metalness: s.adult ? 0.3 : 0 }); for (const sg of [-1, 1]) { const t = new THREE.Mesh(new THREE.TorusGeometry(r * 1.5, 0.0035, 8, 24), gm); t.position.set(sg * ex, ey, cz + r + 0.004); head.add(t); } const b = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, ex * 0.6, 6), gm); b.rotation.z = Math.PI / 2; b.position.set(0, ey + r * 0.5, cz + r + 0.004); head.add(b); }
  root.scale.set(s.height * s.build, s.height, s.height * s.build); return { root, hips, torso, head, mouth, armL, armR, legL, legR, spec: s, hip, sit: D.sit };
}

export function poseCamper(c: Camper, pose: Pose, t: number): void {
  const { hips, torso, head, mouth, armL, armR, legL, legR } = c; const sn = Math.sin; let by = c.hip, bx = 0;
  for (const j of [legL, legR, torso, head]) j.rotation.set(0, 0, 0); armL.rotation.set(0, 0, 0.06); armR.rotation.set(0, 0, -0.06); torso.scale.y = 1; mouth.visible = pose === 'scared';
  if (pose === 'idle') { torso.scale.y = 1 + sn(t * 2) * 0.012; head.rotation.y = sn(t * 0.7) * 0.25; armL.rotation.z += sn(t * 2) * 0.03; armR.rotation.z -= sn(t * 2) * 0.03; }
  else if (pose === 'walk' || pose === 'run') { const run = pose === 'run', f = run ? 11 : 6, a = run ? 0.95 : 0.5, p = sn(t * f); legL.rotation.x = p * a; legR.rotation.x = -p * a; armL.rotation.x = -p * a * 0.9; armR.rotation.x = p * a * 0.9; if (run) { torso.rotation.x = 0.2; armL.rotation.z = 0.15; armR.rotation.z = -0.15; } by += Math.abs(p) * (run ? 0.05 : 0.025); }
  else if (pose === 'scared') { armL.rotation.z = 2.6 + sn(t * 40) * 0.05; armR.rotation.z = -2.6 - sn(t * 40) * 0.05; legL.rotation.z = 0.12; legR.rotation.z = -0.12; bx = sn(t * 45) * 0.006; head.rotation.x = -0.15; }
  else { by = c.sit; legL.rotation.set(-Math.PI / 2, 0, 0.15); legR.rotation.set(-Math.PI / 2, 0, -0.15); torso.rotation.x = 0.45; head.rotation.x = 0.35; armL.rotation.set(-2.5 + sn(t * 30) * 0.03, 0, 0.1); armR.rotation.set(-2.5 + sn(t * 30) * 0.03, 0, -0.1); }
  hips.position.set(bx, by, 0); legL.position.y = legR.position.y = by;
}

export const CAMPERS: CamperSpec[] = [
  { id: 'randy', name: "Randy 'Sunshine'", blurb: 'Maroon state-pride tee, orange shorts, striped tube socks. Loud, brave, first to volunteer.', height: 1.05, build: 1, skin: 0xe9b894, hair: 0x6b4a2f, hairStyle: 'feather', top: 0x7a1f3d, topStyle: 'tee', decal: 0xf2d36b, bottom: 0xe8902a, sock: 0xf4f1e8, sockStripes: 0xb5262e, sockLen: 'tube', shoe: 0x2b2b30, extras: ['freckles'] },
  { id: 'tammy', name: "Tammy 'Top Bunk'", blurb: 'Blonde shag, navy vest over a white long-sleeve, jeans, red sneakers. Hides high.', height: 1.08, build: 0.95, skin: 0xf0c4a0, hair: 0xe3bb62, hairStyle: 'shag', top: 0x24304f, topStyle: 'layered', accent: 0xf0eee6, bottom: 0x3d5a8a, long: true, sock: 0xf4f1e8, sockLen: 'crew', shoe: 0xc8352e },
  { id: 'mikey', name: "Mikey 'Bunk Rat'", blurb: 'Smallest camper. Orange tee, khaki shorts, bowl cut. Squeezes into impossible spots.', height: 0.88, build: 0.92, skin: 0xe0aa84, hair: 0x5a3a24, hairStyle: 'bowl', top: 0xe2792e, topStyle: 'tee', bottom: 0xa88a5e, sock: 0xf4f1e8, sockLen: 'crew', shoe: 0x8b6a45 },
  { id: 'kevin', name: "Kevin 'Carrot'", blurb: 'Ginger curls, freckles, teal-grey striped tee, red-striped tube socks. Jumpy.', height: 0.95, build: 1, skin: 0xf3cfb3, hair: 0xc4562b, hairStyle: 'curly', top: 0x8fa5a1, topStyle: 'stripes', accent: 0x4a6f78, bottom: 0x2c2a30, sock: 0xf4f1e8, sockStripes: 0xd8552a, sockLen: 'tube', shoe: 0x1f1f24, extras: ['freckles'] },
  { id: 'jenny', name: "Jenny 'Tube Socks'", blurb: 'Graphic tee, mint shorts, pink headband, mop of brown hair. Trades snacks for secrets.', height: 1, build: 0.92, skin: 0xe8b68e, hair: 0x6d4a33, hairStyle: 'mop', top: 0xf1efe8, topStyle: 'tee', decal: 0x6fc9b4, bottom: 0x7fd1bd, sock: 0xf4f1e8, sockStripes: 0xf2c14e, sockLen: 'tube', shoe: 0x3a5fa8, extras: ['headband'], extraColor: 0xe05a8a },
  { id: 'chip', name: "Chip 'Sprinter'", blurb: 'Blond, yellow tee, cut-off denim. Fastest kid on the lawn, worst at staying quiet.', height: 1.02, build: 0.95, skin: 0xefc29c, hair: 0xe8c46a, hairStyle: 'shag', top: 0xf0c93a, topStyle: 'tee', bottom: 0x4a6fa8, sock: 0xf4f1e8, sockLen: 'crew', shoe: 0x2d2d2d },
  { id: 'tony', name: "Tony 'Big T'", blurb: 'Biggest camper. Blue-striped shirt, grey shorts, glasses. Needs the longest escort.', height: 1.12, build: 1.2, skin: 0xd9a07a, hair: 0x2a1f1a, hairStyle: 'buzz', top: 0xf0eee6, topStyle: 'stripes', accent: 0x3b6aa8, bottom: 0x7b7f86, sock: 0xf4f1e8, sockLen: 'ankle', shoe: 0x303a4a, extras: ['glasses'] },
];

const UNI = 0x4f8c7e;
export const COUNSELORS: CamperSpec[] = [
  { id: 'hank', name: 'Ranger Hank', blurb: 'Head ranger. Curly hair, mustache, aviators, campaign hat. Talks to you like a TV host.', height: 1.02, build: 1, skin: 0xe8b898, hair: 0x6b4228, hairStyle: 'curly', top: UNI, topStyle: 'tee', bottom: 0x7d7550, shoe: 0x5a3a22, adult: { gender: 'm', hat: 0x6b5a35, hatBand: 0x4a2f22, belt: 0x4a2f22, glasses: true, mustache: 0x5a3a22 } },
  { id: 'maria', name: 'Ranger Maria', blurb: 'Archery and trails. Ponytail, flashlight on her belt, always counting heads.', height: 0.97, build: 1, skin: 0x9c6238, hair: 0x1c1410, hairStyle: 'ponytail', top: UNI, topStyle: 'tee', bottom: 0x8a7a58, shoe: 0x5a3a22, extraColor: 0xe8702a, adult: { gender: 'f', belt: 0x4a2f22 } },
  { id: 'doc', name: 'Ranger Doc', blurb: 'Camp medic. Grey crop, grey mustache, campaign hat. Carries the first-aid kit.', height: 1.0, build: 0.97, skin: 0xf3d0b4, hair: 0xc9c9c9, hairStyle: 'crop', top: UNI, topStyle: 'tee', bottom: 0x6f6a4c, shoe: 0x4a3220, adult: { gender: 'm', hat: 0x6b5a35, hatBand: 0x3a2a18, belt: 0x3a2a18, mustache: 0xc9c9c9 } },
  { id: 'june', name: 'Ranger June', blurb: 'Junior ranger. Red bob, quick on her feet, knows every shortcut.', height: 0.93, build: 0.96, skin: 0xf0c4a0, hair: 0xb5432a, hairStyle: 'bob', top: UNI, topStyle: 'tee', bottom: 0x7d7550, shoe: 0x6b3e22, adult: { gender: 'f', belt: 0x4a2f22 } },
  { id: 'big_al', name: 'Ranger Big Al', blurb: 'Bus driver and handyman. Broad shoulders, black mustache, hat low over his eyes.', height: 1.06, build: 1.15, skin: 0x6b4226, hair: 0x15100c, hairStyle: 'crop', top: UNI, topStyle: 'tee', bottom: 0x5f5a45, shoe: 0x2b2b30, adult: { gender: 'm', hat: 0x6b5a35, hatBand: 0x4a2f22, belt: 0x2b2b30, mustache: 0x15100c } },
  { id: 'tess', name: 'Ranger Tess', blurb: 'Trail guide. Long blonde hair, campaign hat, tan skin from too many summers.', height: 0.98, build: 1, skin: 0xd9a07a, hair: 0xe3bb62, hairStyle: 'long', top: UNI, topStyle: 'tee', bottom: 0x8a7a58, shoe: 0x5a3a22, adult: { gender: 'f', hat: 0x6b5a35, hatBand: 0x4a2f22, belt: 0x4a2f22 } },
];

/** Compatibility wrapper used by Game; keeps rendering independent from host/net follower mechanics. */
export class CamperActor {
  root: THREE.Group;
  private camper: Camper;
  private t = 0;
  constructor(public id: number) {
    this.camper = buildCamper(CAMPERS[id % CAMPERS.length]);
    this.root = this.camper.root;
    this.root.name = `camper-${id}`;
  }
  update(dt: number, moving: boolean, scared = false, hiding = false): void {
    this.t += dt;
    const pose: Pose = hiding ? 'hide' : moving ? (scared ? 'run' : 'walk') : scared ? 'scared' : 'idle';
    poseCamper(this.camper, pose, this.t);
  }
}

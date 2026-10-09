import type { Layout } from '../game/layout';
import { WORLD_HALF } from '../game/constants';
import { LANDMARKS } from '../game/landmarks';

/** Retro illustrated top-down map. It intentionally shows landmarks, not hidden camper locations. */
export class CampMap {
  root = document.createElement('div');
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private visible = false;
  private px = 0;
  private pz = 0;
  private yaw = 0;

  constructor(private layout: Layout) {
    this.root.className = 'camp-map hidden';
    const title = document.createElement('div');
    title.className = 'camp-map-title';
    title.textContent = 'CAMP GLOWSTICK — STAFF MAP';
    this.canvas.width = 760; this.canvas.height = 620;
    this.ctx = this.canvas.getContext('2d')!;
    const hint = document.createElement('div');
    hint.className = 'camp-map-hint';
    hint.textContent = 'M to close · campers are not marked';
    this.root.append(title, this.canvas, hint);
    this.draw();
  }

  toggle(): boolean {
    this.visible = !this.visible;
    this.root.classList.toggle('hidden', !this.visible);
    if (this.visible) this.draw();
    return this.visible;
  }
  hide(): void { this.visible = false; this.root.classList.add('hidden'); }
  get open(): boolean { return this.visible; }

  update(x: number, z: number, yaw: number): void {
    this.px = x; this.pz = z; this.yaw = yaw;
    if (this.visible) this.draw();
  }

  private sx(x: number): number { return 38 + ((x + WORLD_HALF) / (WORLD_HALF * 2)) * (this.canvas.width - 76); }
  private sy(z: number): number { return 44 + ((z + WORLD_HALF) / (WORLD_HALF * 2)) * (this.canvas.height - 88); }

  private draw(): void {
    const c = this.ctx, w = this.canvas.width, h = this.canvas.height;
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#f7efce'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#5c4033'; c.lineWidth = 7; c.strokeRect(8, 8, w - 16, h - 16);

    c.fillStyle = '#556b2f';
    c.fillRect(16, 16, w - 32, 22); c.fillRect(16, h - 38, w - 32, 22);
    c.fillRect(16, 38, 22, h - 76); c.fillRect(w - 38, 38, 22, h - 76);

    for (const cl of this.layout.clearings) {
      c.beginPath(); c.ellipse(this.sx(cl.x), this.sy(cl.z), cl.rx * 2.2, cl.rz * 2.2, 0, 0, Math.PI * 2);
      c.fillStyle = '#92a45f'; c.globalAlpha = .72; c.fill(); c.globalAlpha = 1;
    }

    c.beginPath(); c.ellipse(this.sx(this.layout.water.x), this.sy(this.layout.water.z), this.layout.water.rx * 2.25, this.layout.water.rz * 2.25, 0, 0, Math.PI * 2);
    c.fillStyle = '#78b9c3'; c.fill(); c.strokeStyle = '#315d6f'; c.lineWidth = 3; c.stroke();

    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const road of this.layout.roads) {
      c.beginPath(); road.points.forEach(([x, z], i) => i ? c.lineTo(this.sx(x), this.sy(z)) : c.moveTo(this.sx(x), this.sy(z)));
      c.strokeStyle = '#b86c36'; c.lineWidth = Math.max(5, road.width * 1.65); c.stroke();
    }

    for (const s of this.layout.statics) {
      if (s.name === 'tree' || s.name === 'tree2' || s.name === 'tree3') continue;
      const x = this.sx(s.x), y = this.sy(s.z);
      if (s.name === 'cabin') {
        c.save(); c.translate(x, y); c.rotate(-s.rot); c.fillStyle = '#33563d'; c.fillRect(-8, -6, 16, 12); c.fillStyle = '#f0d36b'; c.fillRect(-3, 1, 6, 5); c.restore();
      } else if (s.name === 'shed') {
        c.fillStyle = '#6d705c'; c.fillRect(x - 9, y - 7, 18, 14);
      } else if (s.name === 'tent') {
        c.beginPath(); c.moveTo(x, y - 8); c.lineTo(x - 8, y + 7); c.lineTo(x + 8, y + 7); c.closePath(); c.fillStyle = '#d77a42'; c.fill();
      } else if (s.name === 'bus') {
        c.fillStyle = '#e09f3e'; c.fillRect(x - 16, y - 7, 32, 14); c.strokeStyle = '#5c4033'; c.lineWidth = 2; c.strokeRect(x - 16, y - 7, 32, 14);
      } else if (s.name === 'campfire') {
        c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.fillStyle = '#c15c3d'; c.fill();
      }
    }

    // Named player-enterable landmark buildings.
    c.font = 'bold 11px Rockwell, Georgia, serif';
    for (const b of LANDMARKS) {
      const x = this.sx(b.x), y = this.sy(b.z), scale = 2.05;
      c.save(); c.translate(x, y); c.rotate(-b.rot);
      c.fillStyle = b.kind === 'bathhouse' ? '#68736b' : '#7b5b3a';
      c.fillRect(-b.w * scale / 2, -b.d * scale / 2, b.w * scale, b.d * scale);
      c.strokeStyle = '#f0d36b'; c.lineWidth = 2; c.strokeRect(-b.w * scale / 2, -b.d * scale / 2, b.w * scale, b.d * scale);
      c.restore();
      c.fillStyle = '#5c4033'; c.fillText(b.label, x + 8, y - b.d * 1.25);
    }

    c.fillStyle = '#355f35';
    for (let i = 0; i < this.layout.trees.length; i += 4) {
      const t = this.layout.trees[i]; c.beginPath(); c.arc(this.sx(t.x), this.sy(t.z), 2.3, 0, Math.PI * 2); c.fill();
    }

    c.font = 'bold 15px Rockwell, Georgia, serif'; c.fillStyle = '#5c4033';
    const labels: [string, number, number][] = [
      ['BUS / EXIT', 31, 2], ['CAMPFIRE', 0, 6], ['WATERFRONT', 92, -6], ['TENT FIELD', -7, 58], ['MAINT.', -102, -42], ['MAINT.', 97, -29],
    ];
    labels.forEach(([text, x, z]) => c.fillText(text, this.sx(x) + 9, this.sy(z) - 9));

    const x = this.sx(this.px), y = this.sy(this.pz);
    c.save(); c.translate(x, y); c.rotate(-this.yaw); c.beginPath(); c.moveTo(0, -11); c.lineTo(7, 8); c.lineTo(0, 4); c.lineTo(-7, 8); c.closePath(); c.fillStyle = '#9b2226'; c.fill(); c.strokeStyle = '#fffdd0'; c.lineWidth = 2; c.stroke(); c.restore();
  }
}

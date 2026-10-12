import type { Layout } from '../game/layout';
import { WORLD_HALF } from '../game/constants';
import { LANDMARKS } from '../game/landmarks';

export interface MapPlayer { x: number; z: number; name: string }

/** Folded Forest-Service-style camp map. Hidden campers are never revealed. */
export class CampMap {
  root = document.createElement('div');
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private visible = false;
  private px = 0;
  private pz = 0;
  private yaw = 0;
  private players: MapPlayer[] = [];

  constructor(private layout: Layout) {
    this.root.className = 'camp-map hidden';
    const titleBar = document.createElement('div');
    titleBar.className = 'camp-map-titlebar';
    const title = document.createElement('div');
    title.className = 'camp-map-title';
    title.textContent = 'CAMP GLOWSTICK — TRAIL MAP';
    const close = document.createElement('button');
    close.className = 'camp-map-close';
    close.type = 'button';
    close.textContent = 'PUT MAP AWAY ×';
    close.setAttribute('aria-label', 'Put camp map away');
    const closeMap = (e: Event) => { e.preventDefault(); e.stopPropagation(); this.hide(); };
    close.addEventListener('pointerdown', closeMap);
    close.addEventListener('click', closeMap);
    titleBar.append(title, close);

    this.canvas.width = 820; this.canvas.height = 640;
    this.ctx = this.canvas.getContext('2d')!;
    const hint = document.createElement('div');
    hint.className = 'camp-map-hint';
    hint.textContent = 'M or PUT MAP AWAY to close · campers are intentionally not marked';
    this.root.append(titleBar, this.canvas, hint);
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

  update(x: number, z: number, yaw: number, players: MapPlayer[] = []): void {
    this.px = x; this.pz = z; this.yaw = yaw; this.players = players;
    if (this.visible) this.draw();
  }

  private sx(x: number): number { return 54 + ((x + WORLD_HALF) / (WORLD_HALF * 2)) * (this.canvas.width - 108); }
  private sy(z: number): number { return 54 + ((z + WORLD_HALF) / (WORLD_HALF * 2)) * (this.canvas.height - 108); }

  private path(points: [number, number][], width: number, color: string, dash: number[] = []): void {
    const c = this.ctx; c.beginPath(); c.setLineDash(dash);
    points.forEach(([x, z], i) => i ? c.lineTo(this.sx(x), this.sy(z)) : c.moveTo(this.sx(x), this.sy(z)));
    c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); c.setLineDash([]);
  }

  private label(text: string, x: number, z: number, align: CanvasTextAlign = 'left'): void {
    const c = this.ctx, px = this.sx(x), py = this.sy(z);
    c.save(); c.font = '900 12px Rockwell, Georgia, serif'; c.textAlign = align; c.textBaseline = 'middle';
    const w = c.measureText(text).width + 10;
    const bx = align === 'right' ? px - w : align === 'center' ? px - w / 2 : px;
    c.fillStyle = 'rgba(230,216,184,.92)'; c.fillRect(bx - 3, py - 9, w + 6, 18);
    c.strokeStyle = '#5C4033'; c.lineWidth = 1.5; c.strokeRect(bx - 3, py - 9, w + 6, 18);
    c.fillStyle = '#26394D'; c.fillText(text, px + (align === 'left' ? 4 : align === 'right' ? -4 : 0), py + .5);
    c.restore();
  }

  private drawCompass(): void {
    const c = this.ctx, x = this.canvas.width - 68, y = 72;
    c.save(); c.translate(x, y); c.strokeStyle = '#5C4033'; c.fillStyle = '#A74332'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -20); c.lineTo(7, 3); c.lineTo(0, 0); c.lineTo(-7, 3); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(0, 20); c.lineTo(6, -2); c.lineTo(0, 1); c.lineTo(-6, -2); c.closePath(); c.stroke();
    c.fillStyle = '#26394D'; c.font = '900 12px Georgia'; c.textAlign = 'center'; c.fillText('N', 0, -27); c.restore();
  }

  private draw(): void {
    const c = this.ctx, w = this.canvas.width, h = this.canvas.height;
    c.clearRect(0, 0, w, h);

    // Warm photocopied / folded trail-map paper.
    c.fillStyle = '#E6D8B8'; c.fillRect(0, 0, w, h);
    const paper = c.createLinearGradient(0, 0, w, h); paper.addColorStop(0, 'rgba(255,255,255,.14)'); paper.addColorStop(.5, 'rgba(71,123,120,.035)'); paper.addColorStop(1, 'rgba(92,64,51,.10)'); c.fillStyle = paper; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#5C4033'; c.lineWidth = 5; c.strokeRect(10, 10, w - 20, h - 20);
    c.strokeStyle = 'rgba(92,64,51,.22)'; c.lineWidth = 1.4; c.setLineDash([5, 6]); c.beginPath(); c.moveTo(w / 3, 14); c.lineTo(w / 3, h - 14); c.moveTo(2 * w / 3, 14); c.lineTo(2 * w / 3, h - 14); c.stroke(); c.setLineDash([]);

    // Terrain clearings read like old park-map vegetation fields.
    for (const cl of this.layout.clearings) {
      c.beginPath(); c.ellipse(this.sx(cl.x), this.sy(cl.z), cl.rx * 2.1, cl.rz * 2.1, 0, 0, Math.PI * 2);
      c.fillStyle = 'rgba(116,122,61,.24)'; c.fill();
    }

    // Lake / waterfront.
    c.beginPath(); c.ellipse(this.sx(this.layout.water.x), this.sy(this.layout.water.z), this.layout.water.rx * 2.15, this.layout.water.rz * 2.15, 0, 0, Math.PI * 2);
    c.fillStyle = '#77AAA9'; c.fill(); c.strokeStyle = '#477B78'; c.lineWidth = 3; c.stroke();
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.arc(this.sx(this.layout.water.x) + i * 16, this.sy(this.layout.water.z) + 2, 12, .2, 2.9); c.strokeStyle = 'rgba(230,216,184,.45)'; c.lineWidth = 1.5; c.stroke(); }

    // Roads and trails: gravel roads are solid mustard/brown, foot trails are dashed.
    for (const road of this.layout.roads) {
      const points = road.points;
      if (road.kind === 'foot') {
        this.path(points, Math.max(2.2, road.width * .65), '#A74332', [8, 7]);
      } else {
        this.path(points, Math.max(5, road.width * 1.35), '#B49267');
        this.path(points, Math.max(1.8, road.width * .28), '#E6D8B8', [7, 9]);
      }
    }

    // Forest symbols: intentionally sparse to keep labels readable.
    c.fillStyle = '#31543A'; c.strokeStyle = '#31543A';
    for (let i = 0; i < this.layout.trees.length; i += 7) {
      const t = this.layout.trees[i], x = this.sx(t.x), y = this.sy(t.z);
      c.beginPath(); c.moveTo(x, y - 5); c.lineTo(x - 4, y + 3); c.lineTo(x + 4, y + 3); c.closePath(); c.fill();
      c.fillRect(x - .8, y + 3, 1.6, 3);
    }

    // Major structures. Cabins are grouped visually like a real camp brochure instead of giant text labels.
    for (const s of this.layout.statics) {
      if (s.name === 'tree' || s.name === 'tree2' || s.name === 'tree3') continue;
      const x = this.sx(s.x), y = this.sy(s.z);
      if (s.name === 'cabin') {
        c.save(); c.translate(x, y); c.rotate(-s.rot); c.fillStyle = '#31543A'; c.fillRect(-6.5, -4.5, 13, 9); c.fillStyle = '#D5A336'; c.fillRect(-1.8, 1, 3.6, 3.6); c.restore();
      } else if (s.name === 'shed' || s.name === 'trailShelter') {
        c.fillStyle = '#747A3D'; c.fillRect(x - 6, y - 5, 12, 10);
      } else if (s.name === 'tent') {
        c.beginPath(); c.moveTo(x, y - 6); c.lineTo(x - 6, y + 5); c.lineTo(x + 6, y + 5); c.closePath(); c.fillStyle = '#C85A28'; c.fill();
      } else if (s.name === 'bus') {
        c.fillStyle = '#D5A336'; c.fillRect(x - 13, y - 5, 26, 10); c.strokeStyle = '#5C4033'; c.lineWidth = 1.5; c.strokeRect(x - 13, y - 5, 26, 10);
      } else if (s.name === 'campfire') {
        c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fillStyle = '#C85A28'; c.fill(); c.strokeStyle = '#A74332'; c.stroke();
      }
    }

    // Hero buildings from the authored camp plan.
    for (const b of LANDMARKS) {
      const x = this.sx(b.x), y = this.sy(b.z), scale = 1.75;
      c.save(); c.translate(x, y); c.rotate(-b.rot);
      c.fillStyle = b.kind === 'bathhouse' ? '#477B78' : b.kind === 'maintenance' ? '#747A3D' : '#B49267';
      c.fillRect(-b.w * scale / 2, -b.d * scale / 2, b.w * scale, b.d * scale);
      c.strokeStyle = '#5C4033'; c.lineWidth = 1.6; c.strokeRect(-b.w * scale / 2, -b.d * scale / 2, b.w * scale, b.d * scale);
      c.restore();
    }

    // Fixed labels from the original preferred paper map. Keep them small and useful.
    const landmarkBy = (kind: string) => LANDMARKS.find((b) => b.kind === kind);
    const mark = (text: string, kind: string, dx = 0, dz = 0, align: CanvasTextAlign = 'left') => { const b = landmarkBy(kind); if (b) this.label(text, b.x + dx, b.z + dz, align); };
    this.label('BUS', this.layout.extraction.x + 4, this.layout.extraction.z - 3);
    mark('DIRECTOR', 'director', 4, -2);
    mark('DINING', 'dining', 5, -2);
    mark('BATH', 'bathhouse', 4, -2);
    mark('ARTS', 'arts', 4, -2);
    mark('MAINT.', 'maintenance', 4, -2);
    this.label('CABINS', -62, 35);
    this.label('CABINS', 49, 39);
    this.label('TREEHOUSE', 109, 110, 'right');
    this.label('DOCK', this.layout.water.x - 8, this.layout.water.z - 14, 'right');

    // Other counselors are helpful; hidden campers remain intentionally absent.
    c.font = '900 11px Rockwell, Georgia, serif';
    for (const p of this.players) {
      const x = this.sx(p.x), y = this.sy(p.z);
      c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fillStyle = '#477B78'; c.fill(); c.strokeStyle = '#FFFDD0'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#26394D'; c.fillText(p.name.slice(0, 9), x + 8, y - 6);
    }

    // YOU marker with view direction.
    const x = this.sx(this.px), y = this.sy(this.pz);
    c.save(); c.translate(x, y); c.rotate(-this.yaw); c.beginPath(); c.moveTo(0, -10); c.lineTo(6, 7); c.lineTo(0, 4); c.lineTo(-6, 7); c.closePath(); c.fillStyle = '#A74332'; c.fill(); c.strokeStyle = '#FFFDD0'; c.lineWidth = 2; c.stroke(); c.restore();
    c.font = '900 12px Rockwell, Georgia, serif'; c.fillStyle = '#A74332'; c.fillText('YOU', x + 9, y + 4);

    this.drawCompass();
    c.fillStyle = '#5C4033'; c.font = 'italic 12px Georgia, serif'; c.fillText('Campers do not appear on the map. Search every hiding place.', 48, h - 24);
  }
}

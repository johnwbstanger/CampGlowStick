import { GLOW_COLORS, DAY_SECONDS } from '../game/constants';
import { h } from './dom';

export interface HudData {
  stamina: number; held: string; glow: string; night: boolean; time: number;
  collected: number; need: number; rescued: number; camperNeed: number; names: string[]; fps: number;
  prompt?: string;
}

export class Hud {
  root = h('div', { id: 'hud' });
  private tl = h('div', { cls: 'tl compact', id: 'hud-objective' });
  private tr = h('div', { cls: 'tr', id: 'hud-players' });
  private bar = h('i');
  private objective = h('div', { cls: 'objective-line' });
  private heldText = h('span', {});
  private swatch = h('span', { cls: 'swatch' });
  private glowText = h('span', {});
  private info = h('div', { id: 'hud-held' }, this.heldText, this.swatch, this.glowText);
  private toastEl = h('div', { cls: 'toast', id: 'hud-toast' });
  private promptEl = h('div', { cls: 'prompt hidden', id: 'hud-prompt' });
  private controls = h('div', { cls: 'controls-pop hidden', id: 'hud-controls-pop' },
    h('div', {}, 'WASD move · Shift sprint · Tap Space jump · Hold Space crouch'),
    h('div', {}, 'Mouse / arrows look · Click / E interact · Hold click then release to throw'),
    h('div', {}, 'R place/drop · F flashlight · M map · G glowstick · 1–5 glow colour'));
  private controlsButton = h('button', { cls: 'controls-toggle', id: 'hud-controls-toggle', type: 'button' }, 'Controls ▾');
  private result?: HTMLElement;
  private toastTimer = 0;

  constructor() {
    this.controlsButton.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const opening = this.controls.classList.contains('hidden');
      this.controls.classList.toggle('hidden', !opening);
      this.controlsButton.textContent = opening ? 'Controls ▴' : 'Controls ▾';
    });
    this.tl.append(this.objective, this.controlsButton, this.controls);
    this.root.append(this.tl, this.tr, h('div', { cls: 'cross' }), this.promptEl, this.toastEl,
      h('div', { cls: 'bl' }, this.info, h('div', { cls: 'stam' }, this.bar)));
  }

  private setText(el: HTMLElement, text: string): void { if (el.textContent !== text) el.textContent = text; }

  update(d: HudData): void {
    const dusk = Math.max(0, Math.min(DAY_SECONDS, Math.round(d.time)));
    const remain = Math.max(0, DAY_SECONDS - dusk);
    const mins = Math.floor(remain / 60), secs = remain % 60;
    this.setText(this.objective, `${d.night ? 'NIGHT' : `DUSK ${mins}:${String(secs).padStart(2, '0')}`} · campers ${d.rescued}/${d.camperNeed} · return to bus`);
    this.setText(this.tr, `Counselors: ${d.names.join(', ')} · ${d.fps} fps`);
    this.bar.style.width = `${d.stamina}%`;
    this.setText(this.heldText, `Holding: ${d.held || 'nothing'}  `);
    this.setText(this.glowText, ` ${d.glow}`);
    const bg = `background:${GLOW_COLORS[d.glow]}`;
    if (this.swatch.getAttribute('style') !== bg) this.swatch.setAttribute('style', bg);
    const prompt = d.prompt ?? '';
    this.setText(this.promptEl, prompt);
    this.promptEl.classList.toggle('hidden', !prompt);
  }

  toast(text: string): void {
    this.toastEl.textContent = text;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => { this.toastEl.textContent = ''; }, 3000);
  }

  showResult(kind: 'win' | 'lose'): void {
    if (this.result) return;
    document.exitPointerLock?.();
    this.result = h('div', { cls: 'result', id: 'hud-result' },
      h('h1', {}, kind === 'win' ? 'CAMPERS SAFE!' : 'CAUGHT!'),
      h('p', {}, kind === 'win' ? 'Everyone piles onto the bus as the camp disappears into the dark.' : 'Something heard you...'),
      h('button', { id: 'btn-menu', onclick: () => { location.href = location.pathname; } }, 'Back to the registration desk'));
    this.root.append(this.result);
  }
}

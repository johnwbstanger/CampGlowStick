import { GLOW_COLORS } from '../game/constants';
import { h } from './dom';

export interface HudData {
  stamina: number; held: string; glow: string; night: boolean; time: number;
  collected: number; need: number; rescued: number; camperNeed: number; names: string[]; fps: number;
}

export class Hud {
  root = h('div', { id: 'hud' });
  private tl = h('div', { cls: 'tl', id: 'hud-objective' });
  private tr = h('div', { cls: 'tr', id: 'hud-players' });
  private bar = h('i');
  private objective = h('div', {});
  private heldText = h('span', {});
  private swatch = h('span', { cls: 'swatch' });
  private glowText = h('span', {});
  private info = h('div', { id: 'hud-held' }, this.heldText, this.swatch, this.glowText);
  private toastEl = h('div', { cls: 'toast', id: 'hud-toast' });
  private result?: HTMLElement;
  private toastTimer = 0;

  constructor() {
    this.tl.append(this.objective,
      h('div', {}, 'WASD move · Shift sprint · Tap Space jump · Hold Space crouch'),
      h('div', {}, 'Click / E interact · Hold click then release to throw · R place/drop · F flashlight'),
      h('div', {}, 'G snap glowstick · 1-5 colour · N day/night (host debug)'));
    this.root.append(this.tl, this.tr, h('div', { cls: 'cross' }), this.toastEl,
      h('div', { cls: 'bl' }, this.info, h('div', { cls: 'stam' }, this.bar)));
  }

  private setText(el: HTMLElement, text: string): void { if (el.textContent !== text) el.textContent = text; }

  update(d: HudData): void {
    const dusk = Math.max(0, Math.min(120, Math.round(d.time)));
    this.setText(this.objective, `${d.night ? 'NIGHT' : `SUNSET ${dusk}s`} · campers rescued ${d.rescued}/${d.camperNeed} · return to the bus`);
    this.setText(this.tr, `Counselors: ${d.names.join(', ')} · ${d.fps} fps`);
    this.bar.style.width = `${d.stamina}%`;
    this.setText(this.heldText, `Holding: ${d.held || 'nothing'}  `);
    this.setText(this.glowText, ` ${d.glow}`);
    const bg = `background:${GLOW_COLORS[d.glow]}`;
    if (this.swatch.getAttribute('style') !== bg) this.swatch.setAttribute('style', bg);
  }

  toast(text: string): void {
    this.toastEl.textContent = text;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => { this.toastEl.textContent = ''; }, 2500);
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

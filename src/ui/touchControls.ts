import type { LocalPlayer } from '../game/player';

export interface TouchActions {
  interact(): void;
  drop(): void;
  glow(): void;
  map(): void;
}

/**
 * iPad/mobile controls that do not depend on CSS pointer media queries or Pointer Lock.
 * Supports touch, Apple Pencil/pointer events, and Magic Keyboard trackpad clicks/drags.
 */
export class TouchControls {
  root = document.createElement('div');
  private movePad = document.createElement('div');
  private knob = document.createElement('div');
  private lookPad = document.createElement('div');
  private moveId = -1;
  private lookId = -1;
  private moveOrigin = { x: 0, y: 0 };
  private lookLast = { x: 0, y: 0 };
  private lookStart = { x: 0, y: 0 };
  private lookMoved = false;
  private touchMoveIdentifier = -1;
  private touchLookIdentifier = -1;
  private lastActionAt = 0;

  constructor(private player: LocalPlayer, private actions: TouchActions) {
    this.root.className = 'touch-controls';
    // iPad with Magic Keyboard often reports a fine pointer, so CSS media queries alone are unreliable.
    if (navigator.maxTouchPoints > 0) this.root.style.display = 'block';

    this.movePad.className = 'touch-move';
    this.knob.className = 'touch-knob';
    this.movePad.append(this.knob);

    this.lookPad.className = 'touch-look';
    this.lookPad.setAttribute('aria-label', 'Drag to look; tap to use');

    const safeAction = (fn: () => void) => {
      const now = performance.now();
      if (now - this.lastActionAt < 120) return;
      this.lastActionAt = now;
      fn();
    };

    const button = (text: string, cls: string, fn: () => void) => {
      const b = document.createElement('button');
      b.className = `touch-btn ${cls}`;
      b.textContent = text;
      const run = (e: Event) => { e.preventDefault(); e.stopPropagation(); safeAction(fn); };
      b.addEventListener('pointerdown', run, { passive: false });
      b.addEventListener('touchstart', run, { passive: false });
      b.addEventListener('click', run);
      return b;
    };

    const interact = button('USE', 'touch-use', actions.interact);
    const jump = button('JUMP', 'touch-jump', () => this.player.jump());
    const flash = button('LIGHT', 'touch-flash', () => this.player.toggleFlash());
    const glow = button('GLOW', 'touch-glow', actions.glow);
    const map = button('MAP', 'touch-map', actions.map);
    const drop = button('DROP', 'touch-drop', actions.drop);
    const sprint = button('RUN', 'touch-sprint', () => undefined);
    const crouch = button('CROUCH', 'touch-crouch', () => undefined);

    const hold = (b: HTMLButtonElement, down: (on: boolean) => void) => {
      const set = (on: boolean, e?: Event) => {
        e?.preventDefault(); e?.stopPropagation();
        down(on); b.classList.toggle('active', on);
      };
      b.addEventListener('pointerdown', (e) => { try { b.setPointerCapture(e.pointerId); } catch {} set(true, e); }, { passive: false });
      b.addEventListener('pointerup', (e) => set(false, e), { passive: false });
      b.addEventListener('pointercancel', (e) => set(false, e), { passive: false });
      b.addEventListener('touchstart', (e) => set(true, e), { passive: false });
      b.addEventListener('touchend', (e) => set(false, e), { passive: false });
      b.addEventListener('touchcancel', (e) => set(false, e), { passive: false });
    };
    hold(sprint, (on) => this.player.setTouchSprint(on));
    hold(crouch, (on) => this.player.setTouchCrouch(on));

    this.root.append(this.lookPad, this.movePad, interact, jump, flash, glow, map, drop, sprint, crouch);
    this.bindMove();
    this.bindLook();
  }

  private updateMove(clientX: number, clientY: number): void {
    const r = this.movePad.getBoundingClientRect();
    const radius = Math.max(34, r.width * .34);
    const dx = clientX - this.moveOrigin.x, dy = clientY - this.moveOrigin.y;
    const d = Math.hypot(dx, dy), m = d > radius ? radius / d : 1;
    const x = dx * m, y = dy * m;
    this.knob.style.transform = `translate(${x}px,${y}px)`;
    this.player.setTouchMove(x / radius, y / radius);
  }

  private endMove(): void {
    this.moveId = -1;
    this.touchMoveIdentifier = -1;
    this.knob.style.transform = '';
    this.player.setTouchMove(0, 0);
  }

  private bindMove(): void {
    this.movePad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.moveId = e.pointerId;
      try { this.movePad.setPointerCapture(e.pointerId); } catch {}
      const r = this.movePad.getBoundingClientRect();
      this.moveOrigin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      this.updateMove(e.clientX, e.clientY);
    }, { passive: false });
    this.movePad.addEventListener('pointermove', (e) => { if (e.pointerId === this.moveId) this.updateMove(e.clientX, e.clientY); }, { passive: false });
    this.movePad.addEventListener('pointerup', (e) => { if (e.pointerId === this.moveId) this.endMove(); }, { passive: false });
    this.movePad.addEventListener('pointercancel', () => this.endMove(), { passive: false });

    // Safari touch fallback. Some iPad versions intermittently skip pointermove on complex overlays.
    this.movePad.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0]; if (!t) return;
      this.touchMoveIdentifier = t.identifier;
      const r = this.movePad.getBoundingClientRect();
      this.moveOrigin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      this.updateMove(t.clientX, t.clientY);
    }, { passive: false });
    this.movePad.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = [...e.changedTouches].find((x) => x.identifier === this.touchMoveIdentifier); if (!t) return;
      this.updateMove(t.clientX, t.clientY);
    }, { passive: false });
    this.movePad.addEventListener('touchend', (e) => {
      if ([...e.changedTouches].some((x) => x.identifier === this.touchMoveIdentifier)) this.endMove();
    }, { passive: false });
    this.movePad.addEventListener('touchcancel', () => this.endMove(), { passive: false });
  }

  private beginLook(id: number, x: number, y: number): void {
    this.lookId = id;
    this.lookLast = { x, y };
    this.lookStart = { x, y };
    this.lookMoved = false;
  }

  private moveLook(x: number, y: number): void {
    const dx = x - this.lookLast.x, dy = y - this.lookLast.y;
    this.lookLast = { x, y };
    if (Math.hypot(x - this.lookStart.x, y - this.lookStart.y) > 8) this.lookMoved = true;
    this.player.lookDelta(dx * 1.45, dy * 1.45);
  }

  private endLook(): void {
    if (!this.lookMoved) this.actions.interact();
    this.lookId = -1;
    this.touchLookIdentifier = -1;
    this.lookMoved = false;
  }

  private bindLook(): void {
    this.lookPad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.beginLook(e.pointerId, e.clientX, e.clientY);
      try { this.lookPad.setPointerCapture(e.pointerId); } catch {}
    }, { passive: false });
    this.lookPad.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.lookId) { e.preventDefault(); this.moveLook(e.clientX, e.clientY); }
    }, { passive: false });
    this.lookPad.addEventListener('pointerup', (e) => { if (e.pointerId === this.lookId) { e.preventDefault(); this.endLook(); } }, { passive: false });
    this.lookPad.addEventListener('pointercancel', () => { this.lookId = -1; this.lookMoved = false; }, { passive: false });

    this.lookPad.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0]; if (!t) return;
      this.touchLookIdentifier = t.identifier;
      this.beginLook(-2, t.clientX, t.clientY);
    }, { passive: false });
    this.lookPad.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = [...e.changedTouches].find((x) => x.identifier === this.touchLookIdentifier); if (!t) return;
      this.moveLook(t.clientX, t.clientY);
    }, { passive: false });
    this.lookPad.addEventListener('touchend', (e) => {
      if ([...e.changedTouches].some((x) => x.identifier === this.touchLookIdentifier)) { e.preventDefault(); this.endLook(); }
    }, { passive: false });
    this.lookPad.addEventListener('touchcancel', () => { this.touchLookIdentifier = -1; this.lookMoved = false; }, { passive: false });
  }

  dispose(): void {
    this.player.setTouchMove(0, 0);
    this.player.setTouchSprint(false);
    this.player.setTouchCrouch(false);
    this.root.remove();
  }
}

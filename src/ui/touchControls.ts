import type { LocalPlayer } from '../game/player';

export interface TouchActions {
  interact(): void;
  drop(): void;
  glow(): void;
  map(): void;
}

/**
 * iPad/mobile controls built around two large thumb work-zones:
 * - left: floating analog movement stick that appears where the thumb lands
 * - right: direct camera pan with tap-to-use
 *
 * The outer movement ring automatically blends into sprint, so normal play never requires
 * holding RUN with a second finger. RUN remains as a one-tap sprint lock for players who prefer it.
 */
export class TouchControls {
  root = document.createElement('div');
  private movePad = document.createElement('div');
  private moveRing = document.createElement('div');
  private knob = document.createElement('div');
  private lookPad = document.createElement('div');
  private sprintButton!: HTMLButtonElement;
  private moveId = -1;
  private lookId = -1;
  private moveOrigin = { x: 0, y: 0 };
  private lookLast = { x: 0, y: 0 };
  private lookStart = { x: 0, y: 0 };
  private lookMoved = false;
  private touchMoveIdentifier = -1;
  private touchLookIdentifier = -1;
  private lastActionAt = -Infinity;
  private autoSprint = false;
  private sprintLocked = false;

  constructor(private player: LocalPlayer, private actions: TouchActions) {
    this.root.className = 'touch-controls';
    if (navigator.maxTouchPoints > 0) this.root.style.display = 'block';

    this.movePad.className = 'touch-move';
    this.movePad.setAttribute('aria-label', 'Touch anywhere on the left side to move; push to the outer ring to run');
    this.moveRing.className = 'touch-move-ring';
    this.knob.className = 'touch-knob';
    this.moveRing.append(this.knob);
    this.movePad.append(this.moveRing);

    this.lookPad.className = 'touch-look';
    this.lookPad.setAttribute('aria-label', 'Drag the right side to look; tap to use');

    const safeAction = (fn: () => void) => {
      const now = performance.now();
      if (now - this.lastActionAt < 110) return;
      this.lastActionAt = now;
      fn();
    };

    const button = (text: string, cls: string, fn: () => void) => {
      const b = document.createElement('button');
      b.className = `touch-btn ${cls}`;
      b.textContent = text;
      const run = (e: Event) => { e.preventDefault(); e.stopPropagation(); safeAction(fn); };
      b.addEventListener('pointerdown', run, { passive: false });
      b.addEventListener('click', run);
      return b;
    };

    const interact = button('USE', 'touch-use', actions.interact);
    const jump = button('JUMP', 'touch-jump', () => this.player.jump());
    const flash = button('LIGHT', 'touch-flash', () => this.player.toggleFlash());
    const glow = button('GLOW', 'touch-glow', actions.glow);
    const map = button('MAP', 'touch-map', actions.map);
    const drop = button('DROP', 'touch-drop', actions.drop);

    // Sprint is primarily controlled by pushing the movement stick into its outer band.
    // This button is a toggle, not a hold, so the player never needs a three-finger claw grip.
    this.sprintButton = button('RUN', 'touch-sprint', () => {
      this.sprintLocked = !this.sprintLocked;
      this.sprintButton.classList.toggle('active', this.sprintLocked);
      this.refreshSprint();
    });

    const crouch = button('CROUCH', 'touch-crouch', () => {
      const on = !crouch.classList.contains('active');
      crouch.classList.toggle('active', on);
      this.player.setTouchCrouch(on);
    });

    this.root.append(this.lookPad, this.movePad, interact, jump, flash, glow, map, drop, this.sprintButton, crouch);
    this.bindMove();
    this.bindLook();
  }

  private refreshSprint(): void {
    this.player.setTouchSprint(this.sprintLocked || this.autoSprint);
    this.moveRing.classList.toggle('sprinting', this.autoSprint);
  }

  private placeFloatingStick(clientX: number, clientY: number): void {
    const r = this.movePad.getBoundingClientRect();
    const ring = this.moveRing.getBoundingClientRect();
    const half = Math.max(68, ring.width / 2);
    const x = Math.max(r.left + half, Math.min(r.right - half, clientX));
    const y = Math.max(r.top + half, Math.min(r.bottom - half, clientY));
    this.moveOrigin = { x, y };
    this.moveRing.style.left = `${x - r.left}px`;
    this.moveRing.style.top = `${y - r.top}px`;
    this.moveRing.classList.add('active');
  }

  private updateMove(clientX: number, clientY: number): void {
    const ring = this.moveRing.getBoundingClientRect();
    const radius = Math.max(56, ring.width * .38);
    const deadzone = 0.055;
    const dx = clientX - this.moveOrigin.x, dy = clientY - this.moveOrigin.y;
    const d = Math.hypot(dx, dy), clamp = d > radius ? radius / d : 1;
    const x = dx * clamp, y = dy * clamp;
    this.knob.style.transform = `translate(${x}px,${y}px)`;

    const raw = Math.min(1, Math.hypot(x, y) / radius);
    const normalized = raw <= deadzone ? 0 : (raw - deadzone) / (1 - deadzone);
    const strength = Math.pow(normalized, 1.08);
    const denom = Math.hypot(x, y) || 1;
    this.player.setTouchMove((x / denom) * strength, (y / denom) * strength);

    const shouldSprint = raw >= .82;
    if (shouldSprint !== this.autoSprint) {
      this.autoSprint = shouldSprint;
      this.refreshSprint();
    }
  }

  private endMove(): void {
    this.moveId = -1;
    this.touchMoveIdentifier = -1;
    this.knob.style.transform = '';
    this.moveRing.classList.remove('active', 'sprinting');
    this.player.setTouchMove(0, 0);
    if (this.autoSprint) {
      this.autoSprint = false;
      this.refreshSprint();
    }
  }

  private bindMove(): void {
    const startPointer = (e: PointerEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (this.moveId >= 0) return;
      this.moveId = e.pointerId;
      this.placeFloatingStick(e.clientX, e.clientY);
      try { this.movePad.setPointerCapture(e.pointerId); } catch {}
      this.updateMove(e.clientX, e.clientY);
    };
    const movePointer = (e: PointerEvent) => {
      if (this.moveId < 0 || e.pointerId !== this.moveId) return;
      e.preventDefault(); e.stopPropagation();
      this.updateMove(e.clientX, e.clientY);
    };
    const endPointer = (e: PointerEvent) => {
      if (this.moveId < 0 || e.pointerId !== this.moveId) return;
      e.preventDefault(); e.stopPropagation();
      this.endMove();
    };

    this.movePad.addEventListener('pointerdown', startPointer, { passive: false });
    this.movePad.addEventListener('pointermove', movePointer, { passive: false });
    this.movePad.addEventListener('pointerup', endPointer, { passive: false });
    this.movePad.addEventListener('pointercancel', endPointer, { passive: false });
    this.movePad.addEventListener('lostpointercapture', (e) => { if (e.pointerId === this.moveId) this.endMove(); });
    window.addEventListener('pointermove', movePointer, { passive: false });
    window.addEventListener('pointerup', endPointer, { passive: false });
    window.addEventListener('pointercancel', endPointer, { passive: false });
    window.addEventListener('blur', () => this.endMove());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.endMove(); });

    // Old Safari fallback only. Modern iPadOS uses Pointer Events; registering both paths at once
    // can double-fire gestures and is a major source of clunky/sticky controls.
    if (!('PointerEvent' in window)) {
      this.movePad.addEventListener('touchstart', (e) => {
        e.preventDefault(); e.stopPropagation();
        const t = e.changedTouches[0]; if (!t || this.touchMoveIdentifier >= 0) return;
        this.touchMoveIdentifier = t.identifier;
        this.placeFloatingStick(t.clientX, t.clientY);
        this.updateMove(t.clientX, t.clientY);
      }, { passive: false });
      const moveTouch = (e: TouchEvent) => {
        if (this.touchMoveIdentifier < 0) return;
        const t = [...e.touches].find((x) => x.identifier === this.touchMoveIdentifier); if (!t) return;
        e.preventDefault(); this.updateMove(t.clientX, t.clientY);
      };
      const endTouch = (e: TouchEvent) => {
        if (this.touchMoveIdentifier >= 0 && [...e.changedTouches].some((x) => x.identifier === this.touchMoveIdentifier)) this.endMove();
      };
      this.movePad.addEventListener('touchmove', moveTouch, { passive: false });
      this.movePad.addEventListener('touchend', endTouch, { passive: false });
      this.movePad.addEventListener('touchcancel', () => this.endMove(), { passive: false });
      window.addEventListener('touchmove', moveTouch, { passive: false });
      window.addEventListener('touchend', endTouch, { passive: false });
      window.addEventListener('touchcancel', () => this.endMove(), { passive: false });
    }
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
    if (Math.hypot(x - this.lookStart.x, y - this.lookStart.y) > 9) this.lookMoved = true;
    this.player.lookDelta(dx * 1.18, dy * 1.18);
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
      if (this.lookId >= 0) return;
      this.beginLook(e.pointerId, e.clientX, e.clientY);
      try { this.lookPad.setPointerCapture(e.pointerId); } catch {}
    }, { passive: false });
    this.lookPad.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.lookId) { e.preventDefault(); this.moveLook(e.clientX, e.clientY); }
    }, { passive: false });
    this.lookPad.addEventListener('pointerup', (e) => { if (e.pointerId === this.lookId) { e.preventDefault(); this.endLook(); } }, { passive: false });
    this.lookPad.addEventListener('pointercancel', (e) => { if (e.pointerId === this.lookId) { this.lookId = -1; this.lookMoved = false; } }, { passive: false });
    this.lookPad.addEventListener('lostpointercapture', (e) => { if (e.pointerId === this.lookId) { this.lookId = -1; this.lookMoved = false; } });

    if (!('PointerEvent' in window)) {
      this.lookPad.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const t = e.changedTouches[0]; if (!t || this.touchLookIdentifier >= 0) return;
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
  }

  dispose(): void {
    this.player.setTouchMove(0, 0);
    this.player.setTouchSprint(false);
    this.player.setTouchCrouch(false);
    this.root.remove();
  }
}

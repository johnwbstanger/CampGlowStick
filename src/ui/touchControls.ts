import type { LocalPlayer } from '../game/player';

export interface TouchActions {
  interact(): void;
  drop(): void;
  glow(): void;
  map(): void;
}

/**
 * iPad/mobile overlay. It is deliberately enabled from navigator.maxTouchPoints rather than
 * only CSS pointer media queries because iPadOS with a Magic Keyboard reports a fine pointer
 * even though the touchscreen is still present.
 *
 * Left thumb = move. Right side drag = look. Right-side tap = context interact/throw/fire.
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
  private lookTravel = 0;
  private lookDownAt = 0;

  constructor(private player: LocalPlayer, actions: TouchActions) {
    this.root.className = 'touch-controls';

    // Critical iPadOS/Magic Keyboard fix: maxTouchPoints stays > 0 even when the active
    // pointer is the trackpad, while CSS (pointer: coarse) may stop matching.
    const touchCapable = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
    if (touchCapable) {
      this.root.classList.add('touch-capable');
      this.root.style.display = 'block';
    }

    this.movePad.className = 'touch-move';
    this.knob.className = 'touch-knob';
    this.movePad.append(this.knob);
    this.lookPad.className = 'touch-look';
    this.lookPad.setAttribute('aria-label', 'Drag to look; tap to use');

    const button = (text: string, cls: string, fn: () => void) => {
      const b = document.createElement('button');
      b.className = `touch-btn ${cls}`;
      b.textContent = text;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fn();
      });
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
      const set = (on: boolean, e: PointerEvent) => {
        e.preventDefault(); e.stopPropagation();
        down(on); b.classList.toggle('active', on);
      };
      b.addEventListener('pointerdown', (e) => { b.setPointerCapture(e.pointerId); set(true, e); });
      b.addEventListener('pointerup', (e) => set(false, e));
      b.addEventListener('pointercancel', (e) => set(false, e));
      b.addEventListener('lostpointercapture', () => { down(false); b.classList.remove('active'); });
    };
    hold(sprint, (on) => this.player.setTouchSprint(on));
    hold(crouch, (on) => this.player.setTouchCrouch(on));

    this.root.append(this.lookPad, this.movePad, interact, jump, flash, glow, map, drop, sprint, crouch);
    this.bindMove();
    this.bindLook(actions);
  }

  private bindMove(): void {
    const update = (e: PointerEvent) => {
      const r = this.movePad.getBoundingClientRect();
      const radius = Math.max(34, r.width * .34);
      const dx = e.clientX - this.moveOrigin.x, dy = e.clientY - this.moveOrigin.y;
      const d = Math.hypot(dx, dy), m = d > radius ? radius / d : 1;
      const x = dx * m, y = dy * m;
      this.knob.style.transform = `translate(${x}px,${y}px)`;
      this.player.setTouchMove(x / radius, y / radius);
    };

    this.movePad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.moveId = e.pointerId;
      this.movePad.setPointerCapture(e.pointerId);
      const r = this.movePad.getBoundingClientRect();
      this.moveOrigin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      update(e);
    });
    this.movePad.addEventListener('pointermove', (e) => { if (e.pointerId === this.moveId) update(e); });

    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.moveId) return;
      this.moveId = -1;
      this.knob.style.transform = '';
      this.player.setTouchMove(0, 0);
    };
    this.movePad.addEventListener('pointerup', end);
    this.movePad.addEventListener('pointercancel', end);
  }

  private bindLook(actions: TouchActions): void {
    this.lookPad.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType !== 'touch') return;
      e.preventDefault();
      this.lookId = e.pointerId;
      this.lookLast = { x: e.clientX, y: e.clientY };
      this.lookTravel = 0;
      this.lookDownAt = performance.now();
      this.lookPad.setPointerCapture(e.pointerId);
    });

    this.lookPad.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookId) return;
      e.preventDefault();
      const dx = e.clientX - this.lookLast.x, dy = e.clientY - this.lookLast.y;
      this.lookLast = { x: e.clientX, y: e.clientY };
      this.lookTravel += Math.hypot(dx, dy);

      // Trackpad/mouse needs less gain than a finger; both work without Pointer Lock.
      const gain = e.pointerType === 'mouse' ? 1.0 : 1.35;
      this.player.lookDelta(dx * gain, dy * gain);
    });

    const end = (e: PointerEvent, cancelled = false) => {
      if (e.pointerId !== this.lookId) return;
      e.preventDefault();
      const travel = this.lookTravel;
      const held = performance.now() - this.lookDownAt;
      this.lookId = -1;
      this.lookTravel = 0;
      this.lookDownAt = 0;

      // A short, steady tap/click is the iPad equivalent of left click/E.
      // Dragging is look-only so lifting the finger after turning never accidentally interacts.
      if (!cancelled && travel < 9 && held < 650) actions.interact();
    };

    this.lookPad.addEventListener('pointerup', (e) => end(e));
    this.lookPad.addEventListener('pointercancel', (e) => end(e, true));
    this.lookPad.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  dispose(): void {
    this.player.setTouchMove(0, 0);
    this.player.setTouchSprint(false);
    this.player.setTouchCrouch(false);
    this.root.remove();
  }
}

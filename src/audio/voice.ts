import type { Peer, MediaConnection } from 'peerjs';
import type { Session } from '../net/session';
import { audio } from './synth';

/** Optional proximity voice. Mic permission is requested only when the user flips the toggle; failures never touch gameplay. */
export class Voice {
  private stream?: MediaStream;
  private calls = new Map<string, MediaConnection>();
  private panners = new Map<string, PannerNode>();
  private peerToPlayer = new Map<string, number>();

  constructor(private s: Session) {
    const peer: Peer = s.peer;
    peer.on('call', (call) => { call.answer(this.stream); this.attach(call); });
  }

  async enable(): Promise<boolean> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      this.callAll();
      return true;
    } catch (e) {
      console.warn('[voice] unavailable:', e instanceof Error ? e.message : e);
      return false;
    }
  }

  disable(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
    this.calls.forEach((c) => c.close());
    this.calls.clear(); this.panners.clear();
  }

  /** Call every other camper (small mesh for voice only; gameplay stays host/star). Safe to call repeatedly. */
  callAll(): void {
    if (!this.stream) return;
    for (const p of this.s.players) {
      this.peerToPlayer.set(p.peer, p.id);
      if (p.id === this.s.myId || this.calls.has(p.peer) || p.peer === this.s.peer.id) continue;
      if (this.s.myId > p.id) continue; // lower id calls higher id once per pair
      this.attach(this.s.peer.call(p.peer, this.stream));
    }
  }

  private attach(call: MediaConnection): void {
    this.calls.set(call.peer, call);
    call.on('stream', (remote) => {
      const a = audio(); if (!a) return;
      const panner = a.createPanner();
      panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse'; panner.refDistance = 2; panner.maxDistance = 40; panner.rolloffFactor = 1.5;
      a.createMediaStreamSource(remote).connect(panner).connect(a.destination);
      this.panners.set(call.peer, panner);
      // Chromium only plays remote streams that are attached to a media element
      const el = new Audio(); el.srcObject = remote; el.muted = true; void el.play().catch(() => undefined);
    });
    call.on('close', () => { this.calls.delete(call.peer); this.panners.delete(call.peer); });
    call.on('error', () => undefined);
  }

  /** Called every frame with player positions by id, and the listener's pose. */
  update(listener: { x: number; y: number; z: number; yaw: number }, pos: (id: number) => { x: number; y: number; z: number } | undefined): void {
    const a = audio(); if (!a || !this.panners.size) return;
    const l = a.listener;
    if (l.positionX) { l.positionX.value = listener.x; l.positionY.value = listener.y; l.positionZ.value = listener.z; l.forwardX.value = -Math.sin(listener.yaw); l.forwardZ.value = -Math.cos(listener.yaw); }
    for (const [peerId, p] of this.panners) {
      const at = pos(this.peerToPlayer.get(peerId) ?? -1);
      if (at) { p.positionX.value = at.x; p.positionY.value = at.y; p.positionZ.value = at.z; }
    }
  }
}

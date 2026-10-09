import type { Peer, MediaConnection } from 'peerjs';
import type { Session } from '../net/session';
import { audio } from './synth';

/** Optional proximity voice. Mic permission is requested only when the user flips the toggle; failures never touch gameplay. */
export class Voice {
  private stream?: MediaStream;
  private calls = new Map<string, MediaConnection>();
  private panners = new Map<string, PannerNode>();
  private peerToPlayer = new Map<string, number>();
  private keepAlive = 0;
  private mediaEls = new Map<string, HTMLAudioElement>();

  constructor(private s: Session) {
    const peer: Peer = s.peer;
    peer.on('call', (call) => {
      for (const p of s.players) if (p.peer === call.peer) this.peerToPlayer.set(call.peer, p.id);
      call.answer(this.stream);
      this.attach(call);
    });
  }

  async enable(): Promise<boolean> {
    try {
      const ctx = audio(); if (ctx?.state === 'suspended') await ctx.resume().catch(() => undefined);
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false,
      });
      this.callAll();
      clearInterval(this.keepAlive);
      // Roster and WebRTC timing can race on mobile. Reconcile calls periodically and recover dropped peers.
      this.keepAlive = window.setInterval(() => this.callAll(), 1800);
      return true;
    } catch (e) {
      console.warn('[voice] unavailable:', e instanceof Error ? e.message : e);
      return false;
    }
  }

  disable(): void {
    clearInterval(this.keepAlive); this.keepAlive = 0;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
    this.calls.forEach((c) => c.close());
    this.calls.clear(); this.panners.clear();
    this.mediaEls.forEach((el) => { el.pause(); el.srcObject = null; el.remove(); }); this.mediaEls.clear();
  }

  /** Call every other counselor. Safe to call repeatedly and used as a mobile/WebRTC reconciliation pass. */
  callAll(): void {
    if (!this.stream) return;
    for (const p of this.s.players) {
      this.peerToPlayer.set(p.peer, p.id);
      if (p.id === this.s.myId || this.calls.has(p.peer) || p.peer === this.s.peer.id) continue;
      if (this.s.myId > p.id) continue;
      const call = this.s.peer.call(p.peer, this.stream, { metadata: { playerId: this.s.myId } });
      if (call) this.attach(call);
    }
  }

  private attach(call: MediaConnection): void {
    if (this.calls.has(call.peer)) return;
    this.calls.set(call.peer, call);
    call.on('stream', (remote) => {
      const a = audio(); if (!a) return;
      if (a.state === 'suspended') void a.resume().catch(() => undefined);
      const panner = a.createPanner();
      panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse'; panner.refDistance = 2.2; panner.maxDistance = 46; panner.rolloffFactor = 1.35;
      a.createMediaStreamSource(remote).connect(panner).connect(a.destination);
      this.panners.set(call.peer, panner);

      // Safari/iPad is more reliable when the remote MediaStream is also attached to a real media element.
      let el = this.mediaEls.get(call.peer);
      if (!el) {
        el = document.createElement('audio'); el.autoplay = true; el.playsInline = true; el.muted = true;
        el.style.display = 'none'; document.body.append(el); this.mediaEls.set(call.peer, el);
      }
      el.srcObject = remote; void el.play().catch(() => undefined);
    });
    const cleanup = () => {
      this.calls.delete(call.peer); this.panners.delete(call.peer);
      const el = this.mediaEls.get(call.peer); if (el) { el.pause(); el.srcObject = null; el.remove(); this.mediaEls.delete(call.peer); }
    };
    call.on('close', cleanup);
    call.on('error', cleanup);
  }

  /** Called every frame with player positions by id, and the listener's pose. */
  update(listener: { x: number; y: number; z: number; yaw: number }, pos: (id: number) => { x: number; y: number; z: number } | undefined): void {
    const a = audio(); if (!a || !this.panners.size) return;
    const l = a.listener;
    if (l.positionX) {
      l.positionX.value = listener.x; l.positionY.value = listener.y; l.positionZ.value = listener.z;
      l.forwardX.value = -Math.sin(listener.yaw); l.forwardY.value = 0; l.forwardZ.value = -Math.cos(listener.yaw);
    }
    for (const [peerId, p] of this.panners) {
      const at = pos(this.peerToPlayer.get(peerId) ?? -1);
      if (at) { p.positionX.value = at.x; p.positionY.value = at.y; p.positionZ.value = at.z; }
    }
  }
}

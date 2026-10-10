import type { Peer, MediaConnection } from 'peerjs';
import type { Session } from '../net/session';
import { audio } from './synth';

export interface VoiceDiagnostics {
  enabled: boolean;
  localTracks: number;
  calls: number;
  panners: number;
  pendingIncoming: number;
  peers: string[];
}

/** Optional proximity voice. Mic permission is requested only when the user flips the toggle; failures never touch gameplay. */
export class Voice {
  private stream?: MediaStream;
  private calls = new Map<string, MediaConnection>();
  private pendingIncoming = new Map<string, MediaConnection>();
  private panners = new Map<string, PannerNode>();
  private peerToPlayer = new Map<string, number>();
  private keepAlive = 0;
  private mediaEls = new Map<string, HTMLAudioElement>();

  constructor(private s: Session) {
    const peer: Peer = s.peer;
    peer.on('call', (call) => {
      for (const p of s.players) if (p.peer === call.peer) this.peerToPlayer.set(call.peer, p.id);
      // PeerJS cannot add our microphone retroactively to a call answered without a stream. Queue
      // the call until this player enables voice so toggle order cannot create one-way audio.
      if (!this.stream) {
        this.pendingIncoming.get(call.peer)?.close();
        this.pendingIncoming.set(call.peer, call);
        const discard = () => this.pendingIncoming.delete(call.peer);
        call.on('close', discard); call.on('error', discard);
        return;
      }
      call.answer(this.stream);
      this.attach(call);
    });
  }

  async enable(): Promise<boolean> {
    if (this.stream?.active) return true;
    try {
      const ctx = audio(); if (ctx?.state === 'suspended') await ctx.resume().catch(() => undefined);
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false,
      });

      // Answer calls that arrived while this player had voice disabled. This is the important iPad /
      // mixed-device path: no participant ends up permanently receive-only because they toggled later.
      for (const [peerId, call] of [...this.pendingIncoming]) {
        this.pendingIncoming.delete(peerId);
        call.answer(this.stream);
        this.attach(call);
      }
      this.callAll();
      clearInterval(this.keepAlive);
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
    this.pendingIncoming.forEach((c) => c.close());
    this.calls.clear(); this.pendingIncoming.clear(); this.panners.clear();
    this.mediaEls.forEach((el) => { el.pause(); el.srcObject = null; el.remove(); }); this.mediaEls.clear();
  }

  /** Call every other counselor. Safe to call repeatedly and used as a mobile/WebRTC reconciliation pass. */
  callAll(): void {
    if (!this.stream) return;
    for (const p of this.s.players) {
      this.peerToPlayer.set(p.peer, p.id);
      if (p.id === this.s.myId || this.calls.has(p.peer) || this.pendingIncoming.has(p.peer) || p.peer === this.s.peer.id) continue;
      // One deterministic caller per pair prevents duplicate media calls.
      if (this.s.myId > p.id) continue;
      const call = this.s.peer.call(p.peer, this.stream, { metadata: { playerId: this.s.myId } });
      if (call) this.attach(call);
    }
  }

  private attach(call: MediaConnection): void {
    if (this.calls.has(call.peer)) { call.close(); return; }
    this.calls.set(call.peer, call);
    call.on('stream', (remote) => {
      const a = audio(); if (!a) return;
      if (a.state === 'suspended') void a.resume().catch(() => undefined);
      const old = this.panners.get(call.peer); old?.disconnect();
      const panner = a.createPanner();
      panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse'; panner.refDistance = 2.2; panner.maxDistance = 46; panner.rolloffFactor = 1.35;
      a.createMediaStreamSource(remote).connect(panner).connect(a.destination);
      this.panners.set(call.peer, panner);

      // A muted media element keeps the WebRTC stream alive on iPad/Safari while WebAudio supplies
      // the audible spatialised signal.
      let el = this.mediaEls.get(call.peer);
      if (!el) {
        el = document.createElement('audio'); el.autoplay = true; el.muted = true;
        el.style.display = 'none'; document.body.append(el); this.mediaEls.set(call.peer, el);
      }
      el.srcObject = remote; void el.play().catch(() => undefined);
    });
    const cleanup = () => {
      if (this.calls.get(call.peer) === call) this.calls.delete(call.peer);
      this.panners.get(call.peer)?.disconnect(); this.panners.delete(call.peer);
      const el = this.mediaEls.get(call.peer); if (el) { el.pause(); el.srcObject = null; el.remove(); this.mediaEls.delete(call.peer); }
    };
    call.on('close', cleanup);
    call.on('error', cleanup);
  }

  diagnostics(): VoiceDiagnostics {
    return {
      enabled: !!this.stream?.active,
      localTracks: this.stream?.getAudioTracks().filter((t) => t.readyState === 'live').length ?? 0,
      calls: this.calls.size,
      panners: this.panners.size,
      pendingIncoming: this.pendingIncoming.size,
      peers: [...this.calls.keys()],
    };
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

import type { Peer, MediaConnection } from 'peerjs';
import type { Session } from '../net/session';
import { audio } from './synth';

export interface VoiceDiagnostics {
  enabled: boolean;
  localTracks: number;
  calls: number;
  panners: number;
  pendingIncoming: number;
  readyPeers: number;
  peers: string[];
}

/**
 * Optional proximity voice. Media calls are only placed after BOTH peers have announced that their
 * microphone stream exists over the reliable lobby data channel. This avoids the Safari/PeerJS
 * failure mode where a call is answered without a local stream and can never become two-way later.
 */
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
      const id = typeof call.metadata?.playerId === 'number'
        ? call.metadata.playerId
        : s.players.find((p) => p.peer === call.peer)?.id;
      if (typeof id === 'number') this.peerToPlayer.set(call.peer, id);

      // Do not answer a media call until this side has an actual live microphone track. A queued
      // call is answered immediately from enable(); if it goes stale PeerJS closes it and the
      // deterministic caller retries on the reconciliation interval.
      if (!this.stream?.active) {
        this.pendingIncoming.get(call.peer)?.close();
        this.pendingIncoming.set(call.peer, call);
        const discard = () => { if (this.pendingIncoming.get(call.peer) === call) this.pendingIncoming.delete(call.peer); };
        call.on('close', discard); call.on('error', discard);
        return;
      }
      call.answer(this.stream);
      this.attach(call);
    });

    s.onVoiceState = (id, enabled) => {
      if (!enabled) {
        const peerId = s.players.find((p) => p.id === id)?.peer;
        if (peerId) this.closePeer(peerId);
        return;
      }
      this.callPlayer(id);
    };
  }

  async enable(): Promise<boolean> {
    if (this.stream?.active) return true;
    try {
      const ctx = audio(); if (ctx?.state === 'suspended') await ctx.resume().catch(() => undefined);
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false,
      });

      // Announce readiness only after getUserMedia succeeds. Other players will now place their
      // canonical calls, so every answered call has a live stream on both sides.
      this.s.setVoiceReady(true);
      for (const [peerId, call] of [...this.pendingIncoming]) {
        this.pendingIncoming.delete(peerId);
        call.answer(this.stream);
        this.attach(call);
      }
      this.callAll();
      clearInterval(this.keepAlive);
      this.keepAlive = window.setInterval(() => this.callAll(), 1200);
      return true;
    } catch (e) {
      this.s.setVoiceReady(false);
      console.warn('[voice] unavailable:', e instanceof Error ? e.message : e);
      return false;
    }
  }

  disable(): void {
    this.s.setVoiceReady(false);
    clearInterval(this.keepAlive); this.keepAlive = 0;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
    this.calls.forEach((c) => c.close());
    this.pendingIncoming.forEach((c) => c.close());
    this.calls.clear(); this.pendingIncoming.clear(); this.panners.clear();
    this.mediaEls.forEach((el) => { el.pause(); el.srcObject = null; el.remove(); }); this.mediaEls.clear();
  }

  /** Reconcile media calls after roster/ICE/mobile-resume changes. */
  callAll(): void {
    if (!this.stream?.active) return;
    for (const p of this.s.players) this.callPlayer(p.id);
  }

  private callPlayer(id: number): void {
    if (!this.stream?.active || id === this.s.myId || !this.s.isVoiceReady(id)) return;
    const p = this.s.players.find((x) => x.id === id);
    if (!p || p.peer === this.s.peer.id) return;
    this.peerToPlayer.set(p.peer, p.id);
    if (this.calls.has(p.peer) || this.pendingIncoming.has(p.peer)) return;

    // One deterministic caller per pair avoids doubled audio while still allowing automatic retry.
    if (this.s.myId > p.id) return;
    const call = this.s.peer.call(p.peer, this.stream, { metadata: { playerId: this.s.myId } });
    if (call) this.attach(call);
  }

  private attach(call: MediaConnection): void {
    const existing = this.calls.get(call.peer);
    if (existing && existing !== call) { call.close(); return; }
    this.pendingIncoming.delete(call.peer);
    this.calls.set(call.peer, call);
    call.on('stream', (remote) => {
      const a = audio(); if (!a) return;
      if (a.state === 'suspended') void a.resume().catch(() => undefined);
      const old = this.panners.get(call.peer); old?.disconnect();
      const panner = a.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 2.2;
      panner.maxDistance = 46;
      panner.rolloffFactor = 1.35;
      a.createMediaStreamSource(remote).connect(panner).connect(a.destination);
      this.panners.set(call.peer, panner);

      // Safari is more reliable when the remote MediaStream is also attached to a media element.
      // It remains muted because WebAudio supplies the audible spatialised path.
      let el = this.mediaEls.get(call.peer);
      if (!el) {
        el = document.createElement('audio');
        el.autoplay = true; el.muted = true; el.playsInline = true;
        el.dataset.voicePeer = call.peer;
        el.style.display = 'none';
        document.body.append(el); this.mediaEls.set(call.peer, el);
      }
      el.srcObject = remote;
      void el.play().catch(() => undefined);
    });
    const cleanup = () => {
      if (this.calls.get(call.peer) === call) this.calls.delete(call.peer);
      this.panners.get(call.peer)?.disconnect(); this.panners.delete(call.peer);
      const el = this.mediaEls.get(call.peer);
      if (el) { el.pause(); el.srcObject = null; el.remove(); this.mediaEls.delete(call.peer); }
    };
    call.on('close', cleanup);
    call.on('error', cleanup);
  }

  private closePeer(peerId: string): void {
    this.pendingIncoming.get(peerId)?.close(); this.pendingIncoming.delete(peerId);
    this.calls.get(peerId)?.close(); this.calls.delete(peerId);
    this.panners.get(peerId)?.disconnect(); this.panners.delete(peerId);
    const el = this.mediaEls.get(peerId);
    if (el) { el.pause(); el.srcObject = null; el.remove(); this.mediaEls.delete(peerId); }
  }

  diagnostics(): VoiceDiagnostics {
    return {
      enabled: !!this.stream?.active,
      localTracks: this.stream?.getAudioTracks().filter((t) => t.readyState === 'live').length ?? 0,
      calls: this.calls.size,
      panners: this.panners.size,
      pendingIncoming: this.pendingIncoming.size,
      readyPeers: this.s.players.filter((p) => this.s.isVoiceReady(p.id)).length,
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

import { Peer, type DataConnection } from 'peerjs';
import { generateCode, isValidCode, normalizeCode, peerIdFor } from './codes';
import { peerOptions } from './config';
import { MAX_CAP, MIN_CAP, PROTOCOL, type Msg, type PlayerInfo } from './protocol';

export type NetErrorKind = 'invalid' | 'notfound' | 'full' | 'started' | 'timeout' | 'signaling' | 'host-left' | 'version';
export const ERROR_TEXT: Record<NetErrorKind, string> = {
  invalid: 'That code does not look right. Camp codes look like pine21.',
  notfound: 'No camp found with that code. Check it with your host.',
  full: 'That camp is full.',
  started: 'That camp has already started.',
  timeout: 'Connection timed out. The host may be behind a strict firewall (a TURN server helps).',
  signaling: 'Cannot reach the signaling server. Check your connection and try again.',
  'host-left': 'The host left the camp.',
  version: 'The host is running a different version of the game.',
};
export class NetError extends Error { constructor(public kind: NetErrorKind) { super(ERROR_TEXT[kind]); } }

const CONNECT_TIMEOUT = 12000;
const HEARTBEAT_MS = 2500;
const RECONNECT_GRACE_MS = 12000;
const RECONNECT_RETRY_MS = 1200;
const SNAPSHOT_BUFFER_LIMIT = 160 * 1024;
const SIGNALING_ERRORS = new Set(['network', 'server-error', 'socket-error', 'socket-closed', 'browser-incompatible', 'ssl-unavailable']);
export const clampCap = (n: number): number => Math.min(MAX_CAP, Math.max(MIN_CAP, Math.floor(n) || MAX_CAP));

export class Session {
  code = '';
  myId = 0;
  max = MAX_CAP;
  started = false;
  players: PlayerInfo[] = [];
  peer!: Peer;
  latencyMs = 0;
  reconnecting = false;
  onRoster?: (players: PlayerInfo[]) => void;
  onMessage?: (msg: Msg) => void;
  onHostMessage?: (from: number, msg: Msg) => void;
  onClosed?: (kind: NetErrorKind) => void;
  onVoiceState?: (id: number, enabled: boolean) => void;
  onLatency?: (ms: number) => void;
  onReconnect?: (reconnecting: boolean) => void;
  private conns = new Map<number, DataConnection>();
  private hostConn?: DataConnection;
  private nextId = 1;
  private closed = false;
  private voiceReady = new Set<number>();
  private heartbeat = 0;
  private pingSeq = 0;
  private myName = 'Counselor';
  private reconnectTimer = 0;
  private reconnectDeadline = 0;
  private guestDropTimers = new Map<number, number>();

  get isHost(): boolean { return this.myId === 0; }

  static async host(name: string, max = MAX_CAP): Promise<Session> {
    const s = new Session();
    s.max = clampCap(max); s.myName = name || 'Counselor';
    for (let tries = 0; tries < 8; tries++) {
      const code = generateCode();
      const peer = new Peer(peerIdFor(code), peerOptions());
      try {
        await s.waitOpen(peer);
        s.peer = peer; s.code = code;
        break;
      } catch (e) {
        peer.destroy();
        if (!(e instanceof Error) || e.message !== 'collision') throw e;
      }
    }
    if (!s.code) throw new NetError('signaling');
    s.players = [{ id: 0, name: s.myName, ready: true, peer: s.peer.id }];
    s.peer.on('connection', (c) => s.acceptGuest(c));
    s.peer.on('error', (err) => console.warn('[net] host peer error', err.type));
    return s;
  }

  static async join(rawCode: string, name: string): Promise<Session> {
    const code = normalizeCode(rawCode);
    if (!isValidCode(code)) throw new NetError('invalid');
    const s = new Session();
    s.code = code; s.myName = name || 'Counselor';
    s.peer = new Peer(peerOptions());
    try {
      await s.waitOpen(s.peer);
      await s.connectInitial(code, s.myName);
    } catch (e) {
      s.peer.destroy();
      throw e;
    }
    return s;
  }

  private waitOpen(peer: Peer): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new NetError('signaling')), CONNECT_TIMEOUT);
      peer.once('open', () => { clearTimeout(timer); resolve(); });
      peer.once('error', (err) => {
        clearTimeout(timer);
        if (err.type === 'unavailable-id') reject(new Error('collision'));
        else reject(new NetError('signaling'));
      });
    });
  }

  private connectInitial(code: string, name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = this.peer.connect(peerIdFor(code), { reliable: true, serialization: 'json' });
      let settled = false;
      const fail = (k: NetErrorKind) => { if (!settled) { settled = true; clearTimeout(timer); this.peer.off('error', onPeerError); conn.close(); reject(new NetError(k)); } };
      const timer = setTimeout(() => fail('timeout'), CONNECT_TIMEOUT);
      const onPeerError = (err: { type: string }) => {
        if (settled) return;
        if (err.type === 'peer-unavailable') fail('notfound');
        else if (SIGNALING_ERRORS.has(err.type)) fail('signaling');
      };
      this.peer.on('error', onPeerError);
      conn.on('open', () => this.safeSend(conn, { t: 'hello', name, v: PROTOCOL }));
      conn.on('error', () => { if (!settled) fail('timeout'); else if (this.hostConn === conn) this.beginReconnect(); });
      conn.on('close', () => { if (!settled) fail('timeout'); else if (this.hostConn === conn) this.beginReconnect(); });
      conn.on('data', (raw) => {
        const msg = raw as Msg;
        if (!settled && msg.t === 'welcome') {
          settled = true; clearTimeout(timer); this.peer.off('error', onPeerError);
          this.myId = msg.id; this.max = msg.max; this.hostConn = conn;
          this.startHeartbeat();
          resolve();
        } else if (!settled && msg.t === 'reject') fail(msg.reason);
        else if (settled) this.fromHost(msg);
      });
    });
  }

  private startHeartbeat(): void {
    if (this.isHost) return;
    clearInterval(this.heartbeat);
    const ping = () => {
      const conn = this.hostConn;
      if (!conn?.open || this.closed) return;
      this.safeSend(conn, { t: 'ping', n: ++this.pingSeq, sent: performance.now() });
    };
    ping();
    this.heartbeat = window.setInterval(ping, HEARTBEAT_MS);
  }

  private beginReconnect(): void {
    if (this.isHost || this.closed || this.reconnecting) return;
    clearInterval(this.heartbeat); this.heartbeat = 0;
    this.hostConn = undefined;
    this.reconnecting = true; this.reconnectDeadline = performance.now() + RECONNECT_GRACE_MS;
    this.onReconnect?.(true);
    const attempt = () => {
      if (this.closed || !this.reconnecting) return;
      if (performance.now() >= this.reconnectDeadline) { this.finishHostGone(); return; }
      if (this.peer.disconnected) {
        try { this.peer.reconnect(); } catch { /* next retry will try again */ }
      }
      let conn: DataConnection;
      try { conn = this.peer.connect(peerIdFor(this.code), { reliable: true, serialization: 'json' }); }
      catch { this.scheduleReconnect(attempt); return; }
      let answered = false;
      const failedAttempt = () => {
        if (answered || !this.reconnecting) return;
        answered = true; clearTimeout(timeout); this.scheduleReconnect(attempt);
      };
      const timeout = window.setTimeout(() => { if (!answered) { conn.close(); failedAttempt(); } }, 2600);
      conn.on('open', () => this.safeSend(conn, { t: 'hello', name: this.myName, v: PROTOCOL, resume: this.myId }));
      conn.on('data', (raw) => {
        const msg = raw as Msg;
        if (answered) { if (this.hostConn === conn) this.fromHost(msg); return; }
        if (msg.t === 'welcome' && msg.id === this.myId) {
          answered = true; clearTimeout(timeout); clearTimeout(this.reconnectTimer); this.reconnectTimer = 0;
          this.hostConn = conn; this.max = msg.max; this.reconnecting = false; this.onReconnect?.(false);
          this.startHeartbeat();
          this.setVoiceReady(this.voiceReady.has(this.myId));
        } else if (msg.t === 'reject') {
          answered = true; clearTimeout(timeout); conn.close(); this.scheduleReconnect(attempt);
        }
      });
      conn.on('error', () => { if (!answered) failedAttempt(); else if (this.hostConn === conn) this.beginReconnect(); });
      conn.on('close', () => { if (!answered) failedAttempt(); else if (this.hostConn === conn) this.beginReconnect(); });
    };
    attempt();
  }

  private scheduleReconnect(fn: () => void): void {
    if (this.closed || !this.reconnecting || this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => { this.reconnectTimer = 0; fn(); }, RECONNECT_RETRY_MS);
  }

  private fromHost(msg: Msg): void {
    if (msg.t === 'roster') {
      this.players = msg.players; this.max = msg.max; this.onRoster?.(this.players);
    } else if (msg.t === 'voice' && typeof msg.id === 'number') {
      if (msg.enabled) this.voiceReady.add(msg.id); else this.voiceReady.delete(msg.id);
      this.onVoiceState?.(msg.id, msg.enabled);
    } else if (msg.t === 'pong') {
      this.latencyMs = Math.max(0, performance.now() - msg.sent);
      this.onLatency?.(this.latencyMs);
    } else if (msg.t === 'bye') this.finishHostGone();
    else {
      if (msg.t === 'start') this.started = true;
      this.onMessage?.(msg);
    }
  }

  private finishHostGone(): void {
    if (this.closed) return;
    this.reconnecting = false; this.onReconnect?.(false);
    clearInterval(this.heartbeat); this.heartbeat = 0;
    clearTimeout(this.reconnectTimer); this.reconnectTimer = 0;
    this.closed = true;
    this.onClosed?.('host-left');
  }

  private acceptGuest(conn: DataConnection): void {
    let id = -1;
    conn.on('data', (raw) => {
      const msg = raw as Msg;
      if (id < 0) {
        if (msg.t !== 'hello') return;
        const resumePlayer = typeof msg.resume === 'number' ? this.players.find((p) => p.id === msg.resume && p.peer === conn.peer) : undefined;
        const reason = msg.v !== PROTOCOL ? 'version' : resumePlayer ? null : this.started ? 'started' : this.players.length >= this.max ? 'full' : null;
        if (reason) { this.safeSend(conn, { t: 'reject', reason }); setTimeout(() => conn.close(), 400); return; }
        if (resumePlayer) {
          id = resumePlayer.id;
          const oldTimer = this.guestDropTimers.get(id); if (oldTimer) clearTimeout(oldTimer); this.guestDropTimers.delete(id);
          const previous = this.conns.get(id); if (previous && previous !== conn) previous.close();
          this.conns.set(id, conn);
          this.safeSend(conn, { t: 'welcome', id, max: this.max });
          this.pushRoster();
          for (const voiceId of this.voiceReady) this.safeSend(conn, { t: 'voice', id: voiceId, enabled: true });
          return;
        }
        id = this.nextId++;
        const base = (msg.name || 'Camper').slice(0, 14);
        const name = this.players.some((p) => p.name === base) ? `${base}${id}` : base;
        this.conns.set(id, conn);
        this.players.push({ id, name, ready: false, peer: conn.peer });
        this.safeSend(conn, { t: 'welcome', id, max: this.max });
        this.pushRoster();
        for (const voiceId of this.voiceReady) this.safeSend(conn, { t: 'voice', id: voiceId, enabled: true });
      } else if (msg.t === 'bye') drop(true);
      else if (msg.t === 'ready') {
        const p = this.players.find((x) => x.id === id);
        if (p) { p.ready = msg.ready; this.pushRoster(); }
      } else if (msg.t === 'voice') {
        if (msg.enabled) this.voiceReady.add(id); else this.voiceReady.delete(id);
        this.sendAll({ t: 'voice', id, enabled: msg.enabled });
        this.onVoiceState?.(id, msg.enabled);
      } else if (msg.t === 'ping') {
        this.safeSend(conn, { t: 'pong', n: msg.n, sent: msg.sent });
      } else this.onHostMessage?.(id, msg);
    });
    const drop = (explicit = false) => {
      if (id < 0 || this.conns.get(id) !== conn) return;
      this.conns.delete(id);
      if (explicit || this.closed) { this.finalizeGuestDrop(id); return; }
      const existing = this.guestDropTimers.get(id); if (existing) clearTimeout(existing);
      const timer = window.setTimeout(() => { this.guestDropTimers.delete(id); if (!this.conns.has(id)) this.finalizeGuestDrop(id); }, RECONNECT_GRACE_MS);
      this.guestDropTimers.set(id, timer);
    };
    conn.on('close', () => drop(false));
    conn.on('error', () => drop(false));
  }

  private finalizeGuestDrop(id: number): void {
    this.conns.delete(id);
    const oldTimer = this.guestDropTimers.get(id); if (oldTimer) clearTimeout(oldTimer); this.guestDropTimers.delete(id);
    this.players = this.players.filter((p) => p.id !== id);
    if (this.voiceReady.delete(id)) {
      this.sendAll({ t: 'voice', id, enabled: false });
      this.onVoiceState?.(id, false);
    }
    this.onHostMessage?.(id, { t: 'bye' });
    this.pushRoster();
  }

  private pushRoster(): void {
    this.onRoster?.(this.players);
    this.sendAll({ t: 'roster', players: this.players, max: this.max });
  }

  private safeSend(conn: DataConnection, msg: Msg): void {
    if (!conn.open) return;
    if (msg.t === 's') {
      const dc = (conn as unknown as { dataChannel?: { bufferedAmount?: number } }).dataChannel;
      if ((dc?.bufferedAmount ?? 0) > SNAPSHOT_BUFFER_LIMIT) return;
    }
    try { conn.send(msg); } catch (e) { console.warn('[net] send failed', e); }
  }

  private sendAll(msg: Msg): void {
    for (const c of this.conns.values()) this.safeSend(c, msg);
  }

  broadcast(msg: Msg): void {
    this.sendAll(msg);
    this.onMessage?.(msg);
  }

  sendToHost(msg: Msg): void {
    if (this.isHost) this.onHostMessage?.(0, msg);
    else if (this.hostConn?.open) this.safeSend(this.hostConn, msg);
  }

  setReady(ready: boolean): void {
    if (this.isHost) return;
    this.sendToHost({ t: 'ready', ready });
  }

  setVoiceReady(enabled: boolean): void {
    if (enabled) this.voiceReady.add(this.myId); else this.voiceReady.delete(this.myId);
    this.onVoiceState?.(this.myId, enabled);
    if (this.isHost) this.sendAll({ t: 'voice', id: this.myId, enabled });
    else this.sendToHost({ t: 'voice', enabled });
  }

  isVoiceReady(id: number): boolean { return this.voiceReady.has(id); }
  get everyoneReady(): boolean { return this.players.every((p) => p.ready); }

  /** Browser smoke hook: close only the guest's host transport so the real reconnect path runs. */
  disconnectTransportForTest(): void { if (!this.isHost) this.hostConn?.close(); }

  leave(): void {
    if (this.closed) return;
    this.closed = true; this.reconnecting = false;
    clearInterval(this.heartbeat); this.heartbeat = 0;
    clearTimeout(this.reconnectTimer); this.reconnectTimer = 0;
    for (const timer of this.guestDropTimers.values()) clearTimeout(timer); this.guestDropTimers.clear();
    if (this.isHost) this.sendAll({ t: 'bye' });
    else this.sendToHost({ t: 'bye' });
    setTimeout(() => this.peer?.destroy(), 150);
  }
}

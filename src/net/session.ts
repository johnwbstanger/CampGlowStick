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
const SIGNALING_ERRORS = new Set(['network', 'server-error', 'socket-error', 'socket-closed', 'browser-incompatible', 'ssl-unavailable']);
export const clampCap = (n: number): number => Math.min(MAX_CAP, Math.max(MIN_CAP, Math.floor(n) || MAX_CAP));

export class Session {
  code = '';
  myId = 0;
  max = MAX_CAP;
  started = false;
  players: PlayerInfo[] = [];
  peer!: Peer;
  onRoster?: (players: PlayerInfo[]) => void;
  /** Messages from the host (host loops its own broadcasts back here). */
  onMessage?: (msg: Msg) => void;
  /** Host only: messages from guests, and the host's own sendToHost calls. */
  onHostMessage?: (from: number, msg: Msg) => void;
  onClosed?: (kind: NetErrorKind) => void;
  private conns = new Map<number, DataConnection>();
  private hostConn?: DataConnection;
  private nextId = 1;
  private closed = false;

  get isHost(): boolean { return this.myId === 0; }

  static async host(name: string, max = MAX_CAP): Promise<Session> {
    const s = new Session();
    s.max = clampCap(max);
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
    s.players = [{ id: 0, name: name || 'Counselor', ready: true, peer: s.peer.id }];
    s.peer.on('connection', (c) => s.acceptGuest(c));
    s.peer.on('error', (err) => console.warn('[net] host peer error', err.type));
    return s;
  }

  static async join(rawCode: string, name: string): Promise<Session> {
    const code = normalizeCode(rawCode);
    if (!isValidCode(code)) throw new NetError('invalid');
    const s = new Session();
    s.code = code;
    s.peer = new Peer(peerOptions());
    try {
      await s.waitOpen(s.peer);
      await s.connect(code, name);
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

  private connect(code: string, name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = this.peer.connect(peerIdFor(code), { reliable: true, serialization: 'json' });
      let settled = false;
      const fail = (k: NetErrorKind) => { if (!settled) { settled = true; clearTimeout(timer); conn.close(); reject(new NetError(k)); } };
      const timer = setTimeout(() => fail('timeout'), CONNECT_TIMEOUT);
      this.peer.on('error', (err) => {
        if (settled) return;
        if (err.type === 'peer-unavailable') fail('notfound');
        else if (SIGNALING_ERRORS.has(err.type)) fail('signaling');
      });
      conn.on('open', () => conn.send({ t: 'hello', name, v: PROTOCOL } satisfies Msg));
      conn.on('error', () => fail('timeout'));
      conn.on('close', () => { if (!settled) fail('timeout'); else this.hostGone(); });
      conn.on('data', (raw) => {
        const msg = raw as Msg;
        if (!settled && msg.t === 'welcome') {
          settled = true; clearTimeout(timer);
          this.myId = msg.id; this.max = msg.max; this.hostConn = conn;
          resolve();
        } else if (!settled && msg.t === 'reject') fail(msg.reason);
        else if (settled) this.fromHost(msg);
      });
    });
  }

  private fromHost(msg: Msg): void {
    if (msg.t === 'roster') { this.players = msg.players; this.max = msg.max; this.onRoster?.(this.players); }
    else if (msg.t === 'bye') this.hostGone();
    else { if (msg.t === 'start') this.started = true; this.onMessage?.(msg); }
  }

  private hostGone(): void {
    if (this.closed) return;
    this.closed = true;
    this.onClosed?.('host-left');
  }

  private acceptGuest(conn: DataConnection): void {
    let id = -1;
    conn.on('data', (raw) => {
      const msg = raw as Msg;
      if (id < 0) {
        if (msg.t !== 'hello') return;
        const reason = msg.v !== PROTOCOL ? 'version' : this.started ? 'started' : this.players.length >= this.max ? 'full' : null;
        if (reason) { conn.send({ t: 'reject', reason } satisfies Msg); setTimeout(() => conn.close(), 400); return; }
        id = this.nextId++;
        const base = (msg.name || 'Camper').slice(0, 14);
        const name = this.players.some((p) => p.name === base) ? `${base}${id}` : base;
        this.conns.set(id, conn);
        this.players.push({ id, name, ready: false, peer: conn.peer });
        conn.send({ t: 'welcome', id, max: this.max } satisfies Msg);
        this.pushRoster();
      } else if (msg.t === 'bye') drop();
      else if (msg.t === 'ready') {
        const p = this.players.find((x) => x.id === id);
        if (p) { p.ready = msg.ready; this.pushRoster(); }
      } else this.onHostMessage?.(id, msg);
    });
    const drop = () => {
      if (id < 0 || !this.conns.delete(id)) return;
      this.players = this.players.filter((p) => p.id !== id);
      this.onHostMessage?.(id, { t: 'bye' });
      this.pushRoster();
    };
    conn.on('close', drop);
    conn.on('error', drop);
  }

  private pushRoster(): void {
    this.onRoster?.(this.players);
    this.sendAll({ t: 'roster', players: this.players, max: this.max });
  }

  private sendAll(msg: Msg): void {
    for (const c of this.conns.values()) if (c.open) c.send(msg);
  }

  /** Host: send to every guest and loop back to the host's own onMessage. */
  broadcast(msg: Msg): void {
    this.sendAll(msg);
    this.onMessage?.(msg);
  }

  sendToHost(msg: Msg): void {
    if (this.isHost) this.onHostMessage?.(0, msg);
    else if (this.hostConn?.open) this.hostConn.send(msg);
  }

  setReady(ready: boolean): void {
    if (this.isHost) return;
    this.sendToHost({ t: 'ready', ready });
  }

  get everyoneReady(): boolean { return this.players.every((p) => p.ready); }

  leave(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.isHost) this.sendAll({ t: 'bye' });
    else this.sendToHost({ t: 'bye' });
    setTimeout(() => this.peer?.destroy(), 150);
  }
}

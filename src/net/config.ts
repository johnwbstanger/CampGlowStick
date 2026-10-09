import type { PeerJSOption } from 'peerjs';

declare global { interface Window { __CG_PEER__?: { host?: string; port?: number; path?: string; secure?: boolean; debug?: 0 | 1 | 2 | 3 } } }

const env = import.meta.env as Record<string, string | undefined>;

export function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:global.stun.twilio.com:3478'] }];
  if (env.VITE_TURN_URL) servers.push({ urls: env.VITE_TURN_URL, username: env.VITE_TURN_USER, credential: env.VITE_TURN_PASS });
  return servers;
}

/** Public PeerJS cloud by default; VITE_PEER_* env vars or window.__CG_PEER__ (used by the smoke test) point at another server. */
export function peerOptions(): PeerJSOption {
  const w = window.__CG_PEER__ ?? {};
  const host = w.host ?? env.VITE_PEER_HOST;
  const opts: PeerJSOption = { debug: w.debug ?? 0, config: { iceServers: iceServers() } };
  if (host) {
    opts.host = host;
    opts.port = w.port ?? Number(env.VITE_PEER_PORT ?? 9000);
    opts.path = w.path ?? env.VITE_PEER_PATH ?? '/';
    opts.secure = w.secure ?? env.VITE_PEER_SECURE === 'true';
  }
  return opts;
}

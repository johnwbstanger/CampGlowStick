import type { Session } from '../net/session';
import { h } from './dom';

export interface LobbyHandlers { onStart: () => void; onLeave: () => void; onVoice?: (on: boolean) => void }

export function showLobby(root: HTMLElement, s: Session, hd: LobbyHandlers): void {
  const url = `${location.origin}${location.pathname}?join=${s.code}`;
  const list = h('ul', { cls: 'players', id: 'player-list' });
  const count = h('span', { id: 'lobby-count' });
  const diag = h('p', { cls: 'sub', id: 'lobby-diagnostics' });
  const copy = h('button', { id: 'btn-copy', cls: 'ghost small', onclick: async () => {
    try { await navigator.clipboard.writeText(url); copy.textContent = 'Copied!'; } catch { copy.textContent = 'Copy failed'; }
    setTimeout(() => { copy.textContent = 'Copy link'; }, 1500);
  } }, 'Copy link');
  const start = h('button', { id: 'btn-start', onclick: hd.onStart }, 'Start game');
  let ready = false;
  const readyBtn = h('button', { id: 'btn-ready', onclick: () => { ready = !ready; s.setReady(ready); readyBtn.textContent = ready ? 'Not ready' : "I'm ready"; } }, "I'm ready");
  const voice = h('input', { id: 'voice-toggle', type: 'checkbox', onchange: (e) => hd.onVoice?.((e.target as HTMLInputElement).checked) });
  const hint = h('p', { cls: 'sub', id: 'lobby-hint' });
  const drawDiagnostics = () => {
    const readyVoice = s.players.filter((p) => s.isVoiceReady(p.id)).length;
    const link = s.isHost ? 'HOST' : `${Math.round(s.latencyMs)} ms RTT`;
    diag.textContent = `Connection: ${link} · Voice ready: ${readyVoice}/${s.players.length}`;
  };
  const draw = () => {
    list.replaceChildren(...s.players.map((p) => h('li', {}, h('span', {}, p.name + (p.id === 0 ? ' (host)' : p.id === s.myId ? ' (you)' : '')),
      h('span', { cls: p.ready ? 'ready' : 'notready' }, p.ready ? 'READY' : 'waiting'))));
    count.textContent = `${s.players.length}/${s.max} campers`;
    start.disabled = !s.everyoneReady;
    hint.textContent = s.isHost ? (s.everyoneReady ? 'Everyone is ready. Hit start when you are.' : 'Waiting for campers to ready up...') : 'Waiting for the host to start...';
    drawDiagnostics();
  };
  s.onRoster = draw;
  s.onLatency = drawDiagnostics;
  const oldVoiceState = s.onVoiceState;
  s.onVoiceState = (id, enabled) => { oldVoiceState?.(id, enabled); drawDiagnostics(); };
  draw();
  root.replaceChildren(h('div', { cls: 'screen', id: 'lobby' }, h('div', { cls: 'card' },
    h('h2', {}, 'Cabin 6 · Share this code'),
    h('div', { cls: 'code', id: 'lobby-code' }, s.code),
    h('div', { cls: 'share', id: 'share-url' }, url),
    h('div', { cls: 'row' }, copy),
    h('h2', {}, count), list, hint, diag,
    h('label', {}, voice, ' Proximity voice (asks for your mic when switched on)'),
    h('div', { cls: 'row' }, s.isHost ? start : readyBtn, h('button', { id: 'btn-leave', cls: 'ghost', onclick: hd.onLeave }, 'Leave')))));
}

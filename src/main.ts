import './ui/style.css';
import { click } from './audio/synth';
import { Voice } from './audio/voice';
import type { Game } from './game/game';
import { normalizeCode } from './net/codes';
import type { Msg } from './net/protocol';
import { NetError, Session, clampCap, type NetErrorKind } from './net/session';
import { showLoading } from './ui/loading';
import { showLobby } from './ui/lobby';
import { showMenu } from './ui/menu';

const root = document.getElementById('app')!;
const params = new URLSearchParams(location.search);
let session: Session | null = null;
let game: Game | null = null;

addEventListener('pagehide', () => session?.leave());

function toMenu(error?: NetErrorKind | string): void {
  game?.dispose(); game = null;
  session?.leave(); session = null;
  const ui = showMenu(root, {
    onHost: async (name, cap) => {
      ui.busy(true); ui.setError('');
      try { enterLobby(await Session.host(name, clampCap(cap))); } catch (e) { ui.busy(false); ui.setError(e instanceof NetError ? e.kind : 'signaling'); }
    },
    onJoin: async (name, code) => {
      ui.busy(true); ui.setError('');
      try { enterLobby(await Session.join(code, name)); } catch (e) { ui.busy(false); ui.setError(e instanceof NetError ? e.kind : 'signaling'); }
    },
  }, { code: normalizeCode(params.get('join') ?? ''), error });
}

function enterLobby(s: Session): void {
  session = s;
  click();
  let voice: Voice | null = null;
  s.onClosed = (kind) => toMenu(kind);
  const buffered: Msg[] = [];
  let starting = false;
  s.onMessage = (msg) => {
    if (msg.t !== 'start') return;
    if (starting) return;
    starting = true;
    s.onMessage = (m) => { if (game) game.handle(m); else buffered.push(m); };
    void launch(msg, voice);
  };
  const launch = async (msg: Extract<Msg, { t: 'start' }>, v: Voice | null): Promise<void> => {
    const ui = showLoading(root);
    const [{ Game }] = await Promise.all([import('./game/game'), new Promise((r) => setTimeout(r, 900))]);
    try {
      const g = await Game.create(root, s, msg, ui.progress);
      if (v) g.voice = v;
      game = g;
      s.onRoster = (players) => { for (const id of [...g.remotes.keys()]) if (!players.some((p) => p.id === id)) g.removeRemote(id); };
      for (const m of buffered.splice(0)) g.handle(m);
    } catch (e) {
      console.error('failed to start game', e);
      toMenu('Could not start the game: ' + (e instanceof Error ? e.message : String(e)));
    }
  };
  showLobby(root, s, {
    onStart: () => {
      if (!s.isHost || !s.everyoneReady) return;
      const seed = Math.floor(Math.random() * 1e9);
      s.started = true;
      s.broadcast({ t: 'start', seed, need: 3 });
    },
    onLeave: () => toMenu(),
    onVoice: async (on) => {
      if (!on) { voice?.disable(); return; }
      voice ??= new Voice(s);
      const ok = await voice.enable();
      const box = document.getElementById('voice-toggle') as HTMLInputElement | null;
      if (!ok && box) { box.checked = false; box.title = 'Microphone unavailable'; }
    },
  });
}

toMenu();

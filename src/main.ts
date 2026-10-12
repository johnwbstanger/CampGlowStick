import './ui/style.css';
import './ui/touchProfessional.css';
import './game/camperPresentationFix';
import { click } from './audio/synth';
import { Voice } from './audio/voice';
import type { Game } from './game/game';
import { normalizeCode } from './net/codes';
import type { Msg } from './net/protocol';
import { NetError, Session, clampCap, type NetErrorKind } from './net/session';
import { showArrivalBriefing } from './ui/arrival';
import { showLoading } from './ui/loading';
import { showLobby } from './ui/lobby';
import { showMenu } from './ui/menu';

const root = document.getElementById('app')!;
const params = new URLSearchParams(location.search);
let session: Session | null = null;
let game: Game | null = null;

declare global { interface Window { __cgSession?: Session } }

addEventListener('pagehide', () => session?.leave());

function toMenu(error?: NetErrorKind | string): void {
  game?.dispose(); game = null;
  session?.leave(); session = null;
  delete window.__cgSession;
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
  window.__cgSession = s;
  const ui = showLobby(root, s, {
    onLeave: () => toMenu(),
    onStart: () => s.start(),
    onVoice: async (on) => {
      if (!on) { await s.voice?.disable(); ui.render(); return; }
      if (!s.voice) s.voice = new Voice(s);
      await s.voice.enable(); ui.render();
    },
  });
  s.onLobbyChange = () => ui.render();
  s.onNetError = (kind) => { if (kind === 'host-left' || kind === 'disconnected') toMenu(kind); else ui.setError(kind); };
  s.onStart = (start) => startGame(start);
  ui.render();
}

async function startGame(start: Extract<Msg, { t: 'start' }>): Promise<void> {
  if (!session) return;
  showArrivalBriefing(root, () => void loadGame(start));
}

async function loadGame(start: Extract<Msg, { t: 'start' }>): Promise<void> {
  if (!session) return;
  const loading = showLoading(root);
  try {
    const { Game } = await import('./game/game');
    game?.dispose();
    game = await Game.create(root, session, start, loading.progress, (next) => void startGame(next));
    game.voice = session.voice;
    session.onHostMessage = (from, msg) => game?.sim?.handle(from, msg);
    session.onMessage = (msg) => game?.handle(msg);
    session.onPlayerLeft = (id) => game?.removeRemote(id);
  } catch (e) {
    console.error(e);
    toMenu('loading');
  }
}

document.addEventListener('pointerdown', () => click(), { once: true });
toMenu();

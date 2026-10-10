import { h } from './dom';

/** Narrative beat between the lobby and the 3D load. It is intentionally DOM-only and tiny so it
 * appears instantly even on an iPad before any Three.js/FBX assets are downloaded. */
export function showArrivalBriefing(root: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const style = h('style', {}, `
      .gary-screen{position:fixed;inset:0;display:grid;place-items:center;background:#1c2721;padding:clamp(8px,2vh,22px);color:#2e2419;font-family:Georgia,serif;z-index:50;overflow:auto;overscroll-behavior:contain}
      .gary-board{width:min(850px,94vw);max-height:94vh;box-sizing:border-box;padding:clamp(16px,3vw,34px);background:#a97648;background-image:radial-gradient(#7b5636 1px,transparent 1px);background-size:11px 11px;border:clamp(8px,2vw,18px) solid #503823;box-shadow:0 24px 80px #0009;transform:rotate(-.25deg);display:grid;grid-template-columns:minmax(150px,220px) 1fr;gap:clamp(12px,2.6vw,25px);align-items:start;overflow:auto;-webkit-overflow-scrolling:touch}
      .gary-photo{position:relative;background:#eee2bf;padding:10px 10px 27px;box-shadow:2px 5px 12px #39261788;transform:rotate(-2.2deg)}
      .gary-face{height:220px;background:linear-gradient(#df9a69 0 25%,#d1c2a4 25% 100%);display:grid;place-items:center;font:900 82px/1 system-ui;color:#374239;letter-spacing:-8px}
      .gary-caption{text-align:center;margin-top:10px;font:bold 14px/1.2 'Courier New',monospace;color:#4a3527;white-space:pre-line}
      .gary-note{position:relative;background:#fff5d6;padding:28px 31px 26px;box-shadow:3px 6px 12px #39261788;transform:rotate(.8deg);font-size:clamp(15px,2.1vw,20px);line-height:1.46}
      .gary-note:before,.gary-photo:before{content:'';position:absolute;width:14px;height:14px;border-radius:50%;background:#b6322d;box-shadow:1px 2px 3px #0007;top:9px;left:50%}
      .gary-note h1{font:900 clamp(21px,3vw,34px)/1 'Courier New',monospace;margin:0 0 18px;color:#6b251e;text-transform:uppercase}
      .gary-sign{font-weight:bold;text-align:right;margin:18px 0 0}
      .gary-go{grid-column:1/-1;position:sticky;bottom:4px;justify-self:center;border:3px solid #f0c36c;background:#20392c;color:#fff4d3;font:bold 17px 'Courier New',monospace;padding:13px 25px;box-shadow:4px 4px 0 #472e21;cursor:pointer;z-index:3}
      .gary-go:active{transform:translate(3px,3px);box-shadow:1px 1px 0 #472e21}
      @media(max-width:650px){.gary-board{grid-template-columns:110px 1fr}.gary-face{height:125px;font-size:48px}.gary-photo{padding:7px 7px 20px}.gary-note{padding:18px;font-size:14px}.gary-note h1{font-size:19px}.gary-go{padding:10px 16px;font-size:14px}}
      @media(max-height:420px){.gary-screen{place-items:stretch center}.gary-board{grid-template-columns:88px 1fr;gap:10px;max-height:calc(100vh - 12px);padding:10px;border-width:7px}.gary-face{height:80px;font-size:34px}.gary-photo{padding:5px 5px 14px}.gary-caption{font-size:9px}.gary-note{padding:11px 14px;font-size:11px;line-height:1.25}.gary-note h1{font-size:14px;margin-bottom:8px}.gary-note p{margin:6px 0}.gary-go{padding:7px 11px;font-size:11px}}
    `);
    const photo = h('div', { cls: 'gary-photo' },
      h('div', { cls: 'gary-face', 'aria-label': 'Camp Director Gary employee photo' }, 'G'),
      h('div', { cls: 'gary-caption' }, 'GARY — CAMP DIRECTOR\n“probably an animal”'));
    const note = h('div', { cls: 'gary-note' },
      h('h1', {}, 'Counselors — before you head in'),
      h('p', {}, 'We’ve had several complaints about something scratching at the tents after lights-out. I’m heading out to check the perimeter.'),
      h('p', {}, 'Keep the campers together. Get everybody back to the bus before it gets properly dark. If you hear something in the woods, do not split up to “see what it was.”'),
      h('p', {}, 'If things go truly awry, there is an emergency gun under my desk in the Director’s Office. That is not permission to play with it.'),
      h('p', {}, 'And somebody please put the canoe paddles back by the waterfront this time.'),
      h('p', { cls: 'gary-sign' }, '— Gary'));
    const screen = h('div', { cls: 'gary-screen', id: 'arrival-briefing' }, style,
      h('div', { cls: 'gary-board' }, photo, note,
        h('button', { cls: 'gary-go', id: 'btn-arrive' }, 'GET OFF THE BUS →')));
    root.replaceChildren(screen);
    const button = screen.querySelector<HTMLButtonElement>('#btn-arrive')!;
    let done = false;
    const finish = () => { if (done) return; done = true; clearTimeout(auto); resolve(); };
    button.addEventListener('click', finish, { once: true });
    // Keeps automated multiplayer tests and unattended clients from deadlocking at the narrative card.
    const auto = window.setTimeout(finish, 4200);
  });
}

// End-to-end smoke test: headless Chromium, several browser contexts, real PeerJS signaling.
// Env: SMOKE_LOCAL_PEER=1 forces a local `peer` server; PEER_HOST/PEER_PORT/PEER_PATH/PEER_SECURE use an external one;
//      otherwise the public PeerJS cloud is probed and a local server is started if it is unreachable.
//      PW_CHROMIUM=/path/to/chromium overrides the browser binary.
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { build, preview } from 'vite';
import { PeerServer } from 'peer';

const results = [];
const consoleErrors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function check(name, fn) {
  const t = Date.now();
  try { const info = await fn(); results.push({ name, ok: true, info }); console.log(`PASS  ${name}${info ? ` (${info})` : ''} [${Date.now() - t}ms]`); }
  catch (e) { results.push({ name, ok: false, info: e.message }); console.log(`FAIL  ${name}: ${e.message}`); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };

// ---- signaling server -------------------------------------------------------
let peerCfg = null; // null = public PeerJS cloud
let localServer = null;
async function reachable(url) { try { const r = await fetch(url, { signal: AbortSignal.timeout(4000) }); return r.ok; } catch { return false; } }
if (process.env.PEER_HOST) {
  peerCfg = { host: process.env.PEER_HOST, port: Number(process.env.PEER_PORT ?? 9000), path: process.env.PEER_PATH ?? '/', secure: process.env.PEER_SECURE === 'true' };
} else if (process.env.SMOKE_LOCAL_PEER === '1' || !(await reachable('https://0.peerjs.com/peerjs'))) {
  const port = Number(process.env.PEER_PORT ?? 9000);
  localServer = PeerServer({ port, path: '/', host: '127.0.0.1', allow_discovery: false });
  peerCfg = { host: '127.0.0.1', port, path: '/', secure: false };
}
console.log('signaling:', peerCfg ? `${peerCfg.host}:${peerCfg.port}${localServer ? ' (local peer server)' : ''}` : 'public PeerJS cloud');

// ---- app + browser ----------------------------------------------------------
const outDir = 'dist-smoke';
await build({ logLevel: 'warn', base: '/', build: { outDir, emptyOutDir: true } });
const server = await preview({ logLevel: 'warn', base: '/', build: { outDir }, preview: { port: 4173, host: '127.0.0.1', strictPort: true } });
const URL = 'http://127.0.0.1:4173/';
const exe = [process.env.PW_CHROMIUM, chromium.executablePath(), '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find((p) => p && existsSync(p));
const browser = await chromium.launch({
  executablePath: exe, headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', // permission grant makes chromium expose host ICE candidates (needed in sandboxes without STUN)
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
});

const contexts = [];
async function newPage(label, query = '') {
  const ctx = await browser.newContext({ viewport: { width: 480, height: 270 }, deviceScaleFactor: 1, permissions: ['microphone'] });
  if (peerCfg) await ctx.addInitScript((c) => { window.__CG_PEER__ = c; }, peerCfg);
  const page = await ctx.newPage();
  page.label = label;
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`[${label}] ${m.text()}`); if (m.type() === 'warning' && m.text().includes('[assets]')) consoleErrors.push(`[${label}] ${m.text()}`); });
  page.on('pageerror', (e) => consoleErrors.push(`[${label}] pageerror: ${e.message}`));
  await page.goto(URL + query);
  contexts.push(ctx);
  return page;
}
const errorText = (p) => p.locator('#error').innerText();
async function host(label, cap) {
  const p = await newPage(label);
  await p.fill('#name', label);
  if (cap) await p.selectOption('#cap', String(cap));
  await p.click('#btn-host');
  await p.waitForSelector('#lobby-code', { timeout: 20000 });
  return { page: p, code: (await p.innerText('#lobby-code')).trim() };
}
async function join(label, code, viaUrl = false) {
  const p = await newPage(label, viaUrl ? `?join=${code}` : '');
  await p.fill('#name', label);
  if (viaUrl) assert((await p.inputValue('#join-code')) === code, '?join= should prefill the code');
  else await p.fill('#join-code', code);
  await p.click('#btn-join');
  await p.waitForSelector('#lobby-code', { timeout: 20000 });
  return p;
}
const players = (p) => p.locator('#player-list li').count();
async function waitPlayers(p, n) { await p.waitForFunction((n) => document.querySelectorAll('#player-list li').length === n, n, { timeout: 25000 }); }
async function tryJoin(label, code) {
  const p = await newPage(label);
  await p.fill('#name', label); await p.fill('#join-code', code); await p.click('#btn-join');
  await p.waitForFunction(() => document.querySelector('#error') && !document.querySelector('#error').classList.contains('hidden'), null, { timeout: 25000 });
  return errorText(p);
}
const cg = (p, fn, arg) => p.evaluate(fn, arg);
async function startGame(hostPage, guests) {
  for (const g of guests) await g.click('#btn-ready');
  await hostPage.waitForFunction(() => !document.querySelector('#btn-start').disabled, null, { timeout: 10000 });
  await hostPage.click('#btn-start');
  const loading = await hostPage.waitForSelector('#loading', { timeout: 5000 }).then(() => hostPage.innerText('#loading')).catch(() => '');
  for (const p of [hostPage, ...guests]) await p.waitForFunction(() => window.__cg?.ready && window.__cg.frames() > 5, null, { timeout: 90000 });
  return loading;
}

try {
  // --- lobby A: host + 2 guests (code and ?join= URL) ---
  let A, g1, g2;
  await check('host starts a camp and gets a word+number code', async () => {
    A = await host('Hosty'); assert(/^[a-z]+\d{2}$/.test(A.code), `bad code ${A.code}`);
    const url = await A.page.innerText('#share-url'); assert(url.includes(`?join=${A.code}`), 'share url');
    return A.code;
  });
  await check('guest joins by typing the code; both see each other', async () => {
    g1 = await join('Guest1', A.code); await waitPlayers(A.page, 2); await waitPlayers(g1, 2);
  });
  await check('second guest joins via ?join= URL', async () => { g2 = await join('Guest2', A.code, true); await waitPlayers(A.page, 3); await waitPlayers(g1, 3); await waitPlayers(g2, 3); });

  // --- negative cases ---
  await check('bad code shows an error (invalid format and unknown code)', async () => {
    const a = await tryJoin('Bad1', 'zzz'); assert(/does not look right/i.test(a), a);
    const b = await tryJoin('Bad2', 'nope99'); assert(/No camp found/i.test(b), b);
  });
  let B;
  await check('full lobby is rejected (cap 4)', async () => {
    B = await host('FullHost', 4); B.guests = [];
    for (let i = 1; i <= 3; i++) B.guests.push(await join(`B${i}`, B.code));
    await waitPlayers(B.page, 4);
    const e = await tryJoin('B5', B.code); assert(/full/i.test(e), e);
  });
  await check('guest disconnect (page closed) updates the host player list', async () => {
    const C = await host('HostC'); const c1 = await join('C1', C.code); const c2 = await join('C2', C.code);
    await waitPlayers(C.page, 3);
    await c2.close({ runBeforeUnload: true }); await C.page.waitForFunction(() => document.querySelectorAll('#player-list li').length === 2, null, { timeout: 30000 });
    await C.page.click('#btn-leave');
    await c1.waitForFunction(() => document.querySelector('#error') && /host left/i.test(document.querySelector('#error').textContent), null, { timeout: 30000 });
    return 'host-left message shown to remaining guest';
  });

  // --- play scene on lobby A ---
  const pages = () => [A.page, g1, g2];
  await check('host presses Start: everyone sees the loading card then the play scene', async () => {
    const loading = await startGame(A.page, [g1, g2]);
    assert(/CAMP GLOWSTICK — SUMMER 1987/.test(loading), `loading card text: ${loading}`);
    assert(await A.page.locator('canvas.game').count() === 1, 'canvas');
    for (const p of pages()) assert((await cg(p, () => window.__cg.missingModels())) === 0, 'placeholder models in scene');
  });
  await check('late joiner is rejected: lobby already started', async () => { const e = await tryJoin('Late', A.code); assert(/already started/i.test(e), e); });
  await check('avatars: each client sees the other two as remote players', async () => {
    for (const p of pages()) assert((await cg(p, () => window.__cg.remoteIds())).length === 2, 'remote ids');
  });
  await check('remote avatar position update arrives within ~200 ms', async () => {
    const times = [];
    for (let i = 0; i < 5; i++) {
      const x = 4 + i * 3, z = 12 - i;
      const waiting = A.page.evaluate(([x, z]) => new Promise((res) => { const iv = setInterval(() => { const r = window.__cg.remote(1); if (r && Math.abs(r.tx - x) < 0.05 && Math.abs(r.tz - z) < 0.05) { clearInterval(iv); res(Date.now()); } }, 2); }), [x, z]);
      await sleep(120);
      const t0 = await g1.evaluate(([x, z]) => { const t = Date.now(); window.__cg.teleport(x, z); return t; }, [x, z]);
      times.push((await waiting) - t0);
    }
    times.sort((a, b) => a - b);
    assert(times[2] <= 250, `median latency ${times[2]}ms (${times})`);
    await sleep(600);
    const r = await A.page.evaluate(() => window.__cg.remote(1));
    assert(Math.hypot(r.x - r.tx, r.z - r.tz) < 0.3, 'rendered avatar converged on target');
    return `latencies ms: ${times.join(', ')}`;
  });
  await check('glowstick snap + throw syncs to every client', async () => {
    await g1.evaluate(() => { window.__cg.teleport(0, 12); window.__cg.look(0); window.__cg.setGlow('pink'); });
    await sleep(200);
    await g1.evaluate(() => window.__cg.act('snap')); await sleep(300);
    await g1.evaluate(() => window.__cg.act('throw')); await sleep(1800);
    for (const p of pages()) {
      const gl = await cg(p, () => window.__cg.glows());
      const pink = gl.filter((g) => g.color === 'pink');
      assert(pink.length === 1, `expected 1 pink glowstick, got ${JSON.stringify(gl)}`);
      assert(Math.hypot(pink[0].x, pink[0].z - 12) > 3, `glowstick did not travel: ${JSON.stringify(pink[0])}`);
    }
    const a = (await cg(A.page, () => window.__cg.glows()))[0], b = (await cg(g2, () => window.__cg.glows()))[0];
    assert(Math.hypot(a.x - b.x, a.z - b.z) < 0.5, 'positions agree between clients');
  });
  await check('canvas is not blank in the play scene (day)', async () => {
    for (const p of pages()) { const s = await cg(p, () => window.__cg.sample()); assert(s.distinct > 15 && s.lit > 200, `blank-looking canvas ${JSON.stringify(s)}`); }
  });
  await check('night falls (flashlight scene stays non-blank) and the monster catches a player -> everyone loses', async () => {
    await A.page.evaluate(() => window.__cg.act('night'));
    await A.page.waitForFunction(() => window.__cg.snap()?.night === true, null, { timeout: 10000 });
    await A.page.keyboard.press('KeyF');
    const s = await cg(A.page, () => window.__cg.sample()); assert(s.distinct > 8 && s.lit > 20, `night canvas blank ${JSON.stringify(s)}`);
    for (let i = 0; i < 40; i++) {
      const m = await cg(A.page, () => window.__cg.snap().monster);
      await g2.evaluate(([x, z]) => window.__cg.teleport(x, z), [m.p[0] + 0.5, m.p[2]]);
      if ((await cg(g2, () => window.__cg.snap()?.over)) === 'lose') break;
      await sleep(150);
    }
    for (const p of pages()) await p.waitForSelector('#hud-result', { timeout: 10000 });
    assert((await cg(A.page, () => window.__cg.snap().over)) === 'lose', 'lose state');
  });

  // --- win loop on lobby B (4 players) ---
  await check('co-op win loop: carry 3 loot items to the extraction point', async () => {
    const H = B.page;
    await startGame(H, B.guests);
    for (let n = 0; n < 3; n++) {
      const loot = (await cg(H, () => window.__cg.items())).filter((i) => i.kind === 'loot').sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0];
      assert(loot, 'loot item');
      await H.evaluate(([x, z]) => window.__cg.teleport(x + 0.4, z), [loot.x, loot.z]); await sleep(250);
      await H.evaluate(() => window.__cg.act('pick'));
      await H.waitForFunction((id) => window.__cg.items().some((i) => i.id === id) , loot.id, { timeout: 3000 });
      await sleep(250);
      await H.evaluate(() => window.__cg.teleport(26, 2)); await sleep(300);
      await H.evaluate(() => window.__cg.act('drop'));
      await H.waitForFunction((k) => window.__cg.snap()?.collected >= k, n + 1, { timeout: 25000 }).catch(async (e) => { throw new Error(`${e.message.split('\n')[0]} loot=${JSON.stringify(loot)} state=${JSON.stringify(await H.evaluate(() => ({ s: window.__cg.snap(), it: window.__cg.items().filter((i) => i.kind === 'loot'), me: window.__cg.sample ? null : null })))}`); });
    }
    await H.waitForFunction(() => window.__cg.snap()?.over === 'win', null, { timeout: 8000 });
    for (const p of [H, ...B.guests]) await p.waitForSelector('#hud-result', { timeout: 10000 });
  });
  await check('no console errors or missing-asset warnings in any page', async () => { assert(consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | ')); });
} finally {
  await browser.close().catch(() => undefined);
  await new Promise((r) => server.httpServer.close(r));
  localServer?.close?.();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} smoke checks passed`);
process.exit(failed.length ? 1 : 0);

// Focused end-to-end smoke test for Camp Glowstick.
// Uses a local PeerJS signaling server in CI and validates multiplayer, voice and the core gameplay loop.
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { build, preview } from 'vite';
import { PeerServer } from 'peer';

const results = [];
const consoleErrors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const assert = (c, m) => { if (!c) throw new Error(m); };
async function check(name, fn) {
  const t = Date.now();
  try { const info = await fn(); results.push({ name, ok: true }); console.log(`PASS  ${name}${info ? ` (${info})` : ''} [${Date.now() - t}ms]`); }
  catch (e) { results.push({ name, ok: false, info: e.message }); console.log(`FAIL  ${name}: ${e.message}`); }
}

const port = Number(process.env.PEER_PORT ?? 9000);
const localPeer = PeerServer({ port, path: '/', host: '127.0.0.1', allow_discovery: false });
const peerCfg = { host: '127.0.0.1', port, path: '/', secure: false };

const outDir = 'dist-smoke';
await build({ logLevel: 'warn', base: '/', build: { outDir, emptyOutDir: true } });
const server = await preview({ logLevel: 'warn', base: '/', build: { outDir }, preview: { port: 4173, host: '127.0.0.1', strictPort: true } });
const URL = 'http://127.0.0.1:4173/';
const exe = [process.env.PW_CHROMIUM, chromium.executablePath(), '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find((p) => p && existsSync(p));
const browser = await chromium.launch({
  executablePath: exe, headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
});

const contexts = [];
async function page(label, query = '') {
  const ctx = await browser.newContext({ viewport: { width: 480, height: 270 }, deviceScaleFactor: 1, permissions: ['microphone'] });
  await ctx.addInitScript((c) => { window.__CG_PEER__ = c; }, peerCfg);
  const p = await ctx.newPage(); p.label = label;
  p.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`[${label}] ${m.text()}`); });
  p.on('pageerror', (e) => consoleErrors.push(`[${label}] pageerror: ${e.message}`));
  await p.goto(URL + query); contexts.push(ctx); return p;
}
async function host(label) {
  const p = await page(label); await p.fill('#name', label); await p.click('#btn-host');
  await p.waitForSelector('#lobby-code', { timeout: 20000 });
  return { page: p, code: (await p.innerText('#lobby-code')).trim() };
}
async function join(label, code) {
  const p = await page(label); await p.fill('#name', label); await p.fill('#join-code', code); await p.click('#btn-join');
  await p.waitForSelector('#lobby-code', { timeout: 20000 }); return p;
}
async function waitPlayers(p, n) { await p.waitForFunction((n) => document.querySelectorAll('#player-list li').length === n, n, { timeout: 25000 }); }
async function startGame(h, guests) {
  for (const g of guests) await g.click('#btn-ready');
  await h.waitForFunction(() => !document.querySelector('#btn-start').disabled, null, { timeout: 10000 });
  await h.click('#btn-start');
  for (const p of [h, ...guests]) {
    await p.waitForSelector('#arrival-briefing', { timeout: 10000 });
    const text = await p.innerText('#arrival-briefing');
    assert(text.includes('GARY') && text.includes('scratching') && text.includes('gun'), `${p.label} missing Gary briefing content`);
    await p.locator('#btn-arrive').evaluate((el) => el.click());
  }
  await Promise.all([h, ...guests].map((p) => p.waitForFunction(() => window.__cg?.ready && window.__cg.frames() > 5, null, { timeout: 90000 })));
}
const cg = (p, fn, arg) => p.evaluate(fn, arg);

try {
  let H, g1, g2;
  await check('host and two guests join one lobby', async () => {
    const x = await host('Host'); H = x.page;
    assert(/^[a-z]+\d{2}$/.test(x.code), `bad code ${x.code}`);
    g1 = await join('Guest1', x.code); g2 = await join('Guest2', x.code);
    for (const p of [H, g1, g2]) await waitPlayers(p, 3);
  });

  await check('lobby surfaces connection diagnostics', async () => {
    await g1.waitForFunction(() => /\d+ ms RTT/.test(document.querySelector('#lobby-diagnostics')?.textContent ?? ''), null, { timeout: 8000 });
    const hostDiag = await H.innerText('#lobby-diagnostics');
    const guestDiag = await g1.innerText('#lobby-diagnostics');
    assert(hostDiag.includes('Connection: HOST'), `host diagnostics missing: ${hostDiag}`);
    assert(/\d+ ms RTT/.test(guestDiag), `guest RTT missing: ${guestDiag}`);
  });

  await check('proximity voice survives different enable order', async () => {
    await H.check('#voice-toggle'); await sleep(350);
    await g1.check('#voice-toggle'); await sleep(350);
    await g2.check('#voice-toggle');
    await sleep(2400);
    for (const p of [H, g1, g2]) {
      await p.waitForFunction(() => document.querySelectorAll('audio').length >= 1, null, { timeout: 12000 });
      assert(await p.isChecked('#voice-toggle'), `${p.label} voice toggle did not stay enabled`);
      await p.waitForFunction(() => document.querySelector('#lobby-diagnostics')?.textContent?.includes('Voice ready: 3/3'), null, { timeout: 5000 });
    }
  });

  await check('Gary briefing leads all three clients into one game world', async () => {
    await startGame(H, [g1, g2]);
    for (const p of [H, g1, g2]) {
      assert(await p.locator('canvas.game').count() === 1, 'missing game canvas');
      assert((await cg(p, () => window.__cg.missingModels())) === 0, 'placeholder models in scene');
      assert(await p.locator('audio').count() >= 1, 'voice media element disappeared after game load');
    }
  });

  await check('remote movement syncs', async () => {
    await g1.evaluate(() => window.__cg.teleport(8, 10));
    await H.waitForFunction(() => { const r = window.__cg.remote(1); return r && Math.abs(r.tx - 8) < .1 && Math.abs(r.tz - 10) < .1; }, null, { timeout: 8000 });
  });

  await check('terrain, lake and seven campers render', async () => {
    const campers = await cg(H, () => window.__cg.campers());
    assert(campers.length === 7, `expected 7 campers, got ${campers.length}`);
    const s = await cg(H, () => window.__cg.sample());
    assert(s.distinct > 15 && s.lit > 150, `blank-looking world ${JSON.stringify(s)}`);
  });

  await check('camper interaction state reaches every client', async () => {
    const camper = (await cg(H, () => window.__cg.campers()))[0]; assert(camper, 'camper exists');
    await H.evaluate(([x, z]) => { window.__cg.teleport(x, z + .55); window.__cg.look(Math.PI); }, [camper.x, camper.z]);
    await sleep(500);
    await H.evaluate(() => window.__cg.act('pick'));
    await H.waitForFunction((id) => window.__cg.campers().some((c) => c.id === id && c.foundBy >= 0), camper.id, { timeout: 5000 });
    for (const p of [g1, g2]) {
      try {
        await p.waitForFunction((id) => window.__cg.campers().some((c) => c.id === id && c.foundBy >= 0), camper.id, { timeout: 20000 });
      } catch (e) {
        const state = await p.evaluate((id) => ({ camper: window.__cg.campers().find((c) => c.id === id), snap: window.__cg.snap() }), camper.id);
        throw new Error(`${p.label} never received camper ${camper.id} found state; latest=${JSON.stringify(state)}`);
      }
    }
  });

  await check('found camper stays in escort range and boards the bus', async () => {
    const camper = (await cg(H, () => window.__cg.campers()))[0];
    const before = { x: camper.x, z: camper.z };
    await H.evaluate(([x, z]) => window.__cg.teleport(x + 4, z + 2), [before.x, before.z]);
    await sleep(1800);
    let moved = (await cg(H, () => window.__cg.campers()))[0];
    assert(Math.hypot(moved.x - before.x, moved.z - before.z) > 1, 'camper did not follow rescuer');
    let local = await cg(H, () => window.__cg.local());
    assert(Math.hypot(moved.x - local.x, moved.z - local.z) <= 5.7, 'camper escaped the escort leash');
    await H.evaluate(([x, z]) => window.__cg.teleport(x + 18, z + 8), [local.x, local.z]);
    await sleep(700);
    moved = (await cg(H, () => window.__cg.campers()))[0];
    local = await cg(H, () => window.__cg.local());
    assert(Math.hypot(moved.x - local.x, moved.z - local.z) <= 5.7, 'camper did not regroup after a large correction');
    await H.evaluate(() => window.__cg.teleport(28, 2));
    await H.waitForFunction((id) => window.__cg.campers().some((c) => c.id === id && c.rescued), camper.id, { timeout: 18000 });
    moved = (await cg(H, () => window.__cg.campers()))[0];
    assert(moved.rescued, 'camper never boarded bus');
  });

  await check('charged thrown object/glowstick synchronizes', async () => {
    await g1.evaluate(() => { window.__cg.teleport(0, 12); window.__cg.look(0); window.__cg.setGlow('pink'); window.__cg.act('snap'); });
    await sleep(400); await g1.evaluate(() => window.__cg.act('throw', .8)); await sleep(1600);
    const a = (await cg(H, () => window.__cg.glows())).find((g) => g.color === 'pink');
    const b = (await cg(g2, () => window.__cg.glows())).find((g) => g.color === 'pink');
    assert(a && b, 'pink glowstick missing');
    assert(Math.hypot(a.x - b.x, a.z - b.z) < .6, 'throw position disagreement');
  });

  await check('night state and monster loss work', async () => {
    await H.evaluate(() => window.__cg.act('night'));
    await H.waitForFunction(() => window.__cg.snap()?.night === true, null, { timeout: 10000 });
    for (let i = 0; i < 50; i++) {
      const m = await cg(H, () => window.__cg.snap().monster);
      await g2.evaluate(([x, z]) => window.__cg.teleport(x + .4, z), [m.p[0], m.p[2]]);
      if ((await cg(H, () => window.__cg.snap()?.over)) === 'lose') break;
      await sleep(150);
    }
    assert((await cg(H, () => window.__cg.snap()?.over)) === 'lose', 'monster never produced lose state');
  });

  await check('no console errors', async () => { assert(consoleErrors.length === 0, consoleErrors.slice(0, 6).join(' | ')); });
} finally {
  await browser.close().catch(() => undefined);
  await new Promise((r) => server.httpServer.close(r));
  localPeer?.close?.();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} smoke checks passed`);
process.exit(failed.length ? 1 : 0);

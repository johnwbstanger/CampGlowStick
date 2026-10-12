// Capacity smoke: prove the advertised 15-player browser lobby actually accepts 15 peers and rejects #16.
// This intentionally stops before loading the 3D world so it isolates signaling/roster capacity from GPU cost.
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { preview, build } from 'vite';
import { PeerServer } from 'peer';

const port = Number(process.env.PEER_PORT ?? 9015);
const localPeer = PeerServer({ port, path: '/', host: '127.0.0.1', allow_discovery: false });
const peerCfg = { host: '127.0.0.1', port, path: '/', secure: false };
const outDir = 'dist-lobby15';
await build({ logLevel: 'warn', base: '/', build: { outDir, emptyOutDir: true } });
const server = await preview({ logLevel: 'warn', base: '/', build: { outDir }, preview: { port: 4175, host: '127.0.0.1', strictPort: true } });
const URL = 'http://127.0.0.1:4175/';
const exe = [process.env.PW_CHROMIUM, chromium.executablePath(), '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find((p) => p && existsSync(p));
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-background-timer-throttling'] });
const contexts = [];

async function page(name) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 240 }, deviceScaleFactor: 1 });
  contexts.push(ctx);
  await ctx.addInitScript((cfg) => { window.__CG_PEER__ = cfg; }, peerCfg);
  const p = await ctx.newPage();
  await p.goto(URL);
  await p.fill('#name', name);
  return p;
}

try {
  const host = await page('Host');
  // menu cap input defaults to the production maximum; set it explicitly when available.
  const cap = host.locator('input[type="number"]');
  if (await cap.count()) await cap.fill('15');
  await host.click('#btn-host');
  await host.waitForSelector('#lobby-code', { timeout: 20000 });
  const code = (await host.innerText('#lobby-code')).trim();
  if (!/^[a-z]+\d{2}$/.test(code)) throw new Error(`invalid lobby code ${code}`);

  const guests = [];
  for (let i = 1; i < 15; i++) {
    const p = await page(`G${i}`);
    await p.fill('#join-code', code);
    await p.click('#btn-join');
    await p.waitForSelector('#lobby-code', { timeout: 20000 });
    guests.push(p);
  }

  await host.waitForFunction(() => document.querySelectorAll('#player-list li').length === 15, null, { timeout: 25000 });
  for (const p of [host, ...guests]) {
    await p.waitForFunction(() => document.querySelectorAll('#player-list li').length === 15, null, { timeout: 25000 });
    const count = (await p.innerText('#lobby-count')).trim();
    if (!count.startsWith('15/15')) throw new Error(`wrong capacity display: ${count}`);
  }

  const overflow = await page('Overflow');
  await overflow.fill('#join-code', code);
  await overflow.click('#btn-join');
  await overflow.waitForFunction(() => document.body.innerText.toLowerCase().includes('full'), null, { timeout: 20000 });
  console.log('PASS  15-player lobby accepted 15 peers and rejected peer 16');
} finally {
  await Promise.all(contexts.map((c) => c.close().catch(() => undefined)));
  await browser.close().catch(() => undefined);
  await new Promise((resolve) => server.httpServer.close(resolve));
  localPeer?.close?.();
}

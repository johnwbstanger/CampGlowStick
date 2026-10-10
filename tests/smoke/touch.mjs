// iPad-style touch smoke. Chromium is not Safari, but this proves the touch-only control surface
// drives movement, jump and USE without any keyboard events or pointer lock.
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { build, preview } from 'vite';
import { PeerServer } from 'peer';

const port = Number(process.env.PEER_PORT ?? 9020);
const localPeer = PeerServer({ port, path: '/', host: '127.0.0.1', allow_discovery: false });
const peerCfg = { host: '127.0.0.1', port, path: '/', secure: false };
const outDir = 'dist-touch';
await build({ logLevel: 'warn', base: '/', build: { outDir, emptyOutDir: true } });
const server = await preview({ logLevel: 'warn', base: '/', build: { outDir }, preview: { port: 4176, host: '127.0.0.1', strictPort: true } });
const exe = [process.env.PW_CHROMIUM, chromium.executablePath(), '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find((p) => p && existsSync(p));
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({
  viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1,
  hasTouch: true, isMobile: true,
  userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
});
await ctx.addInitScript((cfg) => { window.__CG_PEER__ = cfg; }, peerCfg);
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const waitGame = () => p.waitForFunction(() => window.__cg?.ready && window.__cg.frames() > 5, null, { timeout: 90000 });

try {
  await p.goto('http://127.0.0.1:4176/');
  await p.fill('#name', 'TouchCounselor');
  await p.click('#btn-host');
  await p.waitForSelector('#btn-start');
  await p.click('#btn-start');
  const arrive = p.locator('#btn-arrive');
  if (await arrive.count()) await arrive.evaluate((el) => el.click());
  await waitGame();

  const controls = p.locator('.touch-controls');
  if (!(await controls.isVisible())) throw new Error('touch controls are not visible for iPad-style context');
  for (const sel of ['.touch-move', '.touch-use', '.touch-jump', '.touch-sprint', '.touch-crouch', '.touch-flash', '.touch-glow', '.touch-map', '.touch-drop']) {
    if (!(await p.locator(sel).isVisible())) throw new Error(`missing touch control ${sel}`);
  }

  // Jump must work through the actual touch button. It previously existed visually without always
  // reaching player.jump() on iPad event sequences.
  const beforeJump = await p.evaluate(() => window.__cg.local());
  await p.locator('.touch-jump').tap();
  await p.waitForFunction((y) => window.__cg.local().y > y + .08, beforeJump.y, { timeout: 2500 });
  await p.waitForTimeout(900);

  // Put the counselor on known open ground, then perform the same center-to-forward drag a thumb
  // makes on iPad. This avoids accidentally testing a bus wall/cabin collider at the random spawn.
  await p.evaluate(() => { window.__cg.teleport(0, 12); window.__cg.look(0); });
  const pad = await p.locator('.touch-move').boundingBox();
  if (!pad) throw new Error('movement pad has no layout box');
  const cx = pad.x + pad.width / 2, cy = pad.y + pad.height / 2;
  const beforeMove = await p.evaluate(() => window.__cg.local());
  await p.locator('.touch-move').dispatchEvent('pointerdown', { pointerId: 51, pointerType: 'touch', clientX: cx, clientY: cy, isPrimary: true, bubbles: true });
  await p.locator('.touch-move').dispatchEvent('pointermove', { pointerId: 51, pointerType: 'touch', clientX: cx, clientY: cy - 52, isPrimary: true, bubbles: true });
  await p.waitForTimeout(900);
  await p.locator('.touch-move').dispatchEvent('pointerup', { pointerId: 51, pointerType: 'touch', clientX: cx, clientY: cy - 52, isPrimary: true, bubbles: true });
  const afterMove = await p.evaluate(() => window.__cg.local());
  if (Math.hypot(afterMove.x - beforeMove.x, afterMove.z - beforeMove.z) < .25) throw new Error(`virtual joystick did not move the player: before=${JSON.stringify(beforeMove)} after=${JSON.stringify(afterMove)}`);

  // USE must be a real touch/click alternative: move next to a camper and tap the onscreen button.
  const camper = (await p.evaluate(() => window.__cg.campers()))[0];
  await p.evaluate(([x, z]) => { window.__cg.teleport(x, z + .55); window.__cg.look(Math.PI); }, [camper.x, camper.z]);
  await p.waitForTimeout(350);
  await p.locator('.touch-use').tap();
  await p.waitForFunction((id) => window.__cg.campers().some((c) => c.id === id && c.foundBy >= 0), camper.id, { timeout: 6000 });

  if (errors.length) throw new Error(errors.slice(0, 5).join(' | '));
  console.log('PASS  iPad-style touch: controls visible, jump, joystick drag movement and USE interaction');
} finally {
  await ctx.close().catch(() => undefined);
  await browser.close().catch(() => undefined);
  await new Promise((resolve) => server.httpServer.close(resolve));
  localPeer?.close?.();
}

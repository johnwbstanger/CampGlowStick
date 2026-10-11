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
  viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2,
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

  // A high-DPR iPad must not render the game at native 2x/3x resolution. That was one of the main
  // causes of slow-motion input/rendering on real tablets. The runtime governor should start <= 1x.
  const runtime = await p.evaluate(() => window.__cg.runtime());
  if (!runtime.touchLike) throw new Error(`iPad runtime profile not detected: ${JSON.stringify(runtime)}`);
  if (runtime.pixelRatio > 1.05) throw new Error(`iPad render scale too high: ${JSON.stringify(runtime)}`);

  const controls = p.locator('.touch-controls');
  if (!(await controls.isVisible())) throw new Error('touch controls are not visible for iPad-style context');
  for (const sel of ['.touch-move', '.touch-use', '.touch-jump', '.touch-sprint', '.touch-crouch', '.touch-flash', '.touch-glow', '.touch-map', '.touch-drop']) {
    if (!(await p.locator(sel).isVisible())) throw new Error(`missing touch control ${sel}`);
  }

  // Use Playwright's real touchscreen device rather than synthesized PointerEvents. This follows the
  // same browser touch pipeline an iPad finger press uses and catches overlay/touch-action regressions.
  await p.evaluate(() => { window.__cg.teleport(0, 12); window.__cg.look(0); });
  await p.waitForTimeout(120);
  const beforeJump = await p.evaluate(() => window.__cg.local());
  const jump = p.locator('.touch-jump');
  const jb = await jump.boundingBox();
  if (!jb) throw new Error('jump button has no layout box');
  const jx = jb.x + jb.width / 2, jy = jb.y + jb.height / 2;
  await p.touchscreen.tap(jx, jy);
  await p.waitForFunction((y) => window.__cg.local().y > y + .08, beforeJump.y, { timeout: 3000 });
  await p.waitForTimeout(900);

  // Perform the same center-to-forward drag a thumb makes on iPad. Pointer movement remains here
  // because Playwright exposes touchscreen tap but not a multi-step touchscreen drag primitive.
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

  // USE is also exercised as an actual touchscreen tap.
  const camper = (await p.evaluate(() => window.__cg.campers()))[0];
  await p.evaluate(([x, z]) => { window.__cg.teleport(x, z + .55); window.__cg.look(Math.PI); }, [camper.x, camper.z]);
  await p.waitForTimeout(350);
  const use = p.locator('.touch-use');
  const ub = await use.boundingBox();
  if (!ub) throw new Error('USE button has no layout box');
  await p.touchscreen.tap(ub.x + ub.width / 2, ub.y + ub.height / 2);
  await p.waitForFunction((id) => window.__cg.campers().some((c) => c.id === id && c.foundBy >= 0), camper.id, { timeout: 6000 });

  if (errors.length) throw new Error(errors.slice(0, 5).join(' | '));
  console.log('PASS  iPad-style touch: <=1x render scale, controls visible, jump, joystick movement and USE interaction');
} finally {
  await ctx.close().catch(() => undefined);
  await browser.close().catch(() => undefined);
  await new Promise((resolve) => server.httpServer.close(resolve));
  localPeer?.close?.();
}

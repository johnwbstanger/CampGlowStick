// iPad-style touch smoke. Chromium is not Safari, but this proves the touch-only control surface
// drives movement, jump, multitouch pointer ownership, floating-stick auto sprint, map close/back
// behavior and USE without keyboard events or pointer lock.
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

  const runtime = await p.evaluate(() => window.__cg.runtime());
  if (!runtime.touchLike) throw new Error(`iPad runtime profile not detected: ${JSON.stringify(runtime)}`);
  if (runtime.pixelRatio > 1.05) throw new Error(`iPad render scale too high: ${JSON.stringify(runtime)}`);

  const controls = p.locator('.touch-controls');
  if (!(await controls.isVisible())) throw new Error('touch controls are not visible for iPad-style context');
  for (const sel of ['.touch-move', '.touch-use', '.touch-jump', '.touch-sprint', '.touch-crouch', '.touch-flash', '.touch-glow', '.touch-map', '.touch-drop']) {
    if (!(await p.locator(sel).isVisible())) throw new Error(`missing touch control ${sel}`);
  }
  const moveRing = p.locator('.touch-move-ring');
  if ((await moveRing.count()) !== 1) throw new Error('floating movement ring is missing from the DOM');
  if (await moveRing.evaluate((el) => el.classList.contains('active'))) throw new Error('floating movement ring should be dormant before thumb-down');

  // The movement collider must be a broad thumb work-zone, not a tiny fixed joystick target.
  const pad = await p.locator('.touch-move').boundingBox();
  if (!pad) throw new Error('movement zone has no layout box');
  if (pad.width < 380 || pad.height < 450) throw new Error(`movement capture zone too small for iPad: ${JSON.stringify(pad)}`);
  const look = await p.locator('.touch-look').boundingBox();
  if (!look || look.width < 450 || look.height < 550) throw new Error(`right-look work-zone too small: ${JSON.stringify(look)}`);

  // Map/overlay must be reversible on an iPad with no keyboard attached.
  const mapButton = p.locator('.touch-map');
  const mb = await mapButton.boundingBox();
  if (!mb) throw new Error('MAP button has no layout box');
  await p.touchscreen.tap(mb.x + mb.width / 2, mb.y + mb.height / 2);
  await p.waitForSelector('.camp-map:not(.hidden)', { timeout: 3000 });
  const closeMap = p.locator('.camp-map-close');
  if (!(await closeMap.isVisible())) throw new Error('open camp map has no touch-accessible close/back button');
  const cb = await closeMap.boundingBox();
  if (!cb || cb.height < 44) throw new Error(`map close target is too small: ${JSON.stringify(cb)}`);
  await p.touchscreen.tap(cb.x + cb.width / 2, cb.y + cb.height / 2);
  await p.waitForFunction(() => document.querySelector('.camp-map')?.classList.contains('hidden'), null, { timeout: 3000 });

  await p.evaluate(() => { window.__cg.teleport(0, 12); window.__cg.look(0); });
  await p.waitForTimeout(120);
  const beforeJump = await p.evaluate(() => window.__cg.local());
  const jump = p.locator('.touch-jump');
  const jb = await jump.boundingBox();
  if (!jb || jb.width < 60 || jb.height < 50) throw new Error(`jump target too small: ${JSON.stringify(jb)}`);
  const jx = jb.x + jb.width / 2, jy = jb.y + jb.height / 2;
  await p.touchscreen.tap(jx, jy);
  await p.waitForFunction((y) => window.__cg.local().y > y + .08, beforeJump.y, { timeout: 3000 });
  await p.waitForTimeout(900);

  // Start anywhere inside the broad left zone. The visible joystick should relocate beneath the thumb.
  const cx = pad.x + pad.width * .42, cy = pad.y + pad.height * .58;
  const beforeMove = await p.evaluate(() => window.__cg.local());
  await p.locator('.touch-move').dispatchEvent('pointerdown', { pointerId: 51, pointerType: 'touch', clientX: cx, clientY: cy, isPrimary: true, bubbles: true });
  await p.waitForFunction(() => document.querySelector('.touch-move-ring')?.classList.contains('active'), null, { timeout: 1200 });
  if (!(await moveRing.isVisible())) throw new Error('floating joystick did not become visible after thumb-down');

  const ringCenter = await moveRing.evaluate((el) => {
    const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (Math.hypot(ringCenter.x - cx, ringCenter.y - cy) > 12) throw new Error(`floating joystick did not appear under thumb: thumb=${cx},${cy} ring=${JSON.stringify(ringCenter)}`);

  // A moderate push should walk smoothly.
  await p.locator('.touch-move').dispatchEvent('pointermove', { pointerId: 51, pointerType: 'touch', clientX: cx, clientY: cy - 46, isPrimary: true, bubbles: true });
  await p.waitForTimeout(350);
  const beforeForeignRelease = await p.evaluate(() => window.__cg.local());

  // Releasing a DIFFERENT touch pointer must never cancel the left stick.
  await p.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 77, pointerType: 'touch', clientX: 800, clientY: 360, bubbles: true })));
  await p.waitForTimeout(400);
  const afterForeignRelease = await p.evaluate(() => window.__cg.local());
  if (Math.hypot(afterForeignRelease.x - beforeForeignRelease.x, afterForeignRelease.z - beforeForeignRelease.z) < .14) {
    throw new Error(`foreign touch pointer cancelled left joystick: before=${JSON.stringify(beforeForeignRelease)} after=${JSON.stringify(afterForeignRelease)}`);
  }

  // Push into the outer ring: this should automatically engage sprint without holding a RUN button.
  await p.locator('.touch-move').dispatchEvent('pointermove', { pointerId: 51, pointerType: 'touch', clientX: cx, clientY: cy - 105, isPrimary: true, bubbles: true });
  await p.waitForFunction(() => document.querySelector('.touch-move-ring')?.classList.contains('sprinting'), null, { timeout: 1200 });
  const sprintStart = await p.evaluate(() => window.__cg.local());
  await p.waitForTimeout(420);
  const sprintEnd = await p.evaluate(() => window.__cg.local());
  if (Math.hypot(sprintEnd.x - sprintStart.x, sprintEnd.z - sprintStart.z) < .7) throw new Error('outer-ring auto sprint did not produce meaningful movement');

  await p.locator('.touch-move').dispatchEvent('pointerup', { pointerId: 51, pointerType: 'touch', clientX: cx, clientY: cy - 105, isPrimary: true, bubbles: true });
  await p.waitForFunction(() => !document.querySelector('.touch-move-ring')?.classList.contains('active'), null, { timeout: 1200 });
  const afterMove = await p.evaluate(() => window.__cg.local());
  if (Math.hypot(afterMove.x - beforeMove.x, afterMove.z - beforeMove.z) < .5) throw new Error(`floating joystick did not move the player: before=${JSON.stringify(beforeMove)} after=${JSON.stringify(afterMove)}`);

  // Verify the right-look surface can own its own pointer while remaining independent from movement.
  const lx = look.x + look.width * .7, ly = look.y + look.height * .45;
  const yaw0 = (await p.evaluate(() => window.__cg.local())).yaw;
  await p.locator('.touch-look').dispatchEvent('pointerdown', { pointerId: 71, pointerType: 'touch', clientX: lx, clientY: ly, isPrimary: false, bubbles: true });
  await p.locator('.touch-look').dispatchEvent('pointermove', { pointerId: 71, pointerType: 'touch', clientX: lx + 60, clientY: ly, isPrimary: false, bubbles: true });
  await p.locator('.touch-look').dispatchEvent('pointerup', { pointerId: 71, pointerType: 'touch', clientX: lx + 60, clientY: ly, isPrimary: false, bubbles: true });
  const yaw1 = (await p.evaluate(() => window.__cg.local())).yaw;
  if (Math.abs(yaw1 - yaw0) < .03) throw new Error(`right look drag did not rotate player: ${yaw0} -> ${yaw1}`);

  const use = p.locator('.touch-use');
  const ub = await use.boundingBox();
  if (!ub || ub.width < 80 || ub.height < 80) throw new Error(`USE target is too small: ${JSON.stringify(ub)}`);
  const camper = (await p.evaluate(() => window.__cg.campers()))[0];
  await p.evaluate(([x, z]) => { window.__cg.teleport(x, z + .55); window.__cg.look(Math.PI); }, [camper.x, camper.z]);
  await p.waitForTimeout(350);
  await p.touchscreen.tap(ub.x + ub.width / 2, ub.y + ub.height / 2);
  await p.waitForFunction((id) => window.__cg.campers().some((c) => c.id === id && c.foundBy >= 0), camper.id, { timeout: 6000 });

  if (errors.length) throw new Error(errors.slice(0, 5).join(' | '));
  console.log('PASS  iPad touch: large work-zones, floating stick, analog walk/auto-run, independent look, map close, jump and USE');
} finally {
  await ctx.close().catch(() => undefined);
  await browser.close().catch(() => undefined);
  await new Promise((resolve) => server.httpServer.close(resolve));
  localPeer?.close?.();
}

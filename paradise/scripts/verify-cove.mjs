import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Set PLAYWRIGHT_MODULE to an installed Playwright module when not in node_modules.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PARADISE_URL || 'http://127.0.0.1:8794/';
const output = process.env.PARADISE_REPORT_DIR || fileURLToPath(new URL('../verification/cove-current/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu'] : [] });
const report = { at: new Date().toISOString(), url: base, checks: [], screenshots: [], errors: [] };
const inspect = page => page.evaluate(() => window.__paradise.snapshot());
async function capture(page, name) {
  await page.screenshot({ path: join(output, `${name}.png`) });
  report.screenshots.push(`${name}.png`);
}
function observe(page) {
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400 && new URL(response.url()).origin === new URL(base).origin) report.errors.push(`${response.status()} ${response.url()}`); });
}
async function open(page) {
  observe(page);
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('body[data-ready="true"]');
  await page.waitForTimeout(2000);
  const snapshot = await inspect(page);
  assert.equal(snapshot.build, 'unified-cove-20260924');
  assert.equal(snapshot.canvases, 1);
  assert.equal(snapshot.frames, 0);
  assert.equal(snapshot.waveComponents, 32);
  assert.equal(await page.locator('#world img').count(), 0);
  return snapshot;
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  report.initial = await open(page);
  report.gpu = await page.evaluate(() => {
    const gl = document.querySelector('#world canvas').getContext('webgl2');
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'not exposed';
  });
  await capture(page, 'desktop-landing');
  await page.locator('#begin').click();
  assert.equal((await inspect(page)).entered, true);
  await page.locator('#cast').click();
  await page.waitForFunction(() => window.__paradise.snapshot().phase === 'hunt');
  const buoyancy = [];
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(100);
    const state = await inspect(page);
    buoyancy.push(Math.abs(state.bobber[1] - state.surface));
  }
  report.buoyancyMeanError = buoyancy.reduce((a, b) => a + b, 0) / buoyancy.length;
  assert.ok(report.buoyancyMeanError < .25, 'bobber must track the shared wave surface');
  await capture(page, 'desktop-fishing');
  await page.waitForFunction(() => window.__paradise.snapshot().phase === 'strike', null, { timeout: 25000 });
  await capture(page, 'desktop-strike');
  await page.locator('#cast').click();
  assert.equal((await inspect(page)).phase, 'fight');
  const reel = await page.locator('#cast').boundingBox();
  await page.mouse.move(reel.x + reel.width / 2, reel.y + reel.height / 2);
  let held = false;
  const deadline = Date.now() + 35000;
  while (Date.now() < deadline) {
    const state = await inspect(page);
    if (state.phase === 'landed') break;
    assert.equal(state.phase, 'fight', 'feathered reel should not lose the fish');
    const jumping = (await page.locator('#status').innerText()).includes('jumping');
    if (held && (state.tension > .6 || jumping)) { await page.mouse.up(); held = false; }
    else if (!held && state.tension < .33 && !jumping) { await page.mouse.down(); held = true; }
    await page.waitForTimeout(80);
  }
  await page.mouse.up();
  const caught = await inspect(page);
  assert.equal(caught.phase, 'landed');
  assert.equal(caught.catches, 1);
  report.checks.push('cast, wave-tracking buoyancy, strike, tension fight, catch');
  await capture(page, 'desktop-catch');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('body[data-ready="true"]');
  assert.equal((await inspect(page)).catches, 1);
  report.checks.push('catch persists after reload');
  await page.locator('#menu-button').click();
  await page.locator('button[data-time="night"]').click();
  await page.locator('button[data-weather="storm"]').click();
  await page.locator('#close-settings').click();
  await page.waitForTimeout(2000);
  const night = await inspect(page);
  assert.equal(night.time, 'night'); assert.equal(night.weather, 'storm');
  await capture(page, 'desktop-night-storm');
  report.checks.push('time/weather controls update the real scene');
  await context.close();

  for (const [name, width, height] of [['portrait', 390, 844], ['landscape', 844, 390]]) {
    const mobile = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await mobile.newPage();
    report[name] = await open(page);
    await capture(page, `mobile-${name}-landing`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.locator('#begin').tap();
    await page.locator('#cast').tap();
    await page.waitForFunction(() => window.__paradise.snapshot().phase === 'hunt');
    await page.waitForTimeout(2000);
    const button = await page.locator('#cast').boundingBox();
    assert.ok(button.width >= 44 && button.height >= 44 && button.y >= 0 && button.y + button.height <= height);
    await capture(page, `mobile-${name}-fishing`);
    await page.locator('#journal').tap();
    assert.ok(await page.locator('#journal-panel').isVisible());
    await page.locator('#close-journal').tap();
    report.checks.push(`${name}: touch cast, readable controls, journal, no overflow`);
    await mobile.close();
  }
  assert.deepEqual(report.errors, []);
  report.ok = true;
} catch (error) {
  report.ok = false;
  report.failure = error.stack;
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}

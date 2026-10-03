import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../apps/www/package.json', import.meta.url));
const { chromium } = require('playwright-core');
const evidence = process.env.OPTICAL_EVIDENCE_DIR;
assert(evidence, 'OPTICAL_EVIDENCE_DIR must identify the bounded artifact directory');
await mkdir(evidence, { recursive: true });
const html = await readFile(new URL('./backdrop-probe.html', import.meta.url), 'utf8');
const server = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(html);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
const report = {
  sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  node: process.version,
  scope:
    'Single Chromium native DOM backdrop carrier; no full optical material or Adapter/Compiler claim',
  browser: null,
  status: 'not-executed',
  observations: [],
  errors: [],
};
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  report.browser = browser.version();
  const page = await browser.newPage({
    viewport: { width: 760, height: 560 },
    deviceScaleFactor: 1,
  });
  page.on('pageerror', (error) => report.errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const scene = page.locator('#scene');
  const foreground = page.locator('#foreground');
  // Two animation frames synchronize DOM mutations with rasterization, not an arbitrary retry delay.
  const frame = () =>
    page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    );
  const captures = new Map();
  async function capture(name) {
    await frame();
    const png = await scene.screenshot({ path: path.join(evidence, `${name}.png`) });
    captures.set(name, png.toString('base64'));
    const metrics = await page.evaluate(async (base64) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const marker = (y, channel) => {
        let weight = 0,
          moment = 0,
          peak = 0;
        for (let x = 125; x < 470; x++) {
          const offset = 4 * (y * canvas.width + x);
          const signal = Math.max(
            0,
            pixels[offset + channel] -
              Math.max(pixels[offset + (channel === 0 ? 1 : 0)], pixels[offset + 2])
          );
          weight += signal;
          moment += signal * x;
          peak = Math.max(peak, signal);
        }
        return { x: weight ? moment / weight : null, peak, weight };
      };
      return {
        width: canvas.width,
        height: canvas.height,
        red: marker(95, 0),
        green: marker(95, 1),
        outsideRed: marker(35, 0),
        outsideGreen: marker(35, 1),
      };
    }, png.toString('base64'));
    report.observations.push({ name, metrics });
    return metrics;
  }
  const near = (value, expected, label) =>
    assert(
      typeof value === 'number' &&
        Number.isFinite(value) &&
        Number.isFinite(expected) &&
        Math.abs(value - expected) < 1.1,
      `${label}: observed ${value}, expected ${expected} ±1.1px`
    );
  await page.evaluate(() => window.opticalProbe.none());
  const unfiltered = await capture('no-effect');
  await page.evaluate(() => window.opticalProbe.setScale(0));
  const none = await capture('scale-zero');
  near(none.red.x, unfiltered.red.x, 'zero scale equals no effect');
  near(none.red.x, 171.5, 'baseline red');
  near(none.green.x, 348.5, 'baseline green');
  const foregroundBefore = await foreground.screenshot();
  await page.evaluate(() => window.opticalProbe.setScale(20));
  const positive = await capture('scale-positive-20');
  near(positive.red.x, none.red.x - 10, 'positive inverse sample displacement red');
  near(positive.green.x, none.green.x - 10, 'positive inverse sample displacement green');
  near(positive.outsideRed.x, none.outsideRed.x, 'outside clip retains source position');
  assert(
    positive.red.peak > 240,
    'displacement must preserve a sharp red line instead of only scattering it'
  );
  assert.deepEqual(
    await foreground.screenshot(),
    foregroundBefore,
    'foreground pixels must not be displaced'
  );
  await page.evaluate(() => window.opticalProbe.setScale(-20));
  const negative = await capture('scale-negative-20');
  near(negative.red.x, none.red.x + 10, 'negative displacement reverses direction');
  near(negative.green.x, none.green.x + 10, 'negative displacement second marker');
  await page.evaluate(() => window.opticalProbe.blurOnly());
  const blurred = await capture('blur-only-negative-control');
  near(blurred.red.x, none.red.x, 'blur alone must not satisfy displacement');
  assert(
    blurred.red.peak < positive.red.peak - 40,
    'blur negative control must measurably scatter the line'
  );
  await page.evaluate(() => {
    window.opticalProbe.setScale(20);
    window.opticalProbe.changeBackdrop();
  });
  const updated = await capture('live-dom-backdrop-mutated');
  near(updated.red.x, positive.red.x + 23, 'current DOM change propagates to filtered backdrop');
  near(updated.outsideRed.x, none.outsideRed.x + 23, 'unfiltered source DOM also moves');
  assert.equal(await page.locator('#source-text').textContent(), 'LIVE DOM 4567 / B');
  await page.evaluate(() => window.opticalProbe.moveAndResize());
  const resized = await capture('surface-moved-resized');
  near(resized.red.x, updated.red.x, 'screen-space background sampling after move/resize');
  near(resized.green.x, updated.green.x, 'second screen-space marker after move/resize');
  await page.evaluate(() => window.opticalProbe.setScale(0));
  const restored = await capture('restored-zero');
  near(restored.red.x, 194.5, 'zero scale restores current source');
  // Full-scene pixels outside the union of the old/new surface rectangles must be unchanged.
  const outsideChanges = await page.evaluate(
    async ({ before, after }) => {
      async function pixels(base64) {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        return ctx.getImageData(0, 0, canvas.width, canvas.height);
      }
      const a = await pixels(before),
        b = await pixels(after);
      let count = 0;
      for (let y = 0; y < a.height; y++)
        for (let x = 0; x < a.width; x++) {
          if (x >= 98 && x <= 502 && y >= 58 && y <= 292) continue;
          const i = (y * a.width + x) * 4;
          if (
            Math.abs(a.data[i] - b.data[i]) +
              Math.abs(a.data[i + 1] - b.data[i + 1]) +
              Math.abs(a.data[i + 2] - b.data[i + 2]) >
            3
          )
            count++;
        }
      return count;
    },
    { before: captures.get('scale-zero'), after: captures.get('scale-positive-20') }
  );
  assert.equal(outsideChanges, 0, 'filter must not modify pixels outside its surface clip');
  assert.deepEqual(report.errors, []);
  report.status = 'carrier-passed';
  report.outsideChanges = outsideChanges;
  await page.screenshot({ path: path.join(evidence, 'complete-scene.png') });
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.status = 'carrier-failed-or-unavailable';
  report.failure = String(error.stack ?? error);
  throw error;
} finally {
  await writeFile(path.join(evidence, 'observations.json'), JSON.stringify(report, null, 2));
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}

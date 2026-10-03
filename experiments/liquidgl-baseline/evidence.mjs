import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(new URL('../../apps/www/package.json', import.meta.url));
const { chromium } = require('playwright-core');
const directory = process.env.LIQUIDGL_EVIDENCE_DIR;
assert(directory, 'A bounded evidence directory is required');
const record = process.argv.includes('--record');
await mkdir(directory, { recursive: true });
const resources = new Map(
  await Promise.all(
    ['index.html', 'scene.css', 'scene.js', 'vendor/liquidGL.js'].map(async (name) => [
      name,
      await readFile(new URL(name, import.meta.url)),
    ])
  )
);
const csp =
  "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; worker-src blob:; connect-src 'none'; font-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'";
const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const name = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!resources.has(name)) {
    response.writeHead(404);
    response.end();
    return;
  }
  const type = name.endsWith('.css')
    ? 'text/css'
    : name.endsWith('.js')
      ? 'text/javascript'
      : 'text/html';
  response.writeHead(200, {
    'content-type': `${type}; charset=utf-8`,
    'content-security-policy': csp,
    'cache-control': 'no-store',
  });
  response.end(resources.get(name));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const viewport = { width: 760, height: 770 };
const report = {
  sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  upstream: JSON.parse(await readFile(new URL('provenance.json', import.meta.url), 'utf8')),
  node: process.version,
  sourceKind: 'reconstructed-scene',
  mode: record ? 'pure-recording' : 'observation-and-controls',
  viewport,
  screenshotCalls: 0,
  samples: [],
  errors: [],
  externalRequestsBlocked: [],
  status: 'not-run',
};
let browser, context, video;
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    headless: true,
    chromiumSandbox: true,
  });
  report.browser = browser.version();
  context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    serviceWorkers: 'block',
    ...(record ? { recordVideo: { dir: path.join(directory, 'video'), size: viewport } } : {}),
  });
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin || url.protocol === 'data:' || url.protocol === 'blob:')
      return route.continue();
    report.externalRequestsBlocked.push(url.origin);
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push(error.message));
  video = page.video();
  async function load(control = 'normal') {
    await page.goto(`${origin}/?control=${control}`);
    await page.waitForFunction(
      () => ['gpu', 'fallback'].includes(document.body.dataset.ready),
      undefined,
      { timeout: 20000 }
    );
    const state = await page.evaluate(() => window.upstreamBaseline.observe());
    report.samples.push({ label: `loaded-${control}`, state });
    return state;
  }
  async function capture(name) {
    const bytes = await page.screenshot({ path: path.join(directory, `${name}.png`) });
    report.screenshotCalls++;
    report.samples.push({
      label: name,
      state: await page.evaluate(() => window.upstreamBaseline.observe()),
    });
    return bytes.toString('base64');
  }
  const initial = await load();
  if (record) {
    // Presentation holds are intentional; no screenshot/viewport changes in this context.
    await page.waitForTimeout(600);
    await page.mouse.move(100, 270);
    await page.mouse.move(280, 270, { steps: 18 });
    await page.mouse.down();
    await page.mouse.move(185, 285, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(600);
    await page.mouse.move(405, 380);
    await page.mouse.move(645, 430, { steps: 22 });
    await page.mouse.move(50, 720, { steps: 12 });
    await page.waitForTimeout(700);
    report.samples.push({
      label: 'source-mutation',
      state: await page.evaluate(() => window.upstreamBaseline.moveSource()),
    });
    await page.waitForTimeout(800);
    report.status = initial.gpuReady
      ? 'recorded-upstream-unaccepted'
      : 'recorded-fallback-unavailable';
  } else {
    const normal = await capture('upstream-normal');
    await page.locator('.caption').evaluateAll((nodes) =>
      nodes.forEach((node) => {
        node.style.visibility = 'hidden';
      })
    );
    const withoutCaption = await capture('negative-hidden-foreground');
    await page.locator('.caption').evaluateAll((nodes) =>
      nodes.forEach((node) => {
        node.style.removeProperty('visibility');
      })
    );
    report.foregroundChangedPixels = await page.evaluate(
      async ({ normal, withoutCaption }) => {
        async function pixels(base64) {
          const image = new Image();
          image.src = `data:image/png;base64,${base64}`;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(image, 0, 0);
          return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        }
        const a = await pixels(normal),
          b = await pixels(withoutCaption);
        let changed = 0;
        for (let y = 253; y < 292; y++)
          for (let x = 160; x < 280; x++) {
            const i = 4 * (y * 760 + x);
            if (
              Math.abs(a[i] - b[i]) +
                Math.abs(a[i + 1] - b[i + 1]) +
                Math.abs(a[i + 2] - b[i + 2]) >
              12
            )
              changed++;
          }
        return changed;
      },
      { normal, withoutCaption }
    );
    assert(
      report.foregroundChangedPixels > 20,
      'The real Select foreground must visibly paint above the vendor canvas'
    );

    assert(initial.gpuReady, `No optical GPU backend: ${initial.backend}`);
    assert(initial.sharedRenderer, 'The two baseline lenses should share one renderer');
    assert(
      initial.lenses.every((lens) => lens.pointerEvents === 'none'),
      'Record the actual upstream input ownership side effect'
    );
    await page.mouse.move(145, 270);
    await page.mouse.move(285, 270, { steps: 12 });
    await capture('upstream-fluid-movement');
    assert.equal(
      await page.evaluate(() => getSelection()?.toString() ?? ''),
      '',
      'Decorative baseline pointer movement must not select backdrop text'
    );
    await page.mouse.move(20, 720);
    await page.waitForTimeout(700);
    const partial = await page.evaluate(() => window.upstreamBaseline.destroyOne(0));
    report.samples.push({ label: 'destroy-first', state: partial });
    assert.equal(partial.lenses[0].pointerEvents, 'auto');
    assert(
      partial.gpuReady && !partial.lenses[1].destroyed,
      'Destroying one lens must retain the other'
    );
    const disposed = await page.evaluate(() => window.upstreamBaseline.dispose());
    report.samples.push({ label: 'dispose-all', state: disposed });
    assert.equal(disposed.canvasCount, 0);
    assert.equal(disposed.dynamicStyleCount, 0);
    assert(disposed.lenses.every((lens) => lens.pointerEvents === 'auto'));
    const again = await page.evaluate(() => window.upstreamBaseline.dispose());
    assert.equal(again.canvasCount, 0);
    await load('zero');
    const zero = await capture('upstream-zero-refraction-bevel');
    report.opticalDifference = await page.evaluate(
      async ({ normal, zero }) => {
        async function pixels(base64) {
          const image = new Image();
          image.src = `data:image/png;base64,${base64}`;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(image, 0, 0);
          return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        }
        const a = await pixels(normal),
          b = await pixels(zero);
        let changed = 0;
        // Fixed large-surface ROI, excludes header/caption and records effect presence only.
        for (let y = 310; y < 500; y++)
          for (let x = 382; x < 673; x++) {
            const i = 4 * (y * 760 + x);
            if (
              Math.abs(a[i] - b[i]) +
                Math.abs(a[i + 1] - b[i + 1]) +
                Math.abs(a[i + 2] - b[i + 2]) >
              8
            )
              changed++;
          }
        return {
          changedPixels: changed,
          roi: { x: 382, y: 310, width: 291, height: 190 },
          acceptance: 'not-a-visual-quality-score',
        };
      },
      { normal, zero }
    );
    assert(
      report.opticalDifference.changedPixels > 0,
      'Optical controls must change the fixed-geometry surface'
    );
    report.status = 'bounded-observations-passed-not-accepted';
  }
  report.frameTimesMs = await page.evaluate(() => window.upstreamBaseline.frameTimes());
  assert.equal(report.errors.length, 0, report.errors.join('\n'));
  assert.equal(
    report.externalRequestsBlocked.length,
    0,
    'Unexpected external requests were blocked'
  );
} catch (error) {
  report.status = 'failed';
  report.failure = String(error.stack ?? error);
  throw error;
} finally {
  await context?.close();
  if (video) await copyFile(await video.path(), path.join(directory, 'liquidgl-upstream.webm'));
  await writeFile(
    path.join(directory, record ? 'recording.json' : 'observations.json'),
    JSON.stringify(report, null, 2)
  );
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}

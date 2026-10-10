// Official browser execution only. No external pages, source captures, accounts,
// WebGL replacement, native backdrop-filter, or browser-policy workaround.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises';
import { resolve, join, extname, sep, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyFixtureBinding, readBoundFixtureFile, sha256 } from './artifact-binding.mjs';
import { launchBrowser } from '../../apps/www/src/content/docs/zh-cn/browser-harness.ts';
import {
  captureCurrentViewport,
  closeEvidenceContext,
  writeFailureRecord,
} from '../../apps/www/src/content/docs/zh-cn/library-card-capture.ts';
import { renderInitialPaintPage } from './render-page.mjs';
import {
  holdMediaEmulation,
  readMediaObservation,
  assertMediaObservation,
} from './media-session.ts';
const root = resolve(process.argv[2] ?? '/tmp/pui-initial-paint'),
  out = resolve(process.argv[3] ?? '/tmp/pui-initial-paint-evidence');
await mkdir(out, { recursive: true });
assert.deepEqual(
  await readdir(out),
  [],
  'Use a fresh output directory so stale images cannot enter this receipt'
);
const source = JSON.parse(await readFile(join(root, 'source.json'), 'utf8'));
const repository = fileURLToPath(new URL('../../', import.meta.url));
const boundFiles = await verifyFixtureBinding(source, repository, root);
const generatedFiles = [];
async function writeGeneratedPage(file, html) {
  await writeFile(join(root, file), html);
  const digest = sha256(await readFile(join(root, file)));
  boundFiles.set(file, digest);
  generatedFiles.push({ file, sha256: digest });
}
const observations = [],
  images = [],
  cleanup = [];
const report = (issue) => cleanup.push(issue);
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1'),
    file = resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(root + sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    response.setHeader(
      'content-type',
      { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[extname(file)] ??
        'application/octet-stream'
    );
    response.end(await readBoundFixtureFile(root, relative(root, file), boundFiles));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser,
  context,
  page,
  failure = null,
  mediaSession,
  requestedMedia,
  activeCase = null,
  releaseHeld = () => {};
const safe = {
  'prefers-reduced-motion': 'no-preference',
  'prefers-reduced-transparency': 'no-preference',
  'prefers-contrast': 'no-preference',
  'forced-colors': 'none',
};
async function open(theme, { script = true, width = 1000, dpr = 1, preferences = {} } = {}) {
  context = await browser.newContext({
    viewport: { width, height: 800 },
    deviceScaleFactor: dpr,
    javaScriptEnabled: script,
  });
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort()
  );
  page = await context.newPage();
  requestedMedia = { ...safe, 'prefers-color-scheme': theme, ...preferences };
  mediaSession = await holdMediaEmulation(context, page, requestedMedia, report);
}
async function recordMedia() {
  const media = await readMediaObservation(page, requestedMedia);
  observations.push({ ...activeCase, phase: 'media-observation', media });
  assertMediaObservation(media);
  return media;
}
async function snapshot() {
  return page.locator('#seed-control').evaluate(
    (el) => ({
      image: getComputedStyle(el).backgroundImage,
      color: getComputedStyle(el).backgroundColor,
      rect: el.getBoundingClientRect().toJSON(),
      quality: el.dataset.materialQuality ?? null,
      reason: el.dataset.materialReason ?? null,
      blur: getComputedStyle(el).backdropFilter,
      source: getComputedStyle(document.querySelector('canvas')).backgroundImage,
    }),
    undefined,
    { timeout: 5000 }
  );
}
async function capture(name) {
  images.push(await captureCurrentViewport(page, join(out, name), undefined, report));
}
async function close() {
  await mediaSession?.close();
  mediaSession = null;
  await closeEvidenceContext(context, false, report);
  context = null;
  page = null;
}
try {
  browser = await launchBrowser();
  // The original bright dark source is genuinely unsafe under the fixed
  // renderer. Preserve that refusal instead of demanding an optical receipt.
  activeCase = { theme: 'dark', case: 'unsafe-source-rejection' };
  await open('dark');
  const darkTemplate = await readFile(join(root, 'index.html'), 'utf8');
  await writeGeneratedPage(
    'producer-dark.html',
    darkTemplate.replace('data-theme="light"', 'data-theme="dark"')
  );
  await page.goto(`${origin}/producer-dark.html?capture&unsafe-dark-control`, {
    waitUntil: 'networkidle',
  });
  await recordMedia();
  await page.waitForFunction(
    () =>
      document.querySelector('#seed-control')?.dataset.materialReason ===
      'rendered-contrast-unsafe',
    undefined,
    { timeout: 30000 }
  );
  const rejected = await snapshot();
  assert.equal(rejected.quality, 'opaque-fallback');
  assert.equal(rejected.image, 'none');
  assert.equal(await page.locator('html').getAttribute('data-seed-error'), null);
  const rejection = await page.evaluate(async () => {
    try {
      await window.initialPaintExperiment.artifact();
      return null;
    } catch (error) {
      return String(error);
    }
  });
  assert.match(rejection ?? '', /no-admitted-static-paint-captured/);
  observations.push({ ...activeCase, state: rejected, captureRejection: rejection });
  await capture('dark-unsafe-source-rejected.png');
  await close();
  for (const theme of ['light', 'dark']) {
    activeCase = { theme, case: 'producer' };
    await open(theme);
    await page.goto(`${origin}/?capture`, { waitUntil: 'networkidle' });
    // Theme is set before a second navigation because the fixture does not
    // rewrite a captured light product and call it a dark artifact.
    if (theme === 'dark') {
      const template = await readFile(join(root, 'index.html'), 'utf8');
      await writeGeneratedPage(
        'producer-dark.html',
        template.replace('data-theme="light"', 'data-theme="dark"')
      );
      await page.goto(`${origin}/producer-dark.html?capture`, { waitUntil: 'networkidle' });
    }
    await recordMedia();
    await page.waitForFunction(
      () =>
        document.querySelector('#seed-control')?.dataset.materialQuality === 'self-optical' ||
        document.documentElement.dataset.seedError,
      undefined,
      { timeout: 30000 }
    );
    assert.equal(await page.locator('html').getAttribute('data-seed-error'), null);
    const artifact = await page.evaluate(() => window.initialPaintExperiment.artifact());
    await writeFile(
      join(out, `${theme}-artifact.json`),
      JSON.stringify({ ...artifact, source }, null, 2)
    );
    await writeGeneratedPage(
      `seed-${theme}.html`,
      await renderInitialPaintPage(artifact.serialized, artifact.binding)
    );
    await capture(`${theme}-real-producer.png`);
    await close();
    const expected = `url("${artifact.receipt.image.dataUrl}")`;
    for (const [name, config, eligible] of [
      ['no-script', {}, true],
      ['reduce-transparency', { preferences: { 'prefers-reduced-transparency': 'reduce' } }, false],
      ['forced-colors', { preferences: { 'forced-colors': 'active' } }, false],
      ['contrast-more', { preferences: { 'prefers-contrast': 'more' } }, false],
      ['unsupported-width', { width: 800 }, false],
      ['unsupported-dpr', { dpr: 2 }, false],
    ]) {
      activeCase = { theme, case: name };
      await open(theme, { script: false, ...config });
      await page.goto(`${origin}/seed-${theme}.html`, { waitUntil: 'load' });
      const media = await recordMedia();
      const state = await snapshot();
      observations.push({ theme, case: name, eligible, media, state });
      assert.equal(state.image, eligible ? expected : 'none');
      assert.equal(state.quality, null);
      assert.equal(state.blur, 'none');
      assert.match(state.source, /^url\("data:image\/png;base64,/);
      await capture(`${theme}-${name}.png`);
      if (eligible) {
        await page.keyboard.press('Tab');
        assert.equal(await page.locator('a').evaluate((el) => el === document.activeElement), true);
        await page.keyboard.press('Enter');
        assert.equal(new URL(page.url()).hash, '#destination');
      }
      await close();
    }
    activeCase = { theme, case: 'server-to-live' };
    await open(theme);
    let release;
    const held = new Promise((resolve) => {
      release = resolve;
      releaseHeld = resolve;
    });
    await context.route('**/app.js', async (route) => {
      await held;
      await route.continue();
    });
    await page.goto(`${origin}/seed-${theme}.html`, { waitUntil: 'commit' });
    await page.waitForFunction(
      () =>
        document.querySelector('#seed-control') &&
        getComputedStyle(document.querySelector('#seed-control')).backgroundImage.startsWith('url(')
    );
    await recordMedia();
    const before = await snapshot();
    assert.equal(before.image, expected);
    assert.equal(before.quality, null);
    await capture(`${theme}-held-server.png`);
    await page.evaluate(() => {
      window.seedFrames = [];
      window.seedFrameActive = true;
      const owner = document.querySelector('#seed-control');
      const tick = (t) => {
        if (!window.seedFrameActive) return;
        const el = document.querySelector('#seed-control'),
          css = getComputedStyle(el);
        window.seedFrames.push({
          t,
          sameOwner: el === owner,
          image: css.backgroundImage,
          rect: el.getBoundingClientRect().toJSON(),
          visibility: css.visibility,
          opacity: css.opacity,
          quality: el.dataset.materialQuality ?? null,
          reason: el.dataset.materialReason ?? null,
          seedOwner: el.getAttribute('data-pui-initial-seed'),
          backgroundColor: css.backgroundColor,
        });
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    release();
    await page.waitForFunction(
      () =>
        document.querySelector('#seed-control').dataset.materialQuality === 'self-optical' ||
        document.documentElement.dataset.seedError,
      undefined,
      { timeout: 30000 }
    );
    assert.equal(await page.locator('html').getAttribute('data-seed-error'), null);
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          let count = 0;
          const tick = () => (++count === 8 ? resolve() : requestAnimationFrame(tick));
          requestAnimationFrame(tick);
        })
    );
    const frames = await page.evaluate(() => {
      window.seedFrameActive = false;
      return window.seedFrames;
    });
    await writeFile(join(out, `${theme}-frames.json`), JSON.stringify(frames, null, 2));
    assert.ok(frames.length >= 8);
    for (const [index, frame] of frames.entries()) {
      assert.equal(frame.sameOwner, true);
      assert.equal(
        frame.image,
        expected,
        `server-to-live paint mismatch: ${JSON.stringify({
          theme,
          index,
          at: frame.t,
          quality: frame.quality,
          reason: frame.reason,
          seedOwner: frame.seedOwner,
          backgroundColor: frame.backgroundColor,
          sameOwner: frame.sameOwner,
          rect: frame.rect,
        })}`
      );
      assert.deepEqual(frame.rect, before.rect);
      assert.equal(frame.visibility, 'visible');
      assert.equal(frame.opacity, '1');
    }
    await recordMedia();
    const after = await snapshot();
    assert.equal(after.image, expected);
    assert.equal(after.quality, 'self-optical');
    assert.deepEqual(after.rect, before.rect);
    await capture(`${theme}-enhanced.png`);
    observations.push({ theme, case: 'server-to-live', frames: frames.length, before, after });
    await page.evaluate(() => window.initialPaintExperiment.revokeSource());
    await page.waitForFunction(
      () => document.querySelector('#seed-control').dataset.materialQuality === 'opaque-fallback'
    );
    assert.equal((await snapshot()).image, 'none');
    await capture(`${theme}-revoked.png`);
    await close();
  }
} catch (error) {
  failure = String(error?.stack ?? error);
  if (page) {
    try {
      observations.push({
        ...activeCase,
        phase: 'failure-media',
        media: await readMediaObservation(page, requestedMedia),
        state: await snapshot(),
      });
    } catch (issue) {
      report({ operation: 'failure.media-observation', error: String(issue) });
    }
  }
  if (page)
    await capture('failure.png').catch((issue) =>
      report({ operation: 'failure.capture', error: String(issue) })
    );
  await writeFailureRecord(
    join(out, 'failure.json'),
    { source, failure, observations, images, cleanup },
    report
  );
} finally {
  releaseHeld();
  await mediaSession?.close();
  mediaSession = null;
  if (context)
    await closeEvidenceContext(context, !!failure, report).catch((error) => {
      failure ??= String(error);
    });
  if (browser)
    await closeEvidenceContext(browser, !!failure, (issue) =>
      report({ ...issue, operation: 'browser.close' })
    ).catch((error) => {
      failure ??= String(error);
    });
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
const result = {
  source,
  passed: failure === null,
  failure,
  scope:
    'Finite 1000×800 DPR1 desktop rest Surface; actual family + native link. Unsupported viewport/DPR and accessibility preferences use SSR CSS fallback. No Card/mobile/contact/four-runtime/Compiler acceptance.',
  observations,
  generatedFiles,
  images,
  cleanup,
};
await writeFile(join(out, 'result.json'), JSON.stringify(result, null, 2));
await writeFile(
  join(out, 'manifest.json'),
  JSON.stringify(
    {
      source,
      files: await Promise.all(
        (await readdir(out))
          .filter((file) => file !== 'manifest.json')
          .sort()
          .map(async (file) => ({
            file,
            sha256: createHash('sha256')
              .update(await readFile(join(out, file)))
              .digest('hex'),
          }))
      ),
    },
    null,
    2
  )
);
if (failure) throw new Error(failure);

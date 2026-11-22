import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, readdir, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// A diagnostic of browser notifications and competing CDP emulation owners.
// There are no Proto-UI imports, product expectations, synthetic events, or
// backing-store repairs here. A fixed canvas is deliberately not DPR-aware.
const SCRIPT = 'scripts/analysis/liquid-dpr-notification-probe.mjs';
const VIEWPORT = { width: 1100, height: 1000 };
const METRICS = (deviceScaleFactor) => ({ ...VIEWPORT, deviceScaleFactor, mobile: false });
const CASES = ['playwright-viewport', 'single-cdp-owner', 'screenshot-and-cached-override'];
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const HTML = `<!doctype html><meta charset="utf-8"><title>Bare DPR notification probe</title>
<style>html,body{margin:0;background:#fff;color:#111}#probe-area{display:flow-root;width:400px;height:1400px}canvas{display:block;margin:24px;width:320px;height:160px}</style>
<main id="probe-area"><canvas id="probe" width="320" height="160" aria-label="Fixed diagnostic bitmap"></canvas></main>`;

function installObservers() {
  const canvas = document.querySelector('#probe');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('The static 2D canvas is unavailable');
  ctx.fillStyle = '#e4edf4';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#174c77';
  ctx.fillRect(16, 16, 128, 128);
  ctx.fillStyle = '#9b3500';
  ctx.fillRect(176, 16, 128, 128);
  let phase = 'observer-installation';
  let active = true;
  const events = [];
  const resolutions = ['(resolution: 1dppx)', '(resolution: 2dppx)'];
  const queries = resolutions.map((media) => matchMedia(media));
  const box = (value) =>
    Array.from(value ?? [], ({ inlineSize, blockSize }) => ({ inlineSize, blockSize }));
  const rect = (value) => ({ x: value.x, y: value.y, width: value.width, height: value.height });
  const snapshot = () => ({
    performanceNow: performance.now(),
    timeOrigin: performance.timeOrigin,
    phase,
    active,
    dpr: devicePixelRatio,
    innerWidth,
    innerHeight,
    outerWidth,
    outerHeight,
    scrollX,
    scrollY,
    document: {
      clientWidth: document.documentElement.clientWidth,
      clientHeight: document.documentElement.clientHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      screenshotRegion: rect(document.querySelector('#probe-area').getBoundingClientRect()),
    },
    screen: {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
    },
    visualViewport: visualViewport
      ? {
          width: visualViewport.width,
          height: visualViewport.height,
          scale: visualViewport.scale,
          offsetLeft: visualViewport.offsetLeft,
          offsetTop: visualViewport.offsetTop,
          pageLeft: visualViewport.pageLeft,
          pageTop: visualViewport.pageTop,
        }
      : null,
    // Chrome 157 MediaQueryList::matches() updates that object's remembered
    // match. Reading a listener's own object before MediaFeaturesChanged could
    // consume its transition. Sample fresh queries with no listeners; the
    // observed objects are read only through their actual change events.
    media: resolutions.map((media) => ({ media, matches: matchMedia(media).matches })),
    canvas: {
      css: rect(canvas.getBoundingClientRect()),
      bitmapWidth: canvas.width,
      bitmapHeight: canvas.height,
      isConnected: canvas.isConnected,
    },
    eventCount: events.length,
  });
  const append = (kind, details) =>
    events.push({
      sequence: events.length,
      kind,
      ...details,
      observed: snapshot(),
    });
  const eventFacts = (event) => ({
    type: event.type,
    constructor: event.constructor.name,
    isTrusted: event.isTrusted,
    timeStamp: event.timeStamp,
  });
  const onWindow = (event) => append('window-resize', eventFacts(event));
  const onVisual = (event) => append('visual-viewport-resize', eventFacts(event));
  const onMedia = (event) =>
    append('media-query-change', {
      ...eventFacts(event),
      media: event.media,
      matches: event.matches,
    });
  window.addEventListener('resize', onWindow);
  visualViewport?.addEventListener('resize', onVisual);
  for (const query of queries) query.addEventListener('change', onMedia);
  const observers = [];
  const observerSetup = [];
  // Device-pixel boxes are recorded directly; they are not inferred by
  // multiplying CSS geometry by the emulated window.devicePixelRatio.
  for (const observedBox of ['content-box', 'device-pixel-content-box']) {
    const observer = new ResizeObserver((entries) =>
      append('resize-observer', {
        observedBox,
        entries: entries.map((entry) => ({
          constructor: entry.constructor.name,
          target: entry.target.id,
          sameCanvas: entry.target === canvas,
          contentRect: rect(entry.contentRect),
          contentBoxSize: box(entry.contentBoxSize),
          borderBoxSize: box(entry.borderBoxSize),
          devicePixelContentBoxSize: box(entry.devicePixelContentBoxSize),
        })),
      })
    );
    observers.push(observer);
    try {
      observer.observe(canvas, { box: observedBox });
      observerSetup.push({ box: observedBox, accepted: true });
    } catch (error) {
      observerSetup.push({ box: observedBox, accepted: false, error: String(error) });
    }
  }
  window.__dprNotificationProbe = {
    mark(value) {
      phase = value;
      return snapshot();
    },
    read() {
      return snapshot();
    },
    result() {
      return { observerSetup, events, final: snapshot() };
    },
    dispose() {
      window.removeEventListener('resize', onWindow);
      visualViewport?.removeEventListener('resize', onVisual);
      for (const query of queries) query.removeEventListener('change', onMedia);
      for (const observer of observers) observer.disconnect();
      active = false;
      return { observerSetup, events, final: snapshot() };
    },
  };
  return { observerSetup, initial: snapshot() };
}

async function bounded(promise, label, ms = 5000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}: ${ms}ms diagnostic timeout`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function observe(outputArgument) {
  const root = await realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));
  const output = path.resolve(outputArgument);
  await mkdir(output, { recursive: true });
  const actualOutput = await realpath(output);
  const relativeOutput = path.relative(root, actualOutput);
  assert.ok(
    relativeOutput.startsWith(`..${path.sep}`) || path.isAbsolute(relativeOutput),
    'Diagnostic output must be outside the source checkout'
  );
  assert.deepEqual(
    await readdir(actualOutput),
    [],
    'Use an empty output directory; retain earlier observations'
  );
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const report = {
    schemaVersion: 1,
    purpose: 'Bare-browser DPR notification and CDP session diagnostic',
    productAccepted: false,
    status: 'collecting',
    startedAt: new Date().toISOString(),
    environment: { node: process.version, platform: os.platform(), arch: os.arch() },
    source: null,
    expectedCases: CASES,
    staticDocument: {
      html: HTML,
      htmlSha256: sha256(HTML),
      observerFunctionSha256: sha256(installObservers.toString()),
    },
    cases: [],
    operations: [],
    failures: [],
    cleanupErrors: [],
    limitations: [
      'No product code or material scene is loaded. This is not a replacement for any original acceptance suite.',
      'The 320x160 canvas backing store is intentionally fixed. Its unchanged bitmap size is not a product failure.',
      'The static 400x1400 region deliberately exceeds the 1100x1000 viewport so full-page and region screenshots exercise capture-beyond-viewport in addition to the viewport-only screenshot control. Actual protocol parameters remain in the raw log.',
      'Only the requested CDP commands change emulation. No synthetic resize, media event, polling repair or redraw is dispatched.',
      'Each phase observes immediately, after two animation frames, and after a further fixed 1000ms. Absence of a callback within that window is an observation, not proof that no later callback is possible.',
      'DOM geometry reads can flush layout. ResizeObserver entries are callbacks, not DOM Events, and have no isTrusted flag.',
      'Current media values are sampled with fresh queries without listeners. Registered notification queries are never read through their matches getter, because Chrome157 updates their stored comparison value when that getter is read.',
      'CDP deviceScaleFactor emulation and physical display pixel density are distinct; device-pixel-content-box is reported without substituting CSS times emulated DPR.',
      'Playwright protocol logging is enabled through the pinned package DEBUG/DEBUG_FILE facility, including its own session commands and responses. This adds untimed diagnostic logging overhead.',
      'Browser-controlled emulation and screenshot observations make no physical 120Hz, physical-input, latency, or input-to-photon claim.',
    ],
  };
  const reportPath = path.join(actualOutput, 'dpr-notification.json');
  const checkpoint = () => writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  const protocolPath = path.join(actualOutput, 'playwright-protocol.log');
  // DEBUG_FILE's stream is owned by Playwright. beforeExit runs after pending
  // writes drain; do not hash a partially flushed log or force process.exit().
  process.once('beforeExit', () => {
    try {
      if (report.environment.playwright) {
        const bytes = readFileSync(protocolPath);
        const text = bytes.toString('utf8');
        assert.ok(
          text.includes('pw:protocol') && text.includes('SEND') && text.includes('RECV'),
          'Missing actual Playwright protocol log'
        );
        report.protocolLog = {
          path: 'playwright-protocol.log',
          bytes: bytes.length,
          sha256: sha256(bytes),
        };
      }
    } catch (error) {
      report.failures.push({ phase: 'protocol-log-finalization', error: String(error) });
    }
    report.status =
      report.failures.length || report.cleanupErrors.length ? 'diagnostic-incomplete' : 'observed';
    report.productAccepted = false;
    checkpoint();
    process.exitCode = report.status === 'observed' ? 0 : 1;
    console.log(
      JSON.stringify({
        status: report.status,
        productAccepted: false,
        head: report.source?.head,
        cases: report.cases.map(({ id, status }) => ({ id, status })),
        report: reportPath,
      })
    );
  });
  checkpoint();
  let browser;
  try {
    assert.equal(
      process.env.GITHUB_ACTIONS,
      'true',
      'Run this observation only in the genuine diagnostic Actions job'
    );
    assert.equal(process.env.GITHUB_REPOSITORY, 'Proto-UI/Proto-UI');
    assert.match(process.env.GITHUB_RUN_ID ?? '', /^\d+$/);
    assert.match(process.env.CANDIDATE_SHA ?? '', /^[a-f0-9]{40}$/);
    const head = git('rev-parse', 'HEAD');
    assert.equal(head, process.env.CANDIDATE_SHA);
    assert.equal(head, process.env.GITHUB_SHA);
    assert.equal(
      git('status', '--porcelain=v1', '--untracked-files=all'),
      '',
      'The diagnostic checkout must be clean'
    );
    git('ls-files', '--error-unmatch', SCRIPT, 'pnpm-lock.yaml');
    const scriptBytes = await readFile(path.join(root, SCRIPT));
    assert.equal(
      sha256(scriptBytes),
      sha256(execFileSync('git', ['show', `HEAD:${SCRIPT}`], { cwd: root }))
    );
    report.source = {
      head,
      tree: git('rev-parse', 'HEAD^{tree}'),
      clean: true,
      script: {
        path: SCRIPT,
        sha256: sha256(scriptBytes),
        blob: git('rev-parse', `HEAD:${SCRIPT}`),
      },
      lockfile: {
        path: 'pnpm-lock.yaml',
        sha256: sha256(await readFile(path.join(root, 'pnpm-lock.yaml'))),
        blob: git('rev-parse', 'HEAD:pnpm-lock.yaml'),
      },
      actions: {
        repository: process.env.GITHUB_REPOSITORY,
        runId: process.env.GITHUB_RUN_ID,
        runAttempt: process.env.GITHUB_RUN_ATTEMPT,
        workflow: process.env.GITHUB_WORKFLOW,
        ref: process.env.GITHUB_REF,
      },
    };
    assert.ok(process.env.CHROME_PATH, 'CHROME_PATH must identify the actual runner browser');
    process.env.DEBUG = 'pw:protocol';
    process.env.DEBUG_FILE = protocolPath;
    const require = createRequire(path.join(root, 'apps/www/package.json'));
    const playwrightPackagePath = require.resolve('playwright-core/package.json');
    const playwrightPackage = JSON.parse(await readFile(playwrightPackagePath, 'utf8'));
    assert.equal(playwrightPackage.version, '1.58.2');
    const playwrightRoot = path.dirname(playwrightPackagePath);
    report.environment.playwright = {
      version: playwrightPackage.version,
      packageJsonSha256: sha256(await readFile(playwrightPackagePath)),
      protocolLogging: { DEBUG: process.env.DEBUG, DEBUG_FILE: 'playwright-protocol.log' },
      implementationHashes: {},
    };
    for (const name of [
      'lib/server/utils/debugLogger.js',
      'lib/server/chromium/crPage.js',
      'lib/server/chromium/crConnection.js',
    ]) {
      report.environment.playwright.implementationHashes[name] = sha256(
        await readFile(path.join(playwrightRoot, name))
      );
    }
    report.environment.chrome = {
      executable: await realpath(process.env.CHROME_PATH),
      cliVersion: execFileSync(process.env.CHROME_PATH, ['--version'], { encoding: 'utf8' }).trim(),
    };
    const { chromium } = require('playwright-core');
    const launchOptions = {
      executablePath: process.env.CHROME_PATH,
      headless: true,
      timeout: 10000,
      args: ['--no-sandbox'],
    };
    report.environment.launchOptions = launchOptions;
    browser = await chromium.launch(launchOptions);
    report.environment.browser = browser.version();
    const started = performance.now();
    for (const id of CASES) {
      const row = {
        id,
        productAccepted: false,
        status: 'collecting',
        contextOptions:
          id === 'single-cdp-owner'
            ? { viewport: null, serviceWorkers: 'block' }
            : { viewport: VIEWPORT, deviceScaleFactor: 1, serviceWorkers: 'block' },
        samples: [],
        errors: [],
        pageErrors: [],
        cleanupErrors: [],
      };
      report.cases.push(row);
      let context, page, cdp;
      const operation = async (method, params, call) => {
        const record = {
          sequence: report.operations.length,
          case: id,
          method,
          params,
          startedAt: new Date().toISOString(),
          nodeStarted: performance.now(),
        };
        report.operations.push(record);
        try {
          record.response = await bounded(call(), method);
          return record.response;
        } catch (error) {
          record.error = String(error);
          throw error;
        } finally {
          record.nodeEnded = performance.now();
        }
      };
      const send = (method, params = {}) =>
        operation(method, params, () => cdp.send(method, params));
      const sample = async (label) =>
        row.samples.push({
          label,
          nodeTime: performance.now(),
          value: await bounded(
            page.evaluate(() => window.__dprNotificationProbe.read()),
            `sample ${label}`
          ),
        });
      const mark = async (label) => {
        row.samples.push({
          label: `${label}/before`,
          nodeTime: performance.now(),
          value: await bounded(
            page.evaluate((value) => window.__dprNotificationProbe.mark(value), label),
            `mark ${label}`
          ),
        });
      };
      const settle = async (label) => {
        await sample(`${label}/immediate`);
        await bounded(
          page.evaluate(
            () =>
              new Promise((resolve, reject) => {
                let handle;
                const timeout = setTimeout(() => {
                  cancelAnimationFrame(handle);
                  reject(new Error('Two animation frames did not complete'));
                }, 2500);
                handle = requestAnimationFrame(() => {
                  handle = requestAnimationFrame(() => {
                    clearTimeout(timeout);
                    resolve();
                  });
                });
              })
          ),
          'two animation frames',
          3500
        );
        await sample(`${label}/two-animation-frames`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await sample(`${label}/one-second-later`);
      };
      const override = async (label, params) => {
        await mark(label);
        await send('Emulation.setDeviceMetricsOverride', params);
        await settle(label);
      };
      const cleanup = async (label, action) => {
        try {
          await bounded(action(), `cleanup ${label}`);
        } catch (error) {
          row.cleanupErrors.push({ label, error: String(error) });
        }
      };
      try {
        context = await browser.newContext(row.contextOptions);
        page = await context.newPage();
        page.setDefaultTimeout(5000);
        page.on('pageerror', (error) => row.pageErrors.push(String(error)));
        await page.setContent(HTML);
        cdp = await context.newCDPSession(page);
        row.target = await send('Target.getTargetInfo');
        row.browserVersion = await send('Browser.getVersion');
        row.observerInstallation = await bounded(
          page.evaluate(installObservers),
          'install observers'
        );
        assert.ok(
          row.observerInstallation.observerSetup.every(({ accepted }) => accepted),
          'A required native observer could not be installed'
        );
        if (id === 'single-cdp-owner') {
          await override('cdp-set-one', METRICS(1));
        } else {
          await mark('playwright-initial-one');
          await settle('playwright-initial-one');
        }
        await override('cdp-set-two', METRICS(2));
        if (id === 'screenshot-and-cached-override') {
          // Retain the smallest viewport screenshot as a control. The original
          // material suite also uses full-page and oversized locator captures;
          // those enter Chromium's capture-beyond-viewport path separately.
          for (const capture of ['viewport', 'full-page', 'oversized-locator']) {
            const label = `playwright-${capture}-screenshot`;
            await mark(label);
            const screenshotName = `${capture}-screenshot.png`;
            const params = { path: path.join(actualOutput, screenshotName), type: 'png' };
            if (capture !== 'oversized-locator') params.fullPage = capture === 'full-page';
            const method =
              capture === 'oversized-locator'
                ? 'Playwright.locator.screenshot'
                : 'Playwright.page.screenshot';
            await operation(
              method,
              {
                ...params,
                ...(capture === 'oversized-locator' ? { selector: '#probe-area' } : {}),
              },
              async () => {
                const bytes =
                  capture === 'oversized-locator'
                    ? await page.locator('#probe-area').screenshot(params)
                    : await page.screenshot(params);
                return { file: screenshotName, bytes: bytes.length, sha256: sha256(bytes) };
              }
            );
            await settle(label);
            await override(`${capture}/same-cdp-set-two-again`, METRICS(2));
            await mark(`${capture}/cdp-clear-override`);
            await send('Emulation.clearDeviceMetricsOverride');
            await settle(`${capture}/cdp-clear-override`);
            await override(`${capture}/cdp-set-two-after-clear`, METRICS(2));
          }
        }
      } catch (error) {
        row.errors.push(String(error));
      } finally {
        if (page)
          await cleanup('read-observations', async () => {
            row.observations = await page.evaluate(
              () => window.__dprNotificationProbe?.result() ?? null
            );
          });
        if (page)
          await cleanup('dispose-observers', async () => {
            row.afterObserverDisposal = await page.evaluate(
              () => window.__dprNotificationProbe?.dispose() ?? null
            );
          });
        if (cdp) await cleanup('detach-own-cdp', () => cdp.detach());
        if (context) await cleanup('close-context', () => context.close());
        if (
          !row.observations ||
          !row.afterObserverDisposal ||
          row.afterObserverDisposal.final.active !== false
        )
          row.errors.push('Native observer result/disposal is incomplete');
        row.notificationCounts = Object.fromEntries(
          ['window-resize', 'visual-viewport-resize', 'media-query-change', 'resize-observer'].map(
            (kind) => [
              kind,
              row.observations?.events.filter((event) => event.kind === kind).length ?? null,
            ]
          )
        );
        row.status =
          row.errors.length || row.pageErrors.length || row.cleanupErrors.length
            ? 'diagnostic-incomplete'
            : 'observed';
        if (row.status !== 'observed')
          report.failures.push({
            case: id,
            errors: row.errors,
            pageErrors: row.pageErrors,
            cleanupErrors: row.cleanupErrors,
          });
        checkpoint();
      }
    }
    report.observationDurationMs = performance.now() - started;
    assert.deepEqual(
      report.cases.map(({ id }) => id),
      CASES
    );
    assert.equal(git('rev-parse', 'HEAD'), report.source.head);
    assert.equal(git('status', '--porcelain=v1', '--untracked-files=all'), '');
    assert.equal(sha256(await readFile(path.join(root, SCRIPT))), report.source.script.sha256);
    assert.equal(
      sha256(await readFile(path.join(root, 'pnpm-lock.yaml'))),
      report.source.lockfile.sha256
    );
    report.source.verifiedAfterObservation = true;
  } catch (error) {
    report.failures.push({ phase: 'diagnostic', error: String(error) });
  } finally {
    if (browser) {
      try {
        await bounded(browser.close(), 'close browser');
      } catch (error) {
        report.cleanupErrors.push(String(error));
      }
    }
    report.endedAt = new Date().toISOString();
    checkpoint();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 3, 'Usage: node liquid-dpr-notification-probe.mjs OUTPUT_DIR');
  await observe(process.argv[2]);
}

/** Independent source-bound real-browser evidence. No repository writes or shared server reuse. */
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import {
  classifyFrameSamples,
  checkAnimatedRun,
  checkRestingFrame,
  inspectMotion,
  rectNear,
  sha256,
} from './motion-contract.mjs';
const root = path.resolve(process.env.PROTO_UI_TOC_ROOT ?? process.cwd());
const out = path.resolve(process.env.PROTO_UI_TOC_OUT ?? '/tmp/proto-ui-toc-motion');
const expectedHead = process.env.PROTO_UI_EXPECTED_HEAD;
const port = Number(process.env.PROTO_UI_TOC_PORT ?? 4397);
const route = '/zh-cn/start-here/quick-start/';
const moduleAt = (name) => import(pathToFileURL(path.join(root, name)).href);
const { readSourceBinding, routeOwnResponse, allowOwnRequest, sanitizeDiagnostic } = await moduleAt(
  'apps/www/scripts/reading-reference-contract.mjs'
);
const { verifyReadingBuild, startReadingPreview } = await moduleAt(
  'apps/www/scripts/reading-reference-production.mjs'
);
const requireApp = createRequire(path.join(root, 'apps/www/package.json'));
const { chromium } = requireApp('playwright-core');
const report = {
  schemaVersion: 1,
  purpose:
    'Actual shared TOC highlight motion and bounded lifecycle/geometry cost. No overall FPS, CPU, cross-browser or Adapter-parity claim.',
  startedAtUTC: new Date().toISOString(),
  environment: { node: process.version, platform: process.platform, release: os.release() },
  inputAttribution: {
    scroll:
      'Playwright mouse.wheel, browser-applied native scrolling; actual offset captured separately',
    anchor: 'native anchor click',
    family:
      'controlled TOC/native-link family signal; not a family-picker UX or whole-Header settlement claim',
    fontStress: 'injected root font-size reflow, separately labeled; not browser zoom',
    lifecycle: 'controlled remove/reinsert of actual sl-toc; no synthetic product callbacks',
  },
  source: null,
  build: null,
  cases: [],
  failures: [],
  artifacts: [],
  debt: [],
};
await mkdir(out, { recursive: true });
const save = () =>
  writeFile(path.join(out, 'toc-motion.json'), JSON.stringify(report, null, 2) + '\n');
async function artifact(filename, kind) {
  const bytes = await readFile(path.join(out, filename));
  report.artifacts.push({
    path: filename,
    kind,
    sha256: sha256(bytes),
    bytes: bytes.length,
    mtimeUTC: (await stat(path.join(out, filename))).mtime.toISOString(),
  });
}
let browser, preview;
const checks = (entry, messages) => {
  for (const message of messages) {
    entry.failures.push(message);
    report.failures.push(`${entry.name}: ${message}`);
  }
};
// Runs in the actual document. All measurements are read-only. Instrumentation wraps
// original methods without changing arguments, return values or callback ordering.
function installObserver() {
  const host = document.querySelector('.right-sidebar sl-toc') ?? document.querySelector('sl-toc');
  if (!host) throw Error('No sl-toc');
  let uid = 0,
    frameId = 0,
    activeUpdate = null;
  const ids = new WeakMap();
  const id = (node) => {
    if (!node) return null;
    if (!ids.has(node)) ids.set(node, ++uid);
    return ids.get(node);
  };
  const state = {
    host,
    frames: [],
    stage: 'initial',
    sampling: false,
    inputEpoch: 0,
    inputEvents: [],
    updates: [],
    mutations: [],
    events: [],
    readObserver: null,
    originals: [],
    retained: null,
  };
  const rect = (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height });
  state.read = () => {
    const links = [...host.querySelectorAll('a')];
    const visible = links.filter((a) => a.hasAttribute('in-view'));
    const h = host.querySelector('[data-site-toc-highlight]');
    const styles = h ? getComputedStyle(h) : null;
    const first = visible[0]?.getBoundingClientRect(),
      last = visible.at(-1)?.getBoundingClientRect();
    const screenActual = h ? rect(h.getBoundingClientRect()) : null;
    const hostBounds = host.getBoundingClientRect();
    const matrix = styles ? new DOMMatrixReadOnly(styles.transform) : null;
    const actual = matrix
      ? {
          x: matrix.m41,
          y: matrix.m42,
          width: parseFloat(styles.width),
          height: parseFloat(styles.height),
        }
      : null;
    const inlineMatrix = h ? new DOMMatrixReadOnly(h.style.transform || 'none') : null;
    const inlineTarget = inlineMatrix
      ? {
          x: inlineMatrix.m41,
          y: inlineMatrix.m42,
          width: parseFloat(h.style.width),
          height: parseFloat(h.style.height),
        }
      : null;
    const boundary =
      (document.querySelector('header')?.getBoundingClientRect().height ?? 0) +
      (host.querySelector('summary')?.getBoundingClientRect().height ?? 0) +
      32;
    const destinations = links
      .map((link) => ({
        hash: link.hash,
        node: document.getElementById(decodeURIComponent(link.hash.slice(1))),
      }))
      .filter((item) => item.node?.matches('h1,h2,h3,h4,h5,h6'));
    const expectedCurrent =
      destinations.filter((item) => item.node.getBoundingClientRect().top <= boundary).at(-1)
        ?.hash ??
      destinations[0]?.hash ??
      null;
    const target =
      first && last
        ? {
            x: Math.min(first.left, last.left) - hostBounds.left + host.scrollLeft,
            y: first.top - hostBounds.top + host.scrollTop,
            width: Math.max(first.right, last.right) - Math.min(first.left, last.left),
            height: last.bottom - first.top,
          }
        : null;
    const surfaces = h
      ? [...h.children].filter((el) => /^wc-site-.*-surface$/.test(el.localName))
      : [];
    const surface = surfaces[0],
      surfaceStyle = surface ? getComputedStyle(surface) : null;
    return {
      t: performance.now(),
      frameId,
      inputEpoch: state.inputEpoch,
      stage: state.stage,
      scrollY,
      connected: host.isConnected,
      theme: document.documentElement.dataset.theme,
      family: document.documentElement.dataset.siteLibraryFamily,
      viewport: {
        width: innerWidth,
        height: innerHeight,
        dpr: devicePixelRatio,
        scale: visualViewport?.scale,
      },
      expectedCurrent,
      current: links.filter((a) => a.getAttribute('aria-current') === 'true').map((a) => a.hash),
      inView: visible.map((a) => a.hash),
      actual,
      target,
      inlineTarget,
      screenActual,
      hostBounds: rect(hostBounds),
      samplePhase: 'task after animation-frame callbacks',
      highlightCount: host.querySelectorAll('[data-site-toc-highlight]').length,
      highlightId: id(h),
      surfaceCount: surfaces.length,
      surface: surface
        ? {
            tag: surface.localName,
            defined: !!customElements.get(surface.localName),
            id: id(surface),
            backgroundColor: surfaceStyle.backgroundColor,
            borderRadius: surfaceStyle.borderRadius,
            styleTokens: surface.getAttribute('data-pui-style'),
            visibility: surfaceStyle.visibility,
            display: surfaceStyle.display,
            opacity: surfaceStyle.opacity,
            bounds: rect(surface.getBoundingClientRect()),
          }
        : null,
      highlight: h
        ? {
            ariaHidden: h.getAttribute('aria-hidden'),
            pointerEvents: styles.pointerEvents,
            visibility: styles.visibility,
            opacity: styles.opacity,
            transitionProperty: styles.transitionProperty,
            transitionDuration: styles.transitionDuration,
            transform: styles.transform,
            inline: { transform: h.style.transform, width: h.style.width, height: h.style.height },
            ready: h.hasAttribute('data-toc-range-ready'),
            visible: h.hasAttribute('data-toc-range-visible'),
          }
        : null,
    };
  };
  const originalRaf = window.requestAnimationFrame;
  window.requestAnimationFrame = (callback) =>
    originalRaf.call(window, (timestamp) => {
      const before = state.animationTimestamp;
      state.lastAnimationTimestamp = timestamp;
      state.animationTimestamp = timestamp;
      try {
        return callback.call(window, timestamp);
      } finally {
        state.animationTimestamp = before;
      }
    });
  const originalRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function (...args) {
    if (activeUpdate) {
      activeUpdate.order.push('read');
      activeUpdate.reads.push({
        tag: this.localName,
        id: this.id,
        kind:
          this === host
            ? 'toc'
            : this.matches('a')
              ? 'link'
              : this.matches('h1,h2,h3,h4,h5,h6')
                ? 'heading'
                : 'other',
      });
    }
    return originalRect.apply(this, args);
  };
  const originalSet = CSSStyleDeclaration.prototype.setProperty;
  CSSStyleDeclaration.prototype.setProperty = function (...args) {
    if (activeUpdate && this === host.querySelector('[data-site-toc-highlight]')?.style) {
      activeUpdate.order.push('write');
      activeUpdate.writes.push({ property: args[0], value: args[1] });
    }
    return originalSet.apply(this, args);
  };
  for (const method of ['setAttribute', 'removeAttribute']) {
    const original = Element.prototype[method];
    Element.prototype[method] = function (...args) {
      if (
        activeUpdate &&
        host.contains(this) &&
        ['aria-current', 'in-view', 'data-toc-range-visible'].includes(args[0])
      )
        activeUpdate.order.push('write');
      return original.apply(this, args);
    };
  }
  const proto = Object.getPrototypeOf(host),
    originalUpdate = proto.updateVisibleNow;
  if (typeof originalUpdate === 'function')
    proto.updateVisibleNow = function (...args) {
      if (this !== host) return originalUpdate.apply(this, args);
      const update = {
        t: performance.now(),
        frameId,
        animationTimestamp: state.animationTimestamp ?? state.lastAnimationTimestamp,
        renderPhase: state.animationTimestamp === undefined ? 'after-rAF-layout-or-task' : 'rAF',
        stage: state.stage,
        connected: this.isConnected,
        reads: [],
        writes: [],
        order: [],
      };
      activeUpdate = update;
      try {
        return originalUpdate.apply(this, args);
      } finally {
        activeUpdate = null;
        update.duration = performance.now() - update.t;
        state.updates.push(update);
      }
    };
  state.instrumented = typeof originalUpdate === 'function';
  const observer = new MutationObserver((records) => {
    for (const record of records)
      if (record.target.matches?.('[data-site-toc-highlight]'))
        state.mutations.push({
          t: performance.now(),
          frameId,
          attribute: record.attributeName,
          connected: record.target.isConnected,
        });
  });
  observer.observe(host, {
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'data-toc-range-visible', 'data-toc-range-ready'],
  });
  state.readObserver = observer;
  window.addEventListener(
    'scroll',
    (event) =>
      state.events.push({
        t: performance.now(),
        type: 'scroll',
        trusted: event.isTrusted,
        scrollY,
      }),
    { passive: true }
  );
  window.addEventListener(
    'wheel',
    (event) =>
      state.events.push({
        t: performance.now(),
        type: 'wheel',
        trusted: event.isTrusted,
        deltaY: event.deltaY,
        scrollY,
      }),
    { passive: true }
  );
  const tick = (frameTimestamp) => {
    frameId++;
    if (state.sampling) {
      const stage = state.stage;
      const sampledInputEpoch = state.inputEpoch;
      setTimeout(() => {
        if (state.sampling && state.stage === stage) {
          const sample = state.read();
          sample.sampledInputEpoch = sampledInputEpoch;
          sample.frameTimestamp = frameTimestamp;
          sample.samplePhase =
            sampledInputEpoch === sample.inputEpoch
              ? 'task after rAF for the same input epoch'
              : 'input changed after this rAF; diagnostic only';
          state.frames.push(sample);
        }
      }, 0);
    }
    state.raf = requestAnimationFrame(tick);
  };
  state.raf = requestAnimationFrame(tick);
  window.__tocEvidence = state;
}
async function waitFrames(page, n = 30) {
  await page.evaluate(
    (n) =>
      new Promise((resolve) => {
        const next = () => (--n > 0 ? requestAnimationFrame(next) : resolve());
        requestAnimationFrame(next);
      }),
    n
  );
}
async function startStage(page, name) {
  await page.evaluate((name) => {
    const s = window.__tocEvidence;
    s.stage = name;
    s.frames = [];
    s.sampling = true;
  }, name);
}
async function finishStage(page, entry) {
  entry.frames = await page.evaluate(() => {
    const s = window.__tocEvidence;
    s.sampling = false;
    return s.frames;
  });
  entry.inputEpoch = await page.evaluate(() => window.__tocEvidence.inputEpoch);
  const classified = classifyFrameSamples(entry.frames, entry.inputEpoch);
  entry.preFrameDiagnostics = classified.beforeFrame;
  entry.postFrameCount = classified.postFrame.length;
  checks(entry, classified.failures);
  entry.summary = inspectMotion(entry.frames);
  entry.rest = classified.postFrame.at(-1);
  checks(entry, checkRestingFrame(entry.rest));
  const file = `${entry.name}.png`;
  await page.screenshot({ path: path.join(out, file), scale: 'css' });
  await artifact(file, 'actual candidate viewport');
}
async function addCase(name, fn) {
  const entry = { name, failures: [] };
  report.cases.push(entry);
  try {
    await fn(entry);
  } catch (error) {
    checks(entry, [sanitizeDiagnostic(error.stack ?? error)]);
  }
  await save();
  return entry;
}
async function makeContext(options = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    locale: 'zh-CN',
    serviceWorkers: 'block',
    ...options,
  });
  context.on('page', (page) =>
    page.on('pageerror', (error) =>
      report.failures.push(`pageerror: ${sanitizeDiagnostic(error.message)}`)
    )
  );
  await context.route('**/*', (r) =>
    routeOwnResponse(r, report.baseUrl, (failure) =>
      report.failures.push(`network boundary: ${JSON.stringify(failure)}`)
    )
  );
  await context.routeWebSocket('**/*', (socket) => {
    if (allowOwnRequest(socket.url(), report.baseUrl)) socket.connectToServer();
    else socket.close();
  });
  return context;
}
async function ready(page) {
  await page.goto(report.baseUrl + route, { waitUntil: 'networkidle' });
  await observeReady(page);
}
async function observeReady(page) {
  await page.waitForFunction(() => {
    const h = document.querySelector('sl-toc [data-site-toc-highlight]');
    return h?.hasAttribute('data-toc-range-ready') && h?.hasAttribute('data-toc-range-visible');
  });
  await page.evaluate(() => document.fonts.ready);
  // History can restore the same document through BFCache. Reuse that test
  // observer rather than stacking instrumentation over its restored lifetime.
  const alreadyObserved = await page.evaluate(
    () => window.__tocEvidence?.host === document.querySelector('.right-sidebar sl-toc')
  );
  if (!alreadyObserved) await page.evaluate(installObserver);
  await waitFrames(page, 30);
}
async function screencast(page) {
  const client = await page.context().newCDPSession(page);
  const images = [];
  const writes = [];
  await mkdir(path.join(out, 'motion-frames'), { recursive: true });
  client.on('Page.screencastFrame', (event) => {
    const index = images.length;
    const file = `motion-frames/${String(index).padStart(5, '0')}.jpg`;
    images.push({ path: file, timestamp: event.metadata.timestamp });
    writes.push(writeFile(path.join(out, file), Buffer.from(event.data, 'base64')));
    void client.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {});
  });
  await client.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 85,
    maxWidth: 1440,
    maxHeight: 900,
    everyNthFrame: 1,
  });
  return async () => {
    await client.send('Page.stopScreencast');
    await Promise.all(writes);
    await client.detach();
    await writeFile(
      path.join(out, 'screencast-frames.json'),
      JSON.stringify(images, null, 2) + '\n'
    );
    await artifact('screencast-frames.json', 'actual compositor frame timestamps');
    if (images.length > 1) {
      const concat =
        images
          .map(
            (image, index) =>
              `file '${image.path}'\nduration ${Math.max(0.001, (images[index + 1]?.timestamp ?? image.timestamp + 0.05) - image.timestamp)}`
          )
          .join('\n') + `\nfile '${images.at(-1).path}'\n`;
      await writeFile(path.join(out, 'motion-frames.ffconcat'), concat);
      try {
        execFileSync(
          '/usr/bin/ffmpeg',
          [
            '-hide_banner',
            '-loglevel',
            'error',
            '-y',
            '-f',
            'concat',
            '-safe',
            '1',
            '-i',
            'motion-frames.ffconcat',
            '-fps_mode',
            'vfr',
            '-c:v',
            'libvpx-vp9',
            '-crf',
            '34',
            '-b:v',
            '0',
            'toc-motion.webm',
          ],
          { cwd: out, stdio: 'pipe', timeout: 120_000 }
        );
        await artifact(
          'toc-motion.webm',
          'real compositor recording; variable timestamps preserved'
        );
      } catch (error) {
        report.debt.push(
          `Video encoding failed; raw real compositor frames retained: ${sanitizeDiagnostic(error.message)}`
        );
      }
    } else report.failures.push('Compositor recording contains fewer than two frames');
  };
}
try {
  if (process.env.PROTO_UI_BROWSER_BASE_URL)
    throw Error('External/shared server override is refused; own preview only');
  report.source = readSourceBinding(expectedHead, root);
  report.runner = {
    path: path.relative(root, fileURLToPath(import.meta.url)).startsWith('..')
      ? 'external/capture-toc-motion.mjs'
      : path.relative(root, fileURLToPath(import.meta.url)),
    sha256: sha256(await readFile(fileURLToPath(import.meta.url))),
    contractSha256: sha256(await readFile(new URL('./motion-contract.mjs', import.meta.url))),
  };
  report.build = await verifyReadingBuild({
    root,
    out: process.env.PROTO_UI_BUILD_RECEIPT_DIR ?? out,
    expectedHead,
  });
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH ?? '/usr/bin/chromium',
    headless: true,
    args: ['--disable-dev-shm-usage', '--no-sandbox'],
    env: { ...process.env, HOME: os.tmpdir(), XDG_CONFIG_HOME: path.join(out, 'chrome-config') },
  });
  report.environment.browser = browser.version();
  report.environment.playwright = requireApp('playwright-core/package.json').version;
  const owned = await startReadingPreview({ root, port });
  preview = owned.preview;
  report.baseUrl = owned.baseUrl;
  report.server = { mode: owned.mode, address: owned.address };
  const context = await makeContext(),
    page = await context.newPage();
  page.setDefaultTimeout(30_000);
  await ready(page);
  await addCase('initial', async (entry) => {
    await startStage(page, entry.name);
    await waitFrames(page, 6);
    await finishStage(page, entry);
  });
  const stopRecording = await screencast(page);
  for (const [name, direction] of [
    ['continuous-forward', 1],
    ['continuous-reverse', -1],
  ]) {
    await addCase(name, async (entry) => {
      await startStage(page, name);
      await page.mouse.move(700, 550);
      for (let n = 0; n < 14; n++) {
        await page.mouse.wheel(0, 220 * direction);
        await waitFrames(page, 5);
      }
      await waitFrames(page, 30);
      await finishStage(page, entry);
      checks(entry, checkAnimatedRun(entry.frames).failures);
      if (entry.summary.scrollMax - entry.summary.scrollMin < 500)
        checks(entry, ['Wheel input did not produce substantial actual document movement']);
    });
  }
  await addCase('native-anchor', async (entry) => {
    await startStage(page, entry.name);
    const links = page.locator('.right-sidebar sl-toc a');
    const target = links.nth(Math.min(3, (await links.count()) - 1));
    entry.expectedHash = await target.getAttribute('href');
    await target.click();
    await waitFrames(page, 55);
    await finishStage(page, entry);
    entry.actualHash = await page.evaluate(() => location.hash);
    if (decodeURIComponent(entry.actualHash) !== decodeURIComponent(entry.expectedHash))
      checks(entry, ['Native anchor hash did not reach target']);
  });
  await addCase('viewport-resize', async (entry) => {
    await startStage(page, entry.name);
    await page.setViewportSize({ width: 1366, height: 760 });
    await waitFrames(page, 40);
    await finishStage(page, entry);
  });
  await page.setViewportSize({ width: 1600, height: 900 });
  await waitFrames(page, 30);
  await addCase('font-reflow-stress', async (entry) => {
    await startStage(page, entry.name);
    entry.before = await page.evaluate(() => window.__tocEvidence.read());
    entry.trigger = await page.evaluate(() => {
      const state = window.__tocEvidence;
      const event = { kind: 'root-font-size', epoch: ++state.inputEpoch, t: performance.now() };
      state.inputEvents.push(event);
      document.documentElement.style.fontSize = '112.5%';
      return event;
    });
    await page.evaluate(() => document.fonts.ready);
    await waitFrames(page, 40);
    await finishStage(page, entry);
    entry.measuredGeometryChanged = !rectNear(entry.before.target, entry.rest.target);
    entry.attribution =
      'Controlled larger-text CSS reflow; fonts.ready awaited. Not a browser zoom or delayed font loading test.';
  });
  await stopRecording();
  await page.evaluate(() => document.documentElement.style.removeProperty('font-size'));
  await waitFrames(page, 35);
  await addCase('native-theme-toggle', async (entry) => {
    entry.before = await page.evaluate(() => window.__tocEvidence.read());
    await startStage(page, entry.name);
    await page.locator('[data-theme-toggle]').first().click();
    await waitFrames(page, 35);
    await finishStage(page, entry);
    if (entry.before.theme === entry.rest.theme)
      checks(entry, ['Native theme toggle did not change theme']);
  });
  await addCase('family-replacement', async (entry) => {
    await startStage(page, entry.name);
    entry.before = await page.evaluate(() => window.__tocEvidence.read());
    await page.evaluate(() => {
      document.documentElement.dataset.siteLibraryFamily = 'brutalist';
      document
        .querySelectorAll('[data-site-family-scope]')
        .forEach((scope) => (scope.dataset.siteLibraryFamily = 'brutalist'));
    });
    await waitFrames(page, 35);
    await finishStage(page, entry);
    if (entry.rest.surface?.tag !== 'wc-site-brutalist-surface')
      checks(entry, ['Family signal did not remount a Brutalist Surface']);
    if (entry.rest.highlightId !== entry.before.highlightId)
      checks(entry, ['Family changed the shared geometry owner']);
    if (entry.rest.surface?.id === entry.before.surface?.id)
      checks(entry, ['Family kept the stale Surface owner']);
  });
  await addCase('idle-budget', async (entry) => {
    await waitFrames(page, 30);
    const before = await page.evaluate(() => ({
      updates: window.__tocEvidence.updates.length,
      mutations: window.__tocEvidence.mutations.length,
    }));
    await waitFrames(page, 60);
    const after = await page.evaluate(() => ({
      updates: window.__tocEvidence.updates.length,
      mutations: window.__tocEvidence.mutations.length,
    }));
    entry.observedFrames = 60;
    entry.delta = {
      updates: after.updates - before.updates,
      mutations: after.mutations - before.mutations,
    };
    if (entry.delta.updates || entry.delta.mutations)
      checks(entry, [
        'Quiescent TOC continued scheduling geometry or writing highlight attributes',
      ]);
  });
  await addCase('detach-reconnect', async (entry) => {
    await page.evaluate(() => {
      const s = window.__tocEvidence;
      s.retained = { parent: s.host.parentNode, next: s.host.nextSibling };
      window.dispatchEvent(new Event('resize'));
      s.host.remove();
      s.detachStart = s.updates.length;
    });
    await waitFrames(page, 30);
    entry.detached = await page.evaluate(() => {
      const s = window.__tocEvidence;
      return {
        connected: s.host.isConnected,
        updates: s.updates.slice(s.detachStart),
        rangeVisible: s.host
          .querySelector('[data-site-toc-highlight]')
          ?.hasAttribute('data-toc-range-visible'),
      };
    });
    if (entry.detached.connected || entry.detached.updates.length || entry.detached.rangeVisible)
      checks(entry, ['Detached TOC retained geometry activity/visibility']);
    await page.evaluate(() => {
      const s = window.__tocEvidence;
      s.retained.parent.insertBefore(s.host, s.retained.next);
    });
    await waitFrames(page, 40);
    await startStage(page, entry.name);
    await page.mouse.wheel(0, 350);
    await waitFrames(page, 40);
    await finishStage(page, entry);
    entry.attribution =
      'Actual connectedCallback/disconnectedCallback after controlled DOM replacement; resize event is synthetic and disclosed';
  });
  report.performance = await page.evaluate(() => {
    const s = window.__tocEvidence;
    return {
      instrumented: s.instrumented,
      updates: s.updates,
      mutations: s.mutations,
      events: s.events,
    };
  });
  if (!report.performance.instrumented)
    report.failures.push(
      'Product updateVisibleNow could not be instrumented; no method-count claim'
    );
  for (const update of report.performance.updates) {
    const extraRects = update.reads.filter((r) => r.kind === 'toc' || r.kind === 'link').length;
    if (
      update.order.indexOf('write') >= 0 &&
      update.order.slice(update.order.indexOf('write')).includes('read')
    )
      report.failures.push(
        'Layout rect read followed a TOC state/geometry write within one update'
      );
    if (extraRects > 3)
      report.failures.push(`TOC update added ${extraRects} range rect reads, exceeding three`);
    if (update.writes.length > 3)
      report.failures.push(
        `TOC update wrote ${update.writes.length} geometry properties, exceeding three`
      );
    if (update.writes.some((w) => !['transform', 'width', 'height'].includes(w.property)))
      report.failures.push('TOC wrote unexpected geometry property');
  }
  const normalUpdates = report.performance.updates.filter((update) =>
    ['continuous-forward', 'continuous-reverse'].includes(update.stage)
  );
  for (const stage of ['continuous-forward', 'continuous-reverse'])
    if (!normalUpdates.some((update) => update.stage === stage))
      report.failures.push(`No instrumented product updates during ${stage}`);
  report.performance.normalUpdateCount = normalUpdates.length;
  const frameCounts = new Map();
  for (const update of normalUpdates) {
    if (!Number.isFinite(update.animationTimestamp))
      report.failures.push('Continuous-scroll update has no measured animation-frame timestamp');
    // Include layout/ResizeObserver updates in their actual rendering frame,
    // rather than grouping every non-rAF callback into one undefined bucket.
    frameCounts.set(
      update.animationTimestamp,
      (frameCounts.get(update.animationTimestamp) ?? 0) + 1
    );
  }
  report.performance.maxUpdatesPerMeasuredFrame = Math.max(0, ...frameCounts.values());
  if (report.performance.maxUpdatesPerMeasuredFrame > 1)
    report.failures.push(
      'More than one TOC update was observed per animation frame during continuous wheel input'
    );
  report.performance.costBoundary =
    'Rect/write counts only inside actual updateVisibleNow; observer reads are excluded. Sampling overhead makes this unsuitable as an FPS or CPU benchmark.';
  await context.close();
  for (const family of ['shadcn', 'brutalist'])
    for (const theme of ['light', 'dark'])
      for (const motion of ['no-preference', 'reduce']) {
        const matrixContext = await makeContext({ reducedMotion: motion }),
          matrixPage = await matrixContext.newPage();
        await addCase(`matrix-${family}-${theme}-${motion}`, async (entry) => {
          entry.requested = { family, theme, motion };
          await ready(matrixPage);
          if ((await matrixPage.evaluate(() => document.documentElement.dataset.theme)) !== theme)
            await matrixPage.locator('[data-theme-toggle]').first().click();
          await matrixPage.evaluate((family) => {
            document.documentElement.dataset.siteLibraryFamily = family;
            document
              .querySelectorAll('[data-site-family-scope]')
              .forEach((scope) => (scope.dataset.siteLibraryFamily = family));
          }, family);
          await waitFrames(matrixPage, 35);
          entry.initial = await matrixPage.evaluate(() => window.__tocEvidence.read());
          checks(entry, checkRestingFrame(entry.initial));
          await startStage(matrixPage, entry.name);
          await matrixPage.mouse.move(700, 550);
          for (const direction of [1, -1]) {
            for (let n = 0; n < 9; n++) {
              await matrixPage.mouse.wheel(0, 240 * direction);
              await waitFrames(matrixPage, 5);
            }
            await waitFrames(matrixPage, 25);
          }
          const anchor = matrixPage.locator('.right-sidebar sl-toc a').nth(3);
          entry.expectedHash = await anchor.getAttribute('href');
          await anchor.click();
          await waitFrames(matrixPage, 50);
          await finishStage(matrixPage, entry);
          entry.actualHash = await matrixPage.evaluate(() => location.hash);
          if (decodeURIComponent(entry.actualHash) !== decodeURIComponent(entry.expectedHash))
            checks(entry, ['Native anchor hash mismatch']);
          if (entry.rest.theme !== theme || entry.rest.surface?.tag !== `wc-site-${family}-surface`)
            checks(entry, ['Observed theme/family does not match requested matrix mode']);
          entry.media = await matrixPage.evaluate(
            () => matchMedia('(prefers-reduced-motion: reduce)').matches
          );
          if (entry.media !== (motion === 'reduce'))
            checks(entry, ['Reduced-motion media mismatch']);
          if (motion === 'no-preference') checks(entry, checkAnimatedRun(entry.frames).failures);
          else {
            if (
              entry.frames.some((frame) =>
                frame.highlight?.transitionDuration
                  .split(',')
                  .some((duration) => parseFloat(duration) > 0)
              )
            )
              checks(entry, ['Reduced-motion retained nonzero transition duration']);
            const interpolated = entry.frames.filter(
              (frame) =>
                frame.actual &&
                frame.inlineTarget &&
                !rectNear(frame.actual, frame.inlineTarget, 0.1)
            );
            entry.reducedIntermediateFrames = interpolated.length;
            if (interpolated.length)
              checks(entry, [
                `Reduced-motion has ${interpolated.length} real intermediate geometry samples`,
              ]);
            if (entry.summary.targetChanges < 1)
              checks(entry, ['Reduced-motion inputs did not change the range target']);
          }
        });
        await matrixContext.close();
      }
  const navigationContext = await makeContext(),
    navigationPage = await navigationContext.newPage();
  await ready(navigationPage);
  await addCase('native-library-navigation-brutalist', async (entry) => {
    entry.attribution =
      'Native sidebar link into the supported Brutalist documentation route; no family signal injection.';
    entry.before = await navigationPage.evaluate(() => window.__tocEvidence.read());
    const destination = '/zh-cn/ui-libraries/brutalist/design-contract/';
    const link = navigationPage.locator(`.sidebar-pane a[href="${destination}"]`).first();
    const ancestors = link.locator('xpath=ancestor::details');
    for (let index = 0; index < (await ancestors.count()); index++) {
      const details = ancestors.nth(index);
      if (!(await details.evaluate((element) => element.open)))
        await details.locator(':scope > summary').click();
    }
    await Promise.all([navigationPage.waitForURL(report.baseUrl + destination), link.click()]);
    await observeReady(navigationPage);
    await startStage(navigationPage, entry.name);
    await navigationPage.mouse.move(700, 550);
    for (let index = 0; index < 8; index++) {
      await navigationPage.mouse.wheel(0, 180);
      await waitFrames(navigationPage, 5);
    }
    const anchor = navigationPage.locator('.right-sidebar sl-toc a').nth(1);
    entry.expectedHash = await anchor.getAttribute('href');
    await anchor.click();
    await waitFrames(navigationPage, 40);
    await finishStage(navigationPage, entry);
    entry.actualURL = navigationPage.url();
    entry.headerFamilyInputs = await navigationPage
      .locator('header [data-site-control-family]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-site-control-family')));
    if (
      entry.before.surface?.tag !== 'wc-site-shadcn-surface' ||
      entry.rest.surface?.tag !== 'wc-site-brutalist-surface'
    )
      checks(entry, ['Real library navigation did not acquire the route-owned TOC family']);
    if (
      decodeURIComponent(new URL(entry.actualURL).hash) !== decodeURIComponent(entry.expectedHash)
    )
      checks(entry, ['Real Brutalist-route native anchor failed']);
  });
  await addCase('native-library-history-return', async (entry) => {
    for (let index = 0; index < 2 && new URL(navigationPage.url()).pathname !== route; index++)
      await navigationPage.goBack({ waitUntil: 'domcontentloaded' });
    if (new URL(navigationPage.url()).pathname !== route)
      throw Error('Native Back did not return to the Shadcn documentation route');
    await observeReady(navigationPage);
    await startStage(navigationPage, entry.name);
    await navigationPage.mouse.wheel(0, 350);
    await waitFrames(navigationPage, 40);
    await finishStage(navigationPage, entry);
    if (entry.rest.surface?.tag !== 'wc-site-shadcn-surface')
      checks(entry, ['Returned page retained the wrong TOC family']);
  });
  await addCase('native-library-history-forward-keyboard', async (entry) => {
    await navigationPage.goForward({ waitUntil: 'domcontentloaded' });
    if (new URL(navigationPage.url()).pathname !== '/zh-cn/ui-libraries/brutalist/design-contract/')
      throw Error('Native Forward did not restore the Brutalist documentation route');
    await observeReady(navigationPage);
    const anchor = navigationPage.locator('.right-sidebar sl-toc a').nth(1);
    entry.expectedHash = await anchor.getAttribute('href');
    // Focus is assigned by the harness; activation itself is a native Enter.
    entry.attribution =
      'Browser Forward restores the real library route; harness focuses its native TOC anchor, then real keyboard Enter activates it. Not a full Tab-order claim.';
    await anchor.focus();
    await startStage(navigationPage, entry.name);
    await navigationPage.keyboard.press('Enter');
    await waitFrames(navigationPage, 40);
    await finishStage(navigationPage, entry);
    entry.actualHash = new URL(navigationPage.url()).hash;
    if (
      entry.rest.surface?.tag !== 'wc-site-brutalist-surface' ||
      decodeURIComponent(entry.actualHash) !== decodeURIComponent(entry.expectedHash)
    )
      checks(entry, [
        'Forward/keyboard did not restore the route-owned TOC and native destination',
      ]);
  });
  await navigationContext.close();
  const nojs = await makeContext({ javaScriptEnabled: false }),
    nojsPage = await nojs.newPage();
  await addCase('no-javascript', async (entry) => {
    await nojsPage.goto(report.baseUrl + route, { waitUntil: 'networkidle' });
    const links = nojsPage.locator('.right-sidebar sl-toc a');
    entry.linkCount = await links.count();
    if (entry.linkCount < 2) checks(entry, ['SSR native TOC links missing']);
    const link = links.nth(1);
    entry.expectedHash = await link.getAttribute('href');
    await link.click();
    entry.actualHash = new URL(nojsPage.url()).hash;
    entry.geometry = await nojsPage.locator('[data-site-toc-highlight]').evaluateAll((nodes) =>
      nodes.map((h) => ({
        visibility: getComputedStyle(h).visibility,
        opacity: getComputedStyle(h).opacity,
        ready: h.hasAttribute('data-toc-range-ready'),
      }))
    );
    if (entry.geometry.some((h) => h.ready || (h.visibility !== 'hidden' && h.opacity !== '0')))
      checks(entry, ['Unenhanced shared mount paints with JavaScript disabled']);
    if (decodeURIComponent(entry.actualHash) !== decodeURIComponent(entry.expectedHash))
      checks(entry, ['SSR native anchor failed']);
    await nojsPage.screenshot({ path: path.join(out, 'no-javascript.png'), scale: 'css' });
    await artifact('no-javascript.png', 'actual no-JavaScript page');
  });
  await nojs.close();
  const fontContext = await makeContext(),
    fontPage = await fontContext.newPage();
  await addCase('delayed-webfont-completion', async (entry) => {
    let release;
    const gate = new Promise((resolve) => (release = resolve));
    const held = [];
    let released = false;
    await fontContext.route('**/*', async (request) => {
      if (
        !released &&
        request.request().resourceType() === 'font' &&
        allowOwnRequest(request.request().url(), report.baseUrl)
      ) {
        held.push(new URL(request.request().url()).pathname);
        await gate;
      }
      await routeOwnResponse(request, report.baseUrl, (failure) =>
        checks(entry, [`network boundary: ${JSON.stringify(failure)}`])
      );
    });
    try {
      await fontPage.goto(report.baseUrl + route, { waitUntil: 'domcontentloaded' });
      await fontPage.waitForFunction(() => document.querySelector('sl-toc [data-toc-range-ready]'));
      await fontPage.evaluate(installObserver);
      entry.attribution =
        'Controlled use of the existing self-hosted DM Sans FontFace and --font-sans input; real own-site font bytes are delayed, never a synthetic loading event.';
      await fontPage.evaluate(() => {
        document.documentElement.style.setProperty(
          '--font-sans',
          '"DM Sans", ui-sans-serif, sans-serif'
        );
        window.__tocEvidence.requestedFont = document.fonts.load('16px "DM Sans"', 'Proto UI');
      });
      await fontPage.waitForFunction(() => document.fonts.status === 'loading');
      await waitFrames(fontPage, 8);
      entry.before = await fontPage.evaluate(() => ({
        frame: window.__tocEvidence.read(),
        fontStatus: document.fonts.status,
      }));
      entry.heldFontPaths = [...new Set(held)];
      await fontPage.evaluate(() => {
        window.__tocEvidence.fontEvents = [];
        document.fonts.addEventListener('loadingdone', (event) =>
          window.__tocEvidence.fontEvents.push({
            t: performance.now(),
            count: event.fontfaces.length,
          })
        );
      });
      await startStage(fontPage, entry.name);
      released = true;
      release();
      entry.loadedFaces = await fontPage.evaluate(async () =>
        (await window.__tocEvidence.requestedFont).map((font) => ({
          family: font.family,
          status: font.status,
        }))
      );
      await fontPage.evaluate(() => document.fonts.ready);
      await waitFrames(fontPage, 35);
      await finishStage(fontPage, entry);
      entry.after = await fontPage.evaluate(() => ({
        fontStatus: document.fonts.status,
        fontEvents: window.__tocEvidence.fontEvents,
        faces: [...document.fonts].map((font) => ({ family: font.family, status: font.status })),
      }));
      entry.measuredGeometryChanged = !rectNear(entry.before.frame.target, entry.rest.target);
      if (
        !entry.loadedFaces?.some((face) => face.family === 'DM Sans' && face.status === 'loaded') ||
        !entry.heldFontPaths.length ||
        entry.before.fontStatus !== 'loading' ||
        entry.after.fontStatus !== 'loaded' ||
        !entry.after.fontEvents.length
      )
        checks(entry, [
          'Did not demonstrate an actual delayed own-site webfont loading-to-loaded event',
        ]);
      if (entry.after.faces.some((font) => font.status === 'error'))
        checks(entry, ['Real delayed font failed to load']);
    } finally {
      released = true;
      release();
      await fontContext.close();
    }
  });
  report.sourceAfter = readSourceBinding(expectedHead, root);
  await verifyReadingBuild({
    root,
    out: process.env.PROTO_UI_BUILD_RECEIPT_DIR ?? out,
    expectedHead,
  });
  report.debt.push(
    'Historical 411c354cfb motion comparison was not executed by this candidate-only runner. Screenshot/video visual inspection remains required before publication.'
  );
  report.outOfScope = [
    'Safari/Firefox',
    'mobile TOC',
    'screen-reader',
    'production-wide CPU/FPS benchmark',
  ];
} catch (error) {
  report.failures.push(sanitizeDiagnostic(error.stack ?? error));
} finally {
  await browser?.close().catch(() => {});
  await preview?.stop().catch(() => {});
  report.finishedAtUTC = new Date().toISOString();
  report.status = report.failures.length ? 'failed' : report.debt.length ? 'partial' : 'passed';
  await save();
  console.log(JSON.stringify({ status: report.status, failures: report.failures, out }, null, 2));
  if (report.failures.length) process.exitCode = 1;
}

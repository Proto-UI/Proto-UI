// Bounded same-tree diagnostic. Importing this file opens no server or browser.
// Observer/result/distribution approach adapted from the read-only #846 probe;
// historical reports, historical source cohorts and timing results are not reused.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, writeFile, readdir, mkdir, stat, cp } from 'node:fs/promises';
import { validateIndexPair, validateResultLinks } from './search-intent-index.mjs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const BASE_SHA = '4a2320762ba5f4319dec1915ca4e138772dceb0c';
export const PRODUCT_PATHS = Object.freeze([
  'apps/www/src/components/override/Search.astro',
  'apps/www/src/components/site-search-commands.ts',
]);
export const PLAN = Object.freeze({
  route: '/zh-cn/ui-libraries/shadcn/button/',
  samples: 5,
  naturalModes: Object.freeze(['immediate', 'pointer', 'focus']),
  controls: Object.freeze([
    'no-intent',
    'touch',
    'head503',
    'intent-head503',
    'close-pending',
    'dispose-pending',
  ]),
  intentLeadMs: 250,
  startupObservationMs: 2000,
  operationTimeoutMs: 10_000,
  sampleTimeoutMs: 20_000,
  totalTimeoutMs: 600_000,
  openerAcceptanceMs: 1000,
});
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const git = (root, ...args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).trim();
// Git's line-oriented output quotes Unicode/control characters. NUL-delimited
// machine output preserves actual filenames, including whitespace and newlines.
const gitPaths = (root, ...args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
    .split('\0')
    .filter((name) => name !== '');
const json = (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n');

export function semanticResult(href, text, origin) {
  try {
    const url = new URL(href, origin);
    return (
      url.origin === origin &&
      /\/zh-cn\/ui-libraries\/(shadcn|base|brutalist\/components)\/button\/?$/.test(url.pathname) &&
      /button/i.test(text)
    );
  } catch {
    return false;
  }
}
export function distribution(values) {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  const at = (q) => (finite.length ? finite[Math.ceil(q * finite.length) - 1] : null);
  return {
    attempted: values.length,
    observed: finite.length,
    missing: values.length - finite.length,
    min: finite[0] ?? null,
    median: at(0.5),
    p90: at(0.9),
    max: finite.at(-1) ?? null,
    samples: values,
    quantileMethod: 'nearest rank; missing retained, no imputation; descriptive only',
  };
}
export function cohortDistribution(cohort, metric, planned = PLAN.samples) {
  return distribution(
    Array.from({ length: planned }, (_, index) =>
      cohort[index]?.status === 'complete' ? (cohort[index].metrics?.[metric] ?? null) : null
    )
  );
}
export function validatePairFiles(a, b) {
  assert.deepEqual(
    Object.keys(a).sort(),
    Object.keys(b).sort(),
    'Both checkouts must contain the same tracked paths'
  );
  const changed = Object.keys(a)
    .filter((file) => a[file] !== b[file])
    .sort();
  assert.deepEqual(
    changed,
    [...PRODUCT_PATHS].sort(),
    'Only the two Search product files may differ'
  );
}
export function validateIndexes(a, b) {
  assert.ok(
    Object.keys(a).some((name) => name.endsWith('.pf_index')),
    'Real generated Pagefind index is required'
  );
  assert.ok(Object.hasOwn(a, 'pagefind.js'), 'Real generated Pagefind runtime is required');
  assert.deepEqual(a, b, 'A/B Pagefind runtime, index, metadata and fragment bytes must match');
}
async function fileMap(root, files) {
  const entries = new Array(files.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(16, files.length) }, async () => {
      for (;;) {
        const index = next++;
        if (index >= files.length) return;
        entries[index] = [files[index], sha256(await readFile(path.join(root, files[index])))];
      }
    })
  );
  return Object.fromEntries(entries);
}
async function walk(root, relative = '') {
  const result = [];
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    const name = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) result.push(...(await walk(root, name)));
    else {
      assert.ok(entry.isFile(), 'Build evidence cannot contain symbolic links');
      result.push(name);
    }
  }
  return result.sort();
}
export async function sourcePairFiles(baseline, candidate, expectedSha) {
  assert.match(expectedSha ?? '', /^[a-f0-9]{40}$/, 'Exact candidate SHA is required');
  for (const root of [baseline, candidate])
    assert.equal(git(root, 'rev-parse', 'HEAD'), expectedSha);
  assert.equal(
    git(candidate, 'status', '--porcelain', '--untracked-files=all'),
    '',
    'Candidate checkout must be clean'
  );
  const baselineChanged = gitPaths(baseline, 'diff', '--name-only', '-z', 'HEAD').sort();
  assert.deepEqual(
    baselineChanged,
    [...PRODUCT_PATHS].sort(),
    'Baseline is the candidate tree with exactly the two Search files reverted'
  );
  assert.deepEqual(
    gitPaths(baseline, 'ls-files', '-z', '--others', '--exclude-standard'),
    [],
    'Unexpected baseline source files'
  );
  const pathsA = gitPaths(baseline, 'ls-files', '-z');
  const pathsB = gitPaths(candidate, 'ls-files', '-z');
  const [a, b] = await Promise.all([fileMap(baseline, pathsA), fileMap(candidate, pathsB)]);
  validatePairFiles(a, b);
  return { a, b };
}
export async function sourceBoundary(baseline, candidate, expectedSha) {
  const { a, b } = await sourcePairFiles(baseline, candidate, expectedSha);
  for (const file of PRODUCT_PATHS)
    assert.equal(
      a[file],
      sha256(execFileSync('git', ['show', `${BASE_SHA}:${file}`], { cwd: baseline })),
      `Baseline ${file} must match its pinned source bytes`
    );
  return {
    candidateSha: expectedSha,
    baseline: {
      sameTreeSha: expectedSha,
      searchFilesFrom: BASE_SHA,
      productFiles: Object.fromEntries(PRODUCT_PATHS.map((file) => [file, a[file]])),
    },
    candidate: {
      sameTreeSha: expectedSha,
      productFiles: Object.fromEntries(PRODUCT_PATHS.map((file) => [file, b[file]])),
    },
    otherTrackedFilesSha256: sha256(
      JSON.stringify(
        Object.fromEntries(Object.entries(b).filter(([file]) => !PRODUCT_PATHS.includes(file)))
      )
    ),
    changedPaths: [...PRODUCT_PATHS],
  };
}
export async function buildBoundary(root) {
  const dist = path.join(root, 'apps/www/dist');
  const index = await fileMap(path.join(dist, 'pagefind'), await walk(path.join(dist, 'pagefind')));
  const uiAssets = [];
  for (const file of await walk(path.join(dist, '_astro'))) {
    if (!file.endsWith('.js')) continue;
    const body = await readFile(path.join(dist, '_astro', file), 'utf8');
    if (
      body.includes('pagefind-ui__form') &&
      body.includes('pagefind-ui__drawer') &&
      body.includes('pagefind-ui__search-input')
    )
      uiAssets.push({
        path: '/_astro/' + file,
        sha256: sha256(body),
        bytes: Buffer.byteLength(body),
      });
  }
  assert.equal(
    uiAssets.length,
    1,
    'Identify one real default-ui bundle by its three Pagefind UI markers'
  );
  return {
    index,
    uiAssets,
    nativeHtml: await fileMap(
      dist,
      (await walk(dist)).filter((file) => file.endsWith('.html'))
    ),
    routeHtmlSha256: sha256(await readFile(path.join(dist, PLAN.route, 'index.html'))),
  };
}

// Facts only: no product methods, styles, readiness or focus are overwritten.
export function observeSearch() {
  const data = {
    open: [],
    input: [],
    intent: [],
    query: null,
    result: null,
    resultMatches: [],
    opener: null,
    dcl: null,
    uiBeforeOpen: false,
    firstNativeOpenObserved: false,
    unexpectedOpen: false,
    events: [],
    longTasks: [],
  };
  window.__intentSearch = data;
  const visible = (el) => {
    if (!el?.isConnected || el.closest('[inert], [data-projection-generation-state="staging"]'))
      return false;
    for (let node = el; node; node = node.parentElement) {
      const s = getComputedStyle(node);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0)
        return false;
    }
    const box = el.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  };
  const enabled = (el) => el && !el.disabled && el.getAttribute('aria-disabled') !== 'true';
  const beforeOpen = () => {
    const dialog = document.querySelector('site-search dialog');
    if (
      !data.firstNativeOpenObserved &&
      !dialog?.open &&
      document.querySelector('#starlight__search')?.childElementCount
    )
      data.uiBeforeOpen = true;
    if (!data.open.length && dialog?.open) data.unexpectedOpen = true;
  };
  const mutation = new MutationObserver((records = []) => {
    // Mutation records preserve operation order even when constructor DOM and
    // showModal happen in the same task. Looking only at final dialog.open
    // would conceal a constructor that ran before the first native opening.
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const dialog = document.querySelector('site-search dialog');
      if (
        record.type === 'attributes' &&
        record.target === dialog &&
        record.attributeName === 'open'
      ) {
        const next = records
          .slice(i + 1)
          .find(
            (entry) =>
              entry.type === 'attributes' &&
              entry.target === dialog &&
              entry.attributeName === 'open'
          );
        const opened = next ? next.oldValue !== null : dialog.open;
        if (opened) {
          data.firstNativeOpenObserved = true;
          if (!data.open.length) data.unexpectedOpen = true;
        }
      }
      if (
        !data.firstNativeOpenObserved &&
        record.type === 'childList' &&
        (record.target.id === 'starlight__search' ||
          record.target.closest?.('#starlight__search')) &&
        [...record.addedNodes].some((node) => node.nodeType === 1)
      )
        data.uiBeforeOpen = true;
    }
    beforeOpen();
  });
  mutation.observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ['open'],
  });
  const record = (event) => {
    beforeOpen();
    const target = event.target instanceof Element ? event.target : null;
    const command = target?.closest(
      '[data-open-modal], .search-failure__retry, [data-close-modal]'
    );
    if (event.isTrusted && command) {
      const name = command.hasAttribute('data-open-modal')
        ? 'open'
        : command.hasAttribute('data-close-modal')
          ? 'close'
          : 'retry';
      if (data.events.length < 100)
        data.events.push({
          type: event.type,
          command: name,
          at: performance.now(),
          key: event.key,
        });
      if (name === 'open' && ['pointerover', 'focusin', 'touchstart'].includes(event.type))
        data.intent.push({ type: event.type, at: performance.now() });
      if (
        (event.type === 'click' ||
          (event.type === 'keydown' && ['Enter', ' '].includes(event.key))) &&
        name === 'open' &&
        !document.querySelector('site-search dialog')?.open
      )
        data.open.push(performance.now());
    }
    if (
      event.isTrusted &&
      event.type === 'keydown' &&
      (event.ctrlKey || event.metaKey) &&
      event.key === 'k' &&
      !document.querySelector('site-search dialog')?.open
    )
      data.open.push(performance.now());
    if (
      event.type === 'input' &&
      target?.matches('.pagefind-ui__search-input') &&
      target.value === 'Button' &&
      data.query === null
    )
      data.query = performance.now();
  };
  for (const type of ['click', 'keydown', 'pointerover', 'focusin', 'touchstart', 'input'])
    window.addEventListener(type, record, true);
  window.addEventListener(
    'DOMContentLoaded',
    () => {
      data.dcl = performance.now();
    },
    { once: true }
  );
  let timing;
  try {
    timing = new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        if (data.longTasks.length < 200)
          data.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
    });
    timing.observe({ type: 'longtask', buffered: true });
  } catch {}
  let frame;
  const tick = () => {
    beforeOpen();
    const opener = document.querySelector(
      'site-search [data-projection-generation-state="active"] [data-open-modal]'
    );
    if (
      data.opener === null &&
      customElements.get('site-search') &&
      visible(opener) &&
      enabled(opener)
    )
      data.opener = performance.now();
    const input = document.querySelector('site-search .pagefind-ui__search-input');
    const index = data.open.length - 1;
    if (
      index >= 0 &&
      data.input[index] === undefined &&
      document.querySelector('site-search dialog')?.open &&
      visible(input) &&
      enabled(input) &&
      !input.readOnly &&
      document.activeElement === input
    )
      data.input[index] = performance.now();
    if (data.query !== null && data.result === null) {
      const matches = [
        ...document.querySelectorAll('site-search .pagefind-ui__result-link'),
      ].filter((el) => {
        const url = new URL(el.href, location.href);
        return (
          visible(el) &&
          url.origin === location.origin &&
          /\/zh-cn\/ui-libraries\/(shadcn|base|brutalist\/components)\/button\/?$/.test(
            url.pathname
          ) &&
          /button/i.test(el.textContent ?? '')
        );
      });
      if (matches.length) {
        data.result = performance.now();
        data.resultMatches = matches.map((el) => ({ href: el.href, text: el.textContent.trim() }));
      }
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  window.__stopIntentSearch = () => {
    cancelAnimationFrame(frame);
    mutation.disconnect();
    timing?.disconnect();
  };
}

export function requestTiming(event) {
  assert.ok(
    Number.isFinite(event.wallTime) && Number.isFinite(event.timestamp),
    'Request clock mapping requires finite CDP wall and monotonic clocks'
  );
  return {
    atEpochMs: event.wallTime * 1000,
    clockOffsetMs: (event.wallTime - event.timestamp) * 1000,
  };
}
export function completionTiming(request, event) {
  assert.ok(
    Number.isFinite(request.clockOffsetMs) && Number.isFinite(event.timestamp),
    'Completion requires the recorded request clock mapping'
  );
  assert.ok(
    Number.isFinite(event.encodedDataLength) && event.encodedDataLength >= 0,
    'Completion byte count must be observed'
  );
  const finishedAtEpochMs = event.timestamp * 1000 + request.clockOffsetMs;
  assert.ok(
    Number.isFinite(finishedAtEpochMs) && finishedAtEpochMs >= request.atEpochMs,
    'Completion cannot precede its request'
  );
  return { encodedDataLength: event.encodedDataLength, finishedAtEpochMs };
}
export function transferSummary(requests, openEpochMs) {
  const completed = requests.filter(
    (request) => request.encodedDataLength !== null && request.encodedDataLength !== undefined
  );
  for (const request of completed) {
    assert.ok(
      Number.isFinite(request.encodedDataLength) &&
        request.encodedDataLength >= 0 &&
        Number.isFinite(request.finishedAtEpochMs),
      'Observed bytes without a valid completion clock cannot be reported as zero pre-open transfer'
    );
  }
  const bytes = (items) => items.reduce((sum, request) => sum + request.encodedDataLength, 0);
  return {
    totalObserved: bytes(completed),
    unfinishedRequests: requests.length - completed.length,
    completedBeforeFirstOpen: Number.isFinite(openEpochMs)
      ? bytes(completed.filter((request) => request.finishedAtEpochMs < openEpochMs))
      : null,
    note: 'CDP encoded transfer bytes, not source size. Unfinished requests are counted explicitly. Pre-open request list groups request start times; those requests can finish after open.',
  };
}

export function classifyRequest(request, uiAssets) {
  if (request.path === '/pagefind/pagefind.js')
    return request.method === 'HEAD' ? 'index-head' : 'runtime-module';
  if (uiAssets.some((asset) => asset.path === request.path)) return 'default-ui-module';
  if (request.path.startsWith('/pagefind/')) return 'index-or-metadata';
  return 'application';
}
export function validateSample(s) {
  assert.equal(s.status, 'complete');
  assert.equal(s.errors.length, 0, 'Browser error cannot become success');
  assert.equal(
    s.events.uiBeforeOpen,
    false,
    'Pagefind DOM constructed before the first native dialog opening'
  );
  assert.equal(s.events.unexpectedOpen, false, 'Dialog opened without user input');
  assert.equal(s.runtime, 'wc');
  if (s.mode === 'no-intent') {
    assert.equal(s.events.open.length, 0);
    assert.equal(s.events.intent.length, 0);
    assert.equal(
      s.requests.filter((r) => r.kind !== 'application').length,
      0,
      'No-intent startup must not load Search service assets'
    );
    return;
  }
  if (['close-pending', 'dispose-pending'].includes(s.mode)) {
    assert.equal(s.pendingObserved, true, 'Control must intercept the real runtime import');
    assert.equal(s.afterClose.dialogOpen, false);
    assert.equal(s.afterClose.modalMarkers, false);
    if (s.variant === 'candidate')
      assert.equal(
        s.afterClose.uiChildren,
        0,
        'A canceled open may not construct Pagefind UI later'
      );
    if (s.mode === 'dispose-pending') assert.equal(s.afterClose.connected, false);
    else assert.equal(s.afterClose.focusOnOpener, true);
    return;
  }
  for (const metric of ['openToInputMs', 'queryToResultMs', 'secondOpenToInputMs'])
    assert.ok(Number.isFinite(s.metrics[metric]) && s.metrics[metric] >= 0, metric);
  assert.equal(s.events.open.length, 2);
  assert.ok(s.events.query > s.events.open[0] && s.events.result >= s.events.query);
  assert.ok(
    s.events.resultMatches.length &&
      s.events.resultMatches.every((r) => semanticResult(r.href, r.text, s.origin)),
    'Semantic Button result required'
  );
  if (['pointer', 'focus'].includes(s.mode)) {
    assert.ok(
      s.metrics.intentLeadMs >= PLAN.intentLeadMs,
      'Actual event-to-open lead must cover the fixed intent interval'
    );
    if (s.variant === 'candidate') {
      assert.ok(
        s.preOpen.requests.some((r) => r.kind === 'index-head'),
        'Explicit intent must begin preparation'
      );
      assert.equal(
        s.preOpen.requests.filter((r) => r.kind === 'index-or-metadata').length,
        0,
        'Intent must not fetch index payloads'
      );
      // Record runtime/UI overlap, without inventing a 250 ms module deadline.
      // Original product opener acceptance remains independently unchanged.
    }
  }
  if (s.mode === 'head503') {
    assert.ok(s.failureObserved);
    for (const status of [503, 200])
      assert.ok(s.requests.some((r) => r.kind === 'index-head' && r.status === status));
    assert.equal(
      s.events.events.filter((e) => e.type === 'click' && e.command === 'retry').length,
      1
    );
    assert.ok(Number.isFinite(s.metrics.retryToInputMs));
  }
  if (s.mode === 'intent-head503' && s.variant === 'candidate') {
    assert.equal(s.preparationFailureSilent, true);
    assert.equal(
      s.preOpen.requests.filter((r) => r.kind === 'index-head').length,
      1,
      'No background retry during the failed intent interval'
    );
    assert.ok(s.preOpen.requests.some((r) => r.kind === 'index-head' && r.status === 503));
    assert.equal(
      s.requests.filter((r) => r.kind === 'index-head').length,
      2,
      'Only the failed preparation and explicit open recovery probe'
    );
    assert.ok(s.requests.some((r) => r.kind === 'index-head' && r.status === 200));
  }
}

export function validateBuildAfterCapture(before, after) {
  assert.deepEqual(after, before, 'Native HTML, UI bundle or index changed during capture');
}
export function validateServedIndex(file, body, manifest) {
  assert.ok(Object.hasOwn(manifest, file), 'Served index asset absent from its native manifest');
  const digest = sha256(body);
  assert.equal(digest, manifest[file], 'Served index bytes differ from the native build manifest');
  return { path: file, sha256: digest, bytes: body.length };
}
export async function readServedAsset(
  base,
  pathname,
  indexManifest,
  indexRequests,
  indexErrors,
  method = 'GET'
) {
  try {
    let file = path.resolve(base, `.${pathname}`);
    if (!file.startsWith(base + path.sep)) throw new Error('Outside static root');
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const body = await readFile(file);
    if (pathname.startsWith('/pagefind/')) {
      assert.ok(indexRequests.length < 2000, 'Index request evidence limit exceeded');
      indexRequests.push({
        ...validateServedIndex(pathname.slice('/pagefind/'.length), body, indexManifest),
        method,
      });
    }
    return { file, body };
  } catch (error) {
    if (pathname.startsWith('/pagefind/')) indexErrors.push(String(error));
    throw error;
  }
}
async function serve(root, indexManifest) {
  const base = path.resolve(root, 'apps/www/dist');
  const indexRequests = [];
  const indexErrors = [];
  const mime = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.wasm': 'application/wasm',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
  };
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const { file, body } = await readServedAsset(
        base,
        pathname,
        indexManifest,
        indexRequests,
        indexErrors,
        req.method
      );
      res.writeHead(200, {
        'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream',
        'Content-Length': body.length,
        'Cache-Control': 'public, max-age=3600',
      });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    indexRequests,
    indexErrors,
    close: () => {
      server.closeAllConnections();
      return new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    },
  };
}
function bounded(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} deadline exceeded`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}
async function sample(browser, server, source, variant, mode, iteration, out, resultRoots) {
  const id = `${variant}-${mode}-${iteration}`;
  const dir = path.join(out, id);
  await mkdir(dir, { recursive: true });
  const report = {
    id,
    variant,
    mode,
    iteration,
    source,
    origin: server.origin,
    status: 'incomplete',
    errors: [],
    requests: [],
    blockedOrigins: [],
  };
  let context,
    page,
    stage = 'context',
    releasePending = () => {},
    heldRequest;
  let failHead = ['head503', 'intent-head503'].includes(mode);
  const pending = new Promise((resolve) => {
    heldRequest = resolve;
  });
  const release = new Promise((resolve) => {
    releasePending = resolve;
  });
  try {
    await bounded(
      (async () => {
        context = await browser.newContext({
          viewport: { width: 1440, height: 960 },
          colorScheme: 'light',
          locale: 'en-US',
          serviceWorkers: 'block',
          hasTouch: mode === 'touch',
        });
        context.setDefaultTimeout(PLAN.operationTimeoutMs);
        page = await context.newPage();
        const cdp = await context.newCDPSession(page);
        const requestIds = new Map();
        page.on('pageerror', (error) => report.errors.push(error.message.slice(0, 1200)));
        cdp.on('Network.requestWillBeSent', (event) => {
          const url = new URL(event.request.url);
          if (url.origin !== server.origin) return;
          const item = {
            path: url.pathname,
            method: event.request.method,
            ...requestTiming(event),
            status: null,
            encodedDataLength: null,
          };
          item.kind = classifyRequest(item, source.uiAssets);
          requestIds.set(event.requestId, item);
          if (report.requests.length < 2000) report.requests.push(item);
          else report.errors.push('Request evidence limit exceeded');
        });
        cdp.on('Network.responseReceived', (event) => {
          const item = requestIds.get(event.requestId);
          if (item) item.status = event.response.status;
        });
        cdp.on('Network.loadingFinished', (event) => {
          const item = requestIds.get(event.requestId);
          if (item) {
            try {
              Object.assign(item, completionTiming(item, event));
            } catch (error) {
              report.errors.push(String(error));
            }
          }
        });
        await cdp.send('Network.enable');
        await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
        await context.route('**/*', async (route) => {
          const request = route.request();
          const url = new URL(request.url());
          if (url.origin !== server.origin) {
            report.blockedOrigins.push(url.origin);
            await route.abort();
            return;
          }
          if (failHead && url.pathname === '/pagefind/pagefind.js' && request.method() === 'HEAD') {
            await route.fulfill({ status: 503, body: '' });
            return;
          }
          if (
            ['close-pending', 'dispose-pending'].includes(mode) &&
            url.pathname === '/pagefind/pagefind.js' &&
            request.method() === 'GET'
          ) {
            heldRequest();
            await release;
          }
          await route.continue();
        });
        await page.addInitScript(() => {
          localStorage.setItem('starlight-theme', 'light');
          localStorage.setItem('preferred-prototypes-adapter', 'wc');
        });
        await page.addInitScript(observeSearch);
        stage = 'navigate';
        const response = await page.goto(server.origin + PLAN.route, {
          waitUntil: 'domcontentloaded',
          timeout: PLAN.operationTimeoutMs,
        });
        assert.equal(response.status(), 200);
        await page.waitForFunction(() => Number.isFinite(window.__intentSearch?.opener));
        const opener = page.locator(
          'site-search [data-projection-generation-state="active"] [data-open-modal]'
        );
        const waitElapsed = (start, ms) =>
          page.waitForFunction(({ start, ms }) => performance.now() >= start + ms, { start, ms });
        const snapshot = () =>
          page.evaluate(() => ({
            ...window.__intentSearch,
            timeOrigin: performance.timeOrigin,
            capturedAt: performance.now(),
            dialogOpen: !!document.querySelector('site-search dialog')?.open,
            uiChildren: document.querySelector('#starlight__search')?.childElementCount ?? 0,
          }));
        stage = mode;
        if (mode === 'no-intent') {
          await waitElapsed(
            await page.evaluate(() => window.__intentSearch.opener),
            PLAN.startupObservationMs
          );
          report.startup = await snapshot();
          return;
        }
        if (['pointer', 'intent-head503'].includes(mode)) await opener.hover();
        if (mode === 'focus') {
          for (let i = 0; i < 30; i++) {
            await page.keyboard.press('Tab');
            if (await opener.evaluate((el) => el === document.activeElement)) break;
          }
          assert.equal(
            await opener.evaluate((el) => el === document.activeElement),
            true,
            'Native Tab must reach the real opener'
          );
        }
        if (['pointer', 'focus', 'intent-head503'].includes(mode)) {
          const start = await page.evaluate(() => window.__intentSearch.intent.at(-1)?.at);
          assert.ok(Number.isFinite(start), 'Trusted intent event was not recorded');
          await waitElapsed(start, PLAN.intentLeadMs);
          if (mode === 'intent-head503') {
            if (variant === 'candidate') {
              await page.waitForFunction(() =>
                performance
                  .getEntriesByType('resource')
                  .some((r) => new URL(r.name).pathname === '/pagefind/pagefind.js')
              );
              report.preparationFailureSilent = await page.evaluate(
                () =>
                  !document.querySelector('site-search dialog')?.open &&
                  !document.querySelector('#starlight__search')?.childElementCount &&
                  !!document.querySelector('.search-failure')?.hidden
              );
            }
            failHead = false;
          }
        }
        report.preOpen = await snapshot();
        if (mode === 'touch') await opener.tap();
        else if (mode === 'pointer') await opener.click();
        else if (mode === 'focus') await page.keyboard.press('Enter');
        else await page.keyboard.press('Control+k');
        if (['close-pending', 'dispose-pending'].includes(mode)) {
          await pending;
          report.pendingObserved = true;
          await page.keyboard.press('Escape');
          await page.waitForFunction(() => !document.querySelector('site-search dialog')?.open);
          if (mode === 'dispose-pending')
            await page.evaluate(() => {
              window.__detachedSearch = document.querySelector('site-search');
              window.__detachedSearch.remove();
            });
          releasePending();
          // Observe real module request completion, then two rendering frames;
          // this is a lifecycle control, never a relaxed product deadline.
          await page.waitForFunction(() =>
            performance
              .getEntriesByType('resource')
              .some(
                (r) =>
                  new URL(r.name).pathname === '/pagefind/pagefind.js' &&
                  r.initiatorType === 'script'
              )
          );
          if (mode === 'close-pending')
            await page.waitForFunction(
              (paths) =>
                paths.every((name) =>
                  performance
                    .getEntriesByType('resource')
                    .some((r) => new URL(r.name).pathname === name)
                ),
              source.uiAssets.map((asset) => asset.path)
            );
          await page.evaluate(
            () =>
              new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
          );
          report.afterClose = await page.evaluate(() => {
            const search = window.__detachedSearch ?? document.querySelector('site-search');
            return {
              dialogOpen: !!search?.querySelector('dialog')?.open,
              connected: !!search?.isConnected,
              uiChildren: search?.querySelector('#starlight__search')?.childElementCount ?? 0,
              modalMarkers:
                document.documentElement.hasAttribute('data-search-modal-open') ||
                document.body.hasAttribute('data-search-modal-open'),
              focusOnOpener: !!document.activeElement?.matches('[data-open-modal]'),
            };
          });
          return;
        }
        if (mode === 'head503') {
          const retry = page.locator('site-search .search-failure__retry:visible');
          await retry.waitFor({ state: 'visible' });
          report.failureObserved = await snapshot();
          await page.screenshot({ path: path.join(dir, 'head503.png') });
          failHead = false;
          await retry.click();
        }
        stage = 'input';
        await page.waitForFunction(() => Number.isFinite(window.__intentSearch.input[0]));
        stage = 'query';
        await page.locator('site-search .pagefind-ui__search-input').fill('Button');
        await page.waitForFunction(() => Number.isFinite(window.__intentSearch.result));
        // Preserve the first-result timestamp, then wait for all currently
        // rendered Pagefind result placeholders before checking their targets.
        await page.waitForFunction(
          () => !document.querySelector('site-search .pagefind-ui__loading')
        );
        // Check every actual result/subresult destination, not only the Button
        // match used for the latency endpoint. Each retains both native HTMLs.
        report.actualResultLinks = await page
          .locator('site-search .pagefind-ui__result-link')
          .evaluateAll((links) =>
            links.map((link) => ({ href: link.href, text: link.textContent?.trim() ?? '' }))
          );
        report.resultAnchorValidation = await validateResultLinks(
          report.actualResultLinks,
          server.origin,
          ...resultRoots
        );
        stage = 'reopen';
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('site-search dialog')?.open);
        assert.equal(await opener.evaluate((el) => el === document.activeElement), true);
        await page.keyboard.press('Control+k');
        await page.waitForFunction(() => Number.isFinite(window.__intentSearch.input[1]));
      })(),
      PLAN.sampleTimeoutMs,
      id
    );
    report.status = 'complete';
  } catch (error) {
    report.status = 'failed';
    report.failedStage = stage;
    report.error = String(error).slice(0, 4000);
  } finally {
    releasePending();
    try {
      if (page) {
        const observed = await bounded(
          page.evaluate(() => {
            window.__stopIntentSearch?.();
            return {
              ...window.__intentSearch,
              timeOrigin: performance.timeOrigin,
              resources: performance.getEntriesByType('resource').map((r) => ({
                path: new URL(r.name).pathname,
                startTime: r.startTime,
                duration: r.duration,
                transferSize: r.transferSize,
                encodedBodySize: r.encodedBodySize,
                initiatorType: r.initiatorType,
              })),
              runtime: (
                window.__detachedSearch ?? document.querySelector('site-search')
              )?.getAttribute('data-search-runtime'),
            };
          }),
          2000,
          'final observation'
        );
        report.events = observed;
        report.runtime = observed.runtime;
        const delta = (end, start) =>
          Number.isFinite(end) && Number.isFinite(start) ? end - start : null;
        report.metrics = {
          openerFromNavigationMs: observed.opener,
          openToInputMs: delta(observed.input?.[0], observed.open?.[0]),
          intentLeadMs: delta(observed.open?.[0], observed.intent?.[0]?.at),
          queryToResultMs: delta(observed.result, observed.query),
          secondOpenToInputMs: delta(observed.input?.[1], observed.open?.[1]),
          retryToInputMs: delta(
            observed.input?.[0],
            observed.events?.find((e) => e.type === 'click' && e.command === 'retry')?.at
          ),
        };
        if (report.preOpen)
          report.preOpen.requests = report.requests.filter(
            (r) => r.atEpochMs <= report.preOpen.timeOrigin + report.preOpen.capturedAt
          );
        const openEpochMs = observed.timeOrigin + observed.open?.[0];
        report.transferredBytes = transferSummary(report.requests, openEpochMs);
        if (report.status === 'complete') validateSample(report);
      }
    } catch (error) {
      report.status = 'failed';
      report.validationError = String(error).slice(0, 4000);
    }
    if (page && (iteration === 0 || report.status !== 'complete')) {
      try {
        await bounded(page.screenshot({ path: path.join(dir, 'final.png') }), 2000, 'screenshot');
      } catch (error) {
        report.status = 'failed';
        report.screenshotError = String(error);
      }
    }
    try {
      if (context) await bounded(context.close(), 3000, 'context cleanup');
    } catch (error) {
      report.status = 'failed';
      report.cleanupError = String(error);
    }
    await json(path.join(dir, 'sample.json'), report);
  }
  return report;
}

export async function run(baseline, candidate, out, expectedSha = process.env.CANDIDATE_SHA) {
  assert.equal(
    process.env.GITHUB_ACTIONS,
    'true',
    'Browser evidence must use the supported CI runner; do not bypass local socket/browser restrictions'
  );
  assert.ok(process.env.CHROME_PATH, 'Use runner-provided Chrome');
  await mkdir(out, { recursive: true });
  const source = await sourceBoundary(baseline, candidate, expectedSha);
  const builds = {
    baseline: await buildBoundary(baseline),
    candidate: await buildBoundary(candidate),
  };
  // Preserve each independently generated native index before checking it.
  // Random SSR anchor IDs make full index-byte identity an invalid assumption.
  for (const [variant, root] of Object.entries({ baseline, candidate }))
    await cp(path.join(root, 'apps/www/dist/pagefind'), path.join(out, 'native-index', variant), {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
  await json(path.join(out, 'native-build-boundaries.json'), { source, builds });
  let indexComparison;
  try {
    indexComparison = await validateIndexPair(
      path.join(baseline, 'apps/www/dist'),
      path.join(candidate, 'apps/www/dist')
    );
  } catch (error) {
    await json(path.join(out, 'index-boundary-failure.json'), { error: String(error) });
    throw error;
  }
  await json(path.join(out, 'index-semantic-comparison.json'), indexComparison);
  assert.equal(
    builds.baseline.uiAssets[0].sha256,
    builds.candidate.uiAssets[0].sha256,
    'Same default-ui bytes on both trees'
  );
  const require = createRequire(path.join(path.resolve(candidate), 'apps/www/package.json'));
  const { chromium } = require('playwright-core');
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    headless: true,
    timeout: 20_000,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-sync',
      '--no-first-run',
    ],
  });
  const servers = {},
    samples = [];
  const expectedSamples = 2 * (PLAN.samples * PLAN.naturalModes.length + PLAN.controls.length);
  const boundary = {
    source,
    builds,
    indexPolicy:
      'Each source serves its own untouched native index. Runtime/WASM/index shards match byte-for-byte; only five proven non-heading random anchor ID classes may differ after strict corpus and HTML-target verification. Native fragment/metadata compression bytes can differ; query/reopen timing is descriptive, not a pure causal or identical-index comparison.',
    indexComparison,
    plan: PLAN,
    expectedSamples,
    browser: browser.version(),
    node: process.version,
    sourceComparison:
      'Same candidate tree; exactly Search.astro and site-search-commands.ts differ',
    cache:
      'Fresh context and disabled HTTP cache per sample; service workers blocked; same-page reopen retains module/UI memory; OS caches are shared',
    originalOpenerGate:
      'The unchanged 1000ms main-CI oracle is independently required. Navigation-based opener timing here does not replace it.',
    limitations: [
      'One route, WC runtime, light theme, desktop viewport, one CI runner.',
      'Loopback production build, no CPU/network throttling; descriptive distributions, no performance/parity verdict.',
      'Control cases and failed observations are retained; no automatic rerun, no trace profiling mixed into natural latency.',
    ],
  };
  await json(path.join(out, 'boundary.json'), boundary);
  let failure;
  const deadline = Date.now() + PLAN.totalTimeoutMs;
  try {
    for (const [variant, root] of Object.entries({ baseline, candidate }))
      servers[variant] = await serve(root, builds[variant].index);
    const attempt = async (variant, mode, iteration) => {
      // Reserve the full sample plus final observation/screenshot/cleanup.
      // Stop with explicit missing attempts rather than leave an async loop
      // recording after summary or silently omit an exhausted cohort.
      assert.ok(
        Date.now() + PLAN.sampleTimeoutMs + 8000 < deadline,
        'Total measurement deadline cannot admit another complete attempt'
      );
      samples.push(
        await sample(
          browser,
          servers[variant],
          { ...source[variant], uiAssets: builds[variant].uiAssets },
          variant,
          mode,
          iteration,
          out,
          [path.join(baseline, 'apps/www/dist'), path.join(candidate, 'apps/www/dist')]
        )
      );
    };
    for (let i = 0; i < PLAN.samples; i++)
      for (const mode of PLAN.naturalModes)
        for (const variant of i % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate'])
          await attempt(variant, mode, i);
    for (const mode of PLAN.controls)
      for (const variant of ['baseline', 'candidate']) await attempt(variant, mode, 0);
    assert.deepEqual(
      await sourceBoundary(baseline, candidate, expectedSha),
      source,
      'Application source changed during capture'
    );
    for (const [variant, root] of Object.entries({ baseline, candidate })) {
      validateBuildAfterCapture(builds[variant], await buildBoundary(root));
      assert.deepEqual(servers[variant].indexErrors, [], 'Native index changed while serving');
    }
    assert.equal(samples.length, expectedSamples);
    assert.ok(
      samples.every((s) => s.status === 'complete'),
      'Failed samples retained; evidence is not complete'
    );
  } catch (error) {
    failure = error;
  } finally {
    const cleanup = await Promise.allSettled([
      bounded(browser.close(), 5000, 'browser cleanup'),
      ...Object.values(servers).map((server) => bounded(server.close(), 5000, 'server cleanup')),
    ]);
    const groups = {};
    for (const variant of ['baseline', 'candidate'])
      for (const mode of PLAN.naturalModes) {
        const cohort = samples.filter((s) => s.variant === variant && s.mode === mode);
        groups[`${variant}-${mode}`] = {
          planned: PLAN.samples,
          attempted: cohort.length,
          failed: cohort.filter((s) => s.status !== 'complete').map((s) => s.id),
          metrics: Object.fromEntries(
            [
              'openerFromNavigationMs',
              'intentLeadMs',
              'openToInputMs',
              'queryToResultMs',
              'secondOpenToInputMs',
            ].map((metric) => [metric, cohortDistribution(cohort, metric)])
          ),
        };
      }
    await json(path.join(out, 'summary.json'), {
      expectedSamples,
      completedSamples: samples.length,
      servedNativeIndexes: Object.fromEntries(
        Object.entries(servers).map(([variant, server]) => [
          variant,
          {
            requests: server.indexRequests,
            errors: server.indexErrors,
          },
        ])
      ),
      groups,
      samples: samples.map((s) => ({ id: s.id, status: s.status })),
      error: failure ? String(failure) : null,
      cleanup: cleanup.map((entry) => ({
        status: entry.status,
        error: entry.status === 'rejected' ? String(entry.reason) : null,
      })),
      limitations: boundary.limitations,
    });
    if (cleanup.some((entry) => entry.status === 'rejected'))
      throw new Error('Evidence process cleanup failed');
  }
  if (failure) throw failure;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  run(...process.argv.slice(2)).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

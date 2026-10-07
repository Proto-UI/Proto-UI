import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import {
  validateBuildAfterCapture,
  readServedAsset,
  validateServedIndex,
  sourcePairFiles,
  BASE_SHA,
  PRODUCT_PATHS,
  PLAN,
  classifyRequest,
  requestTiming,
  completionTiming,
  transferSummary,
  distribution,
  cohortDistribution,
  observeSearch,
  semanticResult,
  validateIndexes,
  validatePairFiles,
  validateSample,
  run,
} from './search-intent-ab.mjs';

const origin = 'http://127.0.0.1:9000';
const good = () => ({
  status: 'complete',
  variant: 'candidate',
  mode: 'immediate',
  origin,
  errors: [],
  requests: [],
  runtime: 'wc',
  metrics: { openToInputMs: 1, queryToResultMs: 2, secondOpenToInputMs: 0, intentLeadMs: 250 },
  events: {
    open: [10, 100],
    input: [11, 100],
    query: 20,
    result: 22,
    resultMatches: [{ href: origin + '/zh-cn/ui-libraries/shadcn/button/', text: 'Button' }],
    uiBeforeOpen: false,
    unexpectedOpen: false,
    events: [],
    intent: [],
  },
});

test('CDP completion maps monotonic time to the request wall clock and aggregates actual pre-open bytes', () => {
  const first = { ...requestTiming({ timestamp: 12, wallTime: 1000 }), encodedDataLength: null };
  Object.assign(first, completionTiming(first, { timestamp: 12.125, encodedDataLength: 800 }));
  assert.equal(first.atEpochMs, 1_000_000);
  assert.equal(first.finishedAtEpochMs, 1_000_125);
  const later = {
    ...requestTiming({ timestamp: 12.1, wallTime: 1000.1 }),
    encodedDataLength: null,
  };
  Object.assign(later, completionTiming(later, { timestamp: 12.5, encodedDataLength: 1200 }));
  const pending = {
    ...requestTiming({ timestamp: 12.2, wallTime: 1000.2 }),
    encodedDataLength: null,
  };
  const result = transferSummary([first, later, pending], 1_000_250);
  assert.equal(result.completedBeforeFirstOpen, 800);
  assert.equal(result.totalObserved, 2000);
  assert.equal(result.unfinishedRequests, 1);
  assert.equal(transferSummary([first], null).completedBeforeFirstOpen, null);
  assert.equal(
    transferSummary([first], first.finishedAtEpochMs).completedBeforeFirstOpen,
    0,
    'Equal timestamp is not strictly before opening'
  );
});

test('missing/NaN clock mappings fail closed instead of becoming zero transfer', () => {
  assert.throws(() => requestTiming({ timestamp: 12 }));
  assert.throws(() =>
    completionTiming({ atEpochMs: 1000 }, { timestamp: 12, encodedDataLength: 8 })
  );
  assert.throws(() =>
    completionTiming(
      { ...requestTiming({ timestamp: 12, wallTime: 1000 }) },
      { timestamp: 11, encodedDataLength: 8 }
    )
  );
  for (const finishedAtEpochMs of [undefined, NaN, null])
    assert.throws(() => transferSummary([{ encodedDataLength: 800, finishedAtEpochMs }], 1000));
});

test('same-tree comparison permits exactly the two source files, not a whole old application', () => {
  const a = Object.fromEntries(
    [...PRODUCT_PATHS, 'pnpm-lock.yaml', 'shared/app.ts'].map((name) => [name, 'same'])
  );
  const b = { ...a, [PRODUCT_PATHS[0]]: 'candidate-one', [PRODUCT_PATHS[1]]: 'candidate-two' };
  validatePairFiles(a, b);
  assert.throws(() => validatePairFiles(a, { ...b, 'pnpm-lock.yaml': 'different' }));
  assert.throws(() => validatePairFiles(a, { ...b, 'extra.ts': 'surprise' }));
  assert.throws(() => validatePairFiles(a, a));
  assert.equal(BASE_SHA, '4a2320762ba5f4319dec1915ca4e138772dceb0c');
});

test('full index byte comparison rejects runtime-only, missing fragments and changed metadata', () => {
  const index = {
    'pagefind.js': 'runtime',
    'index/a.pf_index': 'index',
    'pagefind-entry.json': 'metadata',
    'fragment/a.pf_fragment': 'fragment',
  };
  validateIndexes(index, { ...index });
  assert.throws(() => validateIndexes({ 'pagefind.js': 'runtime' }, { 'pagefind.js': 'runtime' }));
  assert.throws(() => validateIndexes(index, { ...index, 'pagefind-entry.json': 'different' }));
  assert.throws(() =>
    validateIndexes(index, { 'pagefind.js': 'runtime', 'index/a.pf_index': 'index' })
  );
});

test('missing observations stay missing in descriptive distributions', () => {
  const result = distribution([null, 10, 2, undefined, NaN]);
  assert.equal(result.attempted, 5);
  assert.equal(result.observed, 2);
  assert.equal(result.missing, 3);
  assert.equal(result.median, 2);
  assert.equal(result.p90, 10);
  assert.equal(distribution([null]).min, null);
});

test('semantic query must have the matching local Button document and label', () => {
  assert.equal(
    semanticResult(origin + '/zh-cn/ui-libraries/shadcn/button/', 'Button', origin),
    true
  );
  for (const [href, title] of [
    ['https://foreign.test/zh-cn/ui-libraries/shadcn/button/', 'Button'],
    [origin + '/zh-cn/ui-libraries/shadcn/select/', 'Button'],
    [origin + '/zh-cn/ui-libraries/shadcn/button/', 'Loading'],
    ['javascript:alert(1)', 'Button'],
  ])
    assert.equal(semanticResult(href, title, origin), false);
});

test('request classes distinguish HEAD, runtime, UI bundle and index payload', () => {
  const ui = [{ path: '/_astro/pagefind-ui.X.js' }];
  assert.equal(
    classifyRequest({ path: '/pagefind/pagefind.js', method: 'HEAD' }, ui),
    'index-head'
  );
  assert.equal(
    classifyRequest({ path: '/pagefind/pagefind.js', method: 'GET' }, ui),
    'runtime-module'
  );
  assert.equal(classifyRequest({ path: ui[0].path, method: 'GET' }, ui), 'default-ui-module');
  assert.equal(
    classifyRequest({ path: '/pagefind/index/a.pf_index', method: 'GET' }, ui),
    'index-or-metadata'
  );
  assert.equal(classifyRequest({ path: '/_astro/other.js', method: 'GET' }, ui), 'application');
});

test('normal validation rejects missing results, browser errors, pre-open DOM or uncommanded opening', () => {
  validateSample(good());
  for (const mutate of [
    (s) => {
      s.metrics.openToInputMs = null;
    },
    (s) => {
      s.metrics.queryToResultMs = -1;
    },
    (s) => {
      s.events.resultMatches = [];
    },
    (s) => {
      s.events.result = 1;
    },
    (s) => {
      s.events.open.pop();
    },
    (s) => {
      s.errors.push('error');
    },
    (s) => {
      s.events.uiBeforeOpen = true;
    },
    (s) => {
      s.events.unexpectedOpen = true;
    },
    (s) => {
      s.runtime = 'native';
    },
    (s) => {
      s.status = 'failed';
    },
  ]) {
    const s = good();
    mutate(s);
    assert.throws(() => validateSample(s));
  }
});

test('no-intent startup rejects any Search service traffic and accidentally injected intent', () => {
  const s = good();
  s.mode = 'no-intent';
  s.events.open = [];
  validateSample(s);
  s.requests.push({ kind: 'runtime-module' });
  assert.throws(() => validateSample(s));
  s.requests = [];
  s.events.intent.push({ type: 'focusin', at: 1 });
  assert.throws(() => validateSample(s));
});

test('intent requires actual lead and recorded preparation without accepting index prefetch', () => {
  const s = good();
  s.mode = 'pointer';
  s.preOpen = { requests: [{ kind: 'index-head' }, { kind: 'runtime-module' }] };
  validateSample(s);
  s.preOpen.requests.push({ kind: 'index-or-metadata' });
  assert.throws(() => validateSample(s));
  s.preOpen.requests.pop();
  s.metrics.intentLeadMs = 249;
  assert.throws(() => validateSample(s));
  s.metrics.intentLeadMs = 250;
  s.preOpen.requests = [];
  assert.throws(() => validateSample(s));
});

test('HEAD503 requires an observed failure, one actual retry and both failure/recovery HEAD responses', () => {
  const s = good();
  s.mode = 'head503';
  assert.throws(() => validateSample(s));
  s.failureObserved = { at: 1 };
  s.requests = [
    { kind: 'index-head', status: 503 },
    { kind: 'index-head', status: 200 },
  ];
  s.events.events = [{ type: 'click', command: 'retry' }];
  s.metrics.retryToInputMs = 1;
  validateSample(s);
  s.events.events.push({ type: 'click', command: 'retry' });
  assert.throws(() => validateSample(s));
  s.events.events.pop();
  s.requests.pop();
  assert.throws(() => validateSample(s));
});

test('silent intent failure cannot be confused with a failure dialog or a background retry', () => {
  const s = good();
  s.mode = 'intent-head503';
  s.requests = [
    { kind: 'index-head', status: 503 },
    { kind: 'index-head', status: 200 },
  ];
  s.preOpen = { requests: [{ kind: 'index-head', status: 503 }] };
  s.preparationFailureSilent = true;
  validateSample(s);
  s.preOpen.requests.push({ kind: 'index-head', status: 503 });
  assert.throws(() => validateSample(s));
  s.preOpen.requests.pop();
  s.preparationFailureSilent = false;
  assert.throws(() => validateSample(s));
});

test('late close and disposal require the actual held request and reject UI resurrection', () => {
  const s = good();
  s.mode = 'close-pending';
  s.pendingObserved = true;
  s.afterClose = {
    dialogOpen: false,
    modalMarkers: false,
    uiChildren: 0,
    connected: true,
    focusOnOpener: true,
  };
  validateSample(s);
  s.afterClose.uiChildren = 1;
  assert.throws(() => validateSample(s));
  s.variant = 'baseline';
  validateSample(s); // Historical baseline state is observed, not relabeled fixed.
  s.variant = 'candidate';
  s.afterClose.uiChildren = 0;
  s.pendingObserved = false;
  assert.throws(() => validateSample(s));
  s.pendingObserved = true;
  s.mode = 'dispose-pending';
  assert.throws(() => validateSample(s));
  s.afterClose.connected = false;
  validateSample(s);
});

function observerFixture() {
  const callbacks = new Map();
  let nextFrame,
    mutation,
    now = 0;
  class Element {}
  const style = { display: 'block', visibility: 'visible', opacity: '1' };
  const parent = { parentElement: null, style: { ...style } };
  const opener = new Element();
  Object.assign(opener, {
    parentElement: parent,
    isConnected: true,
    disabled: false,
    style,
    getBoundingClientRect: () => ({ width: 100, height: 44 }),
    getAttribute: () => 'false',
    closest: (selector) => (selector.includes('data-open-modal') ? opener : null),
    hasAttribute: (name) => name === 'data-open-modal',
  });
  const root = { id: 'starlight__search', childElementCount: 0 };
  const dialog = { open: false };
  const document = {
    activeElement: null,
    querySelector: (selector) =>
      selector === '#starlight__search'
        ? root
        : selector === 'site-search dialog'
          ? dialog
          : selector.includes('data-open-modal')
            ? opener
            : null,
    querySelectorAll: () => [],
  };
  const window = { addEventListener: (type, callback) => callbacks.set(type, callback) };
  runInNewContext(`(${observeSearch.toString()})()`, {
    window,
    document,
    Element,
    MutationObserver: class {
      constructor(callback) {
        mutation = callback;
      }
      observe() {}
      disconnect() {}
    },
    customElements: { get: () => function SiteSearch() {} },
    performance: { now: () => now },
    getComputedStyle: (el) => el.style,
    requestAnimationFrame: (callback) => {
      nextFrame = callback;
      return now;
    },
    cancelAnimationFrame() {},
    PerformanceObserver: class {
      observe() {}
      disconnect() {}
    },
  });
  return {
    window,
    root,
    parent,
    opener,
    dialog,
    tick: () => {
      now += 16;
      nextFrame();
    },
    mutate: (records = []) => mutation(records),
    dispatch: (type, props = {}) =>
      callbacks.get(type)({ type, target: opener, isTrusted: true, ...props }),
  };
}

test('observer catches hidden DOM construction before opening and ignores untrusted fake open input', () => {
  const f = observerFixture();
  f.tick();
  assert.equal(f.window.__intentSearch.opener, 16);
  f.root.childElementCount = 1;
  f.mutate();
  assert.equal(f.window.__intentSearch.uiBeforeOpen, true);
  f.dispatch('click', { isTrusted: false });
  assert.equal(f.window.__intentSearch.open.length, 0);
  f.dispatch('keydown', { ctrlKey: true, key: 'k' });
  assert.equal(f.window.__intentSearch.open.length, 1);
  assert.doesNotMatch(observeSearch.toString(), /dispatchEvent|\.focus\(|setAttribute|\.click\(/);
});

test('observer excludes zero-opacity ancestors and detects uncommanded dialog opening', () => {
  const f = observerFixture();
  f.parent.style.opacity = '0';
  f.tick();
  assert.equal(f.window.__intentSearch.opener, null);
  f.parent.style.opacity = '1';
  f.tick();
  assert.equal(f.window.__intentSearch.opener, 32);
  f.dialog.open = true;
  f.mutate();
  assert.equal(f.window.__intentSearch.unexpectedOpen, true);
});

test('constructor after a trusted command but before native dialog opening is still a violation', () => {
  const f = observerFixture();
  f.dispatch('keydown', { ctrlKey: true, key: 'k' });
  assert.equal(f.window.__intentSearch.open.length, 1);
  assert.equal(f.dialog.open, false);
  f.root.childElementCount = 1;
  f.mutate();
  assert.equal(f.window.__intentSearch.uiBeforeOpen, true);
});

test('ordered native mutations reject constructor-before-showModal in one batch but permit retained warm UI', () => {
  const child = (f) => ({ type: 'childList', target: f.root, addedNodes: [{ nodeType: 1 }] });
  const open = (f, oldValue = null) => ({
    type: 'attributes',
    target: f.dialog,
    attributeName: 'open',
    oldValue,
  });
  const bad = observerFixture();
  bad.dispatch('keydown', { ctrlKey: true, key: 'k' });
  bad.root.childElementCount = 1;
  bad.dialog.open = true;
  bad.mutate([child(bad), open(bad)]);
  assert.equal(bad.window.__intentSearch.uiBeforeOpen, true);
  const good = observerFixture();
  good.dispatch('keydown', { ctrlKey: true, key: 'k' });
  good.dialog.open = true;
  good.root.childElementCount = 1;
  good.mutate([open(good), child(good)]);
  assert.equal(good.window.__intentSearch.firstNativeOpenObserved, true);
  assert.equal(good.window.__intentSearch.uiBeforeOpen, false);
  good.dialog.open = false;
  good.mutate([open(good, '')]);
  good.tick();
  assert.equal(
    good.window.__intentSearch.uiBeforeOpen,
    false,
    'Warm closed dialog may retain existing UI'
  );
  const fast = observerFixture();
  fast.dispatch('keydown', { ctrlKey: true, key: 'k' });
  fast.root.childElementCount = 1;
  fast.dialog.open = false;
  fast.mutate([open(fast), child(fast), open(fast, '')]);
  assert.equal(
    fast.window.__intentSearch.firstNativeOpenObserved,
    true,
    'Open then close within one delivery still retains first-open history'
  );
  assert.equal(fast.window.__intentSearch.uiBeforeOpen, false);
});

test('failed finite latency remains raw evidence and never enters the natural distribution', () => {
  const failed = { status: 'failed', metrics: { openToInputMs: 0 } };
  const complete = { status: 'complete', metrics: { openToInputMs: 50 } };
  const summary = cohortDistribution([failed, complete], 'openToInputMs', 3);
  assert.deepEqual(summary.samples, [null, 50, null]);
  assert.equal(summary.median, 50);
  assert.equal(summary.observed, 1);
  assert.equal(summary.missing, 2);
  assert.equal(failed.metrics.openToInputMs, 0, 'Raw failed observation stays intact');
});

test('bounded workflow preserves original acceptance and does not copy or run historical reports', async () => {
  assert.equal(PLAN.openerAcceptanceMs, 1000);
  assert.equal(2 * (PLAN.samples * PLAN.naturalModes.length + PLAN.controls.length), 42);
  assert.equal(PLAN.totalTimeoutMs, 600_000);
  const workflow = await readFile(
    new URL('../../.github/workflows/search-intent-ab.yml', import.meta.url),
    'utf8'
  );
  assert.match(workflow, /timeout-minutes: 35/);
  assert.match(workflow, /kill-after=15s 660s/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /sourceBoundary\('baseline', 'candidate'/);
  assert.match(workflow, /fix\/search-intent-module-preparation/);
  assert.doesNotMatch(workflow, /REPORT\.md|46fa65|search-cold-open-parity|pull_request_target/);
  if (process.env.GITHUB_ACTIONS !== 'true')
    await assert.rejects(run('/no-baseline', '/no-candidate', '/no-output'), /supported CI runner/);
});

test('real Git paths preserve Unicode, whitespace and newlines while rejecting unrelated drift', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'search-source-boundary-'));
  const candidate = path.join(root, 'candidate');
  const baseline = path.join(root, 'baseline');
  const git = (cwd, ...args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const unusual = [
    'styles/__行文脉络.md',
    'notes/a file.md',
    'notes/line\nbreak.md',
    'notes/ trailing \n',
  ];
  try {
    await mkdir(candidate);
    git(candidate, 'init');
    git(candidate, 'config', 'core.quotePath', 'true');
    for (const file of [...PRODUCT_PATHS, ...unusual]) {
      await mkdir(path.dirname(path.join(candidate, file)), { recursive: true });
      await writeFile(path.join(candidate, file), 'candidate');
    }
    git(candidate, 'add', '--all');
    git(
      candidate,
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.invalid',
      'commit',
      '-m',
      'fixture'
    );
    const sha = git(candidate, 'rev-parse', 'HEAD');
    git(candidate, 'worktree', 'add', '--detach', baseline, sha);
    for (const file of PRODUCT_PATHS) await writeFile(path.join(baseline, file), 'baseline');
    const pair = await sourcePairFiles(baseline, candidate, sha);
    for (const file of unusual) {
      assert.ok(Object.hasOwn(pair.a, file));
      assert.equal(pair.a[file], pair.b[file]);
    }
    await writeFile(path.join(baseline, unusual[0]), 'unrelated change');
    await assert.rejects(sourcePairFiles(baseline, candidate, sha), /exactly the two Search files/);
    await writeFile(path.join(baseline, unusual[0]), 'candidate');
    await writeFile(path.join(baseline, 'new\nfile'), 'untracked');
    await assert.rejects(
      sourcePairFiles(baseline, candidate, sha),
      /Unexpected baseline source files/
    );
    await rm(path.join(baseline, 'new\nfile'));
    await writeFile(path.join(candidate, unusual[1]), 'dirty candidate');
    await assert.rejects(
      sourcePairFiles(baseline, candidate, sha),
      /Candidate checkout must be clean/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('actual served native index bytes must match their original manifest', () => {
  const body = Buffer.from('native index');
  const digest = createHash('sha256').update(body).digest('hex');
  const manifest = { 'pagefind.js': digest };
  assert.equal(validateServedIndex('pagefind.js', body, manifest).sha256, digest);
  assert.throws(() => validateServedIndex('pagefind.js', body, {}), /absent/);
  assert.throws(
    () => validateServedIndex('pagefind.js', Buffer.from('wrong or changed index'), manifest),
    /bytes differ/
  );
  assert.equal(
    validateServedIndex('pagefind.js', body, manifest).sha256,
    digest,
    'Later restoration cannot erase the failed actual serving assertion'
  );
});

test('the real static read path retains a missing index error after file restoration', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'search-index-serving-'));
  const file = path.join(root, 'pagefind/pagefind.js');
  const body = Buffer.from('native index');
  const manifest = { 'pagefind.js': createHash('sha256').update(body).digest('hex') };
  const requests = [],
    errors = [];
  try {
    await mkdir(path.dirname(file));
    await writeFile(file, body);
    await readServedAsset(root, '/pagefind/pagefind.js', manifest, requests, errors);
    await rm(file);
    await assert.rejects(
      readServedAsset(root, '/pagefind/pagefind.js', manifest, requests, errors),
      /ENOENT/
    );
    await writeFile(file, body);
    await readServedAsset(root, '/pagefind/pagefind.js', manifest, requests, errors);
    assert.equal(requests.length, 2);
    assert.equal(errors.length, 1, 'Actual failed serving cannot disappear after restoration');
    await writeFile(file, 'wrong index');
    await assert.rejects(
      readServedAsset(root, '/pagefind/pagefind.js', manifest, requests, errors),
      /bytes differ/
    );
    assert.equal(errors.length, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('post-capture boundary rejects native HTML, UI or index changes', () => {
  const before = {
    nativeHtml: { 'index.html': 'original' },
    uiAssets: [{ sha256: 'ui' }],
    index: { 'pagefind.js': 'runtime' },
  };
  validateBuildAfterCapture(before, structuredClone(before));
  for (const field of ['nativeHtml', 'uiAssets', 'index']) {
    const after = structuredClone(before);
    after[field] = { changed: 'bytes' };
    assert.throws(() => validateBuildAfterCapture(before, after), /changed during capture/);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import {
  BASELINE_SHA,
  ROUTE,
  VIEWPORT,
  originalTarget,
  legacyHighlights,
  summarize,
  historicFindings,
} from './original-contract.mjs';
import { installOriginalObserver } from './original-observer.mjs';
import { bindingFingerprint } from './original-runtime.mjs';

test('reference identity and minimal viewport are exact', () => {
  assert.equal(BASELINE_SHA, '411c354cfbf76e9da34eafa90f1c8a7b973d043c');
  assert.equal(ROUTE, '/zh-cn/start-here/quick-start/');
  assert.deepEqual(VIEWPORT, { width: 1440, height: 900 });
});
test('original padding and asymmetric first-left / last-right are preserved', () => {
  const result = originalTarget(
    { left: 120, top: 60 },
    { left: 110, right: 180, bottom: 90 },
    { left: 100, top: 20 },
    2,
    3
  );
  assert.deepEqual(result, { x: 6, y: 39, width: 92, height: 38 });
  assert.equal(originalTarget(null, null, null), null);
});
test('original nonnegative width is preserved without changing geometric premise', () => {
  assert.equal(
    originalTarget({ left: 200, top: 0 }, { right: 100, bottom: 20 }, { left: 0, top: 0 }).width,
    0
  );
});
const node = (tag, hidden, bg) => ({
  localName: tag,
  getAttribute: () => hidden,
  classList: { contains: (x) => x === 'bg-primary/5' && bg },
});
test('legacy selection uses only actual direct div anatomy, aria-hidden and historical class', () => {
  const actual = node('div', 'true', true);
  const host = {
    children: [
      node('nav', 'true', true),
      node('div', 'false', true),
      node('div', 'true', false),
      actual,
    ],
  };
  assert.deepEqual(legacyHighlights(host), [actual]);
  assert.equal(legacyHighlights({ children: [actual, node('div', 'true', true)] }).length, 2);
});
const frame = (x, targetX = x) => ({
  actual: { x, y: 0, width: 100, height: 40 },
  inlineTarget: { x: targetX, y: 0, width: 100, height: 40 },
  target: { x: targetX, y: 0, width: 100, height: 40 },
  current: ['#a'],
  expectedCurrent: '#a',
  scrollY: x * 10,
  highlightId: 1,
  highlight: { opacity: '1', visibility: 'visible' },
});
test('stationary before/after endpoints do not become interpolation', () => {
  const s = summarize([frame(0), frame(100)]);
  assert.equal(s.intermediateFrames, 0);
  assert.equal(s.targetChanges, 1);
  assert.match(historicFindings([frame(0), frame(100)]).join('\n'), /No multi-frame/);
});
test('computed-vs-inline movement is retained independently of current', () => {
  const frames = [frame(0), frame(25, 100), frame(50, 100), frame(100)];
  assert.equal(summarize(frames).intermediateFrames, 2);
  frames[1].current = ['#a', '#b'];
  frames[2].current = ['#b'];
  assert.equal(summarize(frames).nonuniqueCurrentFrames, 1);
  assert.equal(summarize(frames).currentBoundaryMismatchFrames, 1);
  assert.equal(historicFindings(frames).length, 2);
});
test('absence of modern Surface metadata is not a historical finding', () => {
  assert.deepEqual(historicFindings([frame(0), frame(0)]), []);
});
test('binding excludes observation timestamps but binds runner, subject and script bytes', () => {
  const b = {
    runner: { actualGitHead: 'a' },
    subject: { actualGitHead: 'b' },
    files: { helper: '1' },
  };
  const copy = structuredClone(b);
  copy.runner.observedAtUTC = 'later';
  assert.equal(bindingFingerprint(b), bindingFingerprint(copy));
  copy.files.helper = '2';
  assert.notEqual(bindingFingerprint(b), bindingFingerprint(copy));
});
test('browser observer reads authentic structural legacy node without writes', () => {
  const style = {
    left: '6px',
    top: '39px',
    width: '92px',
    height: '38px',
    opacity: '1',
    visibility: 'visible',
  };
  const highlight = {
    ...node('div', 'true', true),
    style,
    className: 'bg-primary/5',
    getBoundingClientRect: () => ({ x: 106, y: 59, width: 92, height: 38 }),
  };
  const firstRect = { left: 120, right: 200, top: 60, bottom: 70 },
    lastRect = { left: 110, right: 180, top: 80, bottom: 90 };
  const links = [firstRect, lastRect].map((rect, i) => ({
    hash: `#h${i}`,
    hasAttribute: () => true,
    getAttribute: (key) => (key === 'aria-current' && i === 0 ? 'true' : null),
    getBoundingClientRect: () => rect,
  }));
  const host = {
    children: [highlight],
    scrollLeft: 2,
    scrollTop: 3,
    getBoundingClientRect: () => ({
      left: 100,
      top: 20,
      x: 100,
      y: 20,
      width: 200,
      height: 120,
    }),
    querySelectorAll: () => links,
    querySelector: () => null,
    addEventListener() {},
  };
  const window = { addEventListener() {} };
  const sandbox = {
    window,
    document: {
      querySelector: (s) =>
        s === 'header' ? { getBoundingClientRect: () => ({ height: 50 }) } : host,
      documentElement: { dataset: { theme: 'light' } },
      getElementById: (id) => ({
        matches: () => true,
        getBoundingClientRect: () => ({ top: id === 'h0' ? 0 : 500 }),
      }),
    },
    getComputedStyle: () => style,
    performance: { now: () => 123, timeOrigin: 456 },
    scrollY: 0,
    innerWidth: 1440,
    innerHeight: 900,
    devicePixelRatio: 1,
    visualViewport: { scale: 1 },
    requestAnimationFrame: () => 1,
    setTimeout() {},
  };
  vm.runInNewContext(`(${installOriginalObserver.toString()})()`, sandbox);
  const observed = JSON.parse(JSON.stringify(window.__originalTocEvidence.read()));
  assert.deepEqual(observed.actual, { x: 6, y: 39, width: 92, height: 38 });
  assert.deepEqual(
    observed.target,
    originalTarget(firstRect, lastRect, { left: 100, top: 20 }, 2, 3)
  );
  assert.deepEqual(observed.current, ['#h0']);
  assert.equal(observed.highlightCount, 1);
  assert.equal(Object.hasOwn(highlight, 'dataset'), false);
});
test('observer and runner do not inject markers, Surface or product style fixes', async () => {
  const observer = await readFile(new URL('original-observer.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(
    observer,
    /setAttribute\(|removeAttribute\(|\.style\.[\w]+\s*=(?!=)|createElement\(|wc-site-/
  );
  const runner = await readFile(new URL('capture-original.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(
    runner,
    /data-site-toc-highlight|data-toc-range-ready|checkRestingFrame|checkAnimatedRun/
  );
  assert.match(runner, /subjectAstro\.preview\(config\)/);
});

// Import only the exact existing source guards, with no server or browser launch.
const runnerRoot = process.env.PROTO_UI_TOC_RUNNER_ROOT;
if (runnerRoot) {
  const guards = await import(
    pathToFileURL(path.join(runnerRoot, 'apps/www/scripts/reading-reference-contract.mjs')).href
  );
  const { startStrictPreview } = await import(
    pathToFileURL(path.join(runnerRoot, 'apps/www/scripts/search-production-preview.mjs')).href
  );
  test('unchanged own-origin guard rejects foreign origin, port and credentials-bearing diagnostics', () => {
    assert.equal(guards.allowOwnRequest('http://127.0.0.1:4396/a', 'http://127.0.0.1:4396'), true);
    assert.equal(guards.allowOwnRequest('https://example.com/a', 'http://127.0.0.1:4396'), false);
    assert.equal(guards.allowOwnRequest('http://127.0.0.1:4397/a', 'http://127.0.0.1:4396'), false);
    assert.equal(
      guards.safeEvidenceURL('https://user:secret@example.com/a?token=secret#secret'),
      'https://example.com/a'
    );
  });
  test('unchanged network guard refuses redirect without following or fulfilling it', async () => {
    const calls = [],
      failures = [];
    const route = {
      request: () => ({ url: () => 'http://127.0.0.1:4396/' }),
      fetch: async (options) => {
        calls.push(options);
        return {
          status: () => 302,
          headers: () => ({ location: 'https://elsewhere.test/?secret=x' }),
          dispose: async () => calls.push('dispose'),
        };
      },
      abort: async () => calls.push('abort'),
      fulfill: async () => calls.push('fulfill'),
    };
    assert.equal(
      await guards.routeOwnResponse(route, 'http://127.0.0.1:4396', (x) => failures.push(x)),
      'blocked-redirect'
    );
    assert.equal(calls[0].maxRedirects, 0);
    assert.equal(calls.includes('fulfill'), false);
    assert.equal(calls.includes('dispose'), true);
    assert.equal(failures[0].location, 'https://elsewhere.test/');
  });
  test('unchanged network guard refuses external request without fetching it', async () => {
    let fetched = false;
    const route = {
      request: () => ({ url: () => 'https://elsewhere.test/' }),
      fetch: () => {
        fetched = true;
      },
      abort: async () => {},
    };
    assert.equal(
      await guards.routeOwnResponse(route, 'http://127.0.0.1:4396', () => {}),
      'blocked-external'
    );
    assert.equal(fetched, false);
  });
  test('unchanged preview guard stops fallback port and retains exact requested subject root', async () => {
    let stopped = false,
      seen;
    await assert.rejects(
      startStrictPreview({ root: '/subject/apps/www', port: 4396 }, async (config) => {
        seen = config;
        return {
          server: { address: () => ({ port: 4397, address: '127.0.0.1' }) },
          stop: async () => {
            stopped = true;
          },
        };
      }),
      /refusing fallback/
    );
    assert.equal(stopped, true);
    assert.equal(seen.root, '/subject/apps/www');
    assert.equal(seen.server.host, '127.0.0.1');
  });
}

if (runnerRoot) {
  const { readSourceBinding } = await import(
    pathToFileURL(path.join(runnerRoot, 'apps/www/scripts/reading-reference-contract.mjs')).href
  );
  const { readingBuildInventory } = await import(
    pathToFileURL(path.join(runnerRoot, 'apps/www/scripts/reading-reference-production.mjs')).href
  );
  test('unchanged source guard rejects non-full and wrong source identity', () => {
    assert.throws(() => readSourceBinding('411c354', runnerRoot), /full lowercase/);
    assert.throws(() => readSourceBinding('0'.repeat(40), runnerRoot), /Candidate SHA mismatch/);
  });
  test('unchanged production inventory notices route bytes changing and missing required route', async () => {
    const fixture = await mkdtemp(new URL('./inventory-unit-', import.meta.url));
    try {
      const quick = path.join(fixture, 'zh-cn/start-here/quick-start');
      const radio = path.join(fixture, 'zh-cn/ui-libraries/shadcn/radio-group');
      await mkdir(quick, { recursive: true });
      await mkdir(radio, { recursive: true });
      await writeFile(path.join(quick, 'index.html'), '<p>Original unit fixture</p>');
      await assert.rejects(readingBuildInventory(fixture), /Missing production reading route/);
      await writeFile(path.join(radio, 'index.html'), '<p>Radio unit fixture</p>');
      const before = await readingBuildInventory(fixture);
      await writeFile(path.join(quick, 'index.html'), '<p>Changed unit fixture</p>');
      const after = await readingBuildInventory(fixture);
      assert.equal(before.fileCount, 2);
      assert.equal(after.fileCount, 2);
      assert.notEqual(before.sha256, after.sha256);
    } finally {
      await rm(fixture, { recursive: true, force: true });
    }
  });
}

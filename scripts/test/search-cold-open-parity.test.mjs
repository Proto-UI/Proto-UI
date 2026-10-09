import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import {
  distribution,
  semanticResult,
  validateSample,
  SOURCES,
  SAMPLE_COUNT,
  observeSearch,
} from './search-cold-open-parity.mjs';
const origin = 'http://127.0.0.1:9000';
const good = () => ({
  status: 'complete',
  origin,
  metrics: { openToInputMs: 1, queryToResultMs: 2, secondOpenToInputMs: 0 },
  events: { open: [1, 10], query: 4, result: 6 },
  resultMatches: [{ href: origin + '/zh-cn/ui-libraries/shadcn/button/', text: 'Button' }],
  errors: [],
});
test('valid result requires matching document URL, title, origin', () => {
  assert.equal(
    semanticResult(origin + '/zh-cn/ui-libraries/shadcn/button/', 'Button', origin),
    true
  );
  for (const [url, text] of [
    ['https://elsewhere.test/zh-cn/ui-libraries/shadcn/button/', 'Button'],
    [origin + '/zh-cn/ui-libraries/shadcn/select/', 'Button'],
    [origin + '/zh-cn/ui-libraries/shadcn/button/', 'Loading'],
    ['javascript:alert(1)', 'Button'],
  ])
    assert.equal(semanticResult(url, text, origin), false);
});
test('missing and failed samples cannot turn into successful zero latency', () => {
  assert.deepEqual(distribution([null, undefined, NaN], 3), {
    attempted: 3,
    observed: 0,
    missing: 3,
    min: null,
    median: null,
    p90: null,
    max: null,
    samples: [null, undefined, NaN],
    quantileMethod:
      'nearest rank; missing observations excluded, explicitly counted; no imputation',
  });
  assert.equal(distribution([10, 1, 3, null], 4).median, 3);
  const x = good();
  x.metrics.openToInputMs = null;
  assert.throws(() => validateSample(x));
  x.metrics.openToInputMs = -1;
  assert.throws(() => validateSample(x));
});
test('reject empty or irrelevant results, wrong event sequence and browser errors', () => {
  validateSample(good());
  for (const mutate of [
    (s) => {
      s.resultMatches = [];
    },
    (s) => {
      s.resultMatches[0].text = 'Searching';
    },
    (s) => {
      s.events.open.pop();
    },
    (s) => {
      s.events.result = 1;
    },
    (s) => {
      s.errors.push('boom');
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
test('freeze intended source pair and sample count; observer does not synthesize readiness', () => {
  assert.equal(SOURCES.baseline, '46fa65bb0146d951a08f6368ee4568be57fba3f5');
  assert.equal(SOURCES.current, '4a2320762ba5f4319dec1915ca4e138772dceb0c');
  assert.equal(SAMPLE_COUNT, 10);
  assert.doesNotMatch(observeSearch.toString(), /dispatchEvent|\.focus\(|setAttribute|\.click\(/);
  assert.match(observeSearch.toString(), /document.activeElement === input/);
  assert.match(observeSearch.toString(), /e.isTrusted/);
});

test('fault control cannot pass without actual failed HEAD and successful retry', () => {
  const s = good();
  s.failureControl = true;
  assert.throws(() => validateSample(s));
  s.failureObserved = { at: 2 };
  s.requests = [{ path: '/pagefind/pagefind.js', method: 'HEAD', status: 503 }];
  s.events.events = [{ command: 'retry' }];
  s.metrics.retryToInputMs = 1;
  assert.throws(() => validateSample(s));
  s.requests.push({ path: '/pagefind/pagefind.js', method: 'HEAD', status: 200 });
  validateSample(s);
});

test('observer waits for painted non-inert ancestors, including staging generations', () => {
  const style = () => ({ opacity: '1', display: 'block', visibility: 'visible' });
  const root = { parentElement: null, style: style(), attrs: {} };
  const host = { parentElement: root, style: style(), attrs: {} };
  const opener = {
    isConnected: true,
    parentElement: host,
    style: style(),
    attrs: {},
    disabled: false,
    getBoundingClientRect: () => ({ width: 100, height: 44 }),
    getAttribute(name) {
      return this.attrs[name] ?? null;
    },
    closest(selector) {
      assert.equal(selector, '[inert], [data-projection-generation-state="staging"]');
      for (let node = this; node; node = node.parentElement) {
        if ('inert' in node.attrs || node.attrs['data-projection-generation-state'] === 'staging')
          return node;
      }
      return null;
    },
  };
  const window = { addEventListener() {} };
  let nextFrame;
  let now = 0;
  runInNewContext(`(${observeSearch.toString()})()`, {
    window,
    document: {
      querySelectorAll: () => [opener],
      querySelector: () => null,
    },
    customElements: { get: () => function SiteSearch() {} },
    performance: { now: () => now },
    getComputedStyle: (node) => node.style,
    requestAnimationFrame(callback) {
      nextFrame = callback;
      return now;
    },
    PerformanceObserver: class {
      observe() {}
    },
  });
  const tick = () => {
    now += 16;
    nextFrame();
  };
  host.attrs['data-projection-generation-state'] = 'staging';
  tick();
  assert.equal(window.__coldSearch.opener, null, 'fully laid-out staging command is not ready');
  delete host.attrs['data-projection-generation-state'];
  host.attrs.inert = '';
  tick();
  assert.equal(window.__coldSearch.opener, null, 'inert ancestor is not actionable');
  delete host.attrs.inert;
  root.style.opacity = '0';
  tick();
  assert.equal(window.__coldSearch.opener, null, 'opacity-zero grandparent suppresses paint');
  root.style.opacity = '1';
  host.style.display = 'none';
  tick();
  assert.equal(window.__coldSearch.opener, null, 'display-none ancestor suppresses paint');
  host.style.display = 'block';
  host.style.visibility = 'hidden';
  tick();
  assert.equal(window.__coldSearch.opener, null, 'hidden ancestor suppresses paint');
  host.style.visibility = 'visible';
  tick();
  assert.equal(window.__coldSearch.opener, now, 'native or active painted command becomes ready');
});

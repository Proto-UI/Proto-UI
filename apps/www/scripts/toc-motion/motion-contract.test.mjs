import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAnimatedRun, checkRestingFrame, rectNear } from './motion-contract.mjs';
const rect = (y) => ({ x: 20, y, width: 100, height: 40 });
const frame = (actual = rect(100), target = rect(100)) => ({
  actual,
  target,
  scrollY: 0,
  expectedCurrent: '#one',
  current: ['#one'],
  highlightCount: 1,
  highlightId: 1,
  highlight: { ariaHidden: 'true', pointerEvents: 'none', visibility: 'visible', opacity: '1' },
  surfaceCount: 1,
  surface: {
    defined: true,
    tag: 'wc-site-shadcn-surface',
    visibility: 'visible',
    display: 'block',
    opacity: '1',
    backgroundColor: 'rgb(230, 230, 230)',
    styleTokens: 'rounded-md border-0 bg-muted text-foreground',
  },
});
test('resting checks reject absent/decorative geometry and wrong ownership', () => {
  assert.deepEqual(checkRestingFrame(frame()), []);
  assert.ok(checkRestingFrame({ ...frame(), highlightCount: 0 }).length);
  assert.ok(checkRestingFrame({ ...frame(), surface: { defined: false, tag: 'div' } }).length);
  assert.ok(checkRestingFrame(frame(rect(20))).length);
  assert.equal(rectNear(null, rect(0)), false);
});
test('static before/after states cannot pass animated motion evidence', () => {
  assert.ok(
    checkAnimatedRun([frame(rect(0), rect(0)), frame(rect(100), rect(100))]).failures.length
  );
});
test('multiple intermediate frames prove interpolation but replacements still fail', () => {
  const samples = [frame(rect(0), rect(0)), frame(rect(20)), frame(rect(70)), frame()];
  assert.deepEqual(checkAnimatedRun(samples).failures, []);
  samples[2].highlightId = 2;
  assert.ok(checkAnimatedRun(samples).failures.some((message) => message.includes('replaced')));
});

test('native current is checked against independent linked-heading geometry', () => {
  assert.ok(
    checkRestingFrame({ ...frame(), current: ['#wrong'] }).some((value) =>
      value.includes('reading boundary')
    )
  );
});

test('geometry without visible paint cannot pass', () => {
  assert.ok(
    checkRestingFrame({ ...frame(), highlight: { ...frame().highlight, visibility: 'hidden' } })
      .length
  );
  assert.ok(
    checkRestingFrame({
      ...frame(),
      surface: { ...frame().surface, backgroundColor: 'rgba(0, 0, 0, 0)' },
    }).length
  );
});

test('layout invalidation lag cannot impersonate CSS interpolation', () => {
  const samples = [
    frame(rect(0), rect(0)),
    frame(rect(20), rect(100)),
    frame(rect(70), rect(100)),
    frame(),
  ];
  for (const sample of samples) sample.inlineTarget = sample.actual;
  assert.ok(checkAnimatedRun(samples).failures.some((value) => value.includes('interpolation')));
});

import { classifyFrameSamples } from './motion-contract.mjs';
const epochFrame = (sampledInputEpoch, inputEpoch, current = ['#right']) => ({
  sampledInputEpoch,
  inputEpoch,
  connected: true,
  current,
  expectedCurrent: '#right',
  t: 1,
});
test('isolates an old-frame timer by input epoch without discarding its diagnostic', () => {
  const stale = epochFrame(0, 1, ['#old']);
  const result = classifyFrameSamples([stale, epochFrame(1, 1)], 1);
  assert.deepEqual(result.beforeFrame, [stale]);
  assert.equal(result.postFrame.length, 1);
  assert.deepEqual(result.failures, []);
});
test('same-epoch wrong current still fails even if a later sample is correct', () => {
  assert.ok(
    classifyFrameSamples([epochFrame(1, 1, ['#old']), epochFrame(1, 1)], 1).failures.length
  );
});
test('isolating every sample or omitting the final input epoch cannot pass', () => {
  assert.ok(classifyFrameSamples([epochFrame(0, 1)], 1).failures.length);
  assert.ok(classifyFrameSamples([epochFrame(0, 0)], 1).failures.length);
});

test('native wheel diagnostics disclose hit targets without retargeting or weakening motion', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('./capture-toc-motion.mjs', import.meta.url), 'utf8');
  const required = [
    'document.elementFromPoint(x, y)',
    'node = node.parentElement',
    'overscrollBehaviorY: style.overscrollBehaviorY',
    'overflowY: style.overflowY',
    'scrollTop: node.scrollTop',
    'scrollHeight: node.scrollHeight',
    'clientHeight: node.clientHeight',
    'target: wheelNode(event.target)',
    'hitEvidence: state.readWheelHit(event.clientX, event.clientY)',
    'deltaMode: event.deltaMode',
    'defaultPrevented: event.defaultPrevented',
    "event.type === 'wheel' && event.stage === s.stage",
    'finalFixedPoint: s.readWheelHit(700, 550)',
    'documentScroller: wheelNode(document.scrollingElement)',
    'await page.mouse.move(700, 550)',
    'await page.mouse.wheel(0, 220 * direction)',
    'entry.summary.scrollMax - entry.summary.scrollMin < 500',
    'checks(entry, checkAnimatedRun(entry.frames).failures)',
  ];
  const composedPathCall = /event\s*\.\s*composedPath\s*\(\s*\)/;
  const verify = (candidate) => {
    assert.match(candidate, composedPathCall);
    for (const fragment of required) assert.ok(candidate.includes(fragment), fragment);
    const hitStart = candidate.indexOf('const wheelNode =');
    const hitEnd = candidate.indexOf('const tick =', hitStart);
    assert.ok(!candidate.slice(hitStart, hitEnd).includes('preventDefault('));
    assert.match(
      candidate,
      /entry\.wheelEvidence = await page\.evaluate\([\s\S]*?await save\(\);\s*entry\.inputEpoch/
    );
  };
  verify(source);
  assert.throws(() => verify(source.replace(composedPathCall, '')));
  for (const fragment of required) assert.throws(() => verify(source.replaceAll(fragment, '')));
});

import { createPageErrorDiagnostics } from './page-error-diagnostics.mjs';
test('page errors retain bounded stack, source, phase and trusted input without changing failure truth', () => {
  const failures = [];
  const recorder = createPageErrorDiagnostics({
    sanitize: (text) => text.replaceAll('private-query', '[redacted]'),
    fail: (message) => failures.push(message),
    limit: 2,
    textLimit: 120,
  });
  const entry = recorder.record(
    {
      name: 'RangeError',
      message: 'Maximum call stack size exceeded',
      stack: 'RangeError\n at https://site.test/source.js?private-query:10:2',
    },
    {
      sourceHead: 'actual-head',
      expectedHead: 'expected-head',
      phase: 'continuous-reverse',
      pageURL: 'https://site.test/route?private-query',
      observedAtUTC: 'now',
    }
  );
  assert.equal(failures.length, 1);
  assert.equal(entry.sourceHead, 'actual-head');
  assert.equal(entry.phase, 'continuous-reverse');
  assert.match(entry.stack, /source.js/);
  assert.doesNotMatch(JSON.stringify(entry), /private-query/);
  recorder.annotate(entry, {
    attribution: 'at-error-event',
    route: 'https://site.test/route',
    sourceURL: 'https://site.test/source.js',
    line: 10,
    column: 2,
    phase: 'continuous-reverse',
    browserDropped: 0,
    lastTrustedInput: { type: 'wheel', key: '', targetTag: 'MAIN', timestamp: 123 },
  });
  assert.deepEqual(entry.inputContext.lastTrustedInput, {
    type: 'wheel',
    key: '',
    targetTag: 'MAIN',
    timestamp: 123,
  });
  assert.equal(entry.inputContext.sourceURL, 'https://site.test/source.js');
  assert.equal(entry.inputContext.line, 10);
  recorder.contextFailed(entry, new Error('Page closed before context read'));
  assert.equal(entry.inputContextError, 'Page closed before context read');
  assert.equal(failures.length, 1, 'enrichment does not erase or duplicate the original failure');
  const second = recorder.record({ message: 'second', stack: 'x'.repeat(1000) }, {});
  assert.equal(second.stack.length, 120);
  for (let i = 0; i < 20; i++) assert.equal(recorder.record(new Error('overflow'), {}), null);
  assert.equal(recorder.report.total, 22);
  assert.equal(recorder.report.entries.length, 2);
  assert.equal(recorder.report.dropped, 20);
  assert.equal(failures.length, 3, 'two original errors and one capped diagnostic failure');
  assert.ok(failures.every((value) => value.startsWith('pageerror:')));
  assert.throws(() => createPageErrorDiagnostics({ sanitize: String, fail() {}, limit: 0 }));
});
test('page error capture preserves fatal status and bounded context reads', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('./capture-toc-motion.mjs', import.meta.url), 'utf8');
  const required = [
    "page.on('pageerror'",
    'pageErrors.record(error',
    'sourceHead: report.source?.actualGitHead',
    'phase: activeCase',
    'pageURL: page.url()',
    'if (!event.isTrusted) return',
    'pageErrors.contextFailed(entry, failure)',
    'pendingErrorContexts.delete(work)',
    'await Promise.allSettled([...pendingErrorContexts])',
    'if (report.failures.length) process.exitCode = 1',
  ];
  const verify = (input) => {
    for (const part of required) assert.ok(input.includes(part), part);
  };
  verify(source);
  for (const part of required) assert.throws(() => verify(source.replaceAll(part, '')));
});

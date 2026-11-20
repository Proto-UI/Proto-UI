import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import {
  RUNTIMES,
  assertNoProgressResurrection,
  assertProgressCleanup,
  assertProgressWindow,
  installProgressCollector,
  observeAfterTwoRaf,
  summarizeProgressWindow,
} from './liquid-glass-source-progress.mjs';

// Artificial delivery controls exercise the actual serialized collector.
// They are not browser paint, scheduler timing or cross-adapter acceptance.
function fixture(serialization = {}) {
  let now = 0,
    sequence = 0,
    owned;
  const timers = new Map(),
    rafs = new Map(),
    observers = [];
  const targets = RUNTIMES.map((runtime) => ({ runtime, selector: runtime }));
  const hosts = Object.fromEntries(
    RUNTIMES.map((runtime) => [
      runtime,
      {
        textContent: 'Regular action',
        dataset: {
          demoRef: 'regular',
          materialFrame: '10',
          materialSourceRevision: '5',
          materialSource: 'visible-app-canvas',
          materialQuality: 'self-optical',
          materialReason: 'rendered',
          materialContact: 'rest',
          materialContactSession: '0',
        },
        badPaint: false,
        scope: { dataset: { materialHost: runtime } },
        listeners: new Map(),
        getAttribute(name) {
          return name === 'role'
            ? 'button'
            : name === 'data-pui-material-carrier'
              ? 'contact-v1'
              : null;
        },
        getBoundingClientRect() {
          return { left: 0, top: 0, width: 100, height: 40 };
        },
        querySelectorAll() {
          return [];
        },
        style: { getPropertyValue: () => 'url("data:image/png;base64,controlled-unit-value")' },
        ownerDocument: {
          defaultView: {
            getComputedStyle: (node, pseudo) =>
              pseudo
                ? {
                    backgroundImage: 'url("data:image/png;base64,controlled-unit-value")',
                    left: '-10px',
                    top: '-10px',
                    width: '118px',
                    height: '58px',
                    content: '""',
                    position: 'absolute',
                    pointerEvents: 'none',
                    zIndex: '-1',
                    visibility: 'visible',
                    opacity: node.badPaint ? '0' : '1',
                    backgroundSize: '100% 100%',
                    backgroundRepeat: 'no-repeat',
                  }
                : {
                    borderLeftWidth: '1px',
                    borderTopWidth: '1px',
                    backgroundImage: 'none',
                    backdropFilter: 'none',
                  },
          },
        },
        closest(selector) {
          return selector === '[data-material-host]' ? this.scope : null;
        },
        addEventListener(name, listener) {
          this.listeners.set(name, listener);
        },
        removeEventListener(name, listener) {
          if (this.listeners.get(name) === listener) this.listeners.delete(name);
        },
      },
    ])
  );
  const environment = {
    performance: { now: () => now },
    document: { querySelectorAll: (selector) => (hosts[selector] ? [hosts[selector]] : []) },
    window: {
      liquidMaterialFixture: {
        metrics: () => ({ contexts: 1, consumers: 4, pendingImages: 0, decodedImages: 4 }),
      },
    },
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
        this.targets = new Set();
        observers.push(this);
      }
      observe(target) {
        this.targets.add(target);
      }
      disconnect() {
        this.targets.clear();
      }
    },
    setTimeout: (callback, delay) => {
      const id = ++sequence;
      timers.set(id, { callback, time: now + delay });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    requestAnimationFrame: (callback) => {
      const id = ++sequence;
      rafs.set(id, callback);
      return id;
    },
    cancelAnimationFrame: (id) => rafs.delete(id),
  };
  const context = vm.createContext(environment);
  const install = vm.runInContext(
    `(${serialization.collectorSource ?? installProgressCollector.toString()})`,
    context
  );
  const options = {
    targets,
    durationMs: 5000,
    checkpointOffsetsMs: [0, 1000, 2000, 3000, 4000, 5000],
    observeSource:
      serialization.observeSource ??
      function (element) {
        return {
          committed: !element.badPaint,
          quality: element.dataset.materialQuality,
          carrier: 'contact-v1',
          source: 'visible-app-canvas',
          geometryMatches: true,
          image: 'data:image/png;base64,controlled-unit-value',
        };
      }.toString(),
  };
  const advance = (time) => {
    for (;;) {
      const entry = [...timers.entries()]
        .filter(([, value]) => value.time <= time)
        .sort((a, b) => a[1].time - b[1].time)[0];
      if (!entry) break;
      now = entry[1].time;
      timers.delete(entry[0]);
      entry[1].callback();
    }
    now = time;
    const callbacks = [...rafs.values()];
    rafs.clear();
    for (const callback of callbacks) callback(now);
  };
  const mutate = (runtime, values, oldQuality) => {
    const host = hosts[runtime];
    Object.assign(host.dataset, values);
    const records = [{ target: host, attributeName: 'data-material-frame', oldValue: null }];
    if (oldQuality !== undefined)
      records.push({ target: host, attributeName: 'data-material-quality', oldValue: oldQuality });
    for (const observer of observers) if (observer.targets.has(host)) observer.callback(records);
  };
  const input = (type, buttons, trusted = true) =>
    hosts.wc.listeners.get(type)?.({
      type,
      buttons,
      isTrusted: trusted,
      pointerId: 1,
      timeStamp: now,
      clientX: 100,
      clientY: 100,
    });
  return {
    hosts,
    timers,
    rafs,
    observers,
    environment,
    install: () => (owned = install(options)),
    postDispose: () => vm.runInContext(`(${observeAfterTwoRaf.toString()})`, context)(),
    advance,
    mutate,
    input,
    get collector() {
      return environment.window.__liquidSourceProgress;
    },
    finish() {
      return JSON.parse(JSON.stringify(owned.stop()));
    },
  };
}

function run({
  staleRuntime,
  contactOnly = false,
  drag = false,
  badPaint = false,
  transientFallback = false,
  serialization,
} = {}) {
  const rig = fixture(serialization);
  rig.install();
  if (drag) {
    rig.advance(1);
    rig.input('pointerdown', 1);
    rig.hosts.wc.dataset.materialContact = 'held';
    rig.hosts.wc.dataset.materialContactSession = '1';
  }
  for (let point = 1; point <= 5; point++) {
    rig.advance(point * 1000 - 1);
    for (const runtime of RUNTIMES) {
      if (runtime === staleRuntime) continue;
      rig.mutate(runtime, {
        materialFrame: String(10 + point),
        materialSourceRevision: String(contactOnly ? 5 : 5 + point),
      });
    }
    if (drag) rig.input('pointermove', 1);
    if (point === 2 && transientFallback)
      rig.mutate('vue2', { materialQuality: 'self-optical' }, 'opaque-fallback');
    if (badPaint) rig.hosts.vue.badPaint = true;
    rig.advance(point * 1000);
  }
  if (drag) {
    rig.advance(5001);
    rig.input('pointerup', 0);
    rig.mutate('wc', { materialFrame: '16', materialContact: 'rest' });
  }
  return { rig, sample: rig.finish() };
}

test('serialized collector retains every host/checkpoint and stops its own resources', () => {
  const { rig, sample } = run();
  const summary = assertProgressWindow(sample, 'dynamic-idle');
  assert.equal(sample.checkpoints.length, 6);
  assert.equal(sample.commits.length, 20);
  assert.equal(sample.windowEnd, 5000);
  for (const runtime of RUNTIMES) {
    assert.equal(summary.hosts[runtime].observedFrames, 5);
    assert.equal(summary.hosts[runtime].revisionProgress, 5);
    assert.equal(summary.hosts[runtime].stalledCheckpointIntervals.length, 0);
  }
  assert.equal(rig.collector, undefined);
  assert.equal(rig.timers.size, 0);
  assert.equal(rig.rafs.size, 0);
  assert.ok(rig.observers.every((observer) => observer.targets.size === 0));
  assert.equal(rig.hosts.wc.listeners.size, 0);
});

test('diagnostic hosts need actual runtime scope, not public preview projection markers', () => {
  const rig = fixture();
  assert.ok(
    RUNTIMES.every((runtime) => !Object.hasOwn(rig.hosts[runtime].dataset, 'projectionRuntime'))
  );
  rig.hosts.vue.scope.dataset.materialHost = 'react';
  assert.throws(() => rig.install(), /vue: unexpected host identity/);
  const missing = fixture();
  delete missing.hosts.vue2;
  assert.throws(() => missing.install(), /vue2: expected one real regular host/);
});

test('one starved adapter fails although the other three make progress', () => {
  const { sample } = run({ staleRuntime: 'vue2' });
  const summary = summarizeProgressWindow(sample);
  assert.equal(summary.hosts.vue2.maximumNoObservedRevisionProgressMs, 5000);
  assert.equal(summary.hosts.vue2.stalledCheckpointIntervals.length, 5);
  assert.throws(
    () => assertProgressWindow(sample, 'dynamic-idle'),
    /vue2: no real source progress/
  );
});

test('new contact frames with unchanged source revisions are not source progress', () => {
  const { sample } = run({ contactOnly: true });
  const summary = summarizeProgressWindow(sample);
  assert.equal(summary.hosts.wc.observedFrames, 5);
  assert.equal(summary.hosts.wc.advancingRevisionObservations, 0);
  assert.throws(() => assertProgressWindow(sample, 'dynamic-idle'), /no real source progress/);
});

test('a missing checkpoint cannot be replaced with a later observation', () => {
  const { sample } = run();
  sample.checkpoints.splice(2, 1);
  assert.throws(() => assertProgressWindow(sample, 'dynamic-idle'), /raw checkpoint/);
});

test('bad owned paint and coalesced transient fallback both fail', () => {
  assert.throws(
    () => assertProgressWindow(run({ badPaint: true }).sample, 'dynamic-idle'),
    /owned optical paint/
  );
  const { sample } = run({ transientFallback: true });
  assert.equal(
    sample.checkpoints[2].hosts.find((entry) => entry.runtime === 'vue2').quality,
    'self-optical'
  );
  assert.throws(() => assertProgressWindow(sample, 'dynamic-idle'), /vue2: fallback/);
});

test('trusted WC drag requires matching held and new released paint', () => {
  const { sample } = run({ drag: true });
  assertProgressWindow(sample, 'dynamic-wc-drag');
  const old = structuredClone(sample);
  old.afterRelease.hosts.find((entry) => entry.runtime === 'wc').frame = '15';
  assert.throws(() => assertProgressWindow(old, 'dynamic-wc-drag'), /new owned rest/);
  const untrusted = structuredClone(sample);
  untrusted.inputs[0].trusted = false;
  assert.throws(() => assertProgressWindow(untrusted, 'dynamic-wc-drag'), /Untrusted input/);
});

test('revision skips and censored tail gaps remain visible without latency inference', () => {
  const { sample } = run();
  const third = sample.commits.find((entry) => entry.runtime === 'react' && entry.frame === '13');
  third.revision = '9';
  sample.commits.find((entry) => entry.runtime === 'react' && entry.frame === '14').revision = '10';
  sample.commits.find((entry) => entry.runtime === 'react' && entry.frame === '15').revision = '11';
  const summary = summarizeProgressWindow(sample);
  assert.equal(summary.hosts.react.skippedRevisions[0].skipped, 1);
  assert.equal(summary.hosts.react.trailingCommitGapMs, 1);
  assert.equal(Object.hasOwn(summary.hosts.react, 'sourceToCommitLatencyMs'), false);
});

test('cleanup rejects leaked tasks; missing baseline task fields remain unmeasured', () => {
  const released = { contexts: 0, consumers: 0, pendingImages: 0, decodedImages: 0 };
  assertProgressCleanup(released);
  assertProgressCleanup({ ...released, pendingSourceRefreshTasks: 0 });
  assert.throws(
    () => assertProgressCleanup({ ...released, pendingSourceRefreshTasks: 1 }),
    /pending source refresh task/
  );
  const summary = summarizeProgressWindow(run().sample);
  assert.equal(summary.taskCounterDelta.sourceRefreshTasksRun, null);
  assert.ok(summary.pendingSourceRefreshTasks.every((entry) => entry.value === null));
});

test('an end checkpoint older than its observed commit cannot pass', () => {
  const { sample } = run();
  sample.checkpoints.at(-1).hosts.find((entry) => entry.runtime === 'react').frame = '14';
  assert.throws(
    () => assertProgressWindow(sample, 'dynamic-idle'),
    /boundary frame\/revision regressed/
  );
});

test('candidate task counters must be complete and cumulative; absence is not zero', () => {
  const { sample } = run();
  assert.throws(() => assertProgressWindow(sample, 'dynamic-idle', true), /task metric/);
  for (const [index, point] of [...sample.checkpoints, sample.afterRelease].entries()) {
    Object.assign(point.resources, {
      sourceRefreshTasksScheduled: index,
      sourceRefreshTasksCancelled: 0,
      sourceRefreshTasksRun: index,
      pendingSourceRefreshTasks: 0,
    });
  }
  assertProgressWindow(sample, 'dynamic-idle', true);
  sample.checkpoints[4].resources.sourceRefreshTasksRun = 1;
  assert.throws(() => assertProgressWindow(sample, 'dynamic-idle', true), /Task counter regressed/);
  assert.throws(
    () =>
      assertProgressCleanup(
        { contexts: 0, consumers: 0, pendingImages: 0, decodedImages: 0 },
        true
      ),
    /pending source refresh task/
  );
});

test('an inspector error remains raw evidence and cannot hang the bounded collector', async () => {
  const rig = fixture();
  rig.install();
  const elapsed = rig.collector.elapsed;
  rig.environment.window.liquidMaterialFixture.metrics = () => {
    throw new Error('controlled inspector failure');
  };
  rig.advance(5000);
  await elapsed;
  assert.equal(rig.collector.expired, true);
  const sample = rig.finish();
  assert.match(sample.checkpoints[1].failure, /controlled inspector failure/);
  assert.throws(
    () => assertProgressWindow(sample, 'dynamic-idle'),
    /Checkpoint observation failed/
  );
  assert.equal(rig.rafs.size, 0);
});

test('actual --import tsx collector and owned-paint function serialize without external helpers', () => {
  const collectorUrl = new URL('./liquid-glass-source-progress.mjs', import.meta.url).href;
  const paintUrl = new URL(
    '../../apps/www/src/content/docs/zh-cn/material-paint-observation.ts',
    import.meta.url
  ).href;
  const script = `import { installProgressCollector } from ${JSON.stringify(collectorUrl)};
import { observeOwnedMaterialPaint } from ${JSON.stringify(paintUrl)};
process.stdout.write(JSON.stringify({ collectorSource: installProgressCollector.toString(), observeSource: observeOwnedMaterialPaint.toString() }));`;
  const serialization = JSON.parse(
    execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-'], {
      cwd: fileURLToPath(new URL('../../', import.meta.url)),
      input: script,
      encoding: 'utf8',
      timeout: 10000,
    })
  );
  for (const source of Object.values(serialization))
    assert.doesNotMatch(source, /\b__(?:name|vite\w*)\b/);
  assertProgressWindow(run({ serialization }).sample, 'dynamic-idle');
  assert.throws(
    () => assertProgressWindow(run({ serialization, badPaint: true }).sample, 'dynamic-idle'),
    /owned optical paint/
  );
});

test('collector refuses an existing marker and retains a foreign replacement on owned stop', () => {
  const rig = fixture();
  rig.install();
  const original = rig.collector;
  assert.throws(() => rig.install(), /Previous source-progress collector/);
  assert.equal(rig.collector, original);
  const foreign = { foreign: true };
  rig.environment.window.__liquidSourceProgress = foreign;
  const sample = rig.finish();
  assert.equal(rig.collector, foreign);
  assert.equal(sample.collectorIdentityDrift, true);
  assert.equal(rig.timers.size, 0);
  assert.equal(rig.rafs.size, 0);
  assert.throws(() => assertProgressWindow(sample, 'dynamic-idle'), /marker ownership changed/);
});

test('post-disposal collector waits two RAFs and rejects resource or task resurrection', async () => {
  const released = {
    contexts: 0,
    consumers: 0,
    pendingImages: 0,
    decodedImages: 0,
    sourceRefreshTasksScheduled: 5,
    sourceRefreshTasksCancelled: 2,
    sourceRefreshTasksRun: 3,
    pendingSourceRefreshTasks: 0,
  };
  const rig = fixture();
  rig.environment.window.liquidMaterialFixture.metrics = () => ({ ...released });
  const done = rig.postDispose();
  rig.advance(16);
  rig.advance(32);
  const settled = JSON.parse(JSON.stringify(await done));
  assertNoProgressResurrection(released, settled, true);
  assert.equal(rig.rafs.size, 0);
  assert.equal(rig.timers.size, 0);
  assert.throws(
    () =>
      assertNoProgressResurrection(
        released,
        { ...settled, resources: { ...released, pendingSourceRefreshTasks: 1 } },
        true
      ),
    /pending source refresh task/
  );
  assert.throws(
    () =>
      assertNoProgressResurrection(
        released,
        { ...settled, resources: { ...released, sourceRefreshTasksRun: 4 } },
        true
      ),
    /Task activity after disposal/
  );
});

test('post-disposal missing RAFs produce a bounded failed observation', async () => {
  const rig = fixture();
  const released = { contexts: 0, consumers: 0, pendingImages: 0, decodedImages: 0 };
  rig.environment.window.liquidMaterialFixture.metrics = () => released;
  const done = rig.postDispose();
  rig.advance(1000);
  const settled = JSON.parse(JSON.stringify(await done));
  assert.equal(settled.timedOut, true);
  assert.equal(rig.rafs.size, 0);
  assert.throws(() => assertNoProgressResurrection(released, settled), /RAF observation timed out/);
});

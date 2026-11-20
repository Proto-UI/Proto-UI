import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { distribution } from './liquid-glass-frame-budget.mjs';

// Separate fairness evidence. This does not instrument or replace the main
// 60-press latency probe, and it does not infer source-to-presentation latency.
const FIXTURE = '/en/test/liquid-glass-material/';
export const RUNTIMES = ['wc', 'react', 'vue', 'vue2'];
const TARGETS = RUNTIMES.map((runtime) => ({
  runtime,
  selector: `[data-material-host="${runtime}"] [data-demo-ref="regular"]`,
}));
const WORKLOAD = {
  route: FIXTURE,
  viewport: { width: 1000, height: 1050 },
  dpr: 1,
  targets: TARGETS,
  modes: ['dynamic-idle', 'dynamic-wc-drag'],
  durationMs: 5000,
  checkpointOffsetsMs: [0, 1000, 2000, 3000, 4000, 5000],
  requestedMoveSpacingMs: 1000 / 120,
  maximumMoves: 600,
  releaseTimeoutMs: 2000,
  sourceCadence: 'Unmodified diagnostic fixture: 120 ms, subject to actual RAF delivery.',
};
const SOURCE_FILES = [
  'pnpm-lock.yaml',
  'packages/adapters/base/src/material/program.ts',
  'packages/adapters/base/src/material/program-pool.ts',
  'packages/adapters/base/src/material/source.ts',
  'packages/adapters/base/src/material/sink.ts',
  'packages/adapters/base/src/material/image-prepare.ts',
  'packages/adapters/base/src/material/contact-motion.ts',
  'packages/adapters/base/src/material/liquidgl-kernel.generated.ts',
  'packages/adapters/web-component/src/adapt.ts',
  'apps/www/src/components/PrototypePreviewer/preview-material-scene.ts',
  'apps/www/src/pages/en/test/liquid-glass-material.astro',
  'apps/www/src/content/docs/zh-cn/browser-harness.ts',
  'apps/www/src/content/docs/zh-cn/material-paint-observation.ts',
];
const OPTIONAL_SOURCE_FILES = [
  'packages/adapters/base/src/material/source-refresh-task.ts',
  'packages/adapters/base/src/material/program-inputs.ts',
  'packages/adapters/base/src/material/prefilter.ts',
];
const TASK_COUNTERS = [
  'sourceRefreshTasksScheduled',
  'sourceRefreshTasksCancelled',
  'sourceRefreshTasksRun',
];
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const integer = (value) =>
  (typeof value === 'number' || (typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value))) &&
  Number.isSafeInteger(Number(value)) &&
  Number(value) >= 0;
const ownedPaint = (paint) =>
  paint?.committed === true &&
  paint.quality === 'self-optical' &&
  paint.carrier === 'contact-v1' &&
  paint.source === 'visible-app-canvas' &&
  paint.geometryMatches === true;

/** Browser callback: self-contained, with all configuration passed explicitly. */
export function installProgressCollector({
  targets,
  durationMs,
  checkpointOffsetsMs,
  observeSource,
}) {
  if (Object.hasOwn(window, '__liquidSourceProgress'))
    throw new Error('Previous source-progress collector still owns its marker');
  const observePaint = Function(`return (${observeSource})`)();
  const nodes = targets.map(({ runtime, selector }) => {
    const matches = document.querySelectorAll(selector);
    if (matches.length !== 1) throw new Error(`${runtime}: expected one real regular host`);
    const node = matches[0];
    if (
      node.getAttribute('role') !== 'button' ||
      node.dataset.demoRef !== 'regular' ||
      node.closest('[data-material-host]')?.dataset.materialHost !== runtime
    )
      throw new Error(`${runtime}: unexpected host identity`);
    return { runtime, node };
  });
  const start = performance.now();
  const state = {
    start,
    intendedEnd: start + durationMs,
    windowEnd: null,
    stoppedAt: null,
    collectorIdentityDrift: false,
    identities: nodes.map(({ runtime, node }) => ({
      runtime,
      role: node.getAttribute('role'),
      text: node.textContent,
      dataset: { ...node.dataset },
      closestMaterialHost: node.closest('[data-material-host]')?.dataset.materialHost,
    })),
    checkpoints: [],
    batches: [],
    commits: [],
    states: [],
    inputs: [],
    raf: [],
  };
  let active = true,
    expired = false,
    raf;
  const timers = [];
  let resolveElapsed;
  const elapsed = new Promise((resolve) => {
    resolveElapsed = resolve;
  });
  const status = (runtime, node, time) => ({
    runtime,
    time,
    frame: node.dataset.materialFrame,
    revision: node.dataset.materialSourceRevision,
    quality: node.dataset.materialQuality ?? null,
    reason: node.dataset.materialReason ?? null,
    contact: node.dataset.materialContact,
    session: node.dataset.materialContactSession,
  });
  const checkpoint = (index, plannedOffsetMs) => {
    const time = performance.now();
    const entry = {
      index,
      plannedAt: plannedOffsetMs === null ? null : start + plannedOffsetMs,
      time,
      hosts: nodes.map(({ runtime, node }) => {
        const facts = status(runtime, node, time);
        try {
          return { ...facts, paint: observePaint(node) };
        } catch (error) {
          return { ...facts, failure: String(error) };
        }
      }),
      resources: {},
    };
    try {
      entry.resources = window.liquidMaterialFixture.metrics();
    } catch (error) {
      entry.failure = String(error);
    }
    entry.finishedAt = performance.now();
    return entry;
  };
  state.checkpoints.push(checkpoint(0, 0));
  const lastFrames = new Map(nodes.map(({ node }) => [node, node.dataset.materialFrame]));
  const byNode = new Map(nodes.map(({ runtime, node }) => [node, runtime]));
  const observer = new MutationObserver((records) => {
    // Record callback entry before any style/geometry work. Only scalar facts
    // are read here; owned paint is checked at the declared boundaries.
    const time = performance.now();
    const touched = new Set(records.map((record) => record.target));
    state.batches.push({
      time,
      records: records.length,
      runtimes: [...touched].map((n) => byNode.get(n)),
    });
    for (const record of records) {
      if (record.attributeName === 'data-material-quality' && record.oldValue !== 'self-optical')
        state.states.push({
          runtime: byNode.get(record.target),
          time,
          quality: record.oldValue,
          observedAs: 'mutation-oldValue',
        });
    }
    for (const { runtime, node } of nodes) {
      if (!touched.has(node)) continue;
      const entry = status(runtime, node, time);
      state.states.push(entry);
      if (entry.frame !== lastFrames.get(node)) {
        state.commits.push(entry);
        lastFrames.set(node, entry.frame);
      }
    }
  });
  for (const { node } of nodes)
    observer.observe(node, {
      attributes: true,
      attributeOldValue: true,
      attributeFilter: [
        'data-material-frame',
        'data-material-source-revision',
        'data-material-quality',
        'data-material-reason',
        'data-material-contact',
      ],
    });
  const target = nodes.find(({ runtime }) => runtime === 'wc').node;
  const input = (event) => {
    const time = performance.now();
    state.inputs.push({
      ...status('wc', target, time),
      type: event.type,
      timestamp: event.timeStamp,
      trusted: event.isTrusted,
      pointerId: event.pointerId,
      buttons: event.buttons,
      clientX: event.clientX,
      clientY: event.clientY,
    });
  };
  for (const type of ['pointerdown', 'pointermove', 'pointerup'])
    target.addEventListener(type, input, true);
  const tick = (timestamp) => {
    if (!active) return;
    state.raf.push({ timestamp, observedAt: performance.now() });
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  for (const [index, offset] of checkpointOffsetsMs.entries()) {
    if (index === 0) continue;
    timers.push(
      setTimeout(() => {
        state.checkpoints.push(checkpoint(index, offset));
        if (offset === durationMs) {
          state.windowEnd = state.checkpoints.at(-1).time;
          expired = true;
          resolveElapsed();
        }
      }, offset)
    );
  }
  const collector = {
    start,
    hosts: nodes.length,
    elapsed,
    get expired() {
      return expired;
    },
    stop() {
      if (!active) return state;
      state.collectorIdentityDrift = window.__liquidSourceProgress !== collector;
      // Teardown is retained separately from the timed observation interval.
      state.afterRelease = checkpoint('after-release', null);
      state.stoppedAt = performance.now();
      active = false;
      cancelAnimationFrame(raf);
      for (const timer of timers) clearTimeout(timer);
      observer.disconnect();
      for (const type of ['pointerdown', 'pointermove', 'pointerup'])
        target.removeEventListener(type, input, true);
      if (window.__liquidSourceProgress === collector) delete window.__liquidSourceProgress;
      return state;
    },
  };
  window.__liquidSourceProgress = collector;
  return collector;
}

/** Browser callback: bounded post-disposal observation, with no page mutation. */
export function observeAfterTwoRaf() {
  return new Promise((resolve) => {
    const state = { started: performance.now(), raf: [], timedOut: false };
    let active = true,
      raf,
      timer;
    const finish = () => {
      if (!active) return;
      active = false;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      state.ended = performance.now();
      try {
        state.resources = window.liquidMaterialFixture.metrics();
      } catch (error) {
        state.failure = String(error);
      }
      resolve(state);
    };
    const tick = (timestamp) => {
      state.raf.push({ timestamp, observedAt: performance.now() });
      if (state.raf.length === 2) finish();
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    timer = setTimeout(() => {
      state.timedOut = true;
      finish();
    }, 1000);
  });
}

export function summarizeProgressWindow(sample) {
  const checkpoints = [...sample.checkpoints].sort((a, b) => a.index - b.index);
  const start = checkpoints[0];
  const end = checkpoints.at(-1);
  const bounded = (entry) => entry.time >= sample.start && entry.time <= sample.windowEnd;
  const hosts = Object.fromEntries(
    RUNTIMES.map((runtime) => {
      const first = start?.hosts.find((entry) => entry.runtime === runtime);
      const last = end?.hosts.find((entry) => entry.runtime === runtime);
      const commits = sample.commits.filter((entry) => entry.runtime === runtime && bounded(entry));
      const observations = [first, ...commits].filter(Boolean);
      const intervals = commits.slice(1).map((entry, i) => entry.time - commits[i].time);
      const advancing = [];
      const skippedRevisions = [];
      const frameSkips = [];
      const invalidOrder = [];
      for (let i = 1; i < observations.length; i++) {
        const previous = observations[i - 1],
          current = observations[i];
        if (
          ![previous.frame, current.frame, previous.revision, current.revision].every(integer) ||
          Number(current.frame) <= Number(previous.frame) ||
          Number(current.revision) < Number(previous.revision)
        ) {
          invalidOrder.push(current);
          continue;
        }
        if (Number(current.revision) > Number(previous.revision)) advancing.push(current);
        if (Number(current.revision) > Number(previous.revision) + 1)
          skippedRevisions.push({
            time: current.time,
            from: previous.revision,
            to: current.revision,
            skipped: Number(current.revision) - Number(previous.revision) - 1,
          });
        if (Number(current.frame) > Number(previous.frame) + 1)
          frameSkips.push({
            time: current.time,
            from: previous.frame,
            to: current.frame,
            skipped: Number(current.frame) - Number(previous.frame) - 1,
          });
      }
      const stalledCheckpointIntervals = checkpoints.slice(1).flatMap((point, i) => {
        const before = checkpoints[i].hosts.find((entry) => entry.runtime === runtime);
        const after = point.hosts.find((entry) => entry.runtime === runtime);
        return before &&
          after &&
          integer(before.revision) &&
          integer(after.revision) &&
          Number(after.revision) > Number(before.revision)
          ? []
          : [
              {
                fromIndex: checkpoints[i].index,
                toIndex: point.index,
                start: checkpoints[i].time,
                end: point.time,
                before: before?.revision ?? null,
                after: after?.revision ?? null,
              },
            ];
      });
      const boundaries = checkpoints.map((point) =>
        point.hosts.find((entry) => entry.runtime === runtime)
      );
      const invalidBoundaryOrder = boundaries.filter((entry, index) => {
        const previous = boundaries[index - 1];
        return (
          !entry ||
          !integer(entry.frame) ||
          !integer(entry.revision) ||
          (previous &&
            (Number(entry.frame) < Number(previous.frame) ||
              Number(entry.revision) < Number(previous.revision)))
        );
      });
      const finalCommit = commits.at(-1);
      if (
        finalCommit &&
        last &&
        (Number(last.frame) < Number(finalCommit.frame) ||
          Number(last.revision) < Number(finalCommit.revision))
      )
        invalidBoundaryOrder.push(last);
      const frameTimes = [sample.start, ...commits.map((entry) => entry.time), sample.windowEnd];
      const revisionTimes = [
        sample.start,
        ...advancing.map((entry) => entry.time),
        sample.windowEnd,
      ];
      return [
        runtime,
        {
          observedFrames: commits.length,
          advancingRevisionObservations: advancing.length,
          revisionProgress:
            first && last && integer(first.revision) && integer(last.revision)
              ? Number(last.revision) - Number(first.revision)
              : null,
          interCommitMs: distribution(intervals),
          interRevisionProgressMs: distribution(
            advancing.slice(1).map((entry, i) => entry.time - advancing[i].time)
          ),
          leadingCommitGapMs: commits.length
            ? commits[0].time - sample.start
            : sample.windowEnd - sample.start,
          trailingCommitGapMs: sample.windowEnd - (commits.at(-1)?.time ?? sample.start),
          maximumNoObservedCommitMs: Math.max(
            ...frameTimes.slice(1).map((time, i) => time - frameTimes[i])
          ),
          maximumNoObservedRevisionProgressMs: Math.max(
            ...revisionTimes.slice(1).map((time, i) => time - revisionTimes[i])
          ),
          skippedRevisions,
          frameSkips,
          invalidOrder,
          invalidBoundaryOrder,
          stalledCheckpointIntervals,
          invalidOwnedBoundaries: boundaries.filter((entry) => !entry || !ownedPaint(entry.paint)),
          nonOpticalStates: sample.states.filter(
            (entry) => entry.runtime === runtime && entry.quality !== 'self-optical'
          ),
        },
      ];
    })
  );
  const resourcesBefore = start?.resources ?? {},
    resourcesAfter = end?.resources ?? {};
  const moves = sample.inputs.filter((event) => event.type === 'pointermove');
  return {
    durationMs: sample.windowEnd - sample.start,
    hosts,
    rafIntervalMs: distribution(
      sample.raf
        .filter((entry) => entry.observedAt <= sample.windowEnd)
        .slice(1)
        .map((entry, i) => entry.timestamp - sample.raf[i].timestamp)
    ),
    taskCounterDelta: Object.fromEntries(
      TASK_COUNTERS.map((key) => [
        key,
        Number.isFinite(resourcesBefore[key]) && Number.isFinite(resourcesAfter[key])
          ? resourcesAfter[key] - resourcesBefore[key]
          : null,
      ])
    ),
    pendingSourceRefreshTasks: checkpoints.map((point) => ({
      index: point.index,
      time: point.time,
      value: point.resources.pendingSourceRefreshTasks ?? null,
    })),
    moveCount: moves.length,
    actualMoveSpacingMs: distribution(moves.slice(1).map((event, i) => event.time - moves[i].time)),
    untrustedInputs: sample.inputs.filter((event) => !event.trusted).length,
  };
}

export function assertProgressWindow(sample, mode, taskMetricsRequired = false) {
  assert.equal(sample.collectorIdentityDrift, false, 'Collector marker ownership changed');
  assert.ok(
    Number.isFinite(sample.windowEnd) && sample.windowEnd > sample.start,
    'Missing bounded observation end'
  );
  assert.deepEqual(
    sample.checkpoints.map((point) => point.index).sort((a, b) => a - b),
    [0, 1, 2, 3, 4, 5],
    'Missing/duplicate raw checkpoint'
  );
  const points = [...sample.checkpoints, sample.afterRelease];
  for (const [index, point] of points.entries()) {
    assert.ok(point, 'Missing after-release boundary');
    assert.equal(point.failure, undefined, 'Checkpoint observation failed');
    assert.deepEqual(
      point.hosts.map((entry) => entry.runtime).sort(),
      [...RUNTIMES].sort(),
      'Missing/duplicate host'
    );
    assert.ok(
      point.hosts.every((entry) => ownedPaint(entry.paint)),
      'Boundary lacks owned optical paint'
    );
    if (taskMetricsRequired || Object.hasOwn(point.resources, 'pendingSourceRefreshTasks')) {
      for (const key of [...TASK_COUNTERS, 'pendingSourceRefreshTasks'])
        assert.ok(
          Number.isSafeInteger(point.resources[key]) && point.resources[key] >= 0,
          `Missing/invalid task metric ${key}`
        );
      if (index > 0)
        for (const key of TASK_COUNTERS)
          assert.ok(
            point.resources[key] >= points[index - 1].resources[key],
            `Task counter regressed: ${key}`
          );
    }
  }
  const summary = summarizeProgressWindow(sample);
  for (const [runtime, row] of Object.entries(summary.hosts)) {
    assert.ok(
      row.observedFrames > 0 && row.advancingRevisionObservations > 0 && row.revisionProgress > 0,
      `${runtime}: no real source progress`
    );
    assert.equal(row.invalidOrder.length, 0, `${runtime}: invalid frame/revision order`);
    assert.equal(
      row.invalidBoundaryOrder.length,
      0,
      `${runtime}: boundary frame/revision regressed`
    );
    assert.equal(row.nonOpticalStates.length, 0, `${runtime}: fallback during observation`);
  }
  assert.equal(summary.untrustedInputs, 0, 'Untrusted input');
  assert.ok(
    sample.inputs.every(
      (entry) =>
        Number.isFinite(entry.timestamp) && entry.timestamp >= 0 && entry.timestamp <= entry.time
    ),
    'Invalid input event timestamp'
  );
  if (mode === 'dynamic-wc-drag') {
    const downs = sample.inputs.filter((entry) => entry.type === 'pointerdown');
    const ups = sample.inputs.filter((entry) => entry.type === 'pointerup');
    assert.equal(downs.length, 1, 'Missing/duplicate down');
    assert.equal(ups.length, 1, 'Missing/duplicate up');
    const down = downs[0],
      up = ups[0];
    assert.equal(down.buttons, 1);
    assert.equal(up.buttons, 0);
    assert.equal(down.pointerId, up.pointerId);
    assert.ok(down.time < sample.windowEnd && up.time >= sample.windowEnd && up.time > down.time);
    assert.ok(summary.moveCount > 0, 'Missing trusted drag moves');
    assert.ok(
      sample.inputs
        .filter((entry) => entry.type === 'pointermove')
        .every(
          (entry) =>
            entry.time >= down.time &&
            entry.time < up.time &&
            entry.pointerId === down.pointerId &&
            entry.buttons === 1
        )
    );
    const initial = sample.checkpoints[0].hosts.find((entry) => entry.runtime === 'wc');
    assert.ok(integer(initial.session) && integer(down.frame) && integer(up.frame));
    const session = Number(initial.session) + 1;
    const held = sample.checkpoints
      .flatMap((point) => point.hosts)
      .filter(
        (entry) =>
          entry.runtime === 'wc' &&
          entry.contact === 'held' &&
          Number(entry.session) === session &&
          Number(entry.frame) > Number(down.frame) &&
          entry.time >= down.time
      );
    assert.ok(held.length > 0, 'No owned held paint during trusted drag');
    const rest = sample.afterRelease.hosts.find((entry) => entry.runtime === 'wc');
    assert.ok(
      rest.contact === 'rest' &&
        Number(rest.session) === session &&
        Number(rest.frame) > Number(held.at(-1).frame) &&
        Number(rest.frame) > Number(up.frame),
      'Missing new owned rest after release'
    );
  } else assert.equal(sample.inputs.length, 0, 'Idle window received pointer injection');
  return summary;
}

export function assertProgressCleanup(resources, taskMetricsRequired = false) {
  for (const key of ['contexts', 'consumers', 'pendingImages', 'decodedImages'])
    assert.equal(resources[key], 0, `Leaked ${key}`);
  if (taskMetricsRequired || resources.pendingSourceRefreshTasks !== undefined)
    assert.equal(resources.pendingSourceRefreshTasks, 0, 'Leaked pending source refresh task');
}

export function assertNoProgressResurrection(immediate, settled, taskMetricsRequired = false) {
  assertProgressCleanup(immediate, taskMetricsRequired);
  assert.equal(settled.failure, undefined, 'Post-disposal observation failed');
  assert.equal(settled.timedOut, false, 'Post-disposal RAF observation timed out');
  assert.equal(settled.raf.length, 2, 'Missing post-disposal RAF observations');
  assertProgressCleanup(settled.resources, taskMetricsRequired);
  for (const key of TASK_COUNTERS) {
    if (
      taskMetricsRequired ||
      immediate[key] !== undefined ||
      settled.resources[key] !== undefined
    ) {
      assert.ok(
        Number.isSafeInteger(immediate[key]) && immediate[key] >= 0,
        `Missing cleanup task counter: ${key}`
      );
      assert.equal(settled.resources[key], immediate[key], `Task activity after disposal: ${key}`);
    }
  }
}

async function observe(output) {
  assert.ok(
    !process.env.PROTO_UI_BROWSER_BASE_URL,
    'Source-bound diagnostic requires the owned local harness'
  );
  const root = process.cwd();
  await mkdir(output, { recursive: true });
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const changes = git('status', '--porcelain');
  assert.equal(changes, '', 'Source-bound diagnostic requires a clean checkout');
  const mainProbeHash = sha256(
    await readFile(new URL('./liquid-glass-frame-budget.mjs', import.meta.url))
  );
  const report = {
    started: new Date().toISOString(),
    kind: 'independent-four-host-source-progress',
    source: {
      sha: git('rev-parse', 'HEAD'),
      tree: git('rev-parse', 'HEAD^{tree}'),
      changes,
      hashes: {},
    },
    probe: {
      sha256: sha256(await readFile(fileURLToPath(import.meta.url))),
      latencyProbeSha256: mainProbeHash,
    },
    workload: WORKLOAD,
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      osRelease: os.release(),
      cpus: os.cpus().length,
      headless: true,
    },
    limitations: [
      'Separate diagnostic, not the main 60-press latency result; no source-to-commit or physical FPS/latency claim.',
      'The companion latency probe is bound by its actual SHA-256; a changed hash identifies a new measurement instrument revision, not an unchanged historical probe.',
      'MO observes published frame/revision markers. Owned paint is synchronously confirmed only at the recorded boundaries; observer delivery may coalesce intermediate frames.',
      'Revision skips describe gaps between observed published revisions, not exact source notifications, lost events or measured source-to-paint latency.',
      'Leading/trailing gaps are censored by the observation window. Every checkpoint stall and actual injection interval is retained; no timing threshold filters samples.',
      'Source cadence and fixture are unchanged. No pause, redraw, source replacement or pendingImages=0 wait is injected.',
      'The functional gate requires four hosts to progress in each window, not a new fairness deadline or 120 Hz guarantee.',
      'Source refresh task counters are cumulative; pendingSourceRefreshTasks is an instantaneous gauge. Missing fields are null, not zero.',
    ],
    windows: [],
    logs: [],
    failures: [],
    cleanup: null,
  };
  for (const file of [...SOURCE_FILES, ...OPTIONAL_SOURCE_FILES]) {
    try {
      report.source.hashes[file] = sha256(await readFile(path.join(root, file)));
    } catch (error) {
      if (error.code === 'ENOENT' && OPTIONAL_SOURCE_FILES.includes(file))
        report.source.hashes[file] = null;
      else throw error;
    }
  }
  report.taskMetricsRequired = report.source.hashes[OPTIONAL_SOURCE_FILES[0]] !== null;
  const save = () => writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  const failure = (stage, error) => report.failures.push({ stage, message: String(error) });
  const { startServer, stopServer, launchBrowser } = await import(
    pathToFileURL(path.join(root, 'apps/www/src/content/docs/zh-cn/browser-harness.ts')).href
  );
  const { observeOwnedMaterialPaint } = await import(
    pathToFileURL(path.join(root, 'apps/www/src/content/docs/zh-cn/material-paint-observation.ts'))
      .href
  );
  let browser,
    context,
    page,
    pressed = false,
    ready = false;
  let interrupt;
  const interrupted = new Promise((_, reject) => {
    interrupt = () => reject(new Error('Diagnostic interrupted'));
  });
  process.once('SIGTERM', interrupt);
  process.once('SIGINT', interrupt);
  try {
    await save();
    await Promise.race([
      interrupted,
      (async () => {
        const baseUrl = await startServer([FIXTURE]);
        browser = await launchBrowser();
        report.environment.browser = browser.version();
        const system = await browser.newBrowserCDPSession();
        report.environment.gpu = (await system.send('SystemInfo.getInfo')).gpu;
        report.environment.gpuClassification =
          /swiftshader|llvmpipe|lavapipe|software rasterizer/i.test(
            JSON.stringify(report.environment.gpu)
          )
            ? 'software'
            : 'unclassified; inspect recorded renderer';
        await system.detach();
        context = await browser.newContext({
          viewport: WORKLOAD.viewport,
          deviceScaleFactor: 1,
          colorScheme: 'light',
          serviceWorkers: 'block',
        });
        await context.route('**/*', (request) =>
          new URL(request.request().url()).origin === new URL(baseUrl).origin
            ? request.continue()
            : request.abort()
        );
        page = await context.newPage();
        page.setDefaultTimeout(20_000);
        page.on('pageerror', (error) => report.logs.push(String(error)));
        const cdp = await context.newCDPSession(page);
        await cdp.send('Emulation.setEmulatedMedia', {
          features: Object.entries({
            'prefers-color-scheme': 'light',
            'prefers-reduced-motion': 'no-preference',
            'prefers-reduced-transparency': 'no-preference',
            'prefers-contrast': 'no-preference',
            'forced-colors': 'none',
          }).map(([name, value]) => ({ name, value })),
        });
        await page.goto(`${baseUrl}${FIXTURE}`, { waitUntil: 'networkidle', timeout: 60_000 });
        await page.waitForFunction(
          () =>
            document.documentElement.dataset.materialReady === 'true' ||
            !!document.documentElement.dataset.materialError
        );
        assert.equal(
          await page.evaluate(() => document.documentElement.dataset.materialError ?? null),
          null
        );
        ready = true;
        await page.waitForFunction(
          (targets) =>
            targets.every(({ selector }) => {
              const node = document.querySelector(selector);
              return (
                node?.dataset.materialQuality === 'self-optical' &&
                node.dataset.materialContact === 'rest'
              );
            }),
          TARGETS
        );
        const target = page.locator(TARGETS[0].selector);
        const bounds = await target.boundingBox();
        assert.ok(bounds);
        await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        for (const mode of WORKLOAD.modes) {
          let collector;
          const window = { mode, injectedMoves: 0 };
          try {
            collector = await page.evaluateHandle(installProgressCollector, {
              targets: TARGETS,
              durationMs: WORKLOAD.durationMs,
              checkpointOffsetsMs: WORKLOAD.checkpointOffsetsMs,
              observeSource: observeOwnedMaterialPaint.toString(),
            });
            if (mode === 'dynamic-wc-drag') {
              pressed = true;
              await page.mouse.down();
              for (let move = 0; move < WORKLOAD.maximumMoves; move++) {
                if (await collector.evaluate((owned) => owned.expired)) break;
                await page.mouse.move(
                  bounds.x +
                    bounds.width / 2 +
                    Math.sin((move * Math.PI) / 30) * bounds.width * 0.25,
                  bounds.y +
                    bounds.height / 2 +
                    Math.cos((move * Math.PI) / 30) * bounds.height * 0.2
                );
                window.injectedMoves++;
                await page.waitForTimeout(WORKLOAD.requestedMoveSpacingMs);
              }
              assert.ok(
                await collector.evaluate((owned) => owned.expired),
                'Input cap reached before the bounded window elapsed'
              );
              const releaseFrame = await target.getAttribute('data-material-frame');
              assert.ok(integer(releaseFrame));
              await page.mouse.up();
              pressed = false;
              await page.waitForFunction(
                ({ selector, frame }) => {
                  const node = document.querySelector(selector);
                  return (
                    node?.dataset.materialContact === 'rest' &&
                    node.dataset.materialQuality === 'self-optical' &&
                    Number(node.dataset.materialFrame) > Number(frame)
                  );
                },
                { selector: TARGETS[0].selector, frame: releaseFrame },
                { timeout: WORKLOAD.releaseTimeoutMs }
              );
            } else await collector.evaluate((owned) => owned.elapsed);
          } catch (error) {
            window.failure = String(error);
            failure(mode, error);
          } finally {
            if (pressed) {
              await page.mouse.up().catch((error) => failure(`${mode}-pointer-cleanup`, error));
              pressed = false;
            }
            if (collector)
              window.sample = await collector
                .evaluate((owned) => owned.stop())
                .catch((error) => {
                  failure(`${mode}-collector-stop`, error);
                  return null;
                });
            await collector?.dispose().catch((error) => failure(`${mode}-collector-handle`, error));
            if (window.sample) {
              for (const checkpoint of [...window.sample.checkpoints, window.sample.afterRelease])
                for (const host of checkpoint.hosts) {
                  if (typeof host.paint?.image === 'string') {
                    const { image, ...facts } = host.paint;
                    host.paint = {
                      ...facts,
                      imageSha256: sha256(image),
                      imageCharacters: image.length,
                    };
                  }
                }
              window.summary = summarizeProgressWindow(window.sample);
            }
            report.windows.push(window);
            await save();
          }
          if (window.sample) {
            try {
              assertProgressWindow(window.sample, mode, report.taskMetricsRequired);
            } catch (error) {
              failure(`${mode}-acceptance`, error);
              await save();
            }
          }
          await page.screenshot({ path: path.join(output, `${mode}.png`), timeout: 5000 });
        }
      })(),
    ]);
  } catch (error) {
    failure('setup-or-interruption', error);
  } finally {
    if (pressed) await page?.mouse.up().catch((error) => failure('pointer-cleanup', error));
    if (ready) {
      try {
        await page.evaluate(() => window.liquidMaterialFixture.dispose());
        report.cleanup = await page.evaluate(() => window.liquidMaterialFixture.metrics());
        report.cleanupAfterTwoRaf = await page.evaluate(observeAfterTwoRaf);
        report.cleanupTaskMetrics = Object.fromEntries(
          [...TASK_COUNTERS, 'pendingSourceRefreshTasks'].map((key) => [
            key,
            report.cleanup[key] ?? null,
          ])
        );
        assertNoProgressResurrection(
          report.cleanup,
          report.cleanupAfterTwoRaf,
          report.taskMetricsRequired
        );
      } catch (error) {
        failure('document-cleanup', error);
      }
    }
    await context?.close().catch((error) => failure('context-cleanup', error));
    await browser?.close().catch((error) => failure('browser-cleanup', error));
    await stopServer().catch((error) => failure('server-cleanup', error));
    process.removeListener('SIGTERM', interrupt);
    process.removeListener('SIGINT', interrupt);
    report.ended = new Date().toISOString();
    await save();
  }
  assert.equal(report.windows.length, 2, 'Incomplete progress windows');
  assert.equal(report.logs.length, 0, 'Browser page errors retained in report');
  assert.equal(
    report.failures.length,
    0,
    `Progress evidence failures retained in ${output}/report.json`
  );
  console.log(
    JSON.stringify({
      source: report.source.sha,
      windows: report.windows.map(({ mode, summary }) => ({ mode, summary })),
      cleanup: report.cleanupTaskMetrics,
    })
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(
    process.argv.length,
    3,
    'Usage: node --import tsx liquid-glass-source-progress.mjs OUTPUT'
  );
  await observe(path.resolve(process.argv[2]));
}

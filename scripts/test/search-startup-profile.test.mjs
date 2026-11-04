import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
  readdirSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import * as profileModule from './search-startup-profile.mjs';
import {
  SEARCH_PROFILE,
  SEARCH_PROFILE_PHASE_NAMES,
  SEARCH_SCENARIOS,
  searchScenario,
  allowedLocalUrl,
  bounded,
  installSearchPhaseMarks,
  mainReadyRoutes,
  recordReadiness,
  runSearchProfile,
  safeCpuProfile,
  safeError,
  safeTimelineEvent,
  safeUrl,
  sourceIdentity,
  createProfileCapture,
  isTimelineSchedulerNoise,
  validateTimelineCoverage,
  readProfileCoverage,
} from './search-startup-profile.mjs';

const origin = 'http://127.0.0.1:4321';
const fastWait = (promise, label) => bounded(promise, label, 20);
async function startProfile(cdp, directory, origin) {
  const capture = createProfileCapture(cdp, directory, origin, fastWait);
  await capture.start();
  return capture.stop;
}

const temp = () => mkdtempSync(path.join(os.tmpdir(), 'search-profile-test-'));
const read = (directory, file) => JSON.parse(readFileSync(path.join(directory, file), 'utf8'));
const source = readFileSync(new URL('./search-startup-profile.mjs', import.meta.url), 'utf8');

// Both bound failure checkouts use this inert warmup list. The current runner's
// imported plan is not the workload captured by either historical scenario.
const originalRunnerSource = `const READY_ROUTES = [
  '/en/test/style-isolation/',
  '/en/test/new-projection-families/',
  '/en/test/liquid-glass-material/',
  '/en/ui-libraries/base/image/',
  '/en/start-here/quick-start/',
  '/en/ui-libraries/shadcn/select/',
  '/en/ui-libraries/shadcn/input/',
  '/en/ui-libraries/base/scroll-area/',
  '/en/ui-libraries/base/textarea/',
  '/en/ui-libraries/brutalist/components/badge/',
  '/en/ui-libraries/brutalist/components/button/',
  '/en/ui-libraries/brutalist/components/card/',
  '/en/ui-libraries/brutalist/components/dialog/',
  '/en/ui-libraries/brutalist/components/hover-card/',
  '/en/ui-libraries/brutalist/components/select/',
  '/en/ui-libraries/brutalist/components/separator/',
  '/en/ui-libraries/brutalist/components/skeleton/',
  '/en/ui-libraries/brutalist/components/switch/',
  '/en/ui-libraries/brutalist/components/tabs/',
  '/en/ui-libraries/brutalist/components/toggle/',
  '/en/ui-libraries/brutalist/components/tooltip/',
  '/en/ui-libraries/shadcn/checkbox/',
  '/en/ui-libraries/shadcn/dropdown-menu/',
  '/en/ui-libraries/shadcn/switch/',
  '/en/ui-libraries/shadcn/textarea/',
  '/zh-cn/ui-libraries/base/transition/',
  '/zh-cn/ui-libraries/shadcn/button/',
  '/zh-cn/',
  '/zh-cn/start-here/quick-start/',
  '/zh-cn/internal/demo-matrix/',
  '/zh-cn/ui-libraries/shadcn/select/',
  '/zh-cn/ui-libraries/shadcn/scroll-area/',
  '/zh-cn/ui-libraries/brutalist/components/checkbox/',
  '/zh-cn/ui-libraries/shadcn/tooltip/',
];`;

test('locks the failing case, original oracle import and actual budget boundary', () => {
  assert.deepEqual(searchScenario('shadcn-dark-1440').viewport, { width: 1440, height: 960 });
  assert.equal(SEARCH_PROFILE.readinessBudgetMs, 1000);
  assert.equal(searchScenario('shadcn-dark-1440').theme, 'dark');
  assert.equal(SEARCH_PROFILE.route, '/zh-cn/ui-libraries/shadcn/button/');
  assert.match(source, /loadModule\(path.join\(appRoot, oraclePath\)\)/);
  assert.ok(!source.includes('1280'));
  assert.match(source, /waitUntil: 'networkidle'/);
  assert.match(source, /identifySource\(appRoot, appSha\)/);
});

test('binds two independent scenes to their actual failed checkouts without mixing dimensions', () => {
  assert.deepEqual(Object.keys(SEARCH_SCENARIOS), ['shadcn-dark-1440', 'shadcn-light-390']);
  const dark = searchScenario('shadcn-dark-1440');
  const light = searchScenario('shadcn-light-390');
  assert.equal(dark.appSha, '7669713a853211bb36995039d3c16569799c3e88');
  assert.equal(light.appSha, '9e183f7a7d69e61d17d62d92e3ccdacd00196833');
  assert.deepEqual(light.viewport, { width: 390, height: 960 });
  assert.equal(light.theme, 'light');
  assert.equal(light.originalFailure.stageElapsedMs, 1149);
  assert.equal(light.originalFailure.job, '111736429219');
  assert.notEqual(dark.originalFailure.run, light.originalFailure.run);
  assert.throws(() => searchScenario('shadcn-dark-390'), /explicitly bound/);
  assert.throws(() => searchScenario('__proto__'), /explicitly bound/);
  assert.match(source, /assert.equal\(appSha, scenario.appSha/);
  assert.match(source, /viewport: scenario.viewport/);
  assert.match(source, /colorScheme: scenario.theme/);
  assert.match(source, /JSON.stringify\(scenario.theme\)/);
  const workflow = readFileSync(
    new URL('../../.github/workflows/search-startup-profile.yml', import.meta.url),
    'utf8'
  );
  const ids = [...workflow.matchAll(/- id: (shadcn-[a-z]+-\d+)/g)].map((match) => match[1]);
  assert.deepEqual(ids, Object.keys(SEARCH_SCENARIOS));
  for (const [id, scene] of Object.entries(SEARCH_SCENARIOS)) {
    assert.ok(workflow.includes(`- id: ${id}\n            app_sha: '${scene.appSha}'`));
  }
  assert.match(workflow, /mode: \[unprofiled, profiled\]/);
  assert.match(workflow, /search-profile-\$\{\{ matrix.scenario.id \}\}-\$\{\{ matrix.mode \}\}/);
  assert.match(workflow, /CASE_ID: \$\{\{ matrix.scenario.id \}\}/);
});

test('uses inert main-CI warmup routes and rejects changed or executable shapes', () => {
  const routes = mainReadyRoutes(originalRunnerSource);
  assert.ok(routes.includes(SEARCH_PROFILE.route));
  assert.equal(routes[0], '/en/test/style-isolation/');
  assert.equal(routes.at(-1), '/zh-cn/ui-libraries/shadcn/tooltip/');
  assert.throws(() => mainReadyRoutes('const READY_ROUTES = [evil()];'));
  assert.throws(() => mainReadyRoutes("const READY_ROUTES = ['https://outside.invalid/'];"));
  assert.throws(() => mainReadyRoutes('const routes = [];'));
});

test('permits only the exact local app origin, including WebSocket transport', () => {
  assert.equal(allowedLocalUrl(`${origin}/module.js?version=1`, origin), true);
  assert.equal(allowedLocalUrl('ws://127.0.0.1:4321/', origin, true), true);
  for (const url of [
    'http://127.0.0.1:99/',
    'https://outside.invalid/',
    'data:text/html,x',
    'http://user:secret@127.0.0.1:4321/',
    '/relative',
  ])
    assert.equal(allowedLocalUrl(url, origin), false);
});

test('strips URL credentials, queries and fragments, including nested diagnostic frames', () => {
  assert.equal(safeUrl(`${origin}/module.ts?token=secret#fragment`, origin), `${origin}/module.ts`);
  assert.equal(safeUrl('https://outside.invalid/private?token=secret', origin), '[non-local-url]');
  assert.equal(safeUrl('file:///private/path', origin), '[non-local-url]');
  assert.equal(safeUrl('data:text/javascript,private', origin), '[non-local-url]');
  assert.ok(!safeError(`Failed ${origin}/a?token=secret#fragment`, origin).includes('secret'));
  const cpu = safeCpuProfile(
    {
      startTime: 1,
      endTime: 2,
      samples: [1],
      timeDeltas: [10],
      nodes: [
        {
          id: 1,
          hitCount: 1,
          children: [],
          callFrame: {
            functionName: 'loadPrototypes',
            url: `${origin}/source.ts?token=secret#fragment`,
            lineNumber: 7,
            columnNumber: 3,
          },
          privateData: 'omitted',
        },
      ],
      privateData: 'omitted',
    },
    origin
  );
  assert.equal(cpu.nodes[0].callFrame.url, `${origin}/source.ts`);
  assert.deepEqual(cpu.samples, [1]);
  assert.ok(!JSON.stringify(cpu).match(/secret|fragment|privateData|omitted/));
});

test('timeline retains JS/layout/GC timing but drops arbitrary payload and foreign user marks', () => {
  for (const name of ['EvaluateScript', 'FunctionCall', 'Layout', 'UpdateLayoutTree', 'MinorGC']) {
    const result = safeTimelineEvent(
      {
        name,
        cat: 'devtools.timeline,v8',
        ph: 'X',
        pid: 1,
        tid: 2,
        ts: 100,
        dur: 90,
        args: {
          data: {
            url: `${origin}/source.ts?token=secret`,
            requestHeaders: { Authorization: 'secret' },
            scriptSource: 'omitted',
            stackTrace: [
              {
                functionName: 'renderDemo',
                url: `${origin}/render.ts?token=secret`,
                lineNumber: 1,
                columnNumber: 2,
              },
            ],
          },
        },
      },
      origin
    );
    assert.equal(result.name, name);
    assert.equal(result.dur, 90);
    assert.ok(!JSON.stringify(result).match(/secret|Authorization|scriptSource|omitted/));
  }
  assert.equal(
    safeTimelineEvent({ cat: 'blink.user_timing', name: 'private-user-mark' }, origin),
    null
  );
  assert.equal(
    safeTimelineEvent(
      { cat: 'blink.user_timing', name: 'pui-search:atomic-active-observed', ts: 1 },
      origin
    ).ts,
    1
  );
});

test('serialized phase marks are observer delivery only, deduplicated and atomic', () => {
  const marks = [];
  const state = { defined: false, mounts: [], commands: [], hosts: [] };
  let originalCalls = 0;
  const trace = {
    record() {
      originalCalls++;
    },
    snapshot: () => ({ events: [{ state }] }),
  };
  runInNewContext(`(${installSearchPhaseMarks.toString()})();`, {
    window: { __puiSearchStartup: trace },
    performance: { mark: (name) => marks.push(name) },
  });
  trace.record('root-found');
  state.defined = true;
  state.mounts = [{}, {}, {}];
  state.commands = [{ command: 'open' }];
  state.hosts = [{ projectionGenerationState: 'staging' }];
  trace.record('defined');
  assert.ok(!marks.includes('pui-search:atomic-active-observed'));
  state.view = 'ready';
  state.hosts = Array.from({ length: 3 }, () => ({ projectionGenerationState: 'active' }));
  trace.record('mutation');
  trace.record('mutation');
  assert.equal(originalCalls, 4);
  assert.equal(marks.filter((name) => name === 'pui-search:atomic-active-observed').length, 1);
  assert.ok(marks.includes('pui-search:definition-observed'));
});

test('persists unchanged deadline failure before returning, never retries or accepts late readiness', async () => {
  let calls = 0;
  const records = [];
  const result = await recordReadiness(
    {
      evaluate: async (fn, args) => {
        calls++;
        assert.equal(args.startedAt, 2000);
        assert.equal(records[0][0], 'initial-ready-boundary');
        return fn(args);
      },
    },
    {
      readSearchReadyWithinBudget: ({ startedAt }) => ({
        startedAt,
        deadline: startedAt + 1000,
        observedReadyAt: 3040,
        currentDisabled: 'false',
        completedAt: 3041,
      }),
      searchReadinessWasOnTime: (evidence) => evidence.observedReadyAt <= evidence.deadline,
    },
    (...args) => records.push(args),
    () => 2000
  );
  assert.equal(calls, 1);
  assert.equal(result.onTime, false);
  assert.equal(records[1][0], 'initial-ready-result');
  assert.equal(records[1][1].onTime, false);
});

test('a rejected readiness read is propagated, not replaced with a passing result', async () => {
  const records = [];
  await assert.rejects(
    recordReadiness({ evaluate: () => Promise.reject(new Error('page gone')) }, {}, (...args) =>
      records.push(args)
    ),
    /page gone/
  );
  assert.deepEqual(
    records.map(([stage]) => stage),
    ['initial-ready-boundary']
  );
});

test('all diagnostic operations have finite timeout failures', async () => {
  await assert.rejects(
    bounded(new Promise(() => {}), 'test operation', 5),
    /exceeded diagnostic bound/
  );
  assert.equal(await bounded(Promise.resolve(3), 'resolved', 5), 3);
});

test('CPU and timeline artifacts are sanitized and retained with no screenshot or network payload', async () => {
  const directory = temp();
  try {
    const cdp = new EventEmitter();
    const commands = [];
    cdp.send = async (command, args) => {
      commands.push([command, args]);
      if (command === 'Profiler.stop')
        return {
          profile: {
            startTime: 1,
            endTime: 2,
            nodes: [
              { id: 1, callFrame: { url: `${origin}/a?token=secret`, functionName: 'renderDemo' } },
            ],
            samples: [1],
            timeDeltas: [1000],
          },
        };
      if (command === 'Tracing.end')
        queueMicrotask(() => cdp.emit('Tracing.tracingComplete', { dataLossOccurred: false }));
      return {};
    };
    const stop = await startProfile(cdp, directory, origin);
    cdp.emit('Tracing.dataCollected', {
      value: [
        { name: 'Layout', cat: 'devtools.timeline', ts: 2, dur: 9, args: { secret: 'omit' } },
      ],
    });
    assert.ok(readFileSync(path.join(directory, 'timeline.ndjson'), 'utf8').includes('Layout'));
    const metadata = await stop();
    assert.equal(metadata.truncated, false);
    assert.equal(metadata.eventCount, 1);
    assert.equal(read(directory, 'timeline.json').traceEvents[0].dur, 9);
    assert.ok(!readFileSync(path.join(directory, 'startup.cpuprofile'), 'utf8').includes('secret'));
    assert.equal(
      commands.find(([name]) => name === 'Profiler.setSamplingInterval')[1].interval,
      1000
    );
    assert.ok(
      !commands.find(([name]) => name === 'Tracing.start')[1].categories.includes('screenshot')
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('timeline cap is explicit evidence debt rather than unbounded buffering', async () => {
  const directory = temp();
  try {
    const cdp = new EventEmitter();
    cdp.send = async (command) => {
      if (command === 'Profiler.stop') return { profile: { nodes: [] } };
      if (command === 'Tracing.end')
        queueMicrotask(() => cdp.emit('Tracing.tracingComplete', { dataLossOccurred: false }));
      return {};
    };
    const stop = await startProfile(cdp, directory, origin);
    cdp.emit('Tracing.dataCollected', {
      value: Array.from({ length: SEARCH_PROFILE.maxTraceEvents + 1 }, () => ({
        name: 'Layout',
        ts: 1,
      })),
    });
    const metadata = await stop();
    assert.equal(metadata.eventCount, SEARCH_PROFILE.maxTraceEvents);
    assert.equal(metadata.dropped, 1);
    assert.equal(metadata.truncated, true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('requires two exact clean SHAs and rejects a dirty probe masquerading as original source', async () => {
  const root = temp();
  try {
    const appRoot = path.join(root, 'app');
    const probeRoot = path.join(root, 'probe');
    const directory = path.join(root, 'evidence');
    for (const repo of [appRoot, probeRoot]) {
      mkdirSync(repo);
      execFileSync('git', ['init', '-q', repo]);
      execFileSync(
        'git',
        [
          '-c',
          'user.name=Test',
          '-c',
          'user.email=test@example.invalid',
          'commit',
          '--allow-empty',
          '-qm',
          'Test source',
        ],
        { cwd: repo }
      );
    }
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: appRoot,
      encoding: 'utf8',
    }).trim();
    assert.deepEqual(sourceIdentity(appRoot, sha), { sha, dirty: false });
    assert.throws(() => sourceIdentity(appRoot, 'a'.repeat(40)), /does not match/);
    assert.throws(() => sourceIdentity(appRoot, 'main'), /exact lowercase source SHA/);
    writeFileSync(path.join(appRoot, 'injected-source.ts'), 'dirty');
    const report = await runSearchProfile({
      appRoot,
      probeRoot,
      directory,
      mode: 'profiled',
      caseId: 'shadcn-dark-1440',
      appSha: sha,
      probeSha: sha,
    });
    assert.equal(report.outcome, 'failure');
    assert.equal(report.captureOutcome, 'failure');
    assert.equal(profileModule.searchProfileExitCode(report), 1);
    assert.ok(read(directory, 'boundary.json').originalFailure);
    assert.ok(
      read(directory, 'result.json').failures.some((failure) =>
        failure.includes('Checkout must be clean')
      )
    );
    assert.equal(read(directory, 'progress.json').stage, 'failure');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('workflow is narrowly opt-in, read-only, paired once, timeout-bounded and uploads failures', () => {
  const workflow = readFileSync(
    new URL('../../.github/workflows/search-startup-profile.yml', import.meta.url),
    'utf8'
  );
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /contents: read/);
  assert.doesNotMatch(workflow, /^\s+[a-z-]+: write$/m);
  assert.match(workflow, /mode: \[unprofiled, profiled\]/);
  assert.match(workflow, /fail-fast: false/);
  assert.match(workflow, /timeout-minutes: 10/);
  assert.match(workflow, /retention-days: 7/);
  assert.match(workflow, /if: always\(\)/);
  assert.ok(!workflow.includes('continue-on-error'));
  assert.match(workflow, /persist-credentials: false/);
});

test('the actual original observer and candidate marks serialize together without runtime helpers', async () => {
  // Node 24 strips this standalone helper's types; no Vite/browser/socket starts.
  const oracle = await import('../../apps/www/src/content/docs/zh-cn/site-search-evidence.ts');
  const marks = [];
  const storage = [];
  const window = {};
  const content = `localStorage.setItem('starlight-theme', 'dark');\n(${oracle.installSearchStartupTrace.toString()})();\n(${installSearchPhaseMarks.toString()})();`;
  const context = {
    window,
    document: { querySelector: () => null },
    customElements: { get: () => undefined, whenDefined: () => new Promise(() => {}) },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    localStorage: { setItem: (...args) => storage.push(args) },
    performance: { mark: (name) => marks.push(name), now: () => 0, timeOrigin: 1 },
  };
  runInNewContext(content, context);
  assert.deepEqual(storage, [['starlight-theme', 'dark']]);
  assert.equal(window.__puiSearchStartup.snapshot().stopped, false);
  assert.deepEqual(marks, ['pui-search:probe-installed']);
  assert.equal(window.__puiSearchStartup.snapshot().eventCount, 0);
});

test('failed timeline completion preserves already captured CPU and incremental timing evidence', async () => {
  const directory = temp();
  try {
    const cdp = new EventEmitter();
    cdp.send = async (command) => {
      if (command === 'Profiler.stop')
        return { profile: { nodes: [], samples: [1], timeDeltas: [1000] } };
      if (command === 'Tracing.end') throw new Error('target closed');
      return {};
    };
    const stop = await startProfile(cdp, directory, origin);
    cdp.emit('Tracing.dataCollected', { value: [{ name: 'Layout', ts: 1, dur: 20 }] });
    const partial = await stop();
    assert.equal(partial.complete, false);
    assert.ok(
      partial.failures.some(
        (failure) => failure.phase === 'timeline end' && failure.error.includes('target closed')
      )
    );
    assert.equal(partial.cpu.persisted, true);
    assert.equal(partial.timeline.eof, false);
    assert.deepEqual(read(directory, 'startup.cpuprofile').samples, [1]);
    assert.ok(readFileSync(path.join(directory, 'timeline.ndjson'), 'utf8').includes('Layout'));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

const coverageMarks = [
  { name: 'pui-search:probe-installed', startTime: 1 },
  { name: 'pui-search:owners-observed', startTime: 2 },
  { name: 'pui-search:capture-end', startTime: 5 },
];
const coverageEvents = () => [
  { name: 'thread_name', ph: 'M', pid: 1, tid: 2, ts: 0, args: { name: 'CrRendererMain' } },
  ...coverageMarks.map((mark) => ({
    name: mark.name,
    cat: 'blink.user_timing',
    ph: 'I',
    pid: 1,
    tid: 2,
    ts: 10000 + mark.startTime * 1000,
  })),
];

function fakeCdp({ cpuStop, traceStart, traceEnd, missingEof = false, backendLoss = false } = {}) {
  const cdp = new EventEmitter();
  cdp.commands = [];
  cdp.send = async (command, args) => {
    cdp.commands.push([command, args]);
    if (command === 'Profiler.stop') {
      if (cpuStop === 'throws') throw new Error('CPU stop rejected');
      if (cpuStop === 'timeout') return new Promise(() => {});
      return {
        profile: {
          startTime: 0,
          endTime: 100000,
          nodes: [
            {
              id: 1,
              callFrame: { functionName: 'renderDemo', url: `${origin}/source.ts?token=excluded` },
            },
          ],
          samples: [1],
          timeDeltas: [1000],
        },
      };
    }
    if (command === 'Tracing.start') {
      if (traceStart === 'throws') throw new Error('Trace start rejected');
      cdp.emit('Tracing.dataCollected', {
        value: [
          ...coverageEvents().slice(0, -1),
          {
            name: 'FunctionCall',
            cat: 'devtools.timeline',
            ph: 'X',
            pid: 1,
            tid: 2,
            ts: 12000,
            dur: 100,
          },
          {
            name: 'Layout',
            cat: 'devtools.timeline',
            ph: 'X',
            pid: 1,
            tid: 2,
            ts: 13000,
            dur: 500,
          },
        ],
      });
    }
    if (command === 'Tracing.end') {
      cdp.emit('Tracing.dataCollected', { value: coverageEvents().slice(-1) });
      if (!missingEof)
        queueMicrotask(() =>
          cdp.emit('Tracing.tracingComplete', { dataLossOccurred: backendLoss })
        );
      if (traceEnd === 'throws') throw new Error('Trace end rejected');
    }
    return {};
  };
  return cdp;
}

for (const cpuStop of ['throws', 'timeout']) {
  test(`CPU stop ${cpuStop} does not suppress timeline end/EOF; stop is idempotent`, async () => {
    const directory = temp();
    try {
      const cdp = fakeCdp({ cpuStop });
      const capture = createProfileCapture(cdp, directory, origin, fastWait);
      assert.equal(read(directory, 'profile-status.json').cpu.startAttempted, false);
      await capture.start();
      const first = capture.stop();
      assert.equal(capture.stop(), first);
      const partial = await first;
      assert.equal(await capture.stop(), partial);
      assert.equal(partial.complete, false);
      assert.equal(partial.cpu.persisted, false);
      assert.equal(partial.timeline.ended, true);
      assert.equal(partial.timeline.eof, true);
      assert.equal(partial.timeline.persisted, true);
      assert.equal(read(directory, 'timeline.json').metadata.complete, false);
      assert.equal(read(directory, 'profile-status.json').complete, false);
      assert.ok(partial.failures.some((failure) => failure.phase === 'CPU stop/persist'));
      assert.equal(cdp.commands.filter(([name]) => name === 'Profiler.stop').length, 1);
      assert.equal(cdp.commands.filter(([name]) => name === 'Tracing.end').length, 1);
      assert.equal(cdp.listenerCount('Tracing.dataCollected'), 0);
      assert.equal(cdp.listenerCount('Tracing.tracingComplete'), 0);
      assert.equal(existsSync(path.join(directory, 'startup.cpuprofile')), false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

test('Trace start rejection after CPU start still stops and persists CPU during cleanup', async () => {
  const directory = temp();
  try {
    const cdp = fakeCdp({ traceStart: 'throws' });
    const capture = createProfileCapture(cdp, directory, origin, fastWait);
    await assert.rejects(capture.start(), /Trace start rejected/);
    const partial = await capture.stop();
    assert.equal(partial.cpu.started, true);
    assert.equal(partial.cpu.stopped, true);
    assert.equal(partial.cpu.persisted, true);
    assert.equal(partial.timeline.started, false);
    assert.equal(partial.complete, false);
    assert.ok(partial.failures.some((failure) => failure.phase === 'capture start'));
    assert.equal(read(directory, 'startup.cpuprofile').samples.length, 1);
    assert.equal(read(directory, 'timeline.json').metadata.complete, false);
    assert.equal(cdp.commands.filter(([name]) => name === 'Profiler.stop').length, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('CPU success plus missing timeline EOF preserves partial files without replaying cleanup', async () => {
  const directory = temp();
  try {
    const cdp = fakeCdp({ missingEof: true });
    const capture = createProfileCapture(cdp, directory, origin, fastWait);
    await capture.start();
    const partial = await capture.stop();
    assert.equal(await capture.stop(), partial);
    assert.equal(partial.cpu.persisted, true);
    assert.equal(partial.timeline.ended, true);
    assert.equal(partial.timeline.eof, false);
    assert.equal(partial.complete, false);
    assert.ok(partial.failures.some((failure) => failure.phase === 'timeline EOF'));
    assert.equal(read(directory, 'timeline.json').metadata.timeline.eof, false);
    assert.ok(readFileSync(path.join(directory, 'timeline.ndjson'), 'utf8').includes('Layout'));
    assert.equal(cdp.commands.filter(([name]) => name === 'Profiler.stop').length, 1);
    assert.equal(cdp.commands.filter(([name]) => name === 'Tracing.end').length, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('Tracing.end rejection still observes independent EOF and retains its own failure', async () => {
  const directory = temp();
  try {
    const cdp = fakeCdp({ traceEnd: 'throws' });
    const capture = createProfileCapture(cdp, directory, origin, fastWait);
    await capture.start();
    const partial = await capture.stop();
    assert.equal(partial.cpu.persisted, true);
    assert.equal(partial.timeline.ended, false);
    assert.equal(partial.timeline.eof, true);
    assert.equal(partial.complete, false);
    assert.ok(partial.failures.some((failure) => failure.phase === 'timeline end'));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

async function fakeVisit(
  directory,
  {
    mode = 'profiled',
    readyAt = 900,
    coverageInput = coverageMarks,
    observedMarks = [],
    blockedHttp = false,
    blockedWebSocket = false,
    pageErrorAt,
    cleanupFailure,
    dirtyAt,
    observationThrows = false,
    extraTraceEvents = [],
    beforeCleanup,
    lateError,
    lateElapsedMs = 0,
    ...cdpOptions
  } = {}
) {
  const oracle = await import('../../apps/www/src/content/docs/zh-cn/site-search-evidence.ts');
  const calls = [];
  const cdp = fakeCdp(cdpOptions);
  const page = new EventEmitter();
  page.setDefaultTimeout = () => {};
  page.setDefaultNavigationTimeout = () => {};
  page.addInitScript = async (script) => {
    calls.push(['init', script.content]);
  };
  page.goto = async (url, options) => {
    calls.push(['visit', url, options]);
    if (pageErrorAt === 'visit') page.emit('pageerror', new Error('Synthetic page error'));
    return { ok: () => true };
  };
  let monotonicTime = 0;
  page.waitForFunction = async (_predicate, _args, options) => {
    calls.push(['late-observation']);
    assert.equal(options.timeout, 10000);
    monotonicTime += lateElapsedMs;
    if (lateError) throw lateError;
  };
  page.evaluate = async (fn, args) => {
    if (fn === readProfileCoverage) {
      calls.push(['coverage']);
      cdp.emit('Tracing.dataCollected', { value: extraTraceEvents });
      return coverageInput;
    }
    if (args?.startedAt !== undefined) {
      assert.equal(fn, oracle.readSearchReadyWithinBudget);
      calls.push(['readiness', args.startedAt]);
      return {
        startedAt: args.startedAt,
        deadline: args.startedAt + 1000,
        observedReadyAt: args.startedAt + readyAt,
        completedAt: args.startedAt + readyAt,
        currentDisabled: 'false',
      };
    }
    calls.push(['snapshot']);
    if (observationThrows) throw new Error('Synthetic observation failure');
    return {
      startup: { resources: [] },
      navigation: [],
      resources: [],
      resourceCount: 0,
      marks: observedMarks,
    };
  };
  const context = {
    route: async (_pattern, handler) => {
      if (blockedHttp)
        await handler({
          request: () => ({ url: () => 'https://outside.invalid/' }),
          abort: async (reason) => calls.push(['http-abort', reason]),
        });
    },
    routeWebSocket: async (_pattern, handler) => {
      if (blockedWebSocket)
        handler({
          url: () => 'wss://outside.invalid/',
          close: () => calls.push(['websocket-close']),
        });
    },
    newPage: async () => page,
    newCDPSession: async () => cdp,
    close: async () => {
      calls.push(['context-close']);
      beforeCleanup?.(read(directory, 'result.json'));
      if (pageErrorAt === 'cleanup') page.emit('pageerror', new Error('Synthetic late page error'));
      if (cleanupFailure === 'context') throw new Error('Synthetic context cleanup failure');
    },
  };
  const browser = {
    version: () => 'fake-chromium-control-flow-only',
    newContext: async (options) => {
      calls.push(['context', options]);
      return context;
    },
    close: async () => {
      calls.push(['browser-close']);
      if (cleanupFailure === 'browser') throw new Error('Synthetic browser cleanup failure');
    },
  };
  const harness = {
    startServer: async () => {
      calls.push(['server-start']);
      return origin;
    },
    launchBrowser: async () => browser,
    stopServer: async () => {
      calls.push(['server-stop']);
      if (cleanupFailure === 'server') throw new Error('Synthetic server cleanup failure');
    },
  };
  const caseId = 'shadcn-light-390';
  const identityCalls = new Map();
  const report = await runSearchProfile(
    {
      appRoot: '/fake/app',
      probeRoot: '/fake/probe',
      appSha: searchScenario(caseId).appSha,
      probeSha: 'a'.repeat(40),
      directory,
      mode,
      caseId,
    },
    {
      identifySource: (root, sha) => {
        const count = (identityCalls.get(root) ?? 0) + 1;
        identityCalls.set(root, count);
        if (
          (dirtyAt === 'warmup' && root === '/fake/app' && count === 2) ||
          (dirtyAt === 'app-after' && root === '/fake/app' && count === 3) ||
          (dirtyAt === 'probe-after' && root === '/fake/probe' && count === 2)
        )
          throw new Error('Checkout must be clean');
        return { sha, dirty: false };
      },
      digestFile: () => 'b'.repeat(64),
      readSource: () => originalRunnerSource,
      enterDirectory: () => {},
      monotonicNow: () => monotonicTime,
      loadModule: async (file) => {
        if (file.endsWith('site-search-evidence.ts')) return oracle;
        assert.ok(file.endsWith('browser-harness.ts'));
        return harness;
      },
      createCapture: (cdp, directory, origin) =>
        createProfileCapture(cdp, directory, origin, fastWait),
    }
  );
  return { report, calls, cdp };
}

for (const mode of ['unprofiled', 'profiled']) {
  test(`full runner ${mode} fake-browser path makes one visit and performs all cleanup`, async () => {
    const directory = temp();
    try {
      const { report, calls, cdp } = await fakeVisit(directory, { mode });
      assert.equal(report.outcome, 'captured');
      assert.equal(report.captureOutcome, 'captured');
      assert.deepEqual(report.captureFailures, []);
      assert.equal(profileModule.searchProfileExitCode(report), 0);
      assert.equal(report.readiness.onTime, true);
      assert.equal(calls.filter(([name]) => name === 'visit').length, 1);
      assert.equal(calls.find(([name]) => name === 'visit')[2].waitUntil, 'networkidle');
      assert.deepEqual(calls.find(([name]) => name === 'context')[1].viewport, {
        width: 390,
        height: 960,
      });
      assert.equal(calls.find(([name]) => name === 'context')[1].colorScheme, 'light');
      for (const name of ['context-close', 'browser-close', 'server-stop'])
        assert.equal(calls.filter(([label]) => label === name).length, 1);
      assert.equal(
        cdp.commands.filter(([name]) => name === 'Profiler.stop').length,
        mode === 'profiled' ? 1 : 0
      );
      assert.equal(
        cdp.commands.filter(([name]) => name === 'Tracing.end').length,
        mode === 'profiled' ? 1 : 0
      );
      if (mode === 'profiled') assert.equal(read(directory, 'profile-status.json').complete, true);
      assert.equal(read(directory, 'result.json').outcome, 'captured');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

for (const partial of [
  { cpuStop: 'throws' },
  { cpuStop: 'timeout' },
  { cpuStop: 'throws', missingEof: true },
  { missingEof: true },
  { traceStart: 'throws' },
]) {
  test(`full runner persists original/partial outcomes and cleanup: ${JSON.stringify(partial)}`, async () => {
    const directory = temp();
    try {
      const { report, calls, cdp } = await fakeVisit(directory, { ...partial, readyAt: 1149 });
      assert.equal(report.outcome, 'failure');
      assert.equal(report.captureOutcome, 'failure');
      assert.equal(profileModule.searchProfileExitCode(report), 1);
      assert.equal(report.profile.complete, false);
      if (!partial.traceStart) {
        assert.equal(report.readiness.onTime, false);
        assert.equal(
          read(directory, 'readiness.json').evidence.observedReadyAt -
            report.readiness.evidence.deadline,
          149
        );
        assert.ok(report.failures.includes('Original 1000ms initial-ready deadline failed'));
        assert.equal(calls.filter(([name]) => name === 'visit').length, 1);
        assert.ok(existsSync(path.join(directory, 'observation.json')));
      } else {
        assert.equal(calls.filter(([name]) => name === 'visit').length, 0);
        assert.equal(report.profile.cpu.persisted, true);
        assert.ok(report.failures.some((failure) => failure.includes('Trace start rejected')));
      }
      for (const name of ['context-close', 'browser-close', 'server-stop'])
        assert.equal(calls.filter(([label]) => label === name).length, 1);
      assert.equal(cdp.commands.filter(([name]) => name === 'Profiler.stop').length, 1);
      assert.equal(cdp.commands.filter(([name]) => name === 'Tracing.end').length, 1);
      assert.equal(read(directory, 'result.json').profile.complete, false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

test('CPU persistence failure retains a completed timeline and explicit partial status', async () => {
  const directory = temp();
  try {
    mkdirSync(path.join(directory, 'startup.cpuprofile'));
    const capture = createProfileCapture(fakeCdp(), directory, origin, fastWait);
    await capture.start();
    const partial = await capture.stop();
    assert.equal(partial.cpu.stopped, true);
    assert.equal(partial.cpu.persisted, false);
    assert.equal(partial.timeline.eof, true);
    assert.equal(partial.timeline.persisted, true);
    assert.equal(partial.complete, false);
    assert.ok(partial.failures.some((failure) => failure.phase === 'CPU stop/persist'));
    assert.ok(
      read(directory, 'timeline.json').traceEvents.some((event) => event.name === 'Layout')
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('scheduler exclusion precedes retention while semantic and unknown events remain eligible', () => {
  for (const event of [
    { name: 'ThreadControllerImpl::RunTask', cat: 'toplevel' },
    { name: 'Receive mojo message', cat: 'toplevel,mojom' },
    { name: 'RunTask', cat: 'disabled-by-default-devtools.timeline' },
  ])
    assert.equal(isTimelineSchedulerNoise(event), true);
  for (const name of [
    'Layout',
    'UpdateLayoutTree',
    'RecalculateStyles',
    'MajorGC',
    'FunctionCall',
    'EvaluateScript',
    'FutureSemanticEvent',
  ])
    assert.equal(isTimelineSchedulerNoise({ name, cat: 'devtools.timeline' }), false);
  assert.equal(isTimelineSchedulerNoise({ name: 'RunTask', cat: 'v8,toplevel' }), false);
  assert.equal(
    isTimelineSchedulerNoise({
      name: 'FutureStyleInvalidation',
      cat: 'disabled-by-default-devtools.timeline',
    }),
    false
  );
  const sourceCategories = source.match(/categories:\s*'([^']+)'/)[1].split(',');
  assert.ok(!sourceCategories.includes('toplevel'));
  for (const category of [
    'devtools.timeline',
    'v8',
    'blink.user_timing',
    'disabled-by-default-devtools.timeline',
  ])
    assert.ok(sourceCategories.includes(category));
  assert.equal(SEARCH_PROFILE.maxTraceEvents, 60_000);
  assert.equal(SEARCH_PROFILE.maxTraceBytes, 24 * 1024 * 1024);
});

function completeCoverageEvents() {
  return [
    ...coverageEvents(),
    {
      name: 'FunctionCall',
      cat: 'devtools.timeline',
      ph: 'X',
      pid: 1,
      tid: 2,
      ts: 12000,
      dur: 100,
    },
    { name: 'Layout', cat: 'devtools.timeline', ph: 'X', pid: 1, tid: 2, ts: 13000, dur: 500 },
  ];
}

test('coverage binds every observed mark to one renderer thread and CPU clock without requiring ready', () => {
  const coverage = validateTimelineCoverage(completeCoverageEvents(), coverageMarks, {
    startTime: 0,
    endTime: 100000,
  });
  assert.equal(coverage.complete, true);
  assert.deepEqual(coverage.renderer, { pid: 1, tid: 2 });
  assert.equal(coverage.originMonotonicUs, 10000);
  assert.equal(coverage.offsetSpreadUs, 0);
  assert.equal(coverage.fromMs, 1);
  assert.equal(coverage.toMs, 5);
  assert.ok(
    !coverageMarks.some((mark) => mark.name.includes('ready') || mark.name.includes('active'))
  );
});

for (const [name, change] of [
  [
    'missing end mark',
    (events) => events.filter((event) => event.name !== 'pui-search:capture-end'),
  ],
  [
    'duplicate mark',
    (events) => [
      ...events,
      { ...events.find((event) => event.name === 'pui-search:probe-installed') },
    ],
  ],
  [
    'wrong thread',
    (events) =>
      events.map((event) =>
        event.name === 'pui-search:capture-end' ? { ...event, tid: 99 } : event
      ),
  ],
  [
    'wrong clock',
    (events) =>
      events.map((event) =>
        event.name === 'pui-search:capture-end' ? { ...event, ts: event.ts + 2000 } : event
      ),
  ],
  ['missing renderer metadata', (events) => events.filter((event) => event.ph !== 'M')],
  ['missing semantic timings', (events) => events.filter((event) => event.ph !== 'X')],
]) {
  test(`coverage fails closed for ${name}`, () => {
    assert.equal(
      validateTimelineCoverage(change(completeCoverageEvents()), coverageMarks, {
        startTime: 0,
        endTime: 100000,
      }).complete,
      false
    );
  });
}

test('missing browser marks or a CPU clock outside the renderer boundaries cannot be complete', () => {
  assert.equal(
    validateTimelineCoverage(completeCoverageEvents(), undefined, { startTime: 0, endTime: 100000 })
      .complete,
    false
  );
  assert.equal(
    validateTimelineCoverage(completeCoverageEvents(), coverageMarks, {
      startTime: 13000,
      endTime: 14000,
    }).complete,
    false
  );
});

test('more than 60000 scheduler events cannot displace later relevant evidence or mark coverage', async () => {
  const directory = temp();
  try {
    const cdp = fakeCdp();
    const capture = createProfileCapture(cdp, directory, origin, fastWait);
    await capture.start();
    cdp.emit('Tracing.dataCollected', {
      value: [
        ...Array.from({ length: 60010 }, () => ({
          name: 'RunTask',
          cat: 'disabled-by-default-devtools.timeline',
          ph: 'X',
          pid: 9,
          tid: 9,
          ts: 1,
          dur: 1,
        })),
        {
          name: 'UpdateLayoutTree',
          cat: 'blink,devtools.timeline',
          ph: 'X',
          pid: 1,
          tid: 2,
          ts: 13000,
          dur: 800,
        },
      ],
    });
    capture.setCoverage(coverageMarks);
    const result = await capture.stop();
    assert.equal(result.filter.schedulerExcluded, 60010);
    assert.equal(result.dropped, 0);
    assert.equal(result.truncated, false);
    assert.equal(result.complete, true);
    assert.ok(
      read(directory, 'timeline.json').traceEvents.some(
        (event) => event.name === 'UpdateLayoutTree'
      )
    );
    assert.equal(
      result.filter.received,
      result.eventCount +
        result.dropped +
        result.filter.schedulerExcluded +
        result.filter.privacyExcluded
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

for (const backendLoss of [true, undefined]) {
  test(`backend data-loss status ${String(backendLoss)} fails even with all stage marks`, async () => {
    const directory = temp();
    try {
      const cdp = fakeCdp({ missingEof: true });
      const capture = createProfileCapture(cdp, directory, origin, fastWait);
      await capture.start();
      capture.setCoverage(coverageMarks);
      const stopping = capture.stop();
      queueMicrotask(() =>
        cdp.emit(
          'Tracing.tracingComplete',
          backendLoss === undefined ? {} : { dataLossOccurred: backendLoss }
        )
      );
      const partial = await stopping;
      assert.equal(partial.coverage.complete, true);
      assert.equal(partial.complete, false);
      assert.ok(partial.failures.some((failure) => failure.phase === 'timeline backend data loss'));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

test('a failed original readiness deadline can still produce complete scoped profiling evidence', async () => {
  const directory = temp();
  try {
    const { report } = await fakeVisit(directory, { readyAt: 1149 });
    assert.equal(report.readiness.onTime, false);
    assert.equal(report.profile.complete, true);
    assert.equal(report.outcome, 'failure');
    assert.deepEqual(report.failures, ['Original 1000ms initial-ready deadline failed']);
    const progress = readFileSync(path.join(directory, 'progress.ndjson'), 'utf8');
    assert.ok(
      progress.indexOf('initial-ready-result') < progress.indexOf('late-observation-result')
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('semantic timing evidence outside the marked capture window is insufficient', () => {
  const outside = completeCoverageEvents().map((event) =>
    event.ph === 'X' ? { ...event, ts: 200000 } : event
  );
  assert.equal(
    validateTimelineCoverage(outside, coverageMarks, { startTime: 0, endTime: 100000 }).complete,
    false
  );
});

test('semantic overflow still fails even when all renderer/clock coverage marks were retained', async () => {
  const directory = temp();
  try {
    const cdp = fakeCdp();
    const send = cdp.send;
    cdp.send = async (command, args) => {
      if (command === 'Tracing.end') {
        queueMicrotask(() => cdp.emit('Tracing.tracingComplete', { dataLossOccurred: false }));
        return {};
      }
      return send(command, args);
    };
    const capture = createProfileCapture(cdp, directory, origin, fastWait);
    await capture.start();
    cdp.emit('Tracing.dataCollected', {
      value: [
        ...coverageEvents().slice(-1),
        ...Array.from({ length: 60000 }, () => ({
          name: 'Layout',
          cat: 'devtools.timeline',
          ph: 'X',
          pid: 1,
          tid: 2,
          ts: 13000,
          dur: 1,
        })),
      ],
    });
    capture.setCoverage(coverageMarks);
    const partial = await capture.stop();
    assert.equal(partial.eventCount, 60000);
    assert.equal(partial.coverage.complete, true);
    assert.equal(partial.filter.schedulerExcluded, 0);
    assert.ok(partial.dropped > 0);
    assert.equal(partial.truncated, true);
    assert.equal(partial.complete, false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

const syntheticPrivatePhase = `pui-search:${origin}/mark?token=synthetic-review-sentinel`;
const syntheticPhaseSentinel = 'synthetic-review-sentinel';

test('serialized browser coverage reader admits only fixed phase names', () => {
  const entries = [coverageMarks[0], { name: syntheticPrivatePhase, startTime: 3 }];
  const result = runInNewContext(`(${readProfileCoverage.toString()})(knownNames)`, {
    knownNames: [...SEARCH_PROFILE_PHASE_NAMES],
    performance: {
      mark: (name) => entries.push({ name, startTime: 5 }),
      getEntriesByType: () => entries,
    },
  });
  assert.deepEqual(
    Array.from(result, (entry) => entry.name),
    ['pui-search:probe-installed', 'pui-search:capture-end']
  );
  assert.ok(!JSON.stringify(result).includes(syntheticPhaseSentinel));
  assert.equal(
    safeTimelineEvent({ name: syntheticPrivatePhase, cat: 'blink.user_timing' }, origin),
    null
  );
});

test('pure coverage diagnostics never echo an unknown phase name or its query', () => {
  const marks = [...coverageMarks, { name: syntheticPrivatePhase, startTime: 3 }];
  const result = validateTimelineCoverage(completeCoverageEvents(), marks, {
    startTime: 0,
    endTime: 100000,
  });
  assert.equal(result.complete, false);
  assert.ok(!JSON.stringify(result).includes(syntheticPhaseSentinel));
  assert.ok(!JSON.stringify(result).includes('token='));
});

function assertNoSyntheticPhaseInFiles(directory) {
  for (const file of readdirSync(directory)) {
    const contents = readFileSync(path.join(directory, file), 'utf8');
    assert.equal(
      contents.includes(syntheticPhaseSentinel),
      false,
      `Unexpected synthetic marker in ${file}`
    );
    assert.equal(contents.includes('token='), false, `Unexpected query in ${file}`);
  }
}

test('the review synthetic phase cannot leak through journal, timeline, status or returned summary', async () => {
  const directory = temp();
  try {
    const cdp = fakeCdp();
    const capture = createProfileCapture(cdp, directory, origin, fastWait);
    await capture.start();
    capture.setCoverage([...coverageMarks, { name: syntheticPrivatePhase, startTime: 3 }]);
    cdp.emit('Tracing.dataCollected', {
      value: [
        {
          name: syntheticPrivatePhase,
          cat: 'blink.user_timing',
          ph: 'I',
          pid: 1,
          tid: 2,
          ts: 13000,
        },
      ],
    });
    const result = await capture.stop();
    assert.equal(result.complete, false);
    assert.ok(result.failures.some((failure) => failure.phase === 'coverage input'));
    assert.ok(!JSON.stringify(result).includes(syntheticPhaseSentinel));
    assertNoSyntheticPhaseInFiles(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('full runner failure artifacts also exclude unexpected coverage and observation phase names', async () => {
  const directory = temp();
  try {
    const contaminated = [...coverageMarks, { name: syntheticPrivatePhase, startTime: 3 }];
    const { report } = await fakeVisit(directory, {
      coverageInput: contaminated,
      observedMarks: contaminated,
    });
    assert.equal(report.outcome, 'failure');
    assert.equal(report.captureOutcome, 'failure');
    assert.equal(profileModule.searchProfileExitCode(report), 1);
    assert.equal(report.profile.complete, false);
    assert.ok(!JSON.stringify(report).includes(syntheticPhaseSentinel));
    assert.ok(existsSync(path.join(directory, 'observation.json')));
    assert.ok(existsSync(path.join(directory, 'result.json')));
    assertNoSyntheticPhaseInFiles(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

for (const mode of ['unprofiled', 'profiled']) {
  test(`complete ${mode} capture preserves the original +149ms readiness failure independently`, async () => {
    const directory = temp();
    try {
      const { report, calls } = await fakeVisit(directory, {
        mode,
        readyAt: 1149,
        beforeCleanup: (pending) => {
          assert.equal(pending.captureOutcome, 'incomplete');
          assert.equal(profileModule.searchProfileExitCode(pending), 1);
          assert.equal(pending.outcome, 'failure');
        },
      });
      assert.equal(report.captureOutcome, 'captured');
      assert.deepEqual(report.captureFailures, []);
      assert.equal(profileModule.searchProfileExitCode(report), 0);
      assert.equal(report.outcome, 'failure');
      assert.deepEqual(report.failures, ['Original 1000ms initial-ready deadline failed']);
      assert.equal(report.readiness.onTime, false);
      assert.equal(report.readiness.evidence.deadline - report.readiness.evidence.startedAt, 1000);
      assert.equal(
        report.readiness.evidence.observedReadyAt - report.readiness.evidence.deadline,
        149
      );
      assert.deepEqual(read(directory, 'readiness.json'), report.readiness);
      assert.deepEqual(read(directory, 'result.json'), report);
      assert.equal(calls.filter(([name]) => name === 'visit').length, 1);
      const summary = profileModule.searchProfileSummary(report);
      assert.match(summary, /Historical subject readiness: FAIL/);
      assert.match(summary, /onTime=false/);
      assert.match(summary, /1149ms/);
      assert.match(summary, /149ms late/);
      assert.match(summary, /Diagnostic capture: CAPTURED/);
      assert.match(summary, /Observed outcome: failure/);
      assert.match(summary, /9e183f7a7d69e61d17d62d92e3ccdacd00196833/);
      assert.match(summary, /Current-product CI is unchanged/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

for (const control of [
  { blockedHttp: true },
  { blockedWebSocket: true },
  { pageErrorAt: 'visit' },
  { pageErrorAt: 'cleanup' },
  { cleanupFailure: 'context' },
  { cleanupFailure: 'browser' },
  { cleanupFailure: 'server' },
  { dirtyAt: 'warmup' },
  { dirtyAt: 'app-after' },
  { dirtyAt: 'probe-after' },
  { observationThrows: true },
  { backendLoss: true },
]) {
  test(`capture remains failed with original readiness miss: ${JSON.stringify(control)}`, async () => {
    const directory = temp();
    try {
      const { report } = await fakeVisit(directory, { ...control, readyAt: 1149 });
      assert.equal(report.captureOutcome, 'failure');
      assert.equal(report.outcome, 'failure');
      assert.ok(report.captureFailures.length > 0);
      assert.ok(report.captureFailures.every((failure) => report.failures.includes(failure)));
      assert.equal(
        report.captureFailures.includes('Original 1000ms initial-ready deadline failed'),
        false
      );
      assert.equal(profileModule.searchProfileExitCode(report), 1);
      assert.deepEqual(read(directory, 'result.json'), report);
      if (report.readiness) {
        assert.equal(report.readiness.onTime, false);
        assert.equal(
          report.readiness.evidence.observedReadyAt - report.readiness.evidence.deadline,
          149
        );
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

test('retention overflow remains a capture failure even when readiness failure is separated', async () => {
  const directory = temp();
  try {
    const { report } = await fakeVisit(directory, {
      readyAt: 1149,
      extraTraceEvents: Array.from({ length: SEARCH_PROFILE.maxTraceEvents + 1 }, () => ({
        name: 'FunctionCall',
        cat: 'devtools.timeline',
        ph: 'X',
        pid: 1,
        tid: 2,
        ts: 12500,
        dur: 1,
      })),
    });
    assert.equal(report.readiness.onTime, false);
    assert.equal(report.profile.truncated, true);
    assert.equal(report.profile.complete, false);
    assert.equal(report.captureOutcome, 'failure');
    assert.equal(profileModule.searchProfileExitCode(report), 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('the CLI uses the capture verdict and publishes both verdicts without masking failures', () => {
  assert.match(source, /process.exit\(searchProfileExitCode\(report\)\)/);
  assert.match(source, /process.env.GITHUB_STEP_SUMMARY/);
  assert.match(source, /appendFileSync\(process.env.GITHUB_STEP_SUMMARY, summary\)/);
  assert.equal(profileModule.searchProfileExitCode({ outcome: 'captured' }), 1);
  assert.equal(profileModule.searchProfileExitCode({ captureOutcome: 'incomplete' }), 1);
  assert.equal(profileModule.searchProfileExitCode({ captureOutcome: 'failure' }), 1);
});

test('summary exposes readiness and capture separately without echoing error payloads', () => {
  const summary = profileModule.searchProfileSummary({
    caseId: 'shadcn-dark-1440',
    mode: 'profiled',
    outcome: 'failure',
    failures: ['https://outside.invalid/?token=summary-private'],
    captureOutcome: 'failure',
    captureFailures: ['summary-private'],
    blockedRequests: 1,
  });
  assert.match(summary, /Historical subject readiness: NOT OBSERVED/);
  assert.match(summary, /Diagnostic capture: FAILURE/);
  assert.match(summary, /Capture failures: 1; blocked requests: 1/);
  assert.doesNotMatch(summary, /summary-private|token=/);
});

// Match the locked Playwright error's public name/message shape without adding
// a dependency to this browser-free suite, which runs before dependency install.
const lateTimeout = (message = 'page.waitForFunction: Timeout 10000ms exceeded.') =>
  Object.assign(new Error(message), { name: 'TimeoutError' });

for (const mode of ['unprofiled', 'profiled']) {
  for (const [label, lateError, lateElapsedMs] of [
    ['ordinary error', new Error('Synthetic late-observation failure'), 10000],
    ['protocol error', new Error(`Protocol error at ${origin}/session?token=late-private`), 10000],
    ['early timeout', lateTimeout(), 0],
    ['insufficient budget', lateTimeout(), 9999],
    ['wrong timeout budget', lateTimeout('page.waitForFunction: Timeout 9000ms exceeded.'), 10000],
    ['unknown timeout source', lateTimeout('Synthetic unclassified timeout'), 10000],
  ]) {
    test(`${mode} rejects late-observation ${label} without losing original failure or cleanup`, async () => {
      const directory = temp();
      try {
        const { report, calls } = await fakeVisit(directory, {
          mode,
          readyAt: 1149,
          lateError,
          lateElapsedMs,
        });
        assert.equal(report.readiness.onTime, false);
        assert.equal(
          report.readiness.evidence.observedReadyAt - report.readiness.evidence.deadline,
          149
        );
        assert.ok(report.failures.includes('Original 1000ms initial-ready deadline failed'));
        assert.equal(report.lateObservation.outcome, 'error');
        assert.equal(report.lateObservation.ready, undefined);
        assert.equal(report.lateObservation.elapsedMs, lateElapsedMs);
        assert.ok(report.lateObservation.error);
        assert.equal(report.captureOutcome, 'failure');
        assert.equal(profileModule.searchProfileExitCode(report), 1);
        assert.ok(
          report.captureFailures.some((failure) => failure.startsWith('Late observation failed:'))
        );
        assert.equal(report.outcome, 'failure');
        if (mode === 'profiled') assert.equal(report.profile.complete, true);
        for (const name of ['context-close', 'browser-close', 'server-stop'])
          assert.equal(calls.filter(([label]) => label === name).length, 1);
        assert.deepEqual(read(directory, 'result.json'), report);
        assert.equal(existsSync(path.join(directory, 'observation.json')), true);
        for (const file of readdirSync(directory))
          assert.doesNotMatch(readFileSync(path.join(directory, file), 'utf8'), /late-private/);
        assert.match(profileModule.searchProfileSummary(report), /Late observation: ERROR/);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    });
  }
  test(`${mode} retains a full-budget late TimeoutError as an observed non-ready result`, async () => {
    const directory = temp();
    try {
      const { report } = await fakeVisit(directory, {
        mode,
        readyAt: 1149,
        lateError: lateTimeout(),
        lateElapsedMs: 10000,
      });
      assert.equal(report.readiness.onTime, false);
      assert.equal(
        report.readiness.evidence.observedReadyAt - report.readiness.evidence.deadline,
        149
      );
      assert.equal(report.lateObservation.ready, false);
      assert.equal(report.lateObservation.outcome, 'timeout');
      assert.equal(report.lateObservation.budgetMs, 10000);
      assert.equal(report.lateObservation.elapsedMs, 10000);
      assert.match(report.lateObservation.error, /TimeoutError.*Timeout 10000ms exceeded/);
      assert.equal(report.captureOutcome, 'captured');
      assert.equal(profileModule.searchProfileExitCode(report), 0);
      assert.equal(report.outcome, 'failure');
      assert.deepEqual(report.failures, ['Original 1000ms initial-ready deadline failed']);
      assert.deepEqual(report.captureFailures, []);
      assert.deepEqual(read(directory, 'result.json'), report);
      assert.match(profileModule.searchProfileSummary(report), /Late observation: TIMEOUT/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { parse } from 'yaml';
import {
  runSearchProductionEvidence,
  SEARCH_PRODUCTION_ROUTES,
  SEARCH_PRODUCTION_SUITE,
} from './run-search-production-evidence.mjs';
import { startStrictPreview } from './search-production-preview.mjs';

async function flush() {
  for (let turn = 0; turn < 100; turn++) await Promise.resolve();
}
function fixture({
  buildCode = 0,
  testCode = 0,
  stopOnTerm = true,
  hangBuild = false,
  hangReady = false,
  hangTests = false,
  previewExit = false,
  missingAssets = false,
  browserMode = 'ready',
} = {}) {
  let clock = 0;
  let serial = 1;
  const timers = new Map();
  const children = [];
  const calls = [];
  const killed = [];
  const readies = [];
  const reports = [];
  const signals = new EventEmitter();
  const deps = {
    node: '/node',
    signals,
    report: (line) => reports.push(line),
    now: () => clock,
    setTimer(callback, ms) {
      const id = serial++;
      timers.set(id, { callback, at: clock + ms });
      return id;
    },
    clearTimer(id) {
      timers.delete(id);
    },
    access: async (file) => {
      calls.push(['access', file]);
      if (missingAssets) throw new Error('Missing generated Pagefind assets');
    },
    makeProfile: () => {
      calls.push(['profile-create']);
      return '/owned/tmp/search-profile';
    },
    removeProfile: async (directory) => {
      calls.push(['profile-remove', directory]);
    },
    readiness: async (url, options) => {
      readies.push({ url, timeoutMs: options.timeoutMs, server: options.server });
      if (hangReady) return new Promise(() => {});
      clock += 5;
    },
    spawn(command, args, options) {
      const child = new EventEmitter();
      child.pid = 10_000 + children.length;
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.exitCode = null;
      child.signalCode = null;
      child.finish = (code, signal = null) => {
        if (child.exitCode !== null || child.signalCode !== null) return;
        child.exitCode = code;
        child.signalCode = signal;
        child.emit('exit', code, signal);
      };
      calls.push(['spawn', command, args, options]);
      children.push(child);
      queueMicrotask(() => {
        if (args.includes('build')) {
          if (!hangBuild) {
            clock += 20;
            child.finish(buildCode);
          }
        } else if (args[0].endsWith('search-production-preview.mjs')) {
          if (previewExit) child.finish(1);
          else child.emit('message', { type: 'search-production-preview-ready', port: 4397 });
        } else if (command === '/owned/chrome') {
          if (browserMode === 'exit') child.finish(1);
          else if (browserMode === 'ready')
            child.stderr.emit(
              'data',
              Buffer.from('DevTools listening on ws://127.0.0.1:9999/devtools/browser/owned\n')
            );
          else if (browserMode === 'bad')
            child.stderr.emit(
              'data',
              Buffer.from(
                'DevTools listening on ws://foreign.example:9999/devtools/browser/foreign\n'
              )
            );
        } else if (!hangTests) child.finish(testCode);
      });
      return child;
    },
    signalProcessGroup(pid, signal) {
      killed.push({ pid, signal, at: clock });
      const child = children.find((entry) => entry.pid === pid);
      assert.ok(child, 'Only this runner’s own child groups may be signaled');
      if (signal === 'SIGKILL' || stopOnTerm) child.finish(null, signal);
    },
  };
  return {
    deps,
    children,
    calls,
    killed,
    readies,
    reports,
    signals,
    timers,
    run: () =>
      runSearchProductionEvidence(
        {
          root: '/repo',
          timeoutMs: 100,
          cleanupMs: 10,
          port: 4397,
          env: { CANDIDATE_SHA: 'a'.repeat(40), CHROME_PATH: '/owned/chrome' },
        },
        deps
      ),
    jumpWithoutTimers(ms) {
      clock += ms;
    },
    async advance(ms) {
      const target = clock + ms;
      await flush();
      while (true) {
        const next = [...timers]
          .filter(([, value]) => value.at <= target)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        clock = next[1].at;
        timers.delete(next[0]);
        next[1].callback();
        await flush();
      }
      clock = target;
      await flush();
    },
  };
}

test('build, exact preview, directly owned Chrome and mandatory two-case suite consume one deadline', async () => {
  const f = fixture();
  await f.run();
  const spawns = f.calls.filter(([kind]) => kind === 'spawn');
  assert.equal(spawns.length, 4);
  assert.deepEqual(spawns[0][2], ['pnpm@10.32.1', '--filter', 'apps-www', 'build']);
  assert.match(f.calls.find(([kind]) => kind === 'access')[1], /dist\/pagefind\/pagefind.js$/);
  assert.match(spawns[1][2][0], /search-production-preview.mjs$/);
  assert.equal(spawns[1][3].env.PROTO_UI_SEARCH_PRODUCTION_PORT, '4397');
  assert.deepEqual(
    f.readies.map((entry) => entry.url),
    SEARCH_PRODUCTION_ROUTES.map((route) => `http://127.0.0.1:4397${route}`)
  );
  assert.deepEqual(
    f.readies.map((entry) => entry.timeoutMs),
    [70, 65, 60]
  );
  assert.ok(f.readies.every((entry) => entry.server === f.children[1]));
  assert.equal(spawns[2][1], '/owned/chrome');
  for (const arg of [
    '--remote-debugging-port=0',
    '--remote-debugging-address=127.0.0.1',
    '--user-data-dir=/owned/tmp/search-profile',
  ])
    assert.ok(spawns[2][2].includes(arg));
  assert.equal(spawns[3][2].at(-1), SEARCH_PRODUCTION_SUITE);
  assert.equal(spawns[3][3].env.PROTO_UI_SEARCH_PRODUCTION_REQUIRED, '1');
  assert.equal(
    spawns[3][3].env.PROTO_UI_SEARCH_PRODUCTION_CDP,
    'ws://127.0.0.1:9999/devtools/browser/owned'
  );
  assert.equal(spawns[3][3].env.PROTO_UI_SEARCH_PRODUCTION_BASE_URL, 'http://127.0.0.1:4397');
  assert.ok(spawns.every(([, , , options]) => options.detached === true));
  for (const child of f.children)
    assert.ok(f.killed.some(({ pid, signal }) => pid === child.pid && signal === 'SIGKILL'));
  assert.equal(f.calls.filter(([kind]) => kind === 'profile-remove').length, 1);
  assert.equal(f.timers.size, 0);
  assert.equal(f.signals.eventNames().length, 0);
});

test('build failure and missing generated Pagefind assets cannot start preview or Chrome', async () => {
  for (const options of [{ buildCode: 1 }, { missingAssets: true }]) {
    const f = fixture(options);
    await assert.rejects(f.run(), /build failed|Missing generated Pagefind/);
    assert.equal(f.children.length, 1);
    assert.equal(f.readies.length, 0);
  }
});

test('preview exit before readiness or a readiness failure is a real failure', async () => {
  const f = fixture({ previewExit: true });
  await assert.rejects(f.run(), /Production preview exited/);
  assert.equal(f.children.length, 2);
  assert.equal(f.readies.length, 0);
  const g = fixture();
  g.deps.readiness = async () => {
    throw new Error('HTTP 404 readiness failed');
  };
  await assert.rejects(g.run(), /HTTP 404 readiness failed/);
  assert.equal(g.children.length, 2);
});

test('nonzero test exit cleans all known Chrome, preview and test groups', async () => {
  const f = fixture({ testCode: 1 });
  await assert.rejects(f.run(), /search-production-tests failed/);
  assert.deepEqual(
    new Set(f.killed.map(({ pid }) => pid)),
    new Set([10_000, 10_001, 10_002, 10_003])
  );
});

test('hung build reserves time for confirmed forceful exit within the total deadline', async () => {
  const f = fixture({ hangBuild: true, stopOnTerm: false });
  const rejected = assert.rejects(f.run(), /total deadline reached/);
  await f.advance(100);
  await rejected;
  assert.equal(f.killed.at(-1).signal, 'SIGKILL');
  assert.equal(f.killed.at(-1).at, 95);
  assert.equal(f.children[0].signalCode, 'SIGKILL');
  assert.equal(f.timers.size, 0);
});

test('hung readiness and early preview exit cannot create Chrome or tests', async () => {
  const f = fixture({ hangReady: true });
  const rejected = assert.rejects(f.run(), /total deadline reached/);
  await flush();
  await f.advance(70);
  await rejected;
  assert.equal(f.children.length, 2);
  const g = fixture({ hangReady: true });
  const exited = assert.rejects(g.run(), /Production preview exited before completion/);
  await flush();
  g.children[1].finish(0);
  await exited;
  assert.equal(g.children.length, 2);
});

test('pending Chrome startup is owned before any CDP handshake and killed by the deadline', async () => {
  const f = fixture({ browserMode: 'pending' });
  const rejected = assert.rejects(f.run(), /total deadline reached/);
  await flush();
  assert.equal(f.children.length, 3, 'Chrome PID already exists while handshake is pending');
  await f.advance(55);
  await rejected;
  assert.ok(f.killed.some(({ pid, signal }) => pid === 10_002 && signal === 'SIGKILL'));
  assert.ok(f.children[2].signalCode, 'Owned Chrome exit must be confirmed');
  assert.ok(f.calls.some(([kind]) => kind === 'profile-remove'));
  f.children[2].stderr.emit(
    'data',
    Buffer.from('DevTools listening on ws://127.0.0.1:9999/devtools/browser/late\n')
  );
  await flush();
  assert.equal(f.children.length, 3, 'Late handshake cannot start tests after cleanup');
});

test('SIGTERM during pending Chrome startup cleans its already owned PID and removes traps', async () => {
  const f = fixture({ browserMode: 'pending' });
  const rejected = assert.rejects(f.run(), /interrupted by SIGTERM/);
  await flush();
  f.signals.emit('SIGTERM');
  await rejected;
  assert.ok(f.killed.some(({ pid, signal }) => pid === 10_002 && signal === 'SIGKILL'));
  assert.equal(f.signals.eventNames().length, 0);
  assert.equal(f.timers.size, 0);
});

test('Chrome startup exit or an invalid endpoint fails closed before a test process', async () => {
  for (const browserMode of ['exit', 'bad']) {
    const f = fixture({ browserMode });
    await assert.rejects(f.run(), /browser exited|Chrome exited|invalid loopback CDP endpoint/);
    assert.equal(f.children.length, 3);
    assert.ok(f.killed.some(({ pid }) => pid === 10_002));
  }
});

test('a handshake split across stderr chunks is read only from the owned Chrome child', async () => {
  const f = fixture({ browserMode: 'pending' });
  const run = f.run();
  await flush();
  f.children[2].stderr.emit('data', Buffer.from('DevTools listening '));
  f.children[2].stderr.emit('data', Buffer.from('on ws://127.0.0.1:9999/devtools/browser/split\n'));
  await run;
  assert.equal(
    f.calls.find(([kind, , args]) => kind === 'spawn' && args.includes('vitest'))[3].env
      .PROTO_UI_SEARCH_PRODUCTION_CDP,
    'ws://127.0.0.1:9999/devtools/browser/split'
  );
});

test('an owned Chrome exit aborts stalled tests and confirms their cleanup', async () => {
  const f = fixture({ hangTests: true });
  const rejected = assert.rejects(f.run(), /Owned production browser exited before completion/);
  await flush();
  f.children[2].finish(1);
  await rejected;
  assert.ok(f.children[3].signalCode);
  assert.ok(f.killed.some(({ pid, signal }) => pid === 10_003 && signal === 'SIGKILL'));
});

test('late handshake plus unconfirmed Chrome kill can never become a passing result', async () => {
  const f = fixture({ browserMode: 'pending' });
  const original = f.deps.signalProcessGroup;
  f.deps.signalProcessGroup = (pid, signal) => {
    if (pid === 10_002) throw Object.assign(new Error('kill denied'), { code: 'EPERM' });
    original(pid, signal);
  };
  const rejected = assert.rejects(f.run(), /total deadline reached/);
  await flush();
  await f.advance(55);
  f.children[2].stderr.emit(
    'data',
    Buffer.from('DevTools listening on ws://127.0.0.1:9999/devtools/browser/too-late\n')
  );
  await f.advance(10);
  await rejected;
  assert.equal(f.children.length, 3, 'A late handshake cannot bypass abort and start tests');
  assert.equal(f.children[2].exitCode, null);
  assert.equal(f.children[2].signalCode, null);
  assert.ok(!f.reports.some((line) => line.includes('cleanup passed')));
  assert.ok(f.reports.some((line) => line.includes('kill denied')));
});

test('cleanup failures after successful test execution are failures, including profile removal', async () => {
  const f = fixture();
  const original = f.deps.signalProcessGroup;
  f.deps.signalProcessGroup = (pid, signal) => {
    if (pid === 10_002) throw Object.assign(new Error('kill denied'), { code: 'EPERM' });
    original(pid, signal);
  };
  const rejected = assert.rejects(f.run(), /process cleanup failed/);
  await flush();
  await f.advance(65);
  await rejected;
  assert.ok(!f.reports.some((line) => line.includes('cleanup passed')));
  const g = fixture();
  g.deps.removeProfile = async () => {
    throw new Error('profile removal failed');
  };
  await assert.rejects(g.run(), /process cleanup failed/);
});

test('stalled profile removal is bounded by the original total deadline', async () => {
  const f = fixture();
  f.deps.removeProfile = () => new Promise(() => {});
  const rejected = assert.rejects(f.run(), /process cleanup failed/);
  await flush();
  await f.advance(65);
  await rejected;
  assert.equal(f.timers.size, 0);
});

test('late cleanup completion cannot win over the deadline through a microtask checkpoint', async () => {
  const f = fixture();
  f.deps.removeProfile = async () => {
    f.jumpWithoutTimers(100);
  };
  await assert.rejects(f.run(), /process cleanup failed/);
  assert.ok(!f.reports.some((line) => line.includes('cleanup passed')));
});

test('fixed port mismatch stops only the newly owned preview and reports EADDRINUSE', async () => {
  let stops = 0;
  await assert.rejects(
    startStrictPreview({ root: '/site', port: 4397 }, async (config) => {
      assert.equal(config.server.port, 4397);
      return {
        server: { address: () => ({ port: 4398 }) },
        stop: async () => {
          stops++;
        },
      };
    }),
    (error) => error.code === 'EADDRINUSE'
  );
  assert.equal(stops, 1);
  const error = Object.assign(new Error('EADDRINUSE'), { code: 'EADDRINUSE' });
  await assert.rejects(
    startStrictPreview({ root: '/site', port: 4397 }, async () => {
      throw error;
    }),
    (actual) => actual === error
  );
});

test('required Actions and real cross-path navigation cannot be replaced by skip or a same-page focus check', () => {
  const workflow = parse(
    readFileSync(
      new URL('../../../.github/workflows/homepage-visual-evidence.yml', import.meta.url),
      'utf8'
    )
  );
  const step = workflow.jobs.capture.steps.find(
    (entry) => entry.name === 'Verify built production Search with real Pagefind'
  );
  assert.ok(step);
  assert.notEqual(step['continue-on-error'], true);
  assert.equal(step['timeout-minutes'], 10);
  assert.match(step.run, /node apps\/www\/scripts\/run-search-production-evidence.mjs/);
  assert.equal(workflow.jobs.capture['timeout-minutes'], 40);
  const suite = readFileSync(
    new URL('../src/content/docs/zh-cn/site-search-production.browser.test.ts', import.meta.url),
    'utf8'
  );
  for (const expression of [
    /PROTO_UI_SEARCH_PRODUCTION_REQUIRED/,
    /input\.fill\('Button'\)/,
    /destinationResponse\.ok\(\)/,
    /result\.click\(\)/,
    /waitForResponse/,
    /navigationResponse\?\.ok/,
    /targetPath !== sourcePath/,
    /connectOverCDP/,
    /status: 503/,
    /await route\.continue\(\)/,
  ])
    assert.match(suite, expression);
  assert.doesNotMatch(suite, /describe\.skip|it\.skip|startServer\(/);
  const runner = readFileSync(
    new URL('run-search-production-evidence.mjs', import.meta.url),
    'utf8'
  );
  assert.doesNotMatch(runner, /launchBrowserServer|\.launchServer\(/);
  assert.match(runner, /start\('search-production-browser', env\.CHROME_PATH/);
});

for (const root of [
  new URL('../', import.meta.url),
  new URL('file:///tmp/production%20site/apps/www/'),
]) {
  test(`passes Astro a filesystem root string for ${root.href}`, async () => {
    const expectedRoot = fileURLToPath(root);
    const owned = { server: { address: () => ({ port: 4397 }) }, stop: async () => {} };
    const preview = await startStrictPreview({ root, port: 4397 }, async (config) => {
      // Astro 5.18.1 createFileBasedRoutes calls path.relative(root, ...).
      // Retain that real argument boundary; accepting URL here hid the defect.
      assert.equal(path.relative(config.root, expectedRoot), '');
      assert.deepEqual(config, {
        root: expectedRoot,
        server: { host: '127.0.0.1', port: 4397, open: false },
      });
      return owned;
    });
    assert.equal(preview, owned);
  });
}

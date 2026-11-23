import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { parse } from 'yaml';
import {
  runSearchProductionEvidence,
  retainSearchProductionBuild,
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
  extraEnv = {},
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
          env: { CANDIDATE_SHA: 'a'.repeat(40), CHROME_PATH: '/owned/chrome', ...extraEnv },
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
  assert.ok(!spawns[2][2].includes('--no-sandbox'));
  assert.ok(!spawns[2][2].includes('--disable-setuid-sandbox'));
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

test('an explicit Sprint 1 report path reaches the original mandatory production suite', async () => {
  const f = fixture({ extraEnv: { PROTO_UI_SEARCH_PRODUCTION_REPORT: '/evidence/vitest.json' } });
  await f.run();
  const args = f.calls.filter(([kind]) => kind === 'spawn')[3][2];
  assert.deepEqual(args.slice(-4), [
    '--reporter=default',
    '--reporter=json',
    '--outputFile=/evidence/vitest.json',
    SEARCH_PRODUCTION_SUITE,
  ]);
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

async function syntheticBuild(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'search-build-capture-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dist = path.join(root, 'apps/www/dist');
  const directory = path.join(root, 'retained');
  const bodies = new Map([
    ['_astro/search.fixture.js', 'console.log("unchanged emitted script");\n'],
    ['_astro/worker.fixture.mjs', 'export const fixture = "worker";\n'],
    ['_astro/search.fixture.js.map', '{"version":3,"sources":["fixture.ts"]}\n'],
    ['pagefind/pagefind.js', 'export const fixture = "pagefind";\n'],
    ['proto-ui-bundle-graph.json', '{"version":1,"chunks":[],"modules":[]}\n'],
    ['zh-cn/ui-libraries/shadcn/button/index.html', '<html>shadcn fixture</html>\n'],
    [
      'zh-cn/ui-libraries/brutalist/components/button/index.html',
      '<html>brutalist fixture</html>\n',
    ],
    ['_astro/irrelevant.css', '.fixture { color: red; }\n'],
    ['unselected/index.html', '<html>not a measured route</html>\n'],
    ['private.txt', 'not a public emitted script\n'],
  ]);
  for (const [file, bytes] of bodies) {
    const target = path.join(dist, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
  const identity = { sha: 'a'.repeat(40), tree: 'b'.repeat(40), dirty: false };
  const options = { root, directory, expectedSha: identity.sha, runnerOutcome: 'failure' };
  return {
    root,
    dist,
    directory,
    bodies,
    identity,
    options,
    capture: (overrides = {}, dependencies = {}) =>
      retainSearchProductionBuild(
        { ...options, ...overrides },
        { readSource: () => ({ ...identity }), ...dependencies }
      ),
  };
}

test('terminal failure retains exact same-build scripts, existing maps, graph and both route HTML files', async (t) => {
  const f = await syntheticBuild(t);
  const manifest = await f.capture();
  assert.equal(manifest.status, 'captured');
  assert.equal(manifest.runnerOutcome, 'failure');
  assert.equal(manifest.byteProvenance, 'same-build-output');
  assert.equal(manifest.actualServedBytes, false);
  assert.equal(manifest.establishesPerformanceAcceptance, false);
  assert.equal(manifest.rebuildPerformed, false);
  assert.deepEqual(manifest.sourceBefore, f.identity);
  assert.deepEqual(manifest.sourceAfter, f.identity);
  assert.deepEqual(
    manifest.files.map((entry) => entry.path).sort(),
    [...f.bodies.keys()]
      .filter(
        (file) => !['private.txt', 'unselected/index.html', '_astro/irrelevant.css'].includes(file)
      )
      .sort()
  );
  for (const entry of manifest.files) {
    const original = Buffer.from(f.bodies.get(entry.path));
    assert.equal(entry.bytes, original.length);
    assert.equal(entry.copyVerified, true);
    assert.equal(entry.sha256, createHash('sha256').update(original).digest('hex'));
    assert.deepEqual(await readFile(path.join(f.directory, 'files', entry.path)), original);
    assert.deepEqual(await readFile(path.join(f.dist, entry.path)), original);
  }
  assert.deepEqual(
    JSON.parse(await readFile(path.join(f.directory, 'manifest.json'), 'utf8')),
    manifest
  );
  await assert.rejects(f.capture(), { code: 'EEXIST' });
});

test('corrupted retained bytes cannot receive a verified source digest', async (t) => {
  const f = await syntheticBuild(t);
  const manifest = await f.capture(
    {},
    {
      writeCopy: (file, bytes) =>
        writeFile(file, file.endsWith('search.fixture.js') ? 'injected truncated copy' : bytes),
    }
  );
  assert.equal(manifest.status, 'incomplete');
  assert.ok(manifest.errors.some((error) => error.includes('Retained bytes differ')));
  assert.ok(!manifest.files.some((entry) => entry.path === '_astro/search.fixture.js'));
  assert.equal(
    await readFile(path.join(f.directory, 'files/_astro/search.fixture.js'), 'utf8'),
    'injected truncated copy'
  );
});

test('absent source maps are recorded as absent without generating another build or map', async (t) => {
  const f = await syntheticBuild(t);
  await rm(path.join(f.dist, '_astro/search.fixture.js.map'));
  const manifest = await f.capture({ runnerOutcome: 'success' });
  assert.equal(manifest.status, 'captured');
  assert.equal(manifest.files.filter((entry) => entry.kind === 'source-map').length, 0);
  assert.equal(manifest.sourceMaps, 'retain-only-if-already-emitted');
  assert.equal(manifest.rebuildPerformed, false);
  assert.ok(!(await readdir(path.join(f.dist, '_astro'))).some((file) => file.endsWith('.map')));
});

test('a failed or partial build leaves an incomplete manifest while retaining every available script', async (t) => {
  for (const missing of [
    'proto-ui-bundle-graph.json',
    'zh-cn/ui-libraries/shadcn/button/index.html',
    'zh-cn/ui-libraries/brutalist/components/button/index.html',
    null,
  ]) {
    const f = await syntheticBuild(t);
    await rm(missing ? path.join(f.dist, missing) : f.dist, { recursive: true, force: true });
    const manifest = await f.capture();
    assert.equal(manifest.status, 'incomplete');
    assert.ok(manifest.errors.some((error) => error.includes(missing ?? 'Build output')));
    assert.equal(manifest.files.filter((entry) => entry.kind === 'script').length, missing ? 3 : 0);
    assert.equal(
      JSON.parse(await readFile(path.join(f.directory, 'manifest.json'), 'utf8')).status,
      'incomplete'
    );
  }
});

test('stale, dirty or changing source and a skipped runner never produce a complete capture receipt', async (t) => {
  for (const kind of ['stale', 'dirty', 'changed-tree', 'skipped']) {
    const f = await syntheticBuild(t);
    let reads = 0;
    const manifest = await f.capture(kind === 'skipped' ? { runnerOutcome: 'skipped' } : {}, {
      readSource: () => {
        reads++;
        return {
          ...f.identity,
          sha: kind === 'stale' ? 'c'.repeat(40) : f.identity.sha,
          tree: kind === 'changed-tree' && reads === 2 ? 'd'.repeat(40) : f.identity.tree,
          dirty: kind === 'dirty',
        };
      },
    });
    assert.equal(reads, 2);
    assert.equal(manifest.status, 'incomplete');
    assert.ok(manifest.errors.length > 0);
    assert.equal(manifest.files.filter((entry) => entry.kind === 'script').length, 3);
  }
});

test('capture does not follow outside symlinks or write into its source dist', async (t) => {
  const f = await syntheticBuild(t);
  await writeFile(path.join(f.root, 'outside.js'), 'outside source must not enter the artifact\n');
  await symlink(path.join(f.root, 'outside.js'), path.join(f.dist, '_astro/outside.js'));
  const manifest = await f.capture();
  assert.equal(manifest.status, 'incomplete');
  assert.ok(manifest.errors.some((error) => error.includes('did not follow symlink')));
  assert.ok(!manifest.files.some((entry) => entry.path.endsWith('outside.js')));
  await assert.rejects(
    f.capture({ directory: path.join(f.dist, 'capture') }),
    /outside the measured dist tree/
  );
  assert.ok(!(await readdir(f.dist)).includes('capture'));
});

test('a symlink dist root is retained as an incomplete receipt without reading the linked tree', async (t) => {
  const f = await syntheticBuild(t);
  const outside = path.join(f.root, 'outside-dist');
  await mkdir(outside);
  await writeFile(path.join(outside, 'outside.js'), 'not this build\\n');
  await rm(f.dist, { recursive: true, force: true });
  await symlink(outside, f.dist);
  const manifest = await f.capture();
  assert.equal(manifest.status, 'incomplete');
  assert.deepEqual(manifest.files, []);
  assert.ok(manifest.errors.some((error) => error.includes('symlink root')));
});

test('runtime diagnostic retains same-build output only after the original runner and before always upload', () => {
  const workflow = parse(
    readFileSync(
      new URL('../../../.github/workflows/search-runtime-diagnostic.yml', import.meta.url),
      'utf8'
    )
  );
  const job = workflow.jobs['production-runtime-profile'];
  const ownerIndex = job.steps.findIndex((step) => step.id === 'production_profile');
  const captureIndex = job.steps.findIndex((step) => step.run?.includes(' retain-build '));
  const uploadIndex = job.steps.findIndex((step) =>
    step.uses?.startsWith('actions/upload-artifact@')
  );
  assert.ok(ownerIndex >= 0 && captureIndex > ownerIndex && uploadIndex > captureIndex);
  const owner = job.steps[ownerIndex];
  const capture = job.steps[captureIndex];
  assert.equal(job['timeout-minutes'], 15);
  assert.equal(owner['timeout-minutes'], 10);
  assert.equal(owner.env.PROTO_UI_SEARCH_RUNTIME_PROFILE, '1');
  assert.equal(owner['continue-on-error'], undefined);
  assert.match(owner.run, /node apps\/www\/scripts\/run-search-production-evidence\.mjs \\/);
  assert.equal(capture.if, 'always()');
  assert.equal(
    capture.env.PROTO_UI_SEARCH_DIAGNOSTIC_RUNNER_OUTCOME,
    '${{ steps.production_profile.outcome }}'
  );
  assert.equal(
    capture.run.trim(),
    'node apps/www/scripts/run-search-production-evidence.mjs retain-build \\\n  "$RUNNER_TEMP/homepage-evidence/search-production/same-build"'
  );
  assert.equal(job.steps[uploadIndex].if, 'always()');
  assert.equal(job.steps[uploadIndex].with.path, '${{ runner.temp }}/homepage-evidence');
});

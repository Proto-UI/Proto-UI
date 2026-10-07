import assert from 'node:assert/strict';
import fs, { globSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { EventEmitter, getEventListeners } from 'node:events';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import YAML from 'yaml';
import {
  createCiPlan,
  runtimeSelection,
  assertVitestReport,
  assertRuntimeGate,
  runtimeRoot,
  ciContext,
  checkoutSha,
  runtimeSlots,
  artifactName,
  assertCiGate,
  finishCiSlot,
  writeJson,
} from './runtime-ci.mjs';
import { waitForServerReadiness } from './server-readiness.mjs';
import { fileURLToPath } from 'node:url';
import { safeError, safeUrl } from './search-startup-profile.mjs';

import {
  BROWSER_SUITES,
  BROWSER_SHARD_COUNT,
  assertBrowserInventory,
  browserShards,
  selectBrowserShard,
  PRODUCTION_BROWSER_SUITES,
  PRODUCTION_BROWSER_OWNERS,
  corepackInvocation,
  createRuntimeTestPlan,
  READY_ROUTES,
} from './runtime-test-plan.mjs';
import {
  observeReadinessFailures,
  observeRuntimeServer,
  runtimeServerSnapshot,
} from './runtime-server-diagnostics.mjs';

describe('native-link browser evidence mutation controls (no browser or server)', () => {
  // Execute the exact pure function imported by the browser suite. Compilation
  // and VM evaluation avoid booting Vite, a websocket, or a DOM simulator.
  const source = readFileSync(
    new URL('../../apps/www/src/content/docs/zh-cn/site-native-link-evidence.ts', import.meta.url),
    'utf8'
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  runInNewContext(compiled, { module, exports: module.exports });
  const check = module.exports.nativeLinkEvidenceIssues;
  const expected = {
    href: 'https://github.com/Proto-UI/Proto-UI',
    name: 'GitHub',
    target: '_blank',
    rel: 'noreferrer',
  };
  const fixture = () => ({
    ...expected,
    tag: 'A',
    role: null,
    nestedFocus: 0,
    centerHitIsAnchor: true,
    cornerHitIsAnchor: true,
    anchorRect: { left: 10, top: 20, right: 54, bottom: 64 },
    surfaceRect: { left: 10, top: 20, right: 54, bottom: 64 },
  });
  it('accepts a real-anchor snapshot and the explicit subpixel containment tolerance', () => {
    assert.equal(check(fixture(), expected).length, 0);
    const near = fixture();
    near.surfaceRect.right += 0.49;
    assert.equal(check(near, expected).length, 0);
  });
  for (const [name, mutate, rejected] of [
    [
      'descendant SVG center hit',
      (f) => {
        f.centerHitIsAnchor = false;
      },
      'exact hit target',
    ],
    [
      'descendant corner hit',
      (f) => {
        f.cornerHitIsAnchor = false;
      },
      'exact hit target',
    ],
    [
      'oversized visual',
      (f) => {
        f.surfaceRect.right += 3;
      },
      'outside native hit box',
    ],
    [
      'shifted visual',
      (f) => {
        f.surfaceRect.top -= 3;
      },
      'outside native hit box',
    ],
    [
      'invalid geometry',
      (f) => {
        f.surfaceRect.right = NaN;
      },
      'outside native hit box',
    ],
    [
      'wrong href',
      (f) => {
        f.href = 'https://example.invalid/';
      },
      'href mismatch',
    ],
    [
      'wrong aria name',
      (f) => {
        f.name = 'Wrong';
      },
      'name mismatch',
    ],
    [
      'fake button role',
      (f) => {
        f.role = 'button';
      },
      'unexpected role',
    ],
    [
      'non-anchor root',
      (f) => {
        f.tag = 'DIV';
      },
      'native anchor tag',
    ],
    [
      'nested focus owner',
      (f) => {
        f.nestedFocus = 1;
      },
      'nested focus owner',
    ],
    [
      'lost new-tab target',
      (f) => {
        f.target = null;
      },
      'target mismatch',
    ],
    [
      'lost rel',
      (f) => {
        f.rel = null;
      },
      'rel mismatch',
    ],
  ]) {
    it(`rejects ${name}`, () => {
      const actual = fixture();
      mutate(actual);
      assert.ok(check(actual, expected).some((issue) => issue.includes(rejected)));
    });
  }
});

it('registers every discovered browser suite exactly once in its explicit browser phase', () => {
  // Mirror the runtime Vitest include roots, retaining newly added browser suites.
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const discovered = globSync(
    [
      'packages/**/*.browser.test.ts',
      'internal/contracts/__tests__/**/*.browser.test.ts',
      'apps/**/test/**/*.browser.test.ts',
      'apps/www/src/**/*.browser.test.ts',
    ],
    { cwd: root, exclude: ['**/node_modules/**', '**/dist/**'] }
  ).map((suite) => suite.replaceAll('\\', '/'));
  assert.deepEqual(
    [...BROWSER_SUITES, ...PRODUCTION_BROWSER_SUITES].sort(),
    [...new Set(discovered)].sort()
  );
  const [general, browser] = createRuntimeTestPlan([]);
  assert.equal(browser.needsServer, true);
  assert.ok(browser.args.includes('--no-file-parallelism'));
  for (const suite of discovered) {
    assert.equal(general.args.filter((arg) => arg === suite).length, 1);
    assert.equal(general.args[general.args.indexOf(suite) - 1], '--exclude');
    assert.equal(
      browser.args.filter((arg) => arg === suite).length,
      PRODUCTION_BROWSER_SUITES.includes(suite) ? 0 : 1
    );
  }
});

describe('runtime test plan', () => {
  it('warms both Table locales before shared-server browser navigation', () => {
    for (const route of ['/en/ui-libraries/base/table/', '/zh-cn/ui-libraries/base/table/']) {
      assert.ok(READY_ROUTES.includes(route), `Missing readiness route: ${route}`);
    }
  });
  it('runs both Table browser suites in the sequential shared-server bucket', () => {
    for (const suite of [
      'apps/www/src/content/docs/zh-cn/demo-base-table.browser.test.ts',
      'apps/www/src/content/docs/zh-cn/table-react19.browser.test.ts',
    ])
      assert.ok(BROWSER_SUITES.includes(suite), suite);
  });
  it('keeps forwarded Vitest arguments out of the Windows command shell', () => {
    const source = fs.readFileSync(new URL('./run-runtime-tests.mjs', import.meta.url), 'utf8');
    const runVitest = source.match(/async function runVitest[\s\S]*?\n\}\n/u)?.[0] ?? '';
    assert.match(runVitest, /spawn\(process\.execPath,[\s\S]*?shell: false/u);
    assert.doesNotMatch(runVitest, /shell:\s*process\.platform/u);
  });

  it('keeps the direct Node and Astro child out of the Windows command shell', () => {
    const source = fs.readFileSync(new URL('./run-runtime-tests.mjs', import.meta.url), 'utf8');
    const startServer = source.match(/async function startServer[\s\S]*?\n\}\n/u)?.[0] ?? '';
    assert.match(startServer, /spawn\(\s*process\.execPath,\s*\[astroCli,[\s\S]*?shell: false/u);
    assert.doesNotMatch(startServer, /shell:\s*process\.platform/u);
  });

  it('launches the Windows Corepack shim through a shell', () => {
    assert.deepEqual(corepackInvocation('win32'), {
      executable: 'corepack.cmd',
      shell: true,
    });
    assert.deepEqual(corepackInvocation('linux'), {
      executable: 'corepack',
      shell: false,
    });
  });

  it('classifies every website browser suite into the shared-server phase', () => {
    const scan = (directory) =>
      readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const file = path.join(directory, entry.name);
        return entry.isDirectory()
          ? ['node_modules', 'dist', '.astro'].includes(entry.name)
            ? []
            : scan(file)
          : file.endsWith('.browser.test.ts')
            ? [file.replaceAll(path.sep, '/')]
            : [];
      });
    for (const file of scan('apps/www')) {
      assert.ok(
        [...BROWSER_SUITES, ...PRODUCTION_BROWSER_SUITES].includes(file),
        `${file} must not run in the parallel unit phase`
      );
    }
  });
  it('reserves generated Pagefind evidence for the mandatory production runner', () => {
    const plan = createRuntimeTestPlan([]);
    for (const suite of PRODUCTION_BROWSER_SUITES) {
      assert.ok(plan[0].args.includes(suite));
      assert.ok(!plan[1].args.includes(suite));
      assert.ok(readFileSync(PRODUCTION_BROWSER_OWNERS[suite], 'utf8').includes(suite));
    }
  });
  it('preserves focused Vitest arguments without starting the documentation server', () => {
    assert.deepEqual(
      createRuntimeTestPlan(['--', 'packages/spec/fixtures/test/context-fixtures.test.ts']),
      [
        {
          needsServer: false,
          args: ['packages/spec/fixtures/test/context-fixtures.test.ts'],
        },
      ]
    );
  });

  it('lets an exact single browser suite use its standalone server', () => {
    const suite = BROWSER_SUITES[0];

    for (const filter of [suite, `./${suite}`, path.resolve(suite)]) {
      for (const args of [[filter], ['--reporter=dot', filter], [filter, '--reporter=dot']]) {
        assert.deepEqual(createRuntimeTestPlan(args), [
          {
            needsServer: false,
            args,
          },
        ]);
      }
    }
  });

  it('isolates browser suites behind one shared documentation server in a full run', () => {
    assert.deepEqual(createRuntimeTestPlan([]), [
      {
        needsServer: false,
        args: [
          '--minWorkers=1',
          '--maxWorkers=2',
          ...[...BROWSER_SUITES, ...PRODUCTION_BROWSER_SUITES].flatMap((suite) => [
            '--exclude',
            suite,
          ]),
        ],
      },
      {
        needsServer: true,
        // Sequential, because every suite drives the same dev server.
        args: ['--no-file-parallelism', ...BROWSER_SUITES],
      },
    ]);
  });
});

describe('shared browser server diagnostics', () => {
  it('prints the current bounded output even when the wrapper process has not exited', () => {
    const message = runtimeServerSnapshot(
      { pid: 123, exitCode: null, signalCode: null },
      'browser readiness failed',
      'old output' + 'x'.repeat(20_000) + '\n[500] /ready/'
    );
    assert.match(message, /pid=123; exitCode=null; signal=null/);
    assert.match(message, /\[500\] \/ready\/$/);
    assert.equal(message.includes('old output'), false);
    assert.equal(message.split('characters):\n')[1].length, 20_000);
  });

  it('recognizes a readiness failure across output chunks and reports it only once', () => {
    let reports = 0;
    const inspect = observeReadinessFailures(() => reports++);
    inspect(Buffer.from('normal browser output\n[browser-har'));
    assert.equal(reports, 0);
    inspect(Buffer.from('ness] readiness failed: Last readiness result: HTTP 500'));
    assert.equal(reports, 1);
    inspect(Buffer.from('\n[browser-harness] readiness failed: again'));
    assert.equal(reports, 1);
  });

  function fixture() {
    const server = new EventEmitter();
    const reports = [];
    let shuttingDown = false;
    let output = 'startup output';
    const dispose = observeRuntimeServer(server, {
      isShuttingDown: () => shuttingDown,
      readOutput: () => output,
      report: (message) => reports.push(message),
    });
    return {
      server,
      reports,
      dispose,
      shutdown: () => (shuttingDown = true),
      output: (value) => (output = value),
    };
  }

  it('reports unexpected signal exit immediately with bounded current server output', () => {
    const probe = fixture();
    probe.output('old output' + 'x'.repeat(20_000) + '\nFATAL ERROR: heap exhausted');
    probe.server.emit('exit', null, 'SIGKILL');
    assert.equal(probe.reports.length, 1);
    assert.match(probe.reports[0], /exitCode=null; signal=SIGKILL/);
    assert.match(probe.reports[0], /FATAL ERROR: heap exhausted$/);
    assert.equal(probe.reports[0].includes('old output'), false);
    assert.equal(probe.reports[0].split('characters):\n')[1].length, 20_000);
    probe.dispose();
  });

  it('reports an unexpected nonzero or clean early exit', () => {
    for (const code of [1, 0]) {
      const probe = fixture();
      probe.server.emit('exit', code, null);
      assert.equal(probe.reports.length, 1);
      assert.match(probe.reports[0], new RegExp(`exitCode=${code}; signal=null`));
      probe.dispose();
    }
  });

  it('reports error followed by exit only once', () => {
    const probe = fixture();
    probe.server.emit('error', new Error('server process error'));
    probe.server.emit('exit', 1, null);
    assert.equal(probe.reports.length, 1);
    assert.match(probe.reports[0], /error=server process error/);
    probe.dispose();
  });

  it('keeps normal completion and signal cleanup silent and removes its listeners', () => {
    for (const signal of [null, 'SIGTERM', 'SIGKILL']) {
      const probe = fixture();
      probe.shutdown();
      probe.server.emit('error', new Error('shutdown error'));
      probe.server.emit('exit', signal ? null : 0, signal);
      assert.deepEqual(probe.reports, []);
      probe.dispose();
      assert.equal(probe.server.listenerCount('exit'), 0);
      assert.equal(probe.server.listenerCount('error'), 0);
    }
  });
});

it('runs the Brutalist Spinner only in the shared sequential browser phase', () => {
  const spinner = 'apps/www/src/content/docs/zh-cn/demo-brutalist-spinner.browser.test.ts';
  const plan = createRuntimeTestPlan([]);
  assert.equal(BROWSER_SUITES.filter((suite) => suite === spinner).length, 1);
  assert.equal(plan[0].args[plan[0].args.indexOf(spinner) - 1], '--exclude');
  assert.equal(plan[1].needsServer, true);
  assert.ok(plan[1].args.includes('--no-file-parallelism'));
  assert.equal(plan[1].args.filter((suite) => suite === spinner).length, 1);
});

describe('bounded documentation readiness', () => {
  it('wires every documentation readiness owner to the same bounded helper', () => {
    const runner = readFileSync('scripts/test/run-runtime-tests.mjs', 'utf8');
    assert.match(runner, /const READY_TIMEOUT_MS = 180_000/);
    assert.match(runner, /waitForServerReadiness\(url, \{\s*timeoutMs: READY_TIMEOUT_MS/);
    for (const file of [
      'browser-harness.ts',
      'demo-base-controls.browser.test.ts',
      'demo-brutalist-controls.browser.test.ts',
    ]) {
      const source = readFileSync(`apps/www/src/content/docs/zh-cn/${file}`, 'utf8');
      assert.match(source, /waitForServerReadiness\(url, \{\s*timeoutMs: 120_000/);
      assert.match(source, /\[browser-harness\] readiness failed:/);
      assert.doesNotMatch(source, /AbortSignal\.timeout\(2_000\)/);
    }
    // The process-owning runner retains its existing finally cleanup. Helper
    // tests below prove request/timer cleanup; this is only a wiring guard.
    assert.match(runner, /finally \{\s*await stopServer\(\)/);
  });

  // Execute the production helper with a deterministic clock and HTTP
  // transport. No socket or browser is started by these negative controls.
  function fixture(t, replies) {
    let now = 0;
    let nextId = 0;
    const timers = new Map();
    t.mock.method(Date, 'now', () => now);
    t.mock.method(globalThis, 'setTimeout', (callback, delay = 0) => {
      const id = ++nextId;
      timers.set(id, { at: now + delay, callback });
      return id;
    });
    t.mock.method(globalThis, 'clearTimeout', (id) => timers.delete(id));
    const flush = async () => {
      for (let i = 0; i < 20; i += 1) await Promise.resolve();
    };
    const advance = async (duration) => {
      const target = now + duration;
      await flush();
      while (true) {
        const entry = [...timers.entries()]
          .filter(([, timer]) => timer.at <= target)
          .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!entry) break;
        const [id, timer] = entry;
        now = timer.at;
        timers.delete(id);
        timer.callback();
        await flush();
      }
      now = target;
      await flush();
    };
    const server = Object.assign(new EventEmitter(), { exitCode: null, signalCode: null });
    const requests = [];
    const active = new Set();
    const cancelledBodies = [];
    const reports = [];
    t.mock.method(globalThis, 'fetch', (_url, { signal }) => {
      const reply = replies[Math.min(requests.length, replies.length - 1)];
      const request = { signal, at: now, aborted: false };
      requests.push(request);
      active.add(request);
      return new Promise((resolve, reject) => {
        let timer;
        const cleanup = () => {
          clearTimeout(timer);
          signal.removeEventListener('abort', aborted);
          active.delete(request);
        };
        const aborted = () => {
          request.aborted = true;
          cleanup();
          reject(signal.reason);
        };
        signal.addEventListener('abort', aborted, { once: true });
        if (reply.delay !== null) {
          timer = setTimeout(() => {
            cleanup();
            if (reply.error) return reject(reply.error);
            resolve({
              ok: reply.status === 200,
              status: reply.status,
              statusText: reply.status === 200 ? 'OK' : 'Service Unavailable',
              body: {
                cancel: async () => {
                  cancelledBodies.push(reply.status);
                  if (reply.hangingBody) await new Promise(() => {});
                },
              },
            });
          }, reply.delay);
        }
      });
    });
    const run = (timeoutMs = 120_000) =>
      waitForServerReadiness('http://documentation.test/ready/', {
        timeoutMs,
        server,
        readOutput: () => 'current server output',
        report: (message) => reports.push(message),
      }).then(
        () => 'ready',
        (error) => error
      );
    const assertClean = () => {
      assert.equal(timers.size, 0, 'no deadline, transport, or retry timer remains');
      assert.equal(active.size, 0, 'no active simulated request remains');
      assert.equal(server.listenerCount('exit'), 0);
      assert.equal(server.listenerCount('error'), 0);
      for (const { signal } of requests) assert.equal(getEventListeners(signal, 'abort').length, 0);
    };
    return { advance, server, requests, cancelledBodies, reports, run, assertClean };
  }

  for (const timeoutMs of [120_000, 180_000]) {
    it(`accepts a 3.6s HTTP 200 within the unchanged ${timeoutMs}ms budget`, async (t) => {
      const f = fixture(t, [{ delay: 3_600, status: 200 }]);
      const result = f.run(timeoutMs);
      await f.advance(3_600);
      assert.equal(await result, 'ready');
      assert.equal(f.requests.length, 1);
      assert.deepEqual(f.cancelledBodies, [200]);
      assert.match(f.reports[0], /attempt=1 requestMs=3600 totalMs=3600 HTTP 200 OK/);
      f.assertClean();
    });

    it(`aborts a hanging request at exactly ${timeoutMs}ms without more requests`, async (t) => {
      const f = fixture(t, [{ delay: null }]);
      let outcome;
      const result = f.run(timeoutMs).then((value) => {
        outcome = value;
        return value;
      });
      await f.advance(timeoutMs - 1);
      assert.equal(outcome, undefined);
      await f.advance(1);
      assert.match((await result).message, /Last readiness result: TimeoutError/);
      assert.equal(f.requests[0].aborted, true);
      assert.match(f.reports[0], new RegExp(`requestMs=${timeoutMs} totalMs=${timeoutMs}`));
      f.assertClean();
      await f.advance(timeoutMs);
      assert.equal(f.requests.length, 1);
    });
  }

  it('records a slow HTTP 503 and retries without resetting the total budget', async (t) => {
    const f = fixture(t, [
      { delay: 3_600, status: 503 },
      { delay: 3_600, status: 200 },
    ]);
    const result = f.run();
    await f.advance(7_450);
    assert.equal(await result, 'ready');
    assert.deepEqual(
      f.requests.map((request) => request.at),
      [0, 3_850]
    );
    assert.deepEqual(f.cancelledBodies, [503, 200]);
    assert.match(f.reports[0], /requestMs=3600 totalMs=3600 HTTP 503 Service Unavailable/);
    assert.match(f.reports[1], /requestMs=3600 totalMs=7450 HTTP 200 OK/);
    f.assertClean();
  });

  it('bounds the final retry delay and retains the last slow HTTP status', async (t) => {
    const f = fixture(t, [{ delay: 119_950, status: 503 }]);
    const result = f.run();
    await f.advance(120_000);
    assert.match((await result).message, /HTTP 503 Service Unavailable/);
    assert.equal(f.requests.length, 1);
    assert.match(f.reports[0], /requestMs=119950 totalMs=119950 HTTP 503/);
    f.assertClean();
  });

  it('bounds repeated HTTP failures and starts no request after the deadline', async (t) => {
    const f = fixture(t, [{ delay: 0, status: 503 }]);
    const result = f.run();
    await f.advance(120_000);
    assert.match((await result).message, /HTTP 503 Service Unavailable/);
    assert.equal(f.requests.length, 480);
    assert.equal(f.reports.length, 480);
    assert.equal(f.requests.at(-1).at, 119_750);
    f.assertClean();
    await f.advance(120_000);
    assert.equal(f.requests.length, 480);
  });

  it('gives a retried hanging request only the remaining total time', async (t) => {
    const f = fixture(t, [{ delay: 119_000, status: 503 }, { delay: null }]);
    const result = f.run();
    await f.advance(120_000);
    assert.match((await result).message, /TimeoutError/);
    assert.equal(f.requests.length, 2);
    assert.equal(f.requests[1].aborted, true);
    assert.match(f.reports[1], /requestMs=750 totalMs=120000 TimeoutError/);
    f.assertClean();
  });

  it('does not accept a response arriving at the total deadline', async (t) => {
    const f = fixture(t, [{ delay: 120_000, status: 200 }]);
    const result = f.run();
    await f.advance(120_000);
    assert.match((await result).message, /Timed out waiting/);
    assert.equal(f.requests[0].aborted, true);
    assert.deepEqual(f.cancelledBodies, []);
    f.assertClean();
  });

  it('bounds a stalled response-body release instead of reporting readiness', async (t) => {
    const f = fixture(t, [{ delay: 3_600, status: 200, hangingBody: true }]);
    const result = f.run();
    await f.advance(120_000);
    assert.match((await result).message, /TimeoutError/);
    assert.deepEqual(f.cancelledBodies, [200]);
    f.assertClean();
  });

  for (const [code, signal] of [
    [1, null],
    [null, 'SIGKILL'],
    [0, null],
  ]) {
    it(`aborts pending readiness immediately on child exit ${code}/${signal}`, async (t) => {
      const f = fixture(t, [{ delay: null }]);
      const result = f.run();
      await f.advance(100);
      f.server.emit('exit', code, signal);
      await f.advance(0);
      assert.match((await result).message, /Documentation dev server exited early/);
      assert.match((await result).message, /current server output/);
      assert.equal(f.requests[0].aborted, true);
      assert.match(f.reports[0], /requestMs=100 totalMs=100/);
      f.assertClean();
    });
  }

  it('rejects an already exited child without opening a request', async (t) => {
    const f = fixture(t, [{ delay: null }]);
    f.server.exitCode = 1;
    assert.match((await f.run()).message, /exitCode=1/);
    assert.equal(f.requests.length, 0);
    f.assertClean();
  });

  it('aborts and cleans listeners on a child error during a retry delay', async (t) => {
    const f = fixture(t, [{ delay: 100, status: 503 }]);
    const result = f.run();
    await f.advance(150);
    f.server.emit('error', new Error('spawn failure'));
    await f.advance(0);
    assert.match((await result).message, /spawn failure/);
    assert.equal(f.requests.length, 1);
    f.assertClean();
  });

  it('keeps transport error causes in timed attempt diagnostics', async (t) => {
    const failure = new TypeError('fetch failed', { cause: new Error('ECONNREFUSED') });
    const f = fixture(t, [{ delay: 100, error: failure }]);
    const result = f.run(200);
    await f.advance(200);
    assert.match((await result).message, /TypeError: fetch failed; cause=Error: ECONNREFUSED/);
    assert.match(f.reports[0], /requestMs=100 totalMs=100 TypeError: fetch failed/);
    f.assertClean();
  });
});

describe('native navigation observation contracts (no browser or server)', () => {
  const browserSource = readFileSync(
    'apps/www/src/content/docs/zh-cn/site-native-links.browser.test.ts',
    'utf8'
  );
  const ast = ts.createSourceFile(
    'site-native-links.browser.test.ts',
    browserSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const arrows = [];
  const visit = (node) => {
    if (ts.isArrowFunction(node)) arrows.push(node);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  const expression = (node) =>
    ts.transpileModule(`(${node.getText(ast)})`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;

  it('accepts false aria-current values without treating the current page as inactive', async () => {
    const { Window } = await import('happy-dom');
    const window = new Window();
    try {
      window.document.body.innerHTML =
        '<a data-site-link-enhanced aria-current="page"></a><a data-site-link-enhanced aria-current="false"></a><a data-site-link-enhanced></a>';
      const selector = 'a[data-site-link-enhanced]:not([aria-current="page"])';
      assert.equal(window.document.querySelectorAll(selector).length, 2);
      assert.equal(window.document.querySelector(selector).getAttribute('aria-current'), 'false');
      assert.equal(
        (browserSource.match(/:not\(\[aria-current="page"\]\):visible/g) ?? []).length,
        3
      );
      assert.doesNotMatch(browserSource, /:not\(\[aria-current\]\)/);
    } finally {
      window.happyDOM.abort();
    }
  });

  it('redacts URL-bearing errors at all CSSOM fixture diagnostic exits while preserving the failure', async () => {
    let diagnosticCatch;
    const findCatch = (node) => {
      if (
        ts.isCatchClause(node) &&
        node.getText(ast).includes('CSSOM fixture diagnostic capture failed')
      )
        diagnosticCatch = node;
      ts.forEachChild(node, findCatch);
    };
    findCatch(ast);
    assert.ok(diagnosticCatch);
    const baseUrl = 'http://127.0.0.1:4321';
    for (const url of [
      `${baseUrl}/docs/?token=secret#fragment`,
      'http://username:password@127.0.0.1:4321/docs/?token=secret#fragment',
      'ws://127.0.0.1:4321/socket?token=secret#fragment',
      'https://outside.invalid/?token=secret#fragment',
    ]) {
      const original = new Error(`navigation failed ${url}`);
      const diagnosticError = new Error(`diagnostic failed ${url}`);
      const captureError = new Error(`capture failed ${url}`);
      const logs = [];
      let evidence;
      const capture = runInNewContext(
        ts.transpileModule(`(async (error) => ${diagnosticCatch.block.getText(ast)})`, {
          compilerOptions: { target: ts.ScriptTarget.ES2022 },
        }).outputText,
        {
          baseUrl,
          safeError,
          phase: 'precondition',
          page: { evaluate: () => Promise.reject(diagnosticError) },
          captureLinks: async (...args) => {
            evidence = args[5];
            throw captureError;
          },
          console: { error: (...args) => logs.push(args) },
        }
      );
      await assert.rejects(capture(original), (error) => error === original);
      assert.equal(evidence.error, safeError(original, baseUrl));
      assert.equal(evidence.sidebar.diagnosticError, safeError(diagnosticError, baseUrl));
      assert.equal(logs[0][1], safeError(captureError, baseUrl));
      assert.doesNotMatch(
        JSON.stringify({ evidence, logs }),
        /secret|fragment|username|password|token=/
      );
    }
  });

  it('redacts captured page URLs through the shared URL sanitizer', async () => {
    const captureFunction = ast.statements.find(
      (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'captureLinks'
    );
    assert.ok(captureFunction);
    const baseUrl = 'http://127.0.0.1:4321';
    for (const url of [
      `${baseUrl}/docs/?token=secret#fragment`,
      'http://username:password@127.0.0.1:4321/docs/?token=secret#fragment',
      'ws://127.0.0.1:4321/socket?token=secret',
      'https://outside.invalid/?token=secret',
    ]) {
      let evidence;
      const capture = runInNewContext(expression(captureFunction), {
        baseUrl,
        safeUrl,
        path,
        evidenceDirectory: '/tmp/fixture-evidence',
        evidenceSource: {},
        mkdir: async () => {},
        writeFile: async (_file, contents) => {
          evidence = JSON.parse(contents);
        },
      });
      await capture(
        {
          screenshot: async () => {},
          evaluate: async () => ({}),
          url: () => url,
          viewportSize: () => ({}),
        },
        'case',
        'shadcn',
        'wc',
        'failed'
      );
      assert.equal(evidence.url, safeUrl(url, baseUrl));
      assert.doesNotMatch(evidence.url, /secret|fragment|username|password|token=/);
    }
  });

  const focusPoll = arrows.find((node) => {
    const value = node.getText(ast);
    return (
      value.includes('const observed = await read()') &&
      value.includes('observed.focused &&') &&
      !value.includes('const baseline =')
    );
  });
  const baseline = {
    focused: false,
    visible: true,
    outline: 'black solid 2px',
    shadow: '2px 2px black',
  };
  for (const [label, sample, expected] of [
    ['unchanged current-link outline and hard shadow', { ...baseline, focused: true }, false],
    [
      'paint changed without native keyboard focus',
      { ...baseline, outline: 'white solid 3px' },
      false,
    ],
    [
      'focused paint is obscured',
      { ...baseline, focused: true, visible: false, outline: 'white solid 3px' },
      false,
    ],
    [
      'actual visible focused paint changed',
      { ...baseline, focused: true, outline: 'white solid 3px' },
      true,
    ],
  ]) {
    it(`actual focus poll ${expected ? 'accepts' : 'rejects'} ${label}`, async () => {
      assert.ok(
        focusPoll,
        'the actual browser poll retains focus, hit visibility, and paint delta'
      );
      const check = runInNewContext(expression(focusPoll), { baseline, read: async () => sample });
      assert.equal(await check(), expected);
    });
  }

  it('captures failed no-JS paint and exact homepage hit nodes before losing the evidence', () => {
    assert.match(browserSource, /focusPassed \? '' : '-failure'/);
    assert.match(
      browserSource,
      /finally \{\s*await captureLinks\([\s\S]*?observed: await read\(\)/
    );
    assert.match(browserSource, /document\.elementsFromPoint\(x, y\)\.slice\(0, 6\)/);
    assert.match(browserSource, /centerHitIsAnchor: centerHit\.isAnchor/);
    assert.match(browserSource, /cornerHitIsAnchor: cornerHit\.isAnchor/);
    assert.ok(
      browserSource.indexOf('`homepage-${family}-${runtime}-native-hit-targets`') <
        browserSource.indexOf('nativeLinkEvidenceIssues(footprint, footprint.expected)')
    );
  });

  it('uses an actual visible pointer point without locator-triggered ancestor scrolling', () => {
    const pointer = arrows.find(
      (node) =>
        node
          .getText(ast)
          .includes("throw new Error('Current article has no visible pointer target')") &&
        !node.getText(ast).includes('await current.evaluate')
    );
    assert.ok(pointer);
    const link = {
      outerHTML: '<a aria-current="page">Current article</a>',
      getBoundingClientRect: () => ({ left: 80, right: 310, top: 857, bottom: 901 }),
    };
    const check = runInNewContext(expression(pointer), {
      innerWidth: 1440,
      innerHeight: 900,
      document: { elementFromPoint: () => link },
    });
    const point = check(link);
    assert.equal(point.hitIsCurrent, true);
    assert.equal(point.y, 878.5);
    assert.ok(point.y < 900);
    assert.doesNotMatch(browserSource, /await current\.hover\(\)/);
    assert.match(browserSource, /await page\.mouse\.move\(pointer\.x, pointer\.y\)/);
  });

  it('retains exact document and sidebar ownership deltas from an initial zero scroll', () => {
    assert.match(browserSource, /expect\(\(await facts\(\)\)\.documentY\)\.toBe\(0\)/);
    for (const [before, after] of [
      ['before', 'beforeWheel'],
      ['beforeWheel', 'manuallyScrolled'],
      ['manuallyScrolled', 'afterMutation'],
    ]) {
      assert.match(
        browserSource,
        new RegExp(
          `expect\\(\\s*${after}\\.documentY,[\\s\\S]*?\\)\\.toBe\\(\\s*${before}\\.documentY\\s*\\)`
        )
      );
    }
    assert.match(
      browserSource,
      /expect\(\s*afterMutation\.scrollTop,[\s\S]*?\.toBe\(\s*manuallyScrolled\.scrollTop\s*\)/
    );
    assert.match(browserSource, /ownerBottom: box\.bottom/);
    assert.match(browserSource, /documentViewportHeight: innerHeight/);
  });

  it('desktop sidebar height compensates its actual sticky top offset', () => {
    const frame = readFileSync('apps/www/src/components/override/PageFrame.astro', 'utf8');
    const desktop = frame.slice(frame.indexOf('@media (min-width: 64rem)'));
    const topExtra = Number(
      desktop.match(/top:\s*calc\(var\(--header-height\)\s*\+\s*(\d+)px\)/)?.[1]
    );
    const height = desktop.match(
      /height:\s*calc\(100svh\s*-\s*var\(--header-height\)(?:\s*-\s*(\d+)px)?\)/
    );
    assert.ok(height, 'height must remain viewport-relative');
    const heightExtra = Number(height[1] ?? 0);
    for (const viewport of [900, 1000])
      for (const header of [64, 104, 112]) {
        const bottom = header + topExtra + (viewport - header - heightExtra);
        assert.equal(
          bottom,
          viewport,
          'source-derived sidebar bottom must equal the real viewport bottom'
        );
      }
  });

  it('Brutalist current no-JS links have an explicit distinct focus ring only in the fallback owner', () => {
    const css = readFileSync('apps/www/src/styles/site-library-family.css', 'utf8');
    const focus = css.match(
      /\[data-site-library-family='brutalist'\]\s*\.sidebar-pane\s*\.top-level\s*a:not\(\[data-site-link-enhanced\]\)\[aria-current='page'\]:focus-visible\s*\{([^}]+)\}/
    );
    assert.ok(focus, 'unlayered current decoration needs an equally owned focus-visible rule');
    assert.match(focus[1], /outline:\s*3px solid var\(--site-brutalist-ring\)/);
    assert.match(focus[1], /outline-offset:\s*2px/);
    assert.doesNotMatch(focus[1], /background|box-shadow/);
  });
});

describe('native navigation precondition evidence', () => {
  const source = readFileSync(
    'apps/www/src/content/docs/zh-cn/site-native-links.browser.test.ts',
    'utf8'
  );
  it('uses a real Brutalist document with substantive headings for TOC journeys', () => {
    const tocJourneys = source.slice(source.indexOf("it('renders docs navigation through"));
    assert.equal(
      (tocJourneys.match(/\/zh-cn\/ui-libraries\/brutalist\/components\/textarea\//g) ?? []).length,
      4
    );
    const document = readFileSync(
      'apps/www/src/content/docs/zh-cn/ui-libraries/brutalist/components/textarea.mdx',
      'utf8'
    );
    assert.ok((document.match(/^## /gm) ?? []).length >= 2);
    const button = readFileSync(
      'apps/www/src/content/docs/zh-cn/ui-libraries/brutalist/components/button.mdx',
      'utf8'
    );
    assert.equal(
      (button.match(/^## /gm) ?? []).length,
      0,
      'Retain why the old nth(1) fixture was invalid'
    );
    assert.match(
      source,
      /const toc = page\.locator\('sl-toc a\[data-site-link-appearance="toc"\]'\)\.nth\(1\)/
    );
  });
  it('waits for the actual option portal to close and propagates a stuck closing surface', async () => {
    const parsed = ts.createSourceFile('native.ts', source, ts.ScriptTarget.Latest, true);
    const helper = parsed.statements.find(
      (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'choose'
    );
    assert.ok(helper);
    const headerSource = readFileSync(
      new URL('../../apps/www/src/content/docs/zh-cn/site-header-browser.ts', import.meta.url),
      'utf8'
    );
    const headerParsed = ts.createSourceFile(
      'header.ts',
      headerSource,
      ts.ScriptTarget.Latest,
      true
    );
    const headerHelpers = headerParsed.statements.filter(
      (node) =>
        ts.isFunctionDeclaration(node) &&
        ['hasCommittedHeaderPreferencesDock', 'revealHeaderPreferences'].includes(node.name?.text)
    );
    assert.equal(headerHelpers.length, 2);
    const context = { result: undefined };
    runInNewContext(
      ts.transpileModule(
        `${headerHelpers.map((node) => node.getText(headerParsed).replace(/^export /, '')).join('; ')}; ${helper.getText(parsed)}; result = choose;`,
        {
          compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
        }
      ).outputText,
      context
    );
    for (const [compact, stuck] of [
      [false, false],
      [false, true],
      [true, false],
      [true, true],
    ]) {
      const order = [];
      const portal = {
        getByRole(role, options) {
          assert.equal(role, 'option');
          assert.equal(options.name, 'Web Components');
          return {
            click: async () => {
              order.push('select-current');
            },
          };
        },
        async waitFor(options) {
          assert.equal(options.state, 'hidden');
          order.push('actual-portal-hidden');
          if (stuck) throw new Error('closing surface remained visible');
        },
      };
      const trigger = {
        click: async () => {
          order.push('open');
        },
        getAttribute: async (name) => {
          assert.equal(name, 'aria-controls');
          return 'runtime-options';
        },
      };
      const preferences = {
        count: async () => (compact ? 1 : 0),
        isVisible: async () => false,
        async waitFor(options) {
          assert.equal(options.state, 'visible');
          order.push('preferences-visible');
        },
      };
      const menu = {
        getAttribute: async () => 'false',
        click: async () => {
          order.push('open-menu');
        },
      };
      const page = {
        async waitForFunction(predicate) {
          assert.equal(predicate.name, 'hasCommittedHeaderPreferencesDock');
          order.push('preferences-docked');
        },
        locator(selector) {
          if (selector === '[data-site-header] [data-site-header-preferences]') return preferences;
          if (selector.includes('home-menu')) return menu;
          return selector.startsWith('[id=') ? portal : trigger;
        },
      };
      const result = context.result(page, 'runtime-owner', 'Web Components');
      if (stuck) await assert.rejects(result, /closing surface remained visible/);
      else await result;
      assert.deepEqual(order, [
        ...(compact ? ['preferences-docked', 'open-menu', 'preferences-visible'] : []),
        'open',
        'select-current',
        'actual-portal-hidden',
      ]);
    }
  });
});

describe('bounded CI runtime shards (no browser or server)', () => {
  const sha = 'a'.repeat(40);
  const needs = Object.fromEntries(
    ['test-plan', 'test-general', 'test-browser'].map((job) => [job, { result: 'success' }])
  );
  const plan = createCiPlan(sha);
  const selections = [
    runtimeSelection('general', undefined, plan),
    ...plan.browser.map((_, index) =>
      runtimeSelection('browser', `${index + 1}/${BROWSER_SHARD_COUNT}`, plan)
    ),
  ];
  const report = (selection) => ({
    success: true,
    numFailedTests: 0,
    numFailedTestSuites: 0,
    numPassedTests: selection.suites.length,
    testResults: selection.suites.map((suite) => ({
      name: path.join(runtimeRoot, suite),
      status: 'passed',
      assertionResults: [{ status: 'passed', fullName: 'simulated gate control' }],
    })),
  });
  const receipts = () =>
    selections.map((selection) => ({ ...selection, report: report(selection) }));
  it('keeps all development suites exactly once in deterministic nonempty bounded shards', () => {
    const shards = browserShards();
    assert.equal(shards.length, BROWSER_SHARD_COUNT);
    assert.deepEqual(shards.flat().sort(), [...BROWSER_SUITES].sort());
    assert.deepEqual(shards, browserShards([...BROWSER_SUITES].reverse()));
    assert.ok(
      shards.every(
        (suites) =>
          suites.length > 0 &&
          suites.length <= Math.ceil(BROWSER_SUITES.length / BROWSER_SHARD_COUNT)
      )
    );
    for (let index = 0; index < shards.length; index += 1) {
      const [browser] = createRuntimeTestPlan([], {
        phase: 'browser',
        shard: `${index + 1}/${shards.length}`,
      });
      assert.equal(browser.needsServer, true);
      assert.deepEqual(browser.args, ['--no-file-parallelism', ...shards[index]]);
    }
    assert.deepEqual(createRuntimeTestPlan([], { phase: 'general' }), [
      createRuntimeTestPlan([])[0],
    ]);
  });
  it('rejects newly discovered unregistered files, stale entries and duplicate ownership', () => {
    const inventory = [...BROWSER_SUITES, ...PRODUCTION_BROWSER_SUITES];
    assert.throws(
      () =>
        assertBrowserInventory([
          ...inventory,
          'apps/www/test/pending-code-surface.browser.test.ts',
        ]),
      /unregistered/
    );
    assert.throws(() => assertBrowserInventory(inventory.slice(1)), /missing=/);
    assert.throws(
      () => assertBrowserInventory(inventory, [...BROWSER_SUITES, BROWSER_SUITES[0]]),
      /Duplicate/
    );
    assert.throws(
      () =>
        assertBrowserInventory(inventory, BROWSER_SUITES, [
          ...PRODUCTION_BROWSER_SUITES,
          BROWSER_SUITES[0],
        ]),
      /Duplicate/
    );
    const added = 'apps/www/test/pending-code-surface.browser.test.ts';
    assert.doesNotThrow(() =>
      assertBrowserInventory([...inventory, added], [...BROWSER_SUITES, added])
    );
    assert.equal(
      browserShards([...BROWSER_SUITES, added])
        .flat()
        .filter((suite) => suite === added).length,
      1
    );
  });
  it('rejects empty shards, unknown phases, ambiguous filters and invalid shard selections', () => {
    for (const shard of [undefined, '', '0/8', '9/8', '1/7', '1/99', 'x/8'])
      assert.throws(() => selectBrowserShard(shard), /Expected browser shard/);
    assert.throws(() => browserShards([], 8), /nonempty/);
    assert.throws(() => browserShards(['same', 'same'], 2), /unique/);
    assert.throws(() => createRuntimeTestPlan([], { phase: 'typo' }), /Unknown/);
    assert.throws(() => createRuntimeTestPlan([], { phase: 'general', shard: '1/8' }), /requires/);
    assert.throws(
      () => createRuntimeTestPlan(['some-filter'], { phase: 'general' }),
      /cannot be combined/
    );
  });
  it('accepts complete simulated receipts and retains explicitly authored general todo coverage', () => {
    assert.doesNotThrow(() => assertRuntimeGate(needs, plan, receipts(), sha));
    const general = report(selections[0]);
    general.testResults[0].assertionResults.push({ status: 'todo' });
    assert.doesNotThrow(() => assertVitestReport(general, selections[0]));
  });
  for (const state of ['failure', 'cancelled', 'skipped', '']) {
    for (const job of Object.keys(needs))
      it(`rejects ${state || 'unknown'} ${job} even with complete receipts`, () => {
        assert.throws(
          () => assertRuntimeGate({ ...needs, [job]: { result: state } }, plan, receipts(), sha),
          /did not succeed/
        );
      });
  }
  it('rejects missing jobs, receipts, duplicate receipts and checkout drift', () => {
    const { 'test-browser': omitted, ...missing } = needs;
    assert.throws(() => assertRuntimeGate(missing, plan, receipts(), sha));
    assert.throws(
      () => assertRuntimeGate(needs, plan, receipts().slice(1), sha),
      /exactly one receipt/
    );
    const duplicate = receipts();
    duplicate[2] = duplicate[1];
    assert.throws(() => assertRuntimeGate(needs, plan, duplicate, sha), /Missing\/duplicate/);
    const stale = receipts();
    stale[1].checkoutSha = 'b'.repeat(40);
    assert.throws(() => assertRuntimeGate(needs, plan, stale, sha), /checkout SHA/);
    assert.throws(
      () => assertRuntimeGate(needs, plan, receipts(), 'b'.repeat(40)),
      /gate checkout/
    );
  });
  for (const [label, mutate] of [
    [
      'empty job',
      (r) => {
        r.numPassedTests = 0;
        r.testResults = [];
      },
    ],
    [
      'missing suite',
      (r) => {
        r.testResults.pop();
      },
    ],
    [
      'duplicate suite',
      (r) => {
        r.testResults[1] = r.testResults[0];
      },
    ],
    [
      'empty suite',
      (r) => {
        r.testResults[0].assertionResults = [];
      },
    ],
    [
      'failed suite',
      (r) => {
        r.testResults[0].status = 'failed';
      },
    ],
    [
      'failed test',
      (r) => {
        r.numFailedTests = 1;
      },
    ],
    [
      'skipped test',
      (r) => {
        r.testResults[0].assertionResults[0].status = 'skipped';
      },
    ],
    [
      'todo browser test',
      (r) => {
        r.testResults[0].assertionResults[0].status = 'todo';
      },
    ],
    [
      'cancelled assertion',
      (r) => {
        r.testResults[0].assertionResults[0].status = 'cancelled';
      },
    ],
    [
      'false success',
      (r) => {
        r.success = false;
      },
    ],
    [
      'false count',
      (r) => {
        r.numPassedTests += 1;
      },
    ],
  ])
    it(`rejects a ${label} in an otherwise successful matrix job`, () => {
      const actual = receipts();
      mutate(actual[1].report);
      assert.throws(() => assertRuntimeGate(needs, plan, actual, sha));
    });
  it('keeps production Search outside every general/dev selection and fails altered plans', () => {
    for (const suite of PRODUCTION_BROWSER_SUITES) {
      assert.ok(!selections.some((selection) => selection.suites.includes(suite)));
      assert.ok(readFileSync(PRODUCTION_BROWSER_OWNERS[suite], 'utf8').includes(suite));
    }
    const changed = structuredClone(plan);
    changed.browser[0].pop();
    assert.throws(
      () => assertRuntimeGate(needs, changed, receipts(), sha),
      /complete current inventory/
    );
  });
  it('bounds real font setup without relaxing browser execution or failure gates', () => {
    const { jobs } = YAML.parse(readFileSync('.github/workflows/ci.yml', 'utf8'));
    const browser = jobs['test-browser'];
    assert.equal(browser['timeout-minutes'], 20);
    assert.equal(browser['continue-on-error'], undefined);
    const fontSteps = browser.steps.filter(
      (step) => step.name === 'Install real CJK fallback for typography glyph evidence'
    );
    assert.equal(fontSteps.length, 1);
    // Exact commands exclude a fake fallback, conditional skip or swallowed apt failure.
    assert.deepEqual(fontSteps[0], {
      name: 'Install real CJK fallback for typography glyph evidence',
      'timeout-minutes': 3,
      run: [
        'sudo apt-get update -qq',
        'sudo apt-get install -y --no-install-recommends fonts-noto-cjk',
        '',
      ].join('\n'),
    });
    const run = browser.steps.find(
      (step) => step.name === 'Run the bounded shard with its own documentation server'
    );
    assert.ok(run);
    assert.ok(browser.steps.indexOf(fontSteps[0]) < browser.steps.indexOf(run));
    assert.equal(run.if, undefined);
    assert.equal(run['continue-on-error'], undefined);
    assert.match(run.run, /^set -euo pipefail$/m);
    assert.match(
      run.run,
      /^timeout --signal=TERM --kill-after=10s 900s \\\n  node scripts\/test\/run-runtime-tests\.mjs 2>&1 \| tee /m
    );
    assert.equal(jobs.test['continue-on-error'], undefined);
  });
  it('wires every required CI job into the existing fail-closed test gate', () => {
    const { jobs } = YAML.parse(readFileSync('.github/workflows/ci.yml', 'utf8'));
    assert.deepEqual(jobs.test.needs, ['test-plan', 'test-general', 'test-browser']);
    assert.equal(jobs.test.if, 'always()');
    assert.equal(jobs['test-browser'].strategy['fail-fast'], false);
    assert.equal(jobs['test-browser'].strategy['max-parallel'], BROWSER_SHARD_COUNT);
    assert.equal(
      jobs['test-browser'].strategy.matrix,
      '${{ fromJSON(needs.test-plan.outputs.matrix) }}'
    );
    assert.equal(jobs['test-general'].env.PROTO_UI_RUNTIME_PHASE, 'general');
    assert.equal(jobs['test-browser'].env.PROTO_UI_RUNTIME_PHASE, 'browser');
    for (const name of ['test-general', 'test-browser']) {
      assert.ok(jobs[name].steps.some((step) => step.uses === 'actions/checkout@v4'));
      const upload = jobs[name].steps.find((step) => step.uses === 'actions/upload-artifact@v4');
      assert.equal(upload.if, 'always()');
      assert.equal(upload.with['if-no-files-found'], 'error');
      assert.ok(jobs[name].steps.some((step) => step.run?.includes('git rev-parse HEAD')));
    }
    assert.ok(jobs['test-general'].steps.some((step) => step.run?.includes('-s test\n')));
    assert.ok(
      jobs['test-browser'].steps.some((step) =>
        step.run?.includes('timeout --signal=TERM --kill-after=10s 900s')
      )
    );
    assert.ok(
      jobs.test.steps.some(
        (step) =>
          step.run?.includes('runtime-ci.mjs gate') &&
          step.env?.RUNTIME_CI_NEEDS === '${{ toJSON(needs) }}'
      )
    );
    assert.ok(
      !JSON.stringify(jobs['test-browser']).includes('site-search-production.browser.test.ts')
    );
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    assert.ok(packageJson.scripts.test.endsWith('-s test:runtime'));
    assert.ok(
      packageJson.scripts['test:runtime'].endsWith('node scripts/test/run-runtime-tests.mjs')
    );
  });
});

describe('CI partial-rerun receipt protocol (no browser or server)', () => {
  const sha = 'a'.repeat(40);
  const context = { runId: '123456', attempt: 2, eventSha: sha, checkoutSha: sha };
  const needs = Object.fromEntries(
    ['test-plan', 'test-general', 'test-browser'].map((job) => [job, { result: 'success' }])
  );
  const complete = (binding = context, attempt = 1) => {
    const plan = createCiPlan(binding.checkoutSha);
    return runtimeSlots.map((slot, index) => {
      const selection =
        index === 0
          ? null
          : index === 1
            ? runtimeSelection('general', undefined, plan)
            : runtimeSelection('browser', `${index - 1}/${BROWSER_SHARD_COUNT}`, plan);
      const payload = selection
        ? {
            ...selection,
            report: {
              success: true,
              numFailedTests: 0,
              numFailedTestSuites: 0,
              numPassedTests: selection.suites.length,
              testResults: selection.suites.map((suite) => ({
                name: path.join(runtimeRoot, suite),
                status: 'passed',
                assertionResults: [
                  { status: 'passed', fullName: 'simulated rerun control, not browser evidence' },
                ],
              })),
            },
          }
        : plan;
      const receipt = { schemaVersion: 1, ...binding, attempt, slot, outcome: 'success', payload };
      return { name: artifactName(receipt), receipt };
    });
  };
  it('accepts an aggregate-only rerun with all original successful slots', () => {
    assert.doesNotThrow(() => assertCiGate(needs, complete(), context));
  });
  it('accepts only the failed shard rerunning while plan/general/other shards stay at attempt one', () => {
    const artifacts = complete();
    artifacts[2].receipt.outcome = 'failure';
    artifacts[2].receipt.payload = null;
    artifacts.push(complete(context, 2)[2]);
    assert.doesNotThrow(() => assertCiGate(needs, artifacts, context));
  });
  for (const outcome of ['failure', 'cancelled', 'skipped']) {
    it(`never falls back to earlier success after a later ${outcome}`, () => {
      const artifacts = complete();
      const later = complete(context, 2)[2];
      later.receipt.outcome = outcome;
      artifacts.push(later);
      assert.throws(() => assertCiGate(needs, artifacts, context), /Latest .* did not succeed/);
    });
    it(`blocks a hard ${outcome} without a new artifact through current needs`, () => {
      assert.throws(
        () => assertCiGate({ ...needs, 'test-browser': { result: outcome } }, complete(), context),
        /Required job/
      );
    });
  }
  it('rejects a later successful slot with no report instead of accepting its older report', () => {
    const artifacts = complete();
    const later = complete(context, 2)[2];
    later.receipt.payload = null;
    artifacts.push(later);
    assert.throws(() => assertCiGate(needs, artifacts, context), /no completed evidence/);
  });
  for (const [label, mutate] of [
    [
      'wrong run',
      (r) => {
        r.runId = '999';
      },
    ],
    [
      'wrong event SHA',
      (r) => {
        r.eventSha = 'b'.repeat(40);
      },
    ],
    [
      'wrong checkout SHA',
      (r) => {
        r.checkoutSha = 'b'.repeat(40);
      },
    ],
    [
      'future attempt',
      (r) => {
        r.attempt = 3;
      },
    ],
    [
      'zero attempt',
      (r) => {
        r.attempt = 0;
      },
    ],
    [
      'fractional attempt',
      (r) => {
        r.attempt = 1.5;
      },
    ],
    [
      'string attempt',
      (r) => {
        r.attempt = '1';
      },
    ],
    [
      'unknown slot',
      (r) => {
        r.slot = 'browser-99-of-8';
      },
    ],
    [
      'empty slot',
      (r) => {
        r.slot = '';
      },
    ],
    [
      'schema drift',
      (r) => {
        r.schemaVersion = 2;
      },
    ],
    [
      'nonterminal outcome',
      (r) => {
        r.outcome = 'running';
      },
    ],
    [
      'slot payload swap',
      (r) => {
        r.payload.shard = '8/8';
      },
    ],
  ])
    it(`rejects ${label}`, () => {
      const artifacts = complete();
      mutate(artifacts[2].receipt);
      assert.throws(() => assertCiGate(needs, artifacts, context));
    });
  it('rejects duplicate same-attempt slots, missing slots, artifact-name drift and plan drift', () => {
    const artifacts = complete();
    assert.throws(
      () => assertCiGate(needs, [...artifacts, artifacts[2]], context),
      /Duplicate slot\/attempt/
    );
    assert.throws(() => assertCiGate(needs, artifacts.slice(1), context), /Missing logical slot/);
    artifacts[2].name += '-unexpected';
    assert.throws(() => assertCiGate(needs, artifacts, context), /Artifact name/);
    const planDrift = complete();
    const later = complete(context, 2)[0];
    later.receipt.payload.browser[0].pop();
    planDrift.push(later);
    assert.throws(() => assertCiGate(needs, planDrift, context), /complete current inventory/);
  });
  it('requires real checkout HEAD to equal event SHA rather than merely agreeing receipts', () => {
    const env = { GITHUB_RUN_ID: '123456', GITHUB_RUN_ATTEMPT: '2', GITHUB_SHA: sha };
    assert.deepEqual(ciContext(env, sha), context);
    assert.throws(() => ciContext(env, 'b'.repeat(40)), /Actual checkout HEAD/);
    for (const key of Object.keys(env)) assert.throws(() => ciContext({ ...env, [key]: '' }, sha));
  });
  it('exercises actual plan, always-finalizer and aggregate CLIs across reruns and rejects corrupt artifacts', (t) => {
    const directory = mkdtempSync(path.join(tmpdir(), 'runtime-ci-cli-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const actual = { ...context, eventSha: checkoutSha(), checkoutSha: checkoutSha() };
    const env = {
      ...process.env,
      GITHUB_RUN_ID: actual.runId,
      GITHUB_RUN_ATTEMPT: '2',
      GITHUB_SHA: actual.eventSha,
      RUNTIME_CI_NEEDS: JSON.stringify(needs),
    };
    const run = (command, dir, extra = {}, status = 0) => {
      const result = spawnSync(process.execPath, ['scripts/test/runtime-ci.mjs', command, dir], {
        cwd: runtimeRoot,
        env: { ...env, ...extra },
        encoding: 'utf8',
      });
      assert.equal(result.status, status, `${command}: ${result.stdout} ${result.stderr}`);
      return result;
    };
    const materialize = (artifacts) => {
      const dir = mkdtempSync(path.join(directory, 'artifacts-'));
      for (const { name, receipt } of artifacts)
        writeJson(path.join(dir, name, 'receipt.json'), receipt);
      return dir;
    };
    const first = complete(actual);
    run('gate', materialize(first)); // attempt one all green; only aggregate rerun
    const repaired = complete(actual);
    repaired[2].receipt.outcome = 'failure';
    repaired[2].receipt.payload = null;
    repaired.push(complete(actual, 2)[2]);
    run('gate', materialize(repaired));
    const laterFailed = [...first, complete(actual, 2)[2]];
    laterFailed.at(-1).receipt.outcome = 'failure';
    run('gate', materialize(laterFailed), {}, 1);
    run('gate', materialize(first.slice(1)), {}, 1);
    run('gate', materialize(first), { GITHUB_SHA: 'b'.repeat(40) }, 1);
    run(
      'gate',
      materialize(first),
      { RUNTIME_CI_NEEDS: JSON.stringify({ ...needs, 'test-browser': { result: 'cancelled' } }) },
      1
    );
    const empty = materialize(first);
    mkdirSync(path.join(empty, `runtime-ci-${actual.runId}-general-attempt-2`));
    run('gate', empty, {}, 1);
    const planDir = path.join(directory, 'producer');
    run('plan', planDir, { GITHUB_OUTPUT: path.join(directory, 'output') });
    const matrix = JSON.parse(
      readFileSync(path.join(directory, 'output'), 'utf8').trim().slice('matrix='.length)
    );
    assert.equal(matrix.include.length, BROWSER_SHARD_COUNT);
    assert.equal(matrix.include[0].slot, 'browser-1-of-8');
    run('plan', path.join(directory, 'wrong-checkout'), { GITHUB_SHA: 'b'.repeat(40) }, 1);
    run('finish', planDir, { PROTO_UI_RUNTIME_SLOT: 'plan', RUNTIME_CI_OUTCOME: 'success' });
    const finished = JSON.parse(readFileSync(path.join(planDir, 'receipt.json'), 'utf8'));
    assert.equal(finished.attempt, 2);
    assert.equal(finished.checkoutSha, actual.eventSha);
    assert.equal(finished.outcome, 'success');
    const failedDir = path.join(directory, 'failed-before-vitest');
    run('finish', failedDir, {
      PROTO_UI_RUNTIME_SLOT: 'browser-1-of-8',
      RUNTIME_CI_OUTCOME: 'failure',
    });
    const failed = JSON.parse(readFileSync(path.join(failedDir, 'receipt.json'), 'utf8'));
    assert.equal(failed.payload, null);
    assert.equal(failed.outcome, 'failure');
    run(
      'finish',
      path.join(directory, 'missing-success'),
      { PROTO_UI_RUNTIME_SLOT: 'general', RUNTIME_CI_OUTCOME: 'success' },
      1
    );
  });
  it('uses same-run separated artifacts and always writes every producer outcome without token escalation', () => {
    const workflow = YAML.parse(readFileSync('.github/workflows/ci.yml', 'utf8'));
    const { jobs } = workflow;
    const download = jobs.test.steps.find((step) => step.uses === 'actions/download-artifact@v4');
    assert.equal(download.with.pattern, 'runtime-ci-${{ github.run_id }}-*');
    assert.equal(download.with['merge-multiple'], false);
    assert.equal(download.with['github-token'], undefined);
    assert.equal(workflow.permissions, undefined);
    for (const name of ['test-plan', 'test-general', 'test-browser']) {
      const finish = jobs[name].steps.find((step) => step.run?.includes('runtime-ci.mjs finish'));
      assert.equal(finish.if, 'always()');
      assert.equal(finish.env.RUNTIME_CI_OUTCOME, '${{ job.status }}');
      const upload = jobs[name].steps.find((step) => step.uses === 'actions/upload-artifact@v4');
      assert.equal(upload.if, 'always()');
      assert.equal(
        upload.with.name,
        'runtime-ci-${{ github.run_id }}-${{ env.PROTO_UI_RUNTIME_SLOT }}-attempt-${{ github.run_attempt }}'
      );
      assert.equal(jobs[name].permissions, undefined);
    }
    assert.equal(jobs['test-browser'].env.PROTO_UI_RUNTIME_SLOT, '${{ matrix.slot }}');
  });
});

// GitHub's context-availability table excludes runner from jobs.<job_id>.env.
// YAML parsing alone does not validate these platform expression boundaries.
// https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#context-availability
// This targeted source guard is not a substitute for GitHub workflow admission.
describe('CI evidence directory context availability', () => {
  for (const name of ['test-general', 'test-browser']) {
    it(`${name} resolves RUNNER_TEMP only after a runner is available`, () => {
      const job = YAML.parse(readFileSync('.github/workflows/ci.yml', 'utf8')).jobs[name];
      for (const [key, value] of Object.entries(job.env ?? {})) {
        assert.doesNotMatch(
          String(value),
          /\$\{\{[^}]*\brunner\./,
          `${name}.env.${key} cannot use runner context`
        );
      }
      assert.equal(job.env.PROTO_UI_RUNTIME_EVIDENCE_DIR, undefined);
      const run = job.steps.find((step) =>
        step.run?.includes('mkdir -p "$PROTO_UI_RUNTIME_EVIDENCE_DIR"')
      ).run;
      const declared = run.indexOf(
        'export PROTO_UI_RUNTIME_EVIDENCE_DIR="$RUNNER_TEMP/runtime-ci"'
      );
      assert.ok(
        declared >= 0,
        'Child runtime tests require an exported runner-local evidence directory'
      );
      assert.ok(declared < run.indexOf('mkdir -p "$PROTO_UI_RUNTIME_EVIDENCE_DIR"'));
      assert.ok(declared < run.indexOf('git rev-parse HEAD'));
    });
  }
});

it('the executable runtime runner parses before any test phase starts', () => {
  const result = spawnSync(
    process.execPath,
    ['--check', path.resolve('scripts/test/run-runtime-tests.mjs')],
    { encoding: 'utf8' }
  );
  assert.equal(result.status, 0, result.stderr);
});

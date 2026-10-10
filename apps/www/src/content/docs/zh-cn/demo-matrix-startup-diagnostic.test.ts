// @vitest-environment node
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { transformSync } from 'esbuild';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Page, Request, Response } from 'playwright-core';
import { startMatrixStartupDiagnostic } from './demo-matrix-startup-diagnostic';

let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'matrix-startup-'));
});
afterEach(async () => {
  vi.useRealTimers();
  await rm(directory, { recursive: true, force: true });
});
function fixture(failMethod?: string, hangMethod?: string, frameUrls?: string[]) {
  const session = {
    send: vi.fn(async (method: string) => {
      if (method === failMethod) throw new Error(`injected ${method} failure`);
      if (method === hangMethod) return new Promise<never>(() => {});
      return {
        profile: {
          nodes: frameUrls
            ? frameUrls.map((url, index) => ({
                id: index + 1,
                callFrame: { url, functionName: 'publicFixture' },
              }))
            : [
                {
                  id: 1,
                  callFrame: {
                    url: 'http://127.0.0.1:4321/src/previewer.ts?secret=omit#hash',
                    functionName: 'switchTo',
                  },
                },
                {
                  id: 2,
                  callFrame: {
                    url: 'data:text/javascript,private-source',
                    functionName: '(anonymous)',
                  },
                },
              ],
          startTime: 10,
          endTime: 20,
          samples: [1],
          timeDeltas: [10],
        },
      };
    }),
    detach: vi.fn(async () => {}),
  };
  const context = { newCDPSession: vi.fn(async () => session) };
  const page = Object.assign(new EventEmitter(), {
    context: () => context,
    evaluate: vi.fn(),
    goto: vi.fn(),
    route: vi.fn(),
    waitForFunction: vi.fn(),
  });
  return { page, session, context };
}
const options = () => ({
  enabled: true,
  directory,
  sourceSha: '0a3fac594103bf1c6fd60fa511ace2e733adb97c',
  caseName: 'mounts every demo in every official Web adapter',
  origin: 'http://127.0.0.1:4321',
  phase: () => 'committed-host-readiness',
});
function request(url: string, type = 'script', errorText: string | null = null) {
  return {
    url: () => url,
    resourceType: () => type,
    failure: () => (errorText ? { errorText } : null),
  } as Request;
}
async function result(file = 'status.json') {
  return JSON.parse(await readFile(join(directory, 'demo-matrix/startup-profile', file), 'utf8'));
}

describe('explicit opt-in Demo Matrix native startup diagnostics', () => {
  it('is inert by default without CDP, listeners, timers or artifacts', async () => {
    const { page, context } = fixture();
    const handle = await startMatrixStartupDiagnostic(page as unknown as Page, {
      ...options(),
      enabled: false,
    });
    await handle.finish();
    expect(context.newCDPSession).not.toHaveBeenCalled();
    expect(page.eventNames()).toEqual([]);
    expect(await readdir(directory)).toEqual([]);
  });
  it('captures bounded own-page resource facts and strips URL credentials, queries and source payloads', async () => {
    const { page, session } = fixture();
    const handle = await startMatrixStartupDiagnostic(page as unknown as Page, options());
    const done = request('http://user:private@127.0.0.1:4321/@fs/runtime.ts?token=private#private');
    const failed = request('http://127.0.0.1:4321/failed.ts', 'script', 'net::ERR_ABORTED');
    const pending = request('http://127.0.0.1:4321/pending.ts');
    page.emit('request', done);
    page.emit('request', failed);
    page.emit('request', pending);
    page.emit('request', request('https://external.invalid/account?token=private', 'fetch'));
    page.emit('response', { request: () => done, status: () => 200 } as Response);
    page.emit('requestfinished', done);
    page.emit('requestfailed', failed);
    await handle.finish();
    const facts = await result();
    expect(facts).toMatchObject({
      diagnosticOnly: true,
      samplingIsNotPerformanceAcceptance: true,
      finished: true,
      profileState: 'captured',
      network: {
        requested: 3,
        responses: 1,
        finished: 1,
        failed: 1,
        ignoredOtherOrigins: 1,
        statuses: { '200': 1 },
        truncated: false,
      },
    });
    expect(facts.network.pending).toEqual([
      expect.objectContaining({ path: '/pending.ts', type: 'script' }),
    ]);
    expect(facts.network.failures).toEqual([
      expect.objectContaining({ path: '/failed.ts', error: 'net::ERR_ABORTED' }),
    ]);
    const profile = await result('profile.json');
    expect(profile.profile.nodes[0].callFrame.url).toBe('http://127.0.0.1:4321/src/previewer.ts');
    expect(JSON.stringify([facts, profile])).not.toContain('private');
    expect(JSON.stringify([facts, profile])).not.toContain('secret');
    expect(session.send.mock.calls.map(([method]) => method)).toEqual([
      'Profiler.enable',
      'Profiler.setSamplingInterval',
      'Profiler.start',
      'Profiler.stop',
    ]);
    expect(session.send).toHaveBeenCalledWith('Profiler.setSamplingInterval', { interval: 10_000 });
    expect(page.evaluate).not.toHaveBeenCalled();
    expect(page.goto).not.toHaveBeenCalled();
    expect(page.route).not.toHaveBeenCalled();
    expect(page.waitForFunction).not.toHaveBeenCalled();
    expect(page.eventNames()).toEqual([]);
  });
  it('never persists unresolved relative, protocol-relative or malformed CPU frame URLs', async () => {
    const inputs = [
      '/src/public-fixture.ts?token=SYNTHETIC_QUERY#SYNTHETIC_FRAGMENT',
      '//remote.invalid/public-fixture?token=SYNTHETIC_QUERY#SYNTHETIC_FRAGMENT',
      'fixture source SYNTHETIC_PAYLOAD',
      'http://[malformed?token=SYNTHETIC_QUERY#SYNTHETIC_FRAGMENT',
      '',
      'http://user:SYNTHETIC_PASSWORD@127.0.0.1:4321/public.ts?token=SYNTHETIC_QUERY#SYNTHETIC_FRAGMENT',
      'data:text/javascript,SYNTHETIC_SOURCE',
      'file:///SYNTHETIC_FILE',
    ];
    const { page } = fixture(undefined, undefined, inputs);
    const handle = await startMatrixStartupDiagnostic(page as unknown as Page, options());
    await handle.finish();
    const profile = await result('profile.json');
    expect(
      profile.profile.nodes.map((node: { callFrame: { url: string } }) => node.callFrame.url)
    ).toEqual([
      '[unresolved script]',
      '[unresolved script]',
      '[unresolved script]',
      '[unresolved script]',
      '[unresolved script]',
      'http://127.0.0.1:4321/public.ts',
      '[non-http script]',
      '[non-http script]',
    ]);
    expect(JSON.stringify(profile)).not.toContain('SYNTHETIC_');
  });
  it('limits retained network rows without losing aggregate counts', async () => {
    const { page } = fixture();
    const handle = await startMatrixStartupDiagnostic(page as unknown as Page, options());
    for (let index = 0; index < 230; index++)
      page.emit('request', request(`http://127.0.0.1:4321/${index}.ts`));
    await handle.finish();
    const facts = await result();
    expect(facts.network.requested).toBe(230);
    expect(facts.network.pending).toHaveLength(200);
    expect(facts.network.truncated).toBe(true);
  });
  it('stops once at the diagnostic deadline even if readiness never settles', async () => {
    vi.useFakeTimers();
    const { page, session } = fixture();
    const handle = await startMatrixStartupDiagnostic(page as unknown as Page, options());
    await vi.advanceTimersByTimeAsync(44_999);
    expect(session.send).not.toHaveBeenCalledWith('Profiler.stop');
    await vi.advanceTimersByTimeAsync(1);
    await handle.finish();
    await handle.finish();
    expect(session.send.mock.calls.filter(([method]) => method === 'Profiler.stop')).toHaveLength(
      1
    );
    expect((await result()).elapsedMs).toBe(45_000);
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each(['Profiler.enable', 'Profiler.start', 'Profiler.stop'])(
    'does not replace the original failure when %s rejects',
    async (method) => {
      const { page } = fixture(method);
      const handle = await startMatrixStartupDiagnostic(page as unknown as Page, options());
      const original = new Error('original committed-host-readiness timeout');
      const journey = async () => {
        try {
          throw original;
        } finally {
          await handle.finish();
        }
      };
      await expect(journey()).rejects.toBe(original);
      expect(await result()).toMatchObject({
        profileState: 'unavailable',
        profileError: expect.stringContaining(method),
        finished: true,
      });
      expect(page.eventNames()).toEqual([]);
    }
  );
  it.each(['Profiler.enable', 'Profiler.stop'])(
    'bounds an unresponsive %s and retains an unavailable receipt',
    async (method) => {
      vi.useFakeTimers();
      const { page } = fixture(undefined, method);
      const starting = startMatrixStartupDiagnostic(page as unknown as Page, options());
      if (method === 'Profiler.enable') await vi.advanceTimersByTimeAsync(2_000);
      const handle = await starting;
      const finishing = handle.finish();
      if (method === 'Profiler.stop') await vi.advanceTimersByTimeAsync(2_000);
      await finishing;
      expect(await result()).toMatchObject({
        profileState: 'unavailable',
        profileError: expect.stringContaining('unavailable within 2000ms'),
        finished: true,
      });
      expect(vi.getTimerCount()).toBe(0);
    }
  );
});

it.each([
  {
    flag: undefined,
    evidence: '/evidence',
    name: 'mounts every demo in every official Web adapter',
    expected: 0,
  },
  {
    flag: '0',
    evidence: '/evidence',
    name: 'mounts every demo in every official Web adapter',
    expected: 0,
  },
  {
    flag: '1',
    evidence: undefined,
    name: 'mounts every demo in every official Web adapter',
    expected: 0,
  },
  { flag: '1', evidence: '/evidence', name: 'keeps the matrix readable at 320px', expected: 0 },
  {
    flag: '1',
    evidence: '/evidence',
    name: 'mounts every demo in every official Web adapter',
    expected: 1,
  },
])(
  'actual route opens unchanged with startup profile gate $flag/$name/$evidence',
  async ({ flag, evidence, name, expected }) => {
    const source = ts.createSourceFile(
      'matrix.ts',
      readFileSync(new URL('./demo-matrix.browser.test.ts', import.meta.url), 'utf8'),
      ts.ScriptTarget.Latest,
      true
    );
    const open = source.statements.find(
      (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'openMatrixRoute'
    )!;
    const { page } = fixture();
    const waitFor = vi.fn(async () => {});
    Object.assign(page, { locator: () => ({ first: () => ({ waitFor }) }) });
    const context = { newPage: async () => page, close: vi.fn(async () => {}) };
    const start = vi.fn(async () => ({ finish: async () => {} }));
    const readDiagnostic = vi.fn(async () => {});
    const run = vm.runInNewContext(
      transformSync(`${open.getText(source)}\nopenMatrixRoute;`, { loader: 'ts', target: 'es2022' })
        .code,
      {
        browser: { newContext: async () => context },
        expect: {
          getState: () => ({ currentTestName: `Website Demo Matrix browser smoke > ${name}` }),
        },
        matrixDiagnostics: new WeakMap(),
        diagnosticSourceSha: options().sourceSha,
        console,
        Date,
        URL,
        process: {
          env: { PROTO_UI_MATRIX_STARTUP_PROFILE: flag, PROTO_UI_RUNTIME_EVIDENCE_DIR: evidence },
        },
        baseUrl: 'http://127.0.0.1:4321',
        MATRIX_ROUTE: '/zh-cn/internal/demo-matrix/',
        startMatrixStartupDiagnostic: start,
        persistReadinessDiagnostic: readDiagnostic,
      }
    );
    await run({ width: 1440, height: 900 });
    expect(start).toHaveBeenCalledTimes(expected);
    expect(page.goto).toHaveBeenCalledWith('http://127.0.0.1:4321/zh-cn/internal/demo-matrix/', {
      waitUntil: 'networkidle',
    });
    expect(waitFor).toHaveBeenCalledWith({ state: 'visible' });
    expect(readDiagnostic.mock.calls.map((call) => (call as unknown[]).slice(1))).toEqual([
      ['route-open', 'started'],
      ['route-open', 'passed'],
    ]);
  }
);

describe('Matrix startup workflow dependency triggers', () => {
  const workflow = readFileSync('.github/workflows/demo-matrix-startup-diagnostic.yml', 'utf8');
  const dependencies = [
    {
      importer: 'apps/www/src/content/docs/zh-cn/demo-matrix.browser.test.ts',
      specifier: './browser-harness',
      dependency: 'apps/www/src/content/docs/zh-cn/browser-harness.ts',
    },
    {
      importer: 'apps/www/src/content/docs/zh-cn/browser-harness.ts',
      specifier: '../../../../../../scripts/test/server-readiness.mjs',
      dependency: 'scripts/test/server-readiness.mjs',
    },
  ];
  const triggeredPaths = (text: string) =>
    [...text.split('  workflow_dispatch:')[0].matchAll(/^\s+- '([^']+)'$/gm)].map(
      (match) => match[1]
    );
  it.each(dependencies)(
    'profiles changes to the actual imported $dependency',
    ({ importer, specifier, dependency }) => {
      expect(readFileSync(importer, 'utf8')).toContain(`from '${specifier}'`);
      expect(triggeredPaths(workflow)).toContain(dependency);
      expect(triggeredPaths(workflow.replace(`      - '${dependency}'\n`, ''))).not.toContain(
        dependency
      );
    }
  );
});

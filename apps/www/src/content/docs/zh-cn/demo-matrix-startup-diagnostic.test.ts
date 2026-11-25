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
import type { Browser, Page, Request, Response } from 'playwright-core';
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
  it('retains network and process CPU after the browser trace checkpoint without starting a page profiler', async () => {
    vi.useFakeTimers();
    const { page, session, context } = fixture();
    const cpu = { send: vi.fn(async () => ({ processInfo: [] })), detach: vi.fn(async () => {}) };
    const trace = Object.assign(new EventEmitter(), {
      send: vi.fn(async (method: string) => {
        if (method === 'Tracing.end')
          trace.emit('Tracing.tracingComplete', { dataLossOccurred: false });
        return {};
      }),
      detach: vi.fn(async () => {}),
    });
    const browser = {
      newBrowserCDPSession: vi.fn().mockResolvedValueOnce(cpu).mockResolvedValueOnce(trace),
    };
    const handle = await startMatrixStartupDiagnostic(page as unknown as Page, {
      ...options(),
      ownedBrowser: browser as unknown as Browser,
    });
    await vi.advanceTimersByTimeAsync(25_000);
    const later = request('http://127.0.0.1:4321/later-module.ts');
    page.emit('request', later);
    page.emit('response', { request: () => later, status: () => 200 } as Response);
    page.emit('requestfinished', later);
    await handle.finish();
    const facts = await result();
    expect(context.newCDPSession).not.toHaveBeenCalled();
    expect(session.send).not.toHaveBeenCalled();
    expect(facts).toMatchObject({
      profileMode: 'browser-trace',
      profileState: 'disabled-for-browser-trace',
      chunks: [],
      network: { requested: 1, responses: 1, finished: 1, failed: 0 },
    });
    const browserFacts = JSON.parse(
      await readFile(join(directory, 'demo-matrix/browser-diagnostic/status.json'), 'utf8')
    );
    expect(browserFacts).toMatchObject({
      cpu: { sampleCount: 6 },
      trace: { state: 'complete', stopReason: 'checkpoint' },
    });
    expect(trace.send.mock.calls.filter(([method]) => method === 'Tracing.start')).toHaveLength(1);
    expect(trace.send.mock.calls.filter(([method]) => method === 'Tracing.end')).toHaveLength(1);
    expect(page.eventNames()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
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
  it('retains an early CPU chunk when a later renderer stop is unresponsive', async () => {
    vi.useFakeTimers();
    const { page, session } = fixture();
    const originalSend = session.send.getMockImplementation()!;
    let stops = 0;
    session.send.mockImplementation(async (method) => {
      if (method === 'Profiler.stop' && ++stops === 2) return new Promise<never>(() => {});
      return originalSend(method);
    });
    const handle = await startMatrixStartupDiagnostic(page as unknown as Page, options());
    await vi.advanceTimersByTimeAsync(42_000);
    page.emit('request', request('http://127.0.0.1:4321/still-observed.ts'));
    await handle.finish();
    const facts = await result();
    expect(facts).toMatchObject({
      finished: true,
      profileState: 'unavailable',
      profileError: expect.stringContaining('unavailable within 2000ms'),
      network: { requested: 1 },
    });
    expect(facts.chunks.map((chunk: { state: string }) => chunk.state)).toEqual([
      'captured',
      'unavailable',
    ]);
    expect((await result('profile-0001.json')).profile.nodes).toHaveLength(2);
    expect(await result('profile.json')).toMatchObject({
      chunkSequence: 1,
      profileTiming: { stopReason: 'checkpoint', ownerStoppedCapture: false },
    });
    expect(stops).toBe(2);
    expect(page.eventNames()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('keeps recording through navigation and the original init wait until the owner finishes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-23T00:00:00.000Z'));
    let phase = 'route-open';
    const { page, session } = fixture();
    const handle = await startMatrixStartupDiagnostic(page as unknown as Page, {
      ...options(),
      phase: () => phase,
    });
    await vi.advanceTimersByTimeAsync(25_000);
    expect(session.send.mock.calls.filter(([method]) => method === 'Profiler.stop')).toHaveLength(
      1
    );
    phase = 'inited-count';
    await vi.advanceTimersByTimeAsync(60_000);
    expect(session.send.mock.calls.filter(([method]) => method === 'Profiler.stop')).toHaveLength(
      4
    );
    phase = 'case-finally';
    await handle.finish();
    await handle.finish();
    const facts = await result();
    expect(facts).toMatchObject({
      elapsedMs: 85_000,
      requestedProfileWindowMs: 180_000,
      profileTiming: {
        startAcknowledgedAt: '2026-11-23T00:01:20.000Z',
        stopRequestedAt: '2026-11-23T00:01:25.000Z',
        stopAcknowledgedAt: '2026-11-23T00:01:25.000Z',
        stopReason: 'owner-finish',
        ownerStoppedCapture: true,
        phaseCoverage: 'requires-timestamp-reconciliation',
        // Fixture CDP timestamps are separate from the fake owner clock.
        sampledDurationMs: 0.01,
      },
    });
    expect(session.send.mock.calls.filter(([method]) => method === 'Profiler.stop')).toHaveLength(
      5
    );
    expect(facts.chunks.map((chunk: { stopReason: string }) => chunk.stopReason)).toEqual([
      'checkpoint',
      'checkpoint',
      'checkpoint',
      'checkpoint',
      'owner-finish',
    ]);
    expect(facts.samplingGaps).toContain('not sampled');
    expect((await result('profile-0001.json')).profileTiming).toMatchObject({
      startAcknowledgedAt: '2026-11-23T00:00:00.000Z',
      stopAcknowledgedAt: '2026-11-23T00:00:20.000Z',
      ownerStoppedCapture: false,
    });
    expect(vi.getTimerCount()).toBe(0);
  });
  it('caps stalled diagnostics at the original case limit without an owner-finish receipt', async () => {
    vi.useFakeTimers();
    const { page, session } = fixture();
    const handle = await startMatrixStartupDiagnostic(page as unknown as Page, options());
    await vi.advanceTimersByTimeAsync(45_000);
    expect(session.send.mock.calls.filter(([method]) => method === 'Profiler.stop')).toHaveLength(
      2
    );
    await vi.advanceTimersByTimeAsync(134_999);
    expect(session.send.mock.calls.filter(([method]) => method === 'Profiler.stop')).toHaveLength(
      8
    );
    await vi.advanceTimersByTimeAsync(1);
    await handle.finish();
    await handle.finish();
    expect(session.send.mock.calls.filter(([method]) => method === 'Profiler.stop')).toHaveLength(
      9
    );
    expect(await result()).toMatchObject({
      elapsedMs: 180_000,
      profileTiming: {
        stopReason: 'diagnostic-deadline',
        ownerStoppedCapture: false,
        phaseCoverage: 'requires-timestamp-reconciliation',
      },
    });
    expect(vi.getTimerCount()).toBe(0);
  });
  it('finishes an in-flight checkpoint once without restarting a retired owner', async () => {
    vi.useFakeTimers();
    const { page, session } = fixture();
    const originalSend = session.send.getMockImplementation()!;
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    session.send.mockImplementation(async (method) => {
      if (method === 'Profiler.stop') await held;
      return originalSend(method);
    });
    const handle = await startMatrixStartupDiagnostic(page as unknown as Page, options());
    await vi.advanceTimersByTimeAsync(20_000);
    const finishing = handle.finish();
    release();
    await finishing;
    await handle.finish();
    expect(session.send.mock.calls.filter(([method]) => method === 'Profiler.start')).toHaveLength(
      1
    );
    expect(session.send.mock.calls.filter(([method]) => method === 'Profiler.stop')).toHaveLength(
      1
    );
    expect(await result()).toMatchObject({
      finished: true,
      finishReason: 'owner-finish',
      profileState: 'captured',
      profileTiming: { stopReason: 'checkpoint', ownerStoppedCapture: false },
    });
    expect(page.eventNames()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('bounds a held restart and a late acknowledgement cannot reactivate capture', async () => {
    vi.useFakeTimers();
    const { page, session } = fixture();
    const originalSend = session.send.getMockImplementation()!;
    let starts = 0;
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    session.send.mockImplementation(async (method) => {
      if (method === 'Profiler.start' && ++starts === 2) await held;
      return originalSend(method);
    });
    const handle = await startMatrixStartupDiagnostic(page as unknown as Page, options());
    await vi.advanceTimersByTimeAsync(22_000);
    await handle.finish();
    const before = await readFile(
      join(directory, 'demo-matrix/startup-profile/status.json'),
      'utf8'
    );
    expect(JSON.parse(before)).toMatchObject({
      finished: true,
      profileState: 'unavailable',
      profileError: expect.stringContaining('Profiler restart unavailable within 2000ms'),
    });
    release();
    await vi.advanceTimersByTimeAsync(40_000);
    expect(await readFile(join(directory, 'demo-matrix/startup-profile/status.json'), 'utf8')).toBe(
      before
    );
    expect(starts).toBe(2);
    expect(session.send.mock.calls.filter(([method]) => method === 'Profiler.stop')).toHaveLength(
      1
    );
    expect(session.detach).toHaveBeenCalled();
    expect((await result('profile-0001.json')).profile.nodes).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each([
    { name: 'missing', clock: { startTime: 10, endTime: undefined } },
    { name: 'non-finite', clock: { startTime: Number.NaN, endTime: 20 } },
    { name: 'reversed', clock: { startTime: 20, endTime: 10 } },
  ])('never infers phase coverage from a $name CDP sampling clock', async ({ clock }) => {
    const { page, session } = fixture();
    const originalSend = session.send.getMockImplementation()!;
    session.send.mockImplementation(async (method) => {
      const response = await originalSend(method);
      if (method === 'Profiler.stop') Object.assign(response.profile, clock);
      return response;
    });
    const handle = await startMatrixStartupDiagnostic(page as unknown as Page, options());
    await handle.finish();
    const facts = await result();
    expect(facts).toMatchObject({
      profileState: 'captured',
      profileTiming: {
        sampledDurationMs: null,
        ownerStoppedCapture: true,
        phaseCoverage: 'requires-timestamp-reconciliation',
      },
    });
    expect(facts.profileTiming).not.toHaveProperty('ownerWindowCovered');
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
  {
    flag: '0',
    browserFlag: '1',
    evidence: '/evidence',
    name: 'mounts every demo in every official Web adapter',
    expected: 0,
  },
  {
    flag: '1',
    browserFlag: '1',
    evidence: '/evidence',
    name: 'mounts every demo in every official Web adapter',
    expected: 1,
  },
])(
  'actual route opens unchanged with startup profile gate $flag/$name/$evidence',
  async ({ flag, browserFlag, evidence, name, expected }) => {
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
    page.evaluate.mockResolvedValue({ delivered: 1, registered: 1 });
    const waitFor = vi.fn(async () => {});
    Object.assign(page, { locator: () => ({ first: () => ({ waitFor }) }) });
    const context = { newPage: async () => page, close: vi.fn(async () => {}) };
    const browser = { newContext: async () => context };
    const start = vi.fn(async () => ({ finish: async () => {} }));
    const readDiagnostic = vi.fn(async () => {});
    const run = vm.runInNewContext(
      transformSync(`${open.getText(source)}\nopenMatrixRoute;`, { loader: 'ts', target: 'es2022' })
        .code,
      {
        browser,
        expect: Object.assign((value: unknown) => expect(value), {
          getState: () => ({ currentTestName: `Website Demo Matrix browser smoke > ${name}` }),
        }),
        matrixDiagnostics: new WeakMap(),
        diagnosticSourceSha: options().sourceSha,
        console,
        Date,
        URL,
        process: {
          env: {
            PROTO_UI_MATRIX_STARTUP_PROFILE: flag,
            PROTO_UI_MATRIX_BROWSER_DIAGNOSTIC: browserFlag,
            PROTO_UI_RUNTIME_EVIDENCE_DIR: evidence,
          },
        },
        baseUrl: 'http://127.0.0.1:4321',
        MATRIX_ROUTE: '/zh-cn/internal/demo-matrix/',
        startMatrixStartupDiagnostic: start,
        persistReadinessDiagnostic: readDiagnostic,
      }
    );
    await run({ width: 1440, height: 900 });
    expect(start).toHaveBeenCalledTimes(expected);
    if (expected)
      expect((start.mock.calls[0] as unknown[])[1]).toMatchObject({
        ownedBrowser: browserFlag === '1' ? browser : undefined,
      });
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

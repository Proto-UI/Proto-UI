// @vitest-environment node
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Browser } from 'playwright-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startMatrixBrowserDiagnostic } from './demo-matrix-browser-diagnostic';

let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'matrix-browser-'));
});
afterEach(async () => {
  vi.useRealTimers();
  await rm(directory, { recursive: true, force: true });
});
const options = () => ({
  enabled: true,
  directory,
  sourceSha: 'source-under-test',
  caseName: 'mounts every demo in every official Web adapter',
  phase: () => 'inited-count',
});
function fixture() {
  let samples = 0;
  const cpu = {
    send: vi.fn(async (_method: string) => ({
      processInfo: [
        { id: 10, type: 'browser', cpuTime: 1 + ++samples / 10 },
        { id: 11, type: 'renderer', cpuTime: 3 + samples * 4 },
        { id: 12, type: 'GPU', cpuTime: 0.5 },
      ],
    })),
    detach: vi.fn(async () => {}),
  };
  const trace = Object.assign(new EventEmitter(), {
    send: vi.fn(async (method: string, _params?: unknown) => {
      if (method === 'Tracing.end')
        trace.emit('Tracing.tracingComplete', { dataLossOccurred: false });
      return {};
    }),
    detach: vi.fn(async () => {}),
  });
  const browser = {
    newBrowserCDPSession: vi.fn().mockResolvedValueOnce(cpu).mockResolvedValueOnce(trace),
  };
  return {
    browser: browser as unknown as Browser,
    create: browser.newBrowserCDPSession,
    cpu,
    trace,
  };
}
const location = (file: string) => join(directory, 'demo-matrix/browser-diagnostic', file);
const result = async (file = 'status.json') => JSON.parse(await readFile(location(file), 'utf8'));
const held = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
};

describe('explicit owned-browser Matrix diagnosis', () => {
  it('prepares tracing before the exact initialization boundary and still stops after one 20-second window', async () => {
    vi.useFakeTimers();
    const f = fixture();
    let phase = 'route-open';
    const handle = await startMatrixBrowserDiagnostic(f.browser, {
      ...options(),
      phase: () => phase,
      prepareTraceBeforePhase: 'inited-count',
    });
    const prematureCalls = f.trace.send.mock.calls.length;
    if (prematureCalls) await handle.finish();
    expect(prematureCalls).toBe(0);
    await handle.preparePhaseTrace('route-open');
    expect(f.trace.send).not.toHaveBeenCalled();
    await handle.preparePhaseTrace('inited-count');
    expect(f.trace.send.mock.calls.map(([method]) => method)).toEqual(['Tracing.start']);
    phase = 'inited-count';
    handle.phaseStarted(phase);
    await handle.preparePhaseTrace('inited-count');
    await vi.advanceTimersByTimeAsync(20_000);
    await handle.finish();
    expect((await result()).trace).toMatchObject({
      requestedTiming: { beforePhase: 'inited-count' },
      preparationPhase: 'route-open',
      preparationRequestedAt: expect.any(String),
      phaseStartedAt: expect.any(String),
      state: 'complete',
      stopReason: 'checkpoint',
      requestedWindowMs: 20_000,
    });
    expect(f.trace.send.mock.calls.map(([method]) => method)).toEqual([
      'Tracing.start',
      'Tracing.end',
    ]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('returns from pre-phase trace setup at the original 2-second bound without accepting a late acknowledgement', async () => {
    vi.useFakeTimers();
    const f = fixture();
    const heldStart = held<Record<string, never>>();
    f.trace.send.mockImplementation(async (method) => {
      if (method === 'Tracing.start') return heldStart.promise;
      if (method === 'Tracing.end')
        f.trace.emit('Tracing.tracingComplete', { dataLossOccurred: false });
      return {};
    });
    const handle = await startMatrixBrowserDiagnostic(f.browser, {
      ...options(),
      prepareTraceBeforePhase: 'inited-count',
    });
    let prepared = false;
    const preparing = handle.preparePhaseTrace('inited-count').then(() => {
      prepared = true;
    });
    await vi.advanceTimersByTimeAsync(1_999);
    expect(prepared).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await preparing;
    expect(prepared).toBe(true);
    handle.phaseStarted('inited-count');
    heldStart.resolve({});
    await vi.advanceTimersByTimeAsync(0);
    let finished = false;
    const finishing = handle.finish().then(() => (finished = true));
    await vi.advanceTimersByTimeAsync(1_999);
    expect(finished).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await finishing;
    expect((await result()).trace).toMatchObject({
      state: 'unavailable',
      setupError: expect.stringContaining('2000ms'),
      startAcknowledgedAt: null,
      phaseStartedAt: expect.any(String),
    });
    expect(f.trace.send.mock.calls.filter(([method]) => method === 'Tracing.start')).toHaveLength(
      1
    );
    expect(f.trace.send.mock.calls.filter(([method]) => method === 'Tracing.end')).toHaveLength(1);
    expect(f.trace.detach).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not prepare tracing after owner retirement or when both timing modes are requested', async () => {
    vi.useFakeTimers();
    const f = fixture();
    const handle = await startMatrixBrowserDiagnostic(f.browser, {
      ...options(),
      prepareTraceBeforePhase: 'inited-count',
      traceTiming: { afterPhase: 'inited-count', delayMs: 60_000 },
    });
    await handle.preparePhaseTrace('inited-count');
    handle.phaseStarted('inited-count');
    await handle.finish();
    await handle.preparePhaseTrace('inited-count');
    await vi.advanceTimersByTimeAsync(70_000);
    expect(f.create).toHaveBeenCalledTimes(1);
    expect((await result()).trace).toMatchObject({
      state: 'unavailable',
      setupError: expect.stringContaining('Invalid delayed trace timing'),
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retires a valid prepared-phase owner before its boundary without creating a trace session', async () => {
    vi.useFakeTimers();
    const f = fixture();
    const handle = await startMatrixBrowserDiagnostic(f.browser, {
      ...options(),
      prepareTraceBeforePhase: 'inited-count',
    });
    await handle.finish();
    await handle.preparePhaseTrace('inited-count');
    handle.phaseStarted('inited-count');
    await vi.advanceTimersByTimeAsync(70_000);
    expect(f.create).toHaveBeenCalledTimes(1);
    expect(f.trace.send).not.toHaveBeenCalled();
    expect((await result()).trace).toMatchObject({
      state: 'unavailable',
      startRequestedAt: null,
      phaseStartedAt: null,
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not contact a browser, install timers or write files without explicit enablement', async () => {
    vi.useFakeTimers();
    const f = fixture();
    const handle = await startMatrixBrowserDiagnostic(f.browser, { ...options(), enabled: false });
    await handle.finish();
    expect(f.create).not.toHaveBeenCalled();
    expect(await readdir(directory)).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('waits for the exact initialization signal plus 60 seconds, then captures only one original 20-second window', async () => {
    vi.useFakeTimers();
    const startedAt = Date.now();
    let phase = 'route-open';
    const f = fixture();
    const handle = await startMatrixBrowserDiagnostic(f.browser, {
      ...options(),
      phase: () => phase,
      traceTiming: { afterPhase: 'inited-count', delayMs: 60_000 },
    });
    const prematureCalls = f.trace.send.mock.calls.length;
    if (prematureCalls) await handle.finish();
    expect(prematureCalls).toBe(0);
    expect(f.create).toHaveBeenCalledTimes(1);
    handle.phaseStarted('route-open');
    await vi.advanceTimersByTimeAsync(10_000);
    phase = 'inited-count';
    handle.phaseStarted(phase);
    await vi.advanceTimersByTimeAsync(30_000);
    handle.phaseStarted(phase);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(f.trace.send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(f.trace.send.mock.calls.map(([method]) => method)).toEqual(['Tracing.start']);
    await vi.advanceTimersByTimeAsync(20_000);
    await handle.finish();
    const facts = await result();
    expect(facts).toMatchObject({
      ownerLimitMs: 180_000,
      elapsedMs: 90_000,
      trace: {
        requestedTiming: { afterPhase: 'inited-count', delayMs: 60_000 },
        phaseStartedAt: new Date(startedAt + 10_000).toISOString(),
        scheduledStartAt: new Date(startedAt + 70_000).toISOString(),
        startRequestedAt: new Date(startedAt + 70_000).toISOString(),
        startAcknowledgedAt: new Date(startedAt + 70_000).toISOString(),
        stopRequestedAt: new Date(startedAt + 90_000).toISOString(),
        state: 'complete',
        stopReason: 'checkpoint',
        requestedWindowMs: 20_000,
      },
    });
    expect(f.trace.send.mock.calls.map(([method]) => method)).toEqual([
      'Tracing.start',
      'Tracing.end',
    ]);
    expect(f.cpu.send.mock.calls.length).toBeGreaterThan(2);
    expect(f.trace.detach).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, 160_001, 0.5])(
    'rejects invalid delayed trace duration %s without falling back to early tracing',
    async (delayMs) => {
      vi.useFakeTimers();
      const f = fixture();
      const handle = await startMatrixBrowserDiagnostic(f.browser, {
        ...options(),
        traceTiming: { afterPhase: 'inited-count', delayMs },
      });
      const prematureCalls = f.trace.send.mock.calls.length;
      if (prematureCalls) await handle.finish();
      expect(prematureCalls).toBe(0);
      handle.phaseStarted('inited-count');
      await vi.advanceTimersByTimeAsync(100_000);
      await handle.finish();
      expect((await result()).trace).toMatchObject({
        state: 'unavailable',
        setupError: expect.stringContaining('Invalid delayed trace timing'),
        startRequestedAt: null,
      });
      expect(f.create).toHaveBeenCalledTimes(1);
      expect(f.cpu.send.mock.calls.length).toBeGreaterThan(1);
      expect(vi.getTimerCount()).toBe(0);
    }
  );

  it('requires a matching explicit phase signal rather than sampling a getter that already names initialization', async () => {
    vi.useFakeTimers();
    const f = fixture();
    const handle = await startMatrixBrowserDiagnostic(f.browser, {
      ...options(),
      traceTiming: { afterPhase: 'inited-count', delayMs: 60_000 },
    });
    handle.phaseStarted('committed-host-readiness');
    await vi.advanceTimersByTimeAsync(90_000);
    await handle.finish();
    expect(f.create).toHaveBeenCalledTimes(1);
    expect((await result()).trace).toMatchObject({
      state: 'unavailable',
      phaseStartedAt: null,
      startRequestedAt: null,
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels the delayed start when the owner finishes and never revives it on another phase signal', async () => {
    vi.useFakeTimers();
    const f = fixture();
    const handle = await startMatrixBrowserDiagnostic(f.browser, {
      ...options(),
      traceTiming: { afterPhase: 'inited-count', delayMs: 60_000 },
    });
    handle.phaseStarted('inited-count');
    await vi.advanceTimersByTimeAsync(20_000);
    await handle.finish();
    const terminal = await readFile(location('status.json'), 'utf8');
    handle.phaseStarted('inited-count');
    await vi.advanceTimersByTimeAsync(100_000);
    expect(f.create).toHaveBeenCalledTimes(1);
    expect(f.trace.send).not.toHaveBeenCalled();
    expect(await readFile(location('status.json'), 'utf8')).toBe(terminal);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps the original owner deadline when the requested delayed window would start after it', async () => {
    vi.useFakeTimers();
    const f = fixture();
    const handle = await startMatrixBrowserDiagnostic(f.browser, {
      ...options(),
      traceTiming: { afterPhase: 'inited-count', delayMs: 60_000 },
    });
    await vi.advanceTimersByTimeAsync(140_000);
    handle.phaseStarted('inited-count');
    await vi.advanceTimersByTimeAsync(40_000);
    await handle.finish();
    expect(await result()).toMatchObject({
      elapsedMs: 180_000,
      ownerLimitMs: 180_000,
      finishReason: 'diagnostic-deadline',
      trace: { state: 'unavailable', startRequestedAt: null },
    });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.create).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not start a stale delayed window after the case has left the signaled phase', async () => {
    vi.useFakeTimers();
    const f = fixture();
    let phase = 'inited-count';
    const handle = await startMatrixBrowserDiagnostic(f.browser, {
      ...options(),
      phase: () => phase,
      traceTiming: { afterPhase: 'inited-count', delayMs: 60_000 },
    });
    handle.phaseStarted(phase);
    await vi.advanceTimersByTimeAsync(30_000);
    phase = 'committed-host-readiness';
    await vi.advanceTimersByTimeAsync(30_000);
    await handle.finish();
    expect(f.create).toHaveBeenCalledTimes(1);
    expect((await result()).trace).toMatchObject({
      state: 'unavailable',
      setupError: expect.stringContaining('left the requested phase'),
      startRequestedAt: null,
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retires a late-created delayed trace session without starting it after owner finish', async () => {
    vi.useFakeTimers();
    const f = fixture();
    const pending = held<unknown>();
    f.create.mockReset().mockResolvedValueOnce(f.cpu).mockReturnValueOnce(pending.promise);
    const handle = await startMatrixBrowserDiagnostic(f.browser, {
      ...options(),
      traceTiming: { afterPhase: 'inited-count', delayMs: 60_000 },
    });
    handle.phaseStarted('inited-count');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.create).toHaveBeenCalledTimes(2);
    await handle.finish();
    const terminal = await readFile(location('status.json'), 'utf8');
    pending.resolve(f.trace);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(f.trace.send).not.toHaveBeenCalled();
    expect(f.trace.detach).toHaveBeenCalledTimes(1);
    expect(await readFile(location('status.json'), 'utf8')).toBe(terminal);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retains separate process CPU clocks and explicit lossy trace completion with sanitized frame facts', async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.trace.send.mockImplementation(async (method) => {
      if (method === 'Tracing.end') {
        f.trace.emit('Tracing.dataCollected', {
          value: [
            {
              name: 'thread_name',
              cat: '__metadata',
              ph: 'M',
              pid: 11,
              tid: 13,
              args: { name: 'CrRendererMain' },
            },
            {
              name: 'ProfileChunk',
              cat: 'disabled-by-default-v8.cpu_profiler',
              ph: 'P',
              pid: 11,
              tid: 13,
              ts: 100,
              id: 'profile-id',
              args: {
                private: 'SYNTHETIC_BODY',
                data: {
                  cpuProfile: {
                    nodes: [
                      {
                        id: 1,
                        callFrame: {
                          functionName: 'initPreviewer',
                          scriptId: '17',
                          url: 'http://user:SYNTHETIC_PASSWORD@127.0.0.1:4321/previewer.ts?token=SYNTHETIC_QUERY#SYNTHETIC_FRAGMENT',
                          lineNumber: 12,
                          columnNumber: 2,
                        },
                        source: 'SYNTHETIC_SOURCE',
                      },
                    ],
                    samples: [1],
                  },
                  timeDeltas: [10],
                  source: 'SYNTHETIC_SOURCE',
                  headers: 'SYNTHETIC_HEADERS',
                },
              },
            },
          ],
        });
        f.trace.emit('Tracing.tracingComplete', { dataLossOccurred: true });
      }
      return {};
    });
    const handle = await startMatrixBrowserDiagnostic(f.browser, options());
    await vi.advanceTimersByTimeAsync(10_000);
    await handle.finish();
    await handle.finish();
    expect((await result('cpu-0001.json')).processes).toEqual([
      { id: 10, type: 'browser', cpuTime: 1.1 },
      { id: 11, type: 'renderer', cpuTime: 7 },
      { id: 12, type: 'GPU', cpuTime: 0.5 },
    ]);
    expect((await result('cpu-0003.json')).processes[1]).toEqual({
      id: 11,
      type: 'renderer',
      cpuTime: 15,
    });
    const facts = await result();
    expect(facts).toMatchObject({
      finished: true,
      cpu: { state: 'captured', sampleCount: 3 },
      trace: {
        state: 'complete',
        dataLossOccurred: true,
        retainedEvents: 2,
        outputTruncated: false,
      },
    });
    expect(facts.trace.flush).toContain('partial output is not a complete window');
    const raw = await readFile(location('trace-0001.json'), 'utf8');
    expect(raw).not.toContain('SYNTHETIC_');
    expect(JSON.parse(raw).traceEvents[1].args.data.cpuProfile.nodes[0].callFrame.url).toBe(
      'http://127.0.0.1:4321/previewer.ts'
    );
    expect(facts.trace.retainedBytes).toBe(Buffer.byteLength(raw));
    expect(f.trace.send).toHaveBeenCalledWith(
      'Tracing.start',
      expect.objectContaining({
        traceConfig: expect.objectContaining({
          traceBufferSizeInKb: 16_384,
          excludedCategories: ['*'],
        }),
      })
    );
    expect(f.create).toHaveBeenCalledTimes(2);
    expect(f.cpu.detach).toHaveBeenCalledTimes(1);
    expect(f.trace.detach).toHaveBeenCalledTimes(1);
    expect(f.trace.eventNames()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves CPU and received trace buckets when trace stop never acknowledges', async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.trace.send.mockImplementation(async (method) =>
      method === 'Tracing.end' ? new Promise<never>(() => {}) : {}
    );
    const handle = await startMatrixBrowserDiagnostic(f.browser, options());
    await vi.advanceTimersByTimeAsync(20_000);
    f.trace.emit('Tracing.bufferUsage', { percentFull: 0.75, eventCount: 5 });
    f.trace.emit('Tracing.dataCollected', {
      value: [{ name: 'RunTask', ph: 'X', pid: 11, tid: 13, ts: 100, dur: 20 }],
    });
    const finishing = handle.finish();
    await vi.advanceTimersByTimeAsync(2_000);
    await finishing;
    expect(await result()).toMatchObject({
      cpu: { sampleCount: 5, state: 'captured' },
      trace: {
        state: 'partial',
        retainedEvents: 1,
        completeAt: null,
        dataLossOccurred: null,
        error: expect.stringContaining('2000ms'),
        bufferUsage: { percentFull: 0.75, eventCount: 5 },
      },
    });
    expect((await result('trace-0001.json')).traceEvents[0].name).toBe('RunTask');
    const terminal = await readFile(location('status.json'), 'utf8');
    f.trace.emit('Tracing.dataCollected', { value: [{ name: 'LATE' }] });
    f.trace.emit('Tracing.tracingComplete', { dataLossOccurred: false });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await readFile(location('status.json'), 'utf8')).toBe(terminal);
    expect(f.trace.eventNames()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops one CPU-only trace at 20 seconds while process CPU continues until the owner finishes', async () => {
    vi.useFakeTimers();
    const f = fixture();
    const startedAt = Date.now();
    const stoppedAt: number[] = [];
    f.trace.send.mockImplementation(async (method) => {
      if (method === 'Tracing.end') {
        stoppedAt.push(Date.now() - startedAt);
        f.trace.emit('Tracing.dataCollected', {
          value: [{ name: 'ProfileChunk', cat: 'disabled-by-default-v8.cpu_profiler', ts: 100 }],
        });
        f.trace.emit('Tracing.tracingComplete', { dataLossOccurred: false });
      }
      return {};
    });
    const handle = await startMatrixBrowserDiagnostic(f.browser, options());
    await vi.advanceTimersByTimeAsync(25_000);
    const earlyStops = [...stoppedAt];
    const laterCpuSamples = f.cpu.send.mock.calls.length;
    f.trace.emit('Tracing.dataCollected', { value: [{ name: 'LATE_RETIRED_TRACE' }] });
    await handle.finish();
    const facts = await result();
    expect(earlyStops).toEqual([20_000]);
    expect(laterCpuSamples).toBe(6);
    expect(stoppedAt).toEqual([20_000]);
    expect(facts).toMatchObject({
      finishReason: 'owner-finish',
      cpu: { state: 'captured', sampleCount: 6 },
      trace: {
        state: 'complete',
        stopReason: 'checkpoint',
        requestedWindowMs: 20_000,
        categories: ['disabled-by-default-v8.cpu_profiler'],
        retainedEvents: 1,
      },
    });
    expect(f.trace.send.mock.calls.filter(([method]) => method === 'Tracing.start')).toHaveLength(
      1
    );
    expect(f.trace.send).toHaveBeenCalledWith(
      'Tracing.start',
      expect.objectContaining({
        traceConfig: expect.objectContaining({
          includedCategories: ['disabled-by-default-v8.cpu_profiler'],
          excludedCategories: ['*'],
          traceBufferSizeInKb: 16_384,
        }),
      })
    );
    expect(facts.trace.outputChunkLimit).toBe(256);
    expect(facts.commandLimitMs).toBe(2_000);
    expect((await result('trace-0001.json')).traceEvents[0].name).toBe('ProfileChunk');
    expect(f.trace.detach).toHaveBeenCalledTimes(1);
    expect(f.trace.eventNames()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shares an in-flight early stop with owner finish and ignores acknowledgements after its bound', async () => {
    vi.useFakeTimers();
    const f = fixture();
    const pending = held<Record<string, never>>();
    f.trace.send.mockImplementation(async (method) =>
      method === 'Tracing.end' ? pending.promise : {}
    );
    const handle = await startMatrixBrowserDiagnostic(f.browser, options());
    await vi.advanceTimersByTimeAsync(20_000);
    const earlyStops = f.trace.send.mock.calls.filter(
      ([method]) => method === 'Tracing.end'
    ).length;
    f.trace.emit('Tracing.dataCollected', {
      value: [{ name: 'ProfileChunk', cat: 'disabled-by-default-v8.cpu_profiler', ts: 100 }],
    });
    let resolved = false;
    const finishing = handle.finish().then(() => {
      resolved = true;
    });
    await vi.advanceTimersByTimeAsync(1_999);
    const returnedBeforeBound = resolved;
    await vi.advanceTimersByTimeAsync(1);
    await finishing;
    const terminal = await readFile(location('status.json'), 'utf8');
    pending.resolve({});
    f.trace.emit('Tracing.tracingComplete', { dataLossOccurred: false });
    f.trace.emit('Tracing.dataCollected', { value: [{ name: 'LATE' }] });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(earlyStops).toBe(1);
    expect(returnedBeforeBound).toBe(false);
    expect(JSON.parse(terminal).trace).toMatchObject({
      state: 'partial',
      stopReason: 'checkpoint',
      stopAcknowledgedAt: null,
      completeAt: null,
      retainedEvents: 1,
      stopError: expect.stringContaining('2000ms'),
    });
    expect(await readFile(location('status.json'), 'utf8')).toBe(terminal);
    expect(f.trace.send.mock.calls.filter(([method]) => method === 'Tracing.end')).toHaveLength(1);
    expect(f.trace.detach).toHaveBeenCalledTimes(1);
    expect(f.trace.eventNames()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['ack-only', 'complete-only'] as const)(
    'does not call a trace complete after %s',
    async (mode) => {
      vi.useFakeTimers();
      const f = fixture();
      f.trace.send.mockImplementation(async (method) => {
        if (method === 'Tracing.end' && mode === 'complete-only') {
          f.trace.emit('Tracing.tracingComplete', { dataLossOccurred: false });
          return new Promise<never>(() => {});
        }
        return {};
      });
      const handle = await startMatrixBrowserDiagnostic(f.browser, options());
      const finishing = handle.finish();
      await vi.advanceTimersByTimeAsync(2_000);
      await finishing;
      expect((await result()).trace.state).toBe('partial');
      expect(vi.getTimerCount()).toBe(0);
    }
  );

  it('keeps tracing when the independent CPU endpoint fails and preserves the owner error', async () => {
    const f = fixture();
    f.cpu.send.mockRejectedValue(new Error('injected CPU endpoint failure'));
    const handle = await startMatrixBrowserDiagnostic(f.browser, options());
    const original = new Error('original 60000ms initialization failure');
    const journey = async () => {
      try {
        throw original;
      } finally {
        await handle.finish();
      }
    };
    await expect(journey()).rejects.toBe(original);
    expect(await result()).toMatchObject({
      cpu: { state: 'unavailable', error: expect.stringContaining('injected CPU') },
      trace: { state: 'complete', dataLossOccurred: false },
    });
    expect(f.trace.eventNames()).toEqual([]);
  });

  it('finishes the already-started bounded cleanup of a failed CPU session', async () => {
    // Real timers keep the asynchronous filesystem independent from the held
    // protocol cleanup; advancing a fake 2s clock can also expire pending writes.
    const f = fixture();
    f.cpu.send.mockRejectedValue(new Error('injected CPU endpoint failure'));
    f.cpu.detach.mockImplementation(() => new Promise<never>(() => {}));
    const handle = await startMatrixBrowserDiagnostic(f.browser, options());
    await handle.finish();
    const facts = await result();
    expect(facts.elapsedMs).toBeGreaterThanOrEqual(1_900);
    expect(facts).toMatchObject({
      finished: true,
      cpu: { state: 'unavailable', detachState: 'unavailable' },
    });
    expect(f.cpu.detach).toHaveBeenCalledTimes(1);
  });

  it('does not resurrect a CPU sample that completes after its owner has finished', async () => {
    vi.useFakeTimers();
    const f = fixture();
    const pending = held<{ processInfo: Array<{ id: number; type: string; cpuTime: number }> }>();
    const original = f.cpu.send.getMockImplementation()!;
    let calls = 0;
    f.cpu.send.mockImplementation((method) => (++calls === 2 ? pending.promise : original(method)));
    const handle = await startMatrixBrowserDiagnostic(f.browser, options());
    await vi.advanceTimersByTimeAsync(5_000);
    const finishing = handle.finish();
    await vi.advanceTimersByTimeAsync(2_000);
    await finishing;
    const terminal = await readFile(location('status.json'), 'utf8');
    pending.resolve({ processInfo: [{ id: 11, type: 'renderer', cpuTime: 999 }] });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await readFile(location('status.json'), 'utf8')).toBe(terminal);
    expect((await result()).cpu.sampleCount).toBe(1);
    expect(calls).toBe(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retires late-created CPU and trace sessions without issuing probes', async () => {
    vi.useFakeTimers();
    const f = fixture();
    const cpu = held<unknown>(),
      trace = held<unknown>();
    f.create.mockReset().mockReturnValueOnce(cpu.promise).mockReturnValueOnce(trace.promise);
    const starting = startMatrixBrowserDiagnostic(f.browser, options());
    await vi.advanceTimersByTimeAsync(2_000);
    const handle = await starting;
    await handle.finish();
    const terminal = await readFile(location('status.json'), 'utf8');
    cpu.resolve(f.cpu);
    trace.resolve(f.trace);
    await vi.advanceTimersByTimeAsync(0);
    expect(f.cpu.send).not.toHaveBeenCalled();
    expect(f.trace.send).not.toHaveBeenCalled();
    expect(f.cpu.detach).toHaveBeenCalledTimes(1);
    expect(f.trace.detach).toHaveBeenCalledTimes(1);
    expect(await readFile(location('status.json'), 'utf8')).toBe(terminal);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps CPU evidence after held trace setup and ignores its late acknowledgement', async () => {
    vi.useFakeTimers();
    const f = fixture();
    const pending = held<Record<string, never>>();
    f.trace.send.mockImplementation(async (method) =>
      method === 'Tracing.start' ? pending.promise : {}
    );
    const starting = startMatrixBrowserDiagnostic(f.browser, options());
    await vi.advanceTimersByTimeAsync(7_000);
    const handle = await starting;
    const finishing = handle.finish();
    await vi.advanceTimersByTimeAsync(2_000);
    await finishing;
    const terminal = await readFile(location('status.json'), 'utf8');
    expect(JSON.parse(terminal)).toMatchObject({
      cpu: { sampleCount: 2 },
      trace: { state: 'unavailable' },
    });
    pending.resolve({});
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await readFile(location('status.json'), 'utf8')).toBe(terminal);
    expect(f.trace.send.mock.calls.filter(([method]) => method === 'Tracing.start')).toHaveLength(
      1
    );
    expect(f.trace.send.mock.calls.filter(([method]) => method === 'Tracing.end')).toHaveLength(1);
    expect(f.trace.eventNames()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('caps retained serialized trace bytes and marks truncation separately from protocol completion', async () => {
    const f = fixture();
    const handle = await startMatrixBrowserDiagnostic(f.browser, options());
    f.trace.emit('Tracing.dataCollected', {
      value: Array.from({ length: 70_000 }, (_, index) => ({
        name: 'x'.repeat(256),
        cat: 'v8.execute',
        ph: 'X',
        pid: 11,
        tid: 13,
        ts: index,
        dur: 1,
      })),
    });
    await handle.finish();
    const facts = await result();
    expect(facts.trace).toMatchObject({
      state: 'complete',
      outputTruncated: true,
      dataLossOccurred: false,
      receivedEvents: 70_000,
    });
    expect(facts.trace.retainedEvents).toBeLessThan(70_000);
    expect(facts.trace.retainedBytes).toBeLessThanOrEqual(16 * 1024 * 1024);
    expect((await stat(location('trace-0001.json'))).size).toBe(facts.trace.retainedBytes);
  });

  it('stops independent sessions at the original owner limit and never polls again', async () => {
    vi.useFakeTimers();
    const f = fixture();
    const handle = await startMatrixBrowserDiagnostic(f.browser, options());
    await vi.advanceTimersByTimeAsync(180_000);
    await handle.finish();
    const samples = f.cpu.send.mock.calls.length;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await result()).toMatchObject({
      finished: true,
      finishReason: 'diagnostic-deadline',
      elapsedMs: 180_000,
    });
    expect(f.cpu.send).toHaveBeenCalledTimes(samples);
    expect(f.trace.eventNames()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});

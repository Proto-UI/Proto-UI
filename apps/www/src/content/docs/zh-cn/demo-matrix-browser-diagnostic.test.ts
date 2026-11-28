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

describe('explicit timeline-only Matrix diagnosis', () => {
  const timelineLocation = (file: string) => join(directory, 'demo-matrix/browser-timeline', file);
  const timelineResult = async () =>
    JSON.parse(await readFile(timelineLocation('status.json'), 'utf8'));
  const timelineFixture = () => {
    const f = fixture();
    f.create.mockReset().mockResolvedValue(f.trace);
    return f;
  };

  it('uses one timeline-only session, preserves layout durations, and never samples CPU', async () => {
    vi.useFakeTimers();
    const f = timelineFixture();
    const handle = await startMatrixBrowserDiagnostic(f.browser, {
      ...options(),
      traceMode: 'timeline',
    });
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
          name: 'Layout',
          cat: 'devtools.timeline',
          ph: 'X',
          pid: 11,
          tid: 13,
          ts: 100,
          dur: 40,
          tts: 90,
          tdur: 31,
          args: {
            beginData: {
              dirtyObjects: 3,
              totalObjects: 47,
              partialLayout: false,
              secret: 'SYNTHETIC_SECRET',
            },
            data: { elementCount: 9, source: 'SYNTHETIC_SOURCE' },
            elementCount: 12,
            private: 'SYNTHETIC_PRIVATE',
          },
        },
      ],
    });
    await vi.advanceTimersByTimeAsync(20_000);
    await handle.finish();
    expect(f.create).toHaveBeenCalledTimes(1);
    expect(f.trace.send.mock.calls.map(([method]) => method)).toEqual([
      'Tracing.start',
      'Tracing.end',
    ]);
    const status = await timelineResult();
    expect(status).toMatchObject({
      diagnosticOnly: true,
      traceMode: 'timeline',
      cpu: { state: 'disabled-for-timeline', sampleCount: 0 },
      trace: {
        state: 'complete',
        requestedWindowMs: 20_000,
        categories: ['devtools.timeline', 'toplevel'],
        outputTruncated: false,
        retainedEvents: 2,
        chunks: 1,
        bufferedEvents: 0,
        bufferedBytes: 0,
      },
    });
    expect(f.cpu.send).not.toHaveBeenCalled();
    expect(f.trace.send).toHaveBeenCalledWith(
      'Tracing.start',
      expect.objectContaining({
        traceConfig: expect.objectContaining({
          includedCategories: ['devtools.timeline', 'toplevel'],
          excludedCategories: ['*'],
          enableSampling: false,
          traceBufferSizeInKb: 16_384,
        }),
      })
    );
    const raw = await readFile(timelineLocation('trace-0001.json'), 'utf8');
    expect(raw).not.toContain('SYNTHETIC_');
    expect(JSON.parse(raw).traceEvents[1]).toMatchObject({
      name: 'Layout',
      ts: 100,
      dur: 40,
      tts: 90,
      tdur: 31,
      args: {
        beginData: { dirtyObjects: 3, totalObjects: 47, partialLayout: false },
        data: { elementCount: 9 },
        elementCount: 12,
      },
    });
    expect(status.trace.retainedBytes).toBe(Buffer.byteLength(raw));
    expect(await readdir(join(directory, 'demo-matrix'))).toEqual(['browser-timeline']);
    expect(f.trace.detach).toHaveBeenCalledTimes(1);
    expect(f.trace.eventNames()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('packs small timeline-only deliveries without treating 300 callback batches as the chunk cap', async () => {
    vi.useFakeTimers();
    const f = timelineFixture();
    const handle = await startMatrixBrowserDiagnostic(f.browser, {
      ...options(),
      traceMode: 'timeline',
    });
    for (let i = 0; i < 300; i++)
      f.trace.emit('Tracing.dataCollected', {
        value: [
          {
            name: 'ThreadControllerImpl::RunTask',
            cat: 'toplevel',
            ph: 'X',
            pid: 11,
            tid: 13,
            ts: i * 10,
            dur: 5,
          },
        ],
      });
    await handle.finish();
    expect(f.create).toHaveBeenCalledTimes(1);
    const status = await timelineResult();
    expect(status.trace).toMatchObject({
      retainedEvents: 300,
      receivedEvents: 300,
      chunks: 1,
      outputTruncated: false,
      bufferedEvents: 0,
      bufferedBytes: 0,
    });
    const raw = await readFile(timelineLocation('trace-0001.json'), 'utf8');
    expect(JSON.parse(raw).traceEvents).toHaveLength(300);
    expect(status.trace.retainedBytes).toBe(Buffer.byteLength(raw));
  });

  it('keeps the original 2s timeline-only flush limit and rejects late completion/events', async () => {
    vi.useFakeTimers();
    const f = timelineFixture();
    f.trace.send.mockImplementation(async (method) =>
      method === 'Tracing.end' ? new Promise<never>(() => {}) : {}
    );
    const handle = await startMatrixBrowserDiagnostic(f.browser, {
      ...options(),
      traceMode: 'timeline',
    });
    f.trace.emit('Tracing.dataCollected', {
      value: [
        { name: 'UpdateLayoutTree', cat: 'devtools.timeline', ph: 'B', pid: 11, tid: 13, ts: 100 },
        {
          name: 'UpdateLayoutTree',
          cat: 'devtools.timeline',
          ph: 'E',
          pid: 11,
          tid: 13,
          ts: 140,
          args: { elementCount: 50 },
        },
      ],
    });
    await vi.advanceTimersByTimeAsync(20_000);
    let completed = false;
    const finish = handle.finish().then(() => {
      completed = true;
    });
    await vi.advanceTimersByTimeAsync(1_999);
    expect(completed).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await finish;
    expect(await timelineResult()).toMatchObject({
      commandLimitMs: 2_000,
      ownerLimitMs: 180_000,
      cpu: { state: 'disabled-for-timeline', sampleCount: 0 },
      trace: {
        state: 'partial',
        completeAt: null,
        retainedEvents: 2,
        chunks: 1,
        outputTruncated: false,
        bufferedEvents: 0,
        bufferedBytes: 0,
        error: expect.stringContaining('2000ms'),
      },
    });
    const raw = await readFile(timelineLocation('trace-0001.json'), 'utf8');
    expect(
      JSON.parse(raw).traceEvents.map(({ ph, ts }: { ph: string; ts: number }) => [ph, ts])
    ).toEqual([
      ['B', 100],
      ['E', 140],
    ]);
    const terminal = await readFile(timelineLocation('status.json'), 'utf8');
    f.trace.emit('Tracing.dataCollected', { value: [{ name: 'LATE' }] });
    f.trace.emit('Tracing.tracingComplete', { dataLossOccurred: false });
    await vi.advanceTimersByTimeAsync(180_000);
    expect(await readFile(timelineLocation('status.json'), 'utf8')).toBe(terminal);
    expect(f.trace.eventNames()).toEqual([]);
    expect(f.trace.detach).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps the original 16MiB/256-chunk timeline-only cap and marks a complete but truncated recording', async () => {
    vi.useFakeTimers();
    const f = timelineFixture();
    const handle = await startMatrixBrowserDiagnostic(f.browser, {
      ...options(),
      traceMode: 'timeline',
    });
    f.trace.emit('Tracing.dataCollected', {
      value: Array.from({ length: 60_000 }, (_, i) => ({
        name: `Layout-${i}`.padEnd(256, 'x'),
        cat: 'devtools.timeline',
        ph: 'X',
        pid: 11,
        tid: 13,
        ts: i * 10,
        dur: 5,
        tts: i * 9,
        tdur: 4,
        args: { beginData: { dirtyObjects: 3, totalObjects: 4756, partialLayout: false } },
      })),
    });
    await handle.finish();
    const status = await timelineResult();
    expect(status.trace).toMatchObject({
      state: 'complete',
      receivedEvents: 60_000,
      outputTruncated: true,
      bufferedEvents: 0,
      bufferedBytes: 0,
      bufferLimitBytes: 16 * 1024 * 1024,
      outputEventLimitBytes: 16 * 1024 * 1024,
      outputChunkLimit: 256,
    });
    expect(status.trace.retainedEvents).toBeLessThan(60_000);
    expect(status.trace.chunks).toBeLessThanOrEqual(256);
    expect(status.trace.retainedBytes).toBeLessThanOrEqual(16 * 1024 * 1024);
    const files = (await readdir(join(directory, 'demo-matrix/browser-timeline'))).filter((name) =>
      name.startsWith('trace-')
    );
    const sizes = await Promise.all(
      files.map(async (name) => (await stat(timelineLocation(name))).size)
    );
    expect(files).toHaveLength(status.trace.chunks);
    expect(sizes.reduce((sum, size) => sum + size, 0)).toBe(status.trace.retainedBytes);
  });
});

describe('explicit owned-browser Matrix diagnosis', () => {
  it('does not contact a browser, install timers or write files without explicit enablement', async () => {
    vi.useFakeTimers();
    const f = fixture();
    const handle = await startMatrixBrowserDiagnostic(f.browser, { ...options(), enabled: false });
    await handle.finish();
    expect(f.create).not.toHaveBeenCalled();
    expect(await readdir(directory)).toEqual([]);
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

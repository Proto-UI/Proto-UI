// @vitest-environment node
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryDispatchTrace } from './query-dispatch-trace.mjs';

const directories: string[] = [];
afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

async function fixture(
  options: { start?: () => Promise<void>; acquire?: Promise<any>; data?: string } = {}
) {
  const parent = await mkdtemp(path.join(tmpdir(), 'query-dispatch-'));
  directories.push(parent);
  const directory = path.join(parent, 'trace');
  const commands: Array<{ method: string; params: any }> = [];
  const session = Object.assign(new EventEmitter(), {
    detach: vi.fn(async () => {}),
    async send(method: string, params: any) {
      commands.push({ method, params });
      if (method === 'Tracing.start') await options.start?.();
      if (method === 'Tracing.end')
        queueMicrotask(() =>
          session.emit('Tracing.tracingComplete', { stream: 'owned', dataLossOccurred: false })
        );
      if (method === 'IO.read') return { data: options.data ?? '{"traceEvents":[]}', eof: true };
      return {};
    },
  });
  const acquire = vi.fn(() => options.acquire ?? Promise.resolve(session));
  const page: any = {
    context: () => ({
      browser: () => ({ version: () => 'test-version', newBrowserCDPSession: acquire }),
    }),
  };
  const recorder = createQueryDispatchTrace(page, directory);
  const report = async () =>
    JSON.parse(await readFile(path.join(directory, 'report.json'), 'utf8'));
  return { recorder, directory, commands, session, acquire, report };
}

describe('original query dispatch trace ownership', () => {
  it('records only trace commands and preserves the already frozen verdict', async () => {
    const f = await fixture();
    const observation = { verdict: { passed: true, nodeMs: 10 } };
    await f.recorder.prepare();
    f.recorder.markVerdict(observation);
    f.recorder.beforeContextClose();
    await f.recorder.finish(true, observation);
    const report = await f.report();
    expect(report.originalVerdict).toEqual(observation.verdict);
    expect(report.trace).toMatchObject({ complete: true, dataLossOccurred: false });
    expect(report.cleanup).toMatchObject({
      originalContextClosed: true,
      streamClosed: true,
      sessionDetached: true,
      unresolvedTraceOwnership: false,
    });
    expect(f.commands.map(({ method }) => method)).toEqual([
      'Tracing.start',
      'Tracing.recordClockSyncMarker',
      'Tracing.end',
      'IO.read',
      'IO.close',
    ]);
    expect(f.commands[0].params.traceConfig.includedCategories).toContain('devtools');
    expect(f.commands[0].params.traceConfig.includedCategories).toContain('devtools.timeline');
    expect(f.session.listenerCount('Tracing.tracingComplete')).toBe(0);
  });

  it('detaches after an acknowledged start rejection without sending trace end', async () => {
    const f = await fixture({
      start: async () => {
        throw new Error('another trace owns the browser');
      },
    });
    await f.recorder.prepare();
    await f.recorder.finish(true, { verdict: { passed: false } });
    expect(f.commands.map(({ method }) => method)).toEqual(['Tracing.start']);
    expect(f.session.detach).toHaveBeenCalledOnce();
    const report = await f.report();
    expect(report.cleanup.unresolvedTraceOwnership).toBe(false);
    expect(report.trace.complete).toBe(false);
    expect(report.errors.some((error: any) => error.reason.includes('another trace'))).toBe(true);
  });

  it('keeps a timed-out pending start owned and closes its stream after the late ACK', async () => {
    let acknowledge!: () => void;
    let startCalled!: () => void;
    const called = new Promise<void>((resolve) => {
      startCalled = resolve;
    });
    const pending = new Promise<void>((resolve) => {
      acknowledge = resolve;
    });
    const f = await fixture({
      start: () => {
        startCalled();
        return pending;
      },
    });
    vi.useFakeTimers();
    const prepare = f.recorder.prepare();
    await called;
    await vi.advanceTimersByTimeAsync(8000);
    await prepare;
    const finish = f.recorder.finish(true, { verdict: { passed: false } });
    await vi.advanceTimersByTimeAsync(2000);
    await finish;
    expect((await f.report()).cleanup.unresolvedTraceOwnership).toBe(true);
    expect(f.session.detach).not.toHaveBeenCalled();
    vi.useRealTimers();
    acknowledge();
    await vi.waitFor(() =>
      expect(existsSync(path.join(f.directory, 'late-cleanup.json'))).toBe(true)
    );
    const late = JSON.parse(await readFile(path.join(f.directory, 'late-cleanup.json'), 'utf8'));
    expect(late).toEqual({ streamClosed: true, sessionDetached: true, errors: [] });
    expect(f.commands.map(({ method }) => method)).toEqual([
      'Tracing.start',
      'Tracing.end',
      'IO.close',
    ]);
  });

  it('does not overwrite an existing evidence directory or start a second trace', async () => {
    const f = await fixture();
    await f.recorder.prepare();
    const duplicate = createQueryDispatchTrace(
      {
        context: () => ({
          browser: () => ({ version: () => 'test', newBrowserCDPSession: f.acquire }),
        }),
      } as any,
      f.directory
    );
    await duplicate.prepare();
    await duplicate.finish(true, {});
    expect(f.acquire).toHaveBeenCalledOnce();
    expect(existsSync(path.join(f.directory, 'report.json'))).toBe(false);
    await f.recorder.finish(true, {});
  });

  it('bounds session acquisition and detaches a late session without starting a trace', async () => {
    let acquire!: (session: any) => void;
    const pending = new Promise((resolve) => {
      acquire = resolve;
    });
    const f = await fixture({ acquire: pending });
    vi.useFakeTimers();
    const prepare = f.recorder.prepare();
    await vi.waitFor(() => expect(f.acquire).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(8000);
    await prepare;
    const finish = f.recorder.finish(true, {});
    await vi.advanceTimersByTimeAsync(2000);
    await finish;
    expect((await f.report()).cleanup.unresolvedTraceOwnership).toBe(true);
    vi.useRealTimers();
    acquire(f.session);
    await vi.waitFor(() =>
      expect(existsSync(path.join(f.directory, 'late-cleanup.json'))).toBe(true)
    );
    expect(f.session.detach).toHaveBeenCalledOnce();
    expect(f.commands).toEqual([]);
  });

  it('marks an oversized stream incomplete and still closes the owned stream', async () => {
    const f = await fixture({ data: 'x'.repeat(32 * 1024 * 1024 + 1) });
    await f.recorder.prepare();
    await f.recorder.finish(true, {});
    const report = await f.report();
    expect(report.trace).toMatchObject({ complete: false, bytes: 32 * 1024 * 1024 });
    expect(report.cleanup).toMatchObject({ streamClosed: true, sessionDetached: true });
    expect(
      report.errors.some((error: any) => error.reason.includes('retained prefix is incomplete'))
    ).toBe(true);
  });

  it('cleans a late start even when writing the main report fails', async () => {
    let acknowledge!: () => void;
    let startCalled!: () => void;
    const called = new Promise<void>((resolve) => {
      startCalled = resolve;
    });
    const pending = new Promise<void>((resolve) => {
      acknowledge = resolve;
    });
    const f = await fixture({
      start: () => {
        startCalled();
        return pending;
      },
    });
    vi.useFakeTimers();
    const prepare = f.recorder.prepare();
    await called;
    await mkdir(path.join(f.directory, 'report.json'));
    await vi.advanceTimersByTimeAsync(8000);
    await prepare;
    const finish = f.recorder.finish(true, {});
    const rejected = expect(finish).rejects.toThrow('EISDIR');
    await vi.advanceTimersByTimeAsync(2000);
    await rejected;
    vi.useRealTimers();
    acknowledge();
    await vi.waitFor(() =>
      expect(existsSync(path.join(f.directory, 'late-cleanup.json'))).toBe(true)
    );
    expect(f.session.detach).toHaveBeenCalledOnce();
    expect(f.commands.map(({ method }) => method)).toEqual([
      'Tracing.start',
      'Tracing.end',
      'IO.close',
    ]);
  });
});

// @vitest-environment node
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nativeDelayArtifact, nativePresenceArtifact } from '../src/native-async';
import { writeArtifactSet } from '../src/artifact-output';

const directories: string[] = [];
afterEach(async () => {
  vi.useRealTimers();
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

async function modules() {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'generated-modules');
  await mkdir(root, { recursive: true });
  const temp = await mkdtemp(path.join(root, 'async-atoms-'));
  directories.push(temp);
  const output = path.join(temp, 'output');
  const result = await writeArtifactSet([nativeDelayArtifact, nativePresenceArtifact], output);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  const delayPath = path.join(output, nativeDelayArtifact.path),
    presencePath = path.join(output, nativePresenceArtifact.path);
  return {
    delay: await import(/* @vite-ignore */ delayPath),
    presence: await import(/* @vite-ignore */ presencePath),
  };
}

describe('independent native async atoms', () => {
  it('schedules zero delay after the stack and preserves callback context, cancellation and diagnostic ownership', async () => {
    const { delay } = await modules();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    let phase = 'callback';
    const trace: string[] = [];
    const failures: unknown[] = [];
    const owner = delay.createNativeDelay({
      runtime() {
        if (phase !== 'callback') throw new Error('runtime phase');
      },
      alive: () => true,
      invoke(callback: () => void) {
        const prior = phase;
        phase = 'callback';
        try {
          callback();
        } finally {
          phase = prior;
        }
      },
      report: (error: unknown) => failures.push(error),
    });
    owner.schedule(0, () => {
      trace.push(phase);
    });
    trace.push('sync');
    phase = 'idle';
    expect(trace).toEqual(['sync']);
    vi.advanceTimersByTime(0);
    expect(trace).toEqual(['sync', 'callback']);
    phase = 'callback';
    const cancelled = owner.schedule(4, () => trace.push('cancelled'));
    cancelled.cancel();
    cancelled.cancel();
    const failure = new Error('authored failure');
    owner.schedule(3, () => {
      throw failure;
    });
    phase = 'idle';
    vi.advanceTimersByTime(4);
    expect(failures).toEqual([failure]);
    expect(trace).toEqual(['sync', 'callback']);
    expect(() => owner.schedule(1, () => {})).toThrow('runtime phase');
    phase = 'callback';
    expect(() => owner.schedule(-1, () => {})).toThrow(/non-negative/);
    expect(() => owner.schedule(Infinity, () => {})).toThrow(/finite/);
    owner.schedule(10, () => trace.push('disposed'));
    owner.dispose();
    owner.dispose();
    vi.advanceTimersByTime(20);
    expect(vi.getTimerCount()).toBe(0);
    expect(trace).toEqual(['sync', 'callback']);
  });

  it('never lets native timer overflow execute a long delay early and retires view-owned tasks', async () => {
    const { delay } = await modules();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const callback = vi.fn();
    const owner = delay.createNativeDelay({
      runtime() {},
      alive: () => true,
      invoke: (fn: () => void) => fn(),
      report: (error: unknown) => {
        throw error;
      },
    });
    owner.schedule(2147483650, callback);
    vi.advanceTimersByTime(2147483647);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3);
    expect(callback).toHaveBeenCalledTimes(1);
    owner.schedule(5, callback);
    owner.cancelView();
    vi.advanceTimersByTime(6);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps presentation authority nominal and invalidates exact receipts on replacement, detach and disposal', async () => {
    const { presence } = await modules();
    let phase = 'setup';
    const run = {};
    const receipts: any[] = [];
    const registry = presence.createNativePresence({
      setup() {
        if (phase !== 'setup') throw new Error('setup phase');
      },
      runtime() {
        if (phase !== 'callback') throw new Error('callback phase');
      },
      alive: () => true,
      invoke: (fn: (run: object) => void) => fn(run),
    });
    const owner = registry.owner();
    owner.onCompletionRequest((receivedRun: object, request: { receipt: object }) => {
      expect(receivedRun).toBe(run);
      receipts.push(request.receipt);
    });
    phase = 'callback';
    const frame = {
      owner: owner.ref,
      revision: 1,
      phase: 'entering',
      attempt: { ownerEpoch: 1, phaseAttempt: 1 },
      completion: 'presentation',
      durationMs: 1,
      timeoutMs: 5,
    };
    registry.publish(owner.writer, frame);
    registry.settle(owner.writer, 'finished');
    expect(receipts).toHaveLength(1);
    expect(receipts[0].outcome).toBe('missing-capability');
    expect(registry.isCurrent(owner.writer, receipts[0])).toBe(true);
    expect(registry.isCurrent(owner.writer, { ...receipts[0] })).toBe(false);
    expect(() => registry.publish({}, frame)).toThrow(/foreign/);
    expect(() => registry.publish(owner.writer, { ...frame, owner: {} })).toThrow(/foreign/);
    registry.publish(owner.writer, { ...frame, revision: 2 });
    expect(registry.isCurrent(owner.writer, receipts[0])).toBe(false);
    registry.settle(owner.writer, 'deadline');
    expect(receipts).toHaveLength(2);
    registry.detach();
    expect(registry.isCurrent(owner.writer, receipts[1])).toBe(false);
    registry.dispose();
    expect(() => registry.publish(owner.writer, { ...frame, revision: 3 })).toThrow(/disposed/);
  });

  it('snapshots completion data without evaluating accessors or accepting undeclared fields', async () => {
    const { presence } = await modules();
    let reads = 0;
    expect(() =>
      presence.snapshotNativeCompletion({
        kind: 'presentation',
        get timeoutMs() {
          reads++;
          return 5;
        },
      })
    ).toThrow(/data fields/);
    expect(reads).toBe(0);
    expect(() =>
      presence.snapshotNativeCompletion({ kind: 'presentation', timeoutMs: 5, extra: true })
    ).toThrow(/shape/);
    const config = { kind: 'presentation', timeoutMs: 5 };
    const snapshot = presence.snapshotNativeCompletion(config);
    config.timeoutMs = 8;
    expect(snapshot.timeoutMs).toBe(5);
    expect(Object.isFrozen(snapshot)).toBe(true);
  });
});

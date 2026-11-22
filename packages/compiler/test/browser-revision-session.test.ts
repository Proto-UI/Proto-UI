// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  CompiledRevisionSession,
  type RevisionOwner,
  type RevisionState,
} from '../../../apps/www/src/components/PrototypePreviewer/compiled-revision-session';
import type { BrowserCompileRequest, BrowserCompileResult } from '../src/browser/protocol';

const deferred = <T>() => {
  let resolve!: (value: T) => void, reject!: (value: unknown) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const request = (revision: string) =>
  ({
    format: 1,
    revision,
    source: '',
    options: { fileName: 'x.ts', profile: 'web-component-source-v1' },
  }) as BrowserCompileRequest;
const success = (revision: string) =>
  ({
    ok: true,
    revision,
    requestSha256: '0'.repeat(64),
    source: {},
    output: {},
  }) as BrowserCompileResult;
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('compiled revision owner coordination', () => {
  it('retires the previous owner before mounting a new revision and ignores old completions', async () => {
    const calls: string[] = [],
      states: RevisionState[] = [];
    const pending = new Map<string, ReturnType<typeof deferred<BrowserCompileResult>>>();
    const retirement = deferred<void>();
    const session = new CompiledRevisionSession({
      compile(input) {
        const value = deferred<BrowserCompileResult>();
        pending.set(input.revision, value);
        return value.promise;
      },
      async prepare(result) {
        return () => {
          calls.push(`mount:${result.revision}`);
          return {
            ready: Promise.resolve(),
            dispose() {
              calls.push(`dispose:${result.revision}`);
              return result.revision === '1' ? retirement.promise : Promise.resolve();
            },
          };
        };
      },
      state(value) {
        states.push(value);
      },
      disposeCompiler() {
        calls.push('stop');
      },
    });
    const one = session.compile(request('1'));
    pending.get('1')!.resolve(success('1'));
    await one;
    const two = session.compile(request('2'));
    const three = session.compile(request('3'));
    pending.get('3')!.resolve(success('3'));
    await tick();
    expect(calls).toEqual(['mount:1', 'dispose:1']);
    retirement.resolve();
    await three;
    pending.get('2')!.resolve(success('2'));
    await two;
    expect(calls).toEqual(['mount:1', 'dispose:1', 'mount:3']);
    expect(states.filter((row) => row.phase === 'ready').map((row) => row.revision)).toEqual([
      '1',
      '3',
    ]);
    await session.dispose();
    expect(calls.slice(-2)).toEqual(['stop', 'dispose:3']);
  });

  it('does not mount after a disposal or stale asynchronous target preparation', async () => {
    const preparation = deferred<() => RevisionOwner>();
    const states: RevisionState[] = [];
    let mounts = 0,
      stops = 0;
    const session = new CompiledRevisionSession({
      compile: async (input) => success(input.revision),
      prepare: () => preparation.promise,
      state: (value) => states.push(value),
      disposeCompiler: () => stops++,
    });
    const work = session.compile(request('1'));
    await tick();
    await session.dispose();
    preparation.resolve(() => {
      mounts++;
      return { ready: Promise.resolve(), dispose: async () => {} };
    });
    await work;
    expect(mounts).toBe(0);
    expect(stops).toBe(1);
    expect(states.at(-1)?.phase).toBe('disposed');
  });

  it('clears a failed mount, recovers with a fresh owner and ignores a retired owner failure', async () => {
    const states: RevisionState[] = [],
      disposed: string[] = [];
    const session = new CompiledRevisionSession({
      compile: async (input) => success(input.revision),
      prepare: async (result) => () => ({
        ready:
          result.revision === 'bad' ? Promise.reject(new Error('mount failed')) : Promise.resolve(),
        dispose: async () => {
          disposed.push(result.revision);
        },
      }),
      state: (value) => states.push(value),
      disposeCompiler() {},
    });
    await session.compile(request('bad'));
    expect(states.at(-1)?.phase).toBe('failed');
    expect(disposed).toEqual(['bad']);
    await session.compile(request('good'));
    session.fail('bad', new Error('old failure'));
    expect(states.at(-1)).toMatchObject({ phase: 'ready', revision: 'good' });
    await session.dispose();
  });

  it('reports a failed retirement and prevents replacement activation until a fresh session', async () => {
    const states: RevisionState[] = [],
      mounted: string[] = [];
    const retirement = deferred<void>();
    const nextResult = deferred<BrowserCompileResult>();
    const session = new CompiledRevisionSession({
      compile: (input) =>
        input.revision === '1' ? Promise.resolve(success('1')) : nextResult.promise,
      prepare: async (result) => () => {
        mounted.push(result.revision);
        return { ready: Promise.resolve(), dispose: () => retirement.promise };
      },
      state: (value) => states.push(value),
      disposeCompiler() {},
    });
    await session.compile(request('1'));
    const work = session.compile(request('2'));
    retirement.reject(new Error('retained resource cleanup failed'));
    // Retirement may settle before a slow compiler response; its rejection is
    // retained without becoming an unhandled rejection during that interval.
    await tick();
    nextResult.resolve(success('2'));
    await work;
    expect(mounted).toEqual(['1']);
    expect(states.at(-1)).toMatchObject({
      phase: 'failed',
      revision: '2',
      message: 'retained resource cleanup failed',
    });
    await expect(session.dispose()).rejects.toThrow('retained resource cleanup failed');
  });
});

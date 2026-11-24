// @vitest-environment node
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import {
  nativeDelayArtifact,
  nativeHostAtomPlan,
  nativeMetaSubscriptionArtifact,
} from '../src/native-async';
import { nativeStyleArtifact } from '../src/native-style';

async function load(contents: string) {
  const code = ts.transpileModule(contents, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  return import(
    /* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  );
}

const base = {
  ensureSetup() {},
  ensureRuntime() {},
  isAlive: () => true,
  project: (_tokens: readonly string[]) => {},
};
const large = { kind: 'tw', tokens: ['text-lg'], groups: ['font-size'] };
const capture = (callback: () => void) => {
  try {
    callback();
    return { failed: false };
  } catch (error) {
    return { failed: true, error };
  }
};

describe('generated native Style owner resources', () => {
  it('keeps the additional viewport reader authoritative beside color and preference sources', async () => {
    const { createNativeStyle } = await load(nativeStyleArtifact.contents);
    const plan = nativeHostAtomPlan([], 'test', ['colorScheme', 'preference.forcedColors']);
    const options = new Function(
      'testReadMeta',
      'testReadPreference',
      'testSubscribeColorScheme',
      'testSubscribePreferences',
      'testReleaseMeta',
      'document',
      `return {${plan.ruleMeta('document', false)}}`
    )(
      (doc: { width: number }, key: string) => (key === 'colorScheme' ? 'dark' : doc.width),
      () => 'active',
      () => () => {},
      () => () => {},
      () => {},
      { width: 1024 }
    );
    const extraRead = vi.fn(() => 'unknown');
    const style = createNativeStyle({
      ...base,
      ...options,
      meta: { read: extraRead, subscribe: () => () => {} },
    });
    expect(style.meta('viewport.width')).toBe('unknown');
    style.mount();
    expect(style.meta('colorScheme')).toBe('dark');
    expect(style.meta('preference.forcedColors')).toBe('active');
    expect(style.meta('viewport.width')).toBe('unknown');
    expect(extraRead).toHaveBeenCalledWith('viewport.width');
    style.unmount();
    expect(style.meta('viewport.width')).toBe('unknown');
    style.dispose();
  });

  it('acquires one logical Meta lease for root and decoration Rules, including child-only dependencies', async () => {
    const { createNativeStyle } = await load(nativeStyleArtifact.contents);
    const requests: readonly string[][] = [];
    let active = false,
      releases = 0,
      invalidated: (() => void) | undefined,
      width = 900;
    const style = createNativeStyle({
      ...base,
      meta: {
        read: () => (active ? width : 'unknown'),
        subscribe(notify: () => void, keys: string[]) {
          if (active) throw new Error('one mounted lease per logical owner');
          active = true;
          (requests as string[][]).push(keys);
          invalidated = notify;
          return () => {
            active = false;
            releases++;
          };
        },
      },
    });
    const target = style.declareDecoration(),
      sink = vi.fn();
    style.rule(() => style.meta('viewport.width') >= 768, [large], ['viewport.width'], target);
    style.bindDecorations([{ target, sink }]);
    style.mount();
    expect(requests).toEqual([['viewport.width']]);
    expect(sink).toHaveBeenLastCalledWith({ kind: 'tw', tokens: ['text-lg'] });
    width = 700;
    invalidated!();
    expect(sink).toHaveBeenLastCalledWith({ kind: 'tw', tokens: [] });
    const oldNotify = invalidated!;
    style.unmount();
    expect(releases).toBe(1);
    const calls = sink.mock.calls.length;
    oldNotify();
    expect(sink).toHaveBeenCalledTimes(calls);
    style.bindDecorations([{ target, sink }]);
    style.mount();
    expect(requests).toEqual([['viewport.width'], ['viewport.width']]);
    style.dispose();
    expect(releases).toBe(2);
  });

  it('rolls back every acquired subscription while preserving a falsy initiating failure', async () => {
    const { createNativeStyle } = await load(nativeStyleArtifact.contents);
    let releases = 0;
    const style = createNativeStyle({
      ...base,
      subscribeMeta: () => () => {
        releases++;
        throw new Error('secondary release');
      },
      meta: {
        read: () => undefined,
        subscribe() {
          throw undefined;
        },
      },
    });
    expect(capture(() => style.mount())).toEqual({ failed: true, error: undefined });
    expect(releases).toBe(1);
    expect(capture(() => style.dispose())).toEqual({ failed: false });
    expect(releases).toBe(1);
  });

  it('retires all physical decoration sinks even when source release fails', async () => {
    const { createNativeStyle } = await load(nativeStyleArtifact.contents);
    let acquired = 0,
      released = 0;
    const callbacks: (() => void)[] = [];
    const style = createNativeStyle({
      ...base,
      subscribeMeta(notify: () => void) {
        acquired++;
        callbacks.push(notify);
        return () => {
          released++;
          throw undefined;
        };
      },
    });
    const first = style.declareDecoration(),
      second = style.declareDecoration();
    const firstSink = vi.fn(),
      secondSink = vi.fn();
    style.bindDecorations([
      { target: first, sink: firstSink },
      { target: second, sink: secondSink },
    ]);
    style.mount();
    expect(acquired).toBe(1);
    const calls = [firstSink.mock.calls.length, secondSink.mock.calls.length];
    expect(capture(() => style.unmount())).toEqual({ failed: true, error: undefined });
    expect(released).toBe(acquired);
    for (const callback of callbacks) callback();
    style.refresh();
    expect([firstSink.mock.calls.length, secondSink.mock.calls.length]).toEqual(calls);
    expect(capture(() => style.dispose())).toEqual({ failed: false });
  });

  it('does not acquire duplicate sources when subscription synchronously reenters mount', async () => {
    const { createNativeStyle } = await load(nativeStyleArtifact.contents);
    let acquired = 0,
      released = 0;
    const style = createNativeStyle({
      ...base,
      subscribeMeta() {
        acquired++;
        if (acquired === 1) style.mount();
        return () => {
          released++;
        };
      },
    });
    style.mount();
    style.dispose();
    expect(acquired).toBe(1);
    expect(released).toBe(acquired);
  });

  it('keeps a reentrant remount after all old sources have retired', async () => {
    const { createNativeStyle } = await load(nativeStyleArtifact.contents);
    let active = false,
      acquired = 0,
      released = 0,
      reenter = true;
    const style = createNativeStyle({
      ...base,
      subscribeMeta: () => () => {
        if (reenter) {
          reenter = false;
          style.mount();
        }
      },
      meta: {
        read: () => (active ? 900 : 'unknown'),
        subscribe() {
          if (active) throw new Error('old extra source is still active');
          active = true;
          acquired++;
          return () => {
            active = false;
            released++;
          };
        },
      },
    });
    style.mount();
    style.unmount();
    expect([acquired, released, active]).toEqual([2, 1, true]);
    expect(style.meta('viewport.width')).toBe(900);
    style.dispose();
    expect([acquired, released, active]).toEqual([2, 2, false]);
  });
});

it('preserves the first native Meta release value and still attempts later releases', async () => {
  const { releaseNativeMeta } = await load(nativeMetaSubscriptionArtifact.contents);
  const calls: number[] = [];
  const result = capture(() =>
    releaseNativeMeta([
      () => {
        calls.push(1);
        throw undefined;
      },
      () => {
        calls.push(2);
        throw new Error('later');
      },
      () => {
        calls.push(3);
      },
    ])
  );
  expect(result).toEqual({ failed: true, error: undefined });
  expect(calls).toEqual([1, 2, 3]);
});

it('attempts every reached native atom retirement and retains the initiating thrown value', () => {
  const plan = nativeHostAtomPlan(
    ['scheduler.delay', 'feedback.style.presence', 'feedback.material.shader'],
    'test',
    [],
    ['copy-rgba8-v1']
  );
  for (const operation of ['detach', 'dispose'] as const) {
    const calls: string[] = [];
    const invoke = new Function('testDelay', 'testPresence', 'testShader', plan[operation]);
    const result = capture(() =>
      invoke(
        {
          cancelView() {
            calls.push('delay');
            throw 0;
          },
          dispose() {
            calls.push('delay');
            throw 0;
          },
        },
        {
          detach() {
            calls.push('presence');
            throw new Error('secondary');
          },
          dispose() {
            calls.push('presence');
            throw new Error('secondary');
          },
        },
        {
          detach() {
            calls.push('shader');
          },
          dispose() {
            calls.push('shader');
          },
        }
      )
    );
    expect(result).toEqual({ failed: true, error: 0 });
    expect(calls).toEqual(['delay', 'presence', 'shader']);
  }
});

it('cancels every acquired Delay even when multiple native timer releases throw', async () => {
  const { createNativeDelay } = await load(nativeDelayArtifact.contents);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  try {
    for (const operation of ['cancelView', 'dispose'] as const) {
      const calls: number[] = [],
        delivered = vi.fn();
      const nativeClear = globalThis.clearTimeout;
      const cancel = vi.spyOn(globalThis, 'clearTimeout').mockImplementation((timer) => {
        nativeClear(timer);
        calls.push(calls.length + 1);
        if (calls.length === 1) throw 0;
        if (calls.length === 2) throw new Error('later release');
      });
      const delay = createNativeDelay({
        runtime() {},
        alive: () => true,
        invoke: (callback: () => void) => callback(),
        report() {},
      });
      for (const duration of [10, 20, 30]) delay.schedule(duration, delivered);
      expect(capture(() => delay[operation]())).toEqual({ failed: true, error: 0 });
      expect(calls).toEqual([1, 2, 3]);
      vi.advanceTimersByTime(100);
      expect(delivered).not.toHaveBeenCalled();
      expect(capture(() => delay.dispose())).toEqual({ failed: false });
      cancel.mockRestore();
    }
  } finally {
    vi.restoreAllMocks();
    vi.useRealTimers();
  }
});

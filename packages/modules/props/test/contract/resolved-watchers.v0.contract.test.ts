import { describe, expect, it } from 'vitest';

import type { ProtoPhase } from '@proto.ui/core';
import type { PropsSpecMap } from '@proto.ui/types';

import { PropsModuleImpl } from '../../src/impl';
import { RAW_PROPS_SOURCE_CAP } from '../../src/caps';

function createModule<P extends Record<string, any>>() {
  const caps = {
    onChange: (_fn: (epoch: number) => void) => {},
    has: (_k: string) => false,
    get: (_k: string) => undefined,
  } as any;

  return new PropsModuleImpl<P>(caps, 'test-proto');
}

function drain(mod: PropsModuleImpl<any>) {
  return mod.consumeTasks();
}

function executeResolvedTasks(mod: PropsModuleImpl<any>) {
  const tasks = drain(mod).filter((task) => task.kind === 'resolved');
  const run = { kind: 'run' } as any;

  for (const task of tasks) {
    task.cb(run, task.next, task.prev, task.info);
  }

  return tasks;
}

describe('props: resolved watchers (T-PROPS-0007)', () => {
  it('T-PROPS-0007-CASE-REGISTRATION-SURFACE / C-PROPS-0011-A,F: registration is setup-only and declared-key scoped', () => {
    type P = { value: number };

    const beforeDefine = createModule<P>();
    expect(() => beforeDefine.watchKeys(['value'], () => {})).toThrow(/define/i);

    const pm = createModule<P>();
    pm.define({ value: { type: 'number' } } satisfies PropsSpecMap<P>);

    expect(() => pm.watchKeys([], () => {})).toThrow(/non-empty/i);
    expect(() => pm.watchKeys(['unknown'] as any, () => {})).toThrow(/undeclared/i);

    const unsubscribeAll = pm.watchAllKeys(() => {});
    const unsubscribeKeyed = pm.watchKeys(['value'], () => {});
    expect(typeof unsubscribeAll).toBe('function');
    expect(typeof unsubscribeKeyed).toBe('function');

    const runtime = createModule<P>();
    runtime.define({ value: { type: 'number' } } satisfies PropsSpecMap<P>);
    runtime.onProtoPhase('mounted' satisfies ProtoPhase);

    expect(() => runtime.watchAllKeys(() => {})).toThrow(/illegal phase/i);
    expect(() => runtime.watchKeys(['value'], () => {})).toThrow(/illegal phase/i);
  });

  it('T-PROPS-0007-CASE-HYDRATION-SKIP / C-PROPS-0011-B: hydration does not trigger resolved watchers', () => {
    type P = { value: number };
    const pm = createModule<P>();
    pm.define({ value: { type: 'number' } } satisfies PropsSpecMap<P>);

    let watchAllCalls = 0;
    let watchKeyCalls = 0;
    pm.watchAllKeys(() => watchAllCalls++);
    pm.watchKeys(['value'], () => watchKeyCalls++);

    pm.applyRaw({ value: 1 });

    expect(drain(pm)).toEqual([]);
    expect(watchAllCalls).toBe(0);
    expect(watchKeyCalls).toBe(0);
  });

  it('T-PROPS-0007-CASE-RESOLVED-DIFF-ONLY / C-PROPS-0011-C: raw-only changes do not trigger resolved watchers', () => {
    type P = { value: number };
    const pm = createModule<P>();
    pm.define({ value: { type: 'number', default: 1 } } satisfies PropsSpecMap<P>);

    let calls = 0;
    pm.watchAllKeys(() => calls++);

    pm.applyRaw({ value: 1, extra: 1 } as any);
    expect(drain(pm)).toEqual([]);

    pm.applyRaw({ value: 1, extra: 2 } as any);
    executeResolvedTasks(pm);

    expect(calls).toBe(0);
  });

  it('T-PROPS-0007-CASE-OBJECT-IS-DIFF / C-PROPS-0011-D: resolved watcher diffs use Object.is', () => {
    type P = { value: number; objectValue: { count: number } };
    const pm = createModule<P>();
    pm.define({
      value: { type: 'number' },
      objectValue: { type: 'object' },
    } satisfies PropsSpecMap<P>);

    const objectValue = { count: 1 };
    const changedKeys: string[][] = [];
    pm.watchAllKeys((_run, _next, _prev, info) => {
      changedKeys.push([...info.changedKeysAll].sort());
    });

    pm.applyRaw({ value: -0, objectValue });
    expect(drain(pm)).toEqual([]);

    pm.applyRaw({ value: -0, objectValue });
    executeResolvedTasks(pm);
    expect(changedKeys).toEqual([]);

    pm.applyRaw({ value: 0, objectValue });
    executeResolvedTasks(pm);
    expect(changedKeys).toEqual([['value']]);

    pm.applyRaw({ value: 0, objectValue: { count: 1 } });
    executeResolvedTasks(pm);
    expect(changedKeys).toEqual([['value'], ['objectValue']]);
  });

  it('T-PROPS-0007-CASE-WATCH-ALL / C-PROPS-0011-E: watchAll observes any changed declared key', () => {
    type P = { a: number; b: number };
    const pm = createModule<P>();
    pm.define({
      a: { type: 'number' },
      b: { type: 'number' },
    } satisfies PropsSpecMap<P>);

    let calls = 0;
    let lastMatched: string[] = [];
    pm.watchAllKeys((_run, _next, _prev, info) => {
      calls++;
      lastMatched = [...info.changedKeysMatched].sort();
    });

    pm.applyRaw({ a: 1, b: 1 });
    expect(drain(pm)).toEqual([]);

    pm.applyRaw({ a: 2, b: 1 });
    executeResolvedTasks(pm);

    expect(calls).toBe(1);
    expect(lastMatched).toEqual(['a']);
  });

  it('T-PROPS-0007-CASE-WATCH-KEYS / C-PROPS-0011-F: watch(keys) observes changed watched keys only', () => {
    type P = { a: number; b: number; c: number };
    const pm = createModule<P>();
    pm.define({
      a: { type: 'number' },
      b: { type: 'number' },
      c: { type: 'number' },
    } satisfies PropsSpecMap<P>);

    let calls = 0;
    let lastMatched: string[] = [];
    pm.watchKeys(['a', 'b'], (_run, _next, _prev, info) => {
      calls++;
      lastMatched = [...info.changedKeysMatched].sort();
    });

    pm.applyRaw({ a: 1, b: 1, c: 1 });
    expect(drain(pm)).toEqual([]);

    pm.applyRaw({ a: 1, b: 1, c: 2 });
    expect(executeResolvedTasks(pm)).toEqual([]);
    expect(calls).toBe(0);

    pm.applyRaw({ a: 1, b: 2, c: 2 });
    executeResolvedTasks(pm);

    expect(calls).toBe(1);
    expect(lastMatched).toEqual(['b']);
  });

  it('T-PROPS-0007-CASE-CALLBACK-SNAPSHOTS / C-PROPS-0011-G: callbacks receive previous and next resolved snapshots', () => {
    type P = { value: number };
    const pm = createModule<P>();
    pm.define({ value: { type: 'number' } } satisfies PropsSpecMap<P>);

    const snapshots: Array<{ prev: P; next: P }> = [];
    pm.watchAllKeys((_run, next, prev) => {
      snapshots.push({ prev, next });
    });

    pm.applyRaw({ value: 1 });
    expect(drain(pm)).toEqual([]);

    pm.applyRaw({ value: 2 });
    executeResolvedTasks(pm);

    expect(snapshots).toEqual([{ prev: { value: 1 }, next: { value: 2 } }]);
  });

  it('T-PROPS-0007-CASE-CHANGE-INFO / C-PROPS-0011-H: WatchInfo reports all and matched changed keys', () => {
    type P = { a: number; b: number; c: number };
    const pm = createModule<P>();
    pm.define({
      a: { type: 'number' },
      b: { type: 'number' },
      c: { type: 'number' },
    } satisfies PropsSpecMap<P>);

    let changedAll: string[] = [];
    let changedMatched: string[] = [];
    pm.watchKeys(['a', 'b'], (_run, _next, _prev, info) => {
      changedAll = [...info.changedKeysAll].sort();
      changedMatched = [...info.changedKeysMatched].sort();
    });

    pm.applyRaw({ a: 1, b: 1, c: 1 });
    expect(drain(pm)).toEqual([]);

    pm.applyRaw({ a: 2, b: 1, c: 2 });
    executeResolvedTasks(pm);

    expect(changedAll).toEqual(['a', 'c']);
    expect(changedMatched).toEqual(['a']);
  });

  it('T-PROPS-0007-CASE-DISPATCH-COALESCING / C-PROPS-0011-I: coalesced dispatch observes first prev and latest next', () => {
    type P = { watched: number; other: number };
    const pm = createModule<P>();
    pm.define({
      watched: { type: 'number' },
      other: { type: 'number' },
    } satisfies PropsSpecMap<P>);

    const observed: Array<{
      prev: P;
      next: P;
      all: string[];
      matched: string[];
    }> = [];
    pm.watchKeys(['watched'], (_run, next, prev, info) => {
      observed.push({
        prev,
        next,
        all: [...info.changedKeysAll].sort(),
        matched: [...info.changedKeysMatched].sort(),
      });
    });

    pm.applyRaw({ watched: 1, other: 1 });
    expect(drain(pm)).toEqual([]);

    pm.applyRaw({ watched: 1, other: 2 });
    pm.applyRaw({ watched: 2, other: 2 });
    executeResolvedTasks(pm);

    expect(observed).toEqual([
      {
        prev: { watched: 1, other: 1 },
        next: { watched: 2, other: 2 },
        all: ['other', 'watched'],
        matched: ['watched'],
      },
    ]);
  });

  it('T-PROPS-0007-CASE-DISPATCH-ORDER / C-PROPS-0011-J: dispatch preserves shared registration order across watchAll and keyed watchers', () => {
    type P = { value: number };
    const pm = createModule<P>();
    pm.define({ value: { type: 'number' } } satisfies PropsSpecMap<P>);

    const order: string[] = [];
    pm.watchKeys(['value'], () => order.push('key-1'));
    pm.watchAllKeys(() => order.push('all-1'));
    pm.watchKeys(['value'], () => order.push('key-2'));
    pm.watchAllKeys(() => order.push('all-2'));

    pm.applyRaw({ value: 1 });
    expect(drain(pm)).toEqual([]);

    pm.applyRaw({ value: 2 });
    executeResolvedTasks(pm);

    expect(order).toEqual(['key-1', 'all-1', 'key-2', 'all-2']);
  });

  it.each([new Error('acquired source release failed'), undefined])(
    'retires queued watcher work when the acquired source release throws %s',
    (releaseFailure) => {
      let raw = { value: 0 };
      let invalidate: (() => void) | undefined;
      let releases = 0;
      const source = {
        get: () => raw,
        subscribe(listener: () => void) {
          invalidate = listener;
          return () => {
            releases++;
            invalidate = undefined;
            throw releaseFailure;
          };
        },
      };
      const caps = {
        onChange: (_fn: (epoch: number) => void) => {},
        has: (key: unknown) => key === RAW_PROPS_SOURCE_CAP,
        get: (key: unknown) => (key === RAW_PROPS_SOURCE_CAP ? source : undefined),
      } as any;
      const pm = new PropsModuleImpl<{ value: number }>(caps, 'release-failure');
      const observed: number[] = [];
      pm.define({ value: { type: 'number' } });
      pm.watchKeys(['value'], (_run, next) => observed.push(next.value));
      pm.syncFromHost();

      raw = { value: 1 };
      invalidate!();
      pm.syncFromHost();
      executeResolvedTasks(pm);
      expect(observed).toEqual([1]);

      raw = { value: 2 };
      invalidate!();
      pm.syncFromHost();
      let caught = false;
      let thrown: unknown;
      try {
        pm.dispose();
      } catch (error) {
        caught = true;
        thrown = error;
      }
      expect(caught).toBe(true);
      expect(thrown).toBe(releaseFailure);
      executeResolvedTasks(pm);
      expect(observed).toEqual([1]);
      expect(() => pm.dispose()).not.toThrow();
      expect(releases).toBe(1);
    }
  );
});

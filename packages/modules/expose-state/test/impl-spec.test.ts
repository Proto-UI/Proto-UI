// packages/modules/expose-state/test/impl-spec.test.ts
import { describe, it, expect } from 'vitest';
import { ExposeStateModuleImpl } from '../src/impl';
import { EXPOSES_RECORD_SINK_CAP, EXPOSE_STATE_SET_EXPOSES_CAP } from '../src/caps';
import { isAppMakerExposeRecordEntry } from '../src/types';
import { createSysCaps, makeCaps } from './utils/fake-caps';
import type { StateEvent, StateSpec } from '@proto.ui/types';
import { createExposeEventDeclaration } from '@proto.ui/module-expose';

type FakeHandle<V> = {
  get(): V;
  set(v: V): void;
  __stateId: number;
  __stateSpec: StateSpec;
};

function createStateHarness() {
  let nextId = 1;
  const subs = new WeakMap<object, Set<(e: StateEvent<any>) => void>>();

  const createHandle = <V>(initial: V, spec: StateSpec): FakeHandle<V> => {
    const id = nextId++;
    let value = initial;
    const handle: FakeHandle<V> = {
      get: () => value,
      set: (v: V) => {
        if (Object.is(value, v)) return;
        const prev = value;
        value = v;
        const e: StateEvent<V> = { type: 'next', prev, next: v };
        const set = subs.get(handle);
        if (set) for (const cb of set) cb(e);
      },
      __stateId: id,
      __stateSpec: spec,
    };
    return handle;
  };

  const statePort = {
    watch<V>(handle: FakeHandle<V>, cb: (_ctx: unknown, e: StateEvent<V>) => void) {
      let set = subs.get(handle as any);
      if (!set) {
        set = new Set();
        subs.set(handle as any, set);
      }
      const wrapped = (e: StateEvent<V>) => cb(undefined, e);
      set.add(wrapped as any);
      return () => set?.delete(wrapped as any);
    },
  };

  return { createHandle, statePort };
}

function makeExposePort(record: Record<string, unknown>) {
  return {
    getAll() {
      return { ...record };
    },
  };
}

function makeDeps(exposePort: any, statePort: any) {
  return {
    requirePort(name: string) {
      if (name === 'expose') return exposePort;
      if (name === 'state') return statePort;
      throw new Error(`missing port: ${name}`);
    },
    requireFacade() {
      throw new Error('not used');
    },
    tryFacade() {
      return undefined;
    },
    tryPort() {
      return undefined;
    },
  } as any;
}

describe('ExposeStateModuleImpl (contract-ish)', () => {
  it('keeps the legacy sink token as an alias of the finalized record sink', () => {
    expect(EXPOSE_STATE_SET_EXPOSES_CAP).toBe(EXPOSES_RECORD_SINK_CAP);
  });

  it('projects exposed state handle into external handle shape', () => {
    const sys = createSysCaps();
    const caps = makeCaps({ sys });

    const { createHandle, statePort } = createStateHarness();
    const h = createHandle(false, { kind: 'bool' });
    const exposePort = makeExposePort({ ready: h });

    const deps = makeDeps(exposePort, statePort);
    const impl = new ExposeStateModuleImpl(caps as any, deps);

    const all = impl.port.getAll();
    const ext: any = all.ready;

    expect(ext).toBeTruthy();
    expect(typeof ext.get).toBe('function');
    expect(typeof ext.subscribe).toBe('function');
    expect(typeof ext.unsubscribe).toBe('function');
    expect(ext.spec).toBeTruthy();
    expect(ext.spec.kind).toBe('bool');
    expect(ext.set).toBeUndefined();
    expect(ext.setDefault).toBeUndefined();
  });

  it('retains branded signal declarations for Adapter translation without confusing author values', () => {
    const sys = createSysCaps();
    const caps = makeCaps({ sys });
    const { statePort } = createStateHarness();
    const authorValue = { __pui_expose: 'event', spec: { payload: 'json' } };
    const declaration = createExposeEventDeclaration({ payload: 'json' });
    const exposePort = makeExposePort({
      ready: declaration,
      authorValue,
    });
    const impl = new ExposeStateModuleImpl(caps as any, makeDeps(exposePort, statePort));

    const all = impl.port.getAll();
    expect(all.ready).toBeTruthy();
    expect(all.authorValue).toBe(authorValue);
    expect(isAppMakerExposeRecordEntry(declaration)).toBe(false);
    expect(isAppMakerExposeRecordEntry(authorValue)).toBe(true);
  });

  it('external subscribe receives StateEvent without run', () => {
    const sys = createSysCaps();
    const caps = makeCaps({ sys });

    const { createHandle, statePort } = createStateHarness();
    const h = createHandle(false, { kind: 'bool' });
    const exposePort = makeExposePort({ ready: h });

    const deps = makeDeps(exposePort, statePort);
    const impl = new ExposeStateModuleImpl(caps as any, deps);

    const ext: any = impl.port.get('ready');

    let got: any = null;
    const off = ext.subscribe((e: any) => {
      got = e;
    });

    h.set(true);

    expect(got).toBeTruthy();
    expect(got.type).toBe('next');
    expect(got.next).toBe(true);

    off();
  });

  it('preserves external handle identity across reads and publications', () => {
    const sys = createSysCaps();
    const calls: Array<Record<string, unknown>> = [];
    const caps = makeCaps({
      sys,
      setExposes: (record: Record<string, unknown>) => calls.push(record),
    });
    const { createHandle, statePort } = createStateHarness();
    const h = createHandle(false, { kind: 'bool' });
    const impl = new ExposeStateModuleImpl(
      caps as any,
      makeDeps(makeExposePort({ ready: h }), statePort)
    );

    const first = impl.port.get('ready');
    expect(impl.port.getAll().ready).toBe(first);

    impl.onInstancePhase('alive');
    impl.afterRenderCommit();

    expect(calls.at(-1)?.ready).toBe(first);
  });

  it('dispose invalidates external handles and clears external subscriptions', () => {
    const sys = createSysCaps();
    const caps = makeCaps({ sys });

    const { createHandle, statePort } = createStateHarness();
    const h = createHandle(false, { kind: 'bool' });
    const exposePort = makeExposePort({ ready: h });

    const deps = makeDeps(exposePort, statePort);
    const impl = new ExposeStateModuleImpl(caps as any, deps);

    const ext: any = impl.port.get('ready');
    const events: any[] = [];
    ext.subscribe((e: any) => events.push(e));

    impl.dispose();

    expect(() => ext.get()).toThrow();
    expect(() => ext.subscribe(() => {})).toThrow();

    h.set(true);
    expect(events).toEqual([]);
  });

  it('publishes external exposes to host sink', () => {
    const sys = createSysCaps();
    const calls: Array<Record<string, unknown>> = [];
    const caps = makeCaps({
      sys,
      setExposes: (r: Record<string, unknown>) => calls.push(r),
    });

    const { createHandle, statePort } = createStateHarness();
    const h = createHandle(false, { kind: 'bool' });
    const exposePort = makeExposePort({ ready: h });

    const deps = makeDeps(exposePort, statePort);
    const impl = new ExposeStateModuleImpl(caps as any, deps);

    impl.onInstancePhase('alive');
    impl.afterRenderCommit();

    expect(calls.length).toBeGreaterThan(0);
    const last = calls[calls.length - 1];
    expect(last.ready).toBeTruthy();
  });

  it('dispose clears host exposes', () => {
    const sys = createSysCaps();
    const calls: Array<Record<string, unknown>> = [];
    const caps = makeCaps({
      sys,
      setExposes: (r: Record<string, unknown>) => calls.push(r),
    });

    const { createHandle, statePort } = createStateHarness();
    const h = createHandle(false, { kind: 'bool' });
    const exposePort = makeExposePort({ ready: h });

    const deps = makeDeps(exposePort, statePort);
    const impl = new ExposeStateModuleImpl(caps as any, deps);

    impl.afterRenderCommit();
    impl.dispose();

    expect(calls[calls.length - 1]).toEqual({});
  });

  it('clears a replaced or removed host sink before publishing elsewhere', () => {
    const sys = createSysCaps();
    const firstCalls: Array<Record<string, unknown>> = [];
    const secondCalls: Array<Record<string, unknown>> = [];
    const caps = makeCaps({
      sys,
      setExposes: (record: Record<string, unknown>) => firstCalls.push(record),
    });
    const { createHandle, statePort } = createStateHarness();
    const h = createHandle(false, { kind: 'bool' });
    const impl = new ExposeStateModuleImpl(
      caps as any,
      makeDeps(makeExposePort({ ready: h }), statePort)
    );

    impl.onInstancePhase('alive');
    expect(firstCalls.at(-1)).toHaveProperty('ready');

    caps.__set('setExposes', (record: Record<string, unknown>) => secondCalls.push(record));
    caps.__bumpEpoch();

    expect(firstCalls.at(-1)).toEqual({});
    expect(secondCalls.at(-1)).toHaveProperty('ready');

    caps.__set('setExposes', undefined);
    caps.__bumpEpoch();

    expect(secondCalls.at(-1)).toEqual({});
  });
});

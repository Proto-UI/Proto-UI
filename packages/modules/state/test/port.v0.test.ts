import { describe, it, expect } from 'vitest';
import type { SystemCaps, ExecPhase } from '@proto.ui/module-base';
import { StateModuleImpl } from '../src/impl';

function createMockSys() {
  let disposed = false;
  let phase: ExecPhase = 'unknown';
  let callbackCtx: unknown = undefined;

  const fail = (msg: string) => {
    throw new Error(msg);
  };

  const sys: SystemCaps = {
    execPhase: () => phase,
    domain: () => (phase === 'setup' ? 'setup' : 'runtime'),
    protoPhase: () => 'setup',
    isDisposed: () => disposed,

    ensureNotDisposed: (op) => {
      if (disposed) fail(`[mock-sys] disposed op=${op}`);
    },

    ensureExecPhase: (op, expected) => {
      if (disposed) fail(`[mock-sys] disposed op=${op}`);
      const ex = Array.isArray(expected) ? expected : [expected];
      if (!ex.includes(phase)) {
        fail(`[mock-sys] exec-phase violation op=${op} expected=${ex.join('|')} actual=${phase}`);
      }
    },

    ensureSetup: (op) => sys.ensureExecPhase(op, 'setup'),
    ensureRuntime: (op) => {
      if (disposed) fail(`[mock-sys] disposed op=${op}`);
      if (phase === 'setup') {
        fail(`[mock-sys] runtime-only violation op=${op} actual=setup`);
      }
    },
    ensureCallback: (op) => sys.ensureExecPhase(op, 'callback'),

    getCallbackCtx: () => {
      return phase === 'callback' ? callbackCtx : undefined;
    },
  };

  return {
    sys,
    setPhase(p: ExecPhase) {
      phase = p;
    },
    setCallbackCtx(v: unknown) {
      callbackCtx = v;
    },
    disposeSys() {
      disposed = true;
    },
  };
}

describe('module-state port (v0)', () => {
  it('facade definitions preserve finite host-neutral state specs', () => {
    const mock = createMockSys();
    const impl = new StateModuleImpl(mock.sys as any);

    mock.setPhase('setup');

    const enabled = impl.facade.bool('enabled', false);
    const tone = impl.facade.enum('tone', 'primary', {
      options: ['primary', 'danger'] as const,
    });
    const label = impl.facade.string('label', 'OK', {
      options: ['OK', 'Cancel'],
    });
    const progress = impl.facade.numberRange('progress', 50, {
      min: 0,
      max: 100,
      clamp: true,
    });
    const step = impl.facade.numberDiscrete('step', 2, {
      min: 0,
      max: 10,
      step: 2,
    });

    expect((enabled as any).__stateKind).toBe('bool');
    expect((enabled as any).__stateSpec).toEqual({ kind: 'bool' });

    expect((tone as any).__stateKind).toBe('enum');
    expect((tone as any).__stateSpec).toEqual({
      kind: 'enum',
      options: ['primary', 'danger'],
    });

    expect((label as any).__stateKind).toBe('string');
    expect((label as any).__stateSpec).toEqual({
      kind: 'string',
      options: ['OK', 'Cancel'],
    });

    expect((progress as any).__stateKind).toBe('number.range');
    expect((progress as any).__stateSpec).toEqual({
      kind: 'number.range',
      min: 0,
      max: 100,
      clamp: true,
    });

    expect((step as any).__stateKind).toBe('number.discrete');
    expect((step as any).__stateSpec).toEqual({
      kind: 'number.discrete',
      min: 0,
      max: 10,
      step: 2,
    });
  });

  it('watch(handle) receives ctx from sys.getCallbackCtx and dispatches synchronously on owned.set', () => {
    const mock = createMockSys();
    const impl = new StateModuleImpl(mock.sys as any);
    const port = impl.port;

    mock.setPhase('setup');
    const owned = impl.facade.bool('focused', false);

    const calls: Array<{ ctx: unknown; e: any }> = [];

    const off = port.watch(owned, (ctx, e) => {
      calls.push({ ctx, e });
    });

    mock.setPhase('callback');
    const ctxObj = { tag: 'run-like-ctx' };
    mock.setCallbackCtx(ctxObj);

    owned.set(true, 'test-reason');

    expect(calls.length).toBe(1);
    expect(calls[0].ctx).toBe(ctxObj);

    expect(calls[0].e?.type).toBe('next');
    expect(calls[0].e?.prev).toBe(false);
    expect(calls[0].e?.next).toBe(true);
    expect('reason' in calls[0].e).toBe(true);

    off();
    calls.length = 0;
    owned.set(false);
    expect(calls.length).toBe(0);
  });

  it('createObservedHandle: get+watch works and watch receives ctx', () => {
    const mock = createMockSys();
    const impl = new StateModuleImpl(mock.sys as any);
    const port = impl.port;

    mock.setPhase('setup');
    const owned = impl.facade.bool('open', false);
    const observed = port.createObservedHandle(owned);

    expect(observed.get()).toBe(false);
    expect((observed as any).__stateId).toBe((owned as any).__stateId);
    expect((observed as any).__stateSemantic).toBe('open');
    expect((observed as any).__stateSpec).toEqual((owned as any).__stateSpec);

    const calls: Array<{ ctx: unknown; e: any }> = [];
    const off = observed.watch((ctx, e) => calls.push({ ctx, e }));

    mock.setPhase('callback');
    const ctxObj = { tag: 'run-like-ctx' };
    mock.setCallbackCtx(ctxObj);

    owned.set(true);

    expect(observed.get()).toBe(true);
    expect(calls.length).toBe(1);
    expect(calls[0].ctx).toBe(ctxObj);
    expect(calls[0].e?.type).toBe('next');
    expect(calls[0].e?.prev).toBe(false);
    expect(calls[0].e?.next).toBe(true);

    off();
  });

  it('createBorrowedHandle: set() forwards ctx (withCtx) and triggers watchers with correct ctx', () => {
    const mock = createMockSys();
    const impl = new StateModuleImpl(mock.sys as any);
    const port = impl.port;

    mock.setPhase('setup');
    const owned = impl.facade.numberDiscrete('count', 0, {});
    const borrowed = port.createBorrowedHandle(owned);

    const calls: Array<{ ctx: unknown; e: any }> = [];
    const off = borrowed.watch((ctx, e) => calls.push({ ctx, e }));

    borrowed.setDefault(1);
    expect(owned.get()).toBe(1);

    mock.setPhase('callback');
    const ctxObj = { tag: 'run-like-ctx' };
    mock.setCallbackCtx(ctxObj);

    borrowed.set(2, 'reason-x');

    expect(owned.get()).toBe(2);
    expect(calls.length).toBe(1);
    expect(calls[0].ctx).toBe(ctxObj);
    expect(calls[0].e?.type).toBe('next');
    expect(calls[0].e?.prev).toBe(1);
    expect(calls[0].e?.next).toBe(2);

    off();
  });

  it('re-entrant set ordering is deterministic (1 -> 2 -> 3) and ctx remains stable within the set chain', () => {
    const mock = createMockSys();
    const impl = new StateModuleImpl(mock.sys as any);
    const port = impl.port;

    mock.setPhase('setup');
    const owned = impl.facade.numberDiscrete('n', 0, {});
    const observed = port.createObservedHandle(owned);

    const seq: number[] = [];
    const ctxSeq: unknown[] = [];

    const off = observed.watch((ctx, e: any) => {
      if (e?.type !== 'next') return;
      seq.push(e.next);
      ctxSeq.push(ctx);

      if (e.next === 1) owned.set(2);
      if (e.next === 2) owned.set(3);
    });

    mock.setPhase('callback');
    const ctxObj = { tag: 'run-like-ctx' };
    mock.setCallbackCtx(ctxObj);

    owned.set(1);

    expect(seq).toEqual([1, 2, 3]);
    expect(ctxSeq).toEqual([ctxObj, ctxObj, ctxObj]);
    expect(owned.get()).toBe(3);

    off();
  });

  it('author-facing watch view registration is setup-only', () => {
    const mock = createMockSys();
    const impl = new StateModuleImpl(mock.sys as any);
    const port = impl.port;

    mock.setPhase('setup');
    const owned = impl.facade.bool('hovered', false);
    const observed = port.createObservedHandle(owned);
    const borrowed = port.createBorrowedHandle(owned);

    expect(() => observed.watch(() => {})).not.toThrow();
    expect(() => borrowed.watch(() => {})).not.toThrow();

    mock.setPhase('callback');

    expect(() => port.watch(owned, () => {})).not.toThrow();
    expect(() => observed.watch(() => {})).toThrow();
    expect(() => borrowed.watch(() => {})).toThrow();
  });

  it('disconnect(handle) emits disconnect event to watchers of that slot', () => {
    const mock = createMockSys();
    const impl = new StateModuleImpl(mock.sys as any);
    const port = impl.port;

    mock.setPhase('setup');
    const ownedA = impl.facade.bool('a', true);
    const ownedB = impl.facade.bool('b', true);

    const eventsA: any[] = [];
    const eventsB: any[] = [];

    port.watch(ownedA, (_ctx, e) => eventsA.push(e));
    port.watch(ownedB, (_ctx, e) => eventsB.push(e));

    port.disconnect(ownedA);

    expect(eventsA.some((e) => e?.type === 'disconnect')).toBe(true);
    expect(eventsB.some((e) => e?.type === 'disconnect')).toBe(false);
  });

  it('after module dispose: port APIs and derived views are guarded; watchers get best-effort disconnect', () => {
    const mock = createMockSys();
    const impl = new StateModuleImpl(mock.sys as any);
    const port = impl.port;

    mock.setPhase('setup');
    const owned = impl.facade.bool('alive', true);

    const observed = port.createObservedHandle(owned);
    const borrowed = port.createBorrowedHandle(owned);

    const events: any[] = [];
    port.watch(owned, (_ctx, e) => events.push(e));

    impl.dispose();

    // best-effort disconnect broadcast from dispose()
    expect(events.some((e) => e?.type === 'disconnect')).toBe(true);

    // port APIs should throw after module dispose (strict)
    expect(() => port.watch(owned, () => {})).toThrow();
    expect(() => port.disconnect(owned)).toThrow();
    expect(() => port.createObservedHandle(owned)).toThrow();
    expect(() => port.createBorrowedHandle(owned)).toThrow();

    // derived views should also be guarded (strict)
    expect(() => observed.get()).toThrow();
    expect(() => observed.watch(() => {})).toThrow();

    expect(() => borrowed.get()).toThrow();
    expect(() => borrowed.watch(() => {})).toThrow();
    expect(() => borrowed.setDefault(true)).toThrow();
    expect(() => borrowed.set(false)).toThrow();
  });

  it('if runtime sys is disposed, APIs throw even if module not disposed yet', () => {
    const mock = createMockSys();
    const impl = new StateModuleImpl(mock.sys as any);
    const port = impl.port;

    mock.setPhase('setup');
    const owned = impl.facade.bool('x', true);

    mock.disposeSys();

    expect(() => port.watch(owned, () => {})).toThrow();
    expect(() => port.disconnect(owned)).toThrow();
    expect(() => port.createObservedHandle(owned)).toThrow();
    expect(() => port.createBorrowedHandle(owned)).toThrow();
    expect(() => owned.get()).toThrow();
  });
});

it('number.list port views share immutable snapshots and preserve metadata, phase and disposal', () => {
  const mock = createMockSys();
  const impl = new StateModuleImpl(mock.sys);
  mock.setPhase('setup');
  const owned = impl.facade.numberList('coordinates', [1, 9]);
  const borrowed = impl.port.createBorrowedHandle(owned);
  const observed = impl.port.createObservedHandle(owned);
  expect((owned as any).watch).toBeUndefined();
  expect((observed as any).set).toBeUndefined();
  for (const view of [borrowed, observed]) {
    expect(view.get()).toBe(owned.get());
    for (const key of ['__stateId', '__stateName', '__stateSemantic', '__stateKind', '__stateSpec'])
      expect((view as any)[key]).toBe((owned as any)[key]);
  }
  const events: unknown[] = [];
  borrowed.watch((_ctx, event) => events.push(event));
  observed.watch((_ctx, event) => events.push(event));
  const input = [2, 8];
  impl.port.setDefault(owned, input);
  input[0] = 99;
  expect(owned.get()).toEqual([2, 8]);
  expect(events).toHaveLength(0);
  mock.setPhase('callback');
  expect(() => observed.watch(() => {})).toThrow();
  expect(() => borrowed.setDefault([])).toThrow();
  const snapshot = owned.get();
  expect(() => impl.port.set(owned, [NaN])).toThrow();
  expect(() => impl.port.setDefault(owned, [Infinity])).toThrow();
  expect(owned.get()).toBe(snapshot);
  borrowed.set([3, 7], Symbol('reason'));
  expect(events).toHaveLength(2);
  impl.dispose();
  for (const view of [owned, borrowed, observed]) expect(() => view.get()).toThrow();
  expect(() => observed.watch(() => {})).toThrow();
});

// packages/modules/event/test/contracts/event-module.v0.contract.test.ts
import { describe, it, expect } from 'vitest';
import { EventModuleImpl } from '../../src/impl';
import { EventError } from '../../src/error';
import { makeCaps, createSysCaps } from '../utils/fake-caps';

type ExecPhase = 'setup' | 'render' | 'callback' | 'unknown';

function createMockTarget(label: string) {
  type Rec = { type: string; fn: any; options: any };
  const listeners: Rec[] = [];

  const target: EventTarget & {
    __label: string;
    __listeners: Rec[];
    __fire: (type: string, ev?: any) => void;
    __count: (type?: string) => number;
  } = {
    __label: label,
    __listeners: listeners,
    addEventListener(type: any, fn: any, options: any) {
      listeners.push({ type: String(type), fn, options });
    },
    removeEventListener(type: any, fn: any, options: any) {
      const t = String(type);
      for (let i = listeners.length - 1; i >= 0; i--) {
        const r = listeners[i]!;
        if (r.type !== t) continue;
        if (r.fn !== fn) continue;
        if (r.options !== options) continue;
        listeners.splice(i, 1);
        return;
      }
    },
    dispatchEvent(_evt: Event) {
      return true;
    },
    __fire(type: string, ev: any = { type }) {
      const snapshot = listeners.filter((r) => r.type === type).slice();
      for (const r of snapshot) r.fn(ev);
    },
    __count(type?: string) {
      return type ? listeners.filter((r) => r.type === type).length : listeners.length;
    },
  };

  return target;
}

function captureError(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error('Expected operation to throw');
}

describe('event-module: contract v0 (module semantics)', () => {
  it('EV-MOD-V0-0100: event type validation accepts semantic and host:* types only', () => {
    const sys = createSysCaps();
    const caps = makeCaps({ sys });
    const impl = new EventModuleImpl(caps as any, 'test-proto');

    sys.__setExecPhase('setup');

    expect(() => impl.on('press.commit')).not.toThrow();
    expect(() => impl.on('pointer.down')).not.toThrow();
    expect(() => impl.on('host:click')).not.toThrow();
    expect(() => impl.on('host:keydown')).not.toThrow();

    expect(() => impl.on('press.foo' as any)).toThrow(/invalid event type/i);
    expect(() => impl.on('foo.bar' as any)).toThrow(/invalid event type/i);
    expect(() => impl.on('native:click' as any)).toThrow(/invalid event type/i);
    expect(() => impl.on('host.click' as any)).toThrow(/invalid event type/i);
    expect(() => impl.on('host:' as any)).toThrow(/invalid event type/i);
  });

  it('EV-MOD-V0-0150: invalid arguments and unavailable targets use canonical EventError codes', () => {
    const sys = createSysCaps();
    const caps = makeCaps({
      sys,
      getRootTarget: () => null,
    });
    const impl = new EventModuleImpl(caps as any, 'test-proto');

    sys.__setExecPhase('setup');
    const invalidArgument = captureError(() => impl.on('host:' as any));
    expect(invalidArgument).toBeInstanceOf(EventError);
    expect(invalidArgument).toMatchObject({
      name: 'EventError',
      code: 'EVENT_INVALID_ARGUMENT',
    });

    impl.on('host:click' as any);
    sys.__setExecPhase('render');
    const unavailableTarget = captureError(() => impl.bind(() => {}));
    expect(unavailableTarget).toBeInstanceOf(EventError);
    expect(unavailableTarget).toMatchObject({
      name: 'EventError',
      code: 'EVENT_TARGET_UNAVAILABLE',
    });
  });

  it('EV-MOD-V0-1000: bind() with no registrations MUST be no-op and MUST NOT read targets', () => {
    const sys = createSysCaps();
    sys.__setExecPhase('render'); // runtime

    const caps = makeCaps({
      sys,
      getRootTarget: () => {
        throw new Error('should not read root target');
      },
      getGlobalTarget: () => {
        throw new Error('should not read global target');
      },
    });

    const impl = new EventModuleImpl(caps as any, 'test-proto');

    expect(() => impl.bind(() => {})).not.toThrow();
  });

  it('EV-MOD-V0-1100: root target required only if root registrations exist', () => {
    const sys = createSysCaps();

    const caps = makeCaps({
      sys,
      getRootTarget: () => null,
      getGlobalTarget: () => {
        throw new Error('should not read global target');
      },
    });

    const impl = new EventModuleImpl(caps as any, 'test-proto');

    // setup: register root listener
    sys.__setExecPhase('setup');
    impl.on('host:click' as any);

    // runtime: bind => should throw missing root target
    sys.__setExecPhase('render');
    expect(() => impl.bind(() => {})).toThrow(/root target unavailable/i);
  });

  it('EV-MOD-V0-1200: global target required only if global registrations exist', () => {
    const sys = createSysCaps();

    const caps = makeCaps({
      sys,
      getRootTarget: () => {
        throw new Error('should not read root target');
      },
      getGlobalTarget: () => null,
    });

    const impl = new EventModuleImpl(caps as any, 'test-proto');

    // setup: only global reg
    sys.__setExecPhase('setup');
    impl.onGlobal('host:keydown' as any);

    // runtime: bind => should throw missing global target, but not complain about root
    sys.__setExecPhase('render');
    expect(() => impl.bind(() => {})).toThrow(/global target unavailable/i);
  });

  it('EV-MOD-V0-1300: firing host event MUST call dispatch(id, ev) for each registration', () => {
    const sys = createSysCaps();
    const root = createMockTarget('root');

    const caps = makeCaps({
      sys,
      getRootTarget: () => root,
      getGlobalTarget: () => null,
    });

    const impl = new EventModuleImpl(caps as any, 'test-proto');

    sys.__setExecPhase('setup');
    const token = impl.on('host:click' as any);

    const calls: any[] = [];
    const dispatch = (id: string, ev: any) => calls.push([id, ev]);

    sys.__setExecPhase('render');
    impl.bind(dispatch);

    expect(root.__count('host:click')).toBe(1);

    root.__fire('host:click', { type: 'host:click', x: 1 });

    expect(calls.length).toBe(1);
    expect(calls[0]![0]).toBe((token as any).id);
    expect(calls[0]![1]).toMatchObject({ type: 'host:click', x: 1 });
  });

  it('EV-MOD-V0-1350: module-facing listeners dispatch before prototype-author dispatch', () => {
    const sys = createSysCaps();
    const root = createMockTarget('root');

    const caps = makeCaps({
      sys,
      getRootTarget: () => root,
      getGlobalTarget: () => null,
    });

    const impl = new EventModuleImpl(caps as any, 'test-proto');

    const calls: string[] = [];

    sys.__setExecPhase('setup');
    const moduleToken = impl.onInternal('host:click' as any, () => {
      calls.push('module');
    });
    const authorToken = impl.on('host:click' as any);

    sys.__setExecPhase('render');
    impl.bind((id, ev) => {
      impl.dispatchInternal(id, ev);
      if (id === (authorToken as any).id) {
        calls.push(`author:${id}`);
      }
    });

    root.__fire('host:click', { type: 'host:click' });

    expect((moduleToken as any).id).not.toBe((authorToken as any).id);
    expect(calls).toEqual(['module', `author:${(authorToken as any).id}`]);
  });

  it('EV-MOD-V0-1360: default-action cancellation requests are projected through host cap', () => {
    const sys = createSysCaps();
    const calls: unknown[] = [];
    const caps = makeCaps({
      sys,
      cancelDefaultAction: (request) => {
        calls.push(request);
      },
    });
    const impl = new EventModuleImpl(caps as any, 'test-proto');
    const nativeEvent = { type: 'keydown' };

    sys.__setExecPhase('callback');
    impl.requestDefaultActionPrevented(
      { detail: { nativeEvent } },
      { reason: 'test.reason', source: 'test-source' }
    );

    expect(calls).toEqual([
      {
        event: nativeEvent,
        reason: 'test.reason',
        source: 'test-source',
      },
    ]);
  });

  it('EV-MOD-V0-1400: off() MUST detach immediately if currently bound', () => {
    const sys = createSysCaps();
    const root = createMockTarget('root');

    const caps = makeCaps({
      sys,
      getRootTarget: () => root,
      getGlobalTarget: () => null,
    });

    const impl = new EventModuleImpl(caps as any, 'test-proto');

    sys.__setExecPhase('setup');
    const token = impl.on('host:click' as any);

    const calls: any[] = [];
    sys.__setExecPhase('render');
    impl.bind((id, ev) => calls.push([id, ev]));

    expect(root.__count('host:click')).toBe(1);

    // setup-only removal
    sys.__setExecPhase('setup');
    impl.off(token);

    expect(root.__count('host:click')).toBe(0);

    // even if fired, nothing happens
    root.__fire('host:click', { type: 'host:click' });
    expect(calls.length).toBe(0);
  });

  it('EV-MOD-V0-1500: unbind() MUST detach but keep registrations; subsequent bind MUST reattach', () => {
    const sys = createSysCaps();
    const root = createMockTarget('root');

    const caps = makeCaps({
      sys,
      getRootTarget: () => root,
      getGlobalTarget: () => null,
    });

    const impl = new EventModuleImpl(caps as any, 'test-proto');

    sys.__setExecPhase('setup');
    const token = impl.on('host:click' as any);

    const calls: any[] = [];
    const dispatch = (id: string, ev: any) => calls.push([id, ev]);

    sys.__setExecPhase('render');
    impl.bind(dispatch);
    expect(root.__count('host:click')).toBe(1);

    impl.unbind();
    expect(root.__count('host:click')).toBe(0);

    // bind again should reattach
    impl.bind(dispatch);
    expect(root.__count('host:click')).toBe(1);

    root.__fire('host:click', { type: 'host:click' });
    expect(calls.length).toBe(1);
    expect(calls[0]![0]).toBe((token as any).id);
  });

  it('EV-MOD-V0-1550: failed target resolution MUST add no listener and permit explicit retry', () => {
    const sys = createSysCaps();
    const semanticRoot = createMockTarget('semanticRoot');
    const recoveredRoot = createMockTarget('recoveredRoot');

    const caps = makeCaps({
      sys,
      getRootTarget: () => null,
      getGlobalTarget: () => null,
    });

    const impl = new EventModuleImpl(caps as any, 'test-proto');

    sys.__setExecPhase('setup');
    impl.redirectSemanticRoot(semanticRoot);
    const semanticToken = impl.on('key.down' as any);
    const hostToken = impl.on('host:click' as any);

    const calls: string[] = [];
    sys.__setExecPhase('render');

    expect(() => impl.bind((id) => calls.push(id))).toThrow(/root target unavailable/i);
    expect(semanticRoot.__count('key.down')).toBe(0);
    expect(impl.getDiagnostics().map((entry) => entry.bound)).toEqual([false, false]);

    (caps as any).__set('getRootTarget', () => recoveredRoot);
    (caps as any).__bumpEpoch();

    expect(semanticRoot.__count('key.down')).toBe(0);
    expect(recoveredRoot.__count('host:click')).toBe(0);
    expect(impl.getDiagnostics().map((entry) => entry.bound)).toEqual([false, false]);

    impl.bind((id) => calls.push(id));

    expect(semanticRoot.__count('key.down')).toBe(1);
    expect(recoveredRoot.__count('host:click')).toBe(1);
    expect(impl.getDiagnostics().map((entry) => entry.bound)).toEqual([true, true]);

    semanticRoot.__fire('key.down');
    recoveredRoot.__fire('host:click');
    expect(calls).toEqual([(semanticToken as any).id, (hostToken as any).id]);

    impl.unbind();
    expect(semanticRoot.__count('key.down')).toBe(0);
    expect(recoveredRoot.__count('host:click')).toBe(0);

    (caps as any).__bumpEpoch();
    expect(semanticRoot.__count('key.down')).toBe(0);
    expect(recoveredRoot.__count('host:click')).toBe(0);
  });

  it('EV-MOD-V0-1600: onCapsEpoch() MUST rebind to new targets when bound', () => {
    const sys = createSysCaps();
    const rootA = createMockTarget('rootA');
    const rootB = createMockTarget('rootB');

    const caps = makeCaps({
      sys,
      getRootTarget: () => rootA,
      getGlobalTarget: () => null,
    });

    const impl = new EventModuleImpl(caps as any, 'test-proto');

    sys.__setExecPhase('setup');
    const token = impl.on('host:click' as any);

    const calls: any[] = [];
    const dispatch = (id: string, ev: any) => calls.push([id, ev]);

    sys.__setExecPhase('render');
    impl.bind(dispatch);

    expect(rootA.__count('host:click')).toBe(1);
    expect(rootB.__count('host:click')).toBe(0);

    (caps as any).__set('getRootTarget', () => rootB);
    (caps as any).__bumpEpoch();

    expect(rootA.__count('host:click')).toBe(0);
    expect(rootB.__count('host:click')).toBe(1);

    rootB.__fire('host:click', { type: 'host:click', y: 2 });
    expect(calls.length).toBe(1);
    expect(calls[0]![0]).toBe((token as any).id);
  });

  it('EV-MOD-V0-1700: redirectRoot() in setup MUST override caps root target; calling after setup MUST throw', () => {
    const sys = createSysCaps();
    const capRoot = createMockTarget('capRoot');
    const redirected = createMockTarget('redirected');

    const caps = makeCaps({
      sys,
      getRootTarget: () => capRoot,
      getGlobalTarget: () => null,
    });

    const impl = new EventModuleImpl(caps as any, 'test-proto');

    sys.__setExecPhase('setup');
    impl.redirectRoot(redirected);
    const token = impl.on('host:click' as any);

    const calls: any[] = [];
    sys.__setExecPhase('render');
    impl.bind((id, ev) => calls.push([id, ev]));

    expect(capRoot.__count('host:click')).toBe(0);
    expect(redirected.__count('host:click')).toBe(1);

    redirected.__fire('host:click', { type: 'host:click' });
    expect(calls.length).toBe(1);
    expect(calls[0]![0]).toBe((token as any).id);

    // after setup: redirectRoot must throw
    sys.__setExecPhase('render');
    expect(() => impl.redirectRoot(createMockTarget('late'))).toThrow();
  });

  it('EV-MOD-V0-1800: unmounted MUST cleanup (unbind + drop registrations)', () => {
    const sys = createSysCaps();
    const root = createMockTarget('root');

    const caps = makeCaps({
      sys,
      getRootTarget: () => root,
      getGlobalTarget: () => null,
    });

    const impl = new EventModuleImpl(caps as any, 'test-proto');

    sys.__setExecPhase('setup');
    impl.on('host:click' as any);

    const calls: any[] = [];
    sys.__setExecPhase('render');
    impl.bind((id, ev) => calls.push([id, ev]));
    expect(root.__count('host:click')).toBe(1);

    // lifecycle unmount
    (impl as any).onProtoPhase('unmounted');
    expect(root.__count('host:click')).toBe(0);

    // After cleanup, bind should be no-op even if caps would throw
    (caps as any).__set('getRootTarget', () => {
      throw new Error('should not read targets after cleanup');
    });

    expect(() => impl.bind(() => {})).not.toThrow();
    root.__fire('host:click', { type: 'host:click' });
    expect(calls.length).toBe(0);
  });

  it('EV-MOD-V0-1900: setup-only APIs MUST throw in runtime execPhase', () => {
    const sys = createSysCaps();
    const root = createMockTarget('root');

    const caps = makeCaps({
      sys,
      getRootTarget: () => root,
      getGlobalTarget: () => null,
    });

    const impl = new EventModuleImpl(caps as any, 'test-proto');

    sys.__setExecPhase('render');
    expect(() => impl.on('host:click' as any)).toThrow();
    expect(() => impl.onGlobal('host:keydown' as any)).toThrow();
  });

  it('EV-MOD-V0-1950: runtime-only APIs MUST throw in setup execPhase', () => {
    const sys = createSysCaps();
    const root = createMockTarget('root');

    const caps = makeCaps({
      sys,
      getRootTarget: () => root,
      getGlobalTarget: () => null,
    });

    const impl = new EventModuleImpl(caps as any, 'test-proto');

    sys.__setExecPhase('setup');
    expect(() => impl.bind(() => {})).toThrow();
    expect(() => impl.unbind()).toThrow();
  });
});

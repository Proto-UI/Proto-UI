// packages/modules/event/test/impl-spec.test.ts
import { describe, it, expect } from 'vitest';
import { EventModuleImpl } from '../src/impl';
import { FakeEventTarget } from './utils/fake-event-target';
import { makeCaps, createSysCaps } from './utils/fake-caps';

function makeDispatch() {
  const calls: Array<{ id: string; ev: any }> = [];
  const dispatch = (id: string, ev: any) => calls.push({ id, ev });
  return { calls, dispatch };
}

describe('EventModuleImpl (contract-ish)', () => {
  it('setup-only: on/onGlobal/off/redirectRoot/redirectSemanticRoot/token.desc throw after setup', () => {
    const root = new FakeEventTarget();
    const sys = createSysCaps();

    const caps = makeCaps({
      sys,
      getRootTarget: () => root as any,
      getGlobalTarget: () => root as any,
    });

    const impl = new EventModuleImpl(caps, 'p-x');

    sys.__setExecPhase('setup');
    const t = impl.on('press.commit' as any);

    sys.__setExecPhase('callback'); // leave setup

    expect(() => impl.on('press.commit' as any)).toThrow();
    expect(() => impl.onGlobal('key.down' as any)).toThrow();
    expect(() => impl.off(t as any)).toThrow();
    expect(() => (impl as any).redirectRoot(root as any)).toThrow();
    expect(() => (impl as any).redirectSemanticRoot(root as any)).toThrow();
    expect(() => t.desc('x')).toThrow();
  });

  it('runtime-only: bind/unbind throw in setup', () => {
    const sys = createSysCaps();
    const caps = makeCaps({
      sys,
      getRootTarget: () => null,
      getGlobalTarget: () => null,
    });
    const impl = new EventModuleImpl(caps, 'p-x');

    sys.__setExecPhase('setup');
    expect(() => impl.bind((() => {}) as any)).toThrow();
    expect(() => impl.unbind()).toThrow();
  });

  it('bind(): no registrations => no-op and MUST NOT read targets', () => {
    const sys = createSysCaps();
    const caps = makeCaps({
      sys,
      getRootTarget: () => {
        throw new Error('should not read root');
      },
      getGlobalTarget: () => {
        throw new Error('should not read global');
      },
    });

    const impl = new EventModuleImpl(caps, 'p-x');

    sys.__setExecPhase('callback');
    const { dispatch } = makeDispatch();

    expect(() => impl.bind(dispatch)).not.toThrow();
  });

  it('bind(): requires root target only if there is root registration', () => {
    const sys = createSysCaps();
    const caps = makeCaps({
      sys,
      getRootTarget: () => null,
      getGlobalTarget: () => null,
    });

    const impl = new EventModuleImpl(caps, 'p-x');

    sys.__setExecPhase('setup');
    impl.on('press.commit' as any);

    sys.__setExecPhase('callback');
    const { dispatch } = makeDispatch();

    expect(() => impl.bind(dispatch)).toThrowError(/root target unavailable/i);
  });

  it('bind(): requires global target only if there is global registration', () => {
    const root = new FakeEventTarget();

    // A: only root regs -> missing global ok
    const sysA = createSysCaps();
    const capsA = makeCaps({
      sys: sysA,
      getRootTarget: () => root as any,
      getGlobalTarget: () => null,
    });
    const a = new EventModuleImpl(capsA, 'p-a');
    sysA.__setExecPhase('setup');
    a.on('press.commit' as any);
    sysA.__setExecPhase('callback');
    expect(() => a.bind(makeDispatch().dispatch)).not.toThrow();

    // B: has global regs -> missing global must throw
    const sysB = createSysCaps();
    const capsB = makeCaps({
      sys: sysB,
      getRootTarget: () => root as any,
      getGlobalTarget: () => null,
    });
    const b = new EventModuleImpl(capsB, 'p-b');
    sysB.__setExecPhase('setup');
    b.onGlobal('key.down' as any);
    sysB.__setExecPhase('callback');
    expect(() => b.bind(makeDispatch().dispatch)).toThrowError(/global target unavailable/i);
  });

  it('off(token): removes exactly that registration and detaches immediately if bound', () => {
    const root = new FakeEventTarget();
    const sys = createSysCaps();
    const caps = makeCaps({
      sys,
      getRootTarget: () => root as any,
      getGlobalTarget: () => root as any,
    });

    const impl = new EventModuleImpl(caps, 'p-x');

    sys.__setExecPhase('setup');
    const t1 = impl.on('press.commit' as any);
    const t2 = impl.on('press.commit' as any);

    sys.__setExecPhase('callback');
    const { dispatch } = makeDispatch();
    impl.bind(dispatch);

    expect(root.count('press.commit')).toBe(2);

    sys.__setExecPhase('setup');
    impl.off(t1 as any);

    // immediately detached ONE
    expect(root.count('press.commit')).toBe(1);

    // remaining one still works
    sys.__setExecPhase('callback');
    root.dispatch('press.commit', { k: 1 });
  });

  it('redirectRoot(): root bindings use overridden target; global unaffected', () => {
    const rootA = new FakeEventTarget();
    const rootB = new FakeEventTarget();
    const global = new FakeEventTarget();
    const sys = createSysCaps();

    const caps = makeCaps({
      sys,
      getRootTarget: () => rootA as any,
      getGlobalTarget: () => global as any,
    });

    const impl = new EventModuleImpl(caps, 'p-x');

    sys.__setExecPhase('setup');
    (impl as any).redirectRoot(rootB as any);
    impl.on('press.commit' as any);
    impl.onGlobal('key.down' as any);

    sys.__setExecPhase('callback');
    impl.bind(makeDispatch().dispatch);

    expect(rootA.count('press.commit')).toBe(0);
    expect(rootB.count('press.commit')).toBe(1);
    expect(global.count('key.down')).toBe(1);
  });

  it('redirectSemanticRoot(): semantic bindings move while host bindings stay local', () => {
    const local = new FakeEventTarget();
    const semantic = new FakeEventTarget();
    const sys = createSysCaps();
    const caps = makeCaps({
      sys,
      getRootTarget: () => local as any,
      getGlobalTarget: () => local as any,
    });
    const impl = new EventModuleImpl(caps, 'p-x');

    sys.__setExecPhase('setup');
    impl.redirectSemanticRoot(semantic as any);
    impl.on('press.commit' as any);
    impl.on('host:focus' as any);

    sys.__setExecPhase('callback');
    impl.bind(makeDispatch().dispatch);

    expect(semantic.count('press.commit')).toBe(1);
    expect(semantic.count('host:focus')).toBe(0);
    expect(local.count('press.commit')).toBe(0);
    expect(local.count('host:focus')).toBe(1);
  });

  it('unmounted phase triggers cleanupAll()', () => {
    const root = new FakeEventTarget();
    const semantic = new FakeEventTarget();
    const sys = createSysCaps();
    const caps = makeCaps({
      sys,
      getRootTarget: () => root as any,
      getGlobalTarget: () => root as any,
    });

    const impl = new EventModuleImpl(caps, 'p-x');

    sys.__setExecPhase('setup');
    impl.redirectSemanticRoot(semantic as any);
    impl.on('host:focus' as any);

    sys.__setExecPhase('callback');
    impl.bind(makeDispatch().dispatch);
    expect(root.count('host:focus')).toBe(1);

    impl.onProtoPhase('unmounted' as any);

    expect(root.count('host:focus')).toBe(0);
    expect((impl as any).overriddenSemanticRootTarget).toBeNull();
    sys.__setExecPhase('callback');
    expect(() => impl.unbind()).not.toThrow();
  });

  it('caps epoch change while bound triggers rebind', () => {
    const root1 = new FakeEventTarget();
    const root2 = new FakeEventTarget();
    const sys = createSysCaps();

    let current: any = root1;

    const caps = makeCaps({
      sys,
      getRootTarget: () => current as any,
      getGlobalTarget: () => current as any,
    });

    const impl = new EventModuleImpl(caps, 'p-x');

    sys.__setExecPhase('setup');
    impl.on('press.commit' as any);

    sys.__setExecPhase('callback');
    impl.bind(makeDispatch().dispatch);

    expect(root1.count('press.commit')).toBe(1);
    expect(root2.count('press.commit')).toBe(0);

    current = root2;
    (caps as any).__set('getRootTarget', () => current as any);
    (caps as any).__set('getGlobalTarget', () => current as any);
    (caps as any).__bumpEpoch();

    expect(root1.count('press.commit')).toBe(0);
    expect(root2.count('press.commit')).toBe(1);
  });

  it('rejects legacy Expose Event sink wiring on the Event module', () => {
    const caps = makeCaps({ sys: createSysCaps() });
    new EventModuleImpl(caps, 'p-x');

    caps.__set('exposeEventSink', () => undefined);
    expect(() => caps.__bumpEpoch()).toThrow(/wired to the expose-event module, not event/i);
  });

  it('token.desc() stores label for diagnostics', () => {
    const root = new FakeEventTarget();
    const sys = createSysCaps();
    const caps = makeCaps({
      sys,
      getRootTarget: () => root as any,
      getGlobalTarget: () => root as any,
    });

    const impl = new EventModuleImpl(caps, 'p-x');

    sys.__setExecPhase('setup');
    const t = impl.on('press.commit' as any);
    t.desc('asButton: commit');

    const diags = impl.getDiagnostics();
    expect(diags[0].label).toBe('asButton: commit');
  });
});

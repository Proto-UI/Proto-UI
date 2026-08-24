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

  it('keeps a rollback-surviving physical listener inert when removal throws', () => {
    const sys = createSysCaps();
    const rootListeners: Array<(event: unknown) => void> = [];
    const root = {
      addEventListener: (_type: string, callback: (event: unknown) => void) => {
        rootListeners.push(callback);
      },
      removeEventListener: () => {
        throw new Error('host refused rollback removal');
      },
      fire: (event: unknown) => {
        for (const callback of rootListeners) callback(event);
      },
    };
    const recoveredGlobal = new FakeEventTarget();
    let firstGlobal = true;
    const failedGlobal = {
      addEventListener: () => {
        throw new Error('host refused attachment');
      },
      removeEventListener: () => {},
    };
    const caps = makeCaps({
      sys,
      getRootTarget: () => root as any,
      getGlobalTarget: () => (firstGlobal ? (failedGlobal as any) : (recoveredGlobal as any)),
    });
    const impl = new EventModuleImpl(caps, 'p-x');

    sys.__setExecPhase('setup');
    impl.on('press.commit' as any);
    impl.onGlobal('key.down' as any);
    sys.__setExecPhase('callback');
    const { calls, dispatch } = makeDispatch();

    // Original attachment failure is preserved; rollback removal failure does
    // not replace it, and every registration reports logically unbound.
    expect(() => impl.bind(dispatch)).toThrowError(/host refused attachment/);
    expect(impl.getDiagnostics().every((entry) => entry.bound === false)).toBe(true);

    // The host retained the physical callback, but its active gate was revoked
    // before removal, so it cannot dispatch.
    root.fire({ type: 'press.commit' });
    expect(calls).toEqual([]);

    // Explicit retry installs one active wrapper. Firing invokes both the old
    // inert callback and the new active callback, yielding one dispatch only.
    firstGlobal = false;
    impl.bind(dispatch);
    root.fire({ type: 'press.commit' });
    expect(calls).toHaveLength(1);
  });

  // #466 third pass: installation is transactional across attachment
  // failures. A throwing Nth addEventListener must roll back every earlier
  // attachment, leave all registrations logically unbound, and allow a clean
  // explicit retry.
  it('dispatches an immutable data-only payload with a synchronous control window', () => {
    const sys = createSysCaps();
    const root = new FakeEventTarget();
    const prevented: unknown[] = [];
    const caps = makeCaps({
      sys,
      getRootTarget: () => root as any,
      getGlobalTarget: () => root as any,
      cancelDefaultAction: (request: unknown) => prevented.push(request),
    });
    const impl = new EventModuleImpl(caps, 'p-x');
    sys.__setExecPhase('setup');
    const token = impl.on('press.commit' as any); // portable semantic event

    sys.__setExecPhase('callback');
    let received: any = null;
    let inWindow: (() => void) | null = null;
    let afterWindow: (() => void) | null = null;
    impl.bind((id, ev) => {
      if (id === (token as any).id) {
        received = ev as any;
        // A request made inside the synchronous window flows to the host cap.
        (ev as any)?.control?.requestDefaultActionPrevention({
          reason: 'in-window',
          source: 'p-x',
        });
        // A saved facade later must fail closed.
        afterWindow = () =>
          (ev as any)?.control?.requestDefaultActionPrevention({ reason: 'late' });
        inWindow = null;
      }
    });

    // frozen input detail must never be mutated
    const frozen = Object.freeze({ detail: Object.freeze({ key: ' ', shiftKey: true }) });
    root.dispatch('press.commit', frozen as any);

    expect(received).toBeDefined();
    expect(Object.isFrozen(received)).toBe(true);
    expect(received.type).toBe('press.commit');
    expect(received.key).toBe(' ');
    expect(received.shiftKey).toBe(true);
    // the raw event is a new object, not an alias of the input
    expect(received).not.toBe(frozen);

    expect(prevented).toHaveLength(1);
    expect((prevented[0] as any).reason).toBe('in-window');

    // using a saved facade after the window fails closed
    expect(() => afterWindow?.()).toThrow(/outside its callback window/);
    expect(prevented).toHaveLength(1);
  });

  it('rejects listener options on portable semantic registrations but allows host extensions', () => {
    const sys = createSysCaps();
    const root = new FakeEventTarget();
    const caps = makeCaps({
      sys,
      getRootTarget: () => root as any,
      getGlobalTarget: () => root as any,
    });
    const impl = new EventModuleImpl(caps, 'p-x');
    sys.__setExecPhase('setup');
    // portable semantic registration with options must fail
    expect(() => impl.on('press.commit' as any, { capture: true })).toThrow(
      /only valid for host\:/
    );
    // host extension registration with options is allowed
    expect(() => impl.on('host:click', { capture: true })).not.toThrow();
  });

  it('keeps cleanup idempotent and reports logically unbound after rollback', () => {
    const sys = createSysCaps();
    const good = new FakeEventTarget();
    let removeCalls = 0;
    const bad = {
      addEventListener: () => {
        throw new Error('refused');
      },
      removeEventListener: () => {},
      count: () => 0,
    };
    let globalFirst = true;
    const caps = makeCaps({
      sys,
      getRootTarget: () => good as any,
      getGlobalTarget: () => (globalFirst ? (bad as any) : (good as any)),
    });
    const impl = new EventModuleImpl(caps, 'p-x');
    sys.__setExecPhase('setup');
    impl.on('press.commit' as any); // root -> good
    impl.onGlobal('key.down' as any); // first global -> bad throws
    sys.__setExecPhase('callback');
    const { dispatch } = makeDispatch();
    expect(() => impl.bind(dispatch)).toThrow(/refused/);

    // Rollback removed the earlier 'good' root listener, so nothing is bound.
    good.dispatch('press.commit', { ok: true });
    // Retry installs cleanly now that global resolves.
    globalFirst = false;
    impl.bind(dispatch);
    expect((impl as any).isBound).toBe(true);
    good.dispatch('press.commit', { ok: true });

    // unbind twice is idempotent and fails closed to unbound.
    impl.unbind();
    impl.unbind();
    expect((impl as any).isBound).toBe(false);
    good.dispatch('press.commit', { ok: true });
  });

  it('deduplicates default-action requests across registrations for one sample', () => {
    const sys = createSysCaps();
    const root = new FakeEventTarget();
    const prevented: unknown[] = [];
    const caps = makeCaps({
      sys,
      getRootTarget: () => root as any,
      getGlobalTarget: () => root as any,
      cancelDefaultAction: (request: unknown) => prevented.push(request),
    });
    const impl = new EventModuleImpl(caps, 'p-x');
    sys.__setExecPhase('setup');
    const t1 = impl.on('press.commit' as any);
    const t2 = impl.on('press.commit' as any);

    sys.__setExecPhase('callback');
    const samples: unknown[] = [];
    impl.bind((id, ev) => {
      if (id === (t1 as any).id || id === (t2 as any).id) {
        samples.push(ev);
        (ev as any).control.requestDefaultActionPrevention({ reason: 'same' });
      }
    });

    const sample = { detail: { key: ' ' } };
    root.dispatch('press.commit', sample as any);

    // one raw sample => one host request, regardless of registration count
    expect(prevented).toHaveLength(1);
  });

  it('bind(): rolls back earlier attachments when a later one throws', () => {
    const sys = createSysCaps();
    const good = new FakeEventTarget();
    let globalCalls = 0;
    const bad = {
      addEventListener: () => {
        throw new Error('host refused attachment');
      },
      removeEventListener: () => {},
      count: () => 0,
    };

    const caps = makeCaps({
      sys,
      getRootTarget: () => good as any,
      getGlobalTarget: () => {
        globalCalls += 1;
        return globalCalls === 1 ? (bad as any) : (good as any);
      },
    });
    const impl = new EventModuleImpl(caps, 'p-x');

    sys.__setExecPhase('setup');
    impl.on('press.commit' as any); // attaches to `good`
    impl.onGlobal('key.down' as any); // attachment throws on `bad`

    sys.__setExecPhase('callback');
    const { calls, dispatch } = makeDispatch();

    expect(() => impl.bind(dispatch)).toThrowError(/host refused attachment/);

    // Rollback: the first listener must be gone, so no callback can fire.
    good.dispatch('press.commit', { ok: true });
    expect(calls).toEqual([]);

    // Every registration is logically unbound; retry installs cleanly.
    impl.bind(dispatch);
    expect((impl as any).isBound).toBe(true);
    good.dispatch('press.commit', { ok: true });
    expect(calls.length).toBe(1);
  });
});

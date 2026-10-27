// packages/runtime/test/contract/as-hook.v0.contract.test.ts
import { describe, it, expect } from 'vitest';
import type { AsHookResult, OwnedDecorationTarget, Prototype, State, StyleHandle } from '@proto.ui/core';
import { defineAsHook, definePrototype, tw } from '@proto.ui/core';
import type { RuntimeHost } from '../../src';
import { createRuntimeSession, executeWithHost } from '../../src';
import type { PropsBaseType } from '@proto.ui/types';
import { EVENT_GLOBAL_TARGET_CAP, EVENT_ROOT_TARGET_CAP } from '@proto.ui/module-event';
import { asFocusable } from '@proto.ui/hooks';
import { EFFECTS_CAP, OWNED_DECORATION_CAP, type FeedbackPort } from '@proto.ui/module-feedback';

/**
 * Runtime Contract (v0): asHook
 */
describe('runtime contract: asHook (v0)', () => {
  const resolvedStateKeyNames = (stateHandles: unknown): string[] =>
    Object.keys((stateHandles ?? {}) as Record<string, unknown>).sort();

  const createHost = <P extends PropsBaseType>(name: string, initialRaw?: Record<string, any>) => {
    let raw = { ...(initialRaw ?? {}) };
    const commits: any[] = [];
    const scheduled: Array<() => void> = [];
    const rootTarget = new EventTarget();
    const globalTarget = new EventTarget();
    const host: RuntimeHost<P> = {
      prototypeName: name,
      getRawProps: () => raw as any,
      commit(children, signal) {
        commits.push(children);
        signal?.done();
      },
      schedule(task) {
        scheduled.push(task);
      },
      onRuntimeReady(wiring) {
        wiring.attach('event', [
          [EVENT_ROOT_TARGET_CAP, () => rootTarget],
          [EVENT_GLOBAL_TARGET_CAP, () => globalTarget],
        ]);
      },
      onUnmountBegin() {},
    };

    const flush = () => {
      while (scheduled.length) {
        const job = scheduled.shift()!;
        job();
      }
    };

    const setRaw = (next: Record<string, any>) => {
      raw = { ...(next ?? {}) };
    };

    return { host, commits, flush, setRaw };
  };

  it('AS-HOOK-0100: setup-only: calling asHook outside setup must throw', () => {
    const asOnce = defineAsHook({
      name: 'asOnce',
      setup() {},
    });

    const P: Prototype = definePrototype({
      name: 'x-as-hook-0100',
      setup(def) {
        def.lifecycle.onCreated(() => {
          expect(() => asOnce()).toThrow(/setup context|setup only/i);
        });
        return (r) => r.el('div', 'ok');
      },
    });

    const { host } = createHost(P.name);
    executeWithHost(P as any, host as any);
  });

  it('AS-HOOK-0200: dedupe by name: first asHook wins; subsequent same-name asHooks are skipped', () => {
    let a = 0;
    let b = 0;
    let firstResult: any;
    let secondResult: any;

    const asFirst = defineAsHook({
      name: 'asDup',
      setup() {
        a += 1;
      },
      projectHandle() {
        return { source: 'first' };
      },
    });

    const asSecond = defineAsHook({
      name: 'asDup',
      setup() {
        b += 1;
      },
    });

    const P: Prototype = definePrototype({
      name: 'x-as-hook-0200',
      setup() {
        firstResult = asFirst();
        secondResult = asSecond();
        return (r) => r.el('div', 'ok');
      },
    });

    const { host } = createHost(P.name);
    executeWithHost(P as any, host as any);

    expect(a).toBe(1);
    expect(b).toBe(0);
    expect(secondResult).toBe(firstResult);
    expect(secondResult).toEqual({ source: 'first' });
    expect((P as any).__asHooks[0]).toMatchObject({ name: 'asDup', mode: 'once' });
  });

  it('AS-HOOK-0300: module results (except state) attach to caller; module-level dedupe handled by modules', () => {
    const calls: string[] = [];

    const asProps = defineAsHook({
      name: 'asProps',
      setup(def) {
        def.props.define({ a: { type: 'number' } } as any);
        def.props.watch(['a'], () => {
          calls.push('watch:a');
        });
      },
    });

    const P: Prototype = definePrototype({
      name: 'x-as-hook-0300',
      setup() {
        asProps();
        return (r) => r.el('div', 'ok');
      },
    });

    const { host } = createHost(P.name, { a: 1 });
    const { controller } = executeWithHost(P as any, host as any);

    // hydration should not trigger
    expect(calls).toEqual([]);

    controller.applyRawProps({ a: 2 } as any);
    expect(calls).toEqual(['watch:a']);
  });

  it('AS-HOOK-0350: props watch disposers are exposed and setup-only', () => {
    const calls: string[] = [];
    let res: any;

    const asProps = defineAsHook({
      name: 'asPropsWithDispose',
      setup(def) {
        def.props.define({ a: { type: 'number' } } as any);
        def.props.watch(['a'], () => {
          calls.push('watch:a');
        });
      },
    });

    const P: Prototype = definePrototype({
      name: 'x-as-hook-0350',
      setup(def) {
        res = asProps();
        expect(Array.isArray(res?.disposers?.all)).toBe(true);
        expect(Array.isArray(res?.disposers?.props)).toBe(true);
        expect(res?.disposers?.props?.length).toBe(1);
        res.disposers.props[0]();
        def.lifecycle.onCreated(() => {
          expect(() => res.disposers.props[0]()).toThrow(/setup only/i);
        });
        return (r) => r.el('div', 'ok');
      },
    });

    const { host } = createHost(P.name, { a: 1 });
    const { controller } = executeWithHost(P as any, host as any);

    controller.applyRawProps({ a: 2 } as any);
    controller.applyRawProps({ a: 3 } as any);
    expect(calls).toEqual([]);
  });

  it('AS-HOOK-0400: state handles from asHook must be projected to borrowed view', () => {
    let borrowed: any;
    let seen: any[] = [];

    const asState = defineAsHook({
      name: 'asState',
      setup(def) {
        def.state.bool('open', false);
      },
    });

    const P: Prototype = definePrototype({
      name: 'x-as-hook-0400',
      setup(def) {
        const res = asState();
        borrowed = (res as any).state;

        (borrowed as any).watch?.((run: any, e: any) => {
          seen.push({ run, e });
        });

        def.lifecycle.onCreated(() => {
          (borrowed as any).set(true);
        });

        return (r) => r.el('div', 'ok');
      },
    });

    const { host } = createHost(P.name);
    executeWithHost(P as any, host as any);

    expect(typeof borrowed?.watch).toBe('function');
    expect(seen.length).toBeGreaterThan(0);
    expect(typeof seen[0]?.run?.update).toBe('function');
  });

  it('AS-HOOK-0450: named state handles are exposed as borrowed facade and can drive rules', () => {
    let named: any;
    let openHandle: any;
    let artifacts: any;

    const asState = defineAsHook<PropsBaseType, Record<string, never>, { open: State<boolean> }>({
      name: 'asNamedState',
      setup(def) {
        def.state.bool('open', false);
      },
    });

    const P: Prototype = definePrototype({
      name: 'x-as-hook-0450',
      setup(def) {
        const res = asState();
        named = res.stateHandles;
        openHandle = res.getState?.('open');
        artifacts = res.artifacts;

        def.rule({
          when: (w) => w.state(openHandle).eq(true),
          intent: (i) => i.feedback.style.use(tw('opacity-50')),
        });

        def.lifecycle.onCreated(() => {
          openHandle?.set(true);
        });

        return (r) => r.el('div', 'ok');
      },
    });

    const { host } = createHost(P.name);
    const { controller } = executeWithHost(P as any, host as any);

    expect(typeof named?.open?.watch).toBe('function');
    expect(named?.open).toBe(openHandle);
    expect(artifacts?.stateHandles).toBe(named);
    expect(controller.getRuleStyleTokens()).toContain('opacity-50');
  });

  it('AS-HOOK-0455: expose.state key does not name or override projected state handles', () => {
    let named: any;
    let internalHandle: any;

    const asState = defineAsHook<
      PropsBaseType,
      { open: State<boolean> },
      { state: { internalOpen: State<boolean> } }
    >({
      name: 'asExposeNamedState',
      setup(def) {
        const internalOpen = def.state.bool('internalOpen', false);
        def.expose.state('open', internalOpen);
      },
    });

    const P: Prototype = definePrototype({
      name: 'x-as-hook-0455',
      setup(def) {
        const res = asState();
        named = res.stateHandles;
        internalHandle = res.getState?.('internalOpen');

        def.rule({
          when: (w) => w.state(internalHandle).eq(true),
          intent: (i) => i.feedback.style.use(tw('opacity-50')),
        });

        def.lifecycle.onCreated(() => {
          internalHandle?.set(true);
        });

        return (r) => r.el('div', 'ok');
      },
    });

    const { host } = createHost(P.name);
    const { controller } = executeWithHost(P as any, host as any);

    expect(typeof named?.internalOpen?.watch).toBe('function');
    expect(named?.internalOpen).toBe(internalHandle);
    expect(named?.open).toBeUndefined();
    expect(resolvedStateKeyNames(named)).toEqual(['internalOpen']);
    expect(controller.getRuleStyleTokens()).toContain('opacity-50');
  });

  it('AS-HOOK-0456: duplicate state names in the same asHook setup frame must throw', () => {
    const asDuplicateState = defineAsHook({
      name: 'asDuplicateStateName',
      setup(def) {
        def.state.bool('open', false);
        def.state.bool('open', true);
      },
    });

    const P: Prototype = definePrototype({
      name: 'x-as-hook-0456',
      setup() {
        expect(() => asDuplicateState()).toThrow(/duplicate state name/i);
        return (r) => r.el('div', 'ok');
      },
    });

    const { host } = createHost(P.name);
    executeWithHost(P as any, host as any);
  });

  it('AS-HOOK-0460: event disposers are exposed but remain setup-only', () => {
    let calls = 0;
    let res: any;
    const rootTarget = new EventTarget();

    const asEvent = defineAsHook({
      name: 'asEvent',
      setup(def) {
        def.event.on('pointer.enter', () => {
          calls += 1;
        });
      },
    });

    const P: Prototype = definePrototype({
      name: 'x-as-hook-0470',
      setup(def) {
        res = asEvent();
        def.lifecycle.onMounted(() => {
          rootTarget.dispatchEvent(new CustomEvent('pointer.enter'));
          expect(() => res?.disposers?.event?.[0]?.()).toThrow(/setup only/i);
          rootTarget.dispatchEvent(new CustomEvent('pointer.enter'));
        });
        return (r) => r.el('div', 'ok');
      },
    });

    const host: RuntimeHost<any> = {
      prototypeName: P.name,
      getRawProps: () => ({}),
      commit(_children, signal) {
        signal?.done();
      },
      schedule(task) {
        task();
      },
      onRuntimeReady(wiring) {
        wiring.attach('event', [[EVENT_ROOT_TARGET_CAP, () => rootTarget]]);
      },
    };

    executeWithHost(P as any, host as any);

    expect(Array.isArray(res?.disposers?.event)).toBe(true);
    expect(calls).toBe(2);
  });

  it('AS-HOOK-0470: expose.event keys are captured as artifacts', () => {
    let artifacts: any;

    const asExposeEvent = defineAsHook({
      name: 'asExposeEvent',
      setup(def) {
        def.expose.event('ready', { payload: 'void' });
      },
    });

    const P: Prototype = definePrototype({
      name: 'x-as-hook-0480',
      setup() {
        artifacts = asExposeEvent().artifacts;
        return (r) => r.el('div', 'ok');
      },
    });

    const { host } = createHost(P.name);
    executeWithHost(P as any, host as any);

    expect(artifacts?.eventKeys).toEqual({ ready: 'ready' });
  });

  it('AS-HOOK-0475: expose.method is captured as callable methods on result', () => {
    let methods: any;
    let focusSelf: any;
    let artifacts: any;
    let called = 0;

    const asExposeMethod = defineAsHook({
      name: 'asExposeMethod',
      setup(def) {
        def.expose.method('focusSelf', () => {
          called += 1;
        });
      },
    });

    const P: Prototype = definePrototype({
      name: 'x-as-hook-0475',
      setup() {
        const res = asExposeMethod();
        methods = res.methods;
        focusSelf = res.getMethod?.('focusSelf');
        artifacts = res.artifacts;
        return (r) => r.el('div', 'ok');
      },
    });

    const { host } = createHost(P.name);
    executeWithHost(P as any, host as any);

    expect(typeof methods?.focusSelf).toBe('function');
    expect(methods?.focusSelf).toBe(focusSelf);
    expect(artifacts?.methods).toBe(methods);

    focusSelf?.();
    expect(called).toBe(1);
  });

  it('AS-HOOK-0480: rule disposers remove captured rules during setup only', () => {
    let res: any;

    const asRule = defineAsHook({
      name: 'asRule',
      setup(def) {
        def.rule({
          when: (w) => w.t(),
          intent: (i) => i.feedback.style.use(tw('opacity-50')),
        });
      },
    });

    const P: Prototype = definePrototype({
      name: 'x-as-hook-0480',
      setup(def) {
        res = asRule();
        expect(Array.isArray(res?.disposers?.rule)).toBe(true);
        res.disposers.rule[0]();
        def.lifecycle.onCreated(() => {
          expect(() => res.disposers.rule[0]()).toThrow(/setup only/i);
        });
        return (r) => r.el('div', 'ok');
      },
    });

    const { host } = createHost(P.name);
    const { controller } = executeWithHost(P as any, host as any);

    expect(controller.getRuleStyleTokens()).not.toContain('opacity-50');
  });

  it.each(['retain', 'feedback', 'all'] as const)(
    'AS-HOOK-0485: targeted setup style capture preserves identity and withdraws only its own paint (%s)',
    async (withdraw) => {
      const root = document.createElement('div');
      const decoration = document.createElement('span');
      const otherDecoration = document.createElement('span');
      let target!: OwnedDecorationTarget;
      let otherTarget!: OwnedDecorationTarget;
      let result!: AsHookResult;
      let setupCount = 0;
      const asTargetPaint = defineAsHook({
        name: 'as-target-paint-0485',
        setup(def) {
          setupCount += 1;
          def.feedback.style.to(target).use(tw('bg-red-500'));
        },
      });
      const P = definePrototype({
        name: `x-as-hook-0485-${withdraw}`,
        setup(def) {
          target = def.feedback.style.declareDecoration();
          otherTarget = def.feedback.style.declareDecoration();
          def.feedback.style.use(tw('text-white'));
          def.feedback.style.to(target).use(tw('opacity-50'));
          def.feedback.style.to(otherTarget).use(tw('bg-blue-500'));
          result = asTargetPaint();
          expect(asTargetPaint()).toBe(result);
          if (withdraw !== 'retain') {
            // Missing capture must fail on retained target paint, not an undefined call.
            for (const off of result.disposers?.[withdraw] ?? []) off();
          }
          return (r) => [r.decoration(target), r.decoration(otherTarget)];
        },
      });
      const session = createRuntimeSession(P, {
        prototypeName: P.name,
        getRawProps: () => ({}),
        schedule: (task) => task(),
        onRuntimeReady(wiring) {
          wiring.attach('feedback', [
            [OWNED_DECORATION_CAP, true],
            [
              EFFECTS_CAP,
              {
                queueStyle: (value: StyleHandle) => {
                  root.className = value.tokens.join(' ');
                },
                requestFlush() {},
              },
            ],
          ]);
        },
        commit(_children, signal) {
          const port = session.caps.getPort<FeedbackPort>('feedback')!;
          port.bindDecorations!(
            [
              {
                target,
                sink: (value) => {
                  decoration.className = value.tokens.join(' ');
                },
              },
              {
                target: otherTarget,
                sink: (value) => {
                  otherDecoration.className = value.tokens.join(' ');
                },
              },
            ],
            port.captureDecorationLease!()
          );
          signal?.done();
        },
      });
      try {
        await session.mount();
        expect(decoration.className).toBe(
          withdraw === 'retain' ? 'opacity-50 bg-red-500' : 'opacity-50'
        );
        expect(root.className).toBe('text-white');
        expect(otherDecoration.className).toBe('bg-blue-500');
        expect(setupCount).toBe(1);
        expect(result.disposers!.all[0]).toBe(result.disposers!.feedback![0]);
        expect(() => result.disposers!.feedback![0]()).toThrow(/setup only/i);
        expect(decoration.classList.contains('bg-red-500')).toBe(withdraw === 'retain');
        expect(otherDecoration.className).toBe('bg-blue-500');
      } finally {
        await session.dispose();
      }
    }
  );

  it('AS-HOOK-0500: render fragment returned by asHook can be composed into caller render', () => {
    const asFrag = defineAsHook({
      name: 'asFrag',
      setup() {
        return () => 'hook';
      },
    });

    const P: Prototype = definePrototype({
      name: 'x-as-hook-0500',
      setup() {
        const { render } = asFrag() as any;
        return () => [render?.(), 'host'];
      },
    });

    const { host, commits } = createHost(P.name);
    executeWithHost(P as any, host as any);

    const first = commits[0];
    expect(first).toEqual(['hook', 'host']);
  });

  it('AS-HOOK-0520: nested asHook state handles are not flattened into outer stateHandles', () => {
    let result: any;

    const asInner = defineAsHook<PropsBaseType, Record<string, never>, { value: State<boolean> }>({
      name: 'asNestedInner',
      setup(def) {
        def.state.bool('value', false);
      },
    });

    const asOuter = defineAsHook<
      PropsBaseType,
      Record<string, never>,
      { state: { open: State<boolean> } }
    >({
      name: 'asNestedOuter',
      setup(def) {
        asInner();
        def.state.bool('open', false);
      },
    });

    const P: Prototype = definePrototype({
      name: 'x-as-hook-0520',
      setup() {
        result = asOuter();
        return (r) => r.el('div', 'ok');
      },
    });

    const { host } = createHost(P.name);
    executeWithHost(P as any, host as any);

    expect(typeof result?.stateHandles?.open?.watch).toBe('function');
    expect(result?.stateHandles?.value).toBeUndefined();
    expect(result?.asHooks).toHaveLength(1);
    expect(result?.artifacts?.asHooks).toBe(result?.asHooks);
    expect(result?.asHooks?.[0]).toMatchObject({
      name: 'asNestedInner',
      order: expect.any(Number),
      privileged: false,
      mode: 'once',
    });
    expect(result?.getAsHook?.('asNestedInner')).toBe(result?.asHooks?.[0]);
    expect(typeof (result?.asHooks?.[0]?.result as any)?.stateHandles?.value?.watch).toBe(
      'function'
    );
  });

  it('AS-HOOK-0521: same state name is allowed across nested asHook setup frames', () => {
    let result: any;

    const asInner = defineAsHook<PropsBaseType, Record<string, never>, { value: State<boolean> }>({
      name: 'asNestedSameNameInner',
      setup(def) {
        def.state.bool('value', false);
      },
    });

    const asOuter = defineAsHook<PropsBaseType, Record<string, never>, { value: State<boolean> }>({
      name: 'asNestedSameNameOuter',
      setup(def) {
        asInner();
        def.state.bool('value', true);
      },
    });

    const P: Prototype = definePrototype({
      name: 'x-as-hook-0521',
      setup() {
        result = asOuter();
        return (r) => r.el('div', 'ok');
      },
    });

    const { host } = createHost(P.name);
    executeWithHost(P as any, host as any);

    expect(result?.stateHandles?.value?.get()).toBe(true);
    const nested = result?.getAsHook?.('asNestedSameNameInner')?.result as any;
    expect(nested?.stateHandles?.value?.get()).toBe(false);
    expect(result?.stateHandles?.value).not.toBe(nested?.stateHandles?.value);
  });

  it('AS-HOOK-0522: privileged child asHook calls are collected without a def API', () => {
    let result: any;

    const asOuter = defineAsHook({
      name: 'asPrivilegedChildCollector',
      setup(def) {
        asFocusable();
        def.state.bool('open', false);
      },
    });

    const P: Prototype = definePrototype({
      name: 'x-as-hook-0522',
      setup() {
        result = asOuter();
        return (r) => r.el('div', 'ok');
      },
    });

    const { host } = createHost(P.name);
    executeWithHost(P as any, host as any);

    expect(result?.asHooks).toHaveLength(1);
    expect(result?.asHooks?.[0]).toMatchObject({
      name: 'asFocusable',
      order: expect.any(Number),
      privileged: true,
      mode: 'once',
    });
    expect(typeof (result?.asHooks?.[0]?.result as any)?.focused?.watch).toBe('function');
  });

  it('keeps introduced Focus facts observed when synthesizing an authored caller result', async () => {
    let result: any;
    const asObservedFocus = defineAsHook({
      name: 'asObservedFocus',
      setup(def) {
        const focus = asFocusable();
        def.expose.state('focused', focus.focused);
        def.expose.state('focusVisible', focus.focusVisible);
      },
    });
    const P = definePrototype({
      name: 'x-as-hook-observed-focus',
      setup() {
        result = asObservedFocus();
      },
    });
    const { host } = createHost(P.name);
    const runtime = executeWithHost(P, host);
    try {
      for (const name of ['focused', 'focusVisible']) {
        const observed = result.getState(name);
        expect(observed.get()).toBe(false);
        expect(typeof observed.watch).toBe('function');
        expect(observed.setDefault).toBeUndefined();
        expect(observed.set).toBeUndefined();
      }
    } finally {
      await runtime.session.dispose();
    }
  });

  it('AS-HOOK-0550: setup return must follow prototype contract (render function or void)', () => {
    const asBad = defineAsHook({
      name: 'asBad',
      setup() {
        return { illegal: true } as any;
      },
    });

    const P: Prototype = definePrototype({
      name: 'x-as-hook-0550',
      setup() {
        expect(() => asBad()).toThrow(/render function or void/i);
        return (r) => r.el('div', 'ok');
      },
    });

    const { host } = createHost(P.name);
    executeWithHost(P as any, host as any);
  });

  it('AS-HOOK-0600: asHook trace is readable and includes name + order + privileged flag', () => {
    const asTrace = defineAsHook({
      name: 'asTrace',
      setup() {},
    });

    const P: Prototype = definePrototype({
      name: 'x-as-hook-0600',
      setup() {
        asTrace();
        return (r) => r.el('div', 'ok');
      },
    });

    const { host } = createHost(P.name);
    executeWithHost(P as any, host as any);

    const trace = (P as any).__asHooks as Array<any>;
    expect(Array.isArray(trace)).toBe(true);
    expect(trace.length).toBe(1);
    expect(trace[0]).toMatchObject({ name: 'asTrace', order: 0, privileged: false });

    const desc = Object.getOwnPropertyDescriptor(P as any, '__asHooks');
    expect(desc?.enumerable).toBe(false);
    expect(desc?.set).toBeUndefined();
  });

  it('AS-HOOK-0700: authored asHook caller is no-arg and setup receives only def', () => {
    let setupCount = 0;

    const asNoArgs = defineAsHook({
      name: 'asNoArgs',
      setup(def) {
        setupCount += 1;
        def.state.bool('ready', true);
      },
    });

    const P: Prototype = definePrototype({
      name: 'x-as-hook-0700',
      setup() {
        asNoArgs();
        return (r) => r.el('div', 'ok');
      },
    });

    const { host } = createHost(P.name);
    executeWithHost(P as any, host as any);

    expect(setupCount).toBe(1);
  });

  it('AS-HOOK-0800: repeated authored asHook calls skip later setup and reuse first result', () => {
    let setupCount = 0;
    let first: any;
    let second: any;

    const asOnceState = defineAsHook<
      PropsBaseType,
      Record<string, never>,
      { open: State<boolean> }
    >({
      name: 'asOnceState',
      setup(def) {
        setupCount += 1;
        def.state.bool('open', false);
      },
    });

    const P: Prototype = definePrototype({
      name: 'x-as-hook-0800',
      setup() {
        first = asOnceState();
        second = asOnceState();
        return (r) => r.el('div', 'ok');
      },
    });

    const { host } = createHost(P.name);
    executeWithHost(P as any, host as any);

    expect(setupCount).toBe(1);
    expect(first).toBe(second);
    expect(first.getState?.('open')?.get()).toBe(false);
    expect((P as any).__asHooks[0]).toMatchObject({ name: 'asOnceState', mode: 'once' });
  });

  it('AS-HOOK-0850: authored asHook may project one stable caller handle from captured artifacts', () => {
    let projectionCount = 0;
    let closeCount = 0;
    let first: any;
    let second: any;
    let outerResult: any;

    const asProjected = defineAsHook<
      PropsBaseType,
      Record<string, never>,
      { state: { open: State<boolean> } },
      { open: { get(): boolean }; close(): void }
    >({
      name: 'asProjected',
      setup(def) {
        def.state.bool('open', true);
        def.expose.method('close', () => {
          closeCount += 1;
        });
      },
      projectHandle(result) {
        projectionCount += 1;
        return {
          open: result.getState?.('open') as { get(): boolean },
          close: result.getMethod?.('close') as () => void,
        };
      },
    });

    const asProjectedOwner = defineAsHook({
      name: 'asProjectedOwner',
      setup() {
        first = asProjected();
        second = asProjected();
      },
    });

    const P: Prototype = definePrototype({
      name: 'x-as-hook-0850',
      setup() {
        outerResult = asProjectedOwner();
        return (r) => r.el('div', 'ok');
      },
    });

    const { host } = createHost(P.name);
    executeWithHost(P as any, host as any);

    expect(projectionCount).toBe(1);
    expect(first).toBe(second);
    expect(first.open.get()).toBe(true);
    first.close();
    expect(closeCount).toBe(1);

    expect((P as any).__asHooks).toContainEqual(
      expect.objectContaining({
        name: 'asProjected',
        mode: 'once',
        privileged: false,
      })
    );

    const recordedResult = outerResult.getAsHook('asProjected').result;
    const recordedHandle = outerResult.getAsHook('asProjected').handle;
    expect(recordedResult).not.toBe(first);
    expect(recordedHandle).toBe(first);
    expect(outerResult.getAsHookHandle('asProjected')).toBe(first);
    expect(recordedResult.getState('open')).toBe(first.open);
    expect(recordedResult.getMethod('close')).toBe(first.close);
    expect((P as any).__asHooks[0]).toMatchObject({
      name: 'asProjectedOwner',
      mode: 'once',
      privileged: false,
    });
  });
});

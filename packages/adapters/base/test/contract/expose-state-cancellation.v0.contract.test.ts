// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OwnedStateHandle, Prototype } from '@proto.ui/core';
import {
  EXPOSE_STATE_EXTERNAL_HANDLE,
  EXPOSES_RECORD_SINK_CAP,
  type ExposeStateExternalHandle,
} from '@proto.ui/module-expose-state';
import type { StatePort } from '@proto.ui/module-state';
import { createRuntimeSession, type RuntimeHost } from '@proto.ui/runtime';
import { bindInputShellControl } from '../../../../prototypes/shadcn/src/input-shell/bind-control';
import { createScopedExposesReader } from '../../src/host/exposes';

type Fact = 'focusVisible' | 'disabled';
type Failure = { reason: unknown };
type PublicFacts = Record<Fact, ExposeStateExternalHandle<boolean>> & {
  ping(): string;
  factory(): () => string;
  lookalike: { subscribe(): () => string };
  brandedLookalike: { subscribe(): () => string };
};
const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  const failures: unknown[] = [];
  try {
    for (const dispose of cleanups.splice(0).reverse()) {
      try {
        await dispose();
      } catch (error) {
        failures.push(error);
      }
    }
  } finally {
    vi.restoreAllMocks();
  }
  if (failures.length) throw new AggregateError(failures, 'State cancellation fixture cleanup');
});

function settled(action: () => void | Promise<void>) {
  return Promise.resolve()
    .then(action)
    .then(
      () => ({ status: 'fulfilled' as const }),
      (reason: unknown) => ({ status: 'rejected' as const, reason })
    );
}

/** Actual Runtime/State/ExposeState composition, with the Adapter reader boundary. */
async function runtime(cancelFailures: Partial<Record<Fact, Failure>> = {}) {
  let raw: Record<string, unknown> = {};
  let live = true;
  let invocations = 0;
  let ordinaryCalls = 0;
  const handles = {} as Record<Fact, OwnedStateHandle<boolean>>;
  const ordinary = () => {
    ordinaryCalls++;
    return 'ordinary';
  };
  const prototype: Prototype = {
    name: 'external-state-cancellation',
    setup(def) {
      for (const name of ['focusVisible', 'disabled'] as const) {
        handles[name] = def.state.bool(name, false);
        def.expose.state(name, handles[name]);
      }
      def.expose.method('ping', ordinary);
      def.expose.method('factory', () => ordinary);
      def.expose.value('lookalike', { subscribe: () => ordinary });
      def.expose.value('brandedLookalike', {
        [EXPOSE_STATE_EXTERNAL_HANDLE]: true,
        subscribe: () => ordinary,
      });
      return (r) => r.el('div', 'State cancellation consumer');
    },
  };
  const host: RuntimeHost<any> = {
    prototypeName: prototype.name,
    getRawProps: () => ({}),
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
    onRuntimeReady(wiring) {
      wiring.attach('expose-state', [
        [
          EXPOSES_RECORD_SINK_CAP,
          (record: Record<string, unknown>) => {
            raw = record;
          },
        ],
      ]);
    },
  };
  const session = createRuntimeSession(prototype, host);
  const reader = createScopedExposesReader(() =>
    live
      ? (call) => {
          invocations++;
          session.invokeInCallbackScope(call);
        }
      : null
  );
  const invalidate = () => {
    live = false;
    reader.invalidate();
  };
  const dispose = () => {
    // Same actual ordering as Vue2 beforeDestroy: retire the public reader first.
    invalidate();
    return session.dispose();
  };
  cleanups.push(dispose);

  const state = session.caps.getPort<StatePort>('state')!;
  const watch = state.watch.bind(state);
  let terminalDeliveryDepth = 0;
  const cancellations: Array<{ fact: Fact; duringDisconnect: boolean }> = [];
  vi.spyOn(state, 'watch').mockImplementation((handle, callback) => {
    const fact = (['focusVisible', 'disabled'] as const).find((name) => handle === handles[name]);
    if (!fact) return watch(handle, callback);
    const off = watch(handle, (context, event) => {
      if (event.type === 'disconnect') terminalDeliveryDepth++;
      try {
        callback(context, event);
      } finally {
        if (event.type === 'disconnect') terminalDeliveryDepth--;
      }
    });
    return () => {
      cancellations.push({ fact, duringDisconnect: terminalDeliveryDepth > 0 });
      off();
      // Failure injection follows the real State unregister; neither registration
      // nor disconnect delivery nor the ExposeState trackedOff is substituted.
      const failure = cancelFailures[fact];
      if (failure) throw failure.reason;
    };
  });
  await session.mount();
  const instance = { getExposes: () => reader.read(raw) as PublicFacts };
  return {
    session,
    instance,
    invalidate,
    dispose,
    cancellations,
    invocations: () => invocations,
    ordinaryCalls: () => ordinaryCalls,
    set(fact: Fact, value: boolean) {
      session.invokeInCallbackScope(() => handles[fact].set(value));
    },
  };
}

function bindingOwner(cleanupFailure?: Failure) {
  const callbacks = new Set<() => void>();
  let attempts = 0;
  return {
    isCurrent: () => true,
    onDispose(dispose: () => void) {
      callbacks.add(dispose);
      return () => {
        attempts++;
        callbacks.delete(dispose);
        if (cleanupFailure) throw cleanupFailure.reason;
      };
    },
    registrations: () => callbacks.size,
    attempts: () => attempts,
  };
}

function bindingTarget() {
  const writes: Array<{ focusVisible: boolean; disabled: boolean }> = [];
  return {
    instance: {},
    writes,
    setFacts: (facts: (typeof writes)[number]) => {
      writes.push(facts);
    },
  };
}

describe('external State cancellation and terminal InputShell binding', () => {
  it('cancels a real subscription after reader retirement without entering its owner again', async () => {
    const owner = await runtime();
    const state = owner.instance.getExposes().focusVisible;
    const events: string[] = [];
    const off = state.subscribe((event) => events.push(event.type));
    owner.set('focusVisible', true);
    expect(events).toEqual(['next']);
    const calls = owner.invocations();
    owner.invalidate();
    const cancellation = await settled(off);
    owner.set('focusVisible', false);
    const disposal = await settled(owner.dispose);
    expect(cancellation).toEqual({ status: 'fulfilled' });
    expect(disposal).toEqual({ status: 'fulfilled' });
    expect(events).toEqual(['next']);
    expect(owner.invocations()).toBe(calls);
    expect(() => state.get()).toThrow(/terminal disposal/);
    expect(() => state.subscribe(() => {})).toThrow(/terminal disposal/);
  });

  it('keeps an issued cancellation idempotent after complete instance disposal', async () => {
    const owner = await runtime();
    const state = owner.instance.getExposes().focusVisible;
    const events: string[] = [];
    const off = state.subscribe((event) => events.push(event.type));
    const calls = owner.invocations();
    const disposal = await settled(owner.dispose);
    const first = await settled(off);
    const second = await settled(off);
    expect(disposal).toEqual({ status: 'fulfilled' });
    expect([first, second]).toEqual([{ status: 'fulfilled' }, { status: 'fulfilled' }]);
    expect(events).toEqual(['disconnect']);
    expect(owner.invocations()).toBe(calls);
    expect(owner.session.instancePhase).toBe('disposed');
  });

  it('retires both real public facts inside terminal disconnect and releases the binding owner', async () => {
    const control = await runtime();
    const owner = bindingOwner(),
      target = bindingTarget();
    const binding = bindInputShellControl(owner, target, control.instance);
    const calls = control.invocations();
    const disposal = await settled(control.dispose);
    expect(disposal).toEqual({ status: 'fulfilled' });
    expect(control.cancellations).toEqual([
      { fact: 'focusVisible', duringDisconnect: true },
      { fact: 'disabled', duringDisconnect: true },
    ]);
    expect([owner.registrations(), owner.attempts()]).toEqual([0, 1]);
    expect(control.invocations()).toBe(calls);
    binding.sync();
    binding.dispose();
    expect(target.writes).toEqual([{ focusVisible: false, disabled: false }]);
    // The same real target can be owned by a replacement binding.
    const replacement = await runtime();
    const next = bindInputShellControl(bindingOwner(), target, replacement.instance);
    next.dispose();
  });

  it('preserves external identity and subscriptions across a repeatable view detach', async () => {
    const owner = await runtime();
    const state = owner.instance.getExposes().focusVisible;
    const events: string[] = [];
    const off = state.subscribe((event) => events.push(event.type));
    await owner.session.unmount();
    expect(owner.session.instancePhase).toBe('alive');
    expect(owner.instance.getExposes().focusVisible).toBe(state);
    owner.set('focusVisible', true);
    expect(state.get()).toBe(true);
    expect(events).toEqual(['next']);
    await owner.session.mount();
    expect(owner.instance.getExposes().focusVisible).toBe(state);
    off();
    owner.set('focusVisible', false);
    expect(events).toEqual(['next']);
    await owner.dispose();
  });

  it('keeps ordinary methods and factory-returned functions terminal-invalid', async () => {
    const owner = await runtime();
    const exposed = owner.instance.getExposes();
    const returned = exposed.factory();
    expect(exposed.ping()).toBe('ordinary');
    expect(returned()).toBe('ordinary');
    const calls = owner.invocations();
    await owner.dispose();
    expect(() => exposed.ping()).toThrow(/terminal disposal/);
    expect(() => returned()).toThrow(/terminal disposal/);
    expect(owner.ordinaryCalls()).toBe(2);
    expect(owner.invocations()).toBe(calls);
  });

  it.each(['lookalike', 'brandedLookalike'] as const)(
    'does not grant cancellation authority to an authored %s subscribe result',
    async (name) => {
      const owner = await runtime();
      const returned = owner.instance.getExposes()[name].subscribe();
      expect(returned()).toBe('ordinary');
      await owner.dispose();
      expect(() => returned()).toThrow(/terminal disposal/);
      expect(owner.ordinaryCalls()).toBe(1);
    }
  );

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['false', false],
    ['zero', 0],
    ['negative zero', -0],
    ['NaN', NaN],
    ['empty string', ''],
    ['Error', new Error('first cancellation')],
  ])(
    'preserves the first real %s cancellation failure after attempting all cleanups',
    async (_name, reason) => {
      const control = await runtime({
        focusVisible: { reason },
        disabled: { reason: new Error('later cancellation') },
      });
      const owner = bindingOwner({ reason: new Error('later owner cleanup') }),
        target = bindingTarget();
      const binding = bindInputShellControl(owner, target, control.instance);
      const disposal = await settled(control.dispose);
      expect(disposal.status).toBe('rejected');
      if (disposal.status !== 'rejected') throw new Error('Expected the injected cleanup failure');
      expect(disposal.reason).toBe(reason);
      expect(control.cancellations).toEqual([
        { fact: 'focusVisible', duringDisconnect: true },
        { fact: 'disabled', duringDisconnect: true },
      ]);
      expect([owner.registrations(), owner.attempts()]).toEqual([0, 1]);
      expect(control.session.instancePhase).toBe('disposed');
      binding.sync();
      binding.dispose();
      expect(target.writes).toEqual([{ focusVisible: false, disabled: false }]);
      expect(control.cancellations).toHaveLength(2);
    }
  );
});

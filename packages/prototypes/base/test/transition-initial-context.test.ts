import { afterEach, describe, expect, it } from 'vitest';
import { createContextKey, definePrototype, type RunHandle } from '@proto.ui/core';
import { createRuntimeSession, type RuntimeHost, type RuntimeSession } from '@proto.ui/runtime';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import { EXPOSE_STATE_SET_EXPOSES_CAP } from '@proto.ui/module-expose-state';
import { asTransition, type TransitionHandles, type TransitionProps } from '../src/transition';

// C-AS-TRANSITION-0001-O: a declarative single initial sample, not a target observer.
// Agent: dot
type Value = { open: boolean; other: boolean; label: string; optional?: boolean };
const sessions: Array<RuntimeSession<any>> = [];
afterEach(async () => {
  for (const session of sessions.reverse()) await session.dispose();
  sessions.length = 0;
});

function fixture(
  options: {
    props?: TransitionProps;
    value?: Record<string, unknown>;
    provider?: boolean;
    subscribe?: boolean;
    bind?: (handle: TransitionHandles, key: ReturnType<typeof createContextKey<Value>>) => void;
  } = {}
) {
  const key = createContextKey<Value>('transition-initial-context');
  const providerToken = {};
  const consumerToken = {};
  let exposes: Record<string, any> = {};
  let providerRun!: RunHandle<any>;
  const events: string[] = [];
  let handle!: TransitionHandles;
  const host = (name: string, token: object, props: TransitionProps = {}): RuntimeHost<any> => ({
    prototypeName: name,
    getRawProps: () => props,
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
    scheduleDelay(durationMs, task) {
      const timer = setTimeout(task, durationMs);
      return {
        cancel() {
          clearTimeout(timer);
        },
      };
    },
    onRuntimeReady(wiring) {
      if (token === consumerToken)
        wiring.attach('expose-state', [
          [
            EXPOSE_STATE_SET_EXPOSES_CAP,
            (next: Record<string, any>) => {
              exposes = next;
            },
          ],
        ]);
      wiring.attach('context', [
        [CONTEXT_INSTANCE_TOKEN_CAP, token],
        [
          CONTEXT_PARENT_CAP,
          (instance: unknown) => (instance === consumerToken ? providerToken : null),
        ],
      ]);
    },
  });
  if (options.provider !== false) {
    const provider = definePrototype({
      name: 'initial-open-provider',
      setup(def) {
        def.context.provide(
          key,
          (options.value ?? { open: true, other: false, label: 'ok' }) as Value
        );
        def.lifecycle.onCreated((run) => {
          providerRun = run;
        });
      },
    });
    sessions.push(createRuntimeSession(provider, host(provider.name, providerToken)));
  }
  const consumer = definePrototype<TransitionProps>({
    name: 'initial-open-consumer',
    setup(def) {
      handle = asTransition();
      if (options.subscribe !== false) def.context.subscribe(key);
      if (options.bind) options.bind(handle, key);
      else handle.bindInitialOpen<Value>({ context: key, field: 'open' });
      def.lifecycle.onCreated(() => events.push(handle.transitionState.get()));
      return (r) => r.el('div', 'transition');
    },
  });
  const session = createRuntimeSession(consumer, host(consumer.name, consumerToken, options.props));
  sessions.push(session);
  return {
    session,
    handle,
    events,
    key,
    providerRun,
    provider: sessions[0],
    getExposes: () => exposes,
  };
}

describe('Transition initial boolean context binding', () => {
  it('initializes directly entered from the context and samples only once across later epochs', async () => {
    const f = fixture();
    expect(f.events).toEqual(['entered']);
    expect(f.session.viewIntent.getSnapshot().present).toBe(true);
    await f.session.mount();
    await f.session.unmount();
    f.provider.invokeInCallbackScope(() =>
      f.providerRun.context.update(f.key, { open: false, other: false, label: 'changed' })
    );
    await f.session.mount();
    // Unmount resets the phase to closed; remembered target remains true and mounts entering.
    expect(f.handle.transitionState.get()).toBe('entering');
    expect(f.events).toEqual(['entered']);
  });
  it('copies source identity, tolerates identical setup bind and rejects a different source', () => {
    const f = fixture({
      bind(handle, key) {
        const source: { context: typeof key; field: 'open' | 'other' } = {
          context: key,
          field: 'open',
        };
        handle.bindInitialOpen<Value>(source);
        source.field = 'other';
        handle.bindInitialOpen<Value>({ context: key, field: 'open' });
        expect(() => handle.bindInitialOpen<Value>(source)).toThrow(/already bound/);
      },
    });
    expect(f.events).toEqual(['entered']);
    expect(() =>
      f.session.invokeInCallbackScope(() =>
        f.handle.bindInitialOpen<Value>({ context: f.key, field: 'open' })
      )
    ).toThrow(/phase/i);
  });
  it('rejects binding through runtime exposes and after terminal disposal', async () => {
    const f = fixture();
    const source = { context: f.key, field: 'open' as const };
    const exposedBind = f.getExposes().bindInitialOpen;
    expect(() => exposedBind(source)).toThrow(/phase/i);
    await f.session.dispose();
    expect(() => f.handle.bindInitialOpen<Value>(source)).toThrow(/disposed|phase/i);
    expect(f.getExposes().bindInitialOpen).toBeUndefined();
    expect(() => exposedBind(source)).toThrow(/disposed|phase/i);
  });
  for (const props of [
    { open: false },
    { open: true },
    { defaultOpen: false },
    { defaultOpen: true },
  ]) {
    it(`does not read an unprovided, unsubscribed context for explicit ${JSON.stringify(props)}`, () => {
      const f = fixture({ props, provider: false, subscribe: false });
      expect(f.events).toEqual([(props.open ?? props.defaultOpen) ? 'entered' : 'closed']);
    });
  }
  it('propagates an undeclared-context read rather than fabricating false', () => {
    expect(() => fixture({ subscribe: false })).toThrow(/subscription/i);
  });
  it('propagates missing-provider errors', () => {
    expect(() => fixture({ provider: false })).toThrow(/provider|context/i);
  });
  for (const value of [
    { other: false, label: 'missing' },
    { open: 1, other: false, label: 'invalid' },
  ]) {
    it(`rejects a missing or nonboolean direct field: ${value.label}`, () => {
      expect(() => fixture({ value })).toThrow(/required boolean/);
    });
  }
  it('limits the typed field to required boolean keys', () => {
    const f = fixture();
    if (false) {
      // @ts-expect-error non-boolean field cannot supply an initial target
      f.handle.bindInitialOpen<Value>({ context: f.key, field: 'label' });
      // @ts-expect-error optional boolean cannot supply a required initial target
      f.handle.bindInitialOpen<Value>({ context: f.key, field: 'optional' });
      // @ts-expect-error paths/selectors are not direct keys
      f.handle.bindInitialOpen<Value>({ context: f.key, field: 'nested.open' });
    }
    expect(f.handle.transitionState.get()).toBe('entered');
  });
});

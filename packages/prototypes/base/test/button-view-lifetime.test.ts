import { describe, expect, it } from 'vitest';
import { definePrototype, type OwnedStateHandle, type Prototype } from '@proto.ui/core';
import { createRuntimeSession, type RuntimeHost } from '@proto.ui/runtime';
import { EVENT_GLOBAL_TARGET_CAP, EVENT_ROOT_TARGET_CAP } from '@proto.ui/module-event';
import {
  AS_TRIGGER_GET_PROTO_CAP,
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_PARENT_CAP,
} from '@proto.ui/module-as-trigger';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import { EXPOSE_STATE_SET_EXPOSES_CAP } from '@proto.ui/module-expose-state';
import baseButton, { asButton } from '../src/button';
import shadcnButton from '../../shadcn/src/button';
import brutalistButton from '../../brutalist/src/button';

const composedButton = definePrototype({
  name: 'button-view-lifetime-as-hook',
  setup() {
    asButton();
  },
});

const entries = [
  ['direct', baseButton],
  ['asHook', composedButton],
  ['shadcn', shadcnButton],
  ['brutalist', brutalistButton],
] as const;

function createHost(source: Prototype<any, any>) {
  let raw: Record<string, unknown> = {};
  let target = new EventTarget();
  let exposes: Record<string, any> = {};
  let retained!: OwnedStateHandle<string>;
  let setupCount = 0;
  const clicks: string[] = [];
  const identity = {
    addEventListener: (...args: Parameters<EventTarget['addEventListener']>) =>
      target.addEventListener(...args),
    removeEventListener: (...args: Parameters<EventTarget['removeEventListener']>) =>
      target.removeEventListener(...args),
    dispatchEvent: (event: Event) => target.dispatchEvent(event),
  };
  // Delegate the original entry without adding lifecycle behavior. The extra
  // App-owned slot makes unintended instance/state recreation observable.
  const proto = definePrototype({
    ...source,
    name: `${source.name}-view-lifetime`,
    setup(def) {
      setupCount += 1;
      retained = def.state.string('fixtureValue', 'initial');
      def.expose.state('fixtureValue', retained);
      return source.setup(def);
    },
  });
  const host: RuntimeHost<any> = {
    prototypeName: proto.name,
    getRawProps: () => raw,
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
    onRuntimeReady(wiring) {
      wiring.attach('event', [
        [EVENT_ROOT_TARGET_CAP, () => target],
        [EVENT_GLOBAL_TARGET_CAP, () => target],
      ]);
      wiring.attach('as-trigger', [
        [AS_TRIGGER_INSTANCE_CAP, identity],
        [AS_TRIGGER_PARENT_CAP, () => null],
        [AS_TRIGGER_GET_PROTO_CAP, () => null],
      ]);
      wiring.attach('expose-event', [[EXPOSE_EVENT_SINK_CAP, (key: string) => clicks.push(key)]]);
      wiring.attach('expose-state', [
        [EXPOSE_STATE_SET_EXPOSES_CAP, (next: Record<string, unknown>) => (exposes = next)],
      ]);
    },
  };
  const session = createRuntimeSession(proto, host);
  return {
    session,
    clicks,
    get target() {
      return target;
    },
    get exposes() {
      return exposes;
    },
    get setupCount() {
      return setupCount;
    },
    emit(type: string) {
      target.dispatchEvent(new CustomEvent(type));
    },
    replaceTarget() {
      target = new EventTarget();
    },
    setProps(next: Record<string, unknown>) {
      raw = next;
      session.controller.applyRawProps(raw);
    },
    remember(value: string) {
      session.invokeInCallbackScope(() => retained.set(value));
    },
    facts() {
      return { pressed: exposes.pressed.get(), hovered: exposes.hovered.get() };
    },
  };
}

describe('prototypes/base: Button view lifetime', () => {
  it.each(entries)(
    '%s ends press and hover on detach without replacing logical state',
    async (_name, prototype) => {
      // T-BASE-BUTTON-0001-CASE-VIEW-LIFETIME
      const ctx = createHost(prototype);
      try {
        await ctx.session.mount();
        ctx.remember('retained owner value');
        const handles = { ...ctx.exposes };

        for (const mode of ['press', 'hover'] as const) {
          ctx.emit('pointer.enter');
          if (mode === 'press') ctx.emit('pointer.down');
          expect(ctx.facts()).toEqual({ pressed: mode === 'press', hovered: true });
          const epoch = ctx.session.mountEpoch;
          const oldTarget = ctx.target;
          await ctx.session.unmount();
          expect(ctx.session.mountPhase).toBe('detached');
          const detachedFacts = ctx.facts();
          oldTarget.dispatchEvent(new CustomEvent('pointer.up'));
          oldTarget.dispatchEvent(new CustomEvent('pointer.leave'));
          oldTarget.dispatchEvent(new CustomEvent('press.commit'));

          ctx.replaceTarget();
          expect(ctx.target).not.toBe(oldTarget);
          await ctx.session.mount();
          expect(ctx.session.mountEpoch).toBe(epoch + 1);
          expect(ctx.session.mountPhase).toBe('mounted');
          expect(ctx.setupCount).toBe(1);
          for (const key of ['pressed', 'hovered', 'disabled', 'fixtureValue']) {
            expect(ctx.exposes[key], key).toBe(handles[key]);
          }
          expect(ctx.exposes.fixtureValue.get()).toBe('retained owner value');
          expect(ctx.exposes.disabled.get()).toBe(false);
          expect(ctx.clicks).toEqual([]);
          expect(detachedFacts, `${mode} must end with its view`).toEqual({
            pressed: false,
            hovered: false,
          });
          expect(ctx.facts()).toEqual({ pressed: false, hovered: false });

          // A stale route stays inert after replacement; fresh input still works.
          oldTarget.dispatchEvent(new CustomEvent('pointer.down'));
          oldTarget.dispatchEvent(new CustomEvent('press.commit'));
          expect(ctx.facts()).toEqual({ pressed: false, hovered: false });
          expect(ctx.clicks).toEqual([]);
          ctx.emit('pointer.enter');
          expect(ctx.exposes.hovered.get()).toBe(true);
          ctx.emit('pointer.leave');
          expect(ctx.facts()).toEqual({ pressed: false, hovered: false });
        }
      } finally {
        await ctx.session.dispose();
      }
    }
  );

  it.each(entries)(
    '%s retains normal cancellation disabled state and terminal cleanup',
    async (_name, prototype) => {
      // T-BASE-BUTTON-0001-CASE-VIEW-LIFETIME
      const ctx = createHost(prototype);
      try {
        await ctx.session.mount();
        const pressed = ctx.exposes.pressed;
        ctx.remember('control value');
        ctx.emit('pointer.enter');
        ctx.emit('pointer.down');
        ctx.emit('pointer.up');
        expect(ctx.facts()).toEqual({ pressed: false, hovered: true });
        ctx.emit('pointer.leave');
        expect(ctx.facts()).toEqual({ pressed: false, hovered: false });
        ctx.emit('pointer.enter');
        ctx.emit('pointer.down');
        ctx.emit('pointer.cancel');
        expect(ctx.facts()).toEqual({ pressed: false, hovered: false });

        ctx.emit('pointer.enter');
        ctx.emit('pointer.down');
        ctx.setProps({ disabled: true });
        expect(ctx.facts()).toEqual({ pressed: false, hovered: false });
        await ctx.session.unmount();
        ctx.replaceTarget();
        await ctx.session.mount();
        expect(ctx.exposes.disabled.get()).toBe(true);
        expect(ctx.exposes.pressed).toBe(pressed);
        expect(ctx.exposes.fixtureValue.get()).toBe('control value');
        ctx.emit('pointer.enter');
        ctx.emit('pointer.down');
        ctx.emit('press.commit');
        expect(ctx.facts()).toEqual({ pressed: false, hovered: false });
        expect(ctx.clicks).toEqual([]);

        ctx.setProps({});
        ctx.emit('pointer.down');
        ctx.emit('press.commit');
        expect(ctx.exposes.pressed.get()).toBe(false);
        expect(ctx.clicks).toEqual(['click']);
        ctx.emit('pointer.enter');
        ctx.emit('pointer.down');
        await ctx.session.dispose();
        expect(ctx.session.instancePhase).toBe('disposed');
        ctx.emit('pointer.up');
        ctx.emit('press.commit');
        expect(ctx.clicks).toEqual(['click']);
        expect(() => pressed.get()).toThrow();
        expect(ctx.setupCount).toBe(1);
      } finally {
        await ctx.session.dispose();
      }
    }
  );
});

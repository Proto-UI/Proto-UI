import { describe, expect, it } from 'vitest';
import type { Prototype } from '@proto.ui/core';
import { definePrototype } from '@proto.ui/core';
import type { RuntimeHost } from '@proto.ui/runtime';
import { executeWithHost } from '@proto.ui/runtime';
import {
  EVENT_EMIT_CAP,
  EVENT_GLOBAL_TARGET_CAP,
  EVENT_ROOT_TARGET_CAP,
} from '@proto.ui/module-event';
import {
  AS_TRIGGER_GET_PROTO_CAP,
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_PARENT_CAP,
} from '@proto.ui/module-as-trigger';
import {
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_ORDER_OBSERVER_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_ROOT_TARGET_CAP,
} from '@proto.ui/module-anatomy';
import { EXPOSE_STATE_SET_EXPOSES_CAP } from '@proto.ui/module-expose-state';
import slider from '../src/slider';
import { asSliderRoot } from '../src/slider';

function createHost(initialRaw: Record<string, unknown> = {}) {
  let raw = { ...initialRaw };
  const rootTarget = new EventTarget();
  const globalTarget = new EventTarget();
  const emitted: Array<{ key: string; payload: unknown }> = [];
  let exposes: Record<string, any> | null = null;
  const instance = {};

  const host: RuntimeHost<any> = {
    prototypeName: 'base-slider-contract',
    getRawProps: () => raw,
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
    onRuntimeReady(wiring) {
      wiring.attach('event', [
        [EVENT_ROOT_TARGET_CAP, () => rootTarget],
        [EVENT_GLOBAL_TARGET_CAP, () => globalTarget],
        [EVENT_EMIT_CAP, (key: string, payload: unknown) => emitted.push({ key, payload })],
      ]);
      wiring.attach('as-trigger', [
        [AS_TRIGGER_INSTANCE_CAP, rootTarget],
        [AS_TRIGGER_PARENT_CAP, () => null],
        [AS_TRIGGER_GET_PROTO_CAP, () => null],
      ]);
      wiring.attach('expose-state', [
        [EXPOSE_STATE_SET_EXPOSES_CAP, (next: Record<string, unknown>) => (exposes = next)],
      ]);
      wiring.attach('anatomy', [
        [ANATOMY_INSTANCE_TOKEN_CAP, instance],
        [ANATOMY_PARENT_CAP, () => null],
        [ANATOMY_GET_PROTO_CAP, () => null],
        [ANATOMY_ROOT_TARGET_CAP, (inst: unknown) => inst as EventTarget],
        [
          ANATOMY_ORDER_OBSERVER_CAP,
          (_target: unknown, _notify: () => void) => {
            return () => {};
          },
        ],
      ]);
    },
  };

  return {
    host,
    rootTarget,
    emitted,
    applyRawProps(next: Record<string, unknown>) {
      raw = { ...next };
    },
    getExposes() {
      return exposes;
    },
  };
}

describe('prototypes/base: slider', () => {
  it('initializes from defaultValue and updates on slide.commit', () => {
    const ctx = createHost({ defaultValue: 50, min: 0, max: 100, step: 1 });
    const { invokeUnmounted } = executeWithHost(slider as any, ctx.host as any);

    const exposes = ctx.getExposes() as any;
    expect(exposes.value.get()).toBe(50);

    ctx.rootTarget.dispatchEvent(new CustomEvent('slide.commit', { detail: { value: 75 } }));

    expect(exposes.value.get()).toBe(75);
    expect(ctx.emitted).toEqual([{ key: 'valueChange', payload: { value: 75 } }]);

    invokeUnmounted();
  });

  it('clamps value to min/max on slide.commit', () => {
    const ctx = createHost({ defaultValue: 50, min: 0, max: 100, step: 1 });
    executeWithHost(slider as any, ctx.host as any);

    const exposes = ctx.getExposes() as any;

    ctx.rootTarget.dispatchEvent(new CustomEvent('slide.commit', { detail: { value: 150 } }));
    expect(exposes.value.get()).toBe(100);

    ctx.rootTarget.dispatchEvent(new CustomEvent('slide.commit', { detail: { value: -10 } }));
    expect(exposes.value.get()).toBe(0);
  });

  it('rounds value to nearest step on slide.commit', () => {
    const ctx = createHost({ defaultValue: 0, min: 0, max: 100, step: 10 });
    executeWithHost(slider as any, ctx.host as any);

    const exposes = ctx.getExposes() as any;

    ctx.rootTarget.dispatchEvent(new CustomEvent('slide.commit', { detail: { value: 44 } }));
    expect(exposes.value.get()).toBe(40);

    ctx.rootTarget.dispatchEvent(new CustomEvent('slide.commit', { detail: { value: 46 } }));
    expect(exposes.value.get()).toBe(50);
  });

  it('controlled value does not mutate local state', () => {
    const P: Prototype<{ value?: number; min?: number; max?: number; step?: number }> =
      definePrototype({
        name: 'x-base-as-slider',
        setup() {
          asSliderRoot();
          return (r) => r.el('div', 'slider');
        },
      });

    const ctx = createHost({ value: 30, min: 0, max: 100, step: 1 });
    const { controller, invokeUnmounted } = executeWithHost(P as any, ctx.host as any);

    const exposes = ctx.getExposes() as any;
    expect(exposes.value.get()).toBe(30);

    ctx.rootTarget.dispatchEvent(new CustomEvent('slide.commit', { detail: { value: 80 } }));

    expect(exposes.value.get()).toBe(30);
    expect(ctx.emitted).toEqual([{ key: 'valueChange', payload: { value: 80 } }]);

    ctx.applyRawProps({ value: 80 });
    controller.applyRawProps({ value: 80 } as any);
    expect(exposes.value.get()).toBe(80);

    invokeUnmounted();
  });

  it('disabled slider suppresses slide.commit', () => {
    const ctx = createHost({ defaultValue: 50, disabled: true });
    executeWithHost(slider as any, ctx.host as any);

    const exposes = ctx.getExposes() as any;
    expect(exposes.value.get()).toBe(50);

    ctx.rootTarget.dispatchEvent(new CustomEvent('slide.commit', { detail: { value: 75 } }));

    expect(exposes.value.get()).toBe(50);
    expect(ctx.emitted).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { definePrototype, type Prototype } from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';
import { executeWithHost, type RuntimeHost } from '@proto.ui/runtime';
import { EXPOSE_STATE_SET_EXPOSES_CAP } from '@proto.ui/module-expose-state';
import { PRESENCE_HOST_BRIDGE_CAP } from '@proto.ui/module-presence';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import { RULE_META_GET_CAP } from '@proto.ui/module-rule-meta';
import { asTransition, type TransitionProps } from '../src/transition';

type Delay = { durationMs: number; task: () => void; cancelled: boolean };

function createHost(initialRaw: Partial<TransitionProps> = {}) {
  let raw: Partial<TransitionProps> = { ...initialRaw };
  let exposes: any = null;
  const emitted: string[] = [];
  const delays: Delay[] = [];
  let onEvent: (key: string) => void = () => {};
  const host: RuntimeHost<TransitionProps> = {
    prototypeName: 'transition-timing-matrix',
    getRawProps: () => raw as Readonly<TransitionProps>,
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
    scheduleDelay(durationMs, task) {
      const record: Delay = { durationMs, task, cancelled: false };
      delays.push(record);
      return {
        cancel() {
          record.cancelled = true;
        },
      };
    },
    onRuntimeReady(wiring) {
      wiring.attach('presence', [
        [PRESENCE_HOST_BRIDGE_CAP, { mount() {}, unmount() {} }],
      ]);
      wiring.attach('expose-state', [
        [EXPOSE_STATE_SET_EXPOSES_CAP, (next: Record<string, unknown>) => (exposes = next)],
      ]);
      wiring.attach('expose-event', [
        [
          EXPOSE_EVENT_SINK_CAP,
          (key: string) => {
            emitted.push(key);
            onEvent(key);
          },
        ],
      ]);
      wiring.attach('rule-meta', [
        [RULE_META_GET_CAP, (key: string) => (key === 'reducedMotion' ? 'no-preference' : undefined)],
      ]);
    },
  };
  return {
    host,
    emitted,
    delays,
    at(fn: (key: string) => void) {
      onEvent = fn;
    },
    getExposes(): any {
      return exposes;
    },
  };
}

function mount(raw: Partial<TransitionProps>, setup?: (transition: ReturnType<typeof asTransition>) => void) {
  const ctx = createHost(raw);
  const proto = definePrototype<TransitionProps>({
    name: 'transition-timing-matrix',
    setup() {
      const transition = asTransition();
      setup?.(transition);
      return (r) => r.el('div', 'ok');
    },
  });
  const result = executeWithHost<PropsBaseType>(
    proto as Prototype<PropsBaseType>,
    ctx.host as RuntimeHost<PropsBaseType>
  );
  return { ctx, result };
}

describe('runtime transition timing matrix', () => {
  it('cold start stays closed without a view', () => {
    const { ctx, result } = mount({});
    expect(ctx.getExposes().transitionState.get()).toBe('closed');
    expect(ctx.getExposes().isPresent.get()).toBe(false);
    expect(result.session.viewIntent.getSnapshot().present).toBe(false);
    expect(ctx.emitted).toEqual([]);
    expect(ctx.delays).toEqual([]);
  });

  it('cold preparation releases to entered without animation events', () => {
    const ctx = createHost({ defaultOpen: true });
    const proto = definePrototype<TransitionProps>({
      name: 'transition-timing-prepare',
      setup() {
        asTransition().configure({
          coldEntryPreparation: true,
          appear: false,
          enterDuration: 40,
          leaveDuration: 25,
        });
        return (r) => r.el('div', 'ok');
      },
    });
    const result = executeWithHost<PropsBaseType>(
      proto as Prototype<PropsBaseType>,
      ctx.host as RuntimeHost<PropsBaseType>
    );
    const exposes = ctx.getExposes();
    expect(exposes.transitionState.get()).toBe('preparing');
    expect(exposes.isPresent.get()).toBe(true);
    expect(result.session.viewIntent.getSnapshot().present).toBe(true);
    expect(ctx.emitted).toEqual([]);
    const release = exposes.controls.capturePreparation();
    expect(typeof release).toBe('function');
    result.invokeInCallbackScope(() => release());
    expect(exposes.transitionState.get()).toBe('entered');
    expect(ctx.emitted).toEqual([]);
    expect(ctx.delays).toEqual([]);
  });

  it('afterLeave synchronous enter keeps the new view', () => {
    const { ctx, result } = mount({});
    const exposes = ctx.getExposes();
    result.invokeInCallbackScope(() => exposes.controls.enter());
    result.invokeInCallbackScope(() => exposes.controls.complete());
    expect(exposes.transitionState.get()).toBe('entered');
    ctx.at((key) => {
      if (key === 'afterLeave') exposes.controls.enter();
    });
    result.invokeInCallbackScope(() => exposes.controls.leave());
    result.invokeInCallbackScope(() => exposes.controls.complete());
    expect(ctx.emitted).toContain('afterLeave');
    expect(exposes.transitionState.get()).toBe('entering');
    expect(exposes.isPresent.get()).toBe(true);
    expect(result.session.viewIntent.getSnapshot().present).toBe(true);
    for (const delay of ctx.delays.filter((delay) => delay.cancelled)) delay.task();
    expect(exposes.transitionState.get()).toBe('entering');
    expect(result.session.viewIntent.getSnapshot().present).toBe(true);
    for (const delay of ctx.delays.filter((delay) => !delay.cancelled)) delay.task();
    expect(exposes.transitionState.get()).toBe('entered');
    expect(result.session.viewIntent.getSnapshot().present).toBe(true);
  });

  it('a superseded delay cannot complete the newer phase', () => {
    const { ctx, result } = mount({});
    const exposes = ctx.getExposes();
    result.invokeInCallbackScope(() => exposes.controls.enter());
    const entry = ctx.delays[0];
    expect(entry?.cancelled).toBe(false);
    result.invokeInCallbackScope(() => exposes.controls.leave());
    expect(entry?.cancelled).toBe(true);
    expect(exposes.transitionState.get()).toBe('leaving');
    entry?.task();
    expect(exposes.transitionState.get()).toBe('leaving');
    expect(result.session.viewIntent.getSnapshot().present).toBe(true);
  });

  it('duplicate complete finishes the phase once', () => {
    const { ctx, result } = mount({});
    const exposes = ctx.getExposes();
    result.invokeInCallbackScope(() => exposes.controls.enter());
    result.invokeInCallbackScope(() => exposes.controls.complete());
    result.invokeInCallbackScope(() => exposes.controls.complete());
    expect(exposes.transitionState.get()).toBe('entered');
    expect(ctx.emitted.filter((key) => key === 'afterEnter')).toEqual(['afterEnter']);
  });

  it('dispose invalidates the armed completion', async () => {
    const { ctx, result } = mount({});
    const exposes = ctx.getExposes();
    result.invokeInCallbackScope(() => exposes.controls.enter());
    const entry = ctx.delays[0];
    await result.session.dispose();
    expect(entry?.cancelled).toBe(true);
    expect(() => entry?.task()).not.toThrow();
    expect(() => exposes.transitionState.get()).toThrow(/disposed/);
    expect(() => exposes.controls.enter()).not.toThrow();
    expect(ctx.emitted.filter((key) => key === 'afterEnter')).toEqual([]);
  });

  it('an old unmount epoch cannot complete a newer entry', async () => {
    const { ctx, result } = mount({});
    const exposes = ctx.getExposes();
    result.invokeInCallbackScope(() => exposes.controls.enter());
    const old = ctx.delays[0];
    await result.session.unmount();
    expect(exposes.transitionState.get()).toBe('closed');
    expect(old?.cancelled).toBe(true);
    await result.session.mount();
    result.invokeInCallbackScope(() => exposes.controls.enter());
    expect(exposes.transitionState.get()).toBe('entering');
    old?.task();
    expect(exposes.transitionState.get()).toBe('entering');
    expect(result.session.viewIntent.getSnapshot().present).toBe(true);
  });
});

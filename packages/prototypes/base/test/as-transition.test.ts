import { describe, expect, it } from 'vitest';
import { HOST_ELEMENT_CAP, definePrototype, type DefHandle, type Prototype } from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';
import type { RuntimeHost } from '@proto.ui/runtime';
import { executeWithHost } from '@proto.ui/runtime';
import { EXPOSE_STATE_SET_EXPOSES_CAP } from '@proto.ui/module-expose-state';
import { PRESENCE_HOST_BRIDGE_CAP } from '@proto.ui/module-presence';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import { RULE_META_GET_CAP } from '@proto.ui/module-rule-meta';
import { asOverlay } from '@proto.ui/hooks';
import { OVERLAY_GLOBAL_MOUNT_CAP, OVERLAY_MODAL_CAP } from '@proto.ui/module-overlay';
import {
  asTransition,
  transition as baseTransition,
  type TransitionProps,
  type TransitionExposes,
} from '../src/transition';

function createHost(
  initialRaw: Partial<TransitionProps> = {},
  opts: {
    bridge?: { mount?: () => void; unmount?: () => void };
    reducedMotion?: 'reduce' | 'no-preference';
    overlay?: {
      hostElement: HTMLElement;
      mount(): void;
      unmount(): void;
      lock(): void;
      unlock(): void;
    };
  } = {}
) {
  let raw: Partial<TransitionProps> = { ...initialRaw };
  let exposes: any = null;
  const bridgeCalls = { mount: 0, unmount: 0 };
  const emitted: Array<{ key: string; payload: unknown }> = [];
  const delays: Array<{
    durationMs: number;
    task: () => void;
    cancelled: boolean;
  }> = [];

  const host: RuntimeHost<TransitionProps> = {
    prototypeName: 'as-transition-contract',
    getRawProps: () => raw as Readonly<TransitionProps>,
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
    scheduleDelay(durationMs, task) {
      const record = { durationMs, task, cancelled: false };
      delays.push(record);
      return {
        cancel() {
          record.cancelled = true;
        },
      };
    },
    onRuntimeReady(wiring) {
      wiring.attach('presence', [
        [
          PRESENCE_HOST_BRIDGE_CAP,
          {
            mount: () => {
              bridgeCalls.mount++;
              opts.bridge?.mount?.();
            },
            unmount: () => {
              bridgeCalls.unmount++;
              opts.bridge?.unmount?.();
            },
          },
        ],
      ]);
      wiring.attach('expose-state', [
        [EXPOSE_STATE_SET_EXPOSES_CAP, (next: Record<string, unknown>) => (exposes = next as any)],
      ]);
      wiring.attach('expose-event', [
        [EXPOSE_EVENT_SINK_CAP, (key: string, payload: unknown) => emitted.push({ key, payload })],
      ]);
      wiring.attach('rule-meta', [
        [
          RULE_META_GET_CAP,
          (key: string) =>
            key === 'reducedMotion' ? (opts.reducedMotion ?? 'no-preference') : undefined,
        ],
      ]);
      if (opts.overlay) {
        wiring.attach('overlay', [
          [HOST_ELEMENT_CAP, opts.overlay.hostElement],
          [OVERLAY_GLOBAL_MOUNT_CAP, { mount: opts.overlay.mount, unmount: opts.overlay.unmount }],
          [OVERLAY_MODAL_CAP, { lock: opts.overlay.lock, unlock: opts.overlay.unlock }],
        ]);
      }
    },
  };

  return {
    host,
    applyRawProps(next: Partial<TransitionProps>) {
      raw = { ...next };
    },
    getExposes(): any {
      return exposes!;
    },
    getBridgeCalls() {
      return bridgeCalls;
    },
    getEmitted() {
      return emitted;
    },
    getDelays() {
      return delays;
    },
    flushDelay(index: number) {
      delays[index]?.task();
    },
  };
}

function mountTransition(proto: Prototype<TransitionProps>, ctx: ReturnType<typeof createHost>) {
  return executeWithHost<PropsBaseType>(
    proto as Prototype<PropsBaseType>,
    ctx.host as RuntimeHost<PropsBaseType>
  );
}

function createTransitionProto(
  name: string,
  setupCallback?: (def: DefHandle<TransitionProps, TransitionExposes>) => void
): Prototype<TransitionProps> {
  return definePrototype<TransitionProps>({
    name,
    setup(def) {
      asTransition();
      setupCallback?.(def);
      return (r) => r.el('div', 'ok');
    },
  });
}

describe('prototypes/base: asTransition', () => {
  it('BASE-TRANSITION-0100: direct prototype independently installs the shared surface', () => {
    const ctx = createHost({ defaultOpen: true });

    mountTransition(baseTransition as Prototype<TransitionProps>, ctx);

    expect(baseTransition.name).toBe('base-transition');
    expect(ctx.getExposes().transitionState.get()).toBe('entered');
    expect(ctx.getExposes().isPresent.get()).toBe(true);
    expect(ctx.getExposes().controls).toMatchObject({
      enter: expect.any(Function),
      leave: expect.any(Function),
      complete: expect.any(Function),
    });
  });

  it('AS-TRANSITION-0100: initializes to closed state by default', () => {
    const ctx = createHost();
    const P = createTransitionProto('x-as-transition-0100');

    mountTransition(P, ctx);

    expect(ctx.getExposes().transitionState.get()).toBe('closed');
    expect(ctx.getExposes().isPresent.get()).toBe(false);
  });

  it('AS-TRANSITION-0200: with open=true and appear=false, starts at entered', () => {
    const ctx = createHost({ open: true, appear: false });
    const P = createTransitionProto('x-as-transition-0200');

    mountTransition(P, ctx);

    expect(ctx.getExposes().transitionState.get()).toBe('entered');
    expect(ctx.getExposes().isPresent.get()).toBe(true);
  });

  it('AS-TRANSITION-0300: with open=true and appear=true, starts at entering', () => {
    const ctx = createHost({ open: true, appear: true });
    const P = createTransitionProto('x-as-transition-0300');

    mountTransition(P, ctx);

    expect(ctx.getExposes().transitionState.get()).toBe('entering');
    expect(ctx.getExposes().isPresent.get()).toBe(true);
  });

  it('AS-TRANSITION-0400: complete flow: closed → entering → entered', () => {
    const ctx = createHost();
    const P = createTransitionProto('x-as-transition-0400', (def) => {
      def.lifecycle.onMounted(() => {
        const exposes = ctx.getExposes();
        exposes.controls.enter();
        exposes.controls.complete();
      });
    });

    mountTransition(P, ctx);

    expect(ctx.getExposes().transitionState.get()).toBe('entered');
    expect(ctx.getExposes().isPresent.get()).toBe(true);
  });

  it('AS-TRANSITION-0500: complete flow: entered → leaving → closed', () => {
    const ctx = createHost({ open: true, appear: false });
    const P = createTransitionProto('x-as-transition-0500', (def) => {
      def.lifecycle.onMounted(() => {
        const exposes = ctx.getExposes();
        exposes.controls.leave();
        exposes.controls.complete();
      });
    });

    mountTransition(P, ctx);

    expect(ctx.getExposes().transitionState.get()).toBe('closed');
    expect(ctx.getExposes().isPresent.get()).toBe(false);
  });

  it('AS-TRANSITION-0600: reverse interrupt: entering + leave → leaving', () => {
    const ctx = createHost({ interrupt: 'reverse' });
    const P = createTransitionProto('x-as-transition-0600', (def) => {
      def.lifecycle.onMounted(() => {
        const exposes = ctx.getExposes();
        exposes.controls.enter();
        exposes.controls.leave();
      });
    });

    mountTransition(P, ctx);

    expect(ctx.getExposes().transitionState.get()).toBe('leaving');
    expect(ctx.getExposes().isPresent.get()).toBe(true);
  });

  it('AS-TRANSITION-0700: reverse interrupt: leaving + enter → entering', () => {
    const ctx = createHost({ open: true, appear: false, interrupt: 'reverse' });
    const P = createTransitionProto('x-as-transition-0700', (def) => {
      def.lifecycle.onMounted(() => {
        const exposes = ctx.getExposes();
        exposes.controls.leave();
        exposes.controls.enter();
      });
    });

    mountTransition(P, ctx);

    expect(ctx.getExposes().transitionState.get()).toBe('entering');
    expect(ctx.getExposes().isPresent.get()).toBe(true);
  });

  it('AS-TRANSITION-0800: immediate interrupt: entering + leave should reset through entered', () => {
    const ctx = createHost({
      interrupt: 'immediate',
    });
    const P = createTransitionProto('x-as-transition-0800', (def) => {
      def.lifecycle.onMounted(() => {
        const exposes = ctx.getExposes();
        exposes.controls.enter();
        exposes.controls.leave();
      });
    });

    mountTransition(P, ctx);

    expect(ctx.getEmitted().some((e) => e.key === 'afterEnter')).toBe(true);
    expect(ctx.getExposes().transitionState.get()).toBe('leaving');
    expect(ctx.getExposes().isPresent.get()).toBe(true);
  });

  it('AS-TRANSITION-0900: immediate interrupt: leaving + enter should reset through closed', () => {
    const ctx = createHost({
      open: true,
      appear: false,
      interrupt: 'immediate',
    });
    const P = createTransitionProto('x-as-transition-0900', (def) => {
      def.lifecycle.onMounted(() => {
        const exposes = ctx.getExposes();
        exposes.controls.leave();
        exposes.controls.enter();
      });
    });

    mountTransition(P, ctx);

    expect(ctx.getEmitted().some((e) => e.key === 'afterLeave')).toBe(true);
    expect(ctx.getExposes().transitionState.get()).toBe('entering');
    expect(ctx.getExposes().isPresent.get()).toBe(true);
  });

  it('AS-TRANSITION-1000: wait interrupt: entering + leave → wait until complete', () => {
    const steps: string[] = [];
    const ctx = createHost({ interrupt: 'wait' });
    const P = createTransitionProto('x-as-transition-1000', (def) => {
      def.lifecycle.onMounted(() => {
        const exposes = ctx.getExposes();
        exposes.controls.enter();
        steps.push(`after-enter:${exposes.transitionState.get()}`);

        exposes.controls.leave();
        steps.push(`after-leave:${exposes.transitionState.get()}`);

        exposes.controls.complete();
        steps.push(`after-complete:${exposes.transitionState.get()}`);
      });
    });

    mountTransition(P, ctx);

    expect(steps).toEqual([
      'after-enter:entering',
      'after-leave:entering',
      'after-complete:leaving',
    ]);
    expect(ctx.getExposes().isPresent.get()).toBe(true);
  });

  it('AS-TRANSITION-1100: wait interrupt: leaving + enter → wait until complete', () => {
    const steps: string[] = [];
    const ctx = createHost({ open: true, appear: false, interrupt: 'wait' });
    const P = createTransitionProto('x-as-transition-1100', (def) => {
      def.lifecycle.onMounted(() => {
        const exposes = ctx.getExposes();
        exposes.controls.leave();
        steps.push(`after-leave:${exposes.transitionState.get()}`);

        exposes.controls.enter();
        steps.push(`after-enter:${exposes.transitionState.get()}`);

        exposes.controls.complete();
        steps.push(`after-complete:${exposes.transitionState.get()}`);
      });
    });

    mountTransition(P, ctx);

    expect(steps).toEqual([
      'after-leave:leaving',
      'after-enter:leaving',
      'after-complete:entering',
    ]);
    expect(ctx.getExposes().isPresent.get()).toBe(true);
  });

  it('AS-TRANSITION-1200: complete() has no effect in closed or entered states', () => {
    const steps: string[] = [];
    const ctx = createHost();
    const P = createTransitionProto('x-as-transition-1200', (def) => {
      def.lifecycle.onMounted(() => {
        const exposes = ctx.getExposes();
        exposes.controls.complete();
        steps.push(`closed-complete:${exposes.transitionState.get()}`);

        exposes.controls.enter();
        exposes.controls.complete();
        steps.push(`entered-complete1:${exposes.transitionState.get()}`);

        exposes.controls.complete();
        steps.push(`entered-complete2:${exposes.transitionState.get()}`);
      });
    });

    mountTransition(P, ctx);

    expect(steps).toEqual([
      'closed-complete:closed',
      'entered-complete1:entered',
      'entered-complete2:entered',
    ]);
    expect(ctx.getExposes().isPresent.get()).toBe(true);
  });

  it('AS-TRANSITION-1900: wait interrupt queues multiple state changes', () => {
    const steps: string[] = [];
    const ctx = createHost({ interrupt: 'wait' });
    const P = createTransitionProto('x-as-transition-1900', (def) => {
      def.lifecycle.onMounted(() => {
        const exposes = ctx.getExposes();
        exposes.controls.enter();
        steps.push(`after-enter:${exposes.transitionState.get()}`);

        exposes.controls.leave();
        steps.push(`after-leave1:${exposes.transitionState.get()}`);

        exposes.controls.enter();
        steps.push(`after-enter2:${exposes.transitionState.get()}`);

        exposes.controls.leave();
        steps.push(`after-leave2:${exposes.transitionState.get()}`);

        exposes.controls.complete();
        steps.push(`after-complete1:${exposes.transitionState.get()}`);

        exposes.controls.complete();
        steps.push(`after-complete2:${exposes.transitionState.get()}`);

        exposes.controls.complete();
        steps.push(`after-complete3:${exposes.transitionState.get()}`);
      });
    });

    mountTransition(P, ctx);

    expect(steps).toEqual([
      'after-enter:entering',
      'after-leave1:entering',
      'after-enter2:entering',
      'after-leave2:entering',
      'after-complete1:leaving',
      'after-complete2:closed',
      'after-complete3:closed',
    ]);
  });

  it('AS-TRANSITION-1300: idempotent enter/leave calls', () => {
    const ctx = createHost();
    const P = createTransitionProto('x-as-transition-1300', (def) => {
      def.lifecycle.onMounted(() => {
        const exposes = ctx.getExposes();
        exposes.controls.enter();
        exposes.controls.enter();
        exposes.controls.enter();
        expect(exposes.transitionState.get()).toBe('entering');
        expect(exposes.isPresent.get()).toBe(true);

        exposes.controls.complete();
        exposes.controls.complete();
        expect(exposes.transitionState.get()).toBe('entered');
        expect(exposes.isPresent.get()).toBe(true);

        exposes.controls.leave();
        exposes.controls.leave();
        exposes.controls.leave();
        expect(exposes.transitionState.get()).toBe('leaving');
        expect(exposes.isPresent.get()).toBe(true);

        exposes.controls.complete();
        exposes.controls.complete();
        expect(exposes.transitionState.get()).toBe('closed');
        expect(exposes.isPresent.get()).toBe(false);
      });
    });

    mountTransition(P, ctx);
  });

  it('AS-TRANSITION-1400: repeated no-arg calls return the same handle', () => {
    const ctx = createHost();
    let first: ReturnType<typeof asTransition> | undefined;
    let second: ReturnType<typeof asTransition> | undefined;
    const P = definePrototype<TransitionProps>({
      name: 'x-as-transition-1400',
      setup() {
        first = asTransition();
        second = asTransition();
        return (r) => r.el('div', 'ok');
      },
    });

    mountTransition(P, ctx);

    expect(first).toBe(second);
    expect(ctx.getExposes().transitionState.get()).toBe('closed');
    expect((P as any).__asHooks[0]).toMatchObject({
      name: 'asTransition',
      mode: 'once',
      privileged: false,
    });
  });

  it('AS-TRANSITION-1500: supports controlled sync from props updates', () => {
    const steps: string[] = [];
    const ctx = createHost({ open: false });
    const P = createTransitionProto('x-as-transition-1500', (def) => {
      def.lifecycle.onMounted(() => {
        const exposes = ctx.getExposes();
        steps.push(`init:${exposes.transitionState.get()}:${exposes.isPresent.get()}`);
      });

      def.lifecycle.onUpdated(() => {
        const exposes = ctx.getExposes();
        const state = exposes.transitionState.get();
        steps.push(`updated:${state}:${exposes.isPresent.get()}`);

        if (state === 'entering' || state === 'leaving') {
          exposes.controls.complete();
          steps.push(`after-complete:${exposes.transitionState.get()}:${exposes.isPresent.get()}`);
        }
      });
    });

    const { controller } = mountTransition(P, ctx);

    ctx.applyRawProps({ open: true });
    controller.applyRawProps({ open: true });
    controller.update();

    ctx.applyRawProps({ open: false });
    controller.applyRawProps({ open: false });
    controller.update();

    expect(steps).toEqual([
      'init:closed:false',
      'updated:entering:true',
      'after-complete:entered:true',
      'updated:leaving:true',
      'after-complete:closed:false',
    ]);
  });

  it('AS-TRANSITION-1600: supports uncontrolled defaultOpen initialization', () => {
    const ctx = createHost({ defaultOpen: true });
    const P = createTransitionProto('x-as-transition-1600');

    mountTransition(P, ctx);

    expect(ctx.getExposes().transitionState.get()).toBe('entered');
    expect(ctx.getExposes().isPresent.get()).toBe(true);
  });

  it('AS-TRANSITION-1700: emits lifecycle events during controlled transitions', () => {
    const ctx = createHost({ open: false });

    const P = createTransitionProto('x-as-transition-1700', (def) => {
      def.lifecycle.onUpdated(() => {
        const exposes = ctx.getExposes();
        const state = exposes.transitionState.get();
        if (state === 'entering' || state === 'leaving') {
          exposes.controls.complete();
        }
      });
    });

    const { controller } = mountTransition(P, ctx);

    ctx.applyRawProps({ open: true });
    controller.applyRawProps({ open: true });
    controller.update();

    ctx.applyRawProps({ open: false });
    controller.applyRawProps({ open: false });
    controller.update();

    const keys = ctx.getEmitted().map((e) => e.key);
    expect(keys).toContain('beforeEnter');
    expect(keys).toContain('afterEnter');
    expect(keys).toContain('beforeLeave');
    expect(keys).toContain('afterLeave');
  });

  it('AS-TRANSITION-2000: ViewIntent stays present through leave and detaches after completion', () => {
    const ctx = createHost();
    let transition!: ReturnType<typeof asTransition>;
    const P = definePrototype<TransitionProps>({
      name: 'x-as-transition-2000',
      setup() {
        transition = asTransition();
        return (r) => r.el('div', 'ok');
      },
    });

    const result = mountTransition(P, ctx);
    expect(result.session.viewIntent.getSnapshot().present).toBe(false);

    result.invokeInCallbackScope(() => transition.controls.enter());
    expect(result.session.viewIntent.getSnapshot().present).toBe(true);
    expect(transition.transitionState.get()).toBe('entering');

    result.invokeInCallbackScope(() => transition.controls.leave());
    expect(result.session.viewIntent.getSnapshot().present).toBe(true);
    expect(transition.transitionState.get()).toBe('leaving');

    result.invokeInCallbackScope(() => transition.controls.complete());

    expect(transition.transitionState.get()).toBe('closed');
    expect(result.session.viewIntent.getSnapshot().present).toBe(false);
    expect(ctx.getBridgeCalls()).toEqual({ mount: 0, unmount: 0 });
  });

  it('AS-TRANSITION-2100: rapid enter cancels the pending detach intent', () => {
    const ctx = createHost(
      { open: true, appear: false },
      {
        bridge: {
          mount: () => {},
          unmount: () => {},
        },
      }
    );
    let transition!: ReturnType<typeof asTransition>;
    const P = definePrototype<TransitionProps>({
      name: 'x-as-transition-2100',
      setup() {
        transition = asTransition();
        return (r) => r.el('div', 'ok');
      },
    });

    const result = mountTransition(P, ctx);
    result.invokeInCallbackScope(() => {
      transition.controls.leave();
      transition.controls.enter();
      transition.controls.complete();
    });

    expect(transition.transitionState.get()).toBe('entered');
    expect(result.session.viewIntent.getSnapshot().present).toBe(true);
    expect(ctx.getBridgeCalls()).toEqual({ mount: 0, unmount: 0 });
  });

  it('AS-TRANSITION-2200: neutral delay completes an entering phase', () => {
    const ctx = createHost({ open: true, appear: true, enterDuration: 45 });
    const P = createTransitionProto('x-as-transition-2200');

    mountTransition(P, ctx);

    expect(ctx.getExposes().transitionState.get()).toBe('entering');
    expect(ctx.getDelays().map((entry) => entry.durationMs)).toEqual([45]);

    ctx.flushDelay(0);
    expect(ctx.getExposes().transitionState.get()).toBe('entered');
  });

  it('AS-TRANSITION-2300: stale delayed completion is inert after reversal', () => {
    const ctx = createHost({ enterDuration: 30, leaveDuration: 20 });
    let transition!: ReturnType<typeof asTransition>;
    const P = definePrototype<TransitionProps>({
      name: 'x-as-transition-2300',
      setup() {
        transition = asTransition();
        return (r) => r.el('div', 'ok');
      },
    });

    const result = mountTransition(P, ctx);
    result.invokeInCallbackScope(() => {
      transition.controls.enter();
      transition.controls.leave();
    });

    expect(ctx.getDelays().map((entry) => [entry.durationMs, entry.cancelled])).toEqual([
      [30, true],
      [20, false],
    ]);

    ctx.flushDelay(0);
    expect(transition.transitionState.get()).toBe('leaving');

    ctx.flushDelay(1);
    expect(transition.transitionState.get()).toBe('closed');
  });

  it('AS-TRANSITION-2400: bound Overlay delegates ViewIntent and retains host resources through leave', async () => {
    const resourceCalls: string[] = [];
    const ctx = createHost(
      {},
      {
        overlay: {
          hostElement: document.createElement('div'),
          mount: () => resourceCalls.push('mount'),
          unmount: () => resourceCalls.push('unmount'),
          lock: () => resourceCalls.push('lock'),
          unlock: () => resourceCalls.push('unlock'),
        },
      }
    );
    let overlay!: ReturnType<typeof asOverlay>;
    let transition!: ReturnType<typeof asTransition>;
    const P = definePrototype<TransitionProps>({
      name: 'x-as-transition-2400',
      setup() {
        overlay = asOverlay();
        overlay.configure({ portal: true, modal: true });
        transition = asTransition();
        overlay.bindPresence({
          enter: transition.controls.enter,
          leave: transition.controls.leave,
          present: transition.isPresent,
        });
        return (r) => r.el('div', 'ok');
      },
    });

    const result = mountTransition(P, ctx);
    expect(result.session.viewIntent.getSnapshot().present).toBe(false);

    result.invokeInCallbackScope(() => overlay.openOverlay('programmatic'));
    await Promise.resolve();
    expect(transition.transitionState.get()).toBe('entering');
    expect(result.session.viewIntent.getSnapshot().present).toBe(true);

    result.invokeInCallbackScope(() => transition.controls.complete());
    expect(transition.transitionState.get()).toBe('entered');

    const versionBeforeLeave = result.session.viewIntent.getSnapshot().version;
    result.invokeInCallbackScope(() => overlay.close('programmatic'));
    expect(transition.transitionState.get()).toBe('leaving');
    expect(result.session.viewIntent.getSnapshot()).toMatchObject({
      present: true,
      version: versionBeforeLeave,
    });
    expect(resourceCalls).not.toContain('unlock');

    result.invokeInCallbackScope(() => transition.controls.complete());
    expect(transition.transitionState.get()).toBe('closed');
    expect(result.session.viewIntent.getSnapshot().present).toBe(false);
    expect(resourceCalls).toContain('unlock');

    await result.session.unmount();
    expect(resourceCalls).toContain('unmount');
  });

  it('AS-TRANSITION-2500: Overlay accepts one Presence binding and rejects a competing writer', () => {
    const ctx = createHost();
    let conflict: unknown;
    const P = definePrototype<TransitionProps>({
      name: 'x-as-transition-2500',
      setup() {
        const overlay = asOverlay();
        const transition = asTransition();
        const binding = {
          enter: transition.controls.enter,
          leave: transition.controls.leave,
          present: transition.isPresent,
        };
        overlay.bindPresence(binding);
        overlay.bindPresence(binding);
        try {
          overlay.bindPresence({ ...binding });
        } catch (error) {
          conflict = error;
        }
        return (r) => r.el('div', 'ok');
      },
    });

    mountTransition(P, ctx);
    expect(String(conflict)).toMatch(/already bound/i);
  });

  it('AS-TRANSITION-2600: setup configuration supplies phase defaults', () => {
    const ctx = createHost();
    let transition!: ReturnType<typeof asTransition>;
    const P = definePrototype<TransitionProps>({
      name: 'x-as-transition-2600',
      setup() {
        transition = asTransition();
        transition.configure({ enterDuration: 100, leaveDuration: 80 });
        transition.configure({ enterDuration: 120 });
        return (r) => r.el('div', 'ok');
      },
    });

    const result = mountTransition(P, ctx);
    result.invokeInCallbackScope(() => {
      transition.controls.enter();
      transition.controls.leave();
    });

    expect(ctx.getDelays().map((entry) => [entry.durationMs, entry.cancelled])).toEqual([
      [120, true],
      [80, false],
    ]);
  });

  it('AS-TRANSITION-2700: explicit host props override setup configuration', () => {
    const ctx = createHost({ enterDuration: 45, leaveDuration: 25 });
    let transition!: ReturnType<typeof asTransition>;
    const P = definePrototype<TransitionProps>({
      name: 'x-as-transition-2700',
      setup() {
        transition = asTransition();
        transition.configure({ enterDuration: 120, leaveDuration: 80 });
        return (r) => r.el('div', 'ok');
      },
    });

    const result = mountTransition(P, ctx);
    result.invokeInCallbackScope(() => {
      transition.controls.enter();
      transition.controls.leave();
    });

    expect(ctx.getDelays().map((entry) => entry.durationMs)).toEqual([45, 25]);
  });

  it('AS-TRANSITION-2800: configure is setup-only', () => {
    const ctx = createHost();
    let transition!: ReturnType<typeof asTransition>;
    const P = definePrototype<TransitionProps>({
      name: 'x-as-transition-2800',
      setup() {
        transition = asTransition();
        return (r) => r.el('div', 'ok');
      },
    });

    const result = mountTransition(P, ctx);
    expect(() =>
      result.invokeInCallbackScope(() => transition.configure({ enterDuration: 100 }))
    ).toThrow(/exec-phase violation/i);
  });

  it('AS-TRANSITION-2900: reduced motion uses zero-duration fallback without collapsing ordering', () => {
    const ctx = createHost(
      { open: true, appear: true, enterDuration: 240, leaveDuration: 180 },
      { reducedMotion: 'reduce' }
    );
    const P = createTransitionProto('x-as-transition-2900');

    const result = mountTransition(P, ctx);

    expect(ctx.getExposes().transitionState.get()).toBe('entering');
    expect(ctx.getDelays().map((entry) => entry.durationMs)).toEqual([0]);
    expect(ctx.getEmitted().map((entry) => entry.key)).toEqual(['beforeEnter']);

    ctx.flushDelay(0);
    expect(ctx.getExposes().transitionState.get()).toBe('entered');
    expect(ctx.getEmitted().map((entry) => entry.key)).toEqual(['beforeEnter', 'afterEnter']);

    result.invokeInCallbackScope(() => ctx.getExposes().controls.leave());
    expect(ctx.getExposes().transitionState.get()).toBe('leaving');
    expect(result.session.viewIntent.getSnapshot().present).toBe(true);
    expect(ctx.getDelays().map((entry) => entry.durationMs)).toEqual([0, 0]);

    ctx.flushDelay(1);
    expect(ctx.getExposes().transitionState.get()).toBe('closed');
    expect(result.session.viewIntent.getSnapshot().present).toBe(false);
    expect(ctx.getEmitted().map((entry) => entry.key)).toEqual([
      'beforeEnter',
      'afterEnter',
      'beforeLeave',
      'afterLeave',
    ]);
  });
});

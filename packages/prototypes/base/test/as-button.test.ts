import { describe, expect, it } from 'vitest';
import type { Prototype } from '@proto.ui/core';
import type { A11ySemanticObjectSnapshot } from '@proto.ui/core';
import { definePrototype } from '@proto.ui/core';
import type { RuntimeHost } from '@proto.ui/runtime';
import { executeWithHost } from '@proto.ui/runtime';
import type { FocusPort } from '@proto.ui/module-focus';
import {
  EVENT_CANCEL_DEFAULT_ACTION_CAP,
  EVENT_GLOBAL_TARGET_CAP,
  EVENT_ROOT_TARGET_CAP,
} from '@proto.ui/module-event';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import {
  AS_TRIGGER_GET_PROTO_CAP,
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_PARENT_CAP,
} from '@proto.ui/module-as-trigger';
import { A11Y_PROJECT_CAP } from '@proto.ui/module-a11y';
import { EXPOSE_STATE_SET_EXPOSES_CAP } from '@proto.ui/module-expose-state';
import button, { asButton } from '../src/button';

function createHost(initialRaw: Record<string, unknown> = {}) {
  let raw = { ...initialRaw };
  const rootTarget = new EventTarget();
  const globalTarget = new EventTarget();
  const emitted: string[] = [];
  const a11ySnapshots: A11ySemanticObjectSnapshot[] = [];
  const decisions: Array<{ reason?: string; source?: string }> = [];
  let exposes: Record<string, any> | null = null;

  const host: RuntimeHost<any> = {
    prototypeName: 'base-as-button-contract',
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
        [
          EVENT_CANCEL_DEFAULT_ACTION_CAP,
          (request: { reason?: string; source?: string }) => decisions.push(request),
        ],
      ]);
      wiring.attach('expose-event', [[EXPOSE_EVENT_SINK_CAP, (key: string) => emitted.push(key)]]);
      wiring.attach('as-trigger', [
        [AS_TRIGGER_INSTANCE_CAP, rootTarget],
        [AS_TRIGGER_PARENT_CAP, () => null],
        [AS_TRIGGER_GET_PROTO_CAP, () => null],
      ]);
      wiring.attach('a11y', [
        [
          A11Y_PROJECT_CAP,
          (snapshot: A11ySemanticObjectSnapshot) => {
            a11ySnapshots.push(snapshot);
          },
        ],
      ]);
      wiring.attach('expose-state', [
        [EXPOSE_STATE_SET_EXPOSES_CAP, (next: Record<string, unknown>) => (exposes = next)],
      ]);
    },
  };

  return {
    host,
    rootTarget,
    globalTarget,
    emitted,
    getExposes() {
      return exposes;
    },
    getA11ySnapshot() {
      return a11ySnapshots.at(-1);
    },
    getDecisions() {
      return decisions;
    },
  };
}

describe('prototypes/base: asButton', () => {
  it('tracks hovered/focused/pressed and gates click emission when disabled', () => {
    // T-BASE-BUTTON-0001-CASE-DISABLED-CONTROLLED
    // T-BASE-BUTTON-0001-CASE-INTERACTION-STATES
    // T-BASE-BUTTON-0001-CASE-CLICK-SIGNAL
    // T-BASE-BUTTON-0001-CASE-DEFERRED-SURFACES
    const P: Prototype<{ disabled?: boolean }> = definePrototype({
      name: 'x-base-as-button',
      setup() {
        asButton();
        return (r) => r.el('button', 'ok');
      },
    });

    const ctx = createHost({ disabled: false });
    const { controller, caps } = executeWithHost(P as any, ctx.host as any);
    const focusPort = caps.getPort<FocusPort>('focus');

    const exposes = ctx.getExposes() as any;
    expect(exposes).toBeTruthy();
    expect(exposes.click).toBeTruthy();
    expect(exposes.onClick).toBeUndefined();
    expect(ctx.getA11ySnapshot()).toMatchObject({
      role: 'button',
      name: { kind: 'content' },
      states: { disabled: false },
      actions: { activate: { event: 'click' } },
    });

    ctx.rootTarget.dispatchEvent(new CustomEvent('pointer.enter'));
    expect(exposes.hovered.get()).toBe(true);

    ctx.globalTarget?.dispatchEvent?.(new CustomEvent('key.down'));
    ctx.rootTarget.dispatchEvent(new CustomEvent('host:focus'));
    expect(exposes.focused.get()).toBe(true);
    expect(exposes.focusVisible.get()).toBe(true);

    ctx.rootTarget.dispatchEvent(new CustomEvent('pointer.down'));
    expect(exposes.pressed.get()).toBe(true);
    expect(exposes.focusVisible.get()).toBe(false);

    ctx.rootTarget.dispatchEvent(new CustomEvent('press.commit'));
    expect(exposes.pressed.get()).toBe(false);
    expect(ctx.emitted).toEqual(['click']);

    controller.applyRawProps({ disabled: true } as any);
    expect(ctx.getA11ySnapshot()?.states.disabled).toBe(true);
    expect(exposes.hovered.get()).toBe(false);
    expect(exposes.focused.get()).toBe(false);
    expect(exposes.focusVisible.get()).toBe(false);
    expect(exposes.pressed.get()).toBe(false);
    expect(focusPort?.getFocusableConfig().disabled).toBe(true);
    expect(focusPort?.getFacts()).toMatchObject({
      focused: false,
      focusVisible: false,
      focusable: false,
    });

    controller.applyRawProps({});
    expect(ctx.getA11ySnapshot()?.states.disabled).toBe(false);
    expect(exposes.disabled.get()).toBe(false);
    expect(focusPort?.getFocusableConfig().disabled).toBe(false);

    ctx.rootTarget.dispatchEvent(new CustomEvent('pointer.enter'));
    ctx.rootTarget.dispatchEvent(new CustomEvent('host:focus'));
    ctx.rootTarget.dispatchEvent(new CustomEvent('pointer.down'));
    ctx.rootTarget.dispatchEvent(new CustomEvent('press.commit'));

    expect(exposes.hovered.get()).toBe(true);
    expect(exposes.focused.get()).toBe(true);
    expect(exposes.focusVisible.get()).toBe(false);
    expect(exposes.pressed.get()).toBe(false);
    expect(ctx.emitted).toEqual(['click', 'click']);
  });

  it('prevents Space default action when focused', () => {
    // T-BASE-BUTTON-0001-CASE-KEYBOARD-SPACE
    const P: Prototype<{ disabled?: boolean }> = definePrototype({
      name: 'x-base-as-button-space-boundary',
      setup() {
        asButton();
        return (r) => r.el('button', 'ok');
      },
    });

    const ctx = createHost({ disabled: false });
    executeWithHost(P as any, ctx.host as any);
    const exposes = ctx.getExposes() as any;

    ctx.globalTarget.dispatchEvent(new CustomEvent('key.down'));
    ctx.rootTarget.dispatchEvent(new CustomEvent('host:focus'));
    expect(exposes.focused.get()).toBe(true);

    // HC-DEFAULT-ACTION-0001: the prototype requests prevention through the
    // portable control facade; the host observes the request through its
    // cancel-default-action cap, not through a fabricated raw preventDefault.
    ctx.globalTarget.dispatchEvent(
      new CustomEvent('key.down', {
        detail: {
          key: ' ',
          target: ctx.rootTarget,
        },
      })
    );

    expect(ctx.getDecisions()).toEqual([
      {
        reason: 'button.space-activation',
        source: 'base-button',
        event: expect.anything(),
      },
    ]);
  });
  it('keeps base-button and asButton aligned as Button authoring entries', () => {
    // T-BASE-BUTTON-0001-CASE-AUTHORING-ENTRIES
    // T-BASE-BUTTON-0001-CASE-DEFERRED-SURFACES
    const asHookCtx = createHost({ disabled: false });
    const Direct = button as Prototype<{ disabled?: boolean }>;
    const directCtx = createHost({ disabled: false });
    const P: Prototype<{ disabled?: boolean }> = definePrototype({
      name: 'x-base-as-button-authoring-entry',
      setup() {
        asButton();
        return (r) => r.el('button', 'ok');
      },
    });

    executeWithHost(P as any, asHookCtx.host as any);
    executeWithHost(Direct as any, directCtx.host as any);

    const asHookExposes = asHookCtx.getExposes() as any;
    const directExposes = directCtx.getExposes() as any;

    expect(Object.keys(directExposes).sort()).toEqual(Object.keys(asHookExposes).sort());

    asHookCtx.rootTarget.dispatchEvent(new CustomEvent('press.commit'));
    directCtx.rootTarget.dispatchEvent(new CustomEvent('press.commit'));

    expect(asHookCtx.emitted).toEqual(['click']);
    expect(directCtx.emitted).toEqual(['click']);
  });
});

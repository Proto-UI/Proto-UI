import { describe, expect, it } from 'vitest';
import type { Prototype } from '@proto.ui/core';
import { definePrototype } from '@proto.ui/core';
import type { A11ySemanticObjectSnapshot } from '@proto.ui/core';
import type { RuntimeHost } from '@proto.ui/runtime';
import { executeWithHost } from '@proto.ui/runtime';
import {
  FOCUS_REQUEST_FOCUS_CAP,
  FOCUS_ROOT_TARGET_CAP,
  FOCUS_SET_FOCUSABLE_CAP,
} from '@proto.ui/module-focus';
import { EVENT_GLOBAL_TARGET_CAP, EVENT_ROOT_TARGET_CAP } from '@proto.ui/module-event';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import {
  AS_TRIGGER_GET_PROTO_CAP,
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_PARENT_CAP,
} from '@proto.ui/module-as-trigger';
import { A11Y_PROJECT_CAP } from '@proto.ui/module-a11y';
import { EXPOSE_STATE_SET_EXPOSES_CAP } from '@proto.ui/module-expose-state';
import toggle from '../src/toggle';
import { asToggle } from '../src/toggle';

function createHost(initialRaw: Record<string, unknown> = {}) {
  let raw = { ...initialRaw };
  const rootTarget = new EventTarget();
  const globalTarget = new EventTarget();
  const emitted: Array<{ key: string; payload: unknown }> = [];
  const a11ySnapshots: A11ySemanticObjectSnapshot[] = [];
  const focusRequests: unknown[] = [];
  const focusableFlags: boolean[] = [];
  let exposes: Record<string, any> | null = null;

  const host: RuntimeHost<any> = {
    prototypeName: 'base-toggle-contract',
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
      ]);
      wiring.attach('expose-event', [
        [EXPOSE_EVENT_SINK_CAP, (key: string, payload: unknown) => emitted.push({ key, payload })],
      ]);
      wiring.attach('focus', [
        [FOCUS_ROOT_TARGET_CAP, () => rootTarget],
        [
          FOCUS_SET_FOCUSABLE_CAP,
          (_target: unknown, enabled: boolean) => focusableFlags.push(enabled),
        ],
        [
          FOCUS_REQUEST_FOCUS_CAP,
          (_target: unknown, options: unknown) => focusRequests.push(options),
        ],
      ]);
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
    focusRequests,
    focusableFlags,
    applyRawProps(next: Record<string, unknown>) {
      raw = { ...next };
    },
    getExposes() {
      return exposes;
    },
    getA11ySnapshot() {
      return a11ySnapshots.at(-1);
    },
  };
}

describe('prototypes/base: toggle', () => {
  it('base-toggle initializes from defaultActive and flips active on press.commit', () => {
    // T-BASE-TOGGLE-0001-CASE-UNCONTROLLED-ACTIVE-CHANGE
    // T-BASE-TOGGLE-0001-CASE-A11Y-AND-DEFERRED-SURFACES
    const ctx = createHost({ defaultActive: true });
    const { invokeUnmounted } = executeWithHost(toggle as any, ctx.host as any);

    const exposes = ctx.getExposes() as any;
    expect(exposes.active.get()).toBe(true);
    expect(exposes.checked).toBeUndefined();
    expect(exposes.click).toBeUndefined();
    expect(ctx.getA11ySnapshot()).toMatchObject({
      role: 'button',
      name: { kind: 'content' },
      states: { pressed: true, disabled: false },
      actions: { activate: { event: 'activeChange' } },
    });

    ctx.rootTarget.dispatchEvent(new CustomEvent('press.commit'));

    expect(exposes.active.get()).toBe(false);
    expect(ctx.emitted).toEqual([{ key: 'activeChange', payload: { active: false } }]);

    invokeUnmounted();
  });

  it('asToggle mirrors controlled active prop and emits next active without mutating local state', () => {
    // T-BASE-TOGGLE-0001-CASE-AUTHORING-ENTRIES
    // T-BASE-TOGGLE-0001-CASE-CONTROLLED-ACTIVE
    const P: Prototype<{ active?: boolean }> = definePrototype({
      name: 'x-base-as-toggle',
      setup() {
        asToggle();
        return (r) => r.el('button', 'ok');
      },
    });

    const ctx = createHost({ active: true });
    const directCtx = createHost({ active: true });
    const { controller, invokeUnmounted } = executeWithHost(P as any, ctx.host as any);
    const { invokeUnmounted: invokeDirectUnmounted } = executeWithHost(
      toggle as any,
      directCtx.host as any
    );

    const exposes = ctx.getExposes() as any;
    const directExposes = directCtx.getExposes() as any;
    expect(Object.keys(exposes).sort()).toEqual(Object.keys(directExposes).sort());
    expect(exposes.active.get()).toBe(true);
    expect(exposes.checked).toBeUndefined();
    expect(exposes.click).toBeUndefined();

    ctx.rootTarget.dispatchEvent(new CustomEvent('press.commit'));

    expect(exposes.active.get()).toBe(true);
    expect(ctx.emitted).toEqual([{ key: 'activeChange', payload: { active: false } }]);

    ctx.applyRawProps({ active: false });
    controller.applyRawProps({ active: false } as any);
    expect(exposes.active.get()).toBe(false);

    invokeUnmounted();
    invokeDirectUnmounted();
  });

  it('disabled toggle keeps active stable and suppresses activeChange', () => {
    // T-BASE-TOGGLE-0001-CASE-DISABLED-GATING
    const ctx = createHost({ defaultActive: false, disabled: true });
    executeWithHost(toggle as any, ctx.host as any);

    const exposes = ctx.getExposes() as any;
    expect(exposes.active.get()).toBe(false);

    ctx.rootTarget.dispatchEvent(new CustomEvent('pointer.down'));
    ctx.rootTarget.dispatchEvent(new CustomEvent('press.commit'));

    expect(exposes.active.get()).toBe(false);
    expect(exposes.pressed.get()).toBe(false);
    expect(ctx.focusableFlags.at(-1)).toBe(false);
    expect(ctx.emitted).toEqual([]);
  });

  it('toggle exposes pointer, focus, press, and keyboard activation behavior', () => {
    // T-BASE-TOGGLE-0001-CASE-INTERACTION-FOCUS-KEYBOARD
    const ctx = createHost({ defaultActive: false, disabled: false });
    executeWithHost(toggle as any, ctx.host as any);

    const exposes = ctx.getExposes() as any;
    expect(exposes.hovered.get()).toBe(false);
    expect(exposes.pressed.get()).toBe(false);
    expect(exposes.focused.get()).toBe(false);
    expect(exposes.focusVisible.get()).toBe(false);

    ctx.rootTarget.dispatchEvent(new CustomEvent('pointer.enter'));
    expect(exposes.hovered.get()).toBe(true);

    ctx.rootTarget.dispatchEvent(new CustomEvent('pointer.down'));
    expect(exposes.pressed.get()).toBe(true);

    ctx.rootTarget.dispatchEvent(new CustomEvent('pointer.leave'));
    expect(exposes.hovered.get()).toBe(false);
    expect(exposes.pressed.get()).toBe(false);

    exposes.focusSelf({ preventScroll: true });
    expect(ctx.focusRequests).toEqual([{ preventScroll: true }]);

    const preventDefaultCalls: string[] = [];
    ctx.rootTarget.dispatchEvent(new CustomEvent('host:focus'));
    ctx.globalTarget.dispatchEvent(
      new CustomEvent('key.down', {
        detail: {
          key: ' ',
          preventDefault: () => preventDefaultCalls.push('space'),
        },
      })
    );
    expect(preventDefaultCalls).toEqual(['space']);
  });
});

import { describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import type { Prototype } from '@proto.ui/core';
import type { A11ySemanticObjectSnapshot } from '@proto.ui/core';
import { definePrototype } from '@proto.ui/core';
import type { RuntimeHost } from '@proto.ui/runtime';
import { executeWithHost } from '@proto.ui/runtime';
import {
  FOCUS_REQUEST_FOCUS_CAP,
  FOCUS_ROOT_TARGET_CAP,
  FOCUS_SET_FOCUSABLE_CAP,
  type FocusPort,
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
import {
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_ROOT_TARGET_CAP,
} from '@proto.ui/module-anatomy';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import { CHECKBOX_FAMILY, asCheckboxRoot, checkboxIndicator, checkboxRoot } from '../src/checkbox';

AdaptToWebComponent(checkboxRoot as any);
AdaptToWebComponent(checkboxIndicator as any);

function createCheckboxHost(initialRaw: Record<string, unknown> = {}) {
  let raw = { ...initialRaw };
  const rootTarget = new EventTarget();
  const globalTarget = new EventTarget();
  const emitted: Array<{ key: string; payload: unknown }> = [];
  const a11ySnapshots: A11ySemanticObjectSnapshot[] = [];
  const focusRequests: unknown[] = [];
  const focusableFlags: boolean[] = [];
  let exposes: Record<string, any> | null = null;

  const host: RuntimeHost<any> = {
    prototypeName: 'base-as-checkbox-root-contract',
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
      wiring.attach('anatomy', [
        [ANATOMY_INSTANCE_TOKEN_CAP, rootTarget],
        [ANATOMY_PARENT_CAP, () => null],
        [ANATOMY_GET_PROTO_CAP, () => null],
        [ANATOMY_ROOT_TARGET_CAP, () => rootTarget],
      ]);
      wiring.attach('context', [
        [CONTEXT_INSTANCE_TOKEN_CAP, rootTarget],
        [CONTEXT_PARENT_CAP, () => null],
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
    setRawProps(next: Record<string, unknown>) {
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

describe('prototypes/base: checkbox', () => {
  it('declares checkbox anatomy and keeps root authoring entries aligned', () => {
    // T-BASE-CHECKBOX-0001-CASE-ANATOMY-FAMILY
    // T-BASE-CHECKBOX-0001-CASE-AUTHORING-ENTRIES
    expect(CHECKBOX_FAMILY.debugName).toBe('base-checkbox');
    expect(CHECKBOX_FAMILY.decl.roles.root.cardinality).toEqual({ min: 1, max: 1 });
    expect(CHECKBOX_FAMILY.decl.roles.indicator.cardinality).toEqual({ min: 0, max: '*' });
    expect(CHECKBOX_FAMILY.decl.relations).toEqual([
      { kind: 'contains', parent: 'root', child: 'indicator' },
    ]);

    const AsHookRoot: Prototype<{
      checked?: boolean;
      defaultChecked?: boolean;
      disabled?: boolean;
      indeterminate?: boolean;
      defaultIndeterminate?: boolean;
    }> = definePrototype({
      name: 'x-base-as-checkbox-root-authoring-entry',
      setup() {
        asCheckboxRoot();
        return (r) => r.el('button', 'checkbox');
      },
    });

    const asHookCtx = createCheckboxHost({ defaultChecked: false, disabled: false });
    const directCtx = createCheckboxHost({ defaultChecked: false, disabled: false });

    executeWithHost(AsHookRoot as any, asHookCtx.host as any);
    executeWithHost(checkboxRoot as any, directCtx.host as any);

    const asHookExposes = asHookCtx.getExposes() as any;
    const directExposes = directCtx.getExposes() as any;

    expect(Object.keys(directExposes).sort()).toEqual(Object.keys(asHookExposes).sort());
    expect(asHookExposes.click).toBeUndefined();
    expect(directExposes.click).toBeUndefined();
    expect(asHookCtx.getA11ySnapshot()).toMatchObject({
      role: 'checkbox',
      name: { kind: 'content' },
      states: { checked: 'false', disabled: false },
      actions: { activate: { event: 'checkedChange' } },
    });
  });

  it('checkbox-root owns checked state and emits checkedChange', async () => {
    // T-BASE-CHECKBOX-0001-CASE-UNCONTROLLED-CHECKED-CHANGE
    // T-BASE-CHECKBOX-0001-CASE-A11Y-AND-DEFERRED-SURFACES
    const root = document.createElement('base-checkbox-root') as any;
    const checkedChanges: Array<{ checked: boolean; indeterminate: boolean }> = [];
    root.addEventListener('checkedChange', (event: Event) => {
      checkedChanges.push((event as CustomEvent).detail);
    });
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    const exposes = root.getExposes() as any;
    expect(exposes.checked.get()).toBe(false);
    expect(exposes.click).toBeUndefined();
    expect(root.getAttribute('role')).toBe('checkbox');
    expect(root.getAttribute('aria-checked')).toBe('false');

    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(exposes.checked.get()).toBe(true);
    expect(checkedChanges).toEqual([{ checked: true, indeterminate: false }]);
    expect(root.getAttribute('aria-checked')).toBe('true');
    root.remove();
    await Promise.resolve();
  });

  it('controlled checkbox-root emits next checked without mutating checked', async () => {
    // T-BASE-CHECKBOX-0001-CASE-CONTROLLED-CHECKED
    const root = document.createElement('base-checkbox-root') as any;
    const checkedChanges: Array<{ checked: boolean; indeterminate: boolean }> = [];
    root.addEventListener('checkedChange', (event: Event) => {
      checkedChanges.push((event as CustomEvent).detail);
    });
    setElementProps(root, { checked: false });
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    const exposes = root.getExposes() as any;
    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(exposes.checked.get()).toBe(false);
    expect(checkedChanges).toEqual([{ checked: true, indeterminate: false }]);

    setElementProps(root, { checked: true });
    await Promise.resolve();

    expect(exposes.checked.get()).toBe(true);
    expect(root.getAttribute('aria-checked')).toBe('true');
    root.remove();
    await Promise.resolve();
  });

  it('checkbox-root exposes author-controllable indeterminate and clears it on activation', async () => {
    // T-BASE-CHECKBOX-0001-CASE-INDETERMINATE
    const root = document.createElement('base-checkbox-root') as any;
    setElementProps(root, { defaultIndeterminate: true });
    const indeterminateChanges: Array<{ indeterminate: boolean }> = [];
    const checkedChanges: Array<{ checked: boolean; indeterminate: boolean }> = [];
    root.addEventListener('indeterminateChange', (event: Event) => {
      indeterminateChanges.push((event as CustomEvent).detail);
    });
    root.addEventListener('checkedChange', (event: Event) => {
      checkedChanges.push((event as CustomEvent).detail);
    });
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    const exposes = root.getExposes() as any;
    expect(exposes.indeterminate.get()).toBe(true);
    expect(exposes.checked.get()).toBe(false);
    expect(root.getAttribute('aria-checked')).toBe('mixed');

    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(exposes.indeterminate.get()).toBe(false);
    expect(exposes.checked.get()).toBe(true);
    expect(indeterminateChanges).toEqual([{ indeterminate: false }]);
    expect(checkedChanges).toEqual([{ checked: true, indeterminate: false }]);
    expect(root.getAttribute('aria-checked')).toBe('true');
    root.remove();
    await Promise.resolve();
  });

  it('controlled indeterminate remains stable and emits a clear request', async () => {
    // T-BASE-CHECKBOX-0001-CASE-INDETERMINATE
    const root = document.createElement('base-checkbox-root') as any;
    setElementProps(root, { indeterminate: true });
    const events: Array<{ indeterminate: boolean }> = [];
    root.addEventListener('indeterminateChange', (event: Event) => {
      events.push((event as CustomEvent).detail);
    });
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    const exposes = root.getExposes() as any;
    expect(exposes.indeterminate.get()).toBe(true);

    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(exposes.indeterminate.get()).toBe(true);
    expect(events).toEqual([{ indeterminate: false }]);

    setElementProps(root, { indeterminate: false });
    await Promise.resolve();

    expect(exposes.indeterminate.get()).toBe(false);
    root.remove();
    await Promise.resolve();
  });

  it('checkbox-indicator consumes repeatable checkbox context for derived display state', async () => {
    // T-BASE-CHECKBOX-0001-CASE-CONTEXT
    // T-BASE-CHECKBOX-INDICATOR-0001-CASE-INDICATOR-ROLE
    // T-BASE-CHECKBOX-INDICATOR-0001-CASE-CONTEXT-CONSUMPTION
    // T-BASE-CHECKBOX-INDICATOR-0001-CASE-NO-INTERACTION-SURFACES
    // T-BASE-CHECKBOX-INDICATOR-0001-CASE-AUTHORING-PRESENTATION-AND-DEFERRED-SURFACES
    const root = document.createElement('base-checkbox-root') as any;
    const firstIndicator = document.createElement('base-checkbox-indicator') as any;
    const secondIndicator = document.createElement('base-checkbox-indicator') as any;
    setElementProps(root, { defaultIndeterminate: true });
    root.append(firstIndicator, secondIndicator);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    const firstExposes = firstIndicator.getExposes();
    const secondExposes = secondIndicator.getExposes();

    expect(firstExposes.isChecked()).toBe(false);
    expect(secondExposes.isIndeterminate()).toBe(true);
    expect(firstExposes.checked.get()).toBe(false);
    expect(firstExposes.indeterminate.get()).toBe(true);
    expect(firstExposes.checkedChange).toBeUndefined();
    expect(firstExposes.focusSelf).toBeUndefined();
    expect(firstIndicator.getAttribute('role')).toBeNull();

    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(firstExposes.isChecked()).toBe(true);
    expect(secondExposes.isIndeterminate()).toBe(false);
    expect(firstExposes.checked.get()).toBe(true);
    expect(firstExposes.indeterminate.get()).toBe(false);

    root.remove();
    await Promise.resolve();
  });

  it('disabled checkbox-root suppresses value changes and clears transient interaction', async () => {
    // T-BASE-CHECKBOX-0001-CASE-DISABLED-GATING
    const root = document.createElement('base-checkbox-root') as any;
    setElementProps(root, { disabled: true, defaultIndeterminate: true });
    const checkedChanges: Array<{ checked: boolean; indeterminate: boolean }> = [];
    const indeterminateChanges: Array<{ indeterminate: boolean }> = [];
    root.addEventListener('checkedChange', (event: Event) => {
      checkedChanges.push((event as CustomEvent).detail);
    });
    root.addEventListener('indeterminateChange', (event: Event) => {
      indeterminateChanges.push((event as CustomEvent).detail);
    });
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    const exposes = root.getExposes() as any;
    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(exposes.checked.get()).toBe(false);
    expect(exposes.indeterminate.get()).toBe(true);
    expect(checkedChanges).toEqual([]);
    expect(indeterminateChanges).toEqual([]);
    root.remove();
    await Promise.resolve();
  });

  it('checkbox-root exposes focus and keyboard behavior through the root target', () => {
    // T-BASE-CHECKBOX-0001-CASE-INTERACTION-FOCUS-KEYBOARD
    const AsHookRoot: Prototype<{
      checked?: boolean;
      defaultChecked?: boolean;
      disabled?: boolean;
      indeterminate?: boolean;
      defaultIndeterminate?: boolean;
    }> = definePrototype({
      name: 'x-base-as-checkbox-root-focus-keyboard',
      setup(def) {
        const checkbox = asCheckboxRoot();
        const { stateHandles } = checkbox;
        if (!stateHandles) throw new Error('asCheckboxRoot stateHandles unavailable');
        def.lifecycle.onCreated(() => {
          stateHandles.indeterminate.set(true, 'reason: test component author sets indeterminate');
        });
        return (r) => r.el('button', 'checkbox');
      },
    });

    const ctx = createCheckboxHost({ defaultChecked: false, disabled: false });
    const { controller, caps } = executeWithHost(AsHookRoot as any, ctx.host as any);
    const focusPort = caps.getPort<FocusPort>('focus');
    const exposes = ctx.getExposes() as any;

    expect(exposes.indeterminate.get()).toBe(true);
    expect(ctx.getA11ySnapshot()).toMatchObject({
      states: { checked: 'mixed' },
    });

    ctx.rootTarget.dispatchEvent(new CustomEvent('pointer.enter'));
    expect(exposes.hovered.get()).toBe(true);

    ctx.globalTarget.dispatchEvent(new CustomEvent('key.down'));
    ctx.rootTarget.dispatchEvent(new CustomEvent('host:focus'));
    expect(exposes.focused.get()).toBe(true);
    expect(exposes.focusVisible.get()).toBe(true);
    expect(focusPort?.getFacts()).toMatchObject({
      focused: true,
      focusVisible: true,
      focusable: true,
    });

    ctx.rootTarget.dispatchEvent(new CustomEvent('pointer.down'));
    expect(exposes.pressed.get()).toBe(true);
    expect(exposes.focusVisible.get()).toBe(false);

    let prevented = false;
    ctx.globalTarget.dispatchEvent(
      new CustomEvent('key.down', {
        detail: {
          key: ' ',
          target: ctx.rootTarget,
          preventDefault: () => {
            prevented = true;
          },
        },
      })
    );
    expect(prevented).toBe(true);

    ctx.rootTarget.dispatchEvent(
      new CustomEvent('press.commit', { detail: new KeyboardEvent('keydown', { key: 'Enter' }) })
    );
    expect(exposes.checked.get()).toBe(false);
    expect(exposes.indeterminate.get()).toBe(true);

    ctx.rootTarget.dispatchEvent(
      new CustomEvent('press.commit', { detail: new KeyboardEvent('keydown', { key: ' ' }) })
    );
    expect(exposes.checked.get()).toBe(true);
    expect(exposes.indeterminate.get()).toBe(false);

    exposes.focusSelf({ reason: 'programmatic' });
    expect(ctx.focusRequests).toHaveLength(1);

    controller.applyRawProps({ disabled: true, defaultChecked: false } as any);
    expect(exposes.hovered.get()).toBe(false);
    expect(exposes.focused.get()).toBe(false);
    expect(exposes.focusVisible.get()).toBe(false);
    expect(exposes.pressed.get()).toBe(false);
    expect(focusPort?.getFocusableConfig().disabled).toBe(true);

    exposes.focusSelf({ reason: 'disabled' });
    expect(ctx.focusRequests).toHaveLength(1);
  });
});

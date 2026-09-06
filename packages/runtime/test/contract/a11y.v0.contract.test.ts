import { describe, expect, it, vi } from 'vitest';
import type { A11ySemanticObjectSnapshot, Prototype } from '@proto.ui/core';
import { createA11ySemanticObjectRef, defineAsHook, definePrototype } from '@proto.ui/core';
import { A11Y_PROJECT_CAP, type A11yPort, type A11yProjector } from '@proto.ui/module-a11y';
import { executeWithHost, type RuntimeHost } from '../../src';

function createHost(initialRaw: Record<string, unknown> = {}) {
  let raw = { ...initialRaw };
  const snapshots: A11ySemanticObjectSnapshot[] = [];

  const host: RuntimeHost<any> = {
    prototypeName: 'x-a11y-contract',
    getRawProps: () => raw,
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
    onRuntimeReady(wiring) {
      wiring.attach('a11y', [
        [
          A11Y_PROJECT_CAP,
          (snapshot: A11ySemanticObjectSnapshot) => {
            snapshots.push(snapshot);
          },
        ],
      ]);
    },
  };

  return {
    host,
    snapshots,
    applyRaw(nextRaw: Record<string, unknown>) {
      raw = { ...nextRaw };
    },
  };
}

describe('runtime contract: a11y (v0)', () => {
  it('A11Y-0050: role may follow a state-backed semantic fact', () => {
    let role!: { set(value: string, reason?: string): void };
    const P = definePrototype({
      name: 'x-a11y-dynamic-role',
      setup(def) {
        role = def.state.string('role', 'dialog', { options: ['dialog', 'alertdialog'] });
        def.a11y.role(role as any);
        return (r) => r.el('div', 'dialog');
      },
    });

    const ctx = createHost();
    const result = executeWithHost(P as any, ctx.host as any);
    const port = result.caps.getPort<A11yPort>('a11y');
    expect(port?.getSnapshot().role).toBe('dialog');

    result.invokeInCallbackScope(() => role.set('alertdialog', 'reason: alert mode'));
    expect(port?.getSnapshot().role).toBe('alertdialog');
    expect(ctx.snapshots.at(-1)?.role).toBe('alertdialog');
  });

  it('A11Y-0100: def.a11y records semantic object IR and projects state snapshots', () => {
    // T-A11Y-0001-CASE-IR
    const P: Prototype<{ disabled?: boolean }> = definePrototype({
      name: 'x-a11y-ir-contract',
      setup(def) {
        def.props.define({
          disabled: { type: 'boolean', empty: 'fallback' },
        });
        def.props.setDefaults({ disabled: false });

        const disabled = def.state.bool('button.disabled', false);
        const id = def.state.string('button.id', 'button-a');
        const controls = def.state.string('button.controls', 'panel-a');
        def.a11y.id(id);
        def.a11y.role('button');
        def.a11y.name('Save');
        def.a11y.description('Stores changes');
        def.a11y.state('disabled', disabled);
        def.a11y.action('activate', { event: 'click' });
        def.a11y.relation('controls', { target: controls });
        def.a11y.relation('describedBy', { target: 'help-a', mode: 'append' });
        def.a11y.tree({ mergeChildren: true });

        def.lifecycle.onCreated((run) => {
          disabled.set(run.props.get().disabled);
        });
        def.props.watch(['disabled'], (_run, next) => {
          disabled.set(next.disabled);
        });

        return (r) => r.el('button', 'Save');
      },
    });

    const ctx = createHost({ disabled: false });
    const { caps, controller } = executeWithHost(P as any, ctx.host as any);
    const port = caps.getPort<A11yPort>('a11y');

    expect(port?.getSnapshot()).toEqual({
      objectRef: port?.getObjectRef(),
      id: 'button-a',
      role: 'button',
      name: { kind: 'text', value: 'Save' },
      description: { kind: 'text', value: 'Stores changes' },
      states: { disabled: false },
      actions: { activate: { event: 'click' } },
      relations: { controls: 'panel-a', describedBy: 'help-a' },
      relationModes: { describedBy: 'append' },
      tree: { mergeChildren: true },
    });

    ctx.applyRaw({ disabled: true });
    controller.applyRawProps({ disabled: true } as any);

    expect(port?.getSnapshot().states.disabled).toBe(true);
    expect(ctx.snapshots.at(-1)?.states.disabled).toBe(true);
  });

  it('A11Y-0150: preserves opaque ordered relation refs across view epochs and releases projection terminally', async () => {
    // T-A11Y-0001-CASE-OPAQUE-RELATIONS
    const first = createA11ySemanticObjectRef();
    const second = createA11ySemanticObjectRef();
    const authored = [first, second, first];
    const projected: A11ySemanticObjectSnapshot[] = [];
    const dispose = vi.fn();
    const projector: A11yProjector = (snapshot) => {
      projected.push(snapshot);
    };
    projector.dispose = dispose;

    const P = definePrototype({
      name: 'x-a11y-opaque-relations',
      setup(def) {
        def.a11y.role('cell');
        def.a11y.relation('headers', { target: authored });
        return (r) => r.el('div', 'value');
      },
    });
    const ctx = createHost();
    ctx.host.onRuntimeReady = (wiring) => {
      wiring.attach('a11y', [[A11Y_PROJECT_CAP, projector]]);
    };

    const result = executeWithHost(P, ctx.host);
    const port = result.caps.getPort<A11yPort>('a11y');
    authored.splice(0, authored.length, second);
    const objectRef = port?.getObjectRef();
    const initial = port?.getSnapshot();

    expect(objectRef).toBeDefined();
    expect(initial?.objectRef).toBe(objectRef);
    expect(initial?.relations.headers).toEqual([first, second]);
    expect(Object.isFrozen(initial?.relations.headers)).toBe(true);

    port?.setRelation('headers', { target: second });
    expect(port?.getSnapshot().relations.headers).toEqual([second]);
    expect(projected.at(-1)?.relations.headers).toEqual([second]);

    port?.removeRelation('headers');
    expect(port?.getSnapshot().relations).not.toHaveProperty('headers');

    await result.session.unmount();
    await result.session.mount();
    expect(port?.getObjectRef()).toBe(objectRef);
    expect(port?.getSnapshot().objectRef).toBe(objectRef);

    await result.session.dispose();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('A11Y-0155: rewires State-backed relation updates after setup', () => {
    // T-A11Y-0001-CASE-OPAQUE-RELATIONS
    let firstTarget!: { set(value: string, reason?: string): void };
    let secondTarget!: { set(value: string, reason?: string): void };
    const P = definePrototype({
      name: 'x-a11y-dynamic-relations',
      setup(def) {
        firstTarget = def.state.string('first-target', 'first-a');
        secondTarget = def.state.string('second-target', 'second-a');
        return (r) => r.el('div', 'source');
      },
    });
    const ctx = createHost();
    const result = executeWithHost(P, ctx.host);
    const port = result.caps.getPort<A11yPort>('a11y');

    port?.setRelation('controls', { target: firstTarget as any });
    expect(ctx.snapshots.at(-1)?.relations.controls).toBe('first-a');

    result.invokeInCallbackScope(() => firstTarget.set('first-b', 'first changes'));
    expect(ctx.snapshots.at(-1)?.relations.controls).toBe('first-b');

    port?.setRelation('controls', { target: secondTarget as any });
    const afterReplacement = ctx.snapshots.length;
    result.invokeInCallbackScope(() => firstTarget.set('first-c', 'stale source changes'));
    expect(ctx.snapshots).toHaveLength(afterReplacement);

    result.invokeInCallbackScope(() => secondTarget.set('second-b', 'replacement changes'));
    expect(ctx.snapshots.at(-1)?.relations.controls).toBe('second-b');

    port?.removeRelation('controls');
    const afterRemoval = ctx.snapshots.length;
    result.invokeInCallbackScope(() => secondTarget.set('second-c', 'removed source changes'));
    expect(ctx.snapshots).toHaveLength(afterRemoval);
  });

  it('A11Y-0157: keeps borrowed State relation handles live after setup', () => {
    // T-A11Y-0001-CASE-OPAQUE-RELATIONS
    let borrowedTarget!: { get(): string; set(value: string, reason?: string): void };
    const asRelationState = defineAsHook({
      name: 'as-a11y-relation-state',
      setup(def) {
        def.state.string('relation-target', 'target-a');
      },
    });
    const P = definePrototype({
      name: 'x-a11y-borrowed-relation',
      setup(def) {
        borrowedTarget = (asRelationState() as any).state;
        def.a11y.relation('controls', { target: borrowedTarget as any });
        return (r) => r.el('div', 'source');
      },
    });
    const ctx = createHost();
    const result = executeWithHost(P, ctx.host);

    expect(ctx.snapshots.at(-1)?.relations.controls).toBe('target-a');
    result.invokeInCallbackScope(() => borrowedTarget.set('target-b', 'borrowed changes'));
    expect(ctx.snapshots.at(-1)?.relations.controls).toBe('target-b');
  });

  it('A11Y-0160: detaches replaced projector caps and disposes every epoch terminally', async () => {
    // T-A11Y-0001-CASE-OPAQUE-RELATIONS
    const firstDetach = vi.fn();
    const firstDispose = vi.fn();
    const secondDispose = vi.fn();
    const first: A11yProjector = () => undefined;
    first.detach = firstDetach;
    first.dispose = firstDispose;
    const secondSnapshots: A11ySemanticObjectSnapshot[] = [];
    const second: A11yProjector = (snapshot) => {
      secondSnapshots.push(snapshot);
    };
    second.dispose = secondDispose;
    const projectorControl: { replace?: (projector: A11yProjector) => void } = {};

    const P = definePrototype({
      name: 'x-a11y-projector-epochs',
      setup(def) {
        def.a11y.role('group');
        return (r) => r.el('div', 'group');
      },
    });
    const ctx = createHost();
    ctx.host.onRuntimeReady = (wiring) => {
      wiring.attach('a11y', [[A11Y_PROJECT_CAP, first]]);
      projectorControl.replace = (projector) => {
        wiring.reset('a11y');
        wiring.attach('a11y', [[A11Y_PROJECT_CAP, projector]]);
      };
    };

    const result = executeWithHost(P, ctx.host);
    const replaceProjector = projectorControl.replace;
    if (!replaceProjector) throw new Error('Expected runtime A11y wiring');
    replaceProjector(second);
    expect(firstDetach).toHaveBeenCalledOnce();
    expect(secondSnapshots.at(-1)?.role).toBe('group');

    await result.session.dispose();
    expect(firstDispose).toHaveBeenCalledOnce();
    expect(secondDispose).toHaveBeenCalledOnce();
  });

  it('A11Y-0170: never invokes a projector after terminal disposal begins', async () => {
    // T-A11Y-0001-CASE-OPAQUE-RELATIONS
    let port: A11yPort | undefined;
    let beforeDisposeCalled = false;
    let projectorDisposed = false;
    const projectedAfterDispose: A11ySemanticObjectSnapshot[] = [];
    const projector: A11yProjector = (snapshot) => {
      if (projectorDisposed) projectedAfterDispose.push(snapshot);
    };
    projector.dispose = () => {
      projectorDisposed = true;
    };
    const P = definePrototype({
      name: 'x-a11y-terminal-projection',
      setup(def) {
        def.a11y.role('group');
        def.lifecycle.onBeforeDispose(() => {
          beforeDisposeCalled = true;
          port?.setRelation('controls', { target: 'late-target' });
        });
        return (r) => r.el('div', 'group');
      },
    });
    const ctx = createHost();
    ctx.host.onRuntimeReady = (wiring) => {
      wiring.attach('a11y', [[A11Y_PROJECT_CAP, projector]]);
    };
    const result = executeWithHost(P, ctx.host);
    port = result.caps.getPort<A11yPort>('a11y');

    await result.session.dispose();

    expect(beforeDisposeCalled).toBe(true);
    expect(projectorDisposed).toBe(true);
    expect(projectedAfterDispose).toEqual([]);
  });
});

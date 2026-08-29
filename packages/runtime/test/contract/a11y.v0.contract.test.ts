import { describe, expect, it } from 'vitest';
import type {
  A11ySemanticObjectSnapshot,
  OwnedStateHandle,
  Prototype,
  State,
} from '@proto.ui/core';
import { defineAsHook, definePrototype } from '@proto.ui/core';
import { asScrollSurface } from '@proto.ui/hooks';
import { A11Y_PROJECT_CAP, type A11yPort } from '@proto.ui/module-a11y';
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
  it.each([1, 2, 3, 4, 5, 6])('A11Y-0060: accepts portable heading level %s', (level) => {
    // T-A11Y-0001-CASE-HEADING-LEVEL
    const P = definePrototype({
      name: `x-a11y-heading-level-${level}`,
      setup(def) {
        def.a11y.role('heading');
        def.a11y.level(level);
      },
    });

    const result = executeWithHost(P as any, createHost().host as any);
    expect(result.caps.getPort<A11yPort>('a11y')?.getSnapshot().level).toBe(level);
  });

  it.each([0, -1, 1.5, 7, Number.NaN, Number.POSITIVE_INFINITY])(
    'A11Y-0061: rejects invalid static portable heading level %s',
    (level) => {
      // T-A11Y-0001-CASE-HEADING-LEVEL
      const P = definePrototype({
        name: 'x-a11y-invalid-static-heading-level',
        setup(def) {
          def.a11y.role('heading');
          def.a11y.level(level);
        },
      });

      expect(() => executeWithHost(P as any, createHost().host as any)).toThrow(
        /level must be an integer in range 1-6/
      );
    }
  );

  it.each([0, -1, 1.5, 7, Number.NaN, Number.POSITIVE_INFINITY])(
    'A11Y-0062: rejects invalid initial state-backed heading level %s',
    (initialLevel) => {
      // T-A11Y-0001-CASE-HEADING-LEVEL
      const P = definePrototype({
        name: 'x-a11y-invalid-initial-state-heading-level',
        setup(def) {
          const level = def.state.numberDiscrete('heading.level', initialLevel);
          def.a11y.role('heading');
          def.a11y.level(level);
        },
      });

      expect(() => executeWithHost(P as any, createHost().host as any)).toThrow(
        /level must be an integer in range 1-6/
      );
    }
  );

  it.each([0, -1, 1.5, 7, Number.NaN, Number.POSITIVE_INFINITY])(
    'A11Y-0063: rejects invalid state-backed heading level update %s before projection',
    (invalidLevel) => {
      // T-A11Y-0001-CASE-HEADING-LEVEL
      let level!: OwnedStateHandle<number>;
      const P = definePrototype({
        name: 'x-a11y-state-heading-level-update',
        setup(def) {
          level = def.state.numberDiscrete('heading.level', 2);
          def.a11y.role('heading');
          def.a11y.level(level);
        },
      });

      const ctx = createHost();
      const result = executeWithHost(P as any, ctx.host as any);
      expect(ctx.snapshots.at(-1)?.level).toBe(2);

      expect(() =>
        result.invokeInCallbackScope(() => level.set(invalidLevel, 'reason: invalid heading level'))
      ).toThrow(/level must be an integer in range 1-6/);
      expect(ctx.snapshots.at(-1)?.level).toBe(2);

      result.invokeInCallbackScope(() => level.set(3, 'reason: valid heading level'));
      expect(ctx.snapshots.at(-1)?.level).toBe(3);
    }
  );

  it('A11Y-0064: captures a11y.tree declarations in an asHook result', () => {
    let result: any;
    const asSemanticTree = defineAsHook({
      name: 'as-semantic-tree',
      setup(def) {
        def.a11y.tree({ mergeChildren: true });
      },
    });
    const P = definePrototype({
      name: 'x-a11y-tree-as-hook-capture',
      setup() {
        result = asSemanticTree();
      },
    });

    executeWithHost(P as any, createHost().host as any);
    expect(result.context).toEqual({
      op: 'a11y.tree',
      patch: { mergeChildren: true },
    });
  });

  it('A11Y-0065: accepts a borrowed heading level from an authored asHook', () => {
    const asHeadingLevel = defineAsHook<
      Record<string, never>,
      Record<string, never>,
      { level: State<number> }
    >({
      name: 'as-heading-level',
      setup(def) {
        def.state.numberDiscrete('level', 2);
      },
    });
    const P = definePrototype({
      name: 'x-a11y-borrowed-heading-level',
      setup(def) {
        const level = asHeadingLevel().getState?.('level');
        if (!level) throw new Error('missing borrowed heading level');
        def.a11y.role('heading');
        def.a11y.level(level);
      },
    });

    const ctx = createHost();
    expect(() => executeWithHost(P as any, ctx.host as any)).not.toThrow();
    expect(ctx.snapshots.at(-1)?.level).toBe(2);
  });

  it('A11Y-0065A: accepts an observed heading level from another module', () => {
    const P = definePrototype({
      name: 'x-a11y-observed-heading-level',
      setup(def) {
        const scroll = asScrollSurface();
        def.a11y.role('heading');
        def.a11y.level(scroll.horizontal.visibleRatio);
      },
    });

    const ctx = createHost();
    expect(() => executeWithHost(P as any, ctx.host as any)).not.toThrow();
    expect(ctx.snapshots.at(-1)?.level).toBe(1);
  });

  it('A11Y-0066: rejects invalid heading level updates without a host projector', () => {
    let level!: OwnedStateHandle<number>;
    const P = definePrototype({
      name: 'x-a11y-capless-heading-level',
      setup(def) {
        level = def.state.numberDiscrete('heading.level', 2);
        def.a11y.role('heading');
        def.a11y.level(level);
      },
    });

    const ctx = createHost();
    delete (ctx.host as Partial<RuntimeHost<any>>).onRuntimeReady;
    const result = executeWithHost(P as any, ctx.host as any);

    expect(() =>
      result.invokeInCallbackScope(() => level.set(0, 'reason: invalid heading level'))
    ).toThrow(/level must be an integer in range 1-6/);
  });

  it('A11Y-0067: rejects a non-emitting invalid level before installing a cap-less watch', () => {
    const P = definePrototype({
      name: 'x-a11y-capless-invalid-heading-level-before-watch',
      setup(def) {
        const level = def.state.numberDiscrete('heading.level', 2);
        def.a11y.role('heading');
        def.a11y.level(level);
        level.setDefault(0);
      },
    });

    const ctx = createHost();
    delete (ctx.host as Partial<RuntimeHost<any>>).onRuntimeReady;

    expect(() => executeWithHost(P as any, ctx.host as any)).toThrow(
      /level must be an integer in range 1-6/
    );
  });

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
});

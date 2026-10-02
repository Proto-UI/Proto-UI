import { describe, expect, it, vi } from 'vitest';
import type {
  A11ySemanticObjectSnapshot,
  OwnedStateHandle,
  Prototype,
  State,
} from '@proto.ui/core';
import {
  createA11ySemanticObjectRef,
  createAnatomyFamily,
  defineAsHook,
  definePrototype,
} from '@proto.ui/core';
import {
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_ROOT_TARGET_CAP,
  ANATOMY_ORDER_OBSERVER_CAP,
} from '@proto.ui/module-anatomy';
import { asAccessible, asScrollSurface } from '@proto.ui/hooks';
import { createInstanceTreeMarkers } from '@proto.ui/adapter-base';
import {
  A11Y_PROJECT_CAP,
  createWebA11yProjector,
  type A11yPort,
  type A11yProjector,
} from '@proto.ui/module-a11y';
import { SCROLL_SURFACE_HOST_CAP, type ScrollSurfaceHostAttachment } from '@proto.ui/module-scroll';
import { createRuntimeSession, executeWithHost, type RuntimeHost } from '../../src';

function createHost(initialRaw: Record<string, unknown> = {}) {
  let raw = { ...initialRaw };
  const snapshots: A11ySemanticObjectSnapshot[] = [];
  const projectionEvents: string[] = [];

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
          Object.assign(
            (snapshot: A11ySemanticObjectSnapshot) => {
              snapshots.push(snapshot);
            },
            {
              clearHeadingLevel() {
                projectionEvents.push('clear-heading-level');
              },
            }
          ),
        ],
      ]);
    },
  };

  return {
    host,
    snapshots,
    projectionEvents,
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
        asAccessible().role('heading');
        asAccessible().level(level);
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
          asAccessible().role('heading');
          asAccessible().level(level);
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
          asAccessible().role('heading');
          asAccessible().level(level);
        },
      });

      expect(() => executeWithHost(P as any, createHost().host as any)).toThrow(
        /level must be an integer in range 1-6/
      );
    }
  );

  it.each([0, -1, 1.5, 7, Number.NaN, Number.POSITIVE_INFINITY])(
    'A11Y-0063: omits invalid state-backed heading level from projection %s',
    (invalidLevel) => {
      // T-A11Y-0001-CASE-HEADING-LEVEL
      let level!: OwnedStateHandle<number>;
      const P = definePrototype({
        name: 'x-a11y-state-heading-level-update',
        setup(def) {
          level = def.state.numberDiscrete('heading.level', 2);
          asAccessible().role('heading');
          asAccessible().level(level);
        },
      });

      const ctx = createHost();
      const result = executeWithHost(P as any, ctx.host as any);
      expect(ctx.snapshots.at(-1)?.level).toBe(2);

      result.invokeInCallbackScope(() => level.set(invalidLevel, 'reason: invalid heading level'));
      expect(level.get()).toBe(invalidLevel);
      expect(ctx.snapshots.at(-1)?.role).toBe('heading');
      expect(ctx.snapshots.at(-1)?.level).toBeUndefined();

      result.invokeInCallbackScope(() => level.set(3, 'reason: valid heading level'));
      expect(ctx.snapshots.at(-1)?.level).toBe(3);
    }
  );

  it('A11Y-0064: captures the accessible child handle in an authored asHook result', () => {
    let result: any;
    const asSemanticTree = defineAsHook({
      name: 'as-semantic-tree',
      setup(def) {
        asAccessible().tree({ mergeChildren: true });
      },
    });
    const P = definePrototype({
      name: 'x-a11y-tree-as-hook-capture',
      setup() {
        result = asSemanticTree();
      },
    });

    const runtime = executeWithHost(P as any, createHost().host as any);
    const child = result.getAsHook('asAccessible');
    expect(child.handle).toBe(child.result);
    expect(typeof child.handle.tree).toBe('function');
    expect(runtime.caps.getPort<A11yPort>('a11y')?.getSnapshot().tree).toEqual({
      mergeChildren: true,
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
        asAccessible().role('heading');
        asAccessible().level(level);
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
        asAccessible().role('heading');
        asAccessible().level(scroll.horizontal.visibleRatio);
      },
    });

    const ctx = createHost();
    expect(() => executeWithHost(P as any, ctx.host as any)).not.toThrow();
    expect(ctx.snapshots.at(-1)?.level).toBe(1);
  });

  it('does not mutate an observed heading level source when invalid', () => {
    let emitFacts: ScrollSurfaceHostAttachment['onFacts'] | undefined;
    let getVisibleRatio: (() => number) | undefined;
    const P = definePrototype({
      name: 'x-a11y-observed-heading-level-update',
      setup(def) {
        const scroll = asScrollSurface();
        getVisibleRatio = () => scroll.getSnapshot().horizontal.visibleRatio;
        asAccessible().role('heading');
        asAccessible().level(scroll.horizontal.visibleRatio);
      },
    });

    const ctx = createHost();
    const previousReady = ctx.host.onRuntimeReady;
    ctx.host.onRuntimeReady = (wiring) => {
      previousReady?.(wiring);
      wiring.attach('scroll', [
        [
          SCROLL_SURFACE_HOST_CAP,
          {
            support: { system: true, composed: false },
            attach(connection: ScrollSurfaceHostAttachment) {
              emitFacts = connection.onFacts;
              return { update() {}, request() {}, dispose() {} };
            },
          },
        ],
      ]);
    };

    const result = executeWithHost(P as any, ctx.host as any);
    if (!emitFacts || !getVisibleRatio) throw new Error('scroll test host did not attach');

    result.invokeInCallbackScope(() =>
      emitFacts!({
        axes: 'both',
        horizontal: {
          position: 0,
          visibleRatio: 0.5,
          canScrollBefore: false,
          canScrollAfter: true,
          atEnd: false,
        },
        vertical: {
          position: 0,
          visibleRatio: 1,
          canScrollBefore: false,
          canScrollAfter: false,
          atEnd: true,
        },
        scrolling: false,
        projection: 'system',
        endFollow: { state: 'off', requestStatus: 'idle' },
      })
    );
    expect(ctx.snapshots.at(-1)?.level).toBeUndefined();
    expect(getVisibleRatio()).toBe(0.5);
    result.invokeUnmounted();
  });

  it('rematerializes with an invalid runtime level omitted and restores later valid projection', async () => {
    let level!: OwnedStateHandle<number>;
    const P = definePrototype({
      name: 'x-a11y-detached-heading-level',
      setup(def) {
        level = def.state.numberDiscrete('heading.level', 2);
        asAccessible().role('heading');
        asAccessible().level(level);
      },
    });

    const ctx = createHost();
    const session = createRuntimeSession(P as any, ctx.host as any);
    await session.mount();
    expect(ctx.snapshots.at(-1)?.level).toBe(2);

    await session.unmount();
    expect(ctx.projectionEvents).toEqual(['clear-heading-level']);
    expect(session.mountPhase).toBe('detached');
    ctx.snapshots.length = 0;
    session.invokeInCallbackScope(() => level.set(0, 'reason: detached invalid heading level'));
    expect(level.get()).toBe(0);
    expect(ctx.snapshots).toEqual([]);

    await expect(session.mount()).resolves.toBeUndefined();
    expect(ctx.snapshots.at(-1)).toMatchObject({ role: 'heading', level: undefined });

    session.invokeInCallbackScope(() => level.set(4, 'reason: recovered heading level'));
    expect(level.get()).toBe(4);
    expect(ctx.snapshots.at(-1)?.level).toBe(4);
    await session.dispose();
  });

  it('PUI-625-LOCAL-DETACHED-REACTIVATION: defers same-cap replay until remount with current State', async () => {
    // T-A11Y-0001-CASE-HEADING-LEVEL; HC-A11Y-0001-C; C-LIFECYCLE-0006-C.
    const element = document.createElement('h2');
    const projector = createWebA11yProjector(element);
    let level!: OwnedStateHandle<number>;
    let reattach!: () => void;
    const P = definePrototype({
      name: 'x-a11y-detached-cap-reactivation',
      setup(def) {
        level = def.state.numberDiscrete('heading.level', 2);
        asAccessible().role('heading');
        asAccessible().level(level);
      },
    });
    const ctx = createHost();
    ctx.host.onRuntimeReady = (wiring) => {
      wiring.attach('a11y', [[A11Y_PROJECT_CAP, projector]]);
      reattach = () => {
        wiring.reset('a11y');
        wiring.attach('a11y', [[A11Y_PROJECT_CAP, projector]]);
      };
    };
    const session = createRuntimeSession(P, ctx.host);
    const mutations: MutationRecord[] = [];
    const observer = new MutationObserver((records) => mutations.push(...records));
    try {
      await session.mount();
      expect(element.getAttribute('aria-level')).toBe('2');
      await session.unmount();
      expect(session.mountPhase).toBe('detached');
      expect(element.hasAttribute('aria-level')).toBe(false);
      observer.observe(element, {
        attributes: true,
        attributeFilter: ['aria-level'],
        attributeOldValue: true,
      });
      session.invokeInCallbackScope(() => level.set(4, 'new level while detached'));
      reattach();
      expect(element.hasAttribute('aria-level')).toBe(false);
      await session.mount();
      expect(element.getAttribute('aria-level')).toBe('4');
      mutations.push(...observer.takeRecords());
      expect(mutations.map((record) => record.oldValue)).not.toContain('2');
    } finally {
      observer.disconnect();
      await session.dispose();
    }
  });

  it('PUI-625-LOCAL-CACHED-HEADING-REPLAY: keeps retained-cap target notifications free of stale level', async () => {
    // C-A11Y-0001-LEVEL; HC-A11Y-0001-C; C-LIFECYCLE-0006-C.
    let level!: OwnedStateHandle<number>;
    const P = definePrototype({
      name: 'x-a11y-retained-cap-heading',
      setup(def) {
        level = def.state.numberDiscrete('heading.level', 2);
        asAccessible().role('heading');
        asAccessible().level(level);
      },
    });
    const tree = createInstanceTreeMarkers('@proto.ui/test/a11y-retained-cap-heading');
    const token = tree.createLogicalInstance(P);
    const element = document.createElement('h2');
    tree.markProtoInstance(element, P, token);
    const projector = createWebA11yProjector(
      () => tree.getLogicalTriggerSurfaceRoot(token),
      (listener) => tree.subscribeLogicalTriggerSurface(token, listener)
    );
    const ctx = createHost();
    ctx.host.onRuntimeReady = (wiring) => wiring.attach('a11y', [[A11Y_PROJECT_CAP, projector]]);
    const session = createRuntimeSession(P, ctx.host);
    const mutations: MutationRecord[] = [];
    const observer = new MutationObserver((records) => mutations.push(...records));
    try {
      await session.mount();
      expect(element.getAttribute('aria-level')).toBe('2');
      await session.unmount();
      expect(element.hasAttribute('aria-level')).toBe(false);
      observer.observe(element, {
        attributes: true,
        attributeFilter: ['aria-level'],
        attributeOldValue: true,
      });
      session.invokeInCallbackScope(() => level.set(4, 'new level while detached'));
      // Real Base lifecycle notifications; the cap is neither reset nor replaced.
      tree.unbindProtoInstance(token, element);
      tree.markProtoInstance(element, P, token);
      expect(element.hasAttribute('aria-level')).toBe(false);
      await session.mount();
      expect(element.getAttribute('aria-level')).toBe('4');
      mutations.push(...observer.takeRecords());
      expect(mutations.map((record) => record.oldValue)).not.toContain('2');
    } finally {
      observer.disconnect();
      await session.dispose();
      tree.unbindProtoInstance(token, element);
    }
  });

  it('tracks a replacement level source during setup', () => {
    let first!: OwnedStateHandle<number>;
    let second!: OwnedStateHandle<number>;
    const P = definePrototype({
      name: 'x-a11y-replaced-heading-level',
      setup(def) {
        first = def.state.numberDiscrete('first.heading.level', 2);
        second = def.state.numberDiscrete('second.heading.level', 2);
        asAccessible().role('heading');
        asAccessible().level(first);
        asAccessible().level(second);
      },
    });

    const ctx = createHost();
    const result = executeWithHost(P as any, ctx.host as any);
    expect(ctx.snapshots.at(-1)?.level).toBe(2);

    result.invokeInCallbackScope(() => second.set(0, 'reason: invalid replacement level'));
    expect(second.get()).toBe(0);

    result.invokeInCallbackScope(() => second.set(4, 'reason: replacement level'));
    expect(ctx.snapshots.at(-1)?.level).toBe(4);
    result.invokeUnmounted();
  });

  it('retains a reentrant invalid runtime level in State while omitting projection', () => {
    let setLevel!: (value: number) => void;
    let getLevel!: () => number;
    const asReentrantLevel = defineAsHook<
      Record<string, never>,
      Record<string, never>,
      { level: State<number> }
    >({
      name: 'as-reentrant-heading-level',
      setup(def) {
        def.state.numberDiscrete('level', 2);
      },
    });
    const P = definePrototype({
      name: 'x-a11y-reentrant-heading-level',
      setup(def) {
        const level = asReentrantLevel().getState?.('level');
        if (!level) throw new Error('missing reentrant heading level');
        setLevel = (value) => level.set(value, 'reason: reentrant test level');
        getLevel = () => level.get();
        level.watch((_run, event) => {
          if (event.type === 'next' && event.next === 3) {
            level.set(0, 'reason: reentrant invalid level');
          }
        });
        asAccessible().role('heading');
        asAccessible().level(level);
      },
    });

    const ctx = createHost();
    const result = executeWithHost(P as any, ctx.host as any);
    expect(ctx.snapshots.at(-1)?.level).toBe(2);
    expect(() => result.invokeInCallbackScope(() => setLevel(3))).not.toThrow();
    expect(getLevel()).toBe(0);
    result.invokeUnmounted();
  });

  it('rejects a final invalid level before exposing a detached session', () => {
    const P = definePrototype({
      name: 'x-a11y-final-invalid-heading-level',
      setup(def) {
        const level = def.state.numberDiscrete('heading.level', 2);
        asAccessible().role('heading');
        asAccessible().level(level);
        level.setDefault(0);
      },
    });

    expect(() => createRuntimeSession(P as any, createHost().host as any)).toThrow(
      /level must be an integer in range 1-6/
    );
  });

  it('keeps State watcher delivery unchanged for an invalid runtime level', () => {
    let setLevel!: (value: number) => void;
    let getLevel!: () => number;
    const seen: number[] = [];
    const asHeadingLevel = defineAsHook<
      Record<string, never>,
      Record<string, never>,
      { level: State<number> }
    >({
      name: 'as-early-watcher-heading-level',
      setup(def) {
        def.state.numberDiscrete('level', 2);
      },
    });
    const P = definePrototype({
      name: 'x-a11y-early-watcher-heading-level',
      setup(def) {
        const level = asHeadingLevel().getState?.('level');
        if (!level) throw new Error('missing early-watcher heading level');
        setLevel = (value) => level.set(value, 'reason: invalid early-watcher level');
        getLevel = () => level.get();
        level.watch((_run, event) => {
          if (event.type === 'next') seen.push(event.next);
        });
        asAccessible().role('heading');
        asAccessible().level(level);
      },
    });

    const result = executeWithHost(P as any, createHost().host as any);
    result.invokeInCallbackScope(() => setLevel(0));
    expect(getLevel()).toBe(0);
    expect(seen).toEqual([0]);
    result.invokeUnmounted();
  });

  it('A11Y-0066: retains invalid runtime levels without a host projector', () => {
    let level!: OwnedStateHandle<number>;
    const P = definePrototype({
      name: 'x-a11y-capless-heading-level',
      setup(def) {
        level = def.state.numberDiscrete('heading.level', 2);
        asAccessible().role('heading');
        asAccessible().level(level);
      },
    });

    const ctx = createHost();
    delete (ctx.host as Partial<RuntimeHost<any>>).onRuntimeReady;
    const result = executeWithHost(P as any, ctx.host as any);

    result.invokeInCallbackScope(() => level.set(0, 'reason: invalid heading level'));
    expect(level.get()).toBe(0);
  });

  it('A11Y-0067: rejects a non-emitting invalid level before installing a cap-less watch', () => {
    const P = definePrototype({
      name: 'x-a11y-capless-invalid-heading-level-before-watch',
      setup(def) {
        const level = def.state.numberDiscrete('heading.level', 2);
        asAccessible().role('heading');
        asAccessible().level(level);
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
        asAccessible().role(role as any);
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

  it('A11Y-0100: asAccessible() records semantic object IR and projects state snapshots', () => {
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
        asAccessible().id(id);
        asAccessible().role('button');
        asAccessible().name('Save');
        asAccessible().description('Stores changes');
        asAccessible().state('disabled', disabled);
        asAccessible().action('activate', { event: 'click' });
        asAccessible().relation('controls', { target: controls });
        asAccessible().relation('describedBy', { target: 'help-a', mode: 'append' });
        asAccessible().tree({ mergeChildren: true });

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
      level: undefined,
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
        asAccessible().role('cell');
        asAccessible().relation('headers', { target: authored });
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

  it('A11Y-0152: retires a replaced view projector after the replacement applies', async () => {
    // T-A11Y-0001-CASE-OPAQUE-RELATIONS
    const target = document.createElement('div');
    const first = createWebA11yProjector(target);
    const second = createWebA11yProjector(target);
    const firstDetach = vi.fn(first.detach);
    const firstDispose = vi.fn(first.dispose);
    const secondDispose = vi.fn(second.dispose);
    first.detach = firstDetach;
    first.dispose = firstDispose;
    second.dispose = secondDispose;

    const P = definePrototype({
      name: 'x-a11y-projector-retirement',
      setup(def) {
        asAccessible().role('cell');
        return (r) => r.el('div', 'value');
      },
    });
    let wiringRef: Parameters<NonNullable<RuntimeHost<any>['onRuntimeReady']>>[0] | null = null;
    const ctx = createHost();
    ctx.host.onRuntimeReady = (wiring) => {
      wiringRef = wiring;
      wiring.attach('a11y', [[A11Y_PROJECT_CAP, first]]);
    };

    const result = executeWithHost(P, ctx.host);
    expect(target.getAttribute('role')).toBe('cell');
    expect(firstDetach).not.toHaveBeenCalled();
    expect(firstDispose).not.toHaveBeenCalled();

    // A new view epoch rewires the cap with a fresh projector.
    wiringRef!.attach('a11y', [[A11Y_PROJECT_CAP, second]]);
    expect(firstDetach).toHaveBeenCalledOnce();
    expect(firstDispose).toHaveBeenCalledOnce();
    expect(target.getAttribute('role')).toBe('cell');

    await result.session.dispose();
    expect(firstDispose).toHaveBeenCalledOnce();
    expect(secondDispose).toHaveBeenCalledOnce();
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
        asAccessible().relation('controls', { target: borrowedTarget as any });
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
        asAccessible().role('group');
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
        asAccessible().role('group');
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

function createPartRuntimeFixture() {
  const family = createAnatomyFamily('runtime-part-relationship', {
    roles: {
      root: { cardinality: { min: 1, max: 1 } },
      source: { cardinality: { min: 0, max: '*' } },
      target: { cardinality: { min: 0, max: '*' } },
    },
  });
  const parents = new Map<object, object | null>();
  const sessions: ReturnType<typeof createRuntimeSession>[] = [];
  const physical = new Map<object, HTMLElement>();
  const observers = new Set<() => void>();
  const make = (
    role: 'root' | 'source' | 'target',
    parent: object | null,
    initialKey = 'exact+key'
  ) => {
    const token = {};
    const element = document.createElement(role === 'source' ? 'button' : 'div');
    document.body.append(element);
    physical.set(token, element);
    parents.set(token, parent);
    let key!: OwnedStateHandle<string>;
    let ready = false;
    let commits = 0;
    const visibleRelations: Array<string | null> = [];
    const targetListeners = new Set<() => void>();
    const projector = createWebA11yProjector(
      () => (ready ? element : null),
      (listener) => {
        targetListeners.add(listener);
        return () => targetListeners.delete(listener);
      }
    );
    const proto = definePrototype({
      name: `runtime-part-${role}`,
      setup(def) {
        def.anatomy.claim(family, { role });
        if (role === 'root') return;
        key = def.state.string('protocolKey', initialKey);
        const accessible = asAccessible();
        accessible.part(family, { key });
        accessible.role(role === 'source' ? 'button' : 'region');
        accessible.relation(role === 'source' ? 'controls' : 'labelledBy', {
          target: { kind: 'part', family, role: role === 'source' ? 'target' : 'source', key },
        });
      },
    });
    const session = createRuntimeSession(proto, {
      prototypeName: proto.name,
      getRawProps: () => ({}),
      schedule: (task) => task(),
      commit(_children, signal) {
        ready = true;
        signal?.done();
        commits++;
        visibleRelations.push(
          element.getAttribute(role === 'source' ? 'aria-controls' : 'aria-labelledby')
        );
      },
      onRuntimeReady(wiring) {
        wiring.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, token],
          [ANATOMY_PARENT_CAP, (owner: object) => parents.get(owner) ?? null],
          [ANATOMY_GET_PROTO_CAP, () => proto],
          [ANATOMY_ROOT_TARGET_CAP, (owner: object) => physical.get(owner) ?? null],
          [
            ANATOMY_ORDER_OBSERVER_CAP,
            (_target: unknown, notify: () => void) => {
              observers.add(notify);
              return () => observers.delete(notify);
            },
          ],
        ]);
        wiring.attach('a11y', [[A11Y_PROJECT_CAP, projector]]);
      },
    });
    sessions.push(session);
    return {
      token,
      element,
      session,
      targetListeners,
      visibleRelations,
      port: session.caps.getPort<A11yPort>('a11y')!,
      get commits() {
        return commits;
      },
      setKey(value: string) {
        session.invokeInCallbackScope(() => key.set(value));
      },
      setPresent(value: boolean) {
        session.invokeInCallbackScope(() => session.kernel.run.lifecycle.setPresent(value));
      },
      move(nextParent: object) {
        parents.set(token, nextParent);
        for (const notify of [...observers]) notify();
      },
    };
  };
  return {
    family,
    make,
    observers,
    async dispose() {
      for (const session of sessions.reverse()) await session.dispose();
      for (const element of physical.values()) element.remove();
    },
  };
}

describe('runtime contract: same-domain A11y part relationships', () => {
  it('T-A11Y-PART-RELATIONSHIP-0001-CASE-STRUCTURED-CARRIER: derives structural identity and exact keys without host IDs in State', async () => {
    const f = createPartRuntimeFixture();
    try {
      const root = f.make('root', null);
      await root.session.mount();
      const source = f.make('source', root.token);
      await source.session.mount();
      const target = f.make('target', root.token);
      await target.session.mount();
      const snapshot = source.port.getSnapshot();
      expect(snapshot.partRelationships).toEqual([
        {
          family: f.family,
          scope: root.token,
          source: source.port.getObjectRef(),
          sourceRole: 'source',
          targetRole: 'target',
          relation: 'controls',
          key: 'exact+key',
          sourceEpoch: 1,
          targetEpoch: 1,
          target: target.port.getObjectRef(),
        },
      ]);
      expect(snapshot.id).toBeUndefined();
      expect(Object.isFrozen(snapshot.relations.controls)).toBe(true);
      expect(Object.isFrozen(snapshot.partRelationships)).toBe(true);
      expect(Object.isFrozen(snapshot.partRelationships?.[0])).toBe(true);
      expect(source.port.getIR().parts.get(f.family)?.key).toMatchObject({
        get: expect.any(Function),
      });
      expect(source.element.getAttribute('aria-controls')).toBe(target.element.id);
      expect(target.element.getAttribute('aria-labelledby')).toBe(source.element.id);
      expect(target.visibleRelations[0]).toBe(source.element.id);
    } finally {
      await f.dispose();
    }
  });

  it('T-A11Y-PART-RELATIONSHIP-0001-CASE-FAIL-CLOSED-RESOLUTION: handles late, ambiguous, re-keyed and moved members', async () => {
    const f = createPartRuntimeFixture();
    try {
      const root = f.make('root', null),
        other = f.make('root', null);
      await root.session.mount();
      await other.session.mount();
      const source = f.make('source', root.token);
      await source.session.mount();
      expect(source.element.hasAttribute('aria-controls')).toBe(false);
      expect(source.port.getPartDiagnostics()).toEqual([
        { relation: 'controls', code: 'missing-target' },
      ]);
      const target = f.make('target', root.token);
      await target.session.mount();
      const id = target.element.id;
      expect(source.element.getAttribute('aria-controls')).toBe(id);
      const duplicate = f.make('target', root.token);
      expect(source.element.hasAttribute('aria-controls')).toBe(false);
      expect(source.port.getPartDiagnostics()).toEqual([
        { relation: 'controls', code: 'ambiguous-target' },
      ]);
      duplicate.setKey('exact key');
      expect(source.element.getAttribute('aria-controls')).toBe(id);
      target.move(other.token);
      expect(source.element.hasAttribute('aria-controls')).toBe(false);
      source.move(other.token);
      expect(source.element.getAttribute('aria-controls')).toBe(id);
      target.setKey('exact key');
      expect(source.element.hasAttribute('aria-controls')).toBe(false);
      source.setKey('exact key');
      expect(source.element.getAttribute('aria-controls')).toBe(id);
      expect(source.port.getPartDiagnostics()).toEqual([]);
    } finally {
      await f.dispose();
    }
  });

  it('T-A11Y-PART-RELATIONSHIP-0001-CASE-VIEW-EPOCH-LIFECYCLE: withdraws before host intent and restores both endpoint epochs', async () => {
    const f = createPartRuntimeFixture();
    try {
      const root = f.make('root', null);
      await root.session.mount();
      const source = f.make('source', root.token);
      await source.session.mount();
      const target = f.make('target', root.token);
      await target.session.mount();
      const id = target.element.id;
      const seen: Array<string | null> = [];
      const off = target.session.viewIntent.subscribe(() =>
        seen.push(source.element.getAttribute('aria-controls'))
      );
      target.setPresent(false);
      expect(seen).toEqual([null]);
      target.setPresent(true);
      expect(source.element.getAttribute('aria-controls')).toBe(id);
      await target.session.unmount();
      expect(source.element.hasAttribute('aria-controls')).toBe(false);
      await target.session.mount();
      expect(target.element.id).toBe(id);
      expect(target.visibleRelations.at(-1)).toBe(source.element.id);
      expect(source.port.getSnapshot().partRelationships?.[0]?.targetEpoch).toBe(2);
      await source.session.unmount();
      expect(target.element.hasAttribute('aria-labelledby')).toBe(false);
      await source.session.mount();
      expect(source.visibleRelations.at(-1)).toBe(id);
      expect(source.port.getSnapshot().partRelationships?.[0]?.sourceEpoch).toBe(2);
      off();
    } finally {
      await f.dispose();
    }
  });

  it('keeps only the retained identity and current unbound projector during replacement churn', async () => {
    const f = createPartRuntimeFixture();
    try {
      const root = f.make('root', null);
      await root.session.mount();
      const source = f.make('source', root.token);
      await source.session.mount();
      const target = f.make('target', root.token);
      await target.session.mount();
      const id = target.element.id;
      await target.session.unmount();
      const disposals: ReturnType<typeof vi.fn>[] = [];
      for (let attempt = 0; attempt < 5; attempt++) {
        const pending = createWebA11yProjector(() => null);
        const dispose = pending.dispose!;
        const observed = vi.fn(dispose);
        pending.dispose = observed;
        disposals.push(observed);
        target.session.caps.getWiring().attach('a11y', [[A11Y_PROJECT_CAP, pending]]);
      }
      expect(disposals.slice(0, -1).every((dispose) => dispose.mock.calls.length === 1)).toBe(true);
      expect(disposals.at(-1)).not.toHaveBeenCalled();
      const next = createWebA11yProjector(target.element);
      target.session.caps.getWiring().attach('a11y', [[A11Y_PROJECT_CAP, next]]);
      await target.session.mount();
      expect(disposals.every((dispose) => dispose.mock.calls.length === 1)).toBe(true);
      expect(target.element.id).toBe(id);
      expect(source.element.getAttribute('aria-controls')).toBe(id);
    } finally {
      await f.dispose();
    }
  });

  it('T-A11Y-PART-RELATIONSHIP-0001-CASE-TERMINAL-CLEANUP: removes memberships, observers and dependent leases', async () => {
    const f = createPartRuntimeFixture();
    try {
      const root = f.make('root', null);
      await root.session.mount();
      const source = f.make('source', root.token);
      await source.session.mount();
      const target = f.make('target', root.token);
      await target.session.mount();
      const duplicate = f.make('target', root.token);
      await duplicate.session.mount();
      expect(source.element.hasAttribute('aria-controls')).toBe(false);
      await duplicate.session.dispose();
      expect(source.element.getAttribute('aria-controls')).toBe(target.element.id);
      await target.session.dispose();
      expect(source.element.hasAttribute('aria-controls')).toBe(false);
      expect(target.targetListeners.size).toBe(0);
      await source.session.dispose();
      expect(source.targetListeners.size).toBe(0);
      expect(source.port.getPartDiagnostics()).toEqual([]);
      expect(f.observers.size).toBe(0);
    } finally {
      await f.dispose();
    }
  });
});

it('undeclared semantic modules preserve authored A11y relationships across L1 detach', async () => {
  // C-A11Y-0001-DECLARATION-LIFETIME; C-A11Y-PART-RELATIONSHIP-0001-H.
  const ctx = createHost();
  const session = createRuntimeSession(
    definePrototype({
      name: 'non-table-a11y-label',
      setup() {
        asAccessible().relation('labelledBy', { target: 'authored-label' });
      },
    }),
    ctx.host
  );
  const port = session.caps.getPort<A11yPort>('a11y')!;
  try {
    await session.mount();
    expect(port.getSnapshot().relations.labelledBy).toBe('authored-label');
    await session.unmount();
    expect(port.getSnapshot().relations.labelledBy).toBe('authored-label');
    await session.mount();
    expect(ctx.snapshots.at(-1)?.relations.labelledBy).toBe('authored-label');
  } finally {
    await session.dispose();
  }
});

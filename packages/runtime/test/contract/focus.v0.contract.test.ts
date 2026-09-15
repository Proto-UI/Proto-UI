import { describe, expect, it } from 'vitest';
import {
  createFocusScopeKey,
  createFocusRovingKey,
  definePrototype,
  tw,
  type FocusScopeHandle,
  type FocusableHandle,
} from '@proto.ui/core';
import { asFocusable, asFocusEntry, asFocusScope } from '@proto.ui/hooks';
import type { RuntimeHost } from '../../src';
import { createRuntimeSession, executeWithHost } from '../../src';
import { EVENT_GLOBAL_TARGET_CAP, EVENT_ROOT_TARGET_CAP } from '@proto.ui/module-event';
import {
  FOCUS_INSTANCE_TOKEN_CAP,
  FOCUS_PARENT_CAP,
  FOCUS_REQUEST_FOCUS_CAP,
  FOCUS_ROOT_TARGET_CAP,
  FOCUS_SET_FOCUSABLE_CAP,
  FOCUS_TARGET_READY_CAP,
  type FocusPort,
} from '@proto.ui/module-focus';
import type { PropsBaseType } from '@proto.ui/types';

function createMockTarget() {
  type Rec = { type: string; fn: (ev: any) => void; options?: unknown };
  const listeners: Rec[] = [];

  return {
    addEventListener(type: string, fn: (ev: any) => void, options?: unknown) {
      listeners.push({ type, fn, options });
    },
    removeEventListener(type: string, fn: (ev: any) => void, options?: unknown) {
      for (let i = listeners.length - 1; i >= 0; i--) {
        const rec = listeners[i]!;
        if (rec.type !== type || rec.fn !== fn || rec.options !== options) continue;
        listeners.splice(i, 1);
        return;
      }
    },
    dispatchEvent() {
      return true;
    },
    fire(type: string, ev: any = { type }) {
      for (const rec of listeners.filter((item) => item.type === type).slice()) {
        rec.fn(ev);
      }
    },
  } as EventTarget & { fire(type: string, ev?: any): void };
}

const createHost = <P extends PropsBaseType>(
  name: string,
  targets?: { root?: EventTarget | null; global?: EventTarget | null }
) => {
  const rootTarget = targets?.root === undefined ? createMockTarget() : targets.root;
  const globalTarget = targets?.global === undefined ? createMockTarget() : targets.global;

  const host: RuntimeHost<P> = {
    prototypeName: name,
    getRawProps: () => ({}) as any,
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
    onRuntimeReady(wiring) {
      wiring.attach('event', [
        [EVENT_ROOT_TARGET_CAP, () => rootTarget ?? null],
        [EVENT_GLOBAL_TARGET_CAP, () => globalTarget ?? null],
      ]);
      wiring.attach('focus', [
        [FOCUS_ROOT_TARGET_CAP, () => rootTarget as any],
        [FOCUS_REQUEST_FOCUS_CAP, () => undefined],
      ]);
    },
  };

  return { host };
};

class FocusTarget extends EventTarget {
  constructor(
    readonly id: string,
    private readonly order: Map<string, number>
  ) {
    super();
  }

  compareDocumentPosition(other: FocusTarget): number {
    const a = this.order.get(this.id) ?? 0;
    const b = this.order.get(other.id) ?? 0;
    if (a < b) return Node.DOCUMENT_POSITION_FOLLOWING;
    if (a > b) return Node.DOCUMENT_POSITION_PRECEDING;
    return 0;
  }
}

const createTreeHost = (
  name: string,
  target: FocusTarget,
  options: {
    globalTarget: FocusTarget;
    parents: Map<unknown, unknown | null>;
    focused: string[];
    dispatchHostFocus?: boolean;
  }
): RuntimeHost<PropsBaseType> => ({
  prototypeName: name,
  getRawProps: () => ({}),
  commit(_children, signal) {
    signal?.done();
  },
  schedule(task) {
    task();
  },
  onRuntimeReady(wiring) {
    wiring.attach('event', [
      [EVENT_ROOT_TARGET_CAP, () => target],
      [EVENT_GLOBAL_TARGET_CAP, () => options.globalTarget],
    ]);
    wiring.attach('focus', [
      [FOCUS_INSTANCE_TOKEN_CAP, target],
      [FOCUS_PARENT_CAP, (instance: unknown) => options.parents.get(instance) ?? null],
      [FOCUS_ROOT_TARGET_CAP, () => target as any],
      [
        FOCUS_REQUEST_FOCUS_CAP,
        (nextTarget: FocusTarget) => {
          options.focused.push(nextTarget.id);
          if (options.dispatchHostFocus) {
            nextTarget.dispatchEvent(new Event('host:focus'));
          }
        },
      ],
    ]);
  },
});

describe('runtime contract: focus (v0)', () => {
  it('preserves configuration warning order, key labels and metadata merge', () => {
    // Existing configure diagnostics: explicit fields, not patch insertion order.
    const first = createFocusScopeKey({ debugLabel: 'first' });
    const second = createFocusScopeKey({ debugLabel: 'second' });
    const groupFirst = createFocusRovingKey({ debugLabel: 'group-first' });
    const groupSecond = createFocusRovingKey({ debugLabel: 'group-second' });
    const P = definePrototype({
      name: 'x-focus-config-diagnostics',
      setup() {
        const focusable = asFocusable();
        focusable.configure({ scopeKey: first, groupKey: groupFirst, meta: { retained: true } });
        const patch = {
          groupKey: groupSecond,
          scopeKey: second,
          navParticipation: 'none' as const,
          disabled: true,
          autoFocus: true,
          meta: { changed: true },
        };
        focusable.configure(patch);
        focusable.configure(patch); // equal values do not create warnings
        const entry = asFocusEntry();
        entry.configure({ disabled: true, fallback: 'none', strategy: 'descendant-first' });
        const scope = asFocusScope();
        scope.configure({ key: first });
        scope.configure({
          emptyPolicy: 'container',
          restore: 'previous',
          entry: 'manual',
          orientation: 'horizontal',
          navigation: 'arrow',
          loop: true,
          trap: true,
          key: second,
        });
        return (r) => r.el('div', 'ok');
      },
    });
    const result = executeWithHost(P as any, createHost(P.name).host as any);
    const port = result.caps.getPort<FocusPort>('focus')!;
    expect(port.getWarnings()).toEqual([
      '[Focus] focusable.autoFocus overridden: false -> true',
      '[Focus] focusable.disabled overridden: false -> true',
      '[Focus] focusable.navParticipation overridden: auto -> none',
      '[Focus] focusable.scopeKey overridden: first -> second',
      '[Focus] focusable.groupKey overridden: group-first -> group-second',
      '[Focus] entry.strategy overridden: self -> descendant-first',
      '[Focus] entry.fallback overridden: self -> none',
      '[Focus] entry.disabled overridden: false -> true',
      '[Focus] scope.key overridden: first -> second',
      '[Focus] scope.trap overridden: false -> true',
      '[Focus] scope.loop overridden: false -> true',
      '[Focus] scope.navigation overridden: tab -> arrow',
      '[Focus] scope.orientation overridden: vertical -> horizontal',
      '[Focus] scope.entry overridden: first -> manual',
      '[Focus] scope.restore overridden: none -> previous',
      '[Focus] scope.emptyPolicy overridden: none -> container',
    ]);
    expect(port.getFocusableConfig().meta).toEqual({ retained: true, changed: true });
    expect(Object.isFrozen(port.getFocusableConfig())).toBe(true);
    expect(Object.isFrozen(port.getWarnings())).toBe(true);
  });

  it('FOCUS-0100: repeated asFocusable calls reuse one handle and last compatible scopeKey wins', () => {
    const first = createFocusScopeKey({ debugLabel: 'first' });
    const second = createFocusScopeKey({ debugLabel: 'second' });
    let a!: FocusableHandle<PropsBaseType>;
    let b!: FocusableHandle<PropsBaseType>;

    const P = definePrototype({
      name: 'x-focus-0100',
      setup() {
        a = asFocusable<PropsBaseType>();
        a.configure({ scopeKey: first });
        b = asFocusable<PropsBaseType>();
        b.configure({ scopeKey: second });
        return (r) => r.el('div', 'ok');
      },
    });

    const { host } = createHost(P.name);
    const result = executeWithHost(P as any, host as any);
    const port = result.caps.getPort<FocusPort>('focus');

    expect(a).toBe(b);
    expect(port?.getEffectiveScopeKey()).toBe(second);
    expect(port?.getFocusableConfig()).toMatchObject({
      autoFocus: false,
      disabled: false,
      navParticipation: 'auto',
      scopeKey: second,
    });
    expect(port?.getWarnings()).toEqual([expect.stringContaining('focusable.scopeKey overridden')]);
    expect((P as any).__asHooks).toEqual([
      { name: 'asFocusable', order: 0, privileged: true, mode: 'once' },
    ]);
  });

  it('FOCUS-0200: repeated asFocusScope calls reuse one handle and configure through that handle', () => {
    const scopeKey = createFocusScopeKey({ debugLabel: 'scope-2' });
    let scopeA!: FocusScopeHandle<PropsBaseType>;
    let scopeB!: FocusScopeHandle<PropsBaseType>;

    const P = definePrototype({
      name: 'x-focus-0200',
      setup() {
        scopeA = asFocusScope<PropsBaseType>();
        scopeA.configure({ navigation: 'tab' });
        scopeB = asFocusScope<PropsBaseType>();
        scopeB.configure({ key: scopeKey, navigation: 'arrow', loop: true });
        return (r) => r.el('div', 'ok');
      },
    });

    const { host } = createHost(P.name);
    const result = executeWithHost(P as any, host as any);
    const port = result.caps.getPort<FocusPort>('focus');

    expect(scopeA).toBe(scopeB);
    expect(port?.getEffectiveScopeKey()).toBe(scopeKey);
    expect(port?.getScopeConfig()).toMatchObject({
      key: scopeKey,
      navigation: 'arrow',
      loop: true,
      orientation: 'vertical',
      entry: 'first',
      restore: 'none',
      emptyPolicy: 'none',
      trap: false,
    });
    expect(port?.getWarnings()).toEqual(
      expect.arrayContaining([
        expect.stringContaining('scope.navigation overridden'),
        expect.stringContaining('scope.loop overridden'),
      ])
    );
    expect((P as any).__asHooks).toEqual([
      { name: 'asFocusScope', order: 0, privileged: true, mode: 'once' },
    ]);
  });

  it('FOCUS-0300: configure is setup-only on focus handles', () => {
    const key = createFocusScopeKey({ debugLabel: 'late' });
    let focusable!: FocusableHandle<PropsBaseType>;
    let thrown: unknown;

    const P = definePrototype({
      name: 'x-focus-0300',
      setup(def) {
        focusable = asFocusable<PropsBaseType>();
        def.lifecycle.onCreated(() => {
          try {
            focusable.configure({ scopeKey: key });
          } catch (error) {
            thrown = error;
          }
        });
        return (r) => r.el('div', 'ok');
      },
    });

    const { host } = createHost(P.name);
    executeWithHost(P as any, host as any);

    expect(thrown).toBeTruthy();
    expect(String(thrown)).toMatch(/setup/i);
  });

  it('FOCUS-0800: repeated asFocusEntry calls reuse one handle and configure through that handle', () => {
    let entryA!: ReturnType<typeof asFocusEntry<PropsBaseType>>;
    let entryB!: ReturnType<typeof asFocusEntry<PropsBaseType>>;

    const P = definePrototype({
      name: 'x-focus-0800',
      setup() {
        entryA = asFocusEntry<PropsBaseType>();
        entryA.configure({ strategy: 'self' });
        entryB = asFocusEntry<PropsBaseType>();
        entryB.configure({ strategy: 'descendant-first', fallback: 'self', disabled: true });
        return (r) => r.el('div', 'ok');
      },
    });

    const { host } = createHost(P.name);
    const result = executeWithHost(P as any, host as any);
    const port = result.caps.getPort<FocusPort>('focus');

    expect(entryA).toBe(entryB);
    expect(port?.getEntryConfig()).toMatchObject({
      strategy: 'descendant-first',
      fallback: 'self',
      disabled: true,
    });
    expect(port?.getWarnings()).toEqual(
      expect.arrayContaining([expect.stringContaining('entry.strategy overridden')])
    );
    expect((P as any).__asHooks).toEqual([
      { name: 'asFocusEntry', order: 0, privileged: true, mode: 'once' },
    ]);
  });

  it('FOCUS-0810: asFocusEntry configure is setup-only while setDisabled stays runtime-safe', () => {
    let entry!: ReturnType<typeof asFocusEntry<PropsBaseType>>;
    let thrown: unknown;

    const P = definePrototype({
      name: 'x-focus-0810',
      setup(def) {
        entry = asFocusEntry<PropsBaseType>();
        def.lifecycle.onCreated(() => {
          entry.setDisabled(false);
          try {
            entry.configure({ fallback: 'none' });
          } catch (error) {
            thrown = error;
          }
        });
        return (r) => r.el('div', 'ok');
      },
    });

    const { host } = createHost(P.name);
    const result = executeWithHost(P as any, host as any);
    const port = result.caps.getPort<FocusPort>('focus');

    expect(thrown).toBeTruthy();
    expect(String(thrown)).toMatch(/setup/i);
    expect(port?.getEntryConfig().disabled).toBe(false);
  });

  it('FOCUS-0400: focus commands update minimal facts snapshot', () => {
    let focusable!: FocusableHandle<PropsBaseType>;

    const P = definePrototype({
      name: 'x-focus-0400',
      setup(def) {
        focusable = asFocusable<PropsBaseType>();
        focusable.configure({ disabled: false });
        def.lifecycle.onCreated(() => {
          focusable.focus({ reason: 'keyboard' });
        });
        return (r) => r.el('div', 'ok');
      },
    });

    const { host } = createHost(P.name);
    const result = executeWithHost(P as any, host as any);
    const port = result.caps.getPort<FocusPort>('focus');

    expect(port?.getFacts()).toEqual({
      focused: true,
      focusVisible: true,
      focusable: true,
      active: true,
      hasFocused: true,
      rovingSelected: false,
      rovingActive: false,
    });
  });

  it('FOCUS-0410: pre-commit focus retains only the latest request until its host target exists', () => {
    let focusable!: FocusableHandle<PropsBaseType>;
    let target: FocusTarget | null = null;
    const order = new Map([['target', 0]]);
    const resolvedTarget = new FocusTarget('target', order);
    const globalTarget = new FocusTarget('global', order);
    const instanceToken = {};
    const focused: Array<{ id: string; reason?: string }> = [];
    let focusedBeforeCommit = true;

    const P = definePrototype({
      name: 'x-focus-0410',
      setup(def) {
        focusable = asFocusable<PropsBaseType>();
        def.lifecycle.onCreated(() => {
          focusable.focus({ reason: 'keyboard' });
          focusable.focus({ reason: 'pointer' });
        });
        return (r) => r.el('div', 'ok');
      },
    });

    const host: RuntimeHost<PropsBaseType> = {
      prototypeName: P.name,
      getRawProps: () => ({}),
      commit(_children, signal) {
        focusedBeforeCommit = focusable.focused.get();
        target = resolvedTarget;
        signal?.done();
      },
      schedule(task) {
        task();
      },
      onRuntimeReady(wiring) {
        wiring.attach('event', [
          [EVENT_ROOT_TARGET_CAP, () => globalTarget],
          [EVENT_GLOBAL_TARGET_CAP, () => globalTarget],
        ]);
        wiring.attach('focus', [
          [FOCUS_INSTANCE_TOKEN_CAP, instanceToken],
          [FOCUS_PARENT_CAP, () => null],
          [FOCUS_ROOT_TARGET_CAP, () => target as any],
          [
            FOCUS_REQUEST_FOCUS_CAP,
            (nextTarget: FocusTarget, options?: { reason?: string }) => {
              focused.push({ id: nextTarget.id, reason: options?.reason });
            },
          ],
        ]);
      },
    };

    const result = executeWithHost(P as any, host as any);
    const port = result.caps.getPort<FocusPort>('focus');

    expect(focusedBeforeCommit).toBe(false);
    expect(focused).toEqual([{ id: 'target', reason: 'pointer' }]);
    expect(port?.getFacts()).toMatchObject({
      focused: true,
      focusVisible: false,
      active: true,
    });
  });

  it('FOCUS-0415: pre-commit focusSelf waits for mounted host readiness without fabricating facts', () => {
    let focusable!: FocusableHandle<PropsBaseType>;
    let target: FocusTarget | null = null;
    const order = new Map([['target', 0]]);
    const resolvedTarget = new FocusTarget('target', order);
    const globalTarget = new FocusTarget('global', order);
    const focused: Array<{ id: string; reason?: string }> = [];

    const P = definePrototype({
      name: 'x-focus-0415',
      setup(def) {
        focusable = asFocusable<PropsBaseType>();
        def.lifecycle.onCreated(() => {
          focusable.focusSelf({ reason: 'keyboard' });
        });
        return (r) => r.el('div', 'ok');
      },
    });

    const host: RuntimeHost<PropsBaseType> = {
      prototypeName: P.name,
      getRawProps: () => ({}),
      commit(_children, signal) {
        target = resolvedTarget;
        signal?.done();
      },
      schedule(task) {
        task();
      },
      onRuntimeReady(wiring) {
        wiring.attach('event', [
          [EVENT_ROOT_TARGET_CAP, () => target],
          [EVENT_GLOBAL_TARGET_CAP, () => globalTarget],
        ]);
        wiring.attach('focus', [
          [FOCUS_INSTANCE_TOKEN_CAP, {}],
          [FOCUS_PARENT_CAP, () => null],
          [FOCUS_ROOT_TARGET_CAP, () => target as any],
          [
            FOCUS_REQUEST_FOCUS_CAP,
            (nextTarget: FocusTarget, options?: { reason?: string }) => {
              focused.push({ id: nextTarget.id, reason: options?.reason });
            },
          ],
        ]);
      },
    };

    const result = executeWithHost(P as any, host as any);
    const port = result.caps.getPort<FocusPort>('focus');

    expect(focused).toEqual([{ id: 'target', reason: 'keyboard' }]);
    expect(port?.getFacts()).toMatchObject({ focused: false, focusVisible: false, active: false });
  });

  it('FOCUS-0417: host target-readiness fulfills pending focus and reprojects an established owner', () => {
    let focusable!: FocusableHandle<PropsBaseType>;
    let target: FocusTarget | null = null;
    let ready = false;
    let acceptsFocus = false;
    let targetReadyListener: (() => void) | undefined;
    const order = new Map([['target', 0]]);
    const resolvedTarget = new FocusTarget('target', order);
    const globalTarget = new FocusTarget('global', order);
    const focused: Array<{ id: string; reason?: string }> = [];

    const P = definePrototype({
      name: 'x-focus-0417',
      setup(def) {
        focusable = asFocusable<PropsBaseType>();
        def.lifecycle.onCreated(() => {
          focusable.focus({ reason: 'keyboard' });
        });
        return (r) => r.el('div', 'ok');
      },
    });

    const host: RuntimeHost<PropsBaseType> = {
      prototypeName: P.name,
      getRawProps: () => ({}),
      commit(_children, signal) {
        target = resolvedTarget;
        signal?.done();
      },
      schedule(task) {
        task();
      },
      onRuntimeReady(wiring) {
        wiring.attach('event', [
          [EVENT_ROOT_TARGET_CAP, () => target],
          [EVENT_GLOBAL_TARGET_CAP, () => globalTarget],
        ]);
        wiring.attach('focus', [
          [FOCUS_INSTANCE_TOKEN_CAP, {}],
          [FOCUS_PARENT_CAP, () => null],
          [FOCUS_ROOT_TARGET_CAP, () => (ready ? (target as any) : null)],
          [
            FOCUS_TARGET_READY_CAP,
            (listener: () => void) => {
              targetReadyListener = listener;
              return () => {
                if (targetReadyListener === listener) targetReadyListener = undefined;
              };
            },
          ],
          [
            FOCUS_REQUEST_FOCUS_CAP,
            (nextTarget: FocusTarget, options?: { reason?: string }) => {
              if (!acceptsFocus) return false;
              focused.push({ id: nextTarget.id, reason: options?.reason });
              return true;
            },
          ],
        ]);
      },
    };

    const result = executeWithHost(P as any, host as any);
    const port = result.caps.getPort<FocusPort>('focus');

    expect(focused).toEqual([]);
    expect(port?.getFacts()).toMatchObject({ focused: false, focusVisible: false, active: false });

    ready = true;
    targetReadyListener?.();

    expect(focused).toEqual([]);
    expect(port?.getFacts()).toMatchObject({ focused: false, focusVisible: false, active: false });

    acceptsFocus = true;
    targetReadyListener?.();

    expect(focused).toEqual([{ id: 'target', reason: 'keyboard' }]);
    expect(port?.getFacts()).toMatchObject({ focused: true, focusVisible: true, active: true });

    targetReadyListener?.();
    expect(focused).toEqual([
      { id: 'target', reason: 'keyboard' },
      { id: 'target', reason: 'keyboard' },
    ]);
    expect(port?.getFacts()).toMatchObject({ focused: true, focusVisible: true, active: true });
  });

  it('FOCUS-0418: retained view detachment preserves pending focus for the replacement target', async () => {
    let focusable!: FocusableHandle<PropsBaseType>;
    let target: FocusTarget | null = null;
    const order = new Map([['target', 0]]);
    const resolvedTarget = new FocusTarget('target', order);
    const globalTarget = new FocusTarget('global', order);
    const focused: Array<{ id: string; reason?: string }> = [];
    const instanceToken = {};

    const P = definePrototype({
      name: 'x-focus-0418',
      setup() {
        focusable = asFocusable<PropsBaseType>();
        return (r) => r.el('div', 'ok');
      },
    });

    const host: RuntimeHost<PropsBaseType> = {
      prototypeName: P.name,
      getRawProps: () => ({}),
      commit(_children, signal) {
        signal?.done();
      },
      schedule(task) {
        task();
      },
      onRuntimeReady(wiring) {
        wiring.attach('event', [
          [EVENT_ROOT_TARGET_CAP, () => globalTarget],
          [EVENT_GLOBAL_TARGET_CAP, () => globalTarget],
        ]);
        wiring.attach('focus', [
          [FOCUS_INSTANCE_TOKEN_CAP, instanceToken],
          [FOCUS_PARENT_CAP, () => null],
          [FOCUS_ROOT_TARGET_CAP, () => target as any],
          [
            FOCUS_REQUEST_FOCUS_CAP,
            (nextTarget: FocusTarget, options?: { reason?: string }) => {
              focused.push({ id: nextTarget.id, reason: options?.reason });
              return true;
            },
          ],
        ]);
      },
    };

    const session = createRuntimeSession(P as any, host as any);
    await session.mount();
    focusable.focus({ reason: 'keyboard' });
    expect(focused).toEqual([]);

    await session.unmount();
    target = resolvedTarget;
    await session.mount();

    expect(focused).toEqual([{ id: 'target', reason: 'keyboard' }]);
    await session.dispose();
  });

  it('FOCUS-0420: blur cancels a pre-commit pending focus request', () => {
    let focusable!: FocusableHandle<PropsBaseType>;
    let target: FocusTarget | null = null;
    const order = new Map([['target', 0]]);
    const resolvedTarget = new FocusTarget('target', order);
    const globalTarget = new FocusTarget('global', order);
    const focused: string[] = [];

    const P = definePrototype({
      name: 'x-focus-0420',
      setup(def) {
        focusable = asFocusable<PropsBaseType>();
        def.lifecycle.onCreated(() => {
          focusable.focus({ reason: 'keyboard' });
          focusable.blur();
        });
        return (r) => r.el('div', 'ok');
      },
    });

    const host: RuntimeHost<PropsBaseType> = {
      prototypeName: P.name,
      getRawProps: () => ({}),
      commit(_children, signal) {
        target = resolvedTarget;
        signal?.done();
      },
      schedule(task) {
        task();
      },
      onRuntimeReady(wiring) {
        wiring.attach('event', [
          [EVENT_ROOT_TARGET_CAP, () => target],
          [EVENT_GLOBAL_TARGET_CAP, () => globalTarget],
        ]);
        wiring.attach('focus', [
          [FOCUS_INSTANCE_TOKEN_CAP, {}],
          [FOCUS_PARENT_CAP, () => null],
          [FOCUS_ROOT_TARGET_CAP, () => target as any],
          [FOCUS_REQUEST_FOCUS_CAP, (nextTarget: FocusTarget) => focused.push(nextTarget.id)],
        ]);
      },
    };

    const result = executeWithHost(P as any, host as any);
    const port = result.caps.getPort<FocusPort>('focus');

    expect(focused).toEqual([]);
    expect(port?.getFacts()).toMatchObject({ focused: false, focusVisible: false, active: false });
  });

  it('FOCUS-0450: host focus events update focus-owned observed facts', () => {
    let focusable!: FocusableHandle<PropsBaseType>;
    const root = createMockTarget();
    const global = createMockTarget();

    const P = definePrototype({
      name: 'x-focus-0450',
      setup() {
        focusable = asFocusable<PropsBaseType>();
        return (r) => r.el('div', 'ok');
      },
    });

    const { host } = createHost(P.name, { root, global });
    const result = executeWithHost(P as any, host as any);
    const port = result.caps.getPort<FocusPort>('focus');

    expect(focusable.focused.get()).toBe(false);
    expect((focusable.focused as any).__stateId).toBeTruthy();
    expect((focusable.focused as any).__stateSemantic).toBe('@focus/focused');
    expect((focusable.focusVisible as any).__stateSemantic).toBe('@focus/focusVisible');
    global.fire('key.down', { type: 'key.down' });
    root.fire('host:focus', { type: 'host:focus' });
    expect(focusable.focused.get()).toBe(true);
    expect(focusable.focusVisible.get()).toBe(true);
    expect(port?.getFacts().active).toBe(true);

    root.fire('pointer.down', { type: 'pointer.down' });
    expect(focusable.focusVisible.get()).toBe(false);

    root.fire('host:blur', { type: 'host:blur' });
    expect(focusable.focused.get()).toBe(false);
    expect(port?.getFacts().active).toBe(false);
  });

  it('FOCUS-0460: focus fact handles are rule-consumable state handles', () => {
    let focusable!: FocusableHandle<PropsBaseType>;
    const root = createMockTarget();
    const global = createMockTarget();

    const P = definePrototype({
      name: 'x-focus-0460',
      setup(def) {
        focusable = asFocusable<PropsBaseType>();
        def.rule({
          when: (w) => w.state(focusable.focusVisible).eq(true),
          intent: (i) => i.feedback.style.use(tw('ring-2')),
        });
        return (r) => r.el('div', 'ok');
      },
    });

    const { host } = createHost(P.name, { root, global });
    const result = executeWithHost(P as any, host as any);

    expect(result.controller.getRuleStyleTokens()).not.toContain('ring-2');

    global.fire('key.down', { type: 'key.down' });
    root.fire('host:focus', { type: 'host:focus' });
    expect(result.controller.getRuleStyleTokens()).toContain('ring-2');
  });

  it('FOCUS-0470: host focus clears stale focus facts from the previous owner', () => {
    let first!: FocusableHandle<PropsBaseType>;
    let second!: FocusableHandle<PropsBaseType>;

    const First = definePrototype({
      name: 'x-focus-0470-first',
      setup() {
        first = asFocusable<PropsBaseType>();
        return (r) => r.el('button', 'first');
      },
    });
    const Second = definePrototype({
      name: 'x-focus-0470-second',
      setup() {
        second = asFocusable<PropsBaseType>();
        return (r) => r.el('button', 'second');
      },
    });

    const order = new Map<string, number>([
      ['first', 0],
      ['second', 1],
    ]);
    const globalTarget = new FocusTarget('global', new Map());
    const targets = {
      first: new FocusTarget('first', order),
      second: new FocusTarget('second', order),
    };
    const parents = new Map<unknown, unknown | null>([
      [targets.first, null],
      [targets.second, null],
    ]);
    const focused: string[] = [];
    const hostOptions = { globalTarget, parents, focused };

    executeWithHost(First as any, createTreeHost(First.name, targets.first, hostOptions) as any);
    executeWithHost(Second as any, createTreeHost(Second.name, targets.second, hostOptions) as any);

    globalTarget.dispatchEvent(new Event('key.down'));
    targets.first.dispatchEvent(new Event('host:focus'));

    expect(first.focused.get()).toBe(true);
    expect(first.focusVisible.get()).toBe(true);

    targets.second.dispatchEvent(new Event('host:focus'));

    expect(second.focused.get()).toBe(true);
    expect(second.focusVisible.get()).toBe(true);
    expect(first.focused.get()).toBe(false);
    expect(first.focusVisible.get()).toBe(false);
  });

  it('FOCUS-0500: disabled focusable rejects focus requests', () => {
    let focusable!: FocusableHandle<PropsBaseType>;

    const P = definePrototype({
      name: 'x-focus-0500',
      setup(def) {
        focusable = asFocusable<PropsBaseType>();
        focusable.configure({ disabled: true });
        def.lifecycle.onCreated(() => {
          focusable.focus({ reason: 'keyboard' });
        });
        return (r) => r.el('div', 'ok');
      },
    });

    const { host } = createHost(P.name);
    const result = executeWithHost(P as any, host as any);
    const port = result.caps.getPort<FocusPort>('focus');

    expect(port?.getFacts()).toEqual({
      focused: false,
      focusVisible: false,
      focusable: false,
      active: false,
      hasFocused: false,
      rovingSelected: false,
      rovingActive: false,
    });
  });

  it('FOCUS-0520: navParticipation=none leaves explicit focus requests enabled', () => {
    let focusable!: FocusableHandle<PropsBaseType>;
    const target = new FocusTarget('target', new Map([['target', 0]]));
    const focusableUpdates: boolean[] = [];
    const focused: string[] = [];

    const P = definePrototype({
      name: 'x-focus-0520',
      setup(def) {
        focusable = asFocusable<PropsBaseType>();
        def.lifecycle.onCreated(() => {
          focusable.setNavParticipation('none');
          focusable.focus({ reason: 'keyboard' });
        });
        return (r) => r.el('button', 'ok');
      },
    });

    const host: RuntimeHost<PropsBaseType> = {
      prototypeName: P.name,
      getRawProps: () => ({}),
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
        wiring.attach('focus', [
          [FOCUS_ROOT_TARGET_CAP, () => target as any],
          [
            FOCUS_SET_FOCUSABLE_CAP,
            (_target: HTMLElement, enabled: boolean) => {
              focusableUpdates.push(enabled);
            },
          ],
          [
            FOCUS_REQUEST_FOCUS_CAP,
            (nextTarget: FocusTarget) => {
              focused.push(nextTarget.id);
            },
          ],
        ]);
      },
    };

    const result = executeWithHost(P as any, host as any);
    const port = result.caps.getPort<FocusPort>('focus');

    expect(focusableUpdates).toContain(false);
    expect(focused).toEqual(['target']);
    expect(port?.getFacts()).toMatchObject({
      focused: true,
      focusVisible: true,
      focusable: true,
    });
    expect(port?.getFocusableConfig().navParticipation).toBe('none');
  });

  it('FOCUS-0600: autoFocus requests focus after first render commit', () => {
    const P = definePrototype({
      name: 'x-focus-0600',
      setup() {
        const focusable = asFocusable<PropsBaseType>();
        focusable.configure({ autoFocus: true });
        return (r) => r.el('div', 'ok');
      },
    });

    const { host } = createHost(P.name);
    const result = executeWithHost(P as any, host as any);
    const port = result.caps.getPort<FocusPort>('focus');

    expect(port?.getFacts()).toEqual({
      focused: true,
      focusVisible: false,
      focusable: true,
      active: true,
      hasFocused: true,
      rovingSelected: false,
      rovingActive: false,
    });
  });

  it('FOCUS-0700: scope emptyPolicy=container activates scope without node focus', () => {
    let scope!: FocusScopeHandle<PropsBaseType>;

    const P = definePrototype({
      name: 'x-focus-0700',
      setup(def) {
        scope = asFocusScope<PropsBaseType>();
        scope.configure({ emptyPolicy: 'container' });
        def.lifecycle.onCreated(() => {
          scope.focusFirst();
        });
        return (r) => r.el('div', 'ok');
      },
    });

    const { host } = createHost(P.name);
    const result = executeWithHost(P as any, host as any);
    const port = result.caps.getPort<FocusPort>('focus');

    expect(port?.getFacts()).toEqual({
      focused: false,
      focusVisible: false,
      focusable: false,
      active: true,
      hasFocused: false,
      rovingSelected: false,
      rovingActive: false,
    });
  });

  it('FOCUS-0800: activating a scope requests focus for its first logical focusable child', () => {
    let scope!: FocusScopeHandle<PropsBaseType>;

    const Scope = definePrototype({
      name: 'x-focus-0800-scope',
      setup() {
        scope = asFocusScope<PropsBaseType>();
        return (r) => r.el('div', 'scope');
      },
    });
    const Item = definePrototype({
      name: 'x-focus-0800-item',
      setup() {
        asFocusable<PropsBaseType>();
        return (r) => r.el('button', 'item');
      },
    });

    const order = new Map<string, number>([
      ['scope', 0],
      ['item', 1],
    ]);
    const globalTarget = new FocusTarget('global', new Map());
    const targets = {
      scope: new FocusTarget('scope', order),
      item: new FocusTarget('item', order),
    };
    const parents = new Map<unknown, unknown | null>([
      [targets.scope, null],
      [targets.item, targets.scope],
    ]);
    const focused: string[] = [];
    const hostOptions = { globalTarget, parents, focused };

    const scopeExec = executeWithHost(
      Scope as any,
      createTreeHost(Scope.name, targets.scope, hostOptions) as any
    );
    executeWithHost(Item as any, createTreeHost(Item.name, targets.item, hostOptions) as any);

    scope.activate();

    expect(focused).toEqual(['item']);
    expect(scope.isActive()).toBe(true);
    expect(scopeExec.caps.getPort<FocusPort>('focus')?.getFacts().active).toBe(true);

    scope.deactivate();
  });

  it('FOCUS-0805: trapped Tab marks the synchronously focused target as keyboard-visible', () => {
    let scope!: FocusScopeHandle<PropsBaseType>;

    const Scope = definePrototype({
      name: 'x-focus-0805-scope',
      setup() {
        scope = asFocusScope<PropsBaseType>();
        scope.configure({ trap: true, loop: true });
        return (r) => r.el('div', 'scope');
      },
    });
    const Item = definePrototype({
      name: 'x-focus-0805-item',
      setup() {
        asFocusable<PropsBaseType>();
        return (r) => r.el('button', 'item');
      },
    });

    const order = new Map<string, number>([
      ['scope', 0],
      ['first', 1],
      ['second', 2],
    ]);
    const globalTarget = new FocusTarget('global', new Map());
    const targets = {
      scope: new FocusTarget('scope', order),
      first: new FocusTarget('first', order),
      second: new FocusTarget('second', order),
    };
    const parents = new Map<unknown, unknown | null>([
      [targets.scope, null],
      [targets.first, targets.scope],
      [targets.second, targets.scope],
    ]);
    const focused: string[] = [];
    const hostOptions = { globalTarget, parents, focused, dispatchHostFocus: true };

    executeWithHost(Scope as any, createTreeHost(Scope.name, targets.scope, hostOptions) as any);
    executeWithHost(
      Item as any,
      createTreeHost(`${Item.name}-first`, targets.first, hostOptions) as any
    );
    const secondExec = executeWithHost(
      Item as any,
      createTreeHost(`${Item.name}-second`, targets.second, hostOptions) as any
    );

    scope.activate();
    globalTarget.dispatchEvent(new CustomEvent('key.down', { detail: { key: 'Tab' } }));

    expect(focused).toEqual(['first', 'second']);
    expect(secondExec.caps.getPort<FocusPort>('focus')?.getFacts()).toMatchObject({
      focused: true,
      focusVisible: true,
    });
    scope.deactivate();
  });

  it('FOCUS-0810: deactivating a scope restores focus to the previous owner', () => {
    let outside!: FocusableHandle<PropsBaseType>;
    let scope!: FocusScopeHandle<PropsBaseType>;

    const Outside = definePrototype({
      name: 'x-focus-0810-outside',
      setup() {
        outside = asFocusable<PropsBaseType>();
        return (r) => r.el('button', 'outside');
      },
    });
    const Scope = definePrototype({
      name: 'x-focus-0810-scope',
      setup() {
        scope = asFocusScope<PropsBaseType>();
        return (r) => r.el('div', 'scope');
      },
    });
    const Item = definePrototype({
      name: 'x-focus-0810-item',
      setup() {
        asFocusable<PropsBaseType>();
        return (r) => r.el('button', 'item');
      },
    });

    const order = new Map<string, number>([
      ['outside', 0],
      ['scope', 1],
      ['item', 2],
    ]);
    const globalTarget = new FocusTarget('global', new Map());
    const targets = {
      outside: new FocusTarget('outside', order),
      scope: new FocusTarget('scope', order),
      item: new FocusTarget('item', order),
    };
    const parents = new Map<unknown, unknown | null>([
      [targets.outside, null],
      [targets.scope, null],
      [targets.item, targets.scope],
    ]);
    const focused: string[] = [];
    const hostOptions = { globalTarget, parents, focused };

    executeWithHost(
      Outside as any,
      createTreeHost(Outside.name, targets.outside, hostOptions) as any
    );
    executeWithHost(Scope as any, createTreeHost(Scope.name, targets.scope, hostOptions) as any);
    executeWithHost(Item as any, createTreeHost(Item.name, targets.item, hostOptions) as any);

    outside.focus({ reason: 'programmatic' });
    scope.activate();
    scope.deactivate();

    expect(focused).toEqual(['outside', 'item', 'outside']);
    expect(scope.isActive()).toBe(false);
  });

  it('FOCUS-0820: active scope ignores outside focus requests and records a warning', () => {
    let outside!: FocusableHandle<PropsBaseType>;
    let scope!: FocusScopeHandle<PropsBaseType>;

    const Outside = definePrototype({
      name: 'x-focus-0820-outside',
      setup() {
        outside = asFocusable<PropsBaseType>();
        return (r) => r.el('button', 'outside');
      },
    });
    const Scope = definePrototype({
      name: 'x-focus-0820-scope',
      setup() {
        scope = asFocusScope<PropsBaseType>();
        return (r) => r.el('div', 'scope');
      },
    });
    const Item = definePrototype({
      name: 'x-focus-0820-item',
      setup() {
        asFocusable<PropsBaseType>();
        return (r) => r.el('button', 'item');
      },
    });

    const order = new Map<string, number>([
      ['outside', 0],
      ['scope', 1],
      ['item', 2],
    ]);
    const globalTarget = new FocusTarget('global', new Map());
    const targets = {
      outside: new FocusTarget('outside', order),
      scope: new FocusTarget('scope', order),
      item: new FocusTarget('item', order),
    };
    const parents = new Map<unknown, unknown | null>([
      [targets.outside, null],
      [targets.scope, null],
      [targets.item, targets.scope],
    ]);
    const focused: string[] = [];
    const hostOptions = { globalTarget, parents, focused };

    const outsideExec = executeWithHost(
      Outside as any,
      createTreeHost(Outside.name, targets.outside, hostOptions) as any
    );
    executeWithHost(Scope as any, createTreeHost(Scope.name, targets.scope, hostOptions) as any);
    executeWithHost(Item as any, createTreeHost(Item.name, targets.item, hostOptions) as any);

    outside.focus({ reason: 'programmatic' });
    scope.activate();
    outside.focus({ reason: 'programmatic' });

    expect(focused).toEqual(['outside', 'item']);
    expect(outsideExec.caps.getPort<FocusPort>('focus')?.getWarnings()).toEqual([
      expect.stringContaining('requestFocus ignored'),
    ]);

    scope.deactivate();
  });

  it('FOCUS-0830: scope without focusable child remains inactive unless container activation is allowed', () => {
    let scope!: FocusScopeHandle<PropsBaseType>;

    const Scope = definePrototype({
      name: 'x-focus-0830-scope',
      setup() {
        scope = asFocusScope<PropsBaseType>();
        return (r) => r.el('div', 'scope');
      },
    });

    const order = new Map<string, number>([['scope', 0]]);
    const globalTarget = new FocusTarget('global', new Map());
    const target = new FocusTarget('scope', order);
    const parents = new Map<unknown, unknown | null>([[target, null]]);
    const focused: string[] = [];

    executeWithHost(
      Scope as any,
      createTreeHost(Scope.name, target, { globalTarget, parents, focused }) as any
    );

    scope.activate();

    expect(focused).toEqual([]);
    expect(scope.isActive()).toBe(false);
  });
});

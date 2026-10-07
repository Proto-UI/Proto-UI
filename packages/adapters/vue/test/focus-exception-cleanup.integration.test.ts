import { expect, it, vi } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { asFocusable } from '@proto.ui/hooks';
import { asButton } from '../../../prototypes/base/src/button';
import * as tree from '../src/platform/instance-tree';
import { createVueAdapter } from '../src';
import { VueAny, flushVue } from './utils/vue';

// Actual framework teardown with controlled host focus failure; no gate or fact mocking.
const micro = async () => {
  for (let i = 0; i < 18; i++) await Promise.resolve();
};
const runtime = 'vue';
for (const mode of ['retained-hide', 'terminal-remove'] as const)
  it(`${runtime} ${mode} completes old view cleanup when pending replay throws`, async () => {
    let run: any;
    const observations: any[] = [];
    const outerProto = definePrototype({
      name: `review-${runtime}-outer`,
      setup(def) {
        asButton();
        const f = asFocusable();
        def.expose.method('request', () => f.focus());
        return (r) => r.slot();
      },
    });
    const innerProto = definePrototype({
      name: `review-${runtime}-inner`,
      setup(def) {
        asButton();
        def.lifecycle.onCreated((r) => (run = r));
        def.expose.method('hide', () => run.lifecycle.setPresent(false));
        def.lifecycle.onUnmounted(() =>
          observations.push({ phase: 'onUnmounted', connected: old.isConnected })
        );
        return (r) => r.el('span', 'Owned view child');
      },
    });
    let outer: any,
      inner: any,
      old: HTMLElement,
      cleanup: () => Promise<void>,
      act: (fn: () => void) => Promise<void>,
      remove: () => void;
    const host = document.createElement('div');
    document.body.append(host);

    const adapt = createVueAdapter(VueAny),
      Outer = adapt(outerProto),
      Inner = adapt(innerProto),
      oref = VueAny.ref(null),
      iref = VueAny.ref(null),
      show = VueAny.ref(true);
    const app = VueAny.createApp({
      render: () =>
        VueAny.h(Outer, { ref: oref }, () => (show.value ? VueAny.h(Inner, { ref: iref }) : null)),
    });
    app.config.errorHandler = (e: any) =>
      observations.push({ phase: 'vue-error', error: e.message });
    app.mount(host);
    await flushVue();
    await flushVue();
    outer = oref.value;
    inner = iref.value;
    old = host.querySelectorAll<HTMLElement>('[data-pui-root]')[1];
    remove = () => (show.value = false);
    act = async (fn) => {
      fn();
      await flushVue();
      await micro();
    };
    cleanup = async () => {
      app.unmount();
      host.remove();
      await micro();
    };

    const token = tree.getLogicalEventRouteSurfaceForTarget(old)!;
    const oldEventTarget = (tree.getLogicalEventTarget(token) as any).getTarget();
    const qm = globalThis.queueMicrotask.bind(globalThis);
    const qs = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((cb) =>
      qm(() => {
        try {
          cb();
        } catch (e) {
          observations.push({ phase: 'queued-error', error: (e as Error).message });
        }
      })
    );
    let throwing = false;
    const nativeFocus = HTMLElement.prototype.focus;
    const spy = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (
      this: HTMLElement,
      options?: FocusOptions
    ) {
      observations.push({
        phase: 'focus',
        target: this === old ? 'old' : this === host.firstElementChild ? 'outer' : 'other',
        connected: this.isConnected,
        throwing,
      });
      if (this === old) {
        if (throwing) throw new Error('old-target focus failure');
        return;
      }
      nativeFocus.call(this, options);
    });
    try {
      await act(() => outer.getExposes().request());
      throwing = true;
      try {
        await act(() => (mode === 'terminal-remove' ? remove() : inner.getExposes().hide()));
      } catch (e) {
        observations.push({ phase: 'caught', error: (e as Error).message });
      }
      await micro();
      expect(observations.find((value) => value.phase === 'onUnmounted')?.connected).toBe(
        mode === 'terminal-remove'
      );
      expect(tree.getLogicalRoot(token)).not.toBe(old);
      expect((tree.getLogicalEventTarget(token) as any).getTarget()).not.toBe(oldEventTarget);
      expect(tree.isFocusTargetOwnerReady(old)).toBe(false);
      expect(
        observations.filter(
          (value) => value.phase === 'focus' && value.target === 'old' && value.throwing
        )
      ).toEqual([]);
      expect(
        observations.some(
          (value) => value.phase === 'focus' && value.target === 'outer' && value.throwing
        )
      ).toBe(true);
      outer.getExposes().request();
      expect(document.activeElement).toBe(host.firstElementChild);
    } finally {
      spy.mockRestore();
      try {
        await cleanup();
      } catch {}
      qs.mockRestore();
    }
  });

it('notifies every source-release observer while preserving the first error', () => {
  const proto = definePrototype({ name: 'release-fanout', setup() {} }),
    token = tree.createLogicalInstance(proto);
  const listeners = new Set<() => void>();
  const release = tree.registerNativeFocusReadiness(token, {
    isReady: () => true,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
  const firstError = new Error('first source observer'),
    second = vi.fn();
  const firstOff = tree.subscribeFocusSurfaceReady(
    token,
    () => {
      throw firstError;
    },
    true
  );
  const secondOff = tree.subscribeFocusSurfaceReady(token, second, true);
  try {
    expect(() => release()).toThrow(firstError);
    expect(second).toHaveBeenCalledOnce();
    expect(listeners.size).toBe(0);
  } finally {
    firstOff();
    secondOff();
    release();
  }
});

for (const mode of ['remount-register'] as const)
  it(`${runtime} ${mode} completes old view cleanup when pending replay throws`, async () => {
    let run: any;
    const observations: any[] = [];
    const outerProto = definePrototype({
      name: `review-${runtime}-outer`,
      setup(def) {
        asButton();
        const f = asFocusable();
        def.expose.method('request', () => f.focus());
        return (r) => r.slot();
      },
    });
    const innerProto = definePrototype({
      name: `review-${runtime}-inner`,
      setup(def) {
        asButton();
        def.lifecycle.onCreated((r) => (run = r));
        def.expose.method('hide', () => run.lifecycle.setPresent(false));
        def.expose.method('show', () => run.lifecycle.setPresent(true));
        def.lifecycle.onUnmounted(() =>
          observations.push({ phase: 'onUnmounted', connected: old.isConnected })
        );
        return (r) => r.el('span', 'Owned view child');
      },
    });
    let outer: any,
      inner: any,
      old: HTMLElement,
      cleanup: () => Promise<void>,
      act: (fn: () => void) => Promise<void>,
      remove: () => void;
    const host = document.createElement('div');
    document.body.append(host);

    const adapt = createVueAdapter(VueAny),
      Outer = adapt(outerProto),
      Inner = adapt(innerProto),
      oref = VueAny.ref(null),
      iref = VueAny.ref(null),
      show = VueAny.ref(true);
    const app = VueAny.createApp({
      render: () =>
        VueAny.h(Outer, { ref: oref }, () => (show.value ? VueAny.h(Inner, { ref: iref }) : null)),
    });
    app.config.errorHandler = (e: any) =>
      observations.push({ phase: 'vue-error', error: e.message, stack: e.stack });
    app.mount(host);
    await flushVue();
    await flushVue();
    outer = oref.value;
    inner = iref.value;
    old = host.querySelectorAll<HTMLElement>('[data-pui-root]')[1];
    remove = () => (show.value = false);
    act = async (fn) => {
      fn();
      await flushVue();
      await micro();
    };
    cleanup = async () => {
      app.unmount();
      host.remove();
      await micro();
    };

    const token = tree.getLogicalEventRouteSurfaceForTarget(old)!;
    const qm = globalThis.queueMicrotask.bind(globalThis);
    const qs = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((cb) =>
      qm(() => {
        try {
          cb();
        } catch (e) {
          observations.push({
            phase: 'queued-error',
            error: (e as Error).message,
            stack: (e as Error).stack,
          });
        }
      })
    );
    const outerRoot = host.firstElementChild as HTMLElement;
    await act(() => inner.getExposes().hide());
    const spy = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (
      this: HTMLElement
    ) {
      observations.push({
        phase: 'focus',
        target: this === old ? 'old' : this === outerRoot ? 'outer' : 'new',
        connected: this.isConnected,
      });
      if (this !== outerRoot) throw new Error('new-target focus failure');
    });
    try {
      await act(() => outer.getExposes().request());
      try {
        await act(() => inner.getExposes().show());
      } catch (e) {
        observations.push({
          phase: 'caught',
          error: (e as Error).message,
          stack: (e as Error).stack,
        });
      }
      await micro();
      const replacement = host.querySelectorAll<HTMLElement>('[data-pui-root]')[1];
      spy.mockRestore();
      await act(() => inner.getExposes().hide());
      expect(tree.getLogicalRoot(token)).toBeNull();
      await act(() => inner.getExposes().show());
      const recovered = tree.getLogicalRoot(token)!;
      expect(recovered.isConnected).toBe(true);
      expect(tree.isNativeFocusTargetReady(recovered)).toBe(true);
      await act(() => outer.getExposes().request());
      expect(document.activeElement).toBe(recovered);
    } finally {
      spy.mockRestore();
      try {
        await cleanup();
      } catch {}
      qs.mockRestore();
    }
  });

it('routes a terminal fallback focus failure to Vue errorHandler after releasing bindings', async () => {
  const failure = new Error('fallback focus failure');
  const errors: unknown[] = [];
  const adapt = createVueAdapter(VueAny);
  const Outer = adapt(
    definePrototype({
      name: 'vue-terminal-error-outer',
      setup(def) {
        asButton();
        const target = asFocusable();
        def.expose.method('request', () => target.focus());
        return (r) => r.slot();
      },
    })
  );
  const Inner = adapt(
    definePrototype({
      name: 'vue-terminal-error-inner',
      setup() {
        asButton();
        return () => 'Target';
      },
    })
  );
  const outerRef = VueAny.ref(null),
    show = VueAny.ref(true),
    host = document.createElement('div');
  document.body.append(host);
  const app = VueAny.createApp({
    render: () => VueAny.h(Outer, { ref: outerRef }, () => (show.value ? VueAny.h(Inner) : null)),
  });
  app.config.errorHandler = (error: unknown) => errors.push(error);
  app.mount(host);
  await flushVue();
  await flushVue();
  const old = host.querySelectorAll<HTMLElement>('[data-pui-root]')[1];
  const token = tree.getLogicalEventRouteSurfaceForTarget(old)!;
  let throwing = false;
  const nativeFocus = HTMLElement.prototype.focus;
  const focus = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (
    this: HTMLElement,
    options?: FocusOptions
  ) {
    if (this === old) return;
    if (throwing) throw failure;
    nativeFocus.call(this, options);
  });
  try {
    outerRef.value.getExposes().request();
    throwing = true;
    show.value = false;
    await flushVue();
    await micro();
    expect(tree.getLogicalRoot(token)).toBeNull();
    expect(errors).toContain(failure);
    expect(errors.every((error) => error === failure)).toBe(true);
  } finally {
    focus.mockRestore();
    app.unmount();
    host.remove();
    await micro();
  }
});

function sourceLeaseFixture() {
  const proto = definePrototype({ name: 'focus-source-lease', setup() {} });
  const token = tree.createLogicalInstance(proto),
    root = document.createElement('div');
  tree.markProtoInstance(root, proto, token);
  const source = () => ({ isReady: () => true, subscribe: (_listener: () => void) => () => {} });
  return { token, root, source, cleanup: () => tree.unbindProtoInstance(token, root) };
}
it('retains a releasable deferred source when publication observers throw', () => {
  const f = sourceLeaseFixture(),
    failure = new Error('source observer failure');
  const second = vi.fn();
  const offFirst = tree.subscribeFocusSurfaceReady(
    f.token,
    () => {
      throw failure;
    },
    true
  );
  const offSecond = tree.subscribeFocusSurfaceReady(f.token, second, true);
  const release = tree.registerNativeFocusReadiness(f.token, f.source(), {
    deferPublication: true,
  });
  try {
    expect(second).not.toHaveBeenCalled();
    expect(() => release.publish()).toThrow(failure);
    expect(second).toHaveBeenCalledTimes(1);
    expect(() => release()).toThrow(failure);
    expect(second).toHaveBeenCalledTimes(2);
    expect(tree.isFocusTargetOwnerReady(f.root)).toBe(false);
  } finally {
    offFirst();
    offSecond();
    release();
    f.cleanup();
  }
});
it('ignores stale publication and release after a source is replaced or disposed', () => {
  const f = sourceLeaseFixture(),
    notify = vi.fn();
  const off = tree.subscribeFocusSurfaceReady(f.token, notify, true);
  const old = tree.registerNativeFocusReadiness(f.token, f.source(), {
    deferPublication: true,
  });
  const current = tree.registerNativeFocusReadiness(f.token, f.source(), {
    deferPublication: true,
  });
  try {
    old.publish();
    old();
    expect(notify).not.toHaveBeenCalled();
    expect(tree.isFocusTargetOwnerReady(f.root)).toBe(true);
    current.publish();
    expect(notify).toHaveBeenCalledTimes(1);
    current();
    expect(notify).toHaveBeenCalledTimes(2);
    current.publish();
    expect(notify).toHaveBeenCalledTimes(2);
  } finally {
    off();
    current();
    old();
    f.cleanup();
  }
});

it('keeps a reentrant replacement source and root when an old publication throws', () => {
  const f = sourceLeaseFixture();
  const nextRoot = document.createElement('div');
  let replacement: ReturnType<typeof tree.registerNativeFocusReadiness> | undefined;
  const failure = new Error('observer replaced the source');
  let first = true;
  const off = tree.subscribeFocusSurfaceReady(
    f.token,
    () => {
      if (!first) return;
      first = false;
      tree.markProtoInstance(nextRoot, tree.getLogicalPrototype(f.token)!, f.token);
      replacement = tree.registerNativeFocusReadiness(f.token, f.source(), {
        deferPublication: true,
      });
      throw failure;
    },
    true
  );
  const old = tree.registerNativeFocusReadiness(f.token, f.source(), { deferPublication: true });
  try {
    expect(() => old.publish()).toThrow(failure);
    old();
    old.publish();
    expect(tree.getLogicalRoot(f.token)).toBe(nextRoot);
    expect(tree.isFocusTargetOwnerReady(nextRoot)).toBe(true);
    expect(() => replacement?.publish()).not.toThrow();
  } finally {
    off();
    replacement?.();
    old();
    tree.unbindProtoInstance(f.token, nextRoot);
    f.cleanup();
  }
});

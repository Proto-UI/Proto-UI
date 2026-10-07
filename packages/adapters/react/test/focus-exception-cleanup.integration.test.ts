import { expect, it, vi } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { asFocusable } from '@proto.ui/hooks';
import { asButton } from '../../../prototypes/base/src/button';
import * as tree from '../src/platform/instance-tree';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { createReactAdapter } from '../src';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Actual framework teardown with controlled host focus failure; no gate or fact mocking.
const micro = async () => {
  for (let i = 0; i < 18; i++) await Promise.resolve();
};
const runtime = 'react';
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

    const adapt = createReactAdapter(React),
      Outer = adapt(outerProto),
      Inner = adapt(innerProto),
      oref = React.createRef<any>(),
      iref = React.createRef<any>();
    const app = createRoot(host);
    function App() {
      const [show, setShow] = React.useState(true);
      remove = () => setShow(false);
      return React.createElement(
        Outer,
        { ref: oref },
        show ? React.createElement(Inner, { ref: iref }) : null
      );
    }
    await React.act(async () => app.render(React.createElement(App)));
    outer = oref.current;
    inner = iref.current;
    old = host.querySelectorAll<HTMLElement>('[data-pui-root]')[1];
    act = async (fn) => {
      await React.act(async () => fn());
      await micro();
    };
    cleanup = async () => {
      await React.act(async () => app.unmount());
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

    const adapt = createReactAdapter(React),
      Outer = adapt(outerProto),
      Inner = adapt(innerProto),
      oref = React.createRef<any>(),
      iref = React.createRef<any>();
    const app = createRoot(host);
    function App() {
      const [show, setShow] = React.useState(true);
      remove = () => setShow(false);
      return React.createElement(
        Outer,
        { ref: oref },
        show ? React.createElement(Inner, { ref: iref }) : null
      );
    }
    await React.act(async () => app.render(React.createElement(App)));
    outer = oref.current;
    inner = iref.current;
    old = host.querySelectorAll<HTMLElement>('[data-pui-root]')[1];
    act = async (fn) => {
      await React.act(async () => fn());
      await micro();
    };
    cleanup = async () => {
      await React.act(async () => app.unmount());
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

      expect(tree.getLogicalRoot(token)).toBeNull();
    } finally {
      spy.mockRestore();
      try {
        await cleanup();
      } catch {}
      qs.mockRestore();
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

it('React schedules terminal owner disposal even if fallback readiness focus throws during detach', async () => {
  const trace: any[] = [];
  const outerProto = definePrototype({
    name: 'review-terminal-owner-outer',
    setup(def) {
      asButton();
      const f = asFocusable();
      def.expose.method('request', () => f.focus());
      return (r) => r.slot();
    },
  });
  const innerProto = definePrototype({
    name: 'review-terminal-owner-inner',
    setup() {
      asButton();
      return () => 'Inner';
    },
  });
  const adapt = createReactAdapter(React),
    Outer = adapt(outerProto),
    Inner = adapt(innerProto, { diagnostics: { onLifecycleEvent: (e) => trace.push(e) } }),
    ref = React.createRef<any>();
  let remove = () => {};
  function App() {
    const [show, setShow] = React.useState(true);
    remove = () => setShow(false);
    return React.createElement(Outer, { ref }, show ? React.createElement(Inner) : null);
  }
  const host = document.createElement('div');
  document.body.append(host);
  const app = createRoot(host);
  await React.act(async () => app.render(React.createElement(App)));
  const [outer, old] = host.querySelectorAll<HTMLElement>('[data-pui-root]');
  const initial = vi.spyOn(old, 'focus').mockImplementation(() => {});
  const failure = new Error('fallback focus failure');
  let throwing = false,
    called = 0;
  const outerNative = outer.focus.bind(outer);
  const fallback = vi.spyOn(outer, 'focus').mockImplementation((options) => {
    called++;
    if (throwing) throw failure;
    outerNative(options);
  });
  let caught: unknown;
  try {
    await React.act(async () => ref.current.getExposes().request());
    throwing = true;
    try {
      await React.act(async () => remove());
    } catch (e) {
      caught = e;
    }
    for (let i = 0; i < 25; i++) await Promise.resolve();
    expect(caught).toBe(failure);
    expect(called).toBeGreaterThan(0);
    expect(trace.some((x) => x.type === 'instance.dispose.done')).toBe(true);
  } finally {
    initial.mockRestore();
    fallback.mockRestore();
    await React.act(async () => app.unmount());
    host.remove();
  }
});

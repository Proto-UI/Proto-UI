import { expect, it, vi } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { asFocusable, asOverlay } from '@proto.ui/hooks';
import { asButton } from '../../../prototypes/base/src/button';
import { AdaptToWebComponent } from '../src';
import * as tree from '../src/platform/instance-tree';
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
for (const mode of [
  'normal',
  'old-focus-throw',
  'fallback-focus-throw',
  'unmounted-callback-error',
] as const)
  it(`WC terminal/reconnect completes after ${mode}`, async () => {
    let setup = 0,
      disposed = 0,
      shouldThrow = false;
    const failure = new Error(`wc-terminal-${mode}`),
      errors: unknown[] = [],
      calls: any[] = [];
    const outerProto = definePrototype({
      name: `review-wc-terminal-outer-${mode}`,
      setup(def) {
        asButton();
        const f = asFocusable();
        def.expose.method('request', () => f.focus());
        return (r) => r.slot();
      },
    });
    const innerProto = definePrototype({
      name: `review-wc-terminal-inner-${mode}`,
      setup(def) {
        setup++;
        asButton();
        def.lifecycle.onBeforeDispose(() => disposed++);
        def.lifecycle.onUnmounted(() => {
          if (shouldThrow && mode === 'unmounted-callback-error') throw failure;
        });
        return (r) => r.el('span', 'Fresh inner view');
      },
    });
    AdaptToWebComponent(outerProto);
    AdaptToWebComponent(innerProto);
    const outer = document.createElement(outerProto.name) as any,
      inner = document.createElement(innerProto.name) as any;
    outer.append(inner);
    document.body.append(outer);
    await flush();
    const token = inner._instanceToken,
      controller = inner._controller,
      hostDisplay = inner._hostDisplay;
    const releaseHostDisplay = vi.spyOn(hostDisplay, 'disconnect');
    const queue = globalThis.queueMicrotask.bind(globalThis),
      q = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((cb) =>
        queue(() => {
          try {
            const result = (cb as () => any)();
            if (result?.then) result.catch((e: unknown) => errors.push(e));
          } catch (e) {
            errors.push(e);
          }
        })
      );
    const innerFocus = vi.spyOn(inner, 'focus').mockImplementation(() => {
      calls.push({ target: 'inner', connected: inner.isConnected, throwing: shouldThrow });
      if (shouldThrow && mode === 'old-focus-throw') throw failure;
    });
    const outerNative = outer.focus.bind(outer),
      outerFocus = vi.spyOn(outer, 'focus').mockImplementation((options: any) => {
        calls.push({ target: 'outer', connected: outer.isConnected, throwing: shouldThrow });
        if (shouldThrow && mode === 'fallback-focus-throw') {
          throw failure;
        }
        outerNative(options);
      });
    try {
      outer.getExposes().request();
      shouldThrow = true;
      inner.remove();
      await flush();
      const terminal = {
        bound: tree.getLogicalRoot(token) === inner,
        mountedOnce: inner._mountedOnce,
        controllerRetained: inner._controller === controller,
        invokePending: !!inner._invokeUnmounted,
        disposed,
        text: inner.textContent,
        errorCount: errors.length,
        originalError: errors[0] === failure,
        hostDisplayCleared: inner._hostDisplay === null,
        hostDisplayReleased: releaseHostDisplay.mock.calls.length,
        exposesCleared: Object.keys(inner._exposes ?? {}).length === 0,
      };
      shouldThrow = false;
      innerFocus.mockRestore();
      outerFocus.mockRestore();
      outer.append(inner);
      await flush();
      const reconnect = {
        setup,
        disposed,
        newToken: inner._instanceToken !== token,
        newController: inner._controller !== controller,
        text: inner.textContent,
        exposed: typeof inner.getExposes().focusSelf === 'function',
      };
      expect(terminal.hostDisplayReleased).toBe(1);
      expect(terminal.hostDisplayCleared).toBe(true);
      expect(terminal.exposesCleared).toBe(true);
      expect(terminal.mountedOnce).toBe(false);
      expect(terminal.controllerRetained).toBe(false);
      expect(terminal.bound).toBe(false);
      expect(disposed).toBe(1);
      expect(reconnect).toEqual({
        setup: 2,
        disposed: 1,
        newToken: true,
        newController: true,
        text: 'Fresh inner view',
        exposed: true,
      });
      if (mode === 'fallback-focus-throw' || mode === 'unmounted-callback-error')
        expect(errors).toEqual([failure]);
      else expect(errors).toEqual([]);
    } finally {
      shouldThrow = false;
      innerFocus.mockRestore();
      outerFocus.mockRestore();
      outer.remove();
      await flush();
      releaseHostDisplay.mockRestore();
      q.mockRestore();
    }
  });

it.each([false, true])(
  'WC owns a reconnect requested inside terminal source invalidation (throws=%s)',
  async (throws) => {
    let setup = 0,
      disposed = 0,
      reentered = false;
    const errors: unknown[] = [],
      failure = new Error('reentrant fallback failure');
    const outerProto = definePrototype({
      name: `review-wc-reconnect-outer-${throws}`,
      setup(def) {
        asButton();
        const f = asFocusable();
        def.expose.method('request', () => f.focus());
        return (r) => r.slot();
      },
    });
    const innerProto = definePrototype({
      name: `review-wc-reconnect-inner-${throws}`,
      setup(def) {
        setup++;
        asButton();
        def.lifecycle.onBeforeDispose(() => disposed++);
        return (r) => r.el('span', 'Reconnected inner');
      },
    });
    AdaptToWebComponent(outerProto);
    AdaptToWebComponent(innerProto);
    const outer = document.createElement(outerProto.name) as any,
      inner = document.createElement(innerProto.name) as any;
    outer.append(inner);
    document.body.append(outer);
    await flush();
    const oldToken = inner._instanceToken,
      oldController = inner._controller;
    const queue = globalThis.queueMicrotask.bind(globalThis),
      q = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((cb) =>
        queue(() => {
          try {
            const result = (cb as () => any)();
            if (result?.then) result.catch((e: unknown) => errors.push(e));
          } catch (e) {
            errors.push(e);
          }
        })
      );
    const oldFocus = vi.spyOn(inner, 'focus').mockImplementation(() => {});
    const outerNative = outer.focus.bind(outer),
      fallback = vi.spyOn(outer, 'focus').mockImplementation((options: any) => {
        if (!reentered) {
          reentered = true;
          outer.append(inner);
          if (throws) throw failure;
        } else outerNative(options);
      });
    try {
      outer.getExposes().request();
      inner.remove();
      await flush();
      oldFocus.mockRestore();
      fallback.mockRestore();
      const result = {
        setup,
        disposed,
        reentered,
        connected: inner.isConnected,
        mounted: inner._mountedOnce,
        newToken: inner._instanceToken !== oldToken,
        newController: !!inner._controller && inner._controller !== oldController,
        oldRootBound: tree.getLogicalRoot(oldToken) === inner,
        text: inner.textContent,
        exposed: typeof inner.getExposes().focusSelf === 'function',
        errorCount: errors.length,
        originalError: errors[0] === failure,
      };
      expect(reentered).toBe(true);
      expect(setup).toBe(2);
      expect(disposed).toBe(1);
      expect(result.newToken).toBe(true);
      expect(result.newController).toBe(true);
      expect(result.oldRootBound).toBe(false);
      expect(result.exposed).toBe(true);
      expect(result.text).toBe('Reconnected inner');
      expect(errors).toEqual(throws ? [failure] : []);
      inner.getExposes().focusSelf();
      expect(document.activeElement).toBe(inner);
      expect(inner.getExposes().focused.get()).toBe(true);
      inner.remove();
      await flush();
      expect(disposed).toBe(2);
      expect(inner._mountedOnce).toBe(false);
    } finally {
      oldFocus.mockRestore();
      fallback.mockRestore();
      outer.remove();
      await flush();
      q.mockRestore();
    }
  }
);

it.each(['close', 'external-remove', 'close-to-detached-parent'] as const)(
  'distinguishes portal cleanup from external ownership removal: %s',
  async (mode) => {
    let setups = 0,
      disposed = 0;
    let completeUnmount!: () => void;
    const unmounted = new Promise<void>((resolve) => {
      completeUnmount = resolve;
    });
    const proto = definePrototype({
      name: `wc-terminal-portal-${mode}`,
      setup(def) {
        setups++;
        const overlay = asOverlay();
        overlay.configure({ portal: true, entry: 'manual', restore: 'none' });
        def.expose('actions', { open: () => overlay.openOverlay(), close: () => overlay.close() });
        def.lifecycle.onBeforeDispose(() => {
          disposed++;
        });
        return () => 'Portal content';
      },
    });
    AdaptToWebComponent(proto, {
      diagnostics: {
        onLifecycleEvent(event) {
          if (event.type === 'unmount.done') completeUnmount();
        },
      },
    });
    const host = document.createElement('div'),
      next = document.createElement('span'),
      content: any = document.createElement(proto.name);
    host.append(content, next);
    document.body.append(host);
    await flush();
    try {
      content.getExposes().actions.open();
      await flush();
      expect(Array.from(document.body.children)).toContain(content);
      expect(Array.from(host.children)).not.toContain(content);
      if (mode === 'external-remove') content.remove();
      else {
        if (mode === 'close-to-detached-parent') host.remove();
        content.getExposes().actions.close();
      }
      // Revocation follows actual view completion, including conceal frames and
      // origin-observer delivery. Promise-only flushing is not that boundary.
      await unmounted;
      await flush();
      if (mode === 'external-remove') {
        expect(content.isConnected).toBe(false);
        expect(Array.from(host.children)).not.toContain(content);
        expect(disposed).toBe(1);
      } else {
        expect(Array.from(host.children)).toContain(content);
        // Test physical restoration to the original parent, independent of the
        // bridge's logical parent projection and unrelated sibling ordering.
        expect(Array.from(host.children)).toContain(next);
        expect(disposed).toBe(mode === 'close' ? 0 : 1);
      }
      expect(setups).toBe(1);
    } finally {
      content.remove();
      host.remove();
      await flush();
    }
  }
);

it('keeps newer owner cleanup locked when controlled old error transport settles', async () => {
  let setups = 0,
    disposed = 0;
  const errors: unknown[] = [];
  const proto = definePrototype({
    name: 'wc-terminal-once-release',
    setup(def) {
      setups++;
      const target = asFocusable();
      def.expose.method('focusSelf', () => target.focusSelf());
      return () => 'Owned';
    },
  });
  const Element = AdaptToWebComponent(proto, {
    diagnostics: {
      onLifecycleEvent: (event) => {
        if (event.type === 'instance.dispose.done') disposed++;
      },
    },
  });
  const root: any = new Element();
  document.body.append(root);
  await flush();
  const queue = globalThis.queueMicrotask.bind(globalThis),
    capture = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((callback) =>
      queue(() => {
        try {
          const result = (callback as () => any)();
          if (result?.then) result.catch((error: unknown) => errors.push(error));
        } catch (error) {
          errors.push(error);
        }
      })
    );
  let rejectOld!: (error: unknown) => void, finishNew!: () => void;
  const oldError = new Error('old terminal error transport');
  const oldTransport = new Promise<void>((_resolve, reject) => {
    rejectOld = reject;
  });
  const newCleanup = new Promise<void>((resolve) => {
    finishNew = resolve;
  });
  const disposeOld = root._invokeUnmounted;
  // Keep real old cleanup synchronous while delaying only its error transport.
  root._invokeUnmounted = () => {
    void disposeOld();
    return oldTransport;
  };
  try {
    root.remove();
    await Promise.resolve();
    await Promise.resolve();
    expect(disposed).toBe(1);
    expect(root._terminalDisposing).toBe(false);
    document.body.append(root);
    expect(setups).toBe(2);
    const token = root._instanceToken,
      disposeNew = root._invokeUnmounted;
    // This owner has genuinely not performed its cleanup yet. An older error
    // settling now must not permit a third owner to reuse the same host fields.
    root._invokeUnmounted = () => newCleanup.then(() => disposeNew());
    root.remove();
    await Promise.resolve();
    expect(root._terminalDisposing).toBe(true);
    rejectOld(oldError);
    await flush();
    expect(errors).toEqual([oldError]);
    expect(root._terminalDisposing).toBe(true);
    document.body.append(root);
    expect(setups).toBe(2);
    expect(root._instanceToken).toBe(token);
    finishNew();
    await flush();
    expect(setups).toBe(3);
    expect(disposed).toBe(2);
    expect(root._instanceToken).not.toBe(token);
    root.getExposes().focusSelf();
    expect(document.activeElement).toBe(root);
  } finally {
    finishNew();
    root.remove();
    await flush();
    capture.mockRestore();
  }
});

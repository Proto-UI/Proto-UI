import { it, expect, vi } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { asFocusable } from '@proto.ui/hooks';
import { asButton } from '../../../prototypes/base/src/button';
import { AdaptToWebComponent, setElementProps } from '../src';
import * as tree from '../src/platform/instance-tree';
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
// Actual WC startup, with controlled host focus/author callback failures only.
it.each([false, true])('WC initial publication cleanup after focus throw=%s', async (throws) => {
  let setups = 0,
    disposed = 0,
    clicks = 0;
  const errors: unknown[] = [],
    attempts: any[] = [];
  const failure = new Error('initial-publish-focus');
  const Outer = AdaptToWebComponent(
    definePrototype({
      name: `wc-startup-publication-publish-outer-${throws}`,
      setup(def) {
        asButton();
        const f = asFocusable();
        def.expose.method('request', () => f.focus());
        return (r) => r.slot();
      },
    })
  );
  const Inner = AdaptToWebComponent(
    definePrototype({
      name: `wc-startup-publication-publish-inner-${throws}`,
      setup(def) {
        setups++;
        asButton();
        def.lifecycle.onBeforeDispose(() => disposed++);
        def.event.on('host:click', () => clicks++);
        return (r) => r.el('span', 'Initial content');
      },
    })
  );
  const outer: any = new Outer();
  document.body.append(outer);
  await flush();
  const inner: any = new Inner();
  let reject = true;
  const actualInnerFocus = inner.focus.bind(inner);
  const fs = vi.spyOn(inner, 'focus').mockImplementation((opts: any) => {
    attempts.push({
      rendered: !!inner.querySelector('span'),
      connected: inner.isConnected,
      stack: new Error().stack,
    });
    if (throws && inner.querySelector('span')) throw failure;
    if (!reject) actualInnerFocus(opts);
  });
  const os = vi.spyOn(outer, 'focus').mockImplementation(() => {});
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
  let caught: unknown;
  try {
    outer.getExposes().request();
    try {
      outer.append(inner);
    } catch (e) {
      caught = e;
    }
    await flush();
    const token = inner._instanceToken;
    const afterAppend = {
      setups,
      disposed,
      invokeInstalled: !!inner._invokeUnmounted,
      mounted: inner._mountedOnce,
      viewText: inner.textContent,
      originalCaught: caught === failure,
      errorCount: errors.length,
      listeners: inner._focusTargetReadyListeners.size,
    };
    expect(afterAppend.setups).toBe(1);
    expect(caught).toBe(throws ? failure : undefined);
    expect(errors).toEqual([]);
    expect(afterAppend.disposed).toBe(throws ? 1 : 0);
    if (throws) {
      expect(inner.isConnected).toBe(true);
      expect(tree.getLogicalRoot(token)).toBeNull();
      expect(afterAppend.listeners).toBe(0);
      expect(inner._hostDisplay).toBeNull();
      expect(inner._applier).toBeNull();
    }
    inner.remove();
    await flush();
    inner.dispatchEvent(new MouseEvent('click'));
    await flush();
    const afterRemove = {
      setups,
      disposed,
      clicks,
      readyListeners: inner._focusTargetReadyListeners.size,
      hostDisplayAlive: !!inner._hostDisplay,
      applierAlive: !!inner._applier,
    };
    fs.mockRestore();
    os.mockRestore();
    outer.append(inner);
    await flush();
    const afterReconnect = {
      setups,
      disposed,
      newToken: inner._instanceToken !== token,
      invokeInstalled: !!inner._invokeUnmounted,
      text: inner.textContent,
    };
    if (throws) {
      expect(afterAppend.setups).toBe(1);
      expect(afterAppend.disposed).toBe(1);
      expect(afterAppend.listeners).toBe(0);
      expect(afterAppend.invokeInstalled).toBe(false);
      expect(afterAppend.originalCaught).toBe(true);
    }
    expect(afterRemove.disposed).toBe(1);
    expect(afterRemove.clicks).toBe(0);
    expect(afterRemove.hostDisplayAlive).toBe(false);
    expect(afterRemove.applierAlive).toBe(false);
    expect(afterReconnect.setups).toBe(2);
    expect(afterReconnect.disposed).toBe(1);
  } finally {
    fs.mockRestore();
    os.mockRestore();
    outer.remove();
    await flush();
    q.mockRestore();
  }
});

it.each([false, true])(
  'WC initial controller-bind cleanup after props watcher throw=%s',
  async (throws) => {
    let setups = 0,
      disposed = 0,
      clicks = 0;
    const errors: unknown[] = [],
      attempts: any[] = [];
    const failure = new Error('initial-publish-focus');
    const Outer = AdaptToWebComponent(
      definePrototype({
        name: `wc-startup-controller-publish-outer-${throws}`,
        setup(def) {
          asButton();
          const f = asFocusable();
          def.expose.method('request', () => f.focus());
          return (r) => r.slot();
        },
      })
    );
    const Inner = AdaptToWebComponent(
      definePrototype({
        name: `wc-startup-controller-publish-inner-${throws}`,
        setup(def) {
          setups++;
          asButton();
          def.props.define({ value: { type: 'number', default: 1 } });
          def.props.watch(['value'], () => {
            if (throws) {
              attempts.push({ phase: 'props-watcher', stack: new Error().stack });
              throw failure;
            }
          });
          def.lifecycle.onBeforeDispose(() => disposed++);
          def.event.on('host:click', () => clicks++);
          return (r) => r.el('span', 'Initial content');
        },
      })
    );
    const outer: any = new Outer();
    document.body.append(outer);
    await flush();
    const inner: any = new Inner();
    let reject = true;
    const actualInnerFocus = inner.focus.bind(inner);
    const fs = vi.spyOn(inner, 'focus').mockImplementation((opts: any) => {
      attempts.push({
        rendered: !!inner.querySelector('span'),
        connected: inner.isConnected,
        stack: new Error().stack,
      });
      if (inner.querySelector('span')) setElementProps(inner, { value: 2 });
      if (!reject) actualInnerFocus(opts);
    });
    const os = vi.spyOn(outer, 'focus').mockImplementation(() => {});
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
    let caught: unknown;
    try {
      outer.getExposes().request();
      try {
        outer.append(inner);
      } catch (e) {
        caught = e;
      }
      await flush();
      const token = inner._instanceToken;
      const afterAppend = {
        setups,
        disposed,
        invokeInstalled: !!inner._invokeUnmounted,
        mounted: inner._mountedOnce,
        viewText: inner.textContent,
        originalCaught: caught === failure,
        errorCount: errors.length,
        listeners: inner._focusTargetReadyListeners.size,
      };
      expect(afterAppend.setups).toBe(1);
      expect(caught).toBe(throws ? failure : undefined);
      expect(errors).toEqual([]);
      expect(afterAppend.disposed).toBe(throws ? 1 : 0);
      if (throws) {
        expect(inner.isConnected).toBe(true);
        expect(tree.getLogicalRoot(token)).toBeNull();
        expect(afterAppend.listeners).toBe(0);
        expect(inner._hostDisplay).toBeNull();
        expect(inner._applier).toBeNull();
      }
      inner.remove();
      await flush();
      inner.dispatchEvent(new MouseEvent('click'));
      await flush();
      const afterRemove = {
        setups,
        disposed,
        clicks,
        readyListeners: inner._focusTargetReadyListeners.size,
        hostDisplayAlive: !!inner._hostDisplay,
        applierAlive: !!inner._applier,
      };
      fs.mockRestore();
      os.mockRestore();
      outer.append(inner);
      await flush();
      const afterReconnect = {
        setups,
        disposed,
        newToken: inner._instanceToken !== token,
        invokeInstalled: !!inner._invokeUnmounted,
        text: inner.textContent,
      };
      expect(afterRemove.disposed).toBe(1);
      expect(afterRemove.clicks).toBe(0);
      expect(afterRemove.hostDisplayAlive).toBe(false);
      expect(afterRemove.applierAlive).toBe(false);
      expect(afterReconnect.setups).toBe(2);
      expect(afterReconnect.disposed).toBe(1);
    } finally {
      fs.mockRestore();
      os.mockRestore();
      outer.remove();
      await flush();
      q.mockRestore();
    }
  }
);

for (const mode of ['remove', 'reappend'] as const)
  it.each([false, true])(`WC initial publication ${mode} with throw=%s`, async (throws) => {
    let setups = 0,
      disposed = 0,
      clicks = 0,
      moved = false;
    const errors: unknown[] = [];
    const failure = new Error('initial-reentrant-focus');
    const Outer = AdaptToWebComponent(
      definePrototype({
        name: `wc-startup-reentry-reentry-outer-${mode}-${throws}`,
        setup(def) {
          asButton();
          const f = asFocusable();
          def.expose.method('request', () => f.focus());
          return (r) => r.slot();
        },
      })
    );
    const Inner = AdaptToWebComponent(
      definePrototype({
        name: `wc-startup-reentry-reentry-inner-${mode}-${throws}`,
        setup(def) {
          setups++;
          asButton();
          def.lifecycle.onBeforeDispose(() => disposed++);
          def.event.on('host:click', () => clicks++);
          return (r) => r.el('span', 'Initial content');
        },
      })
    );
    const outer: any = new Outer();
    document.body.append(outer);
    await flush();
    const inner: any = new Inner();
    const os = vi.spyOn(outer, 'focus').mockImplementation(() => {}),
      native = inner.focus.bind(inner);
    const fs = vi.spyOn(inner, 'focus').mockImplementation((options: any) => {
      if (inner.querySelector('span') && !moved) {
        moved = true;
        inner.remove();
        if (mode === 'reappend') outer.append(inner);
        if (throws) throw failure;
      } else if (moved) native(options);
    });
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
    try {
      outer.getExposes().request();
      try {
        outer.append(inner);
      } catch (e) {
        errors.push(e);
      }
      await flush();
      const initial = {
        setups,
        disposed,
        connected: inner.isConnected,
        mounted: inner._mountedOnce,
        invoke: !!inner._invokeUnmounted,
        errorCount: errors.length,
        originalError: errors.includes(failure),
      };
      inner.remove();
      await flush();
      const before = clicks;
      inner.dispatchEvent(new MouseEvent('click'));
      await flush();
      const terminal = {
        setups,
        disposed,
        lateClicks: clicks - before,
        listeners: inner._focusTargetReadyListeners.size,
        hostDisplayAlive: !!inner._hostDisplay,
      };
      fs.mockRestore();
      os.mockRestore();
      outer.append(inner);
      await flush();
      const fresh = {
        setups,
        disposed,
        connected: inner.isConnected,
        mounted: inner._mountedOnce,
        text: inner.textContent,
      };
      expect(moved).toBe(true);
      expect(initial.connected).toBe(mode === 'reappend');
      expect(terminal.disposed).toBe(terminal.setups);
      expect(terminal.lateClicks).toBe(0);
      expect(terminal.listeners).toBe(0);
      expect(terminal.hostDisplayAlive).toBe(false);
      expect(fresh.setups).toBe(terminal.setups + 1);
      expect(fresh.disposed).toBe(terminal.disposed);
      expect(fresh.text).toBe('Initial content');
      if (throws) expect(errors).toContain(failure);
    } finally {
      fs.mockRestore();
      os.mockRestore();
      outer.remove();
      await flush();
      q.mockRestore();
    }
  });

for (const point of ['get-props', 'mounted-diagnostics'] as const)
  it.each([false, true])(`WC ${point} startup rollback throw=%s`, async (throws) => {
    let setups = 0,
      disposed = 0,
      armed = throws;
    const failure = new Error(`startup-${point}`),
      trace: string[] = [];
    const Ctor = AdaptToWebComponent(
      definePrototype({
        name: `wc-startup-callbacks-startup-${point}-${throws}`,
        setup(def) {
          setups++;
          asButton();
          def.lifecycle.onBeforeDispose(() => disposed++);
          return () => 'Owned';
        },
      }),
      {
        getProps() {
          if (point === 'get-props' && armed) {
            armed = false;
            trace.push('getProps');
            throw failure;
          }
          return {};
        },
        diagnostics: {
          onLifecycleEvent(event) {
            if (
              point === 'mounted-diagnostics' &&
              armed &&
              event.type === 'mount.phase' &&
              event.phase === 'mounted'
            ) {
              armed = false;
              trace.push('mounted');
              throw failure;
            }
          },
        },
      }
    );
    const root: any = new Ctor();
    let caught: unknown;
    try {
      try {
        document.body.append(root);
      } catch (error) {
        caught = error;
      }
      await flush();
      const initial = {
        setups,
        disposed,
        hostDisplay: !!root._hostDisplay,
        applier: !!root._applier,
        mounted: root._mountedOnce,
        bound: !!tree.getPrototypeByInstance(root),
        listeners: root._focusTargetReadyListeners.size,
        originalError: caught === failure,
      };
      root.remove();
      await flush();
      const terminal = {
        setups,
        disposed,
        hostDisplay: !!root._hostDisplay,
        applier: !!root._applier,
        mounted: root._mountedOnce,
        bound: !!tree.getPrototypeByInstance(root),
      };
      document.body.append(root);
      await flush();
      const recovered = { setups, disposed, mounted: root._mountedOnce, text: root.textContent };
      expect(terminal.hostDisplay).toBe(false);
      expect(terminal.applier).toBe(false);
      expect(terminal.mounted).toBe(false);
      expect(terminal.bound).toBe(false);
      expect(recovered.mounted).toBe(true);
      expect(recovered.text).toBe('Owned');
      if (throws) {
        expect(caught).toBe(failure);
        expect(initial.hostDisplay).toBe(false);
        expect(initial.applier).toBe(false);
        expect(initial.bound).toBe(false);
        if (point === 'mounted-diagnostics') expect(initial.disposed).toBe(1);
      }
    } finally {
      root.remove();
      await flush();
    }
  });

for (const move of ['stay-connected', 'reappend-during-cleanup'] as const)
  it.each([false, true])(
    `initial rollback ${move} preserves the first error over cleanup throw=%s`,
    async (cleanupThrows) => {
      let setups = 0,
        disposed = 0;
      let inner: any, outer: any;
      const errors: unknown[] = [],
        first = new Error('initial focus failure'),
        second = new Error('cleanup failure');
      const Outer = AdaptToWebComponent(
        definePrototype({
          name: `wc-startup-priority-outer-${move}-${cleanupThrows}`,
          setup(def) {
            asButton();
            const target = asFocusable();
            def.expose.method('request', () => target.focus());
            return (r) => r.slot();
          },
        })
      );
      const Inner = AdaptToWebComponent(
        definePrototype({
          name: `wc-startup-priority-inner-${move}-${cleanupThrows}`,
          setup(def) {
            const generation = ++setups;
            asButton();
            def.lifecycle.onBeforeDispose(() => {
              disposed++;
              if (generation === 1) {
                if (move === 'reappend-during-cleanup') {
                  inner.remove();
                  outer.append(inner);
                }
                if (cleanupThrows) throw second;
              }
            });
            return (r) => r.el('span', 'Owned');
          },
        })
      );
      outer = new Outer();
      document.body.append(outer);
      await flush();
      inner = new Inner();
      const outerFocus = vi.spyOn(outer, 'focus').mockImplementation(() => {}),
        native = inner.focus.bind(inner),
        innerFocus = vi.spyOn(inner, 'focus').mockImplementation((options: any) => {
          if (setups === 1 && inner.querySelector('span')) throw first;
          if (setups > 1) native(options);
        });
      const enqueue = globalThis.queueMicrotask.bind(globalThis),
        capture = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((callback) =>
          enqueue(() => {
            try {
              const result = (callback as () => any)();
              if (result?.then) result.catch((error: unknown) => errors.push(error));
            } catch (error) {
              errors.push(error);
            }
          })
        );
      try {
        outer.getExposes().request();
        let caught: unknown;
        try {
          outer.append(inner);
        } catch (error) {
          caught = error;
        }
        await flush();
        expect(caught).toBe(first);
        expect(errors).toEqual([]);
        expect(disposed).toBe(1);
        expect(setups).toBe(move === 'stay-connected' ? 1 : 2);
        if (move === 'stay-connected') {
          expect(inner.isConnected).toBe(true);
          expect(inner._mountedOnce).toBe(false);
          expect(inner._focusTargetReadyListeners.size).toBe(0);
          inner.remove();
          await flush();
          innerFocus.mockRestore();
          outerFocus.mockRestore();
          outer.append(inner);
          await flush();
          expect(setups).toBe(2);
        } else {
          expect(inner._mountedOnce).toBe(true);
          expect(inner.textContent).toBe('Owned');
          inner.getExposes().focusSelf();
          expect(document.activeElement).toBe(inner);
        }
        inner.remove();
        await flush();
        expect(disposed).toBe(2);
      } finally {
        innerFocus.mockRestore();
        outerFocus.mockRestore();
        outer.remove();
        await flush();
        capture.mockRestore();
      }
    }
  );

it.each([false, true])(
  'initially hidden owner keeps its lifetime through first-show publication throw=%s',
  async (throws) => {
    let setups = 0,
      disposed = 0,
      run: any;
    const errors: unknown[] = [],
      failure = new Error('retained first-show focus');
    const Outer = AdaptToWebComponent(
      definePrototype({
        name: `wc-startup-hidden-outer-${throws}`,
        setup(def) {
          asButton();
          const target = asFocusable();
          def.expose.method('request', () => target.focus());
          return (r) => r.slot();
        },
      })
    );
    const Inner = AdaptToWebComponent(
      definePrototype({
        name: `wc-startup-hidden-inner-${throws}`,
        setup(def) {
          setups++;
          asButton();
          def.lifecycle.onCreated((value) => {
            run = value;
            run.lifecycle.setPresent(false);
          });
          def.lifecycle.onBeforeDispose(() => disposed++);
          def.expose('view', {
            show: () => run.lifecycle.setPresent(true),
            hide: () => run.lifecycle.setPresent(false),
          });
          return (r) => r.el('span', 'Retained');
        },
      })
    );
    const outer: any = new Outer();
    document.body.append(outer);
    await flush();
    const inner: any = new Inner();
    const os = vi.spyOn(outer, 'focus').mockImplementation(() => {}),
      fs = vi.spyOn(inner, 'focus').mockImplementation(() => {
        if (throws && inner.querySelector('span')) throw failure;
      });
    const enqueue = globalThis.queueMicrotask.bind(globalThis),
      capture = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((callback) =>
        enqueue(() => {
          try {
            const result = (callback as () => any)();
            if (result?.then) result.catch((error: unknown) => errors.push(error));
          } catch (error) {
            errors.push(error);
          }
        })
      );
    try {
      outer.getExposes().request();
      outer.append(inner);
      await flush();
      expect(setups).toBe(1);
      expect(inner.textContent).toBe('');
      inner.getExposes().view.show();
      await flush();
      expect(disposed).toBe(0);
      expect(inner.textContent).toBe('Retained');
      expect(errors).toEqual(throws ? [failure] : []);
      fs.mockRestore();
      os.mockRestore();
      inner.getExposes().view.hide();
      await flush();
      inner.getExposes().view.show();
      await flush();
      expect(setups).toBe(1);
      inner.getExposes().focusSelf();
      expect(document.activeElement).toBe(inner);
    } finally {
      fs.mockRestore();
      os.mockRestore();
      outer.remove();
      await flush();
      capture.mockRestore();
    }
  }
);

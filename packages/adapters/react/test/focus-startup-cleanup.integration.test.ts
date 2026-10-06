import { expect, it, vi } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { asFocusable } from '@proto.ui/hooks';
import { FOCUS_CENTER } from '../../../modules/focus/src/center';
import { asButton } from '../../../prototypes/base/src/button';
import * as React19 from 'react';
import { createRoot as createRoot19 } from 'react-dom/client';
// The docs workspace pins the actual React 18 renderer; its relative entry has no declaration mapping.
// @ts-expect-error -- runtime dependency; use the installed React structural types below.
import * as React18Runtime from '../../../../apps/www/node_modules/react';
// @ts-expect-error -- same pinned React 18 runtime entry.
import { createRoot as createRoot18Runtime } from '../../../../apps/www/node_modules/react-dom/client';
import { createReactAdapter } from '../src';
import * as tree from '../src/platform/instance-tree';

const React18 = React18Runtime as typeof React19;
const createRoot18 = createRoot18Runtime as typeof createRoot19;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

// Actual React renderers and ErrorBoundary, before any explicit test unmount.
// Focus rejection and the publication observation only select the author-error
// boundary; they never change a gate, semantic fact or lifecycle outcome.
for (const version of [18, 19] as const) {
  for (const boundary of [
    'full-publication',
    'fallback-allocation',
    'fallback-publication',
    'fallback-render',
    'fallback-publication-cleanup-error',
  ] as const) {
    for (const throws of [false, true]) {
      it(`React ${version} ${boundary} author failure=${throws} releases its acquired startup resources`, async () => {
        const React = version === 18 ? React18 : React19;
        const createRoot = version === 18 ? createRoot18 : createRoot19;
        const fullContext = boundary === 'full-publication';
        const failure = new Error('author startup callback failed');
        const cleanupFailure = new Error('author cleanup callback failed');
        let cleanupErrors = 0;
        const errors: unknown[] = [];
        const events: Array<{ type: string }> = [];
        let setups = 0;
        let disposed = 0;
        let clicks = 0;
        let armed = false;
        let show!: () => void;
        let child: HTMLElement | undefined;
        let token: ReturnType<typeof tree.createLogicalInstance> | null = null;
        const publishing = new Set<unknown>();
        const leases = new Map<unknown, { released: boolean }>();
        const register = tree.registerNativeFocusReadiness;
        const registerSpy = vi
          .spyOn(tree, 'registerNativeFocusReadiness')
          .mockImplementation((instance, source, options) => {
            const release = register(instance, source, options);
            const state = { released: false };
            leases.set(instance, state);
            return Object.assign(
              () => {
                try {
                  release();
                } finally {
                  state.released = true;
                }
              },
              {
                publish() {
                  publishing.add(instance);
                  try {
                    release.publish();
                  } finally {
                    publishing.delete(instance);
                  }
                },
              }
            );
          });
        const outerProto = definePrototype({
          name: `startup-${version}-${boundary}-${throws}-outer`,
          setup(def) {
            asButton();
            const focus = asFocusable();
            focus.focused.watch((_run, event) => {
              if (
                armed &&
                throws &&
                boundary !== 'fallback-render' &&
                event.type === 'next' &&
                event.next
              )
                throw failure;
            });
            def.expose.method('request', () => focus.focus());
            return (r) => r.slot();
          },
        });
        const innerProto = definePrototype({
          name: `startup-${version}-${boundary}-${throws}-inner`,
          setup(def) {
            setups++;
            def.lifecycle.onBeforeDispose(() => {
              disposed++;
              if (armed && throws && boundary === 'fallback-publication-cleanup-error') {
                cleanupErrors++;
                throw cleanupFailure;
              }
            });
            asButton();
            def.event.on('host:click', () => clicks++);
            return (r) => {
              if (throws && boundary === 'fallback-render') throw failure;
              return r.el('span', 'Owned child');
            };
          },
        });
        const adapt = createReactAdapter(
          fullContext ? React : { ...React, createContext: undefined, useContext: undefined }
        );
        const Outer = adapt(outerProto);
        const Inner = adapt(innerProto, {
          diagnostics: { onLifecycleEvent: (event) => events.push(event) },
        });
        const ref = React.createRef<any>();
        class Boundary extends React.Component<any, { failed: boolean }> {
          state = { failed: false };
          static getDerivedStateFromError() {
            return { failed: true };
          }
          componentDidCatch(error: unknown) {
            errors.push(error);
          }
          render() {
            return this.state.failed
              ? React.createElement('i', { 'data-startup-error': '' }, 'Failed')
              : this.props.children;
          }
        }
        function App() {
          const [present, setPresent] = React.useState(false);
          show = () => setPresent(true);
          return React.createElement(
            Outer,
            { ref },
            React.createElement(Boundary, null, present ? React.createElement(Inner) : null)
          );
        }
        const host = document.createElement('div');
        document.body.append(host);
        const app = createRoot(host);
        // React 18 DEV uses DOM error events for guarded callbacks. Vitest's
        // happy-dom default disables that transport; use happy-dom's normal
        // capture for this actual ErrorBoundary test and restore it afterwards.
        const settings = (window as any).happyDOM.settings;
        const previousCapture = settings.disableErrorCapturing;
        settings.disableErrorCapturing = false;
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        await React.act(async () => app.render(React.createElement(App)));
        await flush();
        const outer = host.querySelector<HTMLElement>('[data-pui-root]')!;
        const bindings: Array<{
          target: EventTarget;
          type: string;
          listener: unknown;
          capture: boolean;
          live: boolean;
        }> = [];
        const recordAdd = (
          target: EventTarget,
          type: string,
          listener: unknown,
          options?: boolean | AddEventListenerOptions
        ) => {
          const capture = typeof options === 'boolean' ? options : !!options?.capture;
          if (
            !bindings.some(
              (item) =>
                item.live &&
                item.target === target &&
                item.type === type &&
                item.listener === listener &&
                item.capture === capture
            )
          )
            bindings.push({ target, type, listener, capture, live: true });
        };
        const recordRemove = (
          target: EventTarget,
          type: string,
          listener: unknown,
          options?: boolean | EventListenerOptions
        ) => {
          const capture = typeof options === 'boolean' ? options : !!options?.capture;
          for (const item of bindings)
            if (
              item.target === target &&
              item.type === type &&
              item.listener === listener &&
              item.capture === capture
            )
              item.live = false;
        };
        const add = HTMLElement.prototype.addEventListener;
        const remove = HTMLElement.prototype.removeEventListener;
        const addSpy = vi
          .spyOn(HTMLElement.prototype, 'addEventListener')
          .mockImplementation(function (this: HTMLElement, type, listener, options) {
            add.call(this, type, listener, options);
            recordAdd(this, type, listener, options);
            if (this !== outer && this.hasAttribute('data-pui-root')) {
              child = this;
              token = tree.getLogicalEventRouteSurfaceForTarget(this);
            }
          });
        const removeSpy = vi
          .spyOn(HTMLElement.prototype, 'removeEventListener')
          .mockImplementation(function (this: HTMLElement, type, listener, options) {
            remove.call(this, type, listener, options);
            recordRemove(this, type, listener, options);
          });
        const windowAdd = window.addEventListener.bind(window);
        const windowRemove = window.removeEventListener.bind(window);
        const windowAddSpy = vi
          .spyOn(window, 'addEventListener')
          .mockImplementation((type, listener, options) => {
            windowAdd(type, listener, options);
            recordAdd(window, type, listener, options);
          });
        const windowRemoveSpy = vi
          .spyOn(window, 'removeEventListener')
          .mockImplementation((type, listener, options) => {
            windowRemove(type, listener, options);
            recordRemove(window, type, listener, options);
          });
        const nativeFocus = HTMLElement.prototype.focus;
        const focus = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (
          this: HTMLElement,
          options
        ) {
          if (this === outer) return;
          child = this;
          token = tree.getLogicalEventRouteSurfaceForTarget(this);
          const atBoundary =
            boundary === 'fallback-allocation' ? leases.has(token) : publishing.has(token);
          if (atBoundary) nativeFocus.call(this, options);
        });
        try {
          await React.act(async () => ref.current.getExposes().request());
          armed = true;
          await React.act(async () => show());
          await flush();
          expect(setups).toBe(1);
          expect(child).toBeDefined();
          expect(token).not.toBeNull();
          if (throws) {
            expect(errors).toEqual([failure]);
            expect(cleanupErrors).toBe(boundary === 'fallback-publication-cleanup-error' ? 1 : 0);
            expect(host.querySelector('[data-startup-error]')).not.toBeNull();
            expect(child!.isConnected).toBe(false);
            expect(tree.getLogicalRoot(token!)).toBeNull();
            expect(leases.get(token!)?.released).toBe(true);
            expect(
              bindings.filter(
                (item) => item.live && (item.target === child || item.target === window)
              )
            ).toHaveLength(0);
            expect((FOCUS_CENTER as any).entries.has(token)).toBe(false);
            const beforeClick = clicks;
            child!.dispatchEvent(new MouseEvent('click'));
            expect(clicks).toBe(beforeClick);
            if (boundary !== 'fallback-allocation') {
              // Allocation failure can precede createRuntimeSession returning;
              // only an acquired session owes terminal lifecycle diagnostics.
              expect(disposed).toBe(1);
              expect(events.some((event) => event.type === 'instance.dispose.done')).toBe(true);
            }
          } else {
            expect(errors).toEqual([]);
            expect(child!.isConnected).toBe(true);
            expect(tree.getLogicalRoot(token!)).toBe(child);
            expect(leases.get(token!)?.released).toBe(false);
            expect((FOCUS_CENTER as any).entries.has(token)).toBe(true);
            expect(disposed).toBe(0);
          }
        } finally {
          armed = false;
          focus.mockRestore();
          await React.act(async () => app.unmount());
          await flush();
          addSpy.mockRestore();
          removeSpy.mockRestore();
          windowAddSpy.mockRestore();
          windowRemoveSpy.mockRestore();
          registerSpy.mockRestore();
          consoleError.mockRestore();
          settings.disableErrorCapturing = previousCapture;
          host.remove();
        }
      });
    }
  }
}

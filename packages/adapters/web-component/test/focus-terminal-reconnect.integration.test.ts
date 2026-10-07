import { expect, it, vi } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { asFocusable } from '@proto.ui/hooks';
import { asButton } from '../../../prototypes/base/src/button';
import { AdaptToWebComponent } from '../src';
import * as tree from '../src/platform/instance-tree';
const flush = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
for (const moves of ['move-twice', 'append-remove'] as const)
  it.each([false, true])(
    `WC owns reconnect during terminal invalidation ${moves} (throws=%s)`,
    async (throws) => {
      let setup = 0,
        disposed = 0,
        reentered = false;
      const errors: unknown[] = [],
        failure = new Error('reentrant fallback failure');
      const outerProto = definePrototype({
        name: `review-wc-reconnect-outer-${moves}-${throws}`,
        setup(def) {
          asButton();
          const f = asFocusable();
          def.expose.method('request', () => f.focus());
          return (r) => r.slot();
        },
      });
      const innerProto = definePrototype({
        name: `review-wc-reconnect-inner-${moves}-${throws}`,
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
            if (moves === 'move-twice') {
              inner.remove();
              outer.append(inner);
            }
            if (moves === 'append-remove') inner.remove();
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
        console.info('wc-reentrant-reconnect', JSON.stringify({ moves, throws, ...result }));
        if (moves === 'append-remove') {
          expect(setup).toBe(1);
          expect(disposed).toBe(1);
          expect(inner.isConnected).toBe(false);
          expect(inner._mountedOnce).toBe(false);
          expect(inner._controller).toBeNull();
          expect(tree.getLogicalRoot(oldToken)).toBeNull();
          outer.append(inner);
          await flush();
          result.newToken = inner._instanceToken !== oldToken;
          result.newController = !!inner._controller && inner._controller !== oldController;
          result.exposed = typeof inner.getExposes().focusSelf === 'function';
          result.text = inner.textContent;
        }
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

import { describe, expect, it, vi } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import {
  createWebMaterialSink,
  createCanvasBackdropLease,
} from '@proto.ui/adapter-base/web-material';
import * as liquid from '../../../prototypes/liquid-glass/src/accordion';
import { createVue2Adapter } from '../src';
import { Vue2Any, Vue2RuntimeAny, flushVue2, mountVue2Adapter } from './utils/vue2';

describe('Vue2 pending visibility convergence', () => {
  it.each(['ordinary', 'owned-frame', 'web-material-fallback'] as const)(
    'settles nested Liquid Accordion (%s) without an unrelated parent render',
    async (mode) => {
      const commits = vi.fn();
      const scope = document.createElement('div');
      const canvas = document.createElement('canvas');
      scope.append(canvas);
      const lease = createCanvasBackdropLease(scope, canvas);
      const adapt = createVue2Adapter(Vue2RuntimeAny);
      const parts = Object.fromEntries(
        Object.entries(liquid)
          .filter(([key]) => key.startsWith('accordion'))
          .map(([key, proto]) => [
            key,
            adapt(proto as any, {
              createVisualSink:
                mode === 'ordinary'
                  ? undefined
                  : mode === 'owned-frame'
                    ? () => ({ commit: commits, release() {} })
                    : (host, effects) =>
                        createWebMaterialSink(host, effects, {
                          source: lease,
                          palette: {
                            current: () => ({ revision: 0, colors: {} }),
                            subscribe: () => () => {},
                          },
                        }),
            }),
          ])
      );
      const host = document.createElement('div');
      document.body.append(host);
      const App = Vue2Any.extend({
        render(h: any) {
          const part = (role: string, ref: string, props: any = {}, children: any[] = []) =>
            h(
              parts[`accordion${role}`],
              { attrs: { ...props, 'data-demo-ref': ref }, key: ref },
              children
            );
          const nested = part('Root', 'nested', {}, [
            part('Item', 'nested-item', { value: 'nested' }, [
              part('Heading', 'nested-heading', {}, [part('Trigger', 'nested-trigger')]),
              part('Content', 'nested-content'),
            ]),
          ]);
          return part('Root', 'root', {}, [
            part('Item', 'item', { value: 'first' }, [
              part('Heading', 'heading', {}, [part('Trigger', 'trigger')]),
              part('Content', 'content', {}, [nested]),
            ]),
          ]);
        },
      });
      const vm = new App().$mount();
      host.append(vm.$el);
      const settle = async () => {
        for (let i = 0; i < 5; i++) await flushVue2();
      };
      const get = (ref: string) => host.querySelector<HTMLElement>(`[data-demo-ref="${ref}"]`);
      try {
        await settle();
        if (mode === 'owned-frame') expect(commits).toHaveBeenCalled();
        for (let cycle = 0; cycle < 3; cycle++) {
          get('trigger')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          await settle();
          expect(get('trigger')!.getAttribute('aria-expanded')).toBe('true');
          for (const ref of [
            'content',
            'nested',
            'nested-item',
            'nested-heading',
            'nested-trigger',
          ]) {
            expect(get(ref), ref).not.toBeNull();
            const state = (get(ref) as any).__vue__.__pui;
            expect(state.viewReady, ref).toBe(true);
            expect(state.pendingCommit, ref).toBe(false);
            expect(get(ref)!.hasAttribute('data-pui-view-pending'), ref).toBe(false);
          }
          get('nested-trigger')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          await settle();
          expect(get('nested-trigger')!.getAttribute('aria-expanded')).toBe('true');
          get('trigger')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          await settle();
          expect(get('trigger')!.getAttribute('aria-expanded')).toBe('false');
        }
      } finally {
        vm.$destroy();
        host.remove();
        lease.dispose();
      }
    }
  );
});

// Hold only Adapter commit acknowledgements; Vue still performs real VNode
// updates and presence transitions. No production scheduling code is replaced.
function heldCommitFixture() {
  let run: any;
  const callbacks: Array<() => void> = [];
  const Component: any = createVue2Adapter(Vue2RuntimeAny)(
    definePrototype({
      name: 'vue2-held-ready-commit',
      setup(def) {
        def.lifecycle.onCreated((r) => {
          run = r;
        });
        return () => 'ready';
      },
    }),
    { createVisualSink: () => ({ commit() {}, release() {} }) }
  );
  const nextTick = Component.prototype.$nextTick;
  const tick = vi.spyOn(Component.prototype, '$nextTick').mockImplementation(function (
    this: any,
    callback: any
  ) {
    if (callback && String(callback).includes('finishPendingCommit')) {
      callbacks.push(callback);
      return;
    }
    return nextTick.call(this, callback);
  });
  const mounted = mountVue2Adapter(Component);
  return {
    mounted,
    callbacks,
    get run() {
      return run;
    },
    cleanup() {
      tick.mockRestore();
      mounted.unmount();
    },
  };
}

it('does not let an old commit acknowledge or reveal a replacement view', async () => {
  const f = heldCommitFixture();
  try {
    await flushVue2();
    f.callbacks.shift()!();
    await flushVue2();
    f.mounted.vm.update();
    const oldCommit = f.callbacks.shift()!;
    expect(oldCommit).toBeTypeOf('function');
    const oldRoot = f.mounted.vm.$el;
    f.mounted.vm.invokeInCallbackScope(() => f.run.lifecycle.setPresent(false));
    await flushVue2();
    f.mounted.vm.invokeInCallbackScope(() => f.run.lifecycle.setPresent(true));
    await flushVue2();
    const newRoot = f.mounted.vm.$el;
    expect(newRoot).not.toBe(oldRoot);
    const state = f.mounted.vm.__pui;
    const signal = state.pendingSignal;
    expect(state.pendingCommit).toBe(true);
    expect(newRoot.hasAttribute('data-pui-view-pending')).toBe(true);
    oldCommit();
    expect(state.pendingSignal).toBe(signal);
    expect(state.pendingCommit).toBe(true);
    expect(newRoot.hasAttribute('data-pui-view-pending')).toBe(true);
    for (const callback of f.callbacks.splice(0)) callback();
    await flushVue2();
    expect(state.pendingCommit).toBe(false);
    expect(newRoot.hasAttribute('data-pui-view-pending')).toBe(false);
  } finally {
    f.cleanup();
  }
});

it.each(['hide', 'dispose', 'update'] as const)(
  'does not reveal after commit acknowledgement reenters %s',
  async (action) => {
    const f = heldCommitFixture();
    try {
      await flushVue2();
      const callback = f.callbacks.shift()!;
      const vm = f.mounted.vm,
        root = vm.$el,
        state = vm.__pui;
      const done = state.pendingSignal.done.bind(state.pendingSignal);
      state.pendingSignal.done = () => {
        done();
        if (action === 'hide')
          f.mounted.vm.invokeInCallbackScope(() => f.run.lifecycle.setPresent(false));
        if (action === 'dispose') vm.$destroy();
        if (action === 'update') vm.update();
      };
      const remove = vi.spyOn(root, 'removeAttribute');
      callback();
      expect(remove.mock.calls.filter(([name]) => name === 'data-pui-view-pending')).toEqual([]);
      if (action === 'update') {
        for (const next of f.callbacks.splice(0)) next();
        expect(root.hasAttribute('data-pui-view-pending')).toBe(false);
      }
      remove.mockRestore();
    } finally {
      f.cleanup();
    }
  }
);

it.each([new Error('commit failed'), undefined, 0])(
  'preserves a thrown acknowledgement and leaves pending visibility intact (%s)',
  async (failure) => {
    const f = heldCommitFixture();
    try {
      await flushVue2();
      const callback = f.callbacks.shift()!;
      const root = f.mounted.vm.$el;
      f.mounted.vm.__pui.pendingSignal.done = () => {
        throw failure;
      };
      let threw = false,
        caught: unknown;
      try {
        callback();
      } catch (error) {
        threw = true;
        caught = error;
      }
      expect(threw).toBe(true);
      expect(caught).toBe(failure);
      expect(root.hasAttribute('data-pui-view-pending')).toBe(true);
    } finally {
      f.cleanup();
    }
  }
);

import { describe, expect, it } from 'vitest';
import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { createVueAdapter } from '../src/adapt';
import { VueAny, flushVue } from './utils/vue';

describe('adapter-vue: L1 view intent', () => {
  it('creates the owner during setup and materializes repeatable views from latest intent', async () => {
    const originalRaf = globalThis.requestAnimationFrame;
    const originalCancelRaf = globalThis.cancelAnimationFrame;
    let frameId = 0;
    const frames = new Map<number, FrameRequestCallback>();
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      const id = ++frameId;
      frames.set(id, callback);
      return id;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((id: number) =>
      frames.delete(id)) as typeof cancelAnimationFrame;

    const calls = { setup: 0, created: 0, render: 0, mounted: 0, unmounted: 0, disposed: 0 };
    let run!: RunHandle<any>;
    const proto = definePrototype({
      name: 'vue-view-intent',
      setup(def) {
        calls.setup += 1;
        def.feedback.style.use(tw('rounded-md p-4'));
        def.lifecycle.onCreated((nextRun) => {
          calls.created += 1;
          run = nextRun;
          run.lifecycle.setPresent(false);
        });
        def.lifecycle.onMounted(() => {
          calls.mounted += 1;
        });
        def.lifecycle.onUnmounted(() => {
          calls.unmounted += 1;
        });
        def.lifecycle.onBeforeDispose(() => {
          calls.disposed += 1;
        });
        def.expose('view', {
          show: () => run.lifecycle.setPresent(true),
          hide: () => run.lifecycle.setPresent(false),
        });
        return (renderer) => {
          calls.render += 1;
          return renderer.el('div', 'ok');
        };
      },
    });

    const Component = createVueAdapter(VueAny)(proto, { schedule: (task) => task() });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const app = VueAny.createApp(Component);
    const vm = app.mount(host) as any;

    try {
      expect(host.querySelector('[data-pui-root]')).toBeNull();
      expect(calls).toEqual({
        setup: 1,
        created: 1,
        render: 0,
        mounted: 0,
        unmounted: 0,
        disposed: 0,
      });

      vm.getExposes().view.show();
      await flushVue();
      await flushVue();
      const firstRoot = host.querySelector<HTMLElement>('[data-pui-root]');
      expect(firstRoot).not.toBeNull();
      expect(firstRoot?.hasAttribute('data-pui-view-pending')).toBe(false);
      expect(firstRoot?.getAttribute('data-pui-style')).toBe('rounded-md p-4');
      expect(calls.mounted).toBe(1);

      vm.getExposes().view.hide();
      vm.getExposes().view.show();
      await flushVue();
      const remountedRoot = host.querySelector<HTMLElement>('[data-pui-root]');
      expect(remountedRoot).not.toBeNull();
      expect(remountedRoot?.hasAttribute('data-pui-view-pending')).toBe(false);
      expect(remountedRoot?.getAttribute('data-pui-style')).toBe('rounded-md p-4');
      expect(calls.unmounted).toBe(0);

      vm.getExposes().view.hide();
      await flushVue();
      await flushVue();
      expect(host.querySelector('[data-pui-root]')).toBeNull();
      expect(calls.unmounted).toBe(1);

      vm.getExposes().view.show();
      await flushVue();
      while (frames.size > 0) {
        const [id, frame] = frames.entries().next().value!;
        frames.delete(id);
        frame(16.7);
        await flushVue();
      }
      expect(host.querySelector('[data-pui-root]')).not.toBeNull();
      expect(calls.setup).toBe(1);
      expect(calls.created).toBe(1);
      expect(calls.mounted).toBe(2);
    } finally {
      app.unmount();
      host.remove();
      globalThis.requestAnimationFrame = originalRaf;
      globalThis.cancelAnimationFrame = originalCancelRaf;
    }

    expect(calls.disposed).toBe(1);
  });
});

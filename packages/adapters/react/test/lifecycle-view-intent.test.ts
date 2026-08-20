import { describe, expect, it } from 'vitest';
import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { createReactAdapter } from '../src/adapt';
import { createFakeReactRuntime } from './utils/fake-react';

describe('adapter-react: L1 view intent', () => {
  it('creates the owner before its first view and reconciles the latest intent across epochs', async () => {
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
      name: 'react-view-intent',
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
    const fake = createFakeReactRuntime({ context: true });
    const Component = createReactAdapter(fake.runtime)(proto, {
      schedule: (task) => task(),
    });
    const mounted = fake.render(Component);

    try {
      expect(mounted.root).toBeNull();
      expect(calls).toEqual({
        setup: 1,
        created: 1,
        render: 0,
        mounted: 0,
        unmounted: 0,
        disposed: 0,
      });

      mounted.ref.current.getExposes().view.show();
      mounted.update();
      await Promise.resolve();
      mounted.update();
      expect(mounted.root).not.toBeNull();
      expect(mounted.root?.hasAttribute('data-pui-view-pending')).toBe(false);
      expect(mounted.root?.getAttribute('data-pui-style')).toBe('rounded-md p-4');
      expect(calls.mounted).toBe(1);

      // Reversal before React renders keeps the current view attached.
      mounted.ref.current.getExposes().view.hide();
      mounted.ref.current.getExposes().view.show();
      mounted.update();
      expect(mounted.root).not.toBeNull();
      expect(calls.unmounted).toBe(0);

      mounted.ref.current.getExposes().view.hide();
      mounted.update();
      await Promise.resolve();
      mounted.update();
      expect(mounted.root).toBeNull();
      expect(calls.unmounted).toBe(1);

      mounted.ref.current.getExposes().view.show();
      mounted.update();
      await Promise.resolve();
      mounted.update();
      while (frames.size > 0) {
        const [id, frame] = frames.entries().next().value!;
        frames.delete(id);
        frame(16.7);
        mounted.update();
      }
      expect(mounted.root).not.toBeNull();
      expect(mounted.root?.hasAttribute('data-pui-view-pending')).toBe(false);
      expect(mounted.root?.getAttribute('data-pui-style')).toBe('rounded-md p-4');
      expect(calls.setup).toBe(1);
      expect(calls.created).toBe(1);
      expect(calls.mounted).toBe(2);
    } finally {
      mounted.unmount();
      globalThis.requestAnimationFrame = originalRaf;
      globalThis.cancelAnimationFrame = originalCancelRaf;
    }
    await Promise.resolve();
    expect(calls.disposed).toBe(1);
  });
});

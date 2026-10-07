import { asFocusable, asFocusEntry } from '@proto.ui/hooks';
import { describe, expect, it, vi } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { createVueAdapter } from '../src/adapt';
import { flushVue, VueAny } from './utils/vue';

describe('adapter-vue: KeepAlive lifecycle boundary', () => {
  it('maps deactivation/reactivation to view epochs without recreating the Proto instance', async () => {
    const calls = { setup: 0, created: 0, mounted: 0, unmounted: 0, disposed: 0 };
    const proto = definePrototype({
      name: 'vue-keep-alive-view-epochs',
      setup(def) {
        calls.setup += 1;
        def.lifecycle.onCreated(() => (calls.created += 1));
        def.lifecycle.onMounted(() => (calls.mounted += 1));
        def.lifecycle.onUnmounted(() => (calls.unmounted += 1));
        def.lifecycle.onBeforeDispose(() => (calls.disposed += 1));
        return (run) => run.el('div', 'ok');
      },
    });
    const Component = createVueAdapter(VueAny)(proto);
    const active = VueAny.ref(true);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const app = VueAny.createApp({
      setup() {
        return () =>
          VueAny.h(VueAny.KeepAlive, null, () =>
            active.value ? VueAny.h(Component, { key: 'proto' }) : null
          );
      },
    });

    app.mount(host);
    await flushVue();
    expect(calls).toEqual({ setup: 1, created: 1, mounted: 1, unmounted: 0, disposed: 0 });

    active.value = false;
    await flushVue();
    expect(calls).toEqual({ setup: 1, created: 1, mounted: 1, unmounted: 1, disposed: 0 });

    active.value = true;
    await flushVue();
    await flushVue();
    expect(calls).toEqual({ setup: 1, created: 1, mounted: 2, unmounted: 1, disposed: 0 });

    app.unmount();
    await flushVue();
    expect(calls.disposed).toBe(1);
    host.remove();
  });
});

// Actual Vue KeepAlive changes only the physical view epoch of this owner.
it.each(['entry', 'native', 'programmatic'] as const)(
  'preserves the exhausted %s allowance through KeepAlive',
  async (kind) => {
    let setups = 0;
    const proto = definePrototype({
      name: `vue-keep-budget-${kind}`,
      setup(def) {
        setups++;
        const target = asFocusable(),
          entry = asFocusEntry();
        entry.configure({ strategy: 'descendant-first', fallback: 'none' });
        def.expose.method('request', () => {
          if (kind === 'entry') entry.focus();
          else if (kind === 'native') target.focusSelf();
          else target.focus();
        });
        return (r) => r.el('button', 'Target');
      },
    });
    const Component = createVueAdapter(VueAny)(proto),
      active = VueAny.ref(true),
      ref = VueAny.ref(null),
      host = document.createElement('div');
    document.body.append(host);
    const app = VueAny.createApp({
      render: () =>
        VueAny.h(VueAny.KeepAlive, null, () =>
          active.value ? VueAny.h(Component, { key: 'owner', ref }) : null
        ),
    });
    app.mount(host);
    await flushVue();
    await flushVue();
    const frames: FrameRequestCallback[] = [];
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    let attempts = 0;
    const focus = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(() => {
      attempts++;
    });
    const settle = async () => {
      await flushVue();
      await flushVue();
    };
    const drain = async () => {
      for (let i = 0; frames.length && i < 12; i++) {
        const callbacks = frames.splice(0);
        callbacks.forEach((cb) => cb(performance.now()));
        await settle();
      }
      expect(frames).toHaveLength(0);
    };
    try {
      ref.value.getExposes().request();
      await settle();
      await drain();
      expect(attempts).toBe(4);
      for (let cycle = 0; cycle < 3; cycle++) {
        active.value = false;
        await settle();
        active.value = true;
        await settle();
        const before = attempts;
        await drain();
        expect(attempts).toBe(before);
        expect(setups).toBe(1);
      }
      attempts = 0;
      ref.value.getExposes().request();
      await settle();
      await drain();
      expect(attempts).toBe(4);
    } finally {
      focus.mockRestore();
      raf.mockRestore();
      app.unmount();
      host.remove();
      await settle();
    }
  }
);

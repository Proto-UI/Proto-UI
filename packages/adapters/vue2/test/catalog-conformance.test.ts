import { describe, expect, it, vi } from 'vitest';
import { createContextKey, definePrototype } from '@proto.ui/core';
import { createVue2Adapter } from '../src/adapt';
import { Vue2Any, Vue2RuntimeAny, createMountedVue2Adapter, flushVue2 } from './utils/vue2';

describe('Vue 2 catalog follow-through', () => {
  it('projects default-action requests and stops global delivery at destroy', async () => {
    const global = vi.fn();
    const proto = definePrototype({
      name: 'vue2-catalog-events',
      setup(def) {
        def.event.on('press.commit', (_run, event) =>
          event.control.requestDefaultActionPrevention()
        );
        def.event.onGlobal('key.down', global);
        return (r) => r.el('span', 'events');
      },
    });
    const mounted = createMountedVue2Adapter(proto);
    try {
      await flushVue2();
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      mounted.root!.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(global).toHaveBeenCalledOnce();
    } finally {
      mounted.unmount();
    }
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(global).toHaveBeenCalledOnce();
  });

  it('retains Context, State and Expose identity across keep-alive and clears terminal records', async () => {
    const key = createContextKey<{ value: number }>('vue2-retained-context');
    let setups = 0;
    const proto = definePrototype({
      name: 'vue2-catalog-retained',
      setup(def) {
        setups++;
        const count = def.state.numberDiscrete('count', 0);
        def.expose.state('count', count);
        def.expose.method('increment', () => count.set(count.get() + 1, 'reason: app update'));
        def.context.provide(key, { value: 0 });
        def.context.subscribe(key);
        def.lifecycle.onMounted((run) =>
          run.context.update(key, (prev) => ({ value: prev.value + 1 }))
        );
        return (r) => r.el('span', String(r.read.context.read(key).value));
      },
    });
    const Component = createVue2Adapter(Vue2RuntimeAny)(proto);
    const active = Vue2Any.observable({ value: true });
    const host = document.createElement('div');
    document.body.append(host);
    const App = Vue2Any.extend({
      render(h: (type: unknown, props?: unknown, children?: unknown[]) => unknown) {
        return h(
          'keep-alive',
          {},
          active.value ? [h(Component, { key: 'owner', ref: 'target' })] : []
        );
      },
    });
    const vm = new App().$mount();
    host.append(vm.$el);
    try {
      await flushVue2();
      const target = vm.$refs.target;
      const first = target.getExposes();
      const count = first.count;
      const increment = first.increment;
      const seen = vi.fn();
      const off = count.subscribe(seen);
      expect(count.set).toBeUndefined();
      first.injected = true;
      expect(target.getExposes()).not.toHaveProperty('injected');
      increment();
      expect(count.get()).toBe(1);
      expect(seen).toHaveBeenCalledOnce();
      expect(target.$el.textContent).toBe('0'); // Context update alone does not render.
      target.update();
      await flushVue2();
      expect(target.$el.textContent).toBe('1');
      const beforeDetach = target.getExposes().increment;
      active.value = false;
      await flushVue2();
      expect(target.getExposes().count).toBe(count);
      expect(target.getExposes().increment).toBe(beforeDetach);
      active.value = true;
      await flushVue2();
      await flushVue2();
      expect(vm.$refs.target).toBe(target);
      expect(setups).toBe(1);
      expect(target.getExposes().count).toBe(count);
      expect(count.get()).toBe(1);
      target.update();
      await flushVue2();
      expect(target.$el.textContent).toBe('2');
      off();
      vm.$destroy();
      await flushVue2();
      expect(target.getExposes()).toEqual({});
      expect(() => increment()).toThrow(/terminal disposal/);
    } finally {
      vm.$destroy();
      host.remove();
    }
  });

  it('uses current outward listeners and keeps signal declarations and listeners out of public data', async () => {
    const old = vi.fn(),
      current = vi.fn(),
      vueListener = vi.fn();
    let raw: unknown;
    const proto = definePrototype({
      name: 'vue2-catalog-signal',
      setup(def) {
        def.expose.event('save', { payload: 'json' });
        def.lifecycle.onMounted((run) => {
          raw = run.props.getRaw();
        });
        def.event.on('press.commit', (run) => run.expose.emit('save', { saved: true }));
        return (r) => r.el('span', 'save');
      },
    });
    const Component = createVue2Adapter(Vue2RuntimeAny)(proto);
    const state = Vue2Any.observable({ listener: old });
    const host = document.createElement('div');
    document.body.append(host);
    const App = Vue2Any.extend({
      render(h: (type: unknown, props: unknown) => unknown) {
        return h(Component, {
          ref: 'target',
          attrs: { onSave: state.listener },
          on: { save: vueListener },
        });
      },
    });
    const vm = new App().$mount();
    host.append(vm.$el);
    try {
      await flushVue2();
      expect(raw).not.toHaveProperty('onSave');
      expect(vm.$refs.target.getExposes()).not.toHaveProperty('save');
      vm.$refs.target.$el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(old).toHaveBeenCalledOnce();
      state.listener = current;
      await flushVue2();
      expect(current).not.toHaveBeenCalled(); // No replay on listener replacement.
      vm.$refs.target.$el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(old).toHaveBeenCalledOnce();
      expect(current).toHaveBeenCalledWith({ saved: true }, undefined);
      expect(vueListener).toHaveBeenCalledTimes(2);
    } finally {
      vm.$destroy();
      host.remove();
    }
  });
});

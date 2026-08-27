import { describe, expect, it, vi } from 'vitest';
import type { Prototype } from '@proto.ui/core';

import { createVue2Adapter } from '../src/adapt';
import { createMountedVue2Adapter, flushVue2, Vue2Any, Vue2RuntimeAny } from './utils/vue2';

describe('adapter-vue2: events', () => {
  it('enables native events only after the Vue 2 commit boundary', async () => {
    const calls: string[] = [];

    const proto: Prototype = {
      name: 'vue2-event-gate-basic',
      setup(def: any) {
        def.event.on('press.commit', () => calls.push('press.commit'));
        return (r: any) => r.el('div', {}, ['ok']);
      },
    };

    const mounted = createMountedVue2Adapter(proto);

    mounted.root?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(calls).toEqual([]);

    await flushVue2();

    mounted.root?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(calls).toEqual(['press.commit']);

    mounted.unmount();
  });

  it('disables native events after Vue 2 destroy', async () => {
    const calls: string[] = [];

    const proto: Prototype = {
      name: 'vue2-event-after-unmount',
      setup(def: any) {
        def.event.on('press.commit', () => calls.push('press.commit'));
        def.lifecycle.onUnmounted(() => calls.push('unmounted'));
        return (r: any) => r.el('div', {}, ['ok']);
      },
    };

    const mounted = createMountedVue2Adapter(proto);
    await flushVue2();

    mounted.root?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(calls).toEqual(['press.commit']);

    const root = mounted.root;
    mounted.unmount();
    await flushVue2();

    root?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(calls).toEqual(['press.commit', 'unmounted']);
  });

  it('delivers outward signals through both Vue 2 listeners and typed onX props', async () => {
    const proto: Prototype = {
      name: 'vue2-outward-signal-listeners',
      setup(def: any) {
        def.expose.event('save', { payload: 'json' });
        def.event.on('press.commit', (run: any) => run.expose.emit('save', { saved: true }));
        return (r: any) => r.el('button', {}, ['Save']);
      },
    };
    const Component = createVue2Adapter(Vue2RuntimeAny)(proto);
    const onVueListener = vi.fn();
    const onTypedProp = vi.fn();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const App = Vue2Any.extend({
      render(h: any) {
        return h(Component, {
          attrs: { onSave: onTypedProp },
          on: { save: onVueListener },
          ref: 'target',
        });
      },
    });
    const vm = new App().$mount();
    host.appendChild(vm.$el);

    try {
      await flushVue2();
      (vm.$refs as Record<string, any>).target.$el.dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      );
      await flushVue2();

      expect(onVueListener).toHaveBeenCalledWith({ saved: true }, undefined);
      expect(onTypedProp).toHaveBeenCalledWith({ saved: true }, undefined);
    } finally {
      vm.$destroy();
      host.remove();
    }
  });
});

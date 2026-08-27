import { describe, expect, it } from 'vitest';
import { definePrototype, type Prototype } from '@proto.ui/core';
import type { RuntimeLifecycleEvent } from '@proto.ui/runtime';

import { createVue2Adapter } from '../src/adapt';
import { createMountedVue2Adapter, flushVue2, Vue2Any, Vue2RuntimeAny } from './utils/vue2';

describe('adapter-vue2: lifecycle', () => {
  it('runs Proto lifecycle hooks through Vue 2 mount and destroy', async () => {
    const calls: string[] = [];

    const proto: Prototype = {
      name: 'vue2-life-basic',
      setup(def) {
        def.lifecycle.onCreated(() => calls.push('created'));
        def.lifecycle.onMounted(() => calls.push('mounted'));
        def.lifecycle.onUnmounted(() => calls.push('unmounted'));
        return (r) => [r.el('div', 'ok')];
      },
    };

    const mounted = createMountedVue2Adapter(proto);
    await flushVue2();

    expect(calls.slice(0, 2)).toEqual(['created', 'mounted']);

    mounted.unmount();
    await flushVue2();

    expect(calls.includes('unmounted')).toBe(true);
  });

  it('forwards structured lifecycle diagnostics across update and terminal disposal', async () => {
    const trace: RuntimeLifecycleEvent[] = [];
    const proto: Prototype = {
      name: 'vue2-lifecycle-events',
      setup() {
        return (r) => [r.el('div', 'ok')];
      },
    };
    const Component = createVue2Adapter(Vue2RuntimeAny)(proto, {
      schedule: (task) => task(),
      diagnostics: { onLifecycleEvent: (event) => trace.push(event) },
    });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const vm = new (Component as any)().$mount();
    host.appendChild(vm.$el);

    await flushVue2();
    expect(trace.some((event) => event.type === 'mount.mounted')).toBe(true);

    trace.length = 0;
    vm.update();
    await flushVue2();
    expect(trace.some((event) => event.type === 'update.updated')).toBe(true);

    trace.length = 0;
    vm.$destroy();
    await flushVue2();
    expect(trace.at(-1)).toEqual({ type: 'instance.dispose.done' });
    host.remove();
  });

  it('maps keep-alive deactivation to repeatable view epochs without recreating the owner', async () => {
    const calls = { setup: 0, mounted: 0, unmounted: 0, disposed: 0 };
    const proto = definePrototype({
      name: 'vue2-keep-alive-view-epochs',
      setup(def) {
        calls.setup += 1;
        def.lifecycle.onMounted(() => (calls.mounted += 1));
        def.lifecycle.onUnmounted(() => (calls.unmounted += 1));
        def.lifecycle.onBeforeDispose(() => (calls.disposed += 1));
        return (r) => [r.el('div', 'ok')];
      },
    });
    const Component = createVue2Adapter(Vue2RuntimeAny)(proto);
    const state = Vue2Any.observable({ active: true });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const Root = Vue2Any.extend({
      render(h: any) {
        return h('keep-alive', [state.active ? h(Component, { key: 'proto' }) : null]);
      },
    });
    const vm = new Root().$mount();
    host.appendChild(vm.$el);

    await flushVue2();
    expect(calls).toEqual({ setup: 1, mounted: 1, unmounted: 0, disposed: 0 });

    state.active = false;
    await flushVue2();
    expect(calls).toEqual({ setup: 1, mounted: 1, unmounted: 1, disposed: 0 });

    state.active = true;
    await flushVue2();
    await flushVue2();
    expect(calls).toEqual({ setup: 1, mounted: 2, unmounted: 1, disposed: 0 });

    vm.$destroy();
    await flushVue2();
    expect(calls.disposed).toBe(1);
    host.remove();
  });
});

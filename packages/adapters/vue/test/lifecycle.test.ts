import { describe, expect, it } from 'vitest';
import { definePrototype, type Prototype } from '@proto.ui/core';

import { createVueAdapter } from '../src/adapt';
import { createMountedVueAdapter, flushVue, VueAny } from './utils/vue';

describe('adapter-vue: lifecycle', () => {
  it('completes queued watcher updates before the next Props replacement', async () => {
    const seen: string[] = [];
    const proto = definePrototype({
      name: 'vue-queued-props-update',
      setup(def) {
        def.props.define({ label: { type: 'string', default: 'fallback' } });
        def.props.watch(['label'], (run, next) => {
          seen.push(next.label);
          run.update();
        });
        return (r) => r.el('output', r.read.props.get().label);
      },
    });
    const Component = createVueAdapter(VueAny)(proto);
    const raw = VueAny.shallowRef({ label: 'First' });
    const host = document.createElement('div');
    document.body.append(host);
    const app = VueAny.createApp({ render: () => VueAny.h(Component, raw.value) });
    try {
      app.mount(host);
      for (let turn = 0; turn < 3; turn++) await flushVue();
      expect(host.querySelector('output')?.textContent).toBe('First');
      for (const label of ['Second', 'Third']) {
        raw.value = { label };
        for (let turn = 0; turn < 3; turn++) await flushVue();
        expect(host.querySelector('output')?.textContent).toBe(label);
      }
      expect(seen).toEqual(['Second', 'Third']);
    } finally {
      app.unmount();
      host.remove();
    }
  });

  it('created runs before mounted and unmounted runs on app unmount', async () => {
    const calls: string[] = [];

    const proto: Prototype = {
      name: 'vue-life-basic',
      setup(def) {
        def.lifecycle.onCreated(() => calls.push('created'));
        def.lifecycle.onMounted(() => calls.push('mounted'));
        def.lifecycle.onUnmounted(() => calls.push('unmounted'));
        return (r) => [r.el('div', 'ok')];
      },
    };

    const mounted = createMountedVueAdapter(proto);
    await flushVue();

    expect(calls.slice(0, 2)).toEqual(['created', 'mounted']);

    mounted.unmount();
    await flushVue();

    expect(calls.includes('unmounted')).toBe(true);
  });
});

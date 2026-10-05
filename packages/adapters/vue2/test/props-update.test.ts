import { describe, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';

import { createVue2Adapter } from '../src/adapt';
import { Vue2Any, Vue2RuntimeAny, flushVue2 } from './utils/vue2';

describe('adapter-vue2: props update', () => {
  it('completes queued watcher updates before the next Props replacement', async () => {
    const seen: string[] = [];
    const proto = definePrototype({
      name: 'vue2-queued-props-update',
      setup(def) {
        def.props.define({ label: { type: 'string', default: 'fallback' } });
        def.props.watch(['label'], (run, next) => {
          seen.push(next.label);
          run.update();
        });
        return (r) => r.el('output', r.read.props.get().label);
      },
    });
    const Component = createVue2Adapter(Vue2RuntimeAny)(proto);
    const host = document.createElement('div');
    document.body.append(host);
    const Root = Vue2Any.extend({
      data: () => ({ raw: { label: 'First' } }),
      render(h: any) {
        return h(Component, { attrs: this.raw });
      },
    });
    const vm = new Root();
    try {
      vm.$mount();
      host.append(vm.$el);
      for (let turn = 0; turn < 3; turn++) await flushVue2();
      expect(host.querySelector('output')?.textContent).toBe('First');
      for (const label of ['Second', 'Third']) {
        vm.raw = { label };
        vm.$forceUpdate();
        for (let turn = 0; turn < 3; turn++) await flushVue2();
        expect(host.querySelector('output')?.textContent).toBe(label);
      }
      expect(seen).toEqual(['Second', 'Third']);
    } finally {
      vm.$destroy();
      host.remove();
    }
  });

  it('re-reads Proto props from Vue 2 attrs after the parent updates', async () => {
    const proto = definePrototype({
      name: 'vue2-props-update-basic',
      setup(def) {
        def.props.define({
          label: { type: 'string', default: 'fallback' },
        });
        return (r) => [r.el('div', String(r.read.props.get().label))];
      },
    });

    const Component = createVue2Adapter(Vue2RuntimeAny)(proto);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const state = Vue2Any.observable({ label: 'First' });

    const Root = Vue2Any.extend({
      render(h: any) {
        return h(Component, {
          ref: 'target',
          attrs: {
            label: state.label,
          },
        });
      },
    });

    const vm = new Root().$mount();
    host.appendChild(vm.$el);
    await flushVue2();

    expect(host.textContent).toContain('First');

    state.label = 'Second';
    vm.$forceUpdate();
    await flushVue2();
    vm.$refs.target?.update?.();
    await flushVue2();

    expect(host.textContent).toContain('Second');

    vm.$destroy();
    host.remove();
  });
});

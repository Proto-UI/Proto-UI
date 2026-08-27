import { describe, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';

import { createVue2Adapter } from '../src/adapt';
import { Vue2Any, Vue2RuntimeAny, flushVue2 } from './utils/vue2';

describe('adapter-vue2: slots', () => {
  it('maps Proto slot() to the Vue 2 default slot', async () => {
    const proto = definePrototype({
      name: 'vue2-slot-basic',
      setup() {
        return (r) => [r.el('div', {}, [r.slot()])];
      },
    });

    const Component = createVue2Adapter(Vue2RuntimeAny)(proto);
    const host = document.createElement('div');
    document.body.appendChild(host);

    const Root = Vue2Any.extend({
      render(h: any) {
        return h(Component, { ref: 'c' }, [h('span', { class: 'inner' }, ['hello'])]);
      },
    });

    const vm = new Root().$mount();
    host.appendChild(vm.$el);
    await flushVue2();
    await flushVue2();
    await flushVue2();

    expect(host.querySelector('.inner')?.textContent).toBe('hello');

    vm.$destroy();
    host.remove();
  });
});

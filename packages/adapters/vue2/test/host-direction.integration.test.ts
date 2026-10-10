import { expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { createVue2Adapter } from '../src/adapt';
import { createMountedVue2Adapter, flushVue2, Vue2Any, Vue2RuntimeAny } from './utils/vue2';

it('preserves a consumer DOM direction across unrelated Vue2 view commits', async () => {
  const mounted = createMountedVue2Adapter(
    definePrototype({
      name: 'vue2-unowned-native-direction',
      setup: () => () => 'Native direction',
    })
  );
  await flushVue2();
  try {
    mounted.host.dir = 'rtl';
    const root = mounted.root!;
    expect(root.hasAttribute('dir')).toBe(false);
    for (const direction of ['ltr', 'auto', 'rtl']) {
      root.setAttribute('dir', direction);
      mounted.vm.update();
      await flushVue2();
      expect(root.getAttribute('dir')).toBe(direction);
    }
    root.removeAttribute('dir');
    mounted.vm.update();
    await flushVue2();
    expect(root.hasAttribute('dir')).toBe(false);
  } finally {
    mounted.unmount();
  }
});

it('continues to update and revoke explicitly supplied host direction', async () => {
  const state = Vue2Any.observable({ direction: 'ltr' as string | undefined });
  const Component = createVue2Adapter(Vue2RuntimeAny)(
    definePrototype({
      name: 'vue2-owned-native-direction',
      setup: () => () => 'Controlled direction',
    })
  );
  const Root = Vue2Any.extend({
    render(h: any) {
      return h(Component, { attrs: { dir: state.direction } });
    },
  });
  const vm = new Root().$mount();
  document.body.append(vm.$el);
  await flushVue2();
  try {
    expect(vm.$el.getAttribute('dir')).toBe('ltr');
    state.direction = 'rtl';
    await flushVue2();
    expect(vm.$el.getAttribute('dir')).toBe('rtl');
    state.direction = undefined;
    await flushVue2();
    expect(vm.$el.hasAttribute('dir')).toBe(false);
  } finally {
    vm.$destroy();
    vm.$el.remove();
  }
});

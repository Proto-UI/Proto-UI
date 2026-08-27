import VueDefault from 'vue';

import { createVue2Adapter } from '../../src/adapt';
import type { Vue2Runtime } from '../../src/types';

export const Vue2Any = VueDefault as any;

export const Vue2RuntimeAny: Vue2Runtime = {
  extend: Vue2Any.extend.bind(Vue2Any),
  nextTick: Vue2Any.nextTick.bind(Vue2Any),
  set: Vue2Any.set.bind(Vue2Any),
  delete: Vue2Any.delete.bind(Vue2Any),
};

export async function flushVue2() {
  await Promise.resolve();
  await Vue2Any.nextTick();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await Promise.resolve();
}

export function mountVue2Adapter(Component: any, props: Record<string, unknown> = {}) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const {
    class: className,
    style,
    hostClass,
    surfaceClass,
    hostStyle,
    surfaceStyle,
    ...attrs
  } = props;

  const Root = Vue2Any.extend({
    render(h: any) {
      return h(Component, {
        props: { hostClass, surfaceClass, hostStyle, surfaceStyle },
        attrs,
        class: className,
        style,
      });
    },
  });
  const vm = new Root().$mount();
  host.appendChild(vm.$el);
  const componentVm = vm.$children?.[0] ?? vm;
  const root = host.firstElementChild as HTMLElement | null;

  return {
    host,
    root,
    rootVm: vm,
    vm: componentVm,
    unmount() {
      vm.$destroy();
      host.innerHTML = '';
      host.remove();
    },
  };
}

export function createMountedVue2Adapter(proto: any, props: Record<string, unknown> = {}) {
  const adapter = createVue2Adapter(Vue2RuntimeAny);
  const Component = adapter(proto);
  return mountVue2Adapter(Component, props);
}

import { Vue2Any, Vue2RuntimeAny, flushVue2 } from './utils/vue2';
import { createVue2Adapter } from '../src';
import { focusShadowAcquisitionConformance } from '../../base/test/fixtures/focus-shadow-acquisition-conformance';
focusShadowAcquisitionConformance('vue2', async (proto, container) => {
  const Component = createVue2Adapter(Vue2RuntimeAny)(proto);
  const app = new (Vue2Any.extend({
    render(h: any) {
      return h(Component);
    },
  }))().$mount();
  container.append(app.$el);
  await flushVue2();
  return {
    root: container.firstElementChild as HTMLElement,
    request: () => app.$children[0].getExposes().request(),
    flush: async () => {
      await Vue2Any.nextTick();
      await Promise.resolve();
    },
    unmount: async () => {
      app.$destroy();
      container.innerHTML = '';
    },
  };
});

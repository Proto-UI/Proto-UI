import { createVue2Adapter } from '../src/adapt';
import { Vue2Any, Vue2RuntimeAny, flushVue2 } from './utils/vue2';
import { describeColorSchemeIntegration } from '../../base/test-utils/color-scheme';

describeColorSchemeIntegration('vue2', async (proto, options) => {
  const host = document.createElement('div');
  document.body.append(host);
  const Component = createVue2Adapter(Vue2RuntimeAny)(proto, options);
  const props = Vue2Any.observable({ value: {} });
  const App = Vue2Any.extend({
    render(this: any, h: any) {
      return h(Component, { attrs: props.value, ref: 'target' });
    },
  });
  const vm = new App().$mount();
  host.append(vm.$el);
  const settle = async (action: () => void) => {
    action();
    await flushVue2();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await flushVue2();
  };
  return {
    host,
    act: settle,
    setProps: (next, concurrent) =>
      settle(() => {
        props.value = next;
        concurrent?.();
      }),
    setPresent: (present) =>
      settle(() => vm.$refs.target.getExposes().view[present ? 'show' : 'hide']()),
    update: () => settle(() => vm.$refs.target.update()),
    async unmount() {
      await settle(() => vm.$destroy());
      host.remove();
    },
  };
});

import { createVue2Adapter } from '../src/adapt';
import { Vue2Any, Vue2RuntimeAny, flushVue2 } from './utils/vue2';
import { templateStyleConformance } from '../../base/test/fixtures/template-style-conformance';

templateStyleConformance('vue2', async (proto) => {
  const host = document.createElement('div');
  document.body.append(host);
  const Component = createVue2Adapter(Vue2RuntimeAny)(proto);
  const App = Vue2Any.extend({
    render(h: any) {
      return h(
        Component,
        { ref: 'target', class: 'caller-root p-8', attrs: { 'data-pui-style': 'p-6' } },
        [
          h(
            'b',
            {
              class: 'caller-slot p-8',
              attrs: { 'data-caller-slot': '', 'data-pui-style': 'p-6 opacity-100' },
            },
            'caller'
          ),
        ]
      );
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
  await settle(() => {});
  return {
    host,
    update: () => settle(() => vm.$refs.target.update()),
    async unmount() {
      await settle(() => vm.$destroy());
      host.remove();
    },
  };
});

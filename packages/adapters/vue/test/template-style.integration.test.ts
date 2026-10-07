import { createVueAdapter } from '../src/adapt';
import { VueAny, flushVue } from './utils/vue';
import { templateStyleConformance } from '../../base/test/fixtures/template-style-conformance';

templateStyleConformance('vue', async (proto) => {
  const host = document.createElement('div');
  document.body.append(host);
  const Component = createVueAdapter(VueAny)(proto);
  const ref = VueAny.ref(null);
  const app = VueAny.createApp({
    render: () =>
      VueAny.h(Component, { ref, class: 'caller-root p-8', 'data-pui-style': 'p-6' }, () => [
        VueAny.h(
          'b',
          { 'data-caller-slot': '', class: 'caller-slot p-8', 'data-pui-style': 'p-6 opacity-100' },
          'caller'
        ),
      ]),
  });
  const settle = async (action: () => void) => {
    action();
    await flushVue();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await flushVue();
  };
  await settle(() => app.mount(host));
  return {
    host,
    update: () => settle(() => ref.value.update()),
    async unmount() {
      await settle(() => app.unmount());
      host.remove();
    },
  };
});

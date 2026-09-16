import { createVueAdapter } from '../src/adapt';
import { VueAny, flushVue } from './utils/vue';
import { describeColorSchemeIntegration } from '../../base/test-utils/color-scheme';

describeColorSchemeIntegration('vue', async (proto, options) => {
  const host = document.createElement('div');
  document.body.append(host);
  const Component = createVueAdapter(VueAny)(proto, options);
  const props = VueAny.ref({});
  const ref = VueAny.ref(null);
  const app = VueAny.createApp({
    render: () => VueAny.h(Component, { ...props.value, ref }),
  });
  const settle = async (action: () => void) => {
    action();
    await flushVue();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await flushVue();
  };
  app.mount(host);
  return {
    host,
    act: settle,
    setProps: (next, concurrent) =>
      settle(() => {
        props.value = next;
        concurrent?.();
      }),
    setPresent: (present) => settle(() => ref.value.getExposes().view[present ? 'show' : 'hide']()),
    update: () => settle(() => ref.value.update()),
    async unmount() {
      await settle(() => app.unmount());
      host.remove();
    },
  };
});

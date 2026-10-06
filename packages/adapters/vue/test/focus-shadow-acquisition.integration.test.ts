import { VueAny, flushVue } from './utils/vue';
import { createVueAdapter } from '../src';
import { focusShadowAcquisitionConformance } from '../../base/test/fixtures/focus-shadow-acquisition-conformance';
focusShadowAcquisitionConformance('vue', async (proto, container) => {
  const Component = createVueAdapter(VueAny)(proto);
  const app = VueAny.createApp(Component),
    vm = app.mount(container);
  await flushVue();
  await flushVue();
  return {
    root: container.firstElementChild as HTMLElement,
    request: () => vm.getExposes().request(),
    flush: flushVue,
    unmount: async () => app.unmount(),
  };
});

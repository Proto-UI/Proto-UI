import { createVueAdapter } from '../src/adapt';
import { VueAny, flushVue } from './utils/vue';
import { hitAdapterConformance, type HitTree } from '../../base/test/fixtures/hit-conformance';

hitAdapterConformance('vue', async (tree) => {
  const host = document.createElement('div');
  document.body.append(host);
  const adapt = createVueAdapter(VueAny);
  const render = (node: HitTree): unknown => {
    const component = adapt(node.proto);
    const children = (node.children ?? []).map(render);
    return VueAny.h(component, { key: node.proto.name, class: 'user-hit-class' }, () => children);
  };
  const nodes = tree.map(render);
  const app = VueAny.createApp({ render: () => VueAny.h('div', nodes) });
  app.mount(host);
  return {
    host,
    async flush() {
      await flushVue();
      await flushVue();
    },
    async unmount() {
      app.unmount();
      await flushVue();
      host.remove();
    },
  };
});

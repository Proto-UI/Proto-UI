import { createVueAdapter } from '../src/adapt';
import { VueAny, flushVue } from './utils/vue';
import {
  boundaryAdapterConformance,
  type BoundaryTree,
} from '../../base/test/fixtures/boundary-conformance';

boundaryAdapterConformance('vue', async (tree) => {
  const host = document.createElement('div');
  document.body.append(host);
  const adapt = createVueAdapter(VueAny);
  const render = (node: BoundaryTree): unknown => {
    const component = adapt(node.proto);
    const children = (node.children ?? []).map(render);
    return VueAny.h(
      component,
      { key: node.proto.name, class: 'user-boundary-class' },
      () => children
    );
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
    async press(target) {
      target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    },
    async unmount() {
      app.unmount();
      await flushVue();
      host.remove();
    },
  };
});

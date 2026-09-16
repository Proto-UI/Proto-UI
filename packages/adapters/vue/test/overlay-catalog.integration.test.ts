import { createVueAdapter } from '../src/adapt';
import { VueAny, flushVue } from './utils/vue';
import {
  overlayCatalogConformance,
  type OverlayTree,
} from '../../base/test/fixtures/overlay-catalog-conformance';

overlayCatalogConformance('vue', async (tree) => {
  const host = document.createElement('div');
  document.body.append(host);
  const adapt = createVueAdapter(VueAny);
  const render = (node: OverlayTree): unknown => {
    const component = adapt(node.proto);
    const children = (node.children ?? []).map(render);
    return VueAny.h(
      component,
      { key: node.proto.name, class: 'user-overlay-class' },
      () => children
    );
  };
  const nodes = tree.map(render);
  const app = VueAny.createApp({ render: () => VueAny.h('div', nodes) });
  app.mount(host);
  return {
    host,
    async dispatch(target, event) {
      target.dispatchEvent(event);
    },
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

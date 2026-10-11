import { createVueAdapter } from '../src/adapt';
import { VueAny, flushVue } from './utils/vue';
import { axisInputConformance } from '../../base/test/fixtures/axis-input-conformance';
import type { ScrollTree } from '../../base/test/fixtures/scroll-catalog-conformance';

axisInputConformance('vue', async (tree) => {
  const host = document.createElement('div');
  document.body.append(host);
  const adapt = createVueAdapter(VueAny);
  const render = (node: ScrollTree): unknown => {
    const component = adapt(node.proto);
    const children = (node.children ?? []).map(render);
    return VueAny.h(
      component,
      { key: node.proto.name, class: 'user-scroll-class' },
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

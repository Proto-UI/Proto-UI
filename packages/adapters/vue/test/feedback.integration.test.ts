import { createVueAdapter } from '../src/adapt';
import { VueAny, flushVue } from './utils/vue';
import {
  feedbackAdapterConformance,
  type FeedbackTree,
} from '../../base/test/fixtures/feedback-conformance';

feedbackAdapterConformance('vue', async (tree) => {
  const host = document.createElement('div');
  document.body.append(host);
  const adapt = createVueAdapter(VueAny);
  const render = (node: FeedbackTree): unknown => {
    const component = adapt(node.proto);
    const children = (node.children ?? []).map(render);
    return VueAny.h(
      component,
      { key: node.proto.name, class: 'user-feedback-class' },
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
    async click(target) {
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    },
    async unmount() {
      app.unmount();
      await flushVue();
      host.remove();
    },
  };
});

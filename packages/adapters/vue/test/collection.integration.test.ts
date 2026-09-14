import { createVueAdapter } from '../src/adapt';
import { VueAny, flushVue } from './utils/vue';
import {
  collectionAdapterConformance,
  type CollectionTree,
} from '../../base/test/fixtures/collection-conformance';
collectionAdapterConformance('vue', async (tree) => {
  const host = document.createElement('div');
  document.body.append(host);
  const adapt = createVueAdapter(VueAny),
    components = new Map();
  let current = tree;
  const revision = VueAny.ref(0);
  const render = (node: CollectionTree): unknown => {
    if (!components.has(node.proto)) components.set(node.proto, adapt(node.proto));
    return VueAny.h(components.get(node.proto), { key: node.proto.name }, () =>
      (node.children ?? []).map(render)
    );
  };
  const app = VueAny.createApp({
    render: () => {
      revision.value;
      return VueAny.h('div', current.map(render));
    },
  });
  app.mount(host);
  const flush = async (action?: () => void) => {
    action?.();
    await flushVue();
    await flushVue();
  };
  return {
    host,
    flush,
    async update(next) {
      current = next;
      revision.value++;
      await flush();
    },
    async click(el) {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    },
    async unmount() {
      app.unmount();
      await flush();
      host.remove();
    },
  };
});

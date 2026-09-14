import { createVue2Adapter } from '../src/adapt';
import { Vue2Any, Vue2RuntimeAny, flushVue2 } from './utils/vue2';
import {
  collectionAdapterConformance,
  type CollectionTree,
} from '../../base/test/fixtures/collection-conformance';
collectionAdapterConformance('vue2', async (tree) => {
  const host = document.createElement('div');
  document.body.append(host);
  const adapt = createVue2Adapter(Vue2RuntimeAny),
    components = new Map();
  let current = tree;
  const App = Vue2Any.extend({
    render(h: any) {
      const render = (node: CollectionTree): unknown => {
        if (!components.has(node.proto)) components.set(node.proto, adapt(node.proto));
        return h(
          components.get(node.proto),
          { key: node.proto.name },
          (node.children ?? []).map(render)
        );
      };
      return h('div', {}, current.map(render));
    },
  });
  const vm = new App().$mount();
  host.append(vm.$el);
  const flush = async (action?: () => void) => {
    action?.();
    await flushVue2();
    await flushVue2();
  };
  return {
    host,
    flush,
    async update(next) {
      current = next;
      vm.$forceUpdate();
      await flush();
    },
    async click(el) {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    },
    async unmount() {
      vm.$destroy();
      await flush();
      host.remove();
    },
  };
});

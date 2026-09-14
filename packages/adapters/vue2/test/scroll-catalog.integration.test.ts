import { createVue2Adapter } from '../src/adapt';
import { Vue2Any, Vue2RuntimeAny, flushVue2 } from './utils/vue2';
import {
  scrollCatalogConformance,
  type ScrollTree,
} from '../../base/test/fixtures/scroll-catalog-conformance';

scrollCatalogConformance('vue2', async (tree) => {
  const host = document.createElement('div');
  document.body.append(host);
  const adapt = createVue2Adapter(Vue2RuntimeAny);
  const components = new Map(
    tree
      .flatMap(function flatten(node): ScrollTree[] {
        return [node, ...(node.children ?? []).flatMap(flatten)];
      })
      .map((node) => [node.proto, adapt(node.proto)])
  );
  const App = Vue2Any.extend({
    render(h: (component: unknown, data: unknown, children?: unknown[]) => unknown) {
      const render = (node: ScrollTree): unknown =>
        h(
          components.get(node.proto),
          { key: node.proto.name, class: 'user-scroll-class' },
          (node.children ?? []).map(render)
        );
      return h('div', {}, tree.map(render));
    },
  });
  const vm = new App().$mount();
  host.append(vm.$el);
  return {
    host,
    async dispatch(target, event) {
      target.dispatchEvent(event);
    },
    async flush() {
      await flushVue2();
      await flushVue2();
    },
    async unmount() {
      vm.$destroy();
      await flushVue2();
      host.remove();
    },
  };
});

import { createVue2Adapter } from '../src/adapt';
import { Vue2Any, Vue2RuntimeAny, flushVue2 } from './utils/vue2';
import {
  exposeStateWebAdapterConformance,
  type ExposeStateWebTree,
} from '../../base/test/fixtures/expose-state-web-conformance';

exposeStateWebAdapterConformance('vue2', async (tree, options) => {
  const host = document.createElement('div');
  document.body.append(host);
  const adapt = createVue2Adapter(Vue2RuntimeAny);
  const components = new Map(
    tree
      .flatMap(function flatten(node): ExposeStateWebTree[] {
        return [node, ...(node.children ?? []).flatMap(flatten)];
      })
      .map((node) => [node.proto, adapt(node.proto, options)])
  );
  const App = Vue2Any.extend({
    render(h: (component: unknown, data: unknown, children?: unknown[]) => unknown) {
      const render = (node: ExposeStateWebTree): unknown =>
        h(
          components.get(node.proto),
          { key: node.proto.name, class: 'user-esw-class' },
          (node.children ?? []).map(render)
        );
      return h('div', {}, tree.map(render));
    },
  });
  const vm = new App().$mount();
  host.append(vm.$el);
  return {
    host,
    async flush() {
      await flushVue2();
      await flushVue2();
    },
    async click(target) {
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    },
    async unmount() {
      vm.$destroy();
      await flushVue2();
      host.remove();
    },
  };
});

import { createVue2Adapter } from '../src/adapt';
import { Vue2Any, Vue2RuntimeAny, flushVue2 } from './utils/vue2';
import {
  boundaryAdapterConformance,
  type BoundaryTree,
} from '../../base/test/fixtures/boundary-conformance';

boundaryAdapterConformance('vue2', async (tree) => {
  const host = document.createElement('div');
  document.body.append(host);
  const adapt = createVue2Adapter(Vue2RuntimeAny);
  const components = new Map(
    tree
      .flatMap(function flatten(node): BoundaryTree[] {
        return [node, ...(node.children ?? []).flatMap(flatten)];
      })
      .map((node) => [node.proto, adapt(node.proto)])
  );
  const App = Vue2Any.extend({
    render(h: (component: unknown, data: unknown, children?: unknown[]) => unknown) {
      const render = (node: BoundaryTree): unknown =>
        h(
          components.get(node.proto),
          { key: node.proto.name, class: 'user-boundary-class' },
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
    async press(target) {
      target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    },
    async unmount() {
      vm.$destroy();
      await flushVue2();
      host.remove();
    },
  };
});

import { describe, it, vi } from 'vitest';
import * as base from '../../../prototypes/base/src/select';
import * as shadcn from '../../../prototypes/shadcn/src/select';
import { createVue2Adapter } from '../src/adapt';
import { Vue2Any, Vue2RuntimeAny } from './utils/vue2';
import {
  checkSelectStructuralRelations,
  type StructuralNode,
} from '../../base/test/fixtures/select-structural-conformance';

for (const [family, prototypes] of Object.entries({ base, shadcn })) {
  describe(`Vue 2 ${family} Select structural relations`, () => {
    it('isolates names through framework update/removal/replacement and preserves selection', async () => {
      vi.useFakeTimers();
      const adapt = createVue2Adapter(Vue2RuntimeAny);
      const components = Object.fromEntries(
        Object.entries(prototypes)
          .filter(([k]) => /^select[A-Z]/.test(k))
          .map(([k, p]) => [k, adapt(p as any)])
      );
      const renderNode = (h: any, node: StructuralNode | string): any =>
        typeof node === 'string'
          ? node
          : h(
              components[node.part],
              {
                attrs: node.props,
                key: node.name,
                props: { hostClass: `test-select-${node.name}` },
                ref: node.name,
              },
              (node.children ?? []).map((child) => renderNode(h, child))
            );
      const App = Vue2Any.extend({
        data: () => ({ tree: null }),
        render(this: any, h: any) {
          return this.tree ? renderNode(h, this.tree) : h('div');
        },
      });
      const vm = new App().$mount();
      const host = document.createElement('div');
      document.body.append(host);
      host.append(vm.$el);
      const settle = async () => {
        await Vue2Any.nextTick();
        await vi.advanceTimersByTimeAsync(0);
        await Vue2Any.nextTick();
        await Promise.resolve();
        await Vue2Any.nextTick();
      };
      try {
        await checkSelectStructuralRelations({
          render: async (tree) => {
            vm.tree = tree;
            await settle();
          },
          event: async (action) => {
            action();
            await settle();
          },
          expose: (name) => vm.$refs[name].getExposes(),
        });
      } finally {
        vm.$destroy();
        host.remove();
        vi.useRealTimers();
      }
    });
  });
}

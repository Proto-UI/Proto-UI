import { describe, it, vi } from 'vitest';
import * as base from '../../../prototypes/base/src/select';
import * as shadcn from '../../../prototypes/shadcn/src/select';
import { createVueAdapter } from '../src/adapt';
import { VueAny, flushVue } from './utils/vue';
import {
  checkSelectStructuralRelations,
  type StructuralNode,
} from '../../base/test/fixtures/select-structural-conformance';

for (const [family, prototypes] of Object.entries({ base, shadcn })) {
  describe(`Vue ${family} Select structural relations`, () => {
    it('isolates names through framework update/removal/replacement and preserves selection', async () => {
      vi.useFakeTimers();
      const adapt = createVueAdapter(VueAny);
      const components = Object.fromEntries(
        Object.entries(prototypes)
          .filter(([k]) => /^select[A-Z]/.test(k))
          .map(([k, p]) => [k, adapt(p as any)])
      );
      const refs: Record<string, any> = {};
      const tree = VueAny.shallowRef(null);
      const renderNode = (node: StructuralNode | string): any =>
        typeof node === 'string'
          ? node
          : VueAny.h(
              components[node.part],
              {
                ...node.props,
                key: node.name,
                hostClass: `test-select-${node.name}`,
                ref: (value: any) => {
                  refs[node.name] = value;
                },
              },
              () => (node.children ?? []).map(renderNode)
            );
      const host = document.createElement('div');
      document.body.append(host);
      const app = VueAny.createApp({
        setup: () => () => (tree.value ? renderNode(tree.value) : null),
      });
      app.mount(host);
      const settle = async () => {
        await flushVue();
        await vi.advanceTimersByTimeAsync(0);
        await flushVue();
        await flushVue();
      };
      try {
        await checkSelectStructuralRelations({
          render: async (next) => {
            tree.value = next;
            await settle();
          },
          event: async (action) => {
            action();
            await settle();
          },
          expose: (name) => refs[name].getExposes(),
        });
      } finally {
        app.unmount();
        host.remove();
        vi.useRealTimers();
      }
    });
  });
}

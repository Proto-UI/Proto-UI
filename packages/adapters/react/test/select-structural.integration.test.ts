import * as React from 'react';
import { act } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { describe, it, vi } from 'vitest';
import * as base from '../../../prototypes/base/src/select';
import * as shadcn from '../../../prototypes/shadcn/src/select';
import { createReactAdapter } from '../src';
import {
  checkSelectStructuralRelations,
  type StructuralNode,
} from '../../base/test/fixtures/select-structural-conformance';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
for (const [family, prototypes] of Object.entries({ base, shadcn })) {
  describe(`React ${family} Select structural relations`, () => {
    it('isolates names through framework update/removal/replacement and preserves selection', async () => {
      vi.useFakeTimers();
      const adapt = createReactAdapter({ ...React, createPortal });
      const components = Object.fromEntries(
        Object.entries(prototypes)
          .filter(([k]) => /^select[A-Z]/.test(k))
          .map(([k, p]) => [k, adapt(p as any)])
      );
      const refs: Record<string, any> = {};
      const host = document.createElement('div');
      document.body.append(host);
      const root = createRoot(host);
      const renderNode = (node: StructuralNode | string): any =>
        typeof node === 'string'
          ? node
          : React.createElement(
              components[node.part],
              {
                ...node.props,
                key: node.name,
                hostClassName: `test-select-${node.name}`,
                ref: (value: any) => {
                  refs[node.name] = value;
                },
              },
              ...(node.children ?? []).map(renderNode)
            );
      const settle = async () => {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });
      };
      try {
        await checkSelectStructuralRelations({
          render: async (tree) => {
            await act(async () => {
              root.render(renderNode(tree));
            });
            await settle();
          },
          event: async (action) => {
            await act(async () => {
              action();
            });
            await settle();
          },
          expose: (name) => refs[name].getExposes(),
        });
      } finally {
        await act(async () => root.unmount());
        host.remove();
        vi.useRealTimers();
      }
    });
  });
}

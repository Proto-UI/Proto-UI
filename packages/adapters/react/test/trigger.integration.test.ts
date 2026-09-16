import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createReactAdapter } from '../src';
import {
  triggerAdapterConformance,
  type TriggerTree,
} from '../../base/test/fixtures/trigger-conformance';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
triggerAdapterConformance('react', async (tree) => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const adapt = createReactAdapter(React);
  const render = (node: TriggerTree): React.ReactNode =>
    React.createElement(
      adapt(node.proto),
      { key: node.proto.name, className: 'user-trigger-class' },
      ...(node.children ?? []).map(render)
    );
  await act(async () =>
    root.render(React.createElement(React.Fragment, null, ...tree.map(render)))
  );
  return {
    host,
    async flush() {
      await act(async () => {
        await Promise.resolve();
      });
    },
    async click(target) {
      await act(async () => {
        target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
    },
    async unmount() {
      await act(async () => root.unmount());
      host.remove();
    },
  };
});

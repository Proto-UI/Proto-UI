import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createReactAdapter } from '../src';
import {
  exposeStateWebAdapterConformance,
  type ExposeStateWebTree,
} from '../../base/test/fixtures/expose-state-web-conformance';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
exposeStateWebAdapterConformance('react', async (tree, options) => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const adapt = createReactAdapter(React);
  const render = (node: ExposeStateWebTree): React.ReactNode =>
    React.createElement(
      adapt(node.proto, options),
      { key: node.proto.name, className: 'user-esw-class' },
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

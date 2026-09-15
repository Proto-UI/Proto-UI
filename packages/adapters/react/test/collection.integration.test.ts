import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createReactAdapter } from '../src';
import {
  collectionAdapterConformance,
  type CollectionTree,
} from '../../base/test/fixtures/collection-conformance';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
collectionAdapterConformance('react', async (tree) => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host),
    adapt = createReactAdapter(React);
  const components = new Map();
  const render = (node: CollectionTree): React.ReactNode => {
    if (!components.has(node.proto)) components.set(node.proto, adapt(node.proto));
    return React.createElement(
      components.get(node.proto),
      { key: node.proto.name },
      ...(node.children ?? []).map(render)
    );
  };
  const update = async (next: CollectionTree[]) => {
    await act(async () =>
      root.render(React.createElement(React.Fragment, null, ...next.map(render)))
    );
  };
  await update(tree);
  return {
    host,
    update,
    async flush(action) {
      await act(async () => {
        action?.();
        await Promise.resolve();
      });
    },
    async click(el) {
      await act(async () => {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
    },
    async unmount() {
      await act(async () => root.unmount());
      host.remove();
    },
  };
});

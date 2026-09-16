import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createReactAdapter } from '../src';
import { hitAdapterConformance, type HitTree } from '../../base/test/fixtures/hit-conformance';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
hitAdapterConformance('react', async (tree) => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const adapt = createReactAdapter(React);
  const render = (node: HitTree): React.ReactNode =>
    React.createElement(
      adapt(node.proto),
      { key: node.proto.name, className: 'user-hit-class' },
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
    async unmount() {
      await act(async () => root.unmount());
      host.remove();
    },
  };
});

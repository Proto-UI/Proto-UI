import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createReactAdapter } from '../src';
import {
  positioningAdapterConformance,
  type PositioningTree,
} from '../../base/test/fixtures/positioning-conformance';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
positioningAdapterConformance('react', async (tree) => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const adapt = createReactAdapter(React);
  const render = (node: PositioningTree): React.ReactNode =>
    React.createElement(
      adapt(node.proto),
      { key: node.proto.name, className: 'user-positioning-class' },
      ...(node.children ?? []).map(render)
    );
  await act(async () =>
    root.render(React.createElement(React.Fragment, null, ...tree.map(render)))
  );
  return {
    host,
    async dispatch(target, event) {
      await act(async () => {
        target.dispatchEvent(event);
      });
    },
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

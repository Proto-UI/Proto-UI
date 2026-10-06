import * as tree from '../src/platform/instance-tree';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createReactAdapter } from '../src';
import { focusReadinessFanoutConformance } from '../../base/test/fixtures/focus-readiness-fanout-conformance';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
focusReadinessFanoutConformance('react', tree, async (proto) => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const ref = React.createRef<any>();
  const Component = createReactAdapter(React)(proto);
  await act(async () => root.render(React.createElement(Component, { ref })));
  return {
    get root() {
      return host.firstElementChild as HTMLElement;
    },
    getExposes: () => ref.current.getExposes(),
    act: async (callback) => {
      await act(async () => callback());
    },
    unmount: async () => {
      await act(async () => root.unmount());
      host.remove();
    },
  };
});

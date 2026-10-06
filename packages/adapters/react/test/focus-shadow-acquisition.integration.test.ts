import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createReactAdapter } from '../src';
import { focusShadowAcquisitionConformance } from '../../base/test/fixtures/focus-shadow-acquisition-conformance';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
focusShadowAcquisitionConformance('react', async (proto, container) => {
  const app = createRoot(container),
    ref = React.createRef<any>();
  const Component = createReactAdapter(React)(proto);
  await act(async () => app.render(React.createElement(Component, { ref })));
  return {
    root: container.firstElementChild as HTMLElement,
    request: () => {
      act(() => ref.current.getExposes().request());
    },
    flush: async () => {
      await act(async () => {
        await Promise.resolve();
      });
    },
    unmount: async () => {
      await act(async () => app.unmount());
    },
  };
});

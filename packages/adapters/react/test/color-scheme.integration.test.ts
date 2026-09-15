import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createReactAdapter } from '../src';
import { describeColorSchemeIntegration } from '../../base/test-utils/color-scheme';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describeColorSchemeIntegration('react', async (proto, options) => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const Component = createReactAdapter(React)(proto, options);
  const ref = React.createRef<any>();
  const settle = async (action: () => void) => {
    await act(async () => {
      action();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };
  await settle(() => root.render(React.createElement(Component, { ref })));
  return {
    host,
    act: settle,
    setProps: (props, concurrent) =>
      settle(() => {
        root.render(React.createElement(Component, { ...props, ref }));
        concurrent?.();
      }),
    setPresent: (present) =>
      settle(() => ref.current.getExposes().view[present ? 'show' : 'hide']()),
    update: () => settle(() => ref.current.update()),
    async unmount() {
      await settle(() => root.unmount());
      host.remove();
    },
  };
});

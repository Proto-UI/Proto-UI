import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createReactAdapter } from '../src';
import { templateStyleConformance } from '../../base/test/fixtures/template-style-conformance';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
templateStyleConformance('react', async (proto) => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const Component = createReactAdapter(React)(proto);
  const ref = React.createRef<any>();
  const settle = async (action: () => void) => {
    await act(async () => {
      action();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };
  await settle(() =>
    root.render(
      React.createElement(
        Component,
        { ref, className: 'caller-root p-8', 'data-pui-style': 'p-6' },
        React.createElement(
          'b',
          {
            'data-caller-slot': '',
            className: 'caller-slot p-8',
            'data-pui-style': 'p-6 opacity-100',
          },
          'caller'
        )
      )
    )
  );
  return {
    host,
    update: () => settle(() => ref.current.update()),
    async unmount() {
      await settle(() => root.unmount());
      host.remove();
    },
  };
});

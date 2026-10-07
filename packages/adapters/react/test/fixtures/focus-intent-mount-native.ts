import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Prototype } from '@proto.ui/core';
import { createReactAdapter } from '../../src';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
export async function mountNativeFocusIntentReact(proto: Prototype<any, any>) {
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
    act: async (callback: () => void) => {
      await act(async () => callback());
    },
    unmount: async () => {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

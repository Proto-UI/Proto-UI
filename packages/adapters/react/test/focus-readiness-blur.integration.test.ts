import { expect, it } from 'vitest';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { definePrototype } from '@proto.ui/core';
import { asFocusable } from '@proto.ui/hooks';
import { createReactAdapter } from '../src';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
it('real React applies blur from onUpdated to the focused physical root', async () => {
  let blurOnUpdate = false;
  let calls = 0;
  const proto = definePrototype({
    name: 'independent-real-readiness-blur-control',
    setup(def) {
      const focusable = asFocusable();
      def.expose.state('focused', focusable.focused);
      def.lifecycle.onUpdated(() => {
        if (blurOnUpdate) {
          calls++;
          focusable.blur();
        }
      });
      return (r) => r.el('div', 'target');
    },
  });
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const ref = React.createRef<any>();
  const Component = createReactAdapter(React)(proto);
  try {
    await act(async () => root.render(React.createElement(Component, { ref })));
    const target = host.querySelector<HTMLElement>('[data-pui-root]')!;
    await act(async () => target.focus());
    expect(document.activeElement).toBe(target);
    expect(ref.current.getExposes().focused.get()).toBe(true);
    blurOnUpdate = true;
    await act(async () => ref.current.update());
    expect(calls).toBeGreaterThan(0);
    expect(ref.current.getExposes().focused.get()).toBe(false);
    expect(document.activeElement).not.toBe(target);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

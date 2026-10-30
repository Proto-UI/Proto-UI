import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { definePrototype, type RunHandle, type ViewOperation } from '@proto.ui/core';
import { createReactAdapter } from '../src';

it('uses actual React view replacement and unmount to invalidate captured source operations', async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const hadActFlag = Object.hasOwn(environment, 'IS_REACT_ACT_ENVIRONMENT');
  const previousActFlag = environment.IS_REACT_ACT_ENVIRONMENT;
  let run!: RunHandle<any>;
  let setups = 0;
  const proto = definePrototype({
    name: 'react-view-operation-source',
    setup(def) {
      setups += 1;
      def.lifecycle.onCreated((value) => {
        run = value;
      });
      def.expose('view', {
        capture: () => run.lifecycle.captureViewOperation(),
        present: (value: boolean) => run.lifecycle.setPresent(value),
      });
      return (r) => r.el('span', 'Source');
    },
  });
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const Component = createReactAdapter(React)(proto);
  const ref = React.createRef<any>();
  const settle = async (action: () => void) =>
    act(async () => {
      action();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  let unmounted = false;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await settle(() => root.render(React.createElement(Component, { ref })));
    const view = ref.current.getExposes().view;
    const first = view.capture() as ViewOperation;
    expect(first.isCurrent()).toBe(true);
    await settle(() => view.present(false));
    expect(view.capture()).toBeNull();
    await settle(() => view.present(true));
    expect(setups).toBe(1);
    expect(first.isCurrent()).toBe(false);
    const second = view.capture() as ViewOperation;
    expect(second.isCurrent()).toBe(true);
    await settle(() => root.unmount());
    unmounted = true;
    expect(second.isCurrent()).toBe(false);
  } finally {
    try {
      if (!unmounted) await settle(() => root.unmount());
    } finally {
      host.remove();
      if (hadActFlag) environment.IS_REACT_ACT_ENVIRONMENT = previousActFlag;
      else delete environment.IS_REACT_ACT_ENVIRONMENT;
    }
  }
});

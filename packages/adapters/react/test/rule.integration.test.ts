import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createReactAdapter } from '../src';
import { ruleAdapterConformance, type RuleProps } from '../../base/test/fixtures/rule-conformance';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
ruleAdapterConformance('react', async (proto) => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host),
    Component = createReactAdapter(React)(proto);
  const setProps = async (props: RuleProps) => {
    await act(async () =>
      root.render(React.createElement(Component, { ...props, className: 'rule-user-class' }))
    );
  };
  await setProps({});
  return {
    host,
    setProps,
    async flush() {
      await act(async () => {
        await Promise.resolve();
      });
    },
    async click(target) {
      await act(async () => {
        target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
    },
    async unmount() {
      await act(async () => root.unmount());
      host.remove();
    },
  };
});

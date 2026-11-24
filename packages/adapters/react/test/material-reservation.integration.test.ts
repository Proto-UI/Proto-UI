import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createReactAdapter } from '../src';
import { materialReservationConformance } from '../../base/test/fixtures/material-reservation-conformance';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
materialReservationConformance('react', async (owner, target, duplicate) => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const adapt = createReactAdapter(React);
  const Owner = adapt(owner);
  const Target = adapt(target);
  const ref = React.createRef<any>();
  const settle = async (action: () => void) =>
    act(async () => {
      action();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  await settle(() =>
    root.render(
      React.createElement(
        Owner,
        { ref },
        React.createElement(Target, {}, React.createElement('b', {}, 'borrowed target')),
        duplicate ? React.createElement(Target, {}, 'second target') : null
      )
    )
  );
  let mounted = true;
  return {
    host,
    update: () => settle(() => ref.current.update()),
    async unmount() {
      if (!mounted) return;
      mounted = false;
      await settle(() => root.unmount());
      host.remove();
    },
  };
});

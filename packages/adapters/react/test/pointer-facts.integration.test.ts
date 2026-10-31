// @vitest-environment happy-dom
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createReactAdapter } from '../src';
import { pointerFactsConformance } from '../../base/test/fixtures/pointer-facts-conformance';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
pointerFactsConformance('react', async (prototype) => {
  const host = document.createElement('div'); document.body.append(host);
  const app = createRoot(host); const Component = createReactAdapter(React)(prototype);
  await act(async () => { app.render(React.createElement(Component)); });
  const root = host.querySelector<HTMLElement>('[data-pui-root]');
  if (!root) { await act(async () => app.unmount()); host.remove(); throw new Error('React author fixture did not mount a physical Proto root'); }
  return { root, async flush() { await act(async () => { await Promise.resolve(); }); }, async dispatch(target, sample) { await act(async () => { target.dispatchEvent(sample); }); }, async unmount() { await act(async () => app.unmount()); host.remove(); } };
});

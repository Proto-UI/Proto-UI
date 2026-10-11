import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createReactAdapter } from '../src';
import {
  fieldAdapterConformance,
  type FieldTree,
} from '../../base/test/fixtures/field-conformance';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

fieldAdapterConformance('react', async (tree) => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const adapt = createReactAdapter(React);
  const components = new Map<FieldTree['proto'], any>();
  const refs = new Map<string, any>();
  const render = (node: FieldTree): React.ReactNode => {
    if (!components.has(node.proto)) components.set(node.proto, adapt(node.proto));
    return React.createElement(
      components.get(node.proto),
      {
        ...node.props,
        key: node.key,
        ref: (handle: any) => refs.set(node.key, handle),
        ...(node.onValidationRequest ? { onValidationRequest: node.onValidationRequest } : {}),
      },
      ...(node.children ?? []).map(render)
    );
  };
  const flush = async (action?: () => void) => {
    await act(async () => {
      action?.();
      root.render(React.createElement(React.Fragment, null, ...tree.map(render)));
      await Promise.resolve();
    });
  };
  try {
    await flush();
  } catch (error) {
    await act(async () => root.unmount());
    host.remove();
    throw error;
  }
  return {
    host,
    exposes: (key) => refs.get(key).getExposes(),
    flush,
    async click(target) {
      await act(async () => (() => {
      target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 1, button: 0 }));
      target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 1, button: 0 }));
      return target.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, button: 0, detail: 1 }));
    })());
    },
    async unmount() {
      await act(async () => root.unmount());
      host.remove();
    },
  };
});

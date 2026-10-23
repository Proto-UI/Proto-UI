import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createReactAdapter } from '../../../adapters/react/src';
import type { ReactAdapterHandle } from '../../../adapters/react/src/types';
import {
  selectRoot,
  selectTrigger,
  selectValue,
  selectItem,
  selectContent,
  selectSurface,
  selectViewport,
  selectItemText,
} from '../../../prototypes/shadcn/src/select';

// Native-fixture marker, not a new public prototype prop. Preserve the existing data-attribute route.
const demoRef = (value: string): React.Attributes & { 'data-demo-ref': string } => ({
  'data-demo-ref': value,
});

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
const contentRef = React.createRef<ReactAdapterHandle<typeof selectContent>>();
export const readProofFailure = () =>
  contentRef.current?.getExposes().alignmentDiagnostic.get() || null;

// The proof now consumes the actual public Shadcn composition. Its former
// duplicate resolver/gate/presence implementation has been removed entirely.
let disposeProof: (() => void) | null = null;
let updateProof: ((next: { open?: boolean; selected?: number }) => void) | null = null;
export async function updateAlignmentProof(next: { open?: boolean; selected?: number }) {
  if (!updateProof) throw new Error('Alignment proof is not mounted');
  await act(async () => updateProof?.(next));
}
export const readProofPhase = () => contentRef.current?.getExposes().transitionState.get() ?? null;
export async function unmountAlignmentProof() {
  await act(async () => {
    disposeProof?.();
    disposeProof = null;
    updateProof = null;
  });
}

export async function mountAlignmentProof(
  options: {
    direction?: 'ltr' | 'rtl';
    count?: number;
    selected?: number;
    top?: number;
    omitPart?: 'surface' | 'item-text';
    controlled?: boolean;
  } = {}
) {
  const count = options.count ?? 3,
    selected = options.selected ?? 1;
  const style = document.createElement('style');
  style.textContent = `
    * { box-sizing: border-box; } body { margin: 0; font: 14px/20px sans-serif; }
    [data-pui-view-detached] { display:none; } .proof-content[data-transition-state="preparing"] { visibility:hidden; pointer-events:none; } .hidden { display: none; } .invisible { visibility: hidden; } .pointer-events-none { pointer-events:none; }
    .proof-root { position:absolute; top:${options.top ?? 240}px; left:180px; }
    .proof-trigger { display:flex; align-items:center; width:180px; height:36px; padding:0 12px; border:1px solid #aaa; background:white; }
    .proof-content { z-index:50; position:fixed; display:flex; flex-direction:column; }
    .proof-surface { position:relative; display:flex; flex-direction:column; max-height:100%; min-width:128px; padding:0px; border:1px solid #888; background:white; }
    .proof-viewport { position:relative; flex:1; min-height:0; overflow-y:auto; padding:4px; }
    .proof-item { position:relative; display:flex; align-items:center; height:32px; padding:6px 32px 6px 8px; outline:none; white-space:nowrap; }
    .proof-item:focus { background:#ddd; }
  `;
  document.head.append(style);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  disposeProof = () => {
    root.unmount();
    host.remove();
    style.remove();
  };
  const adapt = createReactAdapter(React);
  const Root = adapt(selectRoot),
    Trigger = adapt(selectTrigger, { rootTag: 'button' }),
    Value = adapt(selectValue, { rootTag: 'span' });
  const Content = adapt(selectContent),
    Surface = adapt(selectSurface),
    Viewport = adapt(selectViewport),
    Item = adapt(selectItem),
    Text = adapt(selectItemText, { rootTag: 'span' });
  const items = Array.from({ length: count }, (_, i) => {
    const itemProps: React.ComponentProps<typeof Item> & { 'data-demo-ref': string } = {
      className: 'proof-item',
      value: `v${i}`,
      textValue: `Option ${i}`,
      key: i,
      'data-demo-ref': `item-${i}`,
    };
    return React.createElement(
      Item,
      itemProps,
      options.omitPart === 'item-text' && i === selected
        ? `Option ${i}`
        : React.createElement(Text, demoRef(`text-${i}`), `Option ${i}`)
    );
  });
  const rows = React.createElement(
    Viewport,
    { className: 'proof-viewport', ...demoRef('viewport') },
    ...items
  );
  const painted =
    options.omitPart === 'surface'
      ? rows
      : React.createElement(Surface, { className: 'proof-surface', ...demoRef('surface') }, rows);
  const triggerProps: React.ComponentProps<typeof Trigger> & { 'data-demo-ref': string } = {
    className: 'proof-trigger',
    'data-demo-ref': 'trigger',
  };
  const valueProps: React.ComponentProps<typeof Value> & { 'data-demo-ref': string } = {
    'data-demo-ref': 'value',
  };
  const contentProps: React.ComponentProps<typeof Content> & { 'data-demo-ref': string } = {
    className: 'proof-content',
    'data-demo-ref': 'frame',
    ref: contentRef,
  };
  let controlledOpen = false,
    currentSelected = selected;
  const render = () =>
    root.render(
      React.createElement(
        Root,
        {
          className: 'proof-root',
          dir: options.direction ?? 'ltr',
          ...(options.controlled
            ? { open: controlledOpen, value: `v${currentSelected}` }
            : { defaultValue: `v${selected}` }),
        },
        React.createElement(Trigger, triggerProps, React.createElement(Value, valueProps)),
        React.createElement(Content, contentProps, painted)
      )
    );
  updateProof = (next) => {
    if (!options.controlled) throw new Error('Alignment proof is not controlled');
    if (next.open !== undefined) controlledOpen = next.open;
    if (next.selected !== undefined) currentSelected = next.selected;
    render();
  };
  await act(async () => render());
  return { count, selected };
}

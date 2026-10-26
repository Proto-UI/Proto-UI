import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createReactAdapter } from '../../../adapters/react/src';
import type { ReactAdapterHandle } from '../../../adapters/react/src/types';
import {
  selectRoot,
  selectTrigger,
  selectValue,
  selectContent,
  selectSurface,
  selectViewport,
  selectItem,
  selectItemText,
  selectGroup,
  selectLabel,
  selectSeparator,
} from '../../../prototypes/shadcn/src/select';

// Native-fixture marker, not a new public prototype prop. Preserve the existing data-attribute route.
const demoRef = (value: string): React.Attributes & { 'data-demo-ref': string } => ({
  'data-demo-ref': value,
});

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
const adapt = createReactAdapter(React);
const Root = adapt(selectRoot),
  Trigger = adapt(selectTrigger, { rootTag: 'button' }),
  Value = adapt(selectValue, { rootTag: 'span' }),
  Content = adapt(selectContent),
  Surface = adapt(selectSurface),
  Viewport = adapt(selectViewport),
  Item = adapt(selectItem),
  Text = adapt(selectItemText, { rootTag: 'span' }),
  Group = adapt(selectGroup),
  Label = adapt(selectLabel),
  Separator = adapt(selectSeparator);
const rootRef = React.createRef<ReactAdapterHandle<typeof selectRoot>>();
const contentRef = React.createRef<ReactAdapterHandle<typeof selectContent>>();
let dispose: (() => void) | undefined;
let update: ((mode: 'present' | 'removed' | 'rebound') => void) | undefined;
export const readState = () => ({
  value: rootRef.current?.getExposes().value.get(),
  diagnostic: contentRef.current?.getExposes().alignmentDiagnostic.get(),
  phase: contentRef.current?.getExposes().transitionState.get(),
});
export async function setLabel(mode: 'present' | 'removed' | 'rebound') {
  if (!update) throw new Error('Grouped Select is not mounted');
  await act(async () => update?.(mode));
}
export async function unmount() {
  await act(async () => dispose?.());
  dispose = undefined;
  update = undefined;
}
export async function mount(direction: 'ltr' | 'rtl') {
  const host = document.createElement('main');
  host.dir = direction;
  // Consumer layout only. Component appearance comes from the production style emitter.
  host.style.cssText = 'position:absolute;top:340px;left:220px;width:440px';
  document.body.append(host);
  const root = createRoot(host);
  let mode: 'present' | 'removed' | 'rebound' = 'present';
  const itemProps = (
    value: string,
    title: string
  ): React.ComponentProps<typeof Item> & { 'data-demo-ref': string } => ({
    value,
    textValue: title,
    'data-demo-ref': value,
    key: value,
  });
  const triggerProps: React.ComponentProps<typeof Trigger> & { 'data-demo-ref': string } = {
    'data-demo-ref': 'trigger',
  };
  const contentProps: React.ComponentProps<typeof Content> & { 'data-demo-ref': string } = {
    ref: contentRef,
    'data-demo-ref': 'content',
  };
  const item = (value: string, title: string) =>
    React.createElement(Item, itemProps(value, title), React.createElement(Text, {}, title));
  const render = () =>
    root.render(
      React.createElement(
        Root,
        { defaultValue: 'react', ref: rootRef },
        React.createElement(Trigger, triggerProps, React.createElement(Value)),
        React.createElement(
          Content,
          contentProps,
          React.createElement(
            Surface,
            demoRef('surface'),
            React.createElement(
              Viewport,
              demoRef('viewport'),
              React.createElement(
                Group,
                demoRef('frameworks'),
                mode !== 'removed' &&
                  React.createElement(
                    Label,
                    { key: mode, ...demoRef('framework-label') },
                    mode === 'rebound' ? 'Framework adapters (rebound)' : 'Framework adapters'
                  ),
                item('react', 'React'),
                item('vue', 'Vue'),
                React.createElement(
                  Group,
                  { key: 'nested', ...demoRef('nested') },
                  React.createElement(Label, demoRef('nested-label'), 'Legacy adapter'),
                  item('vue2', 'Vue 2')
                )
              ),
              // Deliberately no children: a separator is decoration, not an option or label.
              React.createElement(Separator, demoRef('separator')),
              React.createElement(
                Group,
                demoRef('platform'),
                React.createElement(Label, demoRef('platform-label'), 'Web platform'),
                item('wc', 'Web Components')
              )
            )
          )
        )
      )
    );
  update = (next) => {
    mode = next;
    render();
  };
  dispose = () => {
    root.unmount();
    host.remove();
  };
  await act(async () => render());
}

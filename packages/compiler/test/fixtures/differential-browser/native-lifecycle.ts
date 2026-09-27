import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { button } from '@proto.ui/prototypes-base';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { createComponent } from 'virtual:emitted-button';

const side = new URL(location.href).searchParams.get('target');
if (side !== 'reference' && side !== 'candidate') throw new Error('Choose reference or candidate');
const component =
  side === 'reference'
    ? createReactAdapter(React)(button, { schedule: (task) => task() })
    : createComponent({ schedule: (task: () => void) => task() });
const Context = React.createContext('missing-provider');
const stateKeys = ['disabled', 'hovered', 'pressed', 'focused', 'focusVisible'] as const;
type StateHandle = { get(): boolean };
type Exposes = Record<(typeof stateKeys)[number], StateHandle> & { focusSelf(): void };
const ref = React.createRef<{ getExposes(): Exposes }>();
let initialHandles: Record<(typeof stateKeys)[number], StateHandle> | null = null;
let staleTarget: HTMLElement | null = null;
let label = 'Activate';
let contextValue = 'host-value';
let props: Record<string, unknown> = { disabled: false };
let clicks = 0;
let nativeChildClicks = 0;
let outsideClicks = 0;
let spaceEvent: KeyboardEvent | null = null;
const host = document.getElementById('native-root')!;
const root = createRoot(host);

function NativeContent() {
  const context = React.useContext(Context);
  return React.createElement(
    'span',
    {
      'data-native-context': context,
      onClick: () => {
        nativeChildClicks += 1;
      },
    },
    React.createElement(
      'svg',
      { 'aria-hidden': true, 'data-native-icon': '', width: 12, height: 12, viewBox: '0 0 12 12' },
      React.createElement('path', { d: 'M1 6 L5 10 L11 1', fill: 'none', stroke: 'currentColor' })
    ),
    React.createElement('span', { 'data-native-label': '' }, label)
  );
}

function render() {
  flushSync(() =>
    root.render(
      React.createElement(
        Context.Provider,
        { value: contextValue },
        React.createElement(
          component,
          {
            ...props,
            ref,
            onClick: () => {
              clicks += 1;
            },
          },
          React.createElement(NativeContent)
        ),
        React.createElement(
          'button',
          {
            id: 'outside-native',
            onClick: () => {
              outsideClicks += 1;
            },
          },
          'Outside'
        )
      )
    )
  );
}
const target = () => host.querySelector<HTMLElement>('[data-pui-root]');
const exposed = () => {
  const exposes = ref.current?.getExposes();
  if (!exposes || stateKeys.some((key) => !exposes[key]))
    throw new Error('Button exposes are not ready');
  initialHandles ??= {
    disabled: exposes.disabled,
    hovered: exposes.hovered,
    pressed: exposes.pressed,
    focused: exposes.focused,
    focusVisible: exposes.focusVisible,
  };
  return exposes;
};

// Keep the native event until the settled snapshot. A capture-listener microtask
// can run before later native listeners; it is not a dispatch-completion boundary.
window.addEventListener(
  'keydown',
  (event) => {
    if (event.key === ' ') spaceEvent = event;
  },
  { capture: true }
);

render();
(window as unknown as Record<string, unknown>).nativeProbe = {
  ready() {
    const exposes = ref.current?.getExposes();
    if (!target() || !exposes || !stateKeys.every((key) => exposes[key])) return false;
    exposed();
    return true;
  },
  read() {
    const element = target();
    if (!element) {
      if (!initialHandles || !staleTarget)
        throw new Error('Terminal observation needs retained handles and target');
      const reads = stateKeys.map((key) => {
        try {
          return { key, invalid: false, value: initialHandles![key].get() };
        } catch {
          return { key, invalid: true, value: null };
        }
      });
      return {
        present: false,
        refCleared: ref.current === null,
        staleHandleInvalid: reads.every((read) => read.invalid),
        retainedReads: reads,
        staleTargetConnected: staleTarget.isConnected,
        clicks,
        outsideClicks,
        nativeChildClicks,
      };
    }
    const exposes = exposed();
    return {
      present: true,
      ...Object.fromEntries(stateKeys.map((key) => [key, exposes[key].get()])),
      sameHandles: stateKeys.every((key) => initialHandles![key] === exposes[key]),
      nativeContext:
        element.querySelector('[data-native-context]')?.getAttribute('data-native-context') ?? null,
      nativeIcon:
        element.querySelector('[data-native-icon]')?.namespaceURI === 'http://www.w3.org/2000/svg',
      label: element.querySelector('[data-native-label]')?.textContent ?? null,
      active: document.activeElement === element,
      role: element.getAttribute('role'),
      hasDisabledProp: Object.hasOwn(props, 'disabled'),
      clicks,
      outsideClicks,
      nativeChildClicks,
      spacePrevented: spaceEvent?.defaultPrevented ?? null,
    };
  },
  setDisabled(disabled: boolean) {
    props = { ...props, disabled };
    render();
  },
  setLabel(next: string) {
    label = next;
    render();
  },
  setContext(next: string) {
    contextValue = next;
    render();
  },
  rerender() {
    render();
  },
  focusSelf() {
    exposed().focusSelf();
  },
  blur() {
    target()?.blur();
  },
  dispose() {
    exposed();
    staleTarget = target();
    flushSync(() => root.unmount());
  },
  staleClick() {
    if (!staleTarget || staleTarget.isConnected) throw new Error('Expected detached old target');
    // Deliberately synthetic: real pointer input cannot target a detached element.
    staleTarget.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
  },
};

import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { button } from '@proto.ui/prototypes-base';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { createComponent as createEmittedComponent } from 'virtual:emitted-button';

type ClickSink = () => number;

interface Exposes {
  disabled: { get(): unknown };
  hovered: { get(): unknown };
  pressed: { get(): unknown };
  focused: { get(): unknown };
  focusVisible: { get(): unknown };
}

type Adapted = (props: Record<string, unknown>) => React.ReactElement;

function mount(
  container: HTMLElement,
  adapted: Adapted,
  displayName: string,
  onClick: () => void
): {
  read(): Record<string, unknown>;
  setProps(next: Record<string, unknown>, options?: { omitDisabled?: boolean }): void;
  remount(): void;
} {
  let currentProps: Record<string, unknown> = { disabled: false, children: 'Activate', onClick };
  let root = createRoot(container);
  let handle: { getExposes?: () => Record<string, Exposes> } | null = null;
  const ref = (value: unknown) => {
    handle = value as { getExposes?: () => Record<string, Exposes> } | null;
  };
  const render = () => {
    root.render(
      React.createElement(adapted as React.ComponentType<Record<string, unknown>>, {
        ...currentProps,
        ref,
      })
    );
  };
  render();
  const read = (key: keyof Exposes) => {
    const exposes = handle?.getExposes?.() ?? null;
    return exposes && exposes[key] ? exposes[key].get() : null;
  };
  return {
    read: () => ({
      displayName,
      disabled: read('disabled'),
      hovered: read('hovered'),
      pressed: read('pressed'),
      focused: read('focused'),
      focusVisible: read('focusVisible'),
      clicks: onClick.mockCount,
    }),
    setProps(next, options) {
      if (options?.omitDisabled) {
        const { disabled: _omitted, ...rest } = currentProps;
        currentProps = rest;
      } else {
        currentProps = { ...currentProps, ...next };
      }
      render();
    },
    remount() {
      // React 19 roots are single-use: create a fresh root for the new
      // host view epoch rather than rendering into an unmounted root.
      root.unmount();
      root = createRoot(container);
      render();
    },
  };
}

const sinks = {
  reference: (() => {
    let count = 0;
    const fn = () => {
      count += 1;
    };
    return Object.assign(fn, {
      mockCount: 0,
      sync() {
        fn.mockCount = count;
      },
    });
  })(),
  candidate: (() => {
    let count = 0;
    const fn = () => {
      count += 1;
    };
    return Object.assign(fn, {
      mockCount: 0,
      sync() {
        fn.mockCount = count;
      },
    });
  })(),
};

const referenceAdapted = createReactAdapter(React)(button, {
  schedule: (task) => task(),
}) as unknown as Adapted;
const candidateAdapted = createEmittedComponent({
  schedule: (task: () => void) => task(),
}) as Adapted;

const reference = mount(
  document.getElementById('reference-root')!,
  referenceAdapted,
  'reference',
  sinks.reference
);
const candidate = mount(
  document.getElementById('candidate-root')!,
  candidateAdapted,
  'candidate',
  sinks.candidate
);

(document.body as HTMLBodyElement).dataset.ready = 'true';

(window as unknown as Record<string, unknown>).differential = {
  read() {
    sinks.reference.sync();
    sinks.candidate.sync();
    return { reference: reference.read(), candidate: candidate.read() };
  },
  async setDisabled(next: boolean) {
    reference.setProps({ disabled: next });
    candidate.setProps({ disabled: next });
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, 30);
    await promise;
    await new Promise<void>((settle) => requestAnimationFrame(() => settle()));
    return this.read();
  },
  async remount() {
    reference.remount();
    candidate.remount();
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, 30);
    await promise;
    await new Promise<void>((settle) => requestAnimationFrame(() => settle()));
    return this.read();
  },
  async omitDisabled() {
    reference.setProps({}, { omitDisabled: true });
    candidate.setProps({}, { omitDisabled: true });
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, 30);
    await promise;
    await new Promise<void>((settle) => requestAnimationFrame(() => settle()));
    return this.read();
  },
};

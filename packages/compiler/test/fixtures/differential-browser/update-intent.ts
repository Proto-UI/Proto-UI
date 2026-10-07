import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { createReactAdapter } from '@proto.ui/adapter-react';
import type { RuntimeLifecycleEvent } from '@proto.ui/runtime';

const params = new URL(location.href).searchParams;
const side = params.get('target');
const variant = params.get('variant') ?? 'unchanged';
const lifecycle: RuntimeLifecycleEvent[] = [];
const options = {
  // Host prop delivery must not request a template update on the test's behalf.
  autoUpdateOnPropsChange: false,
  diagnostics: { onLifecycleEvent: (event: RuntimeLifecycleEvent) => lifecycle.push(event) },
};
let component;
let compilation: unknown = null;
if (side === 'reference') {
  const { default: prototype } = await import('./update-intent.proto');
  component = createReactAdapter(React)(prototype, options);
} else if (side === 'candidate') {
  const emitted =
    variant === 'without-update'
      ? await import('virtual:update-intent-without-update')
      : await import('virtual:update-intent');
  component = emitted.createComponent(options);
  compilation = emitted.__puiBrowserFixtureCompilation;
} else if (side === 'source') {
  const emitted = await import('virtual:update-intent-source');
  component = emitted.GeneratedButton;
  compilation = emitted.__puiBrowserFixtureCompilation;
} else throw new Error('Choose reference, candidate or source');

type StateHandle = { get(): number };
type Handle = {
  update(): void;
  getExposes(): { count: StateHandle };
  invokeInCallbackScope<T>(callback: () => T): T;
};
const ref = React.createRef<Handle>();
const host = document.getElementById('update-root')!;
const root = createRoot(host);
let firstHandle: Handle | null = null;
let held: StateHandle | null = null;
let next = 0;
let requested = false;
let present = true;
let updates = 0;
let disposed = false;
const updatedEvents: Array<{ text: string | null; present: boolean; at: number }> = [];
const commits: Array<{
  phase: string;
  commitTime: number;
  at: number;
  updates: number;
  text: string | null;
}> = [];
const text = () => host.querySelector('p')?.textContent ?? null;
const onUpdated = () => {
  ++updates;
  // Read live DOM inside the semantic callback, not only after browser settling.
  updatedEvents.push({
    text: text(),
    present: host.querySelector('[data-pui-root]') !== null,
    at: performance.now(),
  });
};
function render() {
  flushSync(() =>
    root.render(
      React.createElement(
        React.Profiler,
        {
          id: 'update-owner',
          onRender: (_id, phase, _actual, _base, _start, commitTime) => {
            commits.push({ phase, commitTime, at: performance.now(), updates, text: text() });
          },
        },
        React.createElement(component, { next, requested, present, onUpdated, ref })
      )
    )
  );
  // Deliver each committed props edge before observation, including detached
  // false/true request edges. Entering scope does not request a template update.
  flushSync(() => ref.current!.invokeInCallbackScope(() => {}));
}
render();
(window as unknown as Record<string, unknown>).updateProbe = {
  ready() {
    const handle = ref.current;
    const count = handle?.getExposes().count;
    if (!handle || !count || !host.querySelector('p')) return false;
    firstHandle ??= handle;
    held ??= count;
    return true;
  },
  write(value: number) {
    next = value;
    render();
  },
  request() {
    // The unchanged prototype calls zero-argument run.update() only on a true edge.
    if (requested) {
      requested = false;
      render();
    }
    requested = true;
    render();
  },
  setPresent(value: boolean) {
    present = value;
    render();
  },
  rapid(requests: number) {
    // Same browser task, no host prop writes or flushSync between redundant requests.
    for (let index = 0; index < requests; ++index) ref.current!.update();
  },
  dispose() {
    flushSync(() => root.unmount());
    disposed = true;
  },
  read() {
    if (!held || !firstHandle) throw new Error('Initial public handles were not captured');
    let value: number | null = null;
    let invalid = false;
    try {
      value = held.get();
    } catch {
      invalid = true;
    }
    return {
      value,
      text: text(),
      updates,
      present: host.querySelector('[data-pui-root]') !== null,
      sameHandle: ref.current?.getExposes().count === held,
      sameOwnerHandle: ref.current === firstHandle,
      invalid,
      disposed,
    };
  },
  evidence() {
    return {
      compilation,
      lifecycle: lifecycle.map((entry) => ({ ...entry })),
      commits,
      updatedEvents,
    };
  },
};

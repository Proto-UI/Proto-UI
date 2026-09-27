import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { createReactAdapter } from '@proto.ui/adapter-react';
import type { RuntimeLifecycleEvent } from '@proto.ui/runtime';
// Read-only test instrumentation of the Adapter's actual token registry, not a synthetic owner counter.
import {
  getLogicalEventRouteSurfaceForTarget,
  getLogicalTriggerSurfaceRoot,
  getLogicalParent,
} from '../../../../adapters/react/src/platform/instance-tree';

const params = new URL(location.href).searchParams;
const side = params.get('target');
const variant = params.get('variant') ?? 'unchanged';
const events: RuntimeLifecycleEvent[] = [];
const options = {
  schedule: (task: () => void) => task(),
  diagnostics: { onLifecycleEvent: (event: RuntimeLifecycleEvent) => events.push(event) },
};
let component;
if (side === 'reference') {
  const { default: prototype } = await import('./retained-owner.proto');
  component = createReactAdapter(React)(prototype, options);
} else if (side === 'candidate') {
  const emitted =
    variant === 'reset-state'
      ? await import('virtual:retained-owner-reset-state')
      : variant === 'recreate-owner'
        ? await import('virtual:retained-owner-recreate-owner')
        : variant === 'reattach-state-loss'
          ? await import('virtual:retained-owner-reattach-state-loss')
          : await import('virtual:retained-owner');
  component = emitted.createComponent(options);
} else throw new Error('Choose reference or candidate');

const stateKeys = ['disabled', 'hovered', 'pressed', 'focused', 'focusVisible', 'count'] as const;
type StateHandle = { get(): boolean | number };
type Exposes = Record<(typeof stateKeys)[number], StateHandle> & { focusSelf(): void };
const ref = React.createRef<{ getExposes(): Exposes }>();
let held: Record<string, StateHandle> | null = null;
let firstOwner: object | null = null;
let lastOwner: object | null = null;
const ownerIds = new WeakMap<object, string>();
let ownerSequence = 0;
function ownerId(token: object | null): string | null {
  if (!token) return null;
  let id = ownerIds.get(token);
  if (!id) {
    id = `${side}-owner-${++ownerSequence}`;
    ownerIds.set(token, id);
  }
  return id;
}
let present = false;
let disabled = false;
let clicks = 0;
let viewEnded = 0;
let staleTarget: HTMLElement | null = null;
let disposed = false;
const host = document.getElementById('native-root')!;
// This root and component position remain unchanged throughout every view epoch.
const root = createRoot(host);
const Context = React.createContext('missing-provider');
function NativeChild() {
  return React.createElement(
    'span',
    { 'data-native-context': React.useContext(Context) },
    'Epoch button'
  );
}
function render() {
  flushSync(() =>
    root.render(
      React.createElement(
        Context.Provider,
        { value: 'retained-context' },
        React.createElement(
          component,
          {
            present,
            disabled,
            ref,
            onClick: () => {
              clicks += 1;
            },
            onViewEnded: () => {
              viewEnded += 1;
            },
          },
          React.createElement(NativeChild)
        )
      )
    )
  );
}
const target = () => host.querySelector<HTMLElement>('[data-pui-root]');
const readHeld = () =>
  Object.fromEntries(
    stateKeys.map((key) => {
      try {
        return [key, { valid: true, value: held![key].get() }];
      } catch {
        return [key, { valid: false, value: null }];
      }
    })
  );
render();
(window as unknown as Record<string, unknown>).nativeProbe = {
  ready() {
    const exposes = ref.current?.getExposes();
    if (!exposes || stateKeys.some((key) => !exposes[key])) return false;
    held ??= Object.fromEntries(stateKeys.map((key) => [key, exposes[key]]));
    return true;
  },
  read() {
    if (!held) throw new Error('Initial handles not captured');
    const exposes = ref.current?.getExposes();
    const node = target();
    const projectedOwner = node ? getLogicalEventRouteSurfaceForTarget(node) : null;
    if (projectedOwner) {
      firstOwner ??= projectedOwner;
      lastOwner = projectedOwner;
    }
    const retained = readHeld();
    const phases = events.filter(
      (event): event is Extract<RuntimeLifecycleEvent, { type: 'mount.phase' }> =>
        event.type === 'mount.phase'
    );
    const instancePhases = events.filter(
      (event): event is Extract<RuntimeLifecycleEvent, { type: 'instance.phase' }> =>
        event.type === 'instance.phase'
    );
    return {
      present: node !== null,
      observedOwnerId: ownerId(lastOwner) ?? 'not-yet-projected',
      observedParentId: lastOwner ? ownerId(getLogicalParent(lastOwner)) : null,
      ownerObservedNow: projectedOwner !== null,
      sameOwner: firstOwner !== null && lastOwner === firstOwner,
      ownerProjectionMatches:
        firstOwner !== null && getLogicalTriggerSurfaceRoot(firstOwner) === node,
      nameInput: 'Epoch button',
      count: retained.count.value,
      handlesValid: stateKeys.every((key) => retained[key].valid),
      sameHandles: Boolean(exposes && stateKeys.every((key) => held![key] === exposes[key])),
      disabled: retained.disabled.value,
      hovered: retained.hovered.value,
      pressed: retained.pressed.value,
      focused: retained.focused.value,
      active: node !== null && document.activeElement === node,
      nativeContext:
        node?.querySelector('[data-native-context]')?.getAttribute('data-native-context') ?? null,
      setupCount: events.filter((event) => event.type === 'instance.setup.exit').length,
      createdCount: events.filter((event) => event.type === 'instance.created').length,
      mountedCount: events.filter((event) => event.type === 'mount.mounted').length,
      disposeCount: events.filter((event) => event.type === 'instance.dispose.done').length,
      instancePhase: instancePhases.at(-1)?.phase ?? null,
      mountPhase: phases.at(-1)?.phase ?? null,
      epoch: phases.at(-1)?.epoch ?? 0,
      lifecycle: events.map((event) => ({ ...event })),
      staleConnected: staleTarget?.isConnected ?? false,
      replacedTarget: Boolean(node && staleTarget && node !== staleTarget),
      refCleared: ref.current === null,
      disposed,
      clicks,
      viewEnded,
    };
  },
  setPresent(next: boolean) {
    if (!next && target()) staleTarget = target();
    present = next;
    render();
  },
  setDisabled(next: boolean) {
    disabled = next;
    render();
  },
  rerender() {
    render();
  },
  focusSelf() {
    ref.current!.getExposes().focusSelf();
  },
  staleClick() {
    if (!staleTarget || staleTarget.isConnected) throw new Error('No detached old target');
    staleTarget.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
  },
  dispose() {
    staleTarget = target() ?? staleTarget;
    flushSync(() => root.unmount());
    disposed = true;
  },
};

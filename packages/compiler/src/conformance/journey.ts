import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactAdapterOptions } from '@proto.ui/adapter-react';
import type { Prototype } from '@proto.ui/core';
import { TraceRecorder, type SemanticCheckpoint, type TraceValue } from './trace';

/**
 * Simulated-host journey only: dispatchEvent creates synthetic input, never
 * browser-trusted native input. The driver supplies identical props and events
 * and records observations; actual native behavior is exercised by browser automation.
 */
export interface TargetComponent {
  (props: Record<string, unknown>): React.ReactElement;
  getExposes?(): Record<string, unknown> | null;
}

export type JourneyAction =
  | { kind: 'pointer-enter' | 'pointer-leave' | 'pointer-down' | 'pointer-up' | 'pointer-cancel' }
  | { kind: 'simulated-click' }
  | { kind: 'key-down' | 'key-up'; key: string }
  | { kind: 'focus' }
  | { kind: 'tab' }
  | { kind: 'rerender'; props: Record<string, unknown>; omitKeys?: readonly string[] }
  | { kind: 'unmount' }
  | { kind: 'remount'; props: Record<string, unknown> };

export interface JourneyStep {
  id: string;
  action: JourneyAction;
}

export interface JourneyObservation {
  step: string;
  ownerId: string;
  parentId: string | null;
  viewEpoch: number;
  data: Record<string, unknown>;
}

export interface JourneyRunOptions {
  mountProps: Record<string, unknown>;
  steps: readonly JourneyStep[];
  observe: (
    exposes: Record<string, unknown> | null,
    host: HTMLElement,
    run: JourneyContext
  ) => TraceValue;
  displayName?: string;
  adapterOptions?: ReactAdapterOptions<Record<string, unknown>>;
}

export interface JourneyContext {
  mounted: boolean;
  remounts: number;
  hasProp(name: string): boolean;
}

interface StateLike {
  get(): unknown;
}

/**
 * Reads semantic facts from an exposes record without target-specific knowledge.
 * Handles `ExposeState` members uniformly; method/event members are ignored for
 * state observation but remain reachable for target-specific checks.
 */
export function readExposedStates(
  exposes: Record<string, unknown> | null | undefined
): Record<string, TraceValue> {
  if (!exposes) return {};
  const snapshot: Record<string, TraceValue> = {};
  for (const [name, entry] of Object.entries(exposes)) {
    if (
      entry !== null &&
      typeof entry === 'object' &&
      'get' in entry &&
      typeof (entry as StateLike).get === 'function'
    ) {
      const value = (entry as StateLike).get();
      if (
        value === null ||
        typeof value === 'boolean' ||
        typeof value === 'number' ||
        typeof value === 'string'
      ) {
        snapshot[name] = value;
      }
    }
  }
  return snapshot;
}

export function semanticId(displayName: string, index: number): string {
  return `${displayName}-${index}`;
}

export async function runJourney(
  component: TargetComponent,
  options: JourneyRunOptions
): Promise<readonly SemanticCheckpoint[]> {
  const recorder = new TraceRecorder();
  const displayName = options.displayName ?? 'target';
  const host = document.createElement('div');
  document.body.append(host);
  let root: Root | null = createRoot(host);
  let mounted = false;
  let remounts = 0;
  const context: JourneyContext = {
    get mounted() {
      return mounted;
    },
    get remounts() {
      return remounts;
    },
    hasProp: (name) => Object.hasOwn(currentProps, name),
  };

  let handle: { getExposes?: () => Record<string, unknown> } | null = null;
  const ref = (value: unknown) => {
    handle = value as { getExposes?: () => Record<string, unknown> } | null;
  };
  let currentProps: Record<string, unknown> = options.mountProps;
  const render = (props: Record<string, unknown>) => {
    currentProps = props;
    return React.createElement(component as React.ComponentType<Record<string, unknown>>, {
      ...props,
      ref,
    });
  };
  const exposesFor = () => handle?.getExposes?.() ?? null;

  const observe = (step: string, inputSources: SemanticCheckpoint['inputSources']) => {
    const data = options.observe(exposesFor(), host, context);
    recorder.record({
      step,
      phase: mounted ? 'mounted' : 'detached',
      ownerId: semanticId(displayName, 0),
      parentId: null,
      viewEpoch: remounts,
      kind: 'snapshot',
      inputSources,
      data,
    });
  };

  const rootElement = (): HTMLElement => {
    const element = host.firstElementChild;
    if (!(element instanceof HTMLElement))
      throw new Error(`Journey ${displayName}: no mounted root element`);
    return element;
  };

  try {
    await act(async () => {
      root!.render(render(options.mountProps));
    });
    mounted = true;
    observe('mount', ['host-api']);

    for (const step of options.steps) {
      const action = step.action;
      switch (action.kind) {
        case 'pointer-enter':
          await act(async () => {
            rootElement().dispatchEvent(new MouseEvent('pointerenter', { bubbles: false }));
          });
          break;
        case 'pointer-leave':
          await act(async () => {
            rootElement().dispatchEvent(new MouseEvent('pointerleave', { bubbles: false }));
          });
          break;
        case 'pointer-down':
          await act(async () => {
            rootElement().dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
          });
          break;
        case 'pointer-up':
          await act(async () => {
            rootElement().dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
          });
          break;
        case 'pointer-cancel':
          await act(async () => {
            rootElement().dispatchEvent(new MouseEvent('pointercancel', { bubbles: true }));
          });
          break;
        case 'simulated-click':
          await act(async () => {
            const event = new MouseEvent('click', { bubbles: true, detail: 1 });
            rootElement().dispatchEvent(event);
          });
          break;
        case 'key-down':
        case 'key-up':
          await act(async () => {
            const init: KeyboardEventInit & { detail?: number } = {
              key: action.key,
              bubbles: true,
              cancelable: true,
            };
            const event = new KeyboardEvent(action.kind === 'key-down' ? 'keydown' : 'keyup', init);
            rootElement().dispatchEvent(event);
          });
          break;
        case 'focus':
          await act(async () => {
            rootElement().focus();
          });
          break;
        case 'tab':
          await act(async () => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
            rootElement().focus();
          });
          break;
        case 'rerender':
          await act(async () => {
            const props = { ...currentProps, ...action.props };
            for (const key of action.omitKeys ?? []) delete props[key];
            root!.render(render(props));
          });
          break;
        case 'unmount':
          await act(async () => {
            await root!.unmount();
          });
          root = null;
          mounted = false;
          break;
        case 'remount':
          remounts += 1;
          root = createRoot(host);
          await act(async () => {
            root!.render(render(action.props));
          });
          mounted = true;
          break;
      }
      observe(
        step.id,
        action.kind === 'tab'
          ? ['synthetic-dispatch', 'host-api']
          : ['focus', 'rerender', 'unmount', 'remount'].includes(action.kind)
            ? ['host-api']
            : ['synthetic-dispatch']
      );
    }
  } finally {
    if (root) {
      const activeRoot = root;
      await act(async () => {
        await activeRoot.unmount();
      });
    }
    host.remove();
  }
  return recorder.snapshot();
}

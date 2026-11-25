import {
  Fragment,
  createElement,
  useImperativeHandle,
  useMemo,
  useSyncExternalStore,
  type DependencyList,
  type ReactElement,
  type Ref,
} from 'react';
import { createPortal, version as rendererVersion } from 'react-dom';
import {
  PublishedInputs,
  useEarlierReactInputs,
  usePublishedInputs,
  type InputLease,
} from './lifetime.ts';

// Older React DOM can skip insertion cleanup for an already-hidden Suspense
// subtree (react/react#30954). It still removes each portal's host children in
// the mutation phase, independently of the visible subtree's physical location.
const earlierDOM = /^(?:18\.3|19\.[01])\./.test(rendererVersion);
let containers: WeakMap<Document, DocumentFragment> | undefined;

function detachedContainer(): DocumentFragment {
  containers ??= new WeakMap();
  let container = containers.get(document);
  if (!container) {
    container = document.createDocumentFragment();
    containers.set(document, container);
  }
  return container;
}

class EarlierHostInputs<Inputs> extends PublishedInputs<Inputs> {
  #marker: Element | undefined;

  // Hiding clears refs without deleting host nodes. Keep the committed marker
  // across ref disconnect/reconnect and StrictMode's effect replay.
  rememberMarker(node: Element | null): void {
    if (node) this.#marker = node;
  }
  get hasMarker(): boolean {
    return this.#marker !== undefined;
  }

  #withdrawIfRemoved(): void {
    if (this.#marker?.parentNode === null) this.release();
  }

  override active(): boolean {
    this.#withdrawIfRemoved();
    return super.active();
  }

  override read(): Inputs {
    this.#withdrawIfRemoved();
    return super.read();
  }

  override release(): void {
    super.release();
    if (this.#marker?.parentNode === null) this.#marker = undefined;
  }
}

function createEarlierInputs<Inputs>() {
  return new EarlierHostInputs<Inputs>();
}

function useEarlierRetainedInputs<Inputs>(inputs: Inputs): InputLease<Inputs> {
  return useEarlierReactInputs(inputs, createEarlierInputs<Inputs>);
}

export const useRetainedInputs = earlierDOM ? useEarlierRetainedInputs : usePublishedInputs;

function clientSnapshot(): boolean {
  return true;
}
function serverSnapshot(): boolean {
  return false;
}
function unsubscribe() {}
function subscribeToHydration() {
  return unsubscribe;
}

function useEarlierHandle<Inputs, Handle>(
  owner: InputLease<Inputs>,
  ref: Ref<Handle> | undefined,
  make: () => Handle,
  deps: DependencyList,
  view: ReactElement
): ReactElement {
  if (!(owner instanceof EarlierHostInputs))
    throw new TypeError('The retained React DOM handle requires its own input lease.');
  // The server (even with a global document) and initial hydration produce the
  // authored markup. First expose a hydrated ref in the commit that can protect
  // it. Ordinary client roots use the client snapshot on their very first render.
  const ready = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot);
  const needsMarker = ready && (ref != null || owner.hasMarker);
  const portal = useMemo(
    () =>
      needsMarker
        ? createPortal(
            createElement('span', {
              ref: (node: HTMLSpanElement | null) => owner.rememberMarker(node),
            }),
            detachedContainer()
          )
        : null,
    [needsMarker, owner]
  );
  useImperativeHandle(ready ? ref : null, make, deps);
  return portal ? createElement(Fragment, null, view, portal) : view;
}

function useCurrentHandle<Inputs, Handle>(
  _owner: InputLease<Inputs>,
  ref: Ref<Handle> | undefined,
  make: () => Handle,
  deps: DependencyList,
  view: ReactElement
): ReactElement {
  useImperativeHandle(ref, make, deps);
  return view;
}

export const useRetainedHandle = earlierDOM ? useEarlierHandle : useCurrentHandle;

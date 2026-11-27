import {
  Fragment,
  createElement,
  useEffect,
  useImperativeHandle,
  useInsertionEffect,
  useMemo,
  useRef,
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

export function useCreatedActions<Inputs>(owner: InputLease<Inputs>, created: () => void): void {
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current || !owner.active()) return;
    ran.current = true;
    created();
  }, [owner, created]);
}

export function useTaskLifetime(dispose: () => void): void {
  const epoch = useRef(0);
  useInsertionEffect(() => dispose, [dispose]);
  useEffect(() => {
    if (!earlierDOM) return;
    const current = ++epoch.current;
    // Older DOM renderers can omit hidden-tree insertion cleanup. A replay
    // in development reconnects the same lifetime before this microtask.
    return () => {
      queueMicrotask(() => { if (epoch.current === current) dispose(); });
    };
  }, [dispose]);
}

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

function useEarlierView<Inputs>(
  owner: InputLease<Inputs>,
  observe: boolean,
  view: ReactElement,
): { ready: boolean; view: ReactElement } {
  if (!(owner instanceof EarlierHostInputs))
    throw new TypeError('The retained React DOM handle requires its own input lease.');
  // The server (even with a global document) and initial hydration produce the
  // authored markup. First expose a hydrated ref in the commit that can protect
  // it. Ordinary client roots use the client snapshot on their very first render.
  const ready = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot);
  const needsMarker = ready && (observe || owner.hasMarker);
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
  return { ready, view: portal ? createElement(Fragment, null, view, portal) : view };
}

function useEarlierHandle<Inputs, Handle>(
  owner: InputLease<Inputs>, ref: Ref<Handle> | undefined, make: () => Handle,
  deps: DependencyList, view: ReactElement, tasks = false,
): ReactElement {
  const retained = useEarlierView(owner, tasks || ref != null, view);
  useImperativeHandle(retained.ready ? ref : null, make, deps);
  return retained.view;
}

export const useRetainedView = earlierDOM
  ? <Inputs>(owner: InputLease<Inputs>, view: ReactElement) => useEarlierView(owner, true, view).view
  : <Inputs>(_owner: InputLease<Inputs>, view: ReactElement) => view;

function useCurrentHandle<Inputs, Handle>(
  _owner: InputLease<Inputs>,
  ref: Ref<Handle> | undefined,
  make: () => Handle,
  deps: DependencyList,
  view: ReactElement,
  _tasks?: boolean,
): ReactElement {
  useImperativeHandle(ref, make, deps);
  return view;
}

export const useRetainedHandle = earlierDOM ? useEarlierHandle : useCurrentHandle;

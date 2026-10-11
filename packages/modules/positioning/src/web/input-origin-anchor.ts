import type { InputOriginAnchor } from '@proto.ui/core';
import type { VirtualElement } from '@floating-ui/dom';

export type WebInputOriginReference = Readonly<{
  element: HTMLElement;
  reference: HTMLElement | VirtualElement;
  isLive(): boolean;
  subscribeInvalidation(callback: () => void): () => void;
}>;
const references = new WeakMap<object, WebInputOriginReference>();

/** Privileged host-only registry. The portable association has no inspectable geometry. */
export function createWebInputOriginAnchor(
  element: HTMLElement,
  point?: { x: number; y: number }
): { anchor: InputOriginAnchor; dispose(): void } {
  const anchor = Object.freeze(Object.create(null)) as InputOriginAnchor;
  let live = true;
  const listeners = new Set<() => void>();
  // Copy primitives before creating the closure; never retain a native input event.
  const x = point?.x;
  const y = point?.y;
  const reference: HTMLElement | VirtualElement = point
    ? {
        contextElement: element,
        getBoundingClientRect: () => ({
          x: x!,
          y: y!,
          left: x!,
          top: y!,
          right: x!,
          bottom: y!,
          width: 0,
          height: 0,
          toJSON: () => ({}),
        }),
      }
    : element;
  references.set(anchor, {
    element,
    reference,
    isLive: () => live && element.isConnected,
    subscribeInvalidation(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  });
  return {
    anchor,
    dispose() {
      if (!live) return;
      live = false;
      references.delete(anchor);
      for (const callback of [...listeners]) callback();
      listeners.clear();
    },
  };
}
export function resolveWebInputOriginAnchor(value: unknown): WebInputOriginReference | null {
  if (!value || typeof value !== 'object') return null;
  const reference = references.get(value);
  return reference?.isLive() ? reference : null;
}

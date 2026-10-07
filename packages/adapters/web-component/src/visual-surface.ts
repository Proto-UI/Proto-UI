/** Adapter-private nodes must never become application slot input. */
const visualOwners = new WeakMap<Node, HTMLElement>();
export const isOwnedVisualNode = (host: HTMLElement, node: Node) => visualOwners.get(node) === host;

export type OwnedVisualSurface = {
  mount(node: HTMLElement): void;
  release(node: HTMLElement): void;
};
export function createOwnedVisualSurface(
  host: HTMLElement,
  root: Element | ShadowRoot
): OwnedVisualSurface {
  return {
    mount(node) {
      visualOwners.set(node, host);
      if (node.parentNode !== root) root.prepend(node);
    },
    release(node) {
      node.remove();
      visualOwners.delete(node);
    },
  };
}

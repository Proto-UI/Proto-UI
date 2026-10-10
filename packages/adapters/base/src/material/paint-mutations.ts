/** Exact final-state ownership for the renderer's own DOM writes. This is not
 * an attribute/node-name exemption: author edits that change the final marker,
 * sheet contents, parent, or order still invalidate admission. */
const marker = 'data-pui-material-carrier';
const markerStates = new WeakMap<HTMLElement, string | null>();
const sheetStates = new WeakMap<
  Node,
  { parent: Node | null; mutationParent: Node | null; next: Node | null }
>();
export function withOwnedCarrierMarker<T>(host: HTMLElement, write: () => T): T {
  const before = host.getAttribute(marker);
  try {
    return write();
  } finally {
    const after = host.getAttribute(marker);
    if (before !== after) markerStates.set(host, after);
  }
}
export function appendOwnedCarrierSheet(node: HTMLStyleElement, parent: Node & ParentNode) {
  parent.append(node);
  sheetStates.set(node, { parent, mutationParent: parent, next: node.nextSibling });
}
export function removeOwnedCarrierSheet(node: HTMLStyleElement) {
  const parent = node.parentNode;
  node.remove();
  sheetStates.set(node, { parent: null, mutationParent: parent, next: null });
}
export function isOwnedCarrierMutation(record: MutationRecord): boolean {
  if (record.type === 'attributes' && record.attributeName === marker) {
    const host = record.target as HTMLElement;
    return markerStates.has(host) && host.getAttribute(marker) === markerStates.get(host);
  }
  if (record.type !== 'childList') return false;
  const nodes = [...record.addedNodes, ...record.removedNodes];
  return (
    nodes.length > 0 &&
    nodes.every((node) => {
      const state = sheetStates.get(node);
      return (
        !!state &&
        record.target === state.mutationParent &&
        node.parentNode === state.parent &&
        node.nextSibling === state.next
      );
    })
  );
}

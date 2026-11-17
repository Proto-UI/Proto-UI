/** Renderer-owned containers map to retained authored nodes. A Selection may
 * point between wrapper children rather than into a Text node; preserving only
 * connected endpoints would silently lose that selection when a wrapper retires. */
const sourceContainers = new WeakMap<Node, readonly Node[]>();
export function registerNativeContentContainer(container: Node, source: readonly Node[]): void {
  sourceContainers.set(container, [...source]);
}
type Boundary = { node: Node; offset: number; previous: Node | null; next: Node | null };
function edge(node: Node | undefined, after: boolean): Node | null {
  if (!node) return null;
  const source = sourceContainers.get(node);
  return source ? edge(source[after ? source.length - 1 : 0], after) : node;
}
function capture(node: Node | null | undefined, offset: number): Boundary | null {
  if (!node) return null;
  const children = sourceContainers.get(node) ?? Array.from(node.childNodes);
  return {
    node,
    offset,
    previous: edge(children[offset - 1], true),
    next: edge(children[offset], false),
  };
}
function resolve(boundary: Boundary | null): { node: Node; offset: number } | null {
  if (!boundary) return null;
  for (const [sibling, after] of [
    [boundary.next, false],
    [boundary.previous, true],
  ] as const) {
    if (sibling?.isConnected && sibling.parentNode)
      return {
        node: sibling.parentNode,
        offset:
          Array.prototype.indexOf.call(sibling.parentNode.childNodes, sibling) + (after ? 1 : 0),
      };
  }
  return boundary.node.isConnected ? { node: boundary.node, offset: boundary.offset } : null;
}
/** Preserve browser-owned focus and directional Selection around a physical
 * composition move. Source nodes are retained, never cloned or serialized. */
export function withNativeContentLease(scope: HTMLElement, move: () => void): void {
  const document = scope.ownerDocument;
  const focused = document.activeElement as HTMLElement | null;
  const ownedFocus = focused && (focused === scope || scope.contains(focused));
  const input = ownedFocus ? (focused as HTMLInputElement | HTMLTextAreaElement) : null;
  const inputSelection =
    input && typeof input.selectionStart === 'number'
      ? ([input.selectionStart, input.selectionEnd, input.selectionDirection ?? undefined] as const)
      : null;
  const selection = document.getSelection();
  const anchor = capture(selection?.anchorNode, selection?.anchorOffset ?? 0);
  const extent = capture(selection?.focusNode, selection?.focusOffset ?? 0);
  // A generated shell can be an ancestor of the retained scope. Only accept
  // such endpoints when its explicit source lease resolves into this scope;
  // an arbitrary ancestor or adjacent preview must not acquire ownership.
  const ownsBoundary = (boundary: Boundary | null): boolean =>
    !!boundary &&
    (scope.contains(boundary.node) ||
      (sourceContainers.has(boundary.node) &&
        [boundary.previous, boundary.next].some((node) => !!node && scope.contains(node))));
  const ownedSelection = !!selection && (ownsBoundary(anchor) || ownsBoundary(extent));
  move();
  if (ownedFocus && focused.isConnected && document.activeElement !== focused)
    focused.focus({ preventScroll: true });
  const nextAnchor = resolve(anchor),
    nextExtent = resolve(extent);
  if (ownedSelection && nextAnchor && nextExtent) {
    try {
      selection!.setBaseAndExtent(
        nextAnchor.node,
        nextAnchor.offset,
        nextExtent.node,
        nextExtent.offset
      );
    } catch {
      /* Connected callbacks may edit source lengths. Cleanup still completes. */
    }
  }
  // Restoring the document range can reset the focused text control's caret.
  if (
    inputSelection &&
    input?.isConnected &&
    document.activeElement === input &&
    typeof input.selectionStart === 'number'
  )
    input.setSelectionRange(...inputSelection);
}

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
  const children = sourceContainers.get(node) ?? node.childNodes;
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
function activeElement(document: Document): HTMLElement | null {
  let active = document.activeElement as HTMLElement | null;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement as HTMLElement;
  return active;
}
/** Preserve browser-owned focus and directional Selection around a physical
 * composition move. Source nodes are retained, never cloned or serialized. */
export function withNativeContentLease(scope: HTMLElement, move: () => void): void {
  const document = scope.ownerDocument;
  const focused = activeElement(document);
  let focusOwner: Node | null = focused;
  const focusRoots: ShadowRoot[] = [];
  while (focusOwner && !scope.contains(focusOwner)) {
    const root = focusOwner.getRootNode();
    if (root.nodeType === 11 && 'host' in root) {
      focusRoots.push(root as ShadowRoot);
      focusOwner = (root as ShadowRoot).host;
    } else focusOwner = null;
  }
  const ownedFocus = !!focusOwner;
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
  if (!ownedFocus && !ownedSelection) {
    move();
    return;
  }
  let focusRevoked = false;
  const removals = ownedFocus ? new MutationObserver(() => {}) : null;
  let blurPath: Set<EventTarget> | null = null;
  const onFocus = () => {
    if (activeElement(document) !== focused) focusRevoked = true;
  };
  const onBlur = (event: Event) => {
    if (!focused?.isConnected || !event.composedPath().includes(focused)) return;
    // Native focusout can precede its removal while the field is still connected.
    // Only subsequent removal of this path identifies transport-induced loss.
    removals!.takeRecords();
    blurPath = new Set(event.composedPath());
  };
  const settleBlur = () => {
    if (!blurPath) return;
    const path = blurPath;
    blurPath = null;
    const moved = removals!
      .takeRecords()
      .some((record) => Array.from(record.removedNodes).some((node) => path.has(node)));
    if (!moved) focusRevoked = true;
  };
  if (ownedFocus) {
    removals!.observe(scope.parentNode ?? scope, { childList: true, subtree: true });
    for (const root of focusRoots) removals!.observe(root, { childList: true, subtree: true });
    document.addEventListener('focusin', onFocus, true);
    document.addEventListener('focusout', onBlur, true);
  }
  try {
    move();
    settleBlur();
    if (!focusRevoked && ownedFocus && focused?.isConnected && activeElement(document) !== focused)
      focused.focus({ preventScroll: true });
    settleBlur();
    // Move and focus callbacks may replace the value or select a newer range.
    const input =
      !focusRevoked && ownedFocus && activeElement(document) === focused
        ? (focused as HTMLInputElement | HTMLTextAreaElement)
        : null;
    const inputSelection =
      input && typeof input.selectionStart === 'number'
        ? ([
            input.selectionStart,
            input.selectionEnd,
            input.selectionDirection ?? undefined,
          ] as const)
        : null;
    if (!focusRevoked && ownedSelection) {
      const nextAnchor = resolve(anchor),
        nextExtent = resolve(extent);
      if (nextAnchor && nextExtent) {
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
    }
    settleBlur();
    // Restoring the document range can reset the focused text control's caret.
    if (
      !focusRevoked &&
      inputSelection &&
      input?.isConnected &&
      activeElement(document) === input &&
      typeof input.selectionStart === 'number'
    )
      input.setSelectionRange(...inputSelection);
  } finally {
    if (ownedFocus) {
      document.removeEventListener('focusin', onFocus, true);
      document.removeEventListener('focusout', onBlur, true);
      removals!.disconnect();
    }
  }
}

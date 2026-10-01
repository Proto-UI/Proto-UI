// `Node.DOCUMENT_POSITION_PRECEDING`, spelled out so ordering needs no `Node`
// global from the realm the helper runs in.
const DOCUMENT_POSITION_PRECEDING = 0x02;

function isNode(value: object): value is Node {
  return (
    typeof (value as Node).compareDocumentPosition === 'function' &&
    typeof (value as Node).getRootNode === 'function'
  );
}

/**
 * Orders Focus targets by document order: the Web realization of
 * `HC-FOCUS-ORDER-0001`.
 *
 * Document order is a total order only within one tree. When a target is not a
 * node, or the targets sit in different trees (another shadow root, a detached
 * subtree or another document), there is no single document order: the set is
 * reported unorderable, and Focus keeps registration order for that navigation.
 */
export function orderFocusTargetsByDocument(targets: readonly object[]): readonly object[] | null {
  if (!targets.every(isNode)) return null;
  const tree = targets[0]?.getRootNode();
  if (targets.some((target) => target.getRootNode() !== tree)) return null;
  return [...targets].sort((a, b) => {
    if (a === b) return 0;
    return a.compareDocumentPosition(b) & DOCUMENT_POSITION_PRECEDING ? 1 : -1;
  });
}

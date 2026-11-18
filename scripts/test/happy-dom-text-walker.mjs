/** Correct Happy DOM's text-only traversal for one caller root; restore after the test. */
export function repairHappyDomTextWalker(window, root) {
  const document = root.ownerDocument;
  const original = document.createTreeWalker;
  document.createTreeWalker = function (walkerRoot, whatToShow, filter) {
    if (walkerRoot !== root || whatToShow !== window.NodeFilter.SHOW_TEXT || filter)
      return original.call(this, walkerRoot, whatToShow, filter);
    const nodes = [];
    const visit = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === window.Node.TEXT_NODE) nodes.push(child);
        visit(child);
      }
    };
    visit(root);
    let index = -1;
    return {
      root,
      whatToShow,
      filter: null,
      currentNode: root,
      nextNode() {
        const next = nodes[++index];
        if (!next) return null;
        this.currentNode = next;
        return next;
      },
    };
  };
  return { restore() { document.createTreeWalker = original; } };
}

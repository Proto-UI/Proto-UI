import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** Test-only correction for happy-dom 15.11.7's no-filter SHOW_TEXT nextNode().
 * The live DOM supplies every returned node; no expected caller payload is injected.
 * Other roots, masks, filters and walker operations keep the installed behavior.
 * Install only after the independent unmodified-package probe confirms the defect.
 */
export function repairHappyDomTextWalker(view, root) {
  const version = require('happy-dom/package.json').version;
  if (
    version !== '15.11.7' ||
    !view.happyDOM ||
    root.ownerDocument?.defaultView !== view
  ) {
    throw new Error(`Text walker correction requires happy-dom 15.11.7 and its owned root, got ${version}`);
  }
  // Document's factory uses its implementation class, not window's bound subclass.
  const sample = root.ownerDocument.createTreeWalker(root, view.NodeFilter.SHOW_TEXT);
  const prototype = Object.getPrototypeOf(sample);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'nextNode');
  const nextNode = prototype.nextNode;
  function correctedNextNode() {
    if (
      this.root !== root ||
      this.whatToShow !== view.NodeFilter.SHOW_TEXT ||
      this.filter !== null ||
      root.ownerDocument?.defaultView !== view ||
      !this.currentNode ||
      (this.currentNode !== root && !root.contains(this.currentNode))
    ) {
      return nextNode.call(this);
    }
    let node = this.currentNode;
    while (node) {
      if (node.firstChild) {
        node = node.firstChild;
      } else {
        while (node && node !== root && !node.nextSibling) node = node.parentNode;
        if (!node || node === root) return null;
        node = node.nextSibling;
      }
      if (node.nodeType === view.Node.TEXT_NODE) {
        this.currentNode = node;
        return node;
      }
    }
    return null;
  }
  Object.defineProperty(prototype, 'nextNode', {
    value: correctedNextNode,
    configurable: true,
    writable: true,
  });
  return {
    restore() {
      if (descriptor) Object.defineProperty(prototype, 'nextNode', descriptor);
      else Reflect.deleteProperty(prototype, 'nextNode');
    },
  };
}

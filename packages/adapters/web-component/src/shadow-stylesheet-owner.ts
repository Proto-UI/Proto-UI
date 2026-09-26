import type { ShadowOwnerShell } from './shadow-owner-shell';

export type ShadowStylesheetOwner = {
  readonly element: HTMLStyleElement;
  readonly cssText: string;
  update(cssText: string): void;
  dispose(): void;
};

const stylesheetOwners = new WeakMap<ShadowRoot, ShadowStylesheetOwner>();

/**
 * Owns the fallback `<style>` resource for one Shadow owner shell.
 *
 * This is intentionally not part of the package export surface. The future
 * split profile still needs a governed Shadow-targeted CSS artifact before it
 * can wire this owner into `AdaptToWebComponent`.
 */
export function createShadowStylesheetOwner(
  shell: ShadowOwnerShell,
  initialCssText: string
): ShadowStylesheetOwner {
  const current = stylesheetOwners.get(shell.root);
  if (current) {
    current.update(initialCssText);
    return current;
  }

  const element = shell.root.ownerDocument.createElement('style');
  element.setAttribute('data-pui-shadow-stylesheet', '');
  let cssText = initialCssText;
  let disposed = false;
  element.textContent = cssText;
  shell.attachOwnerNode(element);

  const owner: ShadowStylesheetOwner = {
    element,
    get cssText() {
      return cssText;
    },
    update(nextCssText) {
      if (disposed) {
        throw new Error('shadow-sheet:disposed');
      }
      shell.attachOwnerNode(element);
      if (nextCssText === cssText && element.textContent === nextCssText) return;
      cssText = nextCssText;
      element.textContent = nextCssText;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      shell.detachOwnerNode(element);
      if (stylesheetOwners.get(shell.root) === owner) stylesheetOwners.delete(shell.root);
    },
  };

  stylesheetOwners.set(shell.root, owner);
  return owner;
}

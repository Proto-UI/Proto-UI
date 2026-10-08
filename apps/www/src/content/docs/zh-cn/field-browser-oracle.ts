// Both the direct host (React/Vue/Vue2) and WC's descendant editor belong to
// the same authored Control ref. Keep ownership separate from cardinality.
export const fieldControlSelector = (id: string) => `[data-demo-ref="${id}Control"]`;
export const fieldEditorSelector = (id: string) =>
  `input${fieldControlSelector(id)}, ${fieldControlSelector(id)} input`;

// This function also runs in the native page via Locator.evaluate.
export function fieldEditorOwnerRef(editor: Element): string | null {
  let current: Element | null = editor;
  while (current) {
    if (current.hasAttribute('data-demo-ref')) return current.getAttribute('data-demo-ref');
    const root = current.getRootNode();
    current = current.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
  }
  return null;
}

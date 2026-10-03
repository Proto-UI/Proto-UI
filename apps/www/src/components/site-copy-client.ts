import { initCopyCommand, type SiteCopyCommand } from './site-copy-command';

export function readCopyText(root: HTMLElement): string {
  if (root.hasAttribute('data-site-copy-text')) return root.dataset.siteCopyText ?? '';
  const panel = root.closest('[data-code-shell]');
  if (panel) {
    const code = panel.querySelector<HTMLElement>('.proto-previewer__code code');
    return code?.dataset.rawCode ?? code?.textContent ?? '';
  }
  const card = root.closest('[data-install-command-card]');
  return (
    card?.querySelector<HTMLElement>('[data-command-panel]:not([hidden]) [data-command]')
      ?.textContent ?? ''
  );
}

const documents = new WeakMap<Document, { scan(root: ParentNode): void; dispose(): void }>();

/** One page lifetime owns all Copy roots; view removal and Astro navigation revoke them. */
export function initSiteCopyCommands(doc: Document = document): () => void {
  const existing = documents.get(doc);
  if (existing) {
    existing.scan(doc);
    return existing.dispose;
  }
  const view = doc.defaultView!;
  const roots = new Map<HTMLElement, { command: SiteCopyCommand; source: MutationObserver }>();
  const scan = (scope: ParentNode) => {
    const found = Array.from(scope.querySelectorAll<HTMLElement>('[data-site-copy]'));
    if (scope instanceof view.HTMLElement && scope.matches('[data-site-copy]'))
      found.unshift(scope);
    for (const root of found) {
      if (!root.isConnected || roots.has(root)) continue;
      const command = initCopyCommand(root, () => readCopyText(root));
      const source = new view.MutationObserver(() => command.owner.syncSource());
      source.observe(root.closest('[data-code-shell], [data-install-command-card]') ?? root, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['data-raw-code', 'data-site-copy-text', 'hidden', 'data-active-manager'],
      });
      roots.set(root, { command, source });
    }
  };
  const remove = (root: HTMLElement) => {
    const handle = roots.get(root);
    if (!handle) return;
    roots.delete(root);
    handle.source.disconnect();
    void handle.command
      .destroy()
      .catch((error) => console.error('[SiteCopy] Copy control cleanup failed.', error));
  };
  const observer = new view.MutationObserver((records) => {
    for (const root of roots.keys()) if (!root.isConnected) remove(root);
    for (const record of records)
      for (const node of record.addedNodes) if (node instanceof view.HTMLElement) scan(node);
  });
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    doc.removeEventListener('astro:before-swap', dispose);
    for (const root of roots.keys()) remove(root);
    documents.delete(doc);
  };
  documents.set(doc, { scan, dispose });
  observer.observe(doc.body, { childList: true, subtree: true });
  doc.addEventListener('astro:before-swap', dispose);
  scan(doc);
  return dispose;
}

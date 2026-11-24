const parts = ['root', 'viewport', 'scrollbar', 'thumb'] as const;
const names = parts.map((part) => `shadcn-scroll-area-${part}`);

export async function enhanceCodeScrollArea(shell: HTMLElement): Promise<void> {
  const container = shell.querySelector<HTMLElement>('[data-code-scroll-root]');
  const content = container?.querySelector<HTMLElement>('[data-code-content]');
  if (!container || !content || container.hasAttribute('data-code-scroll-ready')) return;

  // Reuse the Previewer WC adapter and lazy public-family registry rather
  // than establishing a new raw adapter or prototype admission boundary.
  const [{ loadPrototypes }, { getPrototype }, { ensurePreviewWcRegistered, seedPreviewWcProps }] =
    await Promise.all([
      import('./prototype-modules'),
      import('./registry'),
      import('./wc-registry'),
    ]);
  await loadPrototypes(names);
  if (!content.isConnected || container.hasAttribute('data-code-scroll-ready')) return;

  const doc = shell.ownerDocument;
  const selection = doc.getSelection();
  // Do not disrupt someone who reached the readable first frame before this
  // lazy enhancement arrived. The native surface stays fully usable.
  if (
    content.contains(doc.activeElement) ||
    (selection &&
      !selection.isCollapsed &&
      (content.contains(selection.anchorNode) || content.contains(selection.focusNode)))
  )
    return;

  const create = (part: (typeof parts)[number]) => {
    const id = `shadcn-scroll-area-${part}`;
    const tag = ensurePreviewWcRegistered(`site-code-scroll-${part}`, getPrototype(id));
    return doc.createElement(tag);
  };
  const root = create('root');
  const viewport = create('viewport');
  viewport.dataset.codeScrollViewport = '';
  viewport.setAttribute('role', 'region');
  viewport.setAttribute('aria-label', container.dataset.codeScrollLabel ?? 'Example source');
  root.dataset.codeScrollAnatomy = '';
  root.append(viewport);
  for (const orientation of ['vertical', 'horizontal'] as const) {
    const track = create('scrollbar');
    track.dataset.codeScrollTrack = orientation;
    track.setAttribute('aria-hidden', 'true');
    seedPreviewWcProps(track, { orientation });
    track.append(create('thumb'));
    root.append(track);
  }
  viewport.append(content);
  container.append(root);
  container.dataset.codeScrollReady = '';
  codeScrollTarget(shell);
}

export function codeScrollTarget(shell: HTMLElement): HTMLElement | null {
  const pre = shell.querySelector<HTMLElement>('.proto-previewer__code');
  const viewport = shell.querySelector<HTMLElement>(
    '[data-code-scroll-ready] [data-code-scroll-viewport]'
  );
  if (!viewport || !pre) return pre;
  pre.removeAttribute('tabindex');
  return viewport;
}

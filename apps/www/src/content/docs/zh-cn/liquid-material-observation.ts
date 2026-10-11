/** Read-only actual DOM evidence. A declaration or an opaque screenshot is not optical paint proof.
 * Self-contained so Playwright can serialize this function into the owning page. */
export function collectLiquidMaterialObservation(element: Element) {
  const doc = element.ownerDocument;
  const win = doc.defaultView!;
  const rect = (node: Element) => {
    const value = node.getBoundingClientRect();
    return { x: value.x, y: value.y, width: value.width, height: value.height };
  };
  const style = (node: Element) => {
    const css = win.getComputedStyle(node);
    return {
      backgroundColor: css.backgroundColor,
      backgroundImage:
        css.backgroundImage === 'none'
          ? 'none'
          : {
              kind: css.backgroundImage.startsWith('url("data:image/png') ? 'inline-png' : 'other',
              length: css.backgroundImage.length,
            },
      transform: css.transform,
      translate: css.translate,
      scale: css.scale,
      rotate: css.rotate,
      opacity: css.opacity,
      filter: css.filter,
      mixBlendMode: css.mixBlendMode,
      display: css.display,
      visibility: css.visibility,
    };
  };
  const composedParent = (node: Element): Element | null => {
    if (node.assignedSlot) return node.assignedSlot;
    if (node.parentElement) return node.parentElement;
    const root = node.getRootNode();
    return root instanceof win.ShadowRoot ? root.host : null;
  };
  const ancestors = [];
  for (let node: Element | null = element; node; node = composedParent(node))
    ancestors.push({
      tag: node.localName,
      ref: node.getAttribute('data-demo-ref'),
      parentRoute: node.assignedSlot
        ? 'assigned-slot'
        : node.parentElement
          ? 'parent-element'
          : node.getRootNode() instanceof win.ShadowRoot
            ? 'shadow-host'
            : 'none',
      scene: node.getAttribute('data-material-scene'),
      rect: rect(node),
      ...style(node),
    });
  return {
    captureMeaning:
      'Current computed DOM and sink diagnostics; not a decoded-pixel or native acceptance result',
    preferences: Object.fromEntries(
      [
        '(prefers-reduced-motion: no-preference)',
        '(prefers-reduced-transparency: no-preference)',
        '(prefers-contrast: no-preference)',
        '(forced-colors: none)',
      ].map((query) => [query, win.matchMedia?.(query).matches ?? null])
    ),
    connected: element.isConnected,
    quality: element.getAttribute('data-material-quality'),
    reason: element.getAttribute('data-material-reason'),
    ref: element.getAttribute('data-demo-ref'),
    role: element.getAttribute('role'),
    rect: rect(element),
    ...style(element),
    ancestors,
    sources: Array.from(
      doc.querySelectorAll<HTMLCanvasElement>('canvas[data-material-backdrop]')
    ).map((canvas) => ({
      connected: canvas.isConnected,
      width: canvas.width,
      height: canvas.height,
      rect: rect(canvas),
      ...style(canvas),
      scope: canvas.parentElement?.getAttribute('data-material-scene') ?? null,
      scopeContainsSubject: canvas.parentElement?.contains(element) ?? false,
    })),
  };
}

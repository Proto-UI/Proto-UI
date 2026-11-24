/** Read-only native-browser observations for the retained Contents Popover.
 * This function is serialized by Playwright; keep its closure self-contained. */
export function observeContentsWheel(element: HTMLElement) {
  const document = element.ownerDocument;
  const view = document.defaultView!;
  const surface =
    element.shadowRoot?.querySelector<HTMLElement>('[data-pui-split-surface]') ?? element;
  const wheels: Array<{
    trusted: boolean;
    deltaY: number;
    surfaceInPath: boolean;
    contentInPath: boolean;
    defaultPrevented: boolean;
  }> = [];
  const onWheel = (event: WheelEvent) => {
    if (wheels.length >= 8) return;
    const path = event.composedPath();
    const row = {
      trusted: event.isTrusted === true,
      deltaY: event.deltaY,
      surfaceInPath: path.includes(surface),
      contentInPath: path.includes(element),
      defaultPrevented: event.defaultPrevented,
    };
    wheels.push(row);
    // Observe cancellation after every listener has had its turn. This passive
    // listener never cancels input or changes scroll position.
    view.queueMicrotask(() => (row.defaultPrevented = event.defaultPrevented));
  };
  document.addEventListener('wheel', onWheel, { capture: true, passive: true });
  const read = () => {
    const rect = surface.getBoundingClientRect();
    const host = element.getBoundingClientRect();
    const css = view.getComputedStyle(surface);
    const hostCss = view.getComputedStyle(element);
    const availableHeight = Number.parseFloat(
      hostCss.getPropertyValue('--proto-ui-available-height')
    );
    const availableWidth = Number.parseFloat(
      hostCss.getPropertyValue('--proto-ui-available-width')
    );
    const sameSurface =
      surface ===
      (element.shadowRoot?.querySelector<HTMLElement>('[data-pui-split-surface]') ?? element);
    const positioned =
      Number.isFinite(availableHeight) &&
      availableHeight > 0 &&
      Number.isFinite(availableWidth) &&
      availableWidth > 0;
    const visible =
      element.isConnected &&
      surface.isConnected &&
      sameSurface &&
      surface.clientHeight > 0 &&
      rect.width > 0 &&
      rect.height > 0 &&
      rect.left >= -1 &&
      rect.top >= -1 &&
      rect.right <= view.innerWidth + 1 &&
      rect.bottom <= view.innerHeight + 1 &&
      css.display !== 'none' &&
      css.visibility !== 'hidden';
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    let hitInContent = false;
    for (let node: Node | null = hit; node; ) {
      if (node === element || node === surface) {
        hitInContent = true;
        break;
      }
      node =
        (node as Element).assignedSlot ??
        node.parentNode ??
        (node.getRootNode() as ShadowRoot).host ??
        null;
    }
    return {
      ready: positioned && visible && /^(auto|scroll|overlay)$/.test(css.overflowY),
      positioned,
      visible,
      sameSurface,
      hitInContent,
      hit: hit ? { tag: hit.localName, id: hit.id, role: hit.getAttribute('role') } : null,
      top: surface.scrollTop,
      max: surface.scrollHeight - surface.clientHeight,
      clientHeight: surface.clientHeight,
      scrollHeight: surface.scrollHeight,
      documentY: view.scrollY,
      availableHeight: Number.isFinite(availableHeight) ? availableHeight : null,
      availableWidth: Number.isFinite(availableWidth) ? availableWidth : null,
      overflowY: css.overflowY,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      host: { x: host.x, y: host.y, width: host.width, height: host.height },
      x,
      y,
      wheels: wheels.map((row) => ({ ...row })),
    };
  };
  return {
    read,
    dispose() {
      document.removeEventListener('wheel', onWheel, true);
    },
  };
}

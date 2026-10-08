/** A paint-only pseudo-element has no DOM child, slot input, accessibility node,
 * pointer target or independent semantic owner. Styles are leased per document.
 * Existing author ::before content is never commandeered. */
const marker = 'data-pui-material-carrier';
const sheets = new WeakMap<Document | ShadowRoot, { node: HTMLStyleElement; users: number }>();
const owners = new WeakSet<HTMLElement>();
const rules = `:where([${marker}="contact-v1"])::before {
  all: initial; content: ""; position: absolute; display: block;
  left: var(--pui-material-left); top: var(--pui-material-top);
  width: var(--pui-material-width); height: var(--pui-material-height);
  background-image: var(--pui-material-image); background-size: 100% 100%;
  background-repeat: no-repeat; background-color: transparent;
  border: 0; border-radius: 0; padding: 0; margin: 0;
  pointer-events: none; z-index: -1; opacity: 1; transform: none;
}`;
export function inspectContactCarrier(host: HTMLElement): string | null {
  if (owners.has(host)) return null;
  if (host.hasAttribute(marker)) return 'contact-carrier-marker-conflict';
  const win = host.ownerDocument.defaultView!;
  const hostCss = win.getComputedStyle(host);
  if (
    (!hostCss.position || hostCss.position === 'static') &&
    [hostCss.top, hostCss.right, hostCss.bottom, hostCss.left].some((v) => v && v !== 'auto')
  )
    return 'contact-carrier-position-conflict';
  if (host.getClientRects().length > 1) return 'contact-carrier-fragmented-host';
  const css = win.getComputedStyle(host, '::before');
  return css.content && css.content !== 'none' && css.content !== 'normal'
    ? 'contact-carrier-pseudo-conflict'
    : null;
}
export function createContactCarrier(host: HTMLElement) {
  if (owners.has(host)) throw new Error('contact-carrier-owner-conflict');
  const conflict = inspectContactCarrier(host);
  if (conflict) throw new Error(conflict);
  const doc = host.ownerDocument;
  const tree = host.getRootNode();
  const root = tree instanceof doc.defaultView!.ShadowRoot ? tree : doc;
  let sheet = sheets.get(root);
  if (!sheet) {
    const node = doc.createElement('style');
    node.textContent = rules;
    (root === doc ? (doc.head ?? doc.documentElement) : root).append(node);
    sheet = { node, users: 0 };
    sheets.set(root, sheet);
  }
  const lease = sheet;
  lease.users++;
  owners.add(host);
  host.setAttribute(marker, 'contact-v1');
  let retired = false;
  return {
    valid(image: string) {
      if (
        retired ||
        !lease.node.isConnected ||
        host.getRootNode() !== root ||
        host.getAttribute(marker) !== 'contact-v1'
      )
        return false;
      const css = doc.defaultView!.getComputedStyle(host, '::before');
      return (
        css.position === 'absolute' &&
        css.pointerEvents === 'none' &&
        css.zIndex === '-1' &&
        css.backgroundImage.includes(image) &&
        css.transform === 'none' &&
        Number(css.opacity) === 1 &&
        css.content === '""' &&
        css.display === 'block' &&
        (!css.filter || css.filter === 'none') &&
        (!css.mixBlendMode || css.mixBlendMode === 'normal') &&
        (!css.clipPath || css.clipPath === 'none') &&
        (!css.boxShadow || css.boxShadow === 'none') &&
        [
          'borderTopWidth',
          'borderRightWidth',
          'borderBottomWidth',
          'borderLeftWidth',
          'paddingTop',
          'paddingRight',
          'paddingBottom',
          'paddingLeft',
        ].every((key) => parseFloat((css as any)[key] || '0') === 0) &&
        ['left', 'top', 'width', 'height'].every(
          (key) =>
            Math.abs(
              parseFloat((css as any)[key]) -
                parseFloat(host.style.getPropertyValue(`--pui-material-${key}`))
            ) <=
            1 / 64
        ) &&
        doc.defaultView!.getComputedStyle(host).isolation === 'isolate'
      );
    },
    release() {
      if (retired) return;
      retired = true;
      owners.delete(host);
      if (host.getAttribute(marker) === 'contact-v1') host.removeAttribute(marker);
      if (--lease.users === 0) {
        lease.node.remove();
        sheets.delete(root);
      }
    },
  };
}

/** Registered private paint footprints are excluded from neither visibility nor
 * overlap admission. Another surface must not sample through this output. */
export function contactCarrierBounds(element: Element): DOMRect {
  const rect = element.getBoundingClientRect();
  if (!(element instanceof element.ownerDocument.defaultView!.HTMLElement) || !owners.has(element))
    return rect;
  const width = parseFloat(element.style.getPropertyValue('--pui-material-width'));
  const height = parseFloat(element.style.getPropertyValue('--pui-material-height'));
  const x = Math.max(0, (width - rect.width) / 2),
    y = Math.max(0, (height - rect.height) / 2);
  return {
    ...rect,
    left: rect.left - x,
    top: rect.top - y,
    right: rect.right + x,
    bottom: rect.bottom + y,
  } as DOMRect;
}

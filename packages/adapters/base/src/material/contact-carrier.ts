import {
  appendOwnedCarrierSheet,
  removeOwnedCarrierSheet,
  withOwnedCarrierMarker,
} from './paint-mutations';
/** A paint-only pseudo-element has no DOM child, slot input, accessibility node,
 * pointer target or independent semantic owner. Styles are leased per document.
 * Existing author ::before content is never commandeered. */
const marker = 'data-pui-material-carrier';
const sheets = new WeakMap<Document | ShadowRoot, { node: HTMLStyleElement; users: number }>();
const owners = new WeakSet<HTMLElement>();
// Literal CSS keeps the exact owned stylesheet statically auditable by the consumer wall.
// all: initial retains a medium outline width in Chrome even with style none;
// the owned paint box explicitly zeros it to satisfy the unchanged admission.
const rules = `:where([data-pui-material-carrier="contact-v1"])::before {
  all: initial; content: ""; position: absolute; display: block;
  left: var(--pui-material-left); top: var(--pui-material-top);
  width: var(--pui-material-width); height: var(--pui-material-height);
  background-image: var(--pui-material-image); background-size: 100% 100%;
  background-repeat: no-repeat; background-position: 0% 0%; background-color: transparent;
  background-origin: border-box; background-clip: border-box; background-attachment: scroll;
  visibility: visible; overflow: visible;
  border: 0; border-radius: 0; padding: 0; margin: 0; outline: 0;
  pointer-events: none; z-index: -1; opacity: 1; transform: none;
}`;
export function inspectContactCarrier(host: HTMLElement): string | null {
  if (owners.has(host)) return null;
  if (host.hasAttribute(marker)) return 'contact-carrier-marker-conflict';
  const win = host.ownerDocument.defaultView!;
  const hostCss = win.getComputedStyle(host);
  if (hostCss.visibility && hostCss.visibility !== 'visible')
    return 'contact-carrier-host-not-visible';
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
    appendOwnedCarrierSheet(node, root === doc ? (doc.head ?? doc.documentElement) : root);
    sheet = { node, users: 0 };
    sheets.set(root, sheet);
  }
  const lease = sheet;
  lease.users++;
  owners.add(host);
  withOwnedCarrierMarker(host, () => host.setAttribute(marker, 'contact-v1'));
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
        [`url("${image}")`, `url('${image}')`, `url(${image})`].includes(css.backgroundImage) &&
        css.backgroundSize === '100% 100%' &&
        css.backgroundPosition === '0% 0%' &&
        css.backgroundRepeat === 'no-repeat' &&
        css.backgroundAttachment === 'scroll' &&
        css.backgroundOrigin === 'border-box' &&
        css.backgroundClip === 'border-box' &&
        (css.backgroundColor === 'transparent' || css.backgroundColor === 'rgba(0, 0, 0, 0)') &&
        (!css.backgroundBlendMode || css.backgroundBlendMode === 'normal') &&
        css.visibility === 'visible' &&
        css.overflowX === 'visible' &&
        css.overflowY === 'visible' &&
        (!css.clip || css.clip === 'auto') &&
        (!(css as any).contentVisibility || (css as any).contentVisibility === 'visible') &&
        (!(css as any).zoom || ['1', 'normal'].includes((css as any).zoom)) &&
        (!css.animationName || css.animationName === 'none') &&
        [css.transitionDuration, css.transitionDelay].every(
          (value) => !value || value.split(',').every((time) => /^0(?:s|ms)$/.test(time.trim()))
        ) &&
        [
          'borderImageSource',
          'maskBorderSource',
          'webkitMaskBoxImageSource',
          'webkitBoxReflect',
          'offsetPath',
        ].every((key) => !(css as any)[key] || (css as any)[key] === 'none') &&
        css.transform === 'none' &&
        ['rotate', 'scale', 'translate', 'maskImage', 'webkitMaskImage', 'backdropFilter'].every(
          (key) => !(css as any)[key] || (css as any)[key] === 'none'
        ) &&
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
          'marginTop',
          'marginRight',
          'marginBottom',
          'marginLeft',
          'borderTopLeftRadius',
          'borderTopRightRadius',
          'borderBottomRightRadius',
          'borderBottomLeftRadius',
          'outlineWidth',
        ].every((key) =>
          String((css as any)[key] || '0')
            .trim()
            .split(/\s+/)
            .every((value) => /^[+-]?0(?:\.0+)?(?:px|%)?$/.test(value))
        ) &&
        ['left', 'top', 'width', 'height'].every(
          (key) =>
            Math.abs(
              parseFloat((css as any)[key]) -
                parseFloat(host.style.getPropertyValue(`--pui-material-${key}`))
            ) <=
            1 / 64
        ) &&
        doc.defaultView!.getComputedStyle(host).isolation === 'isolate' &&
        ['relative', 'absolute', 'fixed', 'sticky'].includes(
          doc.defaultView!.getComputedStyle(host).position
        )
      );
    },
    release() {
      if (retired) return;
      retired = true;
      owners.delete(host);
      withOwnedCarrierMarker(host, () => {
        if (host.getAttribute(marker) === 'contact-v1') host.removeAttribute(marker);
      });
      if (--lease.users === 0) {
        removeOwnedCarrierSheet(lease.node);
        sheets.delete(root);
      }
    },
  };
}

/** Author pseudos have no DOMRect and may paint outside their originating box.
 * Only the private before carrier has a separately inspected bounded footprint. */
export function hasAuthoredPseudoPaint(element: Element): boolean {
  return ['::before', '::after'].some((pseudo) => {
    if (pseudo === '::before' && owners.has(element as HTMLElement)) return false;
    const css = element.ownerDocument.defaultView!.getComputedStyle(element, pseudo);
    return (
      !!css.content &&
      !['none', 'normal'].includes(css.content) &&
      css.display !== 'none' &&
      !['hidden', 'collapse'].includes(css.visibility) &&
      Number(css.opacity || '1') !== 0
    );
  });
}

/** Registered private paint footprints are excluded from neither visibility nor
 * overlap admission. Another surface must not sample through this output. */
export function contactCarrierBounds(element: Element): DOMRect {
  const rect = element.getBoundingClientRect();
  if (!(element instanceof element.ownerDocument.defaultView!.HTMLElement) || !owners.has(element))
    return rect;
  const win = element.ownerDocument.defaultView!;
  const css = win.getComputedStyle(element, '::before');
  const hostCss = win.getComputedStyle(element);
  const left = parseFloat(css.left),
    top = parseFloat(css.top),
    width = parseFloat(css.width),
    height = parseFloat(css.height),
    borderLeft = parseFloat(hostCss.borderLeftWidth || '0'),
    borderTop = parseFloat(hostCss.borderTopWidth || '0');
  if (
    ![left, top, width, height, borderLeft, borderTop].every(Number.isFinite) ||
    css.position !== 'absolute' ||
    !['relative', 'absolute', 'fixed', 'sticky'].includes(hostCss.position) ||
    ['transform', 'rotate', 'scale', 'translate', 'filter', 'boxShadow'].some(
      (key) => (css as any)[key] && (css as any)[key] !== 'none'
    )
  )
    return { left: -Infinity, top: -Infinity, right: Infinity, bottom: Infinity } as DOMRect;
  return {
    left: rect.left + borderLeft + left,
    top: rect.top + borderTop + top,
    right: rect.left + borderLeft + left + width,
    bottom: rect.top + borderTop + top + height,
  } as DOMRect;
}

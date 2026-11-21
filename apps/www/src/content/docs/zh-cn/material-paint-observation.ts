/** Read only this host's committed paint. Contact optics use the provider-owned
 * ::before carrier; an arbitrary child image is never optical evidence. Keep
 * this function self-contained so Playwright serializes it into the page. */
export function observeOwnedMaterialPaint(element: Element) {
  const host = element as HTMLElement;
  const win = host.ownerDocument.defaultView!;
  const css = win.getComputedStyle(host);
  const rect = host.getBoundingClientRect();
  const marker = host.getAttribute('data-pui-material-carrier');
  const carrier = win.getComputedStyle(host, '::before');
  const image = marker === 'contact-v1' ? carrier.backgroundImage : css.backgroundImage;
  // The committed receipt identifies engagement independently of actual bounds.
  // Idle/hover/focus use no expansion; held contact, its finite release tail and
  // keyboard press use contact-profile.ts's displacement + dilation + AA bound.
  const contact = host.dataset.materialContact;
  const phase = host.dataset.materialPhase;
  const knownContact =
    (contact === 'rest' || contact === 'held' || contact === 'release') &&
    (phase === 'rest' || phase === 'pressed');
  const engaged = contact === 'held' || contact === 'release' || phase === 'pressed';
  const outset = engaged ? Math.ceil(Math.max(rect.width, rect.height) * 0.08 + 1) : 0;
  const expected = {
    left: -outset - parseFloat(css.borderLeftWidth),
    top: -outset - parseFloat(css.borderTopWidth),
    width: rect.width + 2 * outset,
    height: rect.height + 2 * outset,
  };
  const actual = {
    left: parseFloat(carrier.left),
    top: parseFloat(carrier.top),
    width: parseFloat(carrier.width),
    height: parseFloat(carrier.height),
  };
  const geometryMatches =
    knownContact &&
    Object.keys(expected).every((key) => {
      const name = key as keyof typeof expected;
      return Number.isFinite(actual[name]) && Math.abs(actual[name] - expected[name]) <= 1 / 64;
    });
  const committed =
    marker === 'contact-v1'
      ? carrier.backgroundImage === host.style.getPropertyValue('--pui-material-image').trim() &&
        image.includes('data:image/png;base64,') &&
        geometryMatches &&
        carrier.content === '""' &&
        carrier.position === 'absolute' &&
        carrier.pointerEvents === 'none' &&
        carrier.zIndex === '-1' &&
        carrier.visibility === 'visible' &&
        carrier.opacity === '1' &&
        carrier.backgroundSize === '100% 100%' &&
        carrier.backgroundRepeat === 'no-repeat' &&
        css.backgroundImage === 'none'
      : marker === null && image.includes('data:image/png;base64,');
  return {
    image,
    committed,
    carrier: marker,
    geometryMatches,
    paintOutset: outset,
    hostGeometry: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    carrierGeometry: actual,
    expectedCarrierGeometry: expected,
    quality: host.dataset.materialQuality,
    source: host.dataset.materialSource,
    blur: css.backdropFilter,
    canvas: host.querySelectorAll('canvas').length,
  };
}

/** Register an unscaled PNG crop to the same host pixels across contact extents. */
export function materialHostPixelWindow(
  paint: Pick<ReturnType<typeof observeOwnedMaterialPaint>, 'hostGeometry' | 'paintOutset'>,
  dpr: number
) {
  const { width, height } = paint.hostGeometry;
  const outset = paint.paintOutset;
  if (
    ![width, height, outset, dpr].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0 ||
    outset < 0 ||
    dpr <= 0
  )
    throw new Error('Invalid optical comparison geometry');
  const offset = outset * dpr;
  // No rescaling or interpolation may manufacture a changed-pixel result.
  if (!Number.isInteger(offset))
    throw new Error('Optical comparison requires an aligned physical pixel grid');
  const window = {
    imageWidth: Math.ceil((width + 2 * outset) * dpr),
    imageHeight: Math.ceil((height + 2 * outset) * dpr),
    x: offset,
    y: offset,
    width: Math.ceil(width * dpr),
    height: Math.ceil(height * dpr),
  };
  if (
    !Object.values(window).every(Number.isSafeInteger) ||
    window.imageWidth !== window.width + 2 * offset ||
    window.imageHeight !== window.height + 2 * offset
  )
    throw new Error('Optical comparison pixel registration changed');
  return window;
}

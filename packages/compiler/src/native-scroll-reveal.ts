/**
 * Compiler-owned standalone lowering of C-SCROLL-TARGET-REVEAL-0001 host geometry.
 * Keep host geometry aligned with modules/scroll/src/web/target-reveal.ts;
 * request admission guards compiler-owned synchronous status publication.
 * Generated consumers import neither that runtime Module nor an IR interpreter.
 * Logical part and view authority stay with the surrounding native Scroll owner.
 */
export const NATIVE_SCROLL_REVEAL_SOURCE = String.raw`/** Host-local geometry only. No target or measurement crosses the author boundary. */
function nativeScrollDescendant(surface: HTMLElement, target: HTMLElement): boolean {
  let node: Node | null = target;
  const visited = new Set<Node>();
  while (node && !visited.has(node)) {
    if (node === surface) return target !== surface;
    visited.add(node);
    const element: Element | null = node.nodeType === 1 ? (node as Element) : null;
    node =
      element?.assignedSlot ??
      node.parentNode ??
      (node.nodeType === 11 ? ((node as ShadowRoot).host ?? null) : null);
  }
  return false;
}

const nativeScrollPixels = (value: string, percentageBasis?: number): number => {
  const text = value.trim();
  if (text === '' || text === 'auto' || text === '0') return 0;
  const match = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(px|%)$/i.exec(text);
  if (!match) return NaN;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed)) return NaN;
  return match[2] === 'px'
    ? parsed
    : percentageBasis === undefined
      ? NaN
      : (parsed * percentageBasis) / 100;
};

const nativeScrollRevealRequests = new WeakMap<HTMLElement, number>();

/**
 * Reveal inside this surface only. Native scrollIntoView may move unrelated
 * ancestors or the page; focus is independently owned by the Focus domain.
 */
function revealNativeScrollTarget(
  surface: HTMLElement,
  candidate: unknown,
  isCurrent: () => boolean,
  beforeApply: () => void = () => {}
): boolean {
  const document = surface.ownerDocument;
  const view = document.defaultView;
  if (!view || !(candidate instanceof view.HTMLElement)) return false;
  const target = candidate as HTMLElement;
  // Geometry can reenter before this request is accepted. Only a newer valid
  // reveal may supersede it; refused attempts leave this generation unchanged.
  let expectedGeneration = nativeScrollRevealRequests.get(surface) ?? 0;
  const current = () =>
    isCurrent() &&
    surface.ownerDocument === document &&
    target.ownerDocument === document &&
    surface.isConnected &&
    target.isConnected &&
    nativeScrollDescendant(surface, target) &&
    (nativeScrollRevealRequests.get(surface) ?? 0) === expectedGeneration;
  if (!current()) return false;
  if (!surface.getClientRects().length || !target.getClientRects().length) return false;
  const surfaceStyle = view.getComputedStyle(surface);
  const targetStyle = view.getComputedStyle(target);
  if (
    [surfaceStyle.visibility, targetStyle.visibility].some(
      (visibility) => visibility === 'hidden' || visibility === 'collapse'
    )
  )
    return false;
  const surfaceBox = surface.getBoundingClientRect();
  const targetBox = target.getBoundingClientRect();
  const clientHeight = surface.clientHeight;
  // offsetHeight rounds the used layout size to an integer. Treating that
  // rounding as a transform scales every distant offset and can overshoot a
  // short viewport by an entire row. Computed used lengths preserve the
  // fractional border box while still accounting for actual CSS scaling.
  const usedHeight = nativeScrollPixels(surfaceStyle.height);
  const usedBorderBox =
    usedHeight +
    (surfaceStyle.boxSizing === 'border-box'
      ? 0
      : nativeScrollPixels(surfaceStyle.paddingTop) +
        nativeScrollPixels(surfaceStyle.paddingBottom) +
        nativeScrollPixels(surfaceStyle.borderTopWidth) +
        nativeScrollPixels(surfaceStyle.borderBottomWidth));
  const layoutHeight =
    Number.isFinite(usedBorderBox) && usedHeight > 0 && usedBorderBox > 0
      ? usedBorderBox
      : surface.offsetHeight;
  const scale = layoutHeight > 0 ? surfaceBox.height / layoutHeight : 1;
  const start =
    surfaceBox.top +
    (surface.clientTop + nativeScrollPixels(surfaceStyle.scrollPaddingTop, clientHeight)) * scale;
  const end =
    surfaceBox.top +
    (surface.clientTop + clientHeight - nativeScrollPixels(surfaceStyle.scrollPaddingBottom, clientHeight)) *
      scale;
  const targetStart = targetBox.top - nativeScrollPixels(targetStyle.scrollMarginTop) * scale;
  const targetEnd = targetBox.bottom + nativeScrollPixels(targetStyle.scrollMarginBottom) * scale;
  const position = surface.scrollTop;
  const range = Math.max(0, surface.scrollHeight - clientHeight);
  if (
    ![start, end, targetStart, targetEnd, scale, position, range].every(Number.isFinite) ||
    scale <= 0 ||
    clientHeight <= 0 ||
    surfaceBox.width <= 0 ||
    targetBox.width <= 0 ||
    targetBox.height <= 0 ||
    end <= start
  )
    return false;
  if (!current()) return false;
  // A contained target, or one spanning both viewport edges, is already at
  // the nearest position. Otherwise move the closer edge into the viewport.
  const visible =
    (targetStart >= start && targetEnd <= end) || (targetStart <= start && targetEnd >= end);
  const leading = targetStart - start;
  const trailing = targetEnd - end;
  const delta = visible ? 0 : Math.abs(leading) < Math.abs(trailing) ? leading : trailing;
  const next = Math.min(range, Math.max(0, position + delta / scale));
  // Accept moving and no-op reveals before cancellation can notify observers.
  // Keep the accepted generation after completion so older calls cannot resume.
  expectedGeneration += 1;
  nativeScrollRevealRequests.set(surface, expectedGeneration);
  beforeApply();
  if (!current()) return false;
  if (next === position) return true;
  const previous = surface.style.getPropertyValue('scroll-behavior');
  const priority = surface.style.getPropertyPriority('scroll-behavior');
  // Keyboard navigation must reveal this item before the next key, including
  // when a consumer has authored smooth scrolling for other interactions.
  surface.style.setProperty('scroll-behavior', 'auto', 'important');
  try {
    if (!current()) return false;
    surface.scrollTop = next;
    return current();
  } finally {
    // A reentrant owner may replace the style. Restore only our exact write.
    if (
      surface.style.getPropertyValue('scroll-behavior') === 'auto' &&
      surface.style.getPropertyPriority('scroll-behavior') === 'important'
    ) {
      if (previous) surface.style.setProperty('scroll-behavior', previous, priority);
      else surface.style.removeProperty('scroll-behavior');
    }
  }
}
`;

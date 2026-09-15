// Bounded same-document/open-composed-tree sampler for active scope traversal.
// Stateless: fresh projected eligibility on each key event; no lifecycle lease.
export function sampleWebComponentScopeTargets(
  container: HTMLElement,
  isNativelyFocusable?: (target: HTMLElement) => boolean
) {
  const targets: HTMLElement[] = [];
  const visited = new Set<Element>();
  const visit = (el: Element) => {
    if (visited.has(el)) return;
    visited.add(el);
    if (!(el instanceof HTMLElement)) return;
    if (el.hidden || el.hasAttribute('inert') || el.getAttribute('aria-hidden') === 'true') return;
    const style = getComputedStyle(el);
    if (style.display === 'none') return;
    if (
      el !== container &&
      (el.tabIndex >= 0 ||
        (!el.hasAttribute('tabindex') && (isNativelyFocusable?.(el) || el.isContentEditable))) &&
      isUsableNativeCandidate(el) &&
      !el.matches(':disabled') &&
      el.getAttribute('aria-disabled') !== 'true' &&
      style.visibility !== 'hidden' &&
      style.visibility !== 'collapse' &&
      style.display !== 'contents'
    )
      targets.push(el);
    if (el instanceof HTMLSlotElement) {
      const assigned = el.assignedElements({ flatten: true });
      (assigned.length ? assigned : [...el.children]).forEach(visit);
    } else if (el instanceof HTMLDetailsElement && !el.open) {
      const summary = [...el.children].find((child) => child.tagName === 'SUMMARY');
      if (summary) visit(summary);
    } else if (el.shadowRoot) [...el.shadowRoot.children].forEach(visit);
    else [...el.children].forEach(visit);
  };
  visit(container);
  // Preserve composed order within each native tabindex priority.
  targets.sort(
    (a, b) => (a.tabIndex > 0 ? a.tabIndex : Infinity) - (b.tabIndex > 0 ? b.tabIndex : Infinity)
  );
  let activeTarget = container.ownerDocument.activeElement;
  while (activeTarget?.shadowRoot?.activeElement)
    activeTarget = activeTarget.shadowRoot.activeElement;
  return { targets, activeTarget };
}

// Preserve the shared Web entry exclusions while traversing composed children.
// A positive tabindex does not make these native targets usable.
function isUsableNativeCandidate(el: HTMLElement): boolean {
  if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'hidden') return false;
  if (el.tagName !== 'AREA') return true;
  const map = el.closest('map');
  return !!(
    el.hasAttribute('href') &&
    map?.name &&
    el.isConnected &&
    Array.from(el.ownerDocument.querySelectorAll('img[usemap]')).some(
      (image) =>
        image.getAttribute('usemap') === `#${map.name}` && image.getAttribute('src')?.trim()
    )
  );
}

// Bounded same-document/open-composed-tree sampler for active scope traversal.
// Stateless: fresh projected eligibility on each key event; no lifecycle lease.
export function sampleWebComponentScopeTargets(
  container: HTMLElement,
  isNativelyFocusable?: (target: HTMLElement) => boolean
) {
  type Entry = { element: HTMLElement; target: boolean; priority: number; children?: Entry[] };
  const scope: Entry[] = [];
  const visited = new Set<Element>();
  const visit = (el: Element, entries: Entry[]) => {
    if (visited.has(el)) return;
    visited.add(el);
    if (!(el instanceof HTMLElement)) return;
    if (el.hidden || el.hasAttribute('inert') || el.getAttribute('aria-hidden') === 'true') return;
    const style = getComputedStyle(el);
    if (style.display === 'none') return;
    const target =
      el !== container &&
      (el.tabIndex >= 0 ||
        (!el.hasAttribute('tabindex') && (isNativelyFocusable?.(el) || el.isContentEditable))) &&
      isUsableNativeCandidate(el) &&
      !el.matches(':disabled') &&
      el.getAttribute('aria-disabled') !== 'true' &&
      style.visibility !== 'hidden' &&
      style.visibility !== 'collapse' &&
      style.display !== 'contents';
    // Shadow hosts and slots own separate tabindex-ordered navigation scopes.
    // Sort those scopes independently, then expand each at its owner's position.
    // Sorting a flattened list would let an inner positive tabindex jump ahead
    // of positive targets in an ancestor scope, contrary to native Tab order.
    const ownsScope = el instanceof HTMLSlotElement || !!el.shadowRoot;
    let children = entries;
    if (ownsScope && el !== container) {
      if (el.hasAttribute('tabindex') && el.tabIndex < 0) return;
      children = [];
      const delegatesFocus = !!el.shadowRoot?.delegatesFocus;
      // A non-focusable, non-delegating host (e.g. display:contents) cannot
      // promote its child scope via an otherwise positive tabindex.
      const priority = el.shadowRoot && !target && !delegatesFocus ? 0 : el.tabIndex;
      entries.push({ element: el, target: !!target && !delegatesFocus, priority, children });
    } else if (target) entries.push({ element: el, target: true, priority: el.tabIndex });
    if (el instanceof HTMLSlotElement) {
      const assigned = el.assignedNodes();
      (assigned.length ? assigned : [...el.children]).forEach((node) => {
        if (node instanceof Element) visit(node, children);
      });
    } else if (el instanceof HTMLDetailsElement && !el.open) {
      const summary = [...el.children].find((child) => child.tagName === 'SUMMARY');
      if (summary) visit(summary, children);
    } else if (el.shadowRoot)
      [...el.shadowRoot.children].forEach((child) => visit(child, children));
    else [...el.children].forEach((child) => visit(child, children));
  };
  visit(container, scope);
  const targets: HTMLElement[] = [];
  const flatten = (entries: Entry[]) => {
    entries.sort(
      (a, b) => (a.priority > 0 ? a.priority : Infinity) - (b.priority > 0 ? b.priority : Infinity)
    );
    for (const entry of entries) {
      if (entry.target) targets.push(entry.element);
      if (entry.children) flatten(entry.children);
    }
  };
  flatten(scope);
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

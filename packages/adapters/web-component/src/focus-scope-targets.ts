// Bounded same-document/open-composed-tree sampler for active scope traversal.
// Fresh projected eligibility on each key event. Optional native focus history
// is observed by the view owner, never converted into logical focus facts.
// The UA leaves document.activeElement on the outermost host; only the
// deepest composed active element proves where focus actually landed.
export function deepestActiveElement(doc: Document): Element | null {
  let active = doc.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}

export function sampleWebComponentScopeTargets(
  container: HTMLElement,
  isNativelyFocusable?: (target: HTMLElement) => boolean,
  direction: 'next' | 'prev' = 'next',
  radioFocusOrder?: (radio: HTMLInputElement) => number,
  recentFocusTarget?: () => HTMLElement | null
) {
  const activeTarget = deepestActiveElement(container.ownerDocument);
  type Entry = { element: HTMLElement; target: boolean; priority: number; children?: Entry[] };
  const scope: Entry[] = [];
  const visited = new Set<Element>();
  const visit = (el: Element, entries: Entry[]) => {
    if (visited.has(el)) return;
    visited.add(el);
    // aria-hidden hides a subtree from accessibility APIs but does not remove
    // visible controls from native sequential focus navigation; keep
    // accessibility-tree hiding separate from keyboard-focus eligibility.
    if (el.hasAttribute('inert')) return;
    const style = getComputedStyle(el);
    if (style.display === 'none') return;
    // content-visibility:hidden skips the subtree from rendering and from
    // sequential focus navigation (C-AS-FOCUS-SCOPE-0002-J).
    if (style.contentVisibility === 'hidden') return;
    if (!(el instanceof HTMLElement)) {
      // Non-HTML containers (SVG, MathML) are never candidates themselves,
      // but their descendants (e.g. foreignObject content) stay in the
      // document's sequential focus order.
      [...el.children].forEach((child) => visit(child, entries));
      return;
    }
    if (el.hidden) return;
    const target =
      el !== container &&
      (el.tabIndex >= 0 ||
        (!el.hasAttribute('tabindex') && (isNativelyFocusable?.(el) || isEditingHost(el)))) &&
      isUsableNativeCandidate(el) &&
      !el.matches(':disabled') &&
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
    } else if (target || (el === activeTarget && el !== container))
      entries.push({ element: el, target: !!target, priority: el.tabIndex });
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
  const flatten = (entries: Entry[], output: Entry[] = []) => {
    entries.sort(
      (a, b) => (a.priority > 0 ? a.priority : Infinity) - (b.priority > 0 ? b.priority : Infinity)
    );
    for (const entry of entries) {
      output.push(entry);
      if (entry.children) flatten(entry.children, output);
    }
    return output;
  };
  const ordered = flatten(scope);
  const targets = ordered.filter((entry) => entry.target).map((entry) => entry.element);
  // Native radio groups share one sequential stop. Grouping follows DOM tree
  // and form ownership, not composed placement (e.g. separate slots/forms).
  // Unchecked groups enter at the forward/reverse edge; an already focused
  // radio remains an anchor so departing it does not re-enter the same group.
  const trees = new Map<Node, Map<HTMLFormElement | null, Map<string, HTMLInputElement[]>>>();
  for (const target of targets) {
    if (!(target instanceof HTMLInputElement) || target.type !== 'radio' || !target.name) continue;
    const tree = target.getRootNode();
    let forms = trees.get(tree);
    if (!forms) trees.set(tree, (forms = new Map()));
    let names = forms.get(target.form);
    if (!names) forms.set(target.form, (names = new Map()));
    let group = names.get(target.name);
    if (!group) names.set(target.name, (group = []));
    group.push(target);
  }
  const excluded = new Set<HTMLElement>();
  const wholeTreeTargets = new Map<Node, Set<HTMLElement>>();
  const eligibleOutside = (tree: Node, radio: HTMLInputElement) => {
    let eligible = wholeTreeTargets.get(tree);
    if (!eligible) {
      // A checked group member may live outside this trap. Apply the same
      // eligibility traversal, but never return outside targets to Focus.
      visited.clear();
      const entries: Entry[] = [];
      if (tree instanceof Document) visit(tree.documentElement, entries);
      else if (tree instanceof ShadowRoot) for (const child of tree.children) visit(child, entries);
      eligible = new Set(
        flatten(entries)
          .filter((entry) => entry.target)
          .map((entry) => entry.element)
      );
      wholeTreeTargets.set(tree, eligible);
    }
    return eligible.has(radio);
  };
  for (const [tree, forms] of trees)
    for (const names of forms.values())
      for (const group of names.values()) {
        const active = group.find((el) => el === activeTarget);
        const member = group[0]!;
        const outsideChecked =
          tree instanceof Document || tree instanceof ShadowRoot
            ? Array.from(tree.querySelectorAll<HTMLInputElement>('input')).find(
                (el) =>
                  el.type === 'radio' &&
                  el.name === member.name &&
                  el.form === member.form &&
                  el.checked &&
                  !group.includes(el) &&
                  eligibleOutside(tree, el)
              )
            : undefined;
        const remembered = radioFocusOrder
          ? group.reduce<HTMLInputElement | undefined>(
              (last, el) => (radioFocusOrder(el) > (last ? radioFocusOrder(last) : 0) ? el : last),
              undefined
            )
          : undefined;
        const stop =
          outsideChecked ??
          group.find((el) => el.checked) ??
          active ??
          remembered ??
          (direction === 'prev' ? group.at(-1) : group[0]);
        for (const radio of group) if (radio !== stop && radio !== active) excluded.add(radio);
      }
  const current = ordered.findIndex((entry) => entry.element === activeTarget);
  const filtered = targets.filter((target) => !excluded.has(target));
  return {
    targets: filtered,
    activeTarget,
    // View-observed native focus history; Focus decides whether to recover
    // from it. Never fabricated from logical state.
    recentTarget: recentFocusTarget?.() ?? null,
    // Position is not a Tab stop. Focus owns direction/wrapping after native
    // programmatic focus on tabindex=-1 or another currently excluded target.
    ...(current >= 0 && !filtered.includes(activeTarget as HTMLElement)
      ? {
          activeInsertionIndex: ordered
            .slice(0, current)
            .filter((entry) => entry.target && !excluded.has(entry.element)).length,
        }
      : {}),
  };
}

// Native unchecked radio groups remember the last focused member. Capture
// actual focus while this view lease is live, including pointer/programmatic
// focus and focus in open roots. Weak keys cannot retain detached descendants.
export function observeWebComponentRadioFocus(root: HTMLElement) {
  let sequence = 0;
  const history = new WeakMap<
    HTMLInputElement,
    { order: number; tree: Node; form: HTMLFormElement | null; name: string }
  >();
  let lastFocused: HTMLElement | null = null;
  const remember = (event: Event) => {
    const target = event.composedPath()[0];
    if (!(target instanceof HTMLElement)) return;
    if (deepestActiveElement(root.ownerDocument) !== target) return;
    lastFocused = target;
    if (!(target instanceof HTMLInputElement) || target.type !== 'radio' || !target.name) return;
    history.set(target, {
      order: ++sequence,
      tree: target.getRootNode(),
      form: target.form,
      name: target.name,
    });
  };
  root.addEventListener('focusin', remember, true);
  return {
    order(target: HTMLInputElement) {
      const last = history.get(target);
      return last &&
        last.tree === target.getRootNode() &&
        last.form === target.form &&
        last.name === target.name
        ? last.order
        : 0;
    },
    // The most recent natively focused descendant of this root, while it
    // stays connected. Covers pointer and programmatic focus alike.
    recent() {
      return lastFocused?.isConnected ? lastFocused : null;
    },
    dispose() {
      root.removeEventListener('focusin', remember, true);
    },
  };
}

// Only the editing host itself is a sequential stop. isContentEditable is
// inherited, so ordinary descendants of an editable host must not qualify;
// the contenteditable attribute marks the actual host (empty/true/
// plaintext-only enable editing; "false" and unknown values do not).
function isEditingHost(el: HTMLElement): boolean {
  const value = el.getAttribute('contenteditable');
  if (value === null) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '' || normalized === 'true' || normalized === 'plaintext-only';
}

// An <area> stop exists only while its image is actually rendered. Walk the
// composed ancestors so a hidden image (or a hidden ancestor/host) revokes
// eligibility.
function isRendered(el: Element): boolean {
  let node: Element | null = el;
  while (node) {
    if (node instanceof HTMLElement && node.hidden) return false;
    const style = getComputedStyle(node);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.visibility === 'collapse'
    )
      return false;
    const parent: Element | null = node.parentElement;
    if (parent) node = parent;
    else {
      const root = node.getRootNode();
      node = root instanceof ShadowRoot ? root.host : null;
    }
  }
  return true;
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
        image.getAttribute('usemap') === `#${map.name}` &&
        image.getAttribute('src')?.trim() &&
        isRendered(image)
    )
  );
}

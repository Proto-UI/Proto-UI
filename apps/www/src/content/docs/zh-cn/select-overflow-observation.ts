/** Failure-only geometry on the isolated, repository-owned demo page.
 * Out-of-viewport is an observation, not proof that an element caused document overflow.
 * Never read text, input values, props, URLs, or mutate/scroll/focus the page.
 */
export function collectSelectOverflowObservation() {
  const root = document.documentElement;
  const describe = (node: Element) => {
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return {
      tag: node.localName,
      id: node.id,
      className: node.getAttribute('class'),
      demoRef: node.getAttribute('data-demo-ref'),
      role: node.getAttribute('role'),
      rect: {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth,
      scrollLeft: node.scrollLeft,
      direction: style.direction,
      display: style.display,
      position: style.position,
      whiteSpace: style.whiteSpace,
      minWidth: style.minWidth,
      maxWidth: style.maxWidth,
      width: style.width,
      overflowX: style.overflowX,
      overflowWrap: style.overflowWrap,
      wordBreak: style.wordBreak,
      flexWrap: style.flexWrap,
      fontSize: style.fontSize,
      columnGap: style.columnGap,
      boxSizing: style.boxSizing,
      gridTemplateColumns: style.gridTemplateColumns,
      paddingLeft: style.paddingLeft,
      paddingRight: style.paddingRight,
      borderLeftWidth: style.borderLeftWidth,
      borderRightWidth: style.borderRightWidth,
      transform: style.transform,
    };
  };
  const parent = (node: Element): Element | null =>
    node.parentElement ??
    (node.getRootNode() instanceof ShadowRoot ? (node.getRootNode() as ShadowRoot).host : null);
  const candidates = [];
  // Horizontal scroll can move a wide child back inside the viewport. Keep a
  // separate bounded sample of these known demo owners even when they do not
  // match the generic out-of-viewport predicate; never collect their text.
  const layoutRefs = new Set([
    'selectLayout',
    'selectRtlLayout',
    'accept',
    'acceptLabel',
    'uncontrolledTrigger',
    'disabledTrigger',
    'controlledTrigger',
    'rtlTrigger',
    'uncontrolledContent',
    'disabledContent',
    'controlledContent',
    'rtlContent',
  ]);
  const layoutBoxes = [];
  let layoutMatched = 0;
  let visited = 0,
    matched = 0;
  const pending: Element[] = [root];
  while (pending.length && visited < 5000) {
    const node = pending.pop()!;
    visited++;
    const facts = describe(node);
    if (facts.demoRef && layoutRefs.has(facts.demoRef)) {
      layoutMatched++;
      if (layoutBoxes.length < 24) {
        const children = Array.from(node.children).slice(0, 16).map(describe);
        const selectedOptions = [];
        let selectedOptionsTruncated = false;
        if (facts.role === 'listbox') {
          const options = node.querySelectorAll('[role="option"][aria-selected="true"]');
          selectedOptionsTruncated = options.length > 4;
          for (let index = 0; index < Math.min(options.length, 4); index++) {
            const option = options[index];
            selectedOptions.push({
              ...describe(option),
              label: option.firstElementChild ? describe(option.firstElementChild) : null,
              indicator: option.lastElementChild ? describe(option.lastElementChild) : null,
            });
          }
        }
        layoutBoxes.push({
          ...facts,
          children,
          childrenTruncated: node.children.length > 16,
          selectedOptions,
          selectedOptionsTruncated,
        });
      }
    }
    if (
      facts.rect.width > 0 &&
      facts.rect.height > 0 &&
      (facts.rect.left < -1 ||
        facts.rect.right > innerWidth + 1 ||
        facts.scrollWidth > facts.clientWidth + 1)
    ) {
      matched++;
      if (candidates.length < 80) {
        const ancestors = [];
        let ancestor = parent(node);
        for (; ancestor && ancestors.length < 24; ancestor = parent(ancestor))
          ancestors.push(describe(ancestor));
        candidates.push({ ...facts, ancestors, ancestorsTruncated: !!ancestor });
      }
    }
    // Open roots only; no host instrumentation or closed-root access.
    const children = [...node.children, ...(node.shadowRoot?.children ?? [])];
    for (let i = children.length - 1; i >= 0; i--) pending.push(children[i]);
  }
  return {
    meaning:
      'Post-failure readonly geometry; candidates may be clipped, internally scrollable or displaced by page scrolling, not necessarily causal.',
    at: performance.now(),
    viewport: {
      width: innerWidth,
      height: innerHeight,
      scrollX,
      scrollY,
      visual: visualViewport
        ? {
            width: visualViewport.width,
            height: visualViewport.height,
            offsetLeft: visualViewport.offsetLeft,
            offsetTop: visualViewport.offsetTop,
            scale: visualViewport.scale,
          }
        : null,
    },
    document: { ...describe(root), rootFontSize: getComputedStyle(root).fontSize },
    body: document.body ? describe(document.body) : null,
    visited,
    matched,
    traversalTruncated: pending.length > 0,
    candidatesTruncated: matched > candidates.length,
    candidates,
    layoutBoxes,
    layoutBoxesTruncated: layoutMatched > layoutBoxes.length,
  };
}

export function readSelectSourceBinding(git: (args: string[]) => string) {
  return {
    sourceSha: git(['rev-parse', 'HEAD']).trim(),
    sourceTree: git(['rev-parse', 'HEAD^{tree}']).trim(),
    sourceDirty: git(['status', '--porcelain']).trim().length > 0,
  };
}

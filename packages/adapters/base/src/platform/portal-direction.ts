/**
 * Keep Web direction at a portal's author position. This is a view-owned host
 * projection, not a portable Proto direction policy or a global document edit.
 * An explicit host dir (including auto) and author CSS keep their own priority.
 */
export function retainWebPortalDirection(
  target: HTMLElement,
  getOrigin: () => Node | null
): () => void {
  const Mutation = target.ownerDocument.defaultView?.MutationObserver;
  let released = false;
  let authored = target.getAttribute('dir');
  let projected: string | null = null;
  let chain: Node[] = [];

  const captureAuthor = () => {
    authored = target.getAttribute('dir');
    projected = null;
  };
  const authorObserver = Mutation
    ? new Mutation(() => {
        if (released) return;
        captureAuthor();
        sync();
      })
    : null;
  const sourceObserver = Mutation ? new Mutation(() => sync()) : null;
  const observeAuthor = () =>
    authorObserver?.observe(target, { attributes: true, attributeFilter: ['dir'] });
  const drainAuthor = () => {
    if (authorObserver?.takeRecords().length) captureAuthor();
  };
  const write = (value: string | null) => {
    authorObserver?.disconnect();
    if (value === null) target.removeAttribute('dir');
    else target.setAttribute('dir', value);
    observeAuthor();
  };

  function sync() {
    if (released) return;
    drainAuthor();
    const origin = getOrigin();
    const next = ancestry(origin === target ? parentOf(origin) : origin);
    if (next.length !== chain.length || next.some((node, index) => node !== chain[index])) {
      sourceObserver?.disconnect();
      chain = next;
      for (const node of chain) {
        sourceObserver?.observe(node, {
          childList: true,
          ...(node.nodeType === 1
            ? { attributes: true, attributeFilter: ['dir', 'style', 'class'] }
            : {}),
        });
      }
    }
    if (isAuthoredDirection(authored)) return;
    const source = chain.find((node): node is Element => node.nodeType === 1);
    if (!source) return;
    // Native computed direction also covers inherited CSS and dir=auto. The
    // attribute walk is a non-layout-host fallback, not a fake browser result.
    const computed = source.ownerDocument.defaultView?.getComputedStyle(source).direction;
    const direction =
      computed === 'ltr' || computed === 'rtl'
        ? computed
        : (chain
            .filter((node): node is Element => node.nodeType === 1)
            .map((node) => node.getAttribute('dir')?.toLowerCase())
            .find((value) => value === 'ltr' || value === 'rtl') ?? 'ltr');
    if (target.getAttribute('dir') === direction) return;
    projected = direction;
    write(direction);
  }

  observeAuthor();
  sync();
  return () => {
    if (released) return;
    drainAuthor();
    released = true;
    authorObserver?.disconnect();
    sourceObserver?.disconnect();
    if (projected !== null && target.getAttribute('dir') === projected) {
      if (authored === null) target.removeAttribute('dir');
      else target.setAttribute('dir', authored);
    }
    chain = [];
  };
}

function isAuthoredDirection(value: string | null): boolean {
  return value !== null && /^(ltr|rtl|auto)$/i.test(value);
}

function parentOf(node: Node): Node | null {
  // Slotted nodes inherit from the slot; a ShadowRoot inherits from its host.
  return (
    (node as Element).assignedSlot ??
    node.parentNode ??
    (node.nodeType === 11 ? (node as ShadowRoot).host : null)
  );
}

function ancestry(origin: Node | null): Node[] {
  const result: Node[] = [];
  const seen = new Set<Node>();
  for (let node = origin; node && !seen.has(node); node = parentOf(node)) {
    seen.add(node);
    result.push(node);
  }
  return result;
}

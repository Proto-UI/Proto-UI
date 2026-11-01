function demoOwnedRefSelector(owner: string): string {
  return `[data-demo-owner="${owner}"][data-demo-ref], .pui-owner-${owner}[data-demo-ref]`;
}
export function collectOwnedDemoRefs(host: HTMLElement, owner: string) {
  const selector = demoOwnedRefSelector(owner);
  const nodes = new Set([
    ...host.querySelectorAll<HTMLElement>(selector),
    ...host.ownerDocument.querySelectorAll<HTMLElement>(selector),
  ]);
  if (host.matches(selector)) nodes.add(host);
  const refs: Record<string, HTMLElement> = Object.create(null);
  for (const node of nodes) {
    const ref = node.getAttribute('data-demo-ref');
    if (ref) refs[ref] = node;
  }
  return { refs, nodes };
}
export function ownedDemoRefs(host: HTMLElement, owner: string): Record<string, HTMLElement> {
  return collectOwnedDemoRefs(host, owner).refs;
}
export function publishDemoRefs(
  target: Record<string, HTMLElement>,
  next: Record<string, HTMLElement>
) {
  for (const ref of Object.keys(target)) if (!Object.hasOwn(next, ref)) delete target[ref];
  Object.assign(target, next);
}
type ObservedDemoRefOwner = {
  host: HTMLElement;
  owner: string;
  refs: Record<string, HTMLElement>;
  current(): boolean;
  nodes: Set<HTMLElement>;
};
type DemoRefObservation = {
  add(
    owner: string,
    host: HTMLElement,
    refs: Record<string, HTMLElement>,
    current: () => boolean,
    initialNodes: Iterable<HTMLElement>
  ): () => void;
};
const demoRefObservations = new WeakMap<Document, DemoRefObservation>();

/** One document subscription, not one document scan per demo mutation.
 * Detached owner hosts retain a local subtree subscription. Both entrances
 * feed one microtask batch of changed subtrees, then update only marked owners.
 * The index uses the same light-DOM reachability as initial collection: no
 * shadow-root traversal or inference of nodes hidden behind a shadow boundary.
 * Initial collection still belongs to the renderer's ordinary mount commit. */
export function observeOwnedDemoRefs(
  host: HTMLElement,
  owner: string,
  refs: Record<string, HTMLElement>,
  current: () => boolean,
  initialNodes: Iterable<HTMLElement>
): () => void {
  const doc = host.ownerDocument;
  const Observer = doc.defaultView?.MutationObserver;
  if (!Observer) return () => {};
  let observation = demoRefObservations.get(doc);
  if (!observation) {
    const owners = new Map<string, ObservedDemoRefOwner>();
    const pending = new Set<Node>();
    const pendingOwners = new Set<ObservedDemoRefOwner>();
    let alive = true;
    let scheduled = false;
    let removalsPending = false;
    const belongsToOwner = (node: HTMLElement, entry: ObservedDemoRefOwner) =>
      node.getAttribute('data-demo-owner') === entry.owner ||
      node.classList.contains(`pui-owner-${entry.owner}`);
    const eligible = (node: HTMLElement, entry: ObservedDemoRefOwner) =>
      node.ownerDocument === doc &&
      (doc.contains(node) || node === entry.host || entry.host.contains(node)) &&
      node.hasAttribute('data-demo-ref') &&
      belongsToOwner(node, entry);
    const flush = () => {
      scheduled = false;
      if (!alive) return;
      const changed = [...pending];
      const hadRemovals = removalsPending;
      removalsPending = false;
      pending.clear();
      const affected = new Set(pendingOwners);
      pendingOwners.clear();
      // Removed ancestors may have been emptied or stripped before delivery.
      // Recheck only the finite known index in removal batches, never the DOM.
      if (hadRemovals) {
        for (const entry of owners.values()) {
          for (const node of entry.nodes) {
            if (!eligible(node, entry)) {
              entry.nodes.delete(node);
              affected.add(entry);
            }
          }
        }
      }
      const seen = new Set<Element>();
      const collect = (element: Element) => {
        if (seen.has(element)) return;
        seen.add(element);
        if (!element.hasAttribute('data-demo-ref')) return;
        const ids = new Set<string>();
        const authoredOwner = element.getAttribute('data-demo-owner');
        if (authoredOwner) ids.add(authoredOwner);
        for (const token of element.classList)
          if (token.startsWith('pui-owner-')) ids.add(token.slice('pui-owner-'.length));
        for (const id of ids) {
          const entry = owners.get(id);
          if (!entry) continue;
          entry.nodes.add(element as HTMLElement);
          affected.add(entry);
        }
      };
      for (const root of changed) {
        if (root.nodeType !== 1) continue;
        collect(root as Element);
        for (const element of (root as Element).querySelectorAll('[data-demo-ref]'))
          collect(element);
      }
      for (const entry of affected) {
        if (owners.get(entry.owner) !== entry || !entry.current()) continue;
        const next: Record<string, HTMLElement> = Object.create(null);
        for (const node of entry.nodes) if (!eligible(node, entry)) entry.nodes.delete(node);
        // Preserve the old host-query then document-query Set precedence.
        // Same-ref physical views can overlap during replacement; index
        // insertion order must not decide which current view is published.
        const rank = (node: HTMLElement) =>
          node !== entry.host && entry.host.contains(node) ? 0 : doc.contains(node) ? 1 : 2;
        const ordered = [...entry.nodes].sort((a, b) => {
          const group = rank(a) - rank(b);
          if (group) return group;
          const position = a.compareDocumentPosition(b);
          if (position & 4) return -1; // DOCUMENT_POSITION_FOLLOWING
          if (position & 2) return 1; // DOCUMENT_POSITION_PRECEDING
          return 0;
        });
        for (const node of ordered) {
          if (!eligible(node, entry)) {
            entry.nodes.delete(node);
            continue;
          }
          const ref = node.getAttribute('data-demo-ref');
          if (ref) next[ref] = node;
        }
        if (alive && owners.get(entry.owner) === entry && entry.current())
          publishDemoRefs(entry.refs, next);
      }
    };
    const enqueue = (records: MutationRecord[]) => {
      if (!alive) return;
      for (const record of records) {
        if (record.type === 'attributes') {
          const element = record.target as Element;
          const ids = new Set<string>();
          const readClasses = (value: string | null) =>
            (value ?? '')
              .split(/\s+/)
              .filter((token) => token.startsWith('pui-owner-'))
              .map((token) => token.slice('pui-owner-'.length));
          if (record.attributeName === 'class') {
            const previous = readClasses(record.oldValue);
            const next = readClasses(element.getAttribute('class'));
            // Utility paint class changes are not ownership changes.
            if (previous.length === next.length && previous.every((id) => next.includes(id)))
              continue;
            for (const id of previous) ids.add(id);
          }
          if (record.attributeName === 'data-demo-owner' && record.oldValue)
            ids.add(record.oldValue);
          const dataOwner = element.getAttribute('data-demo-owner');
          if (dataOwner) ids.add(dataOwner);
          for (const id of readClasses(element.getAttribute('class'))) ids.add(id);
          for (const id of ids) {
            const entry = owners.get(id);
            if (entry) pendingOwners.add(entry);
          }
          if (ids.size) pending.add(element);
        } else {
          if (record.removedNodes.length) removalsPending = true;
          for (const node of [...record.addedNodes, ...record.removedNodes]) pending.add(node);
        }
      }
      if ((!pending.size && !pendingOwners.size) || scheduled) return;
      scheduled = true;
      queueMicrotask(flush);
    };
    const options: MutationObserverInit = {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ['data-demo-ref', 'data-demo-owner', 'class'],
    };
    const documentObserver = new Observer(enqueue);
    if (doc.documentElement) documentObserver.observe(doc.documentElement, options);
    const manager: DemoRefObservation = {
      add(id, ownedHost, ownedRefs, isCurrent, initialNodes) {
        if (owners.has(id)) throw new Error('[PrototypePreviewer] duplicate ref observation owner');
        const localObserver = new Observer(enqueue);
        const entry: ObservedDemoRefOwner = {
          owner: id,
          host: ownedHost,
          refs: ownedRefs,
          current: isCurrent,
          nodes: new Set(initialNodes),
        };
        owners.set(id, entry);
        localObserver.observe(ownedHost, options);
        let active = true;
        return () => {
          if (!active) return;
          active = false;
          localObserver.disconnect();
          entry.nodes.clear();
          pendingOwners.delete(entry);
          owners.delete(id);
          if (!owners.size) {
            alive = false;
            documentObserver.disconnect();
            pending.clear();
            pendingOwners.clear();
            removalsPending = false;
            if (demoRefObservations.get(doc) === manager) demoRefObservations.delete(doc);
          }
        };
      },
    };
    observation = manager;
    demoRefObservations.set(doc, manager);
  }
  return observation.add(owner, host, refs, current, initialNodes);
}

import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectOwnedDemoRefs, observeOwnedDemoRefs } from './demo-ref-observer';

const stops: Array<() => void> = [];
const settle = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
afterEach(() => {
  for (const stop of stops.splice(0).reverse()) stop();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});
function marked(owner: string, ref: string, mode: 'data' | 'class' = 'data') {
  const node = document.createElement('button');
  node.dataset.demoRef = ref;
  if (mode === 'data') node.dataset.demoOwner = owner;
  else node.className = `authored pui-owner-${owner}`;
  return node;
}
function mount(owner: string, connected = true, mode: 'data' | 'class' = 'data') {
  const host = document.createElement('div');
  const item = marked(owner, 'item', mode);
  host.append(item);
  if (connected) document.body.append(host);
  const initial = collectOwnedDemoRefs(host, owner);
  const refs = initial.refs;
  let current = true;
  const stop = observeOwnedDemoRefs(host, owner, refs, () => current, initial.nodes);
  stops.push(stop);
  return {
    host,
    item,
    refs,
    stop,
    retire: () => {
      current = false;
    },
  };
}

/** Test-only observation of real MO delivery, not a record/scheduler substitute.
 * Snapshot actual observer instances and their complete subscriptions before
 * each mutation; keep the existing test timeout and every product assertion.
 */
function observeMutationDelivery() {
  const RealObserver = MutationObserver;
  const subscriptions = new Map<MutationObserver, Map<Node, MutationObserverInit>>();
  const waiting = new Set<{
    pending: Set<MutationObserver>;
    matches(record: MutationRecord): boolean;
    resolve(): void;
  }>();
  class DeliveryObserver extends RealObserver {
    constructor(callback: MutationCallback) {
      super((records, observer) => {
        callback(records, observer); // No catching, replay or synthetic records.
        for (const waiter of waiting) {
          if (
            records.some(waiter.matches) &&
            waiter.pending.delete(observer) &&
            waiter.pending.size === 0
          ) {
            waiting.delete(waiter);
            waiter.resolve();
          }
        }
      });
    }
    override observe(target: Node, options?: MutationObserverInit): void {
      super.observe(target, options);
      const targets = subscriptions.get(this) ?? new Map<Node, MutationObserverInit>();
      targets.set(target, { ...options, attributeFilter: options?.attributeFilter?.slice() });
      subscriptions.set(this, targets);
    }
    override disconnect(): void {
      super.disconnect();
      subscriptions.delete(this);
    }
  }
  vi.stubGlobal('MutationObserver', DeliveryObserver);
  expect(document.defaultView?.MutationObserver).toBe(DeliveryObserver);
  return (
    target: Node,
    mutation: { type: 'childList' } | { type: 'attributes'; name: string },
    matches: (record: MutationRecord) => boolean,
    options: { zeroEffectWhenUnobserved?: boolean } = {}
  ) => {
    const pending = new Set<MutationObserver>();
    for (const [observer, targets] of subscriptions) {
      for (const [root, options] of targets) {
        const covers = root === target || (options.subtree && root.contains(target));
        const accepts =
          mutation.type === 'childList'
            ? options.childList === true
            : (options.attributes === true ||
                (options.attributes !== false && options.attributeFilter !== undefined)) &&
              (!options.attributeFilter || options.attributeFilter.includes(mutation.name));
        if (covers && accepts) pending.add(observer);
      }
    }
    const observerCount = pending.size;
    if (observerCount === 0) {
      // No attribute observer is also valid for an irrelevant class change.
      // This is not evidence that a callback path was exercised.
      expect(options.zeroEffectWhenUnobserved).toBe(true);
      return { observerCount, delivered: Promise.resolve() };
    }
    return {
      observerCount,
      delivered: new Promise<void>((resolve) => waiting.add({ pending, matches, resolve })),
    };
  };
}

describe('Website owner ref observation, using real MutationObserver delivery', () => {
  it('shares one document subscription and disconnects it only after the last owner', async () => {
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    const a = mount('demo-a');
    const b = mount('demo-b');
    const documentCalls = observe.mock.calls
      .map(([target], i) => ({ target, i }))
      .filter(({ target }) => target === document.documentElement);
    expect(documentCalls).toHaveLength(1);
    const shared = observe.mock.contexts[documentCalls[0].i];
    expect(
      observe.mock.calls.filter(([target]) => target === a.host || target === b.host)
    ).toHaveLength(2);
    a.stop();
    expect(disconnect.mock.contexts.filter((value) => value === shared)).toHaveLength(0);
    b.stop();
    expect(disconnect.mock.contexts.filter((value) => value === shared)).toHaveLength(1);
    b.stop();
    expect(disconnect.mock.contexts.filter((value) => value === shared)).toHaveLength(1);
    await settle();
  });

  it('indexes added/replaced/removed static refs without a new full-document or host query', async () => {
    const a = mount('demo-a');
    await settle();
    const documentQueries = vi.spyOn(document, 'querySelectorAll');
    const hostQueries = vi.spyOn(a.host, 'querySelectorAll');
    const first = marked('demo-a', 'extra');
    a.host.append(first);
    await vi.waitFor(() => expect(a.refs.extra).toBe(first));
    const second = marked('demo-a', 'extra');
    first.replaceWith(second);
    await vi.waitFor(() => expect(a.refs.extra).toBe(second));
    second.remove();
    await vi.waitFor(() => expect(a.refs.extra).toBeUndefined());
    expect(a.refs.item).toBe(a.item);
    expect(documentQueries).not.toHaveBeenCalled();
    expect(hostQueries).not.toHaveBeenCalled();
  });

  it('coalesces a same-batch remove/add move across two portal roots without dropping identity', async () => {
    const beforeMutation = observeMutationDelivery();
    const a = mount('demo-a');
    const firstRoot = document.createElement('section');
    const secondRoot = document.createElement('section');
    document.body.append(firstRoot, secondRoot);
    await settle();
    let writes = 0;
    let value: HTMLElement = a.item;
    Object.defineProperty(a.refs, 'item', {
      configurable: true,
      enumerable: true,
      get: () => value,
      set: (next: HTMLElement) => {
        writes += 1;
        value = next;
      },
    });
    const delivered = beforeMutation(a.host, { type: 'childList' }, (record) =>
      [...record.removedNodes].includes(a.item)
    );
    firstRoot.append(a.item);
    secondRoot.append(a.item);
    await settle();
    await delivered.delivered;
    await Promise.resolve(); // Finish work already queued by the real callbacks.
    expect(a.refs.item).toBe(a.item);
    expect(a.item.parentElement).toBe(secondRoot);
    expect(writes).toBe(1);
  });

  it('prunes indexed refs when a removed ancestor is emptied and its markers disappear before delivery', async () => {
    const a = mount('demo-a');
    const wrapper = document.createElement('section');
    const nested = marked('demo-a', 'nested');
    wrapper.append(nested);
    document.body.append(wrapper);
    await vi.waitFor(() => expect(a.refs.nested).toBe(nested));
    const queries = vi.spyOn(document, 'querySelectorAll');
    wrapper.remove();
    wrapper.replaceChildren();
    nested.removeAttribute('data-demo-owner');
    nested.removeAttribute('data-demo-ref');
    await vi.waitFor(() => expect(a.refs.nested).toBeUndefined());
    expect(a.refs.item).toBe(a.item);
    expect(queries).not.toHaveBeenCalled();
  });

  it('retains every initial duplicate candidate and preserves host/document DOM order on later moves', async () => {
    const host = document.createElement('div');
    const first = marked('demo-duplicates', 'item');
    const second = marked('demo-duplicates', 'item');
    const outside = marked('demo-duplicates', 'item');
    host.append(first, second);
    document.body.append(host, outside);
    const initial = collectOwnedDemoRefs(host, 'demo-duplicates');
    expect(initial.nodes.size).toBe(3);
    expect(initial.refs.item).toBe(outside);
    const stop = observeOwnedDemoRefs(
      host,
      'demo-duplicates',
      initial.refs,
      () => true,
      initial.nodes
    );
    stops.push(stop);
    await settle();
    const queries = vi.spyOn(document, 'querySelectorAll');
    outside.remove();
    await vi.waitFor(() => expect(initial.refs.item).toBe(second));
    host.prepend(second);
    await vi.waitFor(() => expect(initial.refs.item).toBe(first));
    // An external portal wins after host descendants even when it precedes
    // the host in document order: preserve the previous two-query contract.
    document.body.prepend(outside);
    await vi.waitFor(() => expect(initial.refs.item).toBe(outside));
    const replacement = marked('demo-duplicates', 'item');
    outside.after(replacement);
    await vi.waitFor(() => expect(initial.refs.item).toBe(replacement));
    outside.before(replacement);
    await vi.waitFor(() => expect(initial.refs.item).toBe(outside));
    outside.after(replacement);
    await vi.waitFor(() => expect(initial.refs.item).toBe(replacement));
    expect(queries).not.toHaveBeenCalled();
  });

  it('handles ref rename/removal/readdition through the declared attribute filter', async () => {
    const a = mount('demo-a');
    a.item.dataset.demoRef = 'renamed';
    await vi.waitFor(() => {
      expect(a.refs.item).toBeUndefined();
      expect(a.refs.renamed).toBe(a.item);
    });
    a.item.removeAttribute('data-demo-ref');
    await vi.waitFor(() => expect(a.refs.renamed).toBeUndefined());
    a.item.dataset.demoRef = 'item';
    await vi.waitFor(() => expect(a.refs.item).toBe(a.item));
  });

  it('separates identical ref names and updates both owners when a data marker is reassigned', async () => {
    const a = mount('demo-a');
    const b = mount('demo-b');
    const moving = marked('demo-a', 'moving');
    document.body.append(moving);
    await vi.waitFor(() => expect(a.refs.moving).toBe(moving));
    moving.dataset.demoOwner = 'demo-b';
    await vi.waitFor(() => {
      expect(a.refs.moving).toBeUndefined();
      expect(b.refs.moving).toBe(moving);
    });
    expect(a.refs.item).toBe(a.item);
    expect(b.refs.item).toBe(b.item);
    expect(a.refs.item).not.toBe(b.refs.item);
  });

  it('updates framework host-class ownership but does not republish for utility-only paint changes', async () => {
    const beforeMutation = observeMutationDelivery();
    const a = mount('demo-a', true, 'class');
    const b = mount('demo-b');
    await settle();
    let writes = 0;
    let value: HTMLElement = a.item;
    Object.defineProperty(a.refs, 'item', {
      configurable: true,
      enumerable: true,
      get: () => value,
      set: (next: HTMLElement) => {
        writes += 1;
        value = next;
      },
    });
    const delivered = beforeMutation(
      a.item,
      { type: 'attributes', name: 'class' },
      (record) =>
        record.type === 'attributes' &&
        record.target === a.item &&
        record.attributeName === 'class',
      { zeroEffectWhenUnobserved: true }
    );
    a.item.classList.add('bg-active');
    a.item.classList.remove('authored');
    await settle();
    await delivered.delivered;
    await Promise.resolve();
    console.info('[ref-observer-test] utility-class negative coverage', {
      observedInstances: delivered.observerCount,
      callbackPathExercised: delivered.observerCount > 0,
    });
    expect(writes).toBe(0);
    a.item.dataset.demoRef = 'moved';
    a.item.className = 'pui-owner-demo-b';
    await vi.waitFor(() => {
      expect(a.refs.item).toBeUndefined();
      expect(b.refs.moved).toBe(a.item);
    });
    expect(b.refs.item).toBe(b.item);
  });

  it('observes disconnected owner hosts and their later document portal moves', async () => {
    const a = mount('demo-a', false);
    const extra = marked('demo-a', 'extra');
    a.host.append(extra);
    await vi.waitFor(() => expect(a.refs.extra).toBe(extra));
    expect(extra.isConnected).toBe(false);
    document.body.append(extra);
    await settle();
    expect(a.refs.extra).toBe(extra);
    expect(extra.isConnected).toBe(true);
    expect(a.refs.item).toBe(a.item);
  });

  it('does not discover hidden closed-shadow nodes or follow a known ref across that boundary', async () => {
    const a = mount('demo-a');
    const host = document.createElement('div');
    const closed = host.attachShadow({ mode: 'closed' });
    const secret = marked('demo-a', 'secret');
    closed.append(secret);
    document.body.append(host);
    await settle();
    expect(a.refs.secret).toBeUndefined();
    closed.append(a.item);
    await vi.waitFor(() => expect(a.refs.item).toBeUndefined());
    expect(a.refs.secret).toBeUndefined();
    // The test owns this closed root. The product never traverses it.
    document.body.append(a.item);
    await vi.waitFor(() => expect(a.refs.item).toBe(a.item));
  });

  it('drops refs moved into another document rather than borrowing that document', async () => {
    const a = mount('demo-a');
    const other = document.implementation.createHTMLDocument('Other');
    other.body.append(other.adoptNode(a.item));
    await vi.waitFor(() => expect(a.refs.item).toBeUndefined());
    expect(a.item.ownerDocument).toBe(other);
  });

  it('ignores unknown owners and unrelated DOM without touching known owner refs', async () => {
    const beforeMutation = observeMutationDelivery();
    const a = mount('demo-a');
    const b = mount('demo-b');
    await settle();
    let writes = 0;
    let value: HTMLElement = a.item;
    Object.defineProperty(a.refs, 'item', {
      configurable: true,
      enumerable: true,
      get: () => value,
      set: (next: HTMLElement) => {
        writes += 1;
        value = next;
      },
    });
    const documentQueries = vi.spyOn(document, 'querySelectorAll');
    const unknown = marked('unknown', 'item');
    const article = document.createElement('article');
    const delivered = beforeMutation(document.body, { type: 'childList' }, (record) =>
      [...record.addedNodes].includes(unknown)
    );
    document.body.append(unknown, article);
    await settle();
    await delivered.delivered;
    await Promise.resolve();
    expect(writes).toBe(0);
    expect(documentQueries).not.toHaveBeenCalled();
    expect(a.refs.item).toBe(a.item);
    expect(b.refs.item).toBe(b.item);
  });

  it('does not publish a queued batch after the owner lease becomes stale', async () => {
    const beforeMutation = observeMutationDelivery();
    const a = mount('demo-a');
    const extra = marked('demo-a', 'extra');
    const delivered = beforeMutation(a.host, { type: 'childList' }, (record) =>
      [...record.addedNodes].includes(extra)
    );
    a.host.append(extra);
    a.retire();
    await settle();
    await delivered.delivered;
    await Promise.resolve();
    expect(a.refs.extra).toBeUndefined();
    expect(a.refs.item).toBe(a.item);
  });

  it('cleans a queued retired owner without canceling another owner or reviving a later registration', async () => {
    const a = mount('demo-a');
    const b = mount('demo-b');
    a.host.append(marked('demo-a', 'late'));
    a.stop();
    for (const key of Object.keys(a.refs)) delete a.refs[key];
    const replacement = mount('demo-c');
    const extra = marked('demo-b', 'extra');
    b.host.append(extra);
    await vi.waitFor(() => expect(b.refs.extra).toBe(extra));
    expect(Object.keys(a.refs)).toEqual([]);
    expect(replacement.refs.item).toBe(replacement.item);
    expect(replacement.refs.late).toBeUndefined();
    b.stop();
    replacement.stop();
    const next = mount('demo-d');
    next.host.append(marked('demo-d', 'new'));
    await vi.waitFor(() => expect(next.refs.new).toBeDefined());
    expect(Object.keys(a.refs)).toEqual([]);
  });
});

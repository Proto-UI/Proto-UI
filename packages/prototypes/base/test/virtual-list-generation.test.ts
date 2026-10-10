import { afterEach, expect, it, vi } from 'vitest';
import { createWindowedCollection } from '../src/virtual-list/model';
import { attachWebVirtualList } from '../src/virtual-list/web';
const active: Array<{ dispose(): void }> = [];
// Wait for the host's queued microtask, not a timing grace period.
const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));
const observers: ProbeObserver[] = [];
class ProbeObserver {
  readonly observed = new Set<Element>();
  readonly unobserved = new Set<Element>();
  disconnected = false;
  constructor(readonly callback: ResizeObserverCallback) {
    observers.push(this);
  }
  observe(node: Element) {
    this.observed.add(node);
  }
  unobserve(node: Element) {
    this.observed.delete(node);
    this.unobserved.add(node);
  }
  disconnect() {
    this.disconnected = true;
    this.observed.clear();
  }
  fire(target?: Element) {
    this.callback(
      target ? [{ target } as ResizeObserverEntry] : [],
      this as unknown as ResizeObserver
    );
  }
}
afterEach(async () => {
  active.splice(0).forEach((x) => x.dispose());
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  observers.length = 0;
  await flush();
});
function fixture(renderItem?: (key: string) => HTMLElement) {
  vi.stubGlobal('ResizeObserver', ProbeObserver);
  const collection = createWindowedCollection({ overscanItems: 0, maxMaterializedItems: 5 });
  collection.setItems(Array.from({ length: 20 }, (_, i) => `old-${i}`));
  const viewport = document.createElement('div'),
    content = document.createElement('div');
  viewport.append(content);
  document.body.append(viewport);
  let height = 60;
  Object.defineProperty(viewport, 'clientHeight', { get: () => height });
  const create =
    renderItem ??
    ((key) => {
      const el = document.createElement('div');
      el.textContent = key;
      return el;
    });
  return {
    collection,
    viewport,
    content,
    setHeight: (next: number) => {
      height = next;
    },
    attach: () => {
      const host = attachWebVirtualList({
        viewport,
        content,
        collection,
        estimateSize: 20,
        renderItem: create,
      });
      active.push(host);
      return host;
    },
    rows: () => Array.from(content.querySelectorAll<HTMLElement>('[role=listitem]')),
    spacers: () =>
      Array.from(content.children)
        .filter((n) => !n.hasAttribute('role'))
        .map((n) => (n as HTMLElement).style.height),
  };
}
it('releases obsolete rows, observations and spacer extent when replacement cannot materialize', async () => {
  const f = fixture(),
    host = f.attach(),
    old = f.rows(),
    observer = observers[0]!;
  expect(old.map((n) => n.textContent)).toEqual(['old-0', 'old-1', 'old-2']);
  expect(f.spacers()).toEqual(['0px', '340px']);
  f.setHeight(200);
  f.collection.setItems(Array.from({ length: 10 }, (_, i) => `new-${i}`));
  expect(f.collection.snapshot()).toMatchObject({
    status: 'unavailable',
    committed: null,
    materializedKeys: [],
  });
  expect(f.rows()).toEqual([]);
  expect(f.spacers()).toEqual(['0px', '0px']);
  expect(f.content.querySelector('[aria-setsize="20"]')).toBeNull();
  for (const row of old) {
    expect(row.isConnected).toBe(false);
    expect(observer.observed.has(row)).toBe(false);
    expect(observer.unobserved.has(row)).toBe(true);
  }
  observer.fire(old[0]);
  await flush();
  expect(f.rows()).toEqual([]);
  f.setHeight(60);
  host.refresh();
  const fresh = f.rows();
  expect(fresh.map((n) => n.textContent)).toEqual(['new-0', 'new-1', 'new-2']);
  expect(f.spacers()).toEqual(['0px', '140px']);
  expect(fresh.map((n) => n.getAttribute('aria-setsize'))).toEqual(['10', '10', '10']);
  observer.fire(old[1]);
  await flush();
  expect(f.rows()).toEqual(fresh);
  expect(old.every((n) => !n.isConnected)).toBe(true);
});
it('releases generation resources on policy shrink and re-acquires only current keys on recovery', () => {
  const f = fixture(),
    host = f.attach(),
    old = f.rows();
  f.collection.configure({ maxMaterializedItems: 2 });
  expect(f.collection.snapshot().materializedKeys).toEqual([]);
  expect(f.rows()).toEqual([]);
  expect(f.spacers()).toEqual(['0px', '0px']);
  f.collection.configure({ maxMaterializedItems: 5 });
  expect(f.rows()).toHaveLength(3);
  expect(f.rows().every((n) => !old.includes(n))).toBe(true);
  f.collection.setItems([]);
  expect(f.rows()).toEqual([]);
  expect(f.spacers()).toEqual(['0px', '0px']);
  expect(host.ensureVisible('old-0')).toBe(false);
});
it('preserves a still-committed old window for resize-only unavailability', () => {
  const f = fixture(),
    host = f.attach(),
    old = f.rows(),
    extent = f.spacers();
  f.setHeight(200);
  host.refresh();
  expect(f.collection.snapshot()).toMatchObject({
    status: 'unavailable',
    committed: { start: 0, end: 3 },
    materializedKeys: ['old-0', 'old-1', 'old-2'],
  });
  expect(f.rows()).toEqual(old);
  expect(f.spacers()).toEqual(extent);
});
it('coalesces a generation change during render and never mounts its staged old rows', async () => {
  let changed = false;
  const staged: HTMLElement[] = [];
  const f = fixture((key) => {
    const row = document.createElement('div');
    row.textContent = key;
    staged.push(row);
    if (!changed) {
      changed = true;
      f.collection.setItems(['fresh-0', 'fresh-1', 'fresh-2']);
    }
    return row;
  });
  f.attach();
  await flush();
  expect(f.rows().map((n) => n.textContent)).toEqual(['fresh-0', 'fresh-1', 'fresh-2']);
  expect(f.collection.snapshot().materializedKeys).toEqual(['fresh-0', 'fresh-1', 'fresh-2']);
  expect(staged.filter((n) => n.textContent?.startsWith('old-')).every((n) => !n.isConnected)).toBe(
    true
  );
});
it('does not publish a staged request superseded without a collection notification', () => {
  let supersede = true;
  let pending: ReturnType<ReturnType<typeof createWindowedCollection>['propose']>;
  const f = fixture((key) => {
    const row = document.createElement('div');
    row.textContent = key;
    if (supersede) {
      supersede = false;
      pending = f.collection.propose(1, 2);
    }
    return row;
  });
  const host = f.attach();
  expect(f.rows()).toEqual([]);
  expect(f.collection.snapshot().requested).toEqual({ start: 1, end: 2 });
  expect(f.collection.snapshot().materializedKeys).toEqual([]);
  f.collection.reject(pending!);
  host.refresh();
  expect(f.rows().map((n) => n.textContent)).toEqual(['old-0', 'old-1', 'old-2']);
});
it('stops installation when a connected row invalidates the generation', async () => {
  let changed = false;
  let f: ReturnType<typeof fixture>;
  const tag = 'virtual-generation-connected-row';
  customElements.define(
    tag,
    class extends HTMLElement {
      connectedCallback() {
        if (!changed && this.textContent === 'old-0') {
          changed = true;
          f.collection.setItems(['current-0', 'current-1', 'current-2']);
        }
      }
    }
  );
  const created: HTMLElement[] = [];
  f = fixture((key) => {
    const row = document.createElement(tag);
    row.textContent = key;
    created.push(row);
    return row;
  });
  f.attach();
  await flush();
  expect(f.rows().map((n) => n.textContent)).toEqual(['current-0', 'current-1', 'current-2']);
  for (const row of created.filter((n) => n.textContent?.startsWith('old-'))) {
    expect(row.isConnected).toBe(false);
    expect(observers[0]!.observed.has(row)).toBe(false);
  }
});
it('late queued refresh and observer callbacks cannot revive disposed generation rows', async () => {
  let host: ReturnType<typeof attachWebVirtualList> | undefined;
  let disposeOnRender = false;
  const f = fixture((key) => {
    const row = document.createElement('div');
    row.textContent = key;
    if (disposeOnRender) {
      disposeOnRender = false;
      f.collection.setItems(['late-0', 'late-1']);
      host!.dispose();
    }
    return row;
  });
  host = f.attach();
  const old = f.rows(),
    observer = observers[0]!;
  disposeOnRender = true;
  f.viewport.scrollTop = 120;
  host.refresh();
  await flush();
  observer.fire(old[0]);
  await flush();
  expect(f.content.children).toHaveLength(0);
  expect(observer.disconnected).toBe(true);
  expect(f.collection.snapshot().materializedKeys).toEqual([]);
  expect(host.ensureVisible('late-0')).toBe(false);
  host.refresh();
  expect(f.content.children).toHaveLength(0);
});
it('cleans the old committed projection when rendering fails and rejects the new request', () => {
  let fail = false;
  const f = fixture((key) => {
    if (fail && key === 'old-7') throw new Error('materializer failed');
    const row = document.createElement('div');
    row.textContent = key;
    return row;
  });
  const host = f.attach(),
    old = f.rows();
  fail = true;
  f.viewport.scrollTop = 120;
  expect(() => host.refresh()).toThrow('materializer failed');
  expect(f.collection.snapshot()).toMatchObject({
    status: 'unavailable',
    committed: null,
    materializedKeys: [],
  });
  expect(f.rows()).toEqual([]);
  expect(f.spacers()).toEqual(['0px', '0px']);
  expect(old.every((n) => !n.isConnected)).toBe(true);
});
it('never inserts a row invalidated by its accessibility attribute callback', async () => {
  let changed = false;
  let f: ReturnType<typeof fixture>;
  const connected: string[] = [];
  const tag = 'virtual-generation-attribute-row';
  customElements.define(
    tag,
    class extends HTMLElement {
      static observedAttributes = ['aria-setsize'];
      attributeChangedCallback() {
        if (!changed && this.textContent === 'old-0') {
          changed = true;
          f.collection.setItems(['current-0', 'current-1']);
        }
      }
      connectedCallback() {
        connected.push(this.textContent ?? '');
      }
    }
  );
  f = fixture((key) => {
    const row = document.createElement(tag);
    row.textContent = key;
    return row;
  });
  f.attach();
  await flush();
  expect(connected).toEqual(['current-0', 'current-1']);
  expect(f.rows().map((node) => node.textContent)).toEqual(['current-0', 'current-1']);
});

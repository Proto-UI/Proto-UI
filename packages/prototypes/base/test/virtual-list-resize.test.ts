import { afterEach, expect, it, vi } from 'vitest';
import { createWindowedCollection } from '../src/virtual-list/model';
import { attachWebVirtualList } from '../src/virtual-list/web';

const active: Array<{ dispose(): void }> = [];
class ProbeObserver {
  static latest: ProbeObserver;
  constructor(readonly callback: ResizeObserverCallback) {
    ProbeObserver.latest = this;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  fire() {
    this.callback([], this as unknown as ResizeObserver);
  }
}
// Drain only the finite host microtask chain. Timer races must not hide starvation.
const flush = async () => {
  for (let i = 0; i < 30; i++) await new Promise<void>((resolve) => queueMicrotask(resolve));
};
afterEach(async () => {
  active.splice(0).forEach((host) => host.dispose());
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  await flush();
});
function fixture(
  options: {
    initialHeight?: number;
    limit?: number;
    count?: number;
    heightFor?: (key: string) => number;
  } = {}
) {
  vi.stubGlobal('ResizeObserver', ProbeObserver);
  const collection = createWindowedCollection({
    overscanItems: 0,
    maxMaterializedItems: options.limit ?? 20,
  });
  collection.setItems(Array.from({ length: options.count ?? 20 }, (_, i) => `row-${i}`));
  const propose = vi.spyOn(collection, 'propose');
  const heights = new Map(
    collection.snapshot().keys.map((key) => [key, options.initialHeight ?? 20])
  );
  const viewport = document.createElement('div'),
    content = document.createElement('div');
  Object.defineProperty(viewport, 'clientHeight', { value: 60 });
  viewport.append(content);
  document.body.append(viewport);
  const host = attachWebVirtualList({
    viewport,
    content,
    collection,
    estimateSize: 20,
    renderItem(key) {
      const row = document.createElement('div');
      row.textContent = key;
      row.getBoundingClientRect = () =>
        ({ height: options.heightFor?.(key) ?? heights.get(key) ?? 20 }) as DOMRect;
      return row;
    },
  });
  active.push(host);
  const rows = () => Array.from(content.querySelectorAll<HTMLElement>('[role=listitem]'));
  const extent = () => rows().reduce((sum, row) => sum + row.getBoundingClientRect().height, 0);
  return {
    collection,
    propose,
    heights,
    viewport,
    content,
    host,
    rows,
    extent,
    observer: ProbeObserver.latest,
  };
}
it('corrects an observer-driven shrink without an unrelated refresh', async () => {
  const f = fixture(),
    original = f.rows();
  f.heights.set('row-0', 5);
  f.observer.fire();
  await flush();
  expect(f.extent()).toBe(65);
  expect(f.rows()).toHaveLength(4);
  expect(f.rows().slice(0, 3)).toEqual(original);
  expect((f.content.lastElementChild as HTMLElement).style.height).toBe('320px');
  const count = f.propose.mock.calls.length;
  await flush();
  expect(f.propose).toHaveBeenCalledTimes(count);
});
it.each([5, 50])('converges initial measurements of %ipx', async (initialHeight) => {
  const f = fixture({ initialHeight });
  await flush();
  expect(f.rows()).toHaveLength(initialHeight === 5 ? 12 : 2);
  expect(f.extent()).toBeGreaterThanOrEqual(60);
  expect(f.propose.mock.calls.length).toBeLessThanOrEqual(21);
  const count = f.propose.mock.calls.length;
  await flush();
  expect(f.propose).toHaveBeenCalledTimes(count);
});
it('converges a high estimate-to-measurement ratio without a small fixed pass cap', async () => {
  const f = fixture({ initialHeight: 1, count: 100, limit: 100 });
  await flush();
  expect(f.rows()).toHaveLength(60);
  expect(f.extent()).toBe(60);
  expect(f.propose.mock.calls.length).toBeGreaterThan(10);
  const count = f.propose.mock.calls.length;
  await flush();
  expect(f.propose).toHaveBeenCalledTimes(count);
});
it('corrects multiple shrink and growth deliveries and coalesces pending corrections', async () => {
  const f = fixture();
  for (const size of [10, 30, 5, 40, 20]) {
    f.heights.forEach((_, key) => f.heights.set(key, size));
    f.observer.fire();
    f.observer.fire();
    f.observer.fire();
    const beforeFlush = f.propose.mock.calls.length;
    await flush();
    expect(f.rows()).toHaveLength(Math.ceil(60 / size));
    expect(f.extent()).toBeGreaterThanOrEqual(60);
    expect(f.propose.mock.calls.length - beforeFlush).toBeLessThanOrEqual(20);
    const count = f.propose.mock.calls.length;
    await flush();
    expect(f.propose).toHaveBeenCalledTimes(count);
  }
});
it('does not schedule corrections for unchanged effective measurements', async () => {
  const f = fixture(),
    original = f.rows();
  await flush();
  expect(f.propose).toHaveBeenCalledTimes(1);
  f.observer.fire();
  f.observer.fire();
  await flush();
  expect(f.propose).toHaveBeenCalledTimes(3);
  expect(f.rows()).toEqual(original);
});
it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
  'ignores invalid measurement %s without retrying',
  async (size) => {
    const f = fixture({ initialHeight: size });
    await flush();
    expect(f.rows()).toHaveLength(3);
    expect(f.propose).toHaveBeenCalledTimes(1);
  }
);
it('keeps the valid committed window when correction exceeds the policy limit', async () => {
  const f = fixture({ limit: 3 }),
    original = f.rows();
  f.heights.set('row-0', 5);
  f.observer.fire();
  await flush();
  expect(f.collection.snapshot()).toMatchObject({
    status: 'unavailable',
    committed: { start: 0, end: 3 },
  });
  expect(f.rows()).toEqual(original);
  const count = f.propose.mock.calls.length;
  await flush();
  expect(f.propose).toHaveBeenCalledTimes(count);
});
it('a queued correction respects replacement and invalidation', async () => {
  const f = fixture(),
    original = f.rows();
  f.heights.set('row-0', 5);
  f.observer.fire();
  f.collection.setItems(['fresh-0', 'fresh-1', 'fresh-2']);
  f.collection.invalidate();
  await flush();
  expect(f.collection.snapshot().materializedKeys).toEqual(['fresh-0', 'fresh-1', 'fresh-2']);
  expect(f.rows().every((row) => !original.includes(row))).toBe(true);
  expect(original.every((row) => !row.isConnected)).toBe(true);
});
it('dispose cancels queued correction and late observer delivery', async () => {
  const f = fixture();
  f.heights.set('row-0', 5);
  f.observer.fire();
  f.host.dispose();
  const count = f.propose.mock.calls.length;
  f.observer.fire();
  await flush();
  expect(f.content.children).toHaveLength(0);
  expect(f.collection.snapshot().materializedKeys).toEqual([]);
  expect(f.propose).toHaveBeenCalledTimes(count);
});
it('bounds automatic retries for non-converging geometry and permits later recovery', async () => {
  let stable = false;
  const reads = new Map<string, number>();
  const f = fixture({
    heightFor: (key) => {
      const count = (reads.get(key) ?? 0) + 1;
      reads.set(key, count);
      return stable ? 20 : count % 2 ? 5 : 30;
    },
  });
  await flush();
  const count = f.propose.mock.calls.length;
  expect(count).toBeGreaterThan(1);
  expect(count).toBeLessThanOrEqual(4);
  await flush();
  expect(f.propose).toHaveBeenCalledTimes(count);
  stable = true;
  f.observer.fire();
  await flush();
  expect(f.rows()).toHaveLength(3);
  expect(f.extent()).toBe(60);
});
it('preserves generation checks when measurement re-enters collection replacement', async () => {
  let f: ReturnType<typeof fixture> | undefined,
    replaced = false;
  f = fixture({
    heightFor: () => {
      if (f && !replaced) {
        replaced = true;
        f.collection.setItems(['new-0', 'new-1', 'new-2']);
      }
      return 5;
    },
  });
  f.observer.fire();
  await flush();
  expect(f.collection.snapshot().materializedKeys).toEqual(['new-0', 'new-1', 'new-2']);
  expect(f.rows().map((row) => row.textContent)).toEqual(['new-0', 'new-1', 'new-2']);
});

it('renews convergence for a larger generation introduced during measurement', async () => {
  let f: ReturnType<typeof fixture> | undefined,
    replaced = false;
  f = fixture({
    count: 3,
    limit: 100,
    heightFor: () => {
      if (f && !replaced) {
        replaced = true;
        f.collection.setItems(Array.from({ length: 100 }, (_, i) => `new-${i}`));
      }
      return 1;
    },
  });
  f.observer.fire();
  await flush();
  expect(f.rows()).toHaveLength(60);
  expect(f.extent()).toBe(60);
  expect(f.collection.snapshot().materializedKeys.every((key) => key.startsWith('new-'))).toBe(
    true
  );
});

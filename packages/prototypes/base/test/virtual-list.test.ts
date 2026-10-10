import { it, expect } from 'vitest';
import { createWindowedCollection } from '../src/virtual-list/model';
import { attachWebVirtualList } from '../src/virtual-list/web';
it('keeps complete identity while committing only bounded ranges and rejecting stale work', () => {
  const c = createWindowedCollection({ overscanItems: 2, maxMaterializedItems: 8 });
  c.setItems(Array.from({ length: 100 }, (_, i) => `k${i}`));
  const first = c.propose(10, 14)!;
  expect(first.keys).toHaveLength(8);
  const next = c.propose(20, 23)!;
  expect(c.commit(first, first.keys)).toBe(false);
  expect(c.commit(next, next.keys)).toBe(true);
  expect(c.snapshot().keys).toHaveLength(100);
  c.setItems(['new', ...c.snapshot().keys]);
  expect(c.commit(next, next.keys)).toBe(false);
  expect(() => c.setItems(['a', 'a'])).toThrow();
  expect(c.propose(0, 20)).toBe(null);
});
it('materializes actual bounded Web elements, keeps keyed identity and cleans up', () => {
  const c = createWindowedCollection({ overscanItems: 1, maxMaterializedItems: 20 });
  c.setItems(Array.from({ length: 100 }, (_, i) => `k${i}`));
  const viewport = document.createElement('div'),
    content = document.createElement('div');
  viewport.append(content);
  Object.defineProperty(viewport, 'clientHeight', { value: 100 });
  const host = attachWebVirtualList({
    viewport,
    content,
    collection: c,
    estimateSize: 20,
    renderItem: (key) => {
      const row = document.createElement('div');
      row.textContent = key;
      return row;
    },
  });
  expect(content.querySelectorAll('[role=listitem]').length).toBeLessThan(20);
  expect(c.snapshot().status).toBe('committed');
  const first = content.querySelector('[role=listitem]');
  host.refresh();
  expect(content.querySelector('[role=listitem]')).toBe(first);
  expect(host.ensureVisible('k90', 'start')).toBe(true);
  expect(c.snapshot().materializedKeys).toContain('k90');
  host.dispose();
  expect(content.children.length).toBe(0);
  expect(c.snapshot().status).toBe('idle');
});

it('rejects forged logical contents and invalidates in-flight work on policy change', () => {
  const collection = createWindowedCollection();
  collection.setItems(['a', 'b', 'c']);
  const request = collection.propose(0, 2)!;
  expect(collection.commit({ ...request, keys: ['foreign'] }, ['foreign'])).toBe(false);
  collection.configure({ maxMaterializedItems: 1 });
  expect(collection.commit(request, request.keys)).toBe(false);
  expect(collection.propose(0, 2)).toBe(null);
});

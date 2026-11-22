import { afterEach, expect, it, vi } from 'vitest';
import { createWindowedCollection, type WindowedCollection } from '../src/virtual-list/model';
import { createAdapterHost, createScopedExposesReader } from '@proto.ui/adapter-base';
import {
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_GET_PROTO_CAP,
} from '@proto.ui/module-anatomy';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import { EXPOSES_RECORD_SINK_CAP } from '@proto.ui/module-expose-state';
import { attachWebVirtualList } from '../src/virtual-list/web';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { virtualListRoot, virtualListViewport, virtualListContent } from '../src/virtual-list';
for (const prototype of [virtualListRoot, virtualListViewport, virtualListContent])
  AdaptToWebComponent(prototype, { registerAs: `owner-${prototype.name}` });
const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});
function fixture(
  collection = createWindowedCollection({ overscanItems: 0, maxMaterializedItems: 4 })
) {
  collection.setItems(['a', 'b', 'c']);
  const viewport = document.createElement('div'),
    content = document.createElement('div');
  Object.defineProperty(viewport, 'clientHeight', { value: 20 });
  viewport.append(content);
  document.body.append(viewport);
  return {
    collection,
    viewport,
    content,
    renderItem: (key: string) => {
      const node = document.createElement('div');
      node.textContent = key;
      return node;
    },
    estimateSize: 20,
  };
}
it('grants one portable lease and rejects a competing materializer without modifying the first', () => {
  const collection = createWindowedCollection();
  collection.setItems(['a']);
  const cleanup = vi.fn();
  const first = collection.acquireMaterializer(cleanup);
  expect(first.isCurrent()).toBe(true);
  expect(() => collection.acquireMaterializer(vi.fn())).toThrow(/materializer/i);
  const request = collection.propose(0, 1)!;
  expect(collection.commit(request, ['a'])).toBe(true);
  first.release();
  expect(first.isCurrent()).toBe(false);
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(collection.commit(request, ['a'])).toBe(false);
  const second = collection.acquireMaterializer(vi.fn());
  const current = collection.propose(0, 1)!;
  first.release();
  expect(collection.commit(current, ['a'])).toBe(true);
  expect(second.isCurrent()).toBe(true);
  second.release();
});
it('rejects a second Web host before it appends rows or spacers', () => {
  const first = fixture();
  const host = attachWebVirtualList(first);
  cleanups.push(host.dispose);
  const originalRows = [...first.content.children];
  const snapshot = first.collection.snapshot();
  const second = fixture(first.collection);
  expect(() => attachWebVirtualList(second)).toThrow(/materializer/i);
  expect(second.content.children).toHaveLength(0);
  expect([...first.content.children]).toEqual(originalRows);
  expect(first.collection.snapshot()).toEqual(snapshot);
});
it('root retirement clears the old host and its late callbacks cannot affect a new owner', async () => {
  const first = fixture();
  const old = attachWebVirtualList(first);
  cleanups.push(old.dispose);
  first.collection.retireMaterializer();
  expect(first.content.children).toHaveLength(0);
  const second = fixture(first.collection);
  const next = attachWebVirtualList(second);
  cleanups.push(next.dispose);
  const snapshot = second.collection.snapshot();
  const nodes = [...second.content.children];
  old.refresh();
  old.dispose();
  first.viewport.dispatchEvent(new Event('scroll'));
  await Promise.resolve();
  expect(old.ensureVisible('b')).toBe(false);
  expect(second.collection.snapshot()).toEqual(snapshot);
  expect([...second.content.children]).toEqual(nodes);
});
it('a failed initial render releases the lease and cleans its owned DOM before retry', () => {
  const f = fixture();
  expect(() =>
    attachWebVirtualList({
      ...f,
      renderItem() {
        throw new Error('failed materializer');
      },
    })
  ).toThrow('failed materializer');
  expect(f.content.children).toHaveLength(0);
  const retry = attachWebVirtualList(f);
  cleanups.push(retry.dispose);
  expect(f.collection.snapshot().materializedKeys).toEqual(['a']);
});
it('a failed host observer setup also cleans the lease before same-owner retry', () => {
  const f = fixture();
  const disconnect = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      disconnect = disconnect;
      unobserve() {}
      observe() {
        throw new Error('observer setup failed');
      }
    }
  );
  expect(() => attachWebVirtualList(f)).toThrow('observer setup failed');
  expect(disconnect).toHaveBeenCalledTimes(1);
  expect(f.content.children).toHaveLength(0);
  vi.unstubAllGlobals();
  const retry = attachWebVirtualList(f);
  cleanups.push(retry.dispose);
  expect(f.collection.snapshot().materializedKeys).toEqual(['a']);
});
it('does not install a stale host when observation retires its owner synchronously', () => {
  const f = fixture();
  const disconnect = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      disconnect = disconnect;
      unobserve() {}
      observe() {
        f.collection.retireMaterializer();
      }
    }
  );
  const old = attachWebVirtualList(f);
  cleanups.push(old.dispose);
  expect(f.content.children).toHaveLength(0);
  expect(disconnect).toHaveBeenCalledTimes(1);
  vi.unstubAllGlobals();
  const next = attachWebVirtualList(f);
  cleanups.push(next.dispose);
  const snapshot = f.collection.snapshot();
  old.dispose();
  old.refresh();
  expect(f.collection.snapshot()).toEqual(snapshot);
  expect(f.collection.snapshot().materializedKeys).toEqual(['a']);
});
it('retires before actual Root disposal and makes a late Web host cleanup harmless', async () => {
  const root = document.createElement('owner-base-virtual-list-root') as HTMLElement & {
    getExposes(): any;
  };
  const viewport = document.createElement('owner-base-virtual-list-viewport');
  const content = document.createElement('owner-base-virtual-list-content');
  viewport.append(content);
  root.append(viewport);
  setElementProps(root, { itemKeys: ['a', 'b'] });
  document.body.append(root);
  for (let i = 0; i < 12; i++) await Promise.resolve();
  const collection = root.getExposes().getCollection();
  const host = attachWebVirtualList({
    viewport,
    content,
    collection,
    renderItem: () => document.createElement('div'),
  });
  expect(content.querySelector('[role="listitem"]')).not.toBeNull();
  root.remove();
  for (let i = 0; i < 12; i++) await Promise.resolve();
  expect(content.children).toHaveLength(0);
  expect(() => collection.snapshot()).toThrow(/terminal disposal/);
  expect(() => host.refresh()).not.toThrow();
  expect(host.ensureVisible('a')).toBe(false);
  expect(() => host.dispose()).not.toThrow();
});

it.each(['return', 'throw'] as const)(
  'a real Root disposed inside renderItem preserves the %s outcome and cleans staged nodes',
  async (outcome) => {
    let exposes: Record<string, unknown> = {};
    const token = {};
    const reader = createScopedExposesReader(() => owner.invokeInCallbackScope);
    const owner = createAdapterHost(
      virtualListRoot,
      {
        getRawProps: () => ({ itemKeys: ['a', 'b', 'c'], overscanItems: 0 }),
        schedule: (task) => task(),
        commit: (_children, signal) => signal?.done(),
      },
      {
        onRuntimeReady(wiring) {
          wiring.attach('anatomy', [
            [ANATOMY_INSTANCE_TOKEN_CAP, token],
            [ANATOMY_PARENT_CAP, () => null],
            [ANATOMY_GET_PROTO_CAP, () => virtualListRoot],
          ]);
          wiring.attach('context', [
            [CONTEXT_INSTANCE_TOKEN_CAP, token],
            [CONTEXT_PARENT_CAP, () => null],
          ]);
          wiring.attach('expose-state', [
            [
              EXPOSES_RECORD_SINK_CAP,
              (value: Record<string, unknown>) => {
                exposes = value;
              },
            ],
          ]);
        },
        afterUnmount: () => reader.invalidate(),
      },
      { initialMount: 'manual' }
    );
    await owner.mount();
    const collection = (reader.read(exposes).getCollection as () => WindowedCollection)();
    const viewport = document.createElement('div');
    const content = document.createElement('div');
    Object.defineProperty(viewport, 'clientHeight', { value: 40 });
    viewport.append(content);
    document.body.append(viewport);
    let rendered = 0;
    const failure = new Error('original materializer failure');
    const attach = () =>
      attachWebVirtualList({
        viewport,
        content,
        collection,
        estimateSize: 20,
        renderItem() {
          rendered++;
          if (outcome === 'throw' && rendered === 2) {
            void owner.dispose();
            throw failure;
          }
          const node = document.createElement('div');
          content.append(node);
          if (outcome === 'return') void owner.dispose();
          return node;
        },
      });
    try {
      if (outcome === 'throw') expect(attach).toThrow(failure);
      else {
        let host!: ReturnType<typeof attachWebVirtualList>;
        expect(() => {
          host = attach();
        }).not.toThrow();
        expect(() => host.refresh()).not.toThrow();
        expect(() => host.dispose()).not.toThrow();
        expect(host.ensureVisible('b')).toBe(false);
      }
      expect(() => collection.snapshot()).toThrow(/terminal disposal/);
      expect(content.children).toHaveLength(0);
    } finally {
      await owner.dispose();
    }
  }
);

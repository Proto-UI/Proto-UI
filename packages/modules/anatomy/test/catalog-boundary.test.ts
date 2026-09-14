import { describe, expect, it, vi } from 'vitest';
import { createAnatomyFamily } from '@proto.ui/core';
import { AnatomyModuleImpl } from '../src/impl';
import { makeCaps } from './utils/fake-caps';

const expose = { has: () => false, get: () => undefined } as any;
describe('Anatomy catalog boundaries', () => {
  it('T-ANATOMY-0004-CASE-CANCEL: author unsubscribe is setup-only and rejection preserves the subscription', () => {
    const family = createAnatomyFamily('cancel', {
      roles: {
        root: { cardinality: { min: 1, max: 1 } },
        item: { cardinality: { min: 0, max: '*' } },
      },
    });
    const root = {},
      child = {};
    const make = (instance: object) =>
      makeCaps({
        instance,
        getParent: (i) => (i === child ? root : null),
        getPrototype: () => ({ name: 'part' }),
      });
    const caps = make(root),
      childCaps = make(child);
    const impl = new AnatomyModuleImpl(caps, 'root', expose),
      item = new AnatomyModuleImpl(childCaps, 'item', expose);
    try {
      impl.claim(family, { role: 'root' });
      const removed = vi.fn(),
        kept = vi.fn();
      const offRemoved = impl.subscribeParts(family, 'item', removed);
      offRemoved();
      const off = impl.subscribeParts(family, 'item', kept);
      caps.__sys.__setExecPhase('callback');
      expect(off).toThrow(/setup/i);
      expect(offRemoved).toThrow(/setup/i);
      item.claim(family, { role: 'item' });
      item.onProtoPhase('mounted');
      expect(removed).not.toHaveBeenCalled();
      expect(kept).toHaveBeenCalledTimes(1);
      caps.__sys.__setExecPhase('render');
      expect(off).toThrow(/setup/i);
    } finally {
      item.dispose();
      impl.dispose();
    }
  });

  it('T-ANATOMY-0004-CASE-HOST: isolates nearest domains and uses stable fallback without host targets', () => {
    const family = createAnatomyFamily('identity', {
      roles: {
        root: { cardinality: { min: 1, max: 1 } },
        item: { cardinality: { min: 0, max: '*' } },
      },
    });
    const sameName = createAnatomyFamily('identity', family.decl);
    const outer = {},
      inner = {},
      item = {},
      sibling = {};
    const parents = new Map([
      [outer, null],
      [inner, outer],
      [item, inner],
      [sibling, outer],
    ]);
    const modules = [outer, inner, item, sibling].map((instance, index) => {
      const caps = makeCaps({
        instance,
        getParent: (i) => parents.get(i as object) ?? null,
        getPrototype: () => ({ name: 'part' }),
      });
      const impl = new AnatomyModuleImpl(caps, 'part', expose);
      impl.claim(family, { role: index < 2 ? 'root' : 'item' });
      caps.__sys.__setExecPhase('callback');
      return impl;
    });
    try {
      expect(modules[0].partsOf(family, 'item')).toHaveLength(1);
      expect(modules[1].partsOf(family, 'item')).toHaveLength(1);
      expect(modules[2].indexOfSelf(family, 'item')).toBe(0);
      expect(modules[0].orderedParts(family)?.map((p) => p.role)).toEqual(['root', 'item']);
      expect(() => modules[0].parts(sameName)).toThrow();
      expect(Object.keys(modules[0].parts(family)![0]).sort()).toEqual([
        'getExpose',
        'hasExpose',
        'hasHook',
        'role',
      ]);
    } finally {
      modules.reverse().forEach((m) => m.dispose());
    }
  });
});

it('T-ANATOMY-0004-CASE-ORDER: real DOM observation reports role order changes once and releases the observer', async () => {
  const { createDomOrderObserver } = await import('../src/web/order-observer');
  const family = createAnatomyFamily('dom-order', {
    roles: {
      root: { cardinality: { min: 1, max: 1 } },
      item: { cardinality: { min: 0, max: '*' } },
    },
  });
  const root = document.createElement('div'),
    a = document.createElement('div'),
    b = document.createElement('div');
  root.append(a, b);
  document.body.append(root);
  let observerStarts = 0,
    observerStops = 0;
  const modules = [root, a, b].map((instance, index) => {
    const caps = makeCaps({
      instance,
      getParent: (i) => (i === root ? null : root),
      getPrototype: () => ({ name: 'part' }),
      getRootTarget: (i) => i,
      orderObserver: (target, notify) => {
        observerStarts++;
        const off = createDomOrderObserver(target as HTMLElement, notify);
        return () => {
          observerStops++;
          off();
        };
      },
    });
    const impl = new AnatomyModuleImpl(caps, 'part', { has: () => true, get: () => index } as any);
    impl.claim(family, { role: index === 0 ? 'root' : 'item' });
    return { impl, caps };
  });
  const rootImpl = modules[0].impl;
  const peer = vi.fn();
  modules[1].impl.subscribeParts(family, 'item', peer);
  const seen: number[][] = [];
  rootImpl.subscribeParts(family, 'item', (_ctx, parts) =>
    seen.push(parts.map((p) => p.getExpose('id') as number))
  );
  const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 5));
  try {
    for (const m of modules) {
      m.caps.__sys.__setExecPhase('callback');
      m.impl.onMountPhase('mounted', 1);
    }
    expect(observerStarts).toBe(1);
    expect(seen).toEqual([]);
    root.insertBefore(b, a);
    await flush();
    expect(seen).toEqual([[2, 1]]);
    expect(peer).toHaveBeenCalledTimes(1);
    a.append(document.createTextNode('business content'));
    await flush();
    expect(seen).toHaveLength(1);
    expect(rootImpl.orderVersion(family)).toBe(1);
    rootImpl.onMountPhase('detached', 1);
    root.insertBefore(a, b);
    await flush();
    expect(seen).toHaveLength(1);
    rootImpl.dispose();
    root.insertBefore(b, a);
    await flush();
    expect(seen).toHaveLength(1);
  } finally {
    modules.reverse().forEach((m) => m.impl.dispose());
    expect(observerStops).toBe(observerStarts);
    root.remove();
  }
});

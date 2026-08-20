import { describe, expect, it } from 'vitest';
import { createAnatomyFamily, type Prototype } from '@proto.ui/core';
import { AnatomyModuleImpl } from '../src/impl';
import { makeCaps, createSysCaps } from './utils/fake-caps';

function makeExposePort(record: Record<string, unknown> = {}) {
  return {
    get: (key: string) => record[key],
    getAll: () => ({ ...record }),
    has: (key: string) => Object.prototype.hasOwnProperty.call(record, key),
    keys: () => Object.keys(record),
  } as any;
}

function makeProto(hooks: string[] = []): Prototype<any> {
  const proto: Prototype<any> = { name: `x-${hooks.join('-') || 'plain'}`, setup: () => {} };
  Object.defineProperty(proto as any, '__asHooks', {
    value: hooks.map((name) => ({ name, order: 0, privileged: true })),
    configurable: true,
  });
  return proto;
}

describe('AnatomyModuleImpl', () => {
  it('enforces setup-only family/claim and runtime-only query access', () => {
    const sys = createSysCaps();
    const instance = {};
    const caps = makeCaps({
      sys,
      instance,
      getParent: () => null,
      getPrototype: () => makeProto(['asSelect']),
    });
    const impl = new AnatomyModuleImpl(caps, 'p-x', makeExposePort());
    const family = createAnatomyFamily('setup-guard', {
      roles: { root: { cardinality: { min: 1, max: 1 } } },
    });

    sys.__setExecPhase('setup');
    impl.claim(family, { role: 'root' });
    expect(() => impl.parts(family)).toThrow();

    sys.__setExecPhase('render');
    expect(() => impl.claim(family, { role: 'root' })).toThrow();
    expect(() => impl.parts(family)).not.toThrow();

    sys.__setExecPhase('callback');
    expect(() => impl.parts(family)).not.toThrow();
  });

  it('rejects duplicate claim and non-root profile claim', () => {
    const sys = createSysCaps();
    const instance = {};
    const caps = makeCaps({
      sys,
      instance,
      getParent: () => null,
      getPrototype: () => makeProto(['asSelect']),
    });
    const impl = new AnatomyModuleImpl(caps, 'p-x', makeExposePort());
    const family = createAnatomyFamily('claim-rules', {
      roles: {
        root: { cardinality: { min: 1, max: 1 } },
        item: { cardinality: { min: 0, max: 2 } },
      },
      profiles: {
        default: {},
      },
    });

    expect(() => impl.claim(family, { role: 'item', profile: 'default' })).toThrow();
    impl.claim(family, { role: 'root', profile: 'default' });
    expect(() => impl.claim(family, { role: 'root' })).toThrow();
  });

  it('reports family errors and profile warnings', () => {
    const family = createAnatomyFamily('diag-cardinality', {
      roles: {
        root: { cardinality: { min: 1, max: 1 }, requires: [{ kind: 'hook', name: 'asSelect' }] },
        trigger: {
          cardinality: { min: 0, max: 2 },
          requires: [{ kind: 'hook', name: 'asTrigger' }],
        },
      },
      profiles: {
        default: {
          roles: {
            trigger: { cardinality: { max: 1 } },
          },
        },
      },
    });
    const root = {};
    const triggerA = {};
    const triggerB = {};
    const parentMap = new Map<any, any>([
      [root, null],
      [triggerA, root],
      [triggerB, root],
    ]);

    const sysRoot = createSysCaps();
    const rootImpl = new AnatomyModuleImpl(
      makeCaps({
        sys: sysRoot,
        instance: root,
        getParent: (instance) => parentMap.get(instance) ?? null,
        getPrototype: () => makeProto(['asSelect']),
      }),
      'root',
      makeExposePort()
    );
    const triggerImplA = new AnatomyModuleImpl(
      makeCaps({
        instance: triggerA,
        getParent: (instance) => parentMap.get(instance) ?? null,
        getPrototype: () => makeProto(['asTrigger']),
      }),
      'trigger-a',
      makeExposePort()
    );
    const triggerImplB = new AnatomyModuleImpl(
      makeCaps({
        instance: triggerB,
        getParent: (instance) => parentMap.get(instance) ?? null,
        getPrototype: () => makeProto(['asTrigger']),
      }),
      'trigger-b',
      makeExposePort()
    );

    rootImpl.claim(family, { role: 'root', profile: 'default' });
    triggerImplA.claim(family, { role: 'trigger' });
    triggerImplB.claim(family, { role: 'trigger' });

    const diags = rootImpl.port.getDiagnostics();
    expect(diags.some((it) => it.scope === 'profile' && it.code === 'ANATOMY_PROFILE_MAX')).toBe(
      true
    );
    expect(diags.some((it) => it.scope === 'family' && it.code === 'ANATOMY_FAMILY_MAX')).toBe(
      false
    );
  });

  it('does not report max diagnostics for unbounded role cardinality', () => {
    const family = createAnatomyFamily('diag-unbounded-cardinality', {
      roles: {
        root: { cardinality: { min: 1, max: 1 } },
        indicator: { cardinality: { min: 0, max: '*' } },
      },
    });
    const root = {};
    const indicatorA = {};
    const indicatorB = {};
    const parentMap = new Map<any, any>([
      [root, null],
      [indicatorA, root],
      [indicatorB, root],
    ]);

    const rootImpl = new AnatomyModuleImpl(
      makeCaps({
        instance: root,
        getParent: (instance) => parentMap.get(instance) ?? null,
        getPrototype: () => makeProto([]),
      }),
      'root',
      makeExposePort()
    );
    const indicatorImplA = new AnatomyModuleImpl(
      makeCaps({
        instance: indicatorA,
        getParent: (instance) => parentMap.get(instance) ?? null,
        getPrototype: () => makeProto([]),
      }),
      'indicator-a',
      makeExposePort()
    );
    const indicatorImplB = new AnatomyModuleImpl(
      makeCaps({
        instance: indicatorB,
        getParent: (instance) => parentMap.get(instance) ?? null,
        getPrototype: () => makeProto([]),
      }),
      'indicator-b',
      makeExposePort()
    );

    rootImpl.claim(family, { role: 'root' });
    indicatorImplA.claim(family, { role: 'indicator' });
    indicatorImplB.claim(family, { role: 'indicator' });

    const diags = rootImpl.port.getDiagnostics();
    expect(diags.some((it) => it.code === 'ANATOMY_FAMILY_MAX')).toBe(false);
  });

  it('reports missing family hook and relation failures', () => {
    const family = createAnatomyFamily('diag-relation', {
      roles: {
        root: { cardinality: { min: 1, max: 1 } },
        content: { cardinality: { min: 0, max: 1 } },
        item: {
          cardinality: { min: 0, max: 3 },
          requires: [{ kind: 'hook', name: 'asSelectItem' }],
        },
      },
      relations: [{ kind: 'contains', parent: 'content', child: 'item' }],
    });
    const root = {};
    const item = {};
    const parentMap = new Map<any, any>([
      [root, null],
      [item, root],
    ]);

    const rootImpl = new AnatomyModuleImpl(
      makeCaps({
        instance: root,
        getParent: (instance) => parentMap.get(instance) ?? null,
        getPrototype: () => makeProto(['asSelect']),
      }),
      'root',
      makeExposePort()
    );
    const itemImpl = new AnatomyModuleImpl(
      makeCaps({
        instance: item,
        getParent: (instance) => parentMap.get(instance) ?? null,
        getPrototype: () => makeProto([]),
      }),
      'item',
      makeExposePort()
    );

    rootImpl.claim(family, { role: 'root' });
    itemImpl.claim(family, { role: 'item' });

    const diags = rootImpl.port.getDiagnostics();
    expect(diags.some((it) => it.code === 'ANATOMY_FAMILY_HOOK_REQUIRED')).toBe(true);
    expect(diags.some((it) => it.code === 'ANATOMY_FAMILY_RELATION')).toBe(true);
  });

  it('provides ordered role views by host target position', () => {
    const family = createAnatomyFamily('ordered-role-view', {
      roles: {
        root: { cardinality: { min: 1, max: 1 } },
        item: { cardinality: { min: 0, max: 10 } },
      },
    });
    const root = {};
    const itemA = {};
    const itemB = {};
    const parentMap = new Map<any, any>([
      [root, null],
      [itemA, root],
      [itemB, root],
    ]);
    const order = new Map<any, number>([
      [root, 0],
      [itemA, 2],
      [itemB, 1],
    ]);
    const makeTarget = (instance: unknown) => ({
      compareDocumentPosition(other: any) {
        const a = order.get(instance) ?? 0;
        const b = order.get(other.__instance) ?? 0;
        if (a < b) return 4;
        if (a > b) return 2;
        return 0;
      },
      __instance: instance,
    });

    const rootCaps = makeCaps({
      instance: root,
      getParent: (instance) => parentMap.get(instance) ?? null,
      getPrototype: () => makeProto([]),
      getRootTarget: (instance) => makeTarget(instance),
    });
    const itemCapsA = makeCaps({
      instance: itemA,
      getParent: (instance) => parentMap.get(instance) ?? null,
      getPrototype: () => makeProto([]),
      getRootTarget: (instance) => makeTarget(instance),
    });
    const itemCapsB = makeCaps({
      instance: itemB,
      getParent: (instance) => parentMap.get(instance) ?? null,
      getPrototype: () => makeProto([]),
      getRootTarget: (instance) => makeTarget(instance),
    });
    const rootImpl = new AnatomyModuleImpl(rootCaps, 'root', makeExposePort());
    const itemImplA = new AnatomyModuleImpl(itemCapsA, 'item-a', makeExposePort({ id: 'a' }));
    const itemImplB = new AnatomyModuleImpl(itemCapsB, 'item-b', makeExposePort({ id: 'b' }));

    rootImpl.claim(family, { role: 'root' });
    itemImplA.claim(family, { role: 'item' });
    itemImplB.claim(family, { role: 'item' });

    rootCaps.__sys.__setExecPhase('callback');
    itemCapsA.__sys.__setExecPhase('callback');

    const ordered = rootImpl.orderedPartsOf(family, 'item') ?? [];
    expect(ordered.map((part) => part.getExpose('id'))).toEqual(['b', 'a']);
    expect('getRootTarget' in ordered[0]!).toBe(false);
    expect(itemImplA.indexOfSelf(family, 'item')).toBe(1);
    expect(itemImplA.prevOfSelf(family, 'item')?.getExpose('id')).toBe('b');
    expect(itemImplA.nextOfSelf(family, 'item')).toBeNull();
  });

  it('binds exposed PartView method calls to the target part callback dispatcher', () => {
    const family = createAnatomyFamily('part-method-binding', {
      roles: {
        root: { cardinality: { min: 1, max: 1 } },
        item: { cardinality: { min: 0, max: 1 } },
      },
    });
    const root = {};
    const item = {};
    const parents = new Map<unknown, unknown | null>([
      [root, null],
      [item, root],
    ]);
    const make = (instance: unknown) =>
      makeCaps({
        instance,
        getParent: (candidate) => parents.get(candidate) ?? null,
        getPrototype: () => makeProto([]),
      });
    const rootCaps = make(root);
    const itemCaps = make(item);
    let inItemCallback = false;
    const itemImpl = new AnatomyModuleImpl(
      itemCaps,
      'item',
      makeExposePort({
        request(value: string) {
          expect(inItemCallback).toBe(true);
          return `accepted:${value}`;
        },
      })
    );
    const rootImpl = new AnatomyModuleImpl(rootCaps, 'root', makeExposePort());
    rootImpl.claim(family, { role: 'root' });
    itemImpl.claim(family, { role: 'item' });
    itemImpl.port.setOrderCallbackDispatcher((fn) => {
      inItemCallback = true;
      try {
        fn('item-run');
      } finally {
        inItemCallback = false;
      }
    });
    rootCaps.__sys.__setExecPhase('callback');

    const request = rootImpl.partsOf(family, 'item')?.[0]?.getExpose('request') as
      | ((value: string) => string)
      | null;
    expect(request?.('open')).toBe('accepted:open');
    expect(inItemCallback).toBe(false);
  });

  it('dispatches order subscriptions through callback dispatcher', () => {
    const family = createAnatomyFamily('ordered-subscribe', {
      roles: {
        root: { cardinality: { min: 1, max: 1 } },
        item: { cardinality: { min: 0, max: 10 } },
      },
    });
    const root = {};
    const item = {};
    const target = {
      compareDocumentPosition() {
        return 0;
      },
    };
    let notifyObserver: (() => void) | null = null;
    const caps = makeCaps({
      instance: root,
      getParent: (instance) => (instance === item ? root : null),
      getPrototype: () => makeProto([]),
      getRootTarget: () => target,
      orderObserver: (_target, notify) => {
        notifyObserver = notify;
        return () => {
          notifyObserver = null;
        };
      },
    });
    const impl = new AnatomyModuleImpl(caps, 'root', makeExposePort());
    const itemImpl = new AnatomyModuleImpl(
      makeCaps({
        instance: item,
        getParent: (instance) => (instance === item ? root : null),
        getPrototype: () => makeProto([]),
        getRootTarget: () => target,
      }),
      'item',
      makeExposePort()
    );

    impl.claim(family, { role: 'root' });

    let ctxSeen: unknown = null;
    let calls = 0;
    impl.port.setOrderCallbackDispatcher((fn) => fn('ctx'));
    const off = impl.port.subscribeOrder(family, (ctx) => {
      ctxSeen = ctx;
      calls++;
    });

    // Logical subscription exists while detached, but no DOM observer does.
    expect(notifyObserver).toBeNull();
    impl.onMountPhase('mounted', 1);
    expect(notifyObserver).not.toBeNull();
    expect(impl.port.order.version(family)).toBe(0);
    (notifyObserver as (() => void) | null)?.();
    expect(ctxSeen).toBeNull();
    expect(calls).toBe(0);
    expect(impl.port.order.version(family)).toBe(0);

    itemImpl.claim(family, { role: 'item' });
    (notifyObserver as (() => void) | null)?.();
    expect(ctxSeen).toBe('ctx');
    expect(calls).toBe(1);
    expect(impl.port.order.version(family)).toBe(1);

    (notifyObserver as (() => void) | null)?.();
    expect(calls).toBe(1);
    expect(impl.port.order.version(family)).toBe(1);

    impl.onMountPhase('detached', 1);
    expect(notifyObserver).toBeNull();
    impl.onMountPhase('mounted', 2);
    expect(notifyObserver).not.toBeNull();

    off();
  });

  it('signals target readiness changes across a family domain', () => {
    const family = createAnatomyFamily('target-readiness-subscribe', {
      roles: {
        root: { cardinality: { min: 1, max: 1 } },
        thumb: { cardinality: { min: 0, max: 1 } },
      },
    });
    const root = {};
    const thumb = {};
    const parentMap = new Map<unknown, unknown | null>([
      [root, null],
      [thumb, root],
    ]);
    const rootImpl = new AnatomyModuleImpl(
      makeCaps({
        instance: root,
        getParent: (instance) => parentMap.get(instance) ?? null,
        getPrototype: () => makeProto([]),
      }),
      'root',
      makeExposePort()
    );
    const thumbImpl = new AnatomyModuleImpl(
      makeCaps({
        instance: thumb,
        getParent: (instance) => parentMap.get(instance) ?? null,
        getPrototype: () => makeProto([]),
      }),
      'thumb',
      makeExposePort()
    );

    rootImpl.claim(family, { role: 'root' });
    thumbImpl.claim(family, { role: 'thumb' });

    let calls = 0;
    let callbackContext: unknown = null;
    rootImpl.port.setOrderCallbackDispatcher((fn) => fn('target-context'));
    const off = rootImpl.port.subscribeTargets(family, (ctx) => {
      calls++;
      callbackContext = ctx;
    });

    thumbImpl.onMountPhase('mounted', 1);
    expect(calls).toBe(1);
    expect(callbackContext).toBe('target-context');

    thumbImpl.onMountPhase('detached', 1);
    expect(calls).toBe(2);

    off();
    thumbImpl.onMountPhase('mounted', 2);
    expect(calls).toBe(2);
  });

  it('supports null/empty query policies when current instance is outside a valid domain', () => {
    const family = createAnatomyFamily('query-policy-outside-domain', {
      roles: {
        root: { cardinality: { min: 1, max: 1 } },
        item: { cardinality: { min: 0, max: 10 } },
      },
    });
    const orphan = {};
    const caps = makeCaps({
      instance: orphan,
      getParent: () => null,
      getPrototype: () => makeProto([]),
    });
    const impl = new AnatomyModuleImpl(caps, 'orphan', makeExposePort());

    caps.__sys.__setExecPhase('callback');

    expect(impl.parts(family, { missing: 'null' })).toBeNull();
    expect(impl.parts(family, { missing: 'empty' })).toEqual([]);
    expect(impl.orderVersion(family, { missing: 'null' })).toBeNull();
    expect(impl.orderedParts(family, { missing: 'null' })).toBeNull();
    expect(impl.orderedPartsOf(family, 'item', { missing: 'null' })).toBeNull();
    expect(impl.orderedPartsOf(family, 'item', { missing: 'empty' })).toEqual([]);
    expect(impl.indexOfSelf(family, 'item', { missing: 'null' })).toBeNull();
    expect(impl.prevOfSelf(family, 'item', { missing: 'null' })).toBeNull();
    expect(impl.nextOfSelf(family, 'item', { missing: 'null' })).toBeNull();
  });

  it('auto-registers embedded family declarations on first claim', () => {
    const family = createAnatomyFamily('embedded-family-decl', {
      roles: {
        root: { cardinality: { min: 1, max: 1 } },
        item: { cardinality: { min: 0, max: 10 } },
      },
      relations: [{ kind: 'contains', parent: 'root', child: 'item' }],
    });
    const root = {};
    const item = {};
    const parentMap = new Map<any, any>([
      [root, null],
      [item, root],
    ]);

    const rootCaps = makeCaps({
      instance: root,
      getParent: (instance) => parentMap.get(instance) ?? null,
      getPrototype: () => makeProto([]),
    });
    const itemCaps = makeCaps({
      instance: item,
      getParent: (instance) => parentMap.get(instance) ?? null,
      getPrototype: () => makeProto([]),
    });

    const rootImpl = new AnatomyModuleImpl(rootCaps, 'root', makeExposePort());
    const itemImpl = new AnatomyModuleImpl(itemCaps, 'item', makeExposePort());

    expect(() => itemImpl.claim(family, { role: 'item' })).not.toThrow();
    expect(() => rootImpl.claim(family, { role: 'root' })).not.toThrow();

    rootCaps.__sys.__setExecPhase('callback');
    itemCaps.__sys.__setExecPhase('callback');

    expect(rootImpl.partsOf(family, 'item')?.length).toBe(1);
    expect(itemImpl.indexOfSelf(family, 'item')).toBe(0);
  });
});

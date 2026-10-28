import { describe, expect, it } from 'vitest';
import { createAnatomyFamily, definePrototype, type Prototype } from '@proto.ui/core';
import type { RuntimeHost } from '../../src';
import { executeWithHost } from '../../src';
import {
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_ORDER_OBSERVER_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_ROOT_TARGET_CAP,
  type AnatomyOrderObserver,
} from '@proto.ui/module-anatomy';

type Target = {
  id: string;
  compareDocumentPosition(other: Target): number;
};

function createTarget(id: string, orderMap: Map<string, number>): Target {
  return {
    id,
    compareDocumentPosition(other: Target) {
      const a = orderMap.get(id) ?? 0;
      const b = orderMap.get(other.id) ?? 0;
      if (a < b) return 4;
      if (a > b) return 2;
      return 0;
    },
  };
}

function createHost(args: {
  instance: Target;
  getParent: (instance: unknown) => unknown | null;
  getPrototype: (instance: unknown) => Prototype<any> | null;
  observeOrder?: AnatomyOrderObserver;
}) {
  const host: RuntimeHost<any> = {
    prototypeName: `host-${args.instance.id}`,
    getRawProps: () => ({}),
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
    onRuntimeReady(wiring) {
      wiring.attach('anatomy', [
        [ANATOMY_INSTANCE_TOKEN_CAP, args.instance],
        [ANATOMY_PARENT_CAP, args.getParent],
        [ANATOMY_GET_PROTO_CAP, args.getPrototype],
        [ANATOMY_ROOT_TARGET_CAP, (instance: unknown) => instance as Target],
        ...(args.observeOrder ? ([[ANATOMY_ORDER_OBSERVER_CAP, args.observeOrder]] as const) : []),
      ]);
    },
  };

  return { host };
}

describe('runtime contract: anatomy.order (v0)', () => {
  /**
   * Contract note:
   * - `run.anatomy.order.*` is runtime-only, not setup-only and not callback-only.
   * - This supports author-facing hooks/behaviors that need readonly order queries
   *   from exposed methods or other runtime paths without falling back to internal ports.
   */
  it('ANATOMY-ORDER-RT-0100: run.anatomy.order queries reflect host order and self adjacency', () => {
    const family = createAnatomyFamily('rt-anatomy-order', {
      roles: {
        root: { cardinality: { min: 1, max: 1 } },
        item: { cardinality: { min: 0, max: 10 } },
      },
    });
    const orderMap = new Map<string, number>([
      ['root', 0],
      ['item-a', 2],
      ['item-b', 1],
    ]);
    const rootTarget = createTarget('root', orderMap);
    const itemATarget = createTarget('item-a', orderMap);
    const itemBTarget = createTarget('item-b', orderMap);
    const parents = new Map<unknown, unknown | null>([
      [rootTarget, null],
      [itemATarget, rootTarget],
      [itemBTarget, rootTarget],
    ]);

    let orderedIds: unknown[] = [];
    let version = -1;
    let itemAIndex = -1;
    let itemAPrevId: unknown = undefined;
    let itemANextId: unknown = undefined;

    const Root = definePrototype({
      name: 'x-rt-anatomy-order-root',
      setup(def) {
        def.anatomy.claim(family, { role: 'root' });
        def.lifecycle.onUpdated((run) => {
          orderedIds = run.anatomy.order
            .partsOf(family, 'item')
            .map((part) => part.getExpose('id'));
          version = run.anatomy.order.version(family);
        });
        return (r) => r.el('div', r.slot());
      },
    });

    const Item = definePrototype({
      name: 'x-rt-anatomy-order-item',
      setup(def) {
        def.anatomy.claim(family, { role: 'item' });
        def.expose.value('id' as any, '');
        def.lifecycle.onUpdated((run) => {
          const prev = run.anatomy.order.prevOfSelf(family, 'item');
          const next = run.anatomy.order.nextOfSelf(family, 'item');
          if (
            run.anatomy.order.indexOfSelf(family, 'item') >= 0 &&
            run.anatomy.order.partsOf(family, 'item').length > 0
          ) {
            itemAIndex = run.anatomy.order.indexOfSelf(family, 'item');
            itemAPrevId = prev?.getExpose('id');
            itemANextId = next?.getExpose('id');
          }
        });
        return (r) => r.el('div', r.slot());
      },
    });

    const getPrototype = (instance: unknown) => {
      if (instance === rootTarget) return Root;
      if (instance === itemATarget || instance === itemBTarget) return Item;
      return null;
    };

    const rootCtx = createHost({
      instance: rootTarget,
      getParent: (instance) => parents.get(instance) ?? null,
      getPrototype,
    });
    const itemACtx = createHost({
      instance: itemATarget,
      getParent: (instance) => parents.get(instance) ?? null,
      getPrototype,
    });
    const itemBCtx = createHost({
      instance: itemBTarget,
      getParent: (instance) => parents.get(instance) ?? null,
      getPrototype,
    });

    const rootExec = executeWithHost(Root as any, rootCtx.host as any);
    const itemAExec = executeWithHost(
      definePrototype({
        name: 'x-rt-anatomy-order-item-a',
        setup(def) {
          def.anatomy.claim(family, { role: 'item' });
          def.expose.value('id' as any, 'a');
          def.lifecycle.onUpdated((run) => {
            itemAIndex = run.anatomy.order.indexOfSelf(family, 'item');
            itemAPrevId = run.anatomy.order.prevOfSelf(family, 'item')?.getExpose('id');
            itemANextId = run.anatomy.order.nextOfSelf(family, 'item')?.getExpose('id');
          });
          return (r) => r.el('div', r.slot());
        },
      }) as any,
      itemACtx.host as any
    );
    executeWithHost(
      definePrototype({
        name: 'x-rt-anatomy-order-item-b',
        setup(def) {
          def.anatomy.claim(family, { role: 'item' });
          def.expose.value('id' as any, 'b');
          return (r) => r.el('div', r.slot());
        },
      }) as any,
      itemBCtx.host as any
    );

    rootExec.controller.update();
    itemAExec.controller.update();

    expect(orderedIds).toEqual(['b', 'a']);
    expect(version).toBe(0);
    expect(itemAIndex).toBe(1);
    expect(itemAPrevId).toBe('b');
    expect(itemANextId).toBeUndefined();
  });

  it('ANATOMY-ORDER-RT-0200: run.anatomy query policies return null/empty when no valid domain exists', () => {
    const family = createAnatomyFamily('rt-anatomy-order-policy', {
      roles: {
        root: { cardinality: { min: 1, max: 1 } },
        item: { cardinality: { min: 0, max: 10 } },
      },
    });
    const orphanTarget = createTarget('orphan', new Map([['orphan', 0]]));
    let seen: Record<string, unknown> | null = null;

    const Orphan = definePrototype({
      name: 'x-rt-anatomy-order-orphan',
      setup(def) {
        def.anatomy.claim(family, { role: 'item' });
        def.lifecycle.onUpdated((run) => {
          const anatomyAny = run.anatomy as any;
          seen = {
            parts: anatomyAny.parts(family, { missing: 'null' }),
            emptyParts: anatomyAny.parts(family, { missing: 'empty' }),
            roleParts: anatomyAny.partsOf(family, 'item', { missing: 'null' }),
            emptyRoleParts: anatomyAny.partsOf(family, 'item', { missing: 'empty' }),
            version: anatomyAny.order.version(family, { missing: 'null' }),
            ordered: anatomyAny.order.parts(family, { missing: 'null' }),
            orderedRole: anatomyAny.order.partsOf(family, 'item', { missing: 'null' }),
            index: anatomyAny.order.indexOfSelf(family, 'item', { missing: 'null' }),
            prev: anatomyAny.order.prevOfSelf(family, 'item', { missing: 'null' }),
            next: anatomyAny.order.nextOfSelf(family, 'item', { missing: 'null' }),
          };
        });
        return (r) => r.el('div', r.slot());
      },
    });

    const orphanCtx = createHost({
      instance: orphanTarget,
      getParent: () => null,
      getPrototype: (instance) => (instance === orphanTarget ? Orphan : null),
    });

    executeWithHost(Orphan as any, orphanCtx.host as any).controller.update();

    expect(seen).toEqual({
      parts: null,
      emptyParts: [],
      roleParts: null,
      emptyRoleParts: [],
      version: null,
      ordered: null,
      orderedRole: null,
      index: null,
      prev: null,
      next: null,
    });
  });

  it('ANATOMY-ORDER-RT-0300: embedded family declarations allow parts to claim before root setup', () => {
    const family = createAnatomyFamily('rt-anatomy-embedded-family', {
      roles: {
        root: { cardinality: { min: 1, max: 1 } },
        item: { cardinality: { min: 0, max: 10 } },
      },
      relations: [{ kind: 'contains', parent: 'root', child: 'item' }],
    });
    const orderMap = new Map<string, number>([
      ['root', 0],
      ['item-a', 1],
    ]);
    const rootTarget = createTarget('root', orderMap);
    const itemTarget = createTarget('item-a', orderMap);
    const parents = new Map<unknown, unknown | null>([
      [rootTarget, null],
      [itemTarget, rootTarget],
    ]);

    let beforeRoot: readonly unknown[] | null = [];
    let afterRoot: readonly unknown[] = [];

    const Root = definePrototype({
      name: 'x-rt-anatomy-embedded-root',
      setup(def) {
        def.anatomy.claim(family, { role: 'root' });
      },
    });

    const Item = definePrototype({
      name: 'x-rt-anatomy-embedded-item',
      setup(def) {
        def.anatomy.claim(family, { role: 'item' });
        def.expose.value('id' as any, 'a');
        def.lifecycle.onUpdated((run) => {
          const parts = (run.anatomy.order as any).partsOf(family, 'item', { missing: 'null' });
          if (parts === null) {
            beforeRoot = null;
            return;
          }
          afterRoot = parts.map((part: any) => part.getExpose('id'));
        });
      },
    });

    const getPrototype = (instance: unknown) => {
      if (instance === rootTarget) return Root;
      if (instance === itemTarget) return Item;
      return null;
    };

    const rootCtx = createHost({
      instance: rootTarget,
      getParent: (instance) => parents.get(instance) ?? null,
      getPrototype,
    });
    const itemCtx = createHost({
      instance: itemTarget,
      getParent: (instance) => parents.get(instance) ?? null,
      getPrototype,
    });

    const itemExec = executeWithHost(Item as any, itemCtx.host as any);
    itemExec.controller.update();
    expect(beforeRoot).toBeNull();

    const rootExec = executeWithHost(Root as any, rootCtx.host as any);
    rootExec.controller.update();
    itemExec.controller.update();

    expect(afterRoot).toEqual(['a']);
  });

  it('ANATOMY-ORDER-RT-0400: captured run may query anatomy order outside callback during runtime', () => {
    const family = createAnatomyFamily('rt-anatomy-order-runtime-read', {
      roles: {
        root: { cardinality: { min: 1, max: 1 } },
        item: { cardinality: { min: 0, max: 10 } },
      },
    });
    const orderMap = new Map<string, number>([
      ['root', 0],
      ['item-a', 1],
      ['item-b', 2],
    ]);
    const rootTarget = createTarget('root', orderMap);
    const itemATarget = createTarget('item-a', orderMap);
    const itemBTarget = createTarget('item-b', orderMap);
    const parents = new Map<unknown, unknown | null>([
      [rootTarget, null],
      [itemATarget, rootTarget],
      [itemBTarget, rootTarget],
    ]);

    let readOrderedIds: (() => unknown[]) | null = null;

    const Root = definePrototype({
      name: 'x-rt-anatomy-order-runtime-read-root',
      setup(def) {
        def.anatomy.claim(family, { role: 'root' });
        def.lifecycle.onCreated((run) => {
          const orderAny = run.anatomy.order as any;
          readOrderedIds = () =>
            orderAny
              .partsOf(family, 'item', { missing: 'empty' })
              .map((part: any) => part.getExpose('id'));
        });
      },
    });

    const createItem = (name: string, id: string) =>
      definePrototype({
        name,
        setup(def) {
          def.anatomy.claim(family, { role: 'item' });
          def.expose.value('id' as any, id);
        },
      });

    const ItemA = createItem('x-rt-anatomy-order-runtime-read-item-a', 'a');
    const ItemB = createItem('x-rt-anatomy-order-runtime-read-item-b', 'b');

    const getPrototype = (instance: unknown) => {
      if (instance === rootTarget) return Root;
      if (instance === itemATarget) return ItemA;
      if (instance === itemBTarget) return ItemB;
      return null;
    };

    const rootCtx = createHost({
      instance: rootTarget,
      getParent: (instance) => parents.get(instance) ?? null,
      getPrototype,
    });
    const itemACtx = createHost({
      instance: itemATarget,
      getParent: (instance) => parents.get(instance) ?? null,
      getPrototype,
    });
    const itemBCtx = createHost({
      instance: itemBTarget,
      getParent: (instance) => parents.get(instance) ?? null,
      getPrototype,
    });

    const rootExec = executeWithHost(Root as any, rootCtx.host as any);
    executeWithHost(ItemA as any, itemACtx.host as any);
    executeWithHost(ItemB as any, itemBCtx.host as any);

    rootExec.controller.update();

    expect(readOrderedIds).not.toBeNull();
    if (!readOrderedIds) {
      throw new Error('expected readOrderedIds to be initialized');
    }
    const read = readOrderedIds as unknown as () => unknown[];
    expect(() => read()).not.toThrow();
    expect(read()).toEqual(['a', 'b']);
  });

  it.each([
    { name: 'normal undefined return', throws: false, value: undefined },
    { name: 'throw undefined', throws: true, value: undefined },
    { name: 'throw null', throws: true, value: null },
    { name: 'throw false', throws: true, value: false },
    { name: 'throw zero', throws: true, value: 0 },
    { name: 'throw empty string', throws: true, value: '' },
    { name: 'throw Error', throws: true, value: new Error('part method failure') },
  ])('projects a PartView method outcome: $name', async ({ throws, value }) => {
    const family = createAnatomyFamily('rt-part-view-method-outcome', {
      roles: {
        root: { cardinality: { min: 1, max: 1 } },
        item: { cardinality: { min: 0, max: 1 } },
      },
    });
    const orderMap = new Map([
      ['root', 0],
      ['item', 1],
    ]);
    const rootTarget = createTarget('root', orderMap);
    const itemTarget = createTarget('item', orderMap);
    const parents = new Map<unknown, unknown | null>([
      [rootTarget, null],
      [itemTarget, rootTarget],
    ]);
    let invokePart: (() => unknown) | undefined;
    let calls = 0;
    const Root = definePrototype({
      name: 'x-part-view-outcome-root',
      setup(def) {
        def.anatomy.claim(family, { role: 'root' });
        def.lifecycle.onCreated((run) => {
          invokePart = () => {
            const method = run.anatomy.partsOf(family, 'item')?.[0]?.getExpose('invoke');
            if (typeof method !== 'function') throw new Error('missing exposed part method');
            return method();
          };
        });
      },
    });
    const Item = definePrototype({
      name: 'x-part-view-outcome-item',
      setup(def) {
        def.anatomy.claim(family, { role: 'item' });
        const visited = def.state.bool('visited', false);
        def.expose.method('invoke', () => {
          calls += 1;
          visited.set(true);
          if (throws) throw value;
          return value;
        });
      },
    });
    const getPrototype = (instance: unknown) =>
      instance === rootTarget ? Root : instance === itemTarget ? Item : null;
    const makeHost = (instance: Target) =>
      createHost({
        instance,
        getParent: (candidate) => parents.get(candidate) ?? null,
        getPrototype,
      }).host;
    const root = executeWithHost(Root as any, makeHost(rootTarget));
    const item = executeWithHost(Item as any, makeHost(itemTarget));
    try {
      expect(invokePart).toBeDefined();
      let caught = false;
      let outcome: unknown;
      try {
        outcome = invokePart!();
      } catch (error) {
        caught = true;
        outcome = error;
      }
      expect(calls).toBe(1);
      expect(caught).toBe(throws);
      expect(outcome).toBe(value);
    } finally {
      await item.invokeUnmounted();
      await root.invokeUnmounted();
    }
  });

  /** T-ANATOMY-ORDER-0001-CASE-PARTS-SUBSCRIPTION */
  it('ANATOMY-ORDER-RT-0500: def.anatomy.subscribeParts reports live role membership changes', async () => {
    const family = createAnatomyFamily('rt-anatomy-parts-subscription', {
      roles: {
        root: { cardinality: { min: 1, max: 1 } },
        item: { cardinality: { min: 0, max: 10 } },
        other: { cardinality: { min: 0, max: 10 } },
      },
    });
    const orderMap = new Map<string, number>([
      ['root', 0],
      ['item', 1],
      ['other', 2],
    ]);
    const rootTarget = createTarget('root', orderMap);
    const itemTarget = createTarget('item', orderMap);
    const otherTarget = createTarget('other', orderMap);
    const parents = new Map<unknown, unknown | null>([
      [rootTarget, null],
      [itemTarget, rootTarget],
      [otherTarget, rootTarget],
    ]);

    let notifyOrder: (() => void) | null = null;
    const seen: unknown[][] = [];
    const Root = definePrototype({
      name: 'x-rt-anatomy-parts-subscription-root',
      setup(def) {
        def.anatomy.claim(family, { role: 'root' });
        def.anatomy.subscribeParts(family, 'item', (_run, parts) => {
          seen.push(parts.map((part) => part.getExpose('id')));
        });
      },
    });
    const Item = definePrototype({
      name: 'x-rt-anatomy-parts-subscription-item',
      setup(def) {
        def.anatomy.claim(family, { role: 'item' });
        def.expose.value('id' as any, 'item');
      },
    });
    const Other = definePrototype({
      name: 'x-rt-anatomy-parts-subscription-other',
      setup(def) {
        def.anatomy.claim(family, { role: 'other' });
      },
    });
    const getPrototype = (instance: unknown) => {
      if (instance === rootTarget) return Root;
      if (instance === itemTarget) return Item;
      if (instance === otherTarget) return Other;
      return null;
    };

    executeWithHost(
      Root as any,
      createHost({
        instance: rootTarget,
        getParent: (instance) => parents.get(instance) ?? null,
        getPrototype,
        observeOrder: (_target, notify) => {
          notifyOrder = notify;
          return () => {
            notifyOrder = null;
          };
        },
      }).host as any
    );
    executeWithHost(
      Other as any,
      createHost({
        instance: otherTarget,
        getParent: (instance) => parents.get(instance) ?? null,
        getPrototype,
      }).host as any
    );
    expect(notifyOrder).not.toBeNull();
    const notify = notifyOrder as unknown as () => void;
    notify();
    expect(seen).toEqual([]);

    const itemExec = executeWithHost(
      Item as any,
      createHost({
        instance: itemTarget,
        getParent: (instance) => parents.get(instance) ?? null,
        getPrototype,
      }).host as any
    );

    expect(seen).toEqual([['item']]);
    notify();
    expect(seen).toEqual([['item']]);
    notify();
    expect(seen).toHaveLength(1);

    await itemExec.invokeUnmounted();
    expect(seen).toEqual([['item'], []]);
    notify();
    expect(seen).toEqual([['item'], []]);
  });
});

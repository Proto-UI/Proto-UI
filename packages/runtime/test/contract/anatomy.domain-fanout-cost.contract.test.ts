import { afterEach, describe, expect, it } from 'vitest';
import {
  createAnatomyFamily,
  definePrototype,
  type Prototype,
  type RunHandle,
} from '@proto.ui/core';
import {
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_ORDER_OBSERVER_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_ROOT_TARGET_CAP,
  type AnatomyParentGetter,
  type AnatomyPort,
  type AnatomyRootTarget,
} from '@proto.ui/module-anatomy';
import { executeWithHost, type RuntimeHost } from '../../src';

type Owner = { id: string };
type Execution = ReturnType<typeof executeWithHost>;

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

/** Real Runtime sessions with instrumented private logical-parent capabilities, not elapsed-time assertions. */
function createDomain(subscriberCount: number, itemCount = 12) {
  const family = createAnatomyFamily('runtime-domain-fanout-cost', {
    roles: {
      root: { cardinality: { min: 1, max: 1 } },
      item: { cardinality: { min: 0, max: '*' } },
    },
  });
  const root: Owner = { id: 'root' };
  const element = document.createElement('div');
  document.body.append(element);
  const targets = new Map<Owner, HTMLElement>([[root, element]]);
  const parents = new Map<Owner, Owner | null>([[root, null]]);
  const prototypes = new Map<Owner, Prototype<any>>();
  const executions = new Map<Owner, Execution>();
  const notifications = new Map<Owner, string[][]>();
  const handlers = new Map<Owner, (run: RunHandle<any>, ids: string[]) => void>();
  const metadata = new Map<Owner, { label: string }>();
  const observers = new Map<object, () => void>();
  let parentReads = 0;
  // The actual private bridge identity is shared, as in one adapter platform.
  const getParent = (instance: unknown) => {
    parentReads++;
    return parents.get(instance as Owner) ?? null;
  };

  const mount = (
    owner: Owner,
    role: 'root' | 'item',
    subscribe: boolean,
    parentGetter: AnatomyParentGetter = getParent
  ) => {
    notifications.set(owner, []);
    metadata.set(owner, { label: owner.id });
    const proto = definePrototype({
      name: `test-anatomy-domain-fanout-${owner.id}`,
      setup(def) {
        def.anatomy.claim(family, { role });
        def.expose.value('id' as any, owner.id);
        def.expose.value('metadata' as any, metadata.get(owner));
        if (subscribe) {
          def.anatomy.subscribeParts(family, 'item', (run, parts) => {
            const ids = parts.map((part) => part.getExpose('id') as string);
            notifications.get(owner)!.push(ids);
            handlers.get(owner)?.(run, ids);
          });
        }
      },
    });
    prototypes.set(owner, proto);
    const host: RuntimeHost<any> = {
      prototypeName: proto.name,
      getRawProps: () => ({}),
      commit(_children, signal) {
        signal?.done();
      },
      schedule(task) {
        task();
      },
      onRuntimeReady(wiring) {
        wiring.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, owner],
          [ANATOMY_PARENT_CAP, parentGetter],
          [ANATOMY_GET_PROTO_CAP, (instance: unknown) => prototypes.get(instance as Owner) ?? null],
          [ANATOMY_ROOT_TARGET_CAP, (instance: unknown) => targets.get(instance as Owner) ?? null],
          [
            ANATOMY_ORDER_OBSERVER_CAP,
            (target: AnatomyRootTarget, notify: () => void) => {
              observers.set(target, notify);
              return () => {
                observers.delete(target);
              };
            },
          ],
        ]);
      },
    };
    const execution = executeWithHost(proto, host);
    executions.set(owner, execution);
    return execution;
  };

  const rootExecution = mount(root, 'root', false);
  const add = (
    id: string,
    role: 'root' | 'item',
    parent = root,
    subscribe = false,
    physicalParent = targets.get(parent)!,
    parentGetter: AnatomyParentGetter = getParent
  ) => {
    const owner: Owner = { id };
    const target = document.createElement(role === 'root' ? 'div' : 'span');
    physicalParent.append(target);
    targets.set(owner, target);
    parents.set(owner, parent);
    mount(owner, role, subscribe, parentGetter);
    return owner;
  };
  const items = Array.from({ length: itemCount }, (_, index) =>
    add(`item-${index}`, 'item', root, index < subscriberCount)
  );

  const reset = () => {
    parentReads = 0;
    for (const rows of notifications.values()) rows.length = 0;
  };
  cleanups.push(async () => {
    handlers.clear();
    for (const execution of [...executions.values()].reverse()) await execution.invokeUnmounted();
    for (const target of targets.values()) target.remove();
  });
  const registrationNotifications = new Map(
    [...notifications].map(([owner, rows]) => [owner, [...rows]])
  );
  reset();
  return {
    root,
    family,
    element,
    items,
    targets,
    parents,
    metadata,
    handlers,
    executions,
    notifications,
    registrationNotifications,
    add,
    query: (owner = root) =>
      executions
        .get(owner)!
        .kernel!.run.anatomy.order.partsOf(family, 'item')!
        .map((part) => part.getExpose('id') as string),
    version: (owner = root) => executions.get(owner)!.kernel!.run.anatomy.order.version(family),
    parentReads: () => parentReads,
    reset,
    sync: () => rootExecution.caps.getPort<AnatomyPort>('anatomy')!.syncStructure(),
    notify: (owner = root) => {
      const notify = observers.get(targets.get(owner)!);
      expect(notify).toBeTypeOf('function');
      notify!();
    },
  };
}

describe('Runtime Anatomy synchronous domain fanout cost', () => {
  for (const source of ['sync', 'notify'] as const) {
    it(`${source}: unchanged subscribers sharing a parent bridge do not repeat the whole domain scan`, () => {
      const single = createDomain(1);
      single[source]();
      const oneReaderParentReads = single.parentReads();
      expect(oneReaderParentReads).toBeGreaterThan(0);

      const many = createDomain(12);
      many[source]();
      expect([...many.notifications.values()].flat()).toEqual([]);
      // Each recipient must still resolve its own current root. The allowance
      // leaves room for those live reads without multiplying every claim scan.
      expect(
        many.parentReads(),
        `one-reader baseline: ${oneReaderParentReads}`
      ).toBeLessThanOrEqual(oneReaderParentReads * 3);
    });
  }

  for (const source of ['sync', 'notify'] as const) {
    it(`${source}: different parent bridges remain isolated even with the same family and root token`, () => {
      const domain = createDomain(1, 3);
      let excluded: Owner | null = null;
      const alternateParent: AnatomyParentGetter = (instance) =>
        instance === excluded ? null : (domain.parents.get(instance as Owner) ?? null);
      const alternate = domain.add(
        'alternate-reader',
        'item',
        domain.root,
        true,
        domain.element,
        alternateParent
      );
      domain.reset();

      // The first recipient sees no change. Only the second bridge's current
      // tree loses a member, so sharing an index merely by root would miss it.
      excluded = domain.items[2]!;
      domain[source]();
      expect(domain.notifications.get(domain.items[0]!)).toEqual([]);
      expect(domain.notifications.get(alternate)).toEqual([
        ['item-0', 'item-1', 'alternate-reader'],
      ]);
      expect(domain.query()).toEqual(['item-0', 'item-1', 'item-2', 'alternate-reader']);
      expect(domain.query(alternate)).toEqual(['item-0', 'item-1', 'alternate-reader']);
    });

    it(`${source}: callback reparenting is visible to immediate public queries and later recipients`, () => {
      const domain = createDomain(3, 3);
      const [first, second, third] = domain.items;
      const inner = domain.add('inner-root', 'root');
      domain.add('inner-item', 'item', inner);
      domain.reset();
      let before: string[] = [];
      let after: string[] = [];
      domain.handlers.set(first!, (run) => {
        domain.handlers.delete(first!);
        before = run.anatomy.order
          .partsOf(domain.family, 'item')!
          .map((part) => part.getExpose('id') as string);
        domain.parents.set(third!, inner);
        domain.targets.get(inner)!.append(domain.targets.get(third!)!);
        after = run.anatomy.order
          .partsOf(domain.family, 'item')!
          .map((part) => part.getExpose('id') as string);
      });

      domain.element.prepend(domain.targets.get(second!)!);
      domain[source]();
      expect(before).toEqual(['item-1', 'item-0', 'item-2']);
      expect(after).toEqual(['item-1', 'item-0']);
      expect(domain.notifications.get(first!)).toEqual([before]);
      expect(domain.notifications.get(second!)).toEqual([after]);
      expect(domain.notifications.get(third!)).toEqual([['inner-item', 'item-2']]);
      expect(domain.query()).toEqual(after);
      expect(domain.query(third!)).toEqual(['inner-item', 'item-2']);
    });

    it(`${source}: nested notification uses the new parent domain without an old outer replay`, () => {
      const domain = createDomain(3, 3);
      const [first, second, third] = domain.items;
      const inner = domain.add('inner-root', 'root');
      domain.add('inner-item', 'item', inner);
      domain.reset();
      domain.handlers.set(first!, () => {
        domain.handlers.delete(first!);
        domain.parents.set(third!, inner);
        domain.targets.get(inner)!.append(domain.targets.get(third!)!);
        domain[source]();
      });

      domain.element.prepend(domain.targets.get(second!)!);
      domain[source]();
      expect(domain.notifications.get(first!)).toEqual([
        ['item-1', 'item-0', 'item-2'],
        ['item-1', 'item-0'],
      ]);
      expect(domain.notifications.get(second!)).toEqual([['item-1', 'item-0']]);
      expect(domain.notifications.get(third!)).toEqual([['inner-item', 'item-2']]);
      domain[source]();
      expect(domain.notifications.get(second!)).toHaveLength(1);
      expect(domain.notifications.get(third!)).toHaveLength(1);
    });
  }

  it('a callback can mount a new logical member outside the physical root without a stale domain index', () => {
    const domain = createDomain(3, 3);
    const [first, second] = domain.items;
    domain.handlers.set(first!, () => {
      domain.handlers.delete(first!);
      domain.add('portal-item', 'item', domain.root, false, document.body);
    });
    domain.element.prepend(domain.targets.get(second!)!);
    domain.notify();
    expect(domain.notifications.get(second!)!.at(-1)).toEqual([
      'item-1',
      'item-0',
      'item-2',
      'portal-item',
    ]);
    expect(domain.query()).toEqual(['item-1', 'item-0', 'item-2', 'portal-item']);
  });

  it('a callback can retire a later recipient without publishing its old membership', async () => {
    const domain = createDomain(3, 3);
    const [first, second, third] = domain.items;
    let disposal: void | Promise<void> = undefined;
    domain.handlers.set(first!, () => {
      domain.handlers.delete(first!);
      disposal = domain.executions.get(third!)!.invokeUnmounted();
    });
    domain.element.prepend(domain.targets.get(second!)!);
    domain.notify();
    expect(domain.query()).toEqual(['item-1', 'item-0']);
    expect(domain.notifications.get(second!)).toEqual([['item-1', 'item-0']]);
    expect(domain.notifications.get(third!)).toEqual([]);
    await disposal;
  });

  it('one shared parent bridge keeps nested roots and retired boundaries independent until real adoption', async () => {
    const domain = createDomain(2, 2);
    const inner = domain.add('inner-root', 'root');
    const a = domain.add('inner-a', 'item', inner, true);
    const b = domain.add('inner-b', 'item', inner, true);
    domain.reset();
    domain.targets.get(inner)!.prepend(domain.targets.get(b)!);
    domain.sync();
    expect(domain.notifications.get(domain.items[0]!)).toEqual([]);
    expect(domain.query()).toEqual(['item-0', 'item-1']);
    expect(domain.notifications.get(a)).toEqual([['inner-b', 'inner-a']]);

    const retiring = domain.executions.get(inner)!.invokeUnmounted();
    expect(domain.query()).toEqual(['item-0', 'item-1']);
    expect(domain.notifications.get(a)!.at(-1)).toEqual([]);
    expect(() => domain.query(a)).toThrow();
    domain.parents.set(a, domain.root);
    domain.element.append(domain.targets.get(a)!);
    domain.sync();
    expect(domain.query()).toEqual(['item-0', 'item-1', 'inner-a']);
    expect(domain.notifications.get(b)!.at(-1)).toEqual([]);
    await retiring;
  });
});

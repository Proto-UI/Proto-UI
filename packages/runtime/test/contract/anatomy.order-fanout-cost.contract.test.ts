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

/** Real Runtime sessions with instrumented DOM order capabilities, not elapsed-time assertions. */
function createDomain(subscriberCount: number, itemCount = 12, shareBridge = false) {
  const family = createAnatomyFamily('runtime-order-fanout-cost', {
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
  const parentReads = new Map<Owner, number>();
  const getParent = (instance: unknown) => {
    const owner = instance as Owner;
    parentReads.set(owner, (parentReads.get(owner) ?? 0) + 1);
    return parents.get(owner) ?? null;
  };
  const prototypes = new Map<Owner, Prototype<any>>();
  const executions = new Map<Owner, Execution>();
  const notifications = new Map<Owner, string[][]>();
  const handlers = new Map<Owner, (run: RunHandle<any>, ids: string[]) => void>();
  const metadata = new Map<Owner, { label: string }>();
  const observers = new Map<object, () => void>();
  const unreadyTargets = new Set<Owner>();
  const observerRegistration = new Map<object, () => void>();
  let comparisons = 0;

  const instrument = (target: HTMLElement) => {
    const compare = target.compareDocumentPosition.bind(target);
    target.compareDocumentPosition = (other: Node) => {
      comparisons++;
      return compare(other);
    };
  };
  instrument(element);

  const mount = (owner: Owner, role: 'root' | 'item', subscribe: boolean) => {
    notifications.set(owner, []);
    metadata.set(owner, { label: owner.id });
    const proto = definePrototype({
      name: `test-anatomy-fanout-${owner.id}`,
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
          [
            ANATOMY_PARENT_CAP,
            shareBridge ? getParent : (instance: unknown) => getParent(instance),
          ],
          [ANATOMY_GET_PROTO_CAP, (instance: unknown) => prototypes.get(instance as Owner) ?? null],
          [
            ANATOMY_ROOT_TARGET_CAP,
            (instance: unknown) => {
              const owner = instance as Owner;
              return unreadyTargets.has(owner) ? null : (targets.get(owner) ?? null);
            },
          ],
          [
            ANATOMY_ORDER_OBSERVER_CAP,
            (target: AnatomyRootTarget, notify: () => void) => {
              observers.set(target, notify);
              observerRegistration.get(target)?.();
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
    physicalParent = targets.get(parent)!
  ) => {
    const owner: Owner = { id };
    const target = document.createElement(role === 'root' ? 'div' : 'span');
    instrument(target);
    physicalParent.append(target);
    targets.set(owner, target);
    parents.set(owner, parent);
    mount(owner, role, subscribe);
    return owner;
  };
  const items = Array.from({ length: itemCount }, (_, index) =>
    add(`item-${index}`, 'item', root, index < subscriberCount)
  );

  const reset = () => {
    comparisons = 0;
    parentReads.clear();
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
    parentReads,
    unreadyTargets,
    observerRegistration,
    metadata,
    handlers,
    executions,
    notifications,
    registrationNotifications,
    add,
    instrument,
    query: (owner = root) =>
      executions
        .get(owner)!
        .kernel!.run.anatomy.order.partsOf(family, 'item')!
        .map((part) => part.getExpose('id') as string),
    version: (owner = root) => executions.get(owner)!.kernel!.run.anatomy.order.version(family),
    comparisons: () => comparisons,
    reset,
    sync: () => rootExecution.caps.getPort<AnatomyPort>('anatomy')!.syncStructure(),
    notify: (owner = root) => {
      const notify = observers.get(targets.get(owner)!);
      expect(notify).toBeTypeOf('function');
      notify!();
    },
  };
}

describe('Runtime Anatomy synchronous order fanout cost', () => {
  for (const source of ['sync', 'notify'] as const) {
    it(`${source}: unchanged subscribers do not multiply host order comparisons`, () => {
      const single = createDomain(1);
      single[source]();
      const singleReaderComparisons = single.comparisons();
      expect(singleReaderComparisons).toBeGreaterThan(0);

      const many = createDomain(12);
      many[source]();
      expect([...many.notifications.values()].flat()).toEqual([]);
      expect(many.comparisons()).toBeLessThanOrEqual(singleReaderComparisons * 2);
    });
  }

  for (const source of ['sync', 'notify'] as const) {
    it(`${source}: reads shared logical ancestors once in a stable notification`, () => {
      const domain = createDomain(12, 12, true);
      const bridge: Owner = { id: 'bridge' };
      domain.parents.set(bridge, domain.root);
      for (const item of domain.items) domain.parents.set(item, bridge);

      domain[source]();

      expect(domain.parentReads.get(bridge)).toBe(1);
      expect([...domain.notifications.values()].flat()).toEqual([]);
    });
  }

  it('reads a later subscriber in the new domain after a synchronous author callback', () => {
    const domain = createDomain(3, 3, true);
    const [first, second, later] = domain.items;
    const inner = domain.add('inner-root', 'root');
    domain.add('inner-item', 'item', inner);
    domain.reset();
    let callbackQuery: string[] = [];
    domain.handlers.set(first!, () => {
      domain.handlers.delete(first!);
      domain.parents.set(later!, inner);
      domain.targets.get(inner)!.append(domain.targets.get(later!)!);
      callbackQuery = domain.query(later!);
    });

    domain.element.prepend(domain.targets.get(second!)!);
    domain.sync();

    expect(callbackQuery).toEqual(['inner-item', 'item-2']);
    expect(domain.notifications.get(later!)).toEqual([callbackQuery]);
  });

  it('rebuilds domain reads when attaching a host observer moves a later subscriber', () => {
    const domain = createDomain(0, 0, true);
    const inner = domain.add('inner-root', 'root');
    const innerTarget = domain.targets.get(inner)!;
    domain.unreadyTargets.add(inner);
    const innerReader = domain.add('inner-reader', 'item', inner, true);
    const later = domain.add('later', 'item', domain.root, true);
    domain.unreadyTargets.delete(inner);
    domain.observerRegistration.set(innerTarget, () => {
      domain.observerRegistration.delete(innerTarget);
      domain.parents.set(later, inner);
      innerTarget.append(domain.targets.get(later)!);
    });
    domain.reset();

    domain.sync();

    expect(domain.notifications.get(innerReader)).toEqual([]);
    expect(domain.notifications.get(later)).toEqual([['inner-reader', 'later']]);
    const version = domain.version(later);
    domain.sync();
    expect(domain.version(later)).toBe(version);
  });

  it('keeps registration and business-only changes silent', () => {
    const domain = createDomain(1, 1);
    const item = domain.items[0]!;
    expect(domain.registrationNotifications.get(item)).toEqual([]);
    expect(domain.notifications.get(item)).toEqual([]);
    const version = domain.version(item);
    domain.metadata.get(item)!.label = 'updated without changing membership or order';
    domain.executions.get(item)!.controller.applyRawProps({ label: 'changed' });
    domain.sync();
    domain.notify();
    expect(domain.notifications.get(item)).toEqual([]);
    expect(domain.version(item)).toBe(version);
    const part = domain.executions
      .get(item)!
      .kernel!.run.anatomy.partsOf(domain.family, 'item')![0]!;
    expect(part.getExpose('metadata')).toEqual({
      label: 'updated without changing membership or order',
    });
  });

  for (const source of ['sync', 'notify'] as const) {
    it(`${source}: a public subscriber can reorder DOM before later recipients and query immediately`, () => {
      const domain = createDomain(3, 3);
      const [first, second, third] = domain.items;
      let readBeforeReorder: string[] = [];
      let readInsideCallback: string[] = [];
      domain.handlers.set(first!, (run) => {
        domain.handlers.delete(first!);
        readBeforeReorder = run.anatomy.order
          .partsOf(domain.family, 'item')!
          .map((part) => part.getExpose('id') as string);
        domain.element.prepend(domain.targets.get(third!)!);
        readInsideCallback = run.anatomy.order
          .partsOf(domain.family, 'item')!
          .map((part) => part.getExpose('id') as string);
      });
      domain.element.prepend(domain.targets.get(second!)!);
      domain[source]();
      expect(domain.notifications.get(first!)).toEqual([['item-1', 'item-0', 'item-2']]);
      expect(readBeforeReorder).toEqual(['item-1', 'item-0', 'item-2']);
      expect(readInsideCallback).toEqual(['item-2', 'item-1', 'item-0']);
      expect(domain.notifications.get(second!)).toEqual([readInsideCallback]);
      expect(domain.notifications.get(third!)).toEqual([readInsideCallback]);
      expect(domain.query()).toEqual(readInsideCallback);
    });

    it(`${source}: nested notification publishes the newest order without an old outer replay`, () => {
      const domain = createDomain(3, 3);
      const [first, second, third] = domain.items;
      domain.handlers.set(first!, () => {
        domain.handlers.delete(first!);
        domain.element.prepend(domain.targets.get(third!)!);
        domain[source]();
      });
      domain.element.prepend(domain.targets.get(second!)!);
      domain[source]();
      expect(domain.notifications.get(first!)).toEqual([
        ['item-1', 'item-0', 'item-2'],
        ['item-2', 'item-1', 'item-0'],
      ]);
      expect(domain.notifications.get(second!)).toEqual([['item-2', 'item-1', 'item-0']]);
      expect(domain.notifications.get(third!)).toEqual([['item-2', 'item-1', 'item-0']]);
      domain[source]();
      expect(domain.notifications.get(second!)).toHaveLength(1);
    });
  }

  it('a synchronous subscriber can mount a new logical member outside the root DOM subtree', () => {
    const domain = createDomain(3, 3);
    const [first, second] = domain.items;
    domain.handlers.set(first!, () => {
      domain.handlers.delete(first!);
      domain.add('new-item', 'item', domain.root, false, document.body);
    });
    domain.element.prepend(domain.targets.get(second!)!);
    domain.notify();
    expect(domain.notifications.get(second!)!.at(-1)).toEqual([
      'item-1',
      'item-0',
      'item-2',
      'new-item',
    ]);
    expect(domain.query()).toEqual(['item-1', 'item-0', 'item-2', 'new-item']);
  });

  it('a synchronous subscriber can retire a later recipient without stale membership or callbacks', async () => {
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

  it('replaced targets of surviving logical owners are read afresh within the same fanout', () => {
    const domain = createDomain(3, 3);
    const [first, second, third] = domain.items;
    domain.handlers.set(first!, () => {
      domain.handlers.delete(first!);
      const replacement = document.createElement('span');
      domain.instrument(replacement);
      domain.targets.get(third!)!.remove();
      domain.targets.set(third!, replacement);
      domain.element.prepend(replacement);
    });
    domain.element.prepend(domain.targets.get(second!)!);
    domain.notify();
    expect(domain.notifications.get(second!)).toEqual([['item-2', 'item-1', 'item-0']]);
    expect(domain.notifications.get(third!)).toEqual([['item-2', 'item-1', 'item-0']]);
  });

  it('nested roots keep independent order and a retired inner root cannot leak children outward', async () => {
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
    expect(domain.query(a)).toEqual(['inner-b', 'inner-a']);

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

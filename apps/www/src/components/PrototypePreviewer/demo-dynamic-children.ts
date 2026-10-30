import {
  assertDemoSpec,
  type DemoChild,
  type DemoNode,
  type DemoSpec,
  type DemoKeyedChild,
} from './demo-types';

export type { DemoKeyedChild } from './demo-types';
export type DynamicChildEntry = Readonly<{
  key: string;
  node: DemoChild;
  /** Model-local lifetime identity, not a DOM id or a public prototype ref. */
  identity: number;
}>;
export type DynamicChildrenStatus = 'pending' | 'committed' | 'superseded' | 'disposed';
export type DynamicChildrenTransaction = Readonly<{
  slotRef: string;
  revision: number;
  entries: readonly DynamicChildEntry[];
  /** Renderer must retire these identities and all resources they own. */
  retired: readonly DynamicChildEntry[];
  status(): DynamicChildrenStatus;
  /** Check immediately before publishing any host/ref changes. */
  isCurrent(): boolean;
  /** Release an uncommitted update after host preparation fails; caller rolls back host work. */
  cancel(): void;
  /** Acknowledge only after host/ref commit; this does not await Proto readiness. */
  commit(): Exclude<DynamicChildrenStatus, 'pending'>;
}>;

type Declaration = { prototypeIds: readonly string[] };
type Slot = {
  allowed: Set<string>;
  revision: number;
  entries: readonly DynamicChildEntry[];
  refs: Set<string>;
  pending?: { refs: Set<string>; status: DynamicChildrenStatus };
};

function fail(message: string): never {
  throw new Error(`[PrototypePreviewer] dynamic children: ${message}`);
}

/** Copy first, then validate/freeze: neither caller mutation nor published objects own state. */
export function snapshotDemoValue<T>(input: T): T {
  const ancestors = new Set<object>();
  const copy = (value: unknown): unknown => {
    // Existing DemoNode optional fields may explicitly be undefined. The shared
    // validator still rejects undefined inside authored props/children where invalid.
    if (
      value === undefined ||
      value === null ||
      typeof value === 'string' ||
      typeof value === 'boolean'
    )
      return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'object' || value === null) fail('nodes must be finite JSON-like data');
    if (ancestors.has(value)) fail('cyclic node data');
    if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype)
      fail('node objects must be plain objects');
    if (Object.getOwnPropertySymbols(value).length) fail('symbol keys are not supported');
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
      if (!('value' in descriptor)) fail('accessor properties are not supported');
    }
    ancestors.add(value);
    let result: unknown;
    if (Array.isArray(value)) {
      // Array holes are not valid authored child/prop values.
      result = Array.from(value, (entry) => copy(entry));
    } else {
      const entries = Object.entries(Object.getOwnPropertyDescriptors(value));
      result = Object.fromEntries(
        entries.map(([key, descriptor]) => {
          if (!('value' in descriptor)) fail('accessor properties are not supported');
          return [key, copy(descriptor.value)];
        })
      );
    }
    ancestors.delete(value);
    return Object.freeze(result);
  };
  return copy(input) as T;
}

function declaration(node: DemoNode): unknown {
  return (node as unknown as { dynamicChildren?: unknown }).dynamicChildren;
}
function visit(node: DemoChild, inspect: (node: DemoNode) => void): void {
  if (typeof node === 'string') return;
  inspect(node);
  if (node.kind !== 'text') for (const child of node.children ?? []) visit(child, inspect);
}
function addRef(refs: Set<string>, node: DemoNode): void {
  if (node.kind === 'text' || node.ref === undefined) return;
  if (!node.ref.trim()) fail('refs must be nonempty');
  if (refs.has(node.ref)) fail(`duplicate ref "${node.ref}"`);
  refs.add(node.ref);
}
function discriminator(node: DemoChild): string {
  if (typeof node === 'string') return 'string';
  if (node.kind === 'text') return 'text';
  return node.kind === 'box'
    ? `box:${node.tag ?? 'div'}`
    : `proto:${node.prototypeId}:${node.rootTag ?? 'div'}`;
}

function sameRetainedShape(previous: DemoChild, next: DemoChild): boolean {
  if (discriminator(previous) !== discriminator(next)) return false;
  if (typeof previous === 'string' || typeof next === 'string') return true;
  if (previous.kind === 'text' || next.kind === 'text') return true;
  if (previous.ref !== next.ref) return false;
  const before = previous.children ?? [];
  const after = next.children ?? [];
  return (
    before.length === after.length &&
    before.every((child, index) => sameRetainedShape(child, after[index]!))
  );
}

/**
 * Pure admission/identity/lease model. It never touches host DOM or calls adapters.
 * Keep one model per render; the caller must dispose it with that render.
 */
export function createDynamicChildrenModel(demo: DemoSpec) {
  const root = snapshotDemoValue(demo.root);
  assertDemoSpec({ type: 'demo', root });
  const staticRefs = new Set<string>();
  const prototypeIds = new Set<string>();
  const slots = new Map<string, Slot>();
  visit(root, (node) => {
    addRef(staticRefs, node);
    if (node.kind === 'proto') prototypeIds.add(node.prototypeId);
    const declared = declaration(node);
    if (declared === undefined) return;
    if (node.kind !== 'box' || !node.ref?.trim()) fail('only a ref-bearing box can declare a slot');
    if ((node.children?.length ?? 0) !== 0)
      fail('dynamic slots must initially have empty children');
    if (
      !declared ||
      typeof declared !== 'object' ||
      Array.isArray(declared) ||
      Object.keys(declared).some((key) => key !== 'prototypeIds')
    )
      fail('invalid slot declaration');
    const ids = (declared as Declaration).prototypeIds;
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || !id.trim()))
      fail('prototypeIds must be an array of nonempty strings');
    if (new Set(ids).size !== ids.length) fail('duplicate declared prototypeId');
    const allowed = new Set(ids);
    for (const id of allowed) prototypeIds.add(id);
    slots.set(node.ref, { allowed, revision: 0, entries: Object.freeze([]), refs: new Set() });
  });
  let alive = true;
  let nextIdentity = 0;
  const getSlot = (ref: string): Slot => {
    const slot = slots.get(ref);
    if (!slot) fail(`undeclared slot "${ref}"`);
    return slot;
  };
  const validateWithRefs = (slotRef: string, children: readonly DemoKeyedChild[]) => {
    if (!alive) fail('render is disposed');
    const slot = getSlot(slotRef);
    const incoming = snapshotDemoValue(children);
    if (!Array.isArray(incoming)) fail('children must be an array');
    const committedByKey = new Map(slot.entries.map((entry) => [entry.key, entry.node]));
    const keys = new Set<string>();
    const refs = new Set<string>();
    for (const child of incoming) {
      if (!child || typeof child !== 'object' || typeof child.key !== 'string' || !child.key.trim())
        fail('each direct child requires a nonempty key');
      if (keys.has(child.key)) fail(`duplicate key "${child.key}"`);
      keys.add(child.key);
      // Reuse existing node/props/surface/association validation, without a host mount.
      assertDemoSpec({ type: 'demo', root: { kind: 'box', children: [child.node] } });
      visit(child.node, (node) => {
        if (declaration(node) !== undefined) fail('nested dynamic slots are not supported');
        addRef(refs, node);
        if (node.kind === 'proto' && !slot.allowed.has(node.prototypeId))
          fail(`prototype "${node.prototypeId}" is not declared for slot "${slotRef}"`);
      });
      const previous = committedByKey.get(child.key);
      if (
        previous !== undefined &&
        discriminator(previous) === discriminator(child.node) &&
        !sameRetainedShape(previous, child.node)
      ) {
        fail(`retained key "${child.key}" cannot change subtree shape/ref; use a new key`);
      }
    }
    for (const ref of refs) {
      if (staticRefs.has(ref)) fail(`ref "${ref}" collides with the static tree`);
      for (const [otherRef, other] of slots) {
        if (otherRef === slotRef) continue;
        if (other.refs.has(ref) || other.pending?.refs.has(ref))
          fail(`ref "${ref}" collides with slot "${otherRef}"`);
      }
    }
    return { incoming, refs };
  };
  return Object.freeze({
    /** Includes all declared future prototypes even when every slot is empty. */
    prototypeIds: Object.freeze([...prototypeIds]),
    slotRefs: Object.freeze([...slots.keys()]),
    /** Safe immutable initial tree for consumers that need a stable authored snapshot. */
    root,
    getCommitted(slotRef: string): readonly DynamicChildEntry[] {
      return getSlot(slotRef).entries;
    },
    validate(slotRef: string, children: readonly DemoKeyedChild[]): readonly DemoKeyedChild[] {
      return validateWithRefs(slotRef, children).incoming;
    },
    begin(slotRef: string, children: readonly DemoKeyedChild[]): DynamicChildrenTransaction {
      const { incoming, refs } = validateWithRefs(slotRef, children);
      const slot = getSlot(slotRef);
      // Invalid updates above do not supersede a valid in-flight transaction.
      if (slot.pending) slot.pending.status = 'superseded';
      const pending = { refs, status: 'pending' as DynamicChildrenStatus };
      slot.pending = pending;
      const revision = ++slot.revision;
      const oldByKey = new Map(slot.entries.map((entry) => [entry.key, entry]));
      const entries = Object.freeze(
        incoming.map(({ key, node }) => {
          const previous = oldByKey.get(key);
          const identity =
            previous && discriminator(previous.node) === discriminator(node)
              ? previous.identity
              : ++nextIdentity;
          return Object.freeze({ key, node, identity });
        })
      );
      const retained = new Set(entries.map((entry) => entry.identity));
      const retired = Object.freeze(slot.entries.filter((entry) => !retained.has(entry.identity)));
      const isCurrent = () => alive && slot.pending === pending && pending.status === 'pending';
      return Object.freeze({
        slotRef,
        revision,
        entries,
        retired,
        status: () => pending.status,
        isCurrent,
        cancel() {
          if (!isCurrent()) return;
          pending.status = 'superseded';
          slot.pending = undefined;
        },
        commit() {
          if (!isCurrent()) return pending.status as Exclude<DynamicChildrenStatus, 'pending'>;
          slot.entries = entries;
          slot.refs = refs;
          slot.pending = undefined;
          pending.status = 'committed';
          return 'committed' as const;
        },
      });
    },
    dispose(): void {
      if (!alive) return;
      alive = false;
      for (const slot of slots.values()) {
        if (slot.pending) slot.pending.status = 'disposed';
        slot.pending = undefined;
        slot.entries = Object.freeze([]);
        slot.refs.clear();
      }
    },
  });
}

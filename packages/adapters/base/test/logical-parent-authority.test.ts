import { describe, expect, it } from 'vitest';
import { createInstanceTreeMarkers } from '../src';

function fixture() {
  const tree = createInstanceTreeMarkers('@proto.ui/test/logical-parent-authority');
  const proto = { name: 'generic-owner', setup: () => undefined };
  const token = () => tree.createLogicalInstance(proto);
  const mark = (
    value: ReturnType<typeof token>,
    root: HTMLElement = document.createElement('div'),
    clear = false
  ) => {
    tree.markProtoInstance(root, proto, value, clear);
    return root;
  };
  return { tree, token, mark };
}
const owner = { authority: 'owner' } as const;

describe('adapter-base: authoritative logical parent', () => {
  it('retains an owner without a view instead of choosing the nearest marked physical ancestor', () => {
    const { tree, token, mark } = fixture();
    const physical = token(),
      parent = token(),
      child = token();
    const outer = mark(physical),
      root = document.createElement('div');
    outer.append(root);
    tree.bindLogicalParent(child, parent, owner);
    mark(child, root);
    expect(tree.getLogicalParent(child)).toBe(parent);
    expect(tree.getLogicalRoot(parent)).toBeNull();
    expect(tree.getProtoParent(root)).toBe(outer);
  });
  it.each([null, 'parent'] as const)(
    'does not let late descendant backfill replace owner %s',
    (kind) => {
      const { tree, token, mark } = fixture();
      const parent = kind ? token() : null,
        child = token(),
        physical = token();
      const outer = document.createElement('div'),
        root = document.createElement('div');
      outer.append(root);
      tree.bindLogicalParent(child, parent, owner);
      mark(child, root);
      mark(physical, outer);
      expect(tree.getLogicalParent(child)).toBe(parent);
    }
  );
  it('distinguishes owner null from the old clear-and-physically-rebind path', () => {
    const { tree, token, mark } = fixture();
    const parent = token(),
      explicit = token(),
      derived = token();
    const outer = mark(parent),
      a = document.createElement('div'),
      b = document.createElement('div');
    outer.append(a, b);
    tree.bindLogicalParent(explicit, null, owner);
    tree.bindLogicalParent(derived, null);
    mark(explicit, a, true);
    mark(derived, b, true);
    expect(tree.getLogicalParent(explicit)).toBeNull();
    expect(tree.getLogicalParent(derived)).toBe(parent);
    tree.unbindProtoInstance(derived, b);
    tree.bindLogicalParent(derived, null);
    const fresh = token();
    mark(fresh, b, true);
    expect(tree.getLogicalParent(fresh)).toBe(parent);
  });
  it('preserves owner A/B/null over Portal projection changes and clearMissingParent', () => {
    const { tree, token, mark } = fixture();
    const a = token(),
      b = token(),
      child = token(),
      physical = token();
    const outer = mark(physical),
      root = mark(child);
    for (const parent of [a, b, null]) {
      tree.bindLogicalParent(child, parent, owner);
      tree.setProtoParent(root, outer);
      expect(tree.getLogicalParent(child)).toBe(parent);
      tree.setProtoParent(root, null);
      tree.clearProtoParentProjection(root);
      mark(child, root, true);
      expect(tree.getLogicalParent(child)).toBe(parent);
    }
  });
  it('preserves non-owner Portal inference and late physical parent discovery', () => {
    const { tree, token, mark } = fixture();
    const parent = token(),
      child = token();
    const outer = document.createElement('div'),
      root = document.createElement('div');
    outer.append(root);
    mark(child, root);
    mark(parent, outer);
    expect(tree.getLogicalParent(child)).toBe(parent);
    tree.setProtoParent(root, null);
    expect(tree.getLogicalParent(child)).toBeNull();
    tree.setProtoParent(root, outer);
    expect(tree.getLogicalParent(child)).toBe(parent);
    tree.clearProtoParentProjection(root);
    expect(tree.getLogicalParent(child)).toBe(parent);
  });
  it('retains ownership across view replacement and ignores old-element late cleanup', () => {
    const { tree, token, mark } = fixture();
    const parent = token(),
      child = token(),
      physical = token();
    tree.bindLogicalParent(child, parent, owner);
    const old = mark(child);
    tree.unbindProtoInstance(child, old);
    const outer = mark(physical),
      next = document.createElement('div');
    outer.append(next);
    mark(child, next);
    tree.unbindProtoInstance(child, old);
    tree.clearProtoParentProjection(old);
    tree.setProtoParent(old, null);
    expect(tree.getLogicalRoot(child)).toBe(next);
    expect(tree.getLogicalParent(child)).toBe(parent);
  });
  it('validates Trigger continuity against the effective owner rather than physical ancestry', () => {
    const { tree, token, mark } = fixture();
    const physical = token(),
      occupied = token(),
      parent = token(),
      child = token();
    tree.mergeLogicalTriggerGroup(physical, physical);
    tree.bindLogicalParent(occupied, physical);
    tree.mergeLogicalTriggerGroup(occupied, physical);
    tree.mergeLogicalTriggerGroup(parent, parent);
    tree.bindLogicalParent(child, parent, owner);
    tree.mergeLogicalTriggerGroup(child, parent);
    const outer = mark(physical),
      root = document.createElement('button');
    outer.append(root);
    expect(() => mark(child, root)).not.toThrow();
    expect(tree.getLogicalParent(child)).toBe(parent);
    expect(tree.getLogicalTriggerGroupAnchor(child)).toBe(parent);
  });
  it('rejects an illegal owner branch without leaking authority into later physical fallback', () => {
    const { tree, token, mark } = fixture();
    const occupiedParent = token(),
      occupied = token(),
      oldParent = token(),
      child = token(),
      fallback = token();
    tree.mergeLogicalTriggerGroup(occupiedParent, occupiedParent);
    tree.bindLogicalParent(occupied, occupiedParent);
    tree.mergeLogicalTriggerGroup(occupied, occupiedParent);
    tree.mergeLogicalTriggerGroup(oldParent, oldParent);
    tree.bindLogicalParent(child, oldParent);
    tree.mergeLogicalTriggerGroup(child, oldParent);
    expect(() => tree.bindLogicalParent(child, occupiedParent, owner)).toThrow(/continuous chain/);
    expect(tree.getLogicalParent(child)).toBe(oldParent);
    const outer = mark(fallback),
      root = document.createElement('button');
    outer.append(root);
    mark(child, root);
    expect(tree.getLogicalParent(child)).toBe(fallback);
  });
  it.each(['mark', 'projection', 'throw'] as const)(
    'publishes authority before synchronous Trigger notification: %s',
    (action) => {
      const { tree, token, mark } = fixture();
      const parent = token(),
        child = token(),
        physical = token();
      const outer = mark(physical),
        root = mark(child);
      outer.append(root);
      tree.mergeLogicalTriggerGroup(parent, parent);
      tree.mergeLogicalTriggerGroup(child, child);
      let armed = true;
      const failure = new Error('observer after commit');
      const stop = tree.subscribeLogicalTriggerSurface(parent, () => {
        if (!armed) return;
        armed = false;
        if (action === 'throw') throw failure;
        if (action === 'mark') mark(child, root);
        else tree.setProtoParent(root, outer);
      });
      try {
        if (action === 'throw')
          expect(() => tree.bindLogicalParent(child, parent, owner)).toThrow(failure);
        else tree.bindLogicalParent(child, parent, owner);
        expect(armed).toBe(false);
        mark(child, root);
        tree.setProtoParent(root, null);
        expect(tree.getLogicalParent(child)).toBe(parent);
      } finally {
        stop();
      }
    }
  );
});

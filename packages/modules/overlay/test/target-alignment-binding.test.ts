import { describe, expect, it, vi } from 'vitest';
import {
  createAnatomyFamily,
  type AnatomyPartView,
  type OverlayTargetAlignmentBinding,
} from '@proto.ui/core';
import { AnatomyModuleImpl } from '../../anatomy/src/impl';
import { createSysCaps, makeCaps } from '../../anatomy/test/utils/fake-caps';
import { OverlayTargetAlignment } from '../src/target-alignment-binding';
function fixture() {
  const roles = ['root', 'content', 'surface', 'viewport', 'trigger', 'value', 'item', 'item-text'];
  const family = createAnatomyFamily('binding-test', {
    roles: Object.fromEntries(
      roles.map((role) => [
        role,
        { cardinality: { min: role === 'root' ? 1 : 0, max: role === 'root' ? 1 : '*' } },
      ])
    ),
  });
  const parents = new Map<object, object | null>(),
    all: AnatomyModuleImpl[] = [];
  const add = (role: string, parent: object | null = null) => {
    const token = {},
      target = {},
      sys = createSysCaps();
    parents.set(token, parent);
    const impl = new AnatomyModuleImpl(
      makeCaps({
        sys,
        instance: token,
        getParent: (i) => parents.get(i as object) ?? null,
        getPrototype: () => ({ name: role, setup() {} }),
        getRootTarget: () => target,
      }),
      role,
      { get: () => null, getAll: () => ({}), has: () => false, keys: () => [] } as any
    );
    impl.claim(family, { role });
    sys.__setExecPhase('callback');
    all.push(impl);
    return { token, target, impl };
  };
  const root = add('root'),
    owner = add('content', root.token),
    surface = add('surface', owner.token),
    scrollport = add('viewport', surface.token),
    row = add('item', scrollport.token),
    text = add('item-text', row.token),
    trigger = add('trigger', root.token),
    value = add('value', trigger.token);
  const part = (role: string): AnatomyPartView => {
    const found = owner.impl.partsOf(family, role)?.[0];
    if (!found) throw new Error(`Missing ${role}`);
    return found;
  };
  const onAlignment = vi.fn(),
    replaceImplicitRoot = vi.fn(() => vi.fn());
  const helper = new OverlayTargetAlignment(
    owner.impl.port,
    { replaceImplicitRoot } as any,
    vi.fn()
  );
  const binding: OverlayTargetAlignmentBinding = {
    family,
    surface: part('surface'),
    scrollport: part('viewport'),
    blockReference: part('trigger'),
    inlineReference: part('value'),
    blockTarget: part('item'),
    inlineTarget: part('item-text'),
    atStart: true,
    atEnd: true,
    constraints: {
      boundary: 'layout-viewport',
      margin: 10,
      minimumTargetSpanCount: 5,
      inlineOverflow: 'preserve-start',
      expandOnScroll: true,
    },
    onAlignment,
  };
  return {
    add,
    root,
    owner,
    surface,
    scrollport,
    row,
    text,
    trigger,
    value,
    binding,
    helper,
    onAlignment,
    replaceImplicitRoot,
    dispose() {
      helper.dispose();
      all.reverse().forEach((impl) => impl.dispose());
    },
  };
}
describe('scoped overlay target binding', () => {
  it('resolves actual registered slot identities and replaces only the owned surface', () => {
    const f = fixture();
    try {
      f.helper.set(f.binding);
      f.helper.syncSurface();
      expect(f.replaceImplicitRoot).toHaveBeenCalledWith(f.surface.target);
      const resolved = f.helper.resolve();
      if (!resolved) throw new Error('Missing binding');
      expect(resolved.targetAlignment.blockTarget).toBe(f.row.target);
      expect(resolved.targetAlignment.inlineTarget).toBe(f.text.target);
      resolved.onAlignment({ status: 'applied' });
      expect(f.onAlignment).toHaveBeenCalledWith({ status: 'applied' });
    } finally {
      f.dispose();
    }
  });
  it('rejects a detached logical text claim and ignores callbacks from a replaced binding', () => {
    const f = fixture();
    try {
      f.helper.set(f.binding);
      const old = f.helper.resolve();
      if (!old) throw new Error('Missing initial binding');
      f.text.impl.dispose();
      f.helper.set({ ...f.binding });
      old.onAlignment({ status: 'applied' });
      expect(f.onAlignment).not.toHaveBeenCalled();
      const current = f.helper.resolve();
      if (!current) throw new Error('Missing replacement binding');
      expect(current.targetAlignment.inlineTarget).toBeNull();
      current.onAlignment({ status: 'pending-target', reason: 'missing-target' });
      expect(f.onAlignment).toHaveBeenCalledWith({
        status: 'unavailable',
        reason: 'invalid-association',
      });
    } finally {
      f.dispose();
    }
  });
  it('rejects same-domain but wrong-row text association', () => {
    const f = fixture();
    try {
      const other = f.add('item', f.scrollport.token);
      const text = f.add('item-text', other.token);
      const parts = f.owner.impl.partsOf(f.binding.family, 'item-text');
      const foreign = parts?.find(
        (part) => f.owner.impl.port.resolvePartInstance(part) === text.token
      );
      if (!foreign) throw new Error('Missing second text');
      f.helper.set({ ...f.binding, inlineTarget: foreign });
      const resolved = f.helper.resolve();
      if (!resolved) throw new Error('Missing invalid binding');
      expect(resolved.targetAlignment.blockTarget).toBeNull();
      resolved.onAlignment({ status: 'pending-target', reason: 'missing-target' });
      expect(f.onAlignment).toHaveBeenCalledWith({
        status: 'unavailable',
        reason: 'invalid-association',
      });
    } finally {
      f.dispose();
    }
  });
});

it('revalidates retired membership at delivery without waiting for binding replacement', () => {
  const f = fixture();
  try {
    f.helper.set(f.binding);
    const old = f.helper.resolve();
    if (!old) throw new Error('Missing binding');
    f.text.impl.dispose();
    old.onAlignment({ status: 'applied' });
    expect(f.onAlignment).not.toHaveBeenCalledWith({ status: 'applied' });
  } finally {
    f.dispose();
  }
});
it('rejects old resolution generations and physically replaced targets at delivery', () => {
  const f = fixture();
  try {
    f.helper.set(f.binding);
    const old = f.helper.resolve(),
      current = f.helper.resolve();
    if (!old || !current) throw new Error('Missing resolutions');
    old.onAlignment({ status: 'applied' });
    expect(f.onAlignment).not.toHaveBeenCalled();
    const original = f.owner.impl.port.resolvePartTarget;
    const replacement = {};
    const spy = vi
      .spyOn(f.owner.impl.port, 'resolvePartTarget')
      .mockImplementation((part) =>
        part === f.binding.inlineTarget ? replacement : original(part)
      );
    current.onAlignment({ status: 'applied' });
    expect(f.onAlignment).not.toHaveBeenCalled();
    spy.mockRestore();
  } finally {
    f.dispose();
  }
});

describe('neutral border-box size associations', () => {
  it('admits same-part inline endpoints and scoped size targets without exposing host targets', () => {
    const f = fixture();
    try {
      f.helper.set({
        ...f.binding,
        inlineReference: f.binding.blockReference,
        inlineTarget: f.binding.blockTarget,
        sizeMatch: { reference: f.binding.blockReference, targets: [f.binding.blockTarget] },
      });
      const resolved = f.helper.resolve()!;
      expect(resolved.targetAlignment.sizeMatch).toEqual({
        reference: f.trigger.target,
        targets: [f.row.target],
      });
      resolved.onAlignment({ status: 'applied' });
      expect(f.onAlignment).toHaveBeenCalledWith({ status: 'applied' });
    } finally {
      f.dispose();
    }
  });
  it('rejects an unrelated reference, duplicate targets and a same-family target outside scrollport', () => {
    const f = fixture();
    try {
      for (const sizeMatch of [
        { reference: f.binding.inlineReference, targets: [f.binding.blockTarget] },
        {
          reference: f.binding.blockReference,
          targets: [f.binding.blockTarget, f.binding.blockTarget],
        },
        { reference: f.binding.blockReference, targets: [f.binding.blockReference] },
      ]) {
        f.onAlignment.mockClear();
        f.helper.set({ ...f.binding, sizeMatch });
        f.helper.resolve()!.onAlignment({ status: 'applied' });
        expect(f.onAlignment).toHaveBeenCalledWith({
          status: 'unavailable',
          reason: 'invalid-association',
        });
      }
    } finally {
      f.dispose();
    }
  });
  it('does not deliver success from a replaced size-only physical target', () => {
    const f = fixture();
    try {
      const another = f.add('item', f.scrollport.token);
      const parts = f.owner.impl.partsOf(f.binding.family, 'item');
      if (!parts) throw new Error('Expected registered item parts in the fixed fixture');
      const part = parts.find((p) => f.owner.impl.port.resolvePartInstance(p) === another.token);
      if (!part) throw new Error('Expected the added item part in the fixed fixture');
      f.helper.set({
        ...f.binding,
        sizeMatch: { reference: f.binding.blockReference, targets: [part] },
      });
      const resolved = f.helper.resolve()!;
      const original = f.owner.impl.port.resolvePartTarget;
      const spy = vi
        .spyOn(f.owner.impl.port, 'resolvePartTarget')
        .mockImplementation((p) => (p === part ? {} : original(p)));
      resolved.onAlignment({ status: 'applied' });
      expect(f.onAlignment).not.toHaveBeenCalled();
      spy.mockRestore();
    } finally {
      f.dispose();
    }
  });
});

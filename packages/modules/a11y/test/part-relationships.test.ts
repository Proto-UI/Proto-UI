import { describe, expect, it, vi } from 'vitest';
import { createA11ySemanticObjectRef, createAnatomyFamily } from '@proto.ui/core';
import {
  createA11yPartRelationshipRegistry,
  type A11yPartOwnerSnapshot,
} from '../src/part-relationships';

function family() {
  return createAnatomyFamily('relationship-test', {
    roles: {
      root: { cardinality: { min: 1, max: 1 } },
      source: { cardinality: { min: 0, max: '*' } },
      target: { cardinality: { min: 0, max: '*' } },
    },
  });
}

function fixture() {
  const registry = createA11yPartRelationshipRegistry();
  const scope = {};
  const anatomy = family();
  const sourceRef = createA11ySemanticObjectRef();
  const targetRef = createA11ySemanticObjectRef();
  const notify = vi.fn();
  const source = registry.createOwner(sourceRef, notify);
  const target = registry.createOwner(targetRef, () => {});
  const targetInput: A11yPartOwnerSnapshot = {
    epoch: 1,
    available: true,
    parts: [{ family: anatomy, scope, role: 'target', key: 'a+b' }],
    relationships: [],
  };
  const sourceInput: A11yPartOwnerSnapshot = {
    epoch: 1,
    available: true,
    parts: [],
    relationships: [
      {
        family: anatomy,
        scope,
        role: 'source',
        key: 'a+b',
        relation: 'controls',
        targetRole: 'target',
      },
    ],
  };
  source.update(sourceInput);
  target.update(targetInput);
  return {
    registry,
    scope,
    anatomy,
    sourceRef,
    targetRef,
    source,
    target,
    sourceInput,
    targetInput,
    notify,
  };
}

describe('same-domain A11y part relationships', () => {
  it('carries the exact structural tuple and both view epochs', () => {
    const f = fixture();
    expect(f.source.getRelationships()).toEqual([
      {
        family: f.anatomy,
        scope: f.scope,
        source: f.sourceRef,
        sourceRole: 'source',
        targetRole: 'target',
        relation: 'controls',
        key: 'a+b',
        sourceEpoch: 1,
        targetEpoch: 1,
        target: f.targetRef,
      },
    ]);
    expect(f.source.getDiagnostics()).toEqual([]);
  });

  it.each(['family', 'scope', 'role', 'key'] as const)('does not match a different %s', (field) => {
    const f = fixture();
    const values = { family: family(), scope: {}, role: 'source', key: 'a b' };
    f.target.update({
      ...f.targetInput,
      parts: [{ ...f.targetInput.parts[0]!, [field]: values[field] }],
    });
    expect(f.source.getRelationships()[0]?.target).toBeNull();
    expect(f.source.getDiagnostics()).toEqual([{ relation: 'controls', code: 'missing-target' }]);
  });

  it('fails closed for duplicate logical members, even while one is detached', () => {
    const f = fixture();
    const duplicate = f.registry.createOwner(createA11ySemanticObjectRef(), () => {});
    duplicate.update({ ...f.targetInput, available: false });
    expect(f.source.getRelationships()[0]?.target).toBeNull();
    expect(f.source.getDiagnostics()).toEqual([{ relation: 'controls', code: 'ambiguous-target' }]);
    duplicate.dispose();
    expect(f.source.getRelationships()[0]?.target).toBe(f.targetRef);
  });

  it('withdraws each detached endpoint, resumes new epochs and ignores late old-epoch input', () => {
    const f = fixture();
    f.target.update({ ...f.targetInput, available: false });
    expect(f.source.getRelationships()[0]).toMatchObject({ target: null, targetEpoch: 1 });
    f.target.update({ ...f.targetInput, epoch: 2 });
    expect(f.source.getRelationships()[0]).toMatchObject({ target: f.targetRef, targetEpoch: 2 });
    f.target.update({ ...f.targetInput, available: false });
    expect(f.source.getRelationships()[0]?.target).toBe(f.targetRef);
    f.source.update({ ...f.sourceInput, available: false });
    expect(f.source.getRelationships()[0]?.target).toBeNull();
    f.source.update({ ...f.sourceInput, epoch: 3 });
    expect(f.source.getRelationships()[0]).toMatchObject({ target: f.targetRef, sourceEpoch: 3 });
  });

  it('atomically moves a logical membership and suppresses equality notifications', () => {
    const f = fixture();
    const observations: unknown[] = [];
    f.notify.mockImplementation(() => observations.push(f.source.getRelationships()[0]?.target));
    f.notify.mockClear();
    f.target.update({ ...f.targetInput });
    expect(f.notify).not.toHaveBeenCalled();
    f.target.update({ ...f.targetInput, parts: [{ ...f.targetInput.parts[0]!, key: 'a b' }] });
    expect(observations).toEqual([null]);
    f.source.update({
      ...f.sourceInput,
      relationships: [{ ...f.sourceInput.relationships[0]!, key: 'a b' }],
    });
    expect(observations).toEqual([null, f.targetRef]);
  });

  it('reconciles reentrant changes without recursively publishing an unchanged tuple', () => {
    const f = fixture();
    f.notify.mockClear();
    f.notify.mockImplementation(() => {
      f.source.update(f.sourceInput);
      if (!f.source.getRelationships()[0]?.target) f.target.update(f.targetInput);
    });
    f.target.update({ ...f.targetInput, parts: [] });
    expect(f.notify).toHaveBeenCalledTimes(2);
    expect(f.source.getRelationships()[0]?.target).toBe(f.targetRef);
  });

  it('removes terminal memberships and never revives disposed sources or targets', () => {
    const f = fixture();
    f.target.dispose();
    expect(f.source.getRelationships()[0]?.target).toBeNull();
    f.target.update(f.targetInput);
    expect(f.source.getRelationships()[0]?.target).toBeNull();
    f.source.dispose();
    f.notify.mockClear();
    const replacement = f.registry.createOwner(createA11ySemanticObjectRef(), () => {});
    replacement.update(f.targetInput);
    expect(f.source.getRelationships()).toEqual([]);
    expect(f.notify).not.toHaveBeenCalled();
  });

  it('does not lose a pending peer notification when another callback reenters the registry', () => {
    const f = fixture();
    const notifyPeer = vi.fn();
    const peer = f.registry.createOwner(createA11ySemanticObjectRef(), notifyPeer);
    peer.update(f.sourceInput);
    notifyPeer.mockClear();
    const unrelated = f.registry.createOwner(createA11ySemanticObjectRef(), () => {});
    f.notify.mockImplementation(() =>
      unrelated.update({ epoch: 2, available: false, parts: [], relationships: [] })
    );
    f.target.update({ ...f.targetInput, available: false });
    expect(notifyPeer).toHaveBeenCalledTimes(1);
    expect(peer.getRelationships()[0]?.target).toBeNull();
  });

  it('keeps diagnostics bounded and accepts exact keys without CSS or object-key interpretation', () => {
    const f = fixture();
    for (const key of ['__proto__', '[id="x"]', ' a ', 'a b']) {
      f.target.update({ ...f.targetInput, parts: [{ ...f.targetInput.parts[0]!, key }] });
      f.source.update({
        ...f.sourceInput,
        relationships: [{ ...f.sourceInput.relationships[0]!, key }],
      });
      expect(f.source.getRelationships()[0]?.target).toBe(f.targetRef);
    }
    for (let epoch = 2; epoch < 12; epoch++) {
      f.source.update({
        ...f.sourceInput,
        epoch,
        relationships: [{ ...f.sourceInput.relationships[0]!, key: '' }],
      });
      expect(f.source.getDiagnostics()).toEqual([{ relation: 'controls', code: 'missing-key' }]);
    }
    f.source.update({
      ...f.sourceInput,
      epoch: 12,
      relationships: [{ ...f.sourceInput.relationships[0]!, scope: null }],
    });
    expect(f.source.getDiagnostics()).toEqual([{ relation: 'controls', code: 'missing-source' }]);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { isControlLabelRef, type InstanceAssociations } from '@proto.ui/core';
import { createAssociationLedger } from '../src/associations';
import { createNativeScopeLedger, createPeerControlLabelHost } from '../src/control-label';

describe('GPUI dedicated instance-association lowering', () => {
  it('materializes only through the public factory and shares keys inside one renderer', () => {
    const ledger = createAssociationLedger();
    const values: InstanceAssociations[] = [];
    ledger.apply('label', { controlLabel: 'association:1' }, (v) => values.push(v));
    ledger.apply('target', { controlLabel: 'association:1' }, (v) => values.push(v));
    expect(isControlLabelRef(values[0]!.controlLabel)).toBe(true);
    expect(values[0]!.controlLabel).toBe(values[1]!.controlLabel);
    expect(() => JSON.stringify(values[0])).toThrow('opaque references cannot be serialized');
    const other = createAssociationLedger();
    other.apply('label', { controlLabel: 'association:1' }, (v) =>
      expect(v.controlLabel).not.toBe(values[0]!.controlLabel)
    );
  });
  it('releases last-user keys and a later lifetime obtains a new identity', () => {
    const ledger = createAssociationLedger();
    let old: InstanceAssociations;
    ledger.apply('label', { controlLabel: 'pair' }, (v) => {
      old = v;
    });
    ledger.apply('target', { controlLabel: 'pair' }, () => {});
    ledger.release('label');
    expect(ledger.size()).toBe(1);
    ledger.release('target');
    expect(ledger.size()).toBe(0);
    ledger.apply('replacement', { controlLabel: 'pair' }, (v) =>
      expect(v.controlLabel).not.toBe(old.controlLabel)
    );
  });
  it('leaves a prior accepted identity live when Runtime rejects a replacement', () => {
    const ledger = createAssociationLedger();
    let old: InstanceAssociations;
    ledger.apply('target', { controlLabel: 'old' }, (v) => {
      old = v;
    });
    expect(() =>
      ledger.apply('target', { controlLabel: 'new' }, () => {
        throw new Error('undeclared');
      })
    ).toThrow('undeclared');
    expect(ledger.size()).toBe(1);
    ledger.apply('other', { controlLabel: 'old' }, (v) =>
      expect(v.controlLabel).toBe(old.controlLabel)
    );
  });
  it.each([
    null,
    [],
    { other: 'x' },
    { controlLabel: {} },
    { controlLabel: 'x'.repeat(129) },
    { controlLabel: 'https://external' },
  ])('rejects malformed or foreign association data: %j', (input) => {
    const ledger = createAssociationLedger();
    const commit = vi.fn();
    expect(() => ledger.apply('target', input, commit)).toThrow();
    expect(commit).not.toHaveBeenCalled();
    expect(ledger.size()).toBe(0);
  });
});

function fixture() {
  const scope = createNativeScopeLedger();
  let live = true;
  let epoch = 1;
  const publish = vi.fn();
  const onActivate = vi.fn();
  const onViewChange = vi.fn();
  const owner = createPeerControlLabelHost({
    sessionId: 'label',
    epoch: () => epoch,
    live: () => live,
    scope,
    publish,
  });
  const lease = owner.host.attach({ kind: 'label', activation: true, onActivate, onViewChange });
  const leaseId = owner.plan()!.leaseId;
  const view = (revision = 1, identity = 'surface:1', tree = 'window:1/tree:1') => ({
    kind: 'control-label.view' as const,
    sessionId: 'label',
    viewEpoch: epoch,
    leaseId,
    revision,
    view: { identity, scope: tree, authoredName: false },
  });
  const activate = (revision = 1) => ({
    kind: 'control-label.activate' as const,
    sessionId: 'label',
    viewEpoch: epoch,
    leaseId,
    viewRevision: revision,
    sequence: 1,
    source: 'pointer' as const,
  });
  return {
    owner,
    lease,
    leaseId,
    view,
    activate,
    onActivate,
    onViewChange,
    publish,
    scope,
    setLive: (value: boolean) => {
      live = value;
    },
    setEpoch: (value: number) => {
      epoch = value;
    },
  };
}

describe('GPUI native view lease', () => {
  it('has no view from a parent/session key; only host-native facts enable requests', () => {
    const f = fixture();
    expect(f.lease.view()).toBeNull();
    expect(f.owner.activate(f.activate())).toBe(false);
    expect(f.owner.view(f.view())).toBe(true);
    expect(f.lease.view()).not.toBeNull();
    expect(f.owner.activate(f.activate())).toBe(true);
    expect(f.owner.activate(f.activate())).toBe(false);
    expect(f.onActivate).toHaveBeenCalledTimes(1);
    expect(f.onActivate).toHaveBeenCalledWith('pointer');
  });
  it('keeps stable identity for the same native view and changes it on replacement', () => {
    const f = fixture();
    f.owner.view(f.view());
    const before = f.lease.view();
    f.owner.view(f.view(2));
    expect(f.lease.view()!.identity).toBe(before!.identity);
    f.owner.view(f.view(3, 'surface:2'));
    expect(f.lease.view()!.identity).not.toBe(before!.identity);
    expect(f.lease.view()!.scope).toBe(before!.scope);
    f.owner.view(f.view(4, 'surface:2', 'window:2/tree:1'));
    expect(f.lease.view()!.scope).not.toBe(before!.scope);
  });
  it('rejects old revisions, epochs, lease ids and activation facts', () => {
    const f = fixture();
    f.owner.view(f.view(3));
    expect(f.owner.view(f.view(2))).toBe(false);
    expect(f.owner.view({ ...f.view(4), viewEpoch: 0 })).toBe(false);
    expect(f.owner.view({ ...f.view(4), leaseId: 'retired' })).toBe(false);
    expect(f.owner.activate(f.activate(2))).toBe(false);
    expect(f.onActivate).not.toHaveBeenCalled();
  });
  it('withdraws actions when module options change and prevents retired lease writes', () => {
    const f = fixture();
    f.owner.view(f.view());
    f.lease.setActivation(false);
    expect(f.owner.plan()!.activation).toBe(false);
    expect(f.owner.activate(f.activate())).toBe(false);
    f.lease.dispose();
    expect(f.scope.size()).toBe(0);
    const count = f.publish.mock.calls.length;
    f.lease.setActivation(true);
    expect(f.publish).toHaveBeenCalledTimes(count);
    expect(f.owner.view(f.view(2))).toBe(false);
    expect(f.lease.view()).toBeNull();
  });
  it('does not replay a queued action across activation off/on on the same surface', () => {
    const f = fixture();
    f.owner.view(f.view());
    f.lease.setActivation(false);
    f.lease.setActivation(true);
    expect(f.owner.activate(f.activate())).toBe(false);
    expect(f.lease.view()).not.toBeNull(); // Naming is not withdrawn.
    f.owner.view(f.view(2));
    expect(f.owner.activate(f.activate())).toBe(false);
    expect(f.owner.activate(f.activate(2))).toBe(true);
    expect(f.onActivate).toHaveBeenCalledTimes(1);
  });

  it('revokes a detached view and does not infer readiness from an allocated lease', () => {
    const f = fixture();
    f.owner.view(f.view());
    f.owner.revoke();
    expect(f.lease.view()).toBeNull();
    expect(f.owner.activate(f.activate())).toBe(false);
    f.owner.view(f.view(2));
    f.setLive(false);
    expect(f.lease.view()).toBeNull();
    expect(f.owner.activate(f.activate(2))).toBe(false);
  });
});

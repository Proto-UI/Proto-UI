import { describe, expect, it, vi } from 'vitest';
import {
  createA11ySemanticObjectRef,
  createControlLabelRef,
  isControlLabelRef,
} from '@proto.ui/core';
import {
  bindControlLabel,
  type ControlLabelParticipant,
  type ControlLabelView,
} from '../src/registry';

function fixture() {
  const ref = createControlLabelRef();
  const scope = {};
  let labelView: ControlLabelView | null = { scope, identity: {} };
  let targetView: ControlLabelView | null = { scope, identity: {} };
  let options = { naming: true, activation: true };
  const disposeName = vi.fn();
  const name = vi.fn(() => ({ dispose: disposeName, isActive: () => true }));
  const activate = vi.fn();
  const target: ControlLabelParticipant = {
    owner: {},
    kind: 'target',
    ref,
    semanticRef: createA11ySemanticObjectRef(),
    view: () => targetView,
    options: () => options,
    name,
    activate,
    diagnostic: vi.fn(),
  };
  const label: ControlLabelParticipant = {
    owner: {},
    kind: 'label',
    ref,
    semanticRef: createA11ySemanticObjectRef(),
    view: () => labelView,
    options: () => options,
    name: () => null,
    activate: () => {},
    diagnostic: vi.fn(),
  };
  const targetLease = bindControlLabel(target);
  const labelLease = bindControlLabel(label);
  return {
    ref,
    scope,
    target,
    label,
    targetLease,
    labelLease,
    name,
    disposeName,
    activate,
    setLabelView: (v: ControlLabelView | null) => {
      labelView = v;
    },
    setTargetView: (v: ControlLabelView | null) => {
      targetView = v;
    },
    setOptions: (o: typeof options) => {
      options = o;
    },
  };
}

describe('explicit Control Label pairing', () => {
  it('brands references without accepting lookalikes or silent JSON', () => {
    const ref = createControlLabelRef();
    expect(isControlLabelRef(ref)).toBe(true);
    expect(isControlLabelRef({})).toBe(false);
    expect(() => JSON.stringify(ref)).toThrow(/cannot be serialized/);
  });
  it('names the real Label and routes one request to the target owner', () => {
    const f = fixture();
    expect(f.name).toHaveBeenCalledOnce();
    expect(f.name).toHaveBeenCalledWith(f.label.semanticRef);
    f.labelLease.requestActivation();
    expect(f.activate).toHaveBeenCalledTimes(1);
    expect(f.activate.mock.calls[0]![0]()).toBe(true);
  });
  it('keeps naming independent from activation', () => {
    const f = fixture();
    f.setOptions({ naming: true, activation: false });
    f.labelLease.refresh();
    f.labelLease.requestActivation();
    expect(f.activate).not.toHaveBeenCalled();
    expect(f.name).toHaveBeenCalledTimes(2);
    f.setOptions({ naming: false, activation: true });
    f.labelLease.refresh();
    f.labelLease.requestActivation();
    expect(f.activate).toHaveBeenCalledTimes(1);
    expect(f.disposeName).toHaveBeenCalledTimes(2);
  });
  it('fails closed for duplicate live targets and restores the unique pair after disposal', () => {
    const f = fixture();
    const duplicate = bindControlLabel({ ...f.target, owner: {} });
    f.labelLease.requestActivation();
    expect(f.activate).not.toHaveBeenCalled();
    expect(f.disposeName).toHaveBeenCalledTimes(1);
    expect(f.label.diagnostic).toHaveBeenLastCalledWith('duplicate-binding');
    duplicate.dispose();
    f.labelLease.requestActivation();
    expect(f.activate).toHaveBeenCalledTimes(1);
  });
  it('does not join an unrelated reference or a foreign host tree scope', () => {
    const f = fixture();
    f.setTargetView({ scope: {}, identity: {} });
    f.targetLease.refresh();
    f.labelLease.requestActivation();
    expect(f.activate).not.toHaveBeenCalled();
    expect(f.label.diagnostic).toHaveBeenLastCalledWith('foreign-tree-scope');
    const other = bindControlLabel({ ...f.target, ref: createControlLabelRef(), owner: {} });
    expect(f.target.diagnostic).toHaveBeenLastCalledWith('missing-binding');
    other.dispose();
  });
  it('withdraws on detach and invalidates a retained request guard', () => {
    const f = fixture();
    f.labelLease.requestActivation();
    const guard = f.activate.mock.calls[0]![0];
    f.setLabelView(null);
    f.labelLease.refresh();
    expect(guard()).toBe(false);
    expect(f.disposeName).toHaveBeenCalledOnce();
    f.labelLease.requestActivation();
    expect(f.activate).toHaveBeenCalledTimes(1);
    f.setLabelView({ scope: f.scope, identity: {} });
    f.labelLease.refresh();
    f.labelLease.requestActivation();
    expect(f.activate).toHaveBeenCalledTimes(2);
  });
  it('an old same-owner lease cannot revoke its newer replacement', () => {
    const f = fixture();
    const newer = bindControlLabel({ ...f.label, semanticRef: createA11ySemanticObjectRef() });
    f.labelLease.dispose();
    f.labelLease.requestActivation();
    expect(f.activate).not.toHaveBeenCalled();
    newer.requestActivation();
    expect(f.activate).toHaveBeenCalledOnce();
  });
  it('rechecks physical identity at request time even without a change notification', () => {
    const f = fixture();
    f.labelLease.requestActivation();
    const guard = f.activate.mock.calls[0]![0];
    f.setTargetView({ scope: f.scope, identity: {} });
    expect(guard()).toBe(false);
    f.labelLease.requestActivation();
    expect(f.activate).toHaveBeenCalledTimes(2);
  });
  it('allows explicit activation during a naming conflict without fabricating a name', () => {
    const f = fixture();
    f.targetLease.dispose();
    const target = bindControlLabel({ ...f.target, name: () => null });
    f.labelLease.requestActivation();
    expect(f.label.diagnostic).toHaveBeenLastCalledWith('name-conflict');
    expect(f.activate).toHaveBeenCalledOnce();
    target.dispose();
  });
});

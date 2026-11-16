import { describe, expect, it, vi } from 'vitest';
import {
  createA11ySemanticObjectRef,
  isA11ySemanticObjectRef,
  type A11ySemanticObjectRef,
} from '@proto.ui/core';
import { createWebA11yProjectionRegistry } from '../src/web';
import { ownGeneratedId, retainGeneratedId } from '../src/generated-id';

function snapshot(objectRef: A11ySemanticObjectRef, label?: A11ySemanticObjectRef) {
  return {
    objectRef,
    states: {},
    actions: {},
    relations: label ? { labelledBy: [label] } : {},
  };
}

function fixture() {
  const container = document.createElement('div');
  const label = document.createElement('span');
  const target = document.createElement('button');
  label.textContent = 'Visible Label';
  container.append(label, target);
  document.body.append(container);
  const registry = createWebA11yProjectionRegistry();
  const targetRef = createA11ySemanticObjectRef();
  const projectTarget = registry.createProjector(() => target);
  projectTarget(snapshot(targetRef));
  return { container, label, target, registry, targetRef, projectTarget };
}

describe('target-owned ControlLabel semantic source bridge', () => {
  it('names the real foreign Label through the target projector registry', () => {
    const f = fixture();
    const foreignRef = Object.freeze({});
    const source = f.projectTarget.acquireControlLabelSource!(foreignRef, {
      identity: f.label,
      scope: document,
    })!;
    expect(isA11ySemanticObjectRef(foreignRef)).toBe(false);
    expect(isA11ySemanticObjectRef(source.objectRef)).toBe(true);
    f.projectTarget(snapshot(f.targetRef, source.objectRef));
    expect(f.target.getAttribute('aria-labelledby')).toBe(f.label.id);
    expect(f.label.id).not.toBe('');
    expect(f.target.hasAttribute('aria-label')).toBe(false);
    f.label.textContent = 'Changed visible Label';
    expect(document.getElementById(f.target.getAttribute('aria-labelledby')!)?.textContent).toBe(
      'Changed visible Label'
    );
    f.projectTarget(snapshot(f.targetRef));
    source.dispose();
    expect(f.label.hasAttribute('id')).toBe(false);
    expect(f.target.hasAttribute('aria-labelledby')).toBe(false);
    f.projectTarget.dispose?.();
    f.container.remove();
  });

  it('reuses an exact semantic binding and refuses ambiguous or foreign-tree views', () => {
    const f = fixture();
    const labelRef = createA11ySemanticObjectRef();
    const projectLabel = f.registry.createProjector(() => f.label);
    projectLabel(snapshot(labelRef));
    const view = { identity: f.label, scope: document };
    const source = f.projectTarget.acquireControlLabelSource!(labelRef, view)!;
    expect(source.objectRef).toBe(labelRef);
    const duplicate = f.registry.createProjector(() => f.label);
    duplicate(snapshot(labelRef));
    expect(source.isActive()).toBe(false);
    expect(f.projectTarget.acquireControlLabelSource!(labelRef, view)).toBeNull();
    duplicate.dispose?.();
    expect(f.projectTarget.acquireControlLabelSource!({}, { ...view, scope: {} })).toBeNull();
    source.dispose();
    projectLabel.dispose?.();
    f.projectTarget.dispose?.();
    f.container.remove();
  });

  it('retires its foreign source aliases with the target view', () => {
    const f = fixture();
    const source = f.projectTarget.acquireControlLabelSource!(
      {},
      {
        identity: f.label,
        scope: document,
      }
    )!;
    f.projectTarget(snapshot(f.targetRef, source.objectRef));
    f.projectTarget.detach?.();
    expect(source.isActive()).toBe(false);
    expect(f.label.hasAttribute('id')).toBe(false);
    expect(f.target.hasAttribute('aria-labelledby')).toBe(false);
    source.dispose();
    f.projectTarget.dispose?.();
    f.container.remove();
  });

  it('retains a native-generated source ID until the runtime naming lease releases it', () => {
    const f = fixture();
    f.label.id = 'native-control-label-source';
    const nativeWriter = ownGeneratedId(f.label, f.label.id, null);
    const source = f.projectTarget.acquireControlLabelSource!(
      {},
      {
        identity: f.label,
        scope: document,
      }
    )!;
    f.projectTarget(snapshot(f.targetRef, source.objectRef));
    nativeWriter.dispose();
    expect(f.label.id).toBe('native-control-label-source');
    expect(f.target.getAttribute('aria-labelledby')).toBe(f.label.id);
    f.projectTarget(snapshot(f.targetRef));
    source.dispose();
    expect(f.label.hasAttribute('id')).toBe(false);
    f.projectTarget.dispose?.();
    f.container.remove();
  });

  it('retains a runtime-generated ID for an independent native relation owner', () => {
    const f = fixture();
    const source = f.projectTarget.acquireControlLabelSource!(
      {},
      {
        identity: f.label,
        scope: document,
      }
    )!;
    f.projectTarget(snapshot(f.targetRef, source.objectRef));
    const id = f.label.id;
    const nativeRetainer = retainGeneratedId(f.label, id)!;
    expect(nativeRetainer).not.toBeNull();
    f.projectTarget(snapshot(f.targetRef));
    source.dispose();
    expect(f.label.id).toBe(id);
    nativeRetainer.dispose();
    expect(f.label.hasAttribute('id')).toBe(false);
    f.projectTarget.dispose?.();
    f.container.remove();
  });

  it('does not publish an ID receipt for a Runtime source retired during its physical write', () => {
    const f = fixture();
    const source = f.projectTarget.acquireControlLabelSource!(
      {},
      { identity: f.label, scope: document }
    )!;
    const original = f.label.setAttribute.bind(f.label);
    let retired = false;
    const write = vi.spyOn(f.label, 'setAttribute').mockImplementation((name, value) => {
      original(name, value);
      if (name === 'id' && !retired) {
        retired = true;
        source.dispose();
      }
    });
    try {
      f.projectTarget(snapshot(f.targetRef, source.objectRef));
      expect(retired).toBe(true);
      expect(f.label.hasAttribute('id')).toBe(false);
      expect(f.target.hasAttribute('aria-labelledby')).toBe(false);
    } finally {
      write.mockRestore();
      source.dispose();
      f.projectTarget.dispose?.();
      f.container.remove();
    }
  });

  it('preserves a consumer replacement when the final generated-ID owner retires', () => {
    const f = fixture();
    f.label.id = 'generated-label';
    const writer = ownGeneratedId(f.label, f.label.id, null);
    const retainer = retainGeneratedId(f.label, f.label.id)!;
    writer.dispose();
    f.label.id = 'consumer-label';
    retainer.dispose();
    retainer.dispose();
    expect(f.label.id).toBe('consumer-label');
    expect(retainGeneratedId(f.label, 'consumer-label')).toBeNull();
    f.projectTarget.dispose?.();
    f.container.remove();
  });
});

import { describe, expect, it, vi } from 'vitest';

import {
  createA11ySemanticObjectRef,
  type A11yRelationSnapshotTarget,
  type A11ySemanticObjectRef,
  type A11ySemanticObjectSnapshot,
} from '@proto.ui/core';

import { createWebA11yProjectionRegistry, createWebA11yProjector } from '../src';

function semanticSnapshot(
  objectRef: A11ySemanticObjectRef,
  relations: Record<string, A11yRelationSnapshotTarget> = {},
  relationModes: A11ySemanticObjectSnapshot['relationModes'] = undefined
): A11ySemanticObjectSnapshot {
  return {
    objectRef,
    states: {},
    actions: {},
    relations,
    ...(relationModes ? { relationModes } : {}),
  };
}

function targetSlot(initial: HTMLElement | null) {
  let target = initial;
  const listeners = new Set<() => void>();

  return {
    get listenerCount() {
      return listeners.size;
    },
    get() {
      return target;
    },
    set(next: HTMLElement | null) {
      target = next;
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

describe('Web A11y opaque semantic-object references', () => {
  it('projects ordered targets atomically across missing, removal, rematerialization, and disposal', () => {
    // T-A11Y-0001-CASE-OPAQUE-RELATION-PROJECTION
    const registry = createWebA11yProjectionRegistry({ idPrefix: 'test-a11y' });
    const sourceRef = createA11ySemanticObjectRef();
    const firstRef = createA11ySemanticObjectRef();
    const secondRef = createA11ySemanticObjectRef();
    const source = document.createElement('div');
    const firstTarget = document.createElement('span');
    const secondTarget = document.createElement('span');
    const sourceTarget = targetSlot(source);
    const firstTargetSlot = targetSlot(firstTarget);
    const secondTargetSlot = targetSlot(secondTarget);
    const sourceProjector = createWebA11yProjector(
      sourceTarget.get,
      sourceTarget.subscribe,
      registry
    );
    const firstProjector = createWebA11yProjector(
      firstTargetSlot.get,
      firstTargetSlot.subscribe,
      registry
    );
    const secondProjector = createWebA11yProjector(
      secondTargetSlot.get,
      secondTargetSlot.subscribe,
      registry
    );

    sourceProjector(semanticSnapshot(sourceRef, { labelledBy: [firstRef, secondRef] }));
    firstProjector(semanticSnapshot(firstRef));
    expect(source.hasAttribute('aria-labelledby')).toBe(false);
    secondProjector(semanticSnapshot(secondRef));
    const firstId = firstTarget.id;
    const secondId = secondTarget.id;
    expect(firstId).toMatch(/^test-a11y-/);
    expect(secondId).toMatch(/^test-a11y-/);
    expect(firstId).not.toBe(secondId);
    expect(source.getAttribute('aria-labelledby')).toBe(`${firstId} ${secondId}`);

    sourceProjector(semanticSnapshot(sourceRef, { labelledBy: [secondRef, firstRef, secondRef] }));
    expect(source.getAttribute('aria-labelledby')).toBe(`${secondId} ${firstId}`);

    firstTargetSlot.set(null);
    expect(firstTarget.hasAttribute('id')).toBe(false);
    expect(source.hasAttribute('aria-labelledby')).toBe(false);

    const rematerializedFirst = document.createElement('span');
    firstTargetSlot.set(rematerializedFirst);
    expect(rematerializedFirst.id).toBe(firstId);
    expect(source.getAttribute('aria-labelledby')).toBe(`${secondId} ${firstId}`);

    const replacementSource = document.createElement('div');
    sourceTarget.set(replacementSource);
    expect(source.hasAttribute('aria-labelledby')).toBe(false);
    expect(replacementSource.getAttribute('aria-labelledby')).toBe(`${secondId} ${firstId}`);

    firstProjector.dispose?.();
    expect(firstTargetSlot.listenerCount).toBe(0);
    expect(rematerializedFirst.hasAttribute('id')).toBe(false);
    expect(replacementSource.hasAttribute('aria-labelledby')).toBe(false);

    secondProjector.dispose?.();
    expect(secondTarget.hasAttribute('id')).toBe(false);
    sourceProjector.dispose?.();
    expect(secondTargetSlot.listenerCount).toBe(0);
    expect(sourceTarget.listenerCount).toBe(0);
    expect(replacementSource.hasAttribute('aria-labelledby')).toBe(false);
  });

  it('preserves unrelated additive tokens while a referenced target is unavailable', () => {
    // T-A11Y-0001-CASE-OPAQUE-RELATION-PROJECTION
    const registry = createWebA11yProjectionRegistry({ idPrefix: 'test-additive' });
    const sourceRef = createA11ySemanticObjectRef();
    const targetRef = createA11ySemanticObjectRef();
    const source = document.createElement('div');
    const target = document.createElement('div');
    source.setAttribute('aria-describedby', 'host-help');
    const sourceTarget = targetSlot(source);
    const targetTarget = targetSlot(target);
    const sourceProjector = createWebA11yProjector(
      sourceTarget.get,
      sourceTarget.subscribe,
      registry
    );
    const targetProjector = createWebA11yProjector(
      targetTarget.get,
      targetTarget.subscribe,
      registry
    );

    sourceProjector(
      semanticSnapshot(sourceRef, { describedBy: [targetRef] }, { describedBy: 'append' })
    );
    expect(source.getAttribute('aria-describedby')).toBe('host-help');

    targetProjector(semanticSnapshot(targetRef));
    const targetId = target.id;
    expect(source.getAttribute('aria-describedby')).toBe(`host-help ${targetId}`);

    targetTarget.set(null);
    expect(source.getAttribute('aria-describedby')).toBe('host-help');
    targetProjector.dispose?.();
    sourceProjector.dispose?.();
    expect(source.getAttribute('aria-describedby')).toBe('host-help');
  });
  it('clears prior string ownership when a relation changes to structured refs or is removed', () => {
    // T-A11Y-0001-CASE-OPAQUE-RELATION-PROJECTION
    const registry = createWebA11yProjectionRegistry({ idPrefix: 'test-migration' });
    const sourceRef = createA11ySemanticObjectRef();
    const targetRef = createA11ySemanticObjectRef();
    const source = document.createElement('div');
    const target = document.createElement('div');
    const sourceProjector = createWebA11yProjector(source, undefined, registry);
    const targetProjector = createWebA11yProjector(target, undefined, registry);

    sourceProjector(semanticSnapshot(sourceRef, { labelledBy: 'legacy-id' }));
    expect(source.getAttribute('aria-labelledby')).toBe('legacy-id');

    sourceProjector(semanticSnapshot(sourceRef, { labelledBy: [targetRef] }));
    expect(source.hasAttribute('aria-labelledby')).toBe(false);

    targetProjector(semanticSnapshot(targetRef));
    expect(source.getAttribute('aria-labelledby')).toBe(target.id);

    sourceProjector(semanticSnapshot(sourceRef));
    expect(source.hasAttribute('aria-labelledby')).toBe(false);

    sourceProjector(semanticSnapshot(sourceRef, { labelledBy: 'restored-string' }));
    expect(source.getAttribute('aria-labelledby')).toBe('restored-string');

    sourceProjector.dispose?.();
    targetProjector.dispose?.();
    expect(source.hasAttribute('aria-labelledby')).toBe(false);
  });

  it('keeps one reserved target identity across projector-cap replacement', () => {
    // T-A11Y-0001-CASE-OPAQUE-RELATION-PROJECTION
    const registry = createWebA11yProjectionRegistry({ idPrefix: 'test-cap-rebind' });
    const sourceRef = createA11ySemanticObjectRef();
    const targetRef = createA11ySemanticObjectRef();
    const source = document.createElement('div');
    const oldTarget = document.createElement('div');
    const oldTargetSlot = targetSlot(oldTarget);
    const sourceProjector = createWebA11yProjector(source, undefined, registry);
    const oldProjector = createWebA11yProjector(
      oldTargetSlot.get,
      oldTargetSlot.subscribe,
      registry
    );

    sourceProjector(semanticSnapshot(sourceRef, { labelledBy: [targetRef] }));
    oldProjector({ ...semanticSnapshot(targetRef), role: 'cell' });
    const reservedId = oldTarget.id;
    expect(source.getAttribute('aria-labelledby')).toBe(reservedId);
    expect(oldTarget.getAttribute('role')).toBe('cell');

    oldProjector.detach?.();
    expect(oldTargetSlot.listenerCount).toBe(0);
    expect(oldTarget.hasAttribute('id')).toBe(false);
    expect(oldTarget.getAttribute('role')).toBe('cell');
    expect(source.hasAttribute('aria-labelledby')).toBe(false);

    const replacementTarget = document.createElement('div');
    const replacementProjector = createWebA11yProjector(replacementTarget, undefined, registry);
    replacementProjector(semanticSnapshot(targetRef));
    expect(replacementTarget.id).toBe(reservedId);
    expect(source.getAttribute('aria-labelledby')).toBe(reservedId);

    sourceProjector.dispose?.();
    replacementProjector.dispose?.();
    oldProjector.dispose?.();
    expect(replacementTarget.hasAttribute('id')).toBe(false);
    expect(oldTarget.hasAttribute('role')).toBe(false);
  });

  it('fails closed on duplicate bindings and preserves an adopted host-authored target id', () => {
    // T-A11Y-0001-CASE-OPAQUE-RELATION-PROJECTION
    const registry = createWebA11yProjectionRegistry({ idPrefix: 'test-duplicate' });
    const sourceRef = createA11ySemanticObjectRef();
    const targetRef = createA11ySemanticObjectRef();
    const source = document.createElement('div');
    const firstTarget = document.createElement('div');
    const secondTarget = document.createElement('div');
    firstTarget.id = 'author-target';
    source.setAttribute('aria-labelledby', 'host-label');
    const sourceProjector = createWebA11yProjector(source, undefined, registry);
    const firstProjector = createWebA11yProjector(firstTarget, undefined, registry);
    const secondProjector = createWebA11yProjector(secondTarget, undefined, registry);

    sourceProjector(semanticSnapshot(sourceRef, { labelledBy: [targetRef] }));
    firstProjector(semanticSnapshot(targetRef));
    expect(source.getAttribute('aria-labelledby')).toBe('author-target');

    secondProjector(semanticSnapshot(targetRef));
    expect(source.getAttribute('aria-labelledby')).toBe('host-label');

    secondProjector.dispose?.();
    expect(source.getAttribute('aria-labelledby')).toBe('author-target');

    firstProjector.dispose?.();
    expect(firstTarget.id).toBe('author-target');
    expect(source.getAttribute('aria-labelledby')).toBe('host-label');
    sourceProjector.dispose?.();
    expect(source.getAttribute('aria-labelledby')).toBe('host-label');
  });

  it('scopes adopted target-id reservations to each owner document', () => {
    // T-A11Y-0001-CASE-OPAQUE-RELATION-PROJECTION
    const registry = createWebA11yProjectionRegistry({ idPrefix: 'test-document-scope' });
    const firstDocument = document.implementation.createHTMLDocument('first');
    const secondDocument = document.implementation.createHTMLDocument('second');
    const firstSourceRef = createA11ySemanticObjectRef();
    const secondSourceRef = createA11ySemanticObjectRef();
    const firstTargetRef = createA11ySemanticObjectRef();
    const secondTargetRef = createA11ySemanticObjectRef();
    const firstSource = firstDocument.createElement('div');
    const secondSource = secondDocument.createElement('div');
    const firstTarget = firstDocument.createElement('div');
    const secondTarget = secondDocument.createElement('div');
    firstTarget.id = 'shared-host-id';
    secondTarget.id = 'shared-host-id';
    firstDocument.body.append(firstSource, firstTarget);
    secondDocument.body.append(secondSource, secondTarget);
    const projectors = [
      createWebA11yProjector(firstSource, undefined, registry),
      createWebA11yProjector(secondSource, undefined, registry),
      createWebA11yProjector(firstTarget, undefined, registry),
      createWebA11yProjector(secondTarget, undefined, registry),
    ];

    projectors[0](semanticSnapshot(firstSourceRef, { labelledBy: [firstTargetRef] }));
    projectors[1](semanticSnapshot(secondSourceRef, { labelledBy: [secondTargetRef] }));
    projectors[2](semanticSnapshot(firstTargetRef));
    projectors[3](semanticSnapshot(secondTargetRef));

    expect(firstSource.getAttribute('aria-labelledby')).toBe('shared-host-id');
    expect(secondSource.getAttribute('aria-labelledby')).toBe('shared-host-id');

    for (const projector of projectors) projector.dispose?.();
    expect(firstTarget.id).toBe('shared-host-id');
    expect(secondTarget.id).toBe('shared-host-id');
  });

  it('rebinds reservations and dependents when a target moves between documents', () => {
    // T-A11Y-0001-CASE-OPAQUE-RELATION-PROJECTION
    const registry = createWebA11yProjectionRegistry({ idPrefix: 'test-document-move' });
    const firstDocument = document.implementation.createHTMLDocument('first');
    const secondDocument = document.implementation.createHTMLDocument('second');
    const sourceRef = createA11ySemanticObjectRef();
    const targetRef = createA11ySemanticObjectRef();
    const replacementRef = createA11ySemanticObjectRef();
    const source = firstDocument.createElement('div');
    const target = firstDocument.createElement('div');
    firstDocument.body.append(source, target);
    const targetTarget = targetSlot(target);
    const sourceProjector = createWebA11yProjector(source, undefined, registry);
    const targetProjector = createWebA11yProjector(
      targetTarget.get,
      targetTarget.subscribe,
      registry
    );
    sourceProjector(semanticSnapshot(sourceRef, { labelledBy: [targetRef] }));
    targetProjector(semanticSnapshot(targetRef));
    const firstDocumentId = target.id;
    expect(source.getAttribute('aria-labelledby')).toBe(firstDocumentId);

    secondDocument.adoptNode(target);
    secondDocument.body.append(target);
    expect(target.ownerDocument).toBe(secondDocument);
    targetTarget.set(target);
    expect(source.hasAttribute('aria-labelledby')).toBe(false);

    const secondSource = secondDocument.createElement('div');
    secondDocument.body.append(secondSource);
    const secondSourceProjector = createWebA11yProjector(secondSource, undefined, registry);
    secondSourceProjector(
      semanticSnapshot(createA11ySemanticObjectRef(), { labelledBy: [targetRef] })
    );
    expect(secondSource.getAttribute('aria-labelledby')).toBe(target.id);

    const replacementTarget = firstDocument.createElement('div');
    replacementTarget.id = firstDocumentId;
    firstDocument.body.append(replacementTarget);
    const replacementProjector = createWebA11yProjector(replacementTarget, undefined, registry);
    sourceProjector(semanticSnapshot(sourceRef, { labelledBy: [replacementRef] }));
    replacementProjector(semanticSnapshot(replacementRef));
    expect(source.getAttribute('aria-labelledby')).toBe(firstDocumentId);

    replacementProjector.dispose?.();
    secondSourceProjector.dispose?.();
    targetProjector.dispose?.();
    sourceProjector.dispose?.();
  });

  it('does not reconcile the structured graph for an unrelated legacy update', () => {
    // T-A11Y-0001-CASE-OPAQUE-RELATION-PROJECTION
    const registry = createWebA11yProjectionRegistry({ idPrefix: 'test-targeted-reconcile' });
    const sourceRef = createA11ySemanticObjectRef();
    const targetRef = createA11ySemanticObjectRef();
    const legacyRef = createA11ySemanticObjectRef();
    const source = document.createElement('div');
    const target = document.createElement('div');
    const legacy = document.createElement('div');
    const sourceProjector = createWebA11yProjector(source, undefined, registry);
    const targetProjector = createWebA11yProjector(target, undefined, registry);
    const legacyProjector = createWebA11yProjector(legacy, undefined, registry);

    sourceProjector(semanticSnapshot(sourceRef, { labelledBy: [targetRef] }));
    targetProjector(semanticSnapshot(targetRef));
    const queryAll = vi.spyOn(document, 'querySelectorAll');
    try {
      legacyProjector(semanticSnapshot(legacyRef, { controls: 'legacy-target' }));
      expect(queryAll).not.toHaveBeenCalled();
    } finally {
      queryAll.mockRestore();
      legacyProjector.dispose?.();
      targetProjector.dispose?.();
      sourceProjector.dispose?.();
    }
  });
});

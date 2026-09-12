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

  it('3967157821: preserves the survivor reservation after releasing the reserved duplicate', () => {
    // C-A11Y-0001-N/O/P; T-A11Y-0001-CASE-OPAQUE-RELATION-PROJECTION.
    const registry = createWebA11yProjectionRegistry({ idPrefix: 'test-surviving-reservation' });
    const doc = document.implementation.createHTMLDocument('reservation-transfer');
    const targetRef = createA11ySemanticObjectRef();
    const otherRef = createA11ySemanticObjectRef();
    const source = doc.createElement('div');
    const otherSource = doc.createElement('div');
    const firstTarget = doc.createElement('span');
    const survivingTarget = doc.createElement('span');
    const rematerialized = doc.createElement('span');
    const otherTarget = doc.createElement('span');
    source.setAttribute('aria-controls', 'host-controls');
    doc.body.append(source, otherSource, firstTarget, survivingTarget, rematerialized);
    const survivingSlot = targetSlot(survivingTarget);
    const otherSlot = targetSlot(otherTarget);
    const sourceProjector = createWebA11yProjector(source, undefined, registry);
    const otherSourceProjector = createWebA11yProjector(otherSource, undefined, registry);
    const firstProjector = createWebA11yProjector(firstTarget, undefined, registry);
    const survivingProjector = createWebA11yProjector(
      survivingSlot.get,
      survivingSlot.subscribe,
      registry
    );
    const otherProjector = createWebA11yProjector(otherSlot.get, otherSlot.subscribe, registry);
    try {
      firstProjector(semanticSnapshot(targetRef));
      sourceProjector(semanticSnapshot(createA11ySemanticObjectRef(), { controls: [targetRef] }));
      const reservedId = firstTarget.id;
      expect(source.getAttribute('aria-controls')).toBe(reservedId);
      survivingProjector(semanticSnapshot(targetRef));
      expect(source.getAttribute('aria-controls')).toBe('host-controls');
      firstProjector.dispose?.();
      expect(survivingTarget.id).toBe(reservedId);
      expect(source.getAttribute('aria-controls')).toBe(reservedId);
      survivingSlot.set(null);

      otherTarget.id = reservedId;
      doc.body.append(otherTarget);
      otherProjector(semanticSnapshot(otherRef));
      otherSourceProjector(
        semanticSnapshot(createA11ySemanticObjectRef(), { controls: [otherRef] })
      );
      const competingRelation = otherSource.getAttribute('aria-controls');
      survivingSlot.set(rematerialized);
      // A real competing DOM id must still fail closed, even with a retained reservation.
      expect(doc.getElementById(reservedId)).toBe(otherTarget);
      expect(source.getAttribute('aria-controls')).toBe('host-controls');

      otherTarget.remove();
      otherSlot.set(null);
      expect(otherTarget.id).toBe(reservedId);
      expect(doc.getElementById(reservedId)).toBeNull();
      survivingSlot.set(null);
      survivingSlot.set(rematerialized);
      // Y remains logically alive, but has no physical id collision with the survivor.
      expect(source.getAttribute('aria-controls')).toBe(reservedId);
      expect(rematerialized.id).toBe(reservedId);
      expect(competingRelation).toBeNull();
    } finally {
      firstProjector.dispose?.();
      survivingProjector.dispose?.();
      otherProjector.dispose?.();
      sourceProjector.dispose?.();
      otherSourceProjector.dispose?.();
    }
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

  it('keeps shared scalar attributes until every projector releases them', () => {
    const registry = createWebA11yProjectionRegistry();
    const first = createWebA11yProjector(document.body, undefined, registry);
    const second = createWebA11yProjector(document.body, undefined, registry);
    first({ ...semanticSnapshot(createA11ySemanticObjectRef()), role: 'button' });
    second({ ...semanticSnapshot(createA11ySemanticObjectRef()), role: 'button' });
    expect(document.body.getAttribute('role')).toBe('button');
    first.dispose?.();
    expect(document.body.getAttribute('role')).toBe('button');
    second.dispose?.();
    expect(document.body.hasAttribute('role')).toBe(false);
  });

  it('3980446677: restores an overwritten host scalar baseline on release', () => {
    // C-A11Y-0001-P: terminal release preserves the host-owned baseline.
    const registry = createWebA11yProjectionRegistry();
    const target = document.createElement('div');
    target.setAttribute('role', 'navigation');
    const projector = createWebA11yProjector(target, undefined, registry);
    projector({ ...semanticSnapshot(createA11ySemanticObjectRef()), role: 'button' });
    expect(target.getAttribute('role')).toBe('button');
    projector.dispose?.();
    expect(target.getAttribute('role')).toBe('navigation');
  });

  it('preserves a matching host scalar baseline with reverse shared-owner release', () => {
    const registry = createWebA11yProjectionRegistry();
    const target = document.createElement('div');
    target.setAttribute('role', 'button');
    const first = createWebA11yProjector(target, undefined, registry);
    const second = createWebA11yProjector(target, undefined, registry);
    first({ ...semanticSnapshot(createA11ySemanticObjectRef()), role: 'button' });
    second({ ...semanticSnapshot(createA11ySemanticObjectRef()), role: 'button' });
    second.dispose?.();
    expect(target.getAttribute('role')).toBe('button');
    first.dispose?.();
    expect(target.getAttribute('role')).toBe('button');
  });

  it('3980446683: preserves host heading levels through detach and rematerialization', () => {
    // C-A11Y-0001-P/LEVEL: release this projection, not host-owned aria-level.
    const registry = createWebA11yProjectionRegistry();
    const target = document.createElement('h4');
    target.setAttribute('aria-level', '4');
    const slot = targetSlot(target);
    const projector = createWebA11yProjector(slot.get, slot.subscribe, registry);
    const snapshot = {
      ...semanticSnapshot(createA11ySemanticObjectRef()),
      role: 'heading',
      level: 4,
    };
    projector(snapshot);
    projector.clearHeadingLevel?.();
    projector.detach?.();
    expect(target.getAttribute('aria-level')).toBe('4');
    const replacement = document.createElement('h3');
    replacement.setAttribute('aria-level', '3');
    slot.set(replacement);
    projector.reactivate?.();
    projector({ ...snapshot, level: 5 });
    expect(target.getAttribute('aria-level')).toBe('4');
    expect(replacement.getAttribute('aria-level')).toBe('5');
    projector.dispose?.();
    expect(target.getAttribute('aria-level')).toBe('4');
    expect(replacement.getAttribute('aria-level')).toBe('3');
  });

  it('3980446683: retains a live shared heading owner after another view detaches', () => {
    const registry = createWebA11yProjectionRegistry();
    const target = document.createElement('h4');
    const first = createWebA11yProjector(target, undefined, registry);
    const second = createWebA11yProjector(target, undefined, registry);
    const firstSnapshot = {
      ...semanticSnapshot(createA11ySemanticObjectRef()),
      role: 'heading',
      level: 4,
    };
    first(firstSnapshot);
    second({ ...semanticSnapshot(createA11ySemanticObjectRef()), role: 'heading', level: 4 });
    first.clearHeadingLevel?.();
    first.detach?.();
    expect(target.getAttribute('aria-level')).toBe('4');
    first.reactivate?.();
    first(firstSnapshot);
    first({ ...firstSnapshot, level: undefined });
    expect(target.getAttribute('aria-level')).toBe('4');
    first.dispose?.();
    expect(target.getAttribute('aria-level')).toBe('4');
    second.clearHeadingLevel?.();
    second.detach?.();
    expect(target.hasAttribute('aria-level')).toBe(false);
    second.dispose?.();
    expect(target.hasAttribute('aria-level')).toBe(false);
  });

  it('rebinds a reserved target when the host changes its id', () => {
    const registry = createWebA11yProjectionRegistry({ idPrefix: 'test-id-rebind' });
    const sourceRef = createA11ySemanticObjectRef();
    const targetRef = createA11ySemanticObjectRef();
    const source = document.createElement('div');
    const target = document.createElement('div');
    const sourceProjector = createWebA11yProjector(source, undefined, registry);
    const targetProjector = createWebA11yProjector(target, undefined, registry);

    sourceProjector(semanticSnapshot(sourceRef, { labelledBy: [targetRef] }));
    targetProjector({ ...semanticSnapshot(targetRef), id: 'first-id' });
    expect(source.getAttribute('aria-labelledby')).toBe('first-id');
    targetProjector({ ...semanticSnapshot(targetRef), id: 'second-id' });
    expect(target.id).toBe('second-id');
    expect(source.getAttribute('aria-labelledby')).toBe('second-id');

    sourceProjector.dispose?.();
    targetProjector.dispose?.();
  });

  it.each(['generated', 'host-authored'] as const)(
    'PUI-625-SCALAR-GENERATED-ID-BASELINE: releases an explicit id after %s identity',
    (provenance) => {
      // C-A11Y-0001-P/N: equal-looking IDs have different ownership provenance.
      const registry = createWebA11yProjectionRegistry({ idPrefix: 'test-id-provenance' });
      const doc = document.implementation.createHTMLDocument('id-provenance');
      const source = doc.createElement('div');
      const target = doc.createElement('div');
      doc.body.append(source, target);
      const hostId = provenance === 'host-authored' ? 'test-id-provenance-1' : null;
      if (hostId !== null) target.id = hostId;
      source.setAttribute('aria-labelledby', 'host-caption');
      const targetRef = createA11ySemanticObjectRef();
      const sourceProjector = createWebA11yProjector(source, undefined, registry);
      const targetProjector = createWebA11yProjector(target, undefined, registry);
      sourceProjector(semanticSnapshot(createA11ySemanticObjectRef(), { labelledBy: [targetRef] }));
      targetProjector(semanticSnapshot(targetRef));
      const initialId = target.id;
      expect(initialId).not.toBe('');
      expect(source.getAttribute('aria-labelledby')).toBe(initialId);

      targetProjector({ ...semanticSnapshot(targetRef), id: 'explicit-id' });
      expect(target.id).toBe('explicit-id');
      expect(source.getAttribute('aria-labelledby')).toBe('explicit-id');
      targetProjector.dispose?.();
      expect(source.getAttribute('aria-labelledby')).toBe('host-caption');
      expect(target.getAttribute('id')).toBe(hostId);
      sourceProjector.dispose?.();
      expect(source.getAttribute('aria-labelledby')).toBe('host-caption');
      expect(target.getAttribute('id')).toBe(hostId);
    }
  );

  it.each(['generator-first', 'writer-first'] as const)(
    'PUI-625-SCALAR-GENERATED-ID-BASELINE: shared-target provenance, %s disposal',
    (order) => {
      // C-A11Y-0001-N/P: shared physical targets do not turn another record's id into host data.
      const registry = createWebA11yProjectionRegistry({ idPrefix: 'shared-generated' });
      const doc = document.implementation.createHTMLDocument('shared-generated');
      const source = doc.createElement('div');
      const target = doc.createElement('div');
      doc.body.append(source, target);
      source.setAttribute('aria-labelledby', 'host-caption');
      const generatedRef = createA11ySemanticObjectRef();
      const generator = createWebA11yProjector(target, undefined, registry);
      const writer = createWebA11yProjector(target, undefined, registry);
      const sourceProjector = createWebA11yProjector(source, undefined, registry);
      sourceProjector(
        semanticSnapshot(createA11ySemanticObjectRef(), { labelledBy: [generatedRef] })
      );
      generator(semanticSnapshot(generatedRef));
      expect(target.id).not.toBe('');
      expect(source.getAttribute('aria-labelledby')).toBe(target.id);
      writer({ ...semanticSnapshot(createA11ySemanticObjectRef()), id: 'explicit-shared-id' });
      expect(target.id).toBe('explicit-shared-id');
      if (order === 'generator-first') {
        generator.dispose?.();
        expect(target.id).toBe('explicit-shared-id');
        writer.dispose?.();
      } else {
        writer.dispose?.();
        generator.dispose?.();
      }
      expect(source.getAttribute('aria-labelledby')).toBe('host-caption');
      expect(target.hasAttribute('id')).toBe(false);
      sourceProjector.dispose?.();
      expect(source.getAttribute('aria-labelledby')).toBe('host-caption');
    }
  );

  it.each([
    ['same', 'writer-first'],
    ['same', 'generator-first'],
    ['different', 'writer-first'],
    ['different', 'generator-first'],
  ] as const)('PUI-625-GENERATED-ID-SURVIVOR-RELEASE: %s id, %s', (identity, order) => {
    // C-A11Y-0001-N/O/P: release must re-resolve the surviving opaque-ref dependent.
    const doc = document.implementation.createHTMLDocument('same-id-survivor');
    const target = doc.createElement('div');
    const source = doc.createElement('button');
    const caption = doc.createElement('span');
    caption.id = 'host-caption';
    doc.body.append(source, target, caption);
    source.setAttribute('aria-labelledby', caption.id);
    const registry = createWebA11yProjectionRegistry();
    const generatedRef = createA11ySemanticObjectRef();
    const generator = createWebA11yProjector(target, undefined, registry);
    const writer = createWebA11yProjector(target, undefined, registry);
    const dependent = createWebA11yProjector(source, undefined, registry);
    const observe = () => {
      const idref = source.getAttribute('aria-labelledby');
      const resolved = idref ? doc.getElementById(idref) : null;
      return {
        targetId: target.getAttribute('id'),
        idref,
        resolved: resolved === target ? 'target' : resolved === caption ? 'caption' : null,
      };
    };
    dependent(semanticSnapshot(createA11ySemanticObjectRef(), { labelledBy: [generatedRef] }));
    generator(semanticSnapshot(generatedRef));
    const generatedId = target.id;
    const initial = observe();
    const explicitId = identity === 'same' ? generatedId : 'different-explicit-id';
    writer({ ...semanticSnapshot(createA11ySemanticObjectRef()), id: explicitId });
    const takeover = observe();
    (order === 'writer-first' ? writer : generator).dispose?.();
    const survivor = observe();
    (order === 'writer-first' ? generator : writer).dispose?.();
    const bothGone = observe();
    dependent.dispose?.();
    const terminal = observe();
    const live = { targetId: generatedId, idref: generatedId, resolved: 'target' };
    const released = { targetId: null, idref: caption.id, resolved: 'caption' };
    // Different-id takeover makes G unavailable under its existing reservation (C-A11Y-0001-O).
    const writerOnly = { targetId: explicitId, idref: caption.id, resolved: 'caption' };
    expect({ initial, takeover, survivor, bothGone, terminal }).toEqual({
      initial: live,
      takeover: identity === 'same' ? live : writerOnly,
      survivor: order === 'writer-first' ? live : writerOnly,
      bothGone: released,
      terminal: released,
    });
  });

  it('retains generated identity through shared writer updates and detached final release', () => {
    // C-A11Y-0001-N/P: the shared lifetime outlives one writer, including a detached cap.
    const doc = document.implementation.createHTMLDocument('shared-id-survivor');
    const target = doc.createElement('div');
    const source = doc.createElement('button');
    const caption = doc.createElement('span');
    caption.id = 'host-caption';
    doc.body.append(target, source, caption);
    source.setAttribute('aria-labelledby', caption.id);
    const registry = createWebA11yProjectionRegistry();
    const generatedRef = createA11ySemanticObjectRef();
    const writerRef = createA11ySemanticObjectRef();
    const generator = createWebA11yProjector(target, undefined, registry);
    const first = createWebA11yProjector(target, undefined, registry);
    const second = createWebA11yProjector(target, undefined, registry);
    const dependent = createWebA11yProjector(source, undefined, registry);
    dependent(semanticSnapshot(createA11ySemanticObjectRef(), { labelledBy: [generatedRef] }));
    generator(semanticSnapshot(generatedRef));
    const id = target.id;
    const observe = () => ({
      id: target.getAttribute('id'),
      idref: source.getAttribute('aria-labelledby'),
      resolved: doc.getElementById(source.getAttribute('aria-labelledby')!) === target,
    });
    const initial = observe();
    first({ ...semanticSnapshot(writerRef), id });
    const takeover = observe();
    first({ ...semanticSnapshot(writerRef), id, role: 'button' });
    const updated = observe();
    second({ ...semanticSnapshot(createA11ySemanticObjectRef()), id });
    const shared = observe();
    first.dispose?.();
    const survivor = observe();
    second.detach?.();
    const detached = observe();
    second.dispose?.();
    const released = observe();
    generator.dispose?.();
    const generatorGone = observe();
    dependent.dispose?.();
    const terminal = observe();
    const live = { id, idref: id, resolved: true };
    const gone = { id: null, idref: caption.id, resolved: false };
    expect({
      initial,
      takeover,
      updated,
      shared,
      survivor,
      detached,
      released,
      generatorGone,
      terminal,
    }).toEqual({
      initial: live,
      takeover: live,
      updated: live,
      shared: live,
      survivor: live,
      detached: live,
      released: live,
      generatorGone: gone,
      terminal: gone,
    });
    expect(doc.getElementById(source.getAttribute('aria-labelledby')!)).toBe(caption);
  });

  it('PUI-625-LOCAL-LEASED-HOST-ID-REBIND: follows a live ID change with an older cap lease', () => {
    // C-A11Y-0001-P; HC-A11Y-0001-C. Distinct from a replacement's initial ID mismatch.
    const registry = createWebA11yProjectionRegistry({ idPrefix: 'test-cap-id-rebind' });
    const doc = document.implementation.createHTMLDocument('cap-id-rebind');
    const source = doc.createElement('div');
    const target = doc.createElement('div');
    doc.body.append(source, target);
    source.setAttribute('aria-labelledby', 'host-label');
    const targetRef = createA11ySemanticObjectRef();
    const slot = targetSlot(target);
    const sourceProjector = createWebA11yProjector(source, undefined, registry);
    const first = createWebA11yProjector(target, undefined, registry);
    const second = createWebA11yProjector(slot.get, slot.subscribe, registry);
    try {
      sourceProjector(semanticSnapshot(createA11ySemanticObjectRef(), { labelledBy: [targetRef] }));
      first(semanticSnapshot(targetRef));
      const reservedId = target.id;
      expect(source.getAttribute('aria-labelledby')).toBe(reservedId);
      first.detach?.();
      second(semanticSnapshot(targetRef));
      // Successful resolution proves A is no longer a duplicate live binding.
      expect(source.getAttribute('aria-labelledby')).toBe(reservedId);
      target.id = 'current-host-id';
      expect(doc.querySelectorAll('[id="current-host-id"]')).toHaveLength(1);
      expect(doc.getElementById(reservedId)).toBeNull();
      slot.set(target);
      expect(target.id).toBe('current-host-id');
      expect(source.getAttribute('aria-labelledby')).toBe('current-host-id');
      first.dispose?.();
      expect(source.getAttribute('aria-labelledby')).toBe('current-host-id');
      second.dispose?.();
      expect(target.id).toBe('current-host-id');
      expect(source.getAttribute('aria-labelledby')).toBe('host-label');
    } finally {
      first.dispose?.();
      second.dispose?.();
      sourceProjector.dispose?.();
    }
  });

  it('keeps an appended token until every projector releases it', () => {
    const registry = createWebA11yProjectionRegistry({ idPrefix: 'test-shared-append' });
    const sourceRef = createA11ySemanticObjectRef();
    const firstRef = createA11ySemanticObjectRef();
    const target = document.createElement('div');
    const source = document.createElement('div');
    const first = createWebA11yProjector(source, undefined, registry);
    const second = createWebA11yProjector(source, undefined, registry);
    const targetProjector = createWebA11yProjector(target, undefined, registry);

    targetProjector(semanticSnapshot(firstRef));
    first(semanticSnapshot(sourceRef, { describedBy: [firstRef] }, { describedBy: 'append' }));
    second(semanticSnapshot(sourceRef, { describedBy: [firstRef] }, { describedBy: 'append' }));
    const projectedId = source.getAttribute('aria-describedby');
    expect(projectedId).toBe(target.id);
    first.dispose?.();
    expect(source.getAttribute('aria-describedby')).toBe(projectedId);
    second.dispose?.();
    expect(source.hasAttribute('aria-describedby')).toBe(false);

    targetProjector.dispose?.();
  });
  it('does not clear a host id written after projector disposal begins', () => {
    const registry = createWebA11yProjectionRegistry();
    const ref = createA11ySemanticObjectRef();
    const target = document.createElement('div');
    const projector = createWebA11yProjector(target, undefined, registry);

    projector({ ...semanticSnapshot(ref), id: 'projected-id' });
    target.id = 'host-id';
    projector.dispose?.();
    expect(target.id).toBe('host-id');
  });
  it('preserves a host id written after detach before terminal disposal', () => {
    const registry = createWebA11yProjectionRegistry();
    const projector = createWebA11yProjector(document.createElement('div'), undefined, registry);
    const target = document.createElement('div');
    const slot = targetSlot(target);
    const targetProjector = createWebA11yProjector(slot.get, slot.subscribe, registry);
    targetProjector({ ...semanticSnapshot(createA11ySemanticObjectRef()), id: 'projected-id' });
    targetProjector.detach?.();
    target.id = 'host-id';
    targetProjector.dispose?.();
    expect(target.id).toBe('host-id');
    projector.dispose?.();
  });

  it('retains a token when one projector changes append mode to replace', () => {
    const registry = createWebA11yProjectionRegistry({ idPrefix: 'test-append-replace' });
    const sourceRef = createA11ySemanticObjectRef();
    const targetRef = createA11ySemanticObjectRef();
    const source = document.createElement('div');
    const target = document.createElement('div');
    const first = createWebA11yProjector(source, undefined, registry);
    const second = createWebA11yProjector(source, undefined, registry);
    const targetProjector = createWebA11yProjector(target, undefined, registry);
    targetProjector(semanticSnapshot(targetRef));
    first(semanticSnapshot(sourceRef, { labelledBy: [targetRef] }, { labelledBy: 'append' }));
    second(semanticSnapshot(sourceRef, { labelledBy: [targetRef] }, { labelledBy: 'append' }));
    const targetId = source.getAttribute('aria-labelledby');
    first(semanticSnapshot(sourceRef, { labelledBy: [targetRef] }));
    second.dispose?.();
    expect(source.getAttribute('aria-labelledby')).toBe(targetId);
    first.dispose?.();
    expect(source.hasAttribute('aria-labelledby')).toBe(false);
    targetProjector.dispose?.();
  });

  it('does not restore historical IDREFs over a host rewrite', () => {
    const registry = createWebA11yProjectionRegistry();
    const source = document.createElement('div');
    const target = document.createElement('div');
    const targetRef = createA11ySemanticObjectRef();
    const sourceProjector = createWebA11yProjector(source, undefined, registry);
    const targetProjector = createWebA11yProjector(target, undefined, registry);
    source.setAttribute('aria-labelledby', 'host-old');
    targetProjector(semanticSnapshot(targetRef));
    sourceProjector(semanticSnapshot(createA11ySemanticObjectRef(), { labelledBy: [targetRef] }));
    expect(source.getAttribute('aria-labelledby')).toBe(target.id);
    source.setAttribute('aria-labelledby', 'host-new');
    sourceProjector.dispose?.();
    targetProjector.dispose?.();
    expect(source.getAttribute('aria-labelledby')).toBe('host-new');
  });

  it.each(['older-first', 'newer-first'] as const)(
    'restores only the host baseline after overlapping replacements are disposed %s',
    (order) => {
      const registry = createWebA11yProjectionRegistry();
      const source = document.createElement('div');
      source.setAttribute('aria-labelledby', 'host-label');
      const targets = [document.createElement('div'), document.createElement('div')];
      const refs = targets.map(() => createA11ySemanticObjectRef());
      const targetProjectors = targets.map((target, index) => {
        const projector = createWebA11yProjector(target, undefined, registry);
        projector(semanticSnapshot(refs[index]));
        return projector;
      });
      const sources = refs.map((ref) => {
        const projector = createWebA11yProjector(source, undefined, registry);
        projector(semanticSnapshot(createA11ySemanticObjectRef(), { labelledBy: [ref] }));
        return projector;
      });
      expect(source.getAttribute('aria-labelledby')).toBe(targets[1].id);
      const first = order === 'older-first' ? 0 : 1;
      sources[first].dispose?.();
      expect(source.getAttribute('aria-labelledby')).toBe(targets[1 - first].id);
      sources[1 - first].dispose?.();
      expect(source.getAttribute('aria-labelledby')).toBe('host-label');
      for (const projector of targetProjectors) projector.dispose?.();
    }
  );

  it('releases one scalar binding before reentering the same physical target', () => {
    const registry = createWebA11yProjectionRegistry();
    const target = document.createElement('div');
    const slot = targetSlot(target);
    const projector = createWebA11yProjector(slot.get, slot.subscribe, registry);
    projector({
      ...semanticSnapshot(createA11ySemanticObjectRef()),
      role: 'button',
      states: { busy: true },
    });
    expect(target.getAttribute('role')).toBe('button');
    expect(target.getAttribute('aria-busy')).toBe('true');
    slot.set(null);
    expect(target.hasAttribute('role')).toBe(false);
    expect(target.hasAttribute('aria-busy')).toBe(false);
    slot.set(target);
    expect(target.getAttribute('role')).toBe('button');
    expect(target.getAttribute('aria-busy')).toBe('true');
    projector.dispose?.();
    expect(target.hasAttribute('role')).toBe(false);
    expect(target.hasAttribute('aria-busy')).toBe(false);
  });

  it('preserves shared scalar ownership and host rewrites during physical replacement', () => {
    const registry = createWebA11yProjectionRegistry();
    const original = document.createElement('div');
    const replacement = document.createElement('div');
    const slot = targetSlot(original);
    const moving = createWebA11yProjector(slot.get, slot.subscribe, registry);
    const staying = createWebA11yProjector(original, undefined, registry);
    moving({
      ...semanticSnapshot(createA11ySemanticObjectRef()),
      role: 'button',
      name: { kind: 'text', value: 'projected' },
    });
    staying({ ...semanticSnapshot(createA11ySemanticObjectRef()), role: 'button' });
    original.setAttribute('aria-label', 'host-label');
    slot.set(replacement);
    expect(original.getAttribute('role')).toBe('button');
    expect(original.getAttribute('aria-label')).toBe('host-label');
    expect(replacement.getAttribute('role')).toBe('button');
    moving.dispose?.();
    expect(replacement.hasAttribute('role')).toBe(false);
    expect(replacement.hasAttribute('aria-label')).toBe(false);
    expect(original.getAttribute('role')).toBe('button');
    staying.dispose?.();
    expect(original.hasAttribute('role')).toBe(false);
    expect(original.getAttribute('aria-label')).toBe('host-label');
  });

  it('PUI-625-LOCAL-LIVE-APPEND-RESTORE: restores a live append after replacement release', () => {
    // T-A11Y-0001-CASE-OPAQUE-RELATION-PROJECTION; C-A11Y-0001-K/P.
    const registry = createWebA11yProjectionRegistry();
    const source = document.createElement('div');
    source.setAttribute('aria-labelledby', 'host-label');
    const targets = ['a', 'b'].map((id) => {
      const target = document.createElement('span');
      target.id = id;
      const ref = createA11ySemanticObjectRef();
      const projector = createWebA11yProjector(target, undefined, registry);
      projector(semanticSnapshot(ref));
      return { ref, projector };
    });
    const append = createWebA11yProjector(source, undefined, registry);
    const replace = createWebA11yProjector(source, undefined, registry);
    append(
      semanticSnapshot(
        createA11ySemanticObjectRef(),
        { labelledBy: [targets[0].ref] },
        { labelledBy: 'append' }
      )
    );
    expect(source.getAttribute('aria-labelledby')).toBe('host-label a');
    replace(semanticSnapshot(createA11ySemanticObjectRef(), { labelledBy: [targets[1].ref] }));
    expect(source.getAttribute('aria-labelledby')).toBe('b');
    replace.dispose?.();
    expect(source.getAttribute('aria-labelledby')).toBe('host-label a');
    append.dispose?.();
    expect(source.getAttribute('aria-labelledby')).toBe('host-label');
    for (const target of targets) target.projector.dispose?.();
  });

  it.each([
    { releaseOrder: 'legacy-first', hostBaseline: false },
    { releaseOrder: 'structured-first', hostBaseline: false },
    { releaseOrder: 'legacy-first', hostBaseline: true },
    { releaseOrder: 'structured-first', hostBaseline: true },
  ])(
    'PUI-625-LOCAL-MIXED-IDREF-OWNERS: $releaseOrder, host baseline=$hostBaseline',
    ({ releaseOrder, hostBaseline }) => {
      // T-A11Y-0001-CASE-OPAQUE-RELATION-PROJECTION; C-A11Y-0001-H/K/P.
      const registry = createWebA11yProjectionRegistry();
      const source = document.createElement('div');
      if (hostBaseline) source.setAttribute('aria-labelledby', 't');
      const target = document.createElement('span');
      target.id = 't';
      const targetRef = createA11ySemanticObjectRef();
      const targetProjector = createWebA11yProjector(target, undefined, registry);
      targetProjector(semanticSnapshot(targetRef));
      const legacy = createWebA11yProjector(source, undefined, registry);
      const structured = createWebA11yProjector(source, undefined, registry);
      legacy(semanticSnapshot(createA11ySemanticObjectRef(), { labelledBy: 't' }));
      structured(
        semanticSnapshot(
          createA11ySemanticObjectRef(),
          { labelledBy: [targetRef] },
          { labelledBy: 'append' }
        )
      );
      expect(source.getAttribute('aria-labelledby')).toBe('t');
      const [first, last] =
        releaseOrder === 'legacy-first' ? [legacy, structured] : [structured, legacy];
      first.dispose?.();
      expect(source.getAttribute('aria-labelledby')).toBe('t');
      last.dispose?.();
      expect(source.getAttribute('aria-labelledby')).toBe(hostBaseline ? 't' : null);
      targetProjector.dispose?.();
    }
  );
});

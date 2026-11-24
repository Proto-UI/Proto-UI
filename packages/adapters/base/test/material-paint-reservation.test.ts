import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  connectWebMaterialPaintReservation,
  createWebMaterialPaintReservationRef as legacyReservationRef,
  updateWebMaterialPaintReservation,
  releaseWebMaterialPaintFootprint,
  type MaterialPaintFootprint,
} from '../src/material/paint-reservation';
import { createWebMaterialPaintReservationRef } from '../src';
import { createAnatomyFamily, type AnatomyPartView } from '@proto.ui/core';
import type { AnatomyPort } from '@proto.ui/module-anatomy';
import { MaterialPaintReservationRegistry } from '@proto.ui/module-feedback';

// Explicit geometry injection. These tests exercise ownership and admission
// transitions; actual CSS sizing and optical pixels require the native probe.
function fixture() {
  const part = document.createElement('div');
  const target = document.createElement('button');
  part.append(target);
  document.body.append(part);
  let width = 200,
    height = 48;
  const number = (property: string) => parseFloat(part.style.getPropertyValue(property) || '0');
  vi.spyOn(target, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(50 + number('padding-left'), 50 + number('padding-top'), width, height)
  );
  vi.spyOn(part, 'getBoundingClientRect').mockImplementation(
    () =>
      new DOMRect(
        50,
        50,
        width + number('padding-left') + number('padding-right'),
        height + number('padding-top') + number('padding-bottom')
      )
  );
  const release = connectWebMaterialPaintReservation(target, part, {});
  return {
    part,
    target,
    release,
    dimensions(w: number, h: number) {
      width = w;
      height = h;
    },
  };
}
const footprint = (patch: Partial<MaterialPaintFootprint> = {}): MaterialPaintFootprint => ({
  view: 1,
  revision: 1,
  profile: 'fixture-profile',
  edges: { top: 17, right: 17, bottom: 17, left: 17 },
  ...patch,
});

// Real logical registry and public physical callbacks; only Anatomy lookup and
// geometry are injected. A separate lazy geometry module must see the same leases.
function logicalTarget(target: HTMLElement) {
  const family = createAnatomyFamily('material-reservation-entry-ownership', {
    roles: {
      root: { cardinality: { min: 1, max: 1 } },
      heading: { cardinality: { min: 1, max: 1 } },
      target: { cardinality: { min: 1, max: 1 } },
    },
    relations: [
      { kind: 'contains', parent: 'root', child: 'heading' },
      { kind: 'contains', parent: 'heading', child: 'target' },
    ],
  });
  const unused = (): never => {
    throw new Error('unexpected Anatomy operation');
  };
  const self = {};
  const part: AnatomyPartView = {
    role: 'target',
    hasExpose: unused,
    getExpose: unused,
    hasHook: unused,
  };
  const anatomy: AnatomyPort = {
    resolveSelfInstance: () => self,
    resolveSelfRole: () => 'heading',
    parts: () => [part],
    isCurrentPart: () => true,
    resolveAncestorInstance: () => self,
    resolvePartTarget: () => target,
    subscribeOrder: () => () => {},
    subscribeTargets: () => () => {},
    getDiagnostics: unused,
    syncStructure: unused,
    resolvePartInstance: unused,
    resolveDomainScope: unused,
    descendantsOf: unused,
    order: {
      version: unused,
      parts: unused,
      partsOf: unused,
      indexOfSelf: unused,
      prevOfSelf: unused,
      nextOfSelf: unused,
    },
    setOrderCallbackDispatcher: unused,
  };
  const registry = new MaterialPaintReservationRegistry(() => anatomy);
  return { registry, declare: () => registry.declare({ family, targetRole: 'target' }) };
}
afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('draft host-local material paint reservation', () => {
  it('shares public callback ownership with the lazy geometry entry and preserves a same-node successor', () => {
    const f = fixture();
    f.release();
    const { registry, declare } = logicalTarget(f.target);
    const ref = createWebMaterialPaintReservationRef(declare());
    expect(legacyReservationRef).toBe(createWebMaterialPaintReservationRef);
    ref(f.part);
    registry.setActive(true);
    try {
      expect(updateWebMaterialPaintReservation(f.target, footprint())).toMatchObject({
        reason: 'paint-reservation-layout-pending',
      });
      const first = updateWebMaterialPaintReservation(f.target, footprint());
      expect(first.status).toBe('ready');
      const next = connectWebMaterialPaintReservation(f.target, f.part, {});
      try {
        expect(first.status === 'ready' && first.current()).toBe(false);
        updateWebMaterialPaintReservation(f.target, footprint({ view: 2 }));
        ref(null);
        expect(f.part.style.width).toBe('200px');
        expect(updateWebMaterialPaintReservation(f.target, footprint({ view: 2 })).status).toBe(
          'ready'
        );
      } finally {
        next();
      }
      expect(f.part.style.width).toBe('');
      expect(f.part.style.padding).toBe('');
      expect(updateWebMaterialPaintReservation(f.target, footprint())).toMatchObject({
        reason: 'paint-reservation-missing',
      });
      expect(f.target.parentNode).toBe(f.part);
    } finally {
      ref(null);
      registry.dispose();
    }
  });

  it('retains callback collision and cleanup across the public and lazy geometry entries', () => {
    const f = fixture();
    f.release();
    const other = document.createElement('div');
    document.body.append(other);
    const { registry, declare } = logicalTarget(f.target);
    const first = createWebMaterialPaintReservationRef(declare());
    const second = createWebMaterialPaintReservationRef(declare());
    first(f.part);
    second(other);
    registry.setActive(true);
    try {
      expect(updateWebMaterialPaintReservation(f.target, footprint())).toMatchObject({
        reason: 'paint-reservation-ambiguous',
      });
      second(null);
      expect(other.style.display).toBe('');
      expect(f.part.style.display).toBe('block');
      updateWebMaterialPaintReservation(f.target, footprint());
      const ready = updateWebMaterialPaintReservation(f.target, footprint());
      expect(ready.status).toBe('ready');
      registry.setActive(false);
      expect(ready.status === 'ready' && ready.current()).toBe(false);
      expect(f.part.style.width).toBe('');
      expect(f.part.style.padding).toBe('');
      expect(updateWebMaterialPaintReservation(f.target, footprint())).toMatchObject({
        reason: 'paint-reservation-missing',
      });
      expect(f.target.parentNode).toBe(f.part);
    } finally {
      first(null);
      second(null);
      registry.dispose();
    }
  });

  it('owns only exact part geometry and requires a later observed layout before ready', () => {
    const f = fixture();
    f.target.style.padding = '12px 16px';
    const targetStyle = f.target.getAttribute('style');
    const writes = vi.spyOn(f.part.style, 'setProperty');
    expect(updateWebMaterialPaintReservation(f.target, footprint())).toEqual({
      status: 'unavailable',
      reason: 'paint-reservation-layout-pending',
    });
    expect(f.part.style.width).toBe('200px');
    expect(f.part.style.padding).toBe('17px');
    const admitted = updateWebMaterialPaintReservation(f.target, footprint());
    expect(admitted.status).toBe('ready');
    expect(admitted.status === 'ready' && admitted.current()).toBe(true);
    const count = writes.mock.calls.length;
    expect(updateWebMaterialPaintReservation(f.target, footprint()).status).toBe('ready');
    expect(writes).toHaveBeenCalledTimes(count);
    expect(f.target.getAttribute('style')).toBe(targetStyle);
    f.release();
    expect(f.part.style.width).toBe('');
    expect(f.part.style.padding).toBe('');
    expect(admitted.status === 'ready' && admitted.current()).toBe(false);
    expect(f.target.parentNode).toBe(f.part);
    expect(f.target.getAttribute('style')).toBe(targetStyle);
  });

  it('keeps unknown, missing, invalid, stale and infeasible geometry unavailable', () => {
    const f = fixture();
    expect(updateWebMaterialPaintReservation(f.target, null)).toMatchObject({
      status: 'unavailable',
    });
    for (const edges of [
      { top: 0, right: 0, bottom: 0, left: NaN },
      { top: 0, right: 0, bottom: 0 },
      { top: -1, right: 0, bottom: 0, left: 0 },
    ])
      expect(
        updateWebMaterialPaintReservation(f.target, footprint({ edges: edges as any }))
      ).toMatchObject({
        status: 'unavailable',
        reason: 'paint-footprint-unavailable',
      });
    updateWebMaterialPaintReservation(f.target, footprint({ revision: 4 }));
    expect(updateWebMaterialPaintReservation(f.target, footprint({ revision: 3 }))).toMatchObject({
      status: 'unavailable',
      reason: 'paint-footprint-stale',
    });
    f.dimensions(180, 48);
    expect(updateWebMaterialPaintReservation(f.target, footprint({ revision: 5 }))).toMatchObject({
      status: 'unavailable',
      reason: 'paint-reservation-constraints-unavailable',
    });
    f.release();
  });

  it('does not absorb consumer padding or a part wrapping additional content', () => {
    const f = fixture();
    f.part.style.padding = '5px';
    expect(updateWebMaterialPaintReservation(f.target, footprint())).toMatchObject({
      status: 'unavailable',
    });
    f.release();
    expect(f.part.style.padding).toBe('5px');
    const g = fixture();
    vi.mocked(g.part.getBoundingClientRect).mockReturnValue(new DOMRect(50, 50, 200, 100));
    expect(updateWebMaterialPaintReservation(g.target, footprint())).toEqual({
      status: 'unavailable',
      reason: 'paint-reservation-part-not-exact',
    });
    g.release();
  });

  it('does not erase later consumer styles and rejects late image installation after revocation', () => {
    const f = fixture();
    updateWebMaterialPaintReservation(f.target, footprint());
    const ready = updateWebMaterialPaintReservation(f.target, footprint());
    f.part.style.setProperty('padding-top', '29px', 'important');
    expect(ready.status === 'ready' && ready.current()).toBe(false);
    expect(updateWebMaterialPaintReservation(f.target, footprint())).toMatchObject({
      status: 'unavailable',
      reason: 'paint-reservation-style-conflict',
    });
    f.release();
    expect(f.part.style.getPropertyValue('padding-top')).toBe('29px');
    expect(f.part.style.getPropertyPriority('padding-top')).toBe('important');
  });

  it('revokes exact view facts, rejects ambiguous target owners and preserves same-node successors', () => {
    const f = fixture();
    updateWebMaterialPaintReservation(f.target, footprint());
    const ready = updateWebMaterialPaintReservation(f.target, footprint());
    releaseWebMaterialPaintFootprint(f.target, 0);
    expect(ready.status === 'ready' && ready.current()).toBe(true);
    releaseWebMaterialPaintFootprint(f.target, 1);
    expect(ready.status === 'ready' && ready.current()).toBe(false);
    const next = connectWebMaterialPaintReservation(f.target, f.part, {});
    updateWebMaterialPaintReservation(f.target, footprint({ view: 2 }));
    f.release();
    expect(f.part.style.width).toBe('200px');
    expect(updateWebMaterialPaintReservation(f.target, footprint({ view: 2 })).status).toBe(
      'ready'
    );
    const other = document.createElement('div');
    document.body.append(other);
    const ambiguous = connectWebMaterialPaintReservation(f.target, other, {});
    expect(updateWebMaterialPaintReservation(f.target, footprint({ view: 2 }))).toMatchObject({
      status: 'unavailable',
      reason: 'paint-reservation-ambiguous',
    });
    ambiguous();
    next();
  });

  it('cannot write a stale part after a layout read reenters a new owner', () => {
    const f = fixture();
    const replacement: { current: (() => void) | null } = { current: null };
    vi.mocked(f.target.getBoundingClientRect).mockImplementationOnce(() => {
      replacement.current = connectWebMaterialPaintReservation(f.target, f.part, {});
      return new DOMRect(50, 50, 200, 48);
    });
    expect(updateWebMaterialPaintReservation(f.target, footprint())).toMatchObject({
      status: 'unavailable',
      reason: 'paint-reservation-owner-unavailable',
    });
    expect(f.part.style.width).toBe('');
    expect(f.part.style.padding).toBe('');
    replacement.current?.();
    f.release();
  });

  it('rejects a ready reference fact after same-size physical reparenting', () => {
    const f = fixture();
    f.release();
    const reference = document.createElement('div');
    const other = document.createElement('div');
    document.body.append(reference, other);
    reference.append(f.part);
    vi.spyOn(reference, 'getBoundingClientRect').mockReturnValue(new DOMRect(50, 50, 200, 200));
    const release = connectWebMaterialPaintReservation(f.target, f.part, {}, () => true, reference);
    updateWebMaterialPaintReservation(f.target, footprint());
    const ready = updateWebMaterialPaintReservation(f.target, footprint());
    expect(ready.status).toBe('ready');
    expect(ready.status === 'ready' && ready.current()).toBe(true);
    other.append(f.part);
    expect(ready.status === 'ready' && ready.current()).toBe(false);
    expect(updateWebMaterialPaintReservation(f.target, footprint())).toMatchObject({
      reason: 'paint-reservation-inline-reference-unavailable',
    });
    release();
  });
});

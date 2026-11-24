import { describe, expect, it, vi } from 'vitest';
import { createAnatomyFamily, type MaterialPaintReservation } from '@proto.ui/core';
import type { AnatomyPort } from '@proto.ui/module-anatomy';
import {
  MaterialPaintReservationRegistry,
  prepareMaterialPaintReservationPart,
} from '../src/material/paint-reservation';

// Inject logical identities and host endpoints. This proves module ownership,
// not browser layout, material paint or full Adapter conformance.
function fixture() {
  const family = createAnatomyFamily('reservation-fixture', {
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
  const self = {},
    other = {},
    physical = {};
  type Part = {
    role: string;
    physical: unknown;
    ancestor: unknown;
    current: boolean;
    instance?: unknown;
  };
  let parts: Part[] = [{ role: 'target', physical, ancestor: self, current: true }];
  const order = new Set<() => void>(),
    targets = new Set<() => void>();
  const anatomy = {
    resolveSelfInstance: () => self,
    resolveSelfRole: () => 'heading',
    parts: () => parts,
    isCurrentPart: (_family: unknown, part: (typeof parts)[number]) => part.current,
    resolveAncestorInstance: (_family: unknown, part: (typeof parts)[number]) => part.ancestor,
    resolvePartTarget: (part: (typeof parts)[number]) => part.physical,
    resolvePartInstance: (part: (typeof parts)[number]) => part.instance ?? part,
    subscribeOrder: (_family: unknown, callback: () => void) => {
      order.add(callback);
      return () => order.delete(callback);
    },
    subscribeTargets: (_family: unknown, callback: () => void) => {
      targets.add(callback);
      return () => targets.delete(callback);
    },
  } as unknown as AnatomyPort;
  const registry = new MaterialPaintReservationRegistry(() => anatomy);
  const handle = registry.declare({ family, targetRole: 'target' });
  const releases: ReturnType<typeof vi.fn>[] = [];
  const connect = vi.fn((_target: unknown, _generation: object, _current: () => boolean) => {
    const off = vi.fn();
    releases.push(off);
    return off;
  });
  return {
    family,
    self,
    other,
    physical,
    registry,
    handle,
    connect,
    releases,
    order,
    targets,
    parts(next: typeof parts) {
      parts = next;
      for (const cb of order) cb();
    },
    targetChanged() {
      for (const cb of targets) cb();
    },
  };
}

describe('draft exact material target association', () => {
  it('requires one own template part and never invokes declaration getters', () => {
    const f = fixture();
    const getter = vi.fn(() => f.family);
    expect(() =>
      f.registry.declare({
        get family() {
          return getter();
        },
        targetRole: 'target',
      })
    ).toThrow();
    expect(getter).not.toHaveBeenCalled();
    expect(() => f.registry.validateTemplate([])).toThrow('missing');
    expect(() => f.registry.validateTemplate([f.handle, f.handle])).toThrow('duplicate');
    expect(() => f.registry.validateTemplate([{} as MaterialPaintReservation])).toThrow('foreign');
    f.registry.validateTemplate([f.handle]);
    f.registry.dispose();
  });

  it('resolves only a unique current descendant, without guessing from DOM ancestry', () => {
    const f = fixture();
    const off = prepareMaterialPaintReservationPart(f.handle)({ connect: f.connect });
    expect(f.connect).not.toHaveBeenCalled();
    f.registry.setActive(true);
    expect(f.connect).toHaveBeenCalledWith(
      f.physical,
      expect.any(Object),
      expect.any(Function),
      null,
      null
    );
    f.parts([{ role: 'target', physical: f.physical, ancestor: f.other, current: true }]);
    expect(f.releases[0]).toHaveBeenCalledOnce();
    expect(f.connect).toHaveBeenCalledTimes(1);
    f.parts([
      { role: 'target', physical: f.physical, ancestor: f.self, current: true },
      { role: 'target', physical: {}, ancestor: f.self, current: true },
    ]);
    expect(f.connect).toHaveBeenCalledTimes(1);
    f.parts([{ role: 'target', physical: f.physical, ancestor: f.self, current: false }]);
    expect(f.connect).toHaveBeenCalledTimes(1);
    f.parts([{ role: 'target', physical: f.physical, ancestor: f.self, current: true }]);
    expect(f.connect).toHaveBeenCalledTimes(2);
    off();
    f.registry.dispose();
  });

  it('binds only explicit current inline/outline references and revokes a replaced outline', () => {
    const f = fixture();
    const rootInstance = {},
      rootPhysical = {},
      otherPhysical = {};
    const handle = f.registry.declare({
      family: f.family,
      targetRole: 'target',
      inlineSizeFrom: { family: f.family, role: 'root' },
      outlineFrom: { family: f.family, role: 'root' },
    });
    const parts = (physical: unknown, ancestor: unknown = rootInstance) => [
      { role: 'root', physical, ancestor: null, current: true, instance: rootInstance },
      { role: 'heading', physical: {}, ancestor, current: true, instance: f.self },
      { role: 'target', physical: f.physical, ancestor: f.self, current: true, instance: {} },
    ];
    f.parts(parts(rootPhysical));
    f.registry.setActive(true);
    const currents: (() => boolean)[] = [];
    const release = vi.fn();
    const connect = vi.fn((_target, _generation, current) => {
      currents.push(current);
      return release;
    });
    prepareMaterialPaintReservationPart(handle)({ connect });
    expect(connect).toHaveBeenCalledWith(
      f.physical,
      expect.any(Object),
      expect.any(Function),
      rootPhysical,
      rootPhysical
    );
    expect(currents[0]!()).toBe(true);
    f.parts(parts(otherPhysical));
    expect(currents[0]!()).toBe(false);
    expect(connect.mock.calls.at(-1)?.slice(3)).toEqual([otherPhysical, otherPhysical]);
    f.parts(parts(otherPhysical, f.other));
    expect(currents.at(-1)!()).toBe(false);
    expect(connect).toHaveBeenCalledTimes(2);
    f.registry.dispose();
  });

  it('prepared refs do not revoke a live binding and stale attach/detach cannot erase a successor', () => {
    const f = fixture();
    f.registry.setActive(true);
    const bindOld = prepareMaterialPaintReservationPart(f.handle);
    const oldOff = bindOld({ connect: f.connect });
    const bindNew = prepareMaterialPaintReservationPart(f.handle);
    expect(f.releases[0]).not.toHaveBeenCalled();
    const next = vi.fn(() => vi.fn());
    const newOff = bindNew({ connect: next });
    expect(f.releases[0]).toHaveBeenCalledOnce();
    oldOff();
    bindOld({ connect: f.connect })();
    expect(next.mock.results[0].value).not.toHaveBeenCalled();
    expect(f.connect).toHaveBeenCalledTimes(1);
    newOff();
    expect(next.mock.results[0].value).toHaveBeenCalledOnce();
    f.registry.dispose();
  });

  it('retires same-node target generations before connecting the replacement', () => {
    const f = fixture();
    f.registry.setActive(true);
    prepareMaterialPaintReservationPart(f.handle)({ connect: f.connect });
    const generation = f.connect.mock.calls[0][1];
    f.targetChanged();
    expect(f.releases[0]).toHaveBeenCalledOnce();
    expect(f.connect).toHaveBeenCalledTimes(2);
    expect(f.connect.mock.calls[1][0]).toBe(f.physical);
    expect(f.connect.mock.calls[1][1]).not.toBe(generation);
    f.registry.setActive(false);
    expect(f.releases[1]).toHaveBeenCalledOnce();
    f.registry.setActive(true);
    expect(f.connect).toHaveBeenCalledTimes(3);
    f.registry.dispose();
    expect(f.order.size).toBe(0);
    expect(f.targets.size).toBe(0);
  });

  it('cleanup reentry cannot install an older binding over its successor', () => {
    const finalRelease = vi.fn();
    const finalConnect = vi.fn(() => finalRelease);
    // One owner can capture multiple refs before any of them are committed.
    const g = fixture();
    g.registry.setActive(true);
    const a = prepareMaterialPaintReservationPart(g.handle);
    const b = prepareMaterialPaintReservationPart(g.handle);
    const c = prepareMaterialPaintReservationPart(g.handle);
    a({ connect: () => () => c({ connect: finalConnect }) });
    const middle = vi.fn(() => vi.fn());
    b({ connect: middle });
    expect(middle).not.toHaveBeenCalled();
    expect(finalConnect).toHaveBeenCalledOnce();
    expect(finalRelease).not.toHaveBeenCalled();
    g.registry.dispose();
    expect(finalRelease).toHaveBeenCalledOnce();
  });
});

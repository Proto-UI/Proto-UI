import { expect, it, vi } from 'vitest';
import { createAnatomyFamily, tw, type AnatomyPartView } from '@proto.ui/core';
import type { AnatomyPort } from '@proto.ui/module-anatomy';
import { CapsVault, SYS_CAP } from '@proto.ui/module-base';
import { createFeedbackModule } from '../src/create';
import {
  MATERIAL_PAINT_RESERVATION_CAP,
  MaterialPaintReservationRegistry,
  prepareMaterialPaintReservationPart,
} from '../src/material/paint-reservation';
import { FINAL_STYLE_SINK_CAP } from '../src/material/final-style-sink';

// This fixture exposes only the operations exercised by reservation cleanup.
// Unexpected Anatomy use fails instead of silently fabricating a result.
function anatomyFixture(): AnatomyPort {
  const unused = (): never => {
    throw new Error('unexpected Anatomy operation in reservation cleanup fixture');
  };
  const self = {},
    physical = {};
  const part: AnatomyPartView = {
    role: 'target',
    hasExpose: unused,
    getExpose: unused,
    hasHook: unused,
  };
  return {
    resolveSelfInstance: () => self,
    resolveSelfRole: () => 'heading',
    parts: () => [part],
    isCurrentPart: () => true,
    resolveAncestorInstance: () => self,
    resolvePartTarget: () => physical,
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
}

// Real Feedback module and registry, injected Anatomy and host disconnects.
// No native DOM geometry, material-pixel or full runtime claim.
function fixture() {
  const family = createAnatomyFamily('review-cleanup', {
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
  const anatomy = anatomyFixture();
  const sink = { commit: vi.fn(), release: vi.fn() };
  const caps = new CapsVault();
  caps.attachBase([
    [SYS_CAP, undefined],
    [MATERIAL_PAINT_RESERVATION_CAP, true],
    [FINAL_STYLE_SINK_CAP, sink],
  ]);
  const module = createFeedbackModule({
    init: { prototypeName: 'independent-reservation-cleanup', declarations: [] },
    caps,
    deps: {
      requireFacade() {
        throw Error('unused');
      },
      requirePort() {
        throw Error('unused');
      },
      tryFacade: () => undefined,
      // ModuleDeps erases the named port type at this registration boundary.
      tryPort: <T>(name: string) => (name === 'anatomy' ? anatomy : undefined) as T | undefined,
    },
  });
  const hooks = module.hooks!;
  const first = module.facade.material.reserve({ family, targetRole: 'target' });
  const second = module.facade.material.reserve({ family, targetRole: 'target' });
  let failing = false;
  const sentinel = Error('reservation-cleanup-fault');
  const releaseA = vi.fn(() => {
    if (failing) throw sentinel;
  });
  const releaseB = vi.fn();
  prepareMaterialPaintReservationPart(first)({ connect: () => releaseA });
  prepareMaterialPaintReservationPart(second)({ connect: () => releaseB });
  module.facade.style.use(tw('rounded-lg'));
  hooks.onMountPhase?.('mounting', 1);
  hooks.onProtoPhase?.('mounted');
  hooks.onMountPhase?.('mounted', 1);
  expect(sink.commit).toHaveBeenCalled();
  sink.release.mockClear();
  releaseA.mockClear();
  releaseB.mockClear();
  failing = true;
  return { hooks, sink, releaseA, releaseB, sentinel };
}

it('terminal dispose still retires existing visual sinks after reservation cleanup throws', () => {
  const f = fixture();
  expect(() => f.hooks.dispose?.()).toThrow(f.sentinel);
  expect(f.releaseA).toHaveBeenCalledOnce();
  expect(f.releaseB).toHaveBeenCalledOnce();
  expect(f.sink.release).toHaveBeenCalledOnce();
  f.hooks.dispose?.();
  expect(f.sink.release).toHaveBeenCalledOnce();
});

it('view suspension attempts all reservations and existing sinks after the first cleanup throws', () => {
  const f = fixture();
  expect(() => f.hooks.onMountPhase?.('unmounting', 1)).toThrow(f.sentinel);
  expect(f.releaseA).toHaveBeenCalledOnce();
  expect(f.releaseB).toHaveBeenCalledOnce();
  expect(f.sink.release).toHaveBeenCalledOnce();
  f.hooks.dispose?.();
});

// These counterexamples were first executed by independent review.
function logicalFixture() {
  const family = createAnatomyFamily('review-reentry', {
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
  const anatomy = anatomyFixture();
  return { family, anatomy };
}

it('old view suspension cannot release a visual sink installed by a reentrant later mount', () => {
  const { family, anatomy } = logicalFixture();
  const sink = { commit: vi.fn(), release: vi.fn() },
    caps = new CapsVault();
  caps.attachBase([
    [SYS_CAP, undefined],
    [MATERIAL_PAINT_RESERVATION_CAP, true],
    [FINAL_STYLE_SINK_CAP, sink],
  ]);
  const module = createFeedbackModule({
    init: { prototypeName: 'independent-remount', declarations: [] },
    caps,
    deps: {
      requireFacade() {
        throw Error('unused');
      },
      requirePort() {
        throw Error('unused');
      },
      tryFacade: () => undefined,
      // ModuleDeps erases the named port type at this registration boundary.
      tryPort: <T>(name: string) => (name === 'anatomy' ? anatomy : undefined) as T | undefined,
    },
  });
  const hooks = module.hooks!;
  const reservation = module.facade.material.reserve({ family, targetRole: 'target' });
  let remount = false;
  prepareMaterialPaintReservationPart(reservation)({
    connect: () => () => {
      if (remount) {
        remount = false;
        hooks.onMountPhase?.('mounting', 2);
      }
    },
  });
  module.facade.style.use(tw('rounded-lg'));
  hooks.onMountPhase?.('mounting', 1);
  hooks.onProtoPhase?.('mounted');
  hooks.onMountPhase?.('mounted', 1);
  sink.commit.mockClear();
  sink.release.mockClear();
  remount = true;
  hooks.onMountPhase?.('unmounting', 1);
  const committedViews = sink.commit.mock.calls.map(([frame]) => frame.view);
  const releasedViews = sink.release.mock.calls.map(([view]) => view);
  try {
    expect(committedViews).toContain(2);
    expect(releasedViews).toEqual([1]);
  } finally {
    hooks.dispose?.();
  }
});

it('old bulk deactivation cannot retire a reservation successor created by reentrant activation', () => {
  const { family, anatomy } = logicalFixture();
  const registry = new MaterialPaintReservationRegistry(() => anatomy);
  const a = registry.declare({ family, targetRole: 'target' }),
    b = registry.declare({ family, targetRole: 'target' });
  const connected: string[] = [],
    released: string[] = [];
  let numberA = 0,
    numberB = 0,
    reactivate = false;
  prepareMaterialPaintReservationPart(a)({
    connect: () => {
      const id = `a:${++numberA}`;
      connected.push(id);
      return () => {
        released.push(id);
        if (reactivate) {
          reactivate = false;
          registry.setActive(true);
        }
      };
    },
  });
  prepareMaterialPaintReservationPart(b)({
    connect: () => {
      const id = `b:${++numberB}`;
      connected.push(id);
      return () => {
        released.push(id);
      };
    },
  });
  registry.setActive(true);
  reactivate = true;
  registry.setActive(false);
  try {
    expect(connected).toEqual(['a:1', 'b:1', 'a:2', 'b:2']);
    expect(released).toEqual(['a:1', 'b:1']);
  } finally {
    registry.dispose();
  }
});

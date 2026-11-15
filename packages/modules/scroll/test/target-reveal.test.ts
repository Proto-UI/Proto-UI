import { afterEach, describe, expect, it } from 'vitest';
import {
  createAnatomyFamily,
  type AnatomyPartView,
  type ModuleFacade,
  type RunHandle,
  type ScrollSurfaceRequest,
  type ScrollSurfaceRequestOutcome,
} from '@proto.ui/core';
import { CapsVault, SYS_CAP, type ModuleDeps, type SystemCaps } from '@proto.ui/module-base';
import type { AnatomyPort } from '@proto.ui/module-anatomy';
import type { ContextPort } from '@proto.ui/module-context';
import { createStateModule, type StatePort } from '@proto.ui/module-state';
import { createScrollModule, SCROLL_SURFACE_HOST_CAP, type ScrollSurfaceHost } from '../src';

const cleanups: Array<() => void> = [];
afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));

/** Fake Anatomy and Host ports model lifecycle ordering, not browser geometry. */
function harness(options: { host?: boolean; reveal?: boolean; availability?: boolean } = {}) {
  const family = createAnatomyFamily('test-scroll-reveal', {
    roles: {
      root: { cardinality: { min: 1, max: 1 } },
      surface: { cardinality: { min: 1, max: 1 } },
      item: { cardinality: { min: 0, max: '*' } },
    },
    relations: [
      { kind: 'contains', parent: 'root', child: 'surface' },
      { kind: 'contains', parent: 'surface', child: 'item' },
    ],
  });
  const part = (role: string): AnatomyPartView => ({
    role,
    hasExpose: () => false,
    getExpose: () => null,
    hasHook: () => false,
  });
  const item = part('item'),
    selfPart = part('surface'),
    self = {};
  const controls = {
    current: true,
    role: 'surface' as string | null,
    ancestor: self as unknown,
    target: { name: 'current-target' } as unknown,
    onResolve: undefined as (() => void) | undefined,
    onAttach: undefined as (() => void) | undefined,
    onReveal: undefined as (() => void) | undefined,
    accepted: true,
    available: true,
    binding: {} as object,
  };
  let availabilityChanged: (() => void) | undefined;
  const rawRequests: ScrollSurfaceRequest[] = [];
  const deliveries: unknown[] = [],
    movements: unknown[] = [];
  let phase: 'setup' | 'callback' = 'setup';
  const sys = {
    execPhase: () => phase,
    domain: () => (phase === 'setup' ? 'setup' : 'runtime'),
    protoPhase: () => 'mounted',
    instancePhase: () => 'alive',
    mountPhase: () => 'mounted',
    isDisposed: () => false,
    ensureNotDisposed() {},
    ensureExecPhase() {},
    ensureRuntime() {},
    ensureCallback() {},
    ensureSetup() {
      if (phase !== 'setup') throw new Error('setup only');
    },
    getCallbackCtx: () => ({ update() {} }) as RunHandle<Record<string, unknown>>,
    deferAfterCallback: (task: () => void) => task(),
  } as SystemCaps;
  const vault = new CapsVault();
  vault.attachBase([[SYS_CAP, sys]]);
  const host: ScrollSurfaceHost = {
    support: { system: true, composed: false },
    ...(options.availability
      ? {
          availability: {
            get: () =>
              controls.available
                ? { kind: 'available' as const, binding: controls.binding }
                : { kind: 'unavailable' as const, reason: 'target-pending' as const },
            subscribe(listener: () => void) {
              availabilityChanged = listener;
              return () => {
                availabilityChanged = undefined;
              };
            },
          },
        }
      : {}),
    attach(connection) {
      // Availability-based attachment must synchronously report initial facts;
      // otherwise the existing host-admission contract rejects this fixture.
      if (options.availability) {
        connection.onFacts({
          axes: 'vertical',
          projection: 'system',
          scrolling: false,
          horizontal: {
            position: 0,
            visibleRatio: 1,
            canScrollBefore: false,
            canScrollAfter: false,
            atEnd: true,
          },
          vertical: {
            position: 0,
            visibleRatio: 0.25,
            canScrollBefore: false,
            canScrollAfter: true,
            atEnd: false,
          },
          endFollow: { state: 'off', requestStatus: 'idle' },
        });
      }
      controls.onAttach?.();
      return {
        update() {},
        dispose() {},
        request(request) {
          rawRequests.push(request);
        },
        ...(options.reveal === false
          ? {}
          : {
              reveal(target: unknown, axis: 'vertical', isCurrentTarget?: () => boolean) {
                deliveries.push({ target, axis });
                controls.onReveal?.();
                if (!controls.accepted || (isCurrentTarget && !isCurrentTarget())) return false;
                movements.push(target);
                return true;
              },
            }),
      };
    },
  };
  if (options.host !== false) vault.attach([[SCROLL_SURFACE_HOST_CAP, host]]);
  const emptyDeps = {
    requireFacade() {
      throw new Error('unused');
    },
    requirePort() {
      throw new Error('unused');
    },
    tryFacade: () => undefined,
    tryPort: () => undefined,
  } satisfies ModuleDeps;
  const state = createStateModule({
    init: { prototypeName: 'test-scroll-reveal', declarations: [] },
    caps: vault,
    deps: emptyDeps,
  });
  const anatomy = {
    isCurrentPart: (f: unknown, p: AnatomyPartView) =>
      controls.current && f === family && (p === item || p === selfPart),
    resolveSelfInstance: () => self,
    resolveSelfRole: (f: unknown) => (f === family ? controls.role : null),
    resolvePartInstance: (p: AnatomyPartView) => (p === selfPart ? self : p === item ? item : null),
    resolveAncestorInstance: (_f: unknown, p: AnatomyPartView) =>
      p === item ? controls.ancestor : null,
    resolvePartTarget: () => {
      const target = controls.target;
      const onResolve = controls.onResolve;
      controls.onResolve = undefined;
      onResolve?.();
      return target;
    },
  } as unknown as AnatomyPort;
  const facades: Record<string, ModuleFacade> = { state: state.facade };
  const ports: Record<string, unknown> = {
    state: (state as unknown as { port: StatePort }).port,
    anatomy,
    context: {} as ContextPort,
  };
  const deps: ModuleDeps = {
    requireFacade: <T extends ModuleFacade>(name: string) => facades[name] as T,
    requirePort: <T>(name: string) => ports[name] as T,
    tryFacade: <T extends ModuleFacade>(name: string) => facades[name] as T | undefined,
    tryPort: <T>(name: string) => ports[name] as T | undefined,
  };
  const module = createScrollModule({
    init: { prototypeName: 'test-scroll-reveal', declarations: [] },
    caps: vault,
    deps,
  });
  const surface = module.facade.getSurface();
  surface.configure({ axes: 'vertical', projection: 'system' });
  phase = 'callback';
  let epoch = 0;
  const mount = () => module.hooks.onMountPhase?.('mounted', ++epoch);
  const detach = () => module.hooks.onMountPhase?.('detached', epoch);
  cleanups.push(detach);
  const request = { kind: 'reveal' as const, axis: 'vertical' as const, family, part: item };
  return {
    controls,
    module,
    surface,
    family,
    item,
    selfPart,
    self,
    request,
    rawRequests,
    deliveries,
    movements,
    mount,
    detach,
    vault,
    host,
    notifyAvailability: () => availabilityChanged?.(),
  };
}

const unavailable = { kind: 'rejected', reason: 'unavailable' };

describe('current logical target reveal admission', () => {
  it('delivers a current descendant to the current host without forwarding public Anatomy identity', () => {
    const h = harness();
    h.mount();
    expect(h.surface.request(h.request)).toEqual({ kind: 'dispatched' });
    expect(h.deliveries).toEqual([{ target: h.controls.target, axis: 'vertical' }]);
    expect(h.movements).toEqual([h.controls.target]);
    expect(h.rawRequests).toEqual([]);
  });

  it.each([
    'retired',
    'fabricated',
    'foreign-family',
    'sibling-surface',
    'self',
    'no-surface-role',
  ])('rejects %s identity before host delivery', (kind) => {
    const h = harness();
    h.mount();
    const request = { ...h.request };
    if (kind === 'retired') h.controls.current = false;
    if (kind === 'fabricated') request.part = { ...h.item };
    if (kind === 'foreign-family')
      request.family = createAnatomyFamily('foreign', {
        roles: { root: { cardinality: { min: 1, max: 1 } } },
      });
    if (kind === 'sibling-surface') h.controls.ancestor = {};
    if (kind === 'self') request.part = h.selfPart;
    if (kind === 'no-surface-role') h.controls.role = null;
    expect(h.surface.request(request)).toEqual(unavailable);
    expect(h.deliveries).toEqual([]);
    expect(h.rawRequests).toEqual([]);
  });

  it('rejects before mount and never replays the rejected target after mount', () => {
    const h = harness();
    expect(h.surface.request(h.request)).toEqual({ kind: 'rejected', reason: 'not-mounted' });
    h.mount();
    expect(h.deliveries).toEqual([]);
    expect(h.rawRequests).toEqual([]);
    expect(h.surface.request(h.request)).toEqual({ kind: 'dispatched' });
  });

  it.each([{ host: false }, { reveal: false }])(
    'rejects a host without reveal support: %s',
    (options) => {
      const h = harness(options);
      h.mount();
      expect(h.surface.request(h.request)).toEqual(unavailable);
      expect(h.rawRequests).toEqual([]);
      expect(h.deliveries).toEqual([]);
    }
  );

  it('does not enqueue a target whose host attachment is still acquiring', () => {
    const h = harness();
    let outcome: ScrollSurfaceRequestOutcome | undefined;
    const ordinary = {
      kind: 'page' as const,
      axis: 'vertical' as const,
      direction: 'after' as const,
    };
    h.controls.onAttach = () => {
      outcome = h.surface.request(h.request);
      h.surface.request(ordinary);
    };
    h.mount();
    expect(outcome).toEqual(unavailable);
    expect(h.deliveries).toEqual([]);
    expect(h.rawRequests).toEqual([ordinary]);
    expect(h.surface.request(h.request)).toEqual({ kind: 'dispatched' });
  });

  it('does not retain an unavailable target for later readiness', () => {
    const h = harness();
    h.mount();
    h.controls.target = null;
    expect(h.surface.request(h.request)).toEqual(unavailable);
    h.controls.target = { name: 'later-target' };
    expect(h.deliveries).toEqual([]);
    expect(h.rawRequests).toEqual([]);
    expect(h.surface.request(h.request)).toEqual({ kind: 'dispatched' });
    expect(h.movements).toEqual([h.controls.target]);
  });

  it('rejects an unavailable host without replay when its binding becomes ready', () => {
    const h = harness({ availability: true });
    h.controls.available = false;
    h.mount();
    expect(h.surface.request(h.request)).toEqual(unavailable);
    h.controls.available = true;
    h.notifyAvailability();
    expect(h.deliveries).toEqual([]);
    expect(h.rawRequests).toEqual([]);
    expect(h.surface.request(h.request)).toEqual({ kind: 'dispatched' });
  });

  it('rejects a retired host binding even before its change notification arrives', () => {
    const h = harness({ availability: true });
    h.mount();
    h.controls.binding = {};
    expect(h.surface.request(h.request)).toEqual(unavailable);
    expect(h.deliveries).toEqual([]);
    expect(h.rawRequests).toEqual([]);
  });

  it.each(['claim', 'target', 'view'] as const)(
    'rejects synchronous %s retirement during target resolution',
    (kind) => {
      const h = harness();
      h.mount();
      h.controls.onResolve = () => {
        if (kind === 'claim') h.controls.current = false;
        if (kind === 'target') h.controls.target = { name: 'replacement-target' };
        if (kind === 'view') {
          h.detach();
          h.mount();
        }
      };
      expect(h.surface.request(h.request)).toEqual(unavailable);
      expect(h.deliveries).toEqual([]);
      expect(h.movements).toEqual([]);
      expect(h.rawRequests).toEqual([]);
    }
  );

  it.each(['claim', 'target', 'view'] as const)(
    'revokes a host-call authority after synchronous %s retirement',
    (kind) => {
      const h = harness();
      h.mount();
      h.controls.onReveal = () => {
        if (kind === 'claim') h.controls.current = false;
        if (kind === 'target') h.controls.target = { name: 'replacement-target' };
        if (kind === 'view') {
          h.detach();
          h.mount();
        }
      };
      expect(h.surface.request(h.request)).toEqual(unavailable);
      expect(h.movements).toEqual([]);
      expect(h.rawRequests).toEqual([]);
    }
  );

  it('preserves a host rejection without claiming delivery or retrying', () => {
    const h = harness();
    h.mount();
    h.controls.accepted = false;
    expect(h.surface.request(h.request)).toEqual(unavailable);
    expect(h.deliveries).toHaveLength(1);
    expect(h.movements).toEqual([]);
    h.controls.accepted = true;
    expect(h.deliveries).toHaveLength(1);
  });
});

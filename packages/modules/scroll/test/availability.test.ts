import { describe, expect, it } from 'vitest';
import { createBoundWebScrollSurfaceHost } from '../src/web/create-bound-web-scroll-host';
import type {
  ModuleFacade,
  RunHandle,
  ScrollAxisSnapshot,
  ScrollSurfaceRequest,
  ScrollSurfaceSnapshot,
} from '@proto.ui/core';
import { CapsVault, SYS_CAP, type ModuleDeps, type SystemCaps } from '@proto.ui/module-base';
import type { AnatomyPort } from '@proto.ui/module-anatomy';
import type { ContextPort } from '@proto.ui/module-context';
import { createStateModule, type StatePort } from '@proto.ui/module-state';
import {
  SCROLL_SURFACE_HOST_CAP,
  createScrollModule,
  type ScrollSurfaceAvailability,
  type ScrollSurfaceHost,
  type ScrollSurfaceHostAttachment,
} from '../src';

type TestSystemCaps = SystemCaps & {
  phase: 'setup' | 'callback';
};

function createSystemCaps(): TestSystemCaps {
  let phase: 'setup' | 'callback' = 'setup';
  const run = { update() {} } as RunHandle<Record<string, unknown>>;
  return {
    execPhase: () => phase,
    domain: () => (phase === 'setup' ? 'setup' : 'runtime'),
    protoPhase: () => 'mounted',
    instancePhase: () => 'alive',
    mountPhase: () => 'mounted',
    isDisposed: () => false,
    ensureNotDisposed() {},
    ensureExecPhase(_operation, expected) {
      const values = Array.isArray(expected) ? expected : [expected];
      if (!values.includes(phase)) throw new Error('illegal phase');
    },
    ensureSetup() {
      if (phase !== 'setup') throw new Error('illegal phase');
    },
    ensureRuntime() {
      if (phase === 'setup') throw new Error('illegal phase');
    },
    ensureCallback() {
      if (phase !== 'callback') throw new Error('illegal phase');
    },
    getCallbackCtx: () => (phase === 'callback' ? run : undefined),
    deferAfterCallback: (task) => task(),
    get phase() {
      return phase;
    },
    set phase(value: 'setup' | 'callback') {
      phase = value;
    },
  } as TestSystemCaps;
}

const AT_START: ScrollAxisSnapshot = Object.freeze({
  position: 0,
  visibleRatio: 0.25,
  canScrollBefore: false,
  canScrollAfter: true,
  atEnd: false,
});

const AT_END: ScrollAxisSnapshot = Object.freeze({
  position: 1,
  visibleRatio: 0.25,
  canScrollBefore: true,
  canScrollAfter: false,
  atEnd: true,
});

function snapshot(
  state: ScrollSurfaceSnapshot['endFollow']['state'],
  requestStatus: ScrollSurfaceSnapshot['endFollow']['requestStatus']
): ScrollSurfaceSnapshot {
  return Object.freeze({
    axes: 'vertical',
    horizontal: Object.freeze({ ...AT_START, visibleRatio: 1, canScrollAfter: false, atEnd: true }),
    vertical: state === 'following' ? AT_END : AT_START,
    scrolling: false,
    projection: 'system',
    endFollow: Object.freeze({ state, requestStatus }),
  });
}

function createHarness(
  withHost = true,
  initialFacts?: ScrollSurfaceSnapshot,
  onDispose?: () => void
) {
  const sys = createSystemCaps();
  const vault = new CapsVault();
  const connections: ScrollSurfaceHostAttachment[] = [];
  const requests: ScrollSurfaceRequest[] = [];
  let disposed = 0;
  vault.attachBase([[SYS_CAP, sys]]);
  const host: ScrollSurfaceHost = {
    support: Object.freeze({ system: true, composed: false }),
    attach(connection) {
      connections.push(connection);
      let current = connection;
      initialFacts && connection.onFacts(initialFacts);
      return {
        update(next) {
          current = next;
          connections.push(current);
        },
        request(request) {
          requests.push(request);
        },
        dispose() {
          disposed += 1;
          onDispose?.();
        },
      };
    },
  };
  if (withHost) vault.attach([[SCROLL_SURFACE_HOST_CAP, host]]);

  const emptyDeps: ModuleDeps = {
    requireFacade() {
      throw new Error('unused');
    },
    requirePort() {
      throw new Error('unused');
    },
    tryFacade: () => undefined,
    tryPort: () => undefined,
  };
  const state = createStateModule({
    init: { prototypeName: 'x-scroll-fake-host', declarations: [] },
    caps: vault,
    deps: emptyDeps,
  });
  // createModule returns the privilege-bearing port, which StateModule intentionally omits publicly.
  const statePort = (state as unknown as { readonly port: StatePort }).port;
  const facades: Record<string, ModuleFacade> = { state: state.facade };
  const ports: Record<string, unknown> = {
    state: statePort,
    anatomy: {} as AnatomyPort,
    context: {} as ContextPort,
  };
  const deps: ModuleDeps = {
    requireFacade<T extends ModuleFacade>(name: string): T {
      const facade = facades[name];
      if (!facade) throw new Error(`missing facade ${name}`);
      return facade as T;
    },
    requirePort<T>(name: string): T {
      if (!(name in ports)) throw new Error(`missing port ${name}`);
      return ports[name] as T;
    },
    tryFacade<T extends ModuleFacade>(name: string): T | undefined {
      return facades[name] as T | undefined;
    },
    tryPort<T>(name: string): T | undefined {
      return ports[name] as T | undefined;
    },
  };
  const module = createScrollModule({
    init: { prototypeName: 'x-scroll-fake-host', declarations: [] },
    caps: vault,
    deps,
  });
  const surface = module.facade.getSurface();
  surface.configure({
    axes: 'vertical',
    projection: 'system',
    endFollow: { mode: 'while-at-end', axis: 'vertical' },
  });
  return { sys, vault, module, surface, connections, requests, getDisposed: () => disposed };
}

function availableHarness(
  initial: ScrollSurfaceAvailability = { kind: 'unavailable', reason: 'target-pending' }
) {
  const harness = createHarness(false);
  let value = initial;
  let listener: (() => void) | undefined;
  let subscriptions = 0;
  let unsubscriptions = 0;
  let disposals = 0;
  const requests: ScrollSurfaceRequest[] = [];
  const connections: ScrollSurfaceHostAttachment[] = [];
  const bindings: (object | undefined)[] = [];
  const host: ScrollSurfaceHost = {
    support: { system: true, composed: false },
    availability: {
      get: () => value,
      subscribe(callback) {
        subscriptions++;
        listener = callback;
        callback();
        return () => {
          unsubscriptions++;
          listener = undefined;
        };
      },
    },
    attach(connection, binding) {
      connections.push(connection);
      bindings.push(binding);
      connection.onFacts(snapshot('following', 'applied'));
      return {
        update() {},
        request: (request) => {
          requests.push(request);
        },
        dispose: () => {
          disposals++;
        },
      };
    },
  };
  harness.vault.attach([[SCROLL_SURFACE_HOST_CAP, host]]);
  return {
    ...harness,
    host,
    requests,
    connections,
    bindings,
    set(valueNext: ScrollSurfaceAvailability) {
      value = valueNext;
      listener?.();
    },
    notify() {
      listener?.();
    },
    counts: () => ({ subscriptions, unsubscriptions, disposals }),
  };
}

const request: ScrollSurfaceRequest = { kind: 'to-end', axis: 'vertical' };

describe('module-scroll availability transaction', () => {
  it('rejects before mount and while unavailable without replaying into a later target', () => {
    const h = availableHarness();
    expect(h.surface.request(request)).toEqual({ kind: 'rejected', reason: 'not-mounted' });
    h.module.hooks.onMountPhase?.('mounted', 1);
    expect(h.connections).toHaveLength(0);
    expect(h.surface.projection.get()).toBe('unresolved');
    expect(h.surface.request(request)).toEqual({ kind: 'rejected', reason: 'unavailable' });
    h.set({ kind: 'available', binding: {} });
    expect(h.requests).toHaveLength(0);
    expect(h.surface.projection.get()).toBe('system');
    expect(h.surface.request(request)).toEqual({ kind: 'dispatched' });
    expect(h.counts().subscriptions).toBe(1);
  });

  it('buffers synchronous facts until acquisition returns and queues accepted fact watcher requests', () => {
    const binding = {};
    const h = availableHarness({ kind: 'available', binding });
    const attach = h.host.attach;
    let returned = false;
    h.host.attach = (connection, expected) => {
      expect(expected).toBe(binding);
      const lease = attach(connection, expected);
      expect(h.surface.projection.get()).toBe('unresolved');
      expect(h.surface.vertical.position.get()).toBe(0);
      returned = true;
      return lease;
    };
    h.surface.projection.watch((_run, event) => {
      if (event.type !== 'next' || event.next !== 'system') return;
      expect(returned).toBe(true);
      expect(h.surface.request(request)).toEqual({ kind: 'queued' });
    });
    h.module.hooks.onMountPhase?.('mounted', 1);
    expect(h.requests).toEqual([request]);
  });

  it('never publishes synchronous facts from a throwing acquisition', () => {
    const h = availableHarness({ kind: 'available', binding: {} });
    const seen: string[] = [];
    h.surface.projection.watch((_run, event) => {
      if (event.type === 'next') seen.push(event.next);
    });
    h.host.attach = (connection) => {
      connection.onFacts(snapshot('following', 'applied'));
      throw new Error('acquire');
    };
    expect(() => h.module.hooks.onMountPhase?.('mounted', 1)).toThrow('acquire');
    expect(seen).not.toContain('system');
    expect(h.surface.vertical.position.get()).toBe(0);
    expect(h.surface.projection.get()).toBe('unresolved');
    expect(h.requests).toEqual([]);
    expect(h.counts().unsubscriptions).toBe(0);
    h.module.hooks.onProtoPhase?.('unmounted');
    expect(h.counts().unsubscriptions).toBe(1);
  });

  it('names missing initial facts and disposes the returned lease', () => {
    const h = availableHarness({ kind: 'available', binding: {} });
    let disposed = 0;
    h.host.attach = () => ({
      update() {},
      request() {},
      dispose() {
        disposed++;
      },
    });
    expect(() => h.module.hooks.onMountPhase?.('mounted', 1)).toThrow('missing-initial-snapshot');
    expect(disposed).toBe(1);
    expect(h.surface.projection.get()).toBe('unresolved');
  });

  it('retains historical geometry, rejects pending end requests, and ignores stale facts', () => {
    const h = availableHarness({ kind: 'available', binding: {} });
    h.module.hooks.onMountPhase?.('mounted', 1);
    const old = h.connections[0];
    old.onFacts({ ...snapshot('pending', 'pending'), vertical: AT_END, scrolling: true });
    h.set({ kind: 'unavailable', reason: 'target-retired' });
    expect(h.surface.vertical.position.get()).toBe(1);
    expect(h.surface.projection.get()).toBe('unresolved');
    expect(h.surface.scrolling.get()).toBe(false);
    expect(h.surface.endFollow.state.get()).toBe('off');
    expect(h.surface.endFollow.requestStatus.get()).toBe('rejected');
    old.onFacts(snapshot('following', 'applied'));
    expect(h.surface.projection.get()).toBe('unresolved');
    expect(h.counts().disposals).toBe(1);
  });

  it('replaces during attach without admitting the old lease or old facts', () => {
    const first = {};
    const second = {};
    const h = availableHarness({ kind: 'available', binding: first });
    const attach = h.host.attach;
    h.host.attach = (connection, binding) => {
      if (binding === first) {
        h.set({ kind: 'available', binding: second });
        connection.onFacts(snapshot('pending', 'pending'));
        return {
          update() {},
          request() {
            throw new Error('stale request');
          },
          dispose() {},
        };
      }
      return attach(connection, binding);
    };
    h.module.hooks.onMountPhase?.('mounted', 1);
    expect(h.bindings).toEqual([second]);
    expect(h.surface.endFollow.state.get()).toBe('following');
    expect(h.surface.request(request)).toEqual({ kind: 'dispatched' });
  });

  it('drops queued requests when an initial fact watcher replaces the binding', () => {
    const h = availableHarness({ kind: 'available', binding: {} });
    let replaced = false;
    h.surface.projection.watch((_run, event) => {
      if (event.type !== 'next' || event.next !== 'system' || replaced) return;
      replaced = true;
      expect(h.surface.request(request).kind).toBe('queued');
      h.set({ kind: 'available', binding: {} });
    });
    h.module.hooks.onMountPhase?.('mounted', 1);
    expect(h.connections).toHaveLength(2);
    expect(h.requests).toEqual([]);
    expect(h.counts().disposals).toBe(1);
  });

  it('cancels synchronous subscription registration exactly once', () => {
    const h = availableHarness({ kind: 'available', binding: {} });
    let off = 0;
    h.host.availability!.subscribe = (callback) => {
      callback();
      h.module.hooks.onMountPhase?.('detached', 1);
      return () => {
        off++;
      };
    };
    h.module.hooks.onMountPhase?.('mounted', 1);
    expect(off).toBe(1);
    expect(h.connections).toEqual([]);
  });

  it('attempts subscription cleanup when lease disposal throws on terminal retirement', () => {
    const h = availableHarness({ kind: 'available', binding: {} });
    const attach = h.host.attach;
    h.host.attach = (connection, binding) => ({
      ...attach(connection, binding),
      dispose() {
        throw new Error('dispose');
      },
    });
    h.module.hooks.onMountPhase?.('mounted', 1);
    expect(() => h.module.hooks.onProtoPhase?.('unmounted')).toThrow('dispose');
    expect(h.counts().unsubscriptions).toBe(1);
    expect(h.surface.projection.get()).toBe('unresolved');
    h.module.hooks.onProtoPhase?.('unmounted');
    expect(h.counts().unsubscriptions).toBe(1);
  });

  it('preserves newer authority established reentrantly by disposal', () => {
    const first = {};
    const second = {};
    const third = {};
    const h = availableHarness({ kind: 'available', binding: first });
    const attach = h.host.attach;
    h.host.attach = (connection, binding) => {
      const lease = attach(connection, binding);
      return {
        ...lease,
        dispose() {
          lease.dispose();
          if (binding === first) h.set({ kind: 'available', binding: third });
        },
      };
    };
    h.module.hooks.onMountPhase?.('mounted', 1);
    h.set({ kind: 'available', binding: second });
    expect(h.bindings).toEqual([first, third]);
    expect(h.surface.projection.get()).toBe('system');
  });
  it('does not acquire twice for synchronous notifications during admitted acquisition', () => {
    const h = availableHarness({ kind: 'available', binding: {} });
    const attach = h.host.attach;
    h.host.attach = (connection, binding) => {
      h.notify();
      expect(h.surface.request(request)).toEqual({ kind: 'rejected', reason: 'unavailable' });
      return attach(connection, binding);
    };
    h.module.hooks.onMountPhase?.('mounted', 1);
    expect(h.connections).toHaveLength(1);
    expect(h.requests).toEqual([]);
  });

  it('keeps the newest binding when availability get reenters', () => {
    const first = {};
    const second = {};
    const h = availableHarness({ kind: 'available', binding: first });
    const get = h.host.availability!.get;
    let replaced = false;
    h.host.availability!.get = () => {
      const old = get();
      if (!replaced) {
        replaced = true;
        h.set({ kind: 'available', binding: second });
      }
      return old;
    };
    h.module.hooks.onMountPhase?.('mounted', 1);
    expect(h.bindings).toEqual([second]);
    expect(h.surface.projection.get()).toBe('system');
  });

  it('revalidates expected binding between first facts and attach return', () => {
    const first = {};
    const h = availableHarness({ kind: 'available', binding: first });
    const attach = h.host.attach;
    let oldDisposed = 0;
    h.host.attach = (connection, binding) => {
      const lease = attach(connection, binding);
      if (binding === first) {
        h.set({ kind: 'available', binding: {} });
        return {
          ...lease,
          dispose() {
            oldDisposed++;
          },
        };
      }
      return lease;
    };
    h.module.hooks.onMountPhase?.('mounted', 1);
    expect(oldDisposed).toBe(1);
    expect(h.connections).toHaveLength(2);
    expect(h.surface.projection.get()).toBe('system');
  });

  it('attempts lease and subscription cleanup even when unresolved watcher throws', () => {
    const h = availableHarness({ kind: 'available', binding: {} });
    h.module.hooks.onMountPhase?.('mounted', 1);
    h.surface.projection.watch((_run, event) => {
      if (event.type === 'next' && event.next === 'unresolved') throw new Error('watch');
    });
    expect(() => h.module.hooks.onProtoPhase?.('unmounted')).toThrow('watch');
    expect(h.counts()).toEqual({ subscriptions: 1, unsubscriptions: 1, disposals: 1 });
    expect(h.surface.endFollow.state.get()).toBe('off');
  });
  it('recovers on a new availability notification after a failed acquisition', () => {
    const h = availableHarness({ kind: 'available', binding: {} });
    const attach = h.host.attach;
    h.host.attach = () => {
      throw new Error('acquire');
    };
    expect(() => h.module.hooks.onMountPhase?.('mounted', 1)).toThrow('acquire');
    h.host.attach = attach;
    h.set({ kind: 'available', binding: {} });
    expect(h.connections).toHaveLength(1);
    expect(h.surface.projection.get()).toBe('system');
    expect(h.counts().subscriptions).toBe(1);
  });
  it('does not reject the replacement end state when request validation reenters get', () => {
    const h = availableHarness({ kind: 'available', binding: {} });
    h.module.hooks.onMountPhase?.('mounted', 1);
    const get = h.host.availability!.get;
    let replaced = false;
    h.host.availability!.get = () => {
      const old = get();
      if (!replaced) {
        replaced = true;
        h.set({ kind: 'available', binding: {} });
      }
      return old;
    };
    expect(h.surface.request(request)).toEqual({ kind: 'rejected', reason: 'unavailable' });
    expect(h.surface.endFollow.requestStatus.get()).toBe('applied');
    expect(h.requests).toEqual([]);
  });
  it('retires the real physical lease before an unresolved watcher acquires the newest target', () => {
    const h = createHarness(false);
    const boundary = document.createElement('div');
    const first = document.createElement('div');
    const second = document.createElement('div');
    const third = document.createElement('div');
    document.body.append(boundary, first, second, third);
    let target = first;
    let notify = () => {};
    const host = createBoundWebScrollSurfaceHost({
      boundary,
      getTarget: () => target,
      isReady: () => true,
      subscribeTarget(listener) {
        notify = listener;
        return () => {};
      },
      moveGestureHost: {
        attach() {
          throw new Error('unexpected gesture');
        },
      },
    });
    h.vault.attach([[SCROLL_SURFACE_HOST_CAP, host]]);
    h.module.hooks.onMountPhase?.('mounted', 1);
    let replaced = false;
    h.surface.projection.watch((_run, event) => {
      if (event.type !== 'next' || event.next !== 'unresolved' || replaced) return;
      replaced = true;
      target = third;
      notify();
    });
    try {
      target = second;
      expect(() => notify()).not.toThrow();
      expect(h.surface.projection.get()).toBe('system');
      expect(first.style.overflowY).toBe('');
      expect(second.style.overflowY).toBe('');
      expect(third.style.overflowY).toBe('auto');
      expect(h.surface.request(request)).toEqual({ kind: 'dispatched' });
    } finally {
      h.module.hooks.onProtoPhase?.('unmounted');
      for (const element of [boundary, first, second, third]) element.remove();
    }
  });
  it('defers nested replacement from a real lease disposer until physical cleanup returns', () => {
    const h = createHarness(false);
    const boundary = document.createElement('div');
    const first = document.createElement('div');
    const second = document.createElement('div');
    const third = document.createElement('div');
    document.body.append(boundary, first, second, third);
    let target = first;
    let notify = () => {};
    const host = createBoundWebScrollSurfaceHost({
      boundary,
      getTarget: () => target,
      isReady: () => true,
      subscribeTarget(listener) {
        notify = listener;
        return () => {};
      },
      moveGestureHost: {
        attach() {
          throw new Error('unexpected gesture');
        },
      },
    });
    const attach = host.attach;
    let nested = false;
    host.attach = (connection, binding) => {
      const lease = attach(connection, binding);
      return {
        ...lease,
        dispose() {
          if (!nested) {
            nested = true;
            target = third;
            notify();
            expect(third.style.overflowY).toBe('');
          }
          lease.dispose();
        },
      };
    };
    h.vault.attach([[SCROLL_SURFACE_HOST_CAP, host]]);
    h.module.hooks.onMountPhase?.('mounted', 1);
    try {
      target = second;
      expect(() => notify()).not.toThrow();
      expect(h.surface.projection.get()).toBe('system');
      expect(first.style.overflowY).toBe('');
      expect(second.style.overflowY).toBe('');
      expect(third.style.overflowY).toBe('auto');
    } finally {
      h.module.hooks.onProtoPhase?.('unmounted');
      for (const element of [boundary, first, second, third]) element.remove();
    }
  });

  it('defers remount from disconnect facts until the real old lease and subscription retire', () => {
    const h = createHarness(false);
    const boundary = document.createElement('div');
    const target = document.createElement('div');
    document.body.append(boundary, target);
    let subscribers = 0;
    const host = createBoundWebScrollSurfaceHost({
      boundary,
      getTarget: () => target,
      isReady: () => true,
      subscribeTarget() {
        subscribers++;
        return () => {
          subscribers--;
        };
      },
      moveGestureHost: {
        attach() {
          throw new Error('unexpected gesture');
        },
      },
    });
    h.vault.attach([[SCROLL_SURFACE_HOST_CAP, host]]);
    h.module.hooks.onMountPhase?.('mounted', 1);
    let remounted = false;
    h.surface.projection.watch((_run, event) => {
      if (event.type !== 'next' || event.next !== 'unresolved' || remounted) return;
      remounted = true;
      h.module.hooks.onMountPhase?.('mounted', 2);
    });
    try {
      expect(() => h.module.hooks.onMountPhase?.('detached', 1)).not.toThrow();
      expect(h.surface.projection.get()).toBe('system');
      expect(target.style.overflowY).toBe('auto');
      expect(subscribers).toBe(1);
    } finally {
      h.module.hooks.onProtoPhase?.('unmounted');
      boundary.remove();
      target.remove();
    }
    expect(subscribers).toBe(0);
  });
});

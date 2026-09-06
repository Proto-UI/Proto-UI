import { describe, expect, it } from 'vitest';
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

function createHarness(withHost = true, initialFacts?: ScrollSurfaceSnapshot) {
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
  return { sys, module, surface, connections, requests, getDisposed: () => disposed };
}

describe('module-scroll: fake host contract', () => {
  it('projects fake-host facts and routes the semantic request without host geometry', () => {
    const harness = createHarness();
    harness.module.hooks.onMountPhase?.('mounted', 1);
    const connection = harness.connections[0];
    expect(connection.config.endFollow).toEqual({ mode: 'while-at-end', axis: 'vertical' });

    harness.sys.phase = 'callback';
    connection.onFacts(snapshot('following', 'applied'));

    expect(harness.surface.vertical.atEnd.get()).toBe(true);
    expect(harness.surface.endFollow.state.get()).toBe('following');
    expect(harness.surface.endFollow.requestStatus.get()).toBe('applied');
    expect(Object.keys(harness.surface)).not.toEqual(
      expect.arrayContaining(['target', 'controller', 'offset', 'extent'])
    );

    harness.surface.request({ kind: 'to-end', axis: 'vertical' });
    expect(harness.requests).toEqual([{ kind: 'to-end', axis: 'vertical' }]);
  });

  it('ignores stale fake-host facts after replacement and disposes the old lease', () => {
    const harness = createHarness();
    harness.module.hooks.onMountPhase?.('mounted', 1);
    const first = harness.connections[0];
    harness.module.hooks.onMountPhase?.('detached', 1);
    harness.module.hooks.onMountPhase?.('mounted', 2);
    const replacement = harness.connections[1];
    expect(harness.getDisposed()).toBe(1);

    harness.sys.phase = 'callback';
    replacement.onFacts(snapshot('following', 'applied'));
    first.onFacts(snapshot('paused', 'rejected'));

    expect(harness.surface.endFollow.state.get()).toBe('following');
    expect(harness.surface.endFollow.requestStatus.get()).toBe('applied');
    expect(harness.surface.vertical.atEnd.get()).toBe(true);
  });

  it('preserves the latest nested host outcome during snapshot application', () => {
    const harness = createHarness();
    harness.module.hooks.onMountPhase?.('mounted', 1);
    const connection = harness.connections[0];
    let interrupted = false;
    harness.surface.endFollow.state.watch((_run, event) => {
      if (event.type !== 'next' || event.next !== 'pending' || interrupted) return;
      interrupted = true;
      harness.surface.request({ kind: 'by', axis: 'vertical', delta: -0.1 });
      connection.onFacts(snapshot('paused', 'rejected'));
    });
    harness.sys.phase = 'callback';

    connection.onFacts(snapshot('pending', 'pending'));

    expect(harness.surface.endFollow.state.get()).toBe('paused');
    expect(harness.surface.endFollow.requestStatus.get()).toBe('rejected');
  });

  it('invalidates an in-progress snapshot when its watcher detaches the surface', () => {
    const harness = createHarness();
    harness.module.hooks.onMountPhase?.('mounted', 1);
    const connection = harness.connections[0];
    let detached = false;
    harness.surface.endFollow.state.watch((_run, event) => {
      if (event.type !== 'next' || event.next !== 'pending' || detached) return;
      detached = true;
      harness.module.hooks.onMountPhase?.('detached', 1);
    });
    harness.sys.phase = 'callback';

    connection.onFacts(snapshot('pending', 'pending'));

    expect(harness.surface.projection.get()).toBe('unresolved');
    expect(harness.surface.endFollow.state.get()).toBe('off');
    expect(harness.surface.endFollow.requestStatus.get()).toBe('idle');
  });

  it('replays a request emitted by an initial fact watcher after the host lease attaches', () => {
    const harness = createHarness(true, snapshot('pending', 'pending'));
    let requested = false;
    harness.surface.endFollow.state.watch((_run, event) => {
      if (event.type !== 'next' || event.next !== 'pending' || requested) return;
      requested = true;
      harness.surface.request({ kind: 'by', axis: 'vertical', delta: -0.1 });
    });

    harness.module.hooks.onMountPhase?.('mounted', 1);

    expect(harness.requests).toEqual([{ kind: 'by', axis: 'vertical', delta: -0.1 }]);
  });

  it('rejects to-end when no current host lease can apply it', () => {
    const harness = createHarness(false);
    harness.module.hooks.onMountPhase?.('mounted', 1);
    harness.sys.phase = 'callback';

    harness.surface.request({ kind: 'to-end', axis: 'vertical' });

    expect(harness.surface.endFollow.requestStatus.get()).toBe('rejected');
  });
});

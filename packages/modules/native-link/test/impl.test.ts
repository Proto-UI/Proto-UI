import { describe, expect, it, vi } from 'vitest';
import type { RunHandle } from '@proto.ui/core';
import { CapsVault, SYS_CAP, type SystemCaps } from '@proto.ui/module-base';
import {
  NativeLinkModuleImpl,
  NATIVE_LINK_HOST_CAP,
  NATIVE_LINK_RUN_IN_CALLBACK_CAP,
  declareNativeLink,
  type NativeLinkHost,
  type NativeLinkHostConnection,
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
    ensureExecPhase(_op, expected) {
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
    deferAfterCallback() {},
    set phase(value: 'setup' | 'callback') {
      phase = value;
    },
  } as TestSystemCaps;
}

function harness(host?: NativeLinkHost, declared = true) {
  const sys = createSystemCaps();
  const vault = new CapsVault();
  vault.attachBase([[SYS_CAP, sys]]);
  if (host)
    vault.attach([
      [NATIVE_LINK_HOST_CAP, host],
      [
        NATIVE_LINK_RUN_IN_CALLBACK_CAP,
        (fn: () => void) => {
          sys.phase = 'callback';
          try {
            fn();
          } finally {
            sys.phase = 'setup';
          }
        },
      ],
    ]);
  const impl = new NativeLinkModuleImpl(vault, declared ? [declareNativeLink()] : []);
  return { impl, sys, vault };
}
const event = { href: '#safe', target: '', rel: '', modified: false };
describe('native-link module lifetime', () => {
  it('requires a declaration, one setup handle, and callback-only full sync', () => {
    expect(() => harness(undefined, false).impl.declare()).toThrow('static');
    const { impl, sys } = harness();
    const link = impl.declare();
    expect(() => impl.declare()).toThrow('one link');
    expect(() => link.sync({ href: '#safe' })).toThrow('illegal phase');
    sys.phase = 'callback';
    link.sync({ href: '#safe', target: '_blank', rel: 'external' });
    expect(link.snapshot()).toEqual({
      href: '#safe',
      target: '_blank',
      rel: 'external noopener',
      disabled: false,
    });
    link.sync({ href: '#next' });
    expect(link.snapshot()).toEqual({ href: '#next', target: '', rel: '', disabled: false });
    impl.dispose();
    expect(link.snapshot()).toBeNull();
  });
  it('diagnoses unsupported mounted hosts, without faking native support', () => {
    const { impl } = harness();
    impl.declare();
    expect(() => impl.onMountPhase('mounted', 1)).toThrow('does not provide');
    impl.dispose();
  });
  it('disposes a lease created reentrantly after the owner already unmounted', () => {
    const dispose = vi.fn();
    const host: NativeLinkHost = {
      attach() {
        impl.onMountPhase('unmounting', 2);
        return { update() {}, dispose };
      },
    };
    const { impl } = harness(host);
    impl.declare();
    impl.onMountPhase('mounted', 1);
    expect(dispose).toHaveBeenCalledOnce();
    impl.dispose();
    expect(dispose).toHaveBeenCalledOnce();
  });
  it('replays the latest configuration when attach synchronously changes the properties', () => {
    const update = vi.fn();
    const host: NativeLinkHost = {
      attach() {
        link.sync({ href: '#new' });
        return { update, dispose() {} };
      },
    };
    const { impl, sys } = harness(host);
    const link = impl.declare();
    sys.phase = 'callback';
    link.sync({ href: '#old' });
    impl.onMountPhase('mounted', 1);
    expect(update).toHaveBeenCalledWith({ href: '#new', target: '', rel: '', disabled: false });
    impl.dispose();
  });
  it('rejects old host callbacks after detach and stops listeners after reentrant disposal', () => {
    const connections: NativeLinkHostConnection[] = [];
    const dispose = vi.fn();
    const host: NativeLinkHost = {
      attach(connection) {
        connections.push(connection);
        return { update() {}, dispose };
      },
    };
    const { impl, sys } = harness(host);
    const link = impl.declare();
    const first = vi.fn(() => impl.dispose());
    const second = vi.fn();
    link.on('navigate', first);
    link.on('navigate', second);
    sys.phase = 'callback';
    link.sync({ href: '#safe' });
    sys.phase = 'setup';
    impl.onMountPhase('mounted', 1);
    impl.onMountPhase('detached', 2);
    connections[0].onNavigate(event);
    expect(first).not.toHaveBeenCalled();
    impl.onMountPhase('mounted', 3);
    connections[1].onNavigate(event);
    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
    expect(dispose).toHaveBeenCalledTimes(2);
  });
});

import { describe, expect, it } from 'vitest';
import { SYS_CAP, type ModuleDeps } from '@proto.ui/module-base';
import { createExposeEventDeclaration, type ExposePort } from '@proto.ui/module-expose';

import { EVENT_EMIT_CAP, EXPOSE_EVENT_SINK_CAP } from '../src/caps';
import { ExposeEventModuleImpl } from '../src/impl';

type ExecPhase = 'setup' | 'render' | 'callback' | 'unknown';

function createHarness(entries: Record<string, unknown> = {}) {
  let phase: ExecPhase = 'setup';
  const registry = new Map<string, unknown>(Object.entries(entries));
  const store = new Map<string, unknown>();
  const sys = {
    execPhase: () => phase,
    domain: () => (phase === 'setup' ? 'setup' : 'runtime'),
    protoPhase: () => 'setup',
    instancePhase: () => 'setup',
    mountPhase: () => 'detached',
    isDisposed: () => false,
    ensureNotDisposed: () => undefined,
    ensureExecPhase: () => undefined,
    ensureSetup(op: string) {
      if (phase !== 'setup') throw new Error(`[Phase] ${op} must run in setup`);
    },
    ensureRuntime(op: string) {
      if (phase === 'setup') throw new Error(`[Phase] ${op} must run at runtime`);
    },
    ensureCallback: () => undefined,
    getCallbackCtx: () => undefined,
    deferAfterCallback: () => undefined,
  };
  store.set(SYS_CAP.id, sys);

  const exposePort: ExposePort = {
    get: (key) => registry.get(key),
    getAll: () => Object.fromEntries(registry),
    has: (key) => registry.has(key),
    keys: () => [...registry.keys()],
  };
  const deps: ModuleDeps = {
    requirePort: <T>(name: string) => {
      if (name !== 'expose') throw new Error(`unexpected dependency: ${name}`);
      return exposePort as T;
    },
    tryPort: <T>(name: string) => (name === 'expose' ? (exposePort as T) : undefined),
    requireFacade: () => {
      throw new Error('unexpected facade dependency');
    },
    tryFacade: () => undefined,
  };
  const caps = {
    has: (token: { id: string }) => store.has(token.id),
    get: (token: { id: string }) => store.get(token.id),
    onChange: () => () => undefined,
  } as any;

  return {
    impl: new ExposeEventModuleImpl(caps, deps, 'p-x'),
    setPhase(next: ExecPhase) {
      phase = next;
    },
    setSink(sink?: (...args: any[]) => void) {
      if (sink) store.set(EXPOSE_EVENT_SINK_CAP.id, sink);
      else store.delete(EXPOSE_EVENT_SINK_CAP.id);
    },
  };
}

describe('ExposeEventModuleImpl', () => {
  it('keeps the legacy emit token as the exact canonical sink alias', () => {
    expect(EVENT_EMIT_CAP).toBe(EXPOSE_EVENT_SINK_CAP);
  });

  it('validates setup declarations against the shared Expose registry', () => {
    const h = createHarness({ ready: createExposeEventDeclaration({ payload: 'json' }), value: 1 });

    expect(() => h.impl.registerExposeEvent('ready', { payload: 'json' })).not.toThrow();
    expect(() => h.impl.registerExposeEvent('value')).toThrow(
      /not registered as an expose\.event/i
    );
    expect(() => h.impl.registerExposeEvent('missing')).toThrow(
      /not registered as an expose\.event/i
    );
    expect(() => h.impl.registerExposeEvent('')).toThrow(/non-empty string/i);

    h.setPhase('callback');
    expect(() => h.impl.registerExposeEvent('ready')).toThrow(/must run in setup/i);
  });

  it('emits through the current sink without replay and rejects non-event keys', () => {
    const h = createHarness({ ready: createExposeEventDeclaration() });
    const first: unknown[] = [];
    const second: unknown[] = [];
    h.setSink((...args) => first.push(args));

    expect(() => h.impl.emit('ready')).toThrow(/must run at runtime/i);
    h.setPhase('callback');
    h.impl.emit('ready', { ok: true }, { note: 'x' });

    h.setSink((...args) => second.push(args));
    h.impl.emit('ready');
    h.setSink(undefined);
    h.impl.emit('ready');

    expect(first).toEqual([['ready', { ok: true }, { note: 'x' }]]);
    expect(second).toEqual([['ready', undefined, undefined]]);
    expect(() => h.impl.emit('missing')).toThrow(/unregistered expose\.event/i);
  });

  it('contains host sink failures at the Adapter boundary', () => {
    const h = createHarness({ ready: createExposeEventDeclaration() });
    h.setSink(() => {
      throw new Error('host failure');
    });
    h.setPhase('callback');

    expect(() => h.impl.emit('ready')).not.toThrow();
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import { createContextKey, type CapsVaultView } from '@proto.ui/core';
import { createContextModule } from '../src/create';
import type { ContextPort } from '../src/types';
import { ContextModuleImpl } from '../src/impl';
import { CONTEXT_CENTER } from '../src/center';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '../src/caps';
import { createSysCaps, makeCaps } from './utils/fake-caps';

const owned: ContextModuleImpl[] = [];
afterEach(() => {
  for (const module of owned.splice(0)) module.dispose();
});
const create = (caps: CapsVaultView) => {
  const module = new ContextModuleImpl(caps, 'context-boundary');
  owned.push(module);
  return module;
};

describe('Context capability boundary', () => {
  it('T-CONTEXT-0003-CASE-SURFACE: separates author authority from privileged diagnostics', () => {
    const sys = createSysCaps();
    const token = {};
    const module = createContextModule({
      init: { prototypeName: 'context-surface', declarations: [] },
      caps: makeCaps({ sys, instanceToken: token, getParent: () => null }),
      deps: {
        requireFacade() {
          throw new Error('unexpected dependency');
        },
        requirePort() {
          throw new Error('unexpected dependency');
        },
        tryFacade: () => undefined,
        tryPort: () => undefined,
      },
    });
    const port = (module as typeof module & { port: ContextPort }).port;
    const key = createContextKey<{ value: number }>('surface');
    try {
      expect(Object.keys(module.facade).sort()).toEqual([
        'provide',
        'read',
        'subscribe',
        'tryRead',
        'trySubscribe',
        'tryUpdate',
        'update',
      ]);
      expect(Object.keys(port).sort()).toEqual([
        'dumpCallbackQueue',
        'dumpProviders',
        'dumpSubscriptions',
        'resolveScope',
        'setCallbackDispatcher',
      ]);
      module.facade.provide(key, { value: 1 });
      expect(port.resolveScope(key)).toBe(token);
      expect(() => module.facade.update(key, { value: 2 })).toThrow();
      sys.__setExecPhase('callback');
      module.facade.update(key, { value: 2 }); // Provider exception is write-only.
      expect(port.dumpProviders().find((row) => row.instance === token)?.value).toEqual({
        value: 2,
      });
      expect(() => module.facade.read(key)).toThrow();
      expect(() => module.facade.tryUpdate(key, { value: 3 })).toThrow();
      expect(() => module.facade.subscribe(key)).toThrow();
    } finally {
      module.hooks.dispose?.();
    }
  });

  it('T-CONTEXT-0003-CASE-HOST: uses opaque identity and current ancestry for read, update and callback routing', () => {
    const key = createContextKey<{ value: number }>('scope');
    const a = {},
      b = {},
      c = {};
    let parent: object | null = a;
    const getParent = (token: unknown) => (token === c ? parent : null);
    const sysA = createSysCaps(),
      sysB = createSysCaps(),
      sysC = createSysCaps();
    const pA = create(makeCaps({ sys: sysA, instanceToken: a, getParent }));
    const pB = create(makeCaps({ sys: sysB, instanceToken: b, getParent }));
    const child = create(makeCaps({ sys: sysC, instanceToken: c, getParent }));
    pA.provide(key, { value: 1 });
    pB.provide(key, { value: 10 });
    const seen: number[] = [];
    const off = child.trySubscribe(key, (_run, next) => seen.push(next!.value));
    for (const sys of [sysA, sysB, sysC]) sys.__setExecPhase('callback');
    expect(child.tryRead(key)).toEqual({ value: 1 });
    expect(child.resolveScope(key)).toBe(a);
    parent = b;
    expect(child.tryRead(key)).toEqual({ value: 10 });
    expect(child.resolveScope(key)).toBe(b);
    expect(seen).toEqual([]); // Ancestry changes are not value notifications.
    pA.update(key, { value: 2 });
    expect(seen).toEqual([]);
    expect(child.tryUpdate(key, { value: 11 })).toBe(true);
    expect(seen).toEqual([11]);
    expect(CONTEXT_CENTER.getProviderValue(a, key)).toEqual({ value: 2 });
    parent = null;
    expect(child.tryRead(key)).toBeNull();
    expect(child.tryUpdate(key, { value: 12 })).toBe(false);
    expect(CONTEXT_CENTER.getProviderValue(b, key)).toEqual({ value: 11 });
    parent = b;
    off();
    pB.update(key, { value: 13 });
    expect(seen).toEqual([11]);
  });

  it('T-CONTEXT-0003-CASE-EXPLICIT-CONSUMER: distinguishes omission, undefined and null through the actual port', () => {
    const key = createContextKey<{ value: number }>('explicit-consumer');
    const owner = {},
      elsewhere = {};
    const getParent = (token: unknown) => (token === undefined ? elsewhere : null);
    const ancestor = create(makeCaps({ instanceToken: elsewhere, getParent }));
    ancestor.provide(key, { value: 2 });
    const module = createContextModule({
      init: { prototypeName: 'port-owner', declarations: [] },
      caps: makeCaps({ instanceToken: owner, getParent }),
      deps: {
        requireFacade() {
          throw new Error('unexpected');
        },
        requirePort() {
          throw new Error('unexpected');
        },
        tryFacade: () => undefined,
        tryPort: () => undefined,
      },
    });
    const port = (module as typeof module & { port: ContextPort }).port;
    try {
      module.facade.provide(key, { value: 1 });
      expect(port.resolveScope(key)).toBe(owner);
      expect(port.resolveScope(key, undefined)).toBe(elsewhere);
      expect(port.resolveScope(key, null)).toBeNull();
      expect(port.resolveScope(key, {})).toBeNull();
    } finally {
      module.hooks.dispose?.();
    }
  });

  it.each([0, false, '', undefined, NaN])(
    'T-CONTEXT-0003-CASE-OPAQUE-TOKEN: resolves, updates and disposes opaque token %s',
    (token) => {
      const key = createContextKey<{ value: number }>('falsy-owner');
      const childToken = {};
      const getParent = (instance: unknown) => (instance === childToken ? token : null);
      const providerSys = createSysCaps(),
        consumerSys = createSysCaps();
      const provider = create(makeCaps({ sys: providerSys, instanceToken: token, getParent }));
      const consumer = create(makeCaps({ sys: consumerSys, instanceToken: childToken, getParent }));
      const received: number[] = [];
      provider.provide(key, { value: 1 });
      try {
        provider.subscribe(key);
        consumer.trySubscribe(key, (_run, next) => received.push(next!.value));
        expect(provider.resolveScope(key)).toBe(token);
        expect(consumer.resolveScope(key)).toBe(token);
        providerSys.__setExecPhase('callback');
        consumerSys.__setExecPhase('callback');
        expect(provider.read(key)).toEqual({ value: 1 });
        expect(consumer.tryRead(key)).toEqual({ value: 1 });
        provider.update(key, { value: 2 });
        consumer.update(key, { value: 3 });
        expect(consumer.tryUpdate(key, { value: 4 })).toBe(true);
        expect(
          CONTEXT_CENTER.updateFromConsumer(childToken, key, { value: 5 }, null, getParent)
        ).toBe(true);
        expect(received).toEqual([2, 3, 4, 5]);
      } finally {
        provider.dispose();
        expect(CONTEXT_CENTER.dumpProviders().filter((row) => row.key === key)).toEqual([]);
        expect(
          CONTEXT_CENTER.dumpSubscriptions().some(
            (row) => row.key === key && Object.is(row.instance, token)
          )
        ).toBe(false);
      }
      expect(consumer.tryRead(key)).toBeNull();
      expect(consumer.tryUpdate(key, { value: 6 })).toBe(false);
      expect(
        CONTEXT_CENTER.updateFromConsumer(childToken, key, { value: 6 }, null, getParent)
      ).toBe(false);
    }
  );

  it.each(['missing identity', 'null identity', 'missing ancestry'] as const)(
    'T-CONTEXT-0003-CASE-AVAILABILITY: actual port diagnoses %s for omitted-owner resolution',
    (scenario) => {
      const key = createContextKey<{ value: number }>('port-capability-diagnostic');
      const full = makeCaps({
        instanceToken: scenario === 'null identity' ? null : {},
        getParent: () => null,
      }) as CapsVaultView;
      const absentId =
        scenario === 'missing identity'
          ? CONTEXT_INSTANCE_TOKEN_CAP.id
          : scenario === 'missing ancestry'
            ? CONTEXT_PARENT_CAP.id
            : null;
      const module = createContextModule({
        init: { prototypeName: 'port-capability-diagnostic', declarations: [] },
        caps: { ...full, has: (token) => token.id !== absentId && full.has(token) },
        deps: {
          requireFacade() {
            throw new Error('unexpected');
          },
          requirePort() {
            throw new Error('unexpected');
          },
          tryFacade: () => undefined,
          tryPort: () => undefined,
        },
      });
      const port = (module as typeof module & { port: ContextPort }).port;
      try {
        // Explicit absence needs neither the owner's identity nor traversal.
        expect(port.resolveScope(key, null)).toBeNull();
        expect(() => port.resolveScope(key)).toThrow(
          scenario === 'missing ancestry' ? /parent getter/ : /instance token/
        );
        // An explicit valid consumer does not need the miswired owner's identity.
        if (scenario !== 'missing ancestry') expect(port.resolveScope(key, {})).toBeNull();
      } finally {
        module.hooks.dispose?.();
      }
    }
  );

  it('T-CONTEXT-0003-CASE-AVAILABILITY: fails at capability use without inventing an ancestry fallback', () => {
    const key = createContextKey<{ value: number }>('missing-cap');
    const full = makeCaps({ instanceToken: {}, getParent: () => null }) as CapsVaultView;
    const missing = (id: string): CapsVaultView => ({
      ...full,
      has: (token) => token.id !== id && full.has(token),
    });
    const nullIdentity = create(makeCaps({ instanceToken: null, getParent: () => null }));
    expect(() => nullIdentity.provide(key, { value: 0 })).toThrow(/null instance token/);
    const noIdentity = create(missing(CONTEXT_INSTANCE_TOKEN_CAP.id));
    expect(() => noIdentity.provide(key, { value: 0 })).toThrow(/instance token/);
    const noParent = create(missing(CONTEXT_PARENT_CAP.id));
    // Pure declaration does not require traversal; lookup does.
    noParent.provide(key, { value: 0 });
    expect(() => noParent.subscribe(key)).toThrow(/parent getter/);
  });
});

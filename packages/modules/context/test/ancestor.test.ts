import { afterEach, describe, expect, it } from 'vitest';
import { createContextKey } from '@proto.ui/core';
import { ContextModuleImpl } from '../src/impl';
import { CONTEXT_CENTER } from '../src/center';
import { CONTEXT_PARENT_CAP } from '../src/caps';
import { createSysCaps, makeCaps } from './utils/fake-caps';

const owned: ContextModuleImpl[] = [];
afterEach(() => {
  for (const impl of owned.splice(0)) impl.dispose();
});
function fixture() {
  const key = createContextKey<{ value: number }>('ancestor');
  const parents = new Map<unknown, unknown>();
  const getParent = (token: unknown) => (parents.has(token) ? parents.get(token) : null);
  const make = (...args: unknown[]) => {
    const token = args.length ? args[0] : {};
    const sys = createSysCaps();
    const impl = new ContextModuleImpl(
      makeCaps({ sys, instanceToken: token, getParent }),
      'ancestor'
    );
    owned.push(impl);
    return { token, impl, sys };
  };
  const outer = make(),
    inner = make(),
    leaf = make(),
    other = make();
  parents.set(inner.token, outer.token);
  parents.set(leaf.token, inner.token);
  outer.impl.provide(key, { value: 1 });
  inner.impl.provide(key, { value: 10 });
  other.impl.provide(key, { value: 100 });
  const runtime = () => {
    for (const owner of [outer, inner, leaf, other]) owner.sys.__setExecPhase('callback');
  };
  return { key, parents, getParent, make, outer, inner, leaf, other, runtime };
}

describe('explicit optional strict-ancestor Context', () => {
  it('separates same-key self-inclusive and strict-ancestor intent and values', () => {
    const f = fixture(),
      seen: number[] = [];
    f.inner.impl.subscribe(f.key);
    f.inner.impl.trySubscribeAncestor(f.key, (_, next) => seen.push(next!.value));
    f.leaf.impl.trySubscribeAncestor(f.key);
    f.outer.impl.trySubscribeAncestor(f.key);
    f.runtime();
    expect(f.inner.impl.read(f.key)).toEqual({ value: 10 });
    expect(f.inner.impl.tryReadAncestor(f.key)).toEqual({ value: 1 });
    expect(f.leaf.impl.tryReadAncestor(f.key)).toEqual({ value: 10 });
    expect(f.outer.impl.tryReadAncestor(f.key)).toBeNull();
    f.inner.impl.update(f.key, { value: 11 });
    expect(seen).toEqual([]);
    f.outer.impl.update(f.key, { value: 2 });
    expect(seen).toEqual([2]);
    expect(f.inner.impl.read(f.key)).toEqual({ value: 11 });
  });

  it('does not grant ordinary read or consumer write authority from ancestor intent', () => {
    const f = fixture();
    f.leaf.impl.trySubscribeAncestor(f.key);
    f.runtime();
    expect(() => f.leaf.impl.tryRead(f.key)).toThrow(/requires optional subscription/);
    expect(() => f.leaf.impl.update(f.key, { value: 5 })).toThrow(/requires prior subscription/);
    expect(() => f.leaf.impl.tryUpdate(f.key, { value: 5 })).toThrow(
      /requires optional subscription/
    );
    expect(() => f.inner.impl.tryReadAncestor(f.key)).toThrow(/ancestor subscription/);
  });

  it('re-resolves nearest current ancestry and removed providers without synthetic callbacks', () => {
    const f = fixture(),
      seen: number[] = [];
    f.inner.impl.trySubscribeAncestor(f.key, (_, next) => seen.push(next!.value));
    f.leaf.impl.trySubscribeAncestor(f.key);
    f.runtime();
    f.parents.set(f.inner.token, f.other.token);
    expect(f.inner.impl.tryReadAncestor(f.key)).toEqual({ value: 100 });
    expect(seen).toEqual([]);
    f.outer.impl.update(f.key, { value: 2 });
    expect(seen).toEqual([]);
    f.other.impl.update(f.key, { value: 101 });
    expect(seen).toEqual([101]);
    f.inner.impl.dispose();
    expect(f.leaf.impl.tryReadAncestor(f.key)).toEqual({ value: 101 });
    f.other.impl.dispose();
    expect(f.leaf.impl.tryReadAncestor(f.key)).toBeNull();
    expect(
      CONTEXT_CENTER.dumpSubscriptions().filter((row) => row.instance === f.inner.token)
    ).toEqual([]);
  });

  it('accepts absence at setup and binds a later provider without redeclaration', () => {
    const f = fixture(),
      seen: number[] = [];
    f.outer.impl.trySubscribeAncestor(f.key, (_, next) => seen.push(next!.value));
    f.runtime();
    expect(f.outer.impl.tryReadAncestor(f.key)).toBeNull();
    f.parents.set(f.outer.token, f.other.token);
    f.other.impl.update(f.key, { value: 101 });
    expect(seen).toEqual([101]);
    expect(f.outer.impl.tryReadAncestor(f.key)).toEqual({ value: 101 });
  });

  it('checks setup/runtime phases and missing ancestry rather than guessing a host tree', () => {
    const f = fixture();
    f.inner.impl.trySubscribeAncestor(f.key);
    expect(() => f.inner.impl.tryReadAncestor(f.key)).toThrow(/illegal phase/);
    f.runtime();
    expect(() => f.inner.impl.trySubscribeAncestor(f.key)).toThrow(/illegal phase/);
    const sys = createSysCaps();
    const caps = makeCaps({ sys, instanceToken: {}, getParent: f.getParent });
    const impl = new ContextModuleImpl(
      { ...caps, has: (token) => token.id !== CONTEXT_PARENT_CAP.id && caps.has(token) },
      'no-parent'
    );
    owned.push(impl);
    impl.trySubscribeAncestor(f.key); // A declaration needs no traversal.
    sys.__setExecPhase('callback');
    expect(() => impl.tryReadAncestor(f.key)).toThrow(/parent getter/);
  });

  it.each(['unsubscribe', 'dispose', 'reparent', 'remove-provider', 'replace-provider'] as const)(
    'rejects queued and later callbacks after reentrant %s',
    (action) => {
      const f = fixture(),
        seen: number[] = [];
      let off = () => {};
      f.inner.impl.trySubscribeAncestor(f.key, (_, next) => {
        if (next!.value !== 2) return;
        f.outer.impl.update(f.key, { value: 3 });
        if (action === 'unsubscribe') off();
        else if (action === 'dispose') f.inner.impl.dispose();
        else if (action === 'reparent') f.parents.set(f.inner.token, f.other.token);
        else {
          f.outer.impl.dispose();
          if (action === 'replace-provider')
            CONTEXT_CENTER.provide(f.outer.token, f.key, { value: 20 });
        }
      });
      off = f.inner.impl.trySubscribeAncestor(f.key, (_, next) => seen.push(next!.value));
      f.runtime();
      f.outer.impl.update(f.key, { value: 2 });
      expect(seen).toEqual([]);
      expect(CONTEXT_CENTER.dumpCallbackQueue()).toEqual([]);
    }
  );

  it.each(['unsubscribe', 'dispose', 'reparent', 'remove-provider'] as const)(
    'rechecks eligibility inside a deferred Runtime dispatcher after %s',
    (action) => {
      const f = fixture(),
        seen: number[] = [],
        pending: Array<(ctx: unknown) => void> = [];
      f.inner.impl.setCallbackDispatcher((task) => pending.push(task));
      const off = f.inner.impl.trySubscribeAncestor(f.key, (_, next) => seen.push(next!.value));
      f.runtime();
      f.outer.impl.update(f.key, { value: 2 });
      expect(pending).toHaveLength(1);
      if (action === 'unsubscribe') off();
      else if (action === 'dispose') f.inner.impl.dispose();
      else if (action === 'reparent') f.parents.set(f.inner.token, f.other.token);
      else f.outer.impl.dispose();
      for (const task of pending) task({});
      expect(seen).toEqual([]);
    }
  );

  it('keeps transition order through recursive ancestor composition and releases only the named callback', () => {
    const f = fixture(),
      seen: number[] = [];
    f.inner.impl.trySubscribeAncestor(f.key, (ctx, next) => {
      expect(ctx).toBe('recipient-run');
      f.inner.impl.update(f.key, { value: next!.value * 10 });
    });
    f.inner.impl.setCallbackDispatcher((task) => task('recipient-run'));
    const off = f.leaf.impl.trySubscribeAncestor(f.key, (_, next) => seen.push(next!.value));
    f.runtime();
    f.outer.impl.update(f.key, { value: 2 });
    f.outer.impl.update(f.key, { value: 3 });
    expect(seen).toEqual([20, 30]);
    off();
    off();
    f.outer.impl.update(f.key, { value: 4 });
    expect(seen).toEqual([20, 30]);
    expect(f.leaf.impl.tryReadAncestor(f.key)).toEqual({ value: 40 });
    expect(
      CONTEXT_CENTER.dumpSubscriptions().find((row) => row.instance === f.leaf.token)?.callbackCount
    ).toBe(0);
  });

  it.each([0, false, '', undefined, NaN])(
    'preserves opaque ancestor token identity: %s',
    (token) => {
      const f = fixture(),
        provider = f.make(token),
        seen: number[] = [];
      provider.impl.provide(f.key, { value: 7 });
      f.parents.set(f.inner.token, token);
      f.inner.impl.trySubscribeAncestor(f.key, (_, next) => seen.push(next!.value));
      f.runtime();
      provider.sys.__setExecPhase('callback');
      expect(f.inner.impl.tryReadAncestor(f.key)).toEqual({ value: 7 });
      provider.impl.update(f.key, { value: 8 });
      expect(seen).toEqual([8]);
    }
  );
});

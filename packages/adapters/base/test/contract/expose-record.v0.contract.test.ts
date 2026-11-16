import { describe, expect, it, vi } from 'vitest';
import { EXPOSE_STATE_EXTERNAL_HANDLE } from '@proto.ui/module-expose-state';

import { createScopedExposesReader } from '../../src/host/exposes';

describe('adapter-base contract: expose record (v0)', () => {
  it('preserves arbitrary keys and invokes nested methods in callback scope', () => {
    const invoke = vi.fn((call: () => void) => call());
    const reader = createScopedExposesReader(() => invoke);
    const protoValue = { run: () => 'ok' };
    const record: Record<string, unknown> = {};
    Object.defineProperty(record, '__proto__', {
      value: protoValue,
      enumerable: true,
      configurable: true,
      writable: true,
    });

    const snapshot = reader.read(record);

    expect(Object.getPrototypeOf(snapshot)).toBe(Object.prototype);
    expect(Object.hasOwn(snapshot, '__proto__')).toBe(true);
    expect((snapshot.__proto__ as { run(): string }).run()).toBe('ok');
    expect(invoke).toHaveBeenCalledOnce();
  });

  it('keeps collection coordination entries on the internal channel', () => {
    const reader = createScopedExposesReader(() => (call) => call());
    const snapshot = reader.read({
      __collectionItem: () => ({ value: 'a' }),
      __collectionSnapshot: () => ({ index: 0 }),
      checked: true,
    });

    expect(snapshot).toEqual({ checked: true });
    expect(Object.hasOwn(snapshot, '__collectionItem')).toBe(false);
    expect(Object.hasOwn(snapshot, '__collectionSnapshot')).toBe(false);
  });

  it('preserves the owning receiver when projecting nested methods', () => {
    const invoke = vi.fn((call: () => void) => call());
    const reader = createScopedExposesReader(() => invoke);
    const api = {
      answer: 42,
      getAnswer() {
        return this.answer;
      },
    };

    const snapshot = reader.read({ api });

    expect((snapshot.api as typeof api).getAnswer()).toBe(42);
    expect(invoke).toHaveBeenCalledOnce();
  });

  it('preserves opaque host values and data-only graph identities', () => {
    const reader = createScopedExposesReader(() => (call) => call());
    class HostValue {
      constructor(readonly value: string) {}
    }

    const date = new Date('2026-08-14T00:00:00.000Z');
    const map = new Map([['answer', 42]]);
    const hostValue = new HostValue('host-local');
    const shared = { label: 'shared' };
    const cyclic: Record<string, unknown> = { shared };
    cyclic.self = cyclic;

    const snapshot = reader.read({
      values: { date, map, hostValue, cyclic, shared },
      alias: shared,
    });
    const values = snapshot.values as Record<string, any>;

    expect(values.date).toBe(date);
    expect(values.map).toBe(map);
    expect(values.hostValue).toBe(hostValue);
    expect(values.cyclic).toBe(cyclic);
    expect(values.cyclic.self).toBe(values.cyclic);
    expect(values.shared).toBe(snapshot.alias);
  });

  it('projects array callables in callback scope while preserving cycles', () => {
    const invoke = vi.fn((call: () => void) => call());
    const reader = createScopedExposesReader(() => invoke);
    const values: unknown[] = [() => 'ok'];
    values.push(values);

    const snapshot = reader.read({ values });
    const projected = snapshot.values as Array<unknown>;

    expect((projected[0] as () => string)()).toBe('ok');
    expect(invoke).toHaveBeenCalledOnce();
    expect(projected[1]).toBe(projected);
  });

  it('invalidates held callables at terminal disposal instead of bypassing callback scope', () => {
    const invoke = vi.fn((call: () => void) => call());
    const reader = createScopedExposesReader(() => invoke);
    const ping = reader.read({ ping: () => 'pong' }).ping as () => string;

    expect(ping()).toBe('pong');
    reader.invalidate();

    expect(reader.read({ ping: () => 'pong' })).toEqual({});
    expect(() => ping()).toThrow(/terminal disposal/);
  });

  it('fails explicitly when a callable has no live callback scope', () => {
    const reader = createScopedExposesReader(() => null);
    const ping = reader.read({ ping: () => 'pong' }).ping as () => string;

    expect(() => ping()).toThrow(/live callback scope/);
  });

  it('preserves a finalized external state handle across record replacement', () => {
    const reader = createScopedExposesReader((() => (call: () => void) => call()) as any);
    const handle = {
      [EXPOSE_STATE_EXTERNAL_HANDLE]: true,
      get: () => false,
      subscribe: () => () => {},
      unsubscribe: (off: () => void) => off(),
      spec: { kind: 'bool' },
    } as const;

    const first = reader.read({ ready: handle }).ready;
    const second = reader.read({ ready: handle }).ready;

    expect(second).toBe(first);
  });

  it('omits branded signal declarations from the public record without removing author values', () => {
    const reader = createScopedExposesReader(() => null);
    const authorValue = { __pui_expose: 'event', spec: { payload: 'json' } };
    const classification = Symbol.for('@proto.ui/expose/entry-classification');
    const eventDeclaration = Object.freeze({
      [classification]: 'event',
      __pui_expose: 'event',
      spec: { payload: 'json' },
    });

    const snapshot = reader.read({
      ready: eventDeclaration,
      authorValue,
    });

    expect(snapshot).toEqual({ authorValue });
    expect(snapshot.authorValue).toBe(authorValue);
  });
});

describe('returned expose values share the owner boundary', () => {
  it('wraps returned functions once and preserves their identity across factory aliases', () => {
    const invoke = vi.fn((call: () => void) => call());
    const reader = createScopedExposesReader(() => invoke);
    const returned = () => 'result';
    const factory = () => returned;
    const snapshot = reader.read({ factory, alias: factory, direct: returned }) as {
      factory(): () => string;
      alias(): () => string;
      direct(): string;
    };
    expect(snapshot.factory).toBe(snapshot.alias);
    const first = snapshot.factory();
    expect(first).toBe(snapshot.direct);
    expect(snapshot.alias()).toBe(first);
    expect(first()).toBe('result');
    expect(invoke).toHaveBeenCalledTimes(3);
    reader.invalidate();
    expect(() => first()).toThrow(/terminal disposal/);
  });

  it('preserves cyclic callable-record identity through values and results', () => {
    const reader = createScopedExposesReader(() => (call) => call());
    const api: { value: number; read(): number; self?: unknown } = {
      value: 4,
      read() {
        return this.value;
      },
    };
    api.self = api;
    const snapshot = reader.read({ api, factory: () => api }) as {
      api: typeof api;
      factory(): typeof api;
    };
    expect(snapshot.api).not.toBe(api);
    expect(snapshot.api.self).toBe(snapshot.api);
    expect(snapshot.factory()).toBe(snapshot.api);
    expect(snapshot.factory().read).toBe(snapshot.api.read);
    expect(snapshot.api.read()).toBe(4);
  });

  it('refreshes a cached projection without rerunning accessors during discovery', () => {
    const reader = createScopedExposesReader(() => (call) => call());
    let reads = 0;
    const api = {
      value: 1,
      obsolete: 'remove' as string | undefined,
      get current() {
        reads++;
        return this.value;
      },
      next() {
        this.value++;
      },
    };
    const raw = { api, factory: () => api };
    const first = reader.read(raw) as { api: typeof api; factory(): typeof api };
    expect(reads).toBe(1);
    first.api.next();
    delete (api as Partial<typeof api>).obsolete;
    const second = reader.read(raw) as typeof first;
    expect(reads).toBe(2);
    expect(second.api).toBe(first.api);
    expect(first.api.current).toBe(2);
    expect(first.api.value).toBe(2);
    expect(Object.hasOwn(first.api, 'obsolete')).toBe(false);
    expect(second.factory()).toBe(first.api);
    expect(reads).toBe(3);
  });

  it('does not wrap an already projected returned callable or record again', () => {
    const invoke = vi.fn((call: () => void) => call());
    const reader = createScopedExposesReader(() => invoke);
    const api = { read: () => 7 };
    const first = reader.read({ api }) as { api: typeof api };
    const second = reader.read({ echo: () => first.api, read: () => first.api.read }) as {
      echo(): typeof api;
      read(): () => number;
    };
    expect(second.echo()).toBe(first.api);
    expect(second.read()).toBe(first.api.read);
    expect(second.read()()).toBe(7);
    expect(invoke).toHaveBeenCalledTimes(4);
  });

  it('keeps owner caches separate even for a shared author object', () => {
    const firstReader = createScopedExposesReader(() => (call) => call());
    const secondReader = createScopedExposesReader(() => (call) => call());
    const api = { read: () => 7 };
    const first = firstReader.read({ api }) as { api: typeof api };
    const second = secondReader.read({ api }) as typeof first;
    expect(first.api).not.toBe(second.api);
    expect(first.api.read).not.toBe(second.api.read);
    firstReader.invalidate();
    expect(() => first.api.read()).toThrow(/terminal disposal/);
    expect(second.api.read()).toBe(7);
  });

  it('keeps returned registry snapshots detached and propagates thrown values unchanged', () => {
    const reader = createScopedExposesReader(() => (call) => call());
    const failure = Object.freeze({ reason: 'author' });
    const raw = {
      label: 'author',
      read() {
        return this.label;
      },
      factory: () => () => {
        throw failure;
      },
    };
    const snapshot = reader.read(raw) as typeof raw;
    snapshot.label = 'consumer';
    expect(snapshot.read()).toBe('author');
    expect(raw.label).toBe('author');
    let observed: unknown;
    try {
      snapshot.factory()();
    } catch (error) {
      observed = error;
    }
    expect(observed).toBe(failure);
  });
});

describe('replacement expose snapshot callable identity', () => {
  it('retains root callables with current receiver while distinguishing nested receivers', () => {
    const reader = createScopedExposesReader(() => (fn) => fn());
    function readLabel(this: { label: string }) {
      return this.label;
    }
    const a = { label: 'nested-a', readLabel };
    const b = { label: 'nested-b', readLabel };
    const first = reader.read({ label: 'first', readLabel, a, b });
    const next = reader.read({ label: 'next', readLabel, a, b });
    expect(next.readLabel).toBe(first.readLabel);
    expect((first.readLabel as () => string)()).toBe('next');
    const nestedA = next.a as typeof a,
      nestedB = next.b as typeof b;
    expect(nestedA.readLabel).not.toBe(nestedB.readLabel);
    expect(nestedA.readLabel()).toBe('nested-a');
    expect(nestedB.readLabel()).toBe('nested-b');
    reader.invalidate();
    expect(() => (first.readLabel as () => string)()).toThrow(/terminal disposal/);
  });
});

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

  it('preserves opaque host values and projects cyclic plain-record graphs safely', () => {
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
    expect(values.cyclic).not.toBe(cyclic);
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
    expect(snapshot.authorValue).not.toBe(authorValue);
  });
});

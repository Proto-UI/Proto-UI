import { describe, expect, it, vi } from 'vitest';
import { tw } from '@proto.ui/core';
import { OwnedDecorationRegistryModel as Registry } from '../src/style/owned-decoration-registry';

describe('private owned decoration logic model (not adapter activation)', () => {
  it('keeps opaque identities distinct and rejects forged/foreign subjects and owners', () => {
    const a = new Registry(),
      b = new Registry(),
      x = a.declareTarget(),
      y = a.declareTarget();
    expect(x).not.toBe(y);
    expect(Object.isFrozen(x)).toBe(true);
    expect(() => a.snapshot({})).toThrow('unknown target');
    expect(() => b.snapshot(x)).toThrow('foreign');
    const owner = a.declareContribution(x, 'rule');
    expect(() => b.replace(owner, tw('bg-red-500'))).toThrow('foreign');
  });
  it('retains pending intent before complete first binding without any host fallback', () => {
    const r = new Registry(),
      x = r.declareTarget(),
      owner = r.declareContribution(x, 'setup');
    r.replace(owner, tw('bg-red-500'));
    expect(r.snapshot(x).tokens).toEqual(['bg-red-500']);
    expect(() => r.flush()).toThrow('unbound');
    const sink = vi.fn();
    r.bindAll([{ target: x, sink }]);
    expect(sink).toHaveBeenCalledOnce();
    expect(sink.mock.calls[0][0].tokens).toEqual(['bg-red-500']);
  });
  it.each(['duplicate', 'foreign', 'missing', 'unsupported'] as const)(
    'rejects %s batch before any callback',
    (kind) => {
      const r = new Registry(),
        x = r.declareTarget(),
        y = r.declareTarget(),
        sink = vi.fn();
      const bindings = [
        { target: x, sink },
        { target: y, sink },
      ];
      if (kind === 'duplicate') bindings[1].target = x;
      if (kind === 'foreign') bindings[1].target = {};
      if (kind === 'missing') bindings.pop();
      if (kind === 'unsupported') bindings[1].sink = null as any;
      expect(() => r.bindAll(bindings)).toThrow();
      expect(sink).not.toHaveBeenCalled();
      r.bindAll([
        { target: x, sink },
        { target: y, sink },
      ]);
      expect(sink).toHaveBeenCalledTimes(2);
    }
  );
  it('merges independently and preserves declaration priority across replacement and withdrawal', () => {
    const r = new Registry(),
      x = r.declareTarget(),
      y = r.declareTarget();
    const first = r.declareContribution(x, 'rule'),
      second = r.declareContribution(x, 'rule');
    const setup = r.declareContribution(x, 'setup'),
      other = r.declareContribution(y, 'rule');
    r.replace(first, tw('bg-red-500 p-2'));
    r.replace(second, tw('bg-blue-500'));
    r.replace(setup, tw('bg-black'));
    r.replace(other, tw('text-white'));
    const sx = vi.fn(),
      sy = vi.fn();
    r.bindAll([
      { target: x, sink: sx },
      { target: y, sink: sy },
    ]);
    r.replace(first, tw('bg-green-500 p-4'));
    expect(r.snapshot(x).tokens).toEqual(['bg-blue-500', 'p-4']);
    expect(sy).toHaveBeenCalledOnce();
    r.withdraw(second);
    expect(r.snapshot(x).tokens).toEqual(['bg-green-500', 'p-4']);
    r.withdraw(first);
    expect(r.snapshot(x).tokens).toEqual(['bg-black']);
    r.replace(second, tw('bg-blue-500'));
    r.replace(first, tw('bg-red-500'));
    expect(r.snapshot(x).tokens).toEqual(['bg-blue-500']);
  });
  it('validates replacements atomically and copies caller-owned token arrays', () => {
    const r = new Registry(),
      x = r.declareTarget(),
      owner = r.declareContribution(x, 'rule');
    const value = tw('bg-red-500');
    r.replace(owner, value);
    value.tokens[0] = 'bg-blue-500';
    expect(r.snapshot(x).tokens).toEqual(['bg-red-500']);
    expect(() =>
      r.replace(owner, tw('bg-green-500'), { kind: 'bad', tokens: [] } as any)
    ).toThrow();
    expect(r.snapshot(x).tokens).toEqual(['bg-red-500']);
    expect(Object.isFrozen(r.snapshot(x).tokens)).toBe(true);
  });
  it('suppresses equal publications and makes repeated withdrawal harmless', () => {
    const r = new Registry(),
      x = r.declareTarget(),
      owner = r.declareContribution(x, 'rule'),
      sink = vi.fn();
    r.bindAll([{ target: x, sink }]);
    r.replace(owner, tw('p-2'));
    r.replace(owner, tw('p-2'));
    r.flush();
    expect(sink).toHaveBeenCalledTimes(2);
    r.withdraw(owner);
    r.withdraw(owner);
    expect(sink).toHaveBeenCalledTimes(3);
  });
  it('rejects rebinding, late declarations and implicit rescope', () => {
    const r = new Registry(),
      x = r.declareTarget(),
      sink = vi.fn();
    r.bindAll([{ target: x, sink }]);
    expect(() => r.bindAll([{ target: x, sink }])).toThrow('closed');
    expect(() => r.declareTarget()).toThrow('closed');
    expect(() => r.declareContribution(x, 'rule')).toThrow('closed');
    expect(() => new Registry().bindAll([{ target: x, sink }])).toThrow('foreign');
    expect(sink).toHaveBeenCalledOnce();
  });
  it('makes disposal terminal, rejects late callbacks and cannot reuse identities in a new lifetime', () => {
    const r = new Registry(),
      x = r.declareTarget(),
      owner = r.declareContribution(x, 'rule'),
      sink = vi.fn();
    r.bindAll([{ target: x, sink }]);
    r.dispose();
    r.dispose();
    for (const late of [
      () => r.replace(owner, tw('p-2')),
      () => r.withdraw(owner),
      () => r.snapshot(x),
      () => r.flush(),
    ])
      expect(late).toThrow('disposed');
    expect(() => new Registry().snapshot(x)).toThrow('foreign');
    expect(sink).toHaveBeenCalledOnce();
  });
  it('stops the binding flush after a callback disposes its registry', () => {
    const r = new Registry(),
      x = r.declareTarget(),
      y = r.declareTarget(),
      later = vi.fn();
    expect(() =>
      r.bindAll([
        { target: x, sink: () => r.dispose() },
        { target: y, sink: later },
      ])
    ).toThrow('generation retired');
    expect(later).not.toHaveBeenCalled();
  });
  it('retains logical intent for explicit retry after sink failure', () => {
    const r = new Registry(),
      x = r.declareTarget(),
      owner = r.declareContribution(x, 'rule');
    r.replace(owner, tw('p-2'));
    const sink = vi.fn().mockImplementationOnce(() => {
      throw new Error('sink failed');
    });
    expect(() => r.bindAll([{ target: x, sink }])).toThrow('sink failed');
    r.flush();
    expect(sink).toHaveBeenCalledTimes(2);
    expect(r.snapshot(x).tokens).toEqual(['p-2']);
  });
  it('retains a newer successful reentrant publication even after an outer failure', () => {
    const r = new Registry(),
      x = r.declareTarget(),
      owner = r.declareContribution(x, 'rule');
    const writes: string[] = [];
    let nested = false;
    r.bindAll([
      {
        target: x,
        sink: (v) => {
          const value = v.tokens.join(' ');
          writes.push(value);
          if (value === 'p-1' && !nested) {
            nested = true;
            r.replace(owner, tw('p-2'));
            r.replace(owner, tw('p-1'));
            throw new Error('outer failure');
          }
        },
      },
    ]);
    expect(() => r.replace(owner, tw('p-1'))).toThrow('outer failure');
    r.flush();
    expect(writes).toEqual(['', 'p-1', 'p-2', 'p-1']);
    expect(r.snapshot(x).tokens).toEqual(['p-1']);
  });
  it('validates the actual copied bytes and rechecks disposal after input getters', () => {
    const r = new Registry(),
      x = r.declareTarget(),
      owner = r.declareContribution(x, 'rule');
    r.replace(owner, tw('p-2'));
    let reads = 0;
    expect(() =>
      r.replace(owner, {
        kind: 'tw',
        get tokens() {
          return ++reads === 1 ? ['p-4'] : ['bad:variant'];
        },
      })
    ).toThrow();
    expect(r.snapshot(x).tokens).toEqual(['p-2']);
    expect(() =>
      r.replace(owner, {
        kind: 'tw',
        get tokens() {
          r.dispose();
          return ['p-4'];
        },
      })
    ).toThrow('disposed');
  });
  it('snapshots binding identity and sink once and rejects a foreign snapshot', () => {
    const r = new Registry(),
      x = r.declareTarget(),
      sink = vi.fn();
    let reads = 0,
      sinkReads = 0;
    r.bindAll([
      {
        get target() {
          return ++reads === 1 ? x : {};
        },
        get sink() {
          sinkReads++;
          return sink;
        },
      },
    ]);
    expect(reads).toBe(1);
    expect(sinkReads).toBe(1);
    expect(sink).toHaveBeenCalledOnce();
    const other = new Registry(),
      y = other.declareTarget();
    let foreignReads = 0;
    expect(() =>
      other.bindAll([
        {
          get target() {
            return ++foreignReads === 1 ? x : y;
          },
          sink,
        },
      ])
    ).toThrow('foreign');
    expect(foreignReads).toBe(1);
    expect(sink).toHaveBeenCalledOnce();
  });
  it('rejects disposal during a binding getter before any callback', () => {
    const r = new Registry(),
      x = r.declareTarget(),
      sink = vi.fn();
    expect(() =>
      r.bindAll([
        {
          target: x,
          get sink() {
            r.dispose();
            return sink;
          },
        },
      ])
    ).toThrow('disposed');
    expect(sink).not.toHaveBeenCalled();
  });
  it('rejects recursive binding from an input getter before callbacks', () => {
    const r = new Registry(),
      x = r.declareTarget(),
      sink = vi.fn();
    expect(() =>
      r.bindAll([
        {
          target: x,
          get sink() {
            r.bindAll([{ target: x, sink }]);
            return sink;
          },
        },
      ])
    ).toThrow('reentrant');
    expect(sink).not.toHaveBeenCalled();
    r.bindAll([{ target: x, sink }]);
    expect(sink).toHaveBeenCalledOnce();
  });
});

describe('draft owner-lived targets with replaceable view leases', () => {
  it('retains identities and latest intent across physical suspension', () => {
    const r = new Registry();
    const t = r.declareTarget();
    const c = r.declareContribution(t, 'setup');
    const old = vi.fn(),
      next = vi.fn();
    r.replace(c, tw('bg-black'));
    r.bindAll([{ target: t, sink: old }]);
    r.suspendBindings();
    r.replace(c, tw('bg-white'));
    expect(old).toHaveBeenCalledTimes(1);
    expect(() => r.declareTarget()).toThrow('closed');
    expect(() => r.declareContribution(t, 'rule')).toThrow('closed');
    r.bindAll([{ target: t, sink: next }]);
    expect(next).toHaveBeenLastCalledWith({ kind: 'tw', tokens: ['bg-white'] });
    r.withdraw(c);
    expect(next).toHaveBeenLastCalledWith({ kind: 'tw', tokens: [] });
    expect(old).toHaveBeenCalledTimes(1);
  });
  it('still validates the entire replacement binding set', () => {
    const r = new Registry();
    const a = r.declareTarget(),
      b = r.declareTarget();
    const old = vi.fn(),
      next = vi.fn();
    r.bindAll([
      { target: a, sink: old },
      { target: b, sink: old },
    ]);
    r.suspendBindings();
    expect(() => r.bindAll([{ target: a, sink: next }])).toThrow('unbound');
    expect(next).not.toHaveBeenCalled();
    expect(() =>
      r.bindAll([
        { target: a, sink: next },
        { target: {}, sink: next },
      ])
    ).toThrow('foreign');
    r.bindAll([
      { target: a, sink: next },
      { target: b, sink: next },
    ]);
    expect(next).toHaveBeenCalledTimes(2);
  });
  it('rejects a getter that retires the candidate binding generation', () => {
    const r = new Registry();
    const t = r.declareTarget();
    r.bindAll([{ target: t, sink: vi.fn() }]);
    r.suspendBindings();
    const next = vi.fn();
    expect(() =>
      r.bindAll([
        {
          target: t,
          get sink() {
            r.suspendBindings();
            return next;
          },
        },
      ])
    ).toThrow('generation');
    expect(next).not.toHaveBeenCalled();
  });
  it('stops old flush after a sink synchronously detaches the view', () => {
    const r = new Registry();
    const a = r.declareTarget(),
      b = r.declareTarget();
    const other = vi.fn();
    expect(() =>
      r.bindAll([
        { target: a, sink: () => r.suspendBindings() },
        { target: b, sink: other },
      ])
    ).toThrow('generation retired');
    expect(other).not.toHaveBeenCalled();
  });
  it('never resurrects an owner after terminal disposal', () => {
    const r = new Registry();
    const t = r.declareTarget();
    r.bindAll([{ target: t, sink: vi.fn() }]);
    r.suspendBindings();
    r.dispose();
    expect(() => r.bindAll([{ target: t, sink: vi.fn() }])).toThrow('disposed');
    expect(() => r.suspendBindings()).toThrow('disposed');
  });
});

it('never resumes an older flush into a reentrant newer generation', () => {
  const r = new Registry(),
    a = r.declareTarget(),
    b = r.declareTarget();
  const nextA = vi.fn(),
    nextB = vi.fn(() => {
      throw new Error('new sink failure');
    });
  expect(() =>
    r.bindAll([
      {
        target: a,
        sink: () => {
          r.suspendBindings();
          try {
            r.bindAll([
              { target: a, sink: nextA },
              { target: b, sink: nextB },
            ]);
          } catch {}
        },
      },
      { target: b, sink: vi.fn() },
    ])
  ).toThrow('generation retired');
  expect(nextA).toHaveBeenCalledOnce();
  expect(nextB).toHaveBeenCalledOnce();
});

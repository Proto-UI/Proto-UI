import { describe, expect, it } from 'vitest';
import {
  snapshotPresencePresentation,
  snapshotPresentationOwnerFrame,
  snapshotPresentationCompletionConfig,
} from '../src/presence-presentation';
const vector = () => [
  { px: 0, rootText: 0, ownBox: 0 },
  { px: 0, rootText: 0, ownBox: 1 },
];
const valid = () => ({
  owner: {},
  closed: { translate: vector(), opacity: 0 },
  entered: { translate: vector(), opacity: 1 },
  easing: [0.32, 0.72, 0, 1],
});
describe('presence presentation declaration snapshots', () => {
  it('deeply snapshots typed data but preserves symbolic owner identity', () => {
    const input = valid();
    const result = snapshotPresencePresentation(input as any);
    input.closed.translate[0].px = 99;
    expect(result.owner).toBe(input.owner);
    expect((result.closed.translate as any)[0].px).toBe(0);
    expect(Object.isFrozen((result.closed.translate as any)[0])).toBe(true);
  });
  it.each([NaN, Infinity, -Infinity])('rejects non-finite affine values %s', (n) => {
    const input = valid();
    input.closed.translate[0].px = n;
    expect(() => snapshotPresencePresentation(input as any)).toThrow('Invalid');
  });
  it.each([{ scale: 1 }, {}, { opacity: 2 }, { translate: new Array(2) }])(
    'rejects unsupported, empty, out-of-range and sparse endpoints',
    (closed) => {
      expect(() => snapshotPresencePresentation({ ...valid(), closed } as any)).toThrow('Invalid');
    }
  );
  it('rejects mismatched endpoint channels and unexpected duration', () => {
    expect(() =>
      snapshotPresencePresentation({ ...valid(), entered: { opacity: 1 } } as any)
    ).toThrow('Invalid');
    expect(() => snapshotPresencePresentation({ ...valid(), durationMs: 500 } as any)).toThrow(
      'Invalid'
    );
  });
  it('rejects accessors without executing them', () => {
    let calls = 0;
    const input = valid();
    Object.defineProperty(input.closed.translate[0], 'px', {
      get() {
        calls++;
        return 0;
      },
    });
    expect(() => snapshotPresencePresentation(input as any)).toThrow('Invalid');
    expect(calls).toBe(0);
  });
  it('retains selection reference without evaluating and freezes cases', () => {
    const source = {
      get() {
        throw Error('not evaluated');
      },
      watch() {
        throw Error('not evaluated');
      },
    };
    const result = snapshotPresencePresentation({
      ...valid(),
      closed: { translate: { source, cases: { bottom: vector() } }, opacity: 0 },
    } as any);
    expect((result.closed.translate as any).source).toBe(source);
    expect(Object.isFrozen((result.closed.translate as any).cases.bottom)).toBe(true);
  });
  it('rejects empty cases, accessor cases and sparse easing', () => {
    const source = { get: () => 'bottom', watch: () => () => {} };
    const cases = Object.defineProperty({}, 'bottom', {
      get() {
        throw Error('evaluated');
      },
    });
    for (const value of [{}, cases])
      expect(() =>
        snapshotPresencePresentation({
          ...valid(),
          closed: { translate: { source, cases: value }, opacity: 0 },
        } as any)
      ).toThrow('Invalid');
    expect(() => snapshotPresencePresentation({ ...valid(), easing: new Array(4) } as any)).toThrow(
      'Invalid'
    );
  });
  it.each([0, -1, NaN, Infinity])('rejects invalid independent timeout %s', (timeoutMs) => {
    expect(() => snapshotPresentationCompletionConfig({ kind: 'presentation', timeoutMs })).toThrow(
      'Invalid'
    );
  });
  it('snapshots owner facts and rejects non-finite duration or forged field shapes', () => {
    const frame = {
      owner: {},
      revision: 1,
      phase: 'entering',
      attempt: { ownerEpoch: 1, phaseAttempt: 1 },
      completion: 'presentation',
      durationMs: 500,
      timeoutMs: 1000,
    };
    const result = snapshotPresentationOwnerFrame(frame as any);
    expect(Object.isFrozen(result.attempt)).toBe(true);
    for (const patch of [
      { durationMs: Infinity },
      { revision: -1 },
      { phase: 'unknown' },
      { attempt: null },
      { timeoutMs: 0 },
    ])
      expect(() => snapshotPresentationOwnerFrame({ ...frame, ...patch } as any)).toThrow(
        'Invalid'
      );
  });
});

describe('presence source boundary negative cases', () => {
  it.each([
    { easing: [2, 0, 1, 1] },
    { easing: [0, 0, -1, 1] },
    { easing: [0, Infinity, 1, 1] },
    { owner: null },
    {
      closed: {
        translate: [
          { px: 0, rootText: 0 },
          { px: 0, rootText: 0, ownBox: 0 },
        ],
        opacity: 0,
      },
    },
    {
      closed: {
        translate: [
          { px: 0, rootText: 0, ownBox: 0, rem: 1 },
          { px: 0, rootText: 0, ownBox: 0 },
        ],
        opacity: 0,
      },
    },
    { closed: { opacity: -0.1 } },
  ])('rejects unsupported declaration shape %#', (patch) => {
    expect(() => snapshotPresencePresentation({ ...valid(), ...patch } as any)).toThrow('Invalid');
  });
  it('rejects inherited fields and symbol keys', () => {
    expect(() => snapshotPresencePresentation(Object.create(valid()))).toThrow('Invalid');
    expect(() => snapshotPresencePresentation({ ...valid(), [Symbol()]: 1 } as any)).toThrow(
      'Invalid'
    );
  });
  it('rejects named array properties and array index accessors', () => {
    const easing = [0, 0, 1, 1];
    Object.assign(easing, { extra: 1 });
    expect(() => snapshotPresencePresentation({ ...valid(), easing } as any)).toThrow('Invalid');
    const input = valid();
    let reads = 0;
    Object.defineProperty(input.closed.translate, '0', {
      get() {
        reads++;
        return {};
      },
    });
    expect(() => snapshotPresencePresentation(input as any)).toThrow('Invalid');
    expect(reads).toBe(0);
  });
  it('rejects top-level getters and completion-policy getters', () => {
    let reads = 0;
    const input = valid();
    Object.defineProperty(input, 'closed', {
      get() {
        reads++;
        return {};
      },
    });
    expect(() => snapshotPresencePresentation(input as any)).toThrow('Invalid');
    const policy = {
      kind: 'presentation',
      get timeoutMs() {
        reads++;
        return 1000;
      },
    };
    expect(() => snapshotPresentationCompletionConfig(policy as any)).toThrow('Invalid');
    expect(reads).toBe(0);
  });
  it('copies a __proto__ case as data without prototype mutation', () => {
    const source = { get: () => '__proto__', watch: () => () => {} };
    const cases = Object.create(null);
    cases.__proto__ = vector();
    const result = snapshotPresencePresentation({
      ...valid(),
      closed: { translate: { source, cases }, opacity: 0 },
    } as any);
    const selected = result.closed.translate as any;
    expect(Object.getPrototypeOf(selected.cases)).toBe(null);
    expect(selected.cases.__proto__).toHaveLength(2);
  });
  it('retains invalid runtime policy as a diagnosable current frame', () => {
    const frame = {
      owner: {},
      revision: 1,
      phase: 'entering',
      attempt: { ownerEpoch: 1, phaseAttempt: 1 },
      completion: 'presentation',
      durationMs: 1000,
      timeoutMs: 1000,
    };
    expect(snapshotPresentationOwnerFrame(frame as any).durationMs).toBe(1000);
    expect(snapshotPresentationCompletionConfig('timer')).toBe('timer');
    expect(
      Object.isFrozen(
        snapshotPresentationCompletionConfig({ kind: 'presentation', timeoutMs: 1000 })
      )
    ).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { snapshotMaterialCandidate, snapshotMaterialSlot } from '../src/material';
import vectors from './fixtures/material-intent-vectors.json';

const slot = () => ({
  version: 2,
  shape: { kind: 'rounded-rect', geometry: 'style' },
  source: { kind: 'owned-scene', slot: 'scene' },
  fallback: { fill: 'style', foreground: 'style' },
});

describe('shared finite material intent vectors', () => {
  it.each(vectors.valid)('accepts a portable whole intent %j', (value) => {
    const snapshot = snapshotMaterialCandidate(value);
    expect(snapshot).toEqual(value);
    expect(Object.isFrozen(snapshot)).toBe(true);
  });
  it.each(vectors.invalid.map((value) => [value]))('rejects a foreign payload %j', (value) => {
    expect(() => snapshotMaterialCandidate(value)).toThrow();
  });
  it('does not execute getters, inherit fields, admit symbols or accept explicit undefined', () => {
    let reads = 0;
    expect(() =>
      snapshotMaterialCandidate({
        get intent() {
          reads++;
          return 'liquid-glass';
        },
      })
    ).toThrow();
    expect(reads).toBe(0);
    for (const value of [
      Object.create({ intent: 'liquid-glass' }),
      { intent: 'liquid-glass', [Symbol('payload')]: true },
      { intent: 'liquid-glass', variant: undefined },
      { intent: 'liquid-glass', deformation: { kind: 'press', phase: NaN } },
      { intent: 'liquid-glass', deformation: { kind: 'press', phase: Infinity } },
    ])
      expect(() => snapshotMaterialCandidate(value)).toThrow();
  });
  it('copies and freezes nested deformation, rather than retaining mutable author input', () => {
    const original = { intent: 'liquid-glass', deformation: { kind: 'press', phase: 'pressed' } };
    const result = snapshotMaterialCandidate(original);
    original.deformation.phase = 'rest';
    expect(result).toEqual({
      intent: 'liquid-glass',
      deformation: { kind: 'press', phase: 'pressed' },
    });
    expect(result.intent === 'liquid-glass' && Object.isFrozen(result.deformation)).toBe(true);
  });
  it('accepts all logical source scopes without creating a resource or permission', () => {
    for (const source of [
      { kind: 'owned-scene', slot: 'scene' },
      { kind: 'in-app-backdrop' },
      { kind: 'behind-window' },
    ]) {
      const data = { ...slot(), source };
      expect(snapshotMaterialSlot(data)).toEqual(data);
    }
  });
  it('rejects nonlogical sources, ambiguous fallback ownership and private profile fields', () => {
    for (const data of [
      { ...slot(), source: { kind: 'owned-scene', slot: 'https://example.invalid/x' } },
      { ...slot(), source: { kind: 'owned-scene', slot: 'x'.repeat(65) } },
      { ...slot(), source: { kind: 'behind-window', slot: 'scene' } },
      { ...slot(), source: { kind: 'owned-scene', slot: 'scene', texture: {} } },
      { ...slot(), shape: { kind: 'path', geometry: 'style' } },
      { ...slot(), fallback: { fill: [0, 0, 0, 0.5], foreground: 'style' } },
      { ...slot(), fallback: { fill: 'computed-css', foreground: 'style' } },
      { ...slot(), interaction: { kind: 'button-press' } },
      { ...slot(), version: 1 },
    ])
      expect(() => snapshotMaterialSlot(data)).toThrow();
  });
});

it('admits only a finite pointer contact request, never author coordinates or programs', () => {
  expect(
    snapshotMaterialCandidate({
      intent: 'liquid-glass',
      deformation: { kind: 'press', phase: 'rest', contact: 'pointer' },
    })
  ).toEqual({
    intent: 'liquid-glass',
    deformation: { kind: 'press', phase: 'rest', contact: 'pointer' },
  });
  for (const contact of [null, 'mouse', { x: 0.5, y: 0.5 }, Infinity])
    expect(() =>
      snapshotMaterialCandidate({
        intent: 'liquid-glass',
        deformation: { kind: 'press', phase: 'rest', contact },
      })
    ).toThrow();
});

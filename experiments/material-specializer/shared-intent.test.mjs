import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { lowerMaterialIntentIR } from './shared-intent.mjs';

const vectors = JSON.parse(
  readFileSync(
    new URL('../../packages/core/test/fixtures/material-intent-vectors.json', import.meta.url)
  )
);
const slot = {
  version: 2,
  shape: { kind: 'rounded-rect', geometry: 'style' },
  source: { kind: 'in-app-backdrop' },
  fallback: { fill: 'style', foreground: 'style' },
};

for (const [index, candidate] of vectors.valid.entries()) {
  test(`shared compiler IR retains accepted whole intent ${index}`, () => {
    const ir = lowerMaterialIntentIR(slot, [candidate]);
    assert.deepEqual(ir.candidates, [candidate]);
    assert.deepEqual(ir.slot, slot);
    assert.equal(Object.isFrozen(ir), true);
    assert.equal(Object.isFrozen(ir.candidates), true);
  });
}
for (const [index, candidate] of vectors.invalid.entries()) {
  test(`shared compiler IR rejects the same foreign payload ${index}`, () => {
    assert.throws(() => lowerMaterialIntentIR(slot, [candidate]));
  });
}
test('zero candidates retain a slot; removal is an explicit tombstone', () => {
  assert.deepEqual(lowerMaterialIntentIR(slot, []).slot, slot);
  assert.equal(lowerMaterialIntentIR(null, []).slot, null);
  assert.throws(() => lowerMaterialIntentIR(null, [{ intent: 'liquid-glass' }]));
});
test('compiler preserves conflicting candidates for policy instead of choosing a winner', () => {
  const candidates = [{ intent: 'liquid-glass' }, { intent: 'adaptive-blur' }];
  assert.deepEqual(lowerMaterialIntentIR(slot, candidates).candidates, candidates);
  assert.deepEqual(
    lowerMaterialIntentIR(slot, [...candidates].reverse()).candidates,
    [...candidates].reverse()
  );
});
test('sparse candidates and material source resources never become portable IR', () => {
  assert.throws(() => lowerMaterialIntentIR(slot, new Array(1)));
  assert.throws(() =>
    lowerMaterialIntentIR({ ...slot, source: { kind: 'in-app-backdrop', texture: {} } }, [])
  );
});

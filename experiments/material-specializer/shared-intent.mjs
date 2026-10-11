// Shared front-end IR lowering only. This does not select or generate a GPU/
// native backend, and does not reinterpret the private v1 button declaration.
import {
  snapshotMaterialCandidate,
  snapshotMaterialSlot,
} from '../../packages/core/src/material.ts';

export function lowerMaterialIntentIR(slot, candidates) {
  if (!Array.isArray(candidates)) throw new Error('Material candidates must be a dense array');
  const copy = [];
  for (let i = 0; i < candidates.length; i++) {
    if (!Object.hasOwn(candidates, i)) throw new Error('Sparse material candidates');
    copy.push(snapshotMaterialCandidate(candidates[i]));
  }
  if (slot === null && copy.length !== 0)
    throw new Error('A material tombstone cannot retain active candidates');
  return Object.freeze({
    kind: 'material.intent.v2',
    slot: slot === null ? null : snapshotMaterialSlot(slot),
    candidates: Object.freeze(copy),
  });
}

import assert from 'node:assert/strict';
import test from 'node:test';
import { selectRunnableMission } from '../mission-selection.mjs';

const now = Date.parse('2030-01-01T00:00:00.000Z');

function mission({ id, status = 'ready', band = 'C1', owner = 'subject', offset = 60_000 }) {
  return {
    id,
    status,
    requiredBand: band,
    taskClass: 'observe',
    priority: 1,
    lease: {
      owner,
      acquiredAt: new Date(now - 60_000).toISOString(),
      expiresAt: new Date(now + offset).toISOString(),
    },
  };
}

test('selector excludes candidate, blocked, expired, foreign, and above-band missions', () => {
  const queue = {
    missions: [
      mission({ id: 'candidate', status: 'candidate' }),
      mission({ id: 'blocked', status: 'blocked' }),
      mission({ id: 'expired', offset: -1 }),
      mission({ id: 'foreign', owner: 'other' }),
      mission({ id: 'above-band', band: 'C3' }),
    ],
  };
  assert.equal(selectRunnableMission(queue, { band: 'C1', subject: 'subject', now }), null);
});

test('selector returns only the current subject lease within capability', () => {
  const queue = {
    missions: [
      { ...mission({ id: 'later' }), priority: 2 },
      { ...mission({ id: 'first' }), priority: 1 },
    ],
  };
  assert.equal(selectRunnableMission(queue, { band: 'C2', subject: 'subject', now })?.id, 'first');
});

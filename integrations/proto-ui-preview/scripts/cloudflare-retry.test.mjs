import assert from 'node:assert/strict';
import test from 'node:test';

import { boundedRetryDelay, parseRetryAfter } from './cloudflare-retry.mjs';

test('Retry-After parses seconds and HTTP dates', () => {
  const now = Date.parse('2026-08-24T12:00:00Z');
  assert.equal(parseRetryAfter('1.5', now), 1500);
  assert.equal(parseRetryAfter('Sun, 24 Aug 2026 12:00:03 GMT', now), 3000);
});

test('Retry-After malformed and past values fall back to exponential delay', () => {
  const now = Date.parse('2026-08-24T12:00:00Z');
  assert.equal(parseRetryAfter('not-a-date', now), 0);
  assert.equal(parseRetryAfter('Sun, 24 Aug 2026 11:59:00 GMT', now), 0);
  assert.equal(boundedRetryDelay(2, 0, now + 60_000, now), 1000);
});

test('excessive Retry-After is clamped to the remaining request deadline', () => {
  const now = Date.parse('2026-08-24T12:00:00Z');
  const requested = parseRetryAfter('999999', now);
  assert.equal(requested, 999_999_000);
  assert.equal(boundedRetryDelay(1, requested, now + 20_000, now), 20_000);
  assert.equal(boundedRetryDelay(1, requested, now - 1, now), 0);
});

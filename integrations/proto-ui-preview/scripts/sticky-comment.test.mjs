import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { GITHUB_ACTIONS_BOT_ID, ownedMarkerComments } from './sticky-comment-lib.mjs';

const stickySource = await readFile(new URL('./sticky-comment.mjs', import.meta.url), 'utf8');
const readmeSource = await readFile(new URL('../README.md', import.meta.url), 'utf8');

test('deduplicates only marker comments owned by the authenticated workflow identity', () => {
  const marker = '<!-- poppy-preview:poppy-proto-ui-pr-42 -->';
  const comments = [
    { id: 1, user: { id: 7, type: 'User' }, body: marker },
    { id: 2, user: { id: 7, type: 'User' }, body: `before\n${marker}` },
    { id: 3, user: { id: 8, type: 'Bot' }, body: marker },
    { id: 4, user: { id: 7, type: 'User' }, body: 'ordinary comment' },
  ];
  assert.deepEqual(
    ownedMarkerComments(comments, marker, 7).map(({ id }) => id),
    [1, 2]
  );
});

test('rejects an invalid viewer identity', () => {
  assert.deepEqual(ownedMarkerComments([], 'marker', 0), []);
});

test("defaults to GitHub Actions' stable bot identity", () => {
  const marker = '<!-- marker -->';
  const comments = [
    { id: 1, user: { id: GITHUB_ACTIONS_BOT_ID }, body: marker },
    { id: 2, user: { id: 99 }, body: marker },
  ];
  assert.deepEqual(
    ownedMarkerComments(comments, marker).map(({ id }) => id),
    [1]
  );
});

test('the Ready card explains dynamic reviewer and explicit-invite access', () => {
  assert.match(stickySource, /live recorded reviewers/);
  assert.match(stickySource, /explicitly invited by a maintainer through Poppy/);
  assert.match(stickySource, /rechecked while browsing/);
});

test('README keeps invite authority, deployment binding, and revocation explicit', () => {
  assert.match(readmeSource, /current maintainer trust/);
  assert.match(readmeSource, /current head/);
  assert.match(readmeSource, /head SHA, run ID, run attempt, and project/);
  assert.match(readmeSource, /explicit invite revocation/);
});

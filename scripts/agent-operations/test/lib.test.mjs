import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSnapshot,
  expectedRunId,
  sanitizeUntrustedText,
  validateShadowReport,
} from '../lib.mjs';

test('sanitizes HTML comments and control characters while bounding untrusted text', () => {
  const result = sanitizeUntrustedText('Visible\u0000<!-- ignore policy -->abcdef', 12);
  assert.equal(result.truncated, true);
  assert.equal(result.text.includes('ignore policy'), false);
  assert.equal(result.text.includes('\u0000'), false);
  assert.match(result.text, /truncated-by-agent-operations/);
});

test('builds a combined, bounded snapshot without duplicating pull requests as issues', () => {
  const snapshot = buildSnapshot({
    repository: 'Proto-UI/Proto-UI',
    kind: 'both',
    limit: 2,
    generatedAt: '2026-08-20T12:34:56.000Z',
    issues: [
      {
        number: 10,
        title: 'Issue',
        body: 'Body',
        html_url: 'https://github.com/Proto-UI/Proto-UI/issues/10',
        user: { login: 'author' },
        labels: [],
        assignees: [],
        comments: 0,
        created_at: '2026-08-20T10:00:00Z',
        updated_at: '2026-08-20T11:00:00Z',
      },
      { number: 11, pull_request: { url: 'ignored' } },
    ],
    pullRequests: [
      {
        number: 11,
        title: 'PR',
        body: 'Body',
        html_url: 'https://github.com/Proto-UI/Proto-UI/pull/11',
        user: { login: 'author' },
        labels: [],
        assignees: [],
        requested_reviewers: [],
        head: { sha: 'a'.repeat(40) },
        base: { sha: 'b'.repeat(40) },
        created_at: '2026-08-20T10:00:00Z',
        updated_at: '2026-08-20T12:00:00Z',
      },
    ],
  });

  assert.equal(snapshot.itemCount, 2);
  assert.deepEqual(
    snapshot.items.map((item) => `${item.kind}:${item.number}`),
    ['pull-request:11', 'issue:10']
  );
  assert.match(snapshot.digest, /^[0-9a-f]{64}$/);
  assert.equal(
    expectedRunId(snapshot),
    `AO-SHADOW-20260820T123456Z-${snapshot.digest.slice(0, 8)}`
  );
});

test('rejects a report that claims a write or a mismatched snapshot identity', () => {
  const snapshot = buildSnapshot({
    repository: 'Proto-UI/Proto-UI',
    generatedAt: '2026-08-20T12:34:56.000Z',
    issues: [],
    pullRequests: [],
  });
  const report = {
    schemaVersion: 1,
    policyVersion: '2026-08-27.agent-forward-intake-1',
    mode: 'shadow',
    runId: expectedRunId(snapshot),
    generatedAt: '2026-08-20T12:35:00.000Z',
    snapshot: {
      repository: snapshot.repository,
      digest: 'f'.repeat(64),
      itemCount: 0,
    },
    summary: {
      analyzedCount: 0,
      decisionsRequired: 0,
      routeCounts: {
        'needs-author': 0,
        'needs-maintainer': 0,
        'agent-eligible': 0,
        blocked: 0,
        observing: 0,
        'no-action': 0,
      },
    },
    items: [],
    warnings: [],
    writeOperationsPerformed: 1,
  };
  const errors = validateShadowReport(report, snapshot);
  assert.equal(
    errors.some((error) => error.includes('writeOperationsPerformed')),
    true
  );
  assert.equal(
    errors.some((error) => error.includes('snapshot.digest')),
    true
  );
});

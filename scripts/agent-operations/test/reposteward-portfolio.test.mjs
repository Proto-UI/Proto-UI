import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ENGINE_COMMIT,
  buildEnvelope,
  renderStepSummary,
  validateRepoStewardPortfolio,
} from '../reposteward-portfolio.mjs';

function fixture() {
  return {
    snapshot_digest: 'a'.repeat(64),
    expected_digest: '',
    matches_expected_digest: null,
    snapshot: {
      schema_version: 1,
      repository: 'proto-ui/proto-ui',
      complete: false,
      pull_requests: [
        {
          number: 10,
          title: 'First',
          url: 'https://github.com/Proto-UI/Proto-UI/pull/10',
          draft: false,
          head_sha: 'b'.repeat(40),
          base_sha: 'c'.repeat(40),
          facts_complete: true,
          files: ['packages/core/a.ts'],
          checks: [],
        },
        {
          number: 11,
          title: 'Second',
          url: 'https://github.com/Proto-UI/Proto-UI/pull/11',
          draft: true,
          head_sha: 'd'.repeat(40),
          base_sha: 'e'.repeat(40),
          facts_complete: false,
          files: ['packages/core/a.ts'],
          checks: [],
        },
      ],
      overlaps: [
        {
          left: 10,
          right: 11,
          file_count: 1,
          files: ['packages/core/a.ts'],
        },
      ],
      errors: [{ pull_number: 11, message: 'pull request changed state during snapshot' }],
      stats: {
        pull_requests: 2,
        draft_pull_requests: 1,
        overlapping_pairs: 1,
        files_in_overlaps: 1,
        incomplete_pull_requests: 1,
      },
    },
  };
}

test('accepts an explicitly incomplete snapshot and preserves its observable limits', () => {
  const raw = fixture();
  assert.equal(validateRepoStewardPortfolio(raw), raw);
  const envelope = buildEnvelope(raw, {
    engineCommit: ENGINE_COMMIT,
    runId: '1234',
    runAttempt: 2,
    generatedAt: '2026-08-22T10:00:00Z',
  });
  assert.deepEqual(envelope.snapshot, {
    digest: 'a'.repeat(64),
    expectedDigest: null,
    matchesExpectedDigest: null,
    complete: false,
    pullRequestCount: 2,
    draftPullRequestCount: 1,
    overlappingPairCount: 1,
    overlappingFileCount: 1,
    incompletePullRequestCount: 1,
    errorCount: 1,
  });
  assert.equal(envelope.writeOperationsPerformed, 0);
  assert.match(renderStepSummary(envelope), /incomplete \(see raw artifact errors\)/);
});

test('preserves and checks an expected snapshot digest without treating mismatch as a write', () => {
  const raw = fixture();
  raw.expected_digest = 'f'.repeat(64);
  raw.matches_expected_digest = false;
  const envelope = buildEnvelope(raw, {
    engineCommit: ENGINE_COMMIT,
    runId: '1234',
    runAttempt: 1,
    generatedAt: '2026-08-22T10:00:00Z',
  });
  assert.equal(envelope.snapshot.expectedDigest, 'f'.repeat(64));
  assert.equal(envelope.snapshot.matchesExpectedDigest, false);
  assert.match(renderStepSummary(envelope), /Expected digest match: no/);
  raw.matches_expected_digest = true;
  assert.throws(() => validateRepoStewardPortfolio(raw), /does not match the supplied digest/);
});

test('rejects a complete claim when an incomplete pull request remains', () => {
  const raw = fixture();
  raw.snapshot.complete = true;
  assert.throws(() => validateRepoStewardPortfolio(raw), /complete snapshot/);
});

test('rejects an engine commit that differs from the registered supply-chain pin', () => {
  assert.throws(
    () =>
      buildEnvelope(fixture(), {
        engineCommit: 'f'.repeat(40),
        runId: '1234',
        runAttempt: 1,
        generatedAt: '2026-08-22T10:00:00Z',
      }),
    /engineCommit/
  );
});

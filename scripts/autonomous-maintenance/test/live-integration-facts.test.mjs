import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyLiveIntegrationFacts } from '../live-integration-facts.mjs';

function fixture() {
  const baseline = 'a'.repeat(40);
  const parent = 'b'.repeat(40);
  const head = 'c'.repeat(40);
  const merge = 'd'.repeat(40);
  const main = 'e'.repeat(40);
  const receipt = {
    repositoryId: 'github.com:Proto-UI/Proto-UI',
    pullRequest: 509,
    headSha: head,
    liveHeadSha: head,
    mergeCommitSha: merge,
    mergeMethod: 'squash',
    mergedAt: '2026-10-01T12:00:00Z',
  };
  const responses = {
    'pulls/509': {
      number: 509,
      state: 'closed',
      merged: true,
      base: { ref: 'main', repo: { full_name: 'Proto-UI/Proto-UI' } },
      head: { sha: head },
      merge_commit_sha: merge,
      merged_at: receipt.mergedAt,
    },
    [`git/commits/${merge}`]: { sha: merge, parents: [{ sha: parent }] },
    'git/ref/heads/main': { ref: 'refs/heads/main', object: { type: 'commit', sha: main } },
    [`compare/${baseline}...${parent}?per_page=1`]: {
      status: 'ahead',
      base_commit: { sha: baseline },
      merge_base_commit: { sha: baseline },
    },
    [`compare/${merge}...${main}?per_page=1`]: {
      status: 'ahead',
      base_commit: { sha: merge },
      merge_base_commit: { sha: merge },
    },
  };
  const calls = [];
  const runner = (command, args) => {
    calls.push([command, args]);
    assert.equal(command, 'gh');
    assert.equal(args[0], 'api');
    assert.equal(args.length, 2, 'only read-only endpoint calls are admitted');
    assert.ok(args[1].startsWith('repos/Proto-UI/Proto-UI/'));
    const key = args[1].slice('repos/Proto-UI/Proto-UI/'.length);
    assert.ok(Object.hasOwn(responses, key), `unexpected fixture endpoint: ${key}`);
    return JSON.stringify(responses[key]);
  };
  return { baseline, parent, head, merge, main, receipt, responses, calls, runner };
}

test('live integration facts bind actual merge and main ancestry without claiming method or producer proof', () => {
  const f = fixture();
  const facts = verifyLiveIntegrationFacts(f.receipt, f.baseline, { runner: f.runner });
  assert.equal(facts.actualMergeVerified, true);
  assert.equal(facts.mergeCommitSha, f.merge);
  assert.equal(facts.headSha, f.head);
  assert.equal(facts.mergedAt, f.receipt.mergedAt);
  assert.equal(facts.baseHeadSha, f.main);
  assert.equal(facts.parentSha, f.parent);
  assert.equal(facts.historicalMergeMethodVerified, false);
  assert.equal(facts.receiptProducerVerified, false);
  assert.equal(f.calls.length, 5);
});

const cases = [
  [
    'unmerged PR',
    (f) => {
      f.responses['pulls/509'].merged = false;
    },
  ],
  [
    'wrong PR',
    (f) => {
      f.responses['pulls/509'].number = 510;
    },
  ],
  [
    'wrong repository',
    (f) => {
      f.responses['pulls/509'].base.repo.full_name = 'outsider/Proto-UI';
    },
  ],
  [
    'wrong base branch',
    (f) => {
      f.responses['pulls/509'].base.ref = 'release';
    },
  ],
  [
    'wrong merged head',
    (f) => {
      f.responses['pulls/509'].head.sha = f.parent;
    },
  ],
  [
    'wrong merge commit',
    (f) => {
      f.responses['pulls/509'].merge_commit_sha = f.parent;
    },
  ],
  [
    'wrong merge time',
    (f) => {
      f.responses['pulls/509'].merged_at = '2026-10-01T12:00:01Z';
    },
  ],
  [
    'invalid merge time',
    (f) => {
      f.responses['pulls/509'].merged_at = f.receipt.mergedAt = '2026-02-31T12:00:00Z';
    },
  ],
  [
    'ordinary merge commit',
    (f) => {
      f.responses[`git/commits/${f.merge}`].parents.push({ sha: f.head });
    },
  ],
  [
    'missing parent',
    (f) => {
      f.responses[`git/commits/${f.merge}`].parents = [];
    },
  ],
  [
    'wrong commit object',
    (f) => {
      f.responses[`git/commits/${f.merge}`].sha = f.parent;
    },
  ],
  [
    'wrong live ref',
    (f) => {
      f.responses['git/ref/heads/main'].ref = 'refs/heads/other';
    },
  ],
  [
    'unrelated baseline',
    (f) => {
      f.responses[`compare/${f.baseline}...${f.parent}?per_page=1`].status = 'diverged';
    },
  ],
  [
    'unmerged side branch',
    (f) => {
      f.responses[`compare/${f.merge}...${f.main}?per_page=1`].status = 'diverged';
    },
  ],
  [
    'wrong compare ancestry',
    (f) => {
      f.responses[`compare/${f.merge}...${f.main}?per_page=1`].merge_base_commit.sha = f.parent;
    },
  ],
  [
    'malformed live response',
    (f) => {
      f.responses['pulls/509'] = [];
    },
  ],
];
for (const [name, change] of cases) {
  test(`live integration proof rejects ${name}`, () => {
    const f = fixture();
    change(f);
    assert.throws(() => verifyLiveIntegrationFacts(f.receipt, f.baseline, { runner: f.runner }));
  });
}

test('missing or denied live proof never falls back to caller receipt scalars', () => {
  const f = fixture();
  for (const reason of [
    'HTTP 403',
    'HTTP 404',
    'authentication unavailable',
    'network unavailable',
  ]) {
    assert.throws(
      () =>
        verifyLiveIntegrationFacts(f.receipt, f.baseline, {
          runner() {
            throw new Error(reason);
          },
        }),
      new RegExp(reason)
    );
  }
});

test('single-parent rebase and squash shapes cannot establish historical method', () => {
  const f = fixture();
  // A replay of a rebase result can expose exactly these same read-side facts.
  // The copied method scalar is deliberately not accepted as historical proof.
  assert.equal(
    verifyLiveIntegrationFacts(f.receipt, f.baseline, { runner: f.runner })
      .historicalMergeMethodVerified,
    false
  );
});

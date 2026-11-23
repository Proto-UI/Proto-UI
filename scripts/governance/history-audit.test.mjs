import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAudit,
  assertReady,
  checkboxSources,
  digest,
  selectIdleObjects,
  pullRequestDisposition,
} from './history-audit.mjs';

function fixture() {
  const issue = {
    id: 101,
    number: 1,
    title: 'Preserve original condition',
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-20T00:00:00Z',
    state: 'open',
    state_reason: null,
    closed_at: null,
    body: '- [ ] Render and clean up on both hosts.',
    html_url: 'https://github.com/example/repo/issues/1',
    user: { login: 'original-author' },
    assignees: [],
    comments: 1,
  };
  const comment = {
    id: 201,
    issue_url: 'https://api.github.com/repos/example/repo/issues/1',
    html_url: 'https://github.com/example/repo/issues/1#issuecomment-201',
    created_at: '2026-11-20T00:00:00Z',
    updated_at: '2026-11-20T00:00:00Z',
    body: 'I still own this work. The second host is pending.',
    user: { login: 'topic-owner' },
  };
  const pages = (rows) => [
    { page: 1, rows, sha256: digest(rows) },
    { page: 2, rows: [], sha256: digest([]) },
  ];
  const originalSources = [
    {
      key: 'original:1:criterion1',
      number: 1,
      original: '- [ ] Both hosts and cleanup',
      originalSha256: digest('- [ ] Both hosts and cleanup'),
    },
  ];
  const snapshot = {
    schemaVersion: 1,
    repository: 'example/repo',
    membershipCutoff: '2026-11-22T10:22:30Z',
    issuePages: pages([issue]),
    commentPages: pages([comment]),
    originalSources,
    originalSourcesSha256: digest(originalSources),
    pullRequests: [],
    issueTimeline: [
      {
        capturedAt: '2026-11-22T10:22:30Z',
        issue: {
          number: 1,
          timelineItems: { totalCount: 0, nodes: [], pageInfo: { hasNextPage: false } },
        },
      },
    ],
  };
  const decision = {
    number: 1,
    state: 'reconciled',
    sourceReading: 'manual-full-body-and-discussion',
    reviewer: 'governance author',
    rationale: 'The original owner retains the second-host cleanup obligation.',
    bodySha256: digest(issue.body),
    discussionSha256: digest([comment]),
    sources: [issue.html_url, comment.html_url, originalSources[0].key],
    remaining: [
      {
        condition: 'Second-host cleanup',
        owner: 'topic-owner',
        nextAction: 'Supply the missing second-host result.',
      },
    ],
  };
  decision.conditionDispositions = [
    {
      sourceKey: `github.issue.1.body@${digest(issue.body)}:line:1`,
      originalSha256: digest(issue.body),
    },
    { sourceKey: originalSources[0].key, originalSha256: originalSources[0].originalSha256 },
  ].map((condition) => ({
    ...condition,
    targetIssue: 1,
    owner: 'topic-owner',
    disposition: 'retain-complete-condition-in-existing-issue',
  }));
  return { snapshot, decision };
}

test('frozen current body and original source are both preserved; pending work blocks completion', () => {
  const { snapshot, decision } = fixture();
  const audit = buildAudit(snapshot, [decision]);
  assert.equal(audit.rows[0].originalSources[0].original, '- [ ] Both hosts and cleanup');
  assert.equal(
    audit.rows[0].currentCheckboxes[0].original,
    '- [ ] Render and clean up on both hosts.'
  );
  assert.throws(() => assertReady(audit), /unresolved conditions/);
  assert.throws(() => assertReady(buildAudit(snapshot)), /await source reconciliation/);
});

test('historical accounting preserves an explicit evidence gap without pretending to reaccept the product', () => {
  const { snapshot, decision } = fixture();
  decision.remaining[0] = {
    ...decision.remaining[0],
    disposition: 'historical-source-gap',
    source: decision.sources[0],
  };
  const audit = buildAudit(snapshot, [decision]);
  assert.throws(() => assertReady(audit), /await independent decision acceptance/);
  const acceptance = {
    schemaVersion: 1,
    state: 'accepted',
    reviewer: 'independent integration reviewer',
    reviewScope: 'Rule review and one fully read source sample; no new technical acceptance',
    sources: ['independent-review-record'],
    snapshotSha256: digest(snapshot),
    decisionSetSha256: digest([decision]),
    acceptedNumbers: [1],
    sampledNumbers: [1],
  };
  assert.doesNotThrow(() => assertReady(buildAudit(snapshot, [decision], acceptance)));
  assert.equal(audit.counts.reconciled, 1);
  assert.equal(audit.counts.decisionAccepted, 0);
  assert.equal(audit.counts.manualFullSourceReadings, 1);
  assert.equal(audit.rows[0].decision.remaining[0].condition, 'Second-host cleanup');
});

test('an independent acceptance cannot outlive its source or decision and cannot be self-issued', () => {
  const { snapshot, decision } = fixture();
  const acceptance = {
    schemaVersion: 1,
    state: 'accepted',
    reviewer: 'independent reviewer',
    reviewScope: 'Source-bound rule review',
    sources: ['review-record'],
    snapshotSha256: digest(snapshot),
    decisionSetSha256: digest([decision]),
    acceptedNumbers: [1],
    sampledNumbers: [1],
  };
  assert.doesNotThrow(() => buildAudit(snapshot, [decision], acceptance));
  assert.throws(
    () => buildAudit(snapshot, [{ ...decision, rationale: 'Different disposition' }], acceptance),
    /different decisions/
  );
  assert.throws(
    () => buildAudit({ ...snapshot, capture: 'changed' }, [decision], acceptance),
    /different snapshot/
  );
  assert.throws(
    () => buildAudit(snapshot, [decision], { ...acceptance, reviewer: decision.reviewer }),
    /cannot independently accept/
  );
});

test('open, merged and closed-unmerged PRs retain distinct native outcomes', () => {
  assert.equal(
    pullRequestDisposition({ number: 2, state: 'OPEN', mergedAt: null, closedAt: null }).state,
    'OPEN'
  );
  assert.equal(
    pullRequestDisposition({
      number: 3,
      state: 'CLOSED',
      mergedAt: null,
      closedAt: '2026-11-01T00:00:00Z',
    }).state,
    'CLOSED_UNMERGED'
  );
  assert.equal(
    pullRequestDisposition({ number: 4, state: 'CLOSED', mergedAt: '2026-11-01T00:00:00Z' }).state,
    'MERGED'
  );
  assert.throws(
    () => pullRequestDisposition({ number: 5, state: null, mergedAt: null }),
    /unsupported native state/
  );
});

test('empty terminal page, stable-ID uniqueness and exact comment accounting reject partial capture', () => {
  for (const mutate of [
    (s) => s.issuePages.pop(),
    (s) => {
      s.issuePages[1].page = 3;
    },
    (s) => {
      s.issuePages[0].rows.push(structuredClone(s.issuePages[0].rows[0]));
      s.issuePages[0].sha256 = digest(s.issuePages[0].rows);
    },
    (s) => {
      s.commentPages[0].rows = [];
      s.commentPages = [{ page: 1, rows: [], sha256: digest([]) }];
    },
  ]) {
    const { snapshot } = fixture();
    mutate(snapshot);
    assert.throws(() => buildAudit(snapshot));
  }
});

test('a post-cutoff object is excluded, not quietly counted in the review denominator', () => {
  const { snapshot } = fixture();
  const later = {
    ...snapshot.issuePages[0].rows[0],
    id: 102,
    number: 2,
    created_at: '2026-11-22T10:23:00Z',
    comments: 0,
  };
  snapshot.issuePages[0].rows.push(later);
  snapshot.issuePages[0].sha256 = digest(snapshot.issuePages[0].rows);
  const result = buildAudit(snapshot);
  assert.equal(result.counts.objects, 1);
  assert.equal(result.counts.excludedLaterObjects, 1);
});

test('changing the reviewed source or dropping an original criterion invalidates a decision', () => {
  for (const mutate of [
    (s, d) => {
      d.sources = d.sources.filter((source) => !source.startsWith('original:'));
    },
    (s, d) => {
      d.conditionDispositions.pop();
    },
    (s) => {
      s.originalSources = [];
    },
    (s) => {
      s.issuePages[0].rows[0].body = '- [x] Only one host';
      s.issuePages[0].sha256 = digest(s.issuePages[0].rows);
    },
    (s) => {
      s.commentPages[0].rows[0].body = 'Finished';
      s.commentPages[0].sha256 = digest(s.commentPages[0].rows);
    },
  ]) {
    const { snapshot, decision } = fixture();
    mutate(snapshot, decision);
    assert.throws(() => buildAudit(snapshot, [decision]));
  }
});

test('three hours with empty assignees never becomes an ownership or takeover inference', () => {
  const { snapshot } = fixture();
  const [idle] = selectIdleObjects(buildAudit(snapshot), []);
  assert.equal(idle.threeHoursSinceObjectUpdate, true);
  assert.equal(idle.selected, false);
  assert.equal(idle.authorization, null);
  assert.ok(idle.ownerEvidence.claimSources.some((source) => source.text.includes('still own')));
  const [authorized] = selectIdleObjects(buildAudit(snapshot), [1]);
  assert.equal(authorized.selected, true);
  assert.match(authorized.authorization, /Current user/);
});

test('Markdown example checkboxes do not manufacture acceptance criteria', () => {
  assert.deepEqual(
    checkboxSources('```md\n- [x] example only\n```\n## Actual acceptance\n- [ ] Required', 'body'),
    [
      {
        key: 'body:line:5',
        sourceLine: 5,
        section: '## Actual acceptance',
        original: '- [ ] Required',
        checked: false,
      },
    ]
  );
});

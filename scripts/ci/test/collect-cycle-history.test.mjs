import assert from 'node:assert/strict';
import test from 'node:test';
import { collectScheduledHistory } from '../collect-cycle-history.mjs';
import { auditCycle } from '../cycle-report.mjs';

const ACTIVATION = '2026-11-04T00:00:00Z';

// A native workflow-run row, exactly as the API returns it.
function nativeRun(fields) {
  return {
    id: 1,
    name: 'CI',
    display_title: 'CI',
    event: 'schedule',
    head_branch: 'main',
    head_sha: 'a'.repeat(40),
    status: 'completed',
    conclusion: 'success',
    created_at: '2026-11-04T09:00:00Z',
    run_started_at: '2026-11-04T09:00:01Z',
    run_attempt: 1,
    ...fields,
  };
}

// A source that honours the list-workflow-runs query the way the API does:
// filtering by event, branch and creation instant, then paging the result.
function workflowRunSource(runs) {
  const calls = [];
  const fetchPage = ({ event, branch, createdAfter, perPage, page }) => {
    calls.push({ event, branch, createdAfter, perPage, page });
    const matching = runs
      .filter((run) => run.event === event)
      .filter((run) => run.head_branch === branch)
      .filter((run) => Date.parse(run.created_at) >= Date.parse(createdAfter))
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    const start = (page - 1) * perPage;
    return JSON.stringify({
      total_count: matching.length,
      workflow_runs: matching.slice(start, start + perPage),
    });
  };
  return { fetchPage, calls };
}

const collect = (source, overrides = {}) =>
  collectScheduledHistory({
    fetchPage: source.fetchPage,
    activationIso: ACTIVATION,
    branch: 'main',
    ...overrides,
  });

test('a flood of pull-request runs cannot evict the scheduled green baseline', () => {
  // 120 pull-request runs, all newer than the scheduled green baseline.
  const pullRequests = Array.from({ length: 120 }, (_, index) =>
    nativeRun({
      id: 1000 + index,
      event: 'pull_request',
      display_title: 'Some pull request',
      created_at: '2026-11-04T10:00:00Z',
    })
  );
  const baseline = nativeRun({
    id: 7,
    display_title: 'regression-cycle:0 0 * * *',
    created_at: '2026-11-04T09:00:00Z',
  });
  const source = workflowRunSource([...pullRequests, baseline]);

  // The unfiltered window the receipt used to read: the baseline is gone.
  const unfiltered = [...pullRequests, baseline]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, 100);
  assert.ok(
    !unfiltered.some((run) => run.id === baseline.id),
    'the unfiltered window is expected to have evicted the baseline'
  );

  const { workflow_runs: rows } = collect(source);
  assert.deepEqual(
    rows.map((run) => run.id),
    [baseline.id],
    'the scheduled baseline survives the pull-request flood'
  );
  assert.ok(source.calls.every((call) => call.event === 'schedule'));
  assert.ok(source.calls.every((call) => call.branch === 'main'));
});

test('the complete window is fetched without requesting an extra page', () => {
  const runs = Array.from({ length: 3 }, (_, index) =>
    nativeRun({ id: index + 1, created_at: '2026-11-04T09:00:00Z' })
  );
  const source = workflowRunSource(runs);
  const { workflow_runs: rows } = collect(source);
  assert.equal(rows.length, 3);
  assert.deepEqual(
    source.calls.map((call) => call.page),
    [1],
    'a complete window stops at the first page'
  );
});

test('a window spanning several pages is fetched completely and then stops', () => {
  const runs = Array.from({ length: 150 }, (_, index) =>
    nativeRun({ id: index + 1, created_at: '2026-11-04T09:00:00Z' })
  );
  const source = workflowRunSource(runs);
  const { workflow_runs: rows } = collect(source);
  assert.equal(rows.length, 150);
  assert.deepEqual(
    source.calls.map((call) => call.page),
    [1, 2],
    'the traversal stops on the page that completes the window'
  );
});

test('a source that ignores the page query is rejected instead of duplicating history', () => {
  const page = Array.from({ length: 100 }, (_, index) =>
    nativeRun({ id: index + 1, created_at: '2026-11-04T09:00:00Z' })
  );
  let calls = 0;
  const fetchPage = () => {
    calls += 1;
    return JSON.stringify({ total_count: 250, workflow_runs: page });
  };
  assert.throws(
    () => collectScheduledHistory({ fetchPage, activationIso: ACTIVATION, branch: 'main' }),
    /repeats run/
  );
  assert.equal(calls, 2, 'the repetition is detected on the second page');
});

test('a truncated window fails closed instead of publishing a partial baseline', () => {
  const page = Array.from({ length: 100 }, (_, index) =>
    nativeRun({ id: index + 1, created_at: '2026-11-04T09:00:00Z' })
  );
  let calls = 0;
  const fetchPage = ({ page: requested }) => {
    calls += 1;
    return requested === 1
      ? JSON.stringify({ total_count: 250, workflow_runs: page })
      : JSON.stringify({ total_count: 250, workflow_runs: [] });
  };
  assert.throws(
    () => collectScheduledHistory({ fetchPage, activationIso: ACTIVATION, branch: 'main' }),
    /ended after 100 of 250 runs/
  );
  assert.equal(calls, 2);
});

test('a page budget that runs out fails closed', () => {
  const runs = Array.from({ length: 150 }, (_, index) =>
    nativeRun({ id: index + 1, created_at: '2026-11-04T09:00:00Z' })
  );
  const source = workflowRunSource(runs);
  assert.throws(
    () =>
      collect(source, { limits: { perPage: 100, maxPages: 1, maxRequests: 1, maxBytes: 1 << 20 } }),
    /exhausted its page budget/
  );
});

test('a byte budget that runs out fails closed', () => {
  const runs = Array.from({ length: 3 }, (_, index) =>
    nativeRun({ id: index + 1, created_at: '2026-11-04T09:00:00Z' })
  );
  const source = workflowRunSource(runs);
  assert.throws(
    () =>
      collect(source, { limits: { perPage: 100, maxPages: 50, maxRequests: 50, maxBytes: 16 } }),
    /byte budget/
  );
});

test('collected native cron identity keeps a delayed baseline out of the next slot', () => {
  const baseline = nativeRun({
    id: 7,
    display_title: 'regression-cycle:0 8 * * *',
    created_at: '2026-11-04T16:30:00Z',
  });
  const source = workflowRunSource([baseline]);
  const { receipt } = auditCycle({
    now: '2026-11-05T00:30:00Z',
    policyActivatedAt: ACTIVATION,
    cron: null,
    laneResults: { build: 'failure' },
    currentRun: nativeRun({
      id: 99,
      event: 'workflow_dispatch',
      created_at: '2026-11-05T00:00:00Z',
    }),
    recentRuns: collect(source).workflow_runs,
  });
  assert.equal(receipt.lastBaseline.id, baseline.id);
  assert.ok(!receipt.missedSlots.includes('2026-11-04T08:00:00.000Z'));
  assert.ok(receipt.missedSlots.includes('2026-11-04T16:00:00.000Z'));
  assert.equal(receipt.scheduledSlot, null);
});

test('an empty native result is complete without requesting another page', () => {
  const source = workflowRunSource([]);
  assert.deepEqual(collect(source), { workflow_runs: [] });
  assert.deepEqual(
    source.calls.map((call) => call.page),
    [1]
  );
});

test('over-delivered native totals fail closed rather than fabricating completeness', () => {
  for (const total of [0, 1]) {
    assert.throws(
      () =>
        collectScheduledHistory({
          activationIso: ACTIVATION,
          branch: 'main',
          fetchPage: () =>
            JSON.stringify({
              total_count: total,
              workflow_runs: [nativeRun({ id: 1 }), nativeRun({ id: 2 })],
            }),
        }),
      /exceeds.*total_count/
    );
  }
});

test('a run created before the activation instant is not part of the window', () => {
  const before = nativeRun({ id: 6, created_at: '2026-11-03T23:00:00Z' });
  const after = nativeRun({ id: 7, created_at: '2026-11-04T09:00:00Z' });
  const source = workflowRunSource([before, after]);
  const { workflow_runs: rows } = collect(source);
  assert.deepEqual(
    rows.map((run) => run.id),
    [after.id]
  );
});

test('an invalid activation instant or branch fails closed', () => {
  const source = workflowRunSource([]);
  assert.throws(
    () =>
      collectScheduledHistory({
        fetchPage: source.fetchPage,
        activationIso: 'nope',
        branch: 'main',
      }),
    /valid policy activation instant/
  );
  assert.throws(
    () =>
      collectScheduledHistory({
        fetchPage: source.fetchPage,
        activationIso: ACTIVATION,
        branch: '',
      }),
    /current-run branch/
  );
});

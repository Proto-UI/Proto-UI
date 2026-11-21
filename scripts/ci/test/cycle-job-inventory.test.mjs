import assert from 'node:assert/strict';
import test from 'node:test';
import { cycleJobInventory } from '../cycle-job-inventory.mjs';

const binding = { runId: 99, sourceRevision: 'a'.repeat(40), runAttempt: 2 };
const job = (id, fields = {}) => ({
  id,
  run_id: 99,
  head_sha: binding.sourceRevision,
  run_attempt: 1,
  name: `suite-${id}`,
  status: 'completed',
  conclusion: 'success',
  steps: [],
  ...fields,
});
const pages = () => [
  {
    total_count: 3,
    jobs: [
      job(1),
      job(2, { conclusion: 'failure', steps: [{ name: 'Browser run', conclusion: 'failure' }] }),
    ],
  },
  {
    total_count: 3,
    jobs: [
      job(3, { name: 'cycle-report', status: 'in_progress', conclusion: null, run_attempt: 2 }),
    ],
  },
];

test('retains paginated failed jobs and native steps without calling them product bugs', () => {
  const r = cycleJobInventory(pages(), binding);
  assert.equal(r.total, 3);
  assert.equal(r.completed, 2);
  assert.deepEqual(r.counts, { success: 1, failure: 1 });
  assert.deepEqual(r.incomplete, []);
  assert.equal(r.inventory[1].diagnosis, 'requires-evidence-triage');
  assert.deepEqual(r.inventory[1].failedSteps, [{ name: 'Browser run', conclusion: 'failure' }]);
});

test('rejects incomplete, duplicate, mixed-source and future-attempt acquisitions', () => {
  assert.throws(() => cycleJobInventory(pages().slice(0, 1), binding), /Truncated/);
  for (const mutate of [
    (p) => (p[1].jobs[0] = p[0].jobs[0]),
    (p) => (p[0].jobs[0].head_sha = 'b'.repeat(40)),
    (p) => (p[0].jobs[0].run_id = 100),
    (p) => (p[0].jobs[0].run_attempt = 3),
    (p) => (p[1].total_count = 4),
  ]) {
    const input = pages();
    mutate(input);
    assert.throws(() => cycleJobInventory(input, binding));
  }
});

test('a queued or running upstream job is explicit incomplete evidence', () => {
  const p = pages();
  p[0].jobs[0].status = 'queued';
  p[0].jobs[0].conclusion = null;
  const r = cycleJobInventory(p, binding);
  assert.deepEqual(r.incomplete, [1]);
  assert.equal(r.counts.unknown, 1);
});

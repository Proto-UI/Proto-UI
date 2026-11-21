import assert from 'node:assert/strict';

// Native Actions job facts complement the aggregate `needs` lanes. A failure
// remains unclassified until its assertion/setup/resource evidence is reviewed.
export function cycleJobInventory(pages, { runId, sourceRevision, runAttempt }) {
  assert.ok(Array.isArray(pages) && pages.length > 0, 'Missing paginated job inventory');
  const total = pages[0].total_count;
  assert.ok(Number.isSafeInteger(total) && total > 0, 'Invalid native job count');
  for (const page of pages) {
    assert.equal(page.total_count, total, 'Job inventory changed during pagination');
    assert.ok(Array.isArray(page.jobs), 'Missing native jobs page');
  }
  const jobs = pages.flatMap((page) => page.jobs);
  assert.equal(jobs.length, total, 'Truncated native job inventory');
  assert.equal(new Set(jobs.map((job) => job.id)).size, jobs.length, 'Duplicate native job IDs');
  for (const job of jobs) {
    assert.equal(job.run_id, runId, 'Job belongs to another run');
    assert.equal(job.head_sha, sourceRevision, 'Job source revision drift');
    assert.ok(
      Number.isSafeInteger(job.run_attempt) &&
        job.run_attempt >= 1 &&
        job.run_attempt <= runAttempt,
      'Invalid native job attempt'
    );
  }
  const inventory = jobs.map((job) => ({
    id: job.id,
    name: job.name,
    url: job.html_url,
    attempt: job.run_attempt,
    status: job.status,
    conclusion: job.conclusion,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    failedSteps: (job.steps ?? [])
      .filter((step) => ['failure', 'timed_out', 'cancelled'].includes(step.conclusion))
      .map((step) => ({ name: step.name, conclusion: step.conclusion })),
    diagnosis: job.conclusion === 'success' ? 'native-job-success' : 'requires-evidence-triage',
  }));
  // This reporter is necessarily in progress while collecting its own receipt.
  const upstream = inventory.filter((job) => job.name !== 'cycle-report');
  return {
    total,
    completed: upstream.filter((job) => job.status === 'completed').length,
    incomplete: upstream.filter((job) => job.status !== 'completed').map((job) => job.id),
    counts: Object.fromEntries(
      [...new Set(upstream.map((job) => job.conclusion ?? 'unknown'))].map((outcome) => [
        outcome,
        upstream.filter((job) => (job.conclusion ?? 'unknown') === outcome).length,
      ])
    ),
    inventory,
  };
}

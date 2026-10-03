import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parse } from 'yaml';

test('diagram evidence uses an exact-head read-only PR job and a valid job-level environment', async () => {
  const workflow = parse(
    await readFile(
      new URL('../../../.github/workflows/whitepaper-diagram-evidence.yml', import.meta.url),
      'utf8'
    )
  );
  assert.deepEqual(Object.keys(workflow.on), ['pull_request']);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  const job = workflow.jobs.capture;
  assert.equal(job.env.CANDIDATE_SHA, '${{ github.event.pull_request.head.sha }}');
  // runner is unavailable at jobs.<job_id>.env. Keep the fixed Linux path here;
  // runtime runner variables may only be resolved later inside a step.
  assert.equal(job.env.DIAGRAM_EVIDENCE_DIR, '/tmp/whitepaper-diagram-evidence');
  const checkout = job.steps.find((step) => step.uses?.startsWith('actions/checkout@'));
  assert.equal(checkout.with.ref, '${{ env.CANDIDATE_SHA }}');
  assert.equal(checkout.with['persist-credentials'], false);
  assert.ok(
    job.steps.some(
      (step) => step.uses?.startsWith('actions/upload-artifact@') && step.if === 'always()'
    )
  );
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parse } from 'yaml';

test('diagram evidence PR capture keeps exact-head checkout read-only', async () => {
  const workflow = parse(
    await readFile(
      new URL('../../../.github/workflows/whitepaper-diagram-evidence.yml', import.meta.url),
      'utf8'
    )
  );
  assert.deepEqual(Object.keys(workflow.on), ['pull_request']);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  const job = workflow.jobs.capture;
  const checkout = job.steps.find((step) => step.uses?.startsWith('actions/checkout@'));
  assert.equal(job.env.CANDIDATE_SHA, '${{ github.event.pull_request.head.sha }}');
  assert.equal(checkout.with.ref, '${{ env.CANDIDATE_SHA }}');
  assert.equal(checkout.with['persist-credentials'], false);
});

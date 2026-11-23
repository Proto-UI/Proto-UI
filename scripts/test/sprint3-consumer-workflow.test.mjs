import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import YAML from 'yaml';

const workflow = YAML.parse(
  readFileSync(
    new URL('../../.github/workflows/sprint3-consumer-evidence.yml', import.meta.url),
    'utf8'
  )
);
const job = workflow.jobs['native-consumers'];

test('job environment uses only contexts available before a runner exists', () => {
  // GitHub allows runner in step run/env, but not jobs.<job_id>.env.
  // https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#context-availability
  for (const [name, value] of Object.entries(job.env))
    assert.doesNotMatch(String(value), /\$\{\{\s*runner\./, `${name} has no runner context here`);
});

test('first step creates and publishes owned paths from actual runner shell variables', (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sprint3 runner paths '));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const envFile = path.join(directory, 'github-env');
  const head = 'a'.repeat(40);
  execFileSync('bash', ['-euo', 'pipefail', '-c', job.steps[0].run], {
    env: {
      PATH: process.env.PATH,
      RUNNER_TEMP: directory,
      GITHUB_ENV: envFile,
      GITHUB_SHA: head,
      GITHUB_RUN_ID: '123',
      GITHUB_RUN_ATTEMPT: '2',
    },
  });
  const values = Object.fromEntries(
    readFileSync(envFile, 'utf8')
      .trim()
      .split('\n')
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1)];
      })
  );
  assert.deepEqual(values, {
    SPRINT3_EVIDENCE_DIR: `${directory}/sprint3-consumer-evidence-${head}-123-2`,
    TMPDIR: `${directory}/sprint3-consumer-tmp`,
  });
  for (const value of Object.values(values)) assert.equal(existsSync(value), true);
});

test('workflow stays manual, source bound, read only and retains failures', () => {
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  const checkout = job.steps.find((step) => step.uses === 'actions/checkout@v4');
  assert.equal(checkout.with.ref, '${{ github.sha }}');
  assert.equal(checkout.with['persist-credentials'], false);
  const upload = job.steps.find((step) => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.if, 'always()');
  assert.equal(upload.with.path, '${{ env.SPRINT3_EVIDENCE_DIR }}');
  assert.equal(upload.with['if-no-files-found'], 'error');
  const checks = job.steps.findIndex((step) => step.id === 'runner-checks');
  assert.ok(checks > job.steps.findIndex((step) => step.id === 'dependencies'));
  assert.ok(job.steps.findIndex((step) => step.id === 'inventory') < checks);
  assert.equal(job.steps.find((step) => step.run?.includes('mjs finalize')).if, 'always()');
});

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import YAML from 'yaml';
import { ENGINE_COMMIT } from '../reposteward-portfolio.mjs';

const workflowPath = new URL(
  '../../../.github/workflows/reposteward-portfolio-shadow.yml',
  import.meta.url
);
const workflow = YAML.parse(readFileSync(workflowPath, 'utf8'));
const job = workflow.jobs.portfolio;

// GitHub's context-availability table admits runner in step run/env, but not
// jobs.<job_id>.env. This check needs no workflow dispatch or external engine.
test('portfolio job environment does not reference unavailable runner context', () => {
  for (const [name, value] of Object.entries(job.env)) {
    assert.doesNotMatch(
      String(value),
      /\$\{\{\s*runner\./,
      `${name} is evaluated before a runner exists`
    );
  }
});

test('initializes all ephemeral paths from runner-provided variables before use', () => {
  const step = job.steps[0];
  assert.equal(step.name, 'Initialize ephemeral trial paths');
  const directory = mkdtempSync(path.join(tmpdir(), 'pui runner paths '));
  const envFile = path.join(directory, 'github-env');
  try {
    execFileSync('bash', ['-euo', 'pipefail', '-c', step.run], {
      env: { PATH: process.env.PATH, RUNNER_TEMP: directory, GITHUB_ENV: envFile },
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
      REPOSTEWARD_SOURCE: `${directory}/reposteward/source`,
      REPOSTEWARD_CONFIG_PATH: `${directory}/reposteward/project.toml`,
      XDG_CONFIG_HOME: `${directory}/reposteward/config`,
      XDG_STATE_HOME: `${directory}/reposteward/state`,
      XDG_DATA_HOME: `${directory}/reposteward/data`,
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('retains the manual, read-only, commit-pinned trial boundary', () => {
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.deepEqual(workflow.permissions, {
    contents: 'read',
    'pull-requests': 'read',
    checks: 'read',
    statuses: 'read',
  });
  assert.equal(job.env.REPOSTEWARD_COMMIT, ENGINE_COMMIT);
  assert.equal(
    job.steps.find((step) => step.uses === 'actions/checkout@v4').with['persist-credentials'],
    false
  );
});

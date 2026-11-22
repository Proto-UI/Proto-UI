import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { parse } from 'yaml';

const workflow = parse(
  await readFile(
    new URL('../../../.github/workflows/whitepaper-diagram-evidence.yml', import.meta.url),
    'utf8'
  )
);
const job = workflow.jobs.capture;
const authoredScript = 'apps/www/scripts/capture-authored-diagram-evidence.mjs';

function authoredStep() {
  const matches = job.steps.filter((step) => step.run?.includes(`node ${authoredScript}`));
  assert.equal(matches.length, 1, 'the six authored assets need one independent capture step');
  return matches[0];
}

// Evaluate this workflow's Boolean condition subset, including Actions' implicit
// success() requirement when the expression has no status-check function. This
// is local guard evidence; actual Actions/native execution remains separate.
function admitted(step, { build, previousFailure = false, cancelled = false }) {
  const expression = (step.if ?? 'success()').replace(/^\s*\$\{\{\s*|\s*\}\}\s*$/g, '');
  const statusFunction = /\b(?:always|cancelled|failure|success)\s*\(/.test(expression);
  if (!statusFunction && (previousFailure || cancelled)) return false;
  return Boolean(
    runInNewContext(
      expression,
      {
        steps: { build: { outcome: build } },
        always: () => true,
        cancelled: () => cancelled,
        failure: () => previousFailure,
        success: () => !previousFailure && !cancelled,
      },
      { timeout: 100 }
    )
  );
}

test('diagram evidence keeps explicit triggers and exact-head checkout read-only', () => {
  assert.deepEqual(Object.keys(workflow.on).sort(), ['workflow_call', 'workflow_dispatch']);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  const checkout = job.steps.find((step) => step.uses?.startsWith('actions/checkout@'));
  assert.equal(job.env.CANDIDATE_SHA, '${{ github.event.pull_request.head.sha || github.sha }}');
  assert.equal(checkout.with.ref, '${{ env.CANDIDATE_SHA }}');
  assert.equal(checkout.with['persist-credentials'], false);
});

test('authored capture requires its shared build but survives an earlier profile failure', () => {
  const step = authoredStep();
  const build = job.steps.find((candidate) => candidate.id === 'build');
  assert.ok(build, 'capture needs the existing production build receipt');
  assert.ok(job.steps.indexOf(build) < job.steps.indexOf(step));
  for (const scope of [job, step]) {
    assert.ok(
      scope['continue-on-error'] === undefined || scope['continue-on-error'] === false,
      'a failed authored capture must retain the failed job outcome'
    );
  }
  for (const [state, expected] of [
    [{ build: 'success' }, true],
    [{ build: 'success', previousFailure: true }, true],
    [{ build: 'failure', previousFailure: true }, false],
    [{ build: 'skipped' }, false],
    [{ build: 'cancelled', cancelled: true }, false],
    [{ build: 'success', cancelled: true }, false],
  ]) {
    assert.equal(admitted(step, state), expected, JSON.stringify(state));
  }
  // These counterexamples distinguish independent capture from default success
  // gating, and successful-build admission from indiscriminate always().
  assert.equal(admitted({}, { build: 'success', previousFailure: true }), false);
  assert.equal(admitted({ if: 'always()' }, { build: 'failure' }), true);
  for (const name of ['CANDIDATE_SHA', 'CHROME_PATH', 'DIAGRAM_EVIDENCE_DIR']) {
    assert.equal(step.env?.[name], undefined, `capture must inherit the shared ${name}`);
  }
});

test('the actual authored shell step preserves failure status and raw logs beside the shared build', async () => {
  const step = authoredStep();
  const directory = await mkdtemp(path.join(tmpdir(), 'pui authored workflow '));
  try {
    const bin = path.join(directory, 'bin');
    await mkdir(bin);
    const stub = path.join(bin, 'node');
    await writeFile(
      stub,
      `#!${process.execPath}\n` +
        `process.stdout.write(JSON.stringify({argv:process.argv.slice(2),source:process.env.CANDIDATE_SHA,browser:process.env.CHROME_PATH})+'\\n');\n` +
        `process.stderr.write('authored-capture diagnostic\\n');\n` +
        `process.exit(Number(process.env.CAPTURE_EXIT));\n`
    );
    await chmod(stub, 0o755);
    for (const exit of [0, 17]) {
      const evidence = path.join(directory, `evidence ${exit}`);
      await mkdir(evidence);
      const originalBuild = '{"kind":"retained-shared-build"}\n';
      await writeFile(path.join(evidence, 'build.json'), originalBuild);
      const source = 'a'.repeat(40);
      const browser = '/explicit/browser';
      const result = spawnSync('bash', ['-e', '-c', step.run], {
        cwd: directory,
        env: {
          ...process.env,
          PATH: `${bin}${path.delimiter}${process.env.PATH}`,
          CANDIDATE_SHA: source,
          CHROME_PATH: browser,
          DIAGRAM_EVIDENCE_DIR: evidence,
          CAPTURE_EXIT: String(exit),
        },
        encoding: 'utf8',
        timeout: 10000,
      });
      assert.equal(result.status, exit, result.stderr || result.stdout);
      const log = await readFile(path.join(evidence, 'authored-browser.log'), 'utf8');
      assert.deepEqual(JSON.parse(log.split('\n')[0]), {
        argv: [authoredScript],
        source,
        browser,
      });
      assert.match(log, /authored-capture diagnostic/);
      assert.equal(await readFile(path.join(evidence, 'build.json'), 'utf8'), originalBuild);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('the same evidence artifact remains eligible after capture failure or cancellation', () => {
  const step = authoredStep();
  const upload = job.steps.find((candidate) =>
    candidate.uses?.startsWith('actions/upload-artifact@')
  );
  assert.ok(job.steps.indexOf(step) < job.steps.indexOf(upload));
  assert.equal(admitted(upload, { build: 'success', previousFailure: true }), true);
  assert.equal(admitted(upload, { build: 'success', cancelled: true }), true);
  assert.equal(admitted(upload, { build: 'failure', previousFailure: true }), true);
  assert.equal(upload.with.path, '${{ env.DIAGRAM_EVIDENCE_DIR }}');
  assert.equal(upload.with['if-no-files-found'], 'error');
});

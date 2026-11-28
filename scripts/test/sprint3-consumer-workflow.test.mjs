import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import YAML from 'yaml';
import ts from 'typescript';

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
  for (const [name, value] of Object.entries(
    Object.assign({}, ...Object.values(workflow.jobs).map((entry) => entry.env))
  ))
    assert.doesNotMatch(String(value), /\$\{\{\s*runner\./, `${name} has no runner context here`);
});

test('consumer jobs create distinct owned paths from actual runner shell variables', (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sprint3 runner paths '));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const head = 'a'.repeat(40);
  for (const [id, evidencePrefix, temporaryName] of [
    ['native-consumers', 'sprint3-consumer-evidence', 'sprint3-consumer-tmp'],
    ['base-select-consumers', 'sprint3-base-select-evidence', 'sprint3-base-select-tmp'],
  ]) {
    const runner = path.join(directory, id);
    const envFile = path.join(runner, 'github-env');
    execFileSync('bash', ['-euo', 'pipefail', '-c', workflow.jobs[id].steps[0].run], {
      env: {
        PATH: process.env.PATH,
        RUNNER_TEMP: runner,
        GITHUB_ENV: envFile,
        CANDIDATE_SHA: head,
        GITHUB_SHA: 'b'.repeat(40),
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
      SPRINT3_EVIDENCE_DIR: path.join(runner, evidencePrefix + '-' + head + '-123-2'),
      TMPDIR: path.join(runner, temporaryName),
    });
    for (const value of Object.values(values)) assert.equal(existsSync(value), true);
  }
});

test('workflow stays explicitly manual or callable, source bound, read only and retains failures', () => {
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch', 'workflow_call']);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  const checkout = job.steps.find((step) => step.uses === 'actions/checkout@v4');
  assert.equal(job.env.CANDIDATE_SHA, '${{ github.event.pull_request.head.sha || github.sha }}');
  assert.equal(checkout.with.ref, '${{ env.CANDIDATE_SHA }}');
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

const carrier = YAML.parse(
  readFileSync(
    new URL('../../.github/workflows/browser-suite-repair-evidence.yml', import.meta.url),
    'utf8'
  )
);
const budget = YAML.parse(
  readFileSync(
    new URL('../../.github/workflows/package-budget-evidence.yml', import.meta.url),
    'utf8'
  )
);

test('registered carrier opts in manually without changing ordinary or reusable defaults', () => {
  assert.deepEqual(carrier.on.workflow_dispatch.inputs.sprint3_acceptance, {
    description: 'Run Sprint 3 acceptance instead of the selected repair scope',
    type: 'boolean',
    required: false,
    default: false,
  });
  assert.equal(carrier.on.workflow_call.inputs.sprint3_acceptance, undefined);
  assert.equal(carrier.on.workflow_dispatch.inputs.scope.default, 'repair');
  assert.equal(
    carrier.jobs['focused-browser'].if,
    "${{ inputs.scope != 'sprint1' && inputs.scope != 'contents-wheel' && (github.event_name != 'workflow_dispatch' || inputs.scope != 'dialog-reopen-diagnostic') && inputs.sprint3_acceptance != true && inputs.sprint3_followup != true }}"
  );
  assert.equal(
    carrier.jobs.sprint1.if,
    "${{ inputs.scope == 'sprint1' && inputs.sprint3_acceptance != true && inputs.sprint3_followup != true }}"
  );
  const call = carrier.jobs['sprint3-acceptance'];
  assert.equal(
    call.if,
    "github.event_name == 'workflow_dispatch' && inputs.sprint3_acceptance == true"
  );
  assert.equal(call.uses, './.github/workflows/sprint3-consumer-evidence.yml');
  assert.deepEqual(call.permissions, { contents: 'read' });
  assert.equal(call.secrets, undefined);
  assert.equal(carrier.concurrency['cancel-in-progress'], false);
  assert.equal(carrier.on.pull_request, undefined);
});

test('default consumers, Base Select, release and strict budget fail independently', () => {
  assert.deepEqual(Object.keys(workflow.jobs).sort(), [
    'base-select-consumers',
    'native-consumers',
    'release-rehearsal',
    'strict-package-budgets',
  ]);
  for (const entry of Object.values(workflow.jobs)) {
    assert.equal(entry.needs, undefined);
    assert.equal(entry['continue-on-error'], undefined);
    assert.equal(entry.secrets, undefined);
  }
  assert.equal(
    workflow.jobs['strict-package-budgets'].uses,
    './.github/workflows/package-budget-evidence.yml'
  );
  const release = workflow.jobs['release-rehearsal'];
  assert.equal(
    release.steps.find((step) => step.uses === 'actions/checkout@v4').with.ref,
    '${{ env.CANDIDATE_SHA }}'
  );
  assert.match(
    release.steps.find((step) => step.id === 'rehearsal').run,
    /node scripts\/release\/rehearse\.mjs --out-dir "\$REHEARSAL_EVIDENCE_DIR\/rehearsal" --step-timeout-ms 1800000/
  );
  assert.equal(release.steps.find((step) => step.run?.includes('terminal.json')).if, 'always()');
  assert.equal(
    release.steps.find((step) => step.uses === 'actions/upload-artifact@v4').if,
    'always()'
  );
  const strict = budget.jobs['whole-entry-budgets'];
  assert.ok(
    strict.steps.some((step) =>
      step.run?.includes(
        'node scripts/analysis/package-budgets.mjs --json --require-clean --expected-sha "$GITHUB_SHA"'
      )
    )
  );
  assert.equal(strict.steps.find((step) => step.run?.includes('terminal.json')).if, 'always()');
  assert.equal(
    strict.steps.find((step) => step.uses === 'actions/upload-artifact@v4').with.path,
    '${{ runner.temp }}/package-budgets'
  );
});

test('Base Select binds the explicit profile through every phase without changing the default inventory', () => {
  const selected = workflow.jobs['base-select-consumers'];
  assert.equal(
    selected.env.CANDIDATE_SHA,
    '${{ github.event.pull_request.head.sha || github.sha }}'
  );
  const checkout = selected.steps.find((step) => step.uses === 'actions/checkout@v4');
  assert.equal(checkout.with.ref, '${{ env.CANDIDATE_SHA }}');
  assert.equal(checkout.with['persist-credentials'], false);
  for (const phase of ['init', 'run', 'finalize']) {
    const marker = 'node scripts/test/sprint3-consumer-evidence.mjs ' + phase;
    const selectedStep = selected.steps.find((step) => step.run?.includes(marker));
    assert.ok(selectedStep, 'missing Base Select phase: ' + phase);
    assert.ok(selectedStep.run.includes(marker + ' --profile base-select'));
    const defaultStep = job.steps.find((step) => step.run?.includes(marker));
    assert.ok(defaultStep, 'missing default phase: ' + phase);
    assert.doesNotMatch(defaultStep.run, /--profile/);
    if (phase === 'finalize') {
      assert.equal(selectedStep.if, 'always()');
      assert.match(selectedStep.run, /bootstrap-failure\.json/);
    }
  }
  for (const entry of [job, selected])
    assert.ok(
      entry.steps
        .find((step) => step.id === 'runner-checks')
        .run.includes('scripts/test/sprint3-consumer-profiles.test.mjs')
    );
  const upload = selected.steps.find((step) => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.if, 'always()');
  assert.equal(upload.with.path, '${{ env.SPRINT3_EVIDENCE_DIR }}');
  assert.equal(upload.with['if-no-files-found'], 'error');
  assert.equal(
    upload.with.name,
    'sprint3-base-select-evidence-${{ env.CANDIDATE_SHA }}-${{ github.run_id }}-${{ github.run_attempt }}'
  );
});

function terminalScript(entry) {
  const run = entry.steps.find((step) => step.run?.includes('terminal.json')).run;
  const match = run.match(/node --input-type=module <<'JS'\n([\s\S]*?)\nJS(?:\n|$)/);
  assert.ok(match, 'terminal verifier must be an inspectable, executed Node script');
  return match[1];
}

function literalArray(source, variable) {
  const parsed = ts.createSourceFile(
    'inventory.mjs',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  assert.equal(parsed.parseDiagnostics.length, 0, 'inventory source must parse');
  const declarations = parsed.statements
    .flatMap((statement) =>
      ts.isVariableStatement(statement) ? [...statement.declarationList.declarations] : []
    )
    .filter(
      (declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === variable
    );
  assert.equal(declarations.length, 1, 'expected one declared inventory: ' + variable);
  const initializer = declarations[0].initializer;
  assert.ok(
    initializer && ts.isArrayLiteralExpression(initializer),
    'inventory must be a literal array'
  );
  return initializer.elements;
}

function originalRehearsalLabels() {
  // Parse only: importing rehearse.mjs would execute the real release producer.
  const source = readFileSync(new URL('../release/rehearse.mjs', import.meta.url), 'utf8');
  return literalArray(source, 'steps').map((step) => {
    assert.ok(ts.isArrayLiteralExpression(step), 'each original gate must be a literal tuple');
    const label = step.elements[0];
    assert.ok(label && ts.isStringLiteral(label), 'each original gate must have a literal label');
    return label.text;
  });
}

test('release verifier binds the exact original gate sequence without executing its producer', () => {
  const planned = literalArray(
    terminalScript(workflow.jobs['release-rehearsal']),
    'plannedGates'
  ).map((label) => {
    assert.ok(ts.isStringLiteral(label), 'verifier gate names must remain explicit');
    return label.text;
  });
  assert.equal(planned.length, 15);
  assert.deepEqual(planned, originalRehearsalLabels());
});

test('release terminal verification preserves original failed, incomplete and wrong-source receipts', (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sprint3 release terminal '));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const head = 'a'.repeat(40);
  const good = {
    source: { revision: head, clean: true },
    sourceAfter: { revision: head, clean: true },
    status: 'passed',
    qualifiesAsFrozenCandidate: true,
    sourceUnchanged: true,
    steps: originalRehearsalLabels().map((label, index) => ({
      id: 'step-' + String(index + 1).padStart(2, '0'),
      label,
      status: 'passed',
    })),
  };
  for (const scenario of [
    'passed',
    'gate-failed',
    'wrong-source',
    'dirty-source',
    'missing',
    'producer-failed',
    'incomplete',
    'duplicate-gate',
    'replaced-gate',
    'reordered-gates',
    'wrong-gate-id',
    'null-receipt',
    'array-receipt',
    'malformed-gate',
  ]) {
    const output = path.join(directory, scenario);
    mkdirSync(path.join(output, 'rehearsal'), { recursive: true });
    let receipt = structuredClone(good);
    if (scenario === 'gate-failed') receipt.steps[4].status = 'failed';
    if (scenario === 'wrong-source') receipt.sourceAfter.revision = 'b'.repeat(40);
    if (scenario === 'dirty-source') receipt.sourceAfter.clean = false;
    if (scenario === 'incomplete') receipt.steps.pop();
    if (scenario === 'duplicate-gate') receipt.steps[4] = structuredClone(receipt.steps[3]);
    if (scenario === 'replaced-gate') receipt.steps[4].label = 'Replacement gate';
    if (scenario === 'reordered-gates')
      [receipt.steps[0], receipt.steps[1]] = [receipt.steps[1], receipt.steps[0]];
    if (scenario === 'wrong-gate-id') receipt.steps[4].id = 'step-99';
    if (scenario === 'malformed-gate') receipt.steps[4] = null;
    if (scenario === 'null-receipt') receipt = null;
    if (scenario === 'array-receipt') receipt = [];
    const original = JSON.stringify(receipt) + '\n';
    const file = path.join(output, 'rehearsal/rehearsal.json');
    if (scenario !== 'missing') writeFileSync(file, original);
    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', terminalScript(workflow.jobs['release-rehearsal'])],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          REHEARSAL_EVIDENCE_DIR: output,
          CANDIDATE_SHA: head,
          WORKFLOW_STEP_OUTCOMES: JSON.stringify({
            rehearsal: { outcome: scenario === 'producer-failed' ? 'failure' : 'success' },
          }),
        },
      }
    );
    assert.equal(result.status, scenario === 'passed' ? 0 : 1, result.stderr);
    const terminal = JSON.parse(readFileSync(path.join(output, 'terminal.json'), 'utf8'));
    assert.equal(terminal.status, scenario === 'passed' ? 'passed' : 'failed');
    if (scenario !== 'missing') assert.equal(readFileSync(file, 'utf8'), original);
  }
});

test('strict budget terminal verification keeps measurement and setup failures blocking', (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sprint3 budget terminal '));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const head = 'a'.repeat(40);
  for (const scenario of [
    'passed',
    'gate-failed',
    'wrong-source',
    'missing',
    'setup-failed',
    'dirty-source',
    'null-report',
    'array-report',
  ]) {
    const runner = path.join(directory, scenario),
      output = path.join(runner, 'package-budgets');
    mkdirSync(output, { recursive: true });
    let report = {
      exitCode: scenario === 'gate-failed' ? 1 : 0,
      source: {
        head: scenario === 'wrong-source' ? 'b'.repeat(40) : head,
        expectedSha: head,
        requireClean: true,
        workingTreeClean: scenario !== 'dirty-source',
        measuredSourceMatchesHead: true,
        stableDuringMeasurement: true,
      },
    };
    if (scenario === 'null-report') report = null;
    if (scenario === 'array-report') report = [];
    const original = JSON.stringify(report) + '\n',
      file = path.join(output, 'report.json');
    if (scenario !== 'missing') writeFileSync(file, original);
    const outcomes = Object.fromEntries(
      ['dependencies', 'build', 'controls', 'gate'].map((id) => [
        id,
        { outcome: scenario === 'setup-failed' && id === 'dependencies' ? 'failure' : 'success' },
      ])
    );
    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', terminalScript(budget.jobs['whole-entry-budgets'])],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          RUNNER_TEMP: runner,
          GITHUB_SHA: head,
          WORKFLOW_STEP_OUTCOMES: JSON.stringify(outcomes),
        },
      }
    );
    assert.equal(result.status, scenario === 'passed' ? 0 : 1, result.stderr);
    const terminal = JSON.parse(readFileSync(path.join(output, 'terminal.json'), 'utf8'));
    assert.equal(terminal.status, scenario === 'passed' ? 'passed' : 'failed');
    if (scenario !== 'missing') assert.equal(readFileSync(file, 'utf8'), original);
  }
});

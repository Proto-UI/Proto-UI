#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PNPM = ['corepack', 'pnpm@10.32.1'];
const BUDGET_ENTRIES = [
  'packages/prototypes/lucide/src/icons/x.ts',
  'packages/prototypes/lucide/src/index.ts',
  'packages/core/src/index.ts',
  'packages/runtime/src/index.ts',
  'packages/adapters/react/src/index.ts',
  'packages/adapters/vue/src/index.ts',
  'packages/adapters/web-component/src/index.ts',
  'packages/prototypes/base/src/button/index.ts',
  'packages/prototypes/shadcn/src/button/index.ts',
];
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const errorText = (error) => (error instanceof Error ? error.message : String(error));
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const save = (file, value, options) =>
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n', options);

export function commandPlan(group, expectedHead) {
  assert.ok(['build', 'react', 'cli'].includes(group), 'Unknown public validation group');
  assert.match(expectedHead, /^[a-f0-9]{40}$/);
  const actions =
    group === 'build'
      ? [
          ['build-packages', [...PNPM, 'build:packages']],
          ['package-manifests', [...PNPM, 'check:package-manifests']],
          ['budget-policy', [...PNPM, 'test:package-budget-policy']],
          [
            'strict-budgets',
            [
              'node',
              'scripts/analysis/package-budgets.mjs',
              '--json',
              '--require-clean',
              '--expected-sha',
              expectedHead,
            ],
          ],
        ]
      : [['smoke-' + group, [...PNPM, '-s', 'release:smoke:' + group]]];
  return [
    ['node-version', ['node', '--version']],
    ['gate-controls', ['node', '--test', 'scripts/test/run-bootstrap-public-validation.test.mjs']],
    ['corepack-enable', ['corepack', 'enable']],
    ['corepack-prepare', ['corepack', 'prepare', 'pnpm@10.32.1', '--activate']],
    ['pnpm-version', [...PNPM, '--version']],
    ['install', [...PNPM, 'install', '--frozen-lockfile']],
    ...actions,
  ].map(([id, argv]) => ({
    id,
    argv,
    stdout: id === 'strict-budgets' ? 'package-budgets.json' : id + '.stdout.log',
    stderr: id + '.stderr.log',
  }));
}

export function captureSource(root) {
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  const status = git('status', '--porcelain=v1', '--untracked-files=all');
  return {
    head: git('rev-parse', 'HEAD').trim(),
    tree: git('rev-parse', 'HEAD^{tree}').trim(),
    status,
    clean: status.length === 0,
  };
}

const PIPELINE = [
  'set +e',
  '"$@" 2>"$PUI_PUBLIC_STDERR" | tee "$PUI_PUBLIC_STDOUT"',
  'pui_status=("${PIPESTATUS[@]}")',
  'set -e',
  'printf \'%s\\n\' "${pui_status[0]}" > "$PUI_PUBLIC_COMMAND_EXIT"',
  'printf \'%s\\n\' "${pui_status[1]}" > "$PUI_PUBLIC_TEE_EXIT"',
  'cat "$PUI_PUBLIC_STDERR" >&2',
  '(( pui_status[0] == 0 && pui_status[1] == 0 ))',
].join('\n');
function fileFacts(directory, file) {
  const content = readFileSync(join(directory, file));
  return { file, bytes: content.length, sha256: sha256(content) };
}
function exitReceipt(directory, file) {
  const text = readFileSync(join(directory, file), 'utf8');
  assert.match(text, /^(0|[1-9][0-9]*)\n$/);
  return Number(text.trim());
}

// Fixed argv are passed as positional arguments, never interpolated into shell code.
// stdout is streamed through tee; stderr is retained separately and replayed in full.
export function executeCommand(command, { root, directory }) {
  const commandExitFile = command.id + '.command-exit';
  const teeExitFile = command.id + '.tee-exit';
  for (const file of [command.stdout, command.stderr, commandExitFile, teeExitFile])
    assert.equal(
      existsSync(join(directory, file)),
      false,
      'Refusing stale command evidence: ' + file
    );
  const record = {
    ...command,
    commandExitFile,
    teeExitFile,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    commandExit: null,
    teeExit: null,
    pipelineExit: null,
    signal: null,
    errors: [],
  };
  const result = spawnSync(
    'bash',
    ['--noprofile', '--norc', '-c', PIPELINE, 'public-validation', ...command.argv],
    {
      cwd: root,
      stdio: 'inherit',
      env: {
        ...process.env,
        COREPACK_ENABLE_PROJECT_SPEC: '0',
        PUI_PUBLIC_STDOUT: join(directory, command.stdout),
        PUI_PUBLIC_STDERR: join(directory, command.stderr),
        PUI_PUBLIC_COMMAND_EXIT: join(directory, commandExitFile),
        PUI_PUBLIC_TEE_EXIT: join(directory, teeExitFile),
      },
    }
  );
  record.finishedAt = new Date().toISOString();
  record.pipelineExit = result.status;
  record.signal = result.signal;
  if (result.error) record.errors.push(errorText(result.error));
  for (const [field, file] of [
    ['commandExit', commandExitFile],
    ['teeExit', teeExitFile],
  ]) {
    try {
      record[field] = exitReceipt(directory, file);
    } catch (error) {
      record.errors.push(errorText(error));
    }
  }
  for (const field of ['stdout', 'stderr']) {
    try {
      record[field + 'Evidence'] = fileFacts(directory, command[field]);
    } catch (error) {
      record.errors.push(errorText(error));
    }
  }
  return record;
}

export function assertStrictBudgetReport(report, expectedHead, expectedTree) {
  assert.equal(report.schemaVersion, 2);
  assert.equal(report.policy?.mode, 'strict');
  assert.equal(report.withinBudgets, true);
  assert.equal(report.exitCode, 0);
  assert.equal(report.source?.head, expectedHead);
  assert.equal(report.source?.expectedSha, expectedHead);
  assert.equal(report.source?.tree, expectedTree);
  for (const field of [
    'workingTreeClean',
    'measuredSourceMatchesHead',
    'stableDuringMeasurement',
    'requireClean',
  ])
    assert.equal(report.source?.[field], true, field);
  assert.ok(Number.isSafeInteger(report.source.fileCount) && report.source.fileCount > 0);
  assert.match(report.source.fingerprintSha256, /^[a-f0-9]{64}$/);
  assert.ok(Array.isArray(report.results));
  assert.deepEqual(report.results.map((row) => row.entry).sort(), [...BUDGET_ENTRIES].sort());
  for (const row of report.results) {
    assert.equal(row.pass, true, row.entry);
    assert.equal(row.blocking, false, row.entry);
    assert.equal(row.overBudgetBytes, 0, row.entry);
    for (const field of ['gzipBytes', 'minifiedBytes', 'budget'])
      assert.ok(Number.isSafeInteger(row[field]) && row[field] > 0, row.entry + ' ' + field);
    assert.ok(row.gzipBytes <= row.budget, row.entry);
    assert.match(row.minifiedSha256, /^[a-f0-9]{64}$/);
  }
}

export function inspectExecution(execution, context, directory, currentSource) {
  const failures = [];
  const check = (label, run) => {
    try {
      run();
    } catch (error) {
      failures.push(label + ': ' + errorText(error));
    }
  };
  const plan = commandPlan(context.group, context.expectedHead);
  check('execution identity', () => {
    assert.equal(execution?.schemaVersion, 1);
    for (const field of ['group', 'expectedHead', 'runId', 'runAttempt'])
      assert.equal(execution?.[field], context[field], field);
    assert.equal(execution?.status, 'completed');
    assert.deepEqual(execution?.errors, []);
    assert.match(execution?.node, /^v24\./);
    assert.equal(execution?.platform, 'linux');
    assert.ok(Number.isFinite(Date.parse(execution?.startedAt)));
    assert.ok(Date.parse(execution?.finishedAt) >= Date.parse(execution?.startedAt));
    assert.deepEqual(execution?.plan, plan);
  });
  check('source before and after', () => {
    for (const source of [execution?.sourceBefore, execution?.sourceAfter, currentSource]) {
      assert.equal(source?.head, context.expectedHead);
      assert.match(source?.tree, /^[a-f0-9]{40}$/);
      assert.equal(source?.status, '');
      assert.equal(source?.clean, true);
      assert.equal(source.tree, execution.sourceBefore.tree);
    }
  });
  const commands = Array.isArray(execution?.commands) ? execution.commands : [];
  check('complete command inventory', () => assert.equal(commands.length, plan.length));
  for (let index = 0; index < plan.length; index += 1) {
    const expected = plan[index];
    const actual = commands[index];
    check(expected.id, () => {
      assert.ok(actual, 'Command did not execute');
      for (const field of ['id', 'argv', 'stdout', 'stderr'])
        assert.deepEqual(actual[field], expected[field], field);
      assert.equal(actual.commandExitFile, expected.id + '.command-exit');
      assert.equal(actual.teeExitFile, expected.id + '.tee-exit');
      for (const field of ['commandExit', 'teeExit', 'pipelineExit'])
        assert.equal(actual[field], 0, field);
      assert.equal(actual.signal, null);
      assert.deepEqual(actual.errors, []);
      assert.ok(Number.isFinite(Date.parse(actual.startedAt)));
      assert.ok(Date.parse(actual.finishedAt) >= Date.parse(actual.startedAt));
      assert.equal(exitReceipt(directory, actual.commandExitFile), 0);
      assert.equal(exitReceipt(directory, actual.teeExitFile), 0);
      for (const field of ['stdout', 'stderr'])
        assert.deepEqual(actual[field + 'Evidence'], fileFacts(directory, expected[field]));
    });
  }
  check('executed toolchain versions', () => {
    assert.equal(
      readFileSync(join(directory, 'node-version.stdout.log'), 'utf8').trim(),
      execution.node
    );
    assert.equal(
      readFileSync(join(directory, 'pnpm-version.stdout.log'), 'utf8').trim(),
      '10.32.1'
    );
  });
  if (context.group === 'build')
    check('strict package budgets', () => {
      assertStrictBudgetReport(
        readJson(join(directory, 'package-budgets.json')),
        context.expectedHead,
        execution.sourceBefore.tree
      );
    });
  return failures;
}

function contextFor(group) {
  const context = {
    group,
    expectedHead: process.env.PROTO_UI_EXPECTED_HEAD_SHA,
    runId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT,
  };
  commandPlan(group, context.expectedHead);
  for (const field of ['runId', 'runAttempt']) assert.match(context[field], /^[1-9][0-9]*$/, field);
  return context;
}
function run(context, directory, root) {
  const execution = {
    schemaVersion: 1,
    ...context,
    eventSha: process.env.GITHUB_SHA,
    node: process.version,
    platform: process.platform,
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    plan: commandPlan(context.group, context.expectedHead),
    commands: [],
    errors: [],
    sourceBefore: null,
    sourceAfter: null,
  };
  const file = join(directory, 'execution.json');
  save(file, execution, { flag: 'wx' });
  try {
    assert.match(process.version, /^v24\./);
    assert.equal(process.platform, 'linux');
    execution.sourceBefore = captureSource(root);
    assert.equal(execution.sourceBefore.head, context.expectedHead);
    assert.equal(execution.sourceBefore.status, '');
    save(file, execution);
    for (const command of execution.plan) {
      const result = executeCommand(command, { root, directory });
      execution.commands.push(result);
      save(file, execution);
      assert.equal(result.pipelineExit, 0, command.id + ' pipeline');
      assert.equal(result.signal, null, command.id + ' signal');
      assert.deepEqual(result.errors, [], command.id + ' errors');
    }
  } catch (error) {
    execution.errors.push(errorText(error));
  } finally {
    try {
      execution.sourceAfter = captureSource(root);
    } catch (error) {
      execution.errors.push(errorText(error));
    }
    execution.status = 'completed';
    execution.finishedAt = new Date().toISOString();
    save(file, execution);
  }
  const failures = inspectExecution(execution, context, directory, execution.sourceAfter);
  if (failures.length) console.error(failures.join('\n'));
  return failures.length ? 1 : 0;
}
function finalize(context, directory, root) {
  const receipt = {
    schemaVersion: 1,
    ...context,
    eventSha: process.env.GITHUB_SHA,
    status: 'failed',
    timestamp: new Date().toISOString(),
    failures: [],
    checkoutOutcome: process.env.PUI_PUBLIC_CHECKOUT_OUTCOME,
    nodeOutcome: process.env.PUI_PUBLIC_NODE_OUTCOME,
    executionOutcome: process.env.PUI_PUBLIC_EXECUTION_OUTCOME,
  };
  for (const field of ['checkoutOutcome', 'nodeOutcome', 'executionOutcome'])
    if (receipt[field] !== 'success') receipt.failures.push(field + ': ' + String(receipt[field]));
  try {
    receipt.sourceAfter = captureSource(root);
  } catch (error) {
    receipt.failures.push('source after: ' + errorText(error));
  }
  try {
    receipt.execution = readJson(join(directory, 'execution.json'));
    receipt.failures.push(
      ...inspectExecution(receipt.execution, context, directory, receipt.sourceAfter)
    );
  } catch (error) {
    receipt.failures.push('execution evidence: ' + errorText(error));
  }
  receipt.status = receipt.failures.length ? 'failed' : 'passed';
  save(join(directory, 'manifest.json'), receipt);
  console.log(JSON.stringify(receipt, null, 2));
  return receipt.failures.length ? 1 : 0;
}

export function main(args) {
  assert.equal(args.length, 3, 'Use run|finalize <build|react|cli> <evidence-directory>');
  const [mode, group, evidence] = args;
  assert.ok(['run', 'finalize'].includes(mode), 'Unknown mode; execution is required');
  const root = process.cwd();
  const directory = resolve(evidence);
  const rel = relative(root, directory);
  assert.ok(rel.startsWith('..' + sep) || isAbsolute(rel), 'Evidence must be outside the checkout');
  mkdirSync(directory, { recursive: true });
  const context = contextFor(group);
  return mode === 'run' ? run(context, directory, root) : finalize(context, directory, root);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(errorText(error));
    process.exitCode = 1;
  }
}

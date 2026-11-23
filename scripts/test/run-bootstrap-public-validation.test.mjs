import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertStrictBudgetReport,
  captureSource,
  commandPlan,
  executeCommand,
  inspectExecution,
  main,
} from './run-bootstrap-public-validation.mjs';

const head = 'a'.repeat(40);
const tree = 'b'.repeat(40);
const time = '2026-11-23T00:00:00.000Z';
const source = { head, tree, status: '', clean: true };
const digest = (value) => createHash('sha256').update(value).digest('hex');
const entries = [
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
function budget() {
  return {
    schemaVersion: 2,
    policy: { mode: 'strict' },
    withinBudgets: true,
    exitCode: 0,
    source: {
      head,
      tree,
      expectedSha: head,
      workingTreeClean: true,
      measuredSourceMatchesHead: true,
      stableDuringMeasurement: true,
      requireClean: true,
      fileCount: 1,
      fingerprintSha256: 'c'.repeat(64),
    },
    results: entries.map((entry) => ({
      entry,
      pass: true,
      blocking: false,
      overBudgetBytes: 0,
      gzipBytes: 5,
      minifiedBytes: 10,
      budget: 20,
      minifiedSha256: 'd'.repeat(64),
    })),
  };
}
function temporary(t) {
  const directory = mkdtempSync(join(tmpdir(), 'pui-public-validation-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}
function fixture(t, group = 'react') {
  const directory = temporary(t);
  const context = { group, expectedHead: head, runId: '100', runAttempt: '1' };
  const plan = commandPlan(group, head);
  const execution = {
    schemaVersion: 1,
    ...context,
    status: 'completed',
    errors: [],
    node: 'v24.22.3',
    platform: 'linux',
    startedAt: time,
    finishedAt: time,
    plan,
    sourceBefore: { ...source },
    sourceAfter: { ...source },
    commands: [],
  };
  for (const command of plan) {
    const stdout =
      command.id === 'node-version'
        ? execution.node + '\n'
        : command.id === 'pnpm-version'
          ? '10.32.1\n'
          : command.id === 'strict-budgets'
            ? JSON.stringify(budget()) + '\n'
            : 'validator fixture only\n';
    writeFileSync(join(directory, command.stdout), stdout);
    writeFileSync(join(directory, command.stderr), '');
    const commandExitFile = command.id + '.command-exit';
    const teeExitFile = command.id + '.tee-exit';
    writeFileSync(join(directory, commandExitFile), '0\n');
    writeFileSync(join(directory, teeExitFile), '0\n');
    execution.commands.push({
      ...command,
      commandExitFile,
      teeExitFile,
      startedAt: time,
      finishedAt: time,
      commandExit: 0,
      teeExit: 0,
      pipelineExit: 0,
      signal: null,
      errors: [],
      stdoutEvidence: {
        file: command.stdout,
        bytes: Buffer.byteLength(stdout),
        sha256: digest(stdout),
      },
      stderrEvidence: { file: command.stderr, bytes: 0, sha256: digest('') },
    });
  }
  return { directory, context, execution };
}
const inspect = (value, current = source) =>
  inspectExecution(value.execution, value.context, value.directory, current);

test('plans require full canonical commands and reject preparation or shortcut arguments', () => {
  const build = commandPlan('build', head);
  assert.deepEqual(
    build.slice(-4).map((command) => command.argv),
    [
      ['corepack', 'pnpm@10.32.1', 'build:packages'],
      ['corepack', 'pnpm@10.32.1', 'check:package-manifests'],
      ['corepack', 'pnpm@10.32.1', 'test:package-budget-policy'],
      [
        'node',
        'scripts/analysis/package-budgets.mjs',
        '--json',
        '--require-clean',
        '--expected-sha',
        head,
      ],
    ]
  );
  for (const group of ['react', 'cli']) {
    assert.deepEqual(commandPlan(group, head).at(-1).argv, [
      'corepack',
      'pnpm@10.32.1',
      '-s',
      'release:smoke:' + group,
    ]);
  }
  assert.throws(() => commandPlan('unknown', head));
  assert.throws(() => main(['prepare-only', 'cli', '/tmp/not-executed']));
  assert.throws(() => main(['run', 'cli', '/tmp/not-executed', '--no-build']));
});

test('accepts complete source-bound evidence for all three fixed groups', (t) => {
  for (const group of ['build', 'react', 'cli'])
    assert.deepEqual(inspect(fixture(t, group)), [], group);
});

test('rejects missing commands, prepared-only records, changed argv and abnormal exits', (t) => {
  for (const mutate of [
    (value) => value.execution.commands.pop(),
    (value) => {
      value.execution.status = 'prepared-not-yet-executed';
    },
    (value) => {
      value.execution.commands.at(-1).argv = ['node', '--version'];
    },
    (value) => {
      value.execution.commands.at(-1).argv.push('--no-build');
    },
    (value) => {
      value.execution.commands.at(-1).commandExit = 7;
    },
    (value) => {
      value.execution.commands.at(-1).teeExit = 1;
    },
    (value) => {
      value.execution.commands.at(-1).pipelineExit = null;
      value.execution.commands.at(-1).signal = 'SIGTERM';
    },
  ]) {
    const value = fixture(t);
    mutate(value);
    assert.ok(inspect(value).length > 0);
  }
});

test('rejects source drift and receipts from another workflow attempt or group', (t) => {
  for (const mutate of [
    (value) => {
      value.execution.sourceBefore.head = 'c'.repeat(40);
    },
    (value) => {
      value.execution.sourceAfter.tree = 'c'.repeat(40);
    },
    (value) => {
      value.execution.sourceAfter.status = '?? extra.ts\n';
    },
    (value) => {
      value.execution.runAttempt = '2';
    },
    (value) => {
      value.execution.group = 'cli';
    },
  ]) {
    const value = fixture(t);
    mutate(value);
    assert.ok(inspect(value).length > 0);
  }
  assert.ok(inspect(fixture(t), { ...source, clean: false }).length > 0);
});

test('rejects missing logs, changed raw bytes and nonzero receipts despite success text', (t) => {
  for (const mutate of [
    (value) => rmSync(join(value.directory, value.execution.commands.at(-1).stdout)),
    (value) =>
      writeFileSync(join(value.directory, value.execution.commands.at(-1).stdout), 'PASS\n'),
    (value) =>
      writeFileSync(join(value.directory, value.execution.commands.at(-1).commandExitFile), '7\n'),
    (value) =>
      writeFileSync(join(value.directory, value.execution.commands.at(-1).teeExitFile), '1\n'),
  ]) {
    const value = fixture(t);
    mutate(value);
    assert.ok(inspect(value).length > 0);
  }
});

test('rejects advisory, incomplete, inconsistent and differently bound budget reports', () => {
  for (const mutate of [
    (report) => {
      report.policy.mode = 'finf-development-advisory';
    },
    (report) => report.results.pop(),
    (report) => {
      report.results[0].gzipBytes = report.results[0].budget + 1;
    },
    (report) => {
      report.results[0].minifiedSha256 = '';
    },
    (report) => {
      report.source.expectedSha = 'e'.repeat(40);
    },
    (report) => {
      report.source.requireClean = false;
    },
    (report) => {
      report.exitCode = 1;
    },
  ]) {
    const report = budget();
    mutate(report);
    assert.throws(() => assertStrictBudgetReport(report, head, tree));
  }
});

test('records real command failure independently from a successful tee and PASS stdout', (t) => {
  const directory = temporary(t);
  const command = {
    id: 'failure-probe',
    argv: [
      process.execPath,
      '-e',
      'process.stdout.write("PASS is only text\\n"); process.stderr.write("real stderr\\n"); process.exit(7)',
    ],
    stdout: 'probe.stdout.log',
    stderr: 'probe.stderr.log',
  };
  const record = executeCommand(command, { root: directory, directory });
  assert.equal(record.commandExit, 7);
  assert.equal(record.teeExit, 0);
  assert.equal(record.pipelineExit, 1);
  assert.equal(readFileSync(join(directory, command.stdout), 'utf8'), 'PASS is only text\n');
  assert.equal(readFileSync(join(directory, command.stderr), 'utf8'), 'real stderr\n');
});

test('records a real tee write failure even when the executed command returns zero', (t) => {
  const directory = temporary(t);
  const command = {
    id: 'tee-probe',
    argv: [process.execPath, '-e', 'process.stdout.write("actual stdout\\n")'],
    stdout: 'missing-parent/probe.stdout.log',
    stderr: 'probe.stderr.log',
  };
  const record = executeCommand(command, { root: directory, directory });
  assert.equal(record.commandExit, 0);
  assert.equal(record.teeExit, 1);
  assert.equal(record.pipelineExit, 1);
  assert.ok(record.errors.length > 0);
});

function repository(t) {
  const directory = temporary(t);
  const root = join(directory, 'repo');
  mkdirSync(root);
  const git = (...args) =>
    execFileSync('git', args, { cwd: root, stdio: 'pipe', encoding: 'utf8' });
  git('init', '-q');
  writeFileSync(join(root, 'source.txt'), 'fixture\n');
  git('add', 'source.txt');
  git(
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.test',
    'commit',
    '-qm',
    'fixture'
  );
  return { directory, root };
}

test('captures actual clean Git source and detects a new untracked source file', (t) => {
  const { root } = repository(t);
  const before = captureSource(root);
  assert.equal(before.clean, true);
  assert.match(before.head, /^[a-f0-9]{40}$/);
  writeFileSync(join(root, 'extra.txt'), 'untracked\n');
  const after = captureSource(root);
  assert.equal(after.head, before.head);
  assert.equal(after.clean, false);
  assert.match(after.status, /extra\.txt/);
});

test('always finalization writes a failed manifest when execution never happened', (t) => {
  const { directory, root } = repository(t);
  const evidence = join(directory, 'evidence');
  const actualHead = captureSource(root).head;
  const script = fileURLToPath(new URL('./run-bootstrap-public-validation.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script, 'finalize', 'cli', evidence], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PROTO_UI_EXPECTED_HEAD_SHA: actualHead,
      GITHUB_RUN_ID: '100',
      GITHUB_RUN_ATTEMPT: '1',
      PUI_PUBLIC_CHECKOUT_OUTCOME: 'success',
      PUI_PUBLIC_NODE_OUTCOME: 'success',
      PUI_PUBLIC_EXECUTION_OUTCOME: 'skipped',
    },
  });
  assert.equal(result.status, 1, result.stderr);
  const receipt = JSON.parse(readFileSync(join(evidence, 'manifest.json'), 'utf8'));
  assert.equal(receipt.status, 'failed');
  assert.equal(receipt.sourceAfter.head, actualHead);
  assert.ok(receipt.failures.some((message) => message.includes('executionOutcome: skipped')));
  assert.ok(receipt.failures.some((message) => message.includes('execution evidence:')));
});

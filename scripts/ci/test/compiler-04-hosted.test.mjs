import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  assertExactSource,
  copyConsumerSources,
  validateExecution,
  validateNodeEvents,
  validatePublicBuild,
  validateWorkflowSteps,
} from '../compiler-04-hosted.mjs';

const reporter = fileURLToPath(new URL('../compiler-04-hosted.mjs', import.meta.url));
function temporary(t) {
  const directory = mkdtempSync(path.join(tmpdir(), 'compiler-04-receipt-control-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}
function nodeObservation(t, second) {
  const root = temporary(t);
  const files = ['first.node-test.mjs', 'second.node-test.mjs'];
  writeFileSync(
    path.join(root, files[0]),
    "import test from 'node:test'; test('first actual case', () => {});\n"
  );
  writeFileSync(path.join(root, files[1]), second);
  const env = { ...process.env };
  // These controls start an independent runner, not another IPC worker of this one.
  delete env.NODE_TEST_CONTEXT;
  const outcome = spawnSync(process.execPath, ['--test', `--test-reporter=${reporter}`, ...files], {
    cwd: root,
    env,
    encoding: 'utf8',
  });
  assert.ifError(outcome.error);
  assert.ok(outcome.stdout.trim(), outcome.stderr || 'Node emitted no structured events');
  const events = outcome.stdout.trim().split('\n').map(JSON.parse);
  return { root, files, events, exitCode: outcome.status };
}

test('actual Node terminal events account for both original selected files', (t) => {
  const observation = nodeObservation(
    t,
    "import test from 'node:test'; test('second actual case', () => {});\n"
  );
  assert.equal(observation.exitCode, 0);
  const result = validateNodeEvents(observation.events, observation.files, observation.root);
  assert.equal(result.counts.tests, 2);
  assert.equal(result.counts.passed, 2);
  assert.equal(result.files.length, 2);
});

test('an actual skipped case cannot pass even when Node exits zero', (t) => {
  const observation = nodeObservation(
    t,
    "import test from 'node:test'; test('previous peer unavailable', t => t.skip('missing historical peer'));\n"
  );
  assert.equal(observation.exitCode, 0);
  assert.throws(() => validateNodeEvents(observation.events, observation.files, observation.root));
});

test('an actual failing case remains a failing receipt', (t) => {
  const observation = nodeObservation(
    t,
    "import test from 'node:test'; test('failed consumer', () => { throw new Error('original failure'); });\n"
  );
  assert.equal(observation.exitCode, 1);
  assert.ok(
    observation.events.some(
      (event) => event.type === 'test:fail' && event.data.details?.error?.message
    )
  );
  assert.throws(() => validateNodeEvents(observation.events, observation.files, observation.root));
});

test('missing, duplicated, foreign and truncated file summaries fail closed', (t) => {
  const observation = nodeObservation(
    t,
    "import test from 'node:test'; test('second actual case', () => {});\n"
  );
  const summary = observation.events.find(
    (event) => event.type === 'test:summary' && event.data.file
  );
  const without = observation.events.filter((event) => event !== summary);
  assert.throws(() => validateNodeEvents(without, observation.files, observation.root));
  const duplicated = [...observation.events.slice(0, -1), summary, observation.events.at(-1)];
  assert.throws(() => validateNodeEvents(duplicated, observation.files, observation.root));
  const foreign = structuredClone(observation.events);
  foreign.find((event) => event.type === 'test:summary' && event.data.file).data.file = path.join(
    observation.root,
    'foreign.node-test.mjs'
  );
  assert.throws(() => validateNodeEvents(foreign, observation.files, observation.root));
  assert.throws(() =>
    validateNodeEvents(observation.events.slice(0, -1), observation.files, observation.root)
  );
});

test('an empty test file cannot substitute for a real consumer case', (t) => {
  const observation = nodeObservation(t, '// no registered cases\n');
  assert.equal(observation.exitCode, 0);
  assert.throws(() => validateNodeEvents(observation.events, observation.files, observation.root));
});

test('dirty, unbound and wrong source revisions are rejected', () => {
  const sha = 'a'.repeat(40);
  assertExactSource({ checkoutSha: sha, dirty: false }, sha);
  assert.throws(() => assertExactSource({ checkoutSha: sha, dirty: true }, sha));
  assert.throws(() => assertExactSource({ checkoutSha: 'b'.repeat(40), dirty: false }, sha));
  assert.throws(() => assertExactSource({ checkoutSha: sha, dirty: false }, 'main'));
});

test('stale, filtered, interrupted and differently bound process receipts fail closed', () => {
  const plan = {
    session: 'current-run',
    candidate: { checkoutSha: 'a'.repeat(40) },
    driver: { checkoutSha: 'b'.repeat(40) },
  };
  const args = ['--test', 'first.node-test.mjs', 'second.node-test.mjs'];
  const execution = {
    session: plan.session,
    candidateSha: plan.candidate.checkoutSha,
    driverSha: plan.driver.checkoutSha,
    executable: process.execPath,
    args,
    startedAt: '2026-11-26T00:00:00.000Z',
    finishedAt: '2026-11-26T00:00:01.000Z',
    exitCode: 0,
    signal: null,
    error: null,
  };
  validateExecution(execution, plan, args);
  for (const changed of [
    { session: 'old-run' },
    { candidateSha: 'c'.repeat(40) },
    { driverSha: 'c'.repeat(40) },
    { executable: '/different/node' },
    { args: args.slice(0, -1) },
    { args: [...args, '--test-name-pattern=one'] },
    { exitCode: 1 },
    { signal: 'SIGTERM' },
    { error: 'spawn failed' },
    { startedAt: 'invalid' },
    { finishedAt: '2026-11-25T00:00:00.000Z' },
  ])
    assert.throws(() => validateExecution({ ...execution, ...changed }, plan, args));
  const docsArgs = ['pnpm@10.32.1', '-s', 'docs:build'];
  const docs = { ...execution, executable: 'corepack', args: docsArgs };
  validateExecution(docs, plan, docsArgs, 'corepack');
  assert.throws(() => validateExecution(docs, plan, args));
  assert.throws(() => validateExecution({ ...docs, exitCode: 1 }, plan, docsArgs, 'corepack'));
});

test('complete compiler results cannot hide a missing, skipped or failed Website production build', () => {
  const steps = Object.fromEntries(
    [
      'source',
      'controls',
      'dependencies',
      'toolchain',
      'environment',
      'generator',
      'build',
      'compiler',
      'docs',
      'website',
    ].map((name) => [name, { outcome: 'success' }])
  );
  validateWorkflowSteps(steps);
  for (const name of ['docs', 'website']) {
    for (const outcome of ['failure', 'skipped', 'cancelled']) {
      assert.throws(() =>
        validateWorkflowSteps({
          ...steps,
          [name]: { outcome, conclusion: 'success' },
        })
      );
    }
    const missing = { ...steps };
    delete missing[name];
    assert.throws(() => validateWorkflowSteps(missing));
  }
});

test('the public build receipt requires the full ordered producer inventory', () => {
  const plan = { packageCount: 2, selectedCount: 2, packages: ['a', 'b'] };
  const result = {
    packageCount: 2,
    selectedCount: 2,
    results: [
      { name: 'a', files: 2, bytes: 10 },
      { name: 'b', files: 1, bytes: 5 },
    ],
  };
  validatePublicBuild(plan, result);
  assert.throws(() => validatePublicBuild({ ...plan, selectedCount: 1 }, result));
  assert.throws(() =>
    validatePublicBuild(plan, { ...result, results: result.results.slice(0, 1) })
  );
  assert.throws(() =>
    validatePublicBuild(plan, { ...result, results: [...result.results].reverse() })
  );
  assert.throws(() =>
    validatePublicBuild(plan, { ...result, results: [result.results[0], result.results[0]] })
  );
});

test('generated-source collection excludes dependency trees and refuses source symlinks', (t) => {
  const directory = temporary(t);
  const input = path.join(directory, 'generated');
  const output = path.join(directory, 'evidence');
  const outside = path.join(directory, 'outside');
  mkdirSync(input);
  mkdirSync(outside);
  writeFileSync(path.join(input, 'app.tsx'), 'export const value = 1;\n');
  writeFileSync(path.join(outside, 'private.ts'), 'must not enter the artifact');
  symlinkSync(outside, path.join(input, 'node_modules'), 'dir');
  const files = copyConsumerSources(input, output);
  assert.deepEqual(
    files.map((file) => file.path),
    ['app.tsx']
  );
  assert.equal(readFileSync(path.join(output, 'app.tsx'), 'utf8'), 'export const value = 1;\n');
  symlinkSync(path.join(outside, 'private.ts'), path.join(input, 'escape.ts'));
  assert.throws(() => copyConsumerSources(input, path.join(directory, 'rejected')), /symlink/);
});

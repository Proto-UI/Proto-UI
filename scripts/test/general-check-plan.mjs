// Pure command inventory shared by producers and the independent Tests gate.
import assert from 'node:assert/strict';

const pnpm = (id, args = []) => ({ id, args: ['pnpm@10.32.1', '-s', id, ...args] });

function rootCheckPlan(manifest) {
  const scripts = manifest.scripts.test.split(' && ').map((command) => {
    const match = /^corepack pnpm@10\.32\.1 -s ([\w:-]+)$/.exec(command);
    if (!match) throw new Error(`Unrecognized general gate command: ${command}`);
    return match[1];
  });
  if (scripts.filter((script) => script === 'test:runtime').length !== 1)
    throw new Error('The complete general plan must retain exactly one runtime phase');
  const runtime = manifest.scripts['test:runtime'].split(' && ');
  if (
    runtime.length !== 2 ||
    !/^node --test [\w./ -]+$/.test(runtime[0]) ||
    runtime[1] !== 'node scripts/test/run-runtime-tests.mjs'
  )
    throw new Error('Unrecognized runtime controls/execution boundary');
  const steps = scripts.flatMap((script) =>
    script === 'test:runtime'
      ? [
          {
            id: 'test:runtime:controls',
            executable: process.execPath,
            args: runtime[0].split(' ').slice(1),
          },
          {
            id: 'test:runtime:execute',
            executable: process.execPath,
            args: ['scripts/test/run-runtime-tests.mjs'],
          },
        ]
      : [pnpm(script)]
  );
  assert.equal(new Set(steps.map((step) => step.id)).size, steps.length, 'Duplicate root check');
  return steps;
}

export function generalCheckPlan(manifest, specBase) {
  if (!/^[a-f0-9]{40}$/.test(specBase ?? ''))
    throw new Error('Exact spec-authoring base is required');
  return [
    pnpm('check:spec-authoring', ['--', '--base', specBase]),
    pnpm('check:public-docs'),
    pnpm('build:packages'),
    ...rootCheckPlan(manifest),
  ];
}

export function generalJobPlan(manifest, job, specBase = null) {
  if (job === 'governance')
    return generalCheckPlan(manifest, specBase).filter(
      (step) => !step.id.startsWith('test:runtime:')
    );
  if (job !== 'general') throw new Error(`Unknown general CI job: ${job}`);
  return [
    // Both isolated worktrees need their own public package outputs. Do not
    // consume an unbound dist artifact from another job or earlier source.
    pnpm('build:packages'),
    {
      // The old docs:build generated these ignored inputs before Vitest.
      // General homepage fixtures directly read the generated token CSS.
      id: 'prepare:runtime-styles',
      args: ['pnpm@10.32.1', '--filter', 'apps-www', 'generate:proto-ui-style'],
    },
    ...rootCheckPlan(manifest).filter((step) => step.id.startsWith('test:runtime:')),
  ];
}

export function assertGeneralCheckEvidence(payload, job, manifest, specBase = null) {
  assert.equal(payload?.job, job, 'General check receipt belongs to another job');
  assert.equal(payload.specBase, job === 'governance' ? specBase : null, 'Spec base drift');
  const expected = generalJobPlan(manifest, job, specBase);
  assert.deepEqual(payload.steps, expected, 'General check plan must match the complete source');
  assert.equal(payload.sourceStable, true, 'General check source changed');
  assert.equal(payload.passed, true, 'General checks did not pass');
  assert.ok(Array.isArray(payload.results), 'Missing general check results');
  assert.deepEqual(
    payload.results.map(({ id, args, executable }) => ({
      id,
      args,
      ...(executable === undefined ? {} : { executable }),
    })),
    expected,
    'Every governed command must execute exactly once in its original order'
  );
  for (const result of payload.results) {
    assert.equal(result.passed, true, `General check failed: ${result.id}`);
    assert.equal(result.exitCode, 0, `General check exit: ${result.id}`);
    assert.equal(result.signal, null, `General check interrupted: ${result.id}`);
    assert.equal(result.error, undefined, `General check execution error: ${result.id}`);
    const start = Date.parse(result.startedAt);
    const end = Date.parse(result.finishedAt);
    assert.ok(Number.isFinite(start) && end >= start, `Missing check clocks: ${result.id}`);
    assert.equal(result.logFile, `${result.id.replaceAll(':', '-')}.log`, 'Wrong check log');
  }
}

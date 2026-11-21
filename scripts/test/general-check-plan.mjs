import assert from 'node:assert/strict';

export const GENERAL_CHECK_GROUPS = Object.freeze(['checks', 'runtime']);
const runtimeStep = 'test:runtime:execute';

export function generalCheckPlan(manifest, specBase) {
  if (!/^[a-f0-9]{40}$/.test(specBase ?? ''))
    throw new Error('Exact spec-authoring base is required');
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
  const pnpm = (id, args = []) => ({ id, args: ['pnpm@10.32.1', '-s', id, ...args] });
  return [
    pnpm('check:spec-authoring', ['--', '--base', specBase]),
    pnpm('check:public-docs'),
    // test:public-docs is already in the root chain; avoid executing it twice.
    ...scripts.flatMap((script) =>
      script === 'test:runtime'
        ? [
            {
              id: 'test:runtime:controls',
              executable: process.execPath,
              args: runtime[0].split(' ').slice(1),
            },
            {
              id: runtimeStep,
              executable: process.execPath,
              args: ['scripts/test/run-runtime-tests.mjs'],
            },
          ]
        : [pnpm(script)]
    ),
  ];
}

export function selectGeneralChecks(plan, group) {
  assert.ok(GENERAL_CHECK_GROUPS.includes(group), 'Unknown general check group');
  assert.equal(new Set(plan.map((step) => step.id)).size, plan.length, 'Duplicate general step');
  assert.equal(
    plan.filter((step) => step.id === runtimeStep).length,
    1,
    'The complete general plan requires exactly one runtime execution'
  );
  const selected = plan.filter((step) => (step.id === runtimeStep) === (group === 'runtime'));
  assert.ok(selected.length > 0, 'General check group cannot be empty');
  return selected;
}

/** Scheduling partitions never substitute for the original commands or results. */
export function assertGeneralCheckReports(checks, runtime, manifest) {
  assert.equal(checks?.specBase, runtime?.specBase, 'General spec-authoring base drift');
  const plan = generalCheckPlan(manifest, checks?.specBase);
  const executed = [];
  for (const [group, report] of [
    ['checks', checks],
    ['runtime', runtime],
  ]) {
    assert.equal(report?.schemaVersion, 1, 'Unsupported general check report');
    assert.equal(report.group, group, 'General check report belongs to another group');
    assert.equal(report.passed, true, `General ${group} checks did not pass`);
    assert.equal(report.sourceStable, true, 'General source changed during execution');
    assert.ok(Array.isArray(report.results), 'Missing general check results');
    const expected = selectGeneralChecks(plan, group);
    assert.deepEqual(
      report.results.map((result) => ({
        id: result.id,
        ...('executable' in result ? { executable: result.executable } : {}),
        args: result.args,
      })),
      expected,
      `General ${group} must execute its original commands exactly once`
    );
    for (const result of report.results) {
      assert.equal(result.passed, true, `General step failed: ${result.id}`);
      assert.equal(result.exitCode, 0, `General step exited unsuccessfully: ${result.id}`);
      assert.equal(result.signal, null, `General step was interrupted: ${result.id}`);
      assert.ok(!result.error, `General step execution failed: ${result.id}`);
      executed.push(result.id);
    }
  }
  assert.deepEqual(
    executed.sort(),
    plan.map((step) => step.id).sort(),
    'General group union must retain the complete original plan exactly once'
  );
}

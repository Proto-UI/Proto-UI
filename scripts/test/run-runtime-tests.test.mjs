import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { parse as parseYaml } from 'yaml';

import {
  BROWSER_SHARDS,
  BROWSER_SUITES,
  createRuntimeTestPlan,
  discoverBrowserSuites,
  validateBrowserTestPlan,
} from './runtime-test-plan.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));

describe('runtime test plan', () => {
  it('assigns every discovered browser suite to exactly one nonempty shard', () => {
    const discovered = discoverBrowserSuites(root);
    assert.deepEqual(validateBrowserTestPlan(discovered), BROWSER_SUITES);
    assert.equal(BROWSER_SHARDS.length, 4);
    assert.ok(BROWSER_SHARDS.every((shard) => shard.length > 0));
    assert.deepEqual([...BROWSER_SHARDS.flat()].sort(), [...discovered].sort());
  });

  it('rejects duplicate, missing, and unknown browser suite assignments', () => {
    assert.throws(
      () => validateBrowserTestPlan(['a.browser.test.ts'], [['a.browser.test.ts'], [], [], []]),
      /empty browser shard/i
    );
    assert.throws(
      () =>
        validateBrowserTestPlan(
          ['a.browser.test.ts'],
          [
            ['a.browser.test.ts'],
            ['a.browser.test.ts'],
            ['b.browser.test.ts'],
            ['c.browser.test.ts'],
          ]
        ),
      /duplicate browser suite/i
    );
    assert.throws(
      () =>
        validateBrowserTestPlan(
          ['a.browser.test.ts', 'unknown.browser.test.ts'],
          [
            ['a.browser.test.ts'],
            ['b.browser.test.ts'],
            ['c.browser.test.ts'],
            ['d.browser.test.ts'],
          ]
        ),
      /missing.*unknown/i
    );
  });

  it('preserves focused Vitest arguments without starting the documentation server', () => {
    assert.deepEqual(
      createRuntimeTestPlan(['--', 'packages/spec/fixtures/test/context-fixtures.test.ts']),
      [
        {
          label: 'focused Vitest arguments',
          needsServer: false,
          args: ['packages/spec/fixtures/test/context-fixtures.test.ts'],
        },
      ]
    );
  });

  it('isolates browser suites behind one shared documentation server in a full run', () => {
    assert.deepEqual(createRuntimeTestPlan([]), [
      {
        label: 'non-browser tests',
        needsServer: false,
        args: BROWSER_SUITES.flatMap((suite) => ['--exclude', suite]),
      },
      {
        label: `all browser suites (${BROWSER_SUITES.length} files)`,
        needsServer: true,
        // Sequential, because every suite drives the same dev server.
        args: ['--no-file-parallelism', ...BROWSER_SUITES],
      },
    ]);
  });

  it('selects deterministic browser shards and rejects invalid scope input', () => {
    for (const [index, files] of BROWSER_SHARDS.entries()) {
      assert.deepEqual(createRuntimeTestPlan([], { scope: 'browser', shard: `${index + 1}/4` }), [
        {
          label: `browser shard ${index + 1}/4 (${files.length} files)`,
          needsServer: true,
          args: ['--no-file-parallelism', ...files],
        },
      ]);
    }
    assert.deepEqual(createRuntimeTestPlan([], { scope: 'non-browser' }), [
      {
        label: 'non-browser tests',
        needsServer: false,
        args: BROWSER_SUITES.flatMap((suite) => ['--exclude', suite]),
      },
    ]);
    for (const shard of [undefined, '0/4', '5/4', '1/3', 'one']) {
      assert.throws(() => createRuntimeTestPlan([], { scope: 'browser', shard }), /browser shard/i);
    }
    assert.throws(() => createRuntimeTestPlan([], { scope: 'unknown' }), /test scope/i);
    assert.throws(
      () => createRuntimeTestPlan(['some.test.ts'], { scope: 'non-browser' }),
      /focused.*scope/i
    );
  });

  it('keeps unit and browser jobs independent behind one aggregate test gate', () => {
    const workflow = parseYaml(
      readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8')
    );
    const jobs = workflow.jobs;
    assert.deepEqual(jobs.browser_test.strategy.matrix.shard, [1, 2, 3, 4]);
    assert.equal(jobs.browser_test.strategy['fail-fast'], false);
    assert.equal(jobs.test_unit.env.PROTO_UI_RUNTIME_TEST_SCOPE, 'non-browser');
    const browserStep = jobs.browser_test.steps.find((step) =>
      step.name?.startsWith('Run browser')
    );
    assert.equal(browserStep.env.PROTO_UI_RUNTIME_TEST_SCOPE, 'browser');
    assert.match(browserStep.env.PROTO_UI_RUNTIME_TEST_SHARD, /matrix\.shard.*\/4/);
    assert.match(browserStep.run, /test:runtime/);
    assert.deepEqual(jobs.test.needs, ['test_unit', 'browser_test']);
    assert.match(String(jobs.test.if), /always/);
    const aggregate = jobs.test.steps.map((step) => step.run ?? '').join('\n');
    assert.match(aggregate, /UNIT_RESULT/);
    assert.match(aggregate, /BROWSER_RESULT/);
  });
});

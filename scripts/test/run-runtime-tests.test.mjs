import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BROWSER_SUITES, createRuntimeTestPlan } from './runtime-test-plan.mjs';

describe('runtime test plan', () => {
  it('preserves focused Vitest arguments without starting the documentation server', () => {
    assert.deepEqual(
      createRuntimeTestPlan(['--', 'packages/spec/fixtures/test/context-fixtures.test.ts']),
      [
        {
          needsServer: false,
          args: ['packages/spec/fixtures/test/context-fixtures.test.ts'],
        },
      ]
    );
  });

  it('isolates browser suites behind one shared documentation server in a full run', () => {
    assert.deepEqual(createRuntimeTestPlan([]), [
      {
        needsServer: false,
        args: [
          '--minWorkers=1',
          '--maxWorkers=4',
          ...BROWSER_SUITES.flatMap((suite) => ['--exclude', suite]),
        ],
      },
      {
        needsServer: true,
        // Sequential, because every suite drives the same dev server.
        args: ['--no-file-parallelism', ...BROWSER_SUITES],
      },
    ]);
  });
});

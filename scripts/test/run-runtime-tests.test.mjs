import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { describe, it } from 'node:test';

import { BROWSER_SUITES, createRuntimeTestPlan } from './runtime-test-plan.mjs';

describe('runtime test plan', () => {
  it('keeps every Shadow split browser suite out of the parallel unit phase', () => {
    const directory = 'apps/www/src/content/docs/zh-cn/';
    const shadowSuites = readdirSync(new URL(`../../${directory}`, import.meta.url))
      .filter((name) => /^demo-shadow-split-.+\.browser\.test\.ts$/.test(name))
      .map((name) => `${directory}${name}`);
    assert.ok(shadowSuites.length >= 5);
    for (const suite of shadowSuites)
      assert.ok(BROWSER_SUITES.includes(suite), `Missing shared-server registration: ${suite}`);
  });
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
        args: BROWSER_SUITES.flatMap((suite) => ['--exclude', suite]),
      },
      {
        needsServer: true,
        // Sequential, because every suite drives the same dev server.
        args: ['--no-file-parallelism', ...BROWSER_SUITES],
      },
    ]);
  });
});

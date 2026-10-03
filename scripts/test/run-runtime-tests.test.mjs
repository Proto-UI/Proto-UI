import assert from 'node:assert/strict';
import { globSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { BROWSER_SUITES, createRuntimeTestPlan } from './runtime-test-plan.mjs';

it('registers every discovered browser suite exactly once in the sequential phase', () => {
  // Mirror the runtime Vitest include roots, retaining newly added browser suites.
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const discovered = globSync(
    [
      'packages/**/*.browser.test.ts',
      'internal/contracts/__tests__/**/*.browser.test.ts',
      'apps/**/test/**/*.browser.test.ts',
      'apps/www/src/**/*.browser.test.ts',
    ],
    { cwd: root, exclude: ['**/node_modules/**', '**/dist/**'] }
  ).map((suite) => suite.replaceAll('\\', '/'));
  assert.deepEqual([...BROWSER_SUITES].sort(), [...new Set(discovered)].sort());
  const [general, browser] = createRuntimeTestPlan([]);
  assert.equal(browser.needsServer, true);
  assert.ok(browser.args.includes('--no-file-parallelism'));
  for (const suite of discovered) {
    assert.equal(general.args.filter((arg) => arg === suite).length, 1);
    assert.equal(general.args[general.args.indexOf(suite) - 1], '--exclude');
    assert.equal(browser.args.filter((arg) => arg === suite).length, 1);
  }
});

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
it('runs the Brutalist Spinner only in the shared sequential browser phase', () => {
  const spinner = 'apps/www/src/content/docs/zh-cn/demo-brutalist-spinner.browser.test.ts';
  const plan = createRuntimeTestPlan([]);
  assert.equal(BROWSER_SUITES.filter((suite) => suite === spinner).length, 1);
  assert.equal(plan[0].args[plan[0].args.indexOf(spinner) - 1], '--exclude');
  assert.equal(plan[1].needsServer, true);
  assert.ok(plan[1].args.includes('--no-file-parallelism'));
  assert.equal(plan[1].args.filter((suite) => suite === spinner).length, 1);
});

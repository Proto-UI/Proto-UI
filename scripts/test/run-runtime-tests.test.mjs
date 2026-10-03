import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BROWSER_SUITES, createRuntimeTestPlan, READY_ROUTES } from './runtime-test-plan.mjs';

describe('runtime test plan', () => {
  it('warms both Table locales before shared-server browser navigation', () => {
    for (const route of ['/en/ui-libraries/base/table/', '/zh-cn/ui-libraries/base/table/']) {
      assert.ok(READY_ROUTES.includes(route), `Missing readiness route: ${route}`);
    }
  });
  it('runs both Table browser suites in the sequential shared-server bucket', () => {
    for (const suite of [
      'apps/www/src/content/docs/zh-cn/demo-base-table.browser.test.ts',
      'apps/www/src/content/docs/zh-cn/table-react19.browser.test.ts',
    ])
      assert.ok(BROWSER_SUITES.includes(suite), suite);
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

it('runs the Brutalist Spinner only in the shared sequential browser phase', () => {
  const spinner = 'apps/www/src/content/docs/zh-cn/demo-brutalist-spinner.browser.test.ts';
  const plan = createRuntimeTestPlan([]);
  assert.equal(BROWSER_SUITES.filter((suite) => suite === spinner).length, 1);
  assert.equal(plan[0].args[plan[0].args.indexOf(spinner) - 1], '--exclude');
  assert.equal(plan[1].needsServer, true);
  assert.ok(plan[1].args.includes('--no-file-parallelism'));
  assert.equal(plan[1].args.filter((suite) => suite === spinner).length, 1);
});

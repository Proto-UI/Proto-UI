import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
  BROWSER_SUITES,
  corepackCliCandidates,
  createRuntimeTestPlan,
  resolveCorepackCli,
} from './runtime-test-plan.mjs';

describe('runtime test plan', () => {
  it('resolves both Windows-style and Unix-style bundled Corepack layouts', () => {
    const candidates = corepackCliCandidates(process.execPath);
    assert.equal(
      resolveCorepackCli(process.execPath, (entry) => entry === candidates[0]),
      candidates[0]
    );
    assert.equal(
      resolveCorepackCli(process.execPath, (entry) => entry === candidates[1]),
      candidates[1]
    );
    assert.throws(
      () => resolveCorepackCli(process.execPath, () => false),
      /Unable to locate Corepack/
    );
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

  it('shares one documentation server for a broad filter that can select browser suites', () => {
    for (const filter of [
      'apps/www/src/content/docs/zh-cn',
      './apps/www/src/content/docs/zh-cn',
      path.resolve('apps/www/src/content/docs/zh-cn'),
    ]) {
      assert.deepEqual(createRuntimeTestPlan([filter]), [
        {
          needsServer: true,
          args: ['--no-file-parallelism', filter],
        },
      ]);
    }
  });

  it('detects a broad browser filter after Vitest options', () => {
    const args = ['scripts', '--reporter=dot', 'apps/www/src/content/docs/zh-cn'];
    assert.deepEqual(createRuntimeTestPlan(args), [
      {
        needsServer: true,
        args: ['--no-file-parallelism', ...args],
      },
    ]);
  });

  it('keeps browser suites isolated when only Vitest options are forwarded', () => {
    assert.deepEqual(createRuntimeTestPlan(['--reporter=dot']), [
      {
        needsServer: true,
        args: ['--no-file-parallelism', '--reporter=dot'],
      },
    ]);
  });

  it('isolates browser suites behind one shared documentation server in a full run', () => {
    assert.deepEqual(createRuntimeTestPlan([]), [
      {
        needsServer: false,
        args: [
          '--minWorkers=1',
          '--maxWorkers=2',
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

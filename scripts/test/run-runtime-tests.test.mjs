import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { corepackCliCandidates, resolveCorepackCli } from './corepack-cli-path.mjs';
import { BROWSER_SUITES, createRuntimeTestPlan } from './runtime-test-plan.mjs';

describe('Corepack CLI resolution', () => {
  it('selects the Node-adjacent Windows layout when it exists', () => {
    const execPath = String.raw`C:\Program Files\nodejs\node.exe`;
    const candidates = corepackCliCandidates(execPath, 'win32');
    assert.deepEqual(candidates, [
      String.raw`C:\Program Files\nodejs\node_modules\corepack\dist\corepack.js`,
      String.raw`C:\Program Files\lib\node_modules\corepack\dist\corepack.js`,
    ]);
    assert.equal(
      resolveCorepackCli(execPath, {
        platform: 'win32',
        fileExists: (candidate) => candidate === candidates[0],
      }),
      candidates[0]
    );
  });

  it('falls back to the GitHub Actions Unix toolcache layout', () => {
    const execPath = '/opt/hostedtoolcache/node/22.22.1/x64/bin/node';
    const candidates = corepackCliCandidates(execPath, 'linux');
    assert.deepEqual(candidates, [
      '/opt/hostedtoolcache/node/22.22.1/x64/bin/node_modules/corepack/dist/corepack.js',
      '/opt/hostedtoolcache/node/22.22.1/x64/lib/node_modules/corepack/dist/corepack.js',
    ]);
    assert.equal(
      resolveCorepackCli(execPath, {
        platform: 'linux',
        fileExists: (candidate) => candidate === candidates[1],
      }),
      candidates[1]
    );
  });

  it('reports every attempted layout when Corepack is unavailable', () => {
    assert.throws(
      () =>
        resolveCorepackCli('/usr/local/bin/node', {
          platform: 'linux',
          fileExists: () => false,
        }),
      /Unable to locate Corepack\. Tried:\n- \/usr\/local\/bin\/node_modules\/corepack\/dist\/corepack\.js\n- \/usr\/local\/lib\/node_modules\/corepack\/dist\/corepack\.js/
    );
  });
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

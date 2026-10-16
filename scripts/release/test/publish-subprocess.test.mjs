import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildPrerequisitePackages, ROOT_DIR, stagePackage } from '../lib.mjs';

const posixOnly = { skip: process.platform === 'win32' };

function nativeFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'proto-ui-release-subprocess-'));
  const previousPath = process.env.PATH;
  t.after(() => {
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
    rmSync(root, { recursive: true, force: true });
  });
  const bin = join(root, 'bin');
  mkdirSync(bin);
  symlinkSync(process.execPath, join(bin, 'node'));
  process.env.PATH = bin;

  const dir = join(root, 'package');
  mkdirSync(join(dir, 'dist'), { recursive: true });
  writeFileSync(join(dir, 'dist/index.js'), 'export const value = 42;\n');
  const pkg = {
    name: '@proto.ui/native-release-fixture',
    version: '0.0.0-native-test.0',
    dir,
    relDir: 'private-native-release-fixture',
    distExport: true,
    manifest: {
      name: '@proto.ui/native-release-fixture',
      type: 'module',
      scripts: { build: 'not executed by this fixture' },
      exports: { '.': './dist/index.js' },
    },
  };
  return {
    root,
    pkg,
    options: { outDir: join(root, 'stage'), version: pkg.version, dryRun: true },
    command(name, body) {
      writeFileSync(join(bin, name), `#!${process.execPath}\n${body}\n`, { mode: 0o700 });
    },
  };
}

test('missing prerequisite executable fails before release staging', posixOnly, (t) => {
  const fixture = nativeFixture(t);
  const [build] = buildPrerequisitePackages([fixture.pkg]);
  assert.notEqual(build.code, 0);
  assert.match(build.diagnostics.join('\n'), /ENOENT/);

  const outDir = join(fixture.root, 'must-not-stage');
  const result = spawnSync(
    process.execPath,
    [
      join(ROOT_DIR, 'scripts/release/publish.mjs'),
      '--dry-run',
      '--only',
      '@proto.ui/core',
      '--out-dir',
      outDir,
    ],
    { encoding: 'utf8', timeout: 10000 }
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /ENOENT/);
  assert.equal(existsSync(outDir), false);
});

test('a terminated prerequisite cannot report a successful build', posixOnly, (t) => {
  const fixture = nativeFixture(t);
  fixture.command('corepack', "process.kill(process.pid, 'SIGTERM');");

  const [build] = buildPrerequisitePackages([fixture.pkg]);
  assert.notEqual(build.code, 0);
  assert.match(build.diagnostics.join('\n'), /SIGTERM/);
});

test('missing npm executable rejects the staged publication', posixOnly, (t) => {
  const fixture = nativeFixture(t);

  assert.throws(() => stagePackage(fixture.pkg, fixture.options), /ENOENT/);
});

test(
  'publication termination precedes dry-run exemptions and rate-limit retries',
  posixOnly,
  (t) => {
    const fixture = nativeFixture(t);
    const attempts = join(fixture.root, 'attempts');
    fixture.command(
      'npm',
      `import { appendFileSync, writeSync } from 'node:fs';
appendFileSync(${JSON.stringify(attempts)}, 'publish\\n');
writeSync(2, 'cannot publish over the previously published versions; 429 rate limit\\n');
process.kill(process.pid, 'SIGTERM');`
    );

    assert.throws(
      () =>
        stagePackage(fixture.pkg, {
          ...fixture.options,
          maxPublishRetries: 2,
          retryDelayMs: 0,
        }),
      /SIGTERM/
    );
    assert.equal(readFileSync(attempts, 'utf8'), 'publish\n');
  }
);

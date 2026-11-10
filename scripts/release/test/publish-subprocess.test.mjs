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

for (const code of [0, 7]) {
  test(`a prerequisite retains its normal exit ${code}`, posixOnly, (t) => {
    const fixture = nativeFixture(t);
    fixture.command('corepack', `process.exit(${code});`);

    const [build] = buildPrerequisitePackages([fixture.pkg]);
    assert.equal(build.code, code);
    assert.deepEqual(build.diagnostics, []);
  });
}

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

test('a normal zero publication exit completes exactly one owned child', posixOnly, (t) => {
  const fixture = nativeFixture(t);
  const attempts = join(fixture.root, 'attempts');
  fixture.command(
    'npm',
    `import { appendFileSync } from 'node:fs';
appendFileSync(${JSON.stringify(attempts)}, JSON.stringify(process.argv.slice(2)) + '\\n');`
  );

  const result = stagePackage(fixture.pkg, fixture.options);
  assert.equal(result.publishResult.code, 0);
  assert.equal(result.publishResult.attempt, 1);
  assert.equal(result.publishResult.alreadyPublished, false);
  assert.deepEqual(JSON.parse(readFileSync(attempts, 'utf8')), [
    'publish',
    '--access',
    'public',
    '--tag',
    'latest',
    '--dry-run',
  ]);
});

test('a normal non-rate-limit failure does not retry', posixOnly, (t) => {
  const fixture = nativeFixture(t);
  const attempts = join(fixture.root, 'attempts');
  fixture.command(
    'npm',
    `import { appendFileSync } from 'node:fs';
appendFileSync(${JSON.stringify(attempts)}, 'publish\\n');
console.error('owned child exit 7');
process.exit(7);`
  );

  assert.throws(
    () => stagePackage(fixture.pkg, { ...fixture.options, retryDelayMs: 0 }),
    /owned child exit 7/
  );
  assert.equal(readFileSync(attempts, 'utf8'), 'publish\n');
});

for (const dryRun of [true, false]) {
  test(`the already-published exemption requires dry-run: ${dryRun}`, posixOnly, (t) => {
    const fixture = nativeFixture(t);
    const attempts = join(fixture.root, 'attempts');
    // The only npm in PATH is this owned Node child, including when selecting
    // the real-publication branch. No registry client is available to execute.
    fixture.command(
      'npm',
      `import { appendFileSync } from 'node:fs';
appendFileSync(${JSON.stringify(attempts)}, JSON.stringify(process.argv.slice(2)) + '\\n');
console.error('cannot publish over the previously published versions');
process.exit(7);`
    );
    const options = { ...fixture.options, dryRun, publish: !dryRun, retryDelayMs: 0 };

    if (dryRun) {
      const result = stagePackage(fixture.pkg, options);
      assert.equal(result.publishResult.code, 0);
      assert.equal(result.publishResult.alreadyPublished, true);
      assert.equal(result.publishResult.attempt, 1);
    } else {
      assert.throws(() => stagePackage(fixture.pkg, options), /npm publish failed/);
    }
    const args = JSON.parse(readFileSync(attempts, 'utf8'));
    assert.equal(args.includes('--dry-run'), dryRun);
  });
}

test('a normal rate-limit failure can recover on its next owned child', posixOnly, (t) => {
  const fixture = nativeFixture(t);
  const attempts = join(fixture.root, 'attempts');
  fixture.command(
    'npm',
    `import { appendFileSync, existsSync } from 'node:fs';
const first = !existsSync(${JSON.stringify(attempts)});
appendFileSync(${JSON.stringify(attempts)}, 'publish\\n');
if (first) {
  console.error('429 rate limit');
  process.exit(1);
}`
  );

  const result = stagePackage(fixture.pkg, { ...fixture.options, retryDelayMs: 0 });
  assert.equal(result.publishResult.code, 0);
  assert.equal(result.publishResult.attempt, 2);
  assert.equal(readFileSync(attempts, 'utf8'), 'publish\npublish\n');
});

test('normal rate-limit failures stop at the configured retry bound', posixOnly, (t) => {
  const fixture = nativeFixture(t);
  const attempts = join(fixture.root, 'attempts');
  fixture.command(
    'npm',
    `import { appendFileSync } from 'node:fs';
appendFileSync(${JSON.stringify(attempts)}, 'publish\\n');
console.error('429 rate limit');
process.exit(1);`
  );

  assert.throws(
    () =>
      stagePackage(fixture.pkg, {
        ...fixture.options,
        maxPublishRetries: 2,
        retryDelayMs: 0,
      }),
    /npm publish failed/
  );
  assert.equal(readFileSync(attempts, 'utf8'), 'publish\npublish\npublish\n');
});

for (const { args, error } of [
  { args: ['--publish', '--profile', 'launch'], error: /requires --profile workspace/ },
  { args: ['--publish', '--only', '@proto.ui/core'], error: /does not allow package-local/ },
  { args: ['--publish', '--tag', 'candidate'], error: /derives npm dist-tag/ },
  { args: ['--resume-published'], error: /only valid with --publish/ },
]) {
  test(`release guard rejects ${args.join(' ')} before staging`, posixOnly, (t) => {
    const fixture = nativeFixture(t);
    const outDir = join(fixture.root, 'must-not-stage');
    const result = spawnSync(
      process.execPath,
      [join(ROOT_DIR, 'scripts/release/publish.mjs'), ...args, '--out-dir', outDir],
      { encoding: 'utf8', timeout: 10000 }
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, error);
    assert.equal(existsSync(outDir), false);
  });
}

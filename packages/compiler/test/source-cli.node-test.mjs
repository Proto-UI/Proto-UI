import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const cli = fileURLToPath(new URL('../src/cli-entry.mjs', import.meta.url));
const badge = fileURLToPath(
  new URL('../../../internal/compiler/examples/readonly-badge.proto.ts.txt', import.meta.url)
);
const authoring = fileURLToPath(new URL('../prelude/authoring.d.ts', import.meta.url));

test('compile emits the selected disk source and preserves published output on unavailable paths', (t) => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'proto-source-cli-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const output = path.join(cwd, 'component.ts');
  const compile = (...args) =>
    spawnSync(process.execPath, [cli, 'compile', badge, ...args], { cwd, encoding: 'utf8' });
  const selected = ['--export', 'default', '--name', 'TransportBadge'];

  const printed = compile('--target', 'react', ...selected);
  assert.equal(printed.status, 0, printed.stderr);
  assert.equal(printed.stderr, '');
  const module = ts.createSourceFile(output, printed.stdout, ts.ScriptTarget.ESNext, true);
  const publicNames = module.statements
    .filter(ts.isExportDeclaration)
    .flatMap(({ exportClause }) =>
      exportClause && ts.isNamedExports(exportClause)
        ? exportClause.elements.map((item) => item.name.text)
        : []
    );
  assert.ok(publicNames.includes('TransportBadge'));

  writeFileSync(output, 'previous generation\n');
  const written = compile('--target', 'react', ...selected, '--out', output);
  assert.equal(written.status, 0, written.stderr);
  assert.equal(written.stdout, '');
  assert.equal(readFileSync(output, 'utf8'), printed.stdout);

  for (const target of ['vue2', 'vue3', 'web-components']) {
    const missing = compile('--target', target, '--out', output);
    assert.equal(missing.status, 2, missing.stderr);
    assert.match(missing.stderr, /backend-missing/);
    assert.ok(missing.stderr.includes(target));
    assert.equal(missing.stdout, '');
    assert.equal(readFileSync(output, 'utf8'), printed.stdout);
  }

  // Equal declaration bytes at a different resolved module do not grant authoring authority.
  copyFileSync(authoring, path.join(cwd, 'alternate.d.ts'));
  const callerProject = 'tsconfig.json';
  for (const pattern of ['@proto.ui/core/authoring', '@proto.ui/*']) {
    writeFileSync(
      path.join(cwd, callerProject),
      JSON.stringify({
        compilerOptions: { paths: { [pattern]: ['./alternate.d.ts'] } },
      })
    );
    const unavailable = compile('--target', 'react', '--project', callerProject, '--out', output);
    assert.equal(unavailable.status, 2, unavailable.stderr);
    assert.match(unavailable.stderr, /compiler-missing/);
    assert.match(unavailable.stderr, /producer\/authoring-origin/);
    assert.equal(unavailable.stdout, '');
    assert.equal(readFileSync(output, 'utf8'), printed.stdout);
  }

  // Automatic discovery starts at the Badge source even with a conflicting caller tsconfig.
  const nearest = compile('--target', 'react', ...selected);
  assert.equal(nearest.status, 0, nearest.stderr);
  assert.equal(nearest.stderr, '');
  assert.equal(nearest.stdout, printed.stdout);

  const directory = path.join(cwd, 'existing-directory');
  mkdirSync(directory);
  const before = readdirSync(cwd).sort();
  const rejectedWrite = compile('--target', 'react', '--out', directory);
  assert.equal(rejectedWrite.status, 1, rejectedWrite.stderr);
  assert.equal(rejectedWrite.stdout, '');
  assert.deepEqual(readdirSync(cwd).sort(), before);
  assert.equal(readFileSync(output, 'utf8'), printed.stdout);
});

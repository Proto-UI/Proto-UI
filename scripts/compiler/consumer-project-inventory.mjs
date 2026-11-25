/** Read-only admission of real consumer sources through one installed AST compiler. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { programSourceBinding, verifyProgramSourceBinding } from './current-api.mjs';
import { classifyResult } from './library-profile-inventory.mjs';

const options = new Map();
const selected = [];
for (let index = 2; index < process.argv.length; index++) {
  const key = process.argv[index],
    value = process.argv[++index];
  assert.ok(
    ['--compiler', '--consumer-root', '--name', '--target', '--entry', '--out'].includes(key) &&
      value,
    'Unknown or incomplete option: ' + key
  );
  if (key === '--entry') selected.push(value);
  else {
    assert.ok(!options.has(key), 'Duplicate option: ' + key);
    options.set(key, value);
  }
}
for (const key of ['--compiler', '--consumer-root', '--name', '--target', '--out'])
  assert.ok(options.has(key), 'Missing ' + key);
const compilerEntry = path.resolve(options.get('--compiler'));
const compilerRoot = path.dirname(compilerEntry);
const root = path.resolve(options.get('--consumer-root'));
const target = options.get('--target');
const output = path.resolve(options.get('--out'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const git = (...args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const identity = () => ({
  revision: git('rev-parse', 'HEAD').trim(),
  status: git('status', '--porcelain'),
});
const packageIdentity = JSON.parse(
  readFileSync(path.join(compilerRoot, 'compiler-build.json'), 'utf8')
);
assert.equal(packageIdentity.schema, 'proto-ui.compiler-package.v3');
const verifyPackage = () => {
  for (const file of packageIdentity.files) {
    const bytes = readFileSync(path.join(compilerRoot, file.path));
    assert.equal(bytes.length, file.bytes);
    assert.equal(hash(bytes), file.sha256, 'Installed compiler file changed: ' + file.path);
  }
};
verifyPackage();
const before = identity();
const entries = selected.length
  ? selected
  : git('ls-files', '-z', '--', '*.proto.ts').split('\0').filter(Boolean);
assert.ok(entries.length > 0, 'The consumer has no selected authored .proto.ts entries');
assert.equal(new Set(entries).size, entries.length, 'Duplicate source entry');
const sources = entries.map((entry) => {
  const file = path.resolve(root, entry);
  const relative = path.relative(root, file);
  assert.ok(
    relative !== '..' && !relative.startsWith('../') && !path.isAbsolute(relative),
    'Entry escapes consumer'
  );
  const bytes = readFileSync(file);
  return { path: relative, bytes: bytes.length, sha256: hash(bytes) };
});
assert.equal(
  new Set(sources.map((file) => file.path)).size,
  sources.length,
  'Duplicate canonical source entry'
);
const api = await import(pathToFileURL(compilerEntry).href);
assert.ok(
  api.COMPONENT_TARGETS.includes(target),
  'Select a current component target; this tool never aliases a retired profile'
);
const compiler = api.createCompiler({ rootDir: root });
const sourceInputs = programSourceBinding(compiler.session.ensureFiles(entries));
const result = compiler.inventoryProject(entries, { target });
verifyProgramSourceBinding(sourceInputs);
for (const file of sources)
  assert.equal(
    hash(readFileSync(path.join(root, file.path))),
    file.sha256,
    'Authored source changed during inventory'
  );
assert.deepEqual(identity(), before, 'Consumer checkout changed during inventory');
verifyPackage();
const compilerFailures = result.ok
  ? result.value.files
      .filter(
        (file) =>
          file.status !== 'emitted' &&
          file.status !== 'hook-analysis' &&
          classifyResult({ ok: false, diagnostics: file.diagnostics }).status === 'FAIL'
      )
      .map((file) => ({ sourceFile: file.sourceFile, diagnostics: file.diagnostics }))
  : [];
const report = {
  schema: 'proto-ui.consumer-project-inventory.v1',
  consumer: { name: options.get('--name'), root, ...before, entries: sources, sourceInputs },
  compilerBuild: packageIdentity,
  compilerFailures,
  target,
  result,
  scope:
    'Current, unmodified consumer source admission only. Every selected file remains in the denominator. Emission is not a real-application migration, target build, browser/native execution or full acceptance.',
  executionVerifiedPrototypes: 0,
  applicationMigrationVerified: false,
};
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(
  JSON.stringify({
    output,
    sha256: hash(readFileSync(output)),
    totals: result.ok ? result.value.totals : null,
    applicationMigrationVerified: false,
  })
);
if (!result.ok || result.value.totals.sourceErrorFiles > 0 || compilerFailures.length > 0)
  process.exitCode = 1;

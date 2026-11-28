import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readdir, readFile, realpath, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const kind = 'mobile-interaction-prepared-inputs';
const generatedFiles = [
  'apps/www/src/generated/cli-init.generated.json',
  'apps/www/src/styles/shadcn-theme.css',
  'apps/www/src/styles/proto-ui-tokens.generated.css',
  'apps/www/src/styles/proto-ui-shadow-style.generated.js',
  'apps/www/src/styles/proto-ui-shadow-style.generated.d.ts',
  'apps/www/src/styles/proto-ui-style.css',
];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function filesBelow(root, relative) {
  const directory = path.join(root, relative);
  assert.ok((await lstat(directory)).isDirectory(), `Expected generated directory: ${relative}`);
  const files = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name)
  )) {
    const name = `${relative}/${entry.name}`;
    assert.ok(!entry.isSymbolicLink(), `Prepared inputs cannot contain symlinks: ${name}`);
    if (entry.isDirectory()) files.push(...(await filesBelow(root, name)));
    else {
      assert.ok(entry.isFile(), `Expected regular prepared input: ${name}`);
      files.push(name);
    }
  }
  return files;
}

async function fileFact(root, relative) {
  const file = path.join(root, relative);
  assert.equal(await realpath(file), file, `Prepared input cannot be an alias: ${relative}`);
  assert.ok((await lstat(file)).isFile(), `Expected regular prepared input: ${relative}`);
  const bytes = await readFile(file);
  return { file: relative, bytes: bytes.length, sha256: hash(bytes) };
}

async function sourceIdentity(root) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  assert.equal(
    git('status', '--porcelain', '--untracked-files=all'),
    '',
    'Prepared Mobile inputs require a clean checkout'
  );
  return {
    root: await realpath(root),
    head: git('rev-parse', 'HEAD'),
    tree: git('rev-parse', 'HEAD^{tree}'),
    node: process.version,
  };
}

async function outputs(root) {
  // CLI extraction builds this complete tree, not only its runtime entry. The
  // remaining six outputs are all persistent products of the four-stage script.
  const cli = await filesBelow(root, 'packages/cli/dist');
  assert.ok(cli.length > 0, 'Prepared CLI build cannot be empty');
  return Promise.all([...generatedFiles, ...cli].sort().map((file) => fileFact(root, file)));
}

async function inputSources(root) {
  // Git identity alone cannot bind ignored source files that the token scanner
  // might read. Bind every file in its two roots, excluding only its ignored
  // build/dependency directories. This is deliberately broader than token uses.
  const files = [];
  async function walk(relative) {
    for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
      if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
      const next = `${relative}/${entry.name}`;
      assert.ok(!entry.isSymbolicLink(), `Prepared style sources cannot be aliases: ${next}`);
      if (entry.isDirectory()) await walk(next);
      else {
        assert.ok(entry.isFile(), `Expected regular style source: ${next}`);
        files.push(next);
      }
    }
  }
  await walk('packages/prototypes');
  await walk('apps/www/src/prototypes');
  return Promise.all(files.sort().map((file) => fileFact(root, file)));
}

async function publish(file, value) {
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  await rename(temporary, file);
}

/** Only the Mobile workflow opts in; the normal shared harness still generates. */
export async function prepareMobileInputs({ root, receiptFile, expectedRevision, generate }) {
  root = await realpath(root);
  receiptFile = path.resolve(receiptFile);
  assert.ok(
    path.relative(root, receiptFile).startsWith(`..${path.sep}`),
    'Prepared receipt must live outside its checkout'
  );
  const source = await sourceIdentity(root);
  assert.equal(source.head, expectedRevision, 'Preparation revision differs');
  const inputs = await inputSources(root);
  const command = JSON.parse(await readFile(path.join(root, 'apps/www/package.json'), 'utf8'))
    .scripts['generate:proto-ui-style'];
  assert.ok(
    command.includes('generate-cli-init-docs.mjs'),
    'Candidate preparation must retain real CLI init extraction'
  );
  const receipt = {
    schemaVersion: 1,
    kind,
    status: 'preparing',
    source,
    command,
    startedAt: new Date().toISOString(),
    inputs,
    outputs: [],
    preparationMs: 0,
  };
  // Invalidate a previous successful-looking receipt before any generation. A
  // failed or interrupted command cannot authorize reuse of its old outputs.
  await publish(receiptFile, receipt);
  const started = performance.now();
  try {
    await generate();
    assert.deepEqual(await sourceIdentity(root), source, 'Source changed during preparation');
    assert.deepEqual(await inputSources(root), inputs, 'Style inputs changed during preparation');
    receipt.outputs = await outputs(root);
    receipt.status = 'prepared';
    receipt.preparationMs = performance.now() - started;
    receipt.completedAt = new Date().toISOString();
    await publish(receiptFile, receipt);
    return receipt;
  } catch (error) {
    receipt.status = 'failed';
    receipt.preparationMs = performance.now() - started;
    receipt.error = String(error);
    await publish(receiptFile, receipt);
    throw error;
  }
}

export async function verifyMobileInputs({ root, receiptFile, expectedRevision }) {
  root = await realpath(root);
  receiptFile = path.resolve(receiptFile);
  assert.equal(await realpath(receiptFile), receiptFile, 'Prepared receipt cannot be an alias');
  assert.ok((await lstat(receiptFile)).isFile(), 'Prepared receipt must be a regular file');
  const receipt = JSON.parse(await readFile(receiptFile, 'utf8'));
  assert.equal(receipt.schemaVersion, 1);
  assert.equal(receipt.kind, kind);
  assert.equal(receipt.status, 'prepared', 'Mobile preparation did not complete');
  assert.equal(receipt.source?.head, expectedRevision, 'Prepared revision differs');
  assert.deepEqual(
    await sourceIdentity(root),
    receipt.source,
    'Prepared checkout identity differs'
  );
  assert.deepEqual(await inputSources(root), receipt.inputs, 'Prepared style sources differ');
  assert.deepEqual(await outputs(root), receipt.outputs, 'Prepared generated outputs differ');
  assert.equal(
    JSON.parse(await readFile(path.join(root, 'apps/www/package.json'), 'utf8')).scripts[
      'generate:proto-ui-style'
    ],
    receipt.command,
    'Prepared command differs'
  );
  return receipt;
}

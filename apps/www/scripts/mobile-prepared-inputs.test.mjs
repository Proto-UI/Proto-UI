import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { prepareMobileInputs, verifyMobileInputs } from './mobile-prepared-inputs.mjs';

async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mobile-prepared-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'checkout');
  const receiptFile = path.join(directory, 'prepared.json');
  const sourceFiles = {
    '.gitignore':
      'packages/cli/dist/\napps/www/src/generated/\napps/www/src/styles/\n**/ignored-style.ts\n',
    'apps/www/package.json': JSON.stringify({
      scripts: {
        'generate:proto-ui-style':
          'node scripts/generate-cli-init-docs.mjs && theme && website-tokens && style',
      },
    }),
    'packages/prototypes/base/source.ts': 'export const source = 1;',
    'apps/www/src/prototypes/site/source.ts': 'export const source = 2;',
  };
  const outputs = [
    'packages/cli/dist/index.js',
    'packages/cli/dist/index.d.ts',
    'apps/www/src/generated/cli-init.generated.json',
    'apps/www/src/styles/shadcn-theme.css',
    'apps/www/src/styles/proto-ui-tokens.generated.css',
    'apps/www/src/styles/proto-ui-shadow-style.generated.js',
    'apps/www/src/styles/proto-ui-shadow-style.generated.d.ts',
    'apps/www/src/styles/proto-ui-style.css',
  ];
  const put = async (relative, bytes) => {
    await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
    await writeFile(path.join(root, relative), bytes);
  };
  for (const [relative, bytes] of Object.entries(sourceFiles)) await put(relative, bytes);
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git('init', '-q');
  git('add', '.');
  git(
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '-qm',
    'fixture'
  );
  const expectedRevision = git('rev-parse', 'HEAD');
  let generations = 0;
  const generate = async () => {
    generations++;
    for (const relative of outputs) await put(relative, `fixture generated ${relative}`);
  };
  const options = { root, receiptFile, expectedRevision };
  return { ...options, options, put, git, outputs, generate, generations: () => generations };
}

test('one successful preparation binds exact clean source and every output for both captures', async (t) => {
  const f = await fixture(t);
  const receipt = await prepareMobileInputs({ ...f.options, generate: f.generate });
  assert.equal(receipt.status, 'prepared');
  assert.equal(receipt.outputs.length, f.outputs.length);
  assert.ok(receipt.preparationMs >= 0);
  assert.deepEqual(await verifyMobileInputs(f.options), receipt);
  assert.deepEqual(await verifyMobileInputs(f.options), receipt);
  assert.equal(f.generations(), 1);
});

for (const [name, mutate] of [
  ['tracked source bytes', async (f) => f.put('packages/prototypes/base/source.ts', 'changed')],
  [
    'ignored style source addition',
    async (f) => f.put('apps/www/src/prototypes/site/ignored-style.ts', 'tw("changed")'),
  ],
  [
    'generated CSS bytes',
    async (f) => f.put('apps/www/src/styles/proto-ui-tokens.generated.css', 'wrong CSS'),
  ],
  [
    'CLI declaration bytes',
    async (f) => f.put('packages/cli/dist/index.d.ts', 'wrong declarations'),
  ],
  ['additional CLI output', async (f) => f.put('packages/cli/dist/extra.js', 'unexpected')],
  ['missing CLI output', async (f) => rm(path.join(f.root, 'packages/cli/dist/index.js'))],
  [
    'a generated output alias',
    async (f) => {
      await rm(path.join(f.root, 'packages/cli/dist/index.js'));
      await symlink('index.d.ts', path.join(f.root, 'packages/cli/dist/index.js'));
    },
  ],
])
  test(`rejects ${name} after preparation without regenerating behind the gate`, async (t) => {
    const f = await fixture(t);
    await prepareMobileInputs({ ...f.options, generate: f.generate });
    await mutate(f);
    await assert.rejects(verifyMobileInputs(f.options));
    assert.equal(f.generations(), 1);
  });

test('rejects an exact-tree checkout at another location and a wrong expected revision', async (t) => {
  const f = await fixture(t);
  await prepareMobileInputs({ ...f.options, generate: f.generate });
  await assert.rejects(
    verifyMobileInputs({ ...f.options, expectedRevision: '0'.repeat(40) }),
    /revision differs/
  );
  const receipt = JSON.parse(await readFile(f.receiptFile, 'utf8'));
  receipt.source.root += '-different';
  await writeFile(f.receiptFile, JSON.stringify(receipt));
  await assert.rejects(verifyMobileInputs(f.options), /identity differs/);
});

test('a generation failure invalidates an earlier good receipt even if old outputs remain', async (t) => {
  const f = await fixture(t);
  await prepareMobileInputs({ ...f.options, generate: f.generate });
  await assert.rejects(
    prepareMobileInputs({
      ...f.options,
      generate: async () => {
        throw new Error('real generator failed');
      },
    }),
    /real generator failed/
  );
  assert.equal(JSON.parse(await readFile(f.receiptFile, 'utf8')).status, 'failed');
  await assert.rejects(verifyMobileInputs(f.options), /did not complete/);
});

test('source changes during generation do not produce a reusable receipt', async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    prepareMobileInputs({
      ...f.options,
      generate: async () => {
        await f.generate();
        await f.put('packages/prototypes/base/source.ts', 'changed during generation');
      },
    })
  );
  assert.equal(JSON.parse(await readFile(f.receiptFile, 'utf8')).status, 'failed');
});

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runRepositoryDocsCheck } from '../check-repository-docs.mjs';
import { repositoryDocPolicy } from '../repository-doc-policy.mjs';

async function fixture(t, entries, overrides = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'repository-docs-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const files = {
    'package.json': JSON.stringify({ name: 'test-root', scripts: { check: 'node check.mjs' } }),
    'pnpm-workspace.yaml': 'packages:\n  - packages/*\n  - apps/*\n',
    'README.md': '# Test repository\n',
    ...entries,
  };
  for (const [file, content] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), content);
  }
  const policy = {
    ...repositoryDocPolicy,
    requiredEntrypoints: ['README.md'],
    localProjections: [],
    ...overrides,
  };
  return { root, check: () => runRepositoryDocsCheck({ root, files: Object.keys(files), policy }) };
}

test('actual Markdown links, image references and encoded paths fail when their local target disappears', async (t) => {
  const { root, check } = await fixture(t, {
    'README.md':
      '[Guide](<guide one.md> "A title")\n[Chinese][cn]\n![Diagram][image]\n\n[cn]: %E8%AF%B4%E6%98%8E.md#heading\n[image]: diagram.svg\n',
    'guide one.md': '# Guide\n',
    '说明.md': '# Heading\n',
    'diagram.svg': '<svg/>',
  });
  let report = await check();
  assert.deepEqual(report.errors, []);
  assert.equal(report.checkedLinks, 3);
  await fs.unlink(path.join(root, 'diagram.svg'));
  report = await check();
  assert.equal(report.errors.length, 1);
  assert.match(report.errors[0], /README\.md:3: local link diagram\.svg does not exist/);
});

test('code examples are not links and external URLs, site routes and heading fragments have explicit limits', async (t) => {
  const { check } = await fixture(t, {
    'README.md': [
      '`[not a link](missing-inline.md)`',
      '```md',
      '[not a link](missing-example.md)',
      '```',
      '[remote](https://example.invalid/missing)',
      '[site route](/en/route/)',
      '[heading](#heading)',
      '```js',
      'pnpm nonexistent-example',
      '```',
    ].join('\n'),
  });
  const report = await check();
  assert.deepEqual(report.errors, []);
  assert.equal(report.checkedLinks, 0);
  assert.equal(report.checkedCommands, 0);
  assert.equal(report.omittedLinks, 3);
});

test('missing entrypoints and new current documents fail while frozen records retain their original references', async (t) => {
  const { check } = await fixture(
    t,
    {
      'internal/records/2026-01-01-observation.md': '[historical file](gone.md)',
      'internal/records/README.md': '[current missing entry](gone.md)',
      'spec/versions/V-PUBLISHED.yaml':
        'type: version\nstatus: active\nrelease:\n  version: 1.0.0\n',
      'spec/versions/V-DRAFT.yaml': 'type: version\nstatus: draft\nrelease:\n  version: 1.1.0\n',
      'internal/releases/1.0.0/release-notes.md': '[release-time source](gone.md)',
      'internal/releases/1.1.0/release-notes.md': '[draft source](gone.md)',
      'new-directory/guide.md': '[new guide](gone.md)',
    },
    { requiredEntrypoints: ['README.md', 'docs/README.md'] }
  );
  const report = await check();
  assert.equal(report.errors.length, 4);
  assert.ok(
    report.errors.some((error) => /docs\/README\.md: required documentation entrypoint/.test(error))
  );
  assert.ok(report.errors.some((error) => /internal\/records\/README\.md/.test(error)));
  assert.ok(report.errors.some((error) => /internal\/releases\/1\.1\.0/.test(error)));
  assert.ok(report.errors.some((error) => /new-directory\/guide\.md/.test(error)));
  assert.equal(report.counts['historical-release'], 1);
  assert.equal(report.counts.historical, 1);
});

test('pnpm scripts resolve against package-local, filtered and explicit directory manifests', async (t) => {
  const { root, check } = await fixture(t, {
    'README.md': [
      '```sh',
      'corepack pnpm@10.32.1 check',
      'pnpm --filter @test/local run pack:draft',
      'pnpm -C packages/local pack:draft',
      'pnpm --dir=packages/local pack:draft',
      'pnpm --filter=@test/local pack:draft',
      'pnpm exec node -e "console.log(\'example && pnpm nonexistent\')"',
      '```',
    ].join('\n'),
    'packages/local/package.json': JSON.stringify({
      name: '@test/local',
      scripts: { 'pack:draft': 'node pack.mjs' },
    }),
    'packages/local/README.md': '`pnpm pack:draft` and `pnpm -w check`.',
    'packages/aaa/test/fixtures/package.json': JSON.stringify({ name: '@test/local', scripts: {} }),
  });
  let report = await check();
  assert.deepEqual(report.errors, []);
  assert.equal(report.checkedCommands, 7);
  await fs.writeFile(
    path.join(root, 'packages/local/package.json'),
    JSON.stringify({ name: '@test/local', scripts: {} })
  );
  report = await check();
  assert.equal(report.errors.length, 5);
  assert.ok(
    report.errors.every((error) => /pack:draft.*packages\/local\/package\.json/.test(error))
  );
  assert.equal(report.errors.filter((error) => /is absent from/.test(error)).length, 1);
  assert.equal(
    report.errors.filter((error) => /is not a declared script in/.test(error)).length,
    4
  );
});

test('pnpm native commands do not require scripts, while test aliases and explicit run use the selected manifest', async (t) => {
  // Names and aliases observed in pnpm 10.32.1 help -a and command-level help.
  const nativeCommands = [
    'root',
    'bin',
    'licenses list',
    'deploy output',
    'doctor',
    'ignored-builds',
    'patch-remove example',
    'self-update',
    'install-test',
    'it',
    'ln',
    'rb',
    'c get store-dir',
    'cache list',
    'cat-file hash',
    'cat-index package',
    'find-hash hash',
    'la',
    'll',
    'un example',
    'uninstall example',
    'upgrade',
    'completion',
    'get store-dir',
    'set store-dir example',
    'ci',
    'clean-install',
    'ic',
    'install-clean',
    'uni example',
    'dislink example',
    'restart',
    'server status',
  ];
  const readme = [
    '```sh',
    ...nativeCommands.map((command) => `corepack pnpm@10.32.1 ${command}`),
    'pnpm t',
    'pnpm --filter @test/local t',
    'pnpm -C packages/local t',
    'pnpm --filter @test/local run t',
    'pnpm --filter @test/local tst',
    'pnpm --filter @test/local run-script t',
    '```',
  ].join('\n');
  const localManifest = {
    name: '@test/local',
    scripts: { test: 'node test.mjs', t: 'node other.mjs' },
  };
  const { root, check } = await fixture(t, {
    'package.json': JSON.stringify({ name: 'test-root', scripts: { test: 'node test.mjs' } }),
    'README.md': readme,
    'packages/local/package.json': JSON.stringify(localManifest),
    'packages/local/README.md': '`pnpm t` and `pnpm -w t`.',
  });
  let report = await check();
  assert.deepEqual(report.errors, []);
  assert.equal(report.checkedCommands, 8);

  // A real scripts.t cannot satisfy the pnpm t alias after scripts.test disappears.
  await fs.writeFile(
    path.join(root, 'packages/local/package.json'),
    JSON.stringify({
      ...localManifest,
      scripts: { t: localManifest.scripts.t },
    })
  );
  report = await check();
  assert.equal(report.errors.length, 4);
  assert.ok(
    report.errors.every((error) =>
      /test.*packages\/local\/package\.json|test belongs to the repository root/.test(error)
    )
  );

  await fs.writeFile(path.join(root, 'packages/local/package.json'), JSON.stringify(localManifest));
  await fs.writeFile(path.join(root, 'README.md'), `${readme}\n\n\`pnpm run root\`\n`);
  report = await check();
  assert.equal(report.errors.length, 1);
  assert.match(report.errors[0], /pnpm script root is absent from package\.json/);
});

test('npm forwarding, explicit run and executable shorthand retain distinct static boundaries', async (t) => {
  const { check } = await fixture(t, {
    'README.md': [
      '```sh',
      'pnpm view @proto.ui/core version',
      'pnpm info @proto.ui/core version',
      'pnpm show @proto.ui/core version',
      'pnpm v @proto.ui/core version',
      'pnpm -w view @proto.ui/core version',
      'pnpm run-script view',
      'pnpm prettier --version',
      'pnpm exec prettier --version',
      'pnpm chekc',
      '```',
    ].join('\n'),
  });
  const report = await check();
  assert.equal(report.errors.length, 4);
  assert.ok(
    report.errors.some((error) => /forwards view to npm only as its first argument/.test(error))
  );
  assert.ok(report.errors.some((error) => /script view is absent from package\.json/.test(error)));
  assert.ok(report.errors.some((error) => /pnpm run prettier.*pnpm exec prettier/.test(error)));
  assert.ok(report.errors.some((error) => /pnpm run chekc.*pnpm exec chekc/.test(error)));
});

test('unknown scripts and static filters fail; dynamic selectors and consumer shell contexts are reported separately', async (t) => {
  const { check } = await fixture(t, {
    'README.md': [
      '`pnpm run missing -- <input-file>`',
      '`pnpm --filter @test/missing check`',
      '`pnpm --filter "./packages/*" check`',
      '`pnpm --filter "$PACKAGE" check`',
      '`pnpm --filter @test/one --filter @test/two check`',
      '```sh',
      'cd generated-consumer',
      'pnpm typecheck',
      '```',
    ].join('\n'),
  });
  const report = await check();
  assert.equal(report.errors.length, 2);
  assert.match(report.errors[0], /missing is absent from package\.json/);
  assert.match(report.errors[1], /@test\/missing does not name a workspace package/);
  assert.equal(report.skippedCommands.length, 4);
});

test('local links cannot escape through traversal or symlinks, and generated local views cannot become authored sources', async (t) => {
  const { root, check } = await fixture(
    t,
    {
      'README.md': '[escape](../outside.md)\n[linked](linked.md)',
      'internal/agent/PROJECT-UNDERSTANDING.zh-CN.md': '# Generated\n',
    },
    { localProjections: repositoryDocPolicy.localProjections }
  );
  await fs.symlink(os.tmpdir(), path.join(root, 'linked.md'));
  const report = await check();
  assert.ok(report.errors.some((error) => /local link .* escapes the repository/.test(error)));
  assert.ok(
    report.errors.some((error) => /local link .* resolves outside the repository/.test(error))
  );
  assert.ok(report.errors.some((error) => /generated projection must not be tracked/.test(error)));
  assert.ok(report.errors.some((error) => /generator .* is missing/.test(error)));
  assert.ok(report.errors.some((error) => /root script spec:docs:agent must invoke/.test(error)));
});

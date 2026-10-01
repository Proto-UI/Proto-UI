import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { validatePreservedReadmeMetadata } from '../readme-metadata.mjs';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const PRESERVED_README_DIRS = [
  'packages/hooks',
  'packages/modules/a11y',
  'packages/modules/collection',
  'packages/modules/positioning',
  'packages/modules/text-control',
  'packages/prototypes/base',
  'packages/prototypes/brutalist',
  'packages/prototypes/lucide',
  'packages/prototypes/shadcn',
  'packages/adapters/base',
  'packages/adapters/react',
  'packages/adapters/vue',
  'packages/adapters/web-component',
  'packages/modules/rule-meta',
];

function validate({
  packageName = '@proto.ui/example',
  version = '0.2.0-rc.7',
  internalDeps = ['@proto.ui/core'],
  contents,
}) {
  return validatePreservedReadmeMetadata({ packageName, version, internalDeps, contents });
}

test('preserved README metadata accepts current dependencies and conceptual extras', () => {
  assert.doesNotThrow(() =>
    validate({
      contents: `# Example\n\n\`\`\`bash\nnpm install @proto.ui/example@0.2.0-rc.7\n\`\`\`\n\n## Related Packages\n\n- \`@proto.ui/core\`\n- \`@proto.ui/consumer\`\n`,
    })
  );
});

test('metadata synchronization preserves authored color-scheme README semantics', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'proto-sync-metadata-'));
  const readmes = [
    ['packages/adapters/base', 'createDefaultWebColorSchemeSource'],
    ['packages/adapters/react', 'same-document light DOM'],
    ['packages/adapters/vue', 'same-document light DOM'],
    ['packages/adapters/web-component', 'same-document light DOM'],
    ['packages/modules/rule-meta', 'mounted `colorScheme` invalidation lease'],
  ];

  try {
    const cloned = spawnSync('git', ['clone', '--quiet', '--shared', ROOT_DIR, fixture], {
      encoding: 'utf8',
    });
    assert.equal(cloned.status, 0, cloned.stderr);
    symlinkSync(join(ROOT_DIR, 'node_modules'), join(fixture, 'node_modules'), 'dir');

    const synced = spawnSync(process.execPath, ['scripts/release/sync-metadata.mjs'], {
      cwd: fixture,
      encoding: 'utf8',
    });
    assert.equal(synced.status, 0, synced.stderr);

    for (const [relativeDir, semanticText] of readmes) {
      const packageDir = join(fixture, relativeDir);
      const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
      const contents = readFileSync(join(packageDir, 'README.md'), 'utf8');
      assert.match(contents, new RegExp(semanticText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.match(contents, new RegExp(`npm install ${manifest.name}@${manifest.version}`));
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('preserved README metadata rejects a stale install version', () => {
  assert.throws(
    () =>
      validate({
        internalDeps: [],
        contents: `npm install @proto.ui/example@0.2.0-rc.6\n`,
      }),
    /install command uses 0\.2\.0-rc\.6 instead of 0\.2\.0-rc\.7/
  );
});

test('preserved README metadata rejects omitted production dependencies', () => {
  assert.throws(
    () => validate({ contents: `## Related Internal Packages\n\n- \`@proto.ui/types\`\n` }),
    /Related Packages omits production dependencies: @proto\.ui\/core/
  );
});

test('all current preserved READMEs retain their manifest metadata', () => {
  for (const relativeDir of PRESERVED_README_DIRS) {
    const packageDir = join(ROOT_DIR, relativeDir);
    const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
    const contents = readFileSync(join(packageDir, 'README.md'), 'utf8');
    const internalDeps = Object.keys(manifest.dependencies ?? {}).filter((name) =>
      name.startsWith('@proto.ui/')
    );

    assert.doesNotThrow(
      () =>
        validatePreservedReadmeMetadata({
          packageName: manifest.name,
          version: manifest.version,
          internalDeps,
          contents,
        }),
      manifest.name
    );
  }
});

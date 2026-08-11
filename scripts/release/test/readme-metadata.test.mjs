import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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

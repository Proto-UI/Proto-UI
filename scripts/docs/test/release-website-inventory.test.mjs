import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  buildReleaseWebsiteInventory,
  inspectReleaseDocument,
} from '../release-website-inventory.mjs';

const runtimes = ['wc', 'react', 'vue', 'vue2'];

test('MDX inventory distinguishes rendered previews from code examples and comments', () => {
  const result = inspectReleaseDocument(
    `---\ntitle: Example\n---\n
<PrototypePreviewer demoId="demo-owned" runtimes={['wc', 'vue2']} codePanel={false} />

\`\`\`mdx
<PrototypePreviewer demoId="not-a-real-preview" />
\`\`\`

{/* <PrototypePreviewer demoId="comment-only" /> */}

<CodeExample files={authoredFiles} />`,
    runtimes
  );
  assert.equal(result.previews.length, 1);
  assert.equal(result.previews[0].demoId, 'demo-owned');
  assert.deepEqual(result.previews[0].runtimes, ['wc', 'vue2']);
  assert.equal(result.previews[0].codePanel, false);
  assert.equal(result.codeExamples.length, 1);
  assert.equal(result.inlineCodeBlocks, 1);
});

test('default runtimes use the declared website host set and preserve explicit omissions', () => {
  const result = inspectReleaseDocument('<DemoPreviewer prototypeId="base-button" />', runtimes);
  assert.deepEqual(result.previews[0].runtimes, runtimes);
  assert.equal(result.previews[0].prototypeId, 'base-button');
  assert.equal(result.previews[0].demoId, null);
});

for (const value of ["['wc','wc']", "['svelte']", '[]', 'selectHosts()', 'allHosts']) {
  test(`dynamic or invalid host choice is not silently certified: ${value}`, () => {
    const result = inspectReleaseDocument(
      `<PrototypePreviewer demoId="x" runtimes={${value}} />`,
      runtimes
    );
    assert.equal(result.previews.length, 0);
    assert.equal(result.diagnostics.length, 1);
  });
}

test('unknown spread inputs cannot disappear from the inventory', () => {
  assert.equal(
    inspectReleaseDocument('<PrototypePreviewer {...props} />', runtimes).diagnostics.length,
    1
  );
});

test('literal parsing never executes arbitrary source', () => {
  const result = inspectReleaseDocument(
    '<PrototypePreviewer demoId={process.exit(99)} />',
    runtimes
  );
  assert.equal(result.diagnostics.length, 1);
});

test('import aliases and frontmatter keep the real source identity and line number', () => {
  const source = `---\ntitle: Alias\n---\nimport Preview from '@/components/PrototypePreviewer/PrototypePreviewer.astro';\n\n<Preview demoId="real-alias" />`;
  const result = inspectReleaseDocument(source, runtimes);
  assert.equal(result.previews[0].demoId, 'real-alias');
  assert.equal(result.previews[0].line, 6);
});

for (const attributes of ['demoId={true}', 'demoId="   "', 'demoId="x" codePanel="false"']) {
  test(`malformed authored identities remain errors: ${attributes}`, () => {
    const result = inspectReleaseDocument(`<PrototypePreviewer ${attributes} />`, runtimes);
    assert.equal(result.previews.length, 0);
    assert.equal(result.diagnostics.length, 1);
  });
}

test('current exports drive bilingual route rows, with missing routes and evidence unearned', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'release-website-inventory-'));
  try {
    const write = async (file, content) => {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await writeFile(path.join(root, file), content);
    };
    await write(
      'apps/www/src/components/PrototypePreviewer/runtimes/ids.ts',
      "export const AdapterIds = ['wc', 'react', 'vue', 'vue2'] as const;"
    );
    await write(
      'packages/prototypes/base/package.json',
      JSON.stringify({ exports: { '.': './dist/index.js', './dropdown': './dist/dropdown.js' } })
    );
    await write(
      'apps/www/src/content/docs/en/ui-libraries/base/dropdown-menu.mdx',
      '<PrototypePreviewer demoId="demo-menu" />'
    );
    const policy = {
      locales: ['en', 'zh-cn'],
      libraries: [
        {
          id: 'base',
          packageName: '@proto.ui/prototypes-base',
          catalogPrefix: 'P-BASE-',
          detailPrefix: 'ui-libraries/base',
          familyAliases: { dropdown: 'dropdown-menu' },
          exportClassifications: { '.': { kind: 'library-root' } },
        },
      ],
    };
    const result = await buildReleaseWebsiteInventory({ root, policy });
    assert.equal(result.summary.routes, 2);
    assert.equal(result.summary.families, 1);
    assert.equal(result.summary.previewHostCells, 4);
    assert.match(result.errors[0], /Missing localized/);
    assert.equal(result.rows[0].catalogId, 'P-BASE-DROPDOWN-MENU');
    assert.equal(result.rows[1].document, null);
    assert.ok(
      result.rows.every((row) => Object.values(row.evidence).every((value) => value === 'not-run'))
    );
    assert.equal(result.revision, null);
    assert.equal(result.historicalBoundary.routes, 518);
    assert.equal(result.historicalBoundary.cells, 5784);
    assert.ok(
      result.inputs.some(
        (input) => input.path.endsWith('dropdown-menu.mdx') && /^[a-f0-9]{64}$/.test(input.sha256)
      )
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  checkSpecLifecycleProjection,
  checkLibraryInventory,
  checkLocalizedRoutes,
  checkScaffolding,
  extractSidebarSlugs,
  findStaleReleaseClaims,
} from '../check-public-docs.mjs';
import { publicDocPolicy } from '../public-doc-policy.mjs';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

test('a stale current RC install claim fails while an archived page passes', async () => {
  const current = await fs.readFile(path.join(FIXTURES, 'current-rc.md'), 'utf8');
  const archived = await fs.readFile(path.join(FIXTURES, 'archived-rc.md'), 'utf8');
  const input = {
    currentVersion: '0.2.0',
    governedSource: 'spec/versions/V-STABLE.yaml',
    pendingMarkers: ['stable publication pending'],
  };

  const currentErrors = findStaleReleaseClaims({ file: 'current-rc.md', text: current, ...input });
  assert.equal(currentErrors.length, 1);
  assert.match(currentErrors[0], /current-rc\.md:6/);
  assert.match(currentErrors[0], /V-STABLE\.yaml/);
  assert.deepEqual(
    findStaleReleaseClaims({ file: 'archived-rc.md', text: archived, archived: true, ...input }),
    []
  );
});

test('a current prerelease claim fails even when its core differs from stable', async () => {
  const text = await fs.readFile(path.join(FIXTURES, 'different-core-current-rc.md'), 'utf8');
  const errors = findStaleReleaseClaims({
    file: 'different-core-current-rc.md',
    text,
    currentVersion: '0.2.0',
    governedSource: 'spec/versions/V-STABLE.yaml',
  });

  assert.equal(errors.length, 1);
  assert.match(errors[0], /0\.1\.0-rc\.7 is presented as a current install\/release claim/);
});

test('an explicitly draft workspace train is not a current release claim', () => {
  const errors = findStaleReleaseClaims({
    file: 'workspace.md',
    text: 'The current workspace may contain changes for the draft 0.3.0-alpha.0 train.',
    currentVersion: '0.2.0',
    governedSource: 'spec/versions/V-STABLE.yaml',
  });

  assert.deepEqual(errors, []);
});

test('both bilingual repository landing pages are current release projections', () => {
  assert.deepEqual(publicDocPolicy.release.additionalCurrentProjections, [
    'README.md',
    'README.zh-CN.md',
  ]);
});

test('a missing localized primary route reports the exact locale and slug', async () => {
  const result = await checkLocalizedRoutes({
    root: path.join(FIXTURES, 'routes'),
    slugs: ['start'],
    locales: ['en', 'zh-cn'],
  });

  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /locale=zh-cn, slug=start/);
});

test('an unclassified released family gap points to catalog remediation', () => {
  const errors = checkLibraryInventory({
    releaseVersion: '0.2.0',
    bom: {
      __source: 'internal/releases/0.2.0/package-bom.json',
      packages: [{ name: '@proto.ui/prototypes-test' }],
    },
    libraries: [
      {
        id: 'test',
        packageName: '@proto.ui/prototypes-test',
        detailPrefix: 'ui-libraries/test',
        catalogPrefix: 'P-TEST-',
        exportClassifications: {
          '.': {
            kind: 'library-root',
            reason: 'The root barrel aggregates the component families.',
          },
        },
      },
    ],
    manifests: new Map([
      [
        '@proto.ui/prototypes-test',
        { exports: { '.': './dist/index.js', './new-family': './dist/new.js' } },
      ],
    ]),
    catalog: [],
    sidebarSlugs: ['ui-libraries/test'],
  });

  assert.equal(errors.length, 1);
  assert.match(errors[0], /unclassified family\/export/);
  assert.match(errors[0], /P-TEST-NEW-FAMILY/);
});

test('a released family with the wrong sidebar route fails the canonical projection', () => {
  const errors = checkLibraryInventory({
    releaseVersion: '0.2.0',
    bom: { packages: [{ name: '@proto.ui/prototypes-test' }] },
    libraries: [
      {
        id: 'test',
        packageName: '@proto.ui/prototypes-test',
        detailPrefix: 'ui-libraries/test',
        catalogPrefix: 'P-TEST-',
        exportClassifications: {
          '.': {
            kind: 'library-root',
            reason: 'The root barrel aggregates the component families.',
          },
        },
      },
    ],
    manifests: new Map([
      [
        '@proto.ui/prototypes-test',
        { exports: { '.': './dist/index.js', './button': './dist/button.js' } },
      ],
    ]),
    catalog: [{ id: 'P-TEST-BUTTON', since: '0.2.0-rc.1', status: 'draft' }],
    sidebarSlugs: ['ui-libraries/test/wrong'],
  });

  assert.equal(errors.length, 1);
  assert.match(errors[0], /absent from primary sidebar slug ui-libraries\/test\/button/);
});

test('reasoned non-component and overview-only exports pass intentionally', () => {
  const input = {
    releaseVersion: '0.2.0',
    bom: { packages: [{ name: '@proto.ui/prototypes-icons' }] },
    libraries: [
      {
        id: 'icons',
        packageName: '@proto.ui/prototypes-icons',
        overviewSlug: 'ui-libraries/icons',
        catalogPrefix: 'P-ICONS-',
        exportClassifications: {
          '.': { kind: 'library-root', reason: 'The root barrel maps to the overview.' },
          './manifest': { kind: 'non-component', reason: 'Metadata is not a component.' },
          './icons/*': {
            kind: 'overview-only',
            catalogId: 'P-ICONS-ICON',
            reason: 'Generated entries share one searchable overview.',
          },
        },
      },
    ],
    manifests: new Map([
      [
        '@proto.ui/prototypes-icons',
        {
          exports: {
            '.': './dist/index.js',
            './manifest': './dist/manifest.js',
            './icons/*': './dist/*.js',
          },
        },
      ],
    ]),
    catalog: [{ id: 'P-ICONS-ICON', since: '0.2.0-rc.1', status: 'draft' }],
    sidebarSlugs: ['ui-libraries/icons'],
  };

  assert.deepEqual(checkLibraryInventory(input), []);
  const missingOverview = checkLibraryInventory({ ...input, sidebarSlugs: [] });
  assert.equal(missingOverview.length, 1);
  assert.match(missingOverview[0], /overview route ui-libraries\/icons is missing/);
});

test('public scaffolding reports the source file and marker', async () => {
  const text = await fs.readFile(path.join(FIXTURES, 'placeholder.md'), 'utf8');
  const errors = checkScaffolding({
    documents: [{ locale: 'zh-cn', slug: 'guide', file: 'placeholder.md', text }],
    markers: ['写作提示', 'Coming soon'],
  });

  assert.equal(errors.length, 1);
  assert.match(errors[0], /placeholder\.md:3/);
  assert.match(errors[0], /写作提示/);
});

test('public spec lifecycle guides expose the activation-history boundary', () => {
  const errors = checkSpecLifecycleProjection({
    documents: [
      {
        locale: 'en',
        slug: 'specifications/introduction',
        file: 'apps/www/src/content/docs/en/specifications/introduction.md',
        text: 'Every entity has a `since` version and a lifecycle status.',
      },
      {
        locale: 'zh-cn',
        slug: 'specifications/introduction',
        file: 'apps/www/src/content/docs/zh-cn/specifications/introduction.md',
        text: '普通实体使用 `activeSince` 记录稳定生效版本。',
      },
    ],
  });

  assert.deepEqual(errors, [
    'apps/www/src/content/docs/en/specifications/introduction.md: public spec lifecycle guide must explain `activeSince` as distinct from `since`.',
    'apps/www/src/content/docs/zh-cn/specifications/introduction.md: public spec lifecycle guide must state that `activeSince` may equal `since` for an identity introduced stable.',
  ]);
});

test('the Shadcn Input sidebar route opens its real demo in both locales', async () => {
  const root = new URL('../../../', import.meta.url);
  const slug = 'ui-libraries/shadcn/input';
  const config = await fs.readFile(new URL('apps/www/astro.config.mjs', root), 'utf8');
  assert.ok(extractSidebarSlugs(config).includes(slug));
  for (const locale of publicDocPolicy.locales) {
    const source = await fs.readFile(
      new URL(`apps/www/src/content/docs/${locale}/${slug}.mdx`, root),
      'utf8'
    );
    assert.match(source, /<PrototypePreviewer\s+demoId="demo-shadcn-input"/);
  }
});

test('both general Feedback references explain the bounded selection exception', async () => {
  for (const locale of ['en', 'zh-cn']) {
    const source = await fs.readFile(
      new URL(
        `../../../apps/www/src/content/docs/${locale}/specifications/feedback.mdx`,
        import.meta.url
      ),
      'utf8'
    );
    assert.match(source, /selection:<style-token>/);
    assert.match(source, /tw\('selection:bg-primary'\)/);
    assert.match(source, /tw\('selection:hover:bg-primary'\)/);
  }
});

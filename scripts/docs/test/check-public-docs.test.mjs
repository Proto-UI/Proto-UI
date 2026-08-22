import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  checkLibraryInventory,
  checkLocalizedRoutes,
  checkScaffolding,
  extractOverviewEntries,
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
        overviewSlug: 'ui-libraries/test',
        detailPrefix: 'ui-libraries/test',
        catalogPrefix: 'P-TEST-',
        exportClassifications: {
          '.': { kind: 'library-root', reason: 'The overview represents the root barrel.' },
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
    overviewEntries: new Map([['test', []]]),
    sidebarSlugs: ['ui-libraries/test'],
  });

  assert.equal(errors.length, 1);
  assert.match(errors[0], /unclassified family\/export/);
  assert.match(errors[0], /P-TEST-NEW-FAMILY/);
});

test('a released family missing from overview and sidebar fails both projections', () => {
  const errors = checkLibraryInventory({
    releaseVersion: '0.2.0',
    bom: { packages: [{ name: '@proto.ui/prototypes-test' }] },
    libraries: [
      {
        id: 'test',
        packageName: '@proto.ui/prototypes-test',
        overviewSlug: 'ui-libraries/test',
        detailPrefix: 'ui-libraries/test',
        catalogPrefix: 'P-TEST-',
        exportClassifications: {
          '.': { kind: 'library-root', reason: 'The overview represents the root barrel.' },
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
    overviewEntries: new Map([['test', []]]),
    sidebarSlugs: ['ui-libraries/test'],
  });

  assert.equal(errors.length, 2);
  assert.match(errors[0], /absent from the test overview inventory/);
  assert.match(errors[1], /absent from primary sidebar slug ui-libraries\/test\/button/);
});

test('a released family with the wrong overview href fails the link projection', async () => {
  const source = await fs.readFile(path.join(FIXTURES, 'wrong-overview-link.astro'), 'utf8');
  const overviewEntries = extractOverviewEntries(source, 'wrong-overview-link.astro');
  const errors = checkLibraryInventory({
    releaseVersion: '0.2.0',
    bom: { packages: [{ name: '@proto.ui/prototypes-test' }] },
    libraries: [
      {
        id: 'test',
        packageName: '@proto.ui/prototypes-test',
        overviewSlug: 'ui-libraries/test',
        detailPrefix: 'ui-libraries/test',
        catalogPrefix: 'P-TEST-',
        exportClassifications: {
          '.': { kind: 'library-root', reason: 'The overview represents the root barrel.' },
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
    overviewEntries,
    sidebarSlugs: ['ui-libraries/test', 'ui-libraries/test/button'],
  });

  assert.equal(errors.length, 1);
  assert.match(errors[0], /links to \.\/wrong\//);
  assert.match(errors[0], /expected localized relative href \.\/button\//);
});

test('reasoned non-component and overview-only exports pass intentionally', () => {
  const errors = checkLibraryInventory({
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
    overviewEntries: new Map(),
    sidebarSlugs: ['ui-libraries/icons'],
  });

  assert.deepEqual(errors, []);
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

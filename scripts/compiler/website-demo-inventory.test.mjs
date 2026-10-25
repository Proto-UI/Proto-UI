import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, symlink, writeFile, rm, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { register } from 'tsx/esm/api';
import {
  compareInputBindings,
  HISTORICAL_INVENTORY,
  discoverAutomaticPrototypeRegistrations,
  discoverDemoDeclarations,
  discoverHomepagePrototypeCandidates,
  discoverPrototypeRegistrations,
  generateWebsiteInventory,
  normalizeDocRoute,
  reconcileHistoricalRejections,
  snapshotInputBinding,
} from './website-demo-inventory.mjs';

const workspace = fileURLToPath(new URL('../../.cache/', import.meta.url));
const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
async function fixture(run) {
  await mkdir(workspace, { recursive: true });
  const root = await mkdtemp(path.join(workspace, 'inventory-test-'));
  const put = async (name, bytes) => {
    const file = path.join(root, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
  };
  try {
    await run(root, put);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('normalizes actual documentation route identities across separators', () => {
  assert.equal(normalizeDocRoute('en\\ui-libraries\\card.mdx'), '/en/ui-libraries/card/');
  assert.equal(normalizeDocRoute('en/index.mdx'), '/en/');
  assert.equal(normalizeDocRoute('index.md'), '/');
});

test('retains exact immutable historical inventory bytes and every rejected obligation', async () => {
  const bytes = await readFile(new URL('./website-demo-migrations-829.json', import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), HISTORICAL_INVENTORY.sha256);
  const historical = JSON.parse(bytes.toString('utf8'));
  const rejected = historical.prototypes.filter((row) => row.nodeAdmission === 'rejected');
  const obligations = reconcileHistoricalRejections(historical, []);
  assert.deepEqual(
    obligations.map((row) => row.id),
    rejected.map((row) => row.id)
  );
  for (let index = 0; index < rejected.length; index += 1)
    assert.deepEqual(obligations[index].historical.diagnostics, rejected[index].diagnostics);
});

test('discovers spread, exact helper and returned-import registration addresses without execution', async () => {
  await fixture(async (root, put) => {
    await put(
      'registry.ts',
      `import { additions } from './spread';
throw new Error('author programs must not execute');
function install(id, prototype) { registerPrototype(id, prototype); }
const manualPrototypeModules = {
 ...additions,
 direct: async () => { const mod = await import('./author'); registerPrototype('direct', mod.card); },
 helper: async () => { const mod = await import('./author'); install('helper', mod.card); },
 returned: () => import('./author'),
 dynamic: async () => { const mod = await import('./author'); registerPrototype(runtimeId, mod.card); }
};`
    );
    await put(
      'spread.ts',
      `export const additions = {
 exact: async () => { const mod = await import('./author'); registerExactPrototype('exact', mod.Card); }
};
function registerExactPrototype(id, prototype) { registerPrototype(id, prototype); }`
    );
    await put(
      'author.ts',
      `throw new Error('must remain data'); export const Card = {}; export const card = {};`
    );
    const scan = await discoverPrototypeRegistrations({ root, registryFile: 'registry.ts' });
    assert.deepEqual(
      scan.registrations.map((row) => [row.id, row.exportName]),
      [
        ['direct', 'card'],
        ['exact', 'Card'],
        ['helper', 'card'],
        ['returned', 'default'],
      ]
    );
    assert.ok(
      scan.unresolved.some((row) => row.reason === 'registration-id-or-module-export-is-dynamic')
    );
    assert.deepEqual(scan.sourceFiles, ['registry.ts', 'spread.ts']);
  });
});

test('loader discovery retains nested hidden declarations, dynamic bindings and new membership', async () => {
  await fixture(async (root, put) => {
    await put('loader.ts', `const modules = import.meta.glob('./content/**/*.demo.ts');`);
    await put('prototypes.ts', `const modules = import.meta.glob('./content/**/*.demo.proto.ts');`);
    await put(
      'content/.hidden/card.demo.ts',
      `throw new Error('never execute'); export default { root: { prototypeId: 'card' }, other: { prototypeId: selected } };`
    );
    await put(
      'content/deep/card.demo.proto.ts',
      `throw new Error('never execute'); export default {};`
    );
    const before = await discoverDemoDeclarations({ root, loaderFile: 'loader.ts' });
    assert.deepEqual(
      before.declarations.map((row) => row.prototypeIds),
      [['card']]
    );
    assert.equal(before.declarations[0].hiddenPath, true);
    assert.equal(before.declarations[0].unresolvedBindings[0].expression, 'selected');
    const automatic = await discoverAutomaticPrototypeRegistrations({
      root,
      registryFile: 'prototypes.ts',
    });
    assert.deepEqual(
      automatic.registrations.map((row) => [row.id, row.exportName]),
      [['card', 'default']]
    );
    await put('content/new.demo.ts', `export default { prototypeId: 'new-card' };`);
    const after = await discoverDemoDeclarations({ root, loaderFile: 'loader.ts' });
    assert.deepEqual(
      after.declarations.map((row) => row.id),
      ['card', 'new']
    );
  });
});

test('source bindings detect changed, removed and newly added hidden inputs deterministically', async () => {
  await fixture(async (root, put) => {
    const options = { sourceTrees: ['inputs'], staticPaths: [], git: false };
    await put('inputs/.hidden.ts', 'export const value = 1;');
    await put('inputs/removed.ts', 'export const removed = true;');
    const before = await snapshotInputBinding(root, options);
    assert.deepEqual(before, await snapshotInputBinding(root, options));
    await put('inputs/.hidden.ts', 'export const value = 2;');
    await put('inputs/.added.ts', 'export const added = true;');
    await unlink(path.join(root, 'inputs/removed.ts'));
    const after = await snapshotInputBinding(root, options);
    assert.deepEqual(compareInputBindings(before, after), {
      added: ['inputs/.added.ts'],
      removed: ['inputs/removed.ts'],
      changed: ['inputs/.hidden.ts'],
      revisionChanged: false,
    });
  });
});

test('every historical rejected row remains an open obligation despite new admission or disappearance', () => {
  const diagnostics = [
    { code: 'PUI1020', span: { file: 'old.ts', line: 2 }, message: 'unsupported' },
  ];
  const historical = {
    prototypes: [
      {
        id: 'changed',
        nodeAdmission: 'rejected',
        entry: 'old.ts',
        entrySha256: 'old',
        diagnostics,
      },
      {
        id: 'missing',
        nodeAdmission: 'rejected',
        entry: 'missing.ts',
        entrySha256: 'missing',
        diagnostics,
      },
      { id: 'passed', nodeAdmission: 'compiled' },
    ],
  };
  const result = reconcileHistoricalRejections(historical, [
    { id: 'changed', statuses: { nodeAdmission: 'compiled' }, entry: 'new.ts', entrySha256: 'new' },
  ]);
  assert.deepEqual(
    result.map((row) => row.id),
    ['changed', 'missing']
  );
  assert.ok(result.every((row) => row.obligation === 'open-historical-rejection-reconciliation'));
  assert.deepEqual(result[0].historical.diagnostics, diagnostics);
  assert.equal(result[0].current.nodeAdmission, 'compiled');
  assert.equal(result[1].current.nodeAdmission, 'not-discovered-in-current-scope');
});

test('actual MDX-to-Astro wrappers retain rejected rows and observe source mutations', async () => {
  const unregister = register();
  try {
    await fixture(async (root, put) => {
      await put('apps/www/package.json', '{"type":"module"}');
      await symlink(
        path.join(repositoryRoot, 'apps/www/node_modules'),
        path.join(root, 'apps/www/node_modules'),
        'dir'
      );
      await put(
        'scripts/compiler/website-demo-migrations-829.json',
        await readFile(
          path.join(repositoryRoot, 'scripts/compiler/website-demo-migrations-829.json')
        )
      );
      await put(
        'packages/compiler/package.json',
        '{"private":true,"exports":{".":"./src/index.ts"}}'
      );
      await put(
        'apps/www/src/components/PrototypePreviewer/demo-modules.ts',
        `const loaders = import.meta.glob('../../content/**/*.demo.ts');`
      );
      await put(
        'apps/www/src/components/PrototypePreviewer/prototype-modules.ts',
        `const manualPrototypeModules = {
 one: async () => { const mod = await import('../../content/one.demo.proto'); registerPrototype('one', mod.default); },
 two: async () => { const mod = await import('../../content/two.demo.proto'); registerPrototype('two', mod.default); }
};`
      );
      await put('apps/www/src/content/one.demo.proto.ts', 'export default null;');
      await put('apps/www/src/content/two.demo.proto.ts', 'export default null;');
      await put(
        'apps/www/src/components/PrototypeLibraryOverview.astro',
        '---\nconst entriesByLibrary = { fixture: [] };\n---\n'
      );
      await put(
        'apps/www/src/components/site-library-family.ts',
        `export type SiteLibraryFamily = 'fixture';`
      );
      await put(
        'apps/www/src/components/PrototypePreviewer/projection-families.ts',
        `export const PROJECTION_FAMILY_MANIFESTS = Object.freeze({fixture: {families: {}}});`
      );
      for (const name of [
        'homepage-demo-participant',
        'homepage-gallery-parts',
        'homepage-runtime-client',
        'homepage-showcase',
      ])
        await put(`apps/www/src/components/Homepage/${name}.ts`, 'export {};');
      await put('apps/www/src/components/surface-recipes.ts', 'export {};');
      await put(
        'apps/www/src/content/docs/en/index.mdx',
        `import Gallery from '@/components/Gallery.astro';\n\n<Gallery />\n`
      );
      const wrapper = (id) =>
        `---\nimport PrototypePreviewer from './PrototypePreviewer/PrototypePreviewer.astro';\n---\n<PrototypePreviewer prototypeId="${id}" />\n`;
      await put('apps/www/src/components/Gallery.astro', wrapper('one'));
      const before = await generateWebsiteInventory({ root, outputPath: 'output.json' });
      assert.deepEqual(before.pages[0].rows[0].prototypeIds, ['one']);
      assert.equal(before.prototypes[0].statuses.nodeAdmission, 'rejected');
      assert.ok(before.prototypes[0].diagnostics.every((diagnostic) => diagnostic.span));
      assert.equal(
        before.historicalEvidence.rejectedRowReconciliation.length,
        before.historicalEvidence.originalInventory.prototypes.filter(
          (row) => row.nodeAdmission === 'rejected'
        ).length
      );
      await put('apps/www/src/components/Gallery.astro', wrapper('two'));
      const after = await generateWebsiteInventory({ root, outputPath: 'output.json' });
      assert.deepEqual(after.pages[0].rows[0].prototypeIds, ['two']);
      assert.equal(after.prototypes[0].statuses.nodeAdmission, 'rejected');
      assert.notEqual(after.inputBinding.sha256, before.inputBinding.sha256);
      assert.equal(after.statuses.migration, 'not-migrated');
    });
  } finally {
    unregister();
  }
});

test('retains an unresolved identity or exact prototype for the current factory-backed Surface demo', async () => {
  const demoPath = 'apps/www/src/content/docs/zh-cn/demo-shadcn-surface.demo.ts';
  const helperPath = 'apps/www/src/components/PrototypePreviewer/surface-atom-demo.ts';
  const demoSource = await readFile(path.join(repositoryRoot, demoPath));
  const helperSource = await readFile(path.join(repositoryRoot, helperPath));
  await fixture(async (root, put) => {
    await put(
      'apps/www/src/components/PrototypePreviewer/demo-modules.ts',
      `const modules = import.meta.glob('../../content/**/*.demo.ts');`
    );
    await put(demoPath, demoSource);
    await put(helperPath, helperSource);

    const scan = await discoverDemoDeclarations({ root });
    const surface = scan.declarations.find((row) => row.id === 'demo-shadcn-surface');
    assert.ok(surface, 'the current Surface demo is retained by its real loader source');
    const explicitlyUnresolved = surface.unresolvedBindings.some((binding) =>
      [binding.file, binding.expression, binding.reason, binding.specifier]
        .filter(Boolean)
        .join(' ')
        .includes('createSurfaceAtomDemo')
    );
    assert.ok(
      surface.prototypeIds.includes('shadcn-surface-root') || explicitlyUnresolved,
      'the factory-derived Surface dependency must be admitted as data or explicitly unresolved'
    );
  });
});

test('retains homepage Surface candidates even when absent from the projection manifest', async () => {
  const candidates = await discoverHomepagePrototypeCandidates({ root: repositoryRoot });
  const registrations = await discoverPrototypeRegistrations({ root: repositoryRoot });
  const registeredIds = new Set(registrations.registrations.map((row) => row.id));
  for (const family of ['shadcn', 'brutalist']) {
    const id = `${family}-surface-root`;
    assert.ok(registeredIds.has(id), `the current manual registry contains ${id}`);
    const explicitUnresolved = candidates.unresolved.some(
      (row) =>
        row.prototypeId === id ||
        row.id === id ||
        row.candidate === id ||
        row.possiblePrototypeIds?.includes(id) ||
        row.expression?.includes(id)
    );
    assert.ok(
      candidates.prototypeIds.includes(id) || explicitUnresolved,
      `${id} must be retained as a source-backed candidate or an explicit unresolved binding`
    );
  }
});

test('does not classify unused projection-manifest identities as homepage usage', async () => {
  await fixture(async (root, put) => {
    await put(
      'apps/www/src/components/site-library-family.ts',
      `export type SiteLibraryFamily = 'fixture';`
    );
    await put(
      'apps/www/src/components/PrototypePreviewer/projection-families.ts',
      `export const PROJECTION_FAMILY_MANIFESTS = Object.freeze({
        fixture: { families: {
          card: { parts: { root: { prototypeId: 'fixture-used-card-root' } } },
          unused: { parts: { root: { prototypeId: 'fixture-manifest-only-root' } } }
        } }
      });`
    );
    await put(
      'apps/www/src/components/Homepage/homepage-gallery-parts.ts',
      `part('card', 'root');`
    );
    for (const name of [
      'homepage-demo-participant',
      'homepage-runtime-client',
      'homepage-showcase',
    ])
      await put(`apps/www/src/components/Homepage/${name}.ts`, 'export {};');
    await put('apps/www/src/components/surface-recipes.ts', 'export {};');

    const candidates = await discoverHomepagePrototypeCandidates({
      root,
      registeredPrototypeIds: new Set(),
    });
    assert.deepEqual(candidates.prototypeIds, ['fixture-used-card-root']);
  });
});

async function gitSourceFixture(run) {
  await fixture(async (root, put) => {
    const git = (args) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
    git(['init', '-q']);
    git(['config', 'user.name', 'Inventory Test']);
    git(['config', 'user.email', 'inventory@example.invalid']);
    git(['config', 'commit.gpgsign', 'false']);
    await put('inputs/entry.ts', 'export const entry = 1;');
    const equalBytes = 'export const same = true;';
    await put('inputs/origin.ts', equalBytes);
    await put('inputs/alternate-one.ts', equalBytes);
    await put('inputs/alternate-two.ts', equalBytes);
    await symlink('origin.ts', path.join(root, 'inputs/current.ts'));
    git(['add', '-A']);
    git(['commit', '-m', 'fixture']);
    await run(root, put, git, { sourceTrees: ['inputs'], staticPaths: [], git: true });
  });
}

test('detects staging a dirty input without changing its worktree bytes', async () => {
  await gitSourceFixture(async (root, put, git, options) => {
    await put('inputs/entry.ts', 'export const entry = 2;');
    const beforeStage = await snapshotInputBinding(root, options);
    git(['add', 'inputs/entry.ts']);
    const afterStage = await snapshotInputBinding(root, options);
    assert.deepEqual(compareInputBindings(beforeStage, afterStage).changed, ['inputs/entry.ts']);
  });
});

test('detects retargeting a dirty symlink between equal-byte sources', async () => {
  await gitSourceFixture(async (root, _put, _git, options) => {
    await unlink(path.join(root, 'inputs/current.ts'));
    await symlink('alternate-one.ts', path.join(root, 'inputs/current.ts'));
    const beforeRetarget = await snapshotInputBinding(root, options);
    await unlink(path.join(root, 'inputs/current.ts'));
    await symlink('alternate-two.ts', path.join(root, 'inputs/current.ts'));
    const afterRetarget = await snapshotInputBinding(root, options);
    assert.equal(
      beforeRetarget.files.find((row) => row.path === 'inputs/current.ts').sha256,
      afterRetarget.files.find((row) => row.path === 'inputs/current.ts').sha256
    );
    assert.deepEqual(compareInputBindings(beforeRetarget, afterRetarget).changed, [
      'inputs/current.ts',
    ]);
  });
});

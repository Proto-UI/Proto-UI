import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';
import { checkLibraryInventory } from '../check-public-docs.mjs';
import { publicDocPolicy } from '../public-doc-policy.mjs';

const root = new URL('../../../', import.meta.url);
const read = (path) => fs.readFile(new URL(path, root), 'utf8');
const entity = async (id, directory = 'prototypes') =>
  parseYaml(await read(`spec/${directory}/${id}.yaml`));
const shellId = 'P-SHADCN-INPUT-SHELL';
const controlId = 'P-SHADCN-INPUT-SHELL-CONTROL';
const testId = 'T-SHADCN-INPUT-SHELL-0001';
const ids = (refs = []) => refs.map((ref) => (typeof ref === 'string' ? ref : ref.id));

async function inventory(catalog, releaseVersion = '0.2.0', extraExports = {}) {
  const library = publicDocPolicy.libraries.find((entry) => entry.id === 'shadcn');
  const manifest = JSON.parse(await read('packages/prototypes/shadcn/package.json'));
  assert.ok(manifest.exports['./input-shell'], 'exercise the actual public subpath');
  assert.equal(library.exportClassifications['./input-shell'], undefined);
  return checkLibraryInventory({
    releaseVersion,
    bom: { packages: [{ name: library.packageName }] },
    libraries: [library],
    manifests: new Map([
      [
        library.packageName,
        { exports: { './input-shell': manifest.exports['./input-shell'], ...extraExports } },
      ],
    ]),
    catalog,
    overviewEntries: new Map([['shadcn', []]]),
    sidebarSlugs: [library.overviewSlug],
  });
}

test('input shell has real separate draft protocol owners and reciprocal evidence mapping', async () => {
  const shell = await entity(shellId);
  const control = await entity(controlId);
  const evidence = await entity(testId, 'tests');
  const train = '0.3.0-alpha.1';
  const trainEntity = parseYaml(await read('spec/versions/V-PROTO-UI-0010.yaml'));
  assert.equal(
    trainEntity.release.version,
    train,
    'preserve the actual introduction train, not a moving VERSION'
  );
  for (const record of [shell, control, evidence]) {
    assert.equal(record.since, train);
    assert.equal(record.status, 'draft');
    assert.equal(record.activeSince, undefined);
    assert.ok(record.lifecycleRationale.en.length > 40);
  }
  for (const [record, source] of [
    [shell, 'packages/prototypes/shadcn/src/input-shell/root.proto.ts'],
    [control, 'packages/prototypes/shadcn/src/input-shell/control.proto.ts'],
  ]) {
    assert.ok(record.sources.some((entry) => entry.path === source));
    assert.ok(record.criteria.length > 0);
    assert.ok(ids(record.verifies.tests).includes(testId));
    assert.ok(ids(evidence.exercises.prototypes).includes(record.id));
    assert.ok(ids(evidence.verifies.prototypes).includes(record.id));
  }
  assert.equal(
    shell.inherits,
    undefined,
    'passive shell must not invent Base InputGroup inheritance'
  );
  assert.deepEqual(ids(control.inherits.prototypes), ['P-BASE-INPUT']);
  const criterionIds = new Set(
    [...shell.criteria, ...control.criteria].map((criterion) => criterion.id)
  );
  for (const testCase of evidence.cases) {
    for (const covered of testCase.covers) assert.ok(criterionIds.has(covered), covered);
  }
  assert.ok(
    evidence.implementations.some(
      (entry) => entry.id === 'derived-input-conformance' && entry.status === 'missing'
    )
  );
});

test('draft shell ownership fixes only its missing-family classification, not unrelated exports', async () => {
  const shell = await entity(shellId);
  const missing = await inventory([]);
  assert.equal(missing.length, 1);
  assert.match(missing[0], /\.\/input-shell: unclassified family\/export/);
  assert.match(missing[0], /P-SHADCN-INPUT-SHELL/);
  assert.deepEqual(await inventory([shell]), []);
  const unrelated = await inventory([shell], '0.2.0', {
    './uncataloged-sentinel': './dist/sentinel.js',
  });
  assert.equal(unrelated.length, 1);
  assert.match(unrelated[0], /P-SHADCN-UNCATALOGED-SENTINEL/);
});

test('family availability still requires overview and sidebar projections, even while draft', async () => {
  const shell = await entity(shellId);
  const errors = await inventory([shell], shell.since);
  assert.equal(errors.length, 2);
  assert.match(errors[0], /absent from the shadcn overview inventory/);
  assert.match(errors[1], /absent from primary sidebar slug ui-libraries\/shadcn\/input-shell/);
});

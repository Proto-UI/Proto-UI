import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  collectDiagramInventory,
  diagramDecisions,
} from '../../../apps/www/scripts/whitepaper-diagram-inventory.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const revision = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD']).toString().trim();
const inventory = collectDiagramInventory(root, revision);

test('the inventory binds all original assets, responsive additions and real page references', () => {
  assert.equal(inventory.revision, revision);
  assert.deepEqual(inventory.counts, {
    assets: 17,
    originalInventory: 15,
    additionalResponsiveVariants: 2,
    references: 22,
    canonicalReferences: 20,
    retainedDraftReferences: 2,
  });
  assert.equal(inventory.assets.filter((asset) => asset.kind === 'generated').length, 10);
  assert.equal(inventory.assets.filter((asset) => asset.kind === 'authored-export').length, 6);
  for (const asset of inventory.assets) {
    assert.match(asset.blob, /^[a-f0-9]{40}$/);
    assert.match(asset.sha256, /^[a-f0-9]{64}$/);
    assert.ok(asset.reason.length > 30);
    assert.equal(asset.disposition, 'keep');
    for (const reference of asset.references) {
      const page = execFileSync('git', ['-C', root, 'cat-file', 'blob', reference.blob]).toString();
      assert.ok(
        page.split('\n')[reference.line - 1].includes(asset.asset.replace('apps/www/public', ''))
      );
    }
  }
});

test('canonical legacy comparison and retained draft references remain distinct', () => {
  const legacy = inventory.assets.find((asset) => asset.kind === 'retained-legacy');
  assert.equal(legacy.captureProfile, 'information-flow-model');
  assert.deepEqual(legacy.references.map((reference) => reference.status).sort(), [
    'canonical-article',
    'canonical-article',
    'retained-draft',
    'retained-draft',
  ]);
  assert.ok(
    legacy.references
      .filter((reference) => reference.status === 'canonical-article')
      .every((reference) => reference.path.endsWith('/2-interaction-relations.md'))
  );
  assert.match(legacy.reason, /State\/Lifecycle\/Meta/);
});

test('missing, duplicate or unregistered assets cannot produce a complete inventory', () => {
  for (const decisions of [
    diagramDecisions.slice(1),
    [...diagramDecisions, diagramDecisions[0]],
    [
      ...diagramDecisions.slice(1),
      { ...diagramDecisions[0], asset: 'apps/www/public/diagrams/unknown.svg' },
    ],
  ])
    assert.throws(
      () => collectDiagramInventory(root, revision, decisions),
      /exactly one disposition/
    );
});

test('source, reason and immutable revision failures are rejected rather than omitted', () => {
  const changed = (delta) => [{ ...diagramDecisions[0], ...delta }, ...diagramDecisions.slice(1)];
  assert.throws(
    () => collectDiagramInventory(root, revision, changed({ reason: '' })),
    /semantic reason/
  );
  assert.throws(
    () => collectDiagramInventory(root, revision, changed({ editableSource: 'missing.mjs' })),
    /ordinary tracked file/
  );
  assert.throws(() => collectDiagramInventory(root, 'HEAD'), /full commit SHA/);
});

test('generated ownership and author-held source limitations remain explicit', () => {
  for (const asset of inventory.assets.filter((asset) => asset.kind === 'generated')) {
    assert.equal(asset.editableSource.path, 'apps/www/scripts/generate-whitepaper-diagrams.mjs');
    if (asset.asset.includes('.mobile.')) assert.equal(asset.entrypoint, 'evolutionMobile');
  }
  for (const asset of inventory.assets.filter((asset) => asset.kind === 'authored-export')) {
    assert.equal(asset.editableSource.path, asset.asset);
    assert.equal(asset.captureProfile, null);
    assert.match(asset.originalDrawing, /no original drawing hash/);
  }
  assert.equal(inventory.provenance.filter((entry) => entry.path.includes('/licenses/')).length, 4);
  assert.match(inventory.scope, /not visual, browser, assistive-technology or release acceptance/);
});

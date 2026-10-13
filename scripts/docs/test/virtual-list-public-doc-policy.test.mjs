import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { checkLibraryInventory } from '../check-public-docs.mjs';
import { publicDocPolicy } from '../public-doc-policy.mjs';

const root = new URL('../../../', import.meta.url);
const library = publicDocPolicy.libraries.find(({ id }) => id === 'base');
const manifest = JSON.parse(
  await fs.readFile(new URL('packages/prototypes/base/package.json', root), 'utf8')
);
const exportNames = ['./virtual-list/web', './virtual-list', './button'];
const exports = Object.fromEntries(
  exportNames.map((name) => {
    assert.ok(manifest.exports[name], `The public ${name} export must remain available.`);
    return [name, manifest.exports[name]];
  })
);
const inventory = (catalog) =>
  checkLibraryInventory({
    releaseVersion: '0.2.0',
    bom: { packages: [{ name: library.packageName }] },
    libraries: [library],
    manifests: new Map([[library.packageName, { exports }]]),
    catalog,
    overviewEntries: new Map([['base', []]]),
    sidebarSlugs: [library.overviewSlug],
  });

test('the Web materializer is excluded without exempting Virtual List or other components', async () => {
  const entry = await fs.readFile(
    new URL('packages/prototypes/base/src/virtual-list/web/index.ts', root),
    'utf8'
  );
  assert.equal(entry.trim(), "export { attachWebVirtualList } from '../web';");
  const classification = library.exportClassifications['./virtual-list/web'];
  assert.equal(classification?.kind, 'non-component');
  assert.match(classification.reason, /Web.*materializ/);
  assert.equal(library.exportClassifications['./virtual-list'], undefined);

  const errors = inventory([]);
  assert.equal(errors.length, 2);
  assert.match(errors[0], /\.\/virtual-list: unclassified family\/export.*P-BASE-VIRTUAL-LIST\./);
  assert.match(errors[1], /\.\/button: unclassified family\/export.*P-BASE-BUTTON\./);
});

test('a cataloged Virtual List still requires its overview and sidebar projections', () => {
  const errors = inventory([{ id: 'P-BASE-VIRTUAL-LIST', since: '0.2.0', status: 'draft' }]);
  assert.equal(errors.length, 3);
  assert.match(errors[0], /\.\/virtual-list:.*absent from the base overview inventory/);
  assert.match(errors[1], /\.\/virtual-list:.*absent from primary sidebar slug/);
  assert.match(errors[2], /\.\/button: unclassified family\/export.*P-BASE-BUTTON\./);
});

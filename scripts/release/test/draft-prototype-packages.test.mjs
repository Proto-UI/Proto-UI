import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  DRAFT_FAMILIES,
  DRAFT_VERSION,
  draftExports,
  localManifest,
} from '../../build/draft-prototype-packages.mjs';
import { ROOT_DIR, getPublicPackages } from '../../build/public-packages.mjs';

for (const family of DRAFT_FAMILIES) {
  test(`${family} retains source-only admission while producing real dist targets`, () => {
    const manifest = JSON.parse(
      readFileSync(join(ROOT_DIR, 'packages/prototypes', family, 'package.json'), 'utf8')
    );
    const before = JSON.stringify(manifest);
    const exports = draftExports(manifest);
    for (const entry of [
      'label',
      'field',
      'collapsible',
      'accordion',
      'button',
      'select',
      'surface',
      'text',
    ]) {
      assert.deepEqual(exports[`./${entry}`], {
        types: `./dist/${entry}/index.d.ts`,
        import: `./dist/${entry}/index.js`,
        default: `./dist/${entry}/index.js`,
      });
    }
    assert.equal(JSON.stringify(manifest), before);
    assert.ok(!getPublicPackages().some((pkg) => pkg.name === manifest.name));
    assert.match(manifest.scripts['build:draft'], /draft-prototype-packages\.mjs/);
    assert.match(manifest.scripts['pack:draft'], /--pack$/);
  });
}

test('only guarded private source manifests can be converted', () => {
  const source = {
    private: true,
    protoUi: { release: { scan: false } },
    exports: { '.': { types: './src/index.ts', default: './src/index.ts' } },
  };
  assert.throws(() => draftExports({ ...source, private: false }), /private:true/);
  assert.throws(() => draftExports({ ...source, protoUi: {} }), /release.scan:false/);
  for (const target of ['./src/../../escape.ts', './dist/index.js', './src/*.ts']) {
    assert.throws(
      () => draftExports({ ...source, exports: { '.': { types: target, default: target } } }),
      /Unsupported/
    );
  }
});

test('local manifests prevent publishing and execution and pin the complete workspace closure', () => {
  const manifest = {
    name: '@proto.ui/test',
    scripts: { prepack: 'bad', postinstall: 'bad' },
    publishConfig: { access: 'public' },
    dependencies: { '@proto.ui/core': 'workspace:*' },
  };
  const versions = new Map([
    [manifest.name, DRAFT_VERSION],
    ['@proto.ui/core', DRAFT_VERSION],
  ]);
  const local = localManifest(manifest, versions, {
    '.': { types: './dist/index.d.ts', import: './dist/index.js', default: './dist/index.js' },
  });
  assert.equal(local.private, true);
  assert.equal(local.protoUi.release.scan, false);
  assert.equal(local.protoUi.distribution.publicAdmission, false);
  assert.equal(local.dependencies['@proto.ui/core'], DRAFT_VERSION);
  assert.equal(local.scripts, undefined);
  assert.equal(local.publishConfig, undefined);
  assert.throws(
    () => localManifest(manifest, new Map([[manifest.name, DRAFT_VERSION]])),
    /Unstaged workspace dependency/
  );
});

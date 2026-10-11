import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { buildPublicPackage, publicPackageSourceEntries } from '../../build/public-packages.mjs';

function fixture() {
  const dir = mkdtempSync(path.join(tmpdir(), 'pui-export-roots-'));
  mkdirSync(path.join(dir, 'src', 'host'), { recursive: true });
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ type: 'module' }));
  writeFileSync(path.join(dir, 'src', 'index.ts'), 'export const root = 1;\n');
  writeFileSync(
    path.join(dir, 'src', 'host', 'leaf.ts'),
    'export const leaf = (value: string): string => value;\n'
  );
  return {
    name: '@proto.ui/export-roots-test',
    dir,
    manifest: {
      exports: {
        '.': { types: './dist/index.d.ts', import: './dist/index.js', default: './dist/index.js' },
        './internal/leaf': {
          types: './dist/host/leaf.d.ts',
          import: './dist/host/leaf.js',
          default: './dist/host/leaf.js',
        },
      },
    },
    dispose() {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

test('compiles and JavaScript-smokes declared leaf exports without a barrel edge', () => {
  const pkg = fixture();
  try {
    assert.deepEqual(publicPackageSourceEntries(pkg), [
      path.join(pkg.dir, 'src/index.ts'),
      path.join(pkg.dir, 'src/host/leaf.ts'),
    ]);
    buildPublicPackage(pkg);
    assert.match(
      readFileSync(path.join(pkg.dir, 'dist/host/leaf.js'), 'utf8'),
      /export const leaf/
    );
    assert.doesNotMatch(readFileSync(path.join(pkg.dir, 'dist/index.js'), 'utf8'), /leaf/);
  } finally {
    pkg.dispose();
  }
});

test('refuses a declared export with no source instead of preserving stale dist output', () => {
  const pkg = fixture();
  try {
    pkg.manifest.exports['./missing'] = { import: './dist/missing.js' };
    assert.throws(() => publicPackageSourceEntries(pkg), /missing source for explicit export/);
  } finally {
    pkg.dispose();
  }
});

test('refuses source traversal and does not treat wildcard exports as literal roots', () => {
  const pkg = fixture();
  try {
    pkg.manifest.exports['./wild/*'] = { import: './dist/wild/*.js' };
    assert.equal(publicPackageSourceEntries(pkg).length, 2);
    pkg.manifest.exports['./escape'] = { import: './dist/../outside.js' };
    assert.throws(() => publicPackageSourceEntries(pkg), /escapes its source/);
  } finally {
    pkg.dispose();
  }
});

test('declaration-only roots retain missing-source, wildcard and traversal boundaries', () => {
  const pkg = fixture();
  try {
    pkg.manifest.exports['./wild-types/*'] = { types: './dist/wild/*.d.ts' };
    assert.equal(publicPackageSourceEntries(pkg).length, 2);
    pkg.manifest.exports['./missing-types'] = { types: './dist/missing.d.ts' };
    assert.throws(() => publicPackageSourceEntries(pkg), /missing source for explicit export/);
    delete pkg.manifest.exports['./missing-types'];
    pkg.manifest.exports['./escape-types'] = { types: './dist/../outside.d.ts' };
    assert.throws(() => publicPackageSourceEntries(pkg), /escapes its source/);
  } finally {
    pkg.dispose();
  }
});

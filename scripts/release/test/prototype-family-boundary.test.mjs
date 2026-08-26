import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const BASE_ROOT = join(ROOT_DIR, 'packages', 'prototypes', 'base');
const SHADCN_ROOT = join(ROOT_DIR, 'packages', 'prototypes', 'shadcn');
const BRUTALIST_ROOT = join(ROOT_DIR, 'packages', 'prototypes', 'brutalist');
const BASE_COMPONENT_FAMILIES = new Set([
  'button',
  'checkbox',
  'dialog',
  'dropdown',
  'hover-card',
  'select',
  'switch',
  'tabs',
  'toggle',
]);
const BASE_FAMILIES = new Set([
  'async-region',
  'button',
  'checkbox',
  'dialog',
  'dropdown',
  'hover-card',
  'live-region',
  'scroll-area',
  'select',
  'separator',
  'switch',
  'tabs',
  'textarea',
  'toggle',
  'tooltip',
  'transition',
]);
const SHADCN_FAMILIES = new Set([
  'button',
  'dialog',
  'dropdown',
  'hover-card',
  'select',
  'switch',
  'tabs',
  'toggle',
]);
const BRUTALIST_FAMILIES = new Set([
  'badge',
  'button',
  'card',
  'dialog',
  'dropdown',
  'hover-card',
  'scroll-area',
  'select',
  'separator',
  'skeleton',
  'switch',
  'tabs',
  'textarea',
  'toggle',
  'tooltip',
]);

test('prototype packages expose side-effect-free family entry points', () => {
  assertFamilyExports(BASE_ROOT, BASE_FAMILIES);
  assertFamilyExports(SHADCN_ROOT, SHADCN_FAMILIES);
  assertFamilyExports(BRUTALIST_ROOT, BRUTALIST_FAMILIES);
});

test('Brutalist Tooltip exports only the reviewed root and family subpath', () => {
  const manifest = JSON.parse(readFileSync(join(BRUTALIST_ROOT, 'package.json'), 'utf8'));
  assert.deepEqual(manifest.exports['./tooltip'], {
    types: './dist/tooltip/index.d.ts',
    import: './dist/tooltip/index.js',
    default: './dist/tooltip/index.js',
  });
  assert.equal(
    Object.keys(manifest.exports).some(
      (key) => key.includes('/src') || key.startsWith('./tooltip/')
    ),
    false
  );
});

test('built Brutalist Tooltip root and subpath expose the exact four entries', async () => {
  const { pathToFileURL } = await import('node:url');
  const { execSync } = await import('node:child_process');
  // Always rebuild to validate current source, never stale dist artifacts.
  execSync('corepack pnpm@10.32.1 --filter @proto.ui/prototypes-brutalist build', {
    cwd: ROOT_DIR,
    stdio: 'pipe',
    timeout: 60_000,
  });
  const distRoot = join(BRUTALIST_ROOT, 'dist');
  const rootModule = await import(pathToFileURL(join(distRoot, 'index.js')).href);
  const tooltipModule = await import(pathToFileURL(join(distRoot, 'tooltip', 'index.js')).href);
  const expected = [
    'BrutalistTooltipGroup',
    'BrutalistTooltipRoot',
    'BrutalistTooltipTrigger',
    'BrutalistTooltipContent',
  ];
  for (const name of expected) {
    assert.ok(rootModule[name], `root barrel must export ${name}`);
    assert.ok(tooltipModule[name], `./tooltip subpath must export ${name}`);
  }
  // Root barrel may export other Brutalist families; assert the four Tooltip entries are present.
  for (const name of expected) {
    assert.ok(rootModule[name], `root barrel must export ${name}`);
  }
  const tooltipKeys = Object.keys(tooltipModule).filter((k) => k.startsWith('Brutalist'));
  assert.deepEqual(
    tooltipKeys.sort(),
    expected.sort(),
    './tooltip subpath must expose only the four Tooltip entries'
  );
});

test('Base component families do not import sibling component families', () => {
  for (const file of listTypeScriptFiles(join(BASE_ROOT, 'src'))) {
    const sourceFamily = relative(join(BASE_ROOT, 'src'), file).split(sep)[0];
    if (!BASE_COMPONENT_FAMILIES.has(sourceFamily)) continue;

    for (const specifier of readImportSpecifiers(file)) {
      const match = specifier.match(/^\.\.\/([^/]+)/);
      if (!match || !BASE_COMPONENT_FAMILIES.has(match[1])) continue;
      assert.equal(
        match[1],
        sourceFamily,
        `${relative(ROOT_DIR, file)} imports sibling Base family ${match[1]}`
      );
    }
  }
});

test('Shadcn families depend only on their corresponding Base family', () => {
  for (const file of listTypeScriptFiles(join(SHADCN_ROOT, 'src'))) {
    const sourceFamily = relative(join(SHADCN_ROOT, 'src'), file).split(sep)[0];
    if (!SHADCN_FAMILIES.has(sourceFamily)) continue;

    for (const specifier of readImportSpecifiers(file)) {
      assert.notEqual(
        specifier,
        '@proto.ui/prototypes-base',
        `${relative(ROOT_DIR, file)} imports the Base root barrel`
      );
      assert.ok(
        !specifier.startsWith('@proto.ui/prototypes-shadcn'),
        `${relative(ROOT_DIR, file)} imports another Shadcn module: ${specifier}`
      );
      if (!specifier.startsWith('@proto.ui/prototypes-base/')) continue;
      assert.equal(
        specifier,
        `@proto.ui/prototypes-base/${sourceFamily}`,
        `${relative(ROOT_DIR, file)} imports a non-corresponding Base family: ${specifier}`
      );
    }
  }
});

function assertFamilyExports(packageRoot, families) {
  const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
  assert.equal(manifest.sideEffects, false, `${manifest.name} must declare sideEffects=false`);
  for (const family of families) {
    assert.deepEqual(manifest.exports[`./${family}`], {
      types: `./dist/${family}/index.d.ts`,
      import: `./dist/${family}/index.js`,
      default: `./dist/${family}/index.js`,
    });
  }
}

function listTypeScriptFiles(root) {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => join(entry.parentPath, entry.name));
}

function readImportSpecifiers(file) {
  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
}

import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { buildPublicPackage } from '../../build/public-packages.mjs';

test('public builds rewrite module syntax while preserving literal and template values', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'proto-runtime-specifiers-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const source = join(directory, 'src');
  mkdirSync(join(source, 'nested'), { recursive: true });
  writeFileSync(join(directory, 'package.json'), '{"type":"module"}');
  writeFileSync(
    join(source, 'helper.ts'),
    'export const value = 7; export type Value = { value: number };'
  );
  writeFileSync(join(source, 'nested/index.ts'), 'export const nested = 9;');
  writeFileSync(join(source, 'side-effect.ts'), 'export const loaded = true;');
  writeFileSync(
    join(source, 'index.ts'),
    [
      "export { value } from './helper';",
      "export * from './nested';",
      "import './side-effect';",
      `export const text = "from './helper'";`,
      "export const example = `Example: import('./helper')`;",
      `export const sideEffectText = "import './side-effect'";`,
      "export const load = () => import('./helper');",
      'export const loadTemplate = () => import(`./helper`);',
      "export type Value = import('./helper').Value;",
      "// Example: export { value } from './helper'",
    ].join('\n')
  );
  const pkg = {
    name: '@example/runtime-specifiers',
    dir: directory,
    manifest: { exports: { '.': { import: './dist/index.js', types: './dist/index.d.ts' } } },
  };
  buildPublicPackage(pkg);
  const built = await import(pathToFileURL(join(directory, 'dist/index.js')).href);
  assert.equal(built.text, "from './helper'");
  assert.equal(built.example, "Example: import('./helper')");
  assert.equal(built.sideEffectText, "import './side-effect'");
  assert.equal(built.value, 7);
  assert.equal(built.nested, 9);
  assert.equal((await built.load()).value, 7);
  assert.equal((await built.loadTemplate()).value, 7);
  assert.match(
    readFileSync(join(directory, 'dist/index.js'), 'utf8'),
    /\/\/ Example: export \{ value \} from '\.\/helper'/
  );
  const declarations = readFileSync(join(directory, 'dist/index.d.ts'), 'utf8');
  assert.match(declarations, /import\(["']\.\/helper\.js["']\)\.Value/);
  assert.ok(declarations.includes('"from \'./helper\'"'));
});

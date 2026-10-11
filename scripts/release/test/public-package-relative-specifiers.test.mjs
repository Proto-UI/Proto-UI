import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { buildPublicPackage, ROOT_DIR } from '../../build/public-packages.mjs';

test('built ESM and declarations resolve bare relative directories for strict consumers', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'pui-relative-specifiers-'));
  try {
    mkdirSync(path.join(dir, 'src', 'child'), { recursive: true });
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ type: 'module' }));
    writeFileSync(
      path.join(dir, 'src/index.ts'),
      'export type Root = string;\nexport const root = 1;\n'
    );
    writeFileSync(path.join(dir, 'src/child/index.ts'), 'export const child = 2;\n');
    writeFileSync(
      path.join(dir, 'src/child/leaf.ts'),
      `
import { root } from '..';
import { child } from '.';
import '..';
import '.';
export type Parent = import('..').Root;
export type Child = typeof import('.').child;
export const value = () => root + child;
export const load = async () => (await import('..')).root + (await import('.')).child;
`
    );
    const pkg = {
      name: '@proto.ui/relative-specifiers-test',
      dir,
      manifest: {
        exports: {
          '.': { types: './dist/index.d.ts', import: './dist/index.js' },
          './child/leaf': { types: './dist/child/leaf.d.ts', import: './dist/child/leaf.js' },
        },
      },
    };
    // The native JS smoke also rejects unresolved static directory imports.
    buildPublicPackage(pkg);
    const declaration = readFileSync(path.join(dir, 'dist/child/leaf.d.ts'), 'utf8');
    assert.match(declaration, /import\(['"]\.\.\/index\.js['"]\)/);
    assert.match(declaration, /import\(['"]\.\/index\.js['"]\)/);
    const runtime = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `import {value, load} from './dist/child/leaf.js'; if(value() !== 3 || await load() !== 3) throw Error('incorrect value');`,
      ],
      { cwd: dir, encoding: 'utf8' }
    );
    assert.equal(runtime.status, 0, runtime.stderr);
    writeFileSync(
      path.join(dir, 'consumer.ts'),
      `
import {value, load, type Parent, type Child} from './dist/child/leaf.js';
const parent: Parent = 'parent';
const child: Child = 2;
const result: number = value();
const eventual: Promise<number> = load();
void [parent, child, result, eventual];
`
    );
    for (const mode of ['NodeNext', 'Bundler']) {
      writeFileSync(
        path.join(dir, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            target: 'ES2022',
            module: mode === 'NodeNext' ? mode : 'ESNext',
            moduleResolution: mode,
            strict: true,
            skipLibCheck: false,
            noEmit: true,
            types: [],
          },
          files: ['consumer.ts'],
        })
      );
      const result = spawnSync(
        process.execPath,
        [path.join(ROOT_DIR, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'],
        { cwd: dir, encoding: 'utf8' }
      );
      assert.equal(result.status, 0, `${mode}: ${result.stdout}\n${result.stderr}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const source = `import {definePrototype,createContextKey,createAnatomyFamily} from '@proto.ui/core';
const KEY=createContextKey<{value:number}>('entry-context');
const FAMILY=createAnatomyFamily('entry-family',{roles:{root:{cardinality:{min:1,max:1}}}});
export default definePrototype({name:'entry-order',setup(def){
  def.context.provide(KEY,{value:3});
  def.anatomy.claim(FAMILY,{role:'root'});
  return r=>r.el('output',r.read.context.read(KEY).value);
}});`;

const entryOrders = [
  { name: 'targets before the public API', entries: ['src/targets.ts', 'src/index.ts'] },
  {
    name: 'static declarations before the source graph',
    entries: ['src/static-declarations.ts', 'src/parser-module.ts', 'src/index.ts'],
  },
  {
    name: 'the source graph before targets',
    entries: ['src/parser-module.ts', 'src/targets.ts', 'src/index.ts'],
  },
  {
    name: 'source value and type readers before the public API',
    entries: ['src/source-values.ts', 'src/source-types.ts', 'src/index.ts'],
  },
  {
    name: 'targets before the SSR fixture',
    entries: ['src/targets.ts', 'test/button-ssr-fixture.ts'],
  },
  {
    name: 'the SSR fixture before targets',
    entries: ['test/button-ssr-fixture.ts', 'src/targets.ts'],
  },
];

describe('compiler entry initialization', () => {
  it.each(entryOrders)(
    'initializes $name in a fresh Node process',
    ({ entries }) => {
      // A shared Vitest module cache masks this failure. Each process evaluates the actual ESM
      // graph from its first entry; importing the SSR fixture never builds or starts a browser.
      const script = `
      import assert from 'node:assert/strict';
      for (const entry of ${JSON.stringify(entries)}) {
        const imported = await import('./packages/compiler/' + entry);
        if (entry.endsWith('button-ssr-fixture.ts'))
          assert.equal(typeof imported.buildButtonSsrFixture, 'function');
      }
      const declarations = await import('./packages/compiler/src/static-declarations.ts');
      assert.equal(declarations.STATIC_CAPABILITY_FACTORIES.createAnatomyFamily, 'anatomy-family');
      const compiler = await import('./packages/compiler/src/index.ts');
      assert.equal(compiler.resolveTargetProfile('react-dom-source-v1').ok, true);
      const result = compiler.compilePrototype(${JSON.stringify(source)}, {
        fileName: 'entry.proto.ts', profile: 'react-dom-source-v1'
      });
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.deepEqual(result.value.ir.staticDeclarations.map(value => value.kind), ['anatomy-family']);
      assert.equal(result.value.output.profile, 'react-dom-source-v1');
      process.stdout.write('compiler-entry-ready');
    `;
      const result = spawnSync(
        process.execPath,
        ['--import', 'tsx', '--input-type=module', '--eval', script],
        {
          cwd: repositoryRoot,
          encoding: 'utf8',
          timeout: 20_000,
        }
      );
      if (result.error) throw result.error;
      expect(result.signal, result.stderr).toBeNull();
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toBe('compiler-entry-ready');
    },
    25_000
  );
});

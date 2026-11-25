import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { beforeAll, describe, expect, it } from 'vitest';
import { createBrowserAuthoringEnvironment } from '../../../scripts/compiler/browser-authoring.mjs';
import { createCompiler } from '../src';
import { compileBrowserRequest } from '../src/browser/engine';
import type { BrowserAuthoringEnvironment, BrowserCompileRequest } from '../src/browser/protocol';

let environment: BrowserAuthoringEnvironment;
beforeAll(async () => {
  environment = (await createBrowserAuthoringEnvironment()).environment;
});
const request = (
  source: string,
  options: Partial<BrowserCompileRequest['options']> = {}
): BrowserCompileRequest => ({
  format: 2,
  revision: 'first',
  source,
  preview: true,
  options: { target: 'react', fileName: 'entry.proto.ts', ...options },
});

describe('Browser memory Program and shared AST pipeline', () => {
  for (const family of ['text', 'surface']) {
    it('compiles actual Base ' + family + ' source to the same React AST as Node', async () => {
      const entry = 'packages/prototypes/base/src/' + family + '/root.proto.ts';
      const types = 'packages/prototypes/base/src/' + family + '/types.ts';
      const source = readFileSync(path.resolve(entry), 'utf8');
      const output = await compileBrowserRequest(
        request(source, {
          fileName: entry,
          files: { [types]: readFileSync(path.resolve(types), 'utf8') },
        }),
        environment
      );
      expect(output.ok, JSON.stringify(output)).toBe(true);
      const native = createCompiler({ rootDir: process.cwd() }).compileFile(entry, {
        target: 'react',
        exportName: 'default',
      });
      expect(native.ok, JSON.stringify(native.diagnostics)).toBe(true);
      if (!output.ok || !native.ok) return;
      expect(output.output.code).toBe(native.value.primary!.react.code);
      expect(output.output.target).toBe('react');
      expect(output.output.dependencies.map((value) => value.name)).toEqual(['react']);
      expect(Object.keys(output.preview!.modules)).toEqual(['pui:compiled/component']);
      expect(output.preview!.execution).toBe('native-react');
      const tree = ts.createSourceFile(
        'out.js',
        output.preview!.modules[output.preview!.entry],
        ts.ScriptTarget.Latest,
        true
      );
      expect(
        tree.statements
          .filter(ts.isImportDeclaration)
          .map((node) => (node.moduleSpecifier as ts.StringLiteral).text)
      ).toEqual(['react']);
    });
  }

  it('reports unlowered source effects without evaluating them', async () => {
    const source = `import {definePrototype} from '@proto.ui/core';
      (globalThis as any).browserAuthoredSideEffect = true;
      export default definePrototype({name:'effect',setup(){return r=>r.el('div','ok');}});`;
    const output = await compileBrowserRequest(request(source), environment);
    expect(output.ok).toBe(false);
    expect(
      output.ok
        ? []
        : output.phase === 'compile'
          ? output.diagnostics.map((issue) => issue.code)
          : []
    ).toContain('PUI_REACT_UNSUPPORTED');
    expect(Reflect.get(globalThis, 'browserAuthoredSideEffect')).toBeUndefined();
  });

  it('keeps core definitions immutable and rejects non-browser targets honestly', async () => {
    const source = `import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'memory',setup(){return r=>r.el('div','ok');}});`;
    for (const target of ['gpui', 'kernel', 'web-component', 'vue', 'vue2']) {
      const output = await compileBrowserRequest(request(source, { target }), environment);
      expect(output.ok).toBe(false);
      if (!output.ok && output.phase === 'compile')
        expect(output.diagnostics[0].code).toBe('PUI_BROWSER_TARGET_UNSUPPORTED');
      else throw new Error('Unsupported target must produce a compilation diagnostic.');
    }
    const attacks: Partial<BrowserCompileRequest['options']>[] = [
      {
        files: {
          'packages/core/src/prototype.ts': 'export const definePrototype = (x: unknown) => x;',
        },
      },
      {
        files: { 'fake.ts': 'export const definePrototype = (x: unknown) => x;' },
        sourceImports: { '@proto.ui/core': 'fake.ts' },
      },
    ];
    for (const options of attacks) {
      const output = await compileBrowserRequest(request(source, options), environment);
      expect(output.ok).toBe(false);
      if (!output.ok && output.phase === 'host') expect(output.error.code).toBe('invalid-request');
      else throw new Error('An authored source cannot impersonate trusted core definitions.');
    }
    const legacy = await compileBrowserRequest(
      {
        format: 1,
        source,
        revision: 'old',
        options: { profile: 'react-dom-source-v1', fileName: 'old.proto.ts' },
      },
      environment
    );
    expect(legacy.ok).toBe(false);
  });

  it('uses real TypeScript bindings and emits scalar update callbacks', async () => {
    const source = `import {definePrototype as define} from '@proto.ui/core';
      export default define({name:'counter',setup(def){
        const count=def.state.numberDiscrete('count',0);
        def.event.on('host:click',(run)=>{count.set(count.get()+1);run.update();});
        return r=>r.el('div',count.get());
      }});`;
    const output = await compileBrowserRequest(request(source), environment);
    expect(output.ok, JSON.stringify(output)).toBe(true);
    if (output.ok) {
      expect(output.output.code).toContain('_requestUpdate');
      expect(output.output.code).not.toContain('@proto.ui');
    }
  });
});

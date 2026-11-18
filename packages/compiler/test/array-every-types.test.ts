// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { compilePrototype, writeCompilation } from '../src/compile';
import { generatedSourcePath } from '../src/emitter-map';

const root = process.cwd();
const source = `import{definePrototype}from'@proto.ui/core';
  import{asFocusable}from'@proto.ui/hooks';
  export default definePrototype({name:'typed-every',setup(def){
    const values=[4,5];let total=0;
    values.every((value,index,items)=>{total+=value+index+items.length;return true;});
    [1,2].every((value:number,index?:number)=>{if(index)asFocusable();return true;});
    const fallback=()=>9;
    const defaults=values.every((value:number,index:number=fallback(),items:number[],extra:number=7)=>value+index+extra>items.length);
    def.expose.value('result',{total,defaults,all:values.every(()=>true)});
    return r=>r.el('button','typed every');
  }});`;

for (const profile of [
  'react-dom-source-v1',
  'vue-source-v1',
  'vue2-source-v1',
  'web-component-source-v1',
] as const)
  it(`checks the complete Array.every artifact graph as strict ${profile}`, async () => {
    const compiled = compilePrototype(source, { profile });
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
    const base = path.join(root, 'packages/compiler/test/generated-modules');
    await mkdir(base, { recursive: true });
    const temporary = await mkdtemp(path.join(base, 'typed-array-every-'));
    const output = path.join(temporary, 'output');
    try {
      const written = await writeCompilation(compiled.value, output);
      if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
      const config = JSON.parse(await readFile(path.join(root, 'tsconfig.json'), 'utf8'));
      const parsed = ts.parseJsonConfigFileContent(config, ts.sys, root);
      const names = [
        path.join(output, generatedSourcePath(profile)),
        ...(compiled.value.output.supportingFiles ?? [])
          .filter((file) => /\.[cm]?[jt]sx?$/.test(file.path))
          .map((file) => path.join(output, file.path)),
      ];
      const program = ts.createProgram(names, {
        ...parsed.options,
        strict: true,
        noEmit: true,
        allowJs: true,
        checkJs: true,
        skipLibCheck: true,
        paths: {
          ...parsed.options.paths,
          ...(profile === 'vue2-source-v1'
            ? { vue: [path.join(root, 'packages/adapters/vue2/node_modules/vue/types/index.d.ts')] }
            : {}),
        },
      });
      expect(
        ts.getPreEmitDiagnostics(program).map((diagnostic) => ({
          code: diagnostic.code,
          file: diagnostic.file?.fileName.replace(output, '<artifact>'),
          message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        }))
      ).toEqual([]);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }, 60_000);

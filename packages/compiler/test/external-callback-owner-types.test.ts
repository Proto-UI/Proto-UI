// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { compilePrototype, writeCompilation } from '../src/compile';
import { generatedSourcePath } from '../src/emitter-map';

const root = process.cwd();
const profiles = [
  'react-dom-source-v1',
  'vue-source-v1',
  'vue2-source-v1',
  'web-component-source-v1',
] as const;

const source = `import{definePrototype,type DefHandle}from'@proto.ui/core';
  const deliver=(accept:(step:()=>number)=>void,step:()=>number)=>accept(step);
  const deliverDefault=(accept:(step:()=>number)=>number,step:()=>number,result=accept(step))=>result;
  const create=(definition:DefHandle)=>definition.state.numberDiscrete('default-state',5);
  const register=(definition:DefHandle,created=create(definition))=>created;
  const direct=(definition:DefHandle,created=definition.state.numberDiscrete('direct-state',7))=>created;
  export default definePrototype({name:'typed-external-callback',setup(def){
    const state=register(def);const directState=direct(def);
    def.expose.value('defaultState',state.get()+directState.get());
    const forward=deliver;
    const forwardDefault=deliverDefault;
    const initialize=()=>{def.state.numberDiscrete('setup-proof',0);return 10;};
    forward(step=>{step();},initialize);
    const count=def.state.numberDiscrete('count',0);
    const step=()=>{count.set(count.get()+1);return count.get();};
    const record={nested:{step}};
    def.expose.method('send',(accept:(step:()=>number)=>void)=>forward(accept,step));
    def.expose.method('default',(accept:(step:()=>number)=>number)=>forwardDefault(accept,step));
    def.expose.method('optional',(accept?:(value:{nested:{step:()=>number}})=>void)=>accept?.(record));
    def.expose.method('member',(sink:{accept:(step:()=>number)=>void})=>sink.accept(step));
    return r=>r.el('output',[r.slot()]);
  }});`;

for (const profile of profiles)
  it(`checks the full external-callback artifact closure as strict ${profile}`, async () => {
    const compiled = compilePrototype(source, { profile });
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
    const base = path.join(root, 'packages/compiler/test/generated-modules');
    await mkdir(base, { recursive: true });
    const temporary = await mkdtemp(path.join(base, 'typed-external-callback-'));
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
            ? {
                vue: [path.join(root, 'packages/adapters/vue2/node_modules/vue/types/index.d.ts')],
              }
            : {}),
        },
      });
      const diagnostics = ts.getPreEmitDiagnostics(program).map((diagnostic) => ({
        code: diagnostic.code,
        file: diagnostic.file?.fileName.replace(output, '<artifact>'),
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
      }));
      expect(diagnostics).toEqual([]);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }, 60_000);

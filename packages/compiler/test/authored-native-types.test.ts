// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { compilePrototype, writeCompilation, type Compilation } from '../src/compile';
import { generatedSourcePath } from '../src/emitter-map';

const root = process.cwd();
const profiles = [
  'react-runtime-v1',
  'react-dom-source-v1',
  'vue-source-v1',
  'vue2-source-v1',
  'web-component-source-v1',
] as const;
for (const profile of profiles)
  it(`checks the complete authored Transition and support closure as a strict ${profile} consumer`, async () => {
    const files: Record<string, string> = {};
    for (const name of ['as-transition.proto.ts', 'machine.ts', 'types.ts'])
      files[`transition/${name}`] = await readFile(
        path.join(root, 'packages/prototypes/base/src/transition', name),
        'utf8'
      );
    const compiled = compilePrototype(
      `import {definePrototype} from '@proto.ui/core';
import {asTransition} from './transition/as-transition.proto';
export default definePrototype({name:'strict-authored-consumer',setup(def){
  const handle=asTransition(); handle.configure({enterDuration:10,leaveDuration:7});
  return renderer=>renderer.el('section',[handle.transitionState.get(),renderer.slot()]);
}});`,
      { profile, fileName: 'entry.proto.ts', files }
    );
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
    await checkStrictArtifact(compiled.value);
  }, 60_000);

async function checkStrictArtifact(compiled: Compilation) {
  const base = path.join(root, 'packages/compiler/test/generated-modules');
  await mkdir(base, { recursive: true });
  const temporary = await mkdtemp(path.join(base, 'typed-authored-'));
  const output = path.join(temporary, 'output');
  try {
    const written = await writeCompilation(compiled, output);
    if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
    const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
    const names = [
      path.join(output, generatedSourcePath(compiled.output.profile)),
      ...(compiled.output.supportingFiles ?? [])
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
        ...(compiled.output.profile === 'vue2-source-v1'
          ? {
              'vue': [path.join(root, 'packages/adapters/vue2/node_modules/vue/types/index.d.ts')],
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
}

for (const profile of profiles)
  it(`checks public higher-order results and pruned closure transport as strict ${profile}`, async () => {
    const compiled = compilePrototype(
      `import {definePrototype} from '@proto.ui/core';
import {asOverlay} from '@proto.ui/hooks';
export default definePrototype({name:'strict-ordinary-boundaries',setup(def){
  let unused=()=>asOverlay();
  const boxed=()=>asOverlay(); const box={boxed};
  const create=()=>()=>asOverlay(); const ignored=create();
  const ignore=(callback:()=>void)=>{}; ignore(()=>{asOverlay();});
  let observed=0; const effectfulIgnore=(callback:()=>void)=>{observed+=1;};
  effectfulIgnore(()=>{asOverlay();});
  const useful={tag:1,unused:()=>asOverlay()};
  def.expose.value('ordinaryEffect',observed+useful.tag);
  const count=def.state.numberDiscrete('count',0);
  const next=()=>{count.set(count.get()+1);return count.get();};
  const shared={next};
  def.expose.value('first',shared);def.expose.value('second',shared);
  def.expose.value('create',()=>({next}));
  def.expose.method('factory',()=>next);
  def.expose.method('recordFactory',()=>shared);
  return r=>r.el('output',[r.slot()]);
}});`,
      { profile }
    );
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
    expect(compiled.value.output.dependencies.map((value) => value.name)).not.toContain(
      '@floating-ui/dom'
    );
    expect(
      compiled.value.output.supportingFiles?.filter((file) =>
        file.path.includes('/interaction/')
      ) ?? []
    ).toEqual([]);
    await checkStrictArtifact(compiled.value);
  }, 60_000);

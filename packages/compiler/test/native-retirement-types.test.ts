// @vitest-environment node
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { compilePrototype, writeCompilation } from '../src/compile';
import { generatedSourcePath } from '../src/emitter-map';

for (const profile of [
  'react-dom-source-v1',
  'vue-source-v1',
  'vue2-source-v1',
  'web-component-source-v1',
] as const) {
  it(`strictly checks composed Meta, Delay and Presence retirement in ${profile}`, async () => {
    const source = `import {definePrototype,delay,tw} from '@proto.ui/core';
export default definePrototype({name:'typed-resource-owner',setup(def){
  const owner=def.feedback.presence.owner();
  def.feedback.style.presence({owner:owner.ref,closed:{opacity:0},entered:{opacity:1},easing:[0,0,1,1]});
  def.feedback.style.use(tw('block'));
  def.rule({when:w=>w.meta('colorScheme').eq('dark'),intent:i=>i.feedback.style.use(tw('bg-black'))});
  def.rule({when:w=>w.meta('preference.forcedColors').eq('active'),intent:i=>i.feedback.style.use(tw('opacity-50'))});
  ${
    profile === 'react-dom-source-v1'
      ? `const target=def.feedback.style.declareDecoration();
  def.rule({when:w=>w.meta('viewport.width').gte(768),intent:i=>i.feedback.style.to(target).use(tw('opacity-100'))});`
      : ''
  }
  def.lifecycle.onCreated(()=>{delay(10,()=>{});});
  return r=>${profile === 'react-dom-source-v1' ? '[r.decoration(target),r.slot()]' : 'r.slot()'};
}});`;
    const compiled = compilePrototype(source, { profile });
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
    const root = process.cwd(),
      parent = path.join(root, 'packages/compiler/test/generated-modules');
    await mkdir(parent, { recursive: true });
    const directory = await mkdtemp(path.join(parent, 'retirement-types-'));
    const output = path.join(directory, 'output');
    try {
      const written = await writeCompilation(compiled.value, output);
      if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
      const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
      const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
      const files = [
        path.join(output, generatedSourcePath(profile)),
        ...(compiled.value.output.supportingFiles ?? [])
          .filter((file) => /\.[cm]?[jt]sx?$/.test(file.path))
          .map((file) => path.join(output, file.path)),
      ];
      const program = ts.createProgram(files, {
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
      await rm(directory, { recursive: true, force: true });
    }
  }, 60_000);
}

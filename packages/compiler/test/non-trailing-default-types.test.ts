// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { compilePrototype, writeCompilation } from '../src/compile';
import { generatedSourcePath } from '../src/emitter-map';

const root = process.cwd();
const profiles = [
  'react-dom-source-v1',
  'vue-source-v1',
  'vue2-source-v1',
  'web-component-source-v1',
] as const;
const bodies = {
  'called record member': `
    const box={run:(first:number=7,last:number)=>first+last};
    def.expose.value('result',{provided:box.run(2,3),defaulted:box.run(undefined,3)});
  `,
  'identity-observed uninvoked allocation': `
    let defaults=0;
    const fallback=()=>{defaults++;return 7;};
    const uncalled=(first:number=fallback(),last:number)=>first+last;
    const alias=uncalled;
    def.expose.value('result',{same:uncalled===alias,defaults});
  `,
};

for (const profile of profiles)
  describe(profile, () => {
    it.each(Object.entries(bodies))(
      'checks the complete non-trailing-default artifact graph for %s',
      async (kind, body) => {
        const compiled = compilePrototype(
          `import{definePrototype}from'@proto.ui/core';
            export default definePrototype({name:'non-trailing-default-types',setup(def){
              ${body}
              return r=>r.el('output','default parameter positions');
            }});`,
          { profile }
        );
        if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
        // Ensure the intended source allocation actually ships. An eliminated
        // uncalled function cannot demonstrate the uninvoked JSDoc path.
        const emitted = ts.createSourceFile(
          'generated.tsx',
          compiled.value.output.code,
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TSX
        );
        let allocations = 0;
        const visit = (node: ts.Node) => {
          if (
            ts.isArrowFunction(node) &&
            node.parameters.length === 2 &&
            node.parameters[0].name.getText(emitted) === 'first' &&
            node.parameters[1].name.getText(emitted) === 'last' &&
            node.parameters[0].initializer !== undefined
          )
            allocations++;
          ts.forEachChild(node, visit);
        };
        visit(emitted);
        expect(allocations, `${kind} must retain its real two-position allocation`).toBeGreaterThan(
          0
        );

        const base = path.join(root, 'packages/compiler/test/generated-modules');
        await mkdir(base, { recursive: true });
        const temporary = await mkdtemp(path.join(base, 'non-trailing-default-'));
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
                    vue: [
                      path.join(root, 'packages/adapters/vue2/node_modules/vue/types/index.d.ts'),
                    ],
                  }
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
      },
      60_000
    );
  });

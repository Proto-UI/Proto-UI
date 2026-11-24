// @vitest-environment node
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { compilePrototype, writeCompilation } from '../src/compile';
import { generatedSourcePath } from '../src/emitter-map';
import { lifecycleModuleSource } from './lifecycle-module-fixture';

for (const profile of [
  'react-dom-source-v1',
  'vue-source-v1',
  'vue2-source-v1',
  'web-component-source-v1',
] as const)
  it(`checks the lifecycle module's complete strict ${profile} artifact`, async () => {
    const result = compilePrototype(lifecycleModuleSource, { profile });
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    const root = process.cwd();
    const base = path.join(root, 'packages/compiler/test/generated-modules');
    await mkdir(base, { recursive: true });
    const temporary = await mkdtemp(path.join(base, 'lifecycle-module-types-'));
    const output = path.join(temporary, 'output');
    try {
      const written = await writeCompilation(result.value, output);
      if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
      const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
      const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
      const names = [
        path.join(output, generatedSourcePath(profile)),
        ...(result.value.output.supportingFiles ?? [])
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
        ts
          .getPreEmitDiagnostics(program)
          .map((d) => ({
            code: d.code,
            file: d.file?.fileName.replace(output, '<artifact>'),
            message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
          }))
      ).toEqual([]);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }, 60_000);

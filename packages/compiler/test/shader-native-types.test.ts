// @vitest-environment node
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { compilePrototype, writeCompilation } from '../src/compile';
import { generatedSourcePath } from '../src/emitter-map';
import { shaderVariantSource } from './shader-source-variants';

for (const profile of [
  'react-dom-source-v1',
  'vue-source-v1',
  'vue2-source-v1',
  'web-component-source-v1',
] as const)
  it(`${profile}: strict native consumers preserve copy-only, tint-only and combined interfaces`, async () => {
    const root = process.cwd(),
      base = path.join(root, 'packages/compiler/test/generated-modules');
    await mkdir(base, { recursive: true });
    const temporary = await mkdtemp(path.join(base, 'shader-types-'));
    try {
      const names: string[] = [];
      for (const kind of ['copy', 'tint', 'both'] as const) {
        const compiled = compilePrototype(shaderVariantSource(kind), { profile });
        if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
        const directory = path.join(temporary, kind),
          written = await writeCompilation(compiled.value, directory);
        if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
        names.push(
          path.join(directory, generatedSourcePath(profile)),
          ...(compiled.value.output.supportingFiles ?? [])
            .filter((file) => /\.[cm]?[jt]sx?$/.test(file.path))
            .map((file) => path.join(directory, file.path))
        );
      }
      const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile),
        parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
      const program = ts.createProgram(names, {
        ...parsed.options,
        strict: true,
        noEmit: true,
        allowJs: true,
        checkJs: true,
        skipLibCheck: false,
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
          .map((diagnostic) => ({
            code: diagnostic.code,
            file: diagnostic.file?.fileName.replace(temporary, '<artifact>'),
            message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
          }))
      ).toEqual([]);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }, 60_000);

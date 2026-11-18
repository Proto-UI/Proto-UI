// @vitest-environment happy-dom
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { afterEach, expect, it } from 'vitest';
import { nativeOwnerProfiles } from './native-owner-consumer';
import { cleanupScrollConsumers, mountScrollFamily } from './scroll-reveal-consumer';

afterEach(async () => {
  await cleanupScrollConsumers();
  document.body.replaceChildren();
});

for (const profile of nativeOwnerProfiles)
  it(`strictly checks the complete ordinary Scroll family graph as ${profile}`, async () => {
    const { output } = await mountScrollFamily(profile);
    const root = process.cwd();
    const config = JSON.parse(await readFile(path.join(root, 'tsconfig.json'), 'utf8'));
    const parsed = ts.parseJsonConfigFileContent(config, ts.sys, root);
    const names = (await readdir(output, { recursive: true }))
      .filter((file) => /\.[cm]?[jt]sx?$/.test(file))
      .map((file) => path.join(output, file));
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
    const diagnostics = ts.getPreEmitDiagnostics(program).map((diagnostic) => ({
      code: diagnostic.code,
      file: diagnostic.file?.fileName.replace(output, '<artifact>'),
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    }));
    expect(diagnostics).toEqual([]);
  }, 60_000);

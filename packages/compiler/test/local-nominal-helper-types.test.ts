// @vitest-environment node
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { compilePrototype, writeCompilation } from '../src/compile';
import { localNominalHelperSource } from './local-nominal-helper-fixture';
import { buildLocalTabsArtifact } from './local-tabs-artifact';

async function check(output: string, profile: string) {
  const root = process.cwd();
  const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const roots = (await readdir(output, { recursive: true }))
    .filter((file) => /\.[cm]?[jt]sx?$/.test(file))
    .map((file) => path.join(output, file));
  expect(roots.length).toBeGreaterThan(0);
  const program = ts.createProgram(roots, {
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
    ts.getPreEmitDiagnostics(program).map((d) => ({
      code: d.code,
      file: d.file?.fileName.replace(output, '<artifact>'),
      message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
    }))
  ).toEqual([]);
}

for (const profile of [
  'react-dom-source-v1',
  'vue-source-v1',
  'vue2-source-v1',
  'web-component-source-v1',
] as const) {
  it(`strictly checks the local helper's complete ${profile} artifact`, async () => {
    const result = compilePrototype(localNominalHelperSource, { profile });
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    const base = path.join(process.cwd(), 'packages/compiler/test/generated-modules');
    await mkdir(base, { recursive: true });
    const temporary = await mkdtemp(path.join(base, 'local-nominal-types-'));
    const output = path.join(temporary, 'output');
    try {
      const written = await writeCompilation(result.value, output);
      if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
      await check(output, profile);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }, 60_000);

  it(`strictly checks the real Tabs Content/provider ${profile} project`, async () => {
    const artifact = await buildLocalTabsArtifact(profile);
    try {
      await check(artifact.output, profile);
    } finally {
      await artifact.dispose();
    }
  }, 60_000);
}

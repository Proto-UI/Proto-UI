// @vitest-environment happy-dom
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { afterEach, expect, it } from 'vitest';
import { nativeOwnerProfiles } from './native-owner-consumer';
import { cleanupScrollConsumers, mountScrollFamily } from './scroll-reveal-consumer';

const copiedGraphs: string[] = [];
afterEach(async () => {
  await cleanupScrollConsumers();
  for (const directory of copiedGraphs.splice(0))
    await rm(directory, { recursive: true, force: true });
  document.body.replaceChildren();
});

async function graphFiles(directory: string) {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(directory, path.join(entry.parentPath, entry.name)))
    .sort();
  return Object.fromEntries(
    await Promise.all(
      files.map(async (file) => [
        file,
        createHash('sha256')
          .update(await readFile(path.join(directory, file)))
          .digest('hex'),
      ])
    )
  );
}

for (const profile of nativeOwnerProfiles)
  it(`strictly checks the complete applied-watcher Scroll graph as ${profile}`, async () => {
    const root = process.cwd();
    const capturedRoot = process.env.PUI_SCROLL_TO_END_GRAPH_DIR;
    let output: string;
    let capturedInput: Record<string, string> | undefined;
    if (capturedRoot) {
      const capturedOutput = path.join(capturedRoot, profile, 'output');
      capturedInput = await graphFiles(capturedOutput);
      const parent = path.join(root, 'packages/compiler/test/generated-modules');
      await mkdir(parent, { recursive: true });
      output = await mkdtemp(path.join(parent, 'scroll-to-end-strict-'));
      copiedGraphs.push(output);
      // Preserve every captured byte while resolving the real framework dependencies.
      await cp(capturedOutput, output, { recursive: true, force: false });
    } else {
      output = (
        await mountScrollFamily(profile, {
          appliedReveal: true,
          captureDirectory: process.env.PUI_SCROLL_TO_END_EVIDENCE_DIR,
        })
      ).output;
    }
    const before = await graphFiles(output);
    if (capturedInput) expect(before).toEqual(capturedInput);
    const config = JSON.parse(await readFile(path.join(root, 'tsconfig.json'), 'utf8'));
    const parsed = ts.parseJsonConfigFileContent(config, ts.sys, root);
    const names = Object.keys(before)
      .filter((file) => /\.[cm]?[jt]sx?$/.test(file))
      .map((file) => path.join(output, file));
    const options: ts.CompilerOptions = {
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
    };
    const program = ts.createProgram(names, options);
    const diagnostics = ts.getPreEmitDiagnostics(program).map((diagnostic) => ({
      code: diagnostic.code,
      category: diagnostic.category,
      file: diagnostic.file?.fileName.replace(output, '<artifact>'),
      start: diagnostic.start,
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    }));
    const after = await graphFiles(output);
    const capturedAfter = capturedRoot
      ? await graphFiles(path.join(capturedRoot, profile, 'output'))
      : undefined;
    const evidence = process.env.PUI_SCROLL_TO_END_STRICT_EVIDENCE_DIR;
    if (evidence) {
      await mkdir(evidence, { recursive: true });
      await writeFile(
        path.join(evidence, `${profile}.json`),
        JSON.stringify(
          {
            profile,
            input: capturedRoot ? 'exact captured ordinary graph' : 'fresh ordinary graph',
            capturedInput,
            capturedAfter,
            before,
            after,
            rootNames: names.map((file) => path.relative(output, file)),
            options,
            diagnostics,
          },
          null,
          2
        ),
        { flag: 'wx' }
      );
    }
    expect(after).toEqual(before);
    if (capturedInput) expect(capturedAfter).toEqual(capturedInput);
    expect(diagnostics).toEqual([]);
  }, 60_000);

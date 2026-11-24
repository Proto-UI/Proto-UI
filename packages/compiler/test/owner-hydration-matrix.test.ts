// @vitest-environment happy-dom
import { afterEach, beforeAll, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { buildOwnerMatrix } from './owner-hydration-matrix-build';
import { ownerMatrixCases } from './owner-hydration-matrix-fixture';
import { assertOwnerMatrix, assertServerOwnership } from './owner-hydration-matrix-assertions';
import type { createOwnerBrowserMatrix } from './owner-hydration-matrix-consumer';

let built: Awaited<ReturnType<typeof buildOwnerMatrix>>;
let matrix: ReturnType<typeof createOwnerBrowserMatrix>;
beforeAll(async () => {
  built = await buildOwnerMatrix();
  matrix = new Function(
    `${built.bundle}\nreturn OwnerBrowserMatrix;\n//# sourceURL=owner-matrix-preflight.js`
  )();
}, 60_000);
afterEach(async () => {
  await matrix?.dispose();
  document.body.replaceChildren();
});

it.each(ownerMatrixCases)(
  'preflights the actual $target $journey browser bundle in simulated DOM',
  async ({ target, journey }) => {
    const fixture = built.fixtures[`${target}/${journey}`];
    assertServerOwnership(fixture, journey);
    document.body.innerHTML = `<div id="owner-matrix-host">${fixture.html}</div>`;
    const observed = await matrix.run(target, journey, fixture);
    const final = await matrix.dispose();
    assertOwnerMatrix(journey, observed, final);
  },
  30_000
);

it('checks the complete actual Vue SSR artifact closure with strict TypeScript', async () => {
  const base = path.join(process.cwd(), 'packages/compiler/test/generated-modules');
  await mkdir(base, { recursive: true });
  const output = await mkdtemp(path.join(base, 'vue-owner-matrix-strict-'));
  try {
    const names: string[] = [];
    for (const [file, contents] of built.artifacts) {
      if (!file.startsWith('vue/')) continue;
      const target = path.join(output, file.slice('vue/'.length));
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, contents);
      if (/\.[cm]?[jt]sx?$/.test(file)) names.push(target);
    }
    const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
    const program = ts.createProgram(names, {
      ...parsed.options,
      strict: true,
      noEmit: true,
      allowJs: true,
      checkJs: true,
    });
    const diagnostics = ts.getPreEmitDiagnostics(program).map((diagnostic) => ({
      code: diagnostic.code,
      file: diagnostic.file?.fileName.replace(output, '<artifact>'),
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    }));
    expect(diagnostics, JSON.stringify(diagnostics, null, 2)).toEqual([]);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
}, 30_000);

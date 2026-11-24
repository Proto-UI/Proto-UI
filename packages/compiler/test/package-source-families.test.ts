// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { FileSourceGraph } from '../src/source-loader';

let root: string;
beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'shadcn-family-source-'));
  const prepared = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('./fixtures/shadcn-family-source/prepare.mjs', import.meta.url)), root],
    { encoding: 'utf8', timeout: 20_000 }
  );
  expect(prepared.status, prepared.stderr || prepared.stdout).toBe(0);
});
afterAll(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

it.each([
  ['dialog', 'shadcnDialogRoot', 'root.proto.ts', 'style.ts'],
  ['switch', 'shadcnSwitchRoot', 'root.proto.ts', 'thumb.proto.ts'],
  ['tabs', 'shadcnTabsRoot', 'root.proto.ts', 'visual.ts'],
])(
  'loads the staged %s family source without runtime implementations',
  async (family, exported, member, helper) => {
    const entry = `${family}.proto.ts`;
    const specifier = `@proto.ui/prototypes-shadcn/${family}`;
    await writeFile(path.join(root, entry), `export {${exported} as default} from '${specifier}';`);
    const graph = new FileSourceGraph(root);
    const closure = await graph.load(await graph.entry(entry));
    expect(closure.failures).toEqual([]);
    const prefix = `node_modules/@proto.ui/prototypes-shadcn/src/${family}`;
    expect(closure.sourceImports?.[specifier]).toBe(`${prefix}/index.ts`);
    expect(Object.keys(closure.files)).toEqual(
      expect.arrayContaining([`${prefix}/index.ts`, `${prefix}/${member}`, `${prefix}/${helper}`])
    );
    expect(
      Object.keys(closure.files).some((file) => file.includes('/dist/') || file.endsWith('.js'))
    ).toBe(false);
  }
);

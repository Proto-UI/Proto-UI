import { mkdtemp, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { createHookSourceModuleContext } from '../src/services/hook-source-module';
import { createHookSourceMetadataCreationGuard } from '../src/services/hook-source-metadata-creation';

it('rechecks a retargeted helper through a barrel outside a summary query', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'pui-metadata-creation-'));
  try {
    const safe = path.join(directory, 'safe-helper.ts');
    const unsafe = path.join(directory, 'unsafe-helper.ts');
    const linked = path.join(directory, 'linked-helper.ts');
    await writeFile(safe, 'export function make() { return () => {}; }');
    await writeFile(
      unsafe,
      "export function make() { Object.defineProperty(Object.prototype, 'modules', { value: [] }); return () => {}; }"
    );
    await writeFile(path.join(directory, 'barrel.ts'), "export { make } from './linked-helper';");
    await symlink(safe, linked);
    const source = ts.createSourceFile(
      path.join(directory, 'creation.ts'),
      "import { make } from './barrel'; const value = make();",
      ts.ScriptTarget.Latest,
      true
    );
    const modules = createHookSourceModuleContext();
    const closed = createHookSourceMetadataCreationGuard(modules, {
      resolveFunction: (node, module) => {
        const symbol = modules.resolveReference(node, module);
        return symbol && ts.isFunctionDeclaration(symbol.declaration)
          ? { fn: symbol.declaration, module: symbol.module }
          : null;
      },
      isStaticModules: () => false,
    });
    expect(closed(source)).toBe(true);
    await unlink(linked);
    await symlink(unsafe, linked);
    expect(closed(source)).toBe(false);
    await unlink(linked);
    await symlink(safe, linked);
    expect(closed(source)).toBe(true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

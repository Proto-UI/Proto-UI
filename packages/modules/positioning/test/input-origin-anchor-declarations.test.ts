// @vitest-environment node
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { expect, it } from 'vitest';

it('emits the host factory declaration using the existing public opaque anchor type', () => {
  const root = fileURLToPath(new URL('../../../../', import.meta.url));
  const configPath = fileURLToPath(new URL('../../../../tsconfig.json', import.meta.url));
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  expect(config.error).toBeUndefined();
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root, {
    declaration: true,
    emitDeclarationOnly: true,
    noEmit: false,
    noEmitOnError: true,
  });
  expect(parsed.errors).toEqual([]);
  const source = fileURLToPath(new URL('../src/web/input-origin-anchor.ts', import.meta.url));
  const program = ts.createProgram([source], parsed.options);
  const diagnostics = ts.getPreEmitDiagnostics(program).map((diagnostic) => ({
    code: diagnostic.code,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
  }));
  expect(diagnostics).toEqual([]);

  let declaration = '';
  const emitted = program.emit(undefined, (file, text) => {
    if (basename(file) === 'input-origin-anchor.d.ts') declaration = text;
  });
  expect(emitted.emitSkipped).toBe(false);
  expect(emitted.diagnostics).toEqual([]);
  expect(declaration).toContain("import type { InputOriginAnchor } from '@proto.ui/core'");
  expect(declaration).toMatch(/anchor: InputOriginAnchor;/);
  expect(declaration).toMatch(/dispose\(\): void;/);
  expect(declaration).not.toContain('inputOriginAnchorBrand');
});

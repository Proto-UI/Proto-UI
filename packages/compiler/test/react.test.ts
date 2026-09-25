// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { emitReact } from '../src/react';
import { validateIR } from '../src/ir-validation';
import type { PrototypeIR } from '../src/ir';

const source = readFileSync(
  fileURLToPath(new URL('../../prototypes/base/src/button/button.proto.ts', import.meta.url)),
  'utf8'
);
function buttonIR(): PrototypeIR {
  const parsed = parsePrototype(source, { fileName: 'button.proto.ts' });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  return parsed.value;
}

describe('checked IR to React runtime-backed source', () => {
  it('emits deterministic data-derived code with explicit runtime dependencies and valid syntax', () => {
    const ir = buttonIR();
    const first = emitReact(ir);
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error(JSON.stringify(first.diagnostics));
    expect(emitReact(JSON.parse(JSON.stringify(ir)))).toEqual(first);
    const output = ts.transpileModule(first.value.code, {
      fileName: 'generated.tsx',
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
      reportDiagnostics: true,
    });
    expect(
      output.diagnostics?.filter((entry) => entry.category === ts.DiagnosticCategory.Error)
    ).toEqual([]);
    expect(first.value.dependencies.map((entry) => entry.name)).toEqual([
      'react',
      'react-dom',
      '@proto.ui/core',
      '@proto.ui/hooks',
      '@proto.ui/adapter-react',
    ]);
    expect(first.value.profile).toBe('react-runtime-v1');
  });

  it('changes executable callback literals rather than only changing a provenance comment', () => {
    const before = emitReact(buttonIR());
    const parsed = parsePrototype(
      source.replace(
        "hovered.set(true, 'reason: button pointer.enter => hovered')",
        "hovered.set(false, 'reason: button pointer.enter => hovered')"
      ),
      { fileName: 'button.proto.ts' }
    );
    if (!before.ok || !parsed.ok) throw new Error('Fixture compilation failed');
    const after = emitReact(parsed.value);
    if (!after.ok) throw new Error(JSON.stringify(after.diagnostics));
    const beforeProgram = ts.transpileModule(before.value.code, {
      compilerOptions: { removeComments: true, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const afterProgram = ts.transpileModule(after.value.code, {
      compilerOptions: { removeComments: true, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    expect(afterProgram).not.toBe(beforeProgram);
  });

  it('rejects unknown operations, malformed versions, unbound references and identifier injection', () => {
    const version = buttonIR();
    Object.assign(version, { schemaVersion: 999 });
    expect(validateIR(version)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2001' }] });
    const operation = buttonIR();
    const first = operation.setup.body[0];
    if (first.kind !== 'const' || first.value.kind !== 'operation')
      throw new Error('Expected initial accessibility capability');
    Object.assign(first.value, { operation: 'process.exit' });
    expect(emitReact(operation)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
    const unbound = buttonIR();
    unbound.setup.body.push({
      kind: 'effect',
      expression: { kind: 'reference', name: 'window', type: 'unknown', span: unbound.setup.span },
      span: unbound.setup.span,
    });
    expect(emitReact(unbound)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
    expect(emitReact(buttonIR(), { componentName: 'X;process.exit()' })).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI3001' }],
    });
  });

  it('emits an authored source entry without importing its original module', () => {
    const caller = `import {definePrototype} from '@proto.ui/core'; import {asButton} from './button.proto'; export default definePrototype({name:'caller',setup(def){asButton();}});`;
    const parsed = parsePrototype(caller, {
      fileName: 'caller.proto.ts',
      files: { 'button.proto.ts': source },
    });
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const output = emitReact(parsed.value);
    if (!output.ok) throw new Error(JSON.stringify(output.diagnostics));
    const file = ts.createSourceFile(
      'generated.tsx',
      output.value.code,
      ts.ScriptTarget.Latest,
      true
    );
    const imports = file.statements
      .filter(ts.isImportDeclaration)
      .map((node) =>
        ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : 'dynamic'
      );
    expect(imports.every((specifier) => !specifier.startsWith('.'))).toBe(true);
    expect(parsed.value.hooks).toHaveLength(1);
  });
});

import path from 'node:path';
import { mkdtempSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { createHookSourceModuleContext } from '../src/services/hook-source-module';

function source(text: string) {
  return ts.createSourceFile(path.resolve('lexical-index-fixture.ts'), text, ts.ScriptTarget.Latest, true);
}
function nodes<T extends ts.Node>(root: ts.Node, guard: (node: ts.Node) => node is T): T[] {
  const output: T[] = [];
  const visit = (node: ts.Node): void => { if (guard(node)) output.push(node); ts.forEachChild(node, visit); };
  visit(root);
  return output;
}
function reads(root: ts.Node) {
  return nodes(root, ts.isCallExpression).filter(n => n.expression.getText() === 'read')
    .map(n => n.arguments[0]);
}

describe('operation-owned lexical indexes', () => {
  it('preserves block shadowing, pre-declaration identity, parameters and function var hoisting', () => {
    const file = source(`const value = 'outer';
      function f(value) { read(value); { read(value); const value = 'inner'; }
        if (true) { var hoisted = 1; } read(hoisted); }
      read(value);`);
    const context = createHookSourceModuleContext(); const module = context.moduleForSource(file);
    const declarations = nodes(file, ts.isVariableDeclaration);
    const parameter = nodes(file, ts.isParameter)[0].name;
    const resolved = reads(file).map(n => context.resolveReference(n, module)?.declaration);
    expect(resolved).toEqual([parameter, declarations[1], declarations[2], declarations[0]]);
  });

  it('does not import var declarations from nested functions into their parent', () => {
    const file = source(`const value = 'outer'; function f() {
      function child() { var value = 'nested'; read(value); } read(value); }`);
    const context = createHookSourceModuleContext(); const module = context.moduleForSource(file);
    const declarations = nodes(file, ts.isVariableDeclaration);
    expect(reads(file).map(n => context.resolveReference(n, module)?.declaration))
      .toEqual([declarations[1], declarations[0]]);
  });

  it('retains catch, loop destructuring and named-function-expression bindings', () => {
    const file = source(`const item = 'outer'; try {} catch (item) { read(item); }
      for (const { value: item } of []) { read(item); }
      const fn = function self() { read(self); }; read(item);`);
    const context = createHookSourceModuleContext(); const module = context.moduleForSource(file);
    const catchName = nodes(file, ts.isCatchClause)[0].variableDeclaration!.name;
    const binding = nodes(file, ts.isBindingElement)[0];
    const self = nodes(file, ts.isFunctionExpression)[0].name;
    const outer = nodes(file, ts.isVariableDeclaration)[0];
    expect(reads(file).map(n => context.resolveReference(n, module)?.declaration))
      .toEqual([catchName, binding, self, outer]);
  });

  it('reuses a function var scan for repeated lexical queries, without a wall-clock threshold', () => {
    const file = source(`const target = 1; function f() { if (true) { var marker = 0; } read(target); }`);
    const marker = nodes(file, ts.isVariableStatement)[1];
    const original = marker.declarationList; let visits = 0;
    Object.defineProperty(marker, 'declarationList', { get() { visits++; return original; } });
    const context = createHookSourceModuleContext(); const module = context.moduleForSource(file);
    const query = reads(file)[0]; const expected = nodes(file, ts.isVariableDeclaration)[0];
    expect(context.resolveReference(query, module)?.declaration).toBe(expected);
    const afterFirst = visits;
    expect(afterFirst).toBeGreaterThan(0);
    for (let i = 0; i < 20; i++) expect(context.resolveReference(query, module)?.declaration).toBe(expected);
    expect(visits).toBe(afterFirst);
  });

  it('indexes direct statement declarations once per immutable statement list', () => {
    const file = source(`const first = 1; const second = 2; read(second);`);
    const statement = nodes(file, ts.isVariableStatement)[1];
    const original = statement.declarationList; let visits = 0;
    Object.defineProperty(statement, 'declarationList', { get() { visits++; return original; } });
    const context = createHookSourceModuleContext(); const module = context.moduleForSource(file);
    const query = reads(file)[0];
    const declaration = context.resolveReference(query, module)?.declaration;
    const afterFirst = visits;
    expect(afterFirst).toBeGreaterThan(0);
    for (let i = 0; i < 20; i++) expect(context.resolveReference(query, module)?.declaration).toBe(declaration);
    expect(visits).toBe(afterFirst);
  });

  it('uses new source identities on replacement and in a later operation', () => {
    const context = createHookSourceModuleContext();
    const before = source(`const value = 'old'; read(value);`);
    const oldModule = context.moduleForSource(before);
    const old = context.resolveReference(reads(before)[0], oldModule)?.declaration;
    const after = source(`const value = 'new'; function f(value) { read(value); }`);
    const module = context.moduleForSource(after);
    const expected = nodes(after, ts.isParameter)[0].name;
    expect(context.resolveReference(reads(after)[0], module)?.declaration).toBe(expected);
    expect(expected).not.toBe(old);
    const fresh = createHookSourceModuleContext(); const freshModule = fresh.moduleForSource(after);
    expect(fresh.resolveReference(reads(after)[0], freshModule)?.declaration).toBe(expected);
  });
});

describe('source registration canonicalization', () => {
  it('resolves a source registration once, without caching a later registration', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'proto-source-registration-'));
    const fileName = path.join(directory, 'source.ts');
    writeFileSync(fileName, `export const value = 1;`);
    const file = ts.createSourceFile(fileName, `export const value = 1;`, ts.ScriptTarget.Latest, true);
    const expectedPath = realpathSync.native(fileName);
    const spy = vi.spyOn(realpathSync, 'native');
    try {
      const context = createHookSourceModuleContext();
      const first = context.moduleForSource(file);
      expect(first.file).toBe(expectedPath);
      expect(first.source).toBe(file);
      expect(spy).toHaveBeenCalledTimes(1);
      context.moduleForSource(file);
      expect(spy).toHaveBeenCalledTimes(2);
    } finally {
      spy.mockRestore();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('observes symlink retargeting for the same AST and new AST/context', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'proto-source-retarget-'));
    try {
      const firstPath = path.join(directory, 'first.ts');
      const secondPath = path.join(directory, 'second.ts');
      const link = path.join(directory, 'source.ts');
      writeFileSync(firstPath, `export const value = 1;`);
      writeFileSync(secondPath, `export const value = 2;`);
      symlinkSync(firstPath, link);
      const file = ts.createSourceFile(link, `export const value = 1;`, ts.ScriptTarget.Latest, true);
      const context = createHookSourceModuleContext();
      expect(context.moduleForSource(file).file).toBe(realpathSync.native(firstPath));
      unlinkSync(link);
      symlinkSync(secondPath, link);
      expect(context.moduleForSource(file).file).toBe(realpathSync.native(secondPath));
      const replacement = ts.createSourceFile(link, `export const value = 2;`, ts.ScriptTarget.Latest, true);
      const replaced = context.moduleForSource(replacement);
      expect(replaced.file).toBe(realpathSync.native(secondPath));
      expect(replaced.source).toBe(replacement);
      expect(createHookSourceModuleContext().moduleForSource(replacement).file)
        .toBe(realpathSync.native(secondPath));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
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

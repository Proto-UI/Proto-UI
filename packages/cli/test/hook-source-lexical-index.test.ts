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


describe('public module query canonicalization', () => {
  it('resolves repeated paths once per query but observes later symlink targets', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'proto-module-query-'));
    const from = path.join(directory, 'entry.ts');
    const link = path.join(directory, 'dependency.ts');
    const first = path.join(directory, 'first.ts');
    const second = path.join(directory, 'second.ts');
    writeFileSync(from, `import { value } from './dependency';`);
    writeFileSync(first, `export const value = 1;`);
    writeFileSync(second, `export const value = 2;`);
    writeFileSync(path.join(directory, 'tsconfig.json'), '{}');
    symlinkSync(first, link);
    const spy = vi.spyOn(realpathSync, 'native');
    try {
      const context = createHookSourceModuleContext();
      const before = context.resolveModule(from, './dependency');
      expect(before?.file).toBe(first);
      expect(before?.source.text).toBe(`export const value = 1;`);
      expect(spy.mock.calls.filter(([file]) => String(file) === from)).toHaveLength(1);
      unlinkSync(link);
      symlinkSync(second, link);
      const after = context.resolveModule(from, './dependency');
      expect(after?.file).toBe(second);
      expect(after?.source.text).toBe(`export const value = 2;`);
      expect(spy.mock.calls.filter(([file]) => String(file) === from)).toHaveLength(2);
    } finally {
      spy.mockRestore();
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it('drops query-local paths after an exception and isolates a nested lookup', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'proto-module-query-lifetime-'));
    const from = path.join(directory, 'entry.ts');
    const dependency = path.join(directory, 'dependency.ts');
    writeFileSync(from, `import { value } from './dependency';`);
    writeFileSync(dependency, `export const value = 1;`);
    writeFileSync(path.join(directory, 'tsconfig.json'), '{}');
    const context = createHookSourceModuleContext();
    const originalExists = ts.sys.fileExists;
    const realpathSpy = vi.spyOn(realpathSync, 'native');
    const existsSpy = vi.spyOn(ts.sys, 'fileExists');
    try {
      existsSpy.mockImplementationOnce(() => { throw new Error('query observation failed'); });
      expect(() => context.resolveModule(from, './dependency')).toThrow('query observation failed');
      existsSpy.mockImplementation(originalExists);
      expect(context.resolveModule(from, './dependency')?.file).toBe(dependency);
      expect(realpathSpy.mock.calls.filter(([file]) => String(file) === from)).toHaveLength(2);

      realpathSpy.mockClear();
      let nested = false;
      existsSpy.mockImplementation(file => {
        if (!nested) {
          nested = true;
          expect(context.resolveModule(from, './dependency')?.file).toBe(dependency);
        }
        return originalExists(file);
      });
      expect(context.resolveModule(from, './dependency')?.file).toBe(dependency);
      expect(nested).toBe(true);
      // Each public call owns a fresh scope; the resumed outer query retains
      // its original observation rather than inheriting/clearing the inner one.
      expect(realpathSpy.mock.calls.filter(([file]) => String(file) === from)).toHaveLength(2);
    } finally {
      existsSpy.mockRestore();
      realpathSpy.mockRestore();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('shares repeated successful observations only within one recursive export query', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'proto-export-query-'));
    const from = path.join(directory, 'entry.ts');
    const config = path.join(directory, 'tsconfig.json');
    const text = `export * from './first'; export * from './second';`;
    writeFileSync(from, text);
    writeFileSync(config, '{}');
    writeFileSync(path.join(directory, 'first.ts'), `export const value = 1;`);
    writeFileSync(path.join(directory, 'second.ts'), `export const value = 2;`);
    const context = createHookSourceModuleContext();
    const module = context.moduleForSource(ts.createSourceFile(from, text, ts.ScriptTarget.Latest, true));
    const spy = vi.spyOn(realpathSync, 'native');
    try {
      // Conflicting star exports remain ambiguous; caching must not choose one.
      expect(context.resolveExport(module, 'value')).toBeNull();
      expect(spy.mock.calls.filter(([file]) => String(file) === config)).toHaveLength(1);
      expect(context.resolveExport(module, 'value')).toBeNull();
      expect(spy.mock.calls.filter(([file]) => String(file) === config)).toHaveLength(2);
    } finally {
      spy.mockRestore();
      rmSync(directory, { recursive: true, force: true });
    }
  });

});


describe('immutable AST lexical query identities', () => {
  it.each(['target', 'absent'])('reuses the ancestor lookup for %s including a missing binding', name => {
    const file = source(`const target = 1; function f() { { read(${name}); } }`);
    const context = createHookSourceModuleContext(); const module = context.moduleForSource(file);
    const query = reads(file)[0], parent = query.parent; let parentReads = 0;
    Object.defineProperty(query, 'parent', { get() { parentReads++; return parent; } });
    const expected = name === 'target' ? nodes(file, ts.isVariableDeclaration)[0] : undefined;
    expect(context.resolveReference(query, module)?.declaration).toBe(expected);
    const first = parentReads; expect(first).toBeGreaterThan(0);
    for (let i = 0; i < 20; i++) expect(context.resolveReference(query, module)?.declaration).toBe(expected);
    expect(parentReads).toBe(first);
  });

  it('does not share a cached miss with a replacement SourceFile at the same path', () => {
    const context = createHookSourceModuleContext();
    const before = source(`function f() { read(value); }`);
    const first = context.moduleForSource(before);
    expect(context.resolveReference(reads(before)[0], first)).toBeNull();
    const after = source(`function f() { read(value); const value = 'new'; }`);
    const second = context.moduleForSource(after);
    expect(context.resolveReference(reads(after)[0], second)?.declaration)
      .toBe(nodes(after, ts.isVariableDeclaration)[0]);
    // The immutable old syntax still has no lexical binding; it must not acquire
    // the replacement AST's declaration through a path/name cache.
    expect(context.resolveReference(reads(before)[0], first)).toBeNull();
  });
  it('still resolves the imported target afresh for the same identifier AST', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'proto-lexical-import-'));
    const first = path.join(directory, 'first.ts'), second = path.join(directory, 'second.ts');
    const link = path.join(directory, 'linked.ts'), entry = path.join(directory, 'entry.ts');
    writeFileSync(first, 'export const value = 1;'); writeFileSync(second, 'export const value = 2;');
    symlinkSync(first, link); writeFileSync(path.join(directory, 'tsconfig.json'), '{}');
    const file = ts.createSourceFile(entry, `import { value } from './linked'; read(value);`, ts.ScriptTarget.Latest, true);
    const context = createHookSourceModuleContext(), module = context.moduleForSource(file), query = reads(file)[0];
    try {
      expect(context.resolveReference(query, module)?.module.file).toBe(first);
      unlinkSync(link); symlinkSync(second, link);
      expect(context.resolveReference(query, module)?.module.file).toBe(second);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it('keeps distinct names in the public module-local lookup independent of reference caching', () => {
    const file = source(`const first = 1, second = 2; read(first); read(second);`);
    const context = createHookSourceModuleContext(), module = context.moduleForSource(file);
    const declarations = nodes(file, ts.isVariableDeclaration);
    for (let i = 0; i < 3; i++) {
      expect(context.resolveReference(reads(file)[0], module)?.declaration).toBe(declarations[0]);
      expect(context.resolveLocal(module, 'second')?.declaration).toBe(declarations[1]);
      expect(context.resolveReference(reads(file)[1], module)?.declaration).toBe(declarations[1]);
      expect(context.resolveLocal(module, 'first')?.declaration).toBe(declarations[0]);
    }
  });

});

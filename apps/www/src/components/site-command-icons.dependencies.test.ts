// @vitest-environment node
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const lucide = resolve('packages/prototypes/lucide/src');
const loaders = resolve('apps/www/src/components/PrototypePreviewer/prototype-modules.ts');
const source = (file: string) =>
  ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
const modulePath = (file: string, specifier: string) => {
  const target = resolve(dirname(file), specifier);
  const found = [target, `${target}.ts`, `${target}/index.ts`].find(existsSync);
  if (!found) throw new Error(`Unresolved dependency: ${file} -> ${specifier}`);
  return found;
};
function loaderEntry(id: string) {
  let entry: string | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.name) && node.name.text === id) {
      const imports = (child: ts.Node) => {
        if (ts.isCallExpression(child) && child.expression.kind === ts.SyntaxKind.ImportKeyword) {
          const argument = child.arguments[0];
          if (!argument || !ts.isStringLiteral(argument))
            throw new Error('Expected an explicit loader');
          if (entry) throw new Error(`Expected exactly one module for ${id}`);
          entry = modulePath(loaders, argument.text);
        }
        ts.forEachChild(child, imports);
      };
      imports(node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(source(loaders));
  if (!entry) throw new Error(`Missing loader: ${id}`);
  return entry;
}

/** The real authored entry graph, without tree-shaking or replacing imports.
 * Type-only edges cannot evaluate code; core is the existing renderer protocol. */
function runtimeClosure(entry: string) {
  const visited = new Set<string>();
  const visit = (file: string) => {
    if (visited.has(file)) return;
    visited.add(file);
    for (const statement of source(file).statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      if (ts.isImportDeclaration(statement) && statement.importClause?.isTypeOnly) continue;
      if (ts.isExportDeclaration(statement) && statement.isTypeOnly) continue;
      const specifier = statement.moduleSpecifier;
      if (!specifier || !ts.isStringLiteral(specifier)) continue;
      if (specifier.text === '@proto.ui/core') continue;
      if (!specifier.text.startsWith('.'))
        throw new Error(`Unexpected package edge: ${specifier.text}`);
      visit(modulePath(file, specifier.text));
    }
  };
  visit(entry);
  return [...visited];
}

describe('website command icon dependency boundary', () => {
  it.each([
    ['lucide-search-icon', ['search']],
    ['lucide-x-icon', ['x']],
    ['lucide-chevron-down-icon', ['chevron-down']],
    ['lucide-copy-icon', ['copy']],
    ['lucide-loader-circle-icon', ['loader-circle']],
    ['lucide-check-icon', ['check']],
    ['lucide-circle-alert-icon', ['circle-alert']],
  ] as const)(
    '%s reaches exactly its declared fixed glyphs, never the generic catalog',
    (id, glyphs) => {
      const files = runtimeClosure(loaderEntry(id));
      const icons = files.filter((file) => file.startsWith(`${lucide}/icons/`));
      expect(
        icons.map((file) => relative(`${lucide}/icons`, file).replace(/\.ts$/, '')).sort()
      ).toEqual([...glyphs]);
      expect(
        files
          .filter((file) => file.startsWith(`${lucide}/icon/`))
          .map((file) => relative(lucide, file))
          .sort()
      ).toEqual(['icon/fixed.ts', 'icon/render-shape.ts', 'icon/render.ts']);
      expect(
        files
          .filter((file) => file.startsWith(`${lucide}/`))
          .some((file) =>
            /(?:icons\.generated|render-icon|icon\.proto|manifest|dynamic)/.test(file)
          )
      ).toBe(false);
    }
  );

  it('keeps the full name-based catalog available to actual library/demo consumers', () => {
    expect(loaderEntry('lucide-icon')).toBe(resolve(lucide, 'icon/index.ts'));
    const fullCatalog = source(resolve(lucide, 'icon/icons.generated.ts'));
    const fixedImports = fullCatalog.statements.filter(
      (statement) =>
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text.startsWith('../icons/')
    );
    expect(fixedImports.length).toBeGreaterThan(1500);
  });
});

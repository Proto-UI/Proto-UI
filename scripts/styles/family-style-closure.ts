import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { collectProtoStyleTokensFromFiles } from '../../packages/cli/src/services/prototype-style-tokens.js';

/** Follow the family's actual static value dependencies into Base, not every Base family. */
export async function collectFamilyStyleClosure(familyRoot: string, baseRoot: string) {
  familyRoot = path.resolve(familyRoot);
  baseRoot = path.resolve(baseRoot);
  const files = new Set<string>();
  const within = (file: string, root: string) => file === root || file.startsWith(root + path.sep);
  const resolve = async (candidate: string) => {
    const stem = candidate.replace(/\.(?:[cm]?js|jsx)$/, '');
    for (const file of [candidate, `${stem}.ts`, `${stem}.tsx`, path.join(stem, 'index.ts')]) {
      try {
        if ((await fs.stat(file)).isFile()) return file;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    throw new Error(`Unresolved family style dependency: ${candidate}`);
  };
  const visit = async (file: string) => {
    if (files.has(file)) return;
    if (!within(file, familyRoot) && !within(file, baseRoot)) return;
    files.add(file);
    const source = ts.createSourceFile(
      file,
      await fs.readFile(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true
    );
    for (const node of source.statements) {
      if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue;
      if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) continue;
      if (ts.isImportDeclaration(node)) {
        if (node.importClause?.isTypeOnly) continue;
        const bindings = node.importClause?.namedBindings;
        if (
          !node.importClause?.name &&
          bindings &&
          ts.isNamedImports(bindings) &&
          bindings.elements.length &&
          bindings.elements.every((item) => item.isTypeOnly)
        )
          continue;
      } else {
        if (node.isTypeOnly) continue;
        if (
          node.exportClause &&
          ts.isNamedExports(node.exportClause) &&
          node.exportClause.elements.length &&
          node.exportClause.elements.every((item) => item.isTypeOnly)
        )
          continue;
      }
      const specifier = node.moduleSpecifier.text;
      if (specifier === '@proto.ui/prototypes-base') {
        throw new Error(`Unbounded Base root value import in family style graph: ${file}`);
      }
      const candidate = specifier.startsWith('@proto.ui/prototypes-base/')
        ? path.join(baseRoot, specifier.slice('@proto.ui/prototypes-base/'.length))
        : specifier.startsWith('.')
          ? path.resolve(path.dirname(file), specifier)
          : null;
      if (candidate && (within(candidate, familyRoot) || within(candidate, baseRoot)))
        await visit(await resolve(candidate));
    }
  };
  const walk = async (directory: string) => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (/\.(?:ts|tsx)$/.test(entry.name)) await visit(file);
    }
  };
  await walk(familyRoot);
  const sourceFiles = [...files].sort();
  return {
    tokens: (await collectProtoStyleTokensFromFiles(sourceFiles)) as string[],
    baseFiles: sourceFiles.filter((file) => within(file, baseRoot)),
  };
}

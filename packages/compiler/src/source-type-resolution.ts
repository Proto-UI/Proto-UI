import ts from 'typescript';
import type { SourceModule } from './parser-module';
import { rejectNode } from './source-syntax';
import {
  isLocalSourceSpecifier,
  localSourceBase,
  localSourceCandidates,
  sourceName,
} from './source-resolution';

export type TypeSource = Pick<SourceModule, 'graph' | 'file'>;
export type TypeDeclaration = ts.TypeAliasDeclaration | ts.InterfaceDeclaration;
export type SourceTypeBinding =
  | { kind: 'declaration'; owner: TypeSource; declaration: TypeDeclaration }
  | { kind: 'external'; module: string; name: string; node: ts.Node };

function typeSource(owner: TypeSource, specifier: string, node: ts.Node): TypeSource {
  const mapped = owner.graph.sourceImports[specifier];
  const base = mapped ?? localSourceBase(owner.file.fileName, specifier);
  const name = (mapped ? [mapped] : localSourceCandidates(base)).find((name) =>
    Object.hasOwn(owner.graph.sources, name)
  );
  if (!name)
    rejectNode(node, 'PUI1020', `Type source ${specifier} is absent from the closed source graph.`);
  const runtime = owner.graph.modules.get(name);
  if (runtime) return runtime;
  const previous = owner.graph.typeSources.get(name);
  if (previous) return { graph: owner.graph, file: previous };
  const file = ts.createSourceFile(
    name,
    owner.graph.sources[name],
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const diagnostics = (file as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] })
    .parseDiagnostics;
  if (diagnostics.length)
    rejectNode(node, 'PUI1001', ts.flattenDiagnosticMessageText(diagnostics[0].messageText, '\n'));
  owner.graph.typeSources.set(name, file);
  return { graph: owner.graph, file };
}

function exportBinding(
  owner: TypeSource,
  name: string,
  active: Set<string>
): SourceTypeBinding | undefined {
  const id = `${sourceName(owner.file.fileName)}#export:${name}`;
  if (active.has(id)) rejectNode(owner.file, 'PUI1020', `Cyclic type export ${name}.`);
  active.add(id);
  try {
    const stars: ts.ExportDeclaration[] = [];
    for (const statement of owner.file.statements) {
      if (
        (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) &&
        statement.name.text === name &&
        ts
          .getModifiers(statement)
          ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
      )
        return { kind: 'declaration', owner, declaration: statement };
      if (!ts.isExportDeclaration(statement)) continue;
      if (!statement.exportClause) {
        stars.push(statement);
        continue;
      }
      if (!ts.isNamedExports(statement.exportClause)) continue;
      for (const element of statement.exportClause.elements) {
        if (element.name.text !== name) continue;
        const original = element.propertyName?.text ?? element.name.text;
        return statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
          ? importedBinding(owner, statement.moduleSpecifier.text, original, element, active)
          : localBinding(owner, original, active);
      }
    }
    if (name === 'default') return undefined;
    let result: SourceTypeBinding | undefined;
    for (const star of stars) {
      if (!star.moduleSpecifier || !ts.isStringLiteral(star.moduleSpecifier)) continue;
      const specifier = star.moduleSpecifier.text;
      // An external star has no enumerable closed type surface.
      if (!owner.graph.hasSourceSpecifier(specifier)) continue;
      const candidate = exportBinding(typeSource(owner, specifier, star), name, active);
      if (!candidate) continue;
      if (result && !sameBinding(result, candidate))
        rejectNode(star, 'PUI1020', `Ambiguous type export ${name}.`);
      result = candidate;
    }
    return result;
  } finally {
    active.delete(id);
  }
}

function sameBinding(left: SourceTypeBinding, right: SourceTypeBinding): boolean {
  return left.kind === 'external'
    ? right.kind === 'external' && left.module === right.module && left.name === right.name
    : right.kind === 'declaration' && left.declaration === right.declaration;
}

function importedBinding(
  owner: TypeSource,
  module: string,
  name: string,
  node: ts.Node,
  active: Set<string>
): SourceTypeBinding {
  if (!owner.graph.hasSourceSpecifier(module)) return { kind: 'external', module, name, node };
  const result = exportBinding(typeSource(owner, module, node), name, active);
  if (!result) rejectNode(node, 'PUI1020', `No static type export ${name} in ${module}.`);
  return result;
}

function localBinding(
  owner: TypeSource,
  name: string,
  active: Set<string>
): SourceTypeBinding | undefined {
  let result: SourceTypeBinding | undefined;
  for (const statement of owner.file.statements) {
    let candidate: SourceTypeBinding | undefined;
    if (
      (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) &&
      statement.name.text === name
    )
      candidate = { kind: 'declaration', owner, declaration: statement };
    if (
      ts.isImportDeclaration(statement) &&
      statement.importClause &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      const clause = statement.importClause;
      if (clause.name?.text === name)
        candidate = importedBinding(
          owner,
          statement.moduleSpecifier.text,
          'default',
          clause.name,
          active
        );
      if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        const element = clause.namedBindings.elements.find((element) => element.name.text === name);
        if (element)
          candidate = importedBinding(
            owner,
            statement.moduleSpecifier.text,
            element.propertyName?.text ?? name,
            element,
            active
          );
      }
    }
    if (candidate) {
      if (result) rejectNode(statement, 'PUI1020', `Duplicate or shadowed type binding ${name}.`);
      result = candidate;
    }
  }
  return result;
}

/** Resolve the declaration identity, including erased imports and type barrels. */
export function resolveSourceType(
  owner: TypeSource,
  name: ts.Node | string,
  active = new Set<string>()
): SourceTypeBinding | undefined {
  if (typeof name === 'string' || ts.isIdentifier(name))
    return localBinding(owner, typeof name === 'string' ? name : name.text, active);
  if (ts.isQualifiedName(name) && ts.isIdentifier(name.left)) {
    const namespace = name.left.text;
    for (const statement of owner.file.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
        continue;
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings) && bindings.name.text === namespace)
        return importedBinding(
          owner,
          statement.moduleSpecifier.text,
          name.right.text,
          name,
          active
        );
    }
  }
  return undefined;
}

/** Transparent type aliases preserve the imported semantic symbol, not its spelling. */
export function sourceTypeIdentity(
  owner: TypeSource,
  node: ts.TypeNode,
  active = new Set<TypeDeclaration>()
): Extract<SourceTypeBinding, { kind: 'external' }> | undefined {
  if (ts.isParenthesizedTypeNode(node)) return sourceTypeIdentity(owner, node.type, active);
  if (!ts.isTypeReferenceNode(node)) return undefined;
  const binding = resolveSourceType(owner, node.typeName);
  if (!binding) return undefined;
  if (binding.kind === 'external') return binding;
  const declaration = binding.declaration;
  if (!ts.isTypeAliasDeclaration(declaration) || declaration.typeParameters?.length)
    return undefined;
  if (active.has(declaration)) rejectNode(node, 'PUI1020', 'Cyclic semantic type alias.');
  active.add(declaration);
  try {
    return sourceTypeIdentity(binding.owner, declaration.type, active);
  } finally {
    active.delete(declaration);
  }
}

/** Only syntactically referenced type imports/re-exports need source bytes. */
export function requiredTypeSourceSpecifiers(
  file: ts.SourceFile,
  includeExports = true
): Set<string> {
  const names = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isTypeReferenceNode(node)) {
      let name = node.typeName;
      while (ts.isQualifiedName(name)) name = name.left;
      names.add(name.text);
    }
    if (ts.isExpressionWithTypeArguments(node) && ts.isIdentifier(node.expression))
      names.add(node.expression.text);
    ts.forEachChild(node, visit);
  };
  visit(file);
  const result = new Set<string>();
  for (const statement of file.statements) {
    if (
      includeExports &&
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      if (
        statement.isTypeOnly ||
        (statement.exportClause &&
          ts.isNamedExports(statement.exportClause) &&
          statement.exportClause.elements.some((element) => element.isTypeOnly))
      )
        result.add(statement.moduleSpecifier.text);
    }
    if (
      !ts.isImportDeclaration(statement) ||
      !statement.importClause ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    )
      continue;
    const clause = statement.importClause;
    const bindings = clause.namedBindings;
    if (
      (clause.name && names.has(clause.name.text)) ||
      (bindings &&
        (ts.isNamespaceImport(bindings)
          ? names.has(bindings.name.text)
          : bindings.elements.some((element) => names.has(element.name.text))))
    )
      result.add(statement.moduleSpecifier.text);
  }
  return result;
}

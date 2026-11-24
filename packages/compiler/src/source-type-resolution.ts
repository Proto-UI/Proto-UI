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
type SourceValueBinding = { kind: 'value'; owner: TypeSource; declaration: ts.VariableDeclaration };
type SourceBinding = SourceTypeBinding | SourceValueBinding;

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
  active: Set<string>,
  value = false
): SourceBinding | undefined {
  const id = `${sourceName(owner.file.fileName)}#export:${name}`;
  if (active.has(id)) rejectNode(owner.file, 'PUI1020', `Cyclic type export ${name}.`);
  active.add(id);
  try {
    const stars: ts.ExportDeclaration[] = [];
    for (const statement of owner.file.statements) {
      if (
        value &&
        ts.isVariableStatement(statement) &&
        ts
          .getModifiers(statement)
          ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
      ) {
        const declaration = statement.declarationList.declarations.find(
          (declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === name
        );
        if (declaration) return { kind: 'value', owner, declaration };
      }
      if (
        !value &&
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
          ? importedBinding(owner, statement.moduleSpecifier.text, original, element, active, value)
          : localBinding(owner, original, active, value);
      }
    }
    if (name === 'default') return undefined;
    let result: SourceBinding | undefined;
    for (const star of stars) {
      if (!star.moduleSpecifier || !ts.isStringLiteral(star.moduleSpecifier)) continue;
      const specifier = star.moduleSpecifier.text;
      // An external star has no enumerable closed type surface.
      if (!owner.graph.hasSourceSpecifier(specifier)) continue;
      const candidate = exportBinding(typeSource(owner, specifier, star), name, active, value);
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

function sameBinding(left: SourceBinding, right: SourceBinding): boolean {
  return left.kind === 'external'
    ? right.kind === 'external' && left.module === right.module && left.name === right.name
    : right.kind !== 'external' &&
        right.kind === left.kind &&
        left.declaration === right.declaration;
}

function importedBinding(
  owner: TypeSource,
  module: string,
  name: string,
  node: ts.Node,
  active: Set<string>,
  value = false
): SourceBinding {
  if (!owner.graph.hasSourceSpecifier(module)) return { kind: 'external', module, name, node };
  const result = exportBinding(typeSource(owner, module, node), name, active, value);
  if (!result) rejectNode(node, 'PUI1020', `No static type export ${name} in ${module}.`);
  return result;
}

function localBinding(
  owner: TypeSource,
  name: string,
  active: Set<string>,
  value = false
): SourceBinding | undefined {
  let result: SourceBinding | undefined;
  for (const statement of owner.file.statements) {
    let candidate: SourceBinding | undefined;
    if (
      value &&
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement) ||
        ts.isModuleDeclaration(statement)) &&
      statement.name?.text === name
    )
      rejectNode(statement, 'PUI1020', `Non-tuple value binding ${name}.`);
    if (value && ts.isVariableStatement(statement)) {
      const declaration = statement.declarationList.declarations.find(
        (declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === name
      );
      if (declaration) candidate = { kind: 'value', owner, declaration };
    }
    if (
      !value &&
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
          active,
          value
        );
      if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        const element = clause.namedBindings.elements.find((element) => element.name.text === name);
        if (element)
          candidate = importedBinding(
            owner,
            statement.moduleSpecifier.text,
            element.propertyName?.text ?? name,
            element,
            active,
            value
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
  const binding = resolveSourceBinding(owner, name, active);
  return binding?.kind === 'value' ? undefined : binding;
}

/** Resolve an erased value query through the same closed source graph as types. */
export function resolveSourceValue(
  owner: TypeSource,
  name: ts.Identifier
): SourceValueBinding | undefined {
  const binding = resolveSourceBinding(owner, name, new Set(), true);
  return binding?.kind === 'value' ? binding : undefined;
}

function resolveSourceBinding(
  owner: TypeSource,
  name: ts.Node | string,
  active: Set<string>,
  value = false
): SourceBinding | undefined {
  if (typeof name === 'string' || ts.isIdentifier(name))
    return localBinding(owner, typeof name === 'string' ? name : name.text, active, value);
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
          active,
          value
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
  if (
    ts.isImportTypeNode(node) &&
    !node.isTypeOf &&
    node.qualifier &&
    ts.isIdentifier(node.qualifier) &&
    ts.isLiteralTypeNode(node.argument) &&
    ts.isStringLiteral(node.argument.literal) &&
    (node.argument.literal.text === '@proto.ui/core' ||
      node.argument.literal.text === '@proto.ui/types')
  )
    return {
      kind: 'external',
      module: node.argument.literal.text,
      name: node.qualifier.text,
      node,
    };
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

/** Referenced type imports need source bytes, including their exported value surfaces. */
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
    if (ts.isTypeQueryNode(node) && ts.isIdentifier(node.exprName)) names.add(node.exprName.text);
    if (ts.isExpressionWithTypeArguments(node) && ts.isIdentifier(node.expression))
      names.add(node.expression.text);
    ts.forEachChild(node, visit);
  };
  visit(file);
  if (includeExports) {
    for (const statement of file.statements) {
      if (
        ts.isExportDeclaration(statement) &&
        !statement.moduleSpecifier &&
        statement.exportClause &&
        ts.isNamedExports(statement.exportClause)
      ) {
        for (const element of statement.exportClause.elements)
          names.add((element.propertyName ?? element.name).text);
      }
    }
  }
  const result = new Set<string>();
  for (const statement of file.statements) {
    if (
      includeExports &&
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      (statement.isTypeOnly ||
        !statement.exportClause ||
        (ts.isNamedExports(statement.exportClause) && statement.exportClause.elements.length > 0))
    ) {
      // An erased typeof query may select a value through a named or star
      // re-export. Discover that source without turning it into a runtime edge.
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

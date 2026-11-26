import ts from 'typescript';

import { createHookSourceModuleContext } from './hook-source-module.js';

const unwrap = (node: ts.Node): ts.Node =>
  ts.isParenthesizedExpression(node) ||
  ts.isAsExpression(node) ||
  ts.isTypeAssertionExpression(node) ||
  ts.isNonNullExpression(node) ||
  ts.isSatisfiesExpression(node)
    ? unwrap(node.expression)
    : node;

/** The constants loader does not execute a module. Only the specific Core
 * constructors proved below may initialize fresh data without touching rows.
 * This same admission is used by production and the independent Rule scan.
 */
export function constantModuleHasUnmodeledEffects(source: ts.SourceFile): boolean {
  const strings = new Map<string, ts.VariableDeclaration | null>();
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) continue;
      const name = declaration.name.text;
      strings.set(
        name,
        strings.has(name) || (statement.declarationList.flags & ts.NodeFlags.Const) === 0
          ? null
          : declaration
      );
    }
  }
  const stableName = (owner: ts.SourceFile, name: string, declaration?: ts.Node): boolean => {
    const mentions = (node: ts.Node): boolean =>
      (ts.isIdentifier(node) && node.text === name) || (ts.forEachChild(node, mentions) ?? false);
    const conflicts = (node: ts.Node): boolean => {
      if (ts.isTypeNode(node)) return false;
      if (
        (node !== declaration &&
          (ts.isVariableDeclaration(node) ||
            ts.isParameter(node) ||
            ts.isBindingElement(node) ||
            ts.isFunctionDeclaration(node) ||
            ts.isFunctionExpression(node) ||
            ts.isClassDeclaration(node) ||
            ts.isClassExpression(node)) &&
          node.name &&
          mentions(node.name)) ||
        (ts.isBinaryExpression(node) &&
          node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
          node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
          mentions(node.left)) ||
        ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
          (node.operator === ts.SyntaxKind.PlusPlusToken ||
            node.operator === ts.SyntaxKind.MinusMinusToken) &&
          mentions(node.operand)) ||
        ((ts.isForInStatement(node) || ts.isForOfStatement(node)) && mentions(node.initializer)) ||
        ts.isWithStatement(node) ||
        (ts.isCallExpression(node) &&
          ts.isIdentifier(unwrap(node.expression)) &&
          (unwrap(node.expression) as ts.Identifier).text === 'eval')
      )
        return true;
      return ts.forEachChild(node, conflicts) ?? false;
    };
    return !conflicts(owner);
  };
  const canonicalImport = (name: string): boolean => {
    let imports = 0;
    let canonical = false;
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement)) continue;
      const clause = statement.importClause;
      if (!clause || clause.isTypeOnly) continue;
      if (clause.name?.text === name) imports++;
      const named = clause.namedBindings;
      if (named && ts.isNamespaceImport(named) && named.name.text === name) imports++;
      if (!named || !ts.isNamedImports(named)) continue;
      for (const element of named.elements) {
        if (element.isTypeOnly || element.name.text !== name) continue;
        imports++;
        canonical ||=
          ts.isStringLiteralLike(statement.moduleSpecifier) &&
          statement.moduleSpecifier.text === '@proto.ui/core' &&
          (element.propertyName ?? element.name).text === name;
      }
    }
    return imports === 1 && canonical && stableName(source, name);
  };
  const canonical = new Set(['tw', 'createContextKey', 'definePrototype'].filter(canonicalImport));
  const stringValue = (node: ts.Node, before: number, seen = new Set<string>()): string | null => {
    const value = unwrap(node);
    if (ts.isStringLiteralLike(value)) return value.text;
    if (!ts.isIdentifier(value) || seen.has(value.text)) return null;
    const declaration = strings.get(value.text);
    if (!declaration?.initializer || declaration.getStart() >= before) return null;
    return stringValue(
      declaration.initializer,
      declaration.getStart(),
      new Set(seen).add(value.text)
    );
  };
  const immutableString = (node: ts.Node, before: number): boolean =>
    stringValue(node, before) !== null;
  let bindings: ReturnType<typeof createHookSourceModuleContext> | undefined;
  const setupFunction = (node: ts.Node): boolean => {
    const value = unwrap(node);
    if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) return true;
    if (!ts.isIdentifier(value)) return false;
    bindings ??= createHookSourceModuleContext();
    const symbol = bindings.resolveReference(value, bindings.moduleForSource(source));
    if (!symbol) return false;
    const declaration = symbol.declaration;
    if (
      (!ts.isFunctionDeclaration(declaration) && !ts.isVariableDeclaration(declaration)) ||
      !declaration.name ||
      !ts.isIdentifier(declaration.name) ||
      !stableName(symbol.module.source, declaration.name.text, declaration)
    )
      return false;
    if (symbol.module.source !== source) {
      // Only an ordinary named value import may supply a foreign callable.
      // Resolve its actual declaration; a type/default/namespace import or an
      // imported getter/unknown value cannot borrow this construction proof.
      const imported = source.statements.some(
        (statement) =>
          ts.isImportDeclaration(statement) &&
          !statement.importClause?.isTypeOnly &&
          statement.importClause?.namedBindings &&
          ts.isNamedImports(statement.importClause.namedBindings) &&
          statement.importClause.namedBindings.elements.some(
            (element) => !element.isTypeOnly && element.name.text === value.text
          )
      );
      if (!imported || !stableName(source, value.text)) return false;
      return ts.isFunctionDeclaration(declaration) && !!declaration.body;
    }
    if (ts.isFunctionDeclaration(declaration)) return !!declaration.body;
    return (
      ts.isVariableDeclarationList(declaration.parent) &&
      (declaration.parent.flags & ts.NodeFlags.Const) !== 0 &&
      declaration.getStart() < value.getStart() &&
      !!declaration.initializer &&
      (ts.isArrowFunction(unwrap(declaration.initializer)) ||
        ts.isFunctionExpression(unwrap(declaration.initializer)))
    );
  };
  const freshPrototype = (node: ts.Node): boolean => {
    const value = unwrap(node);
    if (!ts.isObjectLiteralExpression(value) || value.properties.length !== 2) return false;
    const names = new Set<string>();
    for (const property of value.properties) {
      if (
        !property.name ||
        (!ts.isIdentifier(property.name) && !ts.isStringLiteralLike(property.name)) ||
        names.has(property.name.text)
      )
        return false;
      const name = property.name.text;
      names.add(name);
      if (name === 'name') {
        if (!ts.isPropertyAssignment(property)) return false;
        const value = stringValue(property.initializer, property.getStart());
        if (value === null || value.length === 0) return false;
      } else if (name === 'setup') {
        if (ts.isMethodDeclaration(property)) {
          if (!property.body) return false;
        } else if (ts.isPropertyAssignment(property)) {
          if (!setupFunction(property.initializer)) return false;
        } else if (ts.isShorthandPropertyAssignment(property)) {
          if (property.objectAssignmentInitializer || !setupFunction(property.name)) return false;
        } else return false;
      } else return false;
    }
    // Core reads name/setup, never invokes setup, and writes only this fresh
    // object's modules to a new frozen empty array. No modules/extra property,
    // getter, spread, __proto__ or computed key can expose shared row objects.
    return names.has('name') && names.has('setup');
  };
  const modeledCoreCall = (node: ts.Node): boolean => {
    if (
      !ts.isCallExpression(node) ||
      node.questionDotToken ||
      !ts.isIdentifier(node.expression) ||
      !canonical.has(node.expression.text)
    )
      return false;
    // Only module initializers have the lexical scope of the string bindings
    // above. Never borrow their names for a class or nested function scope.
    for (let owner = node.parent; owner && owner !== source; owner = owner.parent) {
      if (
        ts.isFunctionLike(owner) ||
        ts.isClassLike(owner) ||
        ts.isClassStaticBlockDeclaration(owner)
      )
        return false;
    }
    if (node.expression.text === 'tw')
      return node.arguments.every((argument) => immutableString(argument, node.getStart()));
    if (node.arguments.length !== 1) return false;
    if (node.expression.text === 'createContextKey')
      // Core freezes only its newly allocated { __brand, debugName } object.
      return immutableString(node.arguments[0], node.getStart());
    return freshPrototype(node.arguments[0]);
  };
  const passiveDefaultExport = (statement: ts.ExportAssignment): boolean => {
    const value = unwrap(statement.expression);
    if (statement.isExportEquals || !ts.isIdentifier(value)) return false;
    const declaration = strings.get(value.text);
    if (
      !declaration?.initializer ||
      declaration.getStart() >= statement.getStart() ||
      !stableName(source, value.text, declaration)
    )
      return false;
    const initializer = unwrap(declaration.initializer);
    return (
      ts.isCallExpression(initializer) &&
      ts.isIdentifier(initializer.expression) &&
      initializer.expression.text === 'definePrototype' &&
      modeledCoreCall(initializer)
    );
  };
  let modeledCall = false;
  const initializerHasEffects = (node: ts.Node): boolean => {
    if (ts.isFunctionLike(node)) {
      // A method's computed name runs while its object/class is created. Its
      // body and parameter defaults still wait for an actual invocation.
      return (
        !!node.name &&
        ts.isComputedPropertyName(node.name) &&
        initializerHasEffects(node.name.expression)
      );
    }
    if (modeledCoreCall(node)) {
      modeledCall = true;
      return false;
    }
    if (
      ts.isCallExpression(node) ||
      ts.isNewExpression(node) ||
      ts.isTaggedTemplateExpression(node) ||
      ts.isDeleteExpression(node) ||
      ts.isAwaitExpression(node) ||
      ts.isYieldExpression(node) ||
      (ts.isBinaryExpression(node) &&
        node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) ||
      ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
        (node.operator === ts.SyntaxKind.PlusPlusToken ||
          node.operator === ts.SyntaxKind.MinusMinusToken))
    )
      return true;
    return ts.forEachChild(node, initializerHasEffects) ?? false;
  };
  const effects = source.statements.some((statement) =>
    ts.isVariableStatement(statement)
      ? statement.declarationList.declarations.some(
          (declaration) =>
            // Destructuring executes property/iterator reads, computed keys and
            // defaults that this token-only loader does not evaluate.
            !ts.isIdentifier(declaration.name) ||
            (!!declaration.initializer && initializerHasEffects(declaration.initializer))
        )
      : ts.isExportAssignment(statement)
        ? !passiveDefaultExport(statement)
        : !(
            ts.isImportDeclaration(statement) ||
            ts.isExportDeclaration(statement) ||
            ts.isInterfaceDeclaration(statement) ||
            ts.isTypeAliasDeclaration(statement) ||
            ts.isFunctionDeclaration(statement) ||
            ts.isEmptyStatement(statement)
          )
  );
  if (effects || !modeledCall) return effects;
  // Admitting a formerly opaque call must not also admit unrelated getter or
  // coercion effects in the same module. Keep this new exemption to complete
  // literal data, immutable primitive aliases and the modeled Core handles.
  const primitiveKey = (node: ts.Node): boolean => {
    const value = unwrap(node);
    return (
      ts.isStringLiteralLike(value) ||
      ts.isNumericLiteral(value) ||
      value.kind === ts.SyntaxKind.TrueKeyword ||
      value.kind === ts.SyntaxKind.FalseKeyword ||
      value.kind === ts.SyntaxKind.NullKeyword ||
      (ts.isIdentifier(value) && immutableString(value, value.getStart())) ||
      (ts.isPrefixUnaryExpression(value) &&
        (value.operator === ts.SyntaxKind.MinusToken ||
          value.operator === ts.SyntaxKind.PlusToken) &&
        ts.isNumericLiteral(value.operand))
    );
  };
  const literalData = (node: ts.Node): boolean => {
    const value = unwrap(node);
    if (
      ts.isStringLiteralLike(value) ||
      ts.isNumericLiteral(value) ||
      value.kind === ts.SyntaxKind.TrueKeyword ||
      value.kind === ts.SyntaxKind.FalseKeyword ||
      value.kind === ts.SyntaxKind.NullKeyword
    )
      return true;
    if (ts.isIdentifier(value)) return immutableString(value, value.getStart());
    if (modeledCoreCall(value)) return true;
    if (ts.isPrefixUnaryExpression(value))
      return (
        (value.operator === ts.SyntaxKind.MinusToken ||
          value.operator === ts.SyntaxKind.PlusToken) &&
        ts.isNumericLiteral(value.operand)
      );
    if (ts.isArrayLiteralExpression(value)) return value.elements.every(literalData);
    if (ts.isFunctionLike(value))
      return (
        !value.name || !ts.isComputedPropertyName(value.name) || primitiveKey(value.name.expression)
      );
    if (ts.isObjectLiteralExpression(value))
      return value.properties.every((property) =>
        ts.isPropertyAssignment(property)
          ? (!ts.isComputedPropertyName(property.name) || primitiveKey(property.name.expression)) &&
            literalData(property.initializer)
          : ts.isShorthandPropertyAssignment(property)
            ? literalData(property.name)
            : ts.isFunctionLike(property) && literalData(property)
      );
    return false;
  };
  return source.statements.some(
    (statement) =>
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(
        (declaration) => !!declaration.initializer && !literalData(declaration.initializer)
      )
  );
}

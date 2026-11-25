import ts from 'typescript';
import type { SourceSpan } from '../diagnostics';
import type { ScalarLiteral } from '../ir';
import { evaluateStaticScalar } from './constants';
import {
  hasBindingWrites,
  isConstDeclaration,
  atExecutionPoint,
  isBindingInitialized,
  type InitializationPoints,
} from './bindings';

export function spanOf(node: ts.Node, sf: ts.SourceFile): SourceSpan {
  const start = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  const end = sf.getLineAndCharacterOfPosition(node.getEnd());
  return {
    file: sf.fileName,
    line: start.line + 1,
    column: start.character + 1,
    endLine: end.line + 1,
    endColumn: end.character + 1,
  };
}

export function sanitizeSym(name: string): string {
  return name.replace(/[^A-Za-z0-9_]/g, '_').replace(/^(\d)/, '_$1');
}

export function unwrapExpr(expr: ts.Expression): ts.Expression {
  let cur = expr;
  while (
    ts.isParenthesizedExpression(cur) ||
    ts.isAsExpression(cur) ||
    ts.isTypeAssertionExpression(cur) ||
    ts.isSatisfiesExpression(cur) ||
    ts.isNonNullExpression(cur)
  ) {
    cur = cur.expression;
  }
  return cur;
}

export function extractScalarLiteral(
  expr: ts.Expression,
  checker: ts.TypeChecker
): ScalarLiteral | undefined {
  return evaluateStaticScalar(expr, checker);
}

export function isKnownUndefined(expr: ts.Expression, checker: ts.TypeChecker): boolean {
  const value = unwrapExpr(expr);
  return (
    (ts.isIdentifier(value) &&
      value.text === 'undefined' &&
      !checker.getSymbolAtLocation(value)?.valueDeclaration) ||
    (ts.isVoidExpression(value) && evaluateStaticScalar(value.expression, checker) !== undefined)
  );
}

export function resolveAliasedSymbol(
  checker: ts.TypeChecker,
  sym: ts.Symbol | undefined
): ts.Symbol | undefined {
  const visited = new Set<ts.Symbol>();
  while (sym && !visited.has(sym)) {
    visited.add(sym);
    if (sym.flags & ts.SymbolFlags.Alias) {
      sym = checker.getAliasedSymbol(sym);
      continue;
    }
    const declaration = sym.valueDeclaration;
    if (declaration && ts.isShorthandPropertyAssignment(declaration)) {
      const value = checker.getShorthandAssignmentValueSymbol(declaration);
      if (value && value !== sym) {
        sym = value;
        continue;
      }
    }
    return sym;
  }
  return undefined;
}

export function resolveCallName(
  expr: ts.Expression,
  checker: ts.TypeChecker,
  visited = new Set<ts.Symbol>(),
  initializationPoints: InitializationPoints = new Map()
): { name: string; sourceFile?: string } | undefined {
  const e = unwrapExpr(expr);
  const points = atExecutionPoint(e, initializationPoints);
  const sym = resolveAliasedSymbol(checker, checker.getSymbolAtLocation(e));
  if (sym) {
    if (visited.has(sym)) return undefined;
    visited.add(sym);
    const decl = sym.valueDeclaration ?? sym.declarations?.[0];
    if (decl && ts.isVariableDeclaration(decl) && !isBindingInitialized(decl, points, checker))
      return undefined;
    if (
      decl &&
      ts.isVariableDeclaration(decl) &&
      isConstDeclaration(decl) &&
      decl.initializer &&
      (ts.isIdentifier(unwrapExpr(decl.initializer)) ||
        ts.isPropertyAccessExpression(unwrapExpr(decl.initializer)))
    ) {
      return resolveCallName(decl.initializer, checker, visited, points);
    }
    return { name: sym.getName(), sourceFile: decl?.getSourceFile().fileName };
  }
  if (ts.isIdentifier(e)) return { name: e.text };
  return undefined;
}

export function findFactoryCall(
  expr: ts.Expression,
  checker: ts.TypeChecker,
  factoryNames: readonly string[],
  visited = new Set<ts.Node>(),
  initializationPoints: InitializationPoints = new Map()
): { call: ts.CallExpression; factory: string } | undefined {
  const e = unwrapExpr(expr);
  const points = atExecutionPoint(e, initializationPoints);
  if (visited.has(e)) return undefined;
  visited.add(e);

  if (ts.isCallExpression(e)) {
    const resolved = resolveCallName(e.expression, checker, new Set(), points);
    if (resolved && factoryNames.includes(resolved.name) && isCoreIntrinsic(resolved)) {
      return { call: e, factory: resolved.name };
    }
  }
  if (ts.isIdentifier(e)) {
    const sym = resolveAliasedSymbol(checker, checker.getSymbolAtLocation(e));
    const decl = sym?.valueDeclaration ?? sym?.declarations?.[0];
    if (
      decl &&
      ts.isVariableDeclaration(decl) &&
      isConstDeclaration(decl) &&
      decl.initializer &&
      isBindingInitialized(decl, points, checker)
    ) {
      return findFactoryCall(decl.initializer, checker, factoryNames, visited, points);
    }
  }
  return undefined;
}

/** Intrinsics must resolve to the core definition, including import/re-export aliases. */
export function isCoreIntrinsic(binding: { sourceFile?: string }): boolean {
  const file = binding.sourceFile?.replaceAll('\\', '/');
  return !!file && (file.includes('/packages/core/src/') || file.includes('/@proto.ui/core/'));
}

export function resolveFunctionLike(
  expr: ts.Expression,
  checker: ts.TypeChecker,
  initializationPoints: InitializationPoints = new Map(),
  visited = new Set<ts.Node>()
): ts.FunctionLikeDeclaration | undefined {
  const e = unwrapExpr(expr);
  const points = atExecutionPoint(e, initializationPoints);
  if (visited.has(e)) return undefined;
  visited.add(e);
  if (ts.isArrowFunction(e) || ts.isFunctionExpression(e)) return e;
  if (ts.isIdentifier(e)) {
    const sym = resolveAliasedSymbol(checker, checker.getSymbolAtLocation(e));
    const decl = sym?.valueDeclaration ?? sym?.declarations?.[0];
    if (!decl) return undefined;
    if (ts.isFunctionDeclaration(decl))
      return sym && !hasBindingWrites(sym, checker) ? decl : undefined;
    if (ts.isMethodDeclaration(decl)) return decl;
    if (
      ts.isVariableDeclaration(decl) &&
      isConstDeclaration(decl) &&
      decl.initializer &&
      isBindingInitialized(decl, points, checker)
    ) {
      return resolveFunctionLike(decl.initializer, checker, points, visited);
    }
  }
  return undefined;
}

export function isPrototypeType(expression: ts.Expression, checker: ts.TypeChecker): boolean {
  const visited = new Set<ts.Type>();
  const check = (type: ts.Type): boolean => {
    if (visited.has(type)) return false;
    visited.add(type);
    const symbol = type.aliasSymbol ?? type.getSymbol();
    if (
      symbol?.getName() === 'Prototype' &&
      symbol.declarations?.some((declaration) =>
        isCoreIntrinsic({ sourceFile: declaration.getSourceFile().fileName })
      )
    )
      return true;
    if (type.isUnionOrIntersection()) return type.types.some(check);
    const setup = checker.getPropertyOfType(type, 'setup');
    return !!setup?.declarations?.some((declaration) =>
      isCoreIntrinsic({ sourceFile: declaration.getSourceFile().fileName })
    );
  };
  return check(checker.getTypeAtLocation(expression));
}

export function propAccessChain(expr: ts.Expression): string[] | undefined {
  const parts: string[] = [];
  let cur: ts.Expression = unwrapExpr(expr);
  while (ts.isPropertyAccessExpression(cur)) {
    parts.unshift(cur.name.text);
    cur = unwrapExpr(cur.expression);
  }
  if (ts.isIdentifier(cur)) {
    parts.unshift(cur.text);
    return parts;
  }
  return undefined;
}

export function extractObjectProperty(
  obj: ts.ObjectLiteralExpression,
  name: string
): ts.Expression | undefined {
  for (const prop of [...obj.properties].reverse()) {
    if (ts.isPropertyAssignment(prop)) {
      const key =
        ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : undefined;
      if (key === name) return prop.initializer;
    } else if (ts.isShorthandPropertyAssignment(prop) && prop.name.text === name) {
      return prop.name;
    } else if (ts.isMethodDeclaration(prop)) {
      const key =
        ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : undefined;
      if (key === name) {
        // Return a synthetic-free reference via caller checking method declarations separately.
        return undefined;
      }
    }
  }
  return undefined;
}

export function extractSetupFunction(
  obj: ts.ObjectLiteralExpression,
  checker: ts.TypeChecker,
  initializationPoints: InitializationPoints = new Map()
): ts.FunctionLikeDeclaration | undefined {
  for (const prop of [...obj.properties].reverse()) {
    if (
      ts.isMethodDeclaration(prop) &&
      (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) &&
      prop.name.text === 'setup'
    ) {
      return prop;
    }
    if (
      ts.isPropertyAssignment(prop) &&
      (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) &&
      prop.name.text === 'setup'
    ) {
      return resolveFunctionLike(prop.initializer, checker, initializationPoints);
    }
    if (ts.isShorthandPropertyAssignment(prop) && prop.name.text === 'setup') {
      return resolveFunctionLike(prop.name, checker, initializationPoints);
    }
  }
  return undefined;
}

/** Resolve a const definition object only when every reference stays at an intrinsic boundary. */
export function resolveDefinitionObject(
  expression: ts.Expression,
  checker: ts.TypeChecker,
  initializationPoints: InitializationPoints = new Map()
): ts.ObjectLiteralExpression | undefined {
  const value = unwrapExpr(expression);
  if (ts.isObjectLiteralExpression(value)) return value;
  if (!ts.isIdentifier(value)) return undefined;
  const binding = resolveAliasedSymbol(checker, checker.getSymbolAtLocation(value));
  const declaration = binding?.valueDeclaration;
  if (
    !declaration ||
    !ts.isVariableDeclaration(declaration) ||
    !declaration.initializer ||
    !ts.isVariableDeclarationList(declaration.parent) ||
    !(declaration.parent.flags & ts.NodeFlags.Const) ||
    !isBindingInitialized(declaration, atExecutionPoint(value, initializationPoints), checker)
  )
    return undefined;
  const object = unwrapExpr(declaration.initializer);
  if (!ts.isObjectLiteralExpression(object)) return undefined;
  let escaped = false;
  const inspect = (node: ts.Node): void => {
    if (escaped) return;
    if (
      ts.isIdentifier(node) &&
      node !== declaration.name &&
      resolveAliasedSymbol(checker, checker.getSymbolAtLocation(node)) === binding
    ) {
      const parent = node.parent;
      const intrinsic =
        ts.isCallExpression(parent) && parent.arguments.includes(node)
          ? resolveCallName(parent.expression, checker)
          : undefined;
      if (
        !intrinsic ||
        !isCoreIntrinsic(intrinsic) ||
        !['definePrototype', 'defineAsHook', 'defineHook'].includes(intrinsic.name)
      )
        escaped = true;
    }
    ts.forEachChild(node, inspect);
  };
  inspect(declaration.getSourceFile());
  return escaped ? undefined : object;
}

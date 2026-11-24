import ts from 'typescript';
import type { ScalarLiteral } from '../ir/types';
import { hasBindingWrites, isConstDeclaration } from './bindings';

type Evaluation = { known: true; value: ScalarLiteral } | { known: false };
const unknown: Evaluation = { known: false };

/** Bounded compile-time evaluation of proven pure scalar syntax, never of a type assertion. */
export function evaluateStaticScalar(
  expression: ts.Expression,
  checker: ts.TypeChecker
): ScalarLiteral | undefined {
  let budget = 512;
  const active = new Set<ts.Node>();
  const known = (value: ScalarLiteral): Evaluation => ({ known: true, value });
  const symbol = (node: ts.Node): ts.Symbol | undefined => {
    const value = checker.getSymbolAtLocation(node);
    return value && value.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(value) : value;
  };
  const evaluate = (
    raw: ts.Expression,
    scope: ReadonlyMap<ts.Symbol, ScalarLiteral>
  ): Evaluation => {
    if (--budget < 0) return unknown;
    if (
      ts.isParenthesizedExpression(raw) ||
      ts.isAsExpression(raw) ||
      ts.isSatisfiesExpression(raw) ||
      ts.isNonNullExpression(raw)
    )
      return evaluate(raw.expression, scope);
    if (ts.isStringLiteral(raw) || ts.isNoSubstitutionTemplateLiteral(raw)) return known(raw.text);
    if (ts.isNumericLiteral(raw)) return known(Number(raw.text));
    if (raw.kind === ts.SyntaxKind.TrueKeyword) return known(true);
    if (raw.kind === ts.SyntaxKind.FalseKeyword) return known(false);
    if (raw.kind === ts.SyntaxKind.NullKeyword) return known(null);
    if (ts.isIdentifier(raw)) {
      const binding = symbol(raw);
      if (!binding) return unknown;
      if (scope.has(binding)) return known(scope.get(binding)!);
      const declaration = binding.valueDeclaration ?? binding.declarations?.[0];
      if (
        declaration &&
        ts.isVariableDeclaration(declaration) &&
        declaration.initializer &&
        ts.isVariableDeclarationList(declaration.parent) &&
        declaration.parent.flags & ts.NodeFlags.Const &&
        !active.has(declaration)
      ) {
        active.add(declaration);
        const result = evaluate(declaration.initializer, scope);
        active.delete(declaration);
        return result;
      }
      return unknown;
    }
    if (ts.isPrefixUnaryExpression(raw)) {
      const operand = evaluate(raw.operand, scope);
      if (!operand.known) return unknown;
      if (raw.operator === ts.SyntaxKind.ExclamationToken) return known(!operand.value);
      if (typeof operand.value !== 'number') return unknown;
      if (raw.operator === ts.SyntaxKind.MinusToken) return known(-operand.value);
      if (raw.operator === ts.SyntaxKind.PlusToken) return known(+operand.value);
      return unknown;
    }
    if (ts.isConditionalExpression(raw)) {
      const condition = evaluate(raw.condition, scope);
      return condition.known
        ? evaluate(condition.value ? raw.whenTrue : raw.whenFalse, scope)
        : unknown;
    }
    if (ts.isBinaryExpression(raw)) {
      const left = evaluate(raw.left, scope);
      if (!left.known) return unknown;
      const op = raw.operatorToken.kind;
      if (op === ts.SyntaxKind.AmpersandAmpersandToken)
        return left.value ? evaluate(raw.right, scope) : left;
      if (op === ts.SyntaxKind.BarBarToken) return left.value ? left : evaluate(raw.right, scope);
      if (op === ts.SyntaxKind.QuestionQuestionToken)
        return left.value === null ? evaluate(raw.right, scope) : left;
      const right = evaluate(raw.right, scope);
      if (!right.known) return unknown;
      if (op === ts.SyntaxKind.EqualsEqualsEqualsToken) return known(left.value === right.value);
      if (op === ts.SyntaxKind.ExclamationEqualsEqualsToken)
        return known(left.value !== right.value);
      if (
        typeof left.value === 'string' &&
        typeof right.value === 'string' &&
        op === ts.SyntaxKind.PlusToken
      ) {
        return known(left.value + right.value);
      }
      if (typeof left.value !== 'number' || typeof right.value !== 'number') return unknown;
      switch (op) {
        case ts.SyntaxKind.PlusToken:
          return known(left.value + right.value);
        case ts.SyntaxKind.MinusToken:
          return known(left.value - right.value);
        case ts.SyntaxKind.AsteriskToken:
          return known(left.value * right.value);
        case ts.SyntaxKind.SlashToken:
          return known(left.value / right.value);
        case ts.SyntaxKind.PercentToken:
          return known(left.value % right.value);
        case ts.SyntaxKind.LessThanToken:
          return known(left.value < right.value);
        case ts.SyntaxKind.LessThanEqualsToken:
          return known(left.value <= right.value);
        case ts.SyntaxKind.GreaterThanToken:
          return known(left.value > right.value);
        case ts.SyntaxKind.GreaterThanEqualsToken:
          return known(left.value >= right.value);
        default:
          return unknown;
      }
    }
    if (ts.isCallExpression(raw) && ts.isIdentifier(raw.expression)) {
      const binding = symbol(raw.expression);
      const declaration = binding?.valueDeclaration ?? binding?.declarations?.[0];
      const fn =
        declaration && ts.isFunctionDeclaration(declaration)
          ? declaration
          : declaration &&
              ts.isVariableDeclaration(declaration) &&
              isConstDeclaration(declaration) &&
              declaration.initializer &&
              (ts.isArrowFunction(declaration.initializer) ||
                ts.isFunctionExpression(declaration.initializer))
            ? declaration.initializer
            : undefined;
      if (!fn?.body || raw.arguments.length !== fn.parameters.length || active.has(fn))
        return unknown;
      if (!binding || hasBindingWrites(binding, checker)) return unknown;
      if (fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) || fn.asteriskToken)
        return unknown;
      const local = new Map(scope);
      for (let i = 0; i < fn.parameters.length; i++) {
        const parameter = fn.parameters[i];
        if (!ts.isIdentifier(parameter.name) || parameter.dotDotDotToken || parameter.initializer)
          return unknown;
        const parameterSymbol = symbol(parameter.name);
        const argument = evaluate(raw.arguments[i], scope);
        if (!parameterSymbol || !argument.known) return unknown;
        local.set(parameterSymbol, argument.value);
      }
      active.add(fn);
      const result = ts.isBlock(fn.body)
        ? execute(fn.body.statements, local)
        : evaluate(fn.body, local);
      active.delete(fn);
      return result;
    }
    return unknown;
  };
  const execute = (
    statements: readonly ts.Statement[],
    outer: ReadonlyMap<ts.Symbol, ScalarLiteral>
  ): Evaluation => {
    const local = new Map(outer);
    for (const stmt of statements) {
      if (--budget < 0) return unknown;
      if (ts.isReturnStatement(stmt))
        return stmt.expression ? evaluate(stmt.expression, local) : unknown;
      if (ts.isVariableStatement(stmt) && stmt.declarationList.flags & ts.NodeFlags.Const) {
        for (const declaration of stmt.declarationList.declarations) {
          if (!ts.isIdentifier(declaration.name) || !declaration.initializer) return unknown;
          const binding = symbol(declaration.name);
          const result = evaluate(declaration.initializer, local);
          if (!binding || !result.known) return unknown;
          local.set(binding, result.value);
        }
      } else if (ts.isIfStatement(stmt)) {
        const condition = evaluate(stmt.expression, local);
        if (!condition.known) return unknown;
        const chosen = condition.value ? stmt.thenStatement : stmt.elseStatement;
        if (chosen) {
          // A scalar folded branch must return. Fall-through effects are never ignored.
          const branch = execute(ts.isBlock(chosen) ? chosen.statements : [chosen], local);
          if (branch.known) return branch;
          return unknown;
        }
      } else if (!ts.isEmptyStatement(stmt)) return unknown;
    }
    return unknown;
  };
  const result = evaluate(expression, new Map());
  return result.known ? result.value : undefined;
}

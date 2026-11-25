import ts from 'typescript';
import type { LiteralValue } from '../targets/component-ir.ts';
import { numberLiteral, type BehaviorCallback } from './behavior-types.ts';
import type { SourceContext } from './source.ts';

export type SourceFunction = BehaviorCallback;
export type Member = ts.PropertyAssignment | ts.ShorthandPropertyAssignment | ts.MethodDeclaration;

/** The operand still has to prove its value or capability, irrespective of the asserted type. */
export function operand(expression: ts.Expression): ts.Expression {
  while (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isNonNullExpression(expression)
  ) {
    expression = expression.expression;
  }
  return expression;
}

export function memberAccess(
  expression: ts.Expression
): { object: ts.Expression; key: string } | undefined {
  const node = operand(expression);
  if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.name)) {
    return { object: node.expression, key: node.name.text };
  }
  if (ts.isElementAccessExpression(node)) {
    const key = operand(node.argumentExpression);
    if (ts.isStringLiteralLike(key) || ts.isNumericLiteral(key))
      return { object: node.expression, key: key.text };
  }
  return undefined;
}

function propertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name))
    return name.text;
  if (ts.isComputedPropertyName(name)) {
    const key = operand(name.expression);
    if (ts.isStringLiteralLike(key) || ts.isNumericLiteral(key)) return key.text;
  }
  return undefined;
}

export function objectMembers(
  source: SourceContext,
  expression: ts.Expression,
  role: string,
  allowed?: readonly string[]
): Map<string, Member> {
  const node = operand(expression);
  if (!ts.isObjectLiteralExpression(node)) {
    return source.missing(
      node,
      role,
      `Resolving this ${role} needs its complete set of evaluated object members.`
    );
  }
  const members = new Map<string, Member>();
  for (const member of node.properties) {
    if (
      !ts.isPropertyAssignment(member) &&
      !ts.isShorthandPropertyAssignment(member) &&
      !ts.isMethodDeclaration(member)
    ) {
      return source.missing(
        member,
        role,
        `Lowering this ${role} member requires its evaluation and property semantics.`
      );
    }
    if (ts.isShorthandPropertyAssignment(member) && member.objectAssignmentInitializer) {
      return source.missing(
        member.objectAssignmentInitializer,
        role,
        `Lowering this ${role} needs its shorthand initializer.`
      );
    }
    const key = propertyName(member.name);
    if (key === undefined)
      return source.missing(
        member.name,
        role,
        `The computed ${role} key needs value and effect lowering.`
      );
    if (allowed && !allowed.includes(key))
      return source.missing(
        member,
        role,
        `The ${role} member ${JSON.stringify(key)} has no checked lowering.`
      );
    if (members.has(key))
      return source.missing(
        member,
        role,
        `Lowering duplicate ${role} key ${JSON.stringify(key)} needs both evaluations in order.`
      );
    // A colon-initialized __proto__ in an object literal changes its prototype instead of defining an own key.
    if (
      key === '__proto__' &&
      ts.isPropertyAssignment(member) &&
      !ts.isComputedPropertyName(member.name)
    ) {
      return source.missing(
        member,
        role,
        `This ${role} uses a prototype initializer; its own data members are unproved.`
      );
    }
    members.set(key, member);
  }
  return members;
}

export function memberValue(source: SourceContext, member: Member, role: string): ts.Expression {
  if (ts.isPropertyAssignment(member)) return member.initializer;
  if (ts.isShorthandPropertyAssignment(member)) return member.name;
  return source.missing(
    member,
    role,
    `A callable ${role} needs its own function-value lowering here.`
  );
}

export function argumentsIn(
  source: SourceContext,
  call: ts.CallExpression,
  min: number,
  max: number,
  role: string
): void {
  const spread = call.arguments.find(ts.isSpreadElement);
  if (spread)
    source.missing(
      spread,
      role,
      `Lowering spread arguments in ${role} requires their argument values and order.`
    );
  if (call.arguments.length < min || call.arguments.length > max) {
    source.missing(
      call.arguments[max] ?? call,
      role,
      `This ${role} call needs lowering for its ${call.arguments.length} arguments.`
    );
  }
}

export function isConstDeclaration(node: ts.Declaration): node is ts.VariableDeclaration {
  return (
    ts.isVariableDeclaration(node) &&
    ts.isVariableDeclarationList(node.parent) &&
    (node.parent.flags & ts.NodeFlags.Const) !== 0
  );
}

function namespaceMember(source: SourceContext, expression: ts.Expression): ts.Symbol | undefined {
  const access = memberAccess(expression);
  if (!access) return undefined;
  const base = operand(access.object);
  if (!ts.isIdentifier(base)) return undefined;
  const imported = source.checker.getSymbolAtLocation(base);
  if (!imported?.declarations?.some(ts.isNamespaceImport)) return undefined;
  const namespace = source.symbol(base);
  const exported = source.checker
    .getExportsOfModule(namespace)
    .find((item) => item.name === access.key);
  if (!exported) return undefined;
  return exported.flags & ts.SymbolFlags.Alias
    ? source.checker.getAliasedSymbol(exported)
    : exported;
}

/** Resolve actual source callables, including imports and immutable aliases. A property of an arbitrary
 * object could invoke a getter or depend on its receiver, even when the checker gives it the same signature. */
export function sourceFunction(
  source: SourceContext,
  expression: ts.Expression | ts.MethodDeclaration
): SourceFunction | undefined {
  if (ts.isMethodDeclaration(expression)) return expression.body ? expression : undefined;
  const seen = new Set<ts.Symbol>();
  let node = operand(expression);
  for (;;) {
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return node;
    const symbol = ts.isIdentifier(node) ? source.symbol(node) : namespaceMember(source, node);
    if (!symbol || seen.has(symbol)) return undefined;
    seen.add(symbol);
    const implementation = symbol.declarations?.find(
      (declaration): declaration is ts.FunctionDeclaration =>
        ts.isFunctionDeclaration(declaration) &&
        declaration.body !== undefined &&
        !declaration.getSourceFile().isDeclarationFile
    );
    if (implementation) return implementation;
    const declaration = symbol.valueDeclaration;
    if (
      !declaration ||
      !isConstDeclaration(declaration) ||
      !declaration.initializer ||
      declaration.getSourceFile().isDeclarationFile
    )
      return undefined;
    node = operand(declaration.initializer);
  }
}

export function checkedFunction(
  source: SourceContext,
  value: ts.Expression | SourceFunction,
  role: string
): SourceFunction {
  const fn = ts.isFunctionDeclaration(value) ? value : sourceFunction(source, value);
  if (!fn?.body)
    return source.missing(value, role, `The ${role} needs its resolved authored function body.`);
  if (
    fn.asteriskToken ||
    fn.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)
  ) {
    return source.missing(
      fn,
      role,
      `The ${role} requires lowering for its suspension or iteration semantics.`
    );
  }
  return fn;
}

export function capabilityParameter(
  source: SourceContext,
  parameter: ts.ParameterDeclaration,
  role: string
): ts.Identifier {
  if (
    !ts.isIdentifier(parameter.name) ||
    parameter.name.text === 'this' ||
    parameter.initializer ||
    parameter.dotDotDotToken
  ) {
    return source.missing(
      parameter,
      role,
      `The ${role} needs a checked origin through this parameter binding.`
    );
  }
  return parameter.name;
}

export function declarationOnly(statement: ts.Statement): boolean {
  return (
    ts.isFunctionDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isEmptyStatement(statement)
  );
}

/** Only literal values, or immutable bindings with a proved literal initializer, are compile-time data. */
export function sourceLiteral(
  source: SourceContext,
  expression: ts.Expression
): LiteralValue | undefined {
  const seen = new Set<ts.Symbol>();
  let node = operand(expression);
  let sign = 1;
  let numeric = false;
  for (;;) {
    if (!numeric) {
      if (ts.isStringLiteralLike(node)) return { kind: 'text', value: node.text };
      if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) {
        return { kind: 'bool', value: node.kind === ts.SyntaxKind.TrueKeyword };
      }
    }
    if (
      ts.isPrefixUnaryExpression(node) &&
      (node.operator === ts.SyntaxKind.MinusToken || node.operator === ts.SyntaxKind.PlusToken)
    ) {
      if (node.operator === ts.SyntaxKind.MinusToken) sign = -sign;
      numeric = true;
      node = operand(node.operand);
      continue;
    }
    let value: number;
    if (ts.isNumericLiteral(node)) value = Number(node.text);
    else if (ts.isIdentifier(node) && source.intrinsic(node, 'Infinity')) value = Infinity;
    else if (ts.isIdentifier(node) && source.intrinsic(node, 'NaN')) value = NaN;
    else {
      const symbol = ts.isIdentifier(node) ? source.symbol(node) : namespaceMember(source, node);
      const declaration = symbol?.valueDeclaration;
      if (
        !symbol ||
        seen.has(symbol) ||
        !declaration ||
        !isConstDeclaration(declaration) ||
        !declaration.initializer
      )
        return undefined;
      seen.add(symbol);
      node = operand(declaration.initializer);
      continue;
    }
    return numberLiteral(sign < 0 ? -value : value);
  }
}

export function sourceName(source: SourceContext, expression: ts.Expression, role: string): string {
  const literal = sourceLiteral(source, expression);
  if (literal?.kind !== 'text' || !literal.value) {
    return source.missing(
      expression,
      role,
      `The receiving IR needs a resolved, nonempty text name for ${role}.`
    );
  }
  return literal.value;
}

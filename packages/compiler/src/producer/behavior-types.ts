import ts from 'typescript';
import type { Behavior, Binding, LiteralValue, ValueType } from '../targets/component-ir.ts';
import type { SourceContext } from './source.ts';

export type BehaviorCallback =
  | ts.ArrowFunction
  | ts.FunctionExpression
  | ts.MethodDeclaration
  | ts.FunctionDeclaration;
export type Phase = Behavior['phase'];
export type Readable = { kind: 'prop' | 'state' | 'capture' | 'derive'; binding: Binding };
export type Reference = Readable | { kind: 'signal'; binding: Binding };
export type ResolveRead = (expression: ts.Expression) => Reference | undefined;

function scalarDomain(source: SourceContext, type: ts.Type): ValueType | undefined {
  if (type.flags & ts.TypeFlags.BooleanLike) return 'bool';
  if (type.flags & ts.TypeFlags.NumberLike) return 'number';
  if (type.flags & ts.TypeFlags.StringLike) return 'text';
  if (type.flags & ts.TypeFlags.Void) return 'unit';
  if (type.isUnion()) {
    const first = scalarDomain(source, type.types[0]!);
    return first && type.types.slice(1).every((part) => scalarDomain(source, part) === first)
      ? first
      : undefined;
  }
  for (const symbol of [type.getSymbol(), type.aliasSymbol]) {
    if (
      symbol?.declarations?.some(
        (decl) =>
          (ts.isInterfaceDeclaration(decl) || ts.isTypeAliasDeclaration(decl)) &&
          source.intrinsic(decl.name, 'StyleTokens')
      )
    )
      return 'tokens';
  }
  return undefined;
}

export function behaviorValueType(
  source: SourceContext,
  node: ts.Node,
  type = source.checker.getTypeAtLocation(node)
): ValueType {
  return (
    scalarDomain(source, type) ??
    source.missing(
      node,
      'producer/value-type',
      `The behavior receiver cannot yet represent the checked value type ${source.checker.typeToString(type)}.`
    )
  );
}

export function behaviorReturnType(source: SourceContext, node: BehaviorCallback): ValueType {
  const signature = source.checker.getSignatureFromDeclaration(node);
  if (!signature)
    return source.missing(
      node,
      'producer/signature',
      'The behavior needs a resolved source signature.'
    );
  return behaviorValueType(
    source,
    node.type ?? node,
    source.checker.getReturnTypeOfSignature(signature)
  );
}

export function unparenthesize(node: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(node)) node = node.expression;
  return node;
}

// Only identifiers and static projections can be removed as symbolic locations. In
// particular, a checker-resolved member on a call result still evaluates its receiver.
export function staticReference(node: ts.Expression): boolean {
  node = unparenthesize(node);
  if (ts.isIdentifier(node)) return true;
  if (ts.isPropertyAccessExpression(node))
    return !node.questionDotToken && staticReference(node.expression);
  return (
    ts.isElementAccessExpression(node) &&
    !node.questionDotToken &&
    ts.isStringLiteralLike(node.argumentExpression) &&
    staticReference(node.expression)
  );
}

// A namespace import can qualify a function without running an author object
// receiver or supplying author-defined `this`. Keep arbitrary property calls out.
export function staticCallee(source: SourceContext, node: ts.Expression): boolean {
  node = unparenthesize(node);
  if (ts.isIdentifier(node)) return true;
  if (
    !ts.isPropertyAccessExpression(node) ||
    node.questionDotToken ||
    !staticCallee(source, node.expression)
  )
    return false;
  const owner = source.symbol(unparenthesize(node.expression));
  return owner.declarations?.some(ts.isSourceFile) === true;
}

export function moduleConstant(symbol: ts.Symbol): ts.VariableDeclaration | undefined {
  const declaration = symbol.valueDeclaration;
  if (
    !declaration ||
    !ts.isVariableDeclaration(declaration) ||
    !declaration.initializer ||
    !ts.isVariableDeclarationList(declaration.parent) ||
    !(declaration.parent.flags & ts.NodeFlags.Const) ||
    !ts.isVariableStatement(declaration.parent.parent) ||
    !ts.isSourceFile(declaration.parent.parent.parent)
  )
    return undefined;
  return declaration;
}

export function checkParameters(
  source: SourceContext,
  parameters: readonly ts.ParameterDeclaration[]
): void {
  for (const param of parameters) {
    if (
      !ts.isIdentifier(param.name) ||
      param.name.text === 'this' ||
      param.initializer ||
      param.dotDotDotToken ||
      param.questionToken ||
      param.modifiers?.length
    ) {
      source.missing(
        param,
        'producer/parameter',
        'This parameter needs source binding, default, rest, optional, or receiver lowering.'
      );
    }
  }
}

export function requireArity(
  source: SourceContext,
  call: ts.CallExpression,
  expected: number
): void {
  if (call.arguments.length !== expected || call.arguments.some(ts.isSpreadElement)) {
    source.missing(
      call,
      'producer/call-arguments',
      `This call needs exactly ${expected} ordinary arguments for the resolved parameter list.`
    );
  }
}

export function requireDomain(
  source: SourceContext,
  node: ts.Node,
  actual: ValueType,
  expected: ValueType
): void {
  if (actual !== expected) {
    source.missing(
      node,
      'producer/value-domain',
      `The checked operation needs ${expected}, but its source value lowers as ${actual}.`
    );
  }
}

const binary64 = new DataView(new ArrayBuffer(8));
export function numberLiteral(value: number): Extract<LiteralValue, { kind: 'number' }> {
  binary64.setFloat64(0, value);
  return { kind: 'number', bits: binary64.getBigUint64(0).toString(16).padStart(16, '0') };
}

function constantNumber(source: SourceContext, node: ts.Expression): number | undefined {
  node = unparenthesize(node);
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isIdentifier(node)) {
    const symbol = source.symbol(node);
    const declaration = symbol.valueDeclaration;
    if (
      declaration &&
      ts.isVariableDeclaration(declaration) &&
      declaration.getSourceFile().isDeclarationFile &&
      !declaration.initializer
    ) {
      if (symbol.name === 'NaN' && source.intrinsic(node, 'NaN')) return NaN;
      if (symbol.name === 'Infinity' && source.intrinsic(node, 'Infinity')) return Infinity;
    }
  }
  if (
    ts.isPrefixUnaryExpression(node) &&
    (node.operator === ts.SyntaxKind.MinusToken || node.operator === ts.SyntaxKind.PlusToken)
  ) {
    const operand = constantNumber(source, node.operand);
    if (operand !== undefined)
      return node.operator === ts.SyntaxKind.MinusToken ? -operand : operand;
  }
  return undefined;
}

export function literalValue(source: SourceContext, node: ts.Expression): LiteralValue | undefined {
  node = unparenthesize(node);
  if (ts.isStringLiteralLike(node)) return { kind: 'text', value: node.text };
  if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) {
    return { kind: 'bool', value: node.kind === ts.SyntaxKind.TrueKeyword };
  }
  const number = constantNumber(source, node);
  return number === undefined ? undefined : numberLiteral(number);
}

/** Module closure admission proves these initializers ran. Follow immutable
 * source aliases only to an actual literal in that closure. */
export function moduleLiteral(
  source: SourceContext,
  expression: ts.Expression
): LiteralValue | undefined {
  const visited = new Set<ts.Symbol>();
  let node = unparenthesize(expression);
  while (staticCallee(source, node)) {
    const symbol = source.symbol(node);
    const declaration = moduleConstant(symbol);
    if (!declaration?.initializer || visited.has(symbol)) break;
    visited.add(symbol);
    node = unparenthesize(declaration.initializer);
  }
  return literalValue(source, node);
}

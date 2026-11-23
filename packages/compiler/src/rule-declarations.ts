import ts from 'typescript';
import type { RuleDep, WhenExpr } from '../../core/src/handles';
import { tw } from '../../core/src/spec/feedback/style';
import { assertTwTokenV0 } from '../../core/src/spec/feedback/tokens';
import { acceptsValue, type DataType } from './data-types';
import type { Primitive, SourceSpan } from './ir';
import type { SourceModule } from './parser-module';
import { propertyName, rejectNode, sourceSpan, staticJoin } from './source-syntax';
import type { StyleTokenHandle } from './style-plan';

type CoreCondition = WhenExpr<Record<string, Primitive>>;
type CoreDependency = RuleDep<Record<string, Primitive>>;

/** The existing Rule WhenExpr language over portable source identities. */
export type RuleValue = (
  | { type: 'prop'; key: string }
  | { type: 'state'; id: string }
  | { type: 'meta'; key: string }
) & {
  span: SourceSpan;
};
export type RuleCondition = (
  | Extract<CoreCondition, { type: 'true' | 'false' }>
  | (Omit<Extract<CoreCondition, { type: 'eq' }>, 'left'> & { left: RuleValue })
  | (Omit<Extract<CoreCondition, { type: 'gte' }>, 'left'> & { left: RuleValue })
  | { type: 'not'; expr: RuleCondition }
  | { type: 'all' | 'any'; exprs: RuleCondition[] }
) & { span: SourceSpan };
export type RuleDependency = (
  | Extract<CoreDependency, { kind: 'prop' }>
  | { kind: 'state'; id: string }
  | { kind: 'meta'; key: string }
) & { span: SourceSpan };
export type RuleStyleOperand = StyleTokenHandle | { kind: 'reference'; id: string };
export interface RuleStyleOperation {
  kind: 'feedback.style.use';
  /** Stable within this declaration, including when the declaration is inactive. */
  id: string;
  handles: RuleStyleOperand[];
  target?: { id: string };
  span: SourceSpan;
}
export interface RuleDeclarationIR {
  operation: 'rule.declare';
  id: number;
  order: number;
  label?: string;
  note?: string;
  deps: RuleDependency[];
  when: RuleCondition;
  intent: { kind: 'ops'; ops: RuleStyleOperation[] };
  span: SourceSpan;
}
export interface RuleStateBinding {
  id: string;
  type: DataType;
}
export interface RuleDeclarationContext {
  id: number;
  order: number;
  props: ReadonlyMap<string, DataType>;
  /** Compiler-owned resolution of declared state identities; never reads a live state handle. */
  resolveState(expression: ts.Expression): RuleStateBinding | undefined;
  /** Use the shared style extractor/source graph to admit declarations and trusted factories. */
  resolveStyle(expression: ts.Expression): StyleTokenHandle | undefined;
  /** First-class checked handles transported through ordinary helper parameters. */
  resolveStyleReference?(expression: ts.Expression): { id: string } | undefined;
  resolveTarget?(expression: ts.Expression): { id: string } | undefined;
  /** Optional checked lexical constants, including a known omitted optional argument. */
  resolveStatic?(expression: ts.Expression): { value: Primitive | undefined } | undefined;
}

type Callback = ts.ArrowFunction | ts.FunctionExpression | ts.MethodDeclaration;
type WhenPart =
  | { kind: 'condition'; value: RuleCondition }
  | { kind: 'signal'; value: RuleValue; type?: DataType }
  | { kind: 'literal'; value: Primitive };
const code = 'PUI1024';
const tokenType: DataType = {
  kind: 'record',
  fields: [
    { name: 'kind', type: { kind: 'literal', value: 'tw' } },
    { name: 'tokens', type: { kind: 'array', element: 'string' } },
  ],
};

function unwrap(node: ts.Expression): ts.Expression {
  while (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isSatisfiesExpression(node)
  )
    node = node.expression;
  return node;
}

function callback(node: ts.Node): Callback {
  if (!ts.isArrowFunction(node) && !ts.isFunctionExpression(node) && !ts.isMethodDeclaration(node))
    rejectNode(node, code, 'Rules require inline statically checked when/intent callbacks.');
  if (
    !node.body ||
    node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) ||
    ('asteriskToken' in node && node.asteriskToken) ||
    node.typeParameters?.length
  )
    rejectNode(
      node,
      code,
      'Async, generator, generic and external rule callbacks are unsupported.'
    );
  const parameter = node.parameters[0];
  if (
    node.parameters.length !== 1 ||
    !ts.isIdentifier(parameter.name) ||
    parameter.initializer ||
    parameter.dotDotDotToken ||
    parameter.questionToken
  )
    rejectNode(node, code, 'A rule callback requires exactly one ordinary builder parameter.');
  return node;
}

function literal(node: ts.Expression): Primitive | undefined {
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) {
    const value = Number(node.text);
    return Number.isFinite(value) ? value : undefined;
  }
  if (
    ts.isPrefixUnaryExpression(node) &&
    (node.operator === ts.SyntaxKind.MinusToken || node.operator === ts.SyntaxKind.PlusToken) &&
    ts.isNumericLiteral(node.operand)
  ) {
    const value = Number(node.operand.text) * (node.operator === ts.SyntaxKind.MinusToken ? -1 : 1);
    return Number.isFinite(value) ? value : undefined;
  }
  return undefined;
}

/** A When/Intent builder runs once at declaration time. Hoist a pure captured
 * choice to that same setup point, then check each selected declaration normally.
 * This is source-language lowering, not a component name or optional-state recipe.
 */
export function liftRuleDeclarationConditional(
  node: ts.CallExpression
): ts.ConditionalExpression | undefined {
  const linkParents = (parent: ts.Node): void =>
    ts.forEachChild(parent, (child) => {
      Object.defineProperty(child, 'parent', { value: parent, configurable: true, writable: true });
      linkParents(child);
    });
  if (node.arguments.length !== 1 || !ts.isObjectLiteralExpression(node.arguments[0]))
    return undefined;
  for (const field of node.arguments[0].properties) {
    if (!ts.isPropertyAssignment(field) || !['when', 'intent'].includes(propertyName(field.name)))
      continue;
    const value = unwrap(field.initializer);
    if (!ts.isArrowFunction(value) && !ts.isFunctionExpression(value)) continue;
    const locals = new Set<string>();
    const collect = (part: ts.Node): void => {
      if ((ts.isParameter(part) || ts.isVariableDeclaration(part)) && ts.isIdentifier(part.name))
        locals.add(part.name.text);
      if (ts.isFunctionExpression(part) && part.name) locals.add(part.name.text);
      ts.forEachChild(part, collect);
    };
    collect(value);
    const pureCapture = (part: ts.Expression): boolean => {
      part = unwrap(part);
      if (literal(part) !== undefined) return true;
      if (ts.isIdentifier(part)) return !locals.has(part.text);
      if (ts.isPropertyAccessExpression(part)) return pureCapture(part.expression);
      if (ts.isPrefixUnaryExpression(part) && part.operator === ts.SyntaxKind.ExclamationToken)
        return pureCapture(part.operand);
      return (
        ts.isBinaryExpression(part) &&
        [
          ts.SyntaxKind.EqualsEqualsEqualsToken,
          ts.SyntaxKind.ExclamationEqualsEqualsToken,
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(part.operatorToken.kind) &&
        pureCapture(part.left) &&
        pureCapture(part.right)
      );
    };
    let choice: ts.ConditionalExpression | undefined;
    const find = (part: ts.Node): void => {
      if (choice) return;
      if (ts.isConditionalExpression(part) && pureCapture(part.condition)) {
        choice = part;
        return;
      }
      ts.forEachChild(part, find);
    };
    find(value.body);
    if (!choice) continue;
    const selected = choice;
    const branch = (replacement: ts.Expression): ts.CallExpression => {
      const transformed = ts.transform(node, [
        (context) => {
          const visit: ts.Visitor = (part) =>
            part === selected ? replacement : ts.visitEachChild(part, visit, context);
          return (root) => ts.visitNode(root, visit) as ts.CallExpression;
        },
      ]);
      const result = transformed.transformed[0];
      transformed.dispose();
      ts.setOriginalNode(result, node);
      ts.setTextRange(result, node);
      Object.defineProperty(result, 'parent', {
        value: node.parent,
        configurable: true,
        writable: true,
      });
      return result;
    };
    const lifted = ts.factory.createConditionalExpression(
      selected.condition,
      undefined,
      branch(selected.whenTrue),
      undefined,
      branch(selected.whenFalse)
    );
    ts.setOriginalNode(lifted, node);
    ts.setTextRange(lifted, node);
    Object.defineProperty(lifted, 'parent', {
      value: node.parent,
      configurable: true,
      writable: true,
    });
    linkParents(lifted);
    return lifted;
  }
  return undefined;
}

/** Retain a finite style choice at its original evaluation point. Each branch
 * still has to resolve to a trusted tw call with completely static tokens. */
export function liftStyleCallConditional(
  node: ts.CallExpression
): ts.ConditionalExpression | undefined {
  if (node.arguments.length !== 1 || node.questionDotToken || node.typeArguments?.length)
    return undefined;
  const choice = unwrap(node.arguments[0]);
  if (!ts.isConditionalExpression(choice)) return undefined;
  const branch = (value: ts.Expression) => {
    const call = ts.factory.updateCallExpression(node, node.expression, undefined, [value]);
    ts.setOriginalNode(call, node);
    ts.setTextRange(call, node);
    return call;
  };
  const result = ts.factory.createConditionalExpression(
    choice.condition,
    undefined,
    branch(choice.whenTrue),
    undefined,
    branch(choice.whenFalse)
  );
  ts.setOriginalNode(result, node);
  ts.setTextRange(result, node);
  Object.defineProperty(result, 'parent', {
    value: node.parent,
    configurable: true,
    writable: true,
  });
  const parents = (parent: ts.Node): void =>
    ts.forEachChild(parent, (child) => {
      Object.defineProperty(child, 'parent', { value: parent, configurable: true, writable: true });
      parents(child);
    });
  parents(result);
  return result;
}

/** Spread of a literal argument list has the same ordered builder calls as
 * spelling those arguments out. A captured conditional is lifted first, so
 * each selected list remains finite; arbitrary iterable values stay rejected. */
export function lowerRuleLiteralArgumentSpreads(
  node: ts.CallExpression
): ts.CallExpression | undefined {
  let changed = false;
  const transformed = ts.transform(node, [
    (context) => {
      const argumentsOf = (items: readonly ts.Expression[]): ts.Expression[] =>
        items.flatMap((item) => {
          if (!ts.isSpreadElement(item)) return [item];
          const value = unwrap(item.expression);
          if (!ts.isArrayLiteralExpression(value) || value.elements.some(ts.isOmittedExpression))
            return [item];
          changed = true;
          return argumentsOf(value.elements as readonly ts.Expression[]);
        });
      const visit: ts.Visitor = (part) => {
        const visited = ts.visitEachChild(part, visit, context);
        if (!ts.isCallExpression(visited) || !visited.arguments.some(ts.isSpreadElement))
          return visited;
        const args = argumentsOf(visited.arguments);
        if (
          args.length === visited.arguments.length &&
          args.every((arg, index) => arg === visited.arguments[index])
        )
          return visited;
        return ts.factory.updateCallExpression(
          visited,
          visited.expression,
          visited.typeArguments,
          args
        );
      };
      return (root) => ts.visitNode(root, visit) as ts.CallExpression;
    },
  ]);
  const result = transformed.transformed[0];
  transformed.dispose();
  if (!changed) return undefined;
  ts.setOriginalNode(result, node);
  ts.setTextRange(result, node);
  Object.defineProperty(result, 'parent', {
    value: node.parent,
    configurable: true,
    writable: true,
  });
  const parents = (parent: ts.Node): void =>
    ts.forEachChild(parent, (child) => {
      Object.defineProperty(child, 'parent', { value: parent, configurable: true, writable: true });
      parents(child);
    });
  parents(result);
  return result;
}

function ordinaryCall(node: ts.CallExpression): void {
  if (node.questionDotToken || node.typeArguments?.length)
    rejectNode(node, code, 'Optional and generic rule builder calls are unsupported.');
  for (const argument of node.arguments) {
    if (ts.isSpreadElement(argument))
      rejectNode(argument, code, 'Dynamic rule argument spreads are unsupported.');
  }
}

function arity(node: ts.CallExpression, count: number): void {
  if (node.arguments.length !== count)
    rejectNode(node, code, `This rule builder operation requires ${count} argument(s).`);
}

function addConstants<T>(
  statement: ts.VariableStatement,
  aliases: Map<string, T>,
  builder: string,
  parse: (expression: ts.Expression) => T
): void {
  if (!(statement.declarationList.flags & ts.NodeFlags.Const))
    rejectNode(statement, code, 'Rule callback bindings must be immutable static constants.');
  for (const declaration of statement.declarationList.declarations) {
    if (!ts.isIdentifier(declaration.name) || !declaration.initializer)
      rejectNode(
        declaration,
        code,
        'Rule callback destructuring and uninitialized declarations are unsupported.'
      );
    const name = declaration.name.text;
    if (name === builder || aliases.has(name))
      rejectNode(
        declaration.name,
        code,
        'Rule builder shadowing and duplicate bindings are unsupported.'
      );
    aliases.set(name, parse(declaration.initializer));
  }
}

/** Callback bindings shadow setup/module bindings for the whole lexical body. */
function callbackBindings(node: Callback): ReadonlySet<string> {
  const names = new Set<string>();
  if (ts.isFunctionExpression(node) && node.name) names.add(node.name.text);
  const binding = (name: ts.BindingName): void => {
    if (ts.isIdentifier(name)) names.add(name.text);
    else
      for (const element of name.elements) if (ts.isBindingElement(element)) binding(element.name);
  };
  for (const parameter of node.parameters) binding(parameter.name);
  if (node.body && ts.isBlock(node.body))
    for (const statement of node.body.statements)
      if (ts.isVariableStatement(statement))
        for (const declaration of statement.declarationList.declarations) binding(declaration.name);
  return names;
}

/** The outer resolver must never supply a callback-local name, including its TDZ. */
function rejectCallbackCapture(expression: ts.Expression, bindings: ReadonlySet<string>): void {
  const visit = (node: ts.Node): void => {
    if (ts.isTypeNode(node)) return;
    if (ts.isIdentifier(node) && bindings.has(node.text))
      rejectNode(node, code, 'A callback-local rule binding cannot borrow an outer declaration.');
    if (ts.isPropertyAccessExpression(node)) {
      visit(node.expression);
      return;
    }
    if (ts.isPropertyAssignment(node)) {
      if (ts.isComputedPropertyName(node.name)) visit(node.name.expression);
      visit(node.initializer);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(expression);
}

/** Parse authoring syntax only. The admitted def.rule call and binding provenance remain the parser's responsibility. */
export function extractRuleDeclaration(
  node: ts.ObjectLiteralExpression,
  context: RuleDeclarationContext
): RuleDeclarationIR {
  if (
    !Number.isSafeInteger(context.id) ||
    context.id < 1 ||
    !Number.isSafeInteger(context.order) ||
    context.order < 0
  )
    rejectNode(node, code, 'Rule identity/order must be positive/nonnegative safe integers.');
  const fields = new Map<string, ts.Expression | ts.MethodDeclaration>();
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property) && !ts.isMethodDeclaration(property))
      rejectNode(
        property,
        code,
        'Rules require explicit static fields, without spreads, accessors or shorthand.'
      );
    const name = propertyName(property.name);
    if (!['label', 'note', 'when', 'intent'].includes(name) || fields.has(name))
      rejectNode(property, code, 'Unknown or duplicate RuleSpec field.');
    fields.set(name, ts.isPropertyAssignment(property) ? unwrap(property.initializer) : property);
  }
  const whenNode = fields.get('when');
  const intentNode = fields.get('intent');
  if (!whenNode || !intentNode)
    rejectNode(node, code, 'A RuleSpec requires when and intent callbacks.');
  const whenCallback = callback(whenNode);
  const intentCallback = callback(intentNode);
  const deps: RuleDependency[] = [];
  const depKeys = new Set<string>();
  const dependency = (value: RuleValue): void => {
    const key = value.type === 'state' ? `state:${value.id}` : `${value.type}:${value.key}`;
    if (depKeys.has(key)) return;
    depKeys.add(key);
    deps.push(
      value.type === 'state'
        ? { kind: 'state', id: value.id, span: value.span }
        : { kind: value.type, key: value.key, span: value.span }
    );
  };
  const whenBuilder = (whenCallback.parameters[0].name as ts.Identifier).text;
  const whenBindings = callbackBindings(whenCallback);
  const whenAliases = new Map<string, WhenPart>();
  const condition = (expression: ts.Expression): RuleCondition => {
    const part = parseWhen(expression);
    if (part.kind !== 'condition')
      rejectNode(
        expression,
        code,
        'Rule conditions must be WhenBuilder expressions, not raw values.'
      );
    return part.value;
  };
  const parseWhen = (expression: ts.Expression): WhenPart => {
    const original = expression;
    expression = unwrap(expression);
    const span = sourceSpan(original);
    const value = literal(expression);
    if (value !== undefined) return { kind: 'literal', value };
    if (ts.isIdentifier(expression)) {
      const alias = whenAliases.get(expression.text);
      if (alias) return alias;
      rejectCallbackCapture(expression, whenBindings);
    }
    const constant = context.resolveStatic?.(expression);
    if (constant && constant.value !== undefined) return { kind: 'literal', value: constant.value };
    if (ts.isConditionalExpression(expression)) {
      rejectCallbackCapture(expression.condition, whenBindings);
      const selected = context.resolveStatic?.(expression.condition);
      if (selected) return parseWhen(selected.value ? expression.whenTrue : expression.whenFalse);
    }
    if (ts.isIdentifier(expression))
      rejectNode(original, code, 'Only callback-local static rule aliases may be read.');
    if (!ts.isCallExpression(expression) || !ts.isPropertyAccessExpression(expression.expression))
      rejectNode(
        original,
        code,
        'Dynamic conditions, host values and executable Rule expressions are unsupported.'
      );
    ordinaryCall(expression);
    const callee = expression.expression;
    if (callee.questionDotToken)
      rejectNode(callee, code, 'Optional rule builder access is unsupported.');
    const operation = callee.name.text;
    if (operation === 'eq' || operation === 'gte') {
      arity(expression, 1);
      const left = parseWhen(callee.expression);
      const right = parseWhen(expression.arguments[0]);
      if (left.kind !== 'signal')
        rejectNode(
          callee.expression,
          code,
          'Rule comparison requires a declared prop/state/meta signal.'
        );
      if (
        right.kind !== 'literal' ||
        (left.type && operation === 'eq' && !acceptsValue(left.type, right.value))
      )
        rejectNode(
          expression.arguments[0],
          code,
          'Rule comparison requires a concrete literal compatible with its declared data type.'
        );
      if (operation === 'gte') {
        if (typeof right.value !== 'number' || !Number.isFinite(right.value))
          rejectNode(expression.arguments[0], code, 'Rule gte requires a finite numeric literal.');
        return {
          kind: 'condition',
          value: { type: 'gte', left: left.value, right: right.value, span },
        };
      }
      return {
        kind: 'condition',
        value: { type: 'eq', left: left.value, right: right.value, span },
      };
    }
    if (!ts.isIdentifier(callee.expression) || callee.expression.text !== whenBuilder)
      rejectNode(
        callee.expression,
        code,
        'Only the callback-local WhenBuilder may construct rule conditions.'
      );
    if (operation === 't' || operation === 'f') {
      arity(expression, 0);
      return { kind: 'condition', value: { type: operation === 't' ? 'true' : 'false', span } };
    }
    if (operation === 'not') {
      arity(expression, 1);
      return {
        kind: 'condition',
        value: { type: 'not', expr: condition(expression.arguments[0]), span },
      };
    }
    if (operation === 'all' || operation === 'any') {
      return {
        kind: 'condition',
        value: { type: operation, exprs: expression.arguments.map(condition), span },
      };
    }
    if (operation === 'prop') {
      arity(expression, 1);
      const key = parseWhen(expression.arguments[0]);
      if (key.kind !== 'literal' || typeof key.value !== 'string')
        rejectNode(expression.arguments[0], code, 'Rule prop keys must be concrete strings.');
      const type = context.props.get(key.value);
      if (type === undefined)
        rejectNode(expression.arguments[0], code, `Rule reads undeclared prop ${key.value}.`);
      const signal: RuleValue = { type: 'prop', key: key.value, span };
      dependency(signal);
      return { kind: 'signal', value: signal, type };
    }
    if (operation === 'state') {
      arity(expression, 1);
      rejectCallbackCapture(expression.arguments[0], whenBindings);
      const binding = context.resolveState(unwrap(expression.arguments[0]));
      if (!binding || typeof binding.id !== 'string' || !binding.id.length)
        rejectNode(
          expression.arguments[0],
          code,
          'Rule states must resolve to declared portable state identities, not live handles.'
        );
      const signal: RuleValue = { type: 'state', id: binding.id, span };
      dependency(signal);
      return { kind: 'signal', value: signal, type: binding.type };
    }
    if (operation === 'meta') {
      arity(expression, 1);
      const key = parseWhen(expression.arguments[0]);
      if (key.kind !== 'literal' || typeof key.value !== 'string' || !key.value.length)
        rejectNode(
          expression.arguments[0],
          code,
          'Rule meta keys must be nonempty concrete strings.'
        );
      const signal: RuleValue = { type: 'meta', key: key.value, span };
      dependency(signal);
      return { kind: 'signal', value: signal };
    }
    rejectNode(
      expression,
      code,
      `Rule operation ${operation} is not statically supported; context and dynamic extensions are unsupported.`
    );
  };
  const whenBody = whenCallback.body!;
  let when: RuleCondition;
  if (ts.isBlock(whenBody)) {
    const statements = whenBody.statements;
    for (const statement of statements.slice(0, -1)) {
      if (!ts.isVariableStatement(statement))
        rejectNode(
          statement,
          code,
          'Static when callbacks allow only constant aliases followed by one return.'
        );
      addConstants(statement, whenAliases, whenBuilder, parseWhen);
    }
    const last = statements[statements.length - 1];
    if (!last || !ts.isReturnStatement(last) || !last.expression)
      rejectNode(whenBody, code, 'A static when callback must return one checked WhenExpr.');
    when = condition(last.expression);
  } else when = condition(whenBody);

  const intentBuilder = (intentCallback.parameters[0].name as ts.Identifier).text;
  const intentBindings = callbackBindings(intentCallback);
  const styleAliases = new Map<string, RuleStyleOperand>();
  const styleHandle = (expression: ts.Expression): RuleStyleOperand => {
    const input = unwrap(expression);
    if (ts.isIdentifier(input) && styleAliases.has(input.text))
      return styleAliases.get(input.text)!;
    rejectCallbackCapture(input, intentBindings);
    const reference = context.resolveStyleReference?.(input);
    if (reference) return { kind: 'reference', id: reference.id };
    const handle = context.resolveStyle(input);
    if (
      !handle ||
      !acceptsValue(tokenType, handle) ||
      Object.keys(handle).some((key) => key !== 'kind' && key !== 'tokens')
    )
      rejectNode(
        expression,
        code,
        'Rule style intents require declared serializable tw handles, without live handles or functions.'
      );
    try {
      for (const token of handle.tokens) assertTwTokenV0(token, 'compiler rule style');
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      rejectNode(expression, code, error.message);
    }
    return { kind: 'tw', tokens: [...handle.tokens] };
  };
  const ops: RuleStyleOperation[] = [];
  const intent = (expression: ts.Expression): void => {
    const call = unwrap(expression);
    if (!ts.isCallExpression(call))
      rejectNode(expression, code, 'Rule intents must be direct style-use declarations.');
    ordinaryCall(call);
    let receiver: ts.Expression = call.expression;
    const path: string[] = [];
    let target: { id: string } | undefined;
    while (ts.isPropertyAccessExpression(receiver)) {
      if (receiver.questionDotToken)
        rejectNode(receiver, code, 'Optional rule intent access is unsupported.');
      path.unshift(receiver.name.text);
      receiver = receiver.expression;
    }
    if (
      path.join('.') === 'use' &&
      ts.isCallExpression(receiver) &&
      ts.isPropertyAccessExpression(receiver.expression) &&
      receiver.expression.name.text === 'to'
    ) {
      ordinaryCall(receiver);
      if (receiver.arguments.length !== 1)
        rejectNode(receiver, code, 'A decoration style target requires one owned target.');
      rejectCallbackCapture(receiver.arguments[0], intentBindings);
      target = context.resolveTarget?.(receiver.arguments[0]);
      if (!target)
        rejectNode(
          receiver.arguments[0],
          code,
          'Rule decoration styles require a checked owned decoration target.'
        );
      path.length = 0;
      path.push('use');
      receiver = receiver.expression.expression;
      while (ts.isPropertyAccessExpression(receiver)) {
        if (receiver.questionDotToken)
          rejectNode(receiver, code, 'Optional rule target access is unsupported.');
        path.unshift(receiver.name.text);
        receiver = receiver.expression;
      }
    }
    if (
      !ts.isIdentifier(receiver) ||
      receiver.text !== intentBuilder ||
      path.join('.') !== 'feedback.style.use'
    )
      rejectNode(
        expression,
        code,
        'Only feedback.style.use intents are supported; state writes and dynamic effects are not reversible Rule style plans.'
      );
    ops.push({
      kind: 'feedback.style.use',
      id: `rule:${context.id}:style:${ops.length}`,
      handles: call.arguments.map(styleHandle),
      ...(target ? { target } : {}),
      span: sourceSpan(expression),
    });
  };
  const intentBody = intentCallback.body!;
  if (ts.isBlock(intentBody)) {
    for (const [index, statement] of intentBody.statements.entries()) {
      if (ts.isVariableStatement(statement))
        addConstants(statement, styleAliases, intentBuilder, styleHandle);
      else if (ts.isExpressionStatement(statement)) intent(statement.expression);
      else if (ts.isReturnStatement(statement) && index === intentBody.statements.length - 1) {
        if (statement.expression) intent(statement.expression);
      } else
        rejectNode(
          statement,
          code,
          'Static intent callbacks allow style constants and style-use calls only.'
        );
    }
  } else intent(intentBody);
  const metadata: { label?: string; note?: string } = {};
  for (const name of ['label', 'note'] as const) {
    const field = fields.get(name);
    if (!field) continue;
    if (!ts.isStringLiteral(field) && !ts.isNoSubstitutionTemplateLiteral(field))
      rejectNode(field, code, 'Rule labels/notes must be static strings.');
    metadata[name] = field.text;
  }
  return {
    operation: 'rule.declare',
    id: context.id,
    order: context.order,
    ...metadata,
    deps,
    when,
    intent: { kind: 'ops', ops },
    span: sourceSpan(node),
  };
}

/** Resolve static tw authoring through the canonical supplied source graph. The graph must
 * admit the trusted core tw import/declaration; no package import or input evaluation occurs.
 * Setup-local declared handles can instead be supplied by context.resolveStyle.
 */
export function extractRuleStyleHandle(
  module: SourceModule,
  expression: ts.Expression,
  resolveLocal?: (name: string) => ts.Expression | undefined
): StyleTokenHandle {
  const active = new Set<string>();
  const declaration = <T>(
    current: SourceModule,
    identifier: ts.Identifier,
    parse: (owner: SourceModule, node: ts.Expression) => T
  ): T => {
    const local = current === module ? resolveLocal?.(identifier.text) : undefined;
    if (local) {
      const identity = `${current.file.fileName}#local:${identifier.text}`;
      if (active.has(identity))
        rejectNode(identifier, code, 'Recursive style declarations are unsupported.');
      active.add(identity);
      try {
        return parse(current, local);
      } finally {
        active.delete(identity);
      }
    }
    const resolved = current.graph.resolveBinding(current, identifier.text);
    if (
      !resolved.module ||
      ts.isFunctionDeclaration(resolved.node) ||
      resolved.module.mutableBindings.has(resolved.name)
    )
      rejectNode(
        identifier,
        code,
        'Style bindings must resolve to static declarations in the supplied source graph.'
      );
    const identity = `${resolved.module.file.fileName}#${resolved.name}`;
    if (active.has(identity))
      rejectNode(identifier, code, 'Recursive style declarations are unsupported.');
    active.add(identity);
    try {
      return parse(resolved.module, resolved.node);
    } finally {
      active.delete(identity);
    }
  };
  const stringValue = (owner: SourceModule, value: ts.Expression): string => {
    value = unwrap(value);
    if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) return value.text;
    if (ts.isIdentifier(value)) return declaration(owner, value, stringValue);
    // `${a}-${b}` over static strings, and `TABLE[key]` with a static key into a
    // static object literal, fold to the string they name.
    if (ts.isTemplateExpression(value))
      return value.templateSpans.reduce(
        (text, span) => text + stringValue(owner, span.expression) + span.literal.text,
        value.head.text
      );
    if (ts.isElementAccessExpression(value) || ts.isPropertyAccessExpression(value)) {
      const key = ts.isPropertyAccessExpression(value)
        ? value.name.text
        : stringValue(owner, value.argumentExpression);
      const table = (
        current: SourceModule,
        object: ts.Expression,
        key: string,
        selected: (owner: SourceModule, value: ts.Expression) => string
      ): string => {
        object = unwrap(object);
        if (ts.isIdentifier(object))
          return declaration(current, object, (owner, value) => table(owner, value, key, selected));
        if (ts.isElementAccessExpression(object) || ts.isPropertyAccessExpression(object)) {
          const parentKey = ts.isPropertyAccessExpression(object)
            ? object.name.text
            : stringValue(current, object.argumentExpression);
          return table(current, object.expression, parentKey, (owner, value) =>
            table(owner, value, key, selected)
          );
        }
        if (!ts.isObjectLiteralExpression(object))
          rejectNode(
            object,
            code,
            'Style tokens require static strings, not interpolations, functions or host values.'
          );
        const property = object.properties.find(
          (item) =>
            ts.isPropertyAssignment(item) &&
            (ts.isIdentifier(item.name) || ts.isStringLiteral(item.name)) &&
            item.name.text === key
        ) as ts.PropertyAssignment | undefined;
        if (!property) rejectNode(value, code, `Static style table has no entry ${key}.`);
        return selected(current, property.initializer);
      };
      return table(owner, value.expression, key, stringValue);
    }
    // A static string list joined by a literal separator is the same string
    // the module-data admission folds (source-language.md).
    const joined = staticJoin(value);
    if (joined) {
      const items = (current: SourceModule, list: ts.Expression): string[] => {
        list = unwrap(list);
        if (ts.isIdentifier(list)) return declaration(current, list, items);
        if (!ts.isArrayLiteralExpression(list))
          rejectNode(
            list,
            code,
            'Style tokens require static strings, not interpolations, functions or host values.'
          );
        return list.elements.map((element) => {
          if (ts.isSpreadElement(element))
            rejectNode(element, code, 'Style token lists cannot spread.');
          return stringValue(current, element);
        });
      };
      return items(owner, joined.receiver).join(joined.separator ? joined.separator.text : ',');
    }
    rejectNode(
      value,
      code,
      'Style tokens require static strings, not interpolations, functions or host values.'
    );
  };
  const parse = (owner: SourceModule, value: ts.Expression): StyleTokenHandle => {
    value = unwrap(value);
    if (ts.isIdentifier(value)) return declaration(owner, value, parse);
    if (
      !ts.isCallExpression(value) ||
      !ts.isIdentifier(value.expression) ||
      owner.graph.resolveCoreImport(owner, value.expression.text) !== 'tw'
    )
      rejectNode(value, code, 'Style handles must be authored with the trusted core tw factory.');
    ordinaryCall(value);
    if (!value.arguments.length) rejectNode(value, code, 'tw requires at least one static string.');
    const tokens = value.arguments.map((argument) => stringValue(owner, argument));
    const handle = tw(tokens[0], ...tokens.slice(1));
    try {
      for (const token of handle.tokens) assertTwTokenV0(token, 'compiler rule style');
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      rejectNode(value, code, error.message);
    }
    return handle;
  };
  return parse(module, expression);
}

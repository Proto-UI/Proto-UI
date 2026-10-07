import ts from 'typescript';
import type { RuleDep, WhenExpr } from '../../core/src/handles';
import { tw } from '../../core/src/spec/feedback/style';
import { assertTwTokenV0 } from '../../core/src/spec/feedback/tokens';
import { acceptsValue, type DataType } from './data-types';
import type { Primitive, SourceSpan } from './ir';
import { propertyName, rejectNode, sourceSpan, type SourceModule } from './parser-module';
import type { StyleTokenHandle } from './style-plan';

type CoreCondition = WhenExpr<Record<string, Primitive>>;
type CoreDependency = RuleDep<Record<string, Primitive>>;

/** The existing Rule WhenExpr language, restricted to portable prop/state identities. */
export type RuleValue = (
  | { type: 'prop'; key: string }
  | { type: 'state'; id: string }
) & { span: SourceSpan };
export type RuleCondition = (
  | Extract<CoreCondition, { type: 'true' | 'false' }>
  | (Omit<Extract<CoreCondition, { type: 'eq' }>, 'left'> & { left: RuleValue })
  | { type: 'not'; expr: RuleCondition }
  | { type: 'all' | 'any'; exprs: RuleCondition[] }
) & { span: SourceSpan };
export type RuleDependency = (
  | Extract<CoreDependency, { kind: 'prop' }>
  | { kind: 'state'; id: string }
) & { span: SourceSpan };
export interface RuleStyleOperation {
  kind: 'feedback.style.use';
  /** Stable within this declaration, including when the declaration is inactive. */
  id: string;
  handles: StyleTokenHandle[];
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
}

type Callback = ts.ArrowFunction | ts.FunctionExpression | ts.MethodDeclaration;
type WhenPart =
  | { kind: 'condition'; value: RuleCondition }
  | { kind: 'signal'; value: RuleValue; type: DataType }
  | { kind: 'literal'; value: Primitive };
const code = 'PUI1024';
const tokenType: DataType = {
  kind: 'record', fields: [
    { name: 'kind', type: { kind: 'literal', value: 'tw' } },
    { name: 'tokens', type: { kind: 'array', element: 'string' } },
  ],
};

function unwrap(node: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) || ts.isSatisfiesExpression(node)) node = node.expression;
  return node;
}

function callback(node: ts.Node): Callback {
  if (!ts.isArrowFunction(node) && !ts.isFunctionExpression(node) && !ts.isMethodDeclaration(node))
    rejectNode(node, code, 'Rules require inline statically checked when/intent callbacks.');
  if (!node.body || node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) ||
    ('asteriskToken' in node && node.asteriskToken) || node.typeParameters?.length)
    rejectNode(node, code, 'Async, generator, generic and external rule callbacks are unsupported.');
  const parameter = node.parameters[0];
  if (node.parameters.length !== 1 || !ts.isIdentifier(parameter.name) || parameter.initializer ||
    parameter.dotDotDotToken || parameter.questionToken)
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
  if (ts.isPrefixUnaryExpression(node) &&
    (node.operator === ts.SyntaxKind.MinusToken || node.operator === ts.SyntaxKind.PlusToken) &&
    ts.isNumericLiteral(node.operand)) {
    const value = Number(node.operand.text) * (node.operator === ts.SyntaxKind.MinusToken ? -1 : 1);
    return Number.isFinite(value) ? value : undefined;
  }
  return undefined;
}

function ordinaryCall(node: ts.CallExpression): void {
  if (node.questionDotToken || node.typeArguments?.length)
    rejectNode(node, code, 'Optional and generic rule builder calls are unsupported.');
  for (const argument of node.arguments) {
    if (ts.isSpreadElement(argument)) rejectNode(argument, code, 'Dynamic rule argument spreads are unsupported.');
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
      rejectNode(declaration, code, 'Rule callback destructuring and uninitialized declarations are unsupported.');
    const name = declaration.name.text;
    if (name === builder || aliases.has(name))
      rejectNode(declaration.name, code, 'Rule builder shadowing and duplicate bindings are unsupported.');
    aliases.set(name, parse(declaration.initializer));
  }
}

/** Parse authoring syntax only. The admitted def.rule call and binding provenance remain the parser's responsibility. */
export function extractRuleDeclaration(
  node: ts.ObjectLiteralExpression,
  context: RuleDeclarationContext
): RuleDeclarationIR {
  if (!Number.isSafeInteger(context.id) || context.id < 1 ||
    !Number.isSafeInteger(context.order) || context.order < 0)
    rejectNode(node, code, 'Rule identity/order must be positive/nonnegative safe integers.');
  const fields = new Map<string, ts.Expression | ts.MethodDeclaration>();
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property) && !ts.isMethodDeclaration(property))
      rejectNode(property, code, 'Rules require explicit static fields, without spreads, accessors or shorthand.');
    const name = propertyName(property.name);
    if (!['label', 'note', 'when', 'intent'].includes(name) || fields.has(name))
      rejectNode(property, code, 'Unknown or duplicate RuleSpec field.');
    fields.set(name, ts.isPropertyAssignment(property) ? unwrap(property.initializer) : property);
  }
  const whenNode = fields.get('when');
  const intentNode = fields.get('intent');
  if (!whenNode || !intentNode) rejectNode(node, code, 'A RuleSpec requires when and intent callbacks.');
  const whenCallback = callback(whenNode);
  const intentCallback = callback(intentNode);
  const deps: RuleDependency[] = [];
  const depKeys = new Set<string>();
  const dependency = (value: RuleValue): void => {
    const key = value.type === 'prop' ? `prop:${value.key}` : `state:${value.id}`;
    if (depKeys.has(key)) return;
    depKeys.add(key);
    deps.push(value.type === 'prop'
      ? { kind: 'prop', key: value.key, span: value.span }
      : { kind: 'state', id: value.id, span: value.span });
  };
  const whenBuilder = (whenCallback.parameters[0].name as ts.Identifier).text;
  const whenAliases = new Map<string, WhenPart>();
  const condition = (expression: ts.Expression): RuleCondition => {
    const part = parseWhen(expression);
    if (part.kind !== 'condition') rejectNode(expression, code, 'Rule conditions must be WhenBuilder expressions, not raw values.');
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
      rejectNode(original, code, 'Only callback-local static rule aliases may be read.');
    }
    if (!ts.isCallExpression(expression) || !ts.isPropertyAccessExpression(expression.expression))
      rejectNode(original, code, 'Dynamic conditions, host values and executable Rule expressions are unsupported.');
    ordinaryCall(expression);
    const callee = expression.expression;
    if (callee.questionDotToken) rejectNode(callee, code, 'Optional rule builder access is unsupported.');
    const operation = callee.name.text;
    if (operation === 'eq') {
      arity(expression, 1);
      const left = parseWhen(callee.expression);
      const right = parseWhen(expression.arguments[0]);
      if (left.kind !== 'signal') rejectNode(callee.expression, code, 'Rule equality requires a declared prop/state signal.');
      if (right.kind !== 'literal' || !acceptsValue(left.type, right.value))
        rejectNode(expression.arguments[0], code, 'Rule comparison requires a concrete literal compatible with its declared data type.');
      return { kind: 'condition', value: { type: 'eq', left: left.value, right: right.value, span } };
    }
    if (!ts.isIdentifier(callee.expression) || callee.expression.text !== whenBuilder)
      rejectNode(callee.expression, code, 'Only the callback-local WhenBuilder may construct rule conditions.');
    if (operation === 't' || operation === 'f') {
      arity(expression, 0);
      return { kind: 'condition', value: { type: operation === 't' ? 'true' : 'false', span } };
    }
    if (operation === 'not') {
      arity(expression, 1);
      return { kind: 'condition', value: { type: 'not', expr: condition(expression.arguments[0]), span } };
    }
    if (operation === 'all' || operation === 'any') {
      return { kind: 'condition', value: { type: operation, exprs: expression.arguments.map(condition), span } };
    }
    if (operation === 'prop') {
      arity(expression, 1);
      const key = parseWhen(expression.arguments[0]);
      if (key.kind !== 'literal' || typeof key.value !== 'string')
        rejectNode(expression.arguments[0], code, 'Rule prop keys must be concrete strings.');
      const type = context.props.get(key.value);
      if (type === undefined) rejectNode(expression.arguments[0], code, `Rule reads undeclared prop ${key.value}.`);
      const signal: RuleValue = { type: 'prop', key: key.value, span };
      dependency(signal);
      return { kind: 'signal', value: signal, type };
    }
    if (operation === 'state') {
      arity(expression, 1);
      const binding = context.resolveState(unwrap(expression.arguments[0]));
      if (!binding || typeof binding.id !== 'string' || !binding.id.length)
        rejectNode(expression.arguments[0], code, 'Rule states must resolve to declared portable state identities, not live handles.');
      const signal: RuleValue = { type: 'state', id: binding.id, span };
      dependency(signal);
      return { kind: 'signal', value: signal, type: binding.type };
    }
    rejectNode(expression, code, `Rule operation ${operation} is not statically supported; context/meta and dynamic extensions are unsupported.`);
  };
  const whenBody = whenCallback.body!;
  let when: RuleCondition;
  if (ts.isBlock(whenBody)) {
    const statements = whenBody.statements;
    for (const statement of statements.slice(0, -1)) {
      if (!ts.isVariableStatement(statement))
        rejectNode(statement, code, 'Static when callbacks allow only constant aliases followed by one return.');
      addConstants(statement, whenAliases, whenBuilder, parseWhen);
    }
    const last = statements[statements.length - 1];
    if (!last || !ts.isReturnStatement(last) || !last.expression)
      rejectNode(whenBody, code, 'A static when callback must return one checked WhenExpr.');
    when = condition(last.expression);
  } else when = condition(whenBody);

  const intentBuilder = (intentCallback.parameters[0].name as ts.Identifier).text;
  const styleAliases = new Map<string, StyleTokenHandle>();
  const styleHandle = (expression: ts.Expression): StyleTokenHandle => {
    const input = unwrap(expression);
    const handle = ts.isIdentifier(input) && styleAliases.has(input.text)
      ? styleAliases.get(input.text) : context.resolveStyle(input);
    if (!handle || !acceptsValue(tokenType, handle) ||
      Object.keys(handle).some((key) => key !== 'kind' && key !== 'tokens'))
      rejectNode(expression, code, 'Rule style intents require declared serializable tw handles, without live handles or functions.');
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
    if (!ts.isCallExpression(call)) rejectNode(expression, code, 'Rule intents must be direct style-use declarations.');
    ordinaryCall(call);
    let receiver: ts.Expression = call.expression;
    const path: string[] = [];
    while (ts.isPropertyAccessExpression(receiver)) {
      if (receiver.questionDotToken) rejectNode(receiver, code, 'Optional rule intent access is unsupported.');
      path.unshift(receiver.name.text);
      receiver = receiver.expression;
    }
    if (!ts.isIdentifier(receiver) || receiver.text !== intentBuilder || path.join('.') !== 'feedback.style.use')
      rejectNode(expression, code, 'Only feedback.style.use intents are supported; state writes and dynamic effects are not reversible Rule style plans.');
    ops.push({
      kind: 'feedback.style.use', id: `rule:${context.id}:style:${ops.length}`,
      handles: call.arguments.map(styleHandle), span: sourceSpan(expression),
    });
  };
  const intentBody = intentCallback.body!;
  if (ts.isBlock(intentBody)) {
    for (const [index, statement] of intentBody.statements.entries()) {
      if (ts.isVariableStatement(statement)) addConstants(statement, styleAliases, intentBuilder, styleHandle);
      else if (ts.isExpressionStatement(statement)) intent(statement.expression);
      else if (ts.isReturnStatement(statement) && index === intentBody.statements.length - 1) {
        if (statement.expression) intent(statement.expression);
      } else rejectNode(statement, code, 'Static intent callbacks allow style constants and style-use calls only.');
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
    operation: 'rule.declare', id: context.id, order: context.order, ...metadata,
    deps, when, intent: { kind: 'ops', ops }, span: sourceSpan(node),
  };
}

/** Resolve static tw authoring through the canonical supplied source graph. The graph must
 * admit the trusted core tw import/declaration; no package import or input evaluation occurs.
 * Setup-local declared handles can instead be supplied by context.resolveStyle.
 */
export function extractRuleStyleHandle(module: SourceModule, expression: ts.Expression): StyleTokenHandle {
  const active = new Set<string>();
  const declaration = <T>(current: SourceModule, identifier: ts.Identifier,
    parse: (owner: SourceModule, node: ts.Expression) => T): T => {
    const resolved = current.graph.resolveBinding(current, identifier.text);
    if (!resolved.module || ts.isFunctionDeclaration(resolved.node))
      rejectNode(identifier, code, 'Style bindings must resolve to static declarations in the supplied source graph.');
    const identity = `${resolved.module.file.fileName}#${resolved.name}`;
    if (active.has(identity)) rejectNode(identifier, code, 'Recursive style declarations are unsupported.');
    active.add(identity);
    try { return parse(resolved.module, resolved.node); }
    finally { active.delete(identity); }
  };
  const stringValue = (owner: SourceModule, value: ts.Expression): string => {
    value = unwrap(value);
    if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) return value.text;
    if (ts.isIdentifier(value)) return declaration(owner, value, stringValue);
    rejectNode(value, code, 'Style tokens require static strings, not interpolations, functions or host values.');
  };
  const parse = (owner: SourceModule, value: ts.Expression): StyleTokenHandle => {
    value = unwrap(value);
    if (ts.isIdentifier(value)) return declaration(owner, value, parse);
    if (!ts.isCallExpression(value) || !ts.isIdentifier(value.expression) ||
      owner.graph.resolveCoreImport(owner, value.expression.text) !== 'tw')
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

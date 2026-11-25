import ts from 'typescript';
import type { Behavior, Binding, Value, ValueType } from '../targets/component-ir.ts';
import { BehaviorFlow, knownText, type Condition, type Operand, type PresenceTest } from './behavior-flow.ts';
import { memberValue, objectMembers } from './component-syntax.ts';
import {
  behaviorValueType, checkParameters, literalValue, moduleConstant, moduleLiteral, numberLiteral, requireArity, requireDomain,
  staticCallee, staticReference, unparenthesize,
  type BehaviorCallback, type Phase, type Readable, type ResolveRead,
} from './behavior-types.ts';
import type { SourceContext } from './source.ts';

export interface Facts {
  readonly reads: Set<string>;
  readonly calls: Set<string>;
  ordered: boolean;
}
export interface Helper {
  readonly behavior: Behavior;
  readonly captures: readonly ts.Symbol[];
}
export type Capability = ts.ParameterDeclaration | ts.VariableDeclaration;
export type OwnedBinding = { readonly kind: 'reader' } |
  { readonly kind: 'signal'; readonly binding: Binding } |
  { readonly kind: Exclude<Readable['kind'], 'capture'>; readonly binding: Binding };
export interface LexicalBinding {
  readonly declaration: Capability;
  readonly value: OwnedBinding;
}
export type CaptureType = (symbol: ts.Symbol) => ValueType | undefined;
export interface HelperCall {
  readonly actionScope: boolean;
  readonly symbolicArgs: ReadonlyMap<number, OwnedBinding>;
  readonly lexical: Iterable<LexicalBinding>;
  readonly capture: CaptureType;
}
export interface HelperEnvironment {
  readonly lexical: readonly LexicalBinding[];
  readonly actionScope: boolean;
  readonly capturedType: CaptureType;
}
export interface BehaviorHost {
  readonly source: SourceContext;
  readonly resolveRead: ResolveRead;
  ordinaryHelper(call: ts.CallExpression, environment: HelperCall): Helper;
}

export function referenceValue(reference: Readable, facts: Facts): { type: ValueType; value: Value } {
  const { kind, binding } = reference;
  if (kind === 'derive') {
    facts.calls.add(binding.id);
    return { type: binding.type, value: { kind: 'call', fn: binding.id, args: [] } };
  }
  facts.reads.add(binding.id);
  return { type: binding.type, value: { kind, id: binding.id } };
}

function immediate(node: ts.Expression): boolean {
  node = unparenthesize(node);
  return ts.isIdentifier(node) || ts.isStringLiteralLike(node) || ts.isNumericLiteral(node) ||
    node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword;
}

function projection(expression: ts.Expression): { object: ts.Expression; field: string } | undefined {
  const node = unparenthesize(expression);
  if (node.flags & ts.NodeFlags.OptionalChain) return undefined;
  if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.name)) return { object: node.expression, field: node.name.text };
  if (ts.isElementAccessExpression(node) && (ts.isStringLiteralLike(node.argumentExpression) || ts.isNumericLiteral(node.argumentExpression))) {
    return { object: node.expression, field: node.argumentExpression.text };
  }
  return undefined;
}

/** One activation's lexical symbols. Ordinary helpers get their own parameters
 * and body; a caller-local of the same spelling cannot supply a free variable. */
export class BehaviorBody {
  private readonly host: BehaviorHost;
  private readonly source: SourceContext;
  private readonly binding: Binding;
  private readonly phase: Phase;
  private readonly actionScope: boolean;
  private readonly capturedType: CaptureType | undefined;
  private readonly flow: BehaviorFlow;
  private readonly locals = new Map<ts.Symbol, Operand>();
  private readonly lexical = new Map<ts.Symbol, LexicalBinding>();
  private readonly tests = new WeakMap<Operand, PresenceTest>();
  readonly params: Binding[] = [];
  readonly captures: ts.Symbol[] = [];
  readonly facts: Facts = { reads: new Set(), calls: new Set(), ordered: false };

  constructor(host: BehaviorHost, binding: Binding, phase: Phase, origin: ts.Node, environment?: HelperEnvironment) {
    this.host = host;
    this.source = host.source;
    this.binding = binding;
    this.phase = phase;
    this.actionScope = environment?.actionScope ?? phase === 'action';
    this.capturedType = environment?.capturedType;
    this.flow = new BehaviorFlow(this.source, binding, origin);
    for (const { declaration, value } of environment?.lexical ?? []) this.bind(declaration, value);
  }

  private bind(declaration: Capability, value: OwnedBinding): void {
    if (!ts.isIdentifier(declaration.name)) {
      return this.source.missing(declaration, 'producer/capability-binding', 'The owned reference needs a resolved lexical binding.');
    }
    this.lexical.set(this.source.symbol(declaration.name), { declaration, value });
  }

  bindCapability(declaration: Capability): void {
    this.bind(declaration, { kind: 'reader' });
  }

  private owned(node: ts.Expression): OwnedBinding | undefined {
    node = unparenthesize(node);
    if (!staticReference(node)) return undefined;
    if (ts.isIdentifier(node)) {
      const local = this.lexical.get(this.source.symbol(node));
      if (local) return local.value;
    }
    const ref = this.host.resolveRead(node);
    if (!ref || ref.kind === 'capture') return undefined;
    return { kind: ref.kind, binding: ref.binding };
  }

  bindAlias(declaration: ts.VariableDeclaration): void {
    if (!declaration.initializer || !ts.isVariableDeclarationList(declaration.parent) ||
        !(declaration.parent.flags & ts.NodeFlags.Const) || this.owned(declaration.initializer)?.kind !== 'reader') {
      return this.source.missing(declaration, 'producer/capability-alias', 'The immutable alias needs its actual scoped capability initializer.');
    }
    this.bindCapability(declaration);
  }

  private local(symbol: ts.Symbol): Operand | undefined {
    const own = this.locals.get(symbol);
    if (own) return own;
    const type = this.capturedType?.(symbol);
    if (!type) return undefined;
    // Only an enclosing activation's proved lexical value reaches this point.
    // Add the explicit environment parameter on its first actual use.
    const binding = this.flow.binding(symbol.valueDeclaration!, 'capture-parameter', symbol.getName(), type);
    this.params.push(binding);
    this.captures.push(symbol);
    const operand: Operand = { type, value: { kind: 'local', id: binding.id } };
    this.locals.set(symbol, operand);
    return operand;
  }

  callback(node: BehaviorCallback, reader: boolean, symbolicArgs?: ReadonlyMap<number, OwnedBinding>): void {
    if (!node.body || node.asteriskToken || node.typeParameters?.length || node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)) {
      return this.source.missing(node, 'producer/function-body', 'This behavior needs a concrete synchronous, monomorphic source body.');
    }
    checkParameters(this.source, node.parameters);
    for (const [index, parameter] of node.parameters.entries()) {
      const reference = symbolicArgs?.get(index);
      if (reference) {
        this.bind(parameter, reference);
      } else if (index === 0 && reader) {
        this.bindCapability(parameter);
      } else {
        const name = (parameter.name as ts.Identifier).text;
        const binding = this.flow.binding(parameter, 'parameter', name, behaviorValueType(this.source, parameter));
        this.params.push(binding);
        this.locals.set(this.source.symbol(parameter.name), { type: binding.type, value: { kind: 'local', id: binding.id } });
      }
    }
    if (ts.isBlock(node.body)) {
      this.statement(node.body);
      if (!this.flow.terminated) this.result(node.body);
    } else {
      this.result(node.body, node.body);
    }
  }

  result(origin: ts.Node, expression?: ts.Expression): void {
    let result: Operand | undefined;
    if (expression) {
      const value = unparenthesize(expression);
      if (ts.isConditionalExpression(value)) {
        this.flow.branch(value, this.condition(value.condition), () => this.result(value.whenTrue, value.whenTrue),
          () => this.result(value.whenFalse, value.whenFalse));
        return;
      }
      if (ts.isVoidExpression(value)) this.discard(value.expression, value.expression);
      else result = ts.isCallExpression(value) ? this.call(value, this.binding.type === 'unit') : this.expression(value, this.binding.type);
    }
    requireDomain(this.source, origin, result?.type ?? 'unit', this.binding.type);
    const source = this.source.span(origin);
    this.flow.terminate(result === undefined
      ? { kind: 'return', source }
      : { kind: 'return', source, value: this.flow.value(result) });
  }

  finish(): Behavior {
    return { binding: this.binding, phase: this.phase, params: this.params, entry: this.flow.entry,
      blocks: this.flow.finish(), dependencies: [...this.facts.reads] };
  }

  private statement(node: ts.Statement): void {
    if (ts.isBlock(node)) {
      for (const statement of node.statements) {
        if (this.flow.terminated) break;
        this.statement(statement);
      }
    } else if (ts.isIfStatement(node)) {
      this.flow.branch(node, this.condition(node.expression), () => this.statement(node.thenStatement), () => {
        if (node.elseStatement) this.statement(node.elseStatement);
      });
    } else if (ts.isReturnStatement(node)) {
      this.result(node, node.expression);
    } else if (ts.isVariableStatement(node)) {
      if (!(node.declarationList.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let)) || node.declarationList.flags & ts.NodeFlags.Using) {
        this.source.missing(node, 'producer/local-storage', 'This declaration requires hoisting, mutable storage, or resource disposal lowering.');
      }
      for (const declaration of node.declarationList.declarations) this.variable(declaration);
    } else if (ts.isExpressionStatement(node)) {
      this.discard(node.expression, node);
    } else if (!ts.isEmptyStatement(node) && !ts.isFunctionDeclaration(node) && !ts.isTypeAliasDeclaration(node) && !ts.isInterfaceDeclaration(node)) {
      this.source.missing(node, 'producer/statement', `Lowering the reached ${ts.SyntaxKind[node.kind]} statement requires additional behavior support.`);
    }
  }

  private discard(expression: ts.Expression, at: ts.Node): void {
    const node = unparenthesize(expression);
    if (ts.isConditionalExpression(node)) {
      this.flow.branch(node, this.condition(node.condition), () => this.discard(node.whenTrue, node.whenTrue),
        () => this.discard(node.whenFalse, node.whenFalse));
    } else if (ts.isVoidExpression(node)) {
      this.discard(node.expression, at);
    } else {
      const value = ts.isCallExpression(node) ? this.call(node, true) : this.expression(node);
      if (value && 'value' in value && !(value.value.kind === 'local' || value.value.kind === 'text' ||
          value.value.kind === 'number' || value.value.kind === 'bool' || value.value.kind === 'tokens')) {
        this.flow.define(at, this.flow.binding(at, 'discard', 'unused', value.type), value);
      }
    }
  }

  private variable(declaration: ts.VariableDeclaration): void {
    const { name, initializer } = declaration;
    if (!ts.isIdentifier(name) || !initializer) {
      return this.source.missing(declaration, 'producer/local-binding', 'The receiver needs an initialized lexical value for this declaration.');
    }
    const reference = this.owned(initializer);
    if (reference) {
      if (!(declaration.parent.flags & ts.NodeFlags.Const)) {
        return this.source.missing(declaration, 'producer/mutable-capability', 'A reassignable handle or capability needs a proved storage location and lifetime.');
      }
      this.bind(declaration, reference);
      return;
    }
    const annotated = declaration.type && behaviorValueType(this.source, declaration.type, this.source.checker.getTypeFromTypeNode(declaration.type));
    const value = this.expression(initializer, annotated);
    const binding = this.flow.binding(declaration, 'local', name.text, annotated ?? value.type);
    const local = this.flow.define(declaration, binding, value);
    this.locals.set(this.source.symbol(name), local);
    const test = this.tests.get(value);
    if (test && declaration.parent.flags & ts.NodeFlags.Const) this.tests.set(local, test);
  }

  private condition(node: ts.Expression): Condition {
    const value = this.expression(node);
    return this.tests.get(value) ?? value;
  }

  private expression(input: ts.Expression, expected?: ValueType): Operand {
    const node = unparenthesize(input);
    if (ts.isIdentifier(node)) {
      const symbol = this.source.symbol(node);
      const local = this.local(symbol);
      if (local) return local;
      if (this.lexical.has(symbol)) {
        return this.source.missing(node, 'producer/capability-escape', 'This use would turn a scoped capability or handle into a stored or returned value.');
      }
      const snapshot = this.host.resolveRead(node);
      if (snapshot?.kind === 'capture') return referenceValue(snapshot, this.facts);
    }
    const literal = literalValue(this.source, node);
    if (literal) return { type: literal.kind, value: literal };
    if (ts.isCallExpression(node)) return this.call(node, false)!;
    if (ts.isObjectLiteralExpression(node)) return this.record(node, expected);
    if (ts.isConditionalExpression(node)) {
      return this.flow.choose(node, this.condition(node.condition), (arm) => this.expression(arm, expected));
    }
    if (ts.isPrefixUnaryExpression(node)) {
      const operand = this.expression(node.operand);
      if (node.operator === ts.SyntaxKind.ExclamationToken) {
        requireDomain(this.source, node.operand, operand.type, 'bool');
        const result: Operand = { type: 'bool', value: { kind: 'not', value: this.flow.value(operand) } };
        const test = this.tests.get(operand);
        if (test) this.tests.set(result, { ...test, presentOnTrue: !test.presentOnTrue });
        return result;
      }
      if (node.operator === ts.SyntaxKind.PlusToken || node.operator === ts.SyntaxKind.MinusToken) {
        requireDomain(this.source, node.operand, operand.type, 'number');
        return node.operator === ts.SyntaxKind.PlusToken ? operand : { type: 'number', value: {
          kind: 'binary', op: 'multiply', left: numberLiteral(-1), right: this.flow.value(operand),
        } };
      }
    }
    if (ts.isBinaryExpression(node)) return this.binary(node);
    if (ts.isSatisfiesExpression(node)) return this.expression(node.expression, expected);
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      const from = this.source.checker.getTypeAtLocation(node.expression);
      const to = this.source.checker.getTypeAtLocation(node);
      if (!this.source.checker.isTypeAssignableTo(from, to)) {
        return this.source.missing(node, 'producer/assertion-proof', 'The assertion requires a source proof of the asserted value domain.');
      }
      const result = this.expression(node.expression, expected);
      requireDomain(this.source, node, result.type, behaviorValueType(this.source, node, to));
      return result;
    }
    if (staticReference(node)) {
      const reference = this.host.resolveRead(node);
      if (reference?.kind === 'capture') return referenceValue(reference, this.facts);
      if (reference) return this.source.missing(node, 'producer/handle-value', 'This use requires a handle value or an explicit read through its owning capability.');
      if (staticCallee(this.source, node)) {
        const constant = moduleLiteral(this.source, node);
        if (constant) return { type: constant.kind, value: constant };
      }
    }
    const member = projection(node);
    if (member) return this.member(node, this.expression(member.object), member.field);
    return this.source.missing(node, 'producer/expression', `Lowering the reached ${ts.SyntaxKind[node.kind]} value requires additional behavior support.`);
  }

  private member(node: ts.Expression, subject: Operand, field: string): Operand {
    const domain = this.source.data.get(subject.type);
    if (domain?.kind === 'record') {
      const member = domain.fields.find((entry) => entry.name === field);
      if (!member) return this.source.missing(node, 'producer/record-member', 'The checked closed record does not supply this field.');
      return { type: member.type, value: { kind: 'member', value: this.flow.value(subject), field } };
    }
    if (domain?.kind === 'presence' && field === 'value') {
      const payload = this.flow.payload(subject);
      if (!payload) return this.source.missing(node, 'producer/presence-proof', 'This presence payload needs a matching present edge for the same immutable value.');
      requireDomain(this.source, node, behaviorValueType(this.source, node), payload.type);
      return payload;
    }
    return this.source.missing(node, 'producer/value-member', 'This value projection needs a represented field or a checked presence match.');
  }

  private record(node: ts.ObjectLiteralExpression, expected?: ValueType): Operand {
    const members = objectMembers(this.source, node, 'producer/record-fields');
    const checked = behaviorValueType(this.source, node);
    if (expected !== undefined) requireDomain(this.source, node, checked, expected);
    const domain = this.source.data.get(checked);
    if (domain?.kind !== 'record') return this.source.missing(node, 'producer/record-domain', 'This construction needs a concrete checked record layout.');
    const expectedFields = new Map(domain.fields.map((field) => [field.name, field.type]));
    const fields = [...members].map(([name, member], index) => {
      const fieldType = expectedFields.get(name);
      if (fieldType === undefined) return this.source.missing(member, 'producer/record-fields', 'This field is outside the expected closed record.');
      const expression = memberValue(this.source, member, 'producer/record-fields');
      const operand = this.expression(expression, fieldType);
      requireDomain(this.source, expression, operand.type, fieldType);
      const value = index + 1 === members.size ? operand : this.flow.retain(expression, operand);
      return { name, value, source: this.source.span(member) };
    });
    if (fields.length !== expectedFields.size) return this.source.missing(node, 'producer/record-fields', 'The value must initialize all fields of its checked closed record.');
    const type = this.source.data.record(fields.map(({ name, value, source }) => ({ name, type: value.type, source })), node);
    requireDomain(this.source, node, type, checked);
    return { type, value: { kind: 'record', type, fields: fields.map(({ name, value }) => ({ name, value: this.flow.value(value) })) } };
  }

  private tagComparison(node: ts.BinaryExpression, inequality: boolean): Operand | undefined {
    const left = unparenthesize(node.left);
    const right = unparenthesize(node.right);
    const literal = ts.isStringLiteralLike(left) ? left : ts.isStringLiteralLike(right) ? right : undefined;
    if (!literal || (literal.text !== 'present' && literal.text !== 'omitted')) return undefined;
    const other = literal === left ? right : left;
    const access = projection(other);
    if (access?.field !== 'kind') return undefined;
    const subject = this.expression(access.object);
    const domain = this.source.data.get(subject.type);
    if (domain?.kind !== 'presence') {
      // Ordinary authored records can use the same field and text spellings.
      // Their checked field is compared normally, without binding a payload.
      const tag = this.member(other, subject, access.field);
      requireDomain(this.source, other, tag.type, 'text');
      const field = this.flow.value(tag);
      const text: Value = { kind: 'text', value: literal.text };
      const equal: Value = { kind: 'binary', op: 'equal', left: literal === left ? text : field, right: literal === left ? field : text };
      return { type: 'bool', value: inequality ? { kind: 'not', value: equal } : equal };
    }
    const hasValue: Value = { kind: 'has-value', value: this.flow.value(subject) };
    const presentOnTrue = (literal.text === 'present') !== inequality;
    const result: Operand = { type: 'bool', value: presentOnTrue ? hasValue : { kind: 'not', value: hasValue } };
    const object = unparenthesize(access.object);
    // A repeated get(...) is a fresh read. Only a bound immutable SSA value
    // can carry the matched payload to a subsequent .value expression.
    if (ts.isIdentifier(object) && this.locals.get(this.source.symbol(object)) === subject) {
      this.tests.set(result, { subject, payloadType: domain.value, presentOnTrue });
    }
    return result;
  }

  private binary(node: ts.BinaryExpression): Operand {
    const operator = node.operatorToken.kind;
    const inequality = operator === ts.SyntaxKind.ExclamationEqualsEqualsToken || operator === ts.SyntaxKind.ExclamationEqualsToken;
    const equality = inequality || operator === ts.SyntaxKind.EqualsEqualsEqualsToken || operator === ts.SyntaxKind.EqualsEqualsToken;
    if (!equality && operator !== ts.SyntaxKind.PlusToken && operator !== ts.SyntaxKind.AsteriskToken) {
      return this.source.missing(node, 'producer/binary-operation', 'The resolved binary operation needs further typed behavior lowering.');
    }
    if (equality) {
      const tag = this.tagComparison(node, inequality);
      if (tag) return tag;
    }
    const first = this.expression(node.left);
    const left = immediate(node.right) ? first : this.flow.retain(node.left, first);
    const right = this.expression(node.right);
    let op: Extract<Value, { kind: 'binary' }>['op'];
    let type: ValueType;
    if (equality) {
      requireDomain(this.source, node.right, right.type, left.type);
      if (left.type === 'unit') return this.source.missing(node, 'producer/equality', 'Unit equality needs a defined comparison domain.');
      op = 'equal';
      type = 'bool';
    } else if (operator === ts.SyntaxKind.PlusToken && left.type === 'text' && right.type === 'text') {
      op = 'concat';
      type = 'text';
    } else {
      requireDomain(this.source, node.left, left.type, 'number');
      requireDomain(this.source, node.right, right.type, 'number');
      op = operator === ts.SyntaxKind.PlusToken ? 'add' : 'multiply';
      type = 'number';
    }
    const value: Value = { kind: 'binary', op, left: this.flow.value(left), right: this.flow.value(right) };
    return { type, value: inequality ? { kind: 'not', value } : value };
  }

  private call(node: ts.CallExpression, allowUnitEffect: boolean): Operand | undefined {
    if (node.flags & ts.NodeFlags.OptionalChain || node.questionDotToken) {
      return this.source.missing(node, 'producer/optional-call', 'A conditional call needs its own evaluation and presence proof.');
    }
    const callee = unparenthesize(node.expression);
    const member = ts.isPropertyAccessExpression(callee) || (ts.isElementAccessExpression(callee) && ts.isStringLiteralLike(callee.argumentExpression));
    if (member && this.owned(callee.expression)?.kind === 'reader') {
      const key = ts.isPropertyAccessExpression(callee) ? callee.name.text : (callee.argumentExpression as ts.StringLiteralLike).text;
      if (key === 'get' && this.source.method(node, 'ReadContext', key)) {
        requireArity(this.source, node, 1);
        const argument = unparenthesize(node.arguments[0]!);
        const ref = this.owned(argument);
        if (!ref || ref.kind === 'signal' || ref.kind === 'reader') {
          return this.source.missing(argument, 'producer/read-location', 'A capability read needs a resolved readable handle belonging to this instance.');
        }
        requireDomain(this.source, node, ref.binding.type, behaviorValueType(this.source, node));
        return referenceValue(ref, this.facts);
      }
      const set = key === 'set';
      if ((set || key === 'emit') && this.source.method(node, 'ActionContext', key)) {
        requireArity(this.source, node, 2);
        if (!this.actionScope) return this.source.invalid(node, 'PUI_ILLEGAL_EFFECT', 'A pure computation or initializer cannot stage action effects.');
        if (this.phase !== 'action') return this.source.missing(node, 'producer/effectful-result', 'Returning a computed value from this effectful helper needs a value-producing ordered invocation.');
        if (!allowUnitEffect) return this.source.missing(node, 'producer/effect-value', 'This ordered effect needs a unit-valued continuation at this position.');
        const target = unparenthesize(node.arguments[0]!);
        const reference = this.owned(target);
        if (!reference || reference.kind === 'reader' || reference.kind !== (set ? 'state' : 'signal')) {
          return this.source.missing(target, 'producer/effect-target', `This effect needs a resolved ${set ? 'owned state' : 'signal'} handle.`);
        }
        const argument = node.arguments[1]!;
        const value = this.expression(argument, reference.binding.type);
        requireDomain(this.source, argument, value.type, reference.binding.type);
        this.flow.instruction({ kind: set ? 'write' : 'emit', target: reference.binding.id, value: this.flow.value(value), source: this.source.span(node) });
        this.facts.ordered = true;
        return undefined;
      }
      return this.source.missing(node, 'producer/capability-operation', 'This resolved capability operation needs additional phase and receiver support.');
    }
    if (!staticCallee(this.source, callee)) {
      return this.source.missing(callee, 'producer/call-receiver', 'This call needs a checked callable and receiver evaluation.');
    }
    if (this.source.intrinsic(callee, 'tw')) {
      requireArity(this.source, node, 1);
      const symbol = this.source.symbol(callee);
      if (symbol.valueDeclaration && ts.isVariableDeclaration(symbol.valueDeclaration) && !moduleConstant(symbol)) {
        return this.source.missing(callee, 'producer/callable-initialization', 'This local tw alias needs proof that its initializer ran before the reached call.');
      }
      const argument = unparenthesize(node.arguments[0]!);
      const input = this.expression(argument);
      requireDomain(this.source, argument, input.type, 'text');
      const text = knownText(input);
      if (text === undefined) return this.source.missing(argument, 'producer/dynamic-style-tokens', 'This tw argument needs dynamic token construction.');
      requireDomain(this.source, node, behaviorValueType(this.source, node), 'tokens');
      return { type: 'tokens', value: { kind: 'tokens', values: text.split(/[\t\n\f\r ]+/u).filter(Boolean) } };
    }
    const symbolicArgs = new Map<number, OwnedBinding>();
    const actuals: ts.Expression[] = [];
    for (const [index, argument] of node.arguments.entries()) {
      const reference = this.owned(argument);
      if (reference) symbolicArgs.set(index, reference);
      else actuals.push(argument);
    }
    const { behavior: helper, captures } = this.host.ordinaryHelper(node, { actionScope: this.actionScope,
      symbolicArgs, lexical: this.lexical.values(), capture: (symbol) => this.local(symbol)?.type });
    const operands = actuals.map((argument, index) => {
      const formal = helper.params[index]!;
      const operand = this.expression(argument, formal.type);
      requireDomain(this.source, argument, operand.type, formal.type);
      return index + 1 === actuals.length ? operand : this.flow.retain(argument, operand);
    });
    const args = operands.map((operand) => this.flow.value(operand));
    for (const symbol of captures) {
      const value = this.local(symbol);
      if (!value) return this.source.missing(node, 'producer/helper-environment', 'This call path lacks an immutable value from the helper’s lexical environment.');
      args.push(this.flow.value(value));
    }
    this.facts.calls.add(helper.binding.id);
    if (helper.phase === 'action') {
      if (!allowUnitEffect || this.phase !== 'action') return this.source.missing(node, 'producer/action-call-value', 'An ordered action invocation needs a unit-valued continuation in an action behavior.');
      this.flow.instruction({ kind: 'invoke', fn: helper.binding.id, args, source: this.source.span(node) });
      this.facts.ordered = true;
      return undefined;
    }
    return { type: helper.binding.type, value: { kind: 'call', fn: helper.binding.id, args } };
  }
}

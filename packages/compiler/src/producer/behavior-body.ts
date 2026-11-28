import ts from 'typescript';
import type { Behavior, Binding, DataRef, ExternIR, Value, ValueType } from '../targets/component-ir.ts';
import { BehaviorFlow, knownText, type Condition, type MatchTest, type Operand, type SwitchDispatch, type TagTest } from './behavior-flow.ts';
import { memberValue, objectMembers } from './component-syntax.ts';
import { COMPOSITE_VALUE_RULE, PERSISTENT_CAPTURE_RULE, enclosingFunction, isAssignmentOperator, isCompositeKind, isSetupFunction, mutatedMember, writtenTarget } from '../frontend/value-semantics.ts';
import {
  behaviorValueType, checkParameters, literalValue, moduleConstant, moduleLiteral, numberLiteral, requireArity, requireDomain,
  staticCallee, staticReference, unparenthesize,
  type BehaviorCallback, type Phase, type Readable, type ResolveRead, type TaskReference,
} from './behavior-types.ts';
import type { SourceLinks } from './links.ts';
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
interface InlinedHelper { readonly inlined: true; readonly value: Operand | undefined }
export type HelperResult = Helper | InlinedHelper;
export type Capability = ts.ParameterDeclaration | ts.VariableDeclaration;
export type OwnedBinding = { readonly kind: 'reader' } |
  TaskReference | { readonly kind: 'extern'; readonly binding: Binding; readonly external: ExternIR } |
  { readonly kind: 'signal'; readonly binding: Binding } |
  { readonly kind: Exclude<Readable['kind'], 'capture'>; readonly binding: Binding };
export interface LexicalBinding {
  readonly declaration: Capability;
  readonly value: OwnedBinding;
}
export type CaptureType = (symbol: ts.Symbol) => ValueType | undefined;
interface InlineDefinition {
  readonly fn: BehaviorCallback;
  readonly name: string;
  readonly result: ValueType;
  readonly lexical: readonly LexicalBinding[];
  readonly canCapture: (symbol: ts.Symbol) => boolean;
}
export interface HelperCall {
  readonly actionScope: boolean;
  readonly symbolicArgs: ReadonlyMap<number, OwnedBinding>;
  readonly lexical: Iterable<LexicalBinding>;
  readonly capture: CaptureType;
  readonly inline?: (definition: InlineDefinition) => InlinedHelper | undefined;
}
export interface HelperEnvironment {
  readonly lexical: readonly LexicalBinding[];
  readonly actionScope: boolean;
  readonly capturedType?: CaptureType;
}
export interface BehaviorHost {
  readonly source: SourceContext;
  readonly resolveRead: ResolveRead;
  readonly resolveExtern: SourceLinks['resolveExtern'];
  ordinaryHelper(call: ts.CallExpression, environment: HelperCall): HelperResult;
}

interface InlineActivation {
  readonly caller: BehaviorBody;
  readonly fn: BehaviorCallback;
  readonly args: ReadonlyMap<number, Operand>;
  readonly canCapture: (symbol: ts.Symbol) => boolean;
  readonly complete: (origin: ts.Node, value?: Operand) => void;
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
  private readonly inline: InlineActivation | undefined;
  private readonly flow: BehaviorFlow;
  private readonly locals = new Map<ts.Symbol, Operand>();
  private readonly lexical = new Map<ts.Symbol, LexicalBinding>();
  private readonly tests: WeakMap<Operand, MatchTest>;
  private readonly tagAliases = new Map<ts.Symbol, Pick<TagTest, 'subject' | 'cases'>>();
  readonly params: Binding[] = [];
  readonly captures: ts.Symbol[] = [];
  readonly facts: Facts;

  constructor(host: BehaviorHost, binding: Binding, phase: Phase, origin: ts.Node, environment?: HelperEnvironment, inline?: InlineActivation) {
    this.host = host;
    this.source = host.source;
    this.binding = binding;
    this.phase = phase;
    this.actionScope = environment?.actionScope ?? (phase === 'action' || phase === 'task');
    this.capturedType = environment?.capturedType;
    this.inline = inline;
    this.flow = inline?.caller.flow ?? new BehaviorFlow(this.source, binding, origin);
    this.tests = inline?.caller.tests ?? new WeakMap();
    this.facts = inline?.caller.facts ?? { reads: new Set(), calls: new Set(), ordered: false };
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
    if (ref?.kind === 'task') return ref;
    if (ref && ref.kind !== 'capture') return { kind: ref.kind, binding: ref.binding };
    const type = this.source.checker.getTypeAtLocation(node);
    if (type.getSymbol()?.declarations?.some(decl => ts.isInterfaceDeclaration(decl) && this.source.intrinsic(decl.name, 'TaskExtern'))) {
      const external = this.host.resolveExtern(node);
      return { kind: 'extern', binding: external.binding, external };
    }
    return undefined;
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
    if (this.inline) {
      if (!this.inline.canCapture(symbol)) return undefined;
      const captured = this.inline.caller.local(symbol);
      if (captured) this.locals.set(symbol, captured);
      return captured;
    }
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

  callback(node: BehaviorCallback, reader: boolean, symbolicArgs?: ReadonlyMap<number, OwnedBinding>, declaredParams?: readonly ValueType[]): void {
    if (!node.body || node.asteriskToken || node.typeParameters?.length || (this.phase !== 'task' && node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword))) {
      return this.source.missing(node, 'producer/function-body', 'This behavior needs a concrete monomorphic body with suspension owned by a task.');
    }
    checkParameters(this.source, node.parameters);
    for (const [index, parameter] of node.parameters.entries()) {
      const reference = symbolicArgs?.get(index);
      if (reference) {
        this.bind(parameter, reference);
      } else if (this.inline) {
        this.locals.set(this.source.symbol(parameter.name), this.inline.args.get(index)!);
      } else if (index === 0 && reader) {
        this.bindCapability(parameter);
      } else {
        const name = (parameter.name as ts.Identifier).text;
        const type = behaviorValueType(this.source, parameter, this.source.checker.getTypeAtLocation(parameter));
        const domain = declaredParams?.[reader ? index - 1 : index] ?? type;
        const binding = this.flow.binding(parameter, 'parameter', name, domain);
        this.params.push(binding);
        let operand: Operand = this.phase === 'task' ? this.flow.parameter(binding) : { type: domain, value: { kind: 'local', id: binding.id } };
        if (type !== domain) {
          const viewed = this.widen(operand);
          requireDomain(this.source, parameter, viewed.type, type);
          operand = this.flow.define(parameter, this.flow.binding(parameter, 'parameter-view', name, type), viewed);
        }
        this.locals.set(this.source.symbol(parameter.name), operand);
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
      else if (ts.isCallExpression(value) && this.binding.type === 'unit') result = this.call(value, true);
      else result = this.expression(value, this.binding.type);
    }
    requireDomain(this.source, origin, result?.type ?? 'unit', this.binding.type);
    if (this.inline) return this.inline.complete(origin, result);
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
    } else if (ts.isSwitchStatement(node)) {
      this.switchStatement(node);
    } else if (ts.isBreakStatement(node)) {
      this.flow.breakSwitch(node);
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
    const symbol = this.source.symbol(name);
    this.locals.set(symbol, local);
    if (declaration.parent.flags & ts.NodeFlags.Const) {
      const test = this.tests.get(value);
      if (test) this.tests.set(local, test);
      const alias = this.immutableTag(initializer);
      if (alias) this.tagAliases.set(symbol, alias);
    }
  }

  private tagAlias(symbol: ts.Symbol): Pick<TagTest, 'subject' | 'cases'> | undefined {
    return this.tagAliases.get(symbol) ?? (this.inline?.canCapture(symbol) ? this.inline.caller.tagAlias(symbol) : undefined);
  }

  private immutableTag(expression: ts.Expression): Pick<TagTest, 'subject' | 'cases'> | undefined {
    const node = unparenthesize(expression);
    if (ts.isIdentifier(node)) return this.tagAlias(this.source.symbol(node));
    const access = projection(node);
    if (!access) return undefined;
    const receiver = unparenthesize(access.object);
    if (!ts.isIdentifier(receiver)) return undefined;
    const symbol = this.source.symbol(receiver);
    const declaration = symbol.valueDeclaration;
    // The producer admits formal arguments as SSA values. A let location or a
    // fresh capability read cannot identify the snapshot that supplied an alias.
    if (!declaration || !(ts.isParameter(declaration) || (ts.isVariableDeclaration(declaration) &&
        ts.isVariableDeclarationList(declaration.parent) && declaration.parent.flags & ts.NodeFlags.Const))) return undefined;
    const subject = this.locals.get(symbol);
    const domain = subject && this.source.data.get(subject.type);
    return subject && domain?.kind === 'tagged' && access.field === domain.discriminant
      ? { subject, cases: domain.cases } : undefined;
  }

  private condition(node: ts.Expression): Condition {
    const value = this.expression(node);
    return this.tests.get(value) ?? value;
  }

  private switchStatement(node: ts.SwitchStatement): void {
    const clauses = node.caseBlock.clauses;
    const discriminant = unparenthesize(node.expression);
    const access = projection(discriminant);
    const subject = access && this.expression(access.object);
    const data = subject && this.source.data.get(subject.type);
    const tagged = subject && data?.kind === 'tagged' && access?.field === data.discriminant
      ? { subject, cases: data.cases }
      : ts.isIdentifier(discriminant) ? this.tagAlias(this.source.symbol(discriminant)) : undefined;
    const selected = access && subject ? this.member(node.expression, subject, access.field) : this.expression(node.expression);
    const scalar = this.widen(selected);
    const selector = tagged ? scalar : this.flow.retain(node.expression, scalar);
    const labels = new Map<string, number>();
    const tests: Array<SwitchDispatch['tests'][number]> = [];
    let fallback = clauses.length;
    for (const [index, clause] of clauses.entries()) {
      if (ts.isDefaultClause(clause)) { fallback = index; continue; }
      const label = moduleLiteral(this.source, clause.expression);
      if (!label || label.kind !== selector.type) return this.source.missing(clause.expression, 'producer/switch-label', 'This switch label needs a checked literal of the selector domain or ordered runtime evaluation.');
      tests.push({ index, node: clause, value: label });
      if (label.kind === 'text' && !labels.has(label.value)) labels.set(label.value, index);
    }
    this.flow.switchStatement(node, { selector, fallback, tests, ...(tagged ? { tagged: { ...tagged, labels } } : {}) }, clause => {
      for (const statement of clause.statements) {
        if (this.flow.terminated) break;
        this.statement(statement);
      }
    });
  }

  private widen(operand: Operand): Operand {
    return this.source.data.get(operand.type)?.kind === 'text-literal'
      ? { type: 'text', value: { kind: 'widen-text', value: this.flow.value(operand) } } : operand;
  }

  private expression(input: ts.Expression, expected?: ValueType): Operand {
    const value = this.operand(input, expected);
    if (expected === undefined || value.type === expected) return value;
    if (expected === 'text') {
      const widened = this.widen(value);
      requireDomain(this.source, input, widened.type, expected);
      return widened;
    }
    const domain = this.source.data.get(expected);
    if (domain?.kind === 'text-literal' && knownText(value) === domain.value) {
      return { type: expected, value: { kind: 'literal-text', type: expected as DataRef } };
    }
    return this.source.missing(input, 'producer/value-domain', `The checked operation needs ${expected}, but its source value lowers as ${value.type}.`);
  }

  private operand(input: ts.Expression, expected?: ValueType): Operand {
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
    if (ts.isAwaitExpression(node)) return this.awaited(node);
    if (ts.isCallExpression(node)) return this.call(node, false)!;
    if (ts.isObjectLiteralExpression(node)) return this.record(node, expected);
    if (ts.isConditionalExpression(node)) {
      return this.flow.choose(node, this.condition(node.condition), (arm) => this.expression(arm, expected));
    }
    if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node) || ts.isDeleteExpression(node)) {
      this.checkWrite(node);
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
      return this.expression(node.expression, behaviorValueType(this.source, node, to));
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
    if (domain?.kind === 'tagged') {
      if (field === domain.discriminant) {
        const known = this.flow.refinement(subject)?.tag;
        if (known === undefined) return { type: 'text', value: { kind: 'tag', value: this.flow.value(subject) } };
        const type = this.source.data.textLiteral(known, node);
        return { type, value: { kind: 'literal-text', type } };
      }
      const payload = this.flow.refinement(subject)?.payload;
      if (!payload) return this.source.missing(node, 'producer/tag-proof', 'The field requires a matching case of this same immutable tagged value.');
      return this.member(node, payload, field);
    }
    if (domain?.kind === 'record') {
      const member = domain.fields.find((entry) => entry.name === field);
      if (!member) return this.source.missing(node, 'producer/record-member', 'The checked closed record does not supply this field.');
      return { type: member.type, value: { kind: 'member', value: this.flow.value(subject), field } };
    }
    if (domain?.kind === 'presence' && field === 'value') {
      const payload = this.flow.refinement(subject)?.payload;
      if (!payload) return this.source.missing(node, 'producer/presence-proof', 'This presence payload needs a matching present edge for the same immutable value.');
      requireDomain(this.source, node, behaviorValueType(this.source, node), payload.type);
      return payload;
    }
    return this.source.missing(node, 'producer/value-member', 'This value projection needs a represented field or a checked presence match.');
  }

  private record(node: ts.ObjectLiteralExpression, expected?: ValueType): Operand {
    const members = objectMembers(this.source, node, 'producer/record-fields');
    const contextual = this.source.checker.getContextualType(node);
    const type = expected ?? behaviorValueType(this.source, node, contextual?.isUnion() ? contextual : undefined);
    const domain = this.source.data.get(type);
    let layout = type;
    let tag: string | undefined;
    if (domain?.kind === 'tagged') {
      const member = members.get(domain.discriminant);
      if (!member) return this.source.missing(node, 'producer/tagged-constructor', 'The tagged construction needs its checked discriminator field.');
      const expression = memberValue(this.source, member, 'producer/tagged-constructor');
      const checked = this.source.checker.getTypeAtLocation(expression);
      const arm = checked.isStringLiteral() && domain.cases.find(entry => entry.tag === checked.value);
      if (!arm) return this.source.missing(expression, 'producer/tagged-constructor', 'This construction needs one proven case of its declared tagged domain.');
      tag = arm.tag;
      layout = arm.payload;
    }
    const record = this.source.data.get(layout);
    if (record?.kind !== 'record') return this.source.missing(node, 'producer/record-domain', 'This construction needs a concrete checked record layout.');
    const expectedFields = new Map(record.fields.map((field) => [field.name, field.type]));
    const fields: { name: string; value: Operand }[] = [];
    let remaining = members.size;
    for (const [name, member] of members) {
      remaining--;
      const expression = memberValue(this.source, member, 'producer/record-fields');
      if (domain?.kind === 'tagged' && name === domain.discriminant) {
        // A call or read delivering a singleton still executes at its authored position.
        const discriminator = this.source.data.textLiteral(tag!, expression);
        this.flow.retain(expression, this.expression(expression, discriminator));
        continue;
      }
      const fieldType = expectedFields.get(name);
      if (fieldType === undefined) return this.source.missing(member, 'producer/record-fields', 'This field is outside the expected closed record.');
      const operand = this.expression(expression, fieldType);
      fields.push({ name, value: remaining ? this.flow.retain(expression, operand) : operand });
    }
    if (fields.length !== expectedFields.size) return this.source.missing(node, 'producer/record-fields', 'The value must initialize all fields of its checked closed record.');
    const payload: Value = { kind: 'record', type: layout as DataRef, fields: fields.map(({ name, value }) => ({ name, value: this.flow.value(value) })) };
    return { type, value: tag === undefined ? payload : { kind: 'tagged', type: type as DataRef, tag, payload } };
  }

  private caseText(node: ts.Expression): string | undefined {
    if (ts.isIdentifier(node)) {
      const local = this.locals.get(this.source.symbol(node));
      if (local) {
        const domain = this.source.data.get(local.type);
        return domain?.kind === 'text-literal' ? domain.value : knownText(local);
      }
    }
    const literal = moduleLiteral(this.source, node);
    return literal?.kind === 'text' ? literal.value : undefined;
  }

  private tagComparison(node: ts.BinaryExpression, inequality: boolean): Operand | undefined {
    const left = unparenthesize(node.left);
    const right = unparenthesize(node.right);
    const leftText = this.caseText(left);
    const textValue = leftText ?? this.caseText(right);
    if (textValue === undefined) return undefined;
    const other = leftText !== undefined ? right : left;
    let tagged = ts.isIdentifier(other) ? this.tagAlias(this.source.symbol(other)) : undefined;
    let value: Operand;
    if (tagged) {
      value = this.expression(other);
    } else {
      const access = projection(other);
      if (!access || !this.source.checker.getTypeAtLocation(access.object).isUnion()) return undefined;
      const subject = this.expression(access.object);
      const domain = this.source.data.get(subject.type);
      const object = unparenthesize(access.object);
      const stable = ts.isIdentifier(object) && this.locals.get(this.source.symbol(object)) === subject;
      if (domain?.kind === 'presence' && access.field === 'kind' && (textValue === 'present' || textValue === 'omitted')) {
        const hasValue: Value = { kind: 'has-value', value: this.flow.value(subject) };
        const presentOnTrue = (textValue === 'present') !== inequality;
        const result: Operand = { type: 'bool', value: presentOnTrue ? hasValue : { kind: 'not', value: hasValue } };
        if (stable) this.tests.set(result, { subject, payloadType: domain.value, presentOnTrue });
        return result;
      }
      value = this.member(other, subject, access.field);
      if (stable && domain?.kind === 'tagged' && access.field === domain.discriminant) tagged = { subject, cases: domain.cases };
    }
    const tag = this.widen(value);
    requireDomain(this.source, other, tag.type, 'text');
    const field = this.flow.value(tag);
    const text: Value = { kind: 'text', value: textValue };
    const equal: Value = { kind: 'binary', op: 'equal', left: leftText !== undefined ? text : field, right: leftText !== undefined ? field : text };
    const result: Operand = { type: 'bool', value: inequality ? { kind: 'not', value: equal } : equal };
    if (tagged && tagged.cases.length > 1 && tagged.cases.some(arm => arm.tag === textValue)) {
      this.tests.set(result, { ...tagged, tag: textValue, presentOnTrue: !inequality });
    }
    return result;
  }

  private binary(node: ts.BinaryExpression): Operand {
    const operator = node.operatorToken.kind;
    if (isAssignmentOperator(operator)) this.checkWrite(node);
    const inequality = operator === ts.SyntaxKind.ExclamationEqualsEqualsToken || operator === ts.SyntaxKind.ExclamationEqualsToken;
    const equality = inequality || operator === ts.SyntaxKind.EqualsEqualsEqualsToken || operator === ts.SyntaxKind.EqualsEqualsToken;
    if (!equality && operator !== ts.SyntaxKind.PlusToken && operator !== ts.SyntaxKind.AsteriskToken) {
      return this.source.missing(node, 'producer/binary-operation', 'The resolved binary operation needs further typed behavior lowering.');
    }
    if (equality) {
      const tag = this.tagComparison(node, inequality);
      if (tag) return tag;
    }
    const first = this.widen(this.expression(node.left));
    const left = immediate(node.right) ? first : this.flow.retain(node.left, first);
    const right = this.widen(this.expression(node.right));
    let op: Extract<Value, { kind: 'binary' }>['op'];
    let type: ValueType;
    if (equality) {
      requireDomain(this.source, node.right, right.type, left.type);
      if (left.type === 'unit') return this.source.missing(node, 'producer/equality', 'Unit equality needs a defined comparison domain.');
      if (isCompositeKind(this.source.data.get(left.type)?.kind)) {
        return this.source.invalid(node, 'PUI_COMPOSITE_OPERATOR_EQUALITY',
          'Operator equality on a record, presence or tagged value compares identity when the same source runs as JavaScript. Use equals(left, right) for structural comparison.',
          COMPOSITE_VALUE_RULE);
      }
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

  /** Assignment, ++/-- and delete share the composite-value and persistent-capture rules. */
  private checkWrite(node: ts.Node): void {
    if (mutatedMember(node)) {
      this.source.invalid(node, 'PUI_COMPOSITE_MUTATION',
        'Composite values are immutable. Construct a new value and write it to declared state instead of changing a member or element.',
        COMPOSITE_VALUE_RULE);
    }
    const written = writtenTarget(node);
    const target = written && unparenthesize(written);
    if (!target || !ts.isIdentifier(target)) return;
    const declaration = this.source.symbol(target).valueDeclaration;
    if (!declaration || !ts.isVariableDeclaration(declaration)) return;
    const owner = enclosingFunction(declaration);
    if (enclosingFunction(node) === owner) return;
    if (owner === undefined || isSetupFunction(owner)) {
      this.source.invalid(node, 'PUI_PERSISTENT_CAPTURE',
        `Binding ${target.text} outlives this invocation and is written from another closure. Declare it with def.state and write it through run.set or task.set.`,
        PERSISTENT_CAPTURE_RULE);
    }
  }

  private equals(node: ts.CallExpression): Operand {
    requireArity(this.source, node, 2);
    const first = this.widen(this.expression(node.arguments[0]!));
    const left = immediate(node.arguments[1]!) ? first : this.flow.retain(node.arguments[0]!, first);
    const right = this.widen(this.expression(node.arguments[1]!));
    requireDomain(this.source, node.arguments[1]!, right.type, left.type);
    if (left.type === 'unit') return this.source.missing(node, 'producer/equality', 'Unit equality needs a defined comparison domain.');
    return { type: 'bool', value: { kind: 'binary', op: 'equal', left: this.flow.value(left), right: this.flow.value(right) } };
  }

  private actualArguments(call: ts.CallExpression, offset: number, params: readonly ValueType[]): Value[] {
    requireArity(this.source, call, params.length + offset);
    const operands = params.map((type, i) => {
      const argument = call.arguments[offset + i]!;
      const value = this.expression(argument, type);
      return i + 1 < params.length ? this.flow.retain(argument, value) : value;
    });
    return operands.map(operand => this.flow.value(operand));
  }

  private awaited(node: ts.AwaitExpression): Operand {
    const call = unparenthesize(node.expression);
    if (this.phase !== 'task' || !ts.isCallExpression(call) || call.questionDotToken || call.flags & ts.NodeFlags.OptionalChain) {
      return this.source.missing(node, 'producer/owned-await', 'This suspension needs a checked operation owned by the executing task.');
    }
    const access = projection(call.expression);
    if (!access || access.field !== 'await' || this.owned(access.object)?.kind !== 'reader' || !this.source.method(call, 'TaskContext', 'await')) {
      return this.source.missing(node, 'producer/owned-await', 'This await needs its actual task capability and a resolved atomic command.');
    }
    const target = call.arguments[0];
    if (!target) return this.source.missing(call, 'producer/extern-argument', 'The suspension needs its typed external operation.');
    const reference = this.owned(target);
    const external = reference?.kind === 'extern' ? reference.external : this.host.resolveExtern(target);
    const args = this.actualArguments(call, 1, external.params.map(param => param.type));
    requireDomain(this.source, node, behaviorValueType(this.source, node, this.source.checker.getTypeAtLocation(node)), external.binding.type);
    this.facts.ordered = true;
    return this.flow.suspend(node, external.binding, args);
  }

  private inlineHelper(node: ts.CallExpression, definition: InlineDefinition, symbolic: ReadonlyMap<number, OwnedBinding>): Operand | undefined {
    const { fn, name, result, lexical, canCapture } = definition;
    for (let frame = this.inline; frame; frame = frame.caller.inline) {
      if (frame.fn === fn) return this.source.missing(node, 'producer/recursive-helper', 'This reached source helper cycle needs recursive-call support in the receiver.');
    }
    // Evaluate all ordinary actuals in the caller before entering the helper.
    // A later argument or the helper itself can write the location read here.
    const args = new Map<number, Operand>();
    for (const [index, argument] of node.arguments.entries()) {
      if (symbolic.has(index)) continue;
      const formal = fn.parameters[index]!;
      const type = behaviorValueType(this.source, formal, this.source.checker.getTypeAtLocation(formal));
      args.set(index, this.flow.retain(argument, this.expression(argument, type)));
    }
    const owner = this.flow.activationBinding(node, name, result);
    return this.flow.inlineCall(node, owner, complete => {
      const body = new BehaviorBody(this.host, owner, 'action', fn, { lexical, actionScope: true }, {
        caller: this, fn, args, canCapture, complete,
      });
      body.callback(fn, false, symbolic);
    });
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
        if (!ref || ref.kind === 'signal' || ref.kind === 'reader' || ref.kind === 'task' || ref.kind === 'extern') {
          return this.source.missing(argument, 'producer/read-location', 'A capability read needs a resolved readable handle belonging to this instance.');
        }
        requireDomain(this.source, node, ref.binding.type, behaviorValueType(this.source, node, this.source.checker.getTypeAtLocation(node)));
        return referenceValue(ref, this.facts);
      }
      const set = key === 'set';
      if ((set || key === 'emit' || key === 'start' || key === 'cancel') && this.source.method(node, 'ActionContext', key)) {
        if (!this.actionScope) return this.source.invalid(node, 'PUI_ILLEGAL_EFFECT', 'A pure computation or initializer cannot stage action effects.');
        if (this.phase !== 'action' && this.phase !== 'task') return this.source.missing(node, 'producer/effectful-result', 'Returning a computed value from this effectful helper needs a value-producing ordered invocation.');
        if (!allowUnitEffect) return this.source.missing(node, 'producer/effect-value', 'This ordered effect needs a unit-valued continuation at this position.');
        if (key === 'start' || key === 'cancel') {
          const argument = node.arguments[0];
          const task = argument && this.owned(argument);
          if (task?.kind !== 'task') return this.source.missing(argument ?? node, 'producer/task-target', 'This task operation needs its resolved instance-owned task handle.');
          const source = this.source.span(node);
          if (key === 'start') {
            const args = this.actualArguments(node, 1, task.params);
            this.flow.instruction({ kind: 'start', task: task.binding.id, args, source });
          } else {
            requireArity(this.source, node, 1);
            this.flow.instruction({ kind: 'cancel', task: task.binding.id, source });
          }
          this.facts.ordered = true;
          return undefined;
        }
        requireArity(this.source, node, 2);
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
    if (this.source.intrinsic(callee, 'equals')) return this.equals(node);
    if (this.source.intrinsic(callee, 'tw')) {
      requireArity(this.source, node, 1);
      const symbol = this.source.symbol(callee);
      if (symbol.valueDeclaration && ts.isVariableDeclaration(symbol.valueDeclaration) && !moduleConstant(symbol)) {
        return this.source.missing(callee, 'producer/callable-initialization', 'This local tw alias needs proof that its initializer ran before the reached call.');
      }
      const argument = unparenthesize(node.arguments[0]!);
      const input = this.expression(argument);
      const domain = this.source.data.get(input.type);
      if (domain?.kind !== 'text-literal') requireDomain(this.source, argument, input.type, 'text');
      else this.flow.retain(argument, input);
      const text = domain?.kind === 'text-literal' ? domain.value : knownText(input);
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
    const inline: HelperCall['inline'] = this.phase === 'task' || this.inline
      ? (definition) => definition.result === 'unit' && !allowUnitEffect ? undefined
        : { inlined: true, value: this.inlineHelper(node, definition, symbolicArgs) }
      : undefined;
    const target = this.host.ordinaryHelper(node, { actionScope: this.actionScope,
      symbolicArgs, lexical: this.lexical.values(), capture: (symbol) => this.local(symbol)?.type, ...(inline && { inline }) });
    if ('inlined' in target) return target.value;
    const { behavior: helper, captures } = target;
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
      if (!allowUnitEffect || (this.phase !== 'action' && this.phase !== 'task')) return this.source.missing(node, 'producer/action-call-value', 'An ordered action invocation needs a unit-valued continuation in an action or task behavior.');
      this.flow.instruction({ kind: 'invoke', fn: helper.binding.id, args, source: this.source.span(node) });
      this.facts.ordered = true;
      return undefined;
    }
    return { type: helper.binding.type, value: { kind: 'call', fn: helper.binding.id, args } };
  }
}

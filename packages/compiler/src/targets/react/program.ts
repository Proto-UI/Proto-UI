import ts from 'typescript';
import type {
  Behavior,
  Binding,
  Block,
  ComponentIR,
  Edge,
  InputBinding,
  LiteralValue,
  Value,
  ValueType,
} from '../component-ir.ts';
import { unsupportedHostName } from '../validate.ts';
import { viewBindings, type ViewBinding } from '../view.ts';
import { Names, call, constDecl, f, id, member, str, typeRef } from './ast.ts';

const react = 'react';
const support = '@proto.ui/compiler/support/react';
const retainedSupport = '@proto.ui/compiler/support/react/retained';
const reactImports = [
  'CSSProperties',
  'Ref',
  'createElement',
  'forwardRef',
  'useRef',
  'useState',
  'useSyncExternalStore',
];
const supportImports = [
  'ActionDispatch',
  'ActionFailure',
  'FieldDraft',
  'FieldStore',
  'InputLease',
  'SignalQueue',
  'dispatchAction',
  'finishAction',
  'missingInput',
  'numberFromBits',
  'observeNativeAction',
  'readBool',
  'readCallback',
  'readNumber',
  'readText',
  'readTokens',
  'readUnit',
  'sameTokens',
  'usePublishedInputs',
];
const retainedImports = ['useRetainedHandle', 'useRetainedInputs'];
const hostLocals = [
  '$props',
  '$inputs',
  '$fields',
  '$draft',
  '$signals',
  '$owner',
  '$lease',
  '$store',
  '$ref',
  '$handle',
  '$before',
  '$after',
];
const guards: Record<ValueType, string> = {
  bool: 'readBool',
  number: 'readNumber',
  text: 'readText',
  unit: 'readUnit',
  tokens: 'readTokens',
};

function origin(binding: Binding): ts.StringLiteral {
  const { file, start, end } = binding.source;
  return str(`${file}:${start}-${end} (${binding.name})`);
}

function successors(block: Block): readonly Edge[] {
  switch (block.end.kind) {
    case 'jump':
      return [block.end.to];
    case 'branch':
      return [block.end.yes, block.end.no];
    default:
      return [];
  }
}

/** Topological order permits native forward breaks with a single copy of each block. */
function orderedBlocks(fn: Behavior): Block[] {
  const byId = new Map(fn.blocks.map((b) => [b.id, b]));
  const reached = new Set([fn.entry]);
  const incoming = new Map<string, number>();
  for (const from of reached) {
    for (const edge of successors(byId.get(from)!)) {
      reached.add(edge.block);
      incoming.set(edge.block, (incoming.get(edge.block) ?? 0) + 1);
    }
  }
  const order = [byId.get(fn.entry)!];
  for (let i = 0; i < order.length; i++) {
    for (const edge of successors(order[i])) {
      const count = incoming.get(edge.block)! - 1;
      incoming.set(edge.block, count);
      if (!count) order.push(byId.get(edge.block)!);
    }
  }
  return order;
}

function visitValue(value: Value, visit: (value: Value) => void): void {
  visit(value);
  switch (value.kind) {
    case 'not':
      visitValue(value.value, visit);
      break;
    case 'binary':
      visitValue(value.left, visit);
      visitValue(value.right, visit);
      break;
    case 'call':
      for (const arg of value.args) visitValue(arg, visit);
      break;
  }
}

export interface FunctionPlan {
  fn: Behavior;
  name: string;
  blocks: Block[];
  calls: Set<string>;
  captures: Set<string>;
  inputs: boolean;
  fields: boolean;
  writes: boolean;
  emits: boolean;
}

export class ReactProgram {
  readonly ir: ComponentIR;
  readonly names = new Names([
    ...reactImports,
    ...supportImports,
    ...retainedImports,
    ...hostLocals,
    'Object',
    'Number',
    'ReturnType',
    'undefined',
    'exports',
    'module',
    'require',
    '__filename',
    '__dirname',
  ]);
  readonly component: string;
  readonly propsType: string;
  readonly projectionType: string;
  readonly handleType: string;
  readonly inputsType: string;
  readonly readInputs: string;
  readonly fieldsType: string;
  readonly initFields: string;
  readonly sameFields: string;
  readonly props: Map<string, InputBinding>;
  readonly viewBindings: readonly ViewBinding[];
  readonly fields = new Map<string, Binding>();
  readonly fieldKeys = new Map<string, string>();
  readonly callbacks = new Map<string, string>();
  readonly listeners = new Map<string, string>();
  readonly functions = new Map<string, FunctionPlan>();
  readonly dispatchers = new Map<string, string>();
  readonly written = new Set<string>();
  readonly #imports = new Map<string, boolean>(); // true for type-only imports
  readonly #numbers = new Map<string, { value: number; constant?: string }>();
  readonly #tokens = new Map<string, { name: string; values: readonly string[] }>();
  readonly #bits = new DataView(new ArrayBuffer(8));

  constructor(ir: ComponentIR) {
    this.ir = ir;
    this.component = this.names.take(ir.name);
    this.propsType = this.names.take(`${ir.name}Props`);
    this.projectionType = this.names.take(`${ir.name}Projection`);
    this.handleType = this.names.take(`${ir.name}Handle`);
    this.inputsType = this.names.take('Inputs');
    this.readInputs = this.names.take('readInputs');
    this.fieldsType = this.names.take('Fields');
    this.initFields = this.names.take('initializeFields');
    this.sameFields = this.names.take('sameFields');
    this.props = new Map(ir.props.map((b) => [b.id, b]));
    this.viewBindings = viewBindings(ir.view);
    const fieldNames = new Names();
    for (const { binding } of ir.fields) {
      this.fields.set(binding.id, binding);
      this.fieldKeys.set(binding.id, fieldNames.take(binding.name));
    }
    const byId = new Map(ir.behaviors.map((fn) => [fn.binding.id, fn]));
    const propNames = new Map<string, string | null>(
      ['key', 'ref', '__self', '__source', '__proto__'].map((key) => [key, null])
    );
    if (ir.projections.length) propNames.set('appearance', null);
    const claimProp = (name: string, binding: Binding) => {
      if (propNames.has(name)) {
        const other = propNames.get(name);
        unsupportedHostName(
          'react',
          name,
          binding.source,
          'This spelling collides with another prop, a React carrier, or the projected appearance callback. Give the public binding a distinct name.',
          other == null ? [binding.id] : [other, binding.id]
        );
      }
      propNames.set(name, binding.id);
    };
    for (const prop of ir.props) {
      claimProp(prop.name, prop);
      if (prop.default) this.reserveLiteral(prop.default);
    }
    for (const signal of ir.signals) {
      const first = String.fromCodePoint(signal.name.codePointAt(0)!);
      const callback = `on${first.toUpperCase()}${signal.name.slice(first.length)}`;
      claimProp(callback, signal);
      this.callbacks.set(signal.id, callback);
    }
    const handleNames = new Map(ir.projections.map((p) => [p.name, p.fn]));
    for (const action of ir.actions) {
      if (handleNames.has(action.name))
        unsupportedHostName(
          'react',
          action.name,
          byId.get(action.fn)!.binding.source,
          'A projection already uses this handle member. Choose a distinct public action name.',
          [handleNames.get(action.name)!, action.fn]
        );
    }

    const emitted = new Set<string>();
    const reached = new Set([
      ...this.viewBindings.map((b) => b.fn),
      ...ir.fields.map((field) => field.init),
      ...ir.projections.map((p) => p.fn),
      ...ir.actions.map((a) => a.fn),
    ]);
    for (const fnId of reached) {
      const fn = byId.get(fnId)!;
      const plan: FunctionPlan = {
        fn,
        name: this.names.take(fn.binding.name),
        blocks: orderedBlocks(fn),
        calls: new Set(),
        captures: new Set(),
        inputs: false,
        fields: false,
        writes: false,
        emits: false,
      };
      const inspect = (value: Value) => {
        if (value.kind === 'call') plan.calls.add(value.fn);
        if (value.kind === 'number' || value.kind === 'tokens') this.reserveLiteral(value);
        if (value.kind === 'prop' || value.kind === 'state' || value.kind === 'capture') {
          plan.captures.add(value.id);
          if (value.kind === 'prop') plan.inputs = true;
          else plan.fields = true;
        }
      };
      for (const b of plan.blocks) {
        for (const op of b.instructions) {
          if (op.kind === 'invoke') {
            plan.calls.add(op.fn);
            for (const arg of op.args) visitValue(arg, inspect);
          } else {
            visitValue(op.value, inspect);
            if (op.kind === 'write') {
              this.written.add(op.target);
              plan.fields = true;
              plan.writes = true;
            }
            if (op.kind === 'emit') {
              emitted.add(op.target);
              plan.emits = true;
            }
          }
        }
        if (b.end.kind === 'branch') visitValue(b.end.condition, inspect);
        if (b.end.kind === 'return' && b.end.value) visitValue(b.end.value, inspect);
        for (const edge of successors(b)) for (const arg of edge.args) visitValue(arg, inspect);
      }
      this.functions.set(fnId, plan);
      for (const callee of plan.calls) reached.add(callee);
    }
    // Dependencies may conservatively mention a field that has not been initialized.
    // Pass only values actually read by the reached body and its compiled callees.
    const callers = new Map<string, FunctionPlan[]>();
    const remaining = new Map<string, number>();
    const ready: FunctionPlan[] = [];
    for (const plan of this.functions.values()) {
      remaining.set(plan.fn.binding.id, plan.calls.size);
      if (!plan.calls.size) ready.push(plan);
      for (const callee of plan.calls) {
        const parents = callers.get(callee);
        if (parents) parents.push(plan);
        else callers.set(callee, [plan]);
      }
    }
    for (const callee of ready) {
      const parents = callers.get(callee.fn.binding.id);
      if (!parents) continue;
      for (const caller of parents) {
        for (const binding of callee.captures) caller.captures.add(binding);
        caller.inputs ||= callee.inputs;
        caller.fields ||= callee.fields;
        caller.writes ||= callee.writes;
        caller.emits ||= callee.emits;
        const refs = remaining.get(caller.fn.binding.id)! - 1;
        remaining.set(caller.fn.binding.id, refs);
        if (!refs) ready.push(caller);
      }
    }
    const publicEntries = new Set(ir.actions.map((action) => action.fn));
    for (const binding of this.viewBindings)
      if (binding.role === 'activate') publicEntries.add(binding.fn);
    for (const fn of publicEntries)
      this.dispatchers.set(
        fn,
        this.names.take(`dispatch_${this.functions.get(fn)!.fn.binding.name}`)
      );
    for (const signal of emitted) {
      this.listeners.set(signal, this.names.take(`listener_${this.callbacks.get(signal)!}`));
    }
  }

  get hasHandle(): boolean {
    return this.ir.projections.length + this.ir.actions.length !== 0;
  }
  get hasOwner(): boolean {
    return this.hasHandle || this.dispatchers.size !== 0;
  }

  use(name: string): ts.Identifier {
    this.#imports.set(name, false);
    return id(name);
  }

  useType(name: string, ...args: ts.TypeNode[]): ts.TypeReferenceNode {
    if (!this.#imports.has(name)) this.#imports.set(name, true);
    return typeRef(name, ...args);
  }

  imports(): ts.ImportDeclaration[] {
    const result: ts.ImportDeclaration[] = [];
    for (const [module, choices] of [
      [react, reactImports],
      [support, supportImports],
      [retainedSupport, retainedImports],
    ] as const) {
      const names = choices.filter((name) => this.#imports.has(name));
      if (!names.length) continue;
      const items = names.map((name) =>
        f.createImportSpecifier(this.#imports.get(name)!, undefined, id(name))
      );
      result.push(
        f.createImportDeclaration(
          undefined,
          f.createImportClause(false, undefined, f.createNamedImports(items)),
          f.createStringLiteral(module)
        )
      );
    }
    return result;
  }

  guard(binding: Binding, value: ts.Expression): ts.Expression {
    return call(this.use(guards[binding.type]), value, origin(binding));
  }

  readProp(binding: InputBinding, props: ts.Expression): ts.Expression {
    const present = call(member(id('Object'), 'hasOwn'), props, str(binding.name));
    const whenPresent = this.guard(binding, member(props, binding.name));
    const whenOmitted = binding.default
      ? this.literal(binding.default)
      : call(this.use('missingInput'), origin(binding));
    return f.createConditionalExpression(present, undefined, whenPresent, undefined, whenOmitted);
  }

  private reserveLiteral(literal: LiteralValue): void {
    if (literal.kind === 'tokens') {
      // The receiver rejects empty names and spaces inside names, so this key
      // distinguishes all ordered sequences, including duplicates and [].
      const key = literal.values.join(' ');
      if (!this.#tokens.has(key))
        this.#tokens.set(key, { name: this.names.take('styleTokens'), values: literal.values });
      return;
    }
    if (literal.kind !== 'number') return;
    const hex = literal.bits.toLowerCase();
    if (this.#numbers.has(hex)) return;
    this.#bits.setBigUint64(0, BigInt(`0x${hex}`));
    const value = this.#bits.getFloat64(0);
    const entry =
      Number.isNaN(value) && hex !== '7ff8000000000000'
        ? { value, constant: this.names.take(`nan_${hex}`) }
        : { value };
    this.#numbers.set(hex, entry);
  }

  literal(literal: LiteralValue): ts.Expression {
    switch (literal.kind) {
      case 'bool':
        return literal.value ? f.createTrue() : f.createFalse();
      case 'text':
        return str(literal.value);
      case 'tokens':
        return id(this.#tokens.get(literal.values.join(' '))!.name);
    }
    const { value, constant } = this.#numbers.get(literal.bits.toLowerCase())!;
    if (constant) return id(constant);
    if (Number.isNaN(value)) return member(id('Number'), 'NaN');
    if (!Number.isFinite(value))
      return member(id('Number'), value < 0 ? 'NEGATIVE_INFINITY' : 'POSITIVE_INFINITY');
    const magnitude = f.createNumericLiteral(Math.abs(value));
    return value < 0 || Object.is(value, -0)
      ? f.createPrefixUnaryExpression(ts.SyntaxKind.MinusToken, magnitude)
      : magnitude;
  }

  constants(): ts.Statement[] {
    const statements: ts.Statement[] = [];
    for (const [hex, { constant }] of this.#numbers) {
      if (!constant) continue;
      const high = f.createNumericLiteral(`0x${hex.slice(0, 8)}`);
      const low = f.createNumericLiteral(`0x${hex.slice(8)}`);
      statements.push(constDecl(constant, call(this.use('numberFromBits'), high, low)));
    }
    for (const { name, values } of this.#tokens.values()) {
      const array = f.createArrayLiteralExpression(values.map(str));
      statements.push(constDecl(name, call(member(id('Object'), 'freeze'), array)));
    }
    return statements;
  }
}

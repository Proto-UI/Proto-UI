import ts from 'typescript';
import type { Behavior, Binding, Block, ComponentBody, Edge, InputBinding, LiteralValue, Value } from '../component-ir.ts';
import { unsupportedHostName } from '../validate.ts';
import { viewBindings, type ViewBinding } from '../view.ts';
import { Names, call, f, id, member, str } from './ast.ts';
import type { ReactData } from './data.ts';
import type { ReactUnit } from './unit.ts';
export function origin(binding: Binding): ts.StringLiteral {
  const { file, start, end } = binding.source;
  return str(`${file}:${start}-${end} (${binding.name})`);
}

function successors(block: Block): readonly Edge[] {
  switch (block.end.kind) {
    case 'jump': return [block.end.to];
    case 'branch': return [block.end.yes, block.end.no];
    case 'presence': return [block.end.present, block.end.omitted];
    case 'match': return block.end.cases.map(c => c.to);
    case 'await': return [block.end.resume];
    default: return [];
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
    case 'not': case 'has-value': case 'member': case 'widen-text': case 'tag': visitValue(value.value, visit); break;
    case 'tagged': visitValue(value.payload, visit); break;
    case 'record': for (const field of value.fields) visitValue(field.value, visit); break;
    case 'binary': visitValue(value.left, visit); visitValue(value.right, visit); break;
    case 'call': for (const arg of value.args) visitValue(arg, visit); break;
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
  tasks: boolean;
  taskBlocks?: ReadonlyMap<string, string>;
  taskView?: string;
}

export class ReactProgram {
  readonly ir: ComponentBody;
  readonly unit: ReactUnit;
  readonly names: Names;
  readonly component: string;
  readonly propsType: string;
  readonly projectionType: string;
  readonly handleType: string;
  readonly inputsType: string;
  readonly readInputs: string;
  readonly checkFixed: string;
  readonly fixed: readonly InputBinding[];
  readonly data: ReactData;
  readonly fieldsType: string;
  readonly initFields: string;
  readonly sameFields: string;
  readonly props: Map<string, InputBinding>;
  readonly contexts = new Map<string, { binding: Binding; key: string; sourceName: string; valueName: string }>();
  readonly viewBindings: readonly ViewBinding[];
  readonly fields = new Map<string, Binding>();
  readonly fieldKeys = new Map<string, string>();
  readonly callbacks = new Map<string, string>();
  readonly listeners = new Map<string, string>();
  readonly functions = new Map<string, FunctionPlan>();
  readonly dispatchers = new Map<string, string>();
  readonly taskKeys = new Map<string, string>();
  readonly tasksType: string;
  readonly written = new Set<string>();
  constructor(unit: ReactUnit, ir: ComponentBody) {
    this.unit = unit;
    this.ir = ir;
    this.names = unit.names;
    const body = unit.bodies.get(ir.id)!;
    this.component = body.component;
    this.propsType = body.propsType;
    this.projectionType = body.projectionType;
    this.handleType = body.handleType;
    this.inputsType = this.names.take('Inputs');
    this.readInputs = this.names.take('readInputs');
    this.checkFixed = this.names.take('checkFixedInputs');
    this.fixed = ir.props.filter(prop => prop.controlMode === 'fixed-instance');
    this.data = unit.data;
    this.fieldsType = this.names.take('Fields');
    this.initFields = this.names.take('initializeFields');
    this.sameFields = this.names.take('sameFields');
    this.tasksType = this.names.take('Tasks');
    const taskNames = new Names();
    for (const task of ir.tasks) this.taskKeys.set(task.fn, taskNames.take(task.fn));
    this.props = new Map(ir.props.map((b) => [b.id, b]));
    this.viewBindings = viewBindings(ir.view);
    for (const { binding, key } of ir.consumes) {
      this.contexts.set(binding.id, { binding, key: unit.keys.get(key)!.name, sourceName: this.names.take(`source_${binding.name}`), valueName: this.names.take(`context_${binding.name}`) });
    }
    const fieldNames = new Names();
    for (const { binding } of ir.fields) {
      this.fields.set(binding.id, binding);
      this.fieldKeys.set(binding.id, fieldNames.take(binding.name));
    }
    const byId = new Map(ir.behaviors.map((fn) => [fn.binding.id, fn]));
    const propNames = new Map<string, string | null>(['key', 'ref', '__self', '__source', '__proto__'].map((key) => [key, null]));
    if (ir.projections.length) propNames.set('appearance', null);
    const claimProp = (name: string, binding: Binding) => {
      if (propNames.has(name)) {
        const other = propNames.get(name);
        unsupportedHostName('react', name, binding.source, 'This spelling collides with another prop, a React carrier, or the projected appearance callback. Give the public binding a distinct name.', other == null ? [binding.id] : [other, binding.id]);
      }
      propNames.set(name, binding.id);
    };
    for (const prop of ir.props) {
      claimProp(prop.name, prop);
      if (prop.default) unit.reserveLiteral(prop.default);
    }
    for (const signal of ir.signals) {
      const first = String.fromCodePoint(signal.name.codePointAt(0)!);
      const callback = `on${first.toUpperCase()}${signal.name.slice(first.length)}`;
      claimProp(callback, signal);
      this.callbacks.set(signal.id, callback);
    }
    const handleNames = new Map(ir.projections.map((p) => [p.name, p.fn]));
    for (const action of ir.actions) {
      if (handleNames.has(action.name)) unsupportedHostName('react', action.name, byId.get(action.fn)!.binding.source, 'A projection already uses this handle member. Choose a distinct public action name.', [handleNames.get(action.name)!, action.fn]);
    }

    const emitted = new Set<string>();
    const reached = new Set([...this.viewBindings.map((b) => b.fn), ...ir.fields.map((field) => field.init), ...ir.projections.map((p) => p.fn), ...ir.actions.map((a) => a.fn), ...ir.provides.map((p) => p.fn), ...ir.created]);
    for (const fnId of reached) {
      const fn = byId.get(fnId)!;
      const plan: FunctionPlan = {
        fn, name: this.names.take(fn.binding.name), blocks: orderedBlocks(fn),
        calls: new Set(), captures: new Set(), inputs: false, fields: false, writes: false, emits: false, tasks: false,
      };
      if (fn.phase === 'task') {
        plan.taskView = this.names.take(`${plan.name}View`);
        plan.taskBlocks = new Map(plan.blocks.map((b, i) => [b.id, i ? this.names.take(`${plan.name}Block`) : plan.name]));
      }
      const inspect = (value: Value) => {
        if (value.kind === 'call') plan.calls.add(value.fn);
        if (value.kind === 'number' || value.kind === 'tokens') unit.reserveLiteral(value);
        if (value.kind === 'prop' || value.kind === 'context' || value.kind === 'state' || value.kind === 'capture') {
          plan.captures.add(value.id);
          if (value.kind === 'prop' || value.kind === 'context') plan.inputs = true;
          else plan.fields = true;
        }
      };
      for (const b of plan.blocks) {
        for (const op of b.instructions) {
          if (op.kind === 'invoke') {
            plan.calls.add(op.fn);
            for (const arg of op.args) visitValue(arg, inspect);
          } else if (op.kind === 'start' || op.kind === 'cancel') {
            plan.tasks = true;
            if (op.kind === 'start') {
              reached.add(op.task);
              for (const arg of op.args) visitValue(arg, inspect);
            }
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
        if (b.end.kind === 'presence' || b.end.kind === 'match') visitValue(b.end.value, inspect);
        if (b.end.kind === 'await') for (const arg of b.end.args) visitValue(arg, inspect);
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
        caller.tasks ||= callee.tasks;
        const refs = remaining.get(caller.fn.binding.id)! - 1;
        remaining.set(caller.fn.binding.id, refs);
        if (!refs) ready.push(caller);
      }
    }
    // A reachable cancel of a declaration that can never start has no work to
    // withdraw. Its instruction still remains legal and in the authored CFG.
    for (const fn of this.taskKeys.keys()) if (!this.functions.has(fn)) this.taskKeys.delete(fn);
    const publicEntries = new Set([...ir.actions.map((action) => action.fn), ...ir.created]);
    for (const binding of this.viewBindings) if (binding.role === 'activate') publicEntries.add(binding.fn);
    for (const fn of publicEntries) this.dispatchers.set(fn, this.names.take(`dispatch_${this.functions.get(fn)!.fn.binding.name}`));
    for (const signal of emitted) {
      this.listeners.set(signal, this.names.take(`listener_${this.callbacks.get(signal)!}`));
    }
  }

  get hasHandle(): boolean { return this.ir.projections.length + this.ir.actions.length !== 0; }
  get hasOwner(): boolean { return this.hasHandle || this.dispatchers.size !== 0 || this.taskKeys.size !== 0; }
  get groupsInputs(): boolean { return this.hasOwner || this.fixed.length !== 0 || this.ir.provides.length !== 0; }

  use(name: string): ts.Identifier { return this.unit.use(name); }
  useType(name: string, ...args: ts.TypeNode[]): ts.TypeReferenceNode { return this.unit.useType(name, ...args); }
  literal(value: LiteralValue): ts.Expression { return this.unit.literal(value); }

  hostInputs(inputs: ts.Expression): ts.Expression {
    return this.contexts.size ? member(inputs, 'host') : inputs;
  }

  binding(id: string): Binding {
    return this.props.get(id) ?? this.fields.get(id) ?? this.contexts.get(id)!.binding;
  }

  guard(binding: Binding, value: ts.Expression): ts.Expression {
    return this.data.read(binding.type, value, origin(binding));
  }

  readProp(binding: InputBinding, props: ts.Expression): ts.Expression {
    const present = call(member(id('Object'), 'hasOwn'), props, str(binding.name));
    const raw = member(props, binding.name);
    const payload = this.data.presence(binding.type);
    if (payload !== undefined) {
      return f.createConditionalExpression(present, undefined, call(this.use('presentInput'), this.data.read(payload, raw, origin(binding))), undefined, this.use('omittedInput'));
    }
    const whenPresent = this.guard(binding, raw);
    const whenOmitted = binding.default ? this.literal(binding.default) : call(this.use('missingInput'), origin(binding));
    return f.createConditionalExpression(present, undefined, whenPresent, undefined, whenOmitted);
  }

}

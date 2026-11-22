import { gpuiExpressionChildren } from './gpui-lexical-names';
import { serializableDataType } from './value-types';
import type { ExpressionIR, FunctionIR, PrototypeIR, StatementIR } from './ir';

export type PortableModuleBinding = NonNullable<PrototypeIR['moduleBindings']>[number];
type Binding = Pick<PortableModuleBinding, 'name' | 'bindingId'>;
type Locals = ReadonlyMap<string, { bindingId?: string } | undefined>;

function countMethodRegistrations(value: unknown, counts: Map<string, number>): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((child) => countMethodRegistrations(child, counts));
    return;
  }
  const node = value as ExpressionIR;
  if (node.kind === 'operation' && node.operation === 'expose.method') {
    const [key] = node.arguments;
    if (key?.kind === 'literal' && typeof key.value === 'string')
      counts.set(key.value, (counts.get(key.value) ?? 0) + 1);
  }
  for (const [field, child] of Object.entries(node))
    if (field !== 'type' && field !== 'span' && field !== 'captures')
      countMethodRegistrations(child, counts);
}

/** Prove immutable portable functions before pruning. This is not a component registry. */
export function portableDataMethods(
  ir: PrototypeIR,
  options: { sameSourceFileOnly?: boolean } = {}
): ReadonlyMap<string, PortableModuleBinding> {
  const modules = new Map((ir.moduleBindings ?? []).map((binding) => [binding.name, binding]));
  const proven = new Map<FunctionIR, boolean>();
  const active = new Set<FunctionIR>();

  function moduleFunction(reference: Binding, locals: Locals) {
    const binding = modules.get(reference.name);
    return !locals.has(reference.name) &&
      binding?.value.kind === 'function' &&
      (reference.bindingId === undefined || reference.bindingId === binding.bindingId) &&
      (!options.sameSourceFileOnly || binding.value.function.span.file === ir.setup.span.file)
      ? binding
      : undefined;
  }

  function expression(value: ExpressionIR, locals: Locals): boolean {
    switch (value.kind) {
      case 'reference': {
        const binding = locals.get(value.name);
        return (
          binding !== undefined &&
          (value.bindingId === undefined || value.bindingId === binding.bindingId)
        );
      }
      case 'call':
      case 'helper-call': {
        const reference =
          value.kind === 'helper-call'
            ? { name: value.name }
            : !value.optional && value.callee.kind === 'reference'
              ? value.callee
              : undefined;
        const binding = reference && moduleFunction(reference, locals);
        return (
          binding !== undefined &&
          portableFunction(binding) &&
          value.arguments.every((argument) => expression(argument, locals))
        );
      }
      case 'literal':
      case 'undefined':
      case 'narrow':
      case 'member':
      case 'element':
      case 'unary':
      case 'binary':
      case 'conditional':
      case 'array':
      case 'record':
      case 'object-spread':
        return gpuiExpressionChildren(value).every((child) => expression(child, locals));
      // Unknown syntax, operations, mutable storage and nested closures fail closed.
      default:
        return false;
    }
  }

  function statements(body: readonly StatementIR[], parent: Locals): boolean {
    const locals = new Map(parent);
    // A later declaration shadows the enclosing name even before initialization.
    for (const statement of body)
      if (statement.kind === 'const') locals.set(statement.name, undefined);
    return body.every((statement) => {
      switch (statement.kind) {
        case 'const':
          if (!expression(statement.value, locals)) return false;
          locals.set(statement.name, statement);
          return true;
        case 'effect':
          return expression(statement.expression, locals);
        case 'return':
          return !statement.value || expression(statement.value, locals);
        case 'if':
          return (
            expression(statement.condition, locals) &&
            statements(statement.then, locals) &&
            statements(statement.otherwise, locals)
          );
        default:
          return false;
      }
    });
  }

  function portableFunction(binding: PortableModuleBinding): boolean {
    if (binding.value.kind !== 'function') return false;
    const fn = binding.value.function;
    const previous = proven.get(fn);
    if (previous !== undefined) return previous;
    if (active.has(fn)) return false;
    active.add(fn);
    const locals = new Map<string, { bindingId?: string } | undefined>(
      fn.parameters.map((parameter) => [parameter.name, undefined])
    );
    const result =
      fn.context === 'helper' &&
      serializableDataType(fn.returnType) !== undefined &&
      (fn.captures ?? []).every((capture) => {
        const captured = moduleFunction(capture, locals);
        return capture.storage === 'value' && captured !== undefined;
      }) &&
      fn.parameters.every((parameter) => {
        if (
          serializableDataType(parameter.type) === undefined ||
          (parameter.default && !expression(parameter.default, locals))
        )
          return false;
        locals.set(parameter.name, parameter);
        return true;
      }) &&
      statements(fn.body, locals);
    active.delete(fn);
    proven.set(fn, result);
    return result;
  }

  const result = new Map<string, PortableModuleBinding>();
  const registrations = new Map<string, number>();
  // Count even unproven call paths and dead branches. Ambiguity cannot turn a
  // rejected registration into permission to call a different function.
  countMethodRegistrations([ir.setup, ir.moduleBindings, ir.hooks], registrations);
  const exposures = new Map(ir.exposes.map((exposure) => [exposure.name, exposure]));
  const setupLocals = new Map<string, undefined>(
    ir.setup.parameters.map((parameter) => [parameter.name, undefined])
  );

  // Eligibility proves the callback's data behavior, not that setup registered
  // it. The instance registry remains authoritative, including conditional setup.
  function select(body: readonly StatementIR[], parent: Locals): void {
    const locals = new Map(parent);
    for (const statement of body)
      if (statement.kind === 'const') locals.set(statement.name, undefined);
    for (const statement of body) {
      if (statement.kind === 'if') {
        select(statement.then, locals);
        select(statement.otherwise, locals);
        continue;
      }
      if (statement.kind !== 'effect') continue;
      const site = statement.expression;
      if (site.kind !== 'operation' || site.operation !== 'expose.method' || site.optional)
        continue;
      const [key, callback] = site.arguments;
      if (key?.kind !== 'literal' || typeof key.value !== 'string') continue;
      const exposure = exposures.get(key.value);
      if (
        registrations.get(key.value) !== 1 ||
        exposure?.kind !== 'method' ||
        exposure.span.file !== site.span.file ||
        exposure.span.start !== site.span.start ||
        exposure.span.end !== site.span.end
      )
        continue;
      if (callback?.kind !== 'reference') continue;
      const binding = moduleFunction(callback, locals);
      if (binding && portableFunction(binding)) result.set(key.value, binding);
    }
  }
  select(ir.setup.body, setupLocals);
  return result;
}

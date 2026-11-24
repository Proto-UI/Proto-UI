import type { ExpressionIR, FunctionIR, PrototypeIR, StatementIR, ValueType } from './ir';

type Binding = Extract<StatementIR, { kind: 'const' }>;
type Identity = { name: string; bindingId?: string };
const identity = (value: Identity) => value.bindingId ?? `name:${value.name}`;
const ignored = new Set(['type', 'span', 'captures', 'capture', 'source', 'sourceFiles']);
const primitive = (type: ValueType): boolean =>
  typeof type === 'string'
    ? ['string', 'number', 'boolean', 'null', 'void'].includes(type)
    : type.kind === 'literal' || (type.kind === 'union' && type.members.every(primitive));
const unavailable = (): never => {
  throw new Error(
    'The native shader graph must be proved finite immutable data. Mutable or escaping aliases, effectful helpers and dynamic inputs require separately implemented specialization.'
  );
};

/**
 * Compile-time data proof only. It never executes source JavaScript and never
 * ships an evaluator. A referenced container must have no mutation or escape,
 * including through a different alias. Unknown use keeps the target unsupported.
 */
export function shaderStaticData(ir: PrototypeIR): (value: ExpressionIR) => unknown {
  const bindings = new Map<string, Binding | null>();
  const names = new Map<string, Binding | null>();
  const unsafe = new Set<string>();
  function walk(value: unknown, consume: (node: Record<string, unknown>) => void): void {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) return value.forEach((item) => walk(item, consume));
    const node = value as Record<string, unknown>;
    consume(node);
    for (const [key, child] of Object.entries(node)) if (!ignored.has(key)) walk(child, consume);
  }
  const roots = [ir.moduleBindings, ir.setup, ir.hooks];
  walk(roots, (node) => {
    if (node.kind !== 'const') return;
    const binding = node as unknown as Binding;
    const key = identity(binding);
    bindings.set(key, bindings.has(key) ? null : binding);
    names.set(binding.name, names.has(binding.name) ? null : binding);
  });
  function fn(value: ExpressionIR, seen = new Set<string>()): FunctionIR | undefined {
    if (value.kind === 'function') return value.function;
    if (value.kind === 'narrow') return fn(value.value, seen);
    if (value.kind !== 'reference') return;
    const key = identity(value);
    if (seen.has(key)) return;
    seen.add(key);
    const binding = bindings.get(key);
    return binding ? fn(binding.value, seen) : undefined;
  }
  function called(value: ExpressionIR): FunctionIR | undefined {
    if (value.kind === 'call') return fn(value.callee);
    if (value.kind === 'helper-call') {
      const binding = names.get(value.name);
      return binding ? fn(binding.value) : undefined;
    }
  }
  const pure = new Map<FunctionIR, boolean>();
  const checking = new Set<FunctionIR>();
  function pureFunction(value: FunctionIR): boolean {
    const previous = pure.get(value);
    if (previous !== undefined) return previous;
    if (checking.has(value)) return false;
    checking.add(value);
    let result = true;
    walk([value.parameters, value.body], (node) => {
      if (
        ['operation', 'member-write', 'lexical-write', 'lexical-update', 'throw', 'try'].includes(
          String(node.kind)
        ) ||
        (node.kind === 'intrinsic' && node.name !== 'object.freeze') ||
        (node.kind === 'record' &&
          (node.entries as { accessor?: string }[]).some((entry) => entry.accessor)) ||
        node.kind === 'object-spread'
      )
        result = false;
      if (node.kind === 'call' || node.kind === 'helper-call') {
        const target = called(node as unknown as ExpressionIR);
        if (!target || !pureFunction(target)) result = false;
      }
    });
    checking.delete(value);
    pure.set(value, result);
    return result;
  }

  function scan(value: unknown, data = false, returningData = false): void {
    if (!value || typeof value !== 'object') return;
    const child = (input: unknown, safe = false) => scan(input, safe, returningData);
    if (Array.isArray(value)) return value.forEach((item) => child(item, data));
    const node = value as Record<string, unknown>;
    if (node.kind === 'reference') {
      if (!data && !primitive(node.type as ValueType))
        unsafe.add(identity(node as unknown as Identity));
      return;
    }
    if (node.kind === 'const') return child(node.value, true);
    if (node.kind === 'function') {
      const target = node.function as FunctionIR;
      scan(target.parameters, data);
      return scan(target.body, false, data && pureFunction(target));
    }
    if (node.kind === 'return') return child(node.value, returningData);
    if (node.kind === 'operation' && node.operation === 'feedback.material.shader') {
      child(node.receiver);
      return child(node.arguments, true);
    }
    if (node.kind === 'call' || node.kind === 'helper-call') {
      const target = called(node as unknown as ExpressionIR);
      const safe = !!target && pureFunction(target) && (data || primitive(node.type as ValueType));
      child(node.callee, safe);
      if (node.kind === 'helper-call' && !safe) {
        const binding = names.get(String(node.name));
        if (binding) unsafe.add(identity(binding));
      }
      return child(node.arguments, safe);
    }
    if (
      ['array', 'record', 'narrow', 'unary', 'binary', 'conditional'].includes(String(node.kind)) ||
      (node.kind === 'intrinsic' && node.name === 'object.freeze')
    ) {
      for (const [key, input] of Object.entries(node)) if (!ignored.has(key)) child(input, data);
      return;
    }
    if (node.kind === 'member' || node.kind === 'element') {
      // Reading a primitive does not expose its containing record. A container
      // read inherits its caller's use, so returning a nested array still escapes.
      child(node.object, data || primitive(node.type as ValueType));
      child(node.index, true);
      return;
    }
    for (const [key, input] of Object.entries(node))
      if (!ignored.has(key)) child(input, data && node.kind === undefined);
  }
  scan(roots);
  // If an alias escapes, the object it aliases and each nested dependency also
  // lose the proof. This includes a safe-looking sibling alias of that object.
  const escapedFunctions = new Set<FunctionIR>();
  function escapeDependencies(value: unknown): void {
    walk(value, (node) => {
      if (node.kind === 'reference') unsafe.add(identity(node as unknown as Identity));
      if (node.kind === 'call' || node.kind === 'helper-call') {
        const target = called(node as unknown as ExpressionIR);
        if (target && !escapedFunctions.has(target)) {
          escapedFunctions.add(target);
          escapeDependencies([target.parameters, target.body]);
        }
      }
    });
  }
  for (const key of unsafe) {
    const binding = bindings.get(key);
    if (binding) escapeDependencies(binding.value);
  }

  return (value) => {
    let remaining = 2_000_000;
    const resolving = new Set<string>();
    const invoking = new Set<FunctionIR>();
    type Environment = Map<string, unknown>;
    function evaluate(node: ExpressionIR, environment: Environment): unknown {
      if (--remaining < 0) return unavailable();
      switch (node.kind) {
        case 'literal':
          return node.value;
        case 'undefined':
          return undefined;
        case 'narrow':
          return evaluate(node.value, environment);
        case 'reference': {
          const key = identity(node);
          if (environment.has(key)) return environment.get(key);
          const binding = bindings.get(key);
          if (!binding || unsafe.has(key) || resolving.has(key)) return unavailable();
          resolving.add(key);
          try {
            return evaluate(binding.value, environment);
          } finally {
            resolving.delete(key);
          }
        }
        case 'record': {
          if (node.entries.some((entry) => entry.accessor)) return unavailable();
          return Object.fromEntries(
            node.entries.map((entry) => [entry.key, evaluate(entry.value, environment)])
          );
        }
        case 'array':
          return node.elements.map((entry) => evaluate(entry, environment));
        case 'intrinsic':
          if (node.name === 'object.freeze' && node.arguments.length === 1)
            return evaluate(node.arguments[0], environment);
          return unavailable();
        case 'member':
        case 'element': {
          const object = evaluate(node.object, environment);
          if (object == null && node.optional) return undefined;
          const key = node.kind === 'member' ? node.property : evaluate(node.index, environment);
          if (!object || typeof object !== 'object' || !['string', 'number'].includes(typeof key))
            return unavailable();
          const descriptor = Object.getOwnPropertyDescriptor(object, String(key));
          if (!descriptor || !('value' in descriptor)) return unavailable();
          return descriptor.value;
        }
        case 'unary': {
          const operand = evaluate(node.operand, environment);
          if (node.operator === '!') return !operand;
          if (typeof operand !== 'number') return unavailable();
          return node.operator === '-' ? -operand : +operand;
        }
        case 'conditional':
          return evaluate(
            evaluate(node.condition, environment) ? node.then : node.otherwise,
            environment
          );
        case 'call':
        case 'helper-call': {
          const target = called(node);
          if (!target || !pureFunction(target) || invoking.has(target)) return unavailable();
          // Arguments precede defaults; extra evaluated arguments are retained.
          const args = node.arguments.map((argument) => evaluate(argument, environment));
          const local = new Map(environment);
          for (const [index, parameter] of target.parameters.entries()) {
            const value = args[index];
            local.set(
              identity(parameter),
              value === undefined && parameter.default ? evaluate(parameter.default, local) : value
            );
          }
          invoking.add(target);
          try {
            return block(target.body, local)?.value;
          } finally {
            invoking.delete(target);
          }
        }
        default:
          return unavailable();
      }
    }
    function block(
      body: readonly StatementIR[],
      environment: Environment
    ): { value: unknown } | undefined {
      for (const statement of body) {
        if (statement.kind === 'const')
          environment.set(identity(statement), evaluate(statement.value, environment));
        else if (statement.kind === 'return')
          return { value: statement.value ? evaluate(statement.value, environment) : undefined };
        else if (statement.kind === 'if') {
          const result = block(
            evaluate(statement.condition, environment) ? statement.then : statement.otherwise,
            new Map(environment)
          );
          if (result) return result;
        } else if (statement.kind === 'effect') evaluate(statement.expression, environment);
        else return unavailable();
      }
    }
    return evaluate(value, new Map());
  };
}

import type { ExpressionIR, StatementIR, ValueType } from './ir';

// Compiler-private lexical shape facts. No shape object is emitted to a consumer.
export type NativeShape =
  | { kind: 'node' | 'text' | 'null' | 'undefined' | 'invalid' | 'legacy-template' }
  | { kind: 'array'; items: NativeShape[] }
  | { kind: 'union'; items: NativeShape[] };
function shapeFromType(type: ValueType): NativeShape | null {
  // The legacy umbrella alone is not constructor provenance. Hosts retain their explicit legacy policy during extraction.
  if (type === 'template') return { kind: 'legacy-template' };
  if (type === 'string' || type === 'number') return { kind: 'text' };
  if (type === 'null') return { kind: 'null' };
  if (type === 'void') return { kind: 'undefined' };
  if (type === 'boolean') return { kind: 'invalid' };
  if (typeof type === 'object') {
    if (type.kind === 'literal')
      return type.value === null
        ? { kind: 'null' }
        : typeof type.value === 'boolean'
          ? { kind: 'invalid' }
          : { kind: 'text' };
    if (type.kind === 'array') {
      const item = shapeFromType(type.element);
      return item ? { kind: 'array', items: [item] } : null;
    }
    if (type.kind === 'union') {
      const items = type.members.map(shapeFromType);
      return items.every((item): item is NativeShape => item !== null)
        ? { kind: 'union', items }
        : null;
    }
    if (type.kind === 'record') return { kind: 'invalid' };
  }
  return null;
}
interface NativeBinding {
  readonly value: ExpressionIR | undefined;
  readonly environment: NativeLexicalScope;
  readonly shape?: NativeShape | null;
}
/** Persistent compiler-only lexical frames; never emitted into host output. */
export class NativeLexicalScope {
  private constructor(
    private readonly parent?: NativeLexicalScope,
    private readonly name?: string,
    private readonly binding?: NativeBinding
  ) {}
  static empty(): NativeLexicalScope {
    return new NativeLexicalScope();
  }
  bind(name: string, value: ExpressionIR): NativeLexicalScope {
    return new NativeLexicalScope(this, name, { value, environment: this });
  }
  parameter(
    name: string,
    value: ExpressionIR | undefined,
    caller: NativeLexicalScope,
    shape: NativeShape | null
  ): NativeLexicalScope {
    return new NativeLexicalScope(this, name, { value, environment: caller, shape });
  }
  lookup(name: string): NativeBinding | undefined {
    return this.name === name ? this.binding : this.parent?.lookup(name);
  }
}

export function nativeShape(
  expression: ExpressionIR,
  environment: NativeLexicalScope
): NativeShape | null {
  // Each active expression is paired with its lexical frame. No function-name
  // active flag: finite id(id(text)) resolves its caller arguments first.
  const active = new Map<ExpressionIR, Set<NativeLexicalScope>>();
  const activeCalls = new Set<ExpressionIR>();
  function dereference(
    value: ExpressionIR,
    scope: NativeLexicalScope
  ): { value: ExpressionIR; scope: NativeLexicalScope } | null {
    const seen = new Set<NativeBinding>();
    while (value.kind === 'reference') {
      const binding = scope.lookup(value.name);
      if (!binding) break;
      if (!binding.value || seen.has(binding)) return null;
      seen.add(binding);
      value = binding.value;
      scope = binding.environment;
    }
    return { value, scope };
  }
  function analyze(value: ExpressionIR, scope: NativeLexicalScope): NativeShape | null {
    const contexts = active.get(value) ?? new Set<NativeLexicalScope>();
    if (contexts.has(scope)) return null;
    contexts.add(scope);
    active.set(value, contexts);
    try {
      return resolve(value, scope);
    } finally {
      contexts.delete(scope);
      if (!contexts.size) active.delete(value);
    }
  }
  function resolve(value: ExpressionIR, scope: NativeLexicalScope): NativeShape | null {
    if (value.kind === 'reference') {
      const binding = scope.lookup(value.name);
      if (binding)
        return 'shape' in binding
          ? (binding.shape ?? null)
          : binding.value
            ? analyze(binding.value, binding.environment)
            : null;
    }
    if (value.kind === 'literal')
      return {
        kind: value.value === null ? 'null' : typeof value.value === 'boolean' ? 'invalid' : 'text',
      };
    if (value.kind === 'array') return collect(value.elements, scope, 'array');
    if (value.kind === 'binary' && ['&&', '||', '??'].includes(value.operator))
      return collect([value.left, value.right], scope, 'union');
    if (
      value.kind === 'operation' &&
      (value.operation === 'render.el' || value.operation === 'render.slot')
    )
      return { kind: 'node' };
    if (value.kind === 'member') {
      const object = dereference(value.object, scope);
      if (object?.value.kind === 'record') {
        const field = object.value.entries.find((entry) => entry.key === value.property);
        return field ? analyze(field.value, object.scope) : null;
      }
    }
    if (value.kind === 'helper-call') {
      const binding = scope.lookup(value.name);
      if (!binding?.value) return null;
      const target = dereference(binding.value, binding.environment);
      if (target?.value.kind !== 'function') return null;
      const fn = target.value.function;
      const shapes = value.arguments.map((argument) => analyze(argument, scope));
      if (activeCalls.has(value)) return null;
      activeCalls.add(value);
      try {
        // Start from the function definition, never inherit caller parameters.
        let local = target.scope;
        fn.parameters.forEach((parameter, index) => {
          local = local.parameter(
            parameter.name,
            value.arguments[index],
            scope,
            index < shapes.length ? shapes[index] : { kind: 'undefined' }
          );
        });
        const returns: NativeShape[] = [];
        const result = body(fn.body, local, returns);
        if (result === null) return null;
        if (!result) returns.push({ kind: 'undefined' });
        return returns.length ? { kind: 'union', items: returns } : null;
      } finally {
        activeCalls.delete(value);
      }
    }
    const typed = shapeFromType(value.type);
    return typed ?? (value.kind === 'record' ? { kind: 'invalid' } : null);
  }
  function collect(
    values: readonly ExpressionIR[],
    scope: NativeLexicalScope,
    kind: 'array' | 'union'
  ): NativeShape | null {
    const items = values.map((value) => analyze(value, scope));
    return items.every((item): item is NativeShape => item !== null) ? { kind, items } : null;
  }
  function body(
    statements: readonly StatementIR[],
    initial: NativeLexicalScope,
    returns: NativeShape[]
  ): boolean | null {
    let scope = initial;
    for (const statement of statements) {
      if (statement.kind === 'const') scope = scope.bind(statement.name, statement.value);
      else if (statement.kind === 'return') {
        const result = statement.value
          ? analyze(statement.value, scope)
          : ({ kind: 'undefined' } as NativeShape);
        if (!result) return null;
        returns.push(result);
        return true;
      } else if (statement.kind === 'if') {
        const then = body(statement.then, scope, returns),
          otherwise = body(statement.otherwise, scope, returns);
        if (then === null || otherwise === null) return null;
        if (then && otherwise) return true;
      }
    }
    return false;
  }
  return analyze(expression, environment);
}

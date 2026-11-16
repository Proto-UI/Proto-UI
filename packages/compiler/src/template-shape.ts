import type { ExpressionIR, FunctionIR, PrototypeIR, StatementIR, ValueType } from './ir';

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
    if (type.kind === 'union' || type.kind === 'value-union') {
      const items = type.members.map(shapeFromType);
      return items.every((item): item is NativeShape => item !== null)
        ? { kind: 'union', items }
        : null;
    }
    if (type.kind === 'record' || type.kind === 'object' || type.kind === 'callable')
      return { kind: 'invalid' };
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
    private readonly binding?: NativeBinding,
    private readonly declarations?: ReadonlyMap<string, NativeBinding>
  ) {}
  static empty(): NativeLexicalScope {
    return new NativeLexicalScope();
  }
  bind(name: string, value: ExpressionIR): NativeLexicalScope {
    return new NativeLexicalScope(this, name, { value, environment: this });
  }
  block(statements: readonly StatementIR[]): NativeLexicalScope {
    // A closure sees the lexical binding, including a declaration initialized
    // later in this block. This is provenance only: the emitter preserves TDZ
    // and source-order evaluation at runtime.
    const declarations = new Map<string, NativeBinding>();
    const scope = new NativeLexicalScope(this, undefined, undefined, declarations);
    for (const statement of statements)
      if (statement.kind === 'const')
        declarations.set(statement.name, { value: statement.value, environment: scope });
    return scope;
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
    return this.name === name
      ? this.binding
      : (this.declarations?.get(name) ?? this.parent?.lookup(name));
  }
}

export function moduleLexicalScope(ir: PrototypeIR): NativeLexicalScope {
  return NativeLexicalScope.empty().block(ir.moduleBindings ?? []);
}

export function nativeShape(
  expression: ExpressionIR,
  environment: NativeLexicalScope
): NativeShape | null {
  // Each active expression is paired with its lexical frame. No function-name
  // active flag: finite id(id(text)) resolves its caller arguments first.
  const active = new Map<ExpressionIR, Set<NativeLexicalScope>>();
  const activeCalls = new Map<ExpressionIR, Set<NativeLexicalScope>>();
  const activeTargets = new Map<ExpressionIR, Set<NativeLexicalScope>>();
  type Target = { fn: FunctionIR; scope: NativeLexicalScope };
  function provenType(type: ValueType): NativeShape | null {
    const result = shapeFromType(type);
    const concrete = (shape: NativeShape): boolean =>
      shape.kind !== 'legacy-template' && (!('items' in shape) || shape.items.every(concrete));
    return result && concrete(result) ? result : null;
  }
  function dereference(
    value: ExpressionIR,
    scope: NativeLexicalScope
  ): { value: ExpressionIR; scope: NativeLexicalScope } | null {
    const seen = new Set<NativeBinding>();
    while (value.kind === 'reference' || value.kind === 'narrow' || value.kind === 'member') {
      if (value.kind === 'narrow') {
        value = value.value;
        continue;
      }
      if (value.kind === 'member') {
        const object = dereference(value.object, scope);
        if (object?.value.kind !== 'record') return null;
        const property = value.property;
        const field = object.value.entries.find((entry) => entry.key === property);
        if (!field) return null;
        value = field.value;
        scope = object.scope;
        continue;
      }
      const binding = scope.lookup(value.name);
      if (!binding) break;
      if (!binding.value || seen.has(binding)) return null;
      seen.add(binding);
      value = binding.value;
      scope = binding.environment;
    }
    return { value, scope };
  }
  function argumentsScope(
    target: Target,
    args: readonly ExpressionIR[],
    caller: NativeLexicalScope
  ) {
    // Evaluate supplied shapes in the caller before entering the callee. A
    // finite wrapper(wrapper(draw)) must not look like recursive execution.
    const shapes = args.map((argument) => analyze(argument, caller));
    let local = target.scope;
    target.fn.parameters.forEach((parameter, index) => {
      const supplied = args[index];
      const defaulted =
        !supplied || supplied.kind === 'undefined' || shapes[index]?.kind === 'undefined';
      const actual = defaulted ? (parameter.default ?? supplied) : supplied;
      const environment = actual === supplied ? caller : local;
      local = local.parameter(
        parameter.name,
        actual,
        environment,
        actual === supplied
          ? (shapes[index] ?? { kind: 'undefined' })
          : actual
            ? analyze(actual, environment)
            : { kind: 'undefined' }
      );
    });
    return local;
  }
  function targets(value: ExpressionIR, scope: NativeLexicalScope): Target[] {
    const resolved = dereference(value, scope);
    if (!resolved) return [];
    value = resolved.value;
    scope = resolved.scope;
    if (value.kind === 'function') return [{ fn: value.function, scope }];
    if (value.kind === 'conditional')
      return [...targets(value.then, scope), ...targets(value.otherwise, scope)];
    if (value.kind !== 'call' && value.kind !== 'helper-call') return [];
    const call = value;
    const callees = targets(
      call.kind === 'call'
        ? call.callee
        : {
            kind: 'reference',
            name: call.name,
            type: 'function',
            span: call.span,
          },
      scope
    );
    const frames = callees.map((target) => ({
      target,
      local: argumentsScope(target, call.arguments, scope),
    }));
    const activeDefinitions = activeTargets.get(value) ?? new Set<NativeLexicalScope>();
    activeTargets.set(value, activeDefinitions);
    const result: Target[] = [];
    function returns(statements: readonly StatementIR[], initial: NativeLexicalScope): boolean {
      let local = initial.block(statements);
      for (const statement of statements) {
        if (statement.kind === 'const') local = local.bind(statement.name, statement.value);
        else if (statement.kind === 'return') {
          if (statement.value) result.push(...targets(statement.value, local));
          return true;
        } else if (statement.kind === 'throw') return true;
        else if (statement.kind === 'if') {
          const left = returns(statement.then, local),
            right = returns(statement.otherwise, local);
          if (left && right) return true;
        } else if (statement.kind === 'try') {
          const start = result.length;
          const tried = returns(statement.body, local);
          const caught = statement.catch
            ? returns(
                statement.catch.body,
                statement.catch.name
                  ? local.parameter(statement.catch.name, undefined, local, null)
                  : local
              )
            : true;
          const end = result.length;
          const finalized = statement.finally ? returns(statement.finally, local) : false;
          if (finalized) result.splice(start, end - start);
          if (finalized || (tried && caught)) return true;
        }
      }
      return false;
    }
    for (const { target, local } of frames) {
      if (activeDefinitions.has(target.scope)) return [];
      activeDefinitions.add(target.scope);
      try {
        returns(target.fn.body, local);
      } finally {
        activeDefinitions.delete(target.scope);
      }
    }
    return result;
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
    if (value.kind === 'narrow') {
      // A proven scalar narrowing is useful; an umbrella template type alone
      // still cannot invent constructor provenance for an unknown value.
      return value.type === 'template'
        ? analyze(value.value, scope)
        : (shapeFromType(value.type) ?? analyze(value.value, scope));
    }
    if (value.kind === 'conditional') return collect([value.then, value.otherwise], scope, 'union');
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
    if (value.kind === 'helper-call' || value.kind === 'call') {
      const callees = targets(
        value.kind === 'call'
          ? value.callee
          : {
              kind: 'reference',
              name: value.name,
              type: 'function',
              span: value.span,
            },
        scope
      );
      if (!callees.length) return provenType(value.type);
      const frames = callees.map((target) => ({
        target,
        local: argumentsScope(target, value.arguments, scope),
      }));
      const activeDefinitions = activeCalls.get(value) ?? new Set<NativeLexicalScope>();
      activeCalls.set(value, activeDefinitions);
      const returns: NativeShape[] = [];
      for (const { target, local } of frames) {
        if (activeDefinitions.has(target.scope)) return provenType(value.type);
        activeDefinitions.add(target.scope);
        let result: boolean | null;
        try {
          result = body(target.fn.body, local, returns);
        } finally {
          activeDefinitions.delete(target.scope);
        }
        if (result === null) return null;
        if (!result) returns.push({ kind: 'undefined' });
      }
      return returns.length ? { kind: 'union', items: returns } : null;
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
    let scope = initial.block(statements);
    for (const statement of statements) {
      if (statement.kind === 'const') scope = scope.bind(statement.name, statement.value);
      else if (statement.kind === 'return') {
        const result = statement.value
          ? analyze(statement.value, scope)
          : ({ kind: 'undefined' } as NativeShape);
        if (!result) return null;
        returns.push(result);
        return true;
      } else if (statement.kind === 'throw') return true;
      else if (statement.kind === 'try') {
        const branchReturns: NativeShape[] = [],
          finalReturns: NativeShape[] = [];
        const tried = body(statement.body, scope, branchReturns);
        const catchScope = statement.catch?.name
          ? scope.parameter(statement.catch.name, undefined, scope, null)
          : scope;
        const caught = statement.catch
          ? body(statement.catch.body, catchScope, branchReturns)
          : true;
        const finalized = statement.finally ? body(statement.finally, scope, finalReturns) : false;
        if (finalized === null || (!finalized && (tried === null || caught === null))) return null;
        if (!finalized) returns.push(...branchReturns);
        returns.push(...finalReturns);
        if (finalized || (tried && caught)) return true;
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

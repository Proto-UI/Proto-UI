import type { ExpressionIR, StatementIR } from './ir';
import { NativeLexicalScope } from './template-shape';

/** Compiler-only alternatives with their declaration/call frames; never emitted. */
export interface InteractionValueAlternative {
  readonly value: ExpressionIR | undefined;
  readonly scope: NativeLexicalScope;
}

/**
 * Follow immutable lexical values, members and helper returns without executing
 * authored code. A null result means unknown/cyclic provenance, not permission
 * to trust an opaque module-config annotation. Every possible return is kept.
 */
export function interactionValueAlternatives(
  expression: ExpressionIR,
  environment: NativeLexicalScope
): readonly InteractionValueAlternative[] | null {
  const active = new Map<ExpressionIR, Set<NativeLexicalScope>>();
  const activeCalls = new Set<ExpressionIR>();

  function analyze(
    value: ExpressionIR,
    scope: NativeLexicalScope
  ): InteractionValueAlternative[] | null {
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

  function resolve(
    value: ExpressionIR,
    scope: NativeLexicalScope
  ): InteractionValueAlternative[] | null {
    if (value.kind === 'reference') {
      const binding = scope.lookup(value.name);
      if (binding) {
        return binding.value ? analyze(binding.value, binding.environment) : null;
      }
    }
    if (value.kind === 'member') {
      const objects = analyze(value.object, scope);
      if (!objects) return null;
      const results: InteractionValueAlternative[] = [];
      for (const object of objects) {
        if (object.value?.kind !== 'record') return null;
        const field = object.value.entries.find((entry) => entry.key === value.property);
        if (!field) results.push({ value: undefined, scope: object.scope });
        else {
          const resolved = analyze(field.value, object.scope);
          if (!resolved) return null;
          results.push(...resolved);
        }
      }
      return results;
    }
    if (value.kind === 'binary' && ['&&', '||', '??'].includes(value.operator)) {
      const left = analyze(value.left, scope);
      const right = analyze(value.right, scope);
      return left && right ? [...left, ...right] : null;
    }
    if (value.kind === 'helper-call') {
      if (activeCalls.has(value)) return null;
      const binding = scope.lookup(value.name);
      if (!binding?.value) return null;
      activeCalls.add(value);
      try {
        const targets = analyze(binding.value, binding.environment);
        if (!targets) return null;
        const returns: InteractionValueAlternative[] = [];
        for (const target of targets) {
          if (target.value?.kind !== 'function') return null;
          const fn = target.value.function;
          // Captures come from the function definition, never from a caller
          // with the same identifier. Actual arguments keep the caller frame.
          let local = target.scope;
          fn.parameters.forEach((parameter, index) => {
            local = local.parameter(parameter.name, value.arguments[index], scope, null);
          });
          const returned = body(fn.body, local, returns);
          if (returned === null) return null;
          if (!returned) returns.push({ value: undefined, scope: local });
        }
        return returns;
      } finally {
        activeCalls.delete(value);
      }
    }
    return [{ value, scope }];
  }

  function body(
    statements: readonly StatementIR[],
    initial: NativeLexicalScope,
    returns: InteractionValueAlternative[]
  ): boolean | null {
    let scope = initial;
    for (const statement of statements) {
      if (statement.kind === 'const') scope = scope.bind(statement.name, statement.value);
      else if (statement.kind === 'return') {
        if (!statement.value) returns.push({ value: undefined, scope });
        else {
          const values = analyze(statement.value, scope);
          if (!values) return null;
          returns.push(...values);
        }
        return true;
      } else if (statement.kind === 'if') {
        const then = body(statement.then, scope, returns);
        const otherwise = body(statement.otherwise, scope, returns);
        if (then === null || otherwise === null) return null;
        if (then && otherwise) return true;
      }
    }
    return false;
  }

  return analyze(expression, environment);
}

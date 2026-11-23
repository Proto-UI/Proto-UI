import type { ExpressionIR, FunctionIR, PrototypeIR, StatementIR } from './ir';
import { NativeLexicalScope, moduleLexicalScope, nativeShape } from './template-shape';
import { valueAlternatives } from './value-types';

export interface NativeValueSource {
  value: ExpressionIR;
  scope: NativeLexicalScope;
}
export interface NativeCallableSource {
  fn: FunctionIR;
  scope: NativeLexicalScope;
}

/** Retain authored return expressions and their declaration environments. */
export function nativeReturnSources(
  fn: FunctionIR,
  definition: NativeLexicalScope,
  args: readonly ExpressionIR[] = [],
  caller = definition
): NativeValueSource[] {
  let local = definition;
  for (const [index, parameter] of fn.parameters.entries()) {
    const supplied = args[index];
    const actual =
      !supplied || supplied.kind === 'undefined' ? (parameter.default ?? supplied) : supplied;
    const scope = actual === supplied ? caller : local;
    local = local.parameter(
      parameter.name,
      actual,
      scope,
      actual ? nativeShape(actual, scope) : null
    );
  }
  const result: NativeValueSource[] = [];
  function visit(body: readonly StatementIR[], initial: NativeLexicalScope): boolean {
    let scope = initial.block(body);
    for (const statement of body) {
      if (statement.kind === 'const') scope = scope.bind(statement.name, statement.value);
      else if (statement.kind === 'return') {
        if (statement.value) result.push({ value: statement.value, scope });
        return true;
      } else if (statement.kind === 'throw') return true;
      else if (statement.kind === 'if') {
        const left = visit(statement.then, scope),
          right = visit(statement.otherwise, scope);
        if (left && right) return true;
      } else if (statement.kind === 'try') {
        const start = result.length;
        const tried = visit(statement.body, scope);
        const caught = statement.catch
          ? visit(
              statement.catch.body,
              statement.catch.name
                ? scope.parameter(statement.catch.name, undefined, scope, null)
                : scope
            )
          : true;
        const end = result.length;
        const finalized = statement.finally ? visit(statement.finally, scope) : false;
        if (finalized) result.splice(start, end - start);
        if (finalized || (tried && caught)) return true;
      }
    }
    return false;
  }
  visit(fn.body, local);
  return result;
}

/**
 * Follow a field through checked facade projection and ordinary record/spread
 * expressions. This is compile-time callable provenance; no source executes and
 * no component identity or runtime shape plan is emitted.
 */
export function nativeFieldSources(
  value: ExpressionIR,
  property: string,
  environment: NativeLexicalScope,
  ir: PrototypeIR,
  callables: (value: ExpressionIR, scope: NativeLexicalScope) => readonly NativeCallableSource[]
): NativeValueSource[] {
  const hooks = new Map(ir.hooks.map((hook) => [hook.id, hook]));
  const module = moduleLexicalScope(ir);
  const active = new Map<ExpressionIR, Map<string, Set<NativeLexicalScope>>>();
  const capture = (id: string, span: ExpressionIR['span']): ExpressionIR => ({
    kind: 'reference',
    name: '\0native-capture-' + id,
    type: { kind: 'capture', hookId: id },
    span,
  });
  function projected(id: string, key: string): NativeValueSource[] {
    const hook = hooks.get(id);
    if (!hook) return [];
    if (!hook.projectHandle) return key === 'render' ? nativeReturnSources(hook.setup, module) : [];
    return nativeReturnSources(
      hook.projectHandle,
      module,
      [capture(id, hook.span)],
      module
    ).flatMap((source) => field(source.value, key, source.scope));
  }
  function field(node: ExpressionIR, key: string, scope: NativeLexicalScope): NativeValueSource[] {
    const properties = active.get(node) ?? new Map<string, Set<NativeLexicalScope>>();
    const contexts = properties.get(key) ?? new Set<NativeLexicalScope>();
    if (contexts.has(scope)) return [];
    contexts.add(scope);
    properties.set(key, contexts);
    active.set(node, properties);
    try {
      const captures = valueAlternatives(node.type).filter(
        (type): type is Extract<ExpressionIR['type'], { kind: 'capture' }> =>
          typeof type !== 'string' && type.kind === 'capture'
      );
      if (key === 'render' && captures.length)
        return captures.flatMap(({ hookId }) => {
          const hook = hooks.get(hookId);
          return hook ? nativeReturnSources(hook.setup, module) : [];
        });
      if (node.kind === 'narrow') return field(node.value, key, scope);
      if (node.kind === 'reference') {
        const binding = scope.lookup(node.name);
        return binding?.value ? field(binding.value, key, binding.environment) : [];
      }
      if (node.kind === 'conditional')
        return [...field(node.then, key, scope), ...field(node.otherwise, key, scope)];
      if (node.kind === 'record') {
        const entry = [...node.entries].reverse().find((entry) => entry.key === key);
        return entry ? [{ value: entry.value, scope }] : [];
      }
      if (node.kind === 'object-spread') {
        const result: NativeValueSource[] = [];
        // Later explicit entries replace preceding properties. A spread's
        // optional property may be absent, so retain preceding alternatives.
        for (const part of [...node.parts].reverse()) {
          if (part.kind === 'entry') {
            if (part.key === key) {
              result.push({ value: part.value, scope });
              break;
            }
          } else result.push(...field(part.value, key, scope));
        }
        return result;
      }
      if (node.kind === 'authored-hook') return projected(node.hookId, key);
      if (node.kind === 'member')
        return field(node.object, node.property, scope).flatMap((source) =>
          field(source.value, key, source.scope)
        );
      if (node.kind === 'operation' && node.operation === 'capture.getAsHookHandle') {
        const name = node.arguments[0];
        if (name?.kind !== 'literal' || typeof name.value !== 'string' || !node.receiver) return [];
        return valueAlternatives(node.receiver.type).flatMap((type) => {
          if (typeof type === 'string' || type.kind !== 'capture') return [];
          const child = hooks
            .get(type.hookId)
            ?.capture?.children.find((child) => child.name === name.value);
          return child ? projected(child.id, key) : [];
        });
      }
      if (node.kind === 'call' || node.kind === 'helper-call') {
        const callee =
          node.kind === 'call'
            ? node.callee
            : {
                kind: 'reference' as const,
                name: node.name,
                type: 'function' as const,
                span: node.span,
              };
        return callables(callee, scope).flatMap((target) =>
          nativeReturnSources(target.fn, target.scope, node.arguments, scope).flatMap((source) =>
            field(source.value, key, source.scope)
          )
        );
      }
      return [];
    } finally {
      contexts.delete(scope);
    }
  }
  return field(value, property, environment);
}

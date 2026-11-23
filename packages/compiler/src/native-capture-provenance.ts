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
  return createNativeFieldResolver(ir, callables)(value, property, environment);
}

/** One immutable IR analysis session; returned closure environments retain identity. */
export function createNativeFieldResolver(
  ir: PrototypeIR,
  callables: (value: ExpressionIR, scope: NativeLexicalScope) => readonly NativeCallableSource[],
  module = moduleLexicalScope(ir)
): (value: ExpressionIR, property: string, environment: NativeLexicalScope) => NativeValueSource[] {
  // A copied native getter remains bound to its actual capture. It is not an
  // authored FunctionIR and must not be fabricated as one for either emitter.
  type ChildGetter = { hookId: string; getter: 'getAsHookHandle' };
  type Source = NativeValueSource | ChildGetter;
  const values = (sources: readonly Source[]): NativeValueSource[] =>
    sources.filter((source): source is NativeValueSource => 'value' in source);
  const hooks = new Map(ir.hooks.map((hook) => [hook.id, hook]));
  const active = new Map<ExpressionIR, Map<string, Set<NativeLexicalScope>>>();
  const activeGetters = new Map<ExpressionIR, Set<NativeLexicalScope>>();
  const captureNodes = new Map<string, ExpressionIR>();
  const projectionReturns = new Map<string, NativeValueSource[]>();
  const setupReturns = new Map<string, NativeValueSource[]>();
  const callReturns = new Map<
    ExpressionIR,
    Map<NativeLexicalScope, Map<FunctionIR, Map<NativeLexicalScope, NativeValueSource[]>>>
  >();
  function capture(id: string, span: ExpressionIR['span']): ExpressionIR {
    let value = captureNodes.get(id);
    if (!value) {
      value = {
        kind: 'reference',
        name: '\0native-capture-' + id,
        type: { kind: 'capture', hookId: id },
        span,
      };
      captureNodes.set(id, value);
    }
    return value;
  }
  function projection(id: string): NativeValueSource[] {
    const hook = hooks.get(id);
    if (!hook?.projectHandle) return [];
    let sources = projectionReturns.get(id);
    if (!sources) {
      sources = nativeReturnSources(hook.projectHandle, module, [capture(id, hook.span)], module);
      projectionReturns.set(id, sources);
    }
    return sources;
  }
  function setup(id: string): NativeValueSource[] {
    const hook = hooks.get(id);
    if (!hook) return [];
    let sources = setupReturns.get(id);
    if (!sources) {
      sources = nativeReturnSources(hook.setup, module);
      setupReturns.set(id, sources);
    }
    return sources;
  }
  function projected(id: string, key: string): Source[] {
    const hook = hooks.get(id);
    if (!hook) return [];
    if (!hook.projectHandle) return field(capture(id, hook.span), key, module);
    return projection(id).flatMap((source) => field(source.value, key, source.scope));
  }
  function callee(node: Extract<ExpressionIR, { kind: 'call' | 'helper-call' }>): ExpressionIR {
    return node.kind === 'call'
      ? node.callee
      : {
          kind: 'reference',
          name: node.name,
          type: 'function',
          span: node.span,
        };
  }
  function callResults<T>(
    node: Extract<ExpressionIR, { kind: 'call' | 'helper-call' }>,
    scope: NativeLexicalScope,
    select: (source: NativeValueSource) => T[]
  ): T[] {
    // The node's argument expressions are fixed in this IR. Keep all targets,
    // and cache only their complete return expressions, before field selection.
    // A fresh lexical scope for the same call would defeat the collector's
    // recursive fn+definition guard. No partial active result is memoized here.
    const contexts = callReturns.get(node) ??
      new Map<NativeLexicalScope, Map<FunctionIR, Map<NativeLexicalScope, NativeValueSource[]>>>();
    callReturns.set(node, contexts);
    const functions = contexts.get(scope) ??
      new Map<FunctionIR, Map<NativeLexicalScope, NativeValueSource[]>>();
    contexts.set(scope, functions);
    return callables(callee(node), scope).flatMap((target) => {
      const definitions = functions.get(target.fn) ?? new Map<NativeLexicalScope, NativeValueSource[]>();
      functions.set(target.fn, definitions);
      let sources = definitions.get(target.scope);
      if (!sources) {
        sources = nativeReturnSources(target.fn, target.scope, node.arguments, scope);
        definitions.set(target.scope, sources);
      }
      return sources.flatMap(select);
    });
  }
  function getters(node: ExpressionIR, scope: NativeLexicalScope): ChildGetter[] {
    const contexts = activeGetters.get(node) ?? new Set<NativeLexicalScope>();
    if (contexts.has(scope)) return [];
    contexts.add(scope);
    activeGetters.set(node, contexts);
    try {
      if (node.kind === 'narrow') return getters(node.value, scope);
      if (node.kind === 'reference') {
        const binding = scope.lookup(node.name);
        return binding?.value ? getters(binding.value, binding.environment) : [];
      }
      if (node.kind === 'conditional')
        return [...getters(node.then, scope), ...getters(node.otherwise, scope)];
      if (node.kind === 'member' || (node.kind === 'element' && node.index.kind === 'literal')) {
        const key =
          node.kind === 'member'
            ? node.property
            : node.index.kind === 'literal'
              ? String(node.index.value)
              : '';
        return field(node.object, key, scope).flatMap((source) =>
          'getter' in source ? [source] : getters(source.value, source.scope)
        );
      }
      if (node.kind === 'call' || node.kind === 'helper-call')
        return callResults(node, scope, (source) => getters(source.value, source.scope));
      if (node.kind === 'authored-hook') {
        const hook = hooks.get(node.hookId);
        return hook?.projectHandle
          ? projection(hook.id).flatMap((source) => getters(source.value, source.scope))
          : [];
      }
      return [];
    } finally {
      contexts.delete(scope);
    }
  }
  function childFields(getter: ChildGetter, name: ExpressionIR | undefined, key: string): Source[] {
    if (!name) return [];
    const names = valueAlternatives(name.type);
    const literalNames =
      nodeName(name) ??
      (names.every(
        (type) =>
          typeof type !== 'string' && type.kind === 'literal' && typeof type.value === 'string'
      )
        ? names.map((type) => (type as { value: string }).value)
        : undefined);
    // A broad string may name any declared child, but never an invented one.
    return (hooks.get(getter.hookId)?.capture?.children ?? [])
      .filter((child) => !literalNames || literalNames.includes(child.name))
      .flatMap((child) => projected(child.id, key));
  }
  function nodeName(value: ExpressionIR): string[] | undefined {
    return value.kind === 'literal' && typeof value.value === 'string' ? [value.value] : undefined;
  }
  function field(node: ExpressionIR, key: string, scope: NativeLexicalScope): Source[] {
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
        return captures.flatMap(({ hookId }) => setup(hookId));
      if (key === 'getAsHookHandle' && captures.length)
        return captures.map(({ hookId }) => ({ hookId, getter: 'getAsHookHandle' }));
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
        const result: Source[] = [];
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
        return values(field(node.object, node.property, scope)).flatMap((source) =>
          field(source.value, key, source.scope)
        );
      if (node.kind === 'operation' && node.operation === 'capture.getAsHookHandle') {
        if (!node.receiver) return [];
        return valueAlternatives(node.receiver.type).flatMap((type) => {
          if (typeof type === 'string' || type.kind !== 'capture') return [];
          return childFields(
            { hookId: type.hookId, getter: 'getAsHookHandle' },
            node.arguments[0],
            key
          );
        });
      }
      if (node.kind === 'call' || node.kind === 'helper-call') {
        return [
          ...getters(callee(node), scope).flatMap((getter) =>
            childFields(getter, node.arguments[0], key)
          ),
          ...callResults(node, scope, (source) => field(source.value, key, source.scope)),
        ];
      }
      return [];
    } finally {
      contexts.delete(scope);
    }
  }
  return (value, property, environment) => values(field(value, property, environment));
}

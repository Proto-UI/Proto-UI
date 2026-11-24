import { createHash } from 'node:crypto';
import type { ExpressionIR, FunctionIR, PrototypeIR, StatementIR } from './ir';

export function gpuiExpressionChildren(value: ExpressionIR): readonly ExpressionIR[] {
  switch (value.kind) {
    case 'narrow':
    case 'lexical-cell':
      return [value.value];
    case 'lexical-read':
    case 'lexical-update':
      return [value.cell];
    case 'lexical-write':
      return [value.cell, value.value];
    case 'member':
      return [value.object];
    case 'member-write':
      return [value.object, value.value];
    case 'element':
      return [value.object, value.index];
    case 'conditional':
      return [value.condition, value.then, value.otherwise];
    case 'call':
      return [value.callee, ...value.arguments];
    case 'operation':
      return [...(value.receiver ? [value.receiver] : []), ...value.arguments];
    case 'helper-call':
    case 'intrinsic':
      return value.arguments;
    case 'authored-hook':
      return value.arguments ?? [];
    case 'object-spread':
    case 'array-spread':
      return value.parts.map((part) => part.value);
    case 'binary':
      return [value.left, value.right];
    case 'unary':
      return [value.operand];
    case 'array':
      return value.elements;
    case 'record':
      return value.entries.map((entry) => entry.value);
    case 'rule':
      return [
        value.receiver,
        ...value.states.map((state) => state.value),
        ...(value.styles ?? []).map((style) => style.value),
        ...(value.targets ?? []).map((target) => target.value),
      ];
    case 'function':
    case 'literal':
    case 'undefined':
    case 'reference':
    case 'context-key':
    case 'static-capability':
    case 'style-handle':
      return [];
  }
}

/** Bindings have source identities. Rust names must not collapse shadowed captures. */
export function gpuiLexicalNames(input: PrototypeIR): PrototypeIR {
  const functions = new Map<FunctionIR, FunctionIR>();
  const identities = new Map<string, Set<string>>();
  function collect(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    const node = value as Record<string, unknown>;
    if (typeof node.bindingId === 'string' && typeof node.name === 'string') {
      const ids = identities.get(node.name) ?? new Set<string>();
      ids.add(node.bindingId);
      identities.set(node.name, ids);
    }
    for (const [key, child] of Object.entries(node))
      if (!['type', 'span', 'sourceFiles'].includes(key)) collect(child);
  }
  collect(input);
  const name = (value: { name: string; bindingId?: string }): string =>
    value.bindingId && (identities.get(value.name)?.size ?? 0) > 1
      ? `${value.name}__${createHash('sha256').update(value.bindingId).digest('hex').slice(0, 16)}`
      : value.name;
  type Scope = ReadonlyMap<string, string>;
  function fn(value: FunctionIR, parent: Scope): FunctionIR {
    const known = functions.get(value);
    if (known) return known;
    const scope = new Map(parent);
    for (const parameter of value.parameters) scope.set(parameter.name, name(parameter));
    const result = { ...value };
    functions.set(value, result);
    result.parameters = value.parameters.map((parameter) => ({
      ...parameter,
      name: name(parameter),
      ...(parameter.default ? { default: expression(parameter.default, scope) } : {}),
    }));
    result.captures = value.captures?.map((capture) => ({ ...capture, name: name(capture) }));
    result.body = body(value.body, scope);
    return result;
  }
  function expression(value: ExpressionIR, scope: Scope): ExpressionIR {
    const child = (value: ExpressionIR) => expression(value, scope);
    switch (value.kind) {
      case 'function':
        return { ...value, function: fn(value.function, scope) };
      case 'reference':
        return {
          ...value,
          name: value.bindingId ? name(value) : (scope.get(value.name) ?? value.name),
        };
      case 'helper-call':
        return {
          ...value,
          name: scope.get(value.name) ?? value.name,
          arguments: value.arguments.map(child),
        };
      case 'narrow':
      case 'lexical-cell':
        return { ...value, value: child(value.value) };
      case 'lexical-read':
      case 'lexical-update':
        return { ...value, cell: child(value.cell) };
      case 'lexical-write':
        return { ...value, cell: child(value.cell), value: child(value.value) };
      case 'member':
        return { ...value, object: child(value.object) };
      case 'member-write':
        return { ...value, object: child(value.object), value: child(value.value) };
      case 'element':
        return { ...value, object: child(value.object), index: child(value.index) };
      case 'conditional':
        return {
          ...value,
          condition: child(value.condition),
          then: child(value.then),
          otherwise: child(value.otherwise),
        };
      case 'call':
        return { ...value, callee: child(value.callee), arguments: value.arguments.map(child) };
      case 'operation':
        return {
          ...value,
          ...(value.receiver ? { receiver: child(value.receiver) } : {}),
          arguments: value.arguments.map(child),
        };
      case 'intrinsic':
        return { ...value, arguments: value.arguments.map(child) };
      case 'authored-hook':
        return { ...value, ...(value.arguments ? { arguments: value.arguments.map(child) } : {}) };
      case 'binary':
        return { ...value, left: child(value.left), right: child(value.right) };
      case 'unary':
        return { ...value, operand: child(value.operand) };
      case 'array':
        return { ...value, elements: value.elements.map(child) };
      case 'record':
        return {
          ...value,
          entries: value.entries.map((entry) => ({ ...entry, value: child(entry.value) })),
        };
      case 'object-spread':
        return {
          ...value,
          parts: value.parts.map((part) => ({ ...part, value: child(part.value) })),
        };
      case 'array-spread':
        return {
          ...value,
          parts: value.parts.map((part) => ({ ...part, value: child(part.value) })),
        };
      case 'rule':
        return {
          ...value,
          receiver: child(value.receiver),
          states: value.states.map((state) => ({ ...state, value: child(state.value) })),
          ...(value.styles
            ? { styles: value.styles.map((style) => ({ ...style, value: child(style.value) })) }
            : {}),
          ...(value.targets
            ? {
                targets: value.targets.map((target) => ({ ...target, value: child(target.value) })),
              }
            : {}),
        };
      case 'literal':
      case 'undefined':
      case 'context-key':
      case 'static-capability':
      case 'style-handle':
        return value;
    }
  }
  function body(values: readonly StatementIR[], parent: Scope): StatementIR[] {
    const scope = new Map(parent);
    // The lexical environment exists before any initializer is evaluated.
    for (const value of values) if (value.kind === 'const') scope.set(value.name, name(value));
    return values.map((value) => {
      if (value.kind === 'const')
        return { ...value, name: name(value), value: expression(value.value, scope) };
      if (value.kind === 'effect')
        return { ...value, expression: expression(value.expression, scope) };
      if (value.kind === 'return')
        return { ...value, ...(value.value ? { value: expression(value.value, scope) } : {}) };
      if (value.kind === 'throw') return { ...value, value: expression(value.value, scope) };
      if (value.kind === 'if')
        return {
          ...value,
          condition: expression(value.condition, scope),
          then: body(value.then, scope),
          otherwise: body(value.otherwise, scope),
        };
      if (value.kind === 'while')
        return {
          ...value,
          condition: expression(value.condition, scope),
          body: body(value.body, scope),
        };
      if (value.kind === 'for-of') {
        const loop = new Map(scope);
        loop.set(value.name, name(value));
        return {
          ...value,
          name: name(value),
          iterable: expression(value.iterable, scope),
          body: body(value.body, loop),
        };
      }
      const caught = new Map(scope);
      if (value.catch?.name) caught.set(value.catch.name, value.catch.name);
      return {
        ...value,
        body: body(value.body, scope),
        ...(value.catch ? { catch: { ...value.catch, body: body(value.catch.body, caught) } } : {}),
        ...(value.finally ? { finally: body(value.finally, scope) } : {}),
      };
    });
  }
  const moduleScope = new Map(
    (input.moduleBindings ?? []).map((value) => [value.name, name(value)])
  );
  return {
    ...input,
    moduleBindings: body(input.moduleBindings ?? [], moduleScope) as PrototypeIR['moduleBindings'],
    setup: fn(input.setup, moduleScope),
    hooks: input.hooks.map((hook) => ({
      ...hook,
      setup: fn(hook.setup, moduleScope),
      ...(hook.projectHandle ? { projectHandle: fn(hook.projectHandle, moduleScope) } : {}),
      ...(hook.configure ? { configure: fn(hook.configure, moduleScope) } : {}),
    })),
  };
}

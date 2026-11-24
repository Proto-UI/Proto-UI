import { parseDataType, type DataType } from './data-types';
import type { ExpressionIR, FunctionIR, PrototypeIR, StatementIR } from './ir';
import { stateValue } from './operations';

export interface StateDataBinding {
  value?: ExpressionIR;
  stateData?: DataType;
  lookup?: StateDataLookup;
}
export type StateDataLookup = (reference: {
  name: string;
  bindingId?: string;
}) => StateDataBinding | undefined;

/**
 * Infer enum value facts from executable declarations, never serialized claims.
 * Ordinary calls retain the actual returned State identity. A mutable holder,
 * recursion, or any unproven return leaves the value at its scalar boundary.
 */
export function inferStateData(value: ExpressionIR, lookup: StateDataLookup): DataType | undefined {
  const active = new Set<ExpressionIR | FunctionIR>();
  const key = (reference: { name: string; bindingId?: string }) =>
    reference.bindingId ?? reference.name;
  const join = (values: readonly (DataType | undefined)[]): DataType | undefined =>
    values.length && values.every((value) => value !== undefined)
      ? parseDataType({ kind: 'union', members: values })
      : undefined;

  function unwrap(
    expression: ExpressionIR,
    read: StateDataLookup
  ): { value: ExpressionIR; lookup: StateDataLookup } | undefined {
    const seen = new Set<ExpressionIR>();
    while (expression.kind === 'narrow' || expression.kind === 'reference') {
      if (seen.has(expression)) return undefined;
      seen.add(expression);
      if (expression.kind === 'narrow') expression = expression.value;
      else {
        const binding = read(expression);
        if (!binding?.value) return undefined;
        expression = binding.value;
        read = binding.lookup ?? read;
      }
    }
    return { value: expression, lookup: read };
  }

  function strings(expression: ExpressionIR, read: StateDataLookup): string[] | undefined {
    const resolved = unwrap(expression, read);
    if (!resolved) return undefined;
    const value = resolved.value;
    if (value.kind === 'array') {
      const result: string[] = [];
      for (const item of value.elements) {
        const literal = unwrap(item, resolved.lookup)?.value;
        if (literal?.kind !== 'literal' || typeof literal.value !== 'string') return undefined;
        result.push(literal.value);
      }
      return result;
    }
    if (value.kind === 'array-spread') {
      const result: string[] = [];
      for (const part of value.parts) {
        if (part.spread) {
          const values = strings(part.value, resolved.lookup);
          if (!values) return undefined;
          result.push(...values);
        } else {
          const literal = unwrap(part.value, resolved.lookup)?.value;
          if (literal?.kind !== 'literal' || typeof literal.value !== 'string') return undefined;
          result.push(literal.value);
        }
      }
      return result;
    }
    return undefined;
  }

  function returned(
    fn: FunctionIR,
    args: readonly ExpressionIR[],
    read: StateDataLookup
  ): DataType | undefined {
    if (active.has(fn) || !stateValue(fn.returnType)) return undefined;
    active.add(fn);
    try {
      const parameters = new Map<string, StateDataBinding>();
      fn.parameters.forEach((parameter, index) => {
        const argument = args[index] ?? parameter.default;
        if (argument) parameters.set(key(parameter), { value: argument, lookup: read });
      });
      const parent: StateDataLookup = (reference) =>
        parameters.get(key(reference)) ?? read(reference);
      const results: (DataType | undefined)[] = [];
      const walk = (statements: readonly StatementIR[], outer: StateDataLookup): void => {
        const declarations = new Map<string, StateDataBinding>();
        const local: StateDataLookup = (reference) =>
          declarations.get(key(reference)) ?? outer(reference);
        for (const statement of statements) {
          if (statement.kind === 'const') {
            // Cells can change their State identity after this declaration.
            if (statement.value.kind !== 'lexical-cell')
              declarations.set(key(statement), { value: statement.value, lookup: local });
          } else if (statement.kind === 'return') {
            results.push(statement.value ? derive(statement.value, local) : undefined);
            break;
          } else if (statement.kind === 'throw') break;
          else if (statement.kind === 'if') {
            walk(statement.then, local);
            walk(statement.otherwise, local);
          } else if (statement.kind === 'while' || statement.kind === 'for-of')
            walk(statement.body, local);
          else if (statement.kind === 'try') {
            walk(statement.body, local);
            if (statement.catch) walk(statement.catch.body, local);
            if (statement.finally) walk(statement.finally, local);
          }
        }
      };
      walk(fn.body, parent);
      return join(results);
    } finally {
      active.delete(fn);
    }
  }

  function derive(expression: ExpressionIR, read: StateDataLookup): DataType | undefined {
    if (active.has(expression) || !stateValue(expression.type)) return undefined;
    active.add(expression);
    try {
      if (expression.kind === 'narrow') return derive(expression.value, read);
      if (expression.kind === 'reference') {
        const binding = read(expression);
        return (
          binding?.stateData ??
          (binding?.value ? derive(binding.value, binding.lookup ?? read) : undefined)
        );
      }
      if (expression.kind === 'conditional')
        return join([derive(expression.then, read), derive(expression.otherwise, read)]);
      if (expression.kind === 'operation' && expression.operation === 'state.enum') {
        const config = expression.arguments[2] && unwrap(expression.arguments[2], read);
        const options =
          config?.value.kind === 'record'
            ? config.value.entries.find((entry) => entry.key === 'options')?.value
            : undefined;
        const values = options && strings(options, config!.lookup);
        return values?.length
          ? parseDataType({
              kind: 'union',
              members: values.map((value) => ({ kind: 'literal', value })),
            })
          : undefined;
      }
      if (expression.kind === 'helper-call') {
        const binding = read({ name: expression.name });
        const callee = binding?.value && unwrap(binding.value, binding.lookup ?? read);
        return callee?.value.kind === 'function'
          ? returned(callee.value.function, expression.arguments, read)
          : undefined;
      }
      if (expression.kind === 'call' && !expression.optional && !expression.spread?.some(Boolean)) {
        const callee = unwrap(expression.callee, read);
        return callee?.value.kind === 'function'
          ? returned(callee.value.function, expression.arguments, read)
          : undefined;
      }
      return undefined;
    } finally {
      active.delete(expression);
    }
  }
  return derive(value, lookup);
}

/**
 * A static helper may borrow enum facts only from every actual direct caller.
 * A helper referenced as an ordinary value has an open invocation boundary and
 * receives no such facts. This analysis is also run by source-free validation.
 */
export function deriveModuleStateInputs(
  ir: PrototypeIR
): ReadonlyMap<FunctionIR, readonly (DataType | undefined)[]> {
  const modules = new Map(
    (ir.moduleBindings ?? [])
      .filter((value): value is Extract<StatementIR, { kind: 'const' }> => value.kind === 'const')
      .map((value) => [value.name, value])
  );
  const helpers = new Map(
    [...modules].flatMap(([name, declaration]) =>
      declaration.value.kind === 'function' ? [[name, declaration.value.function] as const] : []
    )
  );
  const helperFunctions = new Set(helpers.values());
  let facts = new Map<FunctionIR, readonly (DataType | undefined)[]>();
  const key = (reference: { name: string; bindingId?: string }) =>
    reference.bindingId ?? reference.name;
  for (let pass = 0; pass <= helpers.size; pass++) {
    const calls = new Map<FunctionIR, (DataType | undefined)[][]>();
    const escaped = new Set<FunctionIR>();
    const active = new Set<FunctionIR>();
    const moduleRead: StateDataLookup = (reference) => modules.get(reference.name);
    const visitFunction = (fn: FunctionIR, outer: StateDataLookup, declaration = false): void => {
      if (helperFunctions.has(fn) && !declaration) escaped.add(fn);
      if (active.has(fn)) return;
      active.add(fn);
      const parameters = new Map(
        fn.parameters.map((parameter, index) => [
          key(parameter),
          { stateData: facts.get(fn)?.[index] },
        ])
      );
      visitStatements(fn.body, (reference) => parameters.get(key(reference)) ?? outer(reference));
      active.delete(fn);
    };
    const visitExpression = (value: ExpressionIR, read: StateDataLookup): void => {
      if (value.kind === 'reference') {
        const fn = helpers.get(value.name);
        if (fn) escaped.add(fn);
        return;
      }
      if (value.kind === 'function') {
        visitFunction(value.function, read);
        return;
      }
      if (value.kind === 'helper-call') {
        const fn = helpers.get(value.name);
        if (fn) {
          const inputs = fn.parameters.map((parameter, index) =>
            stateValue(parameter.type) && value.arguments[index]
              ? inferStateData(value.arguments[index], read)
              : undefined
          );
          const entries = calls.get(fn) ?? [];
          entries.push(inputs);
          calls.set(fn, entries);
        }
      }
      const walk = (entry: unknown): void => {
        if (!entry || typeof entry !== 'object') return;
        if (Array.isArray(entry)) {
          entry.forEach(walk);
          return;
        }
        if ('kind' in entry && 'type' in entry && 'span' in entry) {
          visitExpression(entry as ExpressionIR, read);
          return;
        }
        for (const child of Object.values(entry)) walk(child);
      };
      for (const [name, child] of Object.entries(value))
        if (!['type', 'span', 'captures'].includes(name)) walk(child);
    };
    const visitStatements = (body: readonly StatementIR[], outer: StateDataLookup): void => {
      const locals = new Map<string, StateDataBinding>();
      const read: StateDataLookup = (reference) => locals.get(key(reference)) ?? outer(reference);
      for (const statement of body) {
        if (statement.kind === 'const') {
          visitExpression(statement.value, read);
          if (statement.value.kind !== 'lexical-cell')
            locals.set(key(statement), { value: statement.value, lookup: read });
        } else if (statement.kind === 'effect') visitExpression(statement.expression, read);
        else if (statement.kind === 'return') {
          if (statement.value) visitExpression(statement.value, read);
        } else if (statement.kind === 'throw') visitExpression(statement.value, read);
        else if (statement.kind === 'if') {
          visitExpression(statement.condition, read);
          visitStatements(statement.then, read);
          visitStatements(statement.otherwise, read);
        } else if (statement.kind === 'while') {
          visitExpression(statement.condition, read);
          visitStatements(statement.body, read);
        } else if (statement.kind === 'for-of') {
          visitExpression(statement.iterable, read);
          visitStatements(statement.body, read);
        } else if (statement.kind === 'try') {
          visitStatements(statement.body, read);
          if (statement.catch) visitStatements(statement.catch.body, read);
          if (statement.finally) visitStatements(statement.finally, read);
        }
      }
    };
    for (const declaration of modules.values()) {
      if (declaration.value.kind === 'function')
        visitFunction(declaration.value.function, moduleRead, true);
      else visitExpression(declaration.value, moduleRead);
    }
    visitFunction(ir.setup, moduleRead);
    for (const hook of ir.hooks) {
      visitFunction(hook.setup, moduleRead);
      if (hook.configure) visitFunction(hook.configure, moduleRead);
      if (hook.projectHandle) visitFunction(hook.projectHandle, moduleRead);
    }
    const next = new Map<FunctionIR, readonly (DataType | undefined)[]>();
    for (const fn of helpers.values()) {
      const entries = calls.get(fn);
      if (!entries?.length || escaped.has(fn)) continue;
      const parameters = fn.parameters.map((parameter, index): DataType | undefined => {
        const values = entries.map((entry) => entry[index]);
        return stateValue(parameter.type) && values.every((value) => value !== undefined)
          ? parseDataType({ kind: 'union', members: values })
          : undefined;
      });
      if (parameters.some(Boolean)) next.set(fn, parameters);
    }
    const stable = [...helpers.values()].every(
      (fn) => JSON.stringify(facts.get(fn)) === JSON.stringify(next.get(fn))
    );
    facts = next;
    if (stable) break;
  }
  return facts;
}

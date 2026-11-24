import type { ExpressionIR, FunctionIR, PrototypeIR, StatementIR } from './ir';
import { structuralStatementOrder } from './declaration-order';

const cache = new WeakMap<PrototypeIR, PrototypeIR>();
type Binding = Extract<StatementIR, { kind: 'const' }>;
const identity = (value: { name: string; bindingId?: string }) =>
  value.bindingId ? `id:${value.bindingId}` : `name:${value.name}`;

/**
 * Remove unused, proved inert values before capability reachability. In particular,
 * creating a closure or putting it in an unused record does not execute its body.
 * Calls are removable only when their known, capture-free body and all inputs are
 * inert. Host operations, mutations, unknown calls, property reads and exceptions
 * remain observable. This is a compile-time pass; no evaluator ships in artifacts.
 */
export function pruneDeadValues(input: PrototypeIR): PrototypeIR {
  const previous = cache.get(input);
  if (previous) return previous;
  let ir = input;
  for (;;) {
    const uses = new Set<string>();
    const bindings = new Map<string, Binding | null>();
    const names = new Map<string, Binding | null>();
    function inspect(value: unknown): void {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        value.forEach(inspect);
        return;
      }
      const node = value as Record<string, unknown>;
      if (node.kind === 'reference')
        uses.add(identity(node as unknown as ExpressionIR & { name: string }));
      if (node.kind === 'helper-call') uses.add(`name:${node.name}`);
      if (node.kind === 'const') {
        const binding = node as unknown as Binding,
          id = identity(binding);
        bindings.set(id, bindings.has(id) ? null : binding);
        names.set(binding.name, names.has(binding.name) ? null : binding);
      }
      for (const [key, child] of Object.entries(node))
        if (!['type', 'span', 'captures', 'capture', 'sourceFiles', 'source'].includes(key))
          inspect(child);
    }
    inspect(ir.moduleBindings);
    inspect(ir.setup);
    inspect(ir.hooks);
    function resolve(value: ExpressionIR, seen = new Set<string>()): FunctionIR | undefined {
      if (value.kind === 'function') return value.function;
      if (value.kind === 'narrow') return resolve(value.value, seen);
      if (value.kind !== 'reference') return undefined;
      const id = identity(value);
      if (seen.has(id)) return undefined;
      seen.add(id);
      const binding = bindings.get(id);
      return binding && binding.value.kind !== 'lexical-cell'
        ? resolve(binding.value, seen)
        : undefined;
    }
    const checking = new Set<FunctionIR>(),
      pureFunctions = new Map<FunctionIR, boolean>();
    function inertFunction(fn: FunctionIR): boolean {
      const known = pureFunctions.get(fn);
      if (known !== undefined) return known;
      // Captured cells may still be in their temporal dead zone at an actual call.
      if (checking.has(fn) || fn.captures?.length) return false;
      checking.add(fn);
      const available = new Set<string>();
      let result = true;
      for (const parameter of fn.parameters) {
        if (parameter.default && !inert(parameter.default, available)) result = false;
        available.add(identity(parameter));
      }
      result &&= inertBlock(fn.body, available);
      checking.delete(fn);
      pureFunctions.set(fn, result);
      return result;
    }
    function inert(value: ExpressionIR, available: ReadonlySet<string>): boolean {
      switch (value.kind) {
        case 'undefined':
        case 'literal':
        case 'function':
        case 'style-handle':
        case 'context-key':
        case 'static-capability':
          return true;
        case 'reference':
          return available.has(identity(value));
        case 'narrow':
          return inert(value.value, available);
        case 'lexical-cell':
          return inert(value.value, available);
        case 'array':
          return value.elements.every((item) => inert(item, available));
        case 'record':
          return value.entries.every((item) => inert(item.value, available));
        case 'unary':
          return inert(value.operand, available);
        case 'binary':
          return inert(value.left, available) && inert(value.right, available);
        case 'conditional':
          return (
            inert(value.condition, available) &&
            inert(value.then, available) &&
            inert(value.otherwise, available)
          );
        case 'call': {
          const fn = resolve(value.callee);
          return (
            inert(value.callee, available) &&
            value.arguments.every((item) => inert(item, available)) &&
            !!fn &&
            inertFunction(fn)
          );
        }
        case 'helper-call': {
          const binding = names.get(value.name),
            fn = binding && resolve(binding.value);
          return (
            !!binding &&
            available.has(identity(binding)) &&
            value.arguments.every((item) => inert(item, available)) &&
            !!fn &&
            inertFunction(fn)
          );
        }
        default:
          return false;
      }
    }
    function inertBlock(body: readonly StatementIR[], outer: ReadonlySet<string>): boolean {
      const available = new Set(outer);
      for (const statement of body) {
        switch (statement.kind) {
          case 'const':
            if (!inert(statement.value, available)) return false;
            available.add(identity(statement));
            break;
          case 'effect':
            if (!inert(statement.expression, available)) return false;
            break;
          case 'return':
            return !statement.value || inert(statement.value, available);
          case 'if':
            if (
              !inert(statement.condition, available) ||
              !inertBlock(statement.then, available) ||
              !inertBlock(statement.otherwise, available)
            )
              return false;
            break;
          default:
            return false;
        }
      }
      return true;
    }
    let changed = false;
    function rewriteFunction(fn: FunctionIR): FunctionIR {
      const available = new Set(fn.parameters.map(identity));
      const body = rewriteBlock(fn.body, available);
      const parameters = fn.parameters.map((parameter) =>
        parameter.default ? { ...parameter, default: rewriteValue(parameter.default) } : parameter
      );
      const referenced = new Set<string>();
      function reads(value: unknown): void {
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value)) {
          value.forEach(reads);
          return;
        }
        const node = value as Record<string, unknown>;
        if (node.kind === 'reference' && typeof node.bindingId === 'string')
          referenced.add(node.bindingId);
        for (const [key, child] of Object.entries(node))
          if (!['type', 'span', 'captures', 'capture'].includes(key)) reads(child);
      }
      reads(body);
      parameters.forEach((parameter) => reads(parameter.default));
      return {
        ...fn,
        body,
        parameters,
        ...(fn.captures
          ? { captures: fn.captures.filter((capture) => referenced.has(capture.bindingId)) }
          : {}),
      };
    }
    function rewriteValue(value: ExpressionIR): ExpressionIR {
      if (value.kind === 'function') return { ...value, function: rewriteFunction(value.function) };
      function rewrite(child: unknown): unknown {
        if (!child || typeof child !== 'object') return child;
        if (Array.isArray(child)) return child.map(rewrite);
        const record = child as Record<string, unknown>;
        if (record.kind === 'function') return rewriteValue(child as ExpressionIR);
        return Object.fromEntries(
          Object.entries(record).map(([key, item]) => [
            key,
            ['type', 'span', 'captures', 'capture'].includes(key) ? item : rewrite(item),
          ])
        );
      }
      return rewrite(value) as ExpressionIR;
    }
    function rewriteBlock(body: readonly StatementIR[], outer: ReadonlySet<string>): StatementIR[] {
      const available = new Set(outer),
        result: StatementIR[] = [],
        retained = new Set<StatementIR>();
      for (const statement of body) {
        const previousLength = result.length;
        if (statement.kind === 'const') {
          if (
            !uses.has(identity(statement)) &&
            !uses.has(`name:${statement.name}`) &&
            inert(statement.value, available)
          )
            changed = true;
          else result.push({ ...statement, value: rewriteValue(statement.value) });
          available.add(identity(statement));
        } else if (statement.kind === 'effect') {
          if (inert(statement.expression, available)) changed = true;
          else result.push({ ...statement, expression: rewriteValue(statement.expression) });
        } else if (statement.kind === 'return')
          result.push({
            ...statement,
            ...(statement.value ? { value: rewriteValue(statement.value) } : {}),
          });
        else if (statement.kind === 'throw')
          result.push({ ...statement, value: rewriteValue(statement.value) });
        else if (statement.kind === 'if')
          result.push({
            ...statement,
            condition: rewriteValue(statement.condition),
            then: rewriteBlock(statement.then, available),
            otherwise: rewriteBlock(statement.otherwise, available),
          });
        else if (statement.kind === 'while')
          result.push({
            ...statement,
            condition: rewriteValue(statement.condition),
            body: rewriteBlock(statement.body, available),
          });
        else if (statement.kind === 'for-of') {
          const loop = new Set(available);
          loop.add(identity(statement));
          result.push({
            ...statement,
            iterable: rewriteValue(statement.iterable),
            body: rewriteBlock(statement.body, loop),
          });
        } else
          result.push({
            ...statement,
            body: rewriteBlock(statement.body, available),
            ...(statement.catch
              ? {
                  catch: {
                    ...statement.catch,
                    body: rewriteBlock(statement.catch.body, available),
                  },
                }
              : {}),
            ...(statement.finally ? { finally: rewriteBlock(statement.finally, available) } : {}),
          });
        if (result.length !== previousLength) retained.add(statement);
      }
      if (
        body.some(
          (statement) => statement.kind === 'const' && statement.declarationPosition !== undefined
        )
      ) {
        const logicalPositions = new Map(
          structuralStatementOrder(body)
            .filter((statement) => retained.has(statement))
            .map((statement, index) => [statement, index])
        );
        const original = body.filter((statement) => retained.has(statement));
        return result.map((statement, index) =>
          statement.kind === 'const' && statement.declarationPosition !== undefined
            ? { ...statement, declarationPosition: logicalPositions.get(original[index])! }
            : statement
        );
      }
      return result;
    }
    const next: PrototypeIR = {
      ...ir,
      moduleBindings: rewriteBlock(ir.moduleBindings ?? [], new Set()) as Binding[],
      setup: rewriteFunction(ir.setup),
      hooks: ir.hooks.map((hook) => ({
        ...hook,
        setup: rewriteFunction(hook.setup),
        ...(hook.projectHandle ? { projectHandle: rewriteFunction(hook.projectHandle) } : {}),
        ...(hook.configure ? { configure: rewriteFunction(hook.configure) } : {}),
      })),
    };
    if (!changed) break;
    ir = next;
  }
  cache.set(input, ir);
  cache.set(ir, ir);
  return ir;
}

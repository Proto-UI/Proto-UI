import { structuralStatementOrder } from './declaration-order';
import { reject, unknownDiagnosticSpan } from './diagnostics';
import type { AuthoredHookIR, ExpressionIR, FunctionIR, PrototypeIR, StatementIR } from './ir';
import { ordinaryValueChildren } from './value-children';

export const DEFAULT_SET_VALUE_EVENT = 'host:a11y-set-value';

/**
 * A checked declaration binds an owner-local numeric action route. A generic
 * host event, a global listener, or a type assertion does not supply this proof.
 * Keep this derivation shared by source parsing and independent IR validation.
 */
export function declaredSetValueEvent(args: readonly ExpressionIR[]): string | undefined {
  const key = args[0];
  if (key?.kind !== 'literal' || key.value !== 'setValue') return undefined;
  const spec = args[1];
  if (!spec || (spec.kind === 'literal' && spec.value === undefined))
    return DEFAULT_SET_VALUE_EVENT;
  if (spec.kind !== 'record') return undefined;
  const event = spec.entries.find((entry) => entry.key === 'event')?.value;
  if (!event) return DEFAULT_SET_VALUE_EVENT;
  return event.kind === 'literal' &&
    typeof event.value === 'string' &&
    event.value.startsWith('host:') &&
    event.value.length > 5
    ? event.value
    : undefined;
}

export type InputPayloadSchema = 'event' | 'host-event' | 'a11y-value-event';
type Registration = Extract<ExpressionIR, { kind: 'operation' }>;
type Declaration = Extract<StatementIR, { kind: 'const' }>;
type Scope = Map<string, Binding | undefined>;
interface Binding {
  declaration: Declaration;
  scope: Scope;
  module: boolean;
}
interface SchemaContext {
  routes: Set<string>;
  bindings: Set<Binding>;
  hooks: Set<AuthoredHookIR>;
  moduleScope: Scope;
}

/**
 * Derive registration schemas from the complete, unpruned definition graph.
 *
 * This follows structural source discovery, not runtime reachability: both
 * branches and newly created function bodies are checked, while a referenced
 * module helper or authored hook is expanded only at its first discovery.
 * Neither a claimed payload schema nor a diagnostic source span grants proof.
 * The IR boundary checks inert data before calling this pass and validates all
 * operation contracts afterwards; the shape checks here keep discovery closed.
 */
export function inferInputPayloadSchemas(
  input: PrototypeIR
): ReadonlyMap<Registration, InputPayloadSchema> {
  const schemas = new Map<Registration, InputPayloadSchema>();
  const malformed = (message: string): never =>
    reject('PUI2002', message, unknownDiagnosticSpan('<ir>'), 'invalid-ir');
  const record = <T extends object>(value: unknown): T => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      malformed('Input schema discovery requires IR records.');
    return value as T;
  };
  const array = <T>(value: unknown): readonly T[] => {
    if (!Array.isArray(value)) malformed('Input schema discovery requires IR arrays.');
    return value as T[];
  };
  const name = (value: unknown): string => {
    if (typeof value !== 'string' || !value.length)
      malformed('Input schema discovery requires named bindings.');
    return value as string;
  };

  const root = record<PrototypeIR>(input);
  const modules = array<Declaration>(root.moduleBindings ?? []);
  const hooks = new Map<string, AuthoredHookIR>();
  for (const item of array<AuthoredHookIR>(root.hooks)) {
    const hook = record<AuthoredHookIR>(item),
      id = name(hook.id);
    if (hooks.has(id)) malformed('Duplicate authored-hook identity.');
    hooks.set(id, hook);
  }

  function context(): SchemaContext {
    const moduleScope: Scope = new Map();
    for (const item of modules) {
      const declaration = record<Declaration>(item),
        key = name(declaration.name);
      if (declaration.kind !== 'const' || moduleScope.has(key))
        malformed('Invalid or duplicate module binding.');
      if (declaration.declarationPosition !== undefined)
        malformed('Module bindings cannot claim local declaration positions.');
      record<ExpressionIR>(declaration.value);
      moduleScope.set(key, { declaration, scope: moduleScope, module: true });
    }
    return { routes: new Set(), bindings: new Set(), hooks: new Set(), moduleScope };
  }

  function localFunction(value: ExpressionIR): boolean {
    return (
      value.kind === 'function' ||
      (value.kind === 'lexical-cell' && record<ExpressionIR>(value.value).kind === 'function')
    );
  }

  function expandBinding(binding: Binding, state: SchemaContext): void {
    if (state.bindings.has(binding)) return;
    state.bindings.add(binding);
    expression(binding.declaration.value, binding.scope, state);
  }

  function referencedBinding(
    value: { name: string; bindingId?: string },
    scope: Scope,
    state: SchemaContext
  ): void {
    // Parameters and every local declaration shadow module bindings, including
    // non-function values which cannot add a route by referencing a namesake.
    const binding = scope.get(name(value.name));
    if (!binding) return;
    if (value.bindingId !== undefined && value.bindingId !== binding.declaration.bindingId)
      malformed('Reference binding identity mismatch.');
    if (binding.module || localFunction(binding.declaration.value)) expandBinding(binding, state);
  }

  function fn(value: FunctionIR, outer: Scope, state: SchemaContext): void {
    const definition = record<FunctionIR>(value),
      scope = new Map(outer),
      parameters = array<FunctionIR['parameters'][number]>(definition.parameters);
    // All parameters already shadow outer names while defaults are parsed.
    for (const item of parameters) scope.set(name(record<typeof item>(item).name), undefined);
    for (const parameter of parameters)
      if (parameter.default !== undefined) expression(parameter.default, scope, state);
    statements(definition.body, scope, state);
  }

  function expandHook(hook: AuthoredHookIR, state: SchemaContext): void {
    if (state.hooks.has(hook)) return;
    state.hooks.add(hook);
    fn(hook.setup, state.moduleScope, state);
    if (hook.configure !== undefined) fn(hook.configure, state.moduleScope, state);
    if (hook.projectHandle !== undefined) fn(hook.projectHandle, state.moduleScope, state);
  }

  function statements(value: readonly StatementIR[], outer: Scope, state: SchemaContext): void {
    const body = array<StatementIR>(value),
      scope = new Map(outer);
    for (const item of body) {
      const statement = record<StatementIR>(item);
      if (statement.kind !== 'const') continue;
      record<ExpressionIR>(statement.value);
      scope.set(name(statement.name), { declaration: statement, scope, module: false });
    }
    for (const statement of structuralStatementOrder(body)) {
      switch (statement.kind) {
        case 'const': {
          const binding = scope.get(statement.name)!;
          // Pending local functions can be discovered from an earlier closure;
          // otherwise creation/declaration checks their body at this position.
          if (localFunction(statement.value)) expandBinding(binding, state);
          else expression(statement.value, scope, state);
          break;
        }
        case 'effect':
          expression(statement.expression, scope, state);
          break;
        case 'return':
          if (statement.value !== undefined) expression(statement.value, scope, state);
          break;
        case 'throw':
          expression(statement.value, scope, state);
          break;
        case 'if':
          expression(statement.condition, scope, state);
          statements(statement.then, scope, state);
          statements(statement.otherwise, scope, state);
          break;
        case 'try':
          statements(statement.body, scope, state);
          if (statement.catch !== undefined) {
            const caught = record<NonNullable<typeof statement.catch>>(statement.catch),
              catchScope = new Map(scope);
            if (caught.name !== undefined) catchScope.set(name(caught.name), undefined);
            statements(caught.body, catchScope, state);
          }
          if (statement.finally !== undefined) statements(statement.finally, scope, state);
          break;
        default:
          malformed('Unknown statement in input schema discovery.');
      }
    }
  }

  function expression(value: ExpressionIR, scope: Scope, state: SchemaContext): void {
    const node = record<ExpressionIR>(value);
    // Validate containers before using the common operand-order helper.
    if (node.kind === 'call' || node.kind === 'intrinsic') array(node.arguments);
    if (node.kind === 'object-spread')
      for (const part of array<Extract<ExpressionIR, { kind: 'object-spread' }>['parts'][number]>(
        node.parts
      ))
        record(part);
    const ordinary = ordinaryValueChildren(node);
    if (ordinary) {
      for (const child of ordinary) expression(child, scope, state);
      return;
    }
    switch (node.kind) {
      case 'literal':
      case 'undefined':
      case 'context-key':
      case 'static-capability':
      case 'style-handle':
        return;
      case 'reference':
        referencedBinding(node, scope, state);
        return;
      case 'lexical-cell':
        expression(node.value, scope, state);
        return;
      case 'lexical-read':
      case 'lexical-update':
        expression(node.cell, scope, state);
        return;
      case 'lexical-write':
        expression(node.cell, scope, state);
        expression(node.value, scope, state);
        return;
      case 'member':
        expression(node.object, scope, state);
        return;
      case 'unary':
        expression(node.operand, scope, state);
        return;
      case 'binary':
        expression(node.left, scope, state);
        expression(node.right, scope, state);
        return;
      case 'array':
        for (const child of array<ExpressionIR>(node.elements)) expression(child, scope, state);
        return;
      case 'record':
        for (const entry of array<Extract<ExpressionIR, { kind: 'record' }>['entries'][number]>(
          node.entries
        ))
          expression(record<typeof entry>(entry).value, scope, state);
        return;
      case 'rule':
        expression(node.receiver, scope, state);
        for (const entry of array<Extract<ExpressionIR, { kind: 'rule' }>['states'][number]>(
          node.states
        ))
          expression(record<typeof entry>(entry).value, scope, state);
        return;
      case 'function':
        fn(node.function, scope, state);
        return;
      case 'helper-call':
        // Module helpers are discovered after their argument expressions.
        for (const argument of array<ExpressionIR>(node.arguments))
          expression(argument, scope, state);
        referencedBinding(node, scope, state);
        return;
      case 'authored-hook': {
        const hook = hooks.get(name(node.hookId));
        if (!hook) malformed('Unknown authored hook in input schema discovery.');
        // Authored hooks discover setup/configure/projectHandle before options.
        expandHook(hook!, state);
        for (const argument of array<ExpressionIR>(node.arguments ?? []))
          expression(argument, scope, state);
        return;
      }
      case 'operation': {
        if (node.receiver !== undefined) expression(node.receiver, scope, state);
        const args = array<ExpressionIR>(node.arguments);
        if (args.length) expression(args[0], scope, state);
        if (node.operation === 'event.on' || node.operation === 'event.onGlobal') {
          const key = args[0];
          if (key?.kind !== 'literal' || typeof key.value !== 'string')
            malformed('Input registration requires a literal event key.');
          const event = (key as Extract<ExpressionIR, { kind: 'literal' }>).value as string;
          const schema: InputPayloadSchema =
            node.operation === 'event.on' && state.routes.has(event)
              ? 'a11y-value-event'
              : event.startsWith('host:')
                ? 'host-event'
                : 'event';
          const previous = schemas.get(node);
          if (previous !== undefined && previous !== schema)
            malformed('A shared input registration has inconsistent structural schemas.');
          schemas.set(node, schema);
        }
        // The current registration's schema precedes callback-body discovery.
        for (const argument of args.slice(1)) expression(argument, scope, state);
        if (node.operation === 'accessible.action') {
          const event = declaredSetValueEvent(args);
          if (event !== undefined) state.routes.add(event);
        }
        return;
      }
      default:
        malformed('Unknown expression in input schema discovery.');
    }
  }

  const reached = context();
  fn(root.setup, reached.moduleScope, reached);

  // Extra, unreferenced definitions remain independently checked. Each starts
  // without root or sibling routes and cannot grant proof to the root graph.
  for (const hook of hooks.values()) if (!reached.hooks.has(hook)) expandHook(hook, context());
  for (const binding of reached.moduleScope.values())
    if (binding && !reached.bindings.has(binding)) {
      const isolated = context();
      expandBinding(isolated.moduleScope.get(binding.declaration.name)!, isolated);
    }
  return schemas;
}

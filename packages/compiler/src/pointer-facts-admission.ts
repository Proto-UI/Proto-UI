import type { CompilerDiagnostic, ExpressionIR, FunctionIR, PrototypeIR, StatementIR } from './ir';

type Binding = { fn: FunctionIR; scope: Scope };
type Scope = Map<string, Binding | undefined>;

/** Call only after validateIR. Admission follows the target's actual emitted closure.
 * This narrow check does not promote native/SSR profiles or change their older operations.
 */
export function unsupportedPointerFacts(
  ir: PrototypeIR,
  target: string,
  closure: 'reached' | 'emitted-declarations' = 'reached'
): CompilerDiagnostic[] {
  const diagnostics: CompilerDiagnostic[] = [];
  const functions = new Set<FunctionIR>();
  const hooks = new Map(ir.hooks.map((hook) => [hook.id, hook]));
  function fn(value: FunctionIR, outer: Scope): void {
    if (functions.has(value)) return;
    functions.add(value);
    const scope = new Map(outer);
    for (const parameter of value.parameters) scope.set(parameter.name, undefined);
    statements(value.body, scope);
  }
  function expression(value: ExpressionIR, scope: Scope): void {
    if (
      (value.kind === 'member' &&
        value.object.type === 'event' &&
        ['pointerType', 'pointerButtons'].includes(value.property)) ||
      (value.kind === 'operation' &&
        value.operation === 'eventControl.requestDefaultActionPrevention')
    )
      diagnostics.push({
        code: 'PUI4003',
        category: 'unsupported-input',
        message: `Portable pointer facts / control-alias operations are not implemented by ${target}.`,
        span: value.span,
      });
    switch (value.kind) {
      case 'reference': {
        const binding = scope.get(value.name);
        if (binding) fn(binding.fn, binding.scope);
        return;
      }
      case 'function':
        fn(value.function, scope);
        return;
      case 'helper-call': {
        for (const argument of value.arguments) expression(argument, scope);
        const binding = scope.get(value.name);
        if (binding) fn(binding.fn, binding.scope);
        return;
      }
      case 'authored-hook': {
        const hook = hooks.get(value.hookId);
        if (hook) fn(hook.setup, new Map(moduleScope));
        return;
      }
      case 'member':
        expression(value.object, scope);
        return;
      case 'unary':
        expression(value.operand, scope);
        return;
      case 'lexical-cell':
        expression(value.value, scope);
        return;
      case 'lexical-read':
      case 'lexical-update':
        expression(value.cell, scope);
        return;
      case 'lexical-write':
        expression(value.cell, scope);
        expression(value.value, scope);
        return;
      case 'binary':
        expression(value.left, scope);
        expression(value.right, scope);
        return;
      case 'array':
        value.elements.forEach((element) => expression(element, scope));
        return;
      case 'record':
        value.entries.forEach((entry) => expression(entry.value, scope));
        return;
      case 'rule':
        expression(value.receiver, scope);
        value.states.forEach((state) => expression(state.value, scope));
        return;
      case 'operation':
        if (value.receiver) expression(value.receiver, scope);
        value.arguments.forEach((argument) => expression(argument, scope));
        return;
      default:
        return;
    }
  }
  function statements(body: readonly StatementIR[], scope: Scope): void {
    for (const statement of body) {
      switch (statement.kind) {
        case 'const': {
          if (statement.value.kind === 'function') {
            scope.set(statement.name, { fn: statement.value.function, scope: new Map(scope) });
            // Qt/Dart currently print these declarations even when not called.
            // Reject new unsupported members rather than emit an invalid getter.
            if (closure === 'emitted-declarations') fn(statement.value.function, scope);
          } else {
            const alias =
              statement.value.kind === 'reference' ? scope.get(statement.value.name) : undefined;
            if (!alias) expression(statement.value, scope);
            scope.set(statement.name, alias);
          }
          break;
        }
        case 'effect':
          expression(statement.expression, scope);
          break;
        case 'if':
          expression(statement.condition, scope);
          statements(statement.then, new Map(scope));
          statements(statement.otherwise, new Map(scope));
          break;
        case 'try':
          statements(statement.body, new Map(scope));
          if (statement.catch) statements(statement.catch.body, new Map(scope));
          if (statement.finally) statements(statement.finally, new Map(scope));
          break;
        case 'throw':
          expression(statement.value, scope);
          return;
        case 'return':
          if (statement.value) expression(statement.value, scope);
          return;
      }
    }
  }
  const moduleScope: Scope = new Map();
  statements(ir.moduleBindings ?? [], moduleScope);
  fn(ir.setup, moduleScope);
  if (closure === 'emitted-declarations') for (const hook of ir.hooks) fn(hook.setup, new Map(moduleScope));
  return diagnostics;
}

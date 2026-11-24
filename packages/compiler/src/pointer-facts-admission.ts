import { ordinaryValueChildren } from './value-children';
import { serializableDataType } from './value-types';
import {
  type CompilerDiagnostic,
  type ExpressionIR,
  type FunctionIR,
  type PrototypeIR,
  type StatementIR,
  type ValueType,
} from './ir';

type Binding = { fn: FunctionIR; scope: Scope };
type Scope = Map<string, Binding | undefined>;
type EmittedClosure = {
  statementsAfterTerminal?: boolean;
  hookMembers?: 'setup' | 'all';
};

/** Call only after validateIR. Admission follows the target's actual emitted closure.
 * This narrow check does not promote native/SSR profiles or change their older operations.
 */
export function unsupportedPointerFacts(
  ir: PrototypeIR,
  target: string,
  closure: 'reached' | 'emitted-declarations' = 'reached'
): CompilerDiagnostic[] {
  return unsupportedSourceExpressions(ir, target, closure, (value) =>
    (value.kind === 'member' &&
      value.object.type === 'event' &&
      ['pointerType', 'pointerButtons'].includes(value.property)) ||
    (value.kind === 'operation' &&
      value.operation === 'eventControl.requestDefaultActionPrevention')
      ? 'Portable pointer facts / control-alias operations'
      : undefined
  );
}

/** Numeric action payload fields require a host implementation, including at direct entries. */
export function unsupportedNumericAccessibility(
  ir: PrototypeIR,
  target: string,
  emitted: EmittedClosure = { hookMembers: 'setup' }
): CompilerDiagnostic[] {
  return unsupportedSourceExpressions(
    ir,
    target,
    'emitted-declarations',
    (value) =>
      value.kind === 'member' && value.object.type === 'a11y-value-event'
        ? 'Numeric accessibility action payloads'
        : undefined,
    undefined,
    emitted
  );
}

/** Checked Props declarations are finite literal records at every IR entry. */
export function hasPropsValidatorDeclaration(value: ExpressionIR): boolean {
  return (
    value.kind === 'operation' &&
    value.operation === 'props.define' &&
    value.arguments[0]?.kind === 'record' &&
    value.arguments[0].entries.some(
      (entry) =>
        entry.value.kind === 'record' &&
        entry.value.entries.some((field) => field.key === 'validator')
    )
  );
}

/** Direct native emitters must not retain a callback that their host ignores. */
export function unsupportedPropsValidators(ir: PrototypeIR, target: string): CompilerDiagnostic[] {
  return unsupportedSourceExpressions(
    ir,
    target,
    'emitted-declarations',
    (value) => (hasPropsValidatorDeclaration(value) ? 'Authored Props validators' : undefined),
    undefined,
    { hookMembers: 'setup' }
  );
}

/** A generated native ControlLabel host exists only for the four browser profiles. */
export function unsupportedControlLabel(
  ir: PrototypeIR,
  target: string,
  closure: 'reached' | 'emitted-declarations' = 'reached'
): CompilerDiagnostic[] {
  return unsupportedSourceExpressions(ir, target, closure, (value) =>
    value.kind === 'operation' &&
    (value.operation === 'hook.asControlLabel' ||
      value.operation.startsWith('controlLabel.') ||
      value.operation.startsWith('controlLabelRequest.'))
      ? 'ControlLabel operations'
      : undefined
  );
}

/** Server markup cannot claim an anatomy-derived ControlLabel pair before hydration. */
export function unsupportedControlLabelAnatomy(
  ir: PrototypeIR,
  target: string
): CompilerDiagnostic[] {
  return unsupportedSourceExpressions(ir, target, 'reached', (value) => {
    if (value.kind !== 'operation') return undefined;
    const pair =
      value.operation === 'controlLabel.label'
        ? value.arguments[0]
        : value.operation === 'controlLabel.target'
          ? value.arguments[1]
          : undefined;
    return pair && pair.kind !== 'undefined' ? 'ControlLabel anatomy pairing' : undefined;
  });
}

/** Direct Qt/Dart entry points must not discard new executable parameter semantics. */
export function unsupportedCheckedHelperParameters(
  ir: PrototypeIR,
  target: string,
  closure: 'reached' | 'emitted-declarations' = 'reached'
): CompilerDiagnostic[] {
  return unsupportedSourceExpressions(
    ir,
    target,
    closure,
    () => undefined,
    (value) =>
      value.parameters.some(
        (parameter) =>
          parameter.default ||
          (typeof parameter.type !== 'string' && parameter.type.kind === 'callable')
      )
        ? 'Checked callback parameters and per-call parameter defaults'
        : undefined
  );
}

/** Qt's direct experiment has no accepted implementation for these intrinsics. */
export function unsupportedJavaScriptIntrinsics(
  ir: PrototypeIR,
  target: string
): CompilerDiagnostic[] {
  return unsupportedSourceExpressions(ir, target, 'emitted-declarations', (value) =>
    value.kind === 'intrinsic' && (value.name === 'object.assign' || value.name === 'string')
      ? value.name === 'string'
        ? 'String coercion'
        : 'Object.assign intrinsics'
      : undefined
  );
}

/** Ordinary calls use native closures; the remaining structural additions do not. */
export function unsupportedDartOrdinaryValues(ir: PrototypeIR): CompilerDiagnostic[] {
  function supportedType(type: ValueType): boolean {
    if (typeof type === 'string' || serializableDataType(type) !== undefined) return true;
    if (type.kind === 'cell') return supportedType(type.value);
    if (type.kind === 'callable')
      return supportedType(type.returnType) && type.parameters.every((p) => supportedType(p.type));
    if (type.kind === 'value-union') return type.members.every(supportedType);
    // The Dart host supplies Object identity only; capture lookup and hook
    // projection/configuration require separate lowering below.
    if (type.kind === 'capture') return true;
    return false;
  }
  return unsupportedSourceExpressions(ir, 'flutter-source', 'emitted-declarations', (value) => {
    if (value.kind === 'intrinsic' && value.name === 'string') return 'String coercion';
    if (value.kind === 'intrinsic' && value.name === 'object.assign')
      return 'Object.assign intrinsics';
    if (value.kind === 'operation' && value.operation.startsWith('capture.'))
      return 'Authored hook capture lookup';
    if (
      value.kind === 'member' &&
      value.property === 'stateHandles' &&
      typeof value.object.type !== 'string' &&
      value.object.type.kind === 'capture'
    )
      return 'Authored hook named state capture';
    if (value.kind === 'authored-hook') {
      const hook = ir.hooks.find((entry) => entry.id === value.hookId);
      if (hook?.projectHandle) return 'Authored hook handle projection';
      if (hook?.configure || (hook?.mode && hook.mode !== 'once'))
        return 'Authored hook configuration and repeated installation';
      if (value.arguments?.length || (hook && hook.setup.parameters.length > 1))
        return 'Authored hook options and installation API';
    }
    return ['narrow', 'element', 'intrinsic', 'object-spread', 'member-write'].includes(
      value.kind
    ) || !supportedType(value.type)
      ? 'Ordinary callable / structural value expressions'
      : undefined;
  });
}

function unsupportedSourceExpressions(
  ir: PrototypeIR,
  target: string,
  closure: 'reached' | 'emitted-declarations',
  unsupported: (value: ExpressionIR) => string | undefined,
  unsupportedFunction: (value: FunctionIR) => string | undefined = () => undefined,
  emitted: EmittedClosure = {}
): CompilerDiagnostic[] {
  const diagnostics: CompilerDiagnostic[] = [];
  const functions = new Set<FunctionIR>();
  const hooks = new Map(ir.hooks.map((hook) => [hook.id, hook]));
  function fn(value: FunctionIR, outer: Scope): void {
    if (functions.has(value)) return;
    functions.add(value);
    const feature = unsupportedFunction(value);
    if (feature)
      diagnostics.push({
        code: 'PUI4003',
        category: 'unsupported-input',
        message: `${feature} are not implemented by ${target}.`,
        span: value.span,
      });
    const scope = new Map(outer);
    for (const parameter of value.parameters) {
      if (parameter.default) expression(parameter.default, scope);
      scope.set(parameter.name, undefined);
    }
    statements(value.body, scope);
  }
  function expression(value: ExpressionIR, scope: Scope): void {
    const feature = unsupported(value);
    if (feature)
      diagnostics.push({
        code: 'PUI4003',
        category: 'unsupported-input',
        message: `${feature} are not implemented by ${target}.`,
        span: value.span,
      });
    const ordinary = ordinaryValueChildren(value);
    if (ordinary) {
      ordinary.forEach((child) => expression(child, scope));
      return;
    }
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
        for (const argument of value.arguments ?? []) expression(argument, scope);
        const hook = hooks.get(value.hookId);
        if (hook) {
          fn(hook.setup, new Map(moduleScope));
          if (emitted.hookMembers !== 'setup') {
            if (hook.projectHandle) fn(hook.projectHandle, new Map(moduleScope));
            if (hook.configure) fn(hook.configure, new Map(moduleScope));
          }
        }
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
        value.styles?.forEach((style) => expression(style.value, scope));
        value.targets?.forEach((style) => expression(style.value, scope));
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
    // Bind the closed lexical graph before visiting bodies; initialization stays in source order.
    for (const statement of body)
      if (statement.kind === 'const' && statement.value.kind === 'function')
        scope.set(statement.name, { fn: statement.value.function, scope });
    for (const statement of body) {
      switch (statement.kind) {
        case 'const': {
          if (statement.value.kind === 'function') {
            scope.set(statement.name, { fn: statement.value.function, scope });
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
        case 'while':
          expression(statement.condition, scope);
          statements(statement.body, new Map(scope));
          break;
        case 'for-of': {
          expression(statement.iterable, scope);
          const loop = new Map(scope);
          loop.set(statement.name, undefined);
          statements(statement.body, loop);
          break;
        }
        case 'try':
          statements(statement.body, new Map(scope));
          if (statement.catch) statements(statement.catch.body, new Map(scope));
          if (statement.finally) statements(statement.finally, new Map(scope));
          break;
        case 'throw':
          expression(statement.value, scope);
          if (!emitted.statementsAfterTerminal) return;
          break;
        case 'return':
          if (statement.value) expression(statement.value, scope);
          if (!emitted.statementsAfterTerminal) return;
          break;
      }
    }
  }
  const moduleScope: Scope = new Map();
  statements(ir.moduleBindings ?? [], moduleScope);
  fn(ir.setup, moduleScope);
  if (closure === 'emitted-declarations')
    for (const hook of ir.hooks) {
      fn(hook.setup, new Map(moduleScope));
      if (emitted.hookMembers === 'all') {
        if (hook.projectHandle) fn(hook.projectHandle, new Map(moduleScope));
        if (hook.configure) fn(hook.configure, new Map(moduleScope));
      }
    }
  return diagnostics;
}

import { diagnostic, type CompilerDiagnostic } from '../diagnostics';
import type { ModuleIR, PrototypeIR, RuleExpr, StateDeclIR } from '../ir/types';

/** Kernel eligibility is separate from UI target eligibility and from source typechecking. */
export function getKernelLoweringDiagnostics(module: ModuleIR): CompilerDiagnostic[] {
  const issues: CompilerDiagnostic[] = [];
  for (const proto of module.prototypes) {
    const reject = (message: string) =>
      issues.push(diagnostic('PUI_KERNEL_UNSUPPORTED', 'llvm', message, proto.span));
    for (const gap of proto.unlowered ?? []) reject(gap.operation + ': ' + gap.message);
    if (
      proto.hooks.some((hook) => !hook.lowered) ||
      proto.contexts.length ||
      proto.exposes.length ||
      proto.lifecycle.length ||
      proto.propWatches?.length
    ) {
      reject(
        'The scalar kernel target cannot omit host hooks, context, exposed operations, lifecycle effects or property subscriptions.'
      );
    }
    if (proto.rules.length > 31)
      reject(
        'The current combined rule ABI has 31 bits; additional rules require a wider representation.'
      );
    const condition = (value: RuleExpr): void => {
      if (value.kind === 'not') return condition(value.expr);
      if (value.kind === 'all' || value.kind === 'any') {
        value.exprs.forEach(condition);
        return;
      }
      if (value.kind !== 'cmp') return;
      const declaration =
        value.source === 'prop'
          ? proto.props.find((prop) => prop.name === value.key)
          : value.source === 'state'
            ? proto.states.find((state) => state.name === value.key)
            : undefined;
      if (!declaration) {
        reject('Kernel rule references an unresolved input: ' + value.source + '.' + value.key);
        return;
      }
      const kind = declaration.kind;
      const type =
        kind === 'bool'
          ? 'boolean'
          : kind === 'enum'
            ? 'string'
            : kind.startsWith('number.')
              ? 'number'
              : kind;
      if (value.value === null || typeof value.value !== type)
        reject('Kernel comparison requires compatible non-null scalar inputs.');
      if (
        value.operator === 'gte' &&
        (type !== 'number' || typeof value.value !== 'number' || !Number.isFinite(value.value))
      )
        reject('Kernel gte requires a numeric input and a finite threshold.');
      if (value.source === 'prop') {
        const prop = proto.props.find((prop) => prop.name === value.key)!;
        if (
          prop.empty === 'accept' ||
          prop.defaultValue === undefined ||
          prop.defaultValue === null
        )
          reject('Nullable props require a tagged kernel representation.');
      }
    };
    for (const rule of proto.rules) {
      if (rule.dynamic) reject('Dynamic rule conditions have no scalar kernel lowering.');
      condition(rule.condition);
    }
    const validInitial = (state: StateDeclIR): boolean => {
      const value = state.initialValue;
      if (state.kind === 'bool') return typeof value === 'boolean';
      if (state.kind === 'enum' || state.kind === 'string')
        return (
          typeof value === 'string' &&
          (state.kind !== 'enum' || !!state.options?.length) &&
          (!state.options?.length || state.options.includes(value))
        );
      if (typeof value !== 'number' || Number.isNaN(value)) return false;
      if (state.options?.length) return state.options.includes(value);
      return (
        (state.min === undefined || value >= state.min) &&
        (state.max === undefined || value <= state.max) &&
        (state.step === undefined ||
          state.step <= 0 ||
          Number.isInteger((value - (state.min ?? 0)) / state.step))
      );
    };
    for (const state of proto.states)
      if (!validInitial(state))
        reject('Kernel state initializer requires domain normalization: ' + state.name);
    for (const event of proto.events) {
      const action = event.simpleAction;
      if (!action) {
        reject('The ordered event action body needs SSA control-flow lowering: ' + event.eventName);
        continue;
      }
      const state = proto.states.find((state) => state.name === action.stateName);
      if (!state) {
        reject('Kernel event references an undeclared state: ' + action.stateName);
        continue;
      }
      if (
        state.min !== undefined ||
        state.max !== undefined ||
        state.step !== undefined ||
        state.options?.length
      ) {
        reject('Kernel event writes require domain validation before storage: ' + state.name);
      }
      if (
        action.kind === 'increment-state' &&
        (state.ssaType !== 'f64' || !Number.isFinite(action.delta))
      )
        reject('Kernel increment requires a numeric state and a finite delta.');
      if (action.kind === 'toggle-state' && state.kind !== 'bool')
        reject('Kernel toggle requires a boolean state.');
      if (action.kind === 'set-state' && !validInitial({ ...state, initialValue: action.value }))
        reject('Kernel state assignment violates its scalar domain.');
    }
  }
  return issues;
}

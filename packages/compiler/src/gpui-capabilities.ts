import type { CompilerDiagnostic, ExpressionIR, Operation } from './ir';
import { interactionValueAlternatives } from './interaction-value-shape';
import type { NativeLexicalScope } from './template-shape';
import { valueAlternatives } from './value-types';
import { GPUI_PROFILE_SOURCE } from './gpui-dependency';

/** Native language atoms whose complete coercion/prototype boundary is known. */
export function gpuiIntrinsicSupported(
  value: Extract<ExpressionIR, { kind: 'intrinsic' }>
): boolean {
  if (value.name === 'string')
    return (
      !value.arguments.length ||
      valueAlternatives(value.arguments[0].type).every(
        (type) =>
          ['boolean', 'number', 'string', 'null', 'void'].includes(String(type)) ||
          (typeof type !== 'string' && type.kind === 'literal')
      )
    );
  if (value.name === 'object.assign')
    return (
      value.arguments.length > 0 && value.arguments.every((argument) => argument.kind === 'record')
    );
  return true;
}

/** These operations need physical discovery, not just an already-known focus handle. */
export const GPUI_UNAVAILABLE_OPERATIONS: ReadonlySet<Operation> = new Set([
  'hook.asFocusEntry',
  'focusEntry.configure',
  'focusEntry.focus',
  'focusEntry.setDisabled',
]);
export const GPUI_MISSING_FOCUS_TREE = `The published GPUI revision ${GPUI_PROFILE_SOURCE.revision} does not provide Window::resolve_focus_entry, focus_tree_generation or observe_focus_tree. Physical FocusEntry requires a separately verified SDK with that API; no focus-moving probe or logical-only fallback is emitted.`;

/** Scope's logical navigation remains available; its optional physical fallback does not. */
export function gpuiScopeCapabilityDiagnostic(
  value: ExpressionIR,
  scope: NativeLexicalScope
): CompilerDiagnostic | undefined {
  if (value.kind !== 'operation' || value.operation !== 'focusScope.configure') return;
  const config = value.arguments[0];
  if (!config) return;
  const records = interactionValueAlternatives(config, scope);
  const mayUseEntry =
    !records ||
    records.some((alternative) => {
      if (alternative.value?.kind !== 'record') return true;
      const entry = alternative.value.entries.find((entry) => entry.key === 'entryFallback');
      if (!entry) return false;
      const choices = interactionValueAlternatives(entry.value, alternative.scope);
      return (
        !choices ||
        choices.some(
          (choice) =>
            choice.value?.kind !== 'undefined' &&
            !(choice.value?.kind === 'literal' && choice.value.value !== 'entry')
        )
      );
    });
  if (mayUseEntry)
    return {
      code: 'PUI_GPUI_SDK_CAPABILITY',
      category: 'unsupported-input',
      message: `focusScope.configure entryFallback must be proven not to request physical entry. ${GPUI_MISSING_FOCUS_TREE}`,
      span: value.span,
    };
}

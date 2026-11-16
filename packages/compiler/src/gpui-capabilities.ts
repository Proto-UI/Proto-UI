import type { CompilerDiagnostic, ExpressionIR, Operation } from './ir';
import { interactionValueAlternatives } from './interaction-value-shape';
import type { NativeLexicalScope } from './template-shape';

/** These operations need physical discovery, not just an already-known focus handle. */
export const GPUI_UNAVAILABLE_OPERATIONS: ReadonlySet<Operation> = new Set([
  'hook.asFocusEntry',
  'focusEntry.configure',
  'focusEntry.focus',
  'focusEntry.setDisabled',
]);
export const GPUI_MISSING_FOCUS_TREE =
  'The published GPUI revision 62e5991dd0f0c8a3af8d5e7e9c4652490d468db8 does not provide Window::resolve_focus_entry, focus_tree_generation or observe_focus_tree. Physical FocusEntry requires a separately verified SDK with that API; no focus-moving probe or logical-only fallback is emitted.';

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

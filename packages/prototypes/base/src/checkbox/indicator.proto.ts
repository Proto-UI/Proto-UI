import { asAccessible } from '@proto.ui/hooks';
import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { CHECKBOX_CONTEXT, CHECKBOX_FAMILY, type CheckboxContextValue } from './shared';
import type {
  CheckboxIndicatorAsHookContract,
  CheckboxIndicatorExposes,
  CheckboxIndicatorProps,
} from './types';

function setupCheckboxIndicator(
  def: DefHandle<CheckboxIndicatorProps, CheckboxIndicatorExposes>
): void {
  // P-BASE-CHECKBOX-INDICATOR-ROLE-INDICATOR, P-BASE-CHECKBOX-INDICATOR-PROTOCOL-DEPENDENCY
  // P-BASE-CHECKBOX-INDICATOR-CLAIM-ROLE, P-BASE-CHECKBOX-INDICATOR-SAME-DOMAIN
  def.anatomy.claim(CHECKBOX_FAMILY, { role: 'indicator' });
  // P-BASE-CHECKBOX-INDICATOR-DERIVED-CHECKED
  const checked = def.state.bool('checked', false);
  // P-BASE-CHECKBOX-INDICATOR-DERIVED-INDETERMINATE
  const indeterminate = def.state.bool('indeterminate', false);
  // P-BASE-CHECKBOX-INDICATOR-DERIVED-DISABLED
  const disabled = def.state.bool('disabled', false);

  const syncContext = (next: CheckboxContextValue) => {
    checked.set(!!next.checked, 'reason: checkbox indicator context checked sync');
    indeterminate.set(
      !!next.indeterminate,
      'reason: checkbox indicator context indeterminate sync'
    );
    disabled.set(!!next.disabled, 'reason: checkbox indicator context disabled sync');
  };

  def.expose.state('checked', checked);
  def.expose.state('indeterminate', indeterminate);

  def.expose.method('isChecked', () => {
    return checked.get();
  });

  def.expose.method('isIndeterminate', () => {
    return indeterminate.get();
  });

  // P-BASE-CHECKBOX-INDICATOR-CONTEXT-SUBSCRIBE, P-BASE-CHECKBOX-INDICATOR-CONTEXT-REQUIRED
  // P-BASE-CHECKBOX-INDICATOR-DERIVED-CHECKED, P-BASE-CHECKBOX-INDICATOR-DERIVED-INDETERMINATE
  def.context.subscribe(CHECKBOX_CONTEXT, (_run, next) => {
    syncContext(next);
  });

  def.lifecycle.onMounted((run) => {
    syncContext(run.context.read(CHECKBOX_CONTEXT));
  });

  def.lifecycle.onUpdated((run) => {
    syncContext(run.context.read(CHECKBOX_CONTEXT));
  });
}

/*
 * P-BASE-CHECKBOX / P-BASE-CHECKBOX-INDICATOR criteria outside Checkbox-indicator-internal prototype syntax:
 * - P-BASE-CHECKBOX-INDICATOR-NO-VALUE-OWNER: absence of checked props and checkedChange is the implementation.
 * - P-BASE-CHECKBOX-INDICATOR-NO-INDETERMINATE-OWNER: indeterminate is only derived from Checkbox context.
 * - P-BASE-CHECKBOX-INDICATOR-NO-EVENT-TARGET: absence of def.event usage is the implementation.
 * - P-BASE-CHECKBOX-INDICATOR-NO-FOCUS-TARGET: absence of asFocusable/focusSelf is the implementation.
 * - P-BASE-CHECKBOX-INDICATOR-PRESENTATIONAL-A11Y: absence of asAccessible() control syntax is the implementation.
 * - P-BASE-CHECKBOX-INDICATOR-NO-FORM-INTEGRATION: no form-associated props are accepted.
 * - P-BASE-CHECKBOX-INDICATOR-NO-VISUAL-VARIANT-CORE: visual parameters are owned by downstream styled prototypes.
 */

// P-BASE-CHECKBOX-INDICATOR-AUTHORING-ENTRIES
export const asCheckboxIndicator = defineAsHook<
  CheckboxIndicatorProps,
  CheckboxIndicatorExposes,
  CheckboxIndicatorAsHookContract
>({
  name: 'as-checkbox-indicator',
  setup: setupCheckboxIndicator,
});

const checkboxIndicator = definePrototype({
  name: 'base-checkbox-indicator',
  setup: setupCheckboxIndicator,
});

export default checkboxIndicator;

import { asAccessible } from '@proto.ui/hooks';
import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { SWITCH_CONTEXT, SWITCH_FAMILY, type SwitchContextValue } from './shared';
import type { SwitchThumbAsHookContract, SwitchThumbExposes, SwitchThumbProps } from './types';

function setupSwitchThumb(def: DefHandle<SwitchThumbProps, SwitchThumbExposes>): void {
  // P-BASE-SWITCH-THUMB-ROLE-INDICATOR, P-BASE-SWITCH-THUMB-PROTOCOL-DEPENDENCY
  // P-BASE-SWITCH-THUMB-CLAIM-ROLE, P-BASE-SWITCH-THUMB-SAME-DOMAIN
  // P-BASE-SWITCH-THUMB-INDICATOR
  def.anatomy.claim(SWITCH_FAMILY, { role: 'thumb' });
  // P-BASE-SWITCH-THUMB-DERIVED-CHECKED
  const checked = def.state.bool('checked', false);
  // P-BASE-SWITCH-THUMB-DERIVED-DISABLED
  const disabled = def.state.bool('disabled', false);

  def.expose.state('checked', checked);

  def.expose.method('isChecked', () => {
    return checked.get();
  });

  const syncContext = (next: SwitchContextValue) => {
    checked.set(!!next.checked, 'reason: switch thumb context checked sync');
    disabled.set(!!next.disabled, 'reason: switch thumb context disabled sync');
  };

  // P-BASE-SWITCH-THUMB-CONTEXT-SUBSCRIBE, P-BASE-SWITCH-THUMB-CONTEXT-REQUIRED
  // P-BASE-SWITCH-THUMB-DERIVED-CHECKED, P-BASE-SWITCH-THUMB-DERIVED-DISABLED
  def.context.subscribe(SWITCH_CONTEXT, (_run, next) => {
    syncContext(next);
  });

  def.lifecycle.onMounted((run) => {
    syncContext(run.context.read(SWITCH_CONTEXT));
  });

  def.lifecycle.onUpdated((run) => {
    syncContext(run.context.read(SWITCH_CONTEXT));
  });
}

/*
 * P-BASE-SWITCH / P-BASE-SWITCH-THUMB criteria outside Switch-thumb-internal prototype syntax:
 * - P-BASE-SWITCH-THUMB-NO-VALUE-OWNER: absence of props and checkedChange is the implementation.
 * - P-BASE-SWITCH-THUMB-NO-EVENT-TARGET, P-BASE-SWITCH-THUMB-NOT-TARGET: absence of def.event usage is the implementation.
 * - P-BASE-SWITCH-THUMB-NO-FOCUS-TARGET: absence of asFocusable/focusSelf is the implementation.
 * - P-BASE-SWITCH-THUMB-PRESENTATIONAL-A11Y: absence of asAccessible() control syntax is the implementation.
 * - P-BASE-SWITCH-THUMB-NO-FORM-INTEGRATION: no form-associated props are accepted.
 * - P-BASE-SWITCH-THUMB-NO-VISUAL-VARIANT-CORE: visual parameters are owned by downstream styled prototypes.
 */

// P-BASE-SWITCH-THUMB-AUTHORING-ENTRIES
export const asSwitchThumb = defineAsHook<
  SwitchThumbProps,
  SwitchThumbExposes,
  SwitchThumbAsHookContract
>({
  name: 'as-switch-thumb',
  setup: setupSwitchThumb,
});

const switchThumb = definePrototype({
  name: 'base-switch-thumb',
  setup: setupSwitchThumb,
});

export default switchThumb;

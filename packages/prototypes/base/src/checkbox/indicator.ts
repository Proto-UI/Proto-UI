import {
  defineAsHook,
  definePrototype,
  type AnatomyPartView,
  type DefHandle,
  type RunHandle,
} from '@proto.ui/core';
import { CHECKBOX_CONTEXT, CHECKBOX_FAMILY } from './shared';
import type {
  CheckboxIndicatorAsHookContract,
  CheckboxIndicatorExposes,
  CheckboxIndicatorProps,
} from './types';

function setupCheckboxIndicator(
  def: DefHandle<CheckboxIndicatorProps, CheckboxIndicatorExposes>
): void {
  def.anatomy.claim(CHECKBOX_FAMILY, { role: 'indicator' });
  const checked = def.state.fromAccessibility('checked');
  const indeterminate = def.state.bool('indeterminate', false);

  def.context.subscribe(CHECKBOX_CONTEXT, (_run, next) => {
    checked.set(!!next.checked, 'reason: checkbox indicator context checked sync');
    indeterminate.set(
      !!next.indeterminate,
      'reason: checkbox indicator context indeterminate sync'
    );
  });

  let rootPart: AnatomyPartView | null = null;

  def.expose.state('checked', checked);
  def.expose.state('indeterminate', indeterminate);

  def.expose.method('isChecked', () => {
    const rootChecked = rootPart?.getExpose('checked') as { get?: () => boolean } | null;
    if (!rootChecked || typeof rootChecked.get !== 'function') return null;
    return rootChecked.get();
  });

  def.expose.method('isIndeterminate', () => {
    const rootIndeterminate = rootPart?.getExpose('indeterminate') as {
      get?: () => boolean;
    } | null;
    if (!rootIndeterminate || typeof rootIndeterminate.get !== 'function') return null;
    return rootIndeterminate.get();
  });

  const syncRoot = (run: RunHandle<CheckboxIndicatorProps>) => {
    rootPart = run.anatomy.partsOf(CHECKBOX_FAMILY, 'root')[0] ?? null;
    const ctx = run.context.read(CHECKBOX_CONTEXT);

    checked.set(!!ctx.checked, 'reason: checkbox indicator sync => checked');
    indeterminate.set(!!ctx.indeterminate, 'reason: checkbox indicator sync => indeterminate');
  };

  def.lifecycle.onMounted((run) => {
    syncRoot(run);
  });

  def.lifecycle.onUpdated((run) => {
    syncRoot(run);
  });

  def.lifecycle.onUnmounted(() => {
    rootPart = null;
  });
}

export const asCheckboxIndicator = defineAsHook<
  CheckboxIndicatorProps,
  CheckboxIndicatorExposes,
  CheckboxIndicatorAsHookContract
>({
  name: 'as-checkbox-indicator',
  mode: 'once',
  setup: setupCheckboxIndicator,
});

const checkboxIndicator = definePrototype({
  name: 'base-checkbox-indicator',
  setup: setupCheckboxIndicator,
});

export default checkboxIndicator;

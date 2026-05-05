import {
  defineAsHook,
  definePrototype,
  type AnatomyPartView,
  type DefHandle,
  type RunHandle,
} from '@proto.ui/core';
import { CHECKBOX_FAMILY } from './shared';
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

  let rootPart: AnatomyPartView | null = null;
  let rootCheckedOff: (() => void) | null = null;
  let rootIndeterminateOff: (() => void) | null = null;

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
    rootCheckedOff?.();
    rootCheckedOff = null;
    rootIndeterminateOff?.();
    rootIndeterminateOff = null;

    rootPart = run.anatomy.partsOf(CHECKBOX_FAMILY, 'root')[0] ?? null;

    const rootChecked = rootPart?.getExpose('checked') as {
      get?: () => boolean;
      subscribe?: (cb: (e: { next: boolean }) => void) => () => void;
      unsubscribe?: (off: () => void) => void;
    } | null;
    checked.set(!!rootChecked?.get?.(), 'reason: checkbox indicator sync => checked');
    if (rootChecked && typeof rootChecked.subscribe === 'function') {
      const off = rootChecked.subscribe((e) => {
        checked.set(!!e.next, 'reason: checkbox indicator root checked subscription');
      });
      rootCheckedOff = () => {
        if (typeof rootChecked.unsubscribe === 'function') {
          rootChecked.unsubscribe(off);
          return;
        }
        off();
      };
    }

    const rootIndeterminate = rootPart?.getExpose('indeterminate') as {
      get?: () => boolean;
      subscribe?: (cb: (e: { next: boolean }) => void) => () => void;
      unsubscribe?: (off: () => void) => void;
    } | null;
    indeterminate.set(
      !!rootIndeterminate?.get?.(),
      'reason: checkbox indicator sync => indeterminate'
    );
    if (rootIndeterminate && typeof rootIndeterminate.subscribe === 'function') {
      const off = rootIndeterminate.subscribe((e) => {
        indeterminate.set(!!e.next, 'reason: checkbox indicator root indeterminate subscription');
      });
      rootIndeterminateOff = () => {
        if (typeof rootIndeterminate.unsubscribe === 'function') {
          rootIndeterminate.unsubscribe(off);
          return;
        }
        off();
      };
    }
  };

  def.lifecycle.onMounted((run) => {
    syncRoot(run);
  });

  def.lifecycle.onUpdated((run) => {
    syncRoot(run);
  });

  def.lifecycle.onUnmounted(() => {
    rootCheckedOff?.();
    rootCheckedOff = null;
    rootIndeterminateOff?.();
    rootIndeterminateOff = null;
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

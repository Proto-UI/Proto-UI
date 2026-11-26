import {
  delay,
  type DelayTask,
  type DefHandle,
  type BorrowedStateHandle,
  type RendererHandle,
} from '@proto.ui/core';
import type {
  CheckboxIndicatorProps,
  CheckboxIndicatorExposes,
} from '@proto.ui/prototypes-base/checkbox';

// Shared paint only. The 16-unit viewport holds centered 9×8 and 6×2
// round-stroke bounds derived from the @2x HIG illustrations.
export function renderCheckboxGlyph(r: RendererHandle<any>, checked: boolean, mixed: boolean) {
  const path = mixed ? 'M6 8h4' : checked ? 'M4.5 8 7 11 11.5 5' : null;
  if (!path) return null;
  return r.svg.root(
    {
      viewBox: '0 0 16 16',
      width: 16,
      height: 16,
      'aria-hidden': 'true',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    },
    r.svg.path({ d: path })
  );
}

export function checkboxGlyph(
  def: DefHandle<CheckboxIndicatorProps, CheckboxIndicatorExposes>,
  state: {
    checked: BorrowedStateHandle<boolean, CheckboxIndicatorProps>;
    indeterminate: BorrowedStateHandle<boolean, CheckboxIndicatorProps>;
  }
) {
  let refresh: DelayTask | null = null;
  const update = (run: { update(): void }, event: { type: string }) => {
    if (event.type !== 'next') return;
    refresh?.cancel();
    refresh = delay(0, () => {
      refresh = null;
      run.update();
    });
  };
  state.checked.watch(update);
  state.indeterminate.watch(update);
  const cancelRefresh = () => {
    refresh?.cancel();
    refresh = null;
  };
  def.lifecycle.onUnmounted(cancelRefresh);
  def.lifecycle.onBeforeDispose(cancelRefresh);
  return (r: RendererHandle<any>) =>
    renderCheckboxGlyph(r, state.checked.get(), state.indeterminate.get());
}

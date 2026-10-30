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

// Passive glyph grammar for the standalone Checkbox Indicator. Checked and
// mixed remain solely the Root's states; this helper owns no interaction,
// context, focus, naming or accessibility surface. The same check/minus marks
// the shared Checkbox-Group glyph grammar already renders; no separate Apple
// symbol is claimed.
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
  return (r: RendererHandle<any>) => {
    const path = state.indeterminate.get()
      ? 'M5 12h14'
      : state.checked.get()
        ? 'm20 6-11 11-5-5'
        : null;
    if (!path) return null;
    return r.svg.root(
      {
        viewBox: '0 0 24 24',
        width: '100%',
        height: '100%',
        // The Root already carries the checkbox role and its checked/mixed
        // states; this glyph would only add an unnamed node.
        'aria-hidden': 'true',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
      r.svg.path({ d: path })
    );
  };
}

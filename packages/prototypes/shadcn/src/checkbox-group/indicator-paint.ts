import {
  delay,
  type DelayTask,
  type DefHandle,
  type BorrowedStateHandle,
  type RendererHandle,
} from '@proto.ui/core';
import type {
  CheckboxGroupItemProps,
  CheckboxGroupItemExposes,
} from '@proto.ui/prototypes-base/checkbox-group';
// Passive glyph grammar from ../checkbox/indicator.proto.ts.
// No interaction/context/focus owner; checked and mixed remain solely the Group's state.
export function checkboxGroupGlyph(
  def: DefHandle<CheckboxGroupItemProps, CheckboxGroupItemExposes>,
  state: {
    checked: BorrowedStateHandle<boolean, CheckboxGroupItemProps>;
    indeterminate: BorrowedStateHandle<boolean, CheckboxGroupItemProps>;
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
  def.lifecycle.onUnmounted(() => {
    refresh?.cancel();
    refresh = null;
  });
  return (r: RendererHandle<any>) => {
    const path = state.indeterminate.get()
      ? 'M5 12h14'
      : state.checked.get()
        ? 'm20 6-11 11-5-5'
        : null;
    return r.svg.root(
      {
        viewBox: '0 0 24 24',
        width: 16,
        height: 16,
        'aria-hidden': 'true',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
      [
        r.svg.rect({ x: 1, y: 1, width: 22, height: 22, rx: 4 }),
        path ? r.svg.path({ d: path }) : null,
      ]
    );
  };
}

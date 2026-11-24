import {
  delay,
  tw,
  type DelayTask,
  type DefHandle,
  type ObservedStateHandle,
  type RendererHandle,
} from '@proto.ui/core';
import type {
  CheckboxGroupItemProps,
  CheckboxGroupItemExposes,
} from '@proto.ui/prototypes-base/checkbox-group';
import { BRUTALIST_FOCUS_TOKENS } from '../style';
// Passive glyph grammar from ../checkbox/indicator.proto.ts.
// No interaction/context/focus owner; checked and mixed remain solely the Group's state.
// The passive template box owns the visible skin, not the entire label's hit target.
// C-TEMPLATE-0002/0003 allow style-only structural nodes; no host selector or new part is added.
export function checkboxGroupGlyph(
  def: DefHandle<CheckboxGroupItemProps, CheckboxGroupItemExposes>,
  state: {
    checked: ObservedStateHandle<boolean, any>;
    indeterminate: ObservedStateHandle<boolean, any>;
    focusVisible: ObservedStateHandle<boolean, any>;
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
  state.focusVisible.watch(update);
  const cancel = () => {
    refresh?.cancel();
    refresh = null;
  };
  def.lifecycle.onUnmounted(cancel);
  def.lifecycle.onBeforeDispose(cancel);
  return (r: RendererHandle<any>) => {
    const path = state.indeterminate.get()
      ? 'M5 12h14'
      : state.checked.get()
        ? 'm20 6-11 11-5-5'
        : null;
    const boxStyle = tw(
      'pointer-events-none inline-flex size-5 shrink-0 items-center justify-center rounded-none border-2 border-border transition-none',
      path ? 'bg-main text-main-foreground' : 'bg-transparent text-foreground',
      state.focusVisible.get() ? BRUTALIST_FOCUS_TOKENS : ''
    );
    return r.el(
      'span',
      { style: boxStyle },
      r.svg.root(
        {
          viewBox: '0 0 24 24',
          width: 16,
          height: 16,
          'aria-hidden': 'true',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 3,
          strokeLinecap: 'square',
          strokeLinejoin: 'miter',
        },
        path ? r.svg.path({ d: path }) : null
      )
    );
  };
}

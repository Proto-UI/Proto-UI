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
import { COMMAND_FOCUS } from '../interactive-surface';
// Passive glyph grammar aligned with ../checkbox/root.proto.ts; the standalone
// Liquid Checkbox is a separate owner and is not composed for this Group's paint.
// No interaction/context/focus owner; checked and mixed remain solely the Group's state.
export function checkboxGroupGlyph(
  def: DefHandle<CheckboxGroupItemProps, CheckboxGroupItemExposes>,
  state: {
    checked: ObservedStateHandle<boolean, any>;
    indeterminate: ObservedStateHandle<boolean, any>;
    disabled: ObservedStateHandle<boolean, any>;
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
  state.disabled.watch(update);
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
    const isDisabled = state.disabled.get();
    const fillTokens = isDisabled
      ? 'border-border bg-muted text-muted-foreground shadow-none'
      : path
        ? 'border-primary bg-primary text-primary-foreground'
        : 'border-border bg-background text-foreground';
    const boxStyle = tw(
      'pointer-events-none inline-flex size-5 shrink-0 items-center justify-center rounded-[6px] border shadow-sm transition-shadow',
      fillTokens,
      state.focusVisible.get() ? COMMAND_FOCUS : ''
    );
    return r.el(
      'span',
      { style: boxStyle },
      r.svg.root(
        {
          viewBox: '0 0 24 24',
          width: 14,
          height: 14,
          'aria-hidden': 'true',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2.25,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        },
        path ? r.svg.path({ d: path }) : null
      )
    );
  };
}

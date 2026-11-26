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
import { renderCheckboxGlyph } from '../checkbox/indicator-paint';
import { COMMAND_FOCUS } from '../interactive-surface';

// The Group owns these row state reads and its box paint.
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
    const mixed = state.indeterminate.get();
    const checked = state.checked.get();
    const isDisabled = state.disabled.get();
    const fillTokens = isDisabled
      ? 'border-border bg-muted text-muted-foreground shadow-none'
      : checked || mixed
        ? 'border-primary bg-primary text-primary-foreground'
        : 'border-border bg-background text-foreground';
    const boxStyle = tw(
      'pointer-events-none inline-flex size-5 shrink-0 items-center justify-center rounded-[6px] border shadow-sm transition-shadow',
      fillTokens,
      state.focusVisible.get() ? COMMAND_FOCUS : ''
    );
    return r.el('span', { style: boxStyle }, renderCheckboxGlyph(r, checked, mixed));
  };
}

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
      ? 'M5 12H19'
      : state.checked.get()
        ? 'M5 12L10 17L19 7'
        : null;
    const boxStyle = tw(
      'pointer-events-none inline-flex w-[20px] h-[20px] shrink-0 items-center justify-center rounded-[4px] border shadow-[inset_0_1px_1px_rgb(0_0_0/7.5%)]',
      path
        ? 'border-primary bg-[linear-gradient(#08c,#0077b3)] text-primary-foreground'
        : 'border-[#ccc] bg-white text-[#333]',
      state.focusVisible.get()
        ? 'outline-none ring-2 ring-ring ring-offset-2 ring-offset-background'
        : ''
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
          strokeWidth: 2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        },
        path ? r.svg.path({ d: path }) : null
      )
    );
  };
}

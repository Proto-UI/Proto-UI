import {
  tw,
  type AnatomyFamily,
  type BorrowedStateHandle,
  type DefHandle,
  type RendererHandle,
} from '@proto.ui/core';
import { SLIDER_FAMILY, type SliderPartProps } from '@proto.ui/prototypes-base/slider';

// Ordinary Template containers only (C-TEMPLATE-0002/0003): no owner, role,
// focus target, host selector, geometry read, event listener, or hidden control.
// The existing Part root remains the sole input/focus target.
export function refreshSliderPaint(
  def: DefHandle<SliderPartProps, any>,
  states: readonly BorrowedStateHandle<any, SliderPartProps>[],
  families: readonly AnatomyFamily[] = [SLIDER_FAMILY]
) {
  let disposing = false;
  let mounted = false;
  const roots = families.map(() => false);
  // Paint updates may invoke inherited onUpdated hooks. Stop requesting them
  // as soon as a required root lease ends, before descendants finish unmount.
  families.forEach((family, index) => {
    def.anatomy.subscribeParts(family, 'root', (_run, parts) => {
      roots[index] = parts.length === 1;
    });
  });
  def.lifecycle.onMounted((run) => {
    families.forEach((family, index) => {
      roots[index] = run.anatomy.partsOf(family, 'root').length === 1;
    });
    mounted = true;
  });
  def.lifecycle.onUnmounted(() => {
    mounted = false;
  });
  for (const state of states)
    state.watch((run, event) => {
      if (mounted && !disposing && roots.every(Boolean) && event.type === 'next') run.update();
    });
  def.lifecycle.onBeforeDispose(() => {
    disposing = true;
  });
}

export function sliderThumbPaint(
  def: DefHandle<SliderPartProps, any>,
  state: {
    disabled: BorrowedStateHandle<boolean, SliderPartProps>;
    hovered: BorrowedStateHandle<boolean, SliderPartProps>;
    pressed: BorrowedStateHandle<boolean, SliderPartProps>;
    focusVisible: BorrowedStateHandle<boolean, SliderPartProps>;
  },
  families: readonly AnatomyFamily[] = [SLIDER_FAMILY]
) {
  refreshSliderPaint(
    def,
    [state.disabled, state.hovered, state.pressed, state.focusVisible],
    families
  );
  return (r: RendererHandle<any>) =>
    r.el('div', {
      style:
        !state.disabled.get() && state.focusVisible.get()
          ? tw(
              'pointer-events-none block size-3 shrink-0 rounded-full border border-ring bg-white ring-ring/50 ring-3 forced-colors-focus-outline transition-[color,box-shadow] select-none'
            )
          : !state.disabled.get() && (state.hovered.get() || state.pressed.get())
            ? tw(
                'pointer-events-none block size-3 shrink-0 rounded-full border border-ring bg-white ring-ring/50 ring-3 transition-[color,box-shadow] select-none'
              )
            : tw(
                'pointer-events-none block size-3 shrink-0 rounded-full border border-ring bg-white ring-ring/50 transition-[color,box-shadow] select-none'
              ),
    });
}

import { definePrototype, delay, type RendererHandle, tw } from '@proto.ui/core';
import { asSelectItem } from '@proto.ui/prototypes-base/select';
import type { ShadcnSelectItemExposes, ShadcnSelectItemProps } from './types';

function renderCheck(renderer: Pick<RendererHandle<any>, 'svg' | 'el'>, selected: boolean) {
  return renderer.el(
    'span',
    {
      style: tw(
        'pointer-events-none absolute right-2 flex size-3.5 shrink-0 items-center justify-center'
      ),
    },
    selected
      ? renderer.svg.root(
          {
            viewBox: '0 0 24 24',
            width: 16,
            height: 16,
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          },
          renderer.svg.path({ d: 'm20 6-11 11-5-5' })
        )
      : null
  );
}

const selectItem = definePrototype<ShadcnSelectItemProps, ShadcnSelectItemExposes>({
  name: 'shadcn-select-item',
  setup(def) {
    // P-SHADCN-SELECT-ITEM-BASE-INHERITANCE,
    // P-SHADCN-SELECT-ITEM-CURRENT-BASE-DEVIATIONS
    const state = asSelectItem().stateHandles;
    if (!state) throw new Error('[shadcn-select-item] Select Item must project option states.');
    const { disabled, hovered, focused, focusVisible, pressed, active, selected } = state;

    // P-SHADCN-SELECT-ITEM-CURRENT-VISUAL-SURFACE
    def.feedback.style.use(
      tw(
        'relative flex w-full cursor-default items-center gap-2 rounded-sm pl-2 pr-8 py-1.5 text-sm outline-none select-none'
      )
    );
    // P-SHADCN-SELECT-ITEM-STATE-DRIVEN-STYLES
    def.rule({
      when: (w) =>
        w.any(
          w.state(active).eq(true),
          w.state(hovered).eq(true),
          w.state(focused).eq(true),
          w.state(focusVisible).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground')),
    });
    def.rule({
      when: (w) => w.state(pressed).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-accent/80')),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
    });

    let renderTask: { cancel(): void } | null = null;
    // P-SHADCN-SELECT-ITEM-SELECTED-INDICATOR
    selected.watch((run, event) => {
      if (event.type !== 'next') return;
      renderTask?.cancel();
      renderTask = delay(0, () => {
        renderTask = null;
        run.update();
      });
    });
    def.lifecycle.onUnmounted(() => {
      renderTask?.cancel();
      renderTask = null;
    });

    return (renderer) => [renderer.r.slot(), renderCheck(renderer, selected.get())];
  },
});

/** P-SHADCN-SELECT-ITEM-DIRECT-ENTRY; parity is bounded by P-SHADCN-SELECT-ITEM-COMPATIBILITY-SUBSET. */

export default selectItem;

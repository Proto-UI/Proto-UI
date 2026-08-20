import { definePrototype, delay, type RendererHandle, tw } from '@proto.ui/core';
import { asSelectItem } from '@proto.ui/prototypes-base/select';
import type { BrutalistSelectItemExposes, BrutalistSelectItemProps } from './types';

function renderCheck(renderer: Pick<RendererHandle<any>, 'svg' | 'el'>, selected: boolean) {
  return renderer.el(
    'span',
    { style: tw('pointer-events-none flex size-5 shrink-0 items-center justify-center') },
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

const selectItem = definePrototype<BrutalistSelectItemProps, BrutalistSelectItemExposes>({
  name: 'brutalist-select-item',
  setup(def) {
    // P-BRUTALIST-SELECT-ITEM-BASE-INHERITANCE: inherit Base Select Item option states (selected/active/hovered/focused/focusVisible/pressed/disabled) once.
    const state = asSelectItem().stateHandles;
    if (!state) throw new Error('[brutalist-select-item] Select Item must project option states.');
    const { disabled, hovered, focused, focusVisible, pressed, active, selected } = state;

    // P-BRUTALIST-SELECT-ITEM-VISUAL-GRAMMAR: resting mono full-width item surface (font-mono text-sm, rounded-none, gap-2).
    def.feedback.style.use(
      tw(
        'relative flex w-full cursor-default items-center justify-between gap-2 rounded-none px-2 py-1.5 font-mono text-sm outline-none select-none'
      )
    );
    // P-BRUTALIST-SELECT-ITEM-INTERACTION (active/hovered/focused/focusVisible/pressed → bg-main text-main-foreground; disabled → opacity-50 pointer-events-none) and SELECTED-PAIR-INVARIANT below.
    def.rule({
      when: (w) =>
        w.any(
          w.state(active).eq(true),
          w.state(hovered).eq(true),
          w.state(focused).eq(true),
          w.state(focusVisible).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-main text-main-foreground')),
    });
    def.rule({
      when: (w) => w.state(pressed).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-main text-main-foreground')),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
    });

    // P-BRUTALIST-SELECT-ITEM-SELECTED-PAIR-INVARIANT: selected → bg-main text-main-foreground.
    def.rule({
      when: (w) => w.state(selected).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-main text-main-foreground')),
    });

    let renderTask: { cancel(): void } | null = null;
    // P-BRUTALIST-SELECT-ITEM-SELECTED-INDICATOR
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

/** P-BRUTALIST-SELECT-ITEM-ENTRY; parity is bounded by P-BRUTALIST-SELECT-ITEM-SELECTED-INDICATOR. */

export default selectItem;

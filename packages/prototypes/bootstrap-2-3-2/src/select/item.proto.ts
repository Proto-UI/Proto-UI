import { definePrototype, tw, delay } from '@proto.ui/core';
import { asSelectItem } from '@proto.ui/prototypes-base/select';
import type { Bootstrap232SelectItemProps, Bootstrap232SelectItemExposes } from './types';

export default definePrototype<Bootstrap232SelectItemProps, Bootstrap232SelectItemExposes>({
  name: 'bootstrap-2-3-2-select-item',
  setup(def) {
    const state = asSelectItem().stateHandles;
    if (!state)
      throw new Error('[bootstrap-2-3-2-select-item] Required Base state handles are missing.');
    const { active, selected, hovered, focused, focusVisible, disabled } = state;
    def.feedback.style.use(
      tw(
        'relative flex min-w-0 w-full items-center justify-between gap-[8px] px-[20px] py-[3px] text-[14px] font-normal leading-[20px] text-[#333] whitespace-normal wrap-anywhere text-start cursor-pointer select-none outline-none'
      )
    );
    def.rule({
      when: (w) =>
        w.all(
          w.state(disabled).eq(false),
          w.any(
            w.state(selected).eq(true),
            w.state(active).eq(true),
            w.state(hovered).eq(true),
            w.state(focused).eq(true)
          )
        ),
      intent: (i) =>
        i.feedback.style.use(tw('bg-[linear-gradient(#08c,#0077b3)] text-primary-foreground')),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('forced-colors-focus-outline ring-2 ring-ring ring-inset')),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-[#999] cursor-default')),
    });
    // A trailing non-interactive indicator follows logical direction without
    // physical left/right offsets; changing selection retains the slotted label.
    let renderTask: { cancel(): void } | null = null;
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
    return (renderer) => [
      renderer.el(
        'span',
        { style: tw('min-w-0 flex-1 whitespace-normal wrap-anywhere') },
        renderer.r.slot()
      ),
      renderer.el(
        'span',
        {
          style: tw('pointer-events-none flex size-4 shrink-0 items-center justify-center'),
        },
        selected.get()
          ? renderer.svg.root(
              {
                viewBox: '0 0 24 24',
                'aria-hidden': 'true',
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
      ),
    ];
  },
});

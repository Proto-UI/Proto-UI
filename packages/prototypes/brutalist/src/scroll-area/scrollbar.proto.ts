import { definePrototype, tw } from '@proto.ui/core';
import { asScrollAreaScrollbar } from '@proto.ui/prototypes-base/scroll-area';
import type {
  BrutalistScrollAreaScrollbarExposes,
  BrutalistScrollAreaScrollbarProps,
} from './types';

export const BrutalistScrollAreaScrollbar = definePrototype<
  BrutalistScrollAreaScrollbarProps,
  BrutalistScrollAreaScrollbarExposes
>({
  name: 'brutalist-scroll-area-scrollbar',
  setup(def) {
    // Keep Base scrollbar semantics via as-hook; size from props for reliable CSS tokens.
    asScrollAreaScrollbar();
    def.props.watch(['orientation'], (run) => run.update());
    def.feedback.style.use(tw('flex select-none touch-none bg-lavender p-0.5'));
    def.rule({
      when: (w) => w.prop('orientation').eq('vertical'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'absolute right-0 top-0 h-[calc(100%_-_var(--proto-ui-scroll-track-end-inset,0px))] w-4 border-l-2 border-foreground'
          )
        ),
    });
    def.rule({
      when: (w) => w.prop('orientation').eq('horizontal'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'absolute bottom-0 left-0 h-4 w-[calc(100%_-_var(--proto-ui-scroll-track-end-inset,0px))] border-t-2 border-foreground'
          )
        ),
    });
    return (renderer) => [
      renderer.r.slot(),
      ...(renderer.read.props.get().orientation === 'horizontal'
        ? [
            renderer.el(
              'span',
              {
                style: tw(
                  'pointer-events-none absolute left-[100%] top-[-2px] w-[var(--proto-ui-scroll-track-end-inset,0px)] h-[calc(100%_+_2px)] overflow-hidden'
                ),
              },
              renderer.el('span', {
                style: tw('absolute inset-0 bg-lavender border-l-2 border-t-2 border-foreground'),
              })
            ),
          ]
        : []),
    ];
  },
});

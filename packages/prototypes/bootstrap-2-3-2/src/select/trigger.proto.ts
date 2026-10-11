import { definePrototype, tw } from '@proto.ui/core';
import { asSelectTrigger } from '@proto.ui/prototypes-base/select';
import type { Bootstrap232SelectTriggerProps, Bootstrap232SelectTriggerExposes } from './types';

export default definePrototype<Bootstrap232SelectTriggerProps, Bootstrap232SelectTriggerExposes>({
  name: 'bootstrap-2-3-2-select-trigger',
  setup(def) {
    const state = asSelectTrigger().stateHandles;
    if (!state)
      throw new Error('[bootstrap-2-3-2-select-trigger] Required Base state handles are missing.');
    const { hovered, pressed, focusVisible, disabled, placeholder } = state;
    // Bootstrap 2.3.2 button-dropdown presentation; Base owns combobox semantics.

    def.feedback.style.use(
      tw(
        'inline-flex min-w-0 max-w-full items-center justify-between gap-2 rounded-[4px] border border-border bg-[linear-gradient(#fff,#e6e6e6)] text-foreground px-3 py-1 text-sm font-normal leading-5 whitespace-normal text-start select-none cursor-pointer shadow-[inset_0_1px_0_rgb(255_255_255/20%),0_1px_2px_rgb(0_0_0/5%)]'
      )
    );
    def.rule({
      when: (w) => w.state(hovered).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-[#e6e6e6]')),
    });
    def.rule({
      when: (w) => w.state(pressed).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('bg-[#e6e6e6] shadow-[inset_0_2px_4px_rgb(0_0_0/15%),0_1px_2px_rgb(0_0_0/5%)]')
        ),
    });
    def.rule({
      when: (w) => w.state(placeholder).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-foreground')),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'outline-none forced-colors-focus-outline ring-2 ring-ring ring-offset-2 ring-offset-background'
          )
        ),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 pointer-events-none cursor-default')),
    });
    return (renderer) => [
      renderer.r.slot(),
      renderer.el(
        'span',
        { style: tw('pointer-events-none flex size-4 shrink-0 items-center justify-center') },
        renderer.svg.root(
          { viewBox: '0 0 24 24', width: 16, height: 16, fill: 'currentColor' },
          renderer.svg.path({ d: 'M7 10h10l-5 5z' })
        )
      ),
    ];
  },
});

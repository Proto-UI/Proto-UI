import { definePrototype, tw } from '@proto.ui/core';
import { asCollapsibleTrigger } from '@proto.ui/prototypes-base/collapsible';
import type { BrutalistCollapsibleTriggerProps, BrutalistCollapsibleTriggerExposes } from './types';

// P-BRUTALIST-COLLAPSIBLE-TRIGGER-BASE-INHERITANCE: Base is the only semantic owner.
// The pinned reference primitives are unstyled; these safe host defaults are a Proto UI delta.
const collapsibleTrigger = definePrototype<
  BrutalistCollapsibleTriggerProps,
  BrutalistCollapsibleTriggerExposes
>({
  name: 'brutalist-collapsible-trigger',
  modules: asCollapsibleTrigger.modules,
  setup(def) {
    const inherited = asCollapsibleTrigger();
    const state = inherited.stateHandles;
    def.props.define({
      variant: {
        type: 'enum',
        options: ['default', 'neutral', 'noShadow'],
        empty: 'fallback',
      },
    });
    def.props.setDefaults({ variant: 'default' });
    if (!state) throw new Error('[brutalist-collapsible-trigger] Missing Base state handles.');
    const { pressed, focusVisible, disabled } = state;

    // P-BRUTALIST-COLLAPSIBLE-TRIGGER-VISUAL-SAFETY: no fixed width/height or clipped long label.
    // Raised control: 4px hard shadow at rest; +4px,+4px press-only displacement (no hover shift).
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-main-foreground wrap-anywhere whitespace-break-spaces text-left cursor-pointer select-none inline-flex items-center justify-start gap-2 rounded-base border-2 border-border bg-main px-4 py-2 text-sm font-sans font-medium relative hit-envelope-translate-1'
      )
    );
    def.rule({
      when: (w) => w.meta('colorScheme').eq('dark'),
      intent: (i) => i.feedback.style.use(tw('border-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.meta('colorScheme').eq('dark')),
          w.not(w.prop('variant').eq('noShadow')),
          w.state(pressed).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('shadow-[4px_4px_0_0_#000]')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.meta('colorScheme').eq('dark'),
          w.not(w.prop('variant').eq('noShadow')),
          w.state(pressed).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('shadow-[4px_4px_0_0_var(--pui-foreground)]')),
    });
    def.rule({
      when: (w) => w.prop('variant').eq('neutral'),
      intent: (i) => i.feedback.style.use(tw('bg-secondary-background text-foreground')),
    });
    def.rule({
      when: (w) => w.prop('variant').eq('noShadow'),
      intent: (i) =>
        i.feedback.style.use(tw('bg-secondary-background text-foreground shadow-none')),
    });
    for (const variant of ['default', 'neutral'] as const) {
      def.rule({
        when: (w) => w.all(w.state(pressed).eq(true), w.prop('variant').eq(variant)),
        intent: (i) => i.feedback.style.use(tw('translate-x-1 translate-y-1 shadow-none')),
      });
    }
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
    return inherited.render;
  },
});

export default collapsibleTrigger;

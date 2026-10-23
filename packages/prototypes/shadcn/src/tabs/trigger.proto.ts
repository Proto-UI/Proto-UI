import { definePrototype, tw } from '@proto.ui/core';
import { asTabsTrigger } from '@proto.ui/prototypes-base/tabs';
import { setupTabsVisual, TAB_TRIGGER_COMMON, TAB_TRIGGER_RECIPES } from './visual';
import type { ShadcnTabsTriggerExposes, ShadcnTabsTriggerProps } from './types';
const tabsTrigger = definePrototype<ShadcnTabsTriggerProps, ShadcnTabsTriggerExposes>({
  name: 'shadcn-tabs-trigger',
  setup(def) {
    def.props.define({
      appearance: { type: 'enum', options: ['default', 'underline'], empty: 'fallback' },
    });
    def.props.setDefaults({ appearance: 'default' });
    const { disabled, hovered, focusVisible, selected } = asTabsTrigger().stateHandles!;
    const { style, orientation } = setupTabsVisual(def);
    def.rule({
      when: (w) => w.prop('appearance').eq('default'),
      intent: (i) => i.feedback.style.use(TAB_TRIGGER_COMMON),
    });
    // The existing physical outline-none utility is a transparent shorthand.
    // Withdraw it during visible focus so it cannot reset the focused 1px width.
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.not(w.state(focusVisible).eq(true))),
      intent: (i) => i.feedback.style.use(tw('outline-none')),
    });
    for (const id of ['new-york-v4', 'nova', 'rhea'] as const) {
      def.rule({
        when: (w) => w.all(w.prop('appearance').eq('default'), w.state(style).eq(id)),
        intent: (i) => i.feedback.style.use(TAB_TRIGGER_RECIPES[id]),
      });
    }
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.state(orientation).eq('vertical')),
      intent: (i) => i.feedback.style.use(tw('w-full justify-start')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(orientation).eq('vertical'),
          w.state(style).eq('rhea')
        ),
      intent: (i) => i.feedback.style.use(tw('px-3 py-0.5')),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.meta('colorScheme').eq('dark')),
      intent: (i) => i.feedback.style.use(tw('text-muted-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.state(hovered).eq(true)),
      intent: (i) => i.feedback.style.use(tw('text-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.state(focusVisible).eq(true)),
      intent: (i) => i.feedback.style.use(tw('ring-3 ring-ring/50 outline-1 outline-ring')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(focusVisible).eq(true),
          w.not(w.state(style).eq('rhea'))
        ),
      intent: (i) => i.feedback.style.use(tw('border-ring')),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.state(selected).eq(true)),
      intent: (i) => i.feedback.style.use(tw('bg-background text-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(selected).eq(true),
          w.not(w.state(style).eq('rhea'))
        ),
      intent: (i) => i.feedback.style.use(tw('shadow-sm')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(selected).eq(true),
          w.meta('colorScheme').eq('dark')
        ),
      intent: (i) => i.feedback.style.use(tw('bg-input/30 text-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(selected).eq(true),
          w.meta('colorScheme').eq('dark'),
          w.not(w.state(style).eq('rhea'))
        ),
      intent: (i) => i.feedback.style.use(tw('border-input')),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.state(disabled).eq(true)),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
    });
    def.rule({
      when: (w) => w.prop('appearance').eq('underline'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'relative inline-flex flex-none h-auto items-center justify-center gap-1 whitespace-nowrap rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 pt-1 pb-1 text-base font-medium text-muted-foreground shadow-none select-none outline-none'
          )
        ),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('underline'), w.state(selected).eq(true)),
      intent: (i) => i.feedback.style.use(tw('border-foreground text-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('underline'), w.state(hovered).eq(true)),
      intent: (i) => i.feedback.style.use(tw('text-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('underline'), w.state(focusVisible).eq(true)),
      intent: (i) => i.feedback.style.use(tw('outline-2 outline-ring outline-offset-2')),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('underline'), w.state(disabled).eq(true)),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
    });
  },
});
export default tabsTrigger;

import { definePrototype, tw } from '@proto.ui/core';
import { asTabsTrigger } from '@proto.ui/prototypes-base/tabs';
import {
  LINE_INDICATION_ACTIVE,
  LINE_INDICATION_BASE,
  LINE_INDICATION_HORIZONTAL,
  LINE_INDICATION_VERTICAL,
  setupTabsVisual,
  TABS_PROJECTED_STYLES,
  TAB_TRIGGER_COMMON,
  TAB_TRIGGER_DEFAULT_SHADOW,
  TAB_TRIGGER_RECIPES,
  TAB_TRIGGER_VERTICAL,
} from './visual';
import type { ShadcnTabsTriggerExposes, ShadcnTabsTriggerProps } from './types';
const tabsTrigger = definePrototype<ShadcnTabsTriggerProps, ShadcnTabsTriggerExposes>({
  name: 'shadcn-tabs-trigger',
  setup(def) {
    def.props.define({
      appearance: { type: 'enum', options: ['default', 'underline'], empty: 'fallback' },
    });
    def.props.setDefaults({ appearance: 'default' });
    const { disabled, hovered, focusVisible, selected } = asTabsTrigger().stateHandles!;
    const { style, orientation, variant } = setupTabsVisual(def);

    /*
     * The upstream `after:` line indication is an owned decorative target
     * (C-FEEDBACK-STYLE-OWNED-TARGET-0001): permanently decorative, bound to
     * one framework leaf in the template; style rules only paint it. It is a
     * visual decoration, not measured selected-trigger positioning.
     */
    const lineIndication = def.feedback.style.declareDecoration();

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
    for (const id of TABS_PROJECTED_STYLES) {
      const recipe = TAB_TRIGGER_RECIPES[id];
      def.rule({
        when: (w) => w.all(w.prop('appearance').eq('default'), w.state(style).eq(id)),
        intent: (i) => i.feedback.style.use(recipe),
      });
    }
    // Universal vertical trigger rule; per-style vertical padding on top.
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.state(orientation).eq('vertical')),
      intent: (i) => i.feedback.style.use(tw('w-full justify-start')),
    });
    for (const id of TABS_PROJECTED_STYLES) {
      const recipe = TAB_TRIGGER_VERTICAL[id];
      if (!recipe) continue;
      def.rule({
        when: (w) =>
          w.all(
            w.prop('appearance').eq('default'),
            w.state(orientation).eq('vertical'),
            w.state(style).eq(id)
          ),
        intent: (i) => i.feedback.style.use(recipe),
      });
    }
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
    // luma/rhea declare `border-transparent!`: their focus border contribution
    // is withheld instead of copying a CSS-important token.
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(focusVisible).eq(true),
          w.not(w.any(w.state(style).eq('luma'), w.state(style).eq('rhea')))
        ),
      intent: (i) => i.feedback.style.use(tw('border-ring')),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.state(selected).eq(true)),
      intent: (i) => i.feedback.style.use(tw('bg-background text-foreground')),
    });
    for (const id of TAB_TRIGGER_DEFAULT_SHADOW) {
      def.rule({
        when: (w) =>
          w.all(
            w.prop('appearance').eq('default'),
            w.state(variant).eq('default'),
            w.state(selected).eq(true),
            w.state(style).eq(id)
          ),
        intent: (i) => i.feedback.style.use(tw('shadow-sm')),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.prop('appearance').eq('default'),
            w.state(variant).eq('line'),
            w.state(selected).eq(true),
            w.state(style).eq(id)
          ),
        intent: (i) => i.feedback.style.use(tw('shadow-none')),
      });
    }
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(selected).eq(true),
          w.meta('colorScheme').eq('dark')
        ),
      intent: (i) => i.feedback.style.use(tw('bg-input/30 text-foreground')),
    });
    // dark:data-active:border-input — withheld where the style's border is `border-transparent!`.
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(selected).eq(true),
          w.meta('colorScheme').eq('dark'),
          w.not(w.any(w.state(style).eq('luma'), w.state(style).eq('rhea')))
        ),
      intent: (i) => i.feedback.style.use(tw('border-input')),
    });
    // `variant=line` trigger rules: transparent surface in every scheme; the
    // `after:` indication (decoration target below) carries the active signal.
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.state(variant).eq('line')),
      intent: (i) => i.feedback.style.use(tw('bg-transparent')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('line'),
          w.state(selected).eq(true),
          w.meta('colorScheme').eq('dark')
        ),
      intent: (i) => i.feedback.style.use(tw('border-transparent')),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.state(disabled).eq(true)),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
    });

    // after:absolute after:bg-foreground after:opacity-0 after:transition-opacity
    // + orientation placement + opacity-100 when the list is `line` and selected.
    def.rule({
      when: (w) => w.prop('appearance').eq('default'),
      intent: (i) => i.feedback.style.to(lineIndication).use(LINE_INDICATION_BASE),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.state(orientation).eq('horizontal')),
      intent: (i) => i.feedback.style.to(lineIndication).use(LINE_INDICATION_HORIZONTAL),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.state(orientation).eq('vertical')),
      intent: (i) => i.feedback.style.to(lineIndication).use(LINE_INDICATION_VERTICAL),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('line'),
          w.state(selected).eq(true)
        ),
      intent: (i) => i.feedback.style.to(lineIndication).use(LINE_INDICATION_ACTIVE),
    });

    // Existing Proto underline is a separately named compatibility surface, not upstream line.
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

    return (r) => [r.r.slot(), r.decoration(lineIndication)];
  },
});
export default tabsTrigger;

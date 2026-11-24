import { definePrototype, tw } from '@proto.ui/core';
import { asCollapsibleTrigger } from '@proto.ui/prototypes-base/collapsible';
import { SHADCN_STYLE_IDS, setupShadcnStyleSelection, type ShadcnStyleId } from '../style-scope';
import type { ShadcnCollapsibleTriggerProps, ShadcnCollapsibleTriggerExposes } from './types';

const PROFILE_RECIPES: Partial<Record<ShadcnStyleId, string>> = {
  rhea: 'rounded-xl shadow-xs',
  luma: 'rounded-xl shadow-xs',
  maia: 'rounded-xl shadow-xs',
  lyra: 'rounded-none shadow-none',
  vega: 'rounded-lg shadow-xs',
  nova: 'rounded-lg shadow-xs',
  mira: 'rounded-lg shadow-xs',
  sera: 'rounded-lg shadow-xs',
};

// P-SHADCN-COLLAPSIBLE-TRIGGER-BASE-INHERITANCE: Base is the only semantic owner.
// The pinned reference primitives are unstyled; these safe host defaults are a Proto UI delta.
const collapsibleTrigger = definePrototype<
  ShadcnCollapsibleTriggerProps,
  ShadcnCollapsibleTriggerExposes
>({
  name: 'shadcn-collapsible-trigger',
  modules: asCollapsibleTrigger.modules,
  setup(def) {
    const inherited = asCollapsibleTrigger();
    const state = inherited.stateHandles;
    const style = setupShadcnStyleSelection(def, 'new-york-v4', {
      supportedStyles: SHADCN_STYLE_IDS,
    });
    def.props.define({
      variant: {
        type: 'enum',
        options: ['default', 'ghost', 'outline', 'plain'],
        empty: 'fallback',
      },
      size: {
        type: 'enum',
        options: ['default', 'sm', 'icon'],
        empty: 'fallback',
      },
    });
    def.props.setDefaults({ variant: 'default', size: 'default' });
    if (!state) throw new Error('[shadcn-collapsible-trigger] Missing Base state handles.');
    const { expanded, hovered, pressed, focusVisible, disabled } = state;

    // P-SHADCN-COLLAPSIBLE-TRIGGER-VISUAL-SAFETY: no fixed width/height or clipped long label.
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground wrap-anywhere whitespace-break-spaces text-left cursor-pointer select-none inline-flex items-center justify-start gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors'
      )
    );

    for (const [profile, tokens] of Object.entries(PROFILE_RECIPES) as Array<
      [ShadcnStyleId, string]
    >) {
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) => i.feedback.style.use(tw(tokens)),
      });
    }

    def.rule({
      when: (w) => w.prop('variant').eq('ghost'),
      intent: (i) => i.feedback.style.use(tw('border-transparent bg-transparent shadow-none')),
    });
    def.rule({
      when: (w) => w.prop('variant').eq('outline'),
      intent: (i) => i.feedback.style.use(tw('border-border bg-background shadow-xs')),
    });
    def.rule({
      when: (w) => w.prop('variant').eq('plain'),
      intent: (i) =>
        i.feedback.style.use(
          tw('border-0 border-transparent bg-transparent p-0 rounded-none shadow-none')
        ),
    });

    def.rule({
      when: (w) => w.prop('size').eq('sm'),
      intent: (i) => i.feedback.style.use(tw('px-2.5 py-1.5 text-sm')),
    });
    def.rule({
      when: (w) => w.prop('size').eq('icon'),
      intent: (i) => i.feedback.style.use(tw('size-8 p-0 justify-center')),
    });

    for (const variant of ['default', 'outline'] as const) {
      def.rule({
        when: (w) =>
          w.all(
            w.state(expanded).eq(true),
            w.state(pressed).eq(false),
            w.prop('variant').eq(variant)
          ),
        intent: (i) => i.feedback.style.use(tw('bg-muted/50 text-foreground')),
      });
    }
    def.rule({
      when: (w) =>
        w.all(
          w.state(expanded).eq(true),
          w.state(pressed).eq(false),
          w.prop('variant').eq('ghost')
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
    });

    def.rule({
      when: (w) => w.state(hovered).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground')),
    });
    def.rule({
      when: (w) => w.state(pressed).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-muted shadow-none')),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('outline-none forced-colors-focus-outline border-ring ring-[3px] ring-ring/50')
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

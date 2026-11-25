import { definePrototype, tw } from '@proto.ui/core';
import { asCollapsibleContent } from '@proto.ui/prototypes-base/collapsible';
import { SHADCN_STYLE_IDS, setupShadcnStyleSelection, type ShadcnStyleId } from '../style-scope';
import type { ShadcnCollapsibleContentProps, ShadcnCollapsibleContentExposes } from './types';

// Keep the finite profile inventory visible to static package CSS collection.
const PROFILE_CONTENT_RECIPES = [
  [
    'rhea',
    'rounded-xl bg-card text-card-foreground shadow-xs ring-1 ring-foreground/10 border-transparent p-3.5',
  ],
  [
    'luma',
    'rounded-xl bg-card text-card-foreground shadow-xs ring-1 ring-foreground/10 border-transparent p-3.5',
  ],
  ['maia', 'rounded-2xl bg-card text-card-foreground shadow-xs p-3.5'],
  ['lyra', 'rounded-none'],
  ['vega', 'rounded-lg'],
  ['nova', 'rounded-lg'],
  ['mira', 'rounded-lg'],
  ['sera', 'rounded-lg'],
] as const satisfies readonly (readonly [ShadcnStyleId, string])[];

// P-SHADCN-COLLAPSIBLE-CONTENT-BASE-INHERITANCE: Base is the only semantic owner.
// The pinned reference primitives are unstyled; these safe host defaults are a Proto UI delta.
const collapsibleContent = definePrototype<
  ShadcnCollapsibleContentProps,
  ShadcnCollapsibleContentExposes
>({
  name: 'shadcn-collapsible-content',
  modules: asCollapsibleContent.modules,
  setup(def) {
    const inherited = asCollapsibleContent();
    const style = setupShadcnStyleSelection(def, 'new-york-v4', {
      supportedStyles: SHADCN_STYLE_IDS,
    });
    def.props.define({
      variant: {
        type: 'enum',
        options: ['default', 'plain'],
        empty: 'fallback',
      },
    });
    def.props.setDefaults({ variant: 'default' });
    // P-SHADCN-COLLAPSIBLE-CONTENT-VISUAL-SAFETY: no fixed width/height or clipped long label.
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground wrap-anywhere rounded-md border border-border bg-background p-3 text-sm animate-in fade-in-0 duration-150'
      )
    );
    for (const [profile, tokens] of PROFILE_CONTENT_RECIPES) {
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.prop('variant').eq('default')),
        intent: (i) => i.feedback.style.use(tw(tokens)),
      });
    }
    def.rule({
      when: (w) => w.prop('variant').eq('plain'),
      intent: (i) =>
        i.feedback.style.use(
          tw('border-0 border-transparent bg-transparent p-0 rounded-none shadow-none ring-0')
        ),
    });
    return inherited.render;
  },
});

export default collapsibleContent;

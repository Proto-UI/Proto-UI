import type { FieldsetRootExposes } from '@proto.ui/prototypes-base/fieldset';
import { definePrototype, tw } from '@proto.ui/core';
import { asFieldsetLegend } from '@proto.ui/prototypes-base/fieldset';
import { setupShadcnStyleSelection, SHADCN_STYLE_IDS } from '../style-scope';
import type { ShadcnFieldsetLegendProps } from './types';

/** Pinned .cn-field-legend; variant controls paint, never the Base legend relation. */
export default definePrototype<ShadcnFieldsetLegendProps, FieldsetRootExposes>({
  name: 'shadcn-fieldset-legend',
  modules: asFieldsetLegend.modules,
  setup(def) {
    const inherited = asFieldsetLegend();
    const style = setupShadcnStyleSelection(def, 'nova');
    def.props.define({
      variant: { type: 'enum', options: ['legend', 'label'], empty: 'fallback' },
    });
    def.props.setDefaults({ variant: 'legend' });
    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) =>
          i.feedback.style.use(
            tw(
              profile === 'nova'
                ? 'mb-1.5 font-medium'
                : profile === 'lyra'
                  ? 'mb-2.5 font-medium'
                  : profile === 'mira'
                    ? 'mb-2 font-medium'
                    : profile === 'sera'
                      ? 'mb-3 font-semibold uppercase'
                      : 'mb-3 font-medium'
            )
          ),
      });
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.prop('variant').eq('legend')),
        intent: (i) =>
          i.feedback.style.use(
            tw(
              profile === 'sera'
                ? 'text-xs'
                : profile === 'lyra' || profile === 'mira'
                  ? 'text-sm'
                  : 'text-base'
            )
          ),
      });
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.prop('variant').eq('label')),
        intent: (i) =>
          i.feedback.style.use(
            tw(
              profile === 'mira'
                ? 'text-xs leading-relaxed'
                : profile === 'lyra' || profile === 'sera'
                  ? 'text-xs'
                  : 'text-sm'
            )
          ),
      });
    }
    return inherited.render;
  },
});

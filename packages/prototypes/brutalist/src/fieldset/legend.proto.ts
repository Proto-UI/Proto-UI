import type { FieldsetPartProps, FieldsetRootExposes } from '@proto.ui/prototypes-base/fieldset';
import { definePrototype, tw } from '@proto.ui/core';
import { asFieldsetLegend } from '@proto.ui/prototypes-base/fieldset';

export type BrutalistFieldsetLegendProps = FieldsetPartProps & {
  variant?: 'legend' | 'label';
};

export default definePrototype<BrutalistFieldsetLegendProps, FieldsetRootExposes>({
  name: 'brutalist-fieldset-legend',
  modules: asFieldsetLegend.modules,
  setup(def) {
    const inherited = asFieldsetLegend();
    def.props.define({
      variant: { type: 'enum', options: ['legend', 'label'], empty: 'fallback' },
    });
    def.props.setDefaults({ variant: 'legend' });
    def.feedback.style.use(tw('mb-1.5 font-heading font-bold text-foreground'));
    def.rule({
      when: (w) => w.prop('variant').eq('legend'),
      intent: (i) => i.feedback.style.use(tw('text-base')),
    });
    def.rule({
      when: (w) => w.prop('variant').eq('label'),
      intent: (i) => i.feedback.style.use(tw('text-sm')),
    });
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50')),
    });
    return inherited.render;
  },
});

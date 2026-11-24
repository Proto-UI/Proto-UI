import type { FieldsetPartProps, FieldsetRootExposes } from '@proto.ui/prototypes-base/fieldset';
import { definePrototype, tw } from '@proto.ui/core';
import { asFieldsetLegend } from '@proto.ui/prototypes-base/fieldset';

export type LiquidGlassFieldsetLegendProps = FieldsetPartProps & {
  variant?: 'legend' | 'label';
};

export default definePrototype<LiquidGlassFieldsetLegendProps, FieldsetRootExposes>({
  name: 'liquid-glass-fieldset-legend',
  modules: asFieldsetLegend.modules,
  setup(def) {
    const inherited = asFieldsetLegend();
    def.props.define({
      variant: { type: 'enum', options: ['legend', 'label'], empty: 'fallback' },
    });
    def.props.setDefaults({ variant: 'legend' });
    def.feedback.style.use(tw('font-semibold text-foreground'));
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
      intent: (i) => i.feedback.style.use(tw('text-muted-foreground')),
    });
    return inherited.render;
  },
});

import { definePrototype, tw } from '@proto.ui/core';
import {
  asLabelRoot,
  type LabelRootProps,
  type LabelRootExposes,
} from '@proto.ui/prototypes-base/label';

export type LiquidGlassLabelTone = 'primary' | 'secondary';
export type LiquidGlassLabelRootProps = LabelRootProps & {
  /** Content-layer label ink hierarchy over translucent Liquid Glass scenes. */
  tone?: LiquidGlassLabelTone;
};

export default definePrototype<LiquidGlassLabelRootProps, LabelRootExposes>({
  name: 'liquid-glass-label-root',
  modules: asLabelRoot.modules,
  setup(def) {
    const inherited = asLabelRoot();
    def.props.define({
      tone: { type: 'enum', options: ['primary', 'secondary'], empty: 'fallback' },
    });
    def.props.setDefaults({ tone: 'primary' });
    // Plain control labels belong to the content layer (no glass plate) and use
    // crisp theme ink roles so reduced-transparency and high-contrast stay legible.
    def.feedback.style.use(
      tw(
        'flex w-fit max-w-full items-center gap-2 font-sans text-sm font-medium leading-snug text-start break-words'
      )
    );
    def.rule({
      when: (w) => w.prop('tone').eq('primary'),
      intent: (i) => i.feedback.style.use(tw('text-foreground')),
    });
    def.rule({
      when: (w) => w.prop('tone').eq('secondary'),
      intent: (i) => i.feedback.style.use(tw('text-muted-foreground')),
    });
    return inherited.render;
  },
});

import { definePrototype, tw } from '@proto.ui/core';
import {
  asFieldRoot,
  type FieldRootProps,
  type FieldRootExposes,
} from '@proto.ui/prototypes-base/field';

export type LiquidGlassFieldOrientation = 'vertical' | 'horizontal';
export type LiquidGlassFieldRootProps = FieldRootProps & {
  orientation?: LiquidGlassFieldOrientation;
};

export default definePrototype<LiquidGlassFieldRootProps, FieldRootExposes>({
  name: 'liquid-glass-field-root',
  modules: asFieldRoot.modules,
  setup(def) {
    const inherited = asFieldRoot();
    def.props.define({
      orientation: { type: 'enum', empty: 'fallback', options: ['vertical', 'horizontal'] },
    });
    def.props.setDefaults({ orientation: 'vertical' });
    def.feedback.style.use(tw('flex w-full min-w-0 text-foreground'));
    def.rule({
      when: (w) => w.prop('orientation').eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('flex-col gap-2')),
    });
    def.rule({
      when: (w) => w.prop('orientation').eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('flex-row items-center justify-between gap-3')),
    });
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.invalid).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-destructive')),
    });
    return inherited.render;
  },
});

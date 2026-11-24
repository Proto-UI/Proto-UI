import { definePrototype, tw } from '@proto.ui/core';
import { asFieldRoot, type FieldRootExposes } from '@proto.ui/prototypes-base/field';
import type { ShadcnFieldRootProps } from './types';
import { setupFieldRootVisual } from './visual';

export default definePrototype<ShadcnFieldRootProps, FieldRootExposes>({
  name: 'shadcn-field-root',
  modules: asFieldRoot.modules,
  setup(def) {
    const inherited = asFieldRoot();
    def.props.define({
      orientation: { type: 'enum', empty: 'fallback', options: ['vertical', 'horizontal'] },
    });
    def.props.setDefaults({ orientation: 'vertical' });
    setupFieldRootVisual(def, inherited.stateHandles!.invalid, inherited.stateHandles!.disabled);
    def.rule({
      when: (w) => w.prop('orientation').eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('flex-col')),
    });
    def.rule({
      when: (w) => w.prop('orientation').eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('flex-row items-center justify-between')),
    });
    return inherited.render;
  },
});

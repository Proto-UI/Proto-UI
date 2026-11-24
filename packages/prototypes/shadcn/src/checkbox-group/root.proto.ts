import type { CheckboxGroupRootExposes } from '@proto.ui/prototypes-base/checkbox-group';
import { definePrototype, tw } from '@proto.ui/core';
import { asCheckboxGroupRoot } from '@proto.ui/prototypes-base/checkbox-group';
import { setupShadcnStyleScope } from '../style-scope';
import type { ShadcnCheckboxGroupRootProps } from './types';
export default definePrototype<ShadcnCheckboxGroupRootProps, CheckboxGroupRootExposes>({
  name: 'shadcn-checkbox-group-root',
  setup(def) {
    const inherited = asCheckboxGroupRoot();
    setupShadcnStyleScope(def);
    def.props.define({
      orientation: { type: 'enum', options: ['vertical', 'horizontal'], empty: 'fallback' },
    });
    def.props.setDefaults({ orientation: 'vertical' });
    def.feedback.style.use(tw('flex w-full min-w-0 flex-col gap-3 text-foreground'));
    def.rule({
      when: (w) => w.prop('orientation').eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('flex-row flex-wrap items-center gap-4')),
    });
    return inherited.render;
  },
});

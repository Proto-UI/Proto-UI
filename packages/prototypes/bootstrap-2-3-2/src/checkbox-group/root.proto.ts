import type {
  CheckboxGroupRootProps,
  CheckboxGroupRootExposes,
} from '@proto.ui/prototypes-base/checkbox-group';
import { definePrototype, tw } from '@proto.ui/core';
import { asCheckboxGroupRoot } from '@proto.ui/prototypes-base/checkbox-group';

type BootstrapCheckboxGroupRootProps = CheckboxGroupRootProps & {
  orientation?: 'vertical' | 'horizontal';
};

export default definePrototype<BootstrapCheckboxGroupRootProps, CheckboxGroupRootExposes>({
  name: 'bootstrap-2-3-2-checkbox-group-root',
  setup(def) {
    const inherited = asCheckboxGroupRoot();
    def.props.define({
      orientation: { type: 'enum', options: ['vertical', 'horizontal'], empty: 'fallback' },
    });
    def.props.setDefaults({ orientation: 'vertical' });
    def.feedback.style.use(tw('flex min-w-0 flex-col text-foreground text-[14px] leading-[20px]'));
    def.rule({
      when: (w) => w.prop('orientation').eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('flex-row flex-wrap items-center gap-4')),
    });
    return inherited.render;
  },
});

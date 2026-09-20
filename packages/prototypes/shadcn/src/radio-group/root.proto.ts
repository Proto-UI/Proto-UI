import { definePrototype, tw } from '@proto.ui/core';
import { asRadioGroupRoot } from '@proto.ui/prototypes-base/radio-group';
import type { ShadcnRadioGroupRootExposes, ShadcnRadioGroupRootProps } from './types';

const radioGroupRoot = definePrototype<ShadcnRadioGroupRootProps, ShadcnRadioGroupRootExposes>({
  name: 'shadcn-radio-group-root',
  setup(def) {
    asRadioGroupRoot();
    def.feedback.style.use(tw('grid gap-3'));
  },
});

export default radioGroupRoot;

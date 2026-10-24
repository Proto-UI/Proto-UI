import type { ShadcnSelectGroupProps } from './types';
import { setupSelectStyle } from './style';
import { definePrototype, tw } from '@proto.ui/core';
import { asSelectGroup } from '@proto.ui/prototypes-base/select';

export default definePrototype<ShadcnSelectGroupProps>({
  name: 'shadcn-select-group',
  setup(def) {
    asSelectGroup();
    const style = setupSelectStyle(def);
    def.rule({
      when: (w) => w.state(style).eq('rhea'),
      intent: (i) => i.feedback.style.use(tw('scroll-my-1.5 p-1')),
    });
  },
});

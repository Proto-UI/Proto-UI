import type { ShadcnSelectItemTextProps } from './types';
import { setupSelectStyle } from './style';
import { definePrototype, tw } from '@proto.ui/core';
import { asSelectItemText } from '@proto.ui/prototypes-base/select';

export default definePrototype<ShadcnSelectItemTextProps>({
  name: 'shadcn-select-item-text',
  setup(def) {
    asSelectItemText();
    const style = setupSelectStyle(def);
    def.rule({
      when: (w) => w.state(style).eq('rhea'),
      intent: (i) =>
        i.feedback.style.use(tw('flex flex-1 items-center gap-2 shrink-0 whitespace-nowrap')),
    });
  },
});

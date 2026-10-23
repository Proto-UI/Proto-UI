import type { ShadcnSelectLabelProps } from './types';
import { setupSelectStyle } from './style';
import { definePrototype, tw } from '@proto.ui/core';
import { asSelectLabel } from '@proto.ui/prototypes-base/select';

export default definePrototype<ShadcnSelectLabelProps>({
  name: 'shadcn-select-label',
  setup(def) {
    asSelectLabel();
    const style = setupSelectStyle(def);
    def.rule({
      when: (w) => w.state(style).eq('rhea'),
      intent: (i) => i.feedback.style.use(tw('px-2 py-1 text-xs text-muted-foreground')),
    });
    def.rule({
      when: (w) => w.state(style).eq('new-york-v4'),
      intent: (i) => i.feedback.style.use(tw('px-2 py-1.5 text-xs text-muted-foreground')),
    });
  },
});

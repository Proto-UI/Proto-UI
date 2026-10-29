import type { ShadcnSelectLabelProps } from './types';
import { setupSelectStyle } from './style';
import { definePrototype, tw } from '@proto.ui/core';
import { asSelectLabel } from '@proto.ui/prototypes-base/select';
import { SELECT_LABEL_STYLE, SELECT_TRANSLUCENT_STYLES } from './recipes';

export default definePrototype<ShadcnSelectLabelProps>({
  name: 'shadcn-select-label',
  setup(def) {
    asSelectLabel();
    const style = setupSelectStyle(def);
    for (const profile of SELECT_TRANSLUCENT_STYLES)
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) => i.feedback.style.use(tw(SELECT_LABEL_STYLE[profile])),
      });
    def.rule({
      when: (w) => w.state(style).eq('new-york-v4'),
      intent: (i) => i.feedback.style.use(tw('px-2 py-1.5 text-xs text-muted-foreground')),
    });
  },
});

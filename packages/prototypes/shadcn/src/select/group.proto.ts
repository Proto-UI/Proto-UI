import type { ShadcnSelectGroupProps } from './types';
import { setupSelectStyle } from './style';
import { definePrototype, tw } from '@proto.ui/core';
import { asSelectGroup } from '@proto.ui/prototypes-base/select';
import { SELECT_GROUP_STYLE, SELECT_TRANSLUCENT_STYLES } from './recipes';

export default definePrototype<ShadcnSelectGroupProps>({
  name: 'shadcn-select-group',
  setup(def) {
    const inherited = asSelectGroup();
    const style = setupSelectStyle(def);
    for (const profile of SELECT_TRANSLUCENT_STYLES)
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) => i.feedback.style.use(tw(SELECT_GROUP_STYLE[profile])),
      });
    return inherited.render;
  },
});

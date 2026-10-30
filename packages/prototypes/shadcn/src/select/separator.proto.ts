import type { ShadcnSelectSeparatorProps } from './types';
import { setupSelectStyle } from './style';
import { definePrototype, tw } from '@proto.ui/core';
import { asSelectSeparator } from '@proto.ui/prototypes-base/select';
import { SELECT_SEPARATOR_STYLE, SELECT_TRANSLUCENT_STYLES } from './recipes';

export default definePrototype<ShadcnSelectSeparatorProps>({
  name: 'shadcn-select-separator',
  setup(def) {
    const inherited = asSelectSeparator();
    const style = setupSelectStyle(def);
    for (const profile of SELECT_TRANSLUCENT_STYLES)
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) => i.feedback.style.use(tw(SELECT_SEPARATOR_STYLE[profile])),
      });
    def.rule({
      when: (w) => w.state(style).eq('new-york-v4'),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none -mx-1 my-1 h-px bg-border')),
    });
    // The caller owns rendering; hooks inherit declarations, not their renderer.
    return inherited.render;
  },
});

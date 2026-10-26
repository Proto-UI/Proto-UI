import type { ShadcnSelectSeparatorProps } from './types';
import { setupSelectStyle } from './style';
import { definePrototype, tw } from '@proto.ui/core';
import { asSelectSeparator } from '@proto.ui/prototypes-base/select';

export default definePrototype<ShadcnSelectSeparatorProps>({
  name: 'shadcn-select-separator',
  setup(def) {
    asSelectSeparator();
    const style = setupSelectStyle(def);
    def.rule({
      when: (w) => w.state(style).eq('rhea'),
      intent: (i) =>
        i.feedback.style.use(tw('pointer-events-none -mx-1 my-1 h-px bg-foreground/5')),
    });
    def.rule({
      when: (w) => w.state(style).eq('new-york-v4'),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none -mx-1 my-1 h-px bg-border')),
    });
    // The caller owns rendering; hooks inherit declarations, not their renderer.
    return () => null;
  },
});

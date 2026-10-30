import type { FieldsetRootExposes } from '@proto.ui/prototypes-base/fieldset';
import { definePrototype, tw } from '@proto.ui/core';
import { asFieldsetRoot } from '@proto.ui/prototypes-base/fieldset';
import { setupShadcnStyleSelection, SHADCN_STYLE_IDS } from '../style-scope';
import type { ShadcnFieldsetRootProps } from './types';
export default definePrototype<ShadcnFieldsetRootProps, FieldsetRootExposes>({
  name: 'shadcn-fieldset-root',
  modules: asFieldsetRoot.modules,
  setup(def) {
    const inherited = asFieldsetRoot();
    const style = setupShadcnStyleSelection(def, 'nova');
    def.feedback.style.use(tw('flex w-full min-w-0 flex-col text-foreground'));
    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) =>
          i.feedback.style.use(
            tw(profile === 'nova' || profile === 'lyra' || profile === 'mira' ? 'gap-4' : 'gap-6')
          ),
      });
    }
    return inherited.render;
  },
});

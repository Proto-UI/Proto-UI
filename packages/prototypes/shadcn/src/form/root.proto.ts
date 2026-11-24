import type { FormRootExposes } from '@proto.ui/prototypes-base/form';
import { definePrototype, tw } from '@proto.ui/core';
import { asFormRoot } from '@proto.ui/prototypes-base/form';
import { setupShadcnStyleSelection, SHADCN_STYLE_IDS } from '../style-scope';
import type { ShadcnFormRootProps } from './types';

export default definePrototype<ShadcnFormRootProps, FormRootExposes>({
  name: 'shadcn-form-root',
  modules: asFormRoot.modules,
  setup(def) {
    const inherited = asFormRoot();
    // Proto Form policy/layout, not react-hook-form FormProvider API parity.
    const style = setupShadcnStyleSelection(def, 'nova');
    def.feedback.style.use(tw('flex w-full min-w-0 flex-col text-foreground'));
    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) =>
          i.feedback.style.use(
            tw(profile === 'nova' || profile === 'lyra' || profile === 'mira' ? 'gap-5' : 'gap-6')
          ),
      });
    }
    return inherited.render;
  },
});

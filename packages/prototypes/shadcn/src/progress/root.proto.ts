import { definePrototype, tw } from '@proto.ui/core';
import { type ProgressRootExposes, asProgressRoot } from '@proto.ui/prototypes-base/progress';
import { setupShadcnStyleScope } from '../style-scope';
import type { ShadcnProgressRootProps } from './types';
export default definePrototype<ShadcnProgressRootProps, ProgressRootExposes>({
  name: 'shadcn-progress-root',
  modules: asProgressRoot.modules,
  setup(def) {
    const inherited = asProgressRoot();
    setupShadcnStyleScope(def);
    def.props.define({
      dir: { type: 'enum', options: ['ltr', 'rtl'], empty: 'fallback' },
    });
    def.feedback.style.use(tw('flex w-full min-w-0 flex-wrap items-center gap-3 text-foreground'));
    def.rule({
      when: (w) => w.prop('dir').eq('rtl'),
      intent: (i) => i.feedback.style.use(tw('direction-rtl')),
    });
    def.rule({
      when: (w) => w.prop('dir').eq('ltr'),
      intent: (i) => i.feedback.style.use(tw('direction-ltr')),
    });
    return inherited.render;
  },
});

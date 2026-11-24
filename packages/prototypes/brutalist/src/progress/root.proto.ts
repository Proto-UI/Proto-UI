import { definePrototype, tw } from '@proto.ui/core';
import { type ProgressRootExposes, asProgressRoot } from '@proto.ui/prototypes-base/progress';
import type { BrutalistProgressRootProps } from './types';
export default definePrototype<BrutalistProgressRootProps, ProgressRootExposes>({
  name: 'brutalist-progress-root',
  modules: asProgressRoot.modules,
  setup(def) {
    const inherited = asProgressRoot();
    def.props.define({
      dir: { type: 'enum', options: ['ltr', 'rtl'], empty: 'fallback' },
    });
    def.feedback.style.use(
      tw('flex w-full min-w-0 flex-wrap items-center gap-2 font-sans font-medium text-foreground')
    );
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

import { definePrototype, tw } from '@proto.ui/core';
import { asScrollAreaThumb } from '@proto.ui/prototypes-base/scroll-area';
import { SHADCN_STYLE_IDS, setupShadcnStyleSelection } from '../style-scope';
import type { ShadcnScrollAreaThumbExposes, ShadcnScrollAreaThumbProps } from './types';

const scrollAreaThumb = definePrototype<ShadcnScrollAreaThumbProps, ShadcnScrollAreaThumbExposes>({
  name: 'shadcn-scroll-area-thumb',
  modules: asScrollAreaThumb.modules,
  setup(def) {
    const inherited = asScrollAreaThumb();
    const style = setupShadcnStyleSelection(def, 'new-york-v4', {
      supportedStyles: SHADCN_STYLE_IDS,
    });
    // Fill the track's cross-axis thickness. The Scroll host overrides the
    // scrolling-axis dimension with its measured extent and owns flex-grow: 0.
    // Keeping flex-1 would leave a zero flex basis on the empty hit target.
    def.feedback.style.use(tw('relative h-full w-full bg-border'));
    def.rule({
      when: (w) => w.meta('preference.forcedColors').eq('active'),
      intent: (i) => i.feedback.style.use(tw('box-border border border-current')),
    });
    def.rule({
      when: (w) => w.any(w.state(style).eq('lyra'), w.state(style).eq('sera')),
      intent: (i) => i.feedback.style.use(tw('rounded-none')),
    });
    def.rule({
      when: (w) => w.not(w.any(w.state(style).eq('lyra'), w.state(style).eq('sera'))),
      intent: (i) => i.feedback.style.use(tw('rounded-full')),
    });
    return inherited.render;
  },
});

export default scrollAreaThumb;

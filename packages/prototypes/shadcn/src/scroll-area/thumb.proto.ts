import { definePrototype, tw } from '@proto.ui/core';
import { asScrollAreaThumb } from '@proto.ui/prototypes-base/scroll-area';
import { setupShadcnStyleSelection } from '../style-scope';
import type { ShadcnScrollAreaThumbExposes, ShadcnScrollAreaThumbProps } from './types';

const scrollAreaThumb = definePrototype<ShadcnScrollAreaThumbProps, ShadcnScrollAreaThumbExposes>({
  name: 'shadcn-scroll-area-thumb',
  modules: asScrollAreaThumb.modules,
  setup(def) {
    const inherited = asScrollAreaThumb();
    const style = setupShadcnStyleSelection(def, 'new-york-v4');
    def.feedback.style.use(tw('relative flex-1 bg-border'));
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

import { definePrototype, tw } from '@proto.ui/core';
import { asScrollAreaThumb } from '@proto.ui/prototypes-base/scroll-area';
import type { BrutalistScrollAreaThumbExposes, BrutalistScrollAreaThumbProps } from './types';

export const BrutalistScrollAreaThumb = definePrototype<
  BrutalistScrollAreaThumbProps,
  BrutalistScrollAreaThumbExposes
>({
  name: 'brutalist-scroll-area-thumb',
  modules: asScrollAreaThumb.modules,
  setup(def) {
    const inherited = asScrollAreaThumb();
    // The track is a fixed lavender accent that does not flip with the theme, so
    // the fill has to be its paired foreground rather than the theme-global one.
    def.feedback.style.use(tw('relative h-full w-full rounded-full bg-lavender-foreground'));
    def.rule({
      when: (w) => w.meta('preference.forcedColors').eq('active'),
      intent: (i) => i.feedback.style.use(tw('box-border border border-current')),
    });
    return inherited.render;
  },
});

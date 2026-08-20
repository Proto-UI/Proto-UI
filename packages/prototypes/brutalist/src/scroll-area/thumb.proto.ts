import { definePrototype, tw } from '@proto.ui/core';
import { asScrollAreaThumb } from '@proto.ui/prototypes-base/scroll-area';
import type { BrutalistScrollAreaThumbExposes, BrutalistScrollAreaThumbProps } from './types';
export const BrutalistScrollAreaThumb = definePrototype<
  BrutalistScrollAreaThumbProps,
  BrutalistScrollAreaThumbExposes
>({
  name: 'brutalist-scroll-area-thumb',
  setup(def) {
    asScrollAreaThumb();
    // The track is a fixed lavender accent that does not flip with the theme, so
    // the fill has to be its paired foreground rather than the theme-global one.
    def.feedback.style.use(tw('relative h-full w-full rounded-none bg-lavender-foreground'));
    return (renderer) => [renderer.r.slot()];
  },
});

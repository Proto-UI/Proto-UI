import { definePrototype, tw } from '@proto.ui/core';
import { asScrollSurface } from '@proto.ui/hooks';

// A fixed, real viewport; native children supply actual content and extent.
export default definePrototype({
  name: 'native-scroll-reader-arrival',
  setup(def) {
    const scroll = asScrollSurface();
    scroll.configure({
      axes: 'both',
      endFollow: { mode: 'while-at-end', axis: 'vertical' },
    });
    def.feedback.style.use(tw('w-64 h-40'));
    def.expose.method('pause', () => scroll.pauseFollowing().kind);
    def.expose.method('followEnd', () => scroll.request({ kind: 'to-end', axis: 'vertical' }).kind);
    return (renderer) => renderer.slot();
  },
});

import { definePrototype, tw } from '@proto.ui/core';
import {
  asScrollAreaThumb,
  type ScrollAreaThumbProps,
  type ScrollAreaThumbExposes,
} from '@proto.ui/prototypes-base/scroll-area';

export default definePrototype<ScrollAreaThumbProps, ScrollAreaThumbExposes>({
  name: 'liquid-glass-scroll-area-thumb',
  modules: asScrollAreaThumb.modules,
  setup(def) {
    const inherited = asScrollAreaThumb();
    // Fill the cross-axis cleanly (host owns scrolling-axis extent and flex-grow: 0).
    // Fail-closed opaque pill upgrades to a translucent overlay indicator only when
    // reduced-transparency and forced-colors are inactive.
    def.feedback.style.use(
      tw(
        'relative h-full w-full rounded-full border border-transparent bg-muted-foreground transition-colors'
      )
    );
    def.rule({
      when: (w) =>
        w.all(
          w.meta('preference.reducedTransparency').eq('no-preference'),
          w.meta('preference.forcedColors').eq('none')
        ),
      intent: (i) =>
        i.feedback.style.use(tw('bg-muted-foreground/60 ring-1 ring-inset ring-foreground/10')),
    });
    def.rule({
      when: (w) => w.meta('preference.contrast').eq('more'),
      intent: (i) => i.feedback.style.use(tw('bg-foreground border-border')),
    });
    def.rule({
      when: (w) => w.meta('preference.forcedColors').eq('active'),
      intent: (i) => i.feedback.style.use(tw('box-border border border-current')),
    });
    def.rule({
      when: (w) => w.meta('preference.reducedMotion').eq('reduce'),
      intent: (i) => i.feedback.style.use(tw('transition-none')),
    });
    return inherited.render;
  },
});

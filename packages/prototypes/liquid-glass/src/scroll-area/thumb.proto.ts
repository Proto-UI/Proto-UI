import { definePrototype, tw } from '@proto.ui/core';
import {
  asScrollAreaThumb,
  type ScrollAreaThumbProps as BaseScrollAreaThumbProps,
  type ScrollAreaThumbExposes,
} from '@proto.ui/prototypes-base/scroll-area';

export type ScrollAreaThumbProps = BaseScrollAreaThumbProps & {
  material?: 'auto' | 'opaque';
};

export default definePrototype<ScrollAreaThumbProps, ScrollAreaThumbExposes>({
  name: 'liquid-glass-scroll-area-thumb',
  modules: asScrollAreaThumb.modules,
  setup(def) {
    def.props.define({
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ material: 'auto' });
    const inherited = asScrollAreaThumb();
    // Fill the cross-axis cleanly (host owns scrolling-axis extent and flex-grow: 0).
    // Fail-closed opaque pill upgrades via shared optical material when preferences permit.
    def.feedback.style.use(
      tw(
        'relative h-full w-full rounded-full border border-transparent bg-muted-foreground text-background transition-shadow'
      )
    );
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.rule({
      when: (w) => w.prop('material').eq('auto'),
      intent: (i) => i.feedback.material.use({ intent: 'liquid-glass', variant: 'regular' }),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.meta('preference.reducedTransparency').eq('no-preference'),
          w.meta('preference.forcedColors').eq('none')
        ),
      intent: (i) => i.feedback.style.use(tw('ring-1 ring-inset ring-foreground/10')),
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

import { definePrototype, tw } from '@proto.ui/core';
import {
  asSeparatorRoot,
  type SeparatorRootExposes,
  type SeparatorRootProps,
} from '@proto.ui/prototypes-base/separator';

export interface LiquidGlassSeparatorRootProps extends SeparatorRootProps {
  /** 'auto' renders a vibrant translucent hairline; 'opaque' forces a solid separator stroke. */
  material?: 'auto' | 'opaque';
}

// Ordinary content separation, never a functional Liquid Glass surface (avoid
// glass-on-glass stacking). Base owns orientation, decorative visibility and
// semantic separator accessibility.
export default definePrototype<LiquidGlassSeparatorRootProps, SeparatorRootExposes>({
  name: 'liquid-glass-separator-root',
  modules: asSeparatorRoot.modules,
  setup(def) {
    def.props.define({
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ material: 'auto' });

    const inherited = asSeparatorRoot();
    const state = inherited.stateHandles;
    if (!state)
      throw new Error('[liquid-glass-separator-root] Base Separator states are required.');

    // Solid opaque baseline serves both explicit material="opaque" and reduced-transparency hosts.
    def.feedback.style.use(tw('block shrink-0 bg-border'));

    // Vibrant translucent hairline adapts over light/dark content and inside glass sheets.
    def.rule({
      when: (w) =>
        w.all(
          w.prop('material').eq('auto'),
          w.not(w.meta('preference.reducedTransparency').eq('reduce')),
          w.not(w.meta('preference.contrast').eq('more')),
          w.not(w.meta('preference.forcedColors').eq('active'))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-foreground/20')),
    });

    // Elevate contrast when the user requests increased contrast or forced colors.
    def.rule({
      when: (w) =>
        w.any(
          w.meta('preference.contrast').eq('more'),
          w.meta('preference.forcedColors').eq('active')
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted-foreground')),
    });

    def.rule({
      when: (w) => w.state(state.orientation).eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('h-px w-full')),
    });
    def.rule({
      when: (w) => w.state(state.orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('w-px self-stretch')),
    });

    // Preserve contentless rendering: decorative semantics cannot hide children.
    return inherited.render;
  },
});

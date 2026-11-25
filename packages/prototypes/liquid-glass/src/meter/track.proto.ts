import { definePrototype, tw } from '@proto.ui/core';
import {
  type MeterPartProps as BaseMeterPartProps,
  type MeterPartExposes,
  asMeterTrack,
} from '@proto.ui/prototypes-base/meter';

export type LiquidGlassMeterTrackProps = BaseMeterPartProps & {
  material?: 'auto' | 'opaque';
};

export default definePrototype<LiquidGlassMeterTrackProps, MeterPartExposes>({
  name: 'liquid-glass-meter-track',
  modules: asMeterTrack.modules,
  setup(def) {
    def.props.define({
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ material: 'auto' });
    const inherited = asMeterTrack();
    def.feedback.style.use(
      tw(
        'block h-2.5 w-full overflow-hidden rounded-full border border-border bg-muted text-foreground shadow-inner'
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
    return inherited.render;
  },
});

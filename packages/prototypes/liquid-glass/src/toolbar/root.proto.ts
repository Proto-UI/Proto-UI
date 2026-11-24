import { definePrototype, tw } from '@proto.ui/core';
import {
  asToolbarRoot,
  type ToolbarRootProps,
  type ToolbarRootExposes,
} from '@proto.ui/prototypes-base/toolbar';

export interface LiquidGlassToolbarRootProps extends ToolbarRootProps {
  material?: 'auto' | 'opaque';
}

export default definePrototype<LiquidGlassToolbarRootProps, ToolbarRootExposes>({
  name: 'liquid-glass-toolbar-root',
  modules: asToolbarRoot.modules,
  setup(def) {
    def.props.define({
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ material: 'auto' });

    const behavior = asToolbarRoot();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[liquid-glass-toolbar] Root state unavailable.');

    def.feedback.style.use(
      tw(
        'border border-border bg-secondary text-secondary-foreground shadow-md p-1.5 flex w-fit min-w-0 gap-1'
      )
    );
    def.rule({
      when: (w) => w.state(state.orientation).eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('flex-row items-center rounded-full')),
    });
    def.rule({
      when: (w) => w.state(state.orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('flex-col items-stretch rounded-2xl')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('material').eq('auto'),
          w.not(w.meta('preference.reducedTransparency').eq('reduce')),
          w.not(w.meta('preference.forcedColors').eq('active'))
        ),
      intent: (i) => i.feedback.style.use(tw('ring-1 ring-inset ring-foreground/10')),
    });
    def.rule({
      when: (w) =>
        w.any(
          w.prop('material').eq('opaque'),
          w.meta('preference.reducedTransparency').eq('reduce'),
          w.meta('preference.forcedColors').eq('active')
        ),
      intent: (i) => i.feedback.style.use(tw('shadow-sm')),
    });
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.rule({
      when: (w) => w.prop('material').eq('auto'),
      intent: (i) => i.feedback.material.use({ intent: 'liquid-glass' }),
    });
    return behavior.render;
  },
});

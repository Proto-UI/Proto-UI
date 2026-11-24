import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { asToggleGroupRoot } from '@proto.ui/prototypes-base/toggle-group';
import type { LiquidGlassToggleGroupRootExposes, LiquidGlassToggleGroupRootProps } from './types';
import { TOGGLE_GROUP_VISUAL_CONTEXT } from './visual';

export type { LiquidGlassToggleGroupRootProps };

/** Liquid Glass material belongs exclusively to Root so items never stack glass-on-glass. */
export default definePrototype<LiquidGlassToggleGroupRootProps, LiquidGlassToggleGroupRootExposes>({
  name: 'liquid-glass-toggle-group-root',
  modules: asToggleGroupRoot.modules,
  setup(def) {
    def.props.define({
      variant: { type: 'enum', options: ['regular', 'prominent'], empty: 'fallback' },
      size: { type: 'enum', options: ['default', 'sm', 'lg'], empty: 'fallback' },
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ variant: 'regular', size: 'default', material: 'auto' });
    const behavior = asToggleGroupRoot();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[liquid-glass-toggle-group] Root state unavailable.');
    def.context.provide(TOGGLE_GROUP_VISUAL_CONTEXT, {
      orientation: 'horizontal',
      variant: 'regular',
      size: 'default',
    });
    def.context.subscribe(TOGGLE_GROUP_VISUAL_CONTEXT);
    const syncVisual = (run: RunHandle<LiquidGlassToggleGroupRootProps>) => {
      const props = run.props.get();
      const orientation = state.orientation.get();
      const variant = props.variant === 'prominent' ? 'prominent' : 'regular';
      const size = props.size === 'sm' || props.size === 'lg' ? props.size : 'default';
      const cur = run.context.read(TOGGLE_GROUP_VISUAL_CONTEXT);
      if (cur.orientation !== orientation || cur.variant !== variant || cur.size !== size) {
        run.context.update(TOGGLE_GROUP_VISUAL_CONTEXT, { orientation, variant, size });
      }
    };
    def.lifecycle.onCreated(syncVisual);
    def.lifecycle.onMounted(syncVisual);
    def.props.watch(['orientation', 'variant', 'size'], syncVisual);
    def.feedback.style.use(
      tw(
        'rounded-full border border-border bg-secondary text-secondary-foreground shadow-md p-1 flex w-fit min-w-0 gap-1'
      )
    );
    def.rule({
      when: (w) =>
        w.all(
          w.prop('material').eq('auto'),
          w.meta('preference.reducedTransparency').eq('no-preference'),
          w.meta('preference.forcedColors').eq('none'),
          w.not(w.meta('colorScheme').eq('dark'))
        ),
      intent: (i) => i.feedback.style.use(tw('ring-1 ring-inset ring-foreground/15')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('material').eq('auto'),
          w.meta('preference.reducedTransparency').eq('no-preference'),
          w.meta('preference.forcedColors').eq('none'),
          w.meta('colorScheme').eq('dark')
        ),
      intent: (i) => i.feedback.style.use(tw('ring-1 ring-inset ring-foreground/10')),
    });
    def.rule({
      when: (w) => w.state(state.orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('flex-col items-stretch rounded-2xl p-1')),
    });
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('material').eq('auto'),
          w.prop('variant').eq('regular'),
          w.state(state.disabled).eq(false)
        ),
      intent: (i) => i.feedback.material.use({ intent: 'liquid-glass', variant: 'regular' }),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('material').eq('auto'),
          w.prop('variant').eq('prominent'),
          w.state(state.disabled).eq(false)
        ),
      intent: (i) =>
        i.feedback.material.use({ intent: 'liquid-glass', variant: 'regular', tint: 'style-fill' }),
    });
    return behavior.render;
  },
});

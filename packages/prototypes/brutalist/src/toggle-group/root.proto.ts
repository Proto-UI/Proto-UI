import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { asToggleGroupRoot } from '@proto.ui/prototypes-base/toggle-group';
import type {
  BrutalistToggleGroupRootExposes,
  BrutalistToggleGroupRootProps,
  BrutalistToggleGroupSpacing,
} from './types';
import { TOGGLE_GROUP_VISUAL_CONTEXT } from './visual';

export default definePrototype<BrutalistToggleGroupRootProps, BrutalistToggleGroupRootExposes>({
  name: 'brutalist-toggle-group-root',
  modules: asToggleGroupRoot.modules,
  setup(def) {
    def.props.define({
      variant: { type: 'enum', empty: 'fallback', options: ['default', 'outline'] },
      size: { type: 'enum', empty: 'fallback', options: ['default', 'sm', 'lg'] },
      spacing: { type: 'number', empty: 'fallback' },
    });
    def.props.setDefaults({ variant: 'default', size: 'default', spacing: 1 });
    const behavior = asToggleGroupRoot();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[brutalist-toggle-group] Root state unavailable.');
    const spacingState = def.state.string('brutalistToggleGroupSpacing', '1');
    const resolveSpacing = (
      run: RunHandle<BrutalistToggleGroupRootProps>
    ): BrutalistToggleGroupSpacing => {
      const raw = run.props.get().spacing;
      if (raw === 0 || raw === 1 || raw === 2) return raw;
      return 1;
    };
    def.context.provide(TOGGLE_GROUP_VISUAL_CONTEXT, {
      orientation: 'horizontal',
      variant: 'default',
      size: 'default',
      spacing: 1,
    });
    def.context.subscribe(TOGGLE_GROUP_VISUAL_CONTEXT);
    const syncVisual = (run: RunHandle<BrutalistToggleGroupRootProps>) => {
      const props = run.props.get();
      const orientation = state.orientation.get();
      const variant = props.variant === 'outline' ? 'outline' : 'default';
      const size = props.size === 'sm' || props.size === 'lg' ? props.size : 'default';
      const spacing = resolveSpacing(run);
      spacingState.set(String(spacing), 'brutalist toggle group spacing sync');
      const cur = run.context.read(TOGGLE_GROUP_VISUAL_CONTEXT);
      if (
        cur.orientation !== orientation ||
        cur.variant !== variant ||
        cur.size !== size ||
        cur.spacing !== spacing
      ) {
        run.context.update(TOGGLE_GROUP_VISUAL_CONTEXT, { orientation, variant, size, spacing });
      }
    };
    def.lifecycle.onCreated(syncVisual);
    def.lifecycle.onMounted(syncVisual);
    def.props.watch(['orientation', 'variant', 'size', 'spacing'], syncVisual);
    def.feedback.style.use(
      tw(
        'rounded-base border-2 border-black bg-secondary-background text-foreground shadow-[3px_3px_0_0_var(--pui-foreground)] flex w-fit min-w-0'
      )
    );
    def.rule({
      when: (w) => w.state(spacingState).eq('0'),
      intent: (i) => i.feedback.style.use(tw('gap-0 p-0 border-0 bg-transparent')),
    });
    def.rule({
      when: (w) => w.state(spacingState).eq('1'),
      intent: (i) => i.feedback.style.use(tw('gap-1 p-2')),
    });
    def.rule({
      when: (w) => w.state(spacingState).eq('2'),
      intent: (i) => i.feedback.style.use(tw('gap-2 p-2')),
    });
    def.rule({
      when: (w) => w.state(state.orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('flex-col items-stretch')),
    });
    return behavior.render;
  },
});

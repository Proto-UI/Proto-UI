import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { asToggleGroupRoot } from '@proto.ui/prototypes-base/toggle-group';
import type {
  BootstrapToggleGroupRootExposes,
  BootstrapToggleGroupRootProps,
  BootstrapToggleGroupSize,
  BootstrapToggleGroupVariant,
} from './types';
import { TOGGLE_GROUP_VISUAL_AXIS } from './visual';

const VARIANTS: readonly BootstrapToggleGroupVariant[] = [
  'default',
  'primary',
  'warning',
  'danger',
  'success',
  'info',
  'inverse',
];
const SIZES: readonly BootstrapToggleGroupSize[] = ['default', 'large', 'small', 'mini'];

export default definePrototype<BootstrapToggleGroupRootProps, BootstrapToggleGroupRootExposes>({
  name: 'bootstrap-2-3-2-toggle-group-root',
  modules: asToggleGroupRoot.modules,
  setup(def) {
    def.props.define({
      variant: { type: 'enum', empty: 'fallback', options: [...VARIANTS] },
      size: { type: 'enum', empty: 'fallback', options: [...SIZES] },
    });
    def.props.setDefaults({ variant: 'default', size: 'default' });
    const behavior = asToggleGroupRoot();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[bootstrap-2-3-2-toggle-group] Root states unavailable.');
    def.context.provide(TOGGLE_GROUP_VISUAL_AXIS, {
      orientation: 'horizontal',
      variant: 'default',
      size: 'default',
    });
    def.context.subscribe(TOGGLE_GROUP_VISUAL_AXIS);
    const syncVisual = (run: RunHandle<BootstrapToggleGroupRootProps>) => {
      const props = run.props.get();
      const orientation = state.orientation.get();
      const variant = VARIANTS.includes(props.variant as BootstrapToggleGroupVariant)
        ? (props.variant as BootstrapToggleGroupVariant)
        : 'default';
      const size = SIZES.includes(props.size as BootstrapToggleGroupSize)
        ? (props.size as BootstrapToggleGroupSize)
        : 'default';
      const cur = run.context.read(TOGGLE_GROUP_VISUAL_AXIS);
      if (cur.orientation !== orientation || cur.variant !== variant || cur.size !== size) {
        run.context.update(TOGGLE_GROUP_VISUAL_AXIS, { orientation, variant, size });
      }
    };
    def.lifecycle.onCreated(syncVisual);
    def.lifecycle.onMounted(syncVisual);
    def.props.watch(['orientation', 'variant', 'size'], syncVisual);
    def.feedback.style.use(tw('relative flex min-w-0 w-fit whitespace-nowrap'));
    def.rule({
      when: (w) => w.state(state.orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('flex-col')),
    });
    return behavior.render;
  },
});

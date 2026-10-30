import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import {
  asToggleGroupRoot,
  type ToggleGroupRootProps,
  type ToggleGroupRootExposes,
} from '@proto.ui/prototypes-base/toggle-group';
import { TOGGLE_GROUP_VISUAL_AXIS } from './visual';

export default definePrototype<ToggleGroupRootProps, ToggleGroupRootExposes>({
  name: 'bootstrap-2-3-2-toggle-group-root',
  modules: asToggleGroupRoot.modules,
  setup(def) {
    const behavior = asToggleGroupRoot();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[bootstrap-2-3-2-toggle-group] Root states unavailable.');
    def.context.provide(TOGGLE_GROUP_VISUAL_AXIS, { orientation: 'horizontal' });
    def.context.subscribe(TOGGLE_GROUP_VISUAL_AXIS);
    const syncAxis = (run: RunHandle<ToggleGroupRootProps>) => {
      const orientation = state.orientation.get();
      if (run.context.read(TOGGLE_GROUP_VISUAL_AXIS).orientation !== orientation) {
        run.context.update(TOGGLE_GROUP_VISUAL_AXIS, { orientation });
      }
    };
    def.lifecycle.onCreated(syncAxis);
    def.lifecycle.onMounted(syncAxis);
    def.props.watch(['orientation'], syncAxis);
    def.feedback.style.use(tw('relative flex min-w-0 w-fit whitespace-nowrap'));
    def.rule({
      when: (w) => w.state(state.orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('flex-col')),
    });
    return behavior.render;
  },
});

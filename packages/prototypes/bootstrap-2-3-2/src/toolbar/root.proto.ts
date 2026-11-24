import { definePrototype, tw } from '@proto.ui/core';
import {
  asToolbarRoot,
  type ToolbarRootProps,
  type ToolbarRootExposes,
} from '@proto.ui/prototypes-base/toolbar';

export default definePrototype<ToolbarRootProps, ToolbarRootExposes>({
  name: 'bootstrap-2-3-2-toolbar-root',
  modules: asToolbarRoot.modules,
  setup(def) {
    const behavior = asToolbarRoot();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[bootstrap-2-3-2-toolbar] Root state unavailable.');

    def.feedback.style.use(tw('flex w-fit min-w-0 gap-[5px] my-[10px]'));
    def.rule({
      when: (w) => w.state(state.orientation).eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('flex-row flex-wrap items-center')),
    });
    def.rule({
      when: (w) => w.state(state.orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('flex-col items-stretch')),
    });
    return behavior.render;
  },
});

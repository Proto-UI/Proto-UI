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
    def.feedback.style.use(tw('flex min-w-0 flex-wrap items-center gap-[5px] my-[10px]'));
    def.rule({
      when: (w) => w.state(behavior.getState!('orientation')!).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('flex-col')),
    });
    return behavior.render;
  },
});

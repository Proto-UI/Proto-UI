import { definePrototype, tw } from '@proto.ui/core';
import {
  asToolbarRoot,
  type ToolbarRootProps,
  type ToolbarRootExposes,
} from '@proto.ui/prototypes-base/toolbar';

export default definePrototype<ToolbarRootProps, ToolbarRootExposes>({
  name: 'brutalist-toolbar-root',
  modules: asToolbarRoot.modules,
  setup(def) {
    const behavior = asToolbarRoot();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[brutalist-toolbar] Root state unavailable.');

    def.feedback.style.use(
      tw(
        'rounded-base border-2 border-black bg-secondary-background text-foreground shadow-[3px_3px_0_0_var(--pui-foreground)] p-2 flex w-fit min-w-0 gap-1.5 font-sans font-medium'
      )
    );
    def.rule({
      when: (w) => w.state(state.orientation).eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('flex-row items-center')),
    });
    def.rule({
      when: (w) => w.state(state.orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('flex-col items-stretch')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-muted')),
    });
    return behavior.render;
  },
});

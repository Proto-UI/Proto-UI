import { definePrototype, tw } from '@proto.ui/core';
import {
  type ProgressPartProps,
  type ProgressPartExposes,
  asProgressIndicator,
} from '@proto.ui/prototypes-base/progress';
export default definePrototype<ProgressPartProps, ProgressPartExposes>({
  name: 'bootstrap-2-3-2-progress-indicator',
  modules: asProgressIndicator.modules,
  setup(def) {
    const inherited = asProgressIndicator();
    def.feedback.style.use(
      tw(
        'block float-left h-full box-border text-[12px] text-center text-paint-[#fff_0_-1px_0_rgb(0_0_0/25%)] bg-[#0e90d2_linear-gradient(#149bdf,#0480be)_0_0_repeat-x] shadow-[inset_0_-1px_0_rgb(0_0_0/15%)]'
      )
    );
    // Width is the public percentage projection, not a fabricated animation.
    // Exact .6s ease width interpolation and striped/active recipes remain
    // neutral-motion/public-variant gaps; transition-all would claim neither.
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.indeterminate).eq(false),
      intent: (i) => i.feedback.style.use(tw('w-[calc(var(--pui-percentage)*1%)]')),
    });
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.indeterminate).eq(true),
      intent: (i) => i.feedback.style.use(tw('w-1/3')),
    });
    return inherited.render;
  },
});

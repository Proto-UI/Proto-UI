import { definePrototype, tw } from '@proto.ui/core';
import {
  type ProgressPartProps,
  type ProgressPartExposes,
  asProgressIndicator,
} from '@proto.ui/prototypes-base/progress';
export default definePrototype<ProgressPartProps, ProgressPartExposes>({
  name: 'brutalist-progress-indicator',
  modules: asProgressIndicator.modules,
  setup(def) {
    const inherited = asProgressIndicator();
    const indeterminate = inherited.stateHandles!.indeterminate;
    const percentage = inherited.stateHandles!.percentage;
    def.feedback.style.use(tw('block h-full box-border bg-main'));
    def.feedback.style.transition({
      properties: ['width'],
      durationMs: 300,
      easing: [0.4, 0, 0.2, 1],
    });
    def.rule({
      when: (w) => w.state(indeterminate).eq(false),
      intent: (i) => i.feedback.style.use(tw('w-[calc(var(--pui-percentage)*1%)]')),
    });
    def.rule({
      when: (w) =>
        w.not(
          w.any(
            w.state(indeterminate).eq(true),
            w.state(percentage).eq(0),
            w.state(percentage).eq(100)
          )
        ),
      intent: (i) => i.feedback.style.use(tw('border-r border-border')),
    });
    def.rule({
      when: (w) => w.state(indeterminate).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('w-1/3 ms-auto me-auto border-l border-r border-border opacity-80')
        ),
    });
    return inherited.render;
  },
});

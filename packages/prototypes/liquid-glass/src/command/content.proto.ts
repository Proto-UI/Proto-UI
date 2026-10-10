import { definePrototype, tw } from '@proto.ui/core';
import {
  asCommandContent,
  type CommandContentProps,
  type CommandContentExposes,
} from '@proto.ui/prototypes-base/command';
export default definePrototype<CommandContentProps, CommandContentExposes>({
  name: 'liquid-glass-command-content',
  setup(def) {
    const behavior = asCommandContent();
    def.feedback.style.use(
      tw(
        'rounded-2xl border border-border bg-secondary text-secondary-foreground shadow-md min-w-0 w-full max-h-80 overflow-y-auto p-1'
      )
    );
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('open')!).eq(true),
      intent: (i) => i.feedback.material.use({ intent: 'liquid-glass' }),
    });
  },
});

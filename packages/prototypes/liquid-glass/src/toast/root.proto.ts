import { definePrototype, tw } from '@proto.ui/core';
import {
  asToastRoot,
  type ToastRootProps,
  type ToastRootExposes,
} from '@proto.ui/prototypes-base/toast';

export default definePrototype<ToastRootProps, ToastRootExposes>({
  name: 'liquid-glass-toast-root',
  setup(def) {
    const behavior = asToastRoot();
    def.feedback.style.use(
      tw(
        'rounded-2xl border border-border bg-secondary text-secondary-foreground shadow-md p-2 grid gap-2 min-w-0 w-full p-4'
      )
    );
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.feedback.material.use({ intent: 'liquid-glass' });
  },
});

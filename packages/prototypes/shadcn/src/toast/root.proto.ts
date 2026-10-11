import { definePrototype, tw } from '@proto.ui/core';
import {
  asToastRoot,
  type ToastRootProps,
  type ToastRootExposes,
} from '@proto.ui/prototypes-base/toast';

export default definePrototype<ToastRootProps, ToastRootExposes>({
  name: 'shadcn-toast-root',
  setup(def) {
    const behavior = asToastRoot();
    def.feedback.style.use(
      tw(
        'rounded-md border border-border bg-background text-foreground shadow-sm p-2 grid gap-2 min-w-0 w-full p-4'
      )
    );
  },
});

import { definePrototype, tw } from '@proto.ui/core';
import {
  asToastRoot,
  type ToastRootProps,
  type ToastRootExposes,
} from '@proto.ui/prototypes-base/toast';

export default definePrototype<ToastRootProps, ToastRootExposes>({
  name: 'brutalist-toast-root',
  setup(def) {
    const behavior = asToastRoot();
    def.feedback.style.use(
      tw(
        'rounded-none border-2 border-foreground bg-background text-foreground shadow-[3px_3px_0_0_var(--color-foreground)] p-2 grid gap-2 min-w-0 w-full p-4'
      )
    );
  },
});

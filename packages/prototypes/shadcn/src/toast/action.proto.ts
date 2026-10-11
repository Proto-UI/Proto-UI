import { definePrototype, tw } from '@proto.ui/core';
import {
  asToastAction,
  type ToastActionProps,
  type ToastActionExposes,
} from '@proto.ui/prototypes-base/toast';

export default definePrototype<ToastActionProps, ToastActionExposes>({
  name: 'shadcn-toast-action',
  setup(def) {
    const behavior = asToastAction();
    def.feedback.style.use(
      tw('rounded-md inline-flex min-w-0 items-center justify-center px-3 py-2 outline-none')
    );
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2')),
    });
  },
});

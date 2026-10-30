import { definePrototype, tw } from '@proto.ui/core';
import { asToastClose, type ToastCloseExposes } from '@proto.ui/prototypes-base/toast';
import type { ToastCloseProps } from './types';
import { setupOverlayStyle } from '../dialog/style';

export default definePrototype<ToastCloseProps, ToastCloseExposes>({
  name: 'shadcn-toast-close',
  setup(def) {
    const behavior = asToastClose();
    setupOverlayStyle(def);
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

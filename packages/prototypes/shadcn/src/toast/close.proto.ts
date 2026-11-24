import { definePrototype, tw } from '@proto.ui/core';
import { asToastClose, type ToastCloseExposes } from '@proto.ui/prototypes-base/toast';
import type { ToastCloseProps } from './types';
import { setupOverlayPaint } from '../dialog/style';
import { TOAST_CLOSE_RECIPES } from './recipes';

export default definePrototype<ToastCloseProps, ToastCloseExposes>({
  name: 'shadcn-toast-close',
  setup(def) {
    const behavior = asToastClose();
    setupOverlayPaint(def, TOAST_CLOSE_RECIPES);
    def.feedback.style.use(
      tw(
        'inline-flex min-w-0 shrink-0 items-center justify-center whitespace-nowrap select-none cursor-pointer outline-none transition-colors'
      )
    );
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed pointer-events-none')),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('focusVisible')!).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2 ring-offset-background')),
    });
    def.rule({
      when: (w) => w.meta('preference.reducedMotion').eq('reduce'),
      intent: (i) => i.feedback.style.use(tw('transition-none')),
    });
    return behavior.render;
  },
});

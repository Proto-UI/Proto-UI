import { definePrototype, tw } from '@proto.ui/core';
import { asToastAction, type ToastActionExposes } from '@proto.ui/prototypes-base/toast';
import type { ToastActionProps } from './types';
import { setupOverlayPaint } from '../dialog/style';
import { TOAST_ACTION_RECIPES } from './recipes';

export default definePrototype<ToastActionProps, ToastActionExposes>({
  name: 'shadcn-toast-action',
  setup(def) {
    const behavior = asToastAction();
    setupOverlayPaint(def, TOAST_ACTION_RECIPES);
    // Passive command paint; Base alone owns action notification and dismissal.
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

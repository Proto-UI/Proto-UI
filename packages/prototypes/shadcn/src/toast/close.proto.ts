import { definePrototype, tw } from '@proto.ui/core';
import { asToastClose, type ToastCloseExposes } from '@proto.ui/prototypes-base/toast';
import type { ToastCloseProps } from './types';
import { setupOverlayPaint } from '../dialog/style';
import { setupCollectionHover } from '../toolbar/action-visual';
import { TOAST_CLOSE_RECIPES } from './recipes';

export default definePrototype<ToastCloseProps, ToastCloseExposes>({
  name: 'shadcn-toast-close',
  setup(def) {
    const behavior = asToastClose();
    setupOverlayPaint(def, TOAST_CLOSE_RECIPES);
    const { disabled, focusVisible } = behavior.stateHandles!;
    const hovered = setupCollectionHover(def, disabled);
    def.feedback.style.use(
      tw(
        'inline-flex min-w-0 shrink-0 items-center justify-center whitespace-nowrap select-none cursor-pointer outline-none transition-colors'
      )
    );
    def.rule({
      when: (w) => w.any(w.state(disabled).eq(true), w.state(hovered).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-transparent text-muted-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.state(disabled).eq(false), w.state(hovered).eq(true)),
      intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground')),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed pointer-events-none')),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
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

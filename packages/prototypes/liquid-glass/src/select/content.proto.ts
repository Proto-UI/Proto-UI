import { definePrototype, tw } from '@proto.ui/core';
import { asSelectContent } from '@proto.ui/prototypes-base/select';
import type { LiquidGlassSelectContentProps, LiquidGlassSelectContentExposes } from './types';

export default definePrototype<LiquidGlassSelectContentProps, LiquidGlassSelectContentExposes>({
  name: 'liquid-glass-select-content',
  setup(def) {
    const select = asSelectContent();
    // Keep Base portal, collision, focus, dismissal and zero-duration presence.
    select.asTransition.configure({ enterDuration: 0, leaveDuration: 0 });
    // Content is the transparent portal/lifecycle frame, never an inactive
    // material owner. Surface alone owns popup paint and its opaque fallback;
    // Viewport is the one scrollport in the connected composition.
    def.feedback.style.use(tw('z-50 min-w-0 flex flex-col outline-none'));
    def.rule({
      when: (w) => w.prop('position').eq('popper'),
      intent: (i) => i.feedback.style.use(tw('max-h-[var(--proto-ui-available-height)]')),
    });
  },
});

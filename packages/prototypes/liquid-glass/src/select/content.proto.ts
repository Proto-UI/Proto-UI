import { definePrototype, tw } from '@proto.ui/core';
import { asSelectContent } from '@proto.ui/prototypes-base/select';
import type { LiquidGlassSelectContentProps, LiquidGlassSelectContentExposes } from './types';

export default definePrototype<LiquidGlassSelectContentProps, LiquidGlassSelectContentExposes>({
  name: 'liquid-glass-select-content',
  setup(def) {
    const select = asSelectContent();
    // Keep Base portal, collision, focus, dismissal and zero-duration presence.
    // Space inside the scrollport keeps item outlines from being clipped.
    select.asTransition.configure({ enterDuration: 0, leaveDuration: 0 });
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.rule({
      when: (w) => w.state(select.stateHandles.open).eq(true),
      intent: (i) => i.feedback.material.use({ intent: 'liquid-glass' }),
    });

    // Prefer room for text and the indicator even when the anchor is narrow.
    // The available-width maximum still wins; no hard minimum escapes the viewport.
    def.feedback.style.use(
      tw(
        'z-50 min-w-0 w-[max(var(--proto-ui-anchor-width),12rem)] max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-x-hidden overflow-y-auto outline-none rounded-2xl border border-border bg-secondary text-secondary-foreground p-2 shadow-md'
      )
    );
  },
});

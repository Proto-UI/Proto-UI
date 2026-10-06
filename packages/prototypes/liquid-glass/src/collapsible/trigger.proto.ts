import { definePrototype, tw } from '@proto.ui/core';
import { asCollapsibleTrigger } from '@proto.ui/prototypes-base/collapsible';
import type {
  LiquidGlassCollapsibleTriggerProps,
  LiquidGlassCollapsibleTriggerExposes,
} from './types';

// P-LIQUID-GLASS-COLLAPSIBLE-TRIGGER-BASE-INHERITANCE: Base is the only semantic owner.
// Explicit optical intent uses the shared material owner; actual host paint remains separately verified.
// Do not substitute adaptive/native backdrop blur for an explicit glass request.
const collapsibleTrigger = definePrototype<
  LiquidGlassCollapsibleTriggerProps,
  LiquidGlassCollapsibleTriggerExposes
>({
  name: 'liquid-glass-collapsible-trigger',
  setup(def) {
    const state = asCollapsibleTrigger().stateHandles;
    if (!state) throw new Error('[liquid-glass-collapsible-trigger] Missing Base state handles.');
    const { hovered, pressed, focusVisible, disabled } = state;
    // P-LIQUID-GLASS-COLLAPSIBLE-TRIGGER-MATERIAL-INTENT: one owned slot,
    // complete opaque style fallback, and no adaptive/native-blur substitution.
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    for (const isPressed of [false, true]) {
      def.rule({
        when: (w) => w.state(pressed).eq(isPressed),
        intent: (i) =>
          i.feedback.material.use({
            intent: 'liquid-glass',
            deformation: { kind: 'press', phase: isPressed ? 'pressed' : 'rest' },
          }),
      });
    }

    // P-LIQUID-GLASS-COLLAPSIBLE-TRIGGER-VISUAL-SAFETY: no fixed width/height or clipped long label.
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground wrap-anywhere whitespace-pre-wrap text-left cursor-pointer select-none inline-flex items-center justify-start rounded-xl border border-border bg-secondary px-5 py-3 text-sm font-medium shadow-sm'
      )
    );
    def.rule({
      when: (w) => w.state(hovered).eq(true),
      intent: (i) => i.feedback.style.use(tw('shadow-md')),
    });
    def.rule({
      when: (w) => w.state(pressed).eq(true),
      intent: (i) => i.feedback.style.use(tw('shadow-xs')),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'outline-none forced-colors-focus-outline ring-2 ring-ring ring-offset-2 ring-offset-background'
          )
        ),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 pointer-events-none cursor-default')),
    });
  },
});

export default collapsibleTrigger;

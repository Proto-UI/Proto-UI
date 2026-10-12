import { asHitParticipation } from '@proto.ui/hooks';
import { definePrototype, tw } from '@proto.ui/core';
import { asSwitchRoot } from '@proto.ui/prototypes-base/switch';
import type { ShadcnSwitchRootExposes, ShadcnSwitchRootProps } from './types';

// Fixed Base+Nova c2a67849: track dimensions are px; Thumb size remains rem.
// Padding-box static acquisition follows the fixed upstream pseudo-element inset.
const ROOT_BASE_TOKENS = [
  'peer',
  'relative',
  'inline-flex',
  'h-[18.4px]',
  'w-[32px]',
  'shrink-0',
  'items-center',
  'rounded-full',
  'border',
  'border-transparent',
  'p-0',

  'outline-none',
  'bg-input',
  'select-none',
].join(' ');

const switchRoot = definePrototype<ShadcnSwitchRootProps, ShadcnSwitchRootExposes>({
  name: 'shadcn-switch-root',
  setup(def) {
    // P-SHADCN-SWITCH-BASE-INHERITANCE,
    // P-SHADCN-SWITCH-CURRENT-BASE-DEVIATIONS
    const switchState = asSwitchRoot().stateHandles;
    if (!switchState) {
      throw new Error('[shadcn-switch-root] asSwitchRoot must project Switch root state handles.');
    }
    const { checked, disabled, focusVisible } = switchState;
    asHitParticipation().configure({
      staticHitInset: {
        top: { value: 0.5, unit: 'rem' },
        bottom: { value: 0.5, unit: 'rem' },
        left: { value: 0.75, unit: 'rem' },
        right: { value: 0.75, unit: 'rem' },
      },
    });
    // P-SHADCN-SWITCH-CURRENT-VISUAL-SURFACE
    def.feedback.style.transition({
      properties: ['background-color'],
      durationMs: 150,
      easing: [0.4, 0, 0.2, 1],
    });
    def.feedback.style.use(tw(ROOT_BASE_TOKENS));

    // P-SHADCN-SWITCH-STATE-DRIVEN-STYLES
    def.rule({
      when: (w) => w.state(checked).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-primary')),
    });

    def.rule({
      // Use the Switch-root focusVisible handle so web style projection can emit
      // data-[focus-visible] tokens for custom-element focus.
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-ring ring-3 ring-ring/50')),
    });

    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50 cursor-not-allowed')),
    });

    def.rule({
      when: (w) => w.all(w.meta('colorScheme').eq('dark'), w.state(checked).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-input/80')),
    });

    def.rule({
      when: (w) => w.all(w.meta('colorScheme').eq('dark'), w.state(checked).eq(true)),
      intent: (i) => i.feedback.style.use(tw('bg-primary')),
    });
  },
});

/**
 * P-SHADCN-SWITCH-DIRECT-ENTRY exposes the current Root projection.
 * P-SHADCN-SWITCH-COMPATIBILITY-SUBSET and P-SHADCN-SWITCH-AS-CHILD-OMISSION
 * keep upstream parity outside the passing claim unless it is implemented and tested.
 */

export default switchRoot;

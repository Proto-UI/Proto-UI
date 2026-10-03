import { definePrototype, tw } from '@proto.ui/core';
import { asSwitchRoot } from '@proto.ui/prototypes-base/switch';
import { BRUTALIST_DISABLED_TOKENS, BRUTALIST_FOCUS_TOKENS } from '../style';
import type { BrutalistSwitchRootExposes, BrutalistSwitchRootProps } from './types';

// Source: neobrutalism-components switch.tsx@3306a802, default 24x48 capsule.
// The private visual Thumb remains the only checked-motion source.
const ROOT_BASE_TOKENS = [
  'peer',
  'inline-flex',
  'relative',
  'h-6',
  'w-12',
  'shrink-0',
  'items-center',
  'rounded-full',
  'border-2',
  'border-black',
  'bg-secondary-background',
  'p-0',
  'outline-none',
  'select-none',
  'font-sans',
  'font-medium',
  'transition-colors',
  'duration-150',
].join(' ');

const switchRoot = definePrototype<BrutalistSwitchRootProps, BrutalistSwitchRootExposes>({
  // P-BRUTALIST-SWITCH-ENTRY
  name: 'brutalist-switch-root',
  setup(def) {
    // P-BRUTALIST-SWITCH-BASE-INHERITANCE
    const switchState = asSwitchRoot().stateHandles;
    if (!switchState) {
      throw new Error(
        '[brutalist-switch-root] asSwitchRoot must project Switch root state handles.'
      );
    }
    const { checked, disabled, focusVisible } = switchState;

    def.feedback.style.use(tw(ROOT_BASE_TOKENS));

    // P-BRUTALIST-SWITCH-CHECKED-PAIR-INVARIANT — checked swaps fill only, never padding
    def.rule({
      when: (w) => w.state(checked).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-main')),
    });
    // P-BRUTALIST-SWITCH-INTERACTION — focus-visible
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS)),
    });
    // P-BRUTALIST-SWITCH-INTERACTION — disabled
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_DISABLED_TOKENS)),
    });
  },
});

export default switchRoot;

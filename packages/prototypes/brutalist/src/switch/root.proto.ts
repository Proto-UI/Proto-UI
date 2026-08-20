import { definePrototype, tw } from '@proto.ui/core';
import { asSwitchRoot } from '@proto.ui/prototypes-base/switch';
import { BRUTALIST_DISABLED_TOKENS, BRUTALIST_FOCUS_TOKENS } from '../style';
import type { BrutalistSwitchRootExposes, BrutalistSwitchRootProps } from './types';

// P-BRUTALIST-SWITCH-VISUAL-GRAMMAR — square track: rounded-none, border-2 border-black,
// hard shadow, bg-secondary-background resting fill, symmetric px-0.5 that never swaps.
const ROOT_BASE_TOKENS = [
  'peer',
  'inline-flex',
  'h-7',
  'w-12',
  'shrink-0',
  'items-center',
  'rounded-none',
  'border-2',
  'border-black',
  'bg-secondary-background',
  'px-0.5',
  'shadow-[3px_3px_0_0_#000]',
  'outline-none',
  'select-none',
  'transition-none',
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
    const { checked, disabled, focusVisible, pressed } = switchState;

    def.feedback.style.use(tw(ROOT_BASE_TOKENS));

    // P-BRUTALIST-SWITCH-CHECKED-PAIR-INVARIANT — checked swaps fill only, never padding
    def.rule({
      when: (w) => w.state(checked).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-sky')),
    });
    // P-BRUTALIST-SWITCH-INTERACTION — press
    def.rule({
      when: (w) => w.state(pressed).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-coral shadow-none')),
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

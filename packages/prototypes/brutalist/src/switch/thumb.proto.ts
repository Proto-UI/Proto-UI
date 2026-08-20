import { definePrototype, tw } from '@proto.ui/core';
import { asSwitchThumb } from '@proto.ui/prototypes-base/switch';
import type { BrutalistSwitchThumbExposes, BrutalistSwitchThumbProps } from './types';

// P-BRUTALIST-SWITCH-THUMB-VISUAL-GRAMMAR — square size-5 block, border-2 border-black,
// hard shadow, bg-foreground resting fill, bg-canary when checked.
const THUMB_TOKENS = [
  'pointer-events-none',
  'block',
  'size-5',
  'rounded-none',
  'border-2',
  'border-black',
  'bg-foreground',
  'shadow-[3px_3px_0_0_#000]',
  'translate-x-0',
  'transition-none',
].join(' ');

const switchThumb = definePrototype<BrutalistSwitchThumbProps, BrutalistSwitchThumbExposes>({
  // P-BRUTALIST-SWITCH-THUMB-ENTRY
  name: 'brutalist-switch-thumb',
  setup(def) {
    // P-BRUTALIST-SWITCH-THUMB-BASE-INHERITANCE
    const switchState = asSwitchThumb().stateHandles;
    if (!switchState) {
      throw new Error(
        '[brutalist-switch-thumb] asSwitchThumb must project Switch thumb state handles.'
      );
    }
    // Base Switch thumb only projects checked/disabled. Press feedback remains on Root.
    const { checked } = switchState;
    def.feedback.style.use(tw(THUMB_TOKENS));
    // P-BRUTALIST-SWITCH-THUMB-SINGLE-MOVEMENT — checked: translate + canary fill in one rule.
    // The root's symmetric px-0.5 padding stays constant; the thumb is the sole movement source.
    def.rule({
      when: (w) => w.state(checked).eq(true),
      intent: (i) => i.feedback.style.use(tw('translate-x-5 bg-canary')),
    });
  },
});

export default switchThumb;

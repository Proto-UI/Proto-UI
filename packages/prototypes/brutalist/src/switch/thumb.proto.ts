import { definePrototype, tw } from '@proto.ui/core';
import { asSwitchThumb } from '@proto.ui/prototypes-base/switch';
import type { BrutalistSwitchThumbExposes, BrutalistSwitchThumbProps } from './types';

// Source: switch.tsx@3306a802, 16px white disc and 20px checked travel.
// Physical placement keeps identical 6px end insets even in an RTL parent;
// only Thumb transform moves, and the containing Root never shifts padding.
const THUMB_TOKENS = [
  'pointer-events-none',
  'absolute',
  'left-1',
  'top-1/2',
  '-translate-y-1/2',
  'block',
  'size-4',
  'rounded-full',
  'border-2',
  'border-black',
  'bg-white',
  'translate-x-0',
  'transition-transform',
  'duration-150',
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
    // P-BRUTALIST-SWITCH-THUMB-SINGLE-MOVEMENT — checked: one 20px transform delta.
    def.rule({
      when: (w) => w.state(checked).eq(true),
      intent: (i) => i.feedback.style.use(tw('translate-x-5')),
    });
  },
});

export default switchThumb;

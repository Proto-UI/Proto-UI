import { definePrototype, tw } from '@proto.ui/core';
import { asToggle } from '@proto.ui/prototypes-base/toggle';
import {
  BRUTALIST_CONTROL_TOKENS,
  BRUTALIST_DISABLED_TOKENS,
  BRUTALIST_FOCUS_TOKENS,
  BRUTALIST_HOVER_LIFT_TOKENS,
  BRUTALIST_PRESS_TOKENS,
} from '../style';
import type { BrutalistToggleExposes, BrutalistToggleProps, BrutalistToggleSize } from './types';

const TOGGLE_BASE_TOKENS = [
  'group/brutalist-toggle',
  'inline-flex',
  'items-center',
  'justify-center',
  'gap-1',
  'font-bold',
  'uppercase',
  'whitespace-nowrap',
  'select-none',
  BRUTALIST_CONTROL_TOKENS,
].join(' ');

const SIZE_TOKENS: Record<BrutalistToggleSize, string> = {
  default: `${BRUTALIST_CONTROL_TOKENS} h-10 min-w-10 px-3 text-sm`,
  sm: `${BRUTALIST_CONTROL_TOKENS} h-9 min-w-9 px-2.5 text-xs`,
  lg: `${BRUTALIST_CONTROL_TOKENS} h-12 min-w-12 px-4 text-base`,
};

const ACTIVE_FRAME_TOKENS = 'shadow-[inset_0_0_0_2px_#000,3px_3px_0_0_#000]';
const ACTIVE_PRESSED_FRAME_TOKENS = 'shadow-[inset_0_0_0_2px_#000]';

const toggle = definePrototype<BrutalistToggleProps, BrutalistToggleExposes>({
  // P-BRUTALIST-TOGGLE-ENTRY
  name: 'brutalist-toggle',
  setup(def) {
    // P-BRUTALIST-TOGGLE-SIZE-PROP
    def.props.define({
      size: { type: 'enum', empty: 'fallback', options: ['default', 'sm', 'lg'] },
      active: { type: 'boolean', empty: 'fallback' },
      defaultActive: { type: 'boolean', empty: 'fallback' },
      disabled: { type: 'boolean', empty: 'fallback' },
    });
    // P-BRUTALIST-TOGGLE-DEFAULTS
    def.props.setDefaults({ size: 'default', defaultActive: false, disabled: false });

    // P-BRUTALIST-TOGGLE-BASE-INHERITANCE
    const toggleState = asToggle().stateHandles;
    if (!toggleState) {
      throw new Error('[brutalist-toggle] asToggle must project Toggle state handles.');
    }
    const { active, disabled, hovered, focusVisible, pressed } = toggleState;

    // P-BRUTALIST-TOGGLE-VISUAL-GRAMMAR
    def.feedback.style.use(tw(TOGGLE_BASE_TOKENS));

    (Object.keys(SIZE_TOKENS) as BrutalistToggleSize[]).forEach((size) => {
      def.rule({
        when: (w) => w.prop('size').eq(size),
        intent: (i) => i.feedback.style.use(tw(SIZE_TOKENS[size])),
      });
    });

    // P-BRUTALIST-TOGGLE-PAIR-INVARIANT — active pair
    def.rule({
      when: (w) => w.state(active).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-main text-main-foreground')),
    });
    // P-BRUTALIST-TOGGLE-ACTIVE-SIGNAL — an inset frame persists independently of color.
    def.rule({
      when: (w) => w.all(w.state(active).eq(true), w.state(pressed).eq(false)),
      intent: (i) => i.feedback.style.use(tw(ACTIVE_FRAME_TOKENS)),
    });
    // P-BRUTALIST-TOGGLE-INTERACTION — hover lift (non-active)
    def.rule({
      when: (w) =>
        w.all(w.state(hovered).eq(true), w.state(active).eq(false), w.state(pressed).eq(false)),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_HOVER_LIFT_TOKENS)),
    });
    // P-BRUTALIST-TOGGLE-INTERACTION — press
    def.rule({
      when: (w) => w.state(pressed).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_PRESS_TOKENS)),
    });
    // Keep the active inset marker while pressed; only the outer elevation collapses.
    def.rule({
      when: (w) => w.all(w.state(active).eq(true), w.state(pressed).eq(true)),
      intent: (i) => i.feedback.style.use(tw(ACTIVE_PRESSED_FRAME_TOKENS)),
    });
    // P-BRUTALIST-TOGGLE-INTERACTION — focus-visible
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS)),
    });
    // P-BRUTALIST-TOGGLE-INTERACTION — disabled
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_DISABLED_TOKENS)),
    });
  },
});

export type {
  BrutalistToggleProps,
  BrutalistToggleExposes,
  BrutalistToggleStateHandles,
  BrutalistToggleAsHookContract,
} from './types';
export default toggle;

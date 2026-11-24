import { definePrototype, tw } from '@proto.ui/core';
import { asPopoverTrigger, type PopoverTriggerExposes } from '@proto.ui/prototypes-base/popover';
import type { PopoverTriggerProps } from './types';
import {
  BRUTALIST_CONTROL_TOKENS,
  BRUTALIST_FOCUS_TOKENS,
  BRUTALIST_PRESS_TOKENS,
  BRUTALIST_MOTION_HIT_TOKENS,
  BRUTALIST_DISABLED_TOKENS,
} from '../style';

export default definePrototype<PopoverTriggerProps, PopoverTriggerExposes>({
  name: 'brutalist-popover-trigger',
  modules: asPopoverTrigger.modules,
  setup(def) {
    const behavior = asPopoverTrigger();
    def.props.define({
      presentation: { type: 'enum', empty: 'fallback', options: ['default', 'navigation'] },
    });
    def.props.setDefaults({ presentation: 'default' });
    // Raised Brutalist control grammar: 5px rounded-base, 2px black border,
    // 4px hard shadow, DM Sans medium, instant press-only snap (no hover lift).
    def.feedback.style.use(tw('transition-none'));
    def.rule({
      when: (w) => w.prop('presentation').eq('default'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            BRUTALIST_CONTROL_TOKENS,
            'inline-flex items-center justify-center px-3 py-2 text-sm cursor-pointer outline-none'
          )
        ),
    });
    def.rule({
      when: (w) => w.prop('presentation').eq('navigation'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            BRUTALIST_CONTROL_TOKENS,
            'inline-flex shrink-0 items-center justify-center gap-2 size-10 whitespace-nowrap cursor-pointer outline-none'
          )
        ),
    });
    const state = behavior.getState!;
    def.rule({
      when: (w) => w.all(w.state(state('pressed')!).eq(true), w.state(state('disabled')!).eq(false)),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_PRESS_TOKENS, BRUTALIST_MOTION_HIT_TOKENS)),
    });
    def.rule({
      when: (w) => w.state(state('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS)),
    });
    def.rule({
      when: (w) => w.state(state('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_DISABLED_TOKENS, 'cursor-not-allowed')),
    });
    return behavior.render;
  },
});

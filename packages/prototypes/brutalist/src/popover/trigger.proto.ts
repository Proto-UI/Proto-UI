import { definePrototype, tw } from '@proto.ui/core';
import { asPopoverTrigger, type PopoverTriggerExposes } from '@proto.ui/prototypes-base/popover';
import type { PopoverTriggerProps } from './types';
import {
  BRUTALIST_CONTROL_TOKENS,
  BRUTALIST_FOCUS_TOKENS,
  BRUTALIST_HOVER_LIFT_TOKENS,
  BRUTALIST_PRESS_TOKENS,
  BRUTALIST_MOTION_HIT_TOKENS,
  BRUTALIST_DISABLED_TOKENS,
} from '../style';

export default definePrototype<PopoverTriggerProps, PopoverTriggerExposes>({
  name: 'brutalist-popover-trigger',
  setup(def) {
    const behavior = asPopoverTrigger();
    def.props.define({
      presentation: { type: 'enum', empty: 'fallback', options: ['default', 'navigation'] },
    });
    def.props.setDefaults({ presentation: 'default' });
    def.rule({
      when: (w) => w.prop('presentation').eq('default'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'inline-flex items-center justify-center rounded-none border-2 border-foreground bg-background px-3 py-2 text-sm font-bold outline-none'
          )
        ),
    });
    const state = behavior.getState!;
    def.rule({
      when: (w) =>
        w.all(w.prop('presentation').eq('default'), w.state(state('focusVisible')!).eq(true)),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2')),
    });
    def.rule({
      when: (w) =>
        w.all(w.prop('presentation').eq('default'), w.state(state('disabled')!).eq(true)),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
    });
    def.rule({
      when: (w) => w.prop('presentation').eq('navigation'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            BRUTALIST_CONTROL_TOKENS,
            'inline-flex shrink-0 items-center justify-center gap-2 size-10 whitespace-nowrap'
          )
        ),
    });
    for (const [fact, tokens] of [
      ['hovered', tw(BRUTALIST_HOVER_LIFT_TOKENS, BRUTALIST_MOTION_HIT_TOKENS)],
      ['pressed', tw(BRUTALIST_PRESS_TOKENS, BRUTALIST_MOTION_HIT_TOKENS)],
      ['focusVisible', tw(BRUTALIST_FOCUS_TOKENS)],
      ['disabled', tw(BRUTALIST_DISABLED_TOKENS)],
    ] as const)
      def.rule({
        when: (w) => w.all(w.prop('presentation').eq('navigation'), w.state(state(fact)!).eq(true)),
        intent: (i) => i.feedback.style.use(tokens),
      });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('presentation').eq('navigation'),
          w.meta('preference.reducedMotion').eq('no-preference')
        ),
      intent: (i) => i.feedback.style.use(tw('transition-all')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('presentation').eq('navigation'),
          w.not(w.meta('preference.reducedMotion').eq('no-preference'))
        ),
      intent: (i) => i.feedback.style.use(tw('transition-none')),
    });
  },
});

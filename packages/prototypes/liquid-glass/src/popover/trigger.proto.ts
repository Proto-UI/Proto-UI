import { definePrototype, tw } from '@proto.ui/core';
import {
  COMMAND_DISABLED,
  COMMAND_FOCUS,
  COMMAND_HOVER,
  COMMAND_PRESS,
} from '../interactive-surface';
import { asPopoverTrigger, type PopoverTriggerExposes } from '@proto.ui/prototypes-base/popover';
import type { PopoverTriggerProps } from './types';

export default definePrototype<PopoverTriggerProps, PopoverTriggerExposes>({
  name: 'liquid-glass-popover-trigger',
  modules: asPopoverTrigger.modules,
  setup(def) {
    const behavior = asPopoverTrigger();
    def.props.define({
      prominence: { type: 'enum', empty: 'fallback', options: ['regular', 'prominent'] },
    });
    def.props.setDefaults({ prominence: 'regular' });
    def.feedback.style.use(
      tw(
        'inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-medium font-sans cursor-pointer outline-none select-none'
      )
    );
    def.rule({
      when: (w) => w.prop('prominence').eq('regular'),
      intent: (i) =>
        i.feedback.style.use(tw('border-border bg-secondary text-secondary-foreground shadow-xs')),
    });
    def.rule({
      when: (w) => w.prop('prominence').eq('prominent'),
      intent: (i) =>
        i.feedback.style.use(tw('border-transparent bg-primary text-primary-foreground shadow-sm')),
    });
    def.rule({
      when: (w) => w.not(w.meta('preference.reducedMotion').eq('reduce')),
      intent: (i) => i.feedback.style.use(tw('transition-[color,box-shadow,background-color]')),
    });
    def.rule({
      when: (w) => w.meta('preference.reducedMotion').eq('reduce'),
      intent: (i) => i.feedback.style.use(tw('transition-none')),
    });
    const state = behavior.getState!;
    def.rule({
      when: (w) =>
        w.all(
          w.state(state('hovered')!).eq(true),
          w.state(state('pressed')!).eq(false),
          w.state(state('disabled')!).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw(COMMAND_HOVER)),
    });
    def.rule({
      when: (w) => w.all(w.state(state('pressed')!).eq(true), w.state(state('disabled')!).eq(false)),
      intent: (i) => i.feedback.style.use(tw(COMMAND_PRESS)),
    });
    def.rule({
      when: (w) => w.state(state('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) => w.state(state('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_DISABLED)),
    });
    return behavior.render;
  },
});

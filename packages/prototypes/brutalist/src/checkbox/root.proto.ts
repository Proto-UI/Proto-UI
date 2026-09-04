import { definePrototype, tw } from '@proto.ui/core';
import { asCheckboxRoot } from '@proto.ui/prototypes-base/checkbox';
import { BRUTALIST_DISABLED_TOKENS, BRUTALIST_FOCUS_TOKENS } from '../style';
import type { BrutalistCheckboxRootExposes, BrutalistCheckboxRootProps } from './types';

const ROOT_SURFACE_TOKENS = [
  'inline-flex',
  'h-5',
  'w-5',
  'shrink-0',
  'items-center',
  'justify-center',
  'rounded-none',
  'border-2',
  'border-black',
  'bg-main',
  'text-main-foreground',
  'shadow-[3px_3px_0_0_#000]',
  'outline-none',
  'select-none',
  'transition-none',
].join(' ');

const checkboxRoot = definePrototype<BrutalistCheckboxRootProps, BrutalistCheckboxRootExposes>({
  name: 'brutalist-checkbox-root',
  setup(def) {
    const state = asCheckboxRoot().stateHandles;
    if (!state) {
      throw new Error(
        '[brutalist-checkbox-root] asCheckboxRoot must project Checkbox root state handles.'
      );
    }
    const { checked, indeterminate, disabled, focusVisible, pressed } = state;

    def.feedback.style.use(tw(ROOT_SURFACE_TOKENS));

    def.rule({
      when: (when) => when.all(when.state(checked).eq(true), when.state(indeterminate).eq(false)),
      intent: (intent) => intent.feedback.style.use(tw('bg-foreground text-background')),
    });
    def.rule({
      when: (when) => when.state(pressed).eq(true),
      intent: (intent) => intent.feedback.style.use(tw('shadow-none')),
    });
    def.rule({
      when: (when) => when.state(focusVisible).eq(true),
      intent: (intent) => intent.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS)),
    });
    def.rule({
      when: (when) => when.state(disabled).eq(true),
      intent: (intent) => intent.feedback.style.use(tw(BRUTALIST_DISABLED_TOKENS)),
    });
  },
});

export default checkboxRoot;

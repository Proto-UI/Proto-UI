import { definePrototype, tw } from '@proto.ui/core';
import { asCheckboxRoot } from '@proto.ui/prototypes-base/checkbox';
import { BRUTALIST_DISABLED_TOKENS, BRUTALIST_FOCUS_TOKENS } from '../style';
import type { BrutalistCheckboxRootExposes, BrutalistCheckboxRootProps } from './types';

const ROOT_BASE_TOKENS = [
  'peer',
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
  'shadow-[3px_3px_0_0_#000]',
  'outline-none',
  'select-none',
  'transition-none',
].join(' ');

const checkboxRoot = definePrototype<BrutalistCheckboxRootProps, BrutalistCheckboxRootExposes>({
  name: 'brutalist-checkbox-root',
  setup(def) {
    const checkbox = asCheckboxRoot();
    const state = checkbox.stateHandles;
    if (!state) {
      throw new Error(
        '[brutalist-checkbox-root] asCheckboxRoot must project Checkbox root state handles.'
      );
    }
    const { checked, disabled, focusVisible, pressed } = state;

    def.feedback.style.use(tw(ROOT_BASE_TOKENS));

    def.rule({
      when: (w) => w.state(checked).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-foreground text-background')),
    });
    def.rule({
      when: (w) => w.state(pressed).eq(true),
      intent: (i) => i.feedback.style.use(tw('shadow-none')),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS)),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_DISABLED_TOKENS)),
    });
  },
});

export default checkboxRoot;

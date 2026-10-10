import { definePrototype, tw } from '@proto.ui/core';
import { asCheckboxRoot } from '@proto.ui/prototypes-base/checkbox';
import { BRUTALIST_DISABLED_TOKENS, BRUTALIST_FOCUS_TOKENS } from '../style';
import type { BrutalistCheckboxRootExposes, BrutalistCheckboxRootProps } from './types';

// Keep the existing 20px pointer target until a governed static hit envelope
// can support the source's 16px visual box without shrinking activation reach.
// Keep its existing internal 2px frame too: outline-border is not yet supported
// by the current style closure. Do not disguise that missing capability.
const ROOT_SURFACE_TOKENS = [
  'flex',
  'h-5',
  'w-5',
  'shrink-0',
  'items-center',
  'justify-center',
  'rounded-none',
  'border-2',
  'border-border',
  'outline-none',
  'bg-transparent',
  'text-foreground',
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
    const { checked, indeterminate, disabled, focusVisible } = state;

    def.feedback.style.use(tw(ROOT_SURFACE_TOKENS));

    def.rule({
      when: (when) => when.all(when.state(checked).eq(true), when.state(indeterminate).eq(false)),
      intent: (intent) => intent.feedback.style.use(tw('bg-main text-main-foreground')),
    });
    def.rule({
      when: (when) => when.state(indeterminate).eq(true),
      intent: (intent) => intent.feedback.style.use(tw('bg-main text-main-foreground')),
    });
    def.rule({
      when: (when) => when.state(focusVisible).eq(true),
      intent: (intent) => intent.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS)),
    });
    def.rule({
      when: (when) => when.state(disabled).eq(true),
      intent: (intent) =>
        intent.feedback.style.use(tw(`${BRUTALIST_DISABLED_TOKENS} cursor-not-allowed`)),
    });
  },
});

export default checkboxRoot;

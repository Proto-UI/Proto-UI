import { definePrototype, tw } from '@proto.ui/core';
import { asRadioGroupItem } from '@proto.ui/prototypes-base/radio-group';
import type { ShadcnRadioGroupItemExposes, ShadcnRadioGroupItemProps } from './types';

const ITEM_TOKENS = [
  'inline-flex',
  'items-center',
  'justify-center',
  'aspect-square',
  'size-4',
  'shrink-0',
  'rounded-full',
  'border',
  'border-input',
  'bg-transparent',
  'text-primary',
  'shadow-xs',
  'transition-[color,box-shadow]',
  'outline-none',
].join(' ');

const radioGroupItem = definePrototype<ShadcnRadioGroupItemProps, ShadcnRadioGroupItemExposes>({
  name: 'shadcn-radio-group-item',
  setup(def) {
    const state = asRadioGroupItem().stateHandles;
    if (!state) {
      throw new Error(
        '[shadcn-radio-group-item] asRadioGroupItem must project Item state handles.'
      );
    }
    def.feedback.style.use(tw(ITEM_TOKENS));
    def.rule({
      when: (when) => when.state(state.focusVisible).eq(true),
      intent: (intent) => intent.feedback.style.use(tw('border-ring ring-3 ring-ring/50')),
    });
    def.rule({
      when: (when) => when.state(state.disabled).eq(true),
      intent: (intent) => intent.feedback.style.use(tw('cursor-not-allowed opacity-50')),
    });
    def.rule({
      when: (when) => when.meta('colorScheme').eq('dark'),
      intent: (intent) => intent.feedback.style.use(tw('bg-input/30')),
    });
  },
});

export default radioGroupItem;

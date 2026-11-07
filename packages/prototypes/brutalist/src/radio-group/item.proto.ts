import { definePrototype, tw } from '@proto.ui/core';
import { asRadioGroupItem } from '@proto.ui/prototypes-base/radio-group';
import { BRUTALIST_DISABLED_TOKENS, BRUTALIST_FOCUS_TOKENS } from '../style';
import type { BrutalistRadioGroupItemExposes, BrutalistRadioGroupItemProps } from './types';

// Source: neobrutalism-components radio-group.tsx@3306a802 RadioPrimitive.Root.
// The pinned item is a 16px circular 2px-bordered control; checked changes only
// the indicator dot, never the item fill or border, so no checked rule exists
// here. Focus and disabled reuse the family surface tokens.
const ITEM_SURFACE_TOKENS = [
  'inline-flex',
  'aspect-square',
  'size-4',
  'shrink-0',
  'items-center',
  'justify-center',
  'rounded-full',
  'border-2',
  'border-border',
  'bg-transparent',
  'text-black',
  'outline-none',
  'select-none',
  'transition-none',
].join(' ');

const radioGroupItem = definePrototype<
  BrutalistRadioGroupItemProps,
  BrutalistRadioGroupItemExposes
>({
  name: 'brutalist-radio-group-item',
  setup(def) {
    const state = asRadioGroupItem().stateHandles;
    if (!state) {
      throw new Error(
        '[brutalist-radio-group-item] asRadioGroupItem must project Item state handles.'
      );
    }
    const { disabled, focusVisible } = state;

    def.feedback.style.use(tw(ITEM_SURFACE_TOKENS));

    def.rule({
      when: (when) => when.state(focusVisible).eq(true),
      intent: (intent) => intent.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS)),
    });
    def.rule({
      when: (when) => when.state(disabled).eq(true),
      intent: (intent) =>
        intent.feedback.style.use(tw(`${BRUTALIST_DISABLED_TOKENS} cursor-not-allowed`)),
    });
    // Base owns checked, roving focus and activation. Upstream invalid styles
    // stay omitted: this layer adds no validation owner and no checked variant.
  },
});

export default radioGroupItem;

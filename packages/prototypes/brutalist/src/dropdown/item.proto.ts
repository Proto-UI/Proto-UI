import { definePrototype, tw } from '@proto.ui/core';
import { asDropdownItem } from '@proto.ui/prototypes-base/dropdown';
import type { BrutalistDropdownItemExposes, BrutalistDropdownItemProps } from './types';

const ITEM_BASE_TOKENS =
  'relative flex w-full cursor-default select-none items-center gap-2 rounded-none bg-secondary-background px-2 py-1.5 text-left font-mono text-sm text-foreground outline-none';

const dropdownItem = definePrototype<BrutalistDropdownItemProps, BrutalistDropdownItemExposes>({
  name: 'brutalist-dropdown-item',
  setup(def) {
    // P-BRUTALIST-DROPDOWN-MENU-ITEM-PROPS,
    // P-BRUTALIST-DROPDOWN-MENU-ITEM-DEFAULTS
    def.props.define({
      inset: { type: 'boolean', empty: 'fallback' },
      variant: { type: 'enum', empty: 'fallback', options: ['default', 'destructive'] },
    });
    def.props.setDefaults({ inset: false, variant: 'default' });

    // P-BRUTALIST-DROPDOWN-MENU-ITEM-BASE-INHERITANCE
    const itemState = asDropdownItem().stateHandles;
    if (!itemState) {
      throw new Error('[brutalist-dropdown-item] Dropdown Item must project command states.');
    }
    const { disabled, focused, focusVisible, pressed, active } = itemState;

    // P-BRUTALIST-DROPDOWN-MENU-ITEM-PAIR-INVARIANT (resting base pair: bg-secondary-background text-foreground)
    def.feedback.style.use(tw(ITEM_BASE_TOKENS));

    // P-BRUTALIST-DROPDOWN-MENU-ITEM-PROPS (inset: pl-8 left pad)
    def.rule({
      when: (w) => w.prop('inset').eq(true),
      intent: (i) => i.feedback.style.use(tw('pl-8')),
    });

    // P-BRUTALIST-DROPDOWN-MENU-ITEM-PAIR-INVARIANT (destructive resting text pairing).
    def.rule({
      when: (w) => w.prop('variant').eq('destructive'),
      intent: (i) => i.feedback.style.use(tw('text-destructive-ink')),
    });

    // P-BRUTALIST-DROPDOWN-MENU-ITEM-PAIR-INVARIANT,
    // P-BRUTALIST-DROPDOWN-MENU-ITEM-INTERACTION
    // Default variant: any interaction (active includes pointer.enter while the
    // menu is open, plus keyboard focus/press) highlights with the main pair.
    def.rule({
      when: (w) =>
        w.all(
          w.prop('variant').eq('default'),
          w.any(
            w.state(active).eq(true),
            w.state(focused).eq(true),
            w.state(focusVisible).eq(true),
            w.state(pressed).eq(true)
          )
        ),
      intent: (i) => i.feedback.style.use(tw('bg-main text-main-foreground')),
    });

    // P-BRUTALIST-DROPDOWN-MENU-ITEM-PAIR-INVARIANT,
    // P-BRUTALIST-DROPDOWN-MENU-ITEM-INTERACTION
    // Destructive variant: the same interaction states keep the destructive
    // pair instead of being overridden by the main accent (review defect:
    // white background with pale pink text under active/disabled).
    def.rule({
      when: (w) =>
        w.all(
          w.prop('variant').eq('destructive'),
          w.any(
            w.state(active).eq(true),
            w.state(focused).eq(true),
            w.state(focusVisible).eq(true),
            w.state(pressed).eq(true)
          )
        ),
      intent: (i) => i.feedback.style.use(tw('bg-destructive text-destructive-foreground')),
    });

    // P-BRUTALIST-DROPDOWN-MENU-ITEM-PAIR-INVARIANT,
    // P-BRUTALIST-DROPDOWN-MENU-ITEM-INTERACTION
    // Disabled retains an explicit paper + muted-foreground pair so the row is
    // never a blank white panel with un-paired text.
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('pointer-events-none bg-secondary-background text-muted-foreground')
        ),
    });
  },
});

/** P-BRUTALIST-DROPDOWN-MENU-ITEM-ENTRY */

export default dropdownItem;

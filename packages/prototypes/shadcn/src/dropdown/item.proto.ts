import { definePrototype, tw } from '@proto.ui/core';
import { asDropdownItem } from '@proto.ui/prototypes-base/dropdown';
import type { ShadcnDropdownItemExposes, ShadcnDropdownItemProps } from './types';

const ITEM_BASE_TOKENS =
  'relative flex w-full cursor-default select-none items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm outline-none transition-colors';

const dropdownItem = definePrototype<ShadcnDropdownItemProps, ShadcnDropdownItemExposes>({
  name: 'shadcn-dropdown-item',
  setup(def) {
    // P-SHADCN-DROPDOWN-MENU-ITEM-VISUAL-PROPS
    def.props.define({
      inset: { type: 'boolean', empty: 'fallback' },
      variant: { type: 'enum', empty: 'fallback', options: ['default', 'destructive'] },
    });
    def.props.setDefaults({ inset: false, variant: 'default' });

    // P-SHADCN-DROPDOWN-MENU-ITEM-BASE-INHERITANCE,
    // P-SHADCN-DROPDOWN-MENU-ITEM-CURRENT-BASE-DEVIATIONS
    const itemState = asDropdownItem().stateHandles;
    if (!itemState) {
      throw new Error('[shadcn-dropdown-item] Dropdown Item must project command states.');
    }
    const { disabled, hovered, focused, focusVisible, pressed, active } = itemState;

    // P-SHADCN-DROPDOWN-MENU-ITEM-CURRENT-VISUAL-SURFACE
    def.feedback.style.use(tw(ITEM_BASE_TOKENS));
    // P-SHADCN-DROPDOWN-MENU-ITEM-STATE-DRIVEN-STYLES
    def.rule({
      when: (w) => w.prop('inset').eq(true),
      intent: (i) => i.feedback.style.use(tw('pl-7')),
    });
    def.rule({
      when: (w) => w.prop('variant').eq('destructive'),
      intent: (i) => i.feedback.style.use(tw('text-destructive')),
    });
    def.rule({
      when: (w) =>
        w.any(
          w.state(active).eq(true),
          w.state(hovered).eq(true),
          w.state(focused).eq(true),
          w.state(focusVisible).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.state(active).eq(true), w.prop('variant').eq('destructive')),
      intent: (i) => i.feedback.style.use(tw('bg-destructive/10 text-destructive')),
    });
    def.rule({
      when: (w) => w.state(pressed).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-accent/80')),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
    });
  },
});

/** P-SHADCN-DROPDOWN-MENU-ITEM-DIRECT-ENTRY; parity is bounded by P-SHADCN-DROPDOWN-MENU-ITEM-COMPATIBILITY-SUBSET. */

export default dropdownItem;

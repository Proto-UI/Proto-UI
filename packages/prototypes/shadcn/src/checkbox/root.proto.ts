import { definePrototype, tw } from '@proto.ui/core';
import { asCheckboxRoot } from '@proto.ui/prototypes-base/checkbox';
import type { ShadcnCheckboxRootExposes, ShadcnCheckboxRootProps } from './types';

const ROOT_BASE_TOKENS = [
  'size-4',
  'shrink-0',
  'rounded-[4px]',
  'border',
  'border-input',
  'bg-transparent',
  'shadow-xs',
  'outline-none',
].join(' ');

const checkboxRoot = definePrototype<ShadcnCheckboxRootProps, ShadcnCheckboxRootExposes>({
  name: 'shadcn-checkbox-root',
  setup(def) {
    // P-SHADCN-CHECKBOX-BASE-INHERITANCE,
    // P-SHADCN-CHECKBOX-CURRENT-BASE-DEVIATIONS
    const checkboxState = asCheckboxRoot().stateHandles;
    if (!checkboxState) {
      throw new Error(
        '[shadcn-checkbox-root] asCheckboxRoot must project Checkbox root state handles.'
      );
    }
    const { checked, indeterminate, disabled, focusVisible } = checkboxState;
    // P-SHADCN-CHECKBOX-CURRENT-VISUAL-SURFACE
    def.feedback.style.use(tw(ROOT_BASE_TOKENS));

    // P-SHADCN-CHECKBOX-STATE-DRIVEN-STYLES
    // Two rules rather than one `any`, because only `eq` and `all` reach the
    // web lowering; an `any` condition would leave the fill on the runtime plan
    // and paint the box after the first frame instead of with it.
    def.rule({
      when: (w) => w.state(checked).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground border-primary')),
    });

    // Mixed carries the same fill as checked; only the Indicator glyph separates
    // them.
    def.rule({
      when: (w) => w.state(indeterminate).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground border-primary')),
    });

    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-ring ring-ring/50 ring-3')),
    });

    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('cursor-not-allowed opacity-50')),
    });

    // The unfilled box is the only surface this tint is for. Without the two
    // state guards it also lands on the filled box and the fill loses.
    def.rule({
      when: (w) =>
        w.all(
          w.meta('colorScheme').eq('dark'),
          w.state(checked).eq(false),
          w.state(indeterminate).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-input/30')),
    });
  },
});

/**
 * P-SHADCN-CHECKBOX-DIRECT-ENTRY exposes the current Root projection.
 * P-SHADCN-CHECKBOX-COMPATIBILITY-SUBSET and P-SHADCN-CHECKBOX-AS-CHILD-OMISSION
 * keep upstream parity outside the passing claim unless it is implemented and tested.
 */

export default checkboxRoot;

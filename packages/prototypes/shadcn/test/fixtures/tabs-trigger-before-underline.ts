// Immutable pre-appearance recipe from c2cbb8d6; comparison fixture only.
import { definePrototype, tw } from '@proto.ui/core';
import { asTabsTrigger } from '@proto.ui/prototypes-base/tabs';
import type { ShadcnTabsTriggerExposes, ShadcnTabsTriggerProps } from '../../src/tabs/types';

const BASE_TOKENS = [
  'relative',
  'inline-flex',
  'h-[calc(100%_-_1px)]',
  'flex-1',
  'items-center',
  'justify-center',
  'gap-1.5',
  'whitespace-nowrap',
  'rounded-md',
  'border',
  'border-transparent',
  'px-2',
  'py-1',
  'text-sm',
  'font-medium',
  'transition-all',
  'outline-none',
  'text-foreground/60',
  'select-none',
].join(' ');

const tabsTrigger = definePrototype<ShadcnTabsTriggerProps, ShadcnTabsTriggerExposes>({
  name: 'shadcn-tabs-trigger',
  setup(def) {
    // P-SHADCN-TABS-TRIGGER-BASE-INHERITANCE,
    // P-SHADCN-TABS-TRIGGER-CURRENT-BASE-DEVIATIONS
    const triggerState = asTabsTrigger().stateHandles;
    if (!triggerState) {
      throw new Error(
        '[shadcn-tabs-trigger] asTabsTrigger must project Tabs trigger state handles.'
      );
    }
    const { disabled, hovered, focusVisible, selected } = triggerState;

    // P-SHADCN-TABS-TRIGGER-CURRENT-VISUAL-SURFACE
    def.feedback.style.use(tw(BASE_TOKENS));

    // P-SHADCN-TABS-TRIGGER-STATE-DRIVEN-STYLES
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('border-ring ring-3 ring-ring/50 outline-1 outline-ring')),
    });

    def.rule({
      when: (w) => w.state(selected).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-background text-foreground shadow-sm')),
    });

    def.rule({
      when: (w) => w.all(w.state(hovered).eq(true), w.state(selected).eq(false)),
      intent: (i) => i.feedback.style.use(tw('text-foreground')),
    });

    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
    });
  },
});

/** P-SHADCN-TABS-TRIGGER-DIRECT-ENTRY; parity remains bounded by P-SHADCN-TABS-TRIGGER-COMPATIBILITY-SUBSET. */

export default tabsTrigger;

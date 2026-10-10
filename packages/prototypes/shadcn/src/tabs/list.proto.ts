import { definePrototype, tw } from '@proto.ui/core';
import { asTabsList } from '@proto.ui/prototypes-base/tabs';
import type { ShadcnTabsListExposes, ShadcnTabsListProps } from './types';

const tabsList = definePrototype<ShadcnTabsListProps, ShadcnTabsListExposes>({
  name: 'shadcn-tabs-list',
  setup(def) {
    def.props.define({
      appearance: { type: 'enum', options: ['default', 'underline'], empty: 'fallback' },
    });
    def.props.setDefaults({ appearance: 'default' });
    // P-SHADCN-TABS-LIST-BASE-INHERITANCE, P-SHADCN-TABS-LIST-CURRENT-BASE-DEVIATIONS
    asTabsList();
    // P-SHADCN-TABS-LIST-CURRENT-VISUAL-SURFACE
    def.rule({
      when: (w) => w.prop('appearance').eq('default'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground'
          )
        ),
    });
    def.rule({
      when: (w) => w.prop('appearance').eq('underline'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'flex w-full min-w-0 h-auto flex-nowrap items-center justify-start gap-6 overflow-x-auto border-0 rounded-none bg-transparent p-0 text-muted-foreground shadow-none'
          )
        ),
    });
  },
});

/** P-SHADCN-TABS-LIST-DIRECT-ENTRY; parity remains bounded by P-SHADCN-TABS-LIST-COMPATIBILITY-SUBSET. */

export default tabsList;

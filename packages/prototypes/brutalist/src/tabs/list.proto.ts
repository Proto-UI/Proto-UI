import { definePrototype, tw } from '@proto.ui/core';
import { asTabsList } from '@proto.ui/prototypes-base/tabs';
import type { BrutalistTabsListExposes, BrutalistTabsListProps } from './types';

const tabsList = definePrototype<BrutalistTabsListProps, BrutalistTabsListExposes>({
  // P-BRUTALIST-TABS-LIST-ENTRY
  name: 'brutalist-tabs-list',
  setup(def) {
    def.props.define({
      appearance: { type: 'enum', options: ['default', 'underline'], empty: 'fallback' },
    });
    def.props.setDefaults({ appearance: 'default' });
    // P-BRUTALIST-TABS-LIST-BASE-INHERITANCE
    asTabsList();
    // P-BRUTALIST-TABS-LIST-VISUAL-GRAMMAR — rounded flat strip panel: rounded-base, border-2
    // border-black, hard shadow, bg-background fill, text-foreground, h-12, p-1.
    def.rule({
      when: (w) => w.prop('appearance').eq('default'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'inline-flex h-12 items-center rounded-base border-2 border-black bg-background p-1 text-foreground'
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

export default tabsList;

import { definePrototype, tw } from '@proto.ui/core';
import {
  asTabsList,
  type TabsListProps,
  type TabsListExposes,
} from '@proto.ui/prototypes-base/tabs';
export type FamilyTabsListProps = TabsListProps & { appearance?: 'default' | 'underline' };
export default definePrototype<FamilyTabsListProps, TabsListExposes>({
  name: 'liquid-glass-tabs-list',
  setup(def) {
    def.props.define({
      appearance: { type: 'enum', options: ['default', 'underline'], empty: 'fallback' },
    });
    def.props.setDefaults({ appearance: 'default' });
    asTabsList();
    def.rule({
      when: (w) => w.prop('appearance').eq('default'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'inline-flex w-fit max-w-full items-center gap-1 rounded-2xl border border-border bg-secondary p-1 text-secondary-foreground shadow-sm'
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

    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.rule({
      when: (w) => w.prop('appearance').eq('default'),
      intent: (i) => i.feedback.material.use({ intent: 'liquid-glass', variant: 'regular' }),
    });
  },
});

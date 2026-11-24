import { definePrototype, tw } from '@proto.ui/core';
import {
  asTabsList,
  TABS_CONTEXT,
  type TabsListProps,
  type TabsListExposes,
} from '@proto.ui/prototypes-base/tabs';

export type FamilyTabsListProps = TabsListProps & { appearance?: 'default' | 'underline' };

export default definePrototype<FamilyTabsListProps, TabsListExposes>({
  name: 'bootstrap-2-3-2-tabs-list',
  setup(def) {
    def.props.define({
      appearance: { type: 'enum', options: ['default', 'underline'], empty: 'fallback' },
    });
    def.props.setDefaults({ appearance: 'default' });
    asTabsList();
    const orientation = def.state.enum('bootstrapTabsListVisualOrientation', 'horizontal', {
      options: ['horizontal', 'vertical'],
    });
    def.context.subscribe(TABS_CONTEXT, (_run, next) => {
      orientation.set(next.orientation, 'reason: observe Base Tabs orientation for paint');
    });
    def.lifecycle.onMounted((run) => {
      orientation.set(
        run.context.read(TABS_CONTEXT).orientation,
        'reason: observe Base Tabs orientation for paint'
      );
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.state(orientation).eq('horizontal')),
      intent: (i) => i.feedback.style.use(tw('flex min-w-0 items-end border-b border-[#ddd]')),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.state(orientation).eq('vertical')),
      intent: (i) =>
        i.feedback.style.use(
          tw('flex min-w-0 shrink-0 flex-col items-stretch border-r border-[#ddd]')
        ),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.meta('colorScheme').eq('dark')),
      intent: (i) => i.feedback.style.use(tw('border-border')),
    });
    def.rule({
      when: (w) =>
        w.all(w.prop('appearance').eq('underline'), w.state(orientation).eq('horizontal')),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'flex w-full min-w-0 h-auto flex-nowrap items-center justify-start gap-6 overflow-x-auto border-0 rounded-none bg-transparent p-0 text-muted-foreground shadow-none'
          )
        ),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('underline'), w.state(orientation).eq('vertical')),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'flex min-w-0 shrink-0 h-auto flex-col items-stretch justify-start gap-2 border-0 rounded-none bg-transparent p-0 text-muted-foreground shadow-none'
          )
        ),
    });
  },
});

import { createContextKey, definePrototype, type RunHandle, tw } from '@proto.ui/core';
import {
  asTabsList,
  TABS_CONTEXT,
  type TabsListProps,
  type TabsListExposes,
} from '@proto.ui/prototypes-base/tabs';

export const BOOTSTRAP_TABS_LIST_VARIANT = createContextKey<{ variant: 'default' | 'line' }>(
  'bootstrap-2-3-2-tabs-list-variant'
);

export type FamilyTabsListProps = TabsListProps & {
  appearance?: 'default' | 'underline';
  variant?: 'default' | 'line';
};

export default definePrototype<FamilyTabsListProps, TabsListExposes>({
  name: 'bootstrap-2-3-2-tabs-list',
  setup(def) {
    def.props.define({
      appearance: { type: 'enum', options: ['default', 'underline'], empty: 'fallback' },
      variant: { type: 'enum', options: ['default', 'line'], empty: 'fallback' },
    });
    def.props.setDefaults({ appearance: 'default', variant: 'default' });
    asTabsList();
    def.context.provide(BOOTSTRAP_TABS_LIST_VARIANT, { variant: 'default' });
    const publishVariant = (run: RunHandle<FamilyTabsListProps>) => {
      run.context.update(BOOTSTRAP_TABS_LIST_VARIANT, {
        variant: run.props.get().variant ?? 'default',
      });
    };
    def.props.watch(['variant'], publishVariant);
    def.lifecycle.onCreated(publishVariant);
    def.lifecycle.onMounted(publishVariant);
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
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.prop('variant').eq('default'),
          w.state(orientation).eq('horizontal')
        ),
      intent: (i) => i.feedback.style.use(tw('flex min-w-0 items-end border-b border-[#ddd]')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.prop('variant').eq('default'),
          w.state(orientation).eq('vertical')
        ),
      intent: (i) =>
        i.feedback.style.use(
          tw('flex min-w-0 shrink-0 flex-col items-stretch border-r border-[#ddd]')
        ),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.prop('variant').eq('default'),
          w.meta('colorScheme').eq('dark')
        ),
      intent: (i) => i.feedback.style.use(tw('border-border')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.prop('variant').eq('line'),
          w.state(orientation).eq('horizontal')
        ),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'flex w-full min-w-0 h-auto flex-nowrap items-center justify-start gap-6 overflow-x-auto border-0 border-b border-border rounded-none bg-transparent p-0 text-muted-foreground shadow-none'
          )
        ),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.prop('variant').eq('line'),
          w.state(orientation).eq('vertical')
        ),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'flex min-w-0 shrink-0 h-auto flex-col items-stretch justify-start gap-2 border-0 border-r border-border rounded-none bg-transparent p-0 text-muted-foreground shadow-none'
          )
        ),
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

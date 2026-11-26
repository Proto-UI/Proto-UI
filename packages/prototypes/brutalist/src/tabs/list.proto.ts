import { createContextKey, definePrototype, type RunHandle, tw } from '@proto.ui/core';
import { asTabsList, TABS_CONTEXT } from '@proto.ui/prototypes-base/tabs';
import type { BrutalistTabsListExposes, BrutalistTabsListProps } from './types';

export const BRUTALIST_TABS_LIST_VARIANT = createContextKey<{ variant: 'default' | 'line' }>(
  'brutalist-tabs-list-variant'
);

const tabsList = definePrototype<BrutalistTabsListProps, BrutalistTabsListExposes>({
  // P-BRUTALIST-TABS-LIST-ENTRY
  name: 'brutalist-tabs-list',
  setup(def) {
    def.props.define({
      appearance: { type: 'enum', options: ['default', 'underline'], empty: 'fallback' },
      variant: { type: 'enum', options: ['default', 'line'], empty: 'fallback' },
    });
    def.props.setDefaults({ appearance: 'default', variant: 'default' });
    // P-BRUTALIST-TABS-LIST-BASE-INHERITANCE
    asTabsList();
    def.context.provide(BRUTALIST_TABS_LIST_VARIANT, { variant: 'default' });
    const publishVariant = (run: RunHandle<BrutalistTabsListProps>) => {
      run.context.update(BRUTALIST_TABS_LIST_VARIANT, {
        variant: run.props.get().variant ?? 'default',
      });
    };
    def.props.watch(['variant'], publishVariant);
    def.lifecycle.onCreated(publishVariant);
    def.lifecycle.onMounted(publishVariant);
    const orientation = def.state.enum('brutalistTabsListVisualOrientation', 'horizontal', {
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
    // P-BRUTALIST-TABS-LIST-VISUAL-GRAMMAR — flat rounded strip panel: rounded-base, border-2
    // border-black, bg-background fill, text-foreground, p-1 (no shadow per Brutalist design contract).
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.prop('variant').eq('default')),
      intent: (i) =>
        i.feedback.style.use(
          tw('inline-flex rounded-base border-2 border-black bg-background p-1 text-foreground')
        ),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.prop('variant').eq('default'),
          w.state(orientation).eq('horizontal')
        ),
      intent: (i) => i.feedback.style.use(tw('h-12 items-center')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.prop('variant').eq('default'),
          w.state(orientation).eq('vertical')
        ),
      intent: (i) => i.feedback.style.use(tw('h-fit shrink-0 flex-col items-stretch gap-1')),
    });
    // P-BRUTALIST-TABS-LIST-VARIANT — unframed Neo-Brutalist line strip for dogfood consumers.
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
            'flex w-full min-w-0 h-auto flex-nowrap items-center justify-start gap-6 overflow-x-auto border-0 border-b-2 border-black rounded-none bg-transparent p-0 text-muted-foreground shadow-none'
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
            'flex min-w-0 shrink-0 h-auto flex-col items-stretch justify-start gap-2 border-0 border-l-2 border-black rounded-none bg-transparent p-0 text-muted-foreground shadow-none'
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

export default tabsList;

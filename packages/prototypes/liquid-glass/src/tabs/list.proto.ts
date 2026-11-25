import { createContextKey, definePrototype, type RunHandle, tw } from '@proto.ui/core';
import {
  asTabsList,
  TABS_CONTEXT,
  type TabsListProps,
  type TabsListExposes,
} from '@proto.ui/prototypes-base/tabs';

export const LIQUID_GLASS_TABS_LIST_VARIANT = createContextKey<{ variant: 'default' | 'line' }>(
  'liquid-glass-tabs-list-variant'
);

export type FamilyTabsListProps = TabsListProps & {
  appearance?: 'default' | 'underline';
  variant?: 'default' | 'line';
  material?: 'auto' | 'opaque';
  prominence?: 'regular' | 'prominent';
};

export default definePrototype<FamilyTabsListProps, TabsListExposes>({
  name: 'liquid-glass-tabs-list',
  setup(def) {
    def.props.define({
      appearance: { type: 'enum', options: ['default', 'underline'], empty: 'fallback' },
      variant: { type: 'enum', options: ['default', 'line'], empty: 'fallback' },
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
      prominence: { type: 'enum', options: ['regular', 'prominent'], empty: 'fallback' },
    });
    def.props.setDefaults({
      appearance: 'default',
      variant: 'default',
      material: 'auto',
      prominence: 'regular',
    });
    asTabsList();
    def.context.provide(LIQUID_GLASS_TABS_LIST_VARIANT, { variant: 'default' });
    const publishVariant = (run: RunHandle<FamilyTabsListProps>) => {
      run.context.update(LIQUID_GLASS_TABS_LIST_VARIANT, {
        variant: run.props.get().variant ?? 'default',
      });
    };
    def.props.watch(['variant'], publishVariant);
    def.lifecycle.onCreated(publishVariant);
    def.lifecycle.onMounted(publishVariant);
    const orientation = def.state.enum('liquidTabsVisualOrientation', 'horizontal', {
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
      when: (w) => w.all(w.prop('appearance').eq('default'), w.prop('variant').eq('default')),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'inline-flex w-fit max-w-full items-center gap-1 border border-border bg-secondary p-1 text-secondary-foreground ring-1 ring-inset ring-foreground/10 shadow-sm'
          )
        ),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.prop('variant').eq('default'),
          w.state(orientation).eq('horizontal')
        ),
      intent: (i) => i.feedback.style.use(tw('rounded-full')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.prop('variant').eq('default'),
          w.state(orientation).eq('vertical')
        ),
      intent: (i) => i.feedback.style.use(tw('shrink-0 flex-col items-stretch rounded-2xl')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.prop('variant').eq('default'),
          w.prop('prominence').eq('prominent')
        ),
      intent: (i) =>
        i.feedback.style.use(tw('bg-muted text-foreground border-primary/40 ring-primary/20')),
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
            'flex w-full min-w-0 h-auto flex-nowrap items-center justify-start gap-6 overflow-x-auto border-0 rounded-none bg-transparent p-0 text-muted-foreground shadow-none'
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
            'flex min-w-0 shrink-0 h-auto flex-col items-stretch justify-start gap-2 border-0 rounded-none bg-transparent p-0 text-muted-foreground shadow-none'
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

    // Only the navigation List declares Liquid Glass material; Trigger/Content stay non-glass to avoid glass-on-glass stacking.
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.prop('variant').eq('default'),
          w.prop('material').eq('auto'),
          w.prop('prominence').eq('regular')
        ),
      intent: (i) => i.feedback.material.use({ intent: 'liquid-glass', variant: 'regular' }),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.prop('variant').eq('default'),
          w.prop('material').eq('auto'),
          w.prop('prominence').eq('prominent')
        ),
      intent: (i) =>
        i.feedback.material.use({
          intent: 'liquid-glass',
          variant: 'regular',
          tint: 'style-fill',
        }),
    });
  },
});

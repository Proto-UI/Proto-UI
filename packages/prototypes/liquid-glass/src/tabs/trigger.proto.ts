import { definePrototype, type RunHandle, tw } from '@proto.ui/core';
import {
  asTabsTrigger,
  TABS_CONTEXT,
  type TabsTriggerProps,
  type TabsTriggerExposes,
} from '@proto.ui/prototypes-base/tabs';
import {
  COMMAND_DISABLED,
  COMMAND_FOCUS,
  COMMAND_FOCUS_INSET,
  COMMAND_PRESS,
} from '../interactive-surface';
import { LIQUID_GLASS_TABS_LIST_VARIANT } from './list.proto';

export type FamilyTabsTriggerProps = TabsTriggerProps & { appearance?: 'default' | 'underline' };

export default definePrototype<FamilyTabsTriggerProps, TabsTriggerExposes>({
  name: 'liquid-glass-tabs-trigger',
  setup(def) {
    def.props.define({
      appearance: { type: 'enum', options: ['default', 'underline'], empty: 'fallback' },
    });
    def.props.setDefaults({ appearance: 'default' });
    const triggerState = asTabsTrigger().stateHandles;
    if (!triggerState) throw new Error('Tabs Trigger capture missing');
    const { selected, hovered, pressed, focusVisible, disabled } = triggerState;
    const orientation = def.state.enum('liquidTabsTriggerVisualOrientation', 'horizontal', {
      options: ['horizontal', 'vertical'],
    });
    const variant = def.state.enum('liquidTabsListVariant', 'default', {
      options: ['default', 'line'],
    });
    const syncVisual = (run: RunHandle<FamilyTabsTriggerProps>) => {
      orientation.set(
        run.context.read(TABS_CONTEXT).orientation,
        'reason: observe Base Tabs orientation for paint'
      );
      variant.set(
        run.context.tryRead(LIQUID_GLASS_TABS_LIST_VARIANT)?.variant ?? 'default',
        'reason: observe Liquid Glass Tabs List variant for paint'
      );
    };
    def.context.subscribe(TABS_CONTEXT, syncVisual);
    def.context.trySubscribe(LIQUID_GLASS_TABS_LIST_VARIANT, syncVisual);
    def.lifecycle.onCreated(syncVisual);
    def.lifecycle.onMounted(syncVisual);

    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.state(variant).eq('default')),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'inline-flex flex-none items-center justify-center gap-2 border border-transparent px-3.5 py-1.5 text-sm font-medium text-muted-foreground select-none outline-none cursor-pointer transition-[color,box-shadow,background-color] duration-150'
          )
        ),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('default'),
          w.state(orientation).eq('horizontal')
        ),
      intent: (i) => i.feedback.style.use(tw('rounded-full')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('default'),
          w.state(orientation).eq('vertical')
        ),
      intent: (i) => i.feedback.style.use(tw('w-full justify-start rounded-xl')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('default'),
          w.state(selected).eq(true)
        ),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'bg-background text-foreground border-border/60 ring-1 ring-inset ring-foreground/10 shadow-sm cursor-default'
          )
        ),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('default'),
          w.state(hovered).eq(true),
          w.state(selected).eq(false),
          w.state(pressed).eq(false),
          w.state(disabled).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('text-foreground bg-foreground/5')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('default'),
          w.state(pressed).eq(true),
          w.state(disabled).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw(COMMAND_PRESS)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('default'),
          w.state(focusVisible).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS_INSET)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('default'),
          w.state(disabled).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw(`${COMMAND_DISABLED} text-muted-foreground`)),
    });

    // P-LIQUID-GLASS-TABS-TRIGGER-VARIANT — Liquid Glass line trigger.
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.state(variant).eq('line')),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'relative inline-flex flex-none h-auto items-center gap-1.5 whitespace-nowrap rounded-none border-0 border-transparent bg-transparent text-sm font-medium text-muted-foreground shadow-none select-none outline-none cursor-pointer transition-colors duration-150'
          )
        ),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('line'),
          w.state(orientation).eq('horizontal')
        ),
      intent: (i) => i.feedback.style.use(tw('justify-center border-b-2 px-0 py-1.5')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('line'),
          w.state(orientation).eq('vertical')
        ),
      intent: (i) => i.feedback.style.use(tw('w-full justify-start border-l-2 pl-3 py-1.5')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('line'),
          w.state(selected).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('border-primary text-foreground cursor-default')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('line'),
          w.state(hovered).eq(true),
          w.state(disabled).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('text-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('line'),
          w.state(focusVisible).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('line'),
          w.state(disabled).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw(`${COMMAND_DISABLED} text-muted-foreground`)),
    });

    def.rule({
      when: (w) => w.prop('appearance').eq('underline'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'relative inline-flex flex-none h-auto items-center gap-1.5 whitespace-nowrap rounded-none border-0 border-transparent bg-transparent text-sm font-medium text-muted-foreground shadow-none select-none outline-none cursor-pointer transition-colors duration-150'
          )
        ),
    });
    def.rule({
      when: (w) => w.meta('preference.reducedMotion').eq('reduce'),
      intent: (i) => i.feedback.style.use(tw('transition-none')),
    });
    def.rule({
      when: (w) =>
        w.all(w.prop('appearance').eq('underline'), w.state(orientation).eq('horizontal')),
      intent: (i) => i.feedback.style.use(tw('justify-center border-b-2 px-0 py-1.5')),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('underline'), w.state(orientation).eq('vertical')),
      intent: (i) => i.feedback.style.use(tw('w-full justify-start border-l-2 pl-3 py-1.5')),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('underline'), w.state(selected).eq(true)),
      intent: (i) => i.feedback.style.use(tw('border-primary text-foreground cursor-default')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('underline'),
          w.state(hovered).eq(true),
          w.state(disabled).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('text-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('underline'), w.state(focusVisible).eq(true)),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('underline'), w.state(disabled).eq(true)),
      intent: (i) => i.feedback.style.use(tw(`${COMMAND_DISABLED} text-muted-foreground`)),
    });
  },
});

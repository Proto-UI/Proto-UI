import { definePrototype, type RunHandle, tw } from '@proto.ui/core';
import {
  asTabsTrigger,
  TABS_CONTEXT,
  type TabsTriggerProps,
  type TabsTriggerExposes,
} from '@proto.ui/prototypes-base/tabs';
import { BOOTSTRAP_TABS_LIST_VARIANT } from './list.proto';

export type FamilyTabsTriggerProps = TabsTriggerProps & { appearance?: 'default' | 'underline' };

export default definePrototype<FamilyTabsTriggerProps, TabsTriggerExposes>({
  name: 'bootstrap-2-3-2-tabs-trigger',
  setup(def) {
    def.props.define({
      appearance: { type: 'enum', options: ['default', 'underline'], empty: 'fallback' },
    });
    def.props.setDefaults({ appearance: 'default' });
    const triggerState = asTabsTrigger().stateHandles;
    if (!triggerState) throw new Error('Tabs Trigger capture missing');
    const { selected, hovered, focused, focusVisible, disabled } = triggerState;
    const orientation = def.state.enum('bootstrapTabsTriggerVisualOrientation', 'horizontal', {
      options: ['horizontal', 'vertical'],
    });
    const variant = def.state.enum('bootstrapTabsListVariant', 'default', {
      options: ['default', 'line'],
    });
    const syncVisual = (run: RunHandle<FamilyTabsTriggerProps>) => {
      orientation.set(
        run.context.read(TABS_CONTEXT).orientation,
        'reason: observe Base Tabs orientation for paint'
      );
      variant.set(
        run.context.tryRead(BOOTSTRAP_TABS_LIST_VARIANT)?.variant ?? 'default',
        'reason: observe Bootstrap Tabs List variant for paint'
      );
    };
    def.context.subscribe(TABS_CONTEXT, syncVisual);
    def.context.trySubscribe(BOOTSTRAP_TABS_LIST_VARIANT, syncVisual);
    def.lifecycle.onCreated(syncVisual);
    def.lifecycle.onMounted(syncVisual);

    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.state(variant).eq('default')),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'inline-flex flex-none items-center justify-center gap-1.5 whitespace-nowrap px-[12px] py-[8px] border border-transparent text-[14px] leading-[20px] text-[#08c] select-none outline-none cursor-pointer'
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
      intent: (i) => i.feedback.style.use(tw('mr-[2px] mb-[-1px] rounded-t-[4px]')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('default'),
          w.state(orientation).eq('vertical')
        ),
      intent: (i) =>
        i.feedback.style.use(tw('w-full justify-start mb-[2px] mr-[-1px] rounded-l-[4px]')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('default'),
          w.meta('colorScheme').eq('dark')
        ),
      intent: (i) => i.feedback.style.use(tw('text-ring')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('default'),
          w.state(orientation).eq('horizontal'),
          w.any(w.state(hovered).eq(true), w.state(focused).eq(true)),
          w.state(selected).eq(false),
          w.state(disabled).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-[#eee] text-[#005580] border-[#eee_#eee_#ddd]')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('default'),
          w.state(orientation).eq('vertical'),
          w.any(w.state(hovered).eq(true), w.state(focused).eq(true)),
          w.state(selected).eq(false),
          w.state(disabled).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-[#eee] text-[#005580] border-[#eee]')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('default'),
          w.meta('colorScheme').eq('dark'),
          w.any(w.state(hovered).eq(true), w.state(focused).eq(true)),
          w.state(selected).eq(false),
          w.state(disabled).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-secondary text-foreground border-border')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('default'),
          w.state(orientation).eq('horizontal'),
          w.state(selected).eq(true)
        ),
      intent: (i) =>
        i.feedback.style.use(
          tw('bg-white text-[#555] border-[#ddd] border-b-transparent cursor-default')
        ),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('default'),
          w.state(orientation).eq('vertical'),
          w.state(selected).eq(true)
        ),
      intent: (i) =>
        i.feedback.style.use(
          tw('bg-white text-[#555] border-[#eee_#fff_#eee_#eee] cursor-default')
        ),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('default'),
          w.meta('colorScheme').eq('dark'),
          w.state(orientation).eq('horizontal'),
          w.state(selected).eq(true)
        ),
      intent: (i) =>
        i.feedback.style.use(
          tw('bg-background text-foreground border-border border-b-transparent cursor-default')
        ),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('default'),
          w.meta('colorScheme').eq('dark'),
          w.state(orientation).eq('vertical'),
          w.state(selected).eq(true)
        ),
      intent: (i) =>
        i.feedback.style.use(tw('bg-background text-foreground border-border cursor-default')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('default'),
          w.state(focusVisible).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('outline-2 outline-ring outline-offset-2')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('default'),
          w.state(disabled).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('text-[#999] cursor-default')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('default'),
          w.meta('colorScheme').eq('dark'),
          w.state(disabled).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('text-muted-foreground cursor-default')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('default'),
          w.state(disabled).eq(true),
          w.any(w.state(hovered).eq(true), w.state(focused).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-transparent border-transparent')),
    });

    // P-BOOTSTRAP-2-3-2-TABS-TRIGGER-VARIANT — Bootstrap line trigger.
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.state(variant).eq('line')),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'relative inline-flex flex-none h-auto items-center gap-1.5 whitespace-nowrap rounded-none border-0 border-transparent bg-transparent text-[14px] leading-[20px] font-medium text-muted-foreground shadow-none select-none outline-none cursor-pointer'
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
          w.meta('colorScheme').eq('dark'),
          w.state(selected).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('border-ring text-foreground cursor-default')),
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
      intent: (i) => i.feedback.style.use(tw('outline-2 outline-ring outline-offset-2')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('line'),
          w.state(disabled).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
    });

    def.rule({
      when: (w) => w.prop('appearance').eq('underline'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'relative inline-flex flex-none h-auto items-center gap-1.5 whitespace-nowrap rounded-none border-0 border-transparent bg-transparent text-[14px] leading-[20px] font-medium text-muted-foreground shadow-none select-none outline-none cursor-pointer'
          )
        ),
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
          w.meta('colorScheme').eq('dark'),
          w.state(selected).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('border-ring text-foreground cursor-default')),
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
      intent: (i) => i.feedback.style.use(tw('outline-2 outline-ring outline-offset-2')),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('underline'), w.state(disabled).eq(true)),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
    });
  },
});

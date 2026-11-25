import { definePrototype, type RunHandle, tw } from '@proto.ui/core';
import { asTabsTrigger, TABS_CONTEXT } from '@proto.ui/prototypes-base/tabs';
import { BRUTALIST_DISABLED_TOKENS, BRUTALIST_FOCUS_TOKENS } from '../style';
import { BRUTALIST_TABS_LIST_VARIANT } from './list.proto';
import type { BrutalistTabsTriggerExposes, BrutalistTabsTriggerProps } from './types';

// P-BRUTALIST-TABS-TRIGGER-VISUAL-GRAMMAR — resting label: rounded-base, border-2
// border-transparent (transparent at rest, black when selected/hovered), bold mixed-case,
// text-foreground resting fill, no fill until selected/hover.
const BASE_TOKENS = [
  'inline-flex',
  'items-center',
  'justify-center',
  'gap-1.5',
  'whitespace-nowrap',
  'rounded-base',
  'border-2',
  'border-transparent',
  'px-3',
  'py-1.5',
  'text-sm',
  'font-heading',
  'font-bold',
  'outline-none',
  'text-foreground',
  'select-none',
].join(' ');
const tabsTrigger = definePrototype<BrutalistTabsTriggerProps, BrutalistTabsTriggerExposes>({
  // P-BRUTALIST-TABS-TRIGGER-ENTRY
  name: 'brutalist-tabs-trigger',
  setup(def) {
    def.props.define({
      appearance: { type: 'enum', options: ['default', 'underline'], empty: 'fallback' },
    });
    def.props.setDefaults({ appearance: 'default' });
    // P-BRUTALIST-TABS-TRIGGER-BASE-INHERITANCE
    const triggerState = asTabsTrigger().stateHandles;
    if (!triggerState) {
      throw new Error(
        '[brutalist-tabs-trigger] asTabsTrigger must project Tabs trigger state handles.'
      );
    }
    const { disabled, hovered, focusVisible, pressed, selected } = triggerState;
    const orientation = def.state.enum('brutalistTabsTriggerVisualOrientation', 'horizontal', {
      options: ['horizontal', 'vertical'],
    });
    const variant = def.state.enum('brutalistTabsListVariant', 'default', {
      options: ['default', 'line'],
    });
    const syncVisual = (run: RunHandle<BrutalistTabsTriggerProps>) => {
      orientation.set(
        run.context.read(TABS_CONTEXT).orientation,
        'reason: observe Base Tabs orientation for paint'
      );
      variant.set(
        run.context.tryRead(BRUTALIST_TABS_LIST_VARIANT)?.variant ?? 'default',
        'reason: observe Brutalist Tabs List variant for paint'
      );
    };
    def.context.subscribe(TABS_CONTEXT, syncVisual);
    def.context.trySubscribe(BRUTALIST_TABS_LIST_VARIANT, syncVisual);
    def.lifecycle.onCreated(syncVisual);
    def.lifecycle.onMounted(syncVisual);

    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.state(variant).eq('default')),
      intent: (i) => i.feedback.style.use(tw(BASE_TOKENS)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('default'),
          w.state(orientation).eq('vertical')
        ),
      intent: (i) => i.feedback.style.use(tw('w-full justify-start')),
    });

    // P-BRUTALIST-TABS-TRIGGER-SELECTED-PAIR-INVARIANT — selected keeps its
    // semantic color and border while press independently owns elevation.
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('default'),
          w.state(selected).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-main text-main-foreground border-black')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('default'),
          w.all(w.state(selected).eq(true), w.state(pressed).eq(false))
        ),
      intent: (i) => i.feedback.style.use(tw('border-black')),
    });
    // P-BRUTALIST-TABS-TRIGGER-INTERACTION — hover feedback (non-selected only)
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('default'),
          w.all(w.state(hovered).eq(true), w.state(selected).eq(false), w.state(pressed).eq(false))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-secondary-background border-black')),
    });
    // P-BRUTALIST-TABS-TRIGGER-INTERACTION — focus-visible
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('default'),
          w.state(focusVisible).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS)),
    });
    // P-BRUTALIST-TABS-TRIGGER-INTERACTION — press
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('default'),
          w.state(pressed).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('border-black')),
    });
    // P-BRUTALIST-TABS-TRIGGER-INTERACTION — disabled
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('default'),
          w.state(disabled).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_DISABLED_TOKENS)),
    });
    // P-BRUTALIST-TABS-TRIGGER-VARIANT — Neo-Brutalist line trigger.
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('default'), w.state(variant).eq('line')),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'relative inline-flex flex-none h-auto items-center gap-1.5 whitespace-nowrap rounded-none border-0 border-transparent bg-transparent text-sm font-heading font-bold text-muted-foreground shadow-none select-none outline-none cursor-pointer'
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
      intent: (i) => i.feedback.style.use(tw('justify-center border-b-2 px-1 pt-1 pb-1.5')),
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
      intent: (i) => i.feedback.style.use(tw('border-foreground text-foreground cursor-default')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('line'),
          w.state(hovered).eq(true),
          w.state(selected).eq(false),
          w.state(disabled).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-secondary-background text-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('line'),
          w.state(focusVisible).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('appearance').eq('default'),
          w.state(variant).eq('line'),
          w.state(disabled).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_DISABLED_TOKENS)),
    });
    def.rule({
      when: (w) => w.prop('appearance').eq('underline'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'relative inline-flex flex-none h-auto items-center gap-1.5 whitespace-nowrap rounded-none border-0 border-transparent bg-transparent text-sm font-heading font-bold text-muted-foreground shadow-none select-none outline-none'
          )
        ),
    });
    def.rule({
      when: (w) =>
        w.all(w.prop('appearance').eq('underline'), w.state(orientation).eq('horizontal')),
      intent: (i) => i.feedback.style.use(tw('justify-center border-b-2 px-0 pt-1 pb-1.5')),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('underline'), w.state(orientation).eq('vertical')),
      intent: (i) => i.feedback.style.use(tw('w-full justify-start border-l-2 pl-3 py-1.5')),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('underline'), w.state(selected).eq(true)),
      intent: (i) => i.feedback.style.use(tw('border-foreground text-foreground')),
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
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS)),
    });
    def.rule({
      when: (w) => w.all(w.prop('appearance').eq('underline'), w.state(disabled).eq(true)),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_DISABLED_TOKENS)),
    });
  },
});

export default tabsTrigger;

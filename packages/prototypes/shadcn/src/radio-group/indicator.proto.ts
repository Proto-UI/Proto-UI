import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { asRadioGroupIndicator } from '@proto.ui/prototypes-base/radio-group';
import { SHADCN_STYLE_IDS } from '../style-scope';
import { RADIO_GROUP_VISUAL } from './visual';
import type { ShadcnRadioGroupIndicatorExposes, ShadcnRadioGroupIndicatorProps } from './types';

const radioGroupIndicator = definePrototype<
  ShadcnRadioGroupIndicatorProps,
  ShadcnRadioGroupIndicatorExposes
>({
  name: 'shadcn-radio-group-indicator',
  setup(def) {
    const state = asRadioGroupIndicator().stateHandles;
    if (!state) {
      throw new Error(
        '[shadcn-radio-group-indicator] asRadioGroupIndicator must project Indicator state handles.'
      );
    }
    // Follow the containing styled Item rather than resolving a second profile
    // that could disagree with an explicit Item override. Missing family paint
    // retains the current base-nova compatibility surface, not a new owner.
    const style = def.state.enum('radioIndicatorVisualStyle', 'nova', {
      options: SHADCN_STYLE_IDS,
    });
    const sync = (run: RunHandle<ShadcnRadioGroupIndicatorProps>) => {
      style.set(
        run.context.tryRead(RADIO_GROUP_VISUAL)?.style ?? 'nova',
        'reason: Radio Indicator actual Item presentation'
      );
    };
    def.context.trySubscribe(RADIO_GROUP_VISUAL, sync);
    def.lifecycle.onCreated(sync);
    def.lifecycle.onMounted(sync);
    def.lifecycle.onUpdated(sync);
    def.lifecycle.onUnmounted(() => {
      style.set('nova', 'reason: Radio Indicator presentation detach');
    });
    def.feedback.style.use(
      tw('flex shrink-0 items-center justify-center opacity-0 transition-none')
    );
    for (const profile of [
      'new-york-v4',
      'vega',
      'nova',
      'maia',
      'lyra',
      'mira',
      'sera',
    ] as const) {
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) => i.feedback.style.use(tw('size-2')),
      });
    }
    for (const profile of ['luma', 'rhea'] as const) {
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.not(w.meta('colorScheme').eq('dark'))),
        intent: (i) => i.feedback.style.use(tw('size-2')),
      });
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.meta('colorScheme').eq('dark')),
        intent: (i) => i.feedback.style.use(tw('size-2.5')),
      });
    }
    def.rule({
      when: (w) => w.state(style).eq('new-york-v4'),
      intent: (i) => i.feedback.style.use(tw('text-primary')),
    });
    def.rule({
      when: (w) => w.state(style).eq('sera'),
      intent: (i) => i.feedback.style.use(tw('text-foreground')),
    });
    for (const profile of ['vega', 'nova', 'maia', 'lyra', 'mira', 'luma', 'rhea'] as const) {
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) => i.feedback.style.use(tw('text-primary-foreground')),
      });
    }
    def.rule({
      when: (w) => w.state(state.checked).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-100')),
    });

    // The explicit public Indicator centers the upstream dot directly. Its
    // host-neutral SVG is passive and never becomes an activation/focus target.
    return (renderer) => [
      renderer.r.slot(),
      renderer.svg.root(
        {
          viewBox: '0 0 24 24',
          'aria-hidden': 'true',
          width: '100%',
          height: '100%',
          fill: 'currentColor',
          stroke: 'none',
        },
        renderer.svg.circle({ cx: 12, cy: 12, r: 12 })
      ),
    ];
  },
});

export default radioGroupIndicator;

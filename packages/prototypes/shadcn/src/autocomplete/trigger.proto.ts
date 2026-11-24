import { definePrototype, tw } from '@proto.ui/core';
import { asAutocompleteTrigger } from '@proto.ui/prototypes-base/autocomplete';
import type { AutocompleteTriggerProps, AutocompleteTriggerExposes } from './types';
import { SHADCN_STYLE_IDS, setupShadcnStyleSelection } from '../style-scope';

const TRIGGER_PROFILES = {
  vega: {
    base: 'h-9 px-3 rounded-md border-input bg-background text-sm shadow-xs',
    focus: 'border-ring ring-3 ring-ring/50',
  },
  nova: {
    base: 'h-8 px-2.5 rounded-lg border-input bg-background text-sm',
    focus: 'border-ring ring-3 ring-ring/50',
  },
  maia: {
    base: 'h-9 px-3 rounded-[var(--pui-radius-4xl)] border-input bg-input/30 text-sm',
    focus: 'border-ring ring-3 ring-ring/50',
  },
  lyra: {
    base: 'h-8 px-2.5 rounded-none border-input bg-background text-xs',
    focus: 'border-ring ring-1 ring-ring/50',
  },
  mira: {
    base: 'h-7 px-2 rounded-md border-input bg-input/20 text-xs leading-relaxed',
    focus: 'border-ring ring-2 ring-ring/30',
  },
  luma: {
    base: 'h-9 px-3 rounded-[var(--pui-radius-4xl)] border-transparent bg-input/50 text-sm',
    focus: 'border-ring ring-3 ring-ring/30',
  },
  sera: {
    base: 'h-10 px-3 rounded-none border-input bg-transparent text-xs',
    focus: 'border-ring',
  },
  rhea: {
    base: 'h-8 px-2.5 rounded-[var(--pui-radius-2xl)] border-transparent bg-input/50 text-sm',
    focus: 'border-ring ring-3 ring-ring/30',
  },
  'new-york-v4': {
    base: 'h-9 px-3 rounded-md border-input bg-background text-sm shadow-xs',
    focus: 'border-ring ring-3 ring-ring/50',
  },
} as const;

export default definePrototype<AutocompleteTriggerProps, AutocompleteTriggerExposes>({
  name: 'shadcn-autocomplete-trigger',
  modules: asAutocompleteTrigger.modules,
  setup(def) {
    const behavior = asAutocompleteTrigger();
    const disabled = behavior.getState!('disabled')!;
    const focusVisible = behavior.getState!('focusVisible')!;
    const hovered = def.state.bool('hovered', false);
    const pressed = def.state.bool('pressed', false);
    const style = setupShadcnStyleSelection(def, 'rhea');

    def.props.define({
      size: { type: 'enum', empty: 'fallback', options: ['default', 'icon'] },
    });
    def.props.setDefaults({ size: 'default' });

    def.event.on('pointer.enter', () => {
      if (disabled.get()) return;
      hovered.set(true, 'reason: autocomplete trigger pointer.enter');
    });
    def.event.on('pointer.leave', () => {
      hovered.set(false, 'reason: autocomplete trigger pointer.leave');
      pressed.set(false, 'reason: autocomplete trigger pointer.leave');
    });
    def.event.on('pointer.cancel', () => {
      hovered.set(false, 'reason: autocomplete trigger pointer.cancel');
      pressed.set(false, 'reason: autocomplete trigger pointer.cancel');
    });
    def.event.on('press.cancel', () => {
      hovered.set(false, 'reason: autocomplete trigger press.cancel');
      pressed.set(false, 'reason: autocomplete trigger press.cancel');
    });
    def.event.on('pointer.down', () => {
      if (disabled.get()) return;
      pressed.set(true, 'reason: autocomplete trigger pointer.down');
    });
    def.event.on('pointer.up', () => {
      pressed.set(false, 'reason: autocomplete trigger pointer.up');
    });
    def.event.on('press.commit', () => {
      pressed.set(false, 'reason: autocomplete trigger press.commit');
    });
    def.lifecycle.onUnmounted(() => {
      hovered.set(false, 'reason: autocomplete trigger unmounted');
      pressed.set(false, 'reason: autocomplete trigger unmounted');
    });

    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center gap-1.5 border text-foreground font-medium whitespace-nowrap select-none cursor-pointer outline-none'
      )
    );
    def.rule({
      when: (w) => w.meta('preference.reducedMotion').eq('no-preference'),
      intent: (i) => i.feedback.style.use(tw('transition-colors')),
    });
    def.rule({
      when: (w) => w.not(w.meta('preference.reducedMotion').eq('no-preference')),
      intent: (i) => i.feedback.style.use(tw('transition-none')),
    });
    for (const id of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) => w.state(style).eq(id),
        intent: (i) => i.feedback.style.use(tw(TRIGGER_PROFILES[id].base)),
      });
      def.rule({
        when: (w) => w.all(w.state(style).eq(id), w.state(focusVisible).eq(true)),
        intent: (i) => i.feedback.style.use(tw(TRIGGER_PROFILES[id].focus)),
      });
    }
    def.rule({
      when: (w) => w.prop('size').eq('icon'),
      intent: (i) => i.feedback.style.use(tw('w-8 px-0')),
    });
    def.rule({
      when: (w) => w.all(w.state(hovered).eq(true), w.state(disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.state(pressed).eq(true), w.state(disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-accent/80')),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50 cursor-not-allowed')),
    });

    return (renderer) => [
      renderer.r.slot(),
      renderer.el(
        'span',
        {
          style: tw(
            'pointer-events-none flex size-4 shrink-0 items-center justify-center opacity-60'
          ),
        },
        renderer.svg.root(
          {
            viewBox: '0 0 24 24',
            'aria-hidden': 'true',
            width: 14,
            height: 14,
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          },
          renderer.svg.path({ d: 'm6 9 6 6 6-6' })
        )
      ),
    ];
  },
});

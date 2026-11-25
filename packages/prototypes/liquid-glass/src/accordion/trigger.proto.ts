import {
  COMMAND_HOVER,
  COMMAND_PRESS,
  COMMAND_FOCUS,
  COMMAND_DISABLED,
  COMMAND_BLOCKED,
} from '../interactive-surface';
import { definePrototype, tw, delay, type RunHandle } from '@proto.ui/core';
import {
  asAccordionTrigger,
  type AccordionTriggerProps,
  type AccordionTriggerExposes,
} from '@proto.ui/prototypes-base/accordion';

export type LiquidGlassAccordionMaterial = 'auto' | 'opaque';
export type LiquidGlassAccordionProminence = 'regular' | 'prominent';
export interface LiquidGlassAccordionTriggerProps extends AccordionTriggerProps {
  material?: LiquidGlassAccordionMaterial;
  prominence?: LiquidGlassAccordionProminence;
}

// Explicit optical intent over the independent Base Trigger. A missing host sink must retain the opaque fallback, never substitute adaptive native blur.
export default definePrototype<LiquidGlassAccordionTriggerProps, AccordionTriggerExposes>({
  name: 'liquid-glass-accordion-trigger',
  modules: asAccordionTrigger.modules,
  setup(def) {
    const state = asAccordionTrigger().stateHandles!;
    def.props.define({
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
      prominence: { type: 'enum', options: ['regular', 'prominent'], empty: 'fallback' },
    });
    def.props.setDefaults({
      material: 'auto',
      prominence: 'regular',
    });
    def.feedback.material.declare({
      version: 2,
      paintReservation: 'required',
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    // Exactly one complete candidate applies; no static candidate is stacked
    // underneath the pressed Rule, and no button profile is inferred by name.
    // Reduced transparency, forced colors, disabled, collapseBlocked, and
    // material="opaque" withdraw optical candidates while preserving opaque readability.
    for (const pressed of [false, true]) {
      def.rule({
        when: (w) =>
          w.all(
            w.prop('material').eq('auto'),
            w.not(w.meta('preference.reducedTransparency').eq('reduce')),
            w.not(w.meta('preference.forcedColors').eq('active')),
            w.state(state.pressed).eq(pressed),
            w.state(state.disabled).eq(false),
            w.state(state.collapseBlocked).eq(false)
          ),
        intent: (i) =>
          i.feedback.material.use({
            intent: 'liquid-glass',
            deformation: { kind: 'press', phase: pressed ? 'pressed' : 'rest', contact: 'pointer' },
          }),
      });
    }
    def.feedback.style.use(
      tw(
        'flex w-full min-w-0 items-center justify-between gap-4 px-4 py-3 text-start text-base font-medium leading-relaxed whitespace-normal break-words cursor-pointer select-none outline-none rounded-2xl bg-background text-foreground'
      )
    );
    def.rule({
      when: (w) => w.prop('prominence').eq('prominent'),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground shadow-sm')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.hovered).eq(true),
          w.state(state.pressed).eq(false),
          w.state(state.disabled).eq(false),
          w.state(state.focusVisible).eq(false),
          w.state(state.collapseBlocked).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw(COMMAND_HOVER)),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.pressed).eq(true),
          w.state(state.disabled).eq(false),
          w.state(state.collapseBlocked).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw(COMMAND_PRESS)),
    });
    def.rule({
      when: (w) => w.state(state.expanded).eq(true),
      intent: (i) => i.feedback.style.use(tw('font-semibold')),
    });
    // Persistent expansion yields the complete ring to visible focus. Keeping
    // its inset/color alongside COMMAND_FOCUS would contaminate the focus ring.
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.expanded).eq(true),
          w.state(state.focusVisible).eq(false),
          w.not(w.prop('prominence').eq('prominent'))
        ),
      intent: (i) => i.feedback.style.use(tw('ring-1 ring-inset ring-foreground/10')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.expanded).eq(true),
          w.state(state.focusVisible).eq(false),
          w.prop('prominence').eq('prominent')
        ),
      intent: (i) => i.feedback.style.use(tw('ring-1 ring-inset ring-border')),
    });
    // Disabled withdraws optical elevation and pointer interaction without dimming fallback contrast.
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_DISABLED)),
    });
    def.rule({
      when: (w) => w.state(state.collapseBlocked).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_BLOCKED)),
    });
    let pending: { cancel(): void } | null = null;
    let mounted = false;
    const refresh = (run: RunHandle<LiquidGlassAccordionTriggerProps>) => {
      if (!mounted) return;
      pending?.cancel();
      pending = delay(0, () => {
        pending = null;
        if (mounted) run.update();
      });
    };
    state.expanded.watch((run, event) => {
      if (event.type === 'next') refresh(run);
    });
    def.lifecycle.onMounted(() => {
      mounted = true;
    });
    def.lifecycle.onUnmounted(() => {
      mounted = false;
      pending?.cancel();
      pending = null;
    });
    def.lifecycle.onBeforeDispose(() => {
      mounted = false;
      pending?.cancel();
      pending = null;
    });
    return (r) => [
      r.slot(),
      r.el(
        'span',
        { style: tw('pointer-events-none ms-auto flex shrink-0 items-center') },
        r.svg.root(
          {
            viewBox: '0 0 24 24',
            width: '16',
            height: '16',
            'aria-hidden': 'true',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          },
          r.svg.path({ d: state.expanded.get() ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6' })
        )
      ),
    ];
  },
});

import { definePrototype, tw } from '@proto.ui/core';
import { asFormSubmit, type FormActionExposes } from '@proto.ui/prototypes-base/form';
import type { LiquidGlassFormActionProps } from './types';
// Passive liquid-glass Button paint; Base Form remains the sole action owner.
// Keep rules in the owning setup so source lowering can resolve the actual borrowed states.
export default definePrototype<LiquidGlassFormActionProps, FormActionExposes>({
  name: 'liquid-glass-form-submit',
  setup(def) {
    const inherited = asFormSubmit();
    const state = inherited.stateHandles!;
    def.props.define({
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ material: 'auto' });
    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-border px-5 py-2 text-sm font-medium whitespace-nowrap select-none cursor-pointer shadow-sm'
      )
    );
    def.feedback.style.use(tw('bg-primary text-primary-foreground'));
    def.rule({
      when: (w) => w.state(state.hovered).eq(true),
      intent: (i) => i.feedback.style.use(tw('shadow-md')),
    });
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('material').eq('auto'),
          w.state(state.disabled).eq(false),
          w.state(state.pressed).eq(false)
        ),
      intent: (i) =>
        i.feedback.material.use({
          intent: 'liquid-glass',
          variant: 'regular',
          deformation: { kind: 'press', phase: 'rest', contact: 'pointer' },
        }),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('material').eq('auto'),
          w.state(state.disabled).eq(false),
          w.state(state.pressed).eq(true)
        ),
      intent: (i) =>
        i.feedback.material.use({
          intent: 'liquid-glass',
          variant: 'regular',
          deformation: { kind: 'press', phase: 'pressed', contact: 'pointer' },
        }),
    });
    def.rule({
      when: (w) => w.state(state.pressed).eq(true),
      intent: (i) => i.feedback.style.use(tw('shadow-xs')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('outline-none ring-2 ring-ring ring-offset-2 ring-offset-background')
        ),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 pointer-events-none cursor-default')),
    });
    return inherited.render;
  },
});
